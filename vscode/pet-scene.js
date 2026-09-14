"use strict";
const sprites = require("./media/pets");
const { sunset } = require("./sunset");
const space = require("./space-events");
function pixelSize(value) {
  return value === 2 ? 2 : 1;
}
function compact(state) {
  return state.petCompact !== false && pixelSize(state.pixelSize) === 1;
}
function rows(state) {
  return (compact(state) ? 4 : 5) * (state.petCells ? 2 : 1);
}
function sprite(pet, size, small) {
  const art = size === 2 ? sprites.chunky : small ? sprites.small : sprites.art;
  return art[pet] || art.trex;
}
function pose(pet, columns, frame, pixels = 1, small = true) {
  const scale = pixelSize(pixels),
    source = sprite(pet, scale, small);
  const width = Math.max(...source.map((row) => row.length)) * scale;
  const span = Math.max(0, columns - 2 - width);
  const phase = span ? (Math.floor(frame / 2) + span) % (span * 2) : 0;
  return {
    width,
    x: Math.min(phase, span * 2 - phase),
    direction: !span || phase < span ? 1 : -1,
    scale,
  };
}
function scene(state, columns, frame) {
  const pet = sprites.art[state.pet] ? state.pet : "trex";
  const width = columns - 2,
    height = rows(state) * (state.petCells ? 1 : 2);
  const grid = sunset(width, frame, height);
  const event = space.eventAt(state, frame);
  space.draw(grid, event, frame);
  const put = (x, y, color) => {
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = color;
  };
  const actor = pose(pet, columns, frame, state.pixelSize, compact(state));
  let art = sprite(pet, actor.scale, compact(state)).map((row) =>
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
  if (state.mode !== "menu")
    return { width: 4, lines: ["Tab", " ?", " s", " m"] };
  const width = columns >= 52 ? 28 : 7;
  const event = space.eventAt(state, frame);
  return {
    width,
    lines:
      width === 7
        ? ["1 Pets", "2 Tet", "3 Duel", "4 Inv"]
        : [
            `${state.pet || "trex"} / ${event ? space.labels[event.type] : "Sunset"}`,
            "1Pet 2Tet 3Duel 4Inv",
            "a fire n pet e event ? help",
            "s/S size M music m hide Tab",
          ],
  };
}
module.exports = { scene, pose, pixelSize, compact, rows, menu };
