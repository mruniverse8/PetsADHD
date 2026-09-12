const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fitPanel } = require("../panel");
function fixture(position = "right") {
  const terminal = {},
    calls = [];
  const session = {
    focused: true,
    hasDimensions: true,
    dimensions: { columns: 32, rows: 16 },
    redraw() {},
  };
  const vscode = {
    window: { activeTerminal: terminal },
    commands: {
      async executeCommand(name) {
        calls.push(name);
        if (
          [
            "workbench.action.increaseViewSize",
            "workbench.action.decreaseViewSize",
          ].includes(name)
        ) {
          assert.equal(
            session.sizing,
            true,
            "game stays suspended while fitting",
          );
          session.dimensions[
            position.startsWith("bottom") ? "rows" : "columns"
          ] += name === "workbench.action.increaseViewSize" ? 6 : -6;
        }
      },
    },
  };
  const options = { autoSize: true, position, columns: 72, rows: 28 };
  return {
    terminal,
    session,
    vscode,
    calls,
    options,
    fit: (wait) =>
      fitPanel(vscode, terminal, session, options, wait || (async () => {})),
  };
}
test("auto sizing waits for delayed PTY open/focus, then grows the right panel to readable width", async () => {
  const f = fixture();
  f.session.hasDimensions = false;
  f.vscode.window.activeTerminal = undefined;
  let waits = 0;
  await f.fit(async () => {
    if (++waits === 2) {
      f.session.hasDimensions = true;
      f.vscode.window.activeTerminal = f.terminal;
    }
  });
  assert.ok(f.session.dimensions.columns >= 72);
  assert.equal(
    f.session.dimensions.rows,
    16,
    "side panel height belongs to the window",
  );
  assert.equal(f.calls[0], "workbench.action.terminal.focus");
  assert.equal(f.session.sizing, false);
  const before = f.calls.length;
  await f.fit();
  assert.equal(
    f.calls.length,
    before,
    "reopening never keeps growing an already spacious panel",
  );
});
test("bottom panel grows vertically; existing larger sizes and opt-out are respected", async () => {
  const f = fixture("bottom");
  await f.fit();
  assert.equal(f.session.dimensions.rows, 28);
  assert.equal(f.session.dimensions.columns, 32);
  f.session.dimensions.rows = 40;
  const count = f.calls.length;
  await f.fit();
  assert.equal(f.calls.length, count);
  f.options.autoSize = false;
  f.session.dimensions.rows = 10;
  await f.fit();
  assert.equal(f.calls.length, count);
});
test("stop at window constraints and do not resize another terminal after focus changes", async () => {
  const limited = fixture();
  limited.vscode.commands.executeCommand = async (name) =>
    limited.calls.push(name);
  await limited.fit();
  assert.equal(
    limited.calls.filter((n) => n === "workbench.action.increaseViewSize")
      .length,
    1,
  );
  const unfocused = fixture();
  await unfocused.fit(async () => {
    unfocused.vscode.window.activeTerminal = {};
  });
  assert.deepEqual(unfocused.calls, []);
  assert.equal(unfocused.session.sizing, false);
});
test("docking dimensions replace the old wide bottom-panel measurement before fitting", async () => {
  const f = fixture();
  f.session.dimensions.columns = 100;
  await f.fit(async () => {
    f.session.dimensions.columns = 32;
  });
  assert.ok(f.session.dimensions.columns >= 72);
});

test("small pets shrink a bottom-right panel, then games regain their playable height", async () => {
  const f = fixture("bottom-right");
  f.session.dimensions.rows = 38;
  f.options.rows = 8;
  f.options.shrink = true;
  await f.fit();
  assert.equal(f.session.dimensions.rows, 8);
  assert.ok(f.calls.includes("workbench.action.decreaseViewSize"));
  f.options.rows = 28;
  f.options.shrink = false;
  await f.fit();
  assert.ok(f.session.dimensions.rows >= 28);
});

test("a shrink step that clips the pet is reversed once without oscillating", async () => {
  const f = fixture("bottom-right");
  f.session.dimensions.rows = 24;
  f.options.rows = 8;
  f.options.shrink = true;
  await f.fit();
  assert.equal(f.session.dimensions.rows, 12);
  assert.equal(
    f.calls.filter((c) => c === "workbench.action.increaseViewSize").length,
    1,
  );
});
