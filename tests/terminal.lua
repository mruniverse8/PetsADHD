vim.opt.runtimepath:prepend(vim.fn.getcwd())
if vim.fn.executable("node") == 0 then
  print("SKIP: native terminal integration needs Node.js 18+")
  vim.cmd("qa!")
end
vim.o.columns, vim.o.lines = 110, 42
vim.o.laststatus = 2
local terminal = require("petsadhd.terminal")
local state_file = vim.fn.tempname() .. "/session with spaces.json"
local sounds = {}
package.loaded["petsadhd.audio"] = {
  new = function(opts)
    local sound = { opts = opts }
    function sound:start()
      self.started = true
    end
    function sound:pause(value)
      self.paused = value
    end
    function sound:stop()
      self.stopped = true
    end
    sounds[#sounds + 1] = sound
    return sound
  end,
}
terminal.setup({ state_file = state_file, music = true })
local function eventually(callback, message)
  local ok = vim.wait(4000, callback, 20)
  if not ok then
    print(vim.inspect({ saved = vim.fn.readfile(state_file), windows = vim.fn.getwininfo() }))
  end
  assert(ok, message)
end
local function state()
  local ok, value = pcall(function()
    return vim.json.decode(table.concat(vim.fn.readfile(state_file), "\n"))
  end)
  return ok and value or {}
end
local editor = vim.api.nvim_get_current_win()
local editor_buf = vim.api.nvim_get_current_buf()
vim.api.nvim_buf_set_lines(editor_buf, 0, -1, false, { "Keep my work" })
vim.cmd("PetTerminal")
local buf, win = vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
local job = vim.b[buf].terminal_job_id
assert(vim.bo[buf].buftype == "terminal" and job > 0, "a real PTY job, not a float or scratch buffer")
assert(vim.api.nvim_win_get_config(win).relative == "", "native split")
eventually(function()
  return state().petFrame and state().petFrame > 0
end, "renderer starts animating")
assert(vim.api.nvim_win_get_height(win) == 8, "eight terminal rows")
assert(vim.api.nvim_win_get_position(win)[1] > vim.api.nvim_win_get_position(editor)[1], "bottom split")
assert(state().pixelSize == 1 and state().weather == "sunset", "small pixels and sunset by default")
eventually(function()
  return #sounds > 0 and sounds[#sounds].started
end, "pet music starts by default")
assert(sounds[#sounds].opts.url == "https://www.youtube.com/watch?v=5vaaOqLHxrE", "requested default pet soundtrack")
assert(
  table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false)):find("▀", 1, true),
  "actual terminal displays colored half-block pixels"
)
local function input(keys)
  vim.api.nvim_chan_send(job, keys)
end
input("nne")
eventually(function()
  return state().pet == "cow" and state().spaceEvent ~= vim.NIL
end, "cow and a summoned space event")
input("a")
eventually(function()
  return (state().petFire or 0) > 0
end, "pet breathes fire")
input("m")
eventually(function()
  return not vim.api.nvim_win_is_valid(win)
end, "m request closes the terminal split")
local frozen = state()
vim.wait(350, function()
  return false
end)
assert(vim.deep_equal(state(), frozen), "hidden pets, fire, and event timing are frozen")
assert(vim.api.nvim_buf_is_valid(buf) and vim.fn.jobwait({ job }, 0)[1] == -1, "hidden PTY stays alive")
assert(vim.api.nvim_buf_get_lines(editor_buf, 0, -1, false)[1] == "Keep my work", "editor content preserved")
vim.cmd("PetTerminal")
win = vim.api.nvim_get_current_win()
assert(
  vim.api.nvim_get_current_buf() == buf and vim.b[buf].terminal_job_id == job,
  "resume reuses the same terminal and job"
)
eventually(function()
  return (state().petFrame or 0) > frozen.petFrame
end, "pet resumes")
local moving = state().petFrame
vim.api.nvim_set_current_win(editor)
eventually(function()
  return (state().petFrame or 0) > moving
end, "pets animate while editing")
vim.api.nvim_set_current_win(win)
input("2")
eventually(function()
  return state().mode == "tetris" and vim.api.nvim_win_get_height(win) == 18
end, "games expand the pane")
eventually(function()
  return #sounds > 0 and sounds[#sounds].started
end, "Tetris soundtrack starts")
assert(sounds[#sounds].opts.url == "https://www.youtube.com/watch?v=5vaaOqLHxrE", "requested Tetris soundtrack")
vim.api.nvim_set_current_win(editor)
eventually(function()
  return sounds[#sounds].paused
end, "game audio pauses off focus")
vim.wait(150, function()
  return false
end)
local board = state().games.tetris
vim.wait(350, function()
  return false
end)
assert(vim.deep_equal(board, state().games.tetris), "game freezes while editing")
vim.api.nvim_set_current_win(win)
input("pm")
eventually(function()
  return not vim.api.nvim_win_is_valid(win)
end, "game minimizes")
board = state().games.tetris
vim.cmd("PetTerminal")
win = vim.api.nvim_get_current_win()
eventually(function()
  return vim.api.nvim_win_get_height(win) == 18
end, "game size restored")
assert(vim.deep_equal(board, state().games.tetris), "paused board survives reopen")
input("3p")
eventually(function()
  return state().games.duel and state().games.duel.paused
end, "two-player mode works in terminal")
input("1s")
eventually(function()
  return state().mode == "pets" and state().pixelSize == 2 and vim.api.nvim_win_get_height(win) == 8
end, "pets restore compact size")
assert(state().games.tetris and state().games.duel, "mode switches keep both boards")
-- Closing the split with ordinary editor commands also suspends the session.
vim.api.nvim_win_close(win, true)
vim.wait(150, function()
  return false
end)
frozen = state()
vim.wait(350, function()
  return false
end)
assert(vim.deep_equal(state(), frozen), ":close also suspends the hidden session")
vim.cmd("PetTerminal")
win = vim.api.nvim_get_current_win()
vim.o.lines = 28
vim.cmd("doautocmd VimResized")
assert(vim.api.nvim_win_get_height(win) == 8, "terminal remains small on editor resize")
terminal.close()
eventually(function()
  return not vim.api.nvim_buf_is_valid(buf)
end, "explicit close cleans up its terminal buffer")
assert(vim.fn.jobwait({ job }, 0)[1] ~= -1, "explicit close stops the owned child")
vim.cmd("PetTerminal")
local restored_buf = vim.api.nvim_get_current_buf()
eventually(function()
  return vim.b[restored_buf].terminal_job_id ~= job and state().pet == "cow"
end, "new process restores saved session")
assert(
  state().games.tetris and state().games.duel and state().pixelSize == 2,
  "disk state preserves games and pixel preference"
)
-- An unexpectedly terminated child must not leave a dead pane or lose editor work.
vim.fn.jobstop(vim.b[restored_buf].terminal_job_id)
eventually(function()
  return not vim.api.nvim_buf_is_valid(restored_buf)
end, "terminated child and pane cleaned up")
assert(vim.api.nvim_buf_is_valid(editor_buf), "terminating a pet child preserves the editor")
vim.fn.delete(vim.fn.fnamemodify(state_file, ":h"), "rf")
print(
  "PASS: real bottom PTY, pixel pets, space events, fire, minimize/resume, focus, music, games, resize, save/restore, cleanup"
)
vim.cmd("qa!")
