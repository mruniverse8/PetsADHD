"use strict";
const sprites = require("./media/pets");
function pixelSize(value) {
  return value === 1 ? 1 : 2;
}
function sprite(pet, size) {
  const art = size === 2 ? sprites.chunky : sprites.art;
  return art[pet] || art.trex;
}
function pose(pet, columns, frame, pixels = 2) {
  const scale = pixelSize(pixels),
    source = sprite(pet, scale);
  const width = Math.max(...source.map((row) => row.length)) * scale;
  const span = Math.max(1, columns - 2 - width);
  const phase = (Math.floor(frame / 2) + span) % (span * 2);
  return {
    width,
    x: Math.min(phase, span * 2 - phase),
    direction: phase < span ? 1 : -1,
    scale,
  };
}
function scene(state, columns, frame) {
  const pet = sprites.art[state.pet] ? state.pet : "trex";
  const width = columns - 2,
    height = 10;
  const grid = Array.from({ length: height }, (_, y) =>
    Array(width).fill(
      ["#080d1e", "#0b1024", "#0e142a", "#12172e", "#181c30"][
        Math.floor(y / 2)
      ],
    ),
  );
  const put = (x, y, color) => {
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = color;
  };
  // Deterministic twinkling stars, including a few brighter four-point stars.
  for (let x = 1; x < width; x += 5) {
    const y = (x * 7 + 3) % 9;
    const bright = (Math.floor(frame / 6) + x) % 4 === 0;
    put(x, y, bright ? "#ecf2ff" : "#536987");
    if (bright && x % 3 === 0) {
      put(x - 1, y, "#798cba");
      put(x + 1, y, "#798cba");
      put(x, y - 1, "#798cba");
    }
  }
  // A small spiral galaxy; its core and arms stay behind the walking pet.
  const gx = Math.floor(width * 0.24),
    gy = 4;
  for (let i = 0; i < 28; i++) {
    const r = i / 6,
      angle = i * 0.52 + frame / 100;
    for (const sign of [-1, 1])
      put(
        gx + Math.round(Math.cos(angle) * r * sign),
        gy + Math.round(Math.sin(angle) * r * 0.5 * sign),
        i < 12 ? "#9783c5" : "#43375f",
      );
  }
  put(gx, gy, "#eee1ff");
  put(gx + 1, gy, "#c7b9ef");
  // Saturn has a shaded disk and a tilted elliptical ring, in back/front layers.
  const sx = Math.floor(width * 0.57),
    sy = 4;
  function ring(front) {
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI) / 18;
      if (Math.sin(a) >= 0 !== front) continue;
      const dx = Math.round(Math.cos(a) * 6),
        dy = Math.round(Math.sin(a) * 1.5 + dx * 0.23);
      put(sx + dx, sy + dy, front ? "#bfa485" : "#62536d");
    }
  }
  ring(false);
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++)
      if (x * x + y * y <= 5)
        put(
          sx + x,
          sy + y,
          ["#f5d9a5", "#e4c492", "#cfab79", "#ac885f", "#806b58"][y + 2],
        );
  ring(true);
  if (frame % 160 < 28 && width > 35) {
    const mx = width - 1 - (frame % 160) * 2;
    put(mx, 1, "#dce9ff");
    put(mx + 1, 0, "#657cb0");
  }
  const actor = pose(pet, columns, frame, state.pixelSize);
  let art = sprite(pet, actor.scale).map((row) =>
    row.padEnd(actor.width / actor.scale, " ").split(""),
  );
  // Alternate the feet inside the existing sprite bounds. Numbers stay upright.
  if (pet !== "sixseven" && Math.floor(frame / 4) % 2) {
    const foot = art.length - 1;
    art[foot] = art[foot].map((_, x, row) => row[(x + 1) % row.length]);
  }
  if (actor.direction < 0 && pet !== "sixseven")
    art = art.map((row) => row.reverse());
  art.forEach((row, y) =>
    row.forEach((c, x) => {
      if (sprites.palette[c])
        for (let dy = 0; dy < actor.scale; dy++)
          for (let dx = 0; dx < actor.scale; dx++)
            put(
              actor.x + x * actor.scale + dx,
              y * actor.scale + dy,
              sprites.palette[c],
            );
    }),
  );
  if (state.petFire > 0) {
    const muzzle = actor.direction > 0 ? actor.x + actor.width : actor.x - 1;
    const length = Math.min(12, 3 + state.petFire);
    for (let d = 0; d < length; d++) {
      const x = muzzle + actor.direction * d;
      const spread = d < 2 ? 0 : 1 + ((d + frame) % 3 === 0 ? 1 : 0);
      for (let dy = -spread; dy <= spread; dy++) {
        const edge = Math.abs(dy) === spread || d === length - 1;
        put(
          x,
          3 + dy,
          edge ? "#ed643d" : (d + frame) % 2 ? "#ffd36b" : "#fff0ae",
        );
      }
    }
  }
  return { grid, weather: "night", actor, height };
}
function menu(state, columns) {
  const size = pixelSize(state.pixelSize);
  const fire = state.petFire > 0 ? "FIRE!" : "aFire";
  const variants = [
    `1 Pets 2 Tetris 3 Duel 4 Inv | a fire n pet s pixels m hide ? | ${state.pet} ${size}x | Night: stars, Saturn, galaxies`,
    `1234 games | a fire n pet s pixels m hide ? | ${state.pet} ${size}x NIGHT`,
    `1234 ${fire} n:pet s:${size}x m:hide ? NIGHT`,
    `1234 ${fire} n s${size} m? NIGHT`,
  ];
  return (
    variants.find((value) => value.length <= columns) ||
    variants.at(-1).slice(0, columns)
  );
}
module.exports = { scene, pose, pixelSize, menu };
