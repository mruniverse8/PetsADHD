const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { render } = require("../terminal-renderer");
const sprites = require("../media/pets");
const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, "");
test("pets fill four rows with a collapsed menu on the right and no baseline or menu row", () => {
  for (const pet of Object.keys(sprites.art)) {
    const width = Math.max(...sprites.art[pet].map((row) => row.length));
    assert.ok(sprites.art[pet].length <= 10);
    for (const [columns, rows] of [
      [28, 4],
      [80, 4],
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
        assert.equal(lines.filter((line) => line.includes("▀")).length, 4);
        assert.equal(lines.join("").match(/▀/g).length, (columns - 6) * 4);
        assert.ok(lines[rows - 4].endsWith("│Tab"));
        assert.ok(lines.at(-1).includes("▀"));
        assert.ok(lines.at(-1).endsWith("│ m "));
        assert.ok(lines.every((line) => !line.includes("─")));
        assert.ok(
          lines.slice(0, rows - 4).every((line) => !line.trim()),
          "no extra title/status rows",
        );
      }
    }
  }
});
test("the arcade chooser expands on the right while keeping pets visible at narrow and wide sizes", () => {
  for (const [columns, rows] of [
    [28, 4],
    [52, 4],
    [100, 40],
  ]) {
    const lines = render(
      { mode: "menu", games: {} },
      { columns, rows },
    ).lines.map(plain);
    assert.equal(lines.filter((line) => line.trim()).length, 4);
    assert.equal(lines.filter((line) => line.includes("▀")).length, 4);
    const menu = lines
      .slice(-4)
      .map((line) => line.split("│")[1])
      .join("");
    for (const key of ["1", "2", "3", "4"]) assert.ok(menu.includes(key));
  }
});

const { scene, pose, pixelSize, menu } = require("../pet-scene");
test("tiny solid-cell pets fit narrow four-row panels with fire, events and right menus", () => {
  for (const pet of Object.keys(sprites.tiny)) {
    const height = pet === "sixseven" ? 5 : 4;
    assert.equal(sprites.tiny[pet].length, height);
    for (const mode of ["pets", "menu"])
      for (const columns of [28, 52, 110])
        for (const type of [
          "blackhole",
          "supernova",
          "comet",
          "aurora",
          "saturn",
        ])
          for (const frame of [0, 20, 60]) {
            const state = {
              mode,
              games: {},
              pet,
              petCells: true,
              petFire: 5,
              petFrame: frame,
              spaceEvent: { type, start: 0, seed: 1 },
            };
            const output = render(state, { columns, rows: height });
            assert.ok(
              output.playable,
              `${pet}/${mode} fits ${columns}x${height}`,
            );
            assert.equal(output.lines.length, height);
            assert.ok(
              output.lines.every((line) => plain(line).length === columns),
            );
          }
  }
  assert.ok(sprites.tiny.trex.join("").includes("k"), "Rex keeps its eye");
  assert.ok(sprites.tiny.dog.join("").includes("T"), "dog keeps its collar");
  assert.ok(sprites.tiny.cow.join("").includes("P"), "cow keeps its muzzle");
  assert.ok(
    sprites.tiny.sixseven.some((line) => line.startsWith("r r")),
    "67 keeps the counter inside 6",
  );
});
test("solid-cell ANSI artwork preserves every source pixel without block glyphs", async () => {
  const { Terminal } = require("@xterm/headless");
  for (const pet of Object.keys(sprites.art)) {
    for (const petCompact of [true, false]) {
      const state = {
        mode: "pets",
        games: {},
        pet,
        petCells: true,
        petCompact,
        spaceSeed: 1,
        petFrame: 0,
      };
      const columns = 100,
        rows = petCompact ? sprites.tiny[pet].length : 10;
      const source = scene(state, Math.floor((columns - 5) / 2) + 2, 0);
      const output = render(state, { columns, rows });
      assert.ok(output.playable);
      assert.ok(output.lines.every((line) => !plain(line).includes("▀")));
      const terminal = new Terminal({
        cols: columns,
        rows,
        allowProposedApi: true,
      });
      try {
        await new Promise((resolve) =>
          terminal.write("\x1b[?7l" + output.lines.join("\r\n"), resolve),
        );
        source.grid.forEach((row, y) =>
          row.forEach((color, x) => {
            for (const column of [1 + x * 2, 2 + x * 2]) {
              const cell = terminal.buffer.active.getLine(y).getCell(column);
              assert.equal(cell.getChars(), " ");
              assert.equal(
                cell.getBgColor(),
                parseInt(color.slice(1), 16),
                `${pet} pixel ${x},${y}`,
              );
            }
          }),
        );
      } finally {
        terminal.dispose();
      }
      assert.ok(
        !render(state, { columns, rows: rows - 1 }).playable,
        "undersized panes pause instead of clipping",
      );
    }
  }
});
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
      assert.equal(s.height, 8);
      assert.equal(s.actor.width, width);
    }
  }
});
test("detailed sunset has clouds, mountains, water and changing reflections regardless of old weather", () => {
  for (const weather of ["auto", "sun", "sunset", "rain", "night"]) {
    const sky = scene({ pet: "dog", weather, spaceSeed: 1 }, 120, 0);
    assert.equal(sky.weather, "sunset");
    assert.equal(sky.grid.length, 8);
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
test("dog and cow keep their original tall art and detailed compact poses with unmodified palette colors", () => {
  for (const pet of ["dog", "cow"])
    for (const petCompact of [true, false]) {
      const source = petCompact ? sprites.small[pet] : sprites.art[pet];
      assert.equal(source.length, petCompact ? 8 : 10);
      const s = scene({ pet, pixelSize: 1, petCompact }, 24, 0);
      assert.equal(s.actor.scale, 1);
      assert.ok(s.actor.x >= 0 && s.actor.x + s.actor.width <= 22);
      assert.equal(s.height, source.length);
      // Frame zero faces left. Every source pixel survives as its exact color.
      source.forEach((row, y) =>
        [...row.padEnd(s.actor.width)].reverse().forEach((c, x) => {
          if (sprites.palette[c])
            assert.equal(s.grid[y][s.actor.x + x], sprites.palette[c]);
        }),
      );
    }
  assert.notDeepEqual(sprites.art.dog, sprites.art.cow);
  assert.ok(sprites.chunky.dog.join("").includes("T"), "teal collar");
  assert.ok(sprites.chunky.cow.join("").includes("P"), "pink muzzle");
  for (const feature of ["H", "W", "K", "T"])
    assert.ok(sprites.small.dog.join("").includes(feature));
  for (const feature of ["h", "W", "D", "P", "k"])
    assert.ok(sprites.small.cow.join("").includes(feature));
  assert.deepEqual(
    sprites.small.sixseven,
    sprites.art.sixseven.slice(0, 8),
    "67 loses only empty padding",
  );
  assert.equal(pixelSize(undefined), 1);
});
test("collapsed and expanded right menus fit within four rows and their reserved width", () => {
  for (const columns of [28, 40, 60, 120]) {
    for (const mode of ["pets", "menu"]) {
      const result = menu({ pet: "cow", pixelSize: 1, mode }, columns, 0);
      assert.equal(result.lines.length, 4);
      assert.ok(result.lines.every((line) => line.length < result.width));
      if (mode === "pets") assert.equal(result.width, 4);
      else if (columns >= 52) {
        const details = result.lines.join(" ");
        assert.match(details, /Sunset/);
        for (const key of ["s/S", "e event", "M music", "m hide"])
          assert.ok(details.includes(key));
      }
    }
  }
});
