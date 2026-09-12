-- Run from the config directory: nvim --headless -u NONE -l tests/invaders.lua
vim.opt.runtimepath:prepend(vim.fn.getcwd())
vim.o.columns, vim.o.lines = 100, 40
local game = require("petsadhd.invaders")
local s = game.new(66, 24)
assert(#s.enemies == 21 and s.wave == 1 and s.lives == 3)
for _ = 1, 100 do
  game.input(s, "h")
end
assert(s.x == 4, "ship stops at left edge")
for _ = 1, 100 do
  game.input(s, "l")
end
assert(s.x == 63, "ship stops at right edge")
game.input(s, "fire")
game.input(s, "fire")
assert(#s.shots == 1, "laser cooldown limits firing")
s.shots = { { x = s.enemies[1].x, y = s.enemies[1].y } }
game.step(s)
assert(#s.enemies == 20 and s.score == 30 and #s.shots == 0, "laser kills alien and scores")
s.enemies = { { x = 2, y = 2, row = 1 } }
s.shots = { { x = 2, y = 3 } }
game.step(s)
assert(s.wave == 2 and #s.enemies == 21, "clearing aliens starts next wave")
s.tick, s.shield = 1, 0
s.bombs = { { x = s.x, y = s.height - 2 }, { x = s.x, y = s.height - 2 } }
game.step(s)
assert(s.lives == 2 and s.shield > 0 and #s.bombs == 0, "hit shield prevents double damage")
s.tick, s.shield, s.lives = 1, 0, 1
s.bombs = { { x = s.x, y = s.height - 2 } }
game.step(s)
assert(s.over and s.lives == 0, "last hit ends the game")
local ended = vim.deepcopy(s)
game.step(s)
game.input(s, "fire")
assert(vim.deep_equal(s, ended), "game over freezes play")
s = game.new(66, 24)
s.tick = 7
s.direction = -1
s.enemies = { { x = 4, y = 4, row = 1 } }
-- With one alien, formation speed is four ticks at wave one.
game.step(s)
assert(s.enemies[1].y == 5 and s.direction == 1, "formation descends and reverses at wall")
s.enemies[1].x, s.enemies[1].y = 63, s.height - 4
s.tick = 11
game.step(s)
assert(s.over, "aliens reaching ship row end the game")
s = game.new(90, 28)
game.input(s, "p")
local paused = vim.deepcopy(s)
game.step(s)
game.input(s, "l")
assert(vim.deep_equal(s, paused), "pause freezes input and simulation")
for _, size in ipairs({ { 32, 10 }, { 90, 28 }, { 32, 28 }, { 90, 10 }, { 42, 28 }, { 56, 14 }, { 40, 14 }, { 66, 20 } }) do
  game.resize(s, size[1], size[2])
  local radius, rows = game.metrics(s)
  local occupied = {}
  for _, e in ipairs(s.enemies) do
    assert(e.x >= radius + 1 and e.x <= s.width - radius and e.y >= rows and e.y <= s.height - rows - 1)
    for y = e.y - rows + 1, e.y do
      for x = e.x - radius, e.x + radius do
        local cell = y .. ":" .. x
        assert(not occupied[cell], "resizing keeps alien sprites separate")
        occupied[cell] = true
      end
    end
  end
  assert(s.wave == 1 and s.lives == 3 and #s.enemies == 21, "resize preserves game")
  local lines, spans = game.render(s)
  assert(#lines == s.height + 4)
  for _, line in ipairs(lines) do
    assert(#line <= s.width + 2, "render fits window")
  end
  for _, span in ipairs(spans) do
    assert(span[2] + 1 <= #lines[span[1] + 1])
  end
end

-- Save a representative large ASCII frame for visual inspection.
local preview = game.new(90, 28)
preview.tick = 12
game.input(preview, "fire")
-- Rendering is covered above; tests do not create preview artifacts.
game.setup({ music = false })
local editor = vim.api.nvim_get_current_buf()
vim.cmd("SpaceInvaders")
local b, w = vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
assert(vim.bo[b].filetype == "spaceinvaders")
local maps = {}
for _, map in ipairs(vim.api.nvim_buf_get_keymap(b, "n")) do
  maps[map.lhs] = map.callback
end
maps.a()
assert(
  vim.wait(500, function()
    for _, line in ipairs(vim.api.nvim_buf_get_lines(b, 2, -2, false)) do
      if line:sub(2, -2):find("|", 1, true) then
        return true
      end
    end
  end),
  "live laser renders"
)
local original_width = vim.api.nvim_win_get_width(w)
vim.o.columns, vim.o.lines = 50, 24
vim.api.nvim_exec_autocmds("VimResized", {})
assert(vim.api.nvim_win_get_width(w) < original_width, "window shrinks live")
assert(vim.api.nvim_buf_line_count(b) == vim.api.nvim_win_get_height(w), "resized playfield fills window")
vim.o.columns, vim.o.lines = 30, 15
vim.api.nvim_exec_autocmds("VimResized", {})
assert(vim.api.nvim_buf_get_lines(b, 0, 1, false)[1]:find("Resize terminal"), "tiny terminal suspends game")
vim.o.columns, vim.o.lines = 110, 42
vim.api.nvim_exec_autocmds("VimResized", {})
assert(vim.api.nvim_win_get_width(w) > original_width, "window grows live")
assert(vim.api.nvim_buf_get_lines(b, 0, 1, false)[1]:find("PAUSED"), "restoring size keeps game paused")
maps.p()
vim.api.nvim_exec_autocmds("FocusLost", {})
assert(vim.api.nvim_buf_get_lines(b, 0, 1, false)[1]:find("PAUSED"), "focus loss pauses")
maps.r()
maps.q()
assert(
  not vim.api.nvim_buf_is_valid(b) and vim.api.nvim_get_current_buf() == editor,
  "close cleans up and returns to editor"
)
game.open()
b = vim.api.nvim_get_current_buf()
vim.api.nvim_buf_delete(b, { force = true })
vim.wait(120, function()
  return false
end)
game.open()
assert(vim.bo.filetype == "spaceinvaders", "reopens after external close")
game.close()
print("PASS: Invaders combat, waves, resizing, pause, and window lifecycle")
vim.cmd("qa!")
