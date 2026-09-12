"use strict";
const sprites = require("./media/pets");
const { sunset } = require("./sunset");
const space = require("./space-events");
function pixelSize(value) {
  return value === 2 ? 2 : 1;
}
function sprite(pet, size) {
  const art = size === 2 ? sprites.chunky : sprites.art;
  return art[pet] || art.trex;
}
function pose(pet, columns, frame, pixels = 1) {
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
  const grid = sunset(width, frame);
  const event = space.eventAt(state, frame);
  space.draw(grid, event, frame);
  const put = (x, y, color) => {
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = color;
  };
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
  return { grid, weather: "sunset", event, actor, height };
}
function menu(state, columns, frame = state.petFrame || 0) {
  const size = pixelSize(state.pixelSize),
    event = space.eventAt(state, frame);
  const label = event ? space.labels[event.type] : "Sunset";
  const short = event
    ? {
        blackhole: "HOLE",
        supernova: "NOVA",
        comet: "COMET",
        aurora: "AURORA",
        saturn: "SATURN",
      }[event.type]
    : "SUNSET";
  const fire = state.petFire > 0 ? "FIRE!" : "a fire";
  const variants = [
    `1 Pets 2 Tetris 3 Duel 4 Inv | ${fire} n pet s pixels e event m hide ? | ${state.pet} ${size}x | ${event ? `Sunset / ${label}` : "Sunset"}`,
    `1234 | ${fire} n pet s pixels e event m hide ? | ${size}x ${label}`,
    `1234 a n s${size} e m? ${short}`,
  ];
  return (
    variants.find((value) => value.length <= columns) ||
    variants.at(-1).slice(0, columns)
  );
}
module.exports = { scene, pose, pixelSize, menu };
