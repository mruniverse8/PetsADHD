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
assert(#lines == 7 and #spans > 0, "solid-cell sidebar fits a small sprite and weather in seven rows")
for _, line in ipairs(lines) do
  assert(line == string.rep(" ", 36), "pixels use backgrounds, independent of glyph metrics")
end
for _, span in ipairs(spans) do
  assert(span[3] - span[2] == 2 and span[3] <= 36)
  assert(vim.api.nvim_get_hl(0, { name = span[4] }).bg, "each pixel has a solid color")
end
local pet = require("petsadhd.pets")
for _, kind in ipairs({ "dog", "trex", "duck", "sixseven" }) do
  pet.select(kind)
  for _, weather in ipairs({ "sun", "rain" }) do
    pet.weather(weather)
    for _, frame in ipairs({ 0, 4, 28, 60, 179 }) do
      local rendered, pixels, info = pet.render(32, frame)
      assert(#rendered == 7 and info.animal == kind and #pixels > 0, "all tiny sidebar pets fit seven rows")
      for _, pixel in ipairs(pixels) do
        assert(pixel[1] >= 0 and pixel[1] < 7 and pixel[3] <= 32, "weather and animation stay in the canvas")
      end
    end
  end
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
  return vim.api.nvim_win_get_height(win) == 4 and saved().petCells
end, "Apple Terminal automatically fits four solid-pixel rows")
assert(not table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false)):find("▀", 1, true))
vim.api.nvim_chan_send(job, "S")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 10
end, "original art needs ten rows")
vim.api.nvim_chan_send(job, "s")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 4
end, "small art restores four rows")
vim.api.nvim_chan_send(job, "2")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 18
end, "games retain their layout")
vim.api.nvim_chan_send(job, "1")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 4
end, "returning to pets restores solid rows")
vim.api.nvim_chan_send(job, "nnnn")
eventually(function()
  return saved().pet == "sixseven" and vim.api.nvim_win_get_height(win) == 5
end, "67 gets five rows to preserve readable counters")
vim.api.nvim_chan_send(job, "n")
eventually(function()
  return saved().pet == "trex" and vim.api.nvim_win_get_height(win) == 4
end, "switching back to an animal restores four rows")
assert(vim.b[buf].terminal_job_id == job, "resizing retains the same process")
require("petsadhd.terminal").close()
eventually(function()
  return vim.fn.jobwait({ job }, 0)[1] ~= -1
end, "renderer exits")
vim.fn.delete(state_file)
print("PASS: Apple Terminal tiny solid pixels, four/five/ten-row fitting and game transitions")
vim.cmd("qa!")
