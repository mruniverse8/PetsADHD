# Changelog

## Unreleased

- Add optional two-row monochrome Braille pets, four-row small sidebar habitats, and commands to switch pixel styles while retaining saved sessions.
- Add experimental full-color bitmap pets using Snacks' graphics transport in compatible Neovim terminal hosts, with solid-cell fallback in Apple Terminal and scoped image cleanup.
- Avoid Apple Terminal block-glyph gaps with solid-cell pet rendering and hand-drawn four-row tiny animals (five rows for readable 67 digits); small sidebar pets and weather fit seven rows.

- Follow light and dark editor themes in Neovim plugin surfaces and terminal UI; VS Code follows the active theme kind.
- Adjust text, borders, sidebar weather and game colors for contrast while preserving the terminal's sunset and pet artwork.
- Refresh open and minimized terminal sessions on theme changes without restarting games or changing global ANSI palettes.
- Add light, dark, low-contrast, transparent, ANSI-rendering and live theme-change regression tests.

## 0.3.12

- Default to four-row pets with crisp fine pixels and a collapsed menu on the right; Tab expands or collapses it beside the scene.
- Make `s` always select small and `S` restore the original taller artwork, preserving the palette and sprite details.
- Adapt the detailed sunset to the shorter scene, retaining fire, space events, music and saved game progress.
- Fit both editor terminals to the selected pet height and migrate old appearances to small pixels.

## 0.3.11

- Replace the default soundtrack for pets and every game in both editors with the newly requested track.
- Keep soundtrack customization instructions in the README without identifying the default song.

## 0.3.10

- Use the same default music for pets, Tetris, competitive Tetris and Invaders in VS Code and Neovim.
- Keep custom soundtrack settings and music controls available in both editors.

## 0.3.9

- Add `:PetTerminal` / `:PetsADHDTerminal` and `<leader>uP` to open or resume an eight-row bottom terminal.
- Share the latest five-line pixel pets, dog/cow, detailed sunset, fire and random space effects with VS Code; small pixels remain the default.
- Expand for Tetris, shared-keyboard duels and Invaders; shrink when returning to pets.
- Preserve games and animation on `m` or split close, restore sessions from disk, and pause games/music while editing.
- Reuse Neovim's optional audio backend and the requested Tetris soundtrack. Node.js 18+ is required only for the new terminal.
- Add default music to pets in both editors, `M` to toggle it and configurable pet music; document how to change the music.

## 0.3.8

- Default to small 1× pet pixels and adopt the new default for older saved appearances.
- Replace the night sky with a detailed sunset: drifting clouds, sun glow, mountains and animated reflections.
- Add occasional black holes, supernova explosions, comets, auroras and Saturn; `e` summons an event immediately.
- Preserve event timing while minimized and show active event details in the one-line menu.

## 0.3.7

- Add blocky dog and cow sprites with original collar, coat and muzzle details.
- Add `s` to toggle chunky 2× and finer 1× pet pixels while keeping five-line height.
- Replace weather cycling with permanent night: twinkling stars, Saturn, a spiral galaxy and shooting stars.
- Update the one-line menu, previews, help and saved-state migration for the new pets and sky.

## 0.3.6

- Add animated pet fire on `a`, visible rain with drops and splashes, and sunset scenery.
- Improve sprite shading, animate feet, and walk across the available terminal width without resizing pets.
- Show weather and fire details in the one-line menu, with compact labels on narrow terminals.
- Preserve pet animation and fire when hiding and reopening the panel.

## 0.3.5

- Replace ASCII pets with hand-drawn pixel sprites at most five terminal lines tall.
- Condense pet navigation and the arcade chooser to one menu line.
- Add direct 1–4 navigation from any mode while preserving games.
- Remove pet style/size overrides so older preferences cannot restore oversized or ASCII pets.

## 0.3.4

- Make VS Code pets permanently tiny: one-line ASCII companions by default, with optional three-line pixel sprites.
- Replace the large sky/lawn with a thin baseline and target an eight-row pets panel.
- Keep pets fixed in size after resizing; preserve bottom-right docking, shortcuts, and game resume.

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
