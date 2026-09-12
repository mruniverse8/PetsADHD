-- Run: nvim --headless -u NONE -l tests/arcade.lua (from the config directory).
vim.opt.runtimepath:prepend(vim.fn.getcwd())
local astra = require("petsadhd.tetris")
vim.o.lines, vim.o.columns = 40, 90
local s = astra.new()
local start_y = s.piece.y
for _ = 1, 8 do
  astra.step(s)
end
assert(s.piece.y == start_y + 1, "gravity lowers the piece")
for _ = 1, 15 do
  astra.input(s, "h")
end
local left = s.piece.x
astra.input(s, "h")
assert(s.piece.x == left, "left wall blocks movement")
local shape = vim.deepcopy(s.piece.shape)
for _ = 1, 4 do
  astra.input(s, "k")
end
assert(vim.deep_equal(shape, s.piece.shape), "four rotations restore orientation")
astra.input(s, "p")
local frozen = vim.deepcopy(s)
for _, key in ipairs({ "h", "j", "k", "drop" }) do
  astra.input(s, key)
end
astra.step(s)
assert(vim.deep_equal(s, frozen), "pause freezes movement and gravity")
astra.input(s, "p")
astra.input(s, "drop")
local occupied = 0
for _, row in ipairs(s.board) do
  for _ in pairs(row) do
    occupied = occupied + 1
  end
end
assert(occupied == 4 and s.score > 0, "hard drop locks four blocks and awards points")

-- Complete four consecutive rows with a vertical I, including level progression.
s = astra.new()
s.lines = 6
for y = 17, 20 do
  for x = 1, 10 do
    if x ~= 5 then
      s.board[y][x] = "J"
    end
  end
end
s.piece = { kind = "I", shape = { "I", "I", "I", "I" }, x = 5, y = 17 }
astra.input(s, "drop")
assert(s.lines == 10 and s.level == 2 and s.score == 800, "four-line clear scores and levels up")
for _, row in ipairs(s.board) do
  assert(next(row) == nil, "cleared rows leave an empty board")
end

-- Stacked cells block a new spawn and stop further play.
s = astra.new()
s.board[1][4] = "J"
s.next = "O"
s.piece = { kind = "O", shape = { "OO", "OO" }, x = 4, y = 19 }
astra.input(s, "drop")
assert(s.over, "blocked spawn ends the game")
local ended = vim.deepcopy(s)
astra.input(s, "drop")
astra.step(s)
assert(vim.deep_equal(s, ended), "game over freezes the board")

s = astra.new()
local bag = {}
for _ = 1, 7 do
  bag[s.piece.kind] = true
  astra.input(s, "drop")
  for y = 1, s.height do
    s.board[y] = {}
  end
end
assert(vim.tbl_count(bag) == 7, "bag supplies each tetromino once")
local lines, spans = astra.render(s)
assert(#lines == 24)
for _, line in ipairs(lines) do
  assert(vim.fn.strdisplaywidth(line) <= 54, "content fits game window")
end
for _, span in ipairs(spans) do
  assert(span[2] + 2 <= #lines[span[1] + 1])
end

astra.setup({ music = false })
local original = vim.api.nvim_get_current_buf()
for _ = 1, 3 do
  vim.cmd("AstraGame")
  local b = vim.api.nvim_get_current_buf()
  assert(vim.bo[b].filetype == "astra")
  assert(vim.api.nvim_buf_get_lines(b, 0, 1, false)[1]:find("ASTRA TETRIS"))
  local mappings = {}
  for _, map in ipairs(vim.api.nvim_buf_get_keymap(b, "n")) do
    mappings[map.lhs] = map.callback
  end
  mappings.l()
  mappings[" "]()
  mappings.p()
  assert(vim.api.nvim_buf_get_lines(b, 0, 1, false)[1]:find("PAUSED"))
  mappings.r()
  mappings.q()
  assert(not vim.api.nvim_buf_is_valid(b), "close deletes scratch buffer")
  assert(vim.api.nvim_get_current_buf() == original, "close restores editor")
end
astra.open()
local b = vim.api.nvim_get_current_buf()
vim.api.nvim_buf_delete(b, { force = true })
vim.wait(150, function()
  return false
end)
astra.open()
assert(vim.bo.filetype == "astra", "can reopen after external buffer deletion")
astra.close()

local state_file = vim.fn.tempname()
local pet = require("petsadhd.pets")
pet.setup({ state_file = state_file })
vim.cmd("Pet67")
assert(pet.kind() == "sixseven" and pet.is_enabled())
for _, kind in ipairs({ "dog", "trex", "duck", "sixseven" }) do
  pet.select(kind)
  for _, size in ipairs({ "small", "big" }) do
    pet.size(size)
    for _, weather in ipairs({ "sun", "rain", "auto" }) do
      pet.weather(weather)
      for _, frame in ipairs({ 0, 3, 28, 120, 179 }) do
        local rendered, _, info = pet.render(40, frame)
        assert(#rendered == (size == "small" and 7 or 12))
        assert(info.animal == kind)
        for _, line in ipairs(rendered) do
          assert(vim.fn.strdisplaywidth(line) == 40)
        end
      end
    end
  end
end
vim.cmd("Pet67")
assert(vim.fn.readfile(state_file)[2] == "sixseven", "meme selection persists")
local preview = {}
for _, size in ipairs({ "small", "big" }) do
  pet.size(size)
  pet.weather("rain")
  local lines, spans = pet.render(40, 12)
  preview[size] = { lines = lines, spans = spans }
end
-- Preview frames remain in memory.
pet.set(false, false)
package.loaded["petsadhd.pets"] = nil
-- Commands are deliberately redefined by setup, as they would be on startup.
pet = require("petsadhd.pets")
pet.setup({ state_file = state_file })
assert(pet.kind() == "sixseven" and pet.is_enabled(), "saved selection restores")
pet.set(false, false)
vim.fn.delete(state_file)
print("PASS: Tetris rules, lifecycle, pet rendering, and persistence")
vim.cmd("qa!")
