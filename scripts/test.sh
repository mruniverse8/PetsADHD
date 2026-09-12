#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
for test in tests/arcade.lua tests/invaders.lua tests/invaders_audio.lua tests/setup.lua tests/modes.lua tests/terminal.lua; do
  nvim --headless -u NONE -i NONE -l "$test"
done
if [ -n "${PETSADHD_SNACKS_PATH:-}" ]; then
  nvim --headless -u NONE -i NONE -l tests/snacks.lua
fi
if [ -n "${PETSADHD_SNACKS_PATH:-}" ] && [ -n "${PETSADHD_LAZY_PATH:-}" ]; then
  nvim --headless -u NONE -i NONE -l tests/lazy.lua
fi
