// Visual check of the same ANSI stream used by the native VS Code terminal.
// This harness is excluded from the VSIX; the extension never opens a browser.
const { chromium } = require("playwright-core");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const host = require("./host.cjs");
(async () => {
  const h = host();
  h.config["panel.autoSize"] = false;
  await h.commands["petsadhd.duel"]();
  const t = h.terminals[0],
    pty = t.options.pty;
  clearInterval(pty.timer);
  const dir = fs.mkdtempSync(path.join(os.homedir(), "petsadhd-terminal-"));
  fs.writeFileSync(
    path.join(dir, "index.html"),
    '<!doctype html><meta charset="utf-8"><title>PetsADHD terminal renderer test</title><style>body{background:#101725;margin:20px}#terminal{width:max-content}</style><div id="terminal"></div>',
  );
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PETSADHD_CHROMIUM || "/snap/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1060, height: 650 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.exposeFunction("input", (data) => {
      t.output = "";
      pty.handleInput(data);
      return t.output;
    });
    await page.goto("file://" + path.join(dir, "index.html"));
    await page.addStyleTag({
      path: require.resolve("@xterm/xterm/css/xterm.css"),
    });
    await page.addScriptTag({ path: require.resolve("@xterm/xterm") });
    await page.evaluate(() => {
      window.term = new Terminal({
        cols: 90,
        rows: 30,
        fontSize: 17,
        fontFamily: "monospace",
        theme: { background: "#101725", foreground: "#cad7e5" },
      });
      term.open(document.querySelector("#terminal"));
      term.onData((data) => {
        window.inputDone = window
          .input(data)
          .then(
            (output) => new Promise((resolve) => term.write(output, resolve)),
          );
      });
      term.focus();
    });
    await page.evaluate(
      (output) => new Promise((resolve) => term.write(output, resolve)),
      t.output,
    );
    for (const key of ["f", "Enter", "ArrowLeft", "+"]) {
      await page.keyboard.press(key);
      await page.evaluate(() => window.inputDone);
    }
    assert.deepEqual(
      pty.current().players.map((p) => [p.locks, p.speed]),
      [
        [1, 2],
        [1, 2],
      ],
    );
    await page
      .locator("#terminal")
      .screenshot({ path: path.resolve("media/preview.png") });
    const saved = structuredClone(pty.current());
    await page.keyboard.press("m");
    await page.evaluate(() => window.inputDone);
    pty.tick();
    assert.deepEqual(pty.current(), saved);
    await h.commands["petsadhd.open"]();
    assert.deepEqual(pty.current(), saved);
    for (const [mode, columns, rows] of [
      ["duel", 28, 28],
      ["tetris", 42, 26],
      ["invaders", 68, 18],
      ["pets", 80, 8],
    ]) {
      pty.select(mode);
      t.output = "";
      pty.setDimensions({ columns, rows });
      assert.ok(pty.playable);
      await page.evaluate(
        ({ output, columns, rows }) => {
          term.resize(columns, rows);
          return new Promise((resolve) => term.write(output, resolve));
        },
        { output: t.output, columns, rows },
      );
      if (mode === "invaders") {
        await page.keyboard.press("a");
        await page.evaluate(() => window.inputDone);
        assert.equal(pty.current().shots.length, 1);
      }
      await page
        .locator("#terminal")
        .screenshot({ path: `/tmp/petsadhd-${mode}-terminal.png` });
    }
    await page.keyboard.press("Tab");
    await page.evaluate(() => window.inputDone);
    assert.equal(pty.state.mode, "menu");
    await page
      .locator("#terminal")
      .screenshot({ path: "/tmp/petsadhd-menu-terminal.png" });
    await page.keyboard.press("1");
    await page.evaluate(() => window.inputDone);
    assert.equal(pty.state.mode, "pets");
    for (const key of ["w", "w", "w", "a"]) {
      await page.keyboard.press(key);
      await page.evaluate(() => window.inputDone);
    }
    assert.equal(pty.state.weather, "sunset");
    assert.equal(pty.state.petFire, 10);
    await page
      .locator("#terminal")
      .screenshot({ path: path.resolve("media/pets-preview.png") });
    for (const key of ["w", "w", "w", "n"]) {
      await page.keyboard.press(key);
      await page.evaluate(() => window.inputDone);
    }
    assert.equal(pty.state.weather, "rain");
    assert.equal(pty.state.petFire, 0);
    await page
      .locator("#terminal")
      .screenshot({ path: path.resolve("media/rain-preview.png") });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: xterm pixels, shared-keyboard controls, minimize/resume, stacked side layout, solo Tetris, a fire and pets",
    );
  } finally {
    h.dispose();
    await browser?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
