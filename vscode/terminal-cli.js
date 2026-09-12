"use strict";
// Native PTY host for Neovim. The artwork and games are shared with VS Code.
// No VS Code API, npm dependencies, browser, or shell command is needed.
const fs = require("node:fs");
const path = require("node:path");
const { ArcadeTerminal } = require("./terminal");
class EventEmitter {
  listeners = new Set();
  event = (fn) => {
    this.listeners.add(fn);
    return { dispose: () => this.listeners.delete(fn) };
  };
  fire(value) {
    for (const fn of this.listeners) fn(value);
  }
  dispose() {
    this.listeners.clear();
  }
}

function main() {
  const config = JSON.parse(process.env.PETSADHD_TERMINAL || "{}");
  const request = (value) =>
    process.stdout.write("\x1b]51;PetsADHD;" + JSON.stringify(value) + "\x07");
  let saved,
    lastAudio,
    saveFailed = false,
    hostHiding = false;
  if (config.stateFile && fs.existsSync(config.stateFile)) {
    try {
      saved = JSON.parse(fs.readFileSync(config.stateFile, "utf8"));
      if (
        !saved ||
        saved.version !== 2 ||
        !saved.games ||
        Array.isArray(saved.games)
      )
        throw new Error("Unsupported session format");
    } catch {
      request({
        kind: "notice",
        message:
          "Could not restore the saved terminal session; starting fresh.",
      });
      saved = undefined;
    }
  }
  const save = (state) => {
    if (!config.stateFile) return;
    const temporary = config.stateFile + "." + process.pid + ".tmp";
    try {
      fs.mkdirSync(path.dirname(config.stateFile), { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
      fs.renameSync(temporary, config.stateFile);
      saveFailed = false;
    } catch {
      try {
        fs.unlinkSync(temporary);
      } catch {}
      if (!saveFailed)
        request({
          kind: "notice",
          message: "Could not save the terminal session to " + config.stateFile,
        });
      saveFailed = true;
    }
  };
  const session = new ArcadeTerminal(
    { EventEmitter },
    {
      saved,
      pet: config.pet || "trex",
      pixelSize: config.pixelSize || 1,
      speed: config.speed || 1,
      music: config.music !== false,
      save,
      audio: (state, paused) => {
        const value = JSON.stringify({
          kind: "audio",
          mode: state.mode,
          enabled:
            !!state.musicOn &&
            ["pets", "tetris", "duel", "invaders"].includes(state.mode),
          paused: !!paused,
        });
        if (value !== lastAudio) {
          lastAudio = value;
          request(JSON.parse(value));
        }
      },
      hide: () => {
        if (!hostHiding) request({ kind: "hide" });
      },
      fit: () => request({ kind: "mode", mode: session.state.mode }),
      help: (message) => request({ kind: "help", message }),
      closed: () => {},
    },
  );
  session.onDidWrite((data) => process.stdout.write(data));
  const dimensions = () => ({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 8,
  });
  process.stdin.setRawMode?.(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  session.open(dimensions());
  session.select(config.mode || saved?.mode || "pets");
  let exiting = false;
  const stop = () => {
    if (exiting) return;
    exiting = true;
    session.dispose();
    process.stdin.setRawMode?.(false);
    process.stdin.pause();
    process.exitCode = 0;
  };
  process.stdout.on("resize", () => session.setDimensions(dimensions()));
  process.stdin.on("data", (data) => {
    // Private host controls; gameplay input (including fragmented arrow and
    // paste sequences) is passed intact to the shared terminal controller.
    for (const part of data.split(/([\x06\x0f\x10\x12\x1e])/)) {
      if (exiting) break;
      if (part === "\x1e") stop();
      else if (part === "\x0f") {
        hostHiding = true;
        session.minimize();
        hostHiding = false;
      } else if (part === "\x12") session.select();
      else if (part === "\x06" || part === "\x10") {
        // Companions keep moving while editing; games pause off-focus.
        session.setFocused(
          part === "\x06" || ["pets", "menu"].includes(session.state.mode),
        );
        session.save();
      } else if (!session.hidden) session.handleInput(part);
    }
  });
  process.stdin.on("end", stop);
  for (const signal of ["SIGTERM", "SIGHUP", "SIGINT"])
    process.on(signal, stop);
  process.on("exit", () => session.dispose());
}

if (require.main === module) main();
