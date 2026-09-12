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

const { scene, pose, pixelSize, menu } = require("../pet-scene");
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
test("detailed sunset has clouds, mountains, water and changing reflections regardless of old weather", () => {
  for (const weather of ["auto", "sun", "sunset", "rain", "night"]) {
    const sky = scene({ pet: "dog", weather, spaceSeed: 1 }, 120, 0);
    assert.equal(sky.weather, "sunset");
    assert.equal(sky.grid.length, 10);
    assert.ok(
      new Set(sky.grid.flat()).size > 60,
      "glow and clouds have varied colors",
    );
    assert.ok(sky.grid.flat().includes("#66536b"), "mountain ridgeline");
    assert.ok(sky.grid.flat().includes("#ffc58b"), "water reflections");
    assert.deepEqual(
      sky.grid,
      scene({ pet: "dog", spaceSeed: 1 }, 120, 0).grid,
    );
  }
  assert.notDeepEqual(
    scene({ pet: "dog" }, 120, 0).grid,
    scene({ pet: "dog" }, 120, 8).grid,
  );
  assert.ok(
    scene({ pet: "cow", petFire: 10 }, 120, 0).grid.flat().includes("#ed643d"),
  );
});
test("dog and cow have distinct original sprites in two pixel sizes, each at most five lines high", () => {
  for (const pet of ["dog", "cow"])
    for (const size of [1, 2]) {
      const source = size === 2 ? sprites.chunky[pet] : sprites.art[pet];
      assert.equal(source.length * size, 10);
      assert.ok(Math.max(...source.map((row) => row.length)) * size <= 22);
      const s = scene({ pet, pixelSize: size }, 24, 0);
      assert.equal(s.actor.scale, size);
      assert.ok(s.actor.x >= 0 && s.actor.x + s.actor.width <= 22);
      assert.equal(s.height, 10);
    }
  assert.notDeepEqual(sprites.art.dog, sprites.art.cow);
  assert.ok(sprites.chunky.dog.join("").includes("T"), "teal collar");
  assert.ok(sprites.chunky.cow.join("").includes("P"), "pink muzzle");
  assert.equal(pixelSize(undefined), 1);
});
test("single-line menu includes event, pixel-size controls and sunset at every supported width", () => {
  for (const columns of [24, 40, 60, 120]) {
    const line = menu({ pet: "cow", pixelSize: 2 }, columns, 0);
    assert.ok(line.length <= columns);
    assert.ok(line.includes("a") && line.includes("e"));
    assert.match(line, /sunset/i);
    assert.ok(line.includes("s") && line.includes("?") && line.includes("m"));
    assert.doesNotMatch(line, /w sky|night|rain/);
  }
});
