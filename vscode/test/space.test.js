const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { types, eventAt, summon } = require("../space-events");
const { scene } = require("../pet-scene");
test("seeded space events vary over time but remain stable between renders and have quiet intervals", () => {
  const state = { spaceSeed: 3741 };
  const seen = new Set();
  let quiet = 0;
  for (let frame = 0; frame < 8000; frame += 10) {
    const event = eventAt(state, frame);
    assert.deepEqual(eventAt(state, frame), event);
    if (event) {
      seen.add(event.type);
      assert.ok(event.age >= 0 && event.age < 70);
    } else quiet++;
  }
  assert.equal(seen.size, types.length);
  assert.ok(quiet > 100);
  assert.notDeepEqual(
    Array.from({ length: 500 }, (_, f) => eventAt(state, f)),
    Array.from({ length: 500 }, (_, f) => eventAt({ spaceSeed: 8453 }, f)),
  );
});
test("every event renders visibly inside the four-row sky without affecting pet size", () => {
  const state = { pet: "dog", pixelSize: 1, spaceSeed: 1 };
  for (const type of types) {
    const withEvent = scene(
      { ...state, spaceEvent: { type, start: 0, seed: 10 } },
      80,
      20,
    );
    const without = scene(state, 80, 20);
    assert.equal(withEvent.event.type, type);
    assert.notDeepEqual(withEvent.grid, without.grid);
    assert.deepEqual(withEvent.actor, without.actor);
    assert.equal(withEvent.grid.length, 8);
    assert.ok(withEvent.grid.every((row) => row.length === 78));
  }
  const hole = scene(
    { ...state, spaceEvent: { type: "blackhole", start: 0, seed: 10 } },
    80,
    20,
  );
  assert.ok(hole.grid.flat().includes("#08050e"));
  const explosion = scene(
    { ...state, spaceEvent: { type: "supernova", start: 0, seed: 10 } },
    80,
    20,
  );
  assert.ok(explosion.grid.flat().includes("#fff3bd"));
});
test("manual events start now, persist in saved state and expire after seven active seconds", () => {
  const state = { spaceSeed: 1, petFrame: 80 };
  summon(state, () => 0.25);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(eventAt(restored, 80).age, 0);
  assert.equal(eventAt(restored, 149).age, 69);
  assert.equal(eventAt(restored, 150), null);
});
