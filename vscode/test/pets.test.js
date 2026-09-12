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
    const width = Math.max(...sprites.chunky[pet].map((row) => row.length)) * 2;
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
test("night sky always has stars, Saturn rings and a galaxy, even with legacy weather settings", () => {
  for (const weather of ["auto", "sun", "sunset", "rain", "night"]) {
    const sky = scene({ pet: "dog", weather }, 120, 0);
    assert.equal(sky.weather, "night");
    assert.equal(sky.grid.length, 10);
    assert.ok(sky.grid.flat().includes("#ecf2ff"));
    assert.ok(sky.grid.flat().includes("#bfa485"));
    assert.ok(sky.grid.flat().includes("#eee1ff"));
    assert.deepEqual(
      sky.grid,
      scene({ pet: "dog", weather: "night" }, 120, 0).grid,
    );
  }
  assert.notDeepEqual(
    scene({ pet: "dog" }, 120, 0).grid,
    scene({ pet: "dog" }, 120, 8).grid,
  );
  const fire = scene({ pet: "cow", petFire: 10 }, 120, 0);
  assert.ok(fire.grid.flat().includes("#ed643d"));
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
  assert.equal(pixelSize(undefined), 2);
});
test("single-line menu includes fire, pixel-size controls and night at every supported width", () => {
  for (const columns of [24, 40, 60, 120]) {
    const line = menu({ pet: "cow", pixelSize: 2 }, columns, 0);
    assert.ok(line.length <= columns);
    assert.match(line, /fire/i);
    assert.match(line, /night/i);
    assert.ok(line.includes("s") && line.includes("?") && line.includes("m"));
    assert.doesNotMatch(line, /w sky|sunset|rain/);
  }
});
