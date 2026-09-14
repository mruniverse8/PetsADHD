#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
for test in tests/arcade.lua tests/invaders.lua tests/invaders_audio.lua tests/setup.lua tests/modes.lua tests/theme.lua tests/terminal.lua tests/terminal_cells.lua tests/terminal_styles.lua; do
  TERM_PROGRAM=petsadhd-tests nvim --headless -u NONE -i NONE -l "$test"
done
if [ -n "${PETSADHD_SNACKS_PATH:-}" ]; then
  TERM_PROGRAM=petsadhd-tests nvim --headless -u NONE -i NONE -l tests/snacks.lua
fi
if [ -n "${PETSADHD_SNACKS_PATH:-}" ] && [ -n "${PETSADHD_LAZY_PATH:-}" ]; then
  TERM_PROGRAM=petsadhd-tests nvim --headless -u NONE -i NONE -l tests/lazy.lua
fi
