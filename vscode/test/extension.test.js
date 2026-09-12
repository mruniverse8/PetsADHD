const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  host = require("./host.cjs");
const { Terminal } = require("@xterm/headless");
const write = (terminal, value) =>
  new Promise((resolve) => terminal.write(value, resolve));
test("pet music defaults, toggle, minimize/resume, custom track and workspace trust", async (t) => {
  const h = host();
  t.after(h.dispose);
  h.config["panel.autoSize"] = false;
  await h.commands["petsadhd.pets"]();
  const p = h.terminals[0].options.pty;
  assert.equal(h.tracks.at(-1), "https://www.youtube.com/watch?v=5vaaOqLHxrE");
  p.handleInput("m");
  assert.equal(h.tracks.at(-1), "pause");
  await h.commands["petsadhd.pets"]();
  assert.equal(h.tracks.at(-1), "https://www.youtube.com/watch?v=5vaaOqLHxrE");
  p.handleInput("M");
  assert.equal(p.state.musicOn, false);
  assert.equal(h.tracks.at(-1), "stop");
  h.config["pets.musicUrl"] = "https://example.com/custom-pet-track";
  p.handleInput("M");
  assert.equal(h.tracks.at(-1), "https://example.com/custom-pet-track");
  h.api.workspace.isTrusted = false;
  p.redraw();
  assert.equal(h.tracks.at(-1), "stop");
});
test("native terminal panel: shared keys, speed, minimize/resume, saved reopening and docking", async (t) => {
  const h = host();
  t.after(h.dispose);
  await h.commands["petsadhd.duel"]();
  const terminal = h.terminals[0],
    p = terminal.options.pty;
  assert.equal(terminal.options.location, h.api.TerminalLocation.Panel);
  assert.equal(terminal.options.isTransient, true);
  assert.ok(h.executed.includes("workbench.action.positionPanelBottom"));
  assert.ok(h.executed.includes("workbench.action.alignPanelRight"));
  p.handleInput("f\r+");
  assert.deepEqual(
    p.current().players.map((s) => [s.locks, s.speed]),
    [
      [1, 2],
      [1, 2],
    ],
  );
  const before = structuredClone(p.current());
  p.handleInput("m");
  assert.equal(terminal.visible, false);
  p.tick();
  assert.deepEqual(p.current(), before);
  await h.commands["petsadhd.open"]();
  assert.equal(h.terminals.length, 1);
  assert.equal(terminal.visible, true);
  assert.deepEqual(p.current(), before);
  p.tick();
  assert.notDeepEqual(p.current(), before);
  await h.commands["petsadhd.position"]();
  assert.equal(h.config["panel.position"], "right");
  assert.equal(h.executed.at(-1), "workbench.action.positionPanelRight");
  const saved = structuredClone(p.state);
  terminal.dispose();
  assert.equal(p.ready, false);
  await h.commands["petsadhd.open"]();
  assert.equal(h.terminals.length, 2);
  assert.deepEqual(h.terminals[1].options.pty.state, saved);
});
test("resize and focus pause simulation; fragmented arrows, a fire, tracks and explicit quit", async (t) => {
  const h = host();
  t.after(h.dispose);
  delete h.config["music.url"]; // Exercise the extension's default fallback.
  await h.commands["petsadhd.tetris"]();
  const p = h.terminals[0].options.pty;
  assert.equal(h.tracks.at(-1), "https://www.youtube.com/watch?v=5vaaOqLHxrE");
  const x = p.current().piece.x;
  p.handleInput("\x1b[");
  assert.equal(p.current().piece.x, x);
  p.handleInput("C");
  assert.equal(p.current().piece.x, x + 1);
  p.handleInput("\x1b[200~rrqf\x1b[201~");
  assert.equal(p.state.mode, "tetris");
  p.setDimensions({ columns: 10, rows: 5 });
  const before = structuredClone(p.current());
  p.tick();
  p.handleInput(" ");
  assert.deepEqual(p.current(), before);
  p.setDimensions({ columns: 80, rows: 24 });
  h.editor.fire({});
  p.tick();
  assert.deepEqual(p.current(), before);
  p.handleInput("p");
  p.tick();
  assert.equal(p.current().paused, true);
  p.handleInput("m");
  await h.commands["petsadhd.open"]();
  assert.equal(p.current().paused, true);
  await h.commands["petsadhd.invaders"]();
  assert.equal(h.tracks.at(-1), "https://www.youtube.com/watch?v=5vaaOqLHxrE");
  p.handleInput("a");
  assert.equal(p.current().shots.length, 1);
  p.handleInput("q");
  assert.equal(p.state.mode, "menu");
  assert.equal(p.state.games.invaders, undefined);
  assert.deepEqual(p.state.games.tetris, { ...before, paused: true });
});
test("ANSI output renders in xterm without scrolling at bottom and side sizes", async (t) => {
  const h = host();
  t.after(h.dispose);
  await h.commands["petsadhd.duel"]();
  const terminal = h.terminals[0],
    p = terminal.options.pty;
  for (const [cols, rows] of [
    [90, 30],
    [56, 16],
    [28, 28],
  ]) {
    const xterm = new Terminal({ cols, rows, allowProposedApi: true });
    terminal.output = "";
    p.setDimensions({ columns: cols, rows });
    await write(xterm, "\x1b[?1049h\x1b[?7l" + terminal.output);
    const lines = Array.from({ length: rows }, (_, i) =>
      xterm.buffer.active.getLine(i).translateToString(true),
    );
    assert.ok(p.playable, `${cols}x${rows} playable`);
    assert.ok(lines.some((line) => line.includes("PLAYER 1")));
    assert.ok(lines.some((line) => line.includes("PLAYER 2")));
    assert.match(lines.at(-1), /Tab menu/);
    assert.equal(xterm.buffer.active.baseY, 0);
    assert.equal(xterm.buffer.active.length, rows);
    let coloredPixels = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const c = xterm.buffer.active.getLine(y).getCell(x);
        if (
          c.getChars() === "▀" &&
          (c.getFgColor() !== 0x101725 || c.getBgColor() !== 0x101725)
        )
          coloredPixels++;
      }
    assert.ok(coloredPixels > 8, "tetromino pixels have true colors");
    xterm.dispose();
  }
});
test("upgrade imports a minimized board and shutdown disposes the terminal", async () => {
  const E = require("../media/engine"),
    game = E.tetris({ seed: 42 });
  E.input(game, "drop");
  game.hidden = true;
  game.wasPaused = false;
  game.paused = true;
  const h = host({ version: 1, mode: "tetris", games: { tetris: game } });
  try {
    await h.commands["petsadhd.open"]();
    const p = h.terminals[0].options.pty;
    assert.equal(p.current().locks, 1);
    assert.equal(p.current().paused, false);
  } finally {
    h.dispose();
  }
  assert.ok(h.terminals[0].disposed);
});

