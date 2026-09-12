# PetsADHD for VS Code

Pixel companions in your Explorer sidebar and an arcade in your editor:
Astra Tetris, local two-player competitive Tetris, and ASCII Space Invaders.

![Competitive Tetris](media/preview.png)

## Install

1. Download **PetsADHD-0.2.1.vsix** from the repository's `dist` folder.
2. In VS Code, run **Extensions: Install from VSIX** from the Command Palette.
3. Select the file. Run **PetsADHD: Open / Resume Arcade**.

VS Code 1.85 or newer is required. This is a VSIX installation; the extension
has not been published to the VS Code Marketplace.

Your Explorer also gets a **PetsADHD** view with Rex, Biscuit, Quackers, and pixel
67. Choose sun, rain, or automatic weather. Game buttons open the arcade panel.

## Controls

- **Tetris:** arrows or hjkl to move/rotate, z to reverse rotate, Space to hard
  drop. Use **+ / -** or the speed selector for 1×–8× gravity.
- **Invaders:** arrows or h/l move; **a fires**.
- **Competitive Tetris:** two players share one keyboard. Player 1 uses
  **A/D/S/W**, **G** to reverse rotate and **F** to hard drop. Player 2 uses
  **arrows**, **/** to reverse rotate and **Enter** to hard drop. Use lowercase
  letters for Player 1 (Shift is not required).
- **All games:** **p** pauses, **r** restarts, **m** minimizes, **M** toggles music.
  Equivalent buttons are available above the game.

The competitive boards receive identical pieces. Clearing 2 / 3 / 4 rows sends
1 / 2 / 4 garbage rows to the opponent; incoming rows apply on the next piece
lock and can be canceled by your own line clears. The first top-out loses.

Minimizing saves the game in VS Code's workspace storage and closes its panel.
Run the same game command or **Open / Resume Arcade** to continue. Switching
editor tabs pauses the game; press **p** to resume. Restarting a game is explicit.
The canvas scales with the panel and leaves the board state intact.

## Optional music

Tetris and competitive Tetris default to [Daft Punk — “Crescendolls”](https://www.youtube.com/watch?v=oor2uIqys8M).
Use `petsadhd.tetris.musicUrl` to change it. Space Invaders keeps its
[original soundtrack](https://www.youtube.com/watch?v=z0FRc-51_V4), configured with `petsadhd.music.url`. Audio requires `ffplay`
(from FFmpeg), `yt-dlp[default]`, a supported JS runtime, network access, and a
working audio device. Node.js is explicitly enabled; Deno is also supported by
yt-dlp. No tools install automatically and no music files are included.

The Neovim private environment at `~/.local/share/nvim/invaders-audio/bin/yt-dlp`
is reused if present; otherwise `yt-dlp` is found on PATH. Set
`petsadhd.music.extractor` to override it. Settings also expose soundtrack URL,
volume, default music enablement, and initial Tetris speed.

Playback pauses when the panel loses focus and stops when closed. Minimizing
preserves the game but restarts the soundtrack when reopened. Audio was tested
on Linux; Windows falls back to restarting playback when resuming. Audio is
available only in trusted workspaces and plays on the extension host machine
(for remote VS Code, that is the remote machine).

## Development

```sh
npm ci
npm test
npm run package
```

Open this `vscode` directory and press F5 to launch an Extension Development Host.
The browser test uses an installed Chromium:

```sh
PETSADHD_CHROMIUM=/path/to/chromium node test/browser.cjs
```

The extension uses VS Code webviews with restricted content security policies
and local media resources. Game state is stored locally; there is no telemetry.
The game engine, extension lifecycle, and audio process lifecycle have Node tests;
the browser test exercises actual canvas rendering, keyboard controls and resume.

MIT license covers the code; the external soundtrack is not included in it.
