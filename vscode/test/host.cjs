const Module = require("node:module"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url");
module.exports = function host() {
  const commands = {},
    storage = new Map(),
    global = new Map(),
    panels = [],
    providers = {},
    serializers = {};
  const state = (map) => ({
    get: (key, fallback) => (map.has(key) ? map.get(key) : fallback),
    update: async (key, value) => {
      map.set(key, value);
    },
  });
  const config = {
    "music.enabled": false,
    "music.url": "https://www.youtube.com/watch?v=z0FRc-51_V4",
    "music.volume": 25,
    "tetris.speed": 1,
  };
  const api = {
    workspace: {
      isTrusted: true,
      getConfiguration: () => ({
        get: (key, fallback) => config[key] ?? fallback,
      }),
    },
    Uri: { joinPath: (base, ...parts) => path.join(base, ...parts) },
    ViewColumn: { Active: 1 },
    commands: {
      registerCommand: (name, callback) => {
        commands[name] = callback;
        return { dispose() {} };
      },
    },
    window: {
      showWarningMessage: () => {},
      registerWebviewViewProvider: (name, value) => {
        providers[name] = value;
        return { dispose() {} };
      },
      registerWebviewPanelSerializer: (name, value) => {
        serializers[name] = value;
        return { dispose() {} };
      },
      createWebviewPanel: () => {
        const panel = {
          visible: true,
          webview: {
            cspSource: "file:",
            asWebviewUri: (p) => pathToFileURL(p).href,
            onDidReceiveMessage: (fn) => {
              panel.receive = fn;
            },
            postMessage: async (message) => {
              panel.message = message;
            },
          },
          onDidDispose: (fn) => (panel.disposeCallback = fn),
          onDidChangeViewState: (fn) => (panel.viewCallback = fn),
          reveal() {
            this.visible = true;
          },
          dispose() {
            this.visible = false;
            this.disposed = true;
            this.disposeCallback?.();
          },
        };
        panels.push(panel);
        return panel;
      },
    },
  };
  const ctx = {
    subscriptions: [],
    extensionUri: path.resolve(__dirname, ".."),
    workspaceState: state(storage),
    globalState: state(global),
  };
  const tracks = [];
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
    pause() {}
  }
  const load = Module._load;
  Module._load = function (name, ...args) {
    if (name === "./audio") return { Music: MockMusic };
    return name === "vscode" ? api : load.call(this, name, ...args);
  };
  delete require.cache[require.resolve("../extension")];
  try {
    require("../extension").activate(ctx);
  } finally {
    Module._load = load;
  }
  return {
    commands,
    panels,
    storage,
    providers,
    serializers,
    tracks,
    context: ctx,
  };
};
