const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { render } = require("../terminal-renderer");
const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, "");
test("small pets stay compact at the bottom right as terminal dimensions grow", () => {
  for (const pet of ["trex", "dog", "duck", "sixseven"]) {
    const state = {
      mode: "pets",
      games: {},
      pet,
      weather: "sun",
      petSize: "small",
    };
    const compact = render(state, { columns: 80, rows: 16 });
    const spacious = render(state, { columns: 120, rows: 40 });
    assert.ok(compact.playable && spacious.playable);
    const a = compact.lines.map(plain),
      b = spacious.lines.map(plain);
    assert.equal(a.join("").match(/▀/g).length, 400);
    assert.equal(
      b.join("").match(/▀/g).length,
      400,
      "larger terminal does not enlarge pet",
    );
    assert.equal(b[27].indexOf("▀"), 79);
    assert.ok(b.slice(0, 27).every((line) => !line.includes("▀")));
    const large = render(
      { ...state, petSize: "large" },
      { columns: 120, rows: 40 },
    );
    assert.ok(large.lines.map(plain).join("").match(/▀/g).length > 400);
    assert.ok(render(state, { columns: 28, rows: 15 }).playable);
  }
});
