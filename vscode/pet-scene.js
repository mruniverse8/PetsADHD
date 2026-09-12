"use strict";
const sprites = require("./media/pets");
function weatherAt(mode, frame) {
  if (["sun", "rain", "sunset"].includes(mode)) return mode;
  return ["sun", "sunset", "rain"][Math.floor(frame / 120) % 3];
}
function pose(pet, columns, frame) {
  const source = sprites.art[pet] || sprites.art.trex;
  const width = Math.max(...source.map((row) => row.length));
  const span = Math.max(1, columns - 2 - width);
  const phase = (Math.floor(frame / 2) + span) % (span * 2);
  return {
    width,
    x: Math.min(phase, span * 2 - phase),
    direction: phase < span ? 1 : -1,
  };
}
function scene(state, columns, frame) {
  const pet = sprites.art[state.pet] ? state.pet : "trex";
  const width = columns - 2,
    height = 10;
  const weather = weatherAt(state.weather, frame);
  const backgrounds = {
    sun: ["#172f42", "#193448", "#1b394a", "#1d3d48", "#23463f"],
    rain: ["#273443", "#223242", "#1c2d3d", "#172837", "#20323b"],
    sunset: ["#342445", "#60334e", "#97505c", "#cb785e", "#75574e"],
  };
  const grid = Array.from({ length: height }, (_, y) =>
    Array(width).fill(backgrounds[weather][Math.floor(y / 2)]),
  );
  const put = (x, y, color) => {
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = color;
  };
  if (weather === "rain") {
    for (let x = 0; x < width; x++)
      if ((x + Math.floor(frame / 8)) % 17 < 12) put(x, 0, "#50617a");
    for (let x = 1; x < width; x += 5) {
      const y = (frame * 2 + x * 3) % 10;
      put(x, y, "#7ba7d5");
      put(x - 1, y + 1, "#aacbeb");
      if (y >= 8) {
        put(x - 1, 9, "#6e9caf");
        put(x + 1, 9, "#6e9caf");
      }
    }
  } else {
    const sx = Math.floor(width * 0.78),
      sy = weather === "sunset" ? 7 : 2;
    for (let y = 0; y < height; y++)
      for (let x = sx - 3; x <= sx + 3; x++)
        if ((x - sx) ** 2 + (y - sy) ** 2 <= (weather === "sunset" ? 9 : 4))
          put(
            x,
            y,
            weather === "sunset" ? (y < sy ? "#ffcf83" : "#ffac70") : "#ffe0a0",
          );
    if (weather === "sunset")
      for (let x = 0; x < width; x++)
        if ((x + Math.floor(frame / 3)) % 9 < 4) put(x, 9, "#d79575");
  }
  const actor = pose(pet, columns, frame);
  let art = sprites.art[pet].map((row) =>
    row.padEnd(actor.width, " ").split(""),
  );
  // Alternate the feet inside the existing sprite bounds. Numbers stay upright.
  if (pet !== "sixseven" && Math.floor(frame / 4) % 2) {
    art[9] = art[9].map((_, x, row) => row[(x + 1) % row.length]);
  }
  if (actor.direction < 0 && pet !== "sixseven")
    art = art.map((row) => row.reverse());
  art.forEach((row, y) =>
    row.forEach((c, x) => {
      if (sprites.palette[c]) put(actor.x + x, y, sprites.palette[c]);
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
  return { grid, weather, actor, height };
}
function menu(state, columns, frame) {
  const sky = weatherAt(state.weather, frame);
  const label = state.weather === "auto" ? `Auto:${sky}` : sky;
  const fire = state.petFire > 0 ? "FIRE!" : "aFire";
  const variants = [
    `1 Pets 2 Tetris 3 Duel 4 Invaders | a fire n pet w sky m hide ? help | ${state.pet} | ${label}${state.petFire > 0 ? " | FIRE!" : ""}`,
    `1234 games | a fire n pet w sky m hide ? | ${label}${state.petFire > 0 ? " FIRE!" : ""}`,
    `1234 ${fire} n:pet w:sky m:hide ? ${sky}`,
    `1234 ${fire} n w m? ${sky.toUpperCase()}`,
  ];
  return (
    variants.find((value) => value.length <= columns) ||
    variants.at(-1).slice(0, columns)
  );
}
module.exports = { scene, pose, weatherAt, menu };