test("game shortcut starts Tetris and resumes the last game after pets or minimizing", async (t) => {
  const h = host();
  t.after(h.dispose);
  await h.commands["petsadhd.play"]();
  const p = h.terminals[0].options.pty;
  assert.equal(p.state.mode, "tetris");
  assert.ok(h.executed.includes("workbench.action.positionPanelBottom"));
  assert.ok(h.executed.includes("workbench.action.alignPanelRight"));
  await h.commands["petsadhd.invaders"]();
  p.handleInput("a");
  await h.commands["petsadhd.pets"]();
  const before = structuredClone(p.state.games.invaders);
  assert.equal(p.state.mode, "pets");
  p.handleInput("m");
  await h.commands["petsadhd.play"]();
  assert.equal(h.terminals.length, 1);
  assert.equal(p.state.mode, "invaders");
  assert.deepEqual(p.current(), before);
  assert.equal(h.terminals[0].visible, true);
});

test("inline navigation selects games from pets and preserves a board through the one-line menu", async (t) => {
  const h = host();
  t.after(h.dispose);
  h.config["panel.autoSize"] = false;
  await h.commands["petsadhd.pets"]();
  const p = h.terminals[0].options.pty;
  p.handleInput("2 ");
  assert.equal(p.state.mode, "tetris");
  const board = structuredClone(p.current());
  assert.equal(board.locks, 1);
  p.handleInput("1\t2");
  assert.equal(p.state.mode, "tetris");
  assert.deepEqual(p.current(), board);
  p.handleInput("3");
  assert.equal(p.state.mode, "duel");
  p.handleInput("4");
  assert.equal(p.state.mode, "invaders");
});

test("pet fire and walking freeze on hide; the sky stays sunset and pixel size resumes", async (t) => {
  const h = host();
  t.after(h.dispose);
  h.config["panel.autoSize"] = false;
  await h.commands["petsadhd.pets"]();
  const p = h.terminals[0].options.pty;
  p.handleInput("wwwa");
  assert.equal(p.state.weather, "sunset");
  assert.equal(p.state.petFire, 10);
  p.tick();
  assert.equal(p.state.petFire, 9);
  const frame = p.state.petFrame;
  p.handleInput("m");
  p.tick();
  assert.equal(p.state.petFrame, frame);
  assert.equal(p.state.petFire, 9);
  await h.commands["petsadhd.pets"]();
  p.tick();
  assert.equal(p.state.petFire, 8);
  assert.equal(p.state.petFrame, frame + 1);
  p.handleInput("ws");
  assert.equal(p.state.weather, "sunset");
  assert.equal(p.state.pixelSize, 2);
});

test("n selects dog and cow by name and persists cow plus a chosen chunky pixel size", async (t) => {
  const h = host();
  t.after(h.dispose);
  h.config["panel.autoSize"] = false;
  await h.commands["petsadhd.pets"]();
  const p = h.terminals[0].options.pty;
  p.handleInput("n");
  assert.equal(p.state.pet, "dog");
  p.handleInput("ns");
  assert.equal(p.state.pet, "cow");
  assert.equal(p.state.pixelSize, 2);
  h.terminals[0].dispose();
  await h.commands["petsadhd.pets"]();
  const restored = h.terminals[1].options.pty;
  assert.equal(restored.state.pet, "cow");
  assert.equal(restored.state.pixelSize, 2);
  assert.equal(restored.state.weather, "sunset");
});

test("upgrade adopts small pixels and e starts an event that pauses and restores", async (t) => {
  const h = host({
    mode: "pets",
    pet: "cow",
    weather: "night",
    pixelSize: 2,
    games: {},
  });
  t.after(h.dispose);
  h.config["panel.autoSize"] = false;
  await h.commands["petsadhd.pets"]();
  const p = h.terminals[0].options.pty;
  assert.equal(p.state.pixelSize, 1);
  assert.equal(p.state.weather, "sunset");
  p.handleInput("e");
  const event = structuredClone(p.state.spaceEvent);
  assert.ok(event && event.start === p.state.petFrame);
  p.handleInput("m");
  p.tick();
  assert.deepEqual(p.state.spaceEvent, event);
  assert.equal(p.state.petFrame, event.start);
  h.terminals[0].dispose();
  await h.commands["petsadhd.pets"]();
  assert.deepEqual(h.terminals[1].options.pty.state.spaceEvent, event);
});
