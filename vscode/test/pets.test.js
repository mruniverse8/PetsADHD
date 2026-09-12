const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { render } = require("../terminal-renderer");
const sprites = require("../media/pets");
const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, "");
const state = (pet) => ({ mode: "pets", games: {}, pet, weather: "sun" });
test("default pets are one line at minimum and large terminal sizes, even with old large settings", () => {
  for (const pet of Object.keys(sprites.art)) {
    for (const [columns, rows] of [
      [24, 6],
      [80, 8],
      [120, 40],
    ]) {
      const output = render(
        { ...state(pet), petSize: "large" },
        { columns, rows },
      );
      const lines = output.lines.map(plain);
      assert.ok(output.playable);
      assert.ok(lines[rows - 4].includes(sprites.lines[pet]));
      assert.equal(
        lines.filter((line) => line.includes(sprites.lines[pet])).length,
        1,
      );
      assert.ok(lines.every((line) => !line.includes("▀")));
      assert.equal(lines[rows - 3].indexOf("─"), columns - 21);
    }
  }
});
test("pixel companions stay at three terminal lines and preserve every sprite pixel during animation", () => {
  for (const pet of Object.keys(sprites.art)) {
    for (const [columns, rows] of [
      [24, 8],
      [120, 40],
    ]) {
      for (const frame of [0, 12, 48, 100]) {
        const output = render(
          { ...state(pet), petStyle: "pixels" },
          { columns, rows },
          frame,
        );
        const lines = output.lines.map(plain);
        assert.ok(output.playable);
        assert.equal(lines.filter((line) => line.includes("▀")).length, 3);
        assert.equal(
          lines.join("").match(/▀/g).length,
          sprites.art[pet][0].length * 3,
        );
        assert.ok(lines[rows - 6].includes("▀"));
        assert.ok(lines[rows - 4].includes("▀"));
      }
    }
  }
});
