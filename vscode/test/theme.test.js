const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { Terminal } = require("@xterm/headless"),
  host = require("./host.cjs");
const { render } = require("../terminal-renderer");
const E = require("../media/engine");
const { palette } = require("../terminal-theme");
const { spawn } = require("node:child_process");
const write = (terminal, data) =>
  new Promise((resolve) => terminal.write(data, resolve));
const luminance = (color) =>
  [16, 8, 0].reduce((sum, shift, i) => {
    const c = ((color >> shift) & 255) / 255;
    return (
      sum +
      [0.2126, 0.7152, 0.0722][i] *
        (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    );
  }, 0);
const readable = (fg, bg, minimum) => {
  const a = luminance(fg),
    b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= minimum;
};
test("actual ANSI frames keep text and game pixels legible on light, dark and medium themes", async () => {
  for (const theme of [
    { background: "#f3ead3", foreground: "#5c6a72" },
    { background: "#fffbef", foreground: "#5c6a72" },
    { background: "#fbf1c7", foreground: "#3c3836" },
    { background: "#222436", foreground: "#c8d3f5" },
    { background: "#333c43", foreground: "#d3c6aa" },
    { background: "#ffffff", foreground: "#f0f0f0" },
    { background: "#000000", foreground: "#050505" },
    { background: "#777777", foreground: "#888888" },
  ]) {
    const bg = parseInt(theme.background.slice(1), 16);
    for (const mode of ["pets", "menu", "tetris", "duel", "invaders"]) {
      const state = { mode, games: {}, pet: "cow", spaceSeed: 1 };
      if (E[mode]) state.games[mode] = E[mode]({ seed: 42 });
      const frame = render(state, { columns: 90, rows: 30 }, 0, false, theme);
      const terminal = new Terminal({
        cols: 90,
        rows: 30,
        allowProposedApi: true,
      });
      try {
        await write(terminal, "\x1b[?1049h\x1b[?7l" + frame.lines.join("\r\n"));
        assert.ok(frame.playable);
        let text = 0,
          pixels = 0;
        for (let y = 0; y < 30; y++)
          for (let x = 0; x < 90; x++) {
            const cell = terminal.buffer.active.getLine(y).getCell(x);
            const ch = cell.getChars();
            if (!ch || ch === " ") continue;
            if (ch === "▀" || ch === "█") {
              if (mode === "pets" || mode === "menu") continue; // Original sunset/sprite artwork is preserved.
              if (cell.getFgColor() === bg && cell.getBgColor() === bg)
                continue; // Empty half-block cell.
              assert.ok(
                [cell.getFgColor(), cell.getBgColor()].some((c) =>
                  readable(c, bg, 3),
                ),
                `${mode} pixel on ${theme.background}`,
              );
              pixels++;
            } else {
              assert.equal(
                cell.getBgColor(),
                bg,
                "UI text uses the host background",
              );
              assert.ok(
                readable(cell.getFgColor(), bg, ch === "│" ? 3 : 4.5),
                `${mode} text on ${theme.background}`,
              );
              text++;
            }
          }
        assert.ok(text > 0);
        if (E[mode]) assert.ok(pixels > 8);
      } finally {
        terminal.dispose();
      }
    }
  }
});
test("theme OSC is fragmented safely, ignored inside paste, and refreshes hidden sessions without game input", async (t) => {
  const h = host();
  t.after(h.dispose);
  h.config["panel.autoSize"] = false;
  await h.commands["petsadhd.tetris"]();
  const pty = h.terminals[0].options.pty;
  clearInterval(pty.timer);
  const saved = structuredClone(pty.state);
  const light = { background: "#fbf1c7", foreground: "#3c3836" };
  const sequence = "\x1b]51;PetsADHDTheme;" + JSON.stringify(light) + "\x07";
  for (const char of sequence) pty.handleInput(char);
  assert.equal(pty.theme.background, light.background);
  assert.deepEqual(
    pty.state,
    saved,
    "theme payload must not act as gameplay input",
  );
  pty.handleInput("\x1b[200~\x1b]51;PetsADHDTheme;{}\x07\x1b[201~");
  pty.handleInput("\x1b]51;PetsADHDTheme;{broken}\x07");
  pty.handleInput(
    '\x1b]51;PetsADHDTheme;{"background":"oops","foreground":"#000000"}\x07',
  );
  pty.handleInput("\x1b]other;m234nr\x1b\\");
  assert.equal(pty.theme.background, light.background);
  assert.deepEqual(pty.state, saved);
  const dark = { background: "#222436", foreground: "#c8d3f5" };
  pty.handleInput("m2\x1b]51;PetsADHDTheme;" + JSON.stringify(dark) + "\x1b\\");
  assert.ok(pty.hidden);
  assert.equal(pty.theme.background, dark.background);
  assert.deepEqual(
    pty.state,
    saved,
    "theme control works even after minimize in the same chunk",
  );
  await h.commands["petsadhd.open"]();
  assert.deepEqual(pty.state, saved);
  assert.equal(pty.theme.background, dark.background);
  assert.equal(palette({ background: "invalid" }).background, "#101725");
});
test("VS Code light/dark and high contrast theme events refresh the same terminal and preserve focus/state", async (t) => {
  const h = host();
  t.after(h.dispose);
  h.config["panel.autoSize"] = false;
  h.api.window.activeColorTheme = { kind: h.api.ColorThemeKind.Light };
  await h.commands["petsadhd.duel"]();
  const pty = h.terminals[0].options.pty;
  clearInterval(pty.timer);
  assert.equal(pty.theme.background, "#f5f5f5");
  pty.setFocused(false);
  const saved = structuredClone(pty.state);
  for (const [kind, bg] of [
    [2, "#101725"],
    [4, "#f5f5f5"],
    [3, "#101725"],
    [1, "#f5f5f5"],
  ]) {
    h.api.window.activeColorTheme = { kind };
    h.theme.fire({ kind });
    assert.equal(pty.theme.background, bg);
    assert.equal(pty.focused, false);
    assert.deepEqual(pty.state, saved);
    assert.equal(h.terminals.length, 1);
  }
});
test(
  "native CLI forwards fragmented theme controls and applies updates received while hidden",
  { timeout: 5000 },
  async (t) => {
    const child = spawn(
      process.execPath,
      [require.resolve("../terminal-cli")],
      {
        env: {
          ...process.env,
          PETSADHD_TERMINAL: JSON.stringify({ music: false }),
        },
      },
    );
    t.after(() => child.kill());
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    const waitFor = (needle) =>
      new Promise((resolve, reject) => {
        const deadline = Date.now() + 3000;
        const timer = setInterval(() => {
          if (output.includes(needle)) {
            clearInterval(timer);
            resolve();
          } else if (Date.now() > deadline) {
            clearInterval(timer);
            reject(new Error("Missing CLI output: " + needle));
          }
        }, 10);
      });
    await waitFor("\x1b[48;2;16;23;37m");
    output = "";
    child.stdin.write('\x1b]51;PetsADHDTheme;{"background":"#fbf1c7",');
    await new Promise((resolve) => setTimeout(resolve, 20));
    child.stdin.write('"foreground":"#3c3836"}\x07');
    await waitFor("\x1b[48;2;251;241;199m");
    child.stdin.write(
      '\x0f\x1b]51;PetsADHDTheme;{"background":"#222436","foreground":"#c8d3f5"}\x07',
    );
    output = "";
    child.stdin.write("\x12");
    await waitFor("\x1b[48;2;34;36;54m");
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.stdin.end("\x1e");
    assert.equal(await exited, 0);
  },
);
