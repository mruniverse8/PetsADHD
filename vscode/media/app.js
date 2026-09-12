(() => {
  "use strict";
  const api = acquireVsCodeApi(),
    E = PetsEngine,
    initial = PetsInitial;
  const saved = api.getState() || initial.state || {};
  let mode = initial.sidebar
    ? "pets"
    : ["pets", "tetris", "duel", "invaders"].includes(saved.mode)
      ? saved.mode
      : "pets";
  const games = saved.games || {};
  let pet = saved.pet || initial.pet || "trex",
    weather = saved.weather || "auto",
    musicOn = saved.musicOn ?? initial.music;
  let visible = true,
    frame = 0,
    lastMusic = "",
    lastSave = 0;
  const $ = (id) => document.getElementById(id),
    canvas = $("screen"),
    ctx = canvas.getContext("2d");
  const colors = {
    I: "#8bd5ef",
    O: "#eed49f",
    T: "#c6a0f6",
    S: "#a6da95",
    Z: "#ed8796",
    J: "#8aadf4",
    L: "#f5a97f",
    Garbage: "#65748b",
  };
  function state() {
    return { version: 1, mode, games, pet, weather, musicOn };
  }
  function save() {
    if (initial.sidebar) return;
    const value = state();
    api.setState(value);
    api.postMessage({ type: "save", state: value });
  }
  function current() {
    return games[mode];
  }
  function ensure() {
    if (mode === "pets") return;
    games[mode] ||=
      mode === "tetris"
        ? E.tetris({ speed: initial.speed })
        : mode === "duel"
          ? E.duel({ speed: initial.speed })
          : E.invaders();
  }
  function syncMusic() {
    if (initial.sidebar) return;
    const paused =
      !visible || mode === "pets" || !!current()?.paused || !!current()?.over;
    const value = JSON.stringify({
      enabled: !!musicOn && mode !== "pets",
      paused,
    });
    if (value !== lastMusic) {
      lastMusic = value;
      api.postMessage({
        type: "music",
        enabled: !!musicOn && mode !== "pets",
        paused,
      });
    }
    $("music").textContent = musicOn ? "Music on (M)" : "Music off (M)";
  }
  function hideGame() {
    const s = current();
    if (s) {
      s.wasPaused = !!s.paused;
      s.paused = true;
      s.hidden = true;
    }
  }
  function restoreGame() {
    const s = current();
    if (s?.hidden) {
      s.paused = s.wasPaused;
      s.hidden = false;
    }
  }
  function select(next) {
    if (initial.sidebar && next !== "pets") {
      api.postMessage({ type: "open", mode: next });
      return;
    }
    if (next !== mode) hideGame();
    mode = next;
    ensure();
    restoreGame();
    update();
    save();
    canvas.focus();
  }
  function action(key, player) {
    const s = current();
    if (!s) return;
    if (mode === "tetris") E.input(s, key);
    else if (mode === "duel") E.duelInput(s, key, player);
    else E.invadersInput(s, key);
    update();
    save();
  }
  function minimize() {
    hideGame();
    syncMusic();
    api.setState(state());
    api.postMessage({ type: "minimize", state: state() });
  }
  function restart() {
    const speed =
      mode === "duel" ? current()?.players[0].speed : current()?.speed;
    games[mode] =
      mode === "duel"
        ? E.duel({ speed })
        : mode === "tetris"
          ? E.tetris({ speed })
          : E.invaders();
    update();
    save();
    canvas.focus();
  }
  function text(value, x, y, color = "#cad7e5", size = 16) {
    ctx.fillStyle = color;
    ctx.font = `${size}px monospace`;
    ctx.fillText(value, x, y);
  }
  function board(s, x, y, cell) {
    const grid = E.grid(s);
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(x - 2, y - 2, cell * 10 + 4, cell * 20 + 4);
    grid.forEach((row, r) =>
      row.forEach((kind, c) => {
        const px = x + c * cell,
          py = y + r * cell;
        ctx.strokeStyle = "#1c2940";
        ctx.strokeRect(px, py, cell, cell);
        if (!kind) return;
        if (kind === "ghost") {
          ctx.strokeStyle = "#64748b";
          ctx.strokeRect(px + 3, py + 3, cell - 6, cell - 6);
        } else {
          ctx.fillStyle = colors[kind];
          ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
          ctx.fillStyle = "#ffffff40";
          ctx.fillRect(px + 2, py + 2, cell - 4, 3);
        }
      }),
    );
  }
  function preview(kind, x, y) {
    E.shapes[kind].forEach((row, r) =>
      [...row].forEach((v, c) => {
        if (v !== " ") {
          ctx.fillStyle = colors[kind];
          ctx.fillRect(x + c * 16, y + r * 16, 14, 14);
        }
      }),
    );
  }
  function tetrisScene(s) {
    board(s, 160, 20, 24);
    text("ASTRA TETRIS", 460, 55, "#8bd5ef", 25);
    text(`Score  ${s.score}`, 460, 100);
    text(`Lines  ${s.lines}`, 460, 132);
    text(`Level  ${s.level}`, 460, 164);
    text(`Speed  ${s.speed}x`, 460, 196);
    text("NEXT", 460, 245);
    preview(s.next, 460, 268);
    text(":: Landing guide", 460, 390, "#7487a0");
  }
  function duelScene(s) {
    s.players.forEach((p, i) => {
      const x = 55 + i * 435;
      text(
        `PLAYER ${i + 1}    ${p.score} pts`,
        x,
        28,
        i ? "#c6a0f6" : "#8bd5ef",
        19,
      );
      board(p, x, 44, 22);
      text(`Next ${p.next}`, x + 240, 90);
      preview(p.next, x + 240, 108);
      text(`Incoming: ${p.pending}`, x + 240, 205, "#ed8796", 13);
      text(`Lines: ${p.lines}`, x + 240, 235, "#a6da95", 13);
    });
  }
  function invadersScene(s) {
    const dx = 12.5,
      dy = 19,
      ox = 35,
      oy = 30;
    ctx.font = "16px monospace";
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 66; x++) {
        const n =
          (((x * 31 + (y - Math.floor(s.tick / 5)) * 17) % 137) + 137) % 137;
        if (n === 0 || n === 33)
          text(n === 0 ? "+" : ".", ox + x * dx, oy + y * dy, "#3b5068", 13);
      }
    const art = [
      ["  .^.  ", " /o o\\ ", "<|_V_|>"],
      [" \\| |/ ", "[=o o=]", " /|_|\\ "],
      ["  ___  ", " /===\\ ", "<_o_o_>"],
    ];
    s.enemies.forEach((e) =>
      art[e.row].forEach((row, r) =>
        text(
          row,
          ox + (e.x - 3) * dx,
          oy + (e.y - 2 + r) * dy,
          ["#c6a0f6", "#a6da95", "#eed49f"][e.row],
          19,
        ),
      ),
    );
    s.shots.forEach((b) =>
      text("|", ox + b.x * dx, oy + b.y * dy, "#b8ffda", 19),
    );
    s.bombs.forEach((b) =>
      text(
        s.tick % 4 < 2 ? "v" : "!",
        ox + b.x * dx,
        oy + b.y * dy,
        "#ff8095",
        19,
      ),
    );
    ["   ^   ", "  /A\\  ", "</_#_\\>"].forEach((row, r) =>
      text(
        row,
        ox + (s.x - 3) * dx,
        oy + (20 + r) * dy,
        s.shield ? "#fff" : "#8bd5ef",
        19,
      ),
    );
    text(
      s.tick % 4 < 2 ? "V" : ":",
      ox + s.x * dx,
      oy + 23 * dy,
      "#ffad5c",
      19,
    );
    s.explosions.forEach((e) =>
      ["\\|/", "-*-", "/|\\"].forEach((row, r) =>
        text(row, ox + (e.x - 1) * dx, oy + (e.y - 2 + r) * dy, "#ffd77c", 19),
      ),
    );
  }
  function petScene() {
    const rain =
      weather === "rain" || (weather === "auto" && frame % 180 >= 110);
    if (rain) {
      ctx.fillStyle = "#58718c";
      for (let i = 0; i < 50; i++)
        ctx.fillRect(
          (i * 79 + frame * 2) % 900,
          (i * 41 + frame * 12) % 500,
          2,
          12,
        );
    } else {
      ctx.fillStyle = "#eed49f";
      ctx.beginPath();
      ctx.arc(770, 80, 35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#263d39";
    ctx.fillRect(0, 475, 900, 65);
    const art = PetsSprites.art[pet] || PetsSprites.art.trex,
      scale = pet === "sixseven" ? 22 : 17,
      w = Math.max(...art.map((row) => row.length)) * scale;
    const phase = (frame * 3) % (2 * (860 - w));
    const x = 20 + Math.min(phase, 2 * (860 - w) - phase),
      y = 450 - art.length * scale + Math.round(Math.sin(frame / 4) * 7);
    if (pet === "sixseven") {
      ctx.fillStyle = "#101725";
      ctx.fillRect(x - 10, y - 10, w + 20, art.length * scale + 20);
    }
    art.forEach((row, r) =>
      [...row].forEach((c, col) => {
        if (c !== " ") {
          ctx.fillStyle = PetsSprites.palette[c];
          ctx.fillRect(x + col * scale, y + r * scale, scale, scale);
        }
      }),
    );
  }
  function draw() {
    ctx.fillStyle = "#101725";
    ctx.fillRect(0, 0, 900, 540);
    if (mode === "pets") petScene();
    else if (mode === "tetris") tetrisScene(current());
    else if (mode === "duel") duelScene(current());
    else invadersScene(current());
    const s = current();
    if (mode !== "pets" && (s.paused || s.over)) {
      ctx.fillStyle = "#090e1bc9";
      ctx.fillRect(0, 210, 900, 95);
      const label = s.over
        ? mode === "duel"
          ? s.winner
            ? `PLAYER ${s.winner} WINS`
            : "DRAW"
          : "GAME OVER"
        : "PAUSED";
      ctx.textAlign = "center";
      text(label, 450, 248, "#eed49f", 28);
      text(
        s.over ? "r / Restart for a new game" : "p / Pause to resume",
        450,
        280,
        "#cad7e5",
        14,
      );
      ctx.textAlign = "start";
    }
  }
  function update() {
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    $("petControls").classList.toggle("hidden", mode !== "pets");
    $("gameControls").classList.toggle("hidden", mode === "pets");
    $("speed").parentElement.classList.toggle("hidden", mode === "invaders");
    const s = current();
    if (s)
      $("speed").value = mode === "duel" ? s.players[0].speed : s.speed || 1;
    $("status").textContent =
      mode === "pets"
        ? "Your sidebar companion"
        : mode === "invaders"
          ? `Score ${s.score}  ·  Wave ${s.wave}  ·  Lives ${s.lives}`
          : mode === "duel"
            ? "Local 2-player match · identical pieces · clear rows to attack"
            : "Astra Tetris · + / − adjusts speed";
    $("help").textContent =
      mode === "pets"
        ? "Choose a companion and sky above."
        : mode === "duel"
          ? "P1: A/D move · S down · W/G rotate · F hard drop. P2: arrows · / reverse rotate · Enter hard drop. m minimize · M music · p pause."
          : mode === "invaders"
            ? "← / → or h/l move · a fires · m minimizes · M music · p pauses · r restarts."
            : "Arrows or hjkl move / rotate · z reverse rotates · Space hard drops · +/− speed · m minimize · M music · p pause.";
    syncMusic();
    draw();
  }
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => (b.onclick = () => select(b.dataset.mode)));
  $("pet").value = pet;
  $("weather").value = weather;
  $("pet").onchange = (e) => {
    pet = e.target.value;
    api.postMessage({ type: "pet", pet });
    save();
    draw();
  };
  $("weather").onchange = (e) => {
    weather = e.target.value;
    save();
  };
  $("pause").onclick = () => {
    action("pause");
    canvas.focus();
  };
  $("minimize").onclick = minimize;
  $("restart").onclick = restart;
  $("music").onclick = () => {
    musicOn = !musicOn;
    syncMusic();
    save();
    canvas.focus();
  };
  $("speed").onchange = (e) => {
    const speed = Number(e.target.value);
    if (mode === "duel") current().players.forEach((p) => (p.speed = speed));
    else current().speed = speed;
    update();
    save();
    canvas.focus();
  };
  document.addEventListener("keydown", (event) => {
    if (
      mode === "pets" ||
      ["SELECT", "INPUT", "TEXTAREA"].includes(event.target.tagName)
    )
      return;
    const key = event.key;
    if (key === "m") {
      event.preventDefault();
      minimize();
      return;
    }
    if (key === "M") {
      event.preventDefault();
      $("music").click();
      return;
    }
    if (key === "p" || key === "r") {
      event.preventDefault();
      key === "p" ? action("pause") : restart();
      return;
    }
    if (["+", "=", "-"].includes(key) && mode !== "invaders") {
      event.preventDefault();
      action(key === "-" ? "slower" : "faster");
      return;
    }
    let command,
      player = 0;
    if (mode === "duel") {
      const one = {
          a: "left",
          d: "right",
          s: "down",
          w: "rotate",
          g: "reverse",
          f: "drop",
        },
        two = {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowDown: "down",
          ArrowUp: "rotate",
          "/": "reverse",
          Enter: "drop",
        };
      if (one[key]) command = one[key];
      else {
        command = two[key];
        player = 1;
      }
    } else
      command =
        mode === "invaders"
          ? {
              ArrowLeft: "left",
              ArrowRight: "right",
              h: "left",
              l: "right",
              a: "fire",
            }[key]
          : {
              ArrowLeft: "left",
              ArrowRight: "right",
              ArrowDown: "down",
              ArrowUp: "rotate",
              h: "left",
              l: "right",
              j: "down",
              k: "rotate",
              x: "rotate",
              z: "reverse",
              " ": "drop",
            }[key];
    if (command) {
      event.preventDefault();
      action(command, player);
    }
  });
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (m.type === "mode") select(m.mode);
    if (m.type === "visible") {
      visible = m.visible;
      if (!visible && current()) current().paused = true;
      syncMusic();
      draw();
    }
  });
  window.addEventListener("blur", () => {
    if (mode !== "pets" && current()) {
      current().paused = true;
      update();
      save();
    }
  });
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (!visible && current()) current().paused = true;
    syncMusic();
  });
  ensure();
  restoreGame();
  update();
  api.postMessage({ type: "ready" });
  setInterval(() => {
    if (!visible) return;
    frame++;
    const s = current();
    if (mode === "tetris") E.step(s);
    else if (mode === "duel") E.duelStep(s);
    else if (mode === "invaders") E.invadersStep(s);
    update();
    if (Date.now() - lastSave > 1000) {
      lastSave = Date.now();
      save();
    }
  }, 100);
})();
