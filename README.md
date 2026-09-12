# PetsADHD

Pixel pets and a tiny arcade for **Neovim / LazyVim and VS Code**. Includes animated
sidebar companions, Astra Tetris, shared-keyboard competitive Tetris, and Space
Invaders with optional music.

**VS Code:** [download the VSIX](dist/PetsADHD-0.3.3.vsix), then run **Extensions:
Install from VSIX**. Games run as pixel graphics in the integrated Terminal panel.
Use **PetsADHD: Move Game Panel** to choose Bottom Right, Bottom, Left, or Right.
Press **Ctrl+Alt+G** (**Cmd+Option+G** on macOS) to open or resume a game
in a **bottom panel aligned right**, automatically expanded for play.
First use starts Tetris. **Ctrl+Alt+P** (**Cmd+Option+P**) opens small pixel pets
in a compact habitat at the bottom right, with a shorter panel.
Press **m** to hide and preserve the session; use its shortcut to reopen.
See [VS Code instructions](vscode/README.md).

- **Pets:** a T-rex, dog, duck, and readable pixel “67”, with two sizes and sun/rain.
- **Tetris:** seven-piece bags, rotation, ghost landing guide, next-piece preview,
  line clears, scoring, and increasing speed.
- **Space Invaders:** animated ASCII ships and aliens, exhaust, explosions,
  scrolling stars, and a playfield that resizes without resetting your game.
- **Soundtrack:** optional YouTube audio that follows game pause and closes with it.

## Requirements

- Neovim **0.11+** (tested locally on 0.13-dev).
- LazyVim with Snacks explorer, or Neo-tree for sidebar pets. The games also work
  without an explorer. No other Lua plugin is required for the games.
- A terminal font with Unicode block characters for pets; Invaders uses ASCII.
- Optional music: `ffplay`, `yt-dlp[default]`, a supported JavaScript runtime
  such as Node.js or Deno, internet access, and working audio output.
  Audio pause/resume uses POSIX signals; Linux was tested.

## Install in LazyVim

After publishing, create `~/.config/nvim/lua/plugins/petsadhd.lua`:

```lua
return {
  {
    "mruniverse8/PetsADHD",
    name = "PetsADHD",
    main = "petsadhd",
    lazy = false,
    dependencies = { "folke/snacks.nvim" },
    opts = {},
  },
}
```

The plugin adds a reserved
footer to the left Snacks explorer, preserving an existing layout callback.
Neo-tree pets use empty rows below the file list.

For local development, replace the repository string with
`dir = vim.fn.expand("~/PetsADHD")`. A complete local spec is in
[examples/local.lua](examples/local.lua).

If migrating the earlier custom configuration, remove its three setup calls
(`config.pet`, `config.astra`, and `config.invaders`) from `config/autocmds.lua`
and its custom pet layout callback in the Snacks spec. PetsADHD now owns those
commands and the layout integration. Restart Neovim after switching.

## Play

`:PetsADHD` opens the game and pet chooser.

| Command | Action |
| --- | --- |
| `:Pet67` | Select and enable the pixel 67 companion |
| `:PetTRex`, `:PetDog`, `:PetDuck` | Select a companion |
| `:PetOn`, `:PetOff`, `:PetToggle` | Control the habitat |
| `:PetSmall`, `:PetBig` | Set pet size |
| `:PetWeather auto`, `sun`, or `rain` | Set habitat weather |
| `:Tetris`, `:AstraGame`, `:PetGame` | Open Astra Tetris |
| `:SpaceInvaders` | Open or resume Space Invaders |
| `:TetrisDuel`, `:Tetris2P` | Open or resume shared-keyboard competitive Tetris |

Default shortcuts: `<leader>uP` toggles pets, `<leader>uA` opens Tetris, and
`<leader>uI` opens Invaders. Game controls are local to their scratch buffers.

| Game | Controls |
| --- | --- |
| Tetris | `h/l` or Left/Right move; `j` or Down soft drops; `k/x` or Up rotates clockwise; `z` rotates counterclockwise; Space hard drops |
| Invaders | `h/l` or Left/Right move; **a fires**; **M toggles music** |
| All games | **m minimizes**, **M toggles music**, `p` pauses, `r` restarts, `q` or Escape quits |
| Competitive Tetris | P1: `a/d` move, `s` soft drop, `w/g` rotate, `f` hard drop. P2: arrows move/rotate/drop, `/` reverse rotate, Enter hard drop |
| Tetris speed | `+` / `=` faster, `-` slower, from 1× to 8× |

