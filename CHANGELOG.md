# Changelog

## 0.3.3

- Add small VS Code pets that stay at native pixel size in a compact bottom-right habitat.
- Default to a bottom panel with right alignment; add Bottom Right to the panel chooser.
- Fit small pets into a shorter panel and expand again when switching to a game.
- Add a pet size setting and tests for compact sprites, shrinking, and restoring game space.

## 0.3.2

- Default VS Code games and pets to a right-side terminal with automatic sizing (72 columns; 28 rows for bottom docking).
- Add Ctrl+Alt+G / Cmd+Option+G to start Tetris or resume the last game, including after switching to pets.
- Keep Ctrl+Alt+P / Cmd+Option+P for pets, and document shortcuts, automatic layout, and size settings.

## 0.3.1

- Add Ctrl+Alt+P (Cmd+Option+P on macOS) to open the VS Code pixel pets panel.

## 0.3.0

- Replace the VS Code webview arcade and Explorer view with a native pixel terminal panel.
- Add bottom/left/right docking, compact and large Tetris pixels, and stacked two-player boards for narrow panels.
- Preserve each game while minimizing, switching modes, resizing, and reopening; import existing saved games.
- Keep shared-keyboard competition, adjustable speed, `a` to fire, and the requested Tetris soundtrack.
- Test terminal lifecycle, keyboard input and ANSI output with xterm; remove the browser game frontend.

## 0.2.1

- Set the requested oor2uIqys8M soundtrack as the Tetris and competitive Tetris default.
- Add a separate VS Code Tetris soundtrack setting; switching games switches tracks.

## 0.2.0

- Add a VS Code extension, Explorer pets view, saved arcade panel and installable VSIX.
- Add shared-keyboard competitive Tetris with equal bags, garbage attacks and winner detection.
- Add 1×–8× Tetris speed controls and soundtrack support for both Tetris modes.
- Use `m` to minimize/resume games and `M` to toggle music.
- Preserve Neovim games when opening another game or resizing below playable dimensions.

## 0.1.0

- Package animated sidebar pets, pixel 67, Astra Tetris and ASCII Space Invaders for LazyVim.
- Add optional YouTube soundtrack playback and automatic Snacks explorer integration.
