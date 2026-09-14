vim.opt.runtimepath:prepend(vim.fn.getcwd())
vim.env.TERM_PROGRAM = "Apple_Terminal"
vim.o.columns, vim.o.lines = 110, 42
local pixels = require("petsadhd.pixels")
assert(pixels.mode("braille") == "braille")
assert(pixels.mode("bitmap", true) == "bitmap" and pixels.mode("bitmap", false) == "cells")
assert(not pcall(pixels.mode, "unknown"))
assert(not require("petsadhd.bitmap").supported(), "Apple Terminal never probes unsupported graphics")

local live, chunks, placed = {}, {}, 0
package.loaded["snacks.image.terminal"] = {
  request = function(opts)
    if opts.a == "t" then
      live[opts.I] = true
    end
    if opts.a == "d" then
      assert(opts.d == "N" and opts.I, "only delete our newest numbered image")
      live[opts.I] = nil
    end
    if opts.data then
      chunks[#chunks + 1] = opts
      assert(#opts.data <= 4096 and #opts.data % 4 == 0)
    end
    if opts.a == "p" then
      placed = placed + 1
      assert(opts.C == 1 and opts.z == -1 and live[opts.I])
      assert((opts.c ~= nil) ~= (opts.r ~= nil), "host scaling preserves source aspect ratio")
    end
  end,
  write = function() end,
  set_cursor = function() end,
  size = function()
    return { cell_width = 9, cell_height = 18 }
  end,
}
local image = require("petsadhd.bitmap").new()
local frame = { data = string.rep("AAAA", 2100), width = 32, height = 32, row = 0, col = 1, rows = 2, columns = 4 }
image:draw(vim.api.nvim_get_current_win(), frame)
assert(#chunks == 3 and chunks[1].o == "z" and chunks[3].m == 0)
local count = placed
image:draw(vim.api.nvim_get_current_win(), frame)
assert(placed == count, "unchanged frames are not retransmitted")
for i = 1, 20 do
  image:draw(vim.api.nvim_get_current_win(), vim.tbl_extend("force", frame, { data = string.rep("BBBB", i) }))
  assert(vim.tbl_count(live) == 1, "animation retains only the current image")
end
image:draw(vim.api.nvim_get_current_win(), vim.tbl_extend("force", frame, { row = 1000 }))
assert(vim.tbl_count(live) == 0, "outdated resized frames cannot paint outside their window")
local editor = vim.api.nvim_get_current_win()
local overlay = vim.api.nvim_open_win(
  vim.api.nvim_create_buf(false, true),
  false,
  { relative = "editor", row = 0, col = 1, width = 4, height = 2, style = "minimal" }
)
image:draw(editor, frame)
assert(vim.tbl_count(live) == 0, "floating controls do not expose images through their background")
vim.api.nvim_win_close(overlay, true)

local state_file = vim.fn.tempname()
require("petsadhd").setup({
  music = false,
  snacks = false,
  pets = { enabled = false, size = "small", pixel_rendering = "braille", state_file = vim.fn.tempname() },
  terminal = { music = false, pixel_rendering = "braille", state_file = state_file },
})
local pets = require("petsadhd.pets")
for _, kind in ipairs({ "trex", "dog", "duck", "sixseven" }) do
  pets.select(kind)
  for _, weather in ipairs({ "sun", "rain" }) do
    pets.weather(weather)
    local lines, spans = pets.render(36, 28)
    assert(#lines == 4 and #spans > 0)
    for _, line in ipairs(lines) do
      assert(vim.fn.strdisplaywidth(line) == 36)
    end
  end
end
pets.style("auto")
assert(#pets.render(36, 0) == 7)
if vim.fn.executable("node") == 0 then
  print("PASS: Braille sidebar and bitmap transport; SKIP PTY without Node")
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
vim.cmd("PetTerminal pets")
local win, buf = vim.api.nvim_get_current_win(), vim.api.nvim_get_current_buf()
local job = vim.b[buf].terminal_job_id
eventually(function()
  return vim.api.nvim_win_get_height(win) == 2 and saved().petBraille
end, "Braille fits two rows")
vim.api.nvim_chan_send(job, "\t")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 4
end, "menu expands to four rows")
vim.api.nvim_chan_send(job, "1S")
eventually(function()
  return vim.api.nvim_win_get_height(win) == 3
end, "original art fits three rows")
vim.api.nvim_chan_send(job, "snn")
eventually(function()
  return saved().pet == "cow" and vim.api.nvim_win_get_height(win) == 2
end, "pet cycling retains compact layout")
vim.cmd("stopinsert")
vim.cmd("PetTerminalStyle bitmap")
eventually(function()
  return saved().petCells
    and not saved().petBraille
    and not saved().petBitmap
    and vim.bo.filetype == "petsadhd-terminal"
    and vim.api.nvim_win_get_height(0) == 4
end, "Apple Terminal falls back to solid pixels and retains the pet")
assert(saved().pet == "cow")
require("petsadhd.bitmap").supported = function()
  return true
end
vim.cmd("stopinsert")
vim.cmd("PetTerminalStyle bitmap")
eventually(function()
  return saved().petBitmap and placed > count + 20 and vim.api.nvim_win_get_height(0) == 2
end, "real child bitmap frames reach the graphics transport")
require("petsadhd.terminal").hide()
assert(vim.tbl_count(live) == 0, "hiding deletes owned graphics")
require("petsadhd.terminal").open("pets")
eventually(function()
  return vim.tbl_count(live) == 1
end, "reopening redraws bitmap")
vim.cmd("tabnew")
eventually(function()
  return vim.tbl_count(live) == 0
end, "hidden tabs do not repaint graphics")
require("petsadhd.terminal").close()
assert(vim.tbl_count(live) == 0)
vim.fn.delete(state_file)
print("PASS: two/three/four-row Braille, Apple fallback, saved style switching and scoped bitmap lifecycle")
vim.cmd("qa!")
