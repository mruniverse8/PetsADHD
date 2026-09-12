"use strict";
const E = require("./media/engine");
const pets = require("./pet-scene");
const BG = "#101725",
  FG = "#cad7e5",
  BORDER = "#536780";
const colors = {
  I: "#8bd5ef",
  O: "#eed49f",
  T: "#c6a0f6",
  S: "#a6da95",
  Z: "#ed8796",
  J: "#8aadf4",
  L: "#f5a97f",
  Garbage: "#808da2",
  ghost: "#344860",
};
const rgb = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(";");
function render(state, dimensions, frame = 0, suspended = false) {
  const cols = Math.max(1, Math.min(500, dimensions.columns)),
    rows = Math.max(1, Math.min(200, dimensions.rows));
  const screen = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ch: " ", fg: FG, bg: BG })),
  );
  const put = (x, y, ch, fg = FG, bg = BG) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows) screen[y][x] = { ch, fg, bg };
  };
  const text = (x, y, value, fg = FG) =>
    [...String(value)].forEach((c, i) => put(x + i, y, c, fg));
  const border = (x, y, w, h) => {
    text(x, y, "┌" + "─".repeat(w) + "┐", BORDER);
    for (let j = 1; j <= h; j++) {
      put(x, y + j, "│", BORDER);
      put(x + w + 1, y + j, "│", BORDER);
    }
    text(x, y + h + 1, "└" + "─".repeat(w) + "┘", BORDER);
  };
  const pixels = (grid, x, y, scale = 1) => {
    for (let py = 0; py < grid.length * scale; py += 2)
      for (let px = 0; px < grid[0].length * scale; px++) {
        const top = grid[Math.floor(py / scale)][Math.floor(px / scale)] || BG;
        const bottom =
          grid[Math.floor((py + 1) / scale)]?.[Math.floor(px / scale)] || BG;
        put(x + px, y + py / 2, "▀", top, bottom);
      }
  };
  const mode = state.mode,
    game = state.games[mode];
  const title = {
    menu: "ARCADE",
    pets: "TINY PETS",
    tetris: "ASTRA TETRIS",
    duel: "TETRIS / 2 PLAYERS",
    invaders: "SPACE INVADERS",
  }[mode];
  const compactUI = mode === "pets" || mode === "menu";
  if (!compactUI) {
    text(0, 0, `PetsADHD / ${title}`, "#8bd5ef");
    text(0, rows - 2, "m hide  p pause  r restart  M music", BORDER);
    text(0, rows - 1, "Tab menu  ? controls  q quit", BORDER);
  }
  let playable = true;
  if (mode === "menu") {
    // The shared navigation bar below is the entire menu.
  } else if (mode === "tetris" || mode === "duel") {
    const dual = mode === "duel",
      wide = rows >= 26 && cols >= (dual ? 84 : 42);
    const scale = wide ? 2 : 1,
      panelWidth = wide ? 42 : 28;
    const stacked = dual && cols < panelWidth * 2;
    const height = wide ? 22 : 12;
    const neededRows = 4 + height * (stacked ? 2 : 1);
    playable = cols >= panelWidth && rows >= neededRows;
    if (playable) {
      const players = dual ? game.players : [game];
      players.forEach((p, i) => {
        const x = stacked ? 0 : i * panelWidth,
          y = 2 + (stacked ? i * height : 0);
        border(x, y, 10 * scale, 10 * scale);
        pixels(
          E.grid(p).map((row) => row.map((v) => colors[v])),
          x + 1,
          y + 1,
          scale,
        );
        const sx = x + 10 * scale + 3;
        text(sx, y, dual ? `PLAYER ${i + 1}` : "SOLO", "#8bd5ef");
        text(sx, y + 1, `Score ${p.score}`);
        text(sx, y + 2, `Lines ${p.lines}`);
        text(sx, y + 3, `Level ${p.level}`);
        text(sx, y + 4, `Speed ${p.speed}x`);
        text(sx, y + 5, `Next ${p.next}`);
        pixels(
          E.shapes[p.next].map((row) => [...row].map((c) => colors[c])),
          sx,
          y + 6,
          2,
        );
        if (dual) text(sx, y + 10, `Attack +${p.pending}`, "#ed8796");
      });
    } else text(0, 3, `Resize: ${panelWidth}x${neededRows} minimum`);
  } else if (mode === "invaders") {
    playable = cols >= 68 && rows >= 18;
    if (playable) {
      const full = rows >= 30;
      const grid = Array.from({ length: 24 }, () => Array(66).fill(null));
      const pixel = (x, y, color) => {
        if (grid[y] && x >= 0 && x < 66) grid[y][x] = color;
      };
      for (let y = 0; y < 24; y++)
        for (let x = 0; x < 66; x++)
          if (
            (((x * 31 + (y - Math.floor(game.tick / 5)) * 17) % 137) + 137) %
              137 ===
            0
          )
            pixel(x, y, "#344860");
      const art = [
        ["  ###  ", " # # # ", "#######"],
        [" #   # ", "#######", " # # # "],
        ["  ###  ", " ##### ", "## # ##"],
      ];
      const sprite = (lines, x, y, color) =>
        lines.forEach((line, r) =>
          [...line].forEach((c, col) => {
            if (c !== " ") pixel(x + col, y + r, color);
          }),
        );
      game.enemies.forEach((e) =>
        sprite(
          art[e.row],
          e.x - 3,
          e.y - 2,
          ["#c6a0f6", "#a6da95", "#eed49f"][e.row],
        ),
      );
      game.shots.forEach((b) => pixel(b.x, b.y, "#b8ffda"));
      game.bombs.forEach((b) => pixel(b.x, b.y, "#ff8095"));
      sprite(
        ["   #   ", "  ###  ", "#######"],
        game.x - 3,
        20,
        game.shield ? "#ffffff" : "#8bd5ef",
      );
      pixel(game.x, 23, game.tick % 4 < 2 ? "#f5a97f" : "#eed49f");
      game.explosions.forEach((e) =>
        sprite(["# #", " # ", "# #"], e.x - 1, e.y - 2, "#ffd77c"),
      );
      const x = Math.floor((cols - 68) / 2);
      border(x, 2, 66, full ? 24 : 12);
      if (full)
        grid.forEach((row, y) =>
          row.forEach((c, px) =>
            put(x + 1 + px, y + 3, c ? "█" : " ", c || FG),
          ),
        );
      else pixels(grid, x + 1, 3);
    } else text(0, 3, "Resize: 68 columns x 18 rows minimum");
  } else if (mode === "pets") {
    playable = cols >= 24 && rows >= 7;
    if (playable) {
      const scene = pets.scene(state, cols, state.petFrame ?? frame);
      const floor = rows - 2;
      pixels(scene.grid, 1, floor - 5);
      text(1, floor, "─".repeat(cols - 2), "#b58a89");
    } else text(0, 0, "Resize: 24 cols x 7 rows");
  }
  const status = !playable
    ? "PAUSED / enlarge the panel"
    : game?.over
      ? mode === "duel"
        ? game.winner
          ? `PLAYER ${game.winner} WINS / r restart`
          : "DRAW / r restart"
        : "GAME OVER / r restart"
      : game?.paused
        ? "PAUSED / p resume"
        : suspended
          ? "PAUSED / focus terminal to resume"
          : mode === "invaders"
            ? `Score ${game.score}  Wave ${game.wave}  Lives ${game.lives} / a fire`
            : mode === "pets"
              ? `${state.pet} / ${state.weather}`
              : "";
  if (!compactUI) text(0, 1, status, "#eed49f");
  else {
    const choices =
      mode === "pets"
        ? pets.menu(state, cols, state.petFrame ?? frame)
        : cols >= 64
          ? "1 Pets 2 Tetris 3 Duel 4 Invaders | m hide ? help"
          : cols >= 40
            ? "1 Pets 2 Tetris 3 Duel 4 Inv | m hide ?"
            : "1Pet 2Tet 3D 4Inv m?";
    text(0, rows - 1, choices, "#8bd5ef");
  }
  const lines = screen.map((row) => {
    let fg,
      bg,
      line = "";
    for (const cell of row) {
      if (cell.fg !== fg) {
        fg = cell.fg;
        line += `\x1b[38;2;${rgb(fg)}m`;
      }
      if (cell.bg !== bg) {
        bg = cell.bg;
        line += `\x1b[48;2;${rgb(bg)}m`;
      }
      line += cell.ch;
    }
    return line + "\x1b[0m";
  });
  return { lines, playable };
}
module.exports = { render };
