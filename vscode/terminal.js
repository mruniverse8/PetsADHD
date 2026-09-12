"use strict";
const E = require("./media/engine");
const { render } = require("./terminal-renderer");
const modes = ["menu", "pets", "tetris", "duel", "invaders"];
const help = {
  menu: "Choose 1 Pets, 2 Tetris, 3 Competitive Tetris, or 4 Invaders. Move the panel with PetsADHD: Move Game Panel.",
  pets: "n: next pet (Rex, dog, duck, 67). w: sun/rain/auto. m: hide. Tab: menu.",
  tetris:
    "Arrows or h/j/k/l: move, soft drop, rotate. z: reverse rotate. Space: hard drop. + / -: speed 1–8.",
  duel: "Shared keyboard. P1: a/d move, s down, w/g rotate, f hard drop. P2: arrows, / reverse rotate, Enter hard drop. + / - changes both speeds.",
  invaders: "Left/Right or h/l: move. a: fire.",
};
class ArcadeTerminal {
  constructor(vscode, options) {
    this.options = options;
    this.write = new vscode.EventEmitter();
    this.onDidWrite = this.write.event;
    this.dimensions = { columns: 80, rows: 24 };
    const saved = options.saved || {};
    this.state = {
      version: 2,
      lastGame: saved.lastGame,
      mode: modes.includes(saved.mode) ? saved.mode : "menu",
      games: saved.games || {},
      pet: ["trex", "dog", "duck", "sixseven"].includes(saved.pet)
        ? saved.pet
        : options.pet || "trex",
      weather: saved.weather || "auto",
      petStyle: options.petStyle || "line",
      musicOn: saved.musicOn ?? options.music,
    };
    // Import minimized games from the old extension without resetting a board.
    for (const s of Object.values(this.state.games)) {
      if (s.hidden) s.paused = !!s.wasPaused;
      delete s.hidden;
      delete s.wasPaused;
    }
    this.hidden = false;
    this.focused = true;
    this.ready = false;
    this.frame = 0;
    this.pendingInput = "";
    this.ensure();
  }
  current() {
    return this.state.games[this.state.mode];
  }
  ensure() {
    const mode = this.state.mode;
    if (["tetris", "duel", "invaders"].includes(mode) && !this.current())
      this.state.games[mode] = E[mode]({ speed: this.options.speed });
  }
  save() {
    this.options.save(JSON.parse(JSON.stringify(this.state)));
  }
  open(dimensions) {
    if (dimensions) {
      this.dimensions = dimensions;
      this.hasDimensions = true;
    }
    this.ready = true;
    this.write.fire("\x1b[?1049h\x1b[?25l\x1b[?2004h\x1b[?7l\x1b[2J");
    this.redraw(true);
    this.timer = setInterval(() => this.tick(), 100);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    this.ready = false;
    this.hidden = true;
    this.save();
    this.options.audio(this.state, true);
    this.options.closed();
  }
  dispose() {
    this.close();
    this.write.fire("\x1b[0m\x1b[?7h\x1b[?2004l\x1b[?25h\x1b[?1049l");
    this.write.dispose();
  }
  setDimensions(dimensions) {
    this.hasDimensions = true;
    this.dimensions = dimensions;
    this.redraw(true);
  }
  setFocused(focused) {
    this.focused = focused;
    this.redraw();
  }
  select(mode, fit = true) {
    if (modes.includes(mode)) this.state.mode = mode;
    this.hidden = false;
    this.focused = true;
    if (["tetris", "duel", "invaders"].includes(this.state.mode))
      this.state.lastGame = this.state.mode;
    this.ensure();
    this.save();
    this.redraw(true);
    if (fit) this.options.fit?.();
  }
  minimize() {
    this.hidden = true;
    this.save();
    this.options.audio(this.state, true);
    this.options.hide();
  }
  redraw(force = false) {
    if (!this.ready || this.hidden) return;
    const rendered = render(
      this.state,
      this.dimensions,
      this.frame,
      !this.focused,
    );
    this.playable = rendered.playable;
    let output = force ? "\x1b[2J" : "";
    rendered.lines.forEach((line, i) => {
      if (force || line !== this.lines?.[i])
        output += `\x1b[${i + 1};1H` + line;
    });
    this.lines = rendered.lines;
    if (output) this.write.fire(output);
    this.options.audio(
      this.state,
      this.sizing ||
        !this.focused ||
        !this.playable ||
        !!this.current()?.paused ||
        !!this.current()?.over,
    );
  }
  tick() {
    if (
      this.sizing ||
      !this.ready ||
      this.hidden ||
      !this.focused ||
      !this.playable
    )
      return;
    this.frame++;
    const s = this.current();
    if (s) {
      if (this.state.mode === "tetris") E.step(s);
      else if (this.state.mode === "duel") E.duelStep(s);
      else E.invadersStep(s);
    }
    this.redraw();
    if (this.frame % 10 === 0) this.save();
  }
  handleInput(data) {
    // Arrow sequences may arrive split across callbacks. Ignore unknown escape
    // sequences as a unit, including bracketed paste (never play pasted keys).
    this.pendingInput += data;
    while (this.pendingInput) {
      if (this.pendingInput.startsWith("\x1b[200~")) {
        const end = this.pendingInput.indexOf("\x1b[201~");
        if (end < 0) return;
        this.pendingInput = this.pendingInput.slice(end + 6);
        continue;
      }
      let key;
      if (this.pendingInput[0] === "\x1b") {
        if (this.pendingInput.length === 1) return;
        if (/^\x1b[\[O]/.test(this.pendingInput)) {
          const match = this.pendingInput.match(/^\x1b[\[O][0-9;?]*([@-~])/);
          if (!match) return;
          key = { A: "up", B: "down", C: "right", D: "left" }[match[1]];
          this.pendingInput = this.pendingInput.slice(match[0].length);
        } else {
          this.pendingInput = this.pendingInput.slice(2);
          continue;
        }
      } else {
        key = this.pendingInput[0];
        this.pendingInput = this.pendingInput.slice(1);
      }
      if (key) this.key(key);
      if (this.hidden) {
        this.pendingInput = "";
        break;
      }
    }
  }
  key(key) {
    this.focused = true;
    if (key === "m") return this.minimize();
    if (key === "?")
      return this.options.help(
        help[this.state.mode] +
          " All games: p pause, r restart, m hide/resume, M music, Tab menu, q discard current game.",
      );
    if (key === "\t") return this.select("menu");
    if (key === "q" || key === "\x03") {
      delete this.state.games[this.state.mode];
      return this.select("menu");
    }
    if (this.state.mode === "menu") {
      const mode = { 1: "pets", 2: "tetris", 3: "duel", 4: "invaders" }[key];
      if (mode) this.select(mode);
      return;
    }
    if (key === "M") this.state.musicOn = !this.state.musicOn;
    else if (this.state.mode === "pets") {
      if (key === "n") {
        const pets = ["trex", "dog", "duck", "sixseven"];
        this.state.pet = pets[(pets.indexOf(this.state.pet) + 1) % pets.length];
      }
      if (key === "w") {
        const weather = ["auto", "sun", "rain"];
        this.state.weather =
          weather[(weather.indexOf(this.state.weather) + 1) % weather.length];
      }
    } else if (key === "r") {
      const speed =
        this.state.mode === "duel"
          ? this.current().players[0].speed
          : this.current().speed;
      this.state.games[this.state.mode] = E[this.state.mode]({
        speed: speed || this.options.speed,
      });
    } else if (this.playable || key === "p") {
      const common = {
        p: "pause",
        "+": "faster",
        "=": "faster",
        "-": "slower",
      };
      const arrows = {
        left: "left",
        right: "right",
        down: "down",
        up: "rotate",
      };
      let action = common[key],
        player = 0;
      const mode = this.state.mode;
      if (mode === "duel") {
        action ||= {
          a: "left",
          d: "right",
          s: "down",
          w: "rotate",
          g: "reverse",
          f: "drop",
        }[key];
        if (!action) {
          action = { ...arrows, "/": "reverse", "\r": "drop", "\n": "drop" }[
            key
          ];
          player = 1;
        }
      } else if (mode === "tetris")
        action ||= {
          ...arrows,
          h: "left",
          l: "right",
          j: "down",
          k: "rotate",
          x: "rotate",
          z: "reverse",
          " ": "drop",
        }[key];
      else
        action ||= {
          left: "left",
          right: "right",
          h: "left",
          l: "right",
          a: "fire",
        }[key];
      if (action) {
        if (mode === "duel") E.duelInput(this.current(), action, player);
        else if (mode === "tetris") E.input(this.current(), action);
        else E.invadersInput(this.current(), action);
      }
    }
    this.save();
    this.redraw();
  }
}
module.exports = { ArcadeTerminal };
