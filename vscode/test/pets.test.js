const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { render } = require("../terminal-renderer");
const sprites = require("../media/pets");
const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, "");
test("pets use five pixel rows plus baseline and one menu row, regardless of old ASCII/large preferences", () => {
  for (const pet of Object.keys(sprites.art)) {
    const width = Math.max(...sprites.art[pet].map((row) => row.length));
    assert.ok(sprites.art[pet].length <= 10);
    for (const [columns, rows] of [
      [24, 7],
      [80, 8],
      [120, 40],
    ]) {
      for (const frame of [0, 12, 48, 100]) {
        const output = render(
          {
            mode: "pets",
            games: {},
            pet,
            weather: "sun",
            petStyle: "line",
            petSize: "large",
          },
          { columns, rows },
          frame,
        );
        const lines = output.lines.map(plain);
        assert.ok(output.playable);
        assert.equal(lines.filter((line) => line.includes("▀")).length, 5);
        assert.equal(lines.join("").match(/▀/g).length, width * 5);
        assert.ok(lines[rows - 7].includes("▀"));
        assert.ok(lines[rows - 3].includes("▀"));
        assert.equal(lines[rows - 2].indexOf("─"), columns - 21);
        assert.ok(
          lines.at(-1).includes("1") &&
            lines.at(-1).includes("4") &&
            lines.at(-1).includes("?"),
        );
        assert.ok(
          lines.slice(0, rows - 7).every((line) => !line.trim()),
          "no extra title/status rows",
        );
      }
    }
  }
});
test("the arcade chooser fits on exactly one line at narrow and wide sizes", () => {
  for (const [columns, rows] of [
    [24, 7],
    [40, 8],
    [100, 40],
  ]) {
    const lines = render(
      { mode: "menu", games: {} },
      { columns, rows },
    ).lines.map(plain);
    assert.equal(lines.filter((line) => line.trim()).length, 1);
    for (const key of ["1", "2", "3", "4", "m", "?"])
      assert.ok(lines.at(-1).includes(key));
  }
});
