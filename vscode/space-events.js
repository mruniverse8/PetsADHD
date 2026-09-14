"use strict";
const types = ["blackhole", "supernova", "comet", "aurora", "saturn"];
const labels = {
  blackhole: "Black hole",
  supernova: "Supernova",
  comet: "Comet",
  aurora: "Aurora",
  saturn: "Saturn",
};
function hash(seed, index) {
  let value = (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}
function eventAt(state, frame) {
  const forced = state.spaceEvent;
  if (
    forced &&
    types.includes(forced.type) &&
    frame >= forced.start &&
    frame < forced.start + 70
  )
    return {
      type: forced.type,
      age: frame - forced.start,
      seed: forced.seed >>> 0,
      duration: 70,
    };
  const cycle = Math.floor(frame / 180),
    seed = hash(state.spaceSeed || 1, cycle);
  const age = (frame % 180) - (32 + (seed % 42));
  if (age < 0 || age >= 70) return null;
  return { type: types[seed % types.length], age, seed, duration: 70 };
}
function summon(state, random = Math.random) {
  const seed = Math.floor(random() * 0x7fffffff) + 1;
  state.spaceEvent = {
    type: types[seed % types.length],
    start: state.petFrame,
    seed,
  };
}
function draw(grid, event, frame) {
  if (!event) return;
  const width = grid[0].length,
    cx = Math.floor(width * (0.18 + (event.seed % 47) / 100)),
    cy = Math.min(3, grid.length - 2);
  const put = (x, y, color) => {
    if (x >= 0 && x < width && y >= 0 && y < grid.length) grid[y][x] = color;
  };
  if (event.type === "blackhole") {
    // Tilted accretion disk, violet lensing halo, and a dark central silhouette.
    for (let i = 0; i < 40; i++) {
      const angle = (i * Math.PI) / 20 + frame / 20;
      put(
        cx + Math.round(Math.cos(angle) * 5),
        cy + Math.round(Math.sin(angle) * 2),
        "#9174bc",
      );
      put(
        cx + Math.round(Math.cos(angle) * 7),
        cy + Math.round(Math.sin(angle) + Math.cos(angle)),
        i % 3 ? "#ffb46d" : "#ffe5a0",
      );
    }
    for (let y = -1; y <= 1; y++)
      for (let x = -2; x <= 2; x++)
        if (x * x + y * y < 5) put(cx + x, cy + y, "#08050e");
  } else if (event.type === "supernova") {
    const radius = Math.min(7, 1 + Math.floor(event.age / 7));
    for (let i = 0; i < 32; i++) {
      const angle = (i * Math.PI) / 16;
      put(
        cx + Math.round(Math.cos(angle) * radius),
        cy + Math.round(Math.sin(angle) * radius * 0.5),
        event.age < 35 ? "#ffb76d" : "#b878ad",
      );
    }
    if (event.age < 42) {
      put(cx, cy, "#fff3bd");
      put(cx - 1, cy, "#fff3bd");
      put(cx + 1, cy, "#fff3bd");
      put(cx, cy - 1, "#ffdc9b");
    }
  } else if (event.type === "comet") {
    const x = Math.floor((width + 12) * (1 - event.age / 70)) - 6;
    for (let i = 8; i >= 0; i--)
      put(
        x + i,
        2 - Math.floor(i / 5),
        ["#effbff", "#bce8ef", "#84bccc", "#629bb4"][
          Math.min(3, Math.floor(i / 2))
        ],
      );
  } else if (event.type === "aurora") {
    for (let x = 0; x < width; x++) {
      const y = 1 + Math.round((Math.sin(x / 8 + frame / 15) + 1) * 1.5);
      put(x, y, "#72b9b3");
      if (x % 3) put(x, y + 1, "#676699");
    }
  } else {
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++)
        if (x * x + y * y <= 5)
          put(cx + x, cy + y, y < 0 ? "#f5d9a5" : "#cda875");
    for (let i = 0; i < 36; i++) {
      const angle = (i * Math.PI) / 18,
        x = Math.round(Math.cos(angle) * 6);
      put(cx + x, cy + Math.round(Math.sin(angle) + x / 4), "#d2b4a0");
    }
  }
}
module.exports = { types, labels, hash, eventAt, summon, draw };
