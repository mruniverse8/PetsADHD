# PetsADHD for VS Code

Play pixel pets, Astra Tetris, shared-keyboard competitive Tetris, and Space
Invaders directly in VS Code's **integrated Terminal panel**. Dock it at the
bottom, left, or right and drag the panel edge to resize it.

![Competitive Tetris terminal renderer preview](media/preview.png)

## Install and open

1. Download **PetsADHD-0.3.0.vsix** from the repository's `dist` folder.
2. Run **Extensions: Install from VSIX** and select the file. Reload VS Code if prompted.
3. Run **PetsADHD: Open / Resume Arcade**. A terminal named **PetsADHD** opens in the bottom panel.
4. Press **1** for pets, **2** for Tetris, **3** for two-player Tetris, or **4** for Invaders.

You can also run **PetsADHD: Play Tetris**, **Play Competitive Tetris (2 Players)**,
**Play Space Invaders**, or **Show Pixel Pets** directly from the Command Palette.
VS Code 1.85 or newer is required. The extension is distributed as a VSIX and is
not published to the Marketplace.

## Panel position and size

Run **PetsADHD: Move Game Panel** and choose **Bottom**, **Left**, or **Right**.
The preference is saved as `petsadhd.panel.position`. This moves VS Code's entire
panel, including other terminals. Drag its edge to adjust the size.
You can also use VS Code's [panel layout controls](https://code.visualstudio.com/docs/configure/custom-layout#_panel).

Graphics use colored Unicode block characters in a native pseudoterminal.
There are no webviews, browser pages, editor tabs, or canvas game surfaces.
Use a terminal font with block-character support; the normal monospace default works.

Tetris automatically switches between compact half-block pixels and larger
blocks. Competitive boards sit side by side in a wide panel and stack vertically
in a narrow side panel. Resizing preserves the board. Below the minimum size,
the game and audio suspend until the panel is enlarged.

| Mode | Minimum terminal size (columns × rows) |
| --- | --- |
| Pets or solo Tetris | 28 × 16 |
| Competitive Tetris, side by side | 56 × 16 |
| Competitive Tetris, stacked | 28 × 28 |
| Space Invaders | 68 × 18 |

## Controls

Click inside the PetsADHD terminal before playing. Press **?** for control help.

| Mode | Keys |
| --- | --- |
| All games | **p** pause, **r** restart, **m** minimize, **M** toggle music, **Tab** menu, **q** discard current game |
| Tetris | Arrows or **h/j/k/l** move, soft drop, rotate; **z** reverse rotate; **Space** hard drop; **+ / -** speed 1×–8× |
| Competitive P1 | **a/d** move, **s** soft drop, **w/g** rotate, **f** hard drop |
| Competitive P2 | **arrows** move/rotate/soft drop, **/** reverse rotate, **Enter** hard drop |
| Invaders | **Left/Right** or **h/l** move; **a** fires |
| Pets | **n** cycles Rex, dog, duck, pixel 67; **w** cycles auto/sun/rain |

Two players share one keyboard, using lowercase letters for Player 1. Both get
identical pieces and speed. Clearing 2 / 3 / 4 rows sends 1 / 2 / 4 garbage rows
to the opponent. Incoming rows apply on the next piece lock and can be canceled
by your line clears. The first top-out loses. **+ / -** adjusts both speeds.

**m** hides the panel and freezes the game. Run the same game command or
**Open / Resume Arcade** to continue the same board. A manually paused game
stays paused until you press **p**. The menu also preserves each game's board.
Game state is saved in local workspace storage, including when the terminal is
closed; reopen it with a PetsADHD command. **q** explicitly discards only the
current game, and **r** restarts it.

Changing the active terminal, changing the active editor, or switching away from
the VS Code window suspends play. Reopening the arcade or pressing a game key
restores focus. Use **m** when hiding the panel: VS Code's public terminal API
does not report every panel-visibility or focus change.

## Optional music

Tetris and competitive Tetris default to [Daft Punk — “Crescendolls”](https://www.youtube.com/watch?v=oor2uIqys8M).
Use `petsadhd.tetris.musicUrl` to change it. Space Invaders keeps its
[original soundtrack](https://www.youtube.com/watch?v=z0FRc-51_V4), configured with
`petsadhd.music.url`. Audio requires `ffplay` (from FFmpeg), `yt-dlp[default]`, a
supported JS runtime, network access, and a working audio device. Node.js is
explicitly enabled; Deno is also supported by yt-dlp. No tools install
automatically and no music files are bundled.

The Neovim private environment at `~/.local/share/nvim/invaders-audio/bin/yt-dlp`
is reused if present; otherwise `yt-dlp` is found on PATH. Set
`petsadhd.music.extractor` to override it. Settings also expose volume, default
music enablement, and initial Tetris speed.

Minimizing pauses the soundtrack and resumes it when reopened on Linux/macOS.
Windows restarts playback when resuming. Closing the terminal stops audio.
Audio runs only in trusted workspaces, on the extension host machine (the remote
machine when using remote VS Code). Missing audio dependencies leave games playable.

## Development

```sh
npm ci
npm test
npm run package
```

Open this `vscode` directory and press F5 to launch an Extension Development Host.
The Node tests cover the game engine, audio lifecycle, mocked VS Code terminal
API, save/resume, docking commands, resizing, and ANSI output parsed by xterm.
An optional visual test renders that same ANSI stream using xterm in Chromium:

```sh
PETSADHD_CHROMIUM=/path/to/chromium node test/browser.cjs
```

The browser is only a test harness and is excluded from the extension package.
The preview above shows that terminal renderer. Game state is stored locally;
there is no telemetry. MIT covers the code; external music is not included in it.
