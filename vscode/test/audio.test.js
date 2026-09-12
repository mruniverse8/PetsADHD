const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { EventEmitter } = require("node:events"),
  { Music } = require("../audio");
test("audio cancellation cannot create an orphan player and pause owns its signals", () => {
  const jobs = [];
  function launch(command, args) {
    const p = new EventEmitter();
    p.stdout = new EventEmitter();
    p.stderr = new EventEmitter();
    p.signals = [];
    p.kill = (s) => p.signals.push(s || "SIGTERM");
    jobs.push({ command, args, p });
    return p;
  }
  const music = new Music(
    () => ({ url: "https://www.youtube.com/watch?v=oor2uIqys8M", volume: 25 }),
    () => {},
    launch,
  );
  music.start();
  music.stop();
  jobs[0].p.stdout.emit("data", "https://example.com/audio");
  jobs[0].p.emit("close", 0);
  assert.equal(jobs.length, 1);
  music.start();
  jobs[1].p.stdout.emit("data", "https://example.com/audio");
  jobs[1].p.emit("close", 0);
  assert.equal(jobs[2].command, "ffplay");
  music.pause(true);
  if (process.platform !== "win32")
    assert.ok(jobs[2].p.signals.includes("SIGSTOP"));
  music.stop();
  assert.ok(jobs[2].p.signals.includes("SIGTERM"));
});
