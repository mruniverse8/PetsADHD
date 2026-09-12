const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  host = require("./host.cjs");
test("extension registers games, sidebar, safe webview and saved-state reopening", async () => {
  const h = host();
  assert.equal(Object.keys(h.commands).length, 4);
  assert.ok(h.providers["petsadhd.habitat"]);
  assert.ok(h.serializers["petsadhd.arcade"]);
  h.commands["petsadhd.duel"]();
  const p = h.panels[0];
  assert.match(p.webview.html, /Content-Security-Policy/);
  assert.match(p.webview.html, /script-src 'nonce-/);
  assert.doesNotMatch(p.webview.html, /unsafe-inline/);
  assert.match(p.webview.html, /"mode":"duel"/);
  const state = {
    version: 1,
    mode: "duel",
    games: { duel: { paused: true, hidden: true, players: [] } },
  };
  await p.receive({ type: "minimize", state });
  assert.ok(p.disposed);
  h.commands["petsadhd.open"]();
  assert.match(h.panels[1].webview.html, /"hidden":true/);
  assert.deepEqual(h.storage.get("arcade"), state);
});

test("Tetris and duel select the new track, and Invaders selects its own track", async () => {
  const h = host();
  h.commands["petsadhd.open"]();
  const p = h.panels[0];
  for (const mode of ["tetris", "duel"]) {
    await p.receive({ type: "music", mode, enabled: true, paused: false });
    assert.equal(
      h.tracks.at(-1),
      "https://www.youtube.com/watch?v=oor2uIqys8M",
    );
  }
  await p.receive({
    type: "music",
    mode: "invaders",
    enabled: true,
    paused: false,
  });
  assert.equal(h.tracks.at(-1), "https://www.youtube.com/watch?v=z0FRc-51_V4");
  assert.ok(
    h.tracks.includes("stop"),
    "old track stops before switching games",
  );
});
