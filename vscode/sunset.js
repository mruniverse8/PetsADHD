"use strict";
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const hex = (rgb) =>
  "#" +
  rgb
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
    .join("");
function sunset(width, frame) {
  const height = 10,
    sunX = Math.floor(width * 0.72),
    sunY = 5;
  const top = [37, 33, 68],
    rose = [173, 91, 110],
    gold = [248, 159, 96];
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      let color = y < 5 ? mix(top, rose, y / 5) : mix(rose, gold, (y - 5) / 4);
      const glow =
        Math.max(0, 1 - Math.hypot((x - sunX) / 1.8, y - sunY) / 10) * 0.6;
      color = mix(color, [255, 186, 120], glow);
      // Thin drifting cloud ribbons, with peach-lit edges over violet shadows.
      const band = Math.sin((x + frame / 9) / 7) + Math.sin(x / 19 + y * 2.7);
      if (y < 5 && band > 0.65)
        color = mix(color, y % 2 ? [213, 135, 149] : [67, 49, 88], 0.45);
      return hex(color);
    }),
  );
  for (let y = 2; y <= 7; y++)
    for (let x = sunX - 3; x <= sunX + 3; x++)
      if ((x - sunX) ** 2 + (y - sunY) ** 2 <= 9 && x >= 0 && x < width)
        grid[y][x] = y < 5 ? "#ffe5af" : "#ffc184";
  for (let x = 0; x < width; x++) {
    const far =
      7 - Math.floor((Math.sin(x / 8) + Math.sin(x / 17 + 2) + 2) / 2);
    for (let y = far; y <= 7; y++)
      grid[y][x] = y === far ? "#66536b" : "#4d4259";
    for (let y = 8; y < height; y++) {
      const ripple = (x * 7 + Math.floor(frame / 3) + y * 3) % 13;
      const reflected = Math.abs(x - sunX) < (y - 6) * 4 && ripple < 7;
      grid[y][x] = reflected
        ? ripple < 3
          ? "#ffc58b"
          : "#c98c87"
        : ripple < 3
          ? "#6a627c"
          : "#343951";
    }
    if (x < width * 0.12 || x > width * 0.93) grid[9][x] = "#252d40";
  }
  for (let x = 4; x < width; x += 17)
    if ((x + Math.floor(frame / 9)) % 3 === 0) grid[0][x] = "#c7bedb";
  return grid;
}
module.exports = { sunset };
