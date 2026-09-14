"use strict";
const { deflateSync } = require("node:zlib");

// Unicode Braille dot numbers: left 1,2,3,7; right 4,5,6,8.
function braille(grid, foreground) {
  const bits = [
    [1, 8],
    [2, 16],
    [4, 32],
    [64, 128],
  ];
  const lines = [];
  for (let y = 0; y < grid.length; y += 4) {
    const line = [];
    for (let x = 0; x < grid[0].length; x += 2) {
      let mask = 0;
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 2; dx++)
          if (grid[y + dy]?.[x + dx]) mask |= bits[dy][dx];
      line.push({
        ch: mask ? String.fromCodePoint(0x2800 + mask) : " ",
        fg: foreground,
      });
    }
    lines.push(line);
  }
  return lines;
}

// Send compressed RGB directly: no files, image converters or npm dependency.
// Enlarge source pixels before host scaling to retain their square edges.
function bitmap({ grid, ...placement }) {
  const scale = 4,
    width = grid[0].length * scale,
    height = grid.length * scale;
  const raw = Buffer.alloc(width * height * 3);
  grid.forEach((row, y) =>
    row.forEach((color, x) => {
      const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++)
          raw.set(rgb, ((y * scale + dy) * width + x * scale + dx) * 3);
    }),
  );
  return {
    ...placement,
    width,
    height,
    data: deflateSync(raw).toString("base64"),
  };
}

module.exports = { braille, bitmap };
