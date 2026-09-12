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
        assert.equal(lines.join("").match(/▀/g).length, (columns - 2) * 5);
        assert.ok(lines[rows - 7].includes("▀"));
        assert.ok(lines[rows - 3].includes("▀"));
        assert.equal(lines[rows - 2].indexOf("─"), 1);
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

const { scene, pose, weatherAt, menu } = require("../pet-scene");
test("pets traverse the available width, face travel direction and retain their original dimensions", () => {
  for (const pet of Object.keys(sprites.art)) {
    const width = Math.max(...sprites.art[pet].map((row) => row.length));
    const positions = Array.from({ length: 450 }, (_, frame) =>
      pose(pet, 120, frame),
    );
    assert.equal(Math.min(...positions.map((p) => p.x)), 0);
    assert.equal(Math.max(...positions.map((p) => p.x)), 118 - width);
    assert.ok(
      positions.some((p) => p.direction === 1) &&
        positions.some((p) => p.direction === -1),
    );
    for (const frame of [0, 40, 180]) {
      const s = scene({ pet, weather: "sun" }, 120, frame);
      assert.equal(s.height, 10);
      assert.equal(s.actor.width, width);
    }
  }
});
test("rain has moving drops; sunset has a warm sky; fire is visibly different and all fit five lines", () => {
  const base = { pet: "trex", weather: "rain" };
  const rain = scene(base, 80, 0),
    later = scene(base, 80, 1);
  assert.notDeepEqual(rain.grid, later.grid);
  assert.ok(rain.grid.flat().includes("#aacbeb"));
  const sunset = scene({ ...base, weather: "sunset" }, 80, 0);
  assert.ok(sunset.grid.flat().includes("#cb785e"));
  const fire = scene({ ...base, petFire: 10 }, 80, 0);
  assert.ok(fire.grid.flat().includes("#ed643d"));
  assert.ok(!rain.grid.flat().includes("#ed643d"));
  for (const s of [rain, later, sunset, fire]) assert.equal(s.grid.length, 10);
  assert.equal(weatherAt("auto", 0), "sun");
  assert.equal(weatherAt("auto", 120), "sunset");
  assert.equal(weatherAt("auto", 240), "rain");
});
test("the single-line pet menu shows fire and current weather even at minimum width", () => {
  for (const columns of [24, 40, 60, 100])
    for (const weather of ["sun", "rain", "sunset"]) {
      const line = menu({ pet: "trex", weather }, columns, 0);
      assert.ok(line.length <= columns);
      assert.match(line, /fire/i);
      assert.ok(line.toLowerCase().includes(weather));
      assert.ok(line.includes("?") && line.includes("m"));
    }
});
