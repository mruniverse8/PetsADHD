const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../media/engine");
test("Tetris gravity, speed, walls, hard drop and pause", () => {
  const slow = E.tetris({ seed: 42 }),
    fast = E.tetris({ seed: 42, speed: 8 });
  E.step(slow);
  E.step(fast);
  assert.equal(slow.piece.y, 0);
  assert.equal(fast.piece.y, 1);
  for (let i = 0; i < 20; i++) E.input(slow, "left");
  const x = slow.piece.x;
  E.input(slow, "left");
  assert.equal(slow.piece.x, x);
  E.input(slow, "drop");
  assert.equal(slow.board.flat().filter(Boolean).length, 4);
  E.input(slow, "pause");
  const frozen = JSON.stringify(slow);
  E.step(slow);
  E.input(slow, "drop");
  assert.equal(JSON.stringify(slow), frozen);
});
test("four-line clear sends garbage, levels up, and uses identical bags", () => {
  const m = E.duel({ seed: 42 });
  const p = m.players[0];
  for (let y = 16; y < 20; y++)
    p.board[y] = Array.from({ length: 10 }, (_, x) => (x === 4 ? null : "J"));
  p.piece = { kind: "I", shape: ["I", "I", "I", "I"], x: 4, y: 16 };
  p.lines = 6;
  E.duelInput(m, "drop", 0);
  assert.equal(p.score, 800);
  assert.equal(p.level, 2);
  assert.equal(m.players[1].pending, 4);
  E.duelInput(m, "drop", 1);
  for (let y = 16; y < 20; y++)
    assert.equal(m.players[1].board[y].filter(Boolean).length, 9);
  const a = E.tetris({ seed: 123 }),
    b = E.tetris({ seed: 123 });
  for (let i = 0; i < 14; i++) {
    assert.equal(a.piece.kind, b.piece.kind);
    for (const s of [a, b]) {
      E.input(s, "drop");
      s.board = Array.from({ length: 20 }, () => Array(10).fill(null));
    }
  }
});
test("top-out decides competitive winner and serializable state resumes", () => {
  const s = E.duel({ seed: 1 });
  s.players[0].over = true;
  E.duelStep(s);
  assert.equal(s.winner, 2);
  const data = JSON.parse(JSON.stringify(E.tetris({ seed: 2 })));
  E.input(data, "drop");
  assert.equal(data.locks, 1);
});
test("Invaders firing, kills, shield and wave progression", () => {
  const s = E.invaders();
  E.invadersInput(s, "fire");
  E.invadersInput(s, "fire");
  assert.equal(s.shots.length, 1);
  const e = s.enemies[0];
  s.shots = [{ x: e.x, y: e.y }];
  E.invadersStep(s);
  assert.equal(s.score, 30);
  assert.equal(s.enemies.length, 20);
  s.enemies = [{ x: 10, y: 3, row: 0 }];
  s.shots = [{ x: 10, y: 3 }];
  E.invadersStep(s);
  assert.equal(s.wave, 2);
  s.tick = 1;
  s.bombs = [
    { x: s.x, y: 19 },
    { x: s.x, y: 19 },
  ];
  E.invadersStep(s);
  assert.equal(s.lives, 2);
  assert.ok(s.shield > 0);
});
