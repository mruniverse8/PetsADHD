"use strict";
const valid = (value) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (color) =>
  color.reduce((sum, channel, i) => {
    const c = channel / 255;
    return (
      sum +
      [0.2126, 0.7152, 0.0722][i] *
        (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    );
  }, 0);
function contrast(color, background, minimum) {
  const fg = rgb(color),
    bg = luminance(rgb(background));
  const ratio = (c) => {
    const value = luminance(c);
    return (Math.max(value, bg) + 0.05) / (Math.min(value, bg) + 0.05);
  };
  if (ratio(fg) >= minimum) return color;
  const target = bg > 0.179 ? 0 : 255;
  for (let step = 1; step <= 100; step++) {
    const mixed = fg.map((c) => Math.round(c + ((target - c) * step) / 100));
    if (ratio(mixed) >= minimum)
      return "#" + mixed.map((c) => c.toString(16).padStart(2, "0")).join("");
  }
  return target === 0 ? "#000000" : "#ffffff";
}
function palette(theme) {
  const background = valid(theme?.background) ? theme.background : "#101725";
  return {
    background,
    foreground: contrast(
      valid(theme?.foreground) ? theme.foreground : "#cad7e5",
      background,
      4.5,
    ),
    border: contrast("#536780", background, 4.5),
    accent: contrast("#8bd5ef", background, 4.5),
    status: contrast("#eed49f", background, 4.5),
    separator: contrast("#967786", background, 3),
  };
}
module.exports = { palette, contrast, valid };