Leaving a game or switching applications pauses it. Press `p` to resume.
**m** hides the window and preserves the board, score, piece sequence, and music
position in the current Neovim process. Run the same game command to resume.
Opening a different game minimizes the previous one. **r** starts over; **q**
discards that game. Neovim shutdown clears games held in memory.

Tetris needs 58 columns and 29 rows; competitive mode needs 84 columns and 31
rows with a one-row command line. Invaders needs 40 columns and 19 rows. Smaller
terminals suspend the game until you enlarge the terminal and press `p`.

In competitive mode both players get identical seven-piece bags and the same
speed. Clearing 2 / 3 / 4 lines sends 1 / 2 / 4 garbage rows to the opponent.
Incoming garbage applies after the next piece locks; line clears can cancel it.
The first player to top out loses. `+` / `-` changes both players' speed equally.

## Options

```lua
opts = {
  keymaps = true,  -- false disables the three leader shortcuts
  snacks = true,   -- false for a Neo-tree-only or games-only setup
  pets = {
    -- Omit these to restore saved preferences (defaults: on, trex, big, auto).
    -- enabled = true,
    -- kind = "sixseven", -- trex, dog, duck, sixseven
    -- size = "big",      -- big, small
    -- weather = "auto",  -- auto, sun, rain
    -- state_file = vim.fn.stdpath("state") .. "/petsadhd/pets-state",
  },
  tetris = { speed = 1 }, -- initial speed, 1–8
  music = {
    enabled = true,
    -- url = "https://www.youtube.com/watch?v=...", -- optional override for all games
    volume = 25, -- 0–100
    -- extractor = "/path/to/yt-dlp",
    -- player = "/path/to/ffplay",
  },
}
```

Use `music = false` to start games muted. `M` can enable it for the current
session. Setting `vim.g.invaders_music = false` also starts it muted.
Pet preferences are stored outside the repository under Neovim's state directory.
To retain preferences from the original custom configuration, set `pets.state_file`
to `vim.fn.stdpath("state") .. "/quackers-state"`.

Tetris and competitive Tetris use [Daft Punk — “Crescendolls”](https://www.youtube.com/watch?v=oor2uIqys8M) by default.
Space Invaders uses [“06 - I Wanna Be The Guy OST - Tetris”](https://www.youtube.com/watch?v=z0FRc-51_V4).
Set `tetris.music = { url = "..." }` to customize only the Tetris soundtrack.
Only the linked video streams, rather than its radio playlist. Audio is not bundled
with this project. The MIT license covers the plugin code, not external music.
Playback runs asynchronously; missing dependencies or network failures leave the
game playable and show a notification. Nothing installs automatically.

### Optional audio setup

Install FFmpeg (including `ffplay`) with your system package manager. Install
[yt-dlp with its default dependencies](https://github.com/yt-dlp/yt-dlp/wiki/Installation)
and a supported JavaScript runtime. For example:

```sh
python3 -m venv ~/.local/share/nvim/invaders-audio
~/.local/share/nvim/invaders-audio/bin/pip install 'yt-dlp[default]'
```

PetsADHD checks that private environment, then `yt-dlp` on `PATH`. It enables
Node.js when available; yt-dlp can also use its default Deno runtime. Custom
Neovim app names may have a different data directory; set `music.extractor` then.

## Development

```sh
./scripts/test.sh
```

Tests cover both game simulations, controls, resizing, pet rendering/persistence,
plugin setup, and audio-process lifecycle. They need only Neovim and do not access
the network or play audio. Optional real Snacks integration:

```sh
PETSADHD_SNACKS_PATH="$HOME/.local/share/nvim/lazy/snacks.nvim" ./scripts/test.sh
```

Also set `PETSADHD_LAZY_PATH` to your lazy.nvim checkout to test the single-entry
plugin installation through lazy.nvim itself.

Modules live in `lua/petsadhd/`: `init.lua` exposes setup and the chooser,
`pets.lua` renders the habitat, `tetris.lua` and `invaders.lua` own the games, `duel.lua` adds competitive Tetris, `window.lua`
handles minimize/resume, and `audio.lua` owns soundtrack processes. VS Code has
a JavaScript port under `vscode/`, with its own tests and packaging script.

## Push your repository

Create an empty repository named **PetsADHD** on your Git host, then run:

```sh
git remote add origin git@github.com:mruniverse8/PetsADHD.git
git push -u origin main
```

## License

[MIT](LICENSE).
