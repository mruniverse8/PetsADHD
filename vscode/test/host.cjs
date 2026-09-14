const Module = require("node:module");
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
module.exports = function host(saved) {
  const commands = {},
    storage = new Map(saved ? [["arcade", saved]] : []),
    terminals = [],
    executed = [],
    tracks = [];
  const active = new EventEmitter(),
    editor = new EventEmitter(),
    focus = new EventEmitter(),
    configuration = new EventEmitter(),
    theme = new EventEmitter();
  const config = {
    "music.enabled": true,
    "music.url": "https://www.youtube.com/watch?v=5vaaOqLHxrE",
    "music.volume": 25,
    "tetris.speed": 1,
  };
  const state = (map) => ({
    get: (key, fallback) => map.get(key) ?? fallback,
    update: async (key, value) => {
      map.set(key, structuredClone(value));
    },
  });
  const api = {
    EventEmitter,
    ThemeIcon: class {
      constructor(id) {
        this.id = id;
      }
    },
    TerminalLocation: { Panel: 1 },
    ColorThemeKind: {
      Light: 1,
      Dark: 2,
      HighContrast: 3,
      HighContrastLight: 4,
    },
    ConfigurationTarget: { Global: 1 },
    commands: {
      registerCommand: (name, callback) => {
        commands[name] = callback;
        return { dispose() {} };
      },
      executeCommand: async (name) => {
        executed.push(name);
      },
    },
    workspace: {
      isTrusted: true,
      getConfiguration: () => ({
        get: (key, fallback) => config[key] ?? fallback,
        update: async (key, value) => {
          config[key] = value;
        },
      }),
      onDidChangeConfiguration: configuration.event,
    },
    window: {
      activeTerminal: undefined,
      activeColorTheme: { kind: 2 },
      showWarningMessage: () => {},
      showInformationMessage: () => {},
      showQuickPick: async () => "Right",
      onDidChangeActiveTerminal: active.event,
      onDidChangeActiveTextEditor: editor.event,
      onDidChangeActiveColorTheme: theme.event,
      onDidChangeWindowState: focus.event,
      createTerminal(options) {
        const t = {
          options,
          output: "",
          visible: false,
          show() {
            this.visible = true;
            api.window.activeTerminal = this;
            if (!this.opened) {
              this.opened = true;
              options.pty.open({ columns: 90, rows: 30 });
            }
            active.fire(this);
          },
          hide() {
            this.visible = false;
          },
          dispose() {
            this.disposed = true;
            this.visible = false;
            options.pty.close();
          },
        };
        options.pty.onDidWrite((data) => {
          t.output += data;
        });
        terminals.push(t);
        return t;
      },
    },
  };
  const context = {
    subscriptions: [],
    workspaceState: state(storage),
    globalState: state(new Map()),
  };
  class MockMusic {
    constructor(config) {
      this.config = config;
    }
    start() {
      tracks.push(this.config().url);
    }
    stop() {
      tracks.push("stop");
    }
    pause(value) {
      tracks.push(value ? "pause" : "resume");
    }
  }
  const load = Module._load;
  Module._load = function (name, ...args) {
    if (name === "./audio") return { Music: MockMusic };
    return name === "vscode" ? api : load.call(this, name, ...args);
  };
  delete require.cache[require.resolve("../extension")];
  try {
    require("../extension").activate(context);
  } finally {
    Module._load = load;
  }
  return {
    commands,
    terminals,
    storage,
    tracks,
    executed,
    config,
    api,
    active,
    editor,
    focus,
    theme,
    context,
    dispose: () => context.subscriptions.forEach((d) => d.dispose()),
  };
};
