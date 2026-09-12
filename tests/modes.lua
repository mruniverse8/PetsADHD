vim.opt.runtimepath:prepend(vim.fn.getcwd())
vim.o.columns, vim.o.lines = 110, 42
local tetris, duel = require("petsadhd.tetris"), require("petsadhd.duel")
local normal, fast = tetris.new({ seed = 42 }), tetris.new({ seed = 42, speed = 8 })
tetris.step(normal)
tetris.step(fast)
assert(normal.piece.y == 1 and fast.piece.y == 2, "higher speed advances gravity sooner")
for _ = 1, 20 do
  tetris.input(fast, "faster")
end
assert(fast.speed == 8)
for _ = 1, 20 do
  tetris.input(fast, "slower")
end
assert(fast.speed == 1)
local match = duel.new({ seed = 42 })
for _ = 1, 14 do
  assert(match.players[1].piece.kind == match.players[2].piece.kind, "both players get identical bags")
  duel.input(match, { 1, "drop" })
  duel.input(match, { 2, "drop" })
  for _, p in ipairs(match.players) do
    for y = 1, 20 do
      p.board[y] = {}
    end
  end
end
match = duel.new({ seed = 42 })
local p = match.players[1]
for y = 17, 20 do
  for x = 1, 10 do
    if x ~= 5 then
      p.board[y][x] = "J"
    end
  end
end
p.piece = { kind = "I", shape = { "I", "I", "I", "I" }, x = 5, y = 17 }
duel.input(match, { 1, "drop" })
assert(match.players[2].pending == 4, "four-line attack is queued for opponent")
duel.input(match, { 2, "drop" })
for y = 17, 20 do
  assert(vim.tbl_count(match.players[2].board[y]) == 9, "garbage contains one escape hole")
end
assert(match.players[2].pending == 0)
local frozen = vim.deepcopy(match)
duel.input(match, "pause")
duel.step(match)
duel.input(match, { 1, "h" })
duel.input(match, "pause")
assert(vim.deep_equal(match, frozen), "duel pauses both players")
match.players[1].over = true
duel.step(match)
assert(match.over and match.winner == 2, "top-out awards match to opponent")
local lines, spans = duel.render(match)
assert(#lines == 26)
for _, line in ipairs(lines) do
  assert(#line <= 80)
end
for _, span in ipairs(spans) do
  assert(span[2] + 2 <= #lines[span[1] + 1])
end
assert(tetris.music_options(false).enabled == false, "music can remain disabled")
assert(
  tetris.music_options({ url = "https://example.com/custom" }).url == "https://example.com/custom",
  "explicit soundtrack overrides the default"
)
local audio = {}
package.loaded["petsadhd.audio"] = {
  new = function(opts)
    local a = { options = opts }
    function a:start()
      self.started = true
    end
    function a:pause(value)
      self.paused = value
    end
    function a:stop()
      self.stopped = true
    end
    function a:toggle()
      self.toggled = true
    end
    audio[#audio + 1] = a
    return a
  end,
}
require("petsadhd").setup({ music = true, pets = { enabled = false, state_file = vim.fn.tempname() }, snacks = false })
local function maps(b)
  local ret = {}
  for _, map in ipairs(vim.api.nvim_buf_get_keymap(b, "n")) do
    ret[map.lhs] = map.callback
  end
  return ret
end
for _, command in ipairs({ "Tetris", "TetrisDuel", "SpaceInvaders" }) do
  vim.cmd(command)
  if command ~= "SpaceInvaders" then
    assert(
      audio[#audio].options.url == "https://www.youtube.com/watch?v=5vaaOqLHxrE",
      "both Tetris modes use the requested default soundtrack"
    )
  else
    assert(audio[#audio].options.url == nil, "Invaders uses the shared audio default")
  end
  local b, w = vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
  local key = maps(b)
  local before = vim.api.nvim_buf_get_lines(b, 1, -1, false)
  key.m()
  assert(vim.api.nvim_buf_is_valid(b) and not vim.api.nvim_win_is_valid(w), "minimize retains buffer and hides window")
  assert(audio[#audio].paused and not audio[#audio].stopped, "minimize pauses audio without discarding it")
  vim.wait(200, function()
    return false
  end)
  vim.cmd(command)
  assert(vim.api.nvim_get_current_buf() == b, "reopen restores same game")
  assert(vim.deep_equal(before, vim.api.nvim_buf_get_lines(b, 1, -1, false)), "minimized game does not advance")
  key.M()
  assert(audio[#audio].toggled, "uppercase M toggles soundtrack")
  key.q()
  assert(audio[#audio].stopped and not vim.api.nvim_buf_is_valid(b), "quit still ends the game")
end
print("PASS: speed, competitive attacks, equal bags, winners, minimize/resume, and music lifecycle")
vim.cmd("qa!")
