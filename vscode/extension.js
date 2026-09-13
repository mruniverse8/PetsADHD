"use strict";
const vscode = require("vscode");
const { Music } = require("./audio");
const { ArcadeTerminal } = require("./terminal");
const { fitPanel } = require("./panel");
const pets = require("./pet-scene");
function activate(context) {
  let terminal,
    pty,
    musicMode,
    lastAudio = "",
    shuttingDown = false;
  const setting = () => vscode.workspace.getConfiguration("petsadhd");
  const music = new Music(
    () => ({
      url:
        musicMode === "pets"
          ? setting().get(
              "pets.musicUrl",
              "https://www.youtube.com/watch?v=5vaaOqLHxrE",
            )
          : musicMode === "tetris"
            ? setting().get(
                "tetris.musicUrl",
                "https://www.youtube.com/watch?v=5vaaOqLHxrE",
              )
            : setting().get(
                "music.url",
                "https://www.youtube.com/watch?v=5vaaOqLHxrE",
              ),
      volume: setting().get("music.volume", 25),
      extractor: setting().get("music.extractor", ""),
    }),
    (message) => vscode.window.showWarningMessage("PetsADHD: " + message),
  );
  function audio(state, paused) {
    const mode = ["pets", "menu"].includes(state.mode)
      ? "pets"
      : ["tetris", "duel"].includes(state.mode)
        ? "tetris"
        : "invaders";
    const enabled =
      vscode.workspace.isTrusted &&
      state.musicOn &&
      ["pets", "menu", "tetris", "duel", "invaders"].includes(state.mode);
    const signature = JSON.stringify([mode, enabled, paused]);
    if (signature === lastAudio) return;
    lastAudio = signature;
    if (mode !== musicMode || !enabled) music.stop();
    musicMode = mode;
    if (!enabled) return;
    music.pause(paused);
    if (!paused) music.start();
  }
  async function position(
    value = setting().get("panel.position", "bottom-right"),
  ) {
    const command = {
      bottom: "workbench.action.positionPanelBottom",
      "bottom-right": "workbench.action.positionPanelBottom",
      left: "workbench.action.positionPanelLeft",
      right: "workbench.action.positionPanelRight",
    }[value];
    if (command) await vscode.commands.executeCommand(command);
    if (value === "bottom-right" || value === "bottom")
      await vscode.commands.executeCommand(
        value === "bottom-right"
          ? "workbench.action.alignPanelRight"
          : "workbench.action.alignPanelCenter",
      );
  }
  async function open(mode) {
    await position();
    if (shuttingDown) return;
    if (!terminal) {
      const session = new ArcadeTerminal(vscode, {
        saved: context.workspaceState.get("arcade"),
        pet: context.globalState.get("pet", "trex"),
        speed: setting().get("tetris.speed", 1),
        pixelSize: setting().get("pets.pixelSize", 1),
        fit: () => {
          void resize().catch((error) =>
            vscode.window.showWarningMessage("PetsADHD: " + error.message),
          );
        },
        music: setting().get("music.enabled", true),
        save: (state) => {
          void context.workspaceState.update("arcade", state);
          void context.globalState.update("pet", state.pet);
        },
        audio,
        hide: () => terminal?.hide(),
        help: (message) => vscode.window.showInformationMessage(message),
        closed: () => {
          if (pty === session) {
            terminal = undefined;
            pty = undefined;
          }
          music.stop();
          lastAudio = "";
        },
      });
      pty = session;
      terminal = vscode.window.createTerminal({
        name: "PetsADHD",
        pty,
        location: vscode.TerminalLocation.Panel,
        isTransient: true,
        iconPath: new vscode.ThemeIcon("game"),
      });
    }
    pty.select(mode, false);
    terminal.show(false);
    await resize();
  }
  async function resize() {
    if (!pty || !terminal) return;
    const compact = ["pets", "menu"].includes(pty.state.mode);
    await fitPanel(vscode, terminal, pty, {
      autoSize: setting().get("panel.autoSize", true),
      position: setting().get("panel.position", "bottom-right"),
      columns: compact ? 28 : setting().get("panel.columns", 72),
      rows: compact ? pets.rows(pty.state) : setting().get("panel.rows", 28),
      shrink: compact,
    });
  }
  for (const mode of ["open", "pets", "tetris", "duel", "invaders"])
    context.subscriptions.push(
      vscode.commands.registerCommand("petsadhd." + mode, () =>
        open(mode === "open" ? undefined : mode),
      ),
    );
  context.subscriptions.push(
    vscode.commands.registerCommand("petsadhd.play", () => {
      const state = pty?.state || context.workspaceState.get("arcade");
      const mode = ["tetris", "duel", "invaders"].includes(state?.mode)
        ? state.mode
        : ["tetris", "duel", "invaders"].includes(state?.lastGame)
          ? state.lastGame
          : "tetris";
      return open(mode);
    }),
    vscode.commands.registerCommand("petsadhd.position", async () => {
      const chosen = await vscode.window.showQuickPick(
        ["Bottom Right", "Bottom", "Left", "Right"],
        {
          title: "PetsADHD: Move Game Panel",
          placeHolder:
            "Moves VS Code's entire panel, including other terminals",
        },
      );
      if (!chosen) return;
      await setting().update(
        "panel.position",
        chosen.toLowerCase().replace(" ", "-"),
        vscode.ConfigurationTarget.Global,
      );
      await open();
    }),
    vscode.window.onDidChangeActiveTerminal((active) =>
      pty?.setFocused(active === terminal),
    ),
    vscode.window.onDidChangeActiveTextEditor(() => pty?.setFocused(false)),
    vscode.window.onDidChangeWindowState((state) =>
      pty?.setFocused(
        state.focused && vscode.window.activeTerminal === terminal,
      ),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("petsadhd")) {
        music.stop();
        lastAudio = "";
        if (pty) {
          if (event.affectsConfiguration("petsadhd.pets.pixelSize"))
            pty.state.pixelSize = setting().get("pets.pixelSize", 1);
          if (event.affectsConfiguration("petsadhd.music.enabled"))
            pty.state.musicOn = setting().get("music.enabled", true);
          pty.redraw();
        }
      }
    }),
    {
      dispose() {
        shuttingDown = true;
        const current = terminal;
        pty?.dispose();
        current?.dispose();
        music.stop();
      },
    },
  );
}
module.exports = { activate };
