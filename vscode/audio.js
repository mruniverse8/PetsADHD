"use strict";
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { homedir } = require("node:os");
const path = require("node:path");
class Music {
  constructor(config, notify, launch = spawn) {
    this.config = config;
    this.notify = notify;
    this.launch = launch;
    this.generation = 0;
    this.paused = false;
  }
  signal(name) {
    try {
      this.player?.kill(name);
    } catch {}
  }
  stop() {
    this.generation++;
    clearTimeout(this.timeout);
    this.signal("SIGCONT");
    this.player?.kill();
    this.extractor?.kill();
    this.player = this.extractor = null;
  }
  pause(value) {
    if (this.paused === value) return;
    this.paused = value;
    if (process.platform === "win32") {
      if (value) this.stop();
      else this.start();
    } else this.signal(value ? "SIGSTOP" : "SIGCONT");
  }
  start() {
    if (this.player || this.extractor) return;
    const generation = this.generation,
      config = this.config();
    const local = path.join(
      homedir(),
      ".local",
      "share",
      "nvim",
      "invaders-audio",
      "bin",
      "yt-dlp",
    );
    const extractor =
      config.extractor || (existsSync(local) ? local : "yt-dlp");
    let output = "",
      errors = "",
      failed = false;
    const fail = (message) => {
      if (this.generation === generation && !failed) {
        failed = true;
        clearTimeout(this.timeout);
        this.notify(message);
      }
    };
    this.extractor = this.launch(
      extractor,
      [
        "--ignore-config",
        "--no-playlist",
        "--no-warnings",
        "--socket-timeout",
        "10",
        "--retries",
        "1",
        "--js-runtimes",
        "node",
        "-f",
        "bestaudio",
        "--get-url",
        config.url,
      ],
      { windowsHide: true },
    );
    this.extractor.stdout.on("data", (chunk) => {
      if (output.length < 65536) output += chunk;
    });
    this.extractor.stderr.on("data", (chunk) => {
      if (errors.length < 4096) errors += chunk;
    });
    this.extractor.on("error", () =>
      fail("Music needs yt-dlp and ffplay on PATH."),
    );
    this.extractor.on("close", (code) => {
      if (this.generation !== generation) return;
      this.extractor = null;
      clearTimeout(this.timeout);
      const url = output.trim().split(/\r?\n/)[0];
      if (code !== 0 || !url.startsWith("https://")) {
        fail("Soundtrack unavailable. " + errors.trim().slice(0, 160));
        return;
      }
      this.player = this.launch(
        "ffplay",
        [
          "-nodisp",
          "-vn",
          "-autoexit",
          "-loglevel",
          "error",
          "-volume",
          String(Math.max(0, Math.min(100, config.volume))),
          "-loop",
          "0",
          url,
        ],
        { windowsHide: true, stdio: "ignore" },
      );
      this.player.on("error", () =>
        fail("Could not start ffplay. Install FFmpeg to enable music."),
      );
      this.player.on("close", (code) => {
        if (this.generation !== generation) return;
        this.player = null;
        if (code) fail("Soundtrack playback failed. Check audio output.");
      });
      if (this.paused) {
        if (process.platform === "win32") this.stop();
        else this.signal("SIGSTOP");
      }
    });
    this.timeout = setTimeout(() => {
      if (this.generation === generation && this.extractor) {
        fail("Soundtrack request timed out. Toggle music to retry.");
        this.stop();
      }
    }, 30000);
    this.timeout.unref?.();
  }
}
module.exports = { Music };
