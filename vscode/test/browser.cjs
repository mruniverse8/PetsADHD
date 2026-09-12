const { chromium } = require("playwright-core");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const host = require("./host.cjs");
(async () => {
  const h = host();
  h.commands["petsadhd.open"]();
  const dir = fs.mkdtempSync(path.join(os.homedir(), "petsadhd-webview-")),
    file = path.join(dir, "index.html");
  fs.writeFileSync(file, h.panels[0].webview.html);
  const browser = await chromium.launch({
    executablePath: process.env.PETSADHD_CHROMIUM || "/snap/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const errors = [];
    async function page(saved) {
      const p = await browser.newPage({
        viewport: { width: 1100, height: 850 },
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.addInitScript((value) => {
        window.__saved = value;
        window.__messages = [];
        window.acquireVsCodeApi = () => ({
          getState: () => window.__saved,
          setState: (s) => (window.__saved = s),
          postMessage: (m) => window.__messages.push(m),
        });
      }, saved);
      await p.goto("file://" + file);
      return p;
    }
    let p = await page(null);
    await p.locator('[data-mode="tetris"]').click();
    await p.locator("#speed").selectOption("8");
    await p.locator("#screen").press("Space");
    const before = await p.evaluate(() => window.__saved.games.tetris.locks);
    assert.equal(before, 1);
    await p.locator("#screen").press("m");
    const saved = await p.evaluate(
      () => window.__messages.findLast((m) => m.type === "minimize").state,
    );
    assert.ok(saved.games.tetris.hidden);
    await p.close();
    p = await page(saved);
    assert.equal(await p.locator("#speed").inputValue(), "8");
    await p.locator("#screen").press("p");
    const after = await p.evaluate(() => window.__saved.games.tetris);
    assert.equal(after.locks, 1);
    await p.locator('[data-mode="duel"]').click();
    await p.locator("#screen").press("f");
    await p.locator("#screen").press("Enter");
    const duel = await p.evaluate(() => window.__saved.games.duel);
    assert.equal(duel.players[0].locks, 1);
    assert.equal(duel.players[1].locks, 1);
    await p.screenshot({ path: path.resolve("media/preview.png") });
    await p.locator('[data-mode="invaders"]').click();
    await p.locator("#screen").press("a");
    assert.ok(
      (await p.evaluate(() => window.__saved.games.invaders.shots.length)) > 0,
    );
    await p.setViewportSize({ width: 420, height: 700 });
    assert.ok((await p.locator("#screen").boundingBox()).width < 420);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: actual Chromium webview, both player controls, speed, saved-state resume, shooting and responsive canvas",
    );
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
