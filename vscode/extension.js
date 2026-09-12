"use strict";
const vscode = require("vscode");
const crypto = require("node:crypto");
const { Music } = require("./audio");
function activate(context) {
  let panel,
    desiredPaused = true,
    musicOn = false,
    musicMode = "invaders";
  const setting = () => vscode.workspace.getConfiguration("petsadhd");
  const music = new Music(
    () => ({
      url:
        musicMode === "tetris"
          ? setting().get(
              "tetris.musicUrl",
              "https://www.youtube.com/watch?v=oor2uIqys8M",
            )
          : setting().get("music.url"),
      volume: setting().get("music.volume", 25),
      extractor: setting().get("music.extractor", ""),
    }),
    (message) => vscode.window.showWarningMessage("PetsADHD: " + message),
  );
  function audio() {
    if (!vscode.workspace.isTrusted || !musicOn) {
      music.stop();
      return;
    }
    music.pause(desiredPaused || !panel?.visible);
    if (!desiredPaused && panel?.visible) music.start();
  }
  function html(webview, sidebar = false, restored) {
    const nonce = crypto.randomBytes(18).toString("hex");
    const uri = (name) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "media", name),
      );
    const initial = {
      sidebar,
      state: restored || context.workspaceState.get("arcade"),
      pet: context.globalState.get("pet", "trex"),
      speed: setting().get("tetris.speed", 1),
      music: setting().get("music.enabled", true),
    };
    const data = JSON.stringify(initial).replace(/</g, "\\u003c");
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};"><link rel="stylesheet" href="${uri("style.css")}"><title>PetsADHD</title></head><body class="${sidebar ? "sidebar" : ""}">
      <header><strong>Pets<span>ADHD</span></strong><small id="subtitle">A little arcade in your editor</small></header>
      <nav aria-label="Games"><button data-mode="pets">Pets</button><button data-mode="tetris">Tetris</button><button data-mode="duel">2 Players</button><button data-mode="invaders">Invaders</button></nav>
      <section id="petControls"><label>Pet <select id="pet"><option value="trex">Rex</option><option value="dog">Biscuit</option><option value="duck">Quackers</option><option value="sixseven">67</option></select></label><label>Sky <select id="weather"><option value="auto">Auto</option><option value="sun">Sun</option><option value="rain">Rain</option></select></label></section>
      <section id="gameControls"><button id="pause">Pause (p)</button><button id="minimize">Minimize (m)</button><button id="restart">Restart (r)</button><button id="music">Music (M)</button><label>Speed <select id="speed">${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1}×</option>`).join("")}</select></label></section>
      <p id="status" role="status"></p><canvas id="screen" width="900" height="540" tabindex="0" aria-label="PetsADHD game area"></canvas><p id="help"></p>
      <script nonce="${nonce}">globalThis.PetsInitial=${data};</script><script nonce="${nonce}" src="${uri("engine.js")}"></script><script nonce="${nonce}" src="${uri("pets.js")}"></script><script nonce="${nonce}" src="${uri("app.js")}"></script></body></html>`;
  }
  function configure(target, sidebar = false, restored) {
    target.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    };
    target.webview.html = html(target.webview, sidebar, restored);
    target.webview.onDidReceiveMessage(
      async (message) => {
        if (
          message.type === "open" &&
          ["pets", "tetris", "duel", "invaders"].includes(message.mode)
        ) {
          open(message.mode);
          return;
        }
        if (
          message.type === "pet" &&
          ["trex", "dog", "duck", "sixseven"].includes(message.pet)
        ) {
          await context.globalState.update("pet", message.pet);
          return;
        }
        if (sidebar) return;
        if (
          message.type === "save" &&
          message.state &&
          typeof message.state === "object"
        )
          await context.workspaceState.update("arcade", message.state);
        if (message.type === "minimize" && message.state) {
          await context.workspaceState.update("arcade", message.state);
          music.stop();
          if (panel === target) target.dispose();
        }
        if (message.type === "music") {
          const nextMode = ["tetris", "duel"].includes(message.mode)
            ? "tetris"
            : "invaders";
          if (nextMode !== musicMode) music.stop();
          musicMode = nextMode;
          musicOn = message.enabled === true;
          desiredPaused = message.paused === true;
          audio();
        }
        if (message.type === "ready")
          target.webview.postMessage({
            type: "visible",
            visible: target.visible,
          });
      },
      undefined,
      context.subscriptions,
    );
  }
  function attach(target, restored) {
    panel = target;
    configure(target, false, restored);
    target.onDidDispose(
      () => {
        if (panel === target) panel = undefined;
        music.stop();
      },
      undefined,
      context.subscriptions,
    );
    target.onDidChangeViewState(
      () => {
        target.webview.postMessage({
          type: "visible",
          visible: target.visible,
        });
        music.pause(!target.visible || desiredPaused);
      },
      undefined,
      context.subscriptions,
    );
  }
  function open(mode) {
    if (panel) {
      panel.reveal();
      if (mode) panel.webview.postMessage({ type: "mode", mode });
      return;
    }
    const target = vscode.window.createWebviewPanel(
      "petsadhd.arcade",
      "PetsADHD",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      },
    );
    const saved = context.workspaceState.get("arcade");
    attach(target, mode ? { ...saved, mode } : saved);
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("petsadhd.open", () => open()),
  );
  for (const mode of ["tetris", "duel", "invaders"])
    context.subscriptions.push(
      vscode.commands.registerCommand("petsadhd." + mode, () => open(mode)),
    );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("petsadhd.habitat", {
      resolveWebviewView(view) {
        configure(view, true);
      },
    }),
  );
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer("petsadhd.arcade", {
      async deserializeWebviewPanel(target, state) {
        attach(target, state);
      },
    }),
  );
  context.subscriptions.push({
    dispose() {
      music.stop();
      panel?.dispose();
    },
  });
}
module.exports = { activate };
