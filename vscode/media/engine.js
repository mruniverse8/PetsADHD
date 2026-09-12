(function (root) {
  "use strict";
  const shapes = {
    I: ["    ", "IIII", "    ", "    "],
    O: ["OO", "OO"],
    T: [" T ", "TTT", "   "],
    S: [" SS", "SS ", "   "],
    Z: ["ZZ ", " ZZ", "   "],
    J: ["J  ", "JJJ", "   "],
    L: ["  L", "LLL", "   "],
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function cells(p, fn) {
    p.shape.forEach((row, y) =>
      [...row].forEach((cell, x) => {
        if (cell !== " ") fn(p.x + x, p.y + y);
      }),
    );
  }
  function fits(s, p) {
    let valid = true;
    cells(p, (x, y) => {
      if (x < 0 || x >= 10 || y < 0 || y >= 20 || s.board[y][x]) valid = false;
    });
    return valid;
  }
  function take(s) {
    if (!s.bag.length) {
      s.bag = Object.keys(shapes);
      for (let i = 6; i > 0; i--) {
        s.seed = (s.seed * 16807) % 2147483647;
        const j = s.seed % (i + 1);
        [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]];
      }
    }
    return s.bag.pop();
  }
  function spawn(s) {
    const kind = s.next || take(s);
    s.next = take(s);
    s.piece = { kind, shape: shapes[kind], x: 3, y: 0 };
    s.tick = 0;
    if (!fits(s, s.piece)) s.over = true;
  }
  function tetris(options = {}) {
    const s = {
      board: Array.from({ length: 20 }, () => Array(10).fill(null)),
      bag: [],
      seed: options.seed || Math.floor(Math.random() * 2147483646) + 1,
      score: 0,
      lines: 0,
      level: 1,
      tick: 0,
      speed: clamp(Math.floor(options.speed || 1), 1, 8),
      pending: 0,
      attack: 0,
      locks: 0,
    };
    spawn(s);
    return s;
  }
  function move(s, dx, dy) {
    const p = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy };
    if (!fits(s, p)) return false;
    s.piece = p;
    return true;
  }
  function lock(s) {
    cells(s.piece, (x, y) => (s.board[y][x] = s.piece.kind));
    const remaining = s.board.filter((row) => row.some((cell) => !cell));
    const cleared = 20 - remaining.length;
    s.board = [
      ...Array.from({ length: cleared }, () => Array(10).fill(null)),
      ...remaining,
    ];
    s.score += [0, 100, 300, 500, 800][cleared] * s.level;
    s.lines += cleared;
    s.level = 1 + Math.floor(s.lines / 10);
    s.locks++;
    const attack = [0, 0, 1, 2, 4][cleared],
      cancel = Math.min(attack, s.pending);
    s.attack += attack - cancel;
    s.pending -= cancel;
    for (let i = 0; i < s.pending; i++) {
      if (s.board[0].some(Boolean)) {
        s.over = true;
        break;
      }
      s.board.shift();
      const row = Array(10).fill("Garbage");
      row[(s.locks * 7) % 10] = null;
      s.board.push(row);
    }
    s.pending = 0;
    if (!s.over) spawn(s);
  }
  function rotate(s, clockwise) {
    const n = s.piece.shape.length;
    const shape = Array.from({ length: n }, (_, y) =>
      Array.from({ length: n }, (_, x) =>
        clockwise ? s.piece.shape[n - x - 1][y] : s.piece.shape[x][n - y - 1],
      ).join(""),
    );
    for (const [dx, dy] of [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
      [0, -2],
    ]) {
      const p = { ...s.piece, shape, x: s.piece.x + dx, y: s.piece.y + dy };
      if (fits(s, p)) {
        s.piece = p;
        return;
      }
    }
  }
  function input(s, key) {
    if (s.over) return;
    if (key === "faster" || key === "slower") {
      s.speed = clamp(s.speed + (key === "faster" ? 1 : -1), 1, 8);
      return;
    }
    if (key === "pause") {
      s.paused = !s.paused;
      return;
    }
    if (s.paused) return;
    if (key === "left") move(s, -1, 0);
    else if (key === "right") move(s, 1, 0);
    else if (key === "rotate") rotate(s, true);
    else if (key === "reverse") rotate(s, false);
    else if (key === "down") {
      if (move(s, 0, 1)) s.score++;
      else lock(s);
      s.tick = 0;
    } else if (key === "drop") {
      while (move(s, 0, 1)) s.score += 2;
      lock(s);
    }
  }
  function step(s) {
    if (s.over || s.paused) return;
    if (++s.tick >= Math.max(1, (9 - s.level) / s.speed)) {
      s.tick = 0;
      if (!move(s, 0, 1)) lock(s);
    }
  }
  function grid(s) {
    const result = clone(s.board);
    if (!s.over) {
      const p = clone(s.piece);
      while (fits(s, { ...p, y: p.y + 1 })) p.y++;
      cells(p, (x, y) => (result[y][x] = "ghost"));
      cells(s.piece, (x, y) => (result[y][x] = s.piece.kind));
    }
    return result;
  }
  function duel(options = {}) {
    const seed = options.seed || Math.floor(Math.random() * 2147483646) + 1;
    return {
      players: [tetris({ ...options, seed }), tetris({ ...options, seed })],
      paused: false,
    };
  }
  function resolve(s) {
    const [a, b] = s.players,
      cancel = Math.min(a.attack, b.attack);
    a.pending += b.attack - cancel;
    b.pending += a.attack - cancel;
    a.attack = b.attack = 0;
    if (a.over || b.over) {
      s.over = true;
      s.winner = a.over ? (b.over ? 0 : 2) : 1;
    }
  }
  function duelInput(s, key, player = 0) {
    if (s.over) return;
    if (key === "pause") {
      s.paused = !s.paused;
      return;
    }
    if (key === "faster" || key === "slower") {
      s.players.forEach((p) => input(p, key));
      return;
    }
    if (!s.paused) {
      input(s.players[player], key);
      resolve(s);
    }
  }
  function duelStep(s) {
    if (s.over || s.paused) return;
    s.players.forEach(step);
    resolve(s);
  }
  function wave(s) {
    s.wave++;
    s.enemies = [];
    s.shots = [];
    s.bombs = [];
    s.direction = 1;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 7; c++)
        s.enemies.push({ x: 8 + c * 8, y: 3 + r * 4, row: r });
  }
  function invaders() {
    const s = {
      width: 66,
      height: 24,
      x: 33,
      lives: 3,
      score: 0,
      wave: 0,
      tick: 0,
      cooldown: 0,
      shield: 0,
      explosions: [],
    };
    wave(s);
    return s;
  }
  function invadersInput(s, key) {
    if (s.over) return;
    if (key === "pause") {
      s.paused = !s.paused;
      return;
    }
    if (s.paused) return;
    if (key === "left") s.x = Math.max(3, s.x - 1);
    else if (key === "right") s.x = Math.min(62, s.x + 1);
    else if (key === "fire" && !s.cooldown) {
      s.shots.push({ x: s.x, y: 19 });
      s.cooldown = 3;
    }
  }
  function invadersStep(s) {
    if (s.over || s.paused) return;
    s.tick++;
    s.cooldown = Math.max(0, s.cooldown - 1);
    s.shield = Math.max(0, s.shield - 1);
    s.explosions = s.explosions.filter((e) => --e.life > 0);
    function hit(shot) {
      const i = s.enemies.findIndex(
        (e) => Math.abs(e.x - shot.x) <= 3 && shot.y <= e.y && shot.y > e.y - 3,
      );
      if (i < 0) return false;
      const e = s.enemies.splice(i, 1)[0];
      s.score += (3 - e.row) * 10;
      s.explosions.push({ ...e, life: 5 });
      return true;
    }
    s.shots = s.shots.filter((shot) => {
      if (hit(shot)) return false;
      shot.y--;
      return shot.y >= 0 && !hit(shot);
    });
    if (!s.enemies.length) {
      wave(s);
      return;
    }
    const speed = Math.max(
      2,
      9 - s.wave - Math.floor((21 - s.enemies.length) / 5),
    );
    if (s.tick % speed === 0) {
      const descend = s.enemies.some(
        (e) => e.x + s.direction < 3 || e.x + s.direction > 62,
      );
      if (descend) s.direction *= -1;
      s.enemies.forEach((e) => {
        if (descend) e.y++;
        else e.x += s.direction;
        if (e.y >= 20) s.over = true;
      });
    }
    if (s.tick % Math.max(5, 18 - s.wave) === 0) {
      const columns = new Map();
      s.enemies.forEach((e) => {
        if (!columns.has(e.x) || columns.get(e.x).y < e.y) columns.set(e.x, e);
      });
      const values = [...columns.values()].sort((a, b) => a.x - b.x);
      const e = values[Math.floor(s.tick / 3) % values.length];
      s.bombs.push({ x: e.x, y: e.y });
    }
    if (s.tick % 2 === 0)
      s.bombs = s.bombs.filter((b) => {
        b.y++;
        if (b.y >= 20 && b.y <= 22 && Math.abs(b.x - s.x) <= 3) {
          if (!s.shield) {
            s.lives--;
            s.shield = 16;
            if (!s.lives) s.over = true;
          }
          return false;
        }
        return b.y < 24;
      });
  }
  const api = {
    shapes,
    tetris,
    input,
    step,
    grid,
    duel,
    duelInput,
    duelStep,
    invaders,
    invadersInput,
    invadersStep,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PetsEngine = api;
})(globalThis);
