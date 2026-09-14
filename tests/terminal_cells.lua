vim.opt.runtimepath:prepend(vim.fn.getcwd())
vim.env.TERM_PROGRAM = "Apple_Terminal"
vim.o.columns, vim.o.lines = 110, 42
local pixels = require("petsadhd.pixels")
assert(pixels.cells() and pixels.cells("cells") and not pixels.cells("half"))
vim.env.TERM_PROGRAM = "kitty"
assert(not pixels.cells())
vim.env.TERM_PROGRAM = "Apple_Terminal"
local state_file = vim.fn.tempname()
require("petsadhd").setup({
  music = false,
  snacks = false,
  pets = { enabled = false, kind = "dog", size = "small", state_file = vim.fn.tempname() },
  terminal = { music = false, state_file = state_file },
})
local lines, spans = require("petsadhd.pets").render(36, 0)
assert(#lines == 12 and #spans > 0, "solid-cell sidebar fits a small sprite and weather")
for _, line in ipairs(lines) do
  assert(line == string.rep(" ", 36), "pixels use backgrounds, independent of glyph metrics")
end
for _, span in ipairs(spans) do
  assert(span[3] - span[2] == 2 and span[3] <= 36)
  assert(vim.api.nvim_get_hl(0, { name = span[4] }).bg, "each pixel has a solid color")
end
if vim.fn.executable("node") == 0 then
  print("PASS: Apple Terminal detection and solid-cell sidebar; SKIP native PTY without Node")
  vim.cmd("qa!")
end
local function eventually(fn, message)
  assert(vim.wait(4000, fn, 20), message)
end
local function saved()
  local ok, value = pcall(function()
    return vim.json.decode(table.concat(vim.fn.readfile(state_file), "\n"))
  end)
  return ok and value or {}
end
vim.cmd("PetTerminal")
local win, buf = vim.api.nvim_get_current_win(), vim.api.nvim_get_current_buf()
local job = vim.b[buf].terminal_job_id
eventually(function()
  return vim.api.nvim_win_get_height(win) == 8 and saved().petCells
end, "Apple Terminal automatically fits eight solid-pixel rows")
assert(not table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false)):find("▀", 1, true))
vim.api.nvim_chan_send(job, "S")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 10
end, "original art needs ten rows")
vim.api.nvim_chan_send(job, "s")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 8
end, "small art restores eight rows")
vim.api.nvim_chan_send(job, "2")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 18
end, "games retain their layout")
vim.api.nvim_chan_send(job, "1")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 8
end, "returning to pets restores solid rows")
assert(vim.b[buf].terminal_job_id == job, "resizing retains the same process")
require("petsadhd.terminal").close()
eventually(function()
  return vim.fn.jobwait({ job }, 0)[1] ~= -1
end, "renderer exits")
vim.fn.delete(state_file)
print("PASS: Apple Terminal solid pixels, eight/ten-row fitting and game transitions")
vim.cmd("qa!")
