const { test } = require("node:test");
const assert = require("node:assert/strict");
const { inflateSync } = require("node:zlib");
const { braille, bitmap } = require("../terminal-pixels");
const { render } = require("../terminal-renderer");
const { scene, rows } = require("../pet-scene");
const sprites = require("../media/pets");

test("Braille maps each source position to its Unicode dot, including partial cells", () => {
  const expected = [
    [1, 8],
    [2, 16],
    [4, 32],
    [64, 128],
  ];
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 2; x++) {
      const grid = Array.from({ length: 4 }, () => Array(2).fill(null));
      grid[y][x] = "#ffffff";
      assert.equal(
        braille(grid, "#abcdef")[0][0].ch.codePointAt(0),
        0x2800 + expected[y][x],
      );
    }
  assert.equal(braille([["#ffffff"]], "#abcdef")[0][0].ch, "⠁");
  assert.equal(braille([[null]], "#abcdef")[0][0].ch, " ");
});

test("Braille and bitmap retain eight-row sprites in two terminal rows with fitting menus", () => {
  for (const pet of Object.keys(sprites.small))
    for (const style of ["petBraille", "petBitmap"])
      for (const mode of ["pets", "menu"])
        for (const columns of [28, 52, 110]) {
          const state = {
            pet,
            mode,
            games: {},
            [style]: true,
            petFrame: 20,
            petFire: 3,
          };
          const height = mode === "pets" ? 2 : 4;
          assert.equal(rows(state), height);
          const result = render(state, { columns, rows: height });
          assert.ok(result.playable, `${pet}/${style}/${mode}/${columns}`);
          assert.ok(!render(state, { columns, rows: height - 1 }).playable);
          assert.equal(
            scene(
              state,
              (columns - (mode === "pets" ? 4 : columns >= 52 ? 28 : 7) - 1) *
                2 +
                2,
              20,
            ).grid.length,
            height * 4,
          );
          assert.equal(Boolean(result.bitmap), style === "petBitmap");
          if (style === "petBraille")
            assert.match(result.lines.join(""), /[\u2801-\u28ff]/);
        }
});

test("compressed bitmap RGB preserves every pixel and has bounded frame size", () => {
  for (const pet of Object.keys(sprites.art))
    for (const petCompact of [true, false]) {
      const state = {
        pet,
        petCompact,
        mode: "pets",
        games: {},
        petBitmap: true,
        petFrame: 0,
      };
      const result = render(state, { columns: 110, rows: petCompact ? 2 : 3 });
      const frame = bitmap(result.bitmap),
        raw = inflateSync(Buffer.from(frame.data, "base64"));
      assert.equal(raw.length, frame.width * frame.height * 3);
      assert.ok(frame.data.length < 250000);
      result.bitmap.grid.forEach((row, y) =>
        row.forEach((color, x) => {
          const expected = [1, 3, 5].map((i) =>
            parseInt(color.slice(i, i + 2), 16),
          );
          for (let dy = 0; dy < 4; dy++)
            for (let dx = 0; dx < 4; dx++) {
              const offset = ((y * 4 + dy) * frame.width + x * 4 + dx) * 3;
              assert.deepEqual([...raw.subarray(offset, offset + 3)], expected);
            }
        }),
      );
    }
  const game = render(
    {
      mode: "tetris",
      games: { tetris: require("../media/engine").tetris({}) },
      petBitmap: true,
    },
    { columns: 80, rows: 18 },
  );
  assert.equal(game.bitmap, undefined, "games remove the bitmap placement");
});
