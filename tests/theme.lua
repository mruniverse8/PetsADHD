vim.opt.runtimepath:prepend(vim.fn.getcwd())
vim.o.columns, vim.o.lines = 110, 42
local theme = require("petsadhd.theme")
local state_file = vim.fn.tempname()
require("petsadhd").setup({
  music = false,
  snacks = false,
  pets = { enabled = false, state_file = state_file },
})

local function luminance(color)
  local sum = 0
  for i, weight in ipairs({ 0.2126, 0.7152, 0.0722 }) do
    local c = bit.band(bit.rshift(color, (3 - i) * 8), 255) / 255
    sum = sum + weight * (c <= 0.04045 and c / 12.92 or ((c + 0.055) / 1.055) ^ 2.4)
  end
  return sum
end
local function readable(fg, bg, minimum)
  local a, b = luminance(fg), luminance(bg)
  return (math.max(a, b) + 0.05) / (math.min(a, b) + 0.05) >= minimum
end
local function highlight(name, bg, minimum)
  local hl = vim.api.nvim_get_hl(0, { name = name, link = false })
  assert(hl.bg == bg, name .. " has the editor background")
  assert(readable(hl.fg, bg, minimum), name .. " has adequate contrast")
end
for _, preset in ipairs({
  { bg = 0xf3ead3, fg = 0x5c6a72, mode = "light" }, -- Everforest soft
  { bg = 0xfffbef, fg = 0x5c6a72, mode = "light" }, -- Everforest hard
  { bg = 0xfbf1c7, fg = 0x3c3836, mode = "light" }, -- Gruvbox light
  { bg = 0x222436, fg = 0xc8d3f5, mode = "dark" }, -- Tokyo Night
  { bg = 0x333c43, fg = 0xd3c6aa, mode = "dark" }, -- Everforest soft dark
  { bg = 0xffffff, fg = 0xf0f0f0, mode = "dark" }, -- weak contrast, mismatched mode
  { bg = 0x000000, fg = 0x050505, mode = "light" },
  { bg = 0x777777, fg = 0x888888, mode = "dark" }, -- medium background
}) do
  vim.o.background = preset.mode
  vim.api.nvim_set_hl(0, "Normal", { fg = preset.fg, bg = preset.bg })
  vim.api.nvim_exec_autocmds("ColorScheme", {})
  assert(theme.normal().background == string.format("#%06x", preset.bg), "RGB background wins over mode")
  for _, name in ipairs({ "AstraBackground", "InvadersBackground", "PetsADHDGameBorder" }) do
    highlight(name, preset.bg, 4.5)
  end
  for _, name in ipairs({ "AstraGhost", "InvadersAlien1", "InvadersStars", "SidebarDuck", "PetPixelr_" }) do
    highlight(name, preset.bg, 3)
  end
  for _, kind in ipairs({ "I", "O", "T", "S", "Z", "J", "L", "Garbage" }) do
    local hl = vim.api.nvim_get_hl(0, { name = "Astra" .. kind })
    assert(readable(hl.bg, preset.bg, 3), kind .. " block stands out on canvas")
    assert(readable(hl.fg, hl.bg, 4.5), kind .. " block text remains readable")
  end
  for _, command in ipairs({ "Tetris", "TetrisDuel", "SpaceInvaders" }) do
    vim.cmd(command)
    local win = vim.api.nvim_get_current_win()
    assert(theme.normal().background == string.format("#%06x", preset.bg), "active game cannot remap Normal lookup")
    vim.api.nvim_exec_autocmds("ColorScheme", {})
    highlight(command == "SpaceInvaders" and "InvadersBackground" or "AstraBackground", preset.bg, 4.5)
    assert(vim.wo[win].winhighlight:find("FloatBorder:PetsADHDGameBorder", 1, true), "border is theme-aware")
    for _, map in ipairs(vim.api.nvim_buf_get_keymap(0, "n")) do
      if map.lhs == "q" then
        map.callback()
      end
    end
  end
end
vim.api.nvim_set_hl(0, "ThemeTestNormal", { fg = 0x3c3836, bg = 0xfbf1c7 })
vim.api.nvim_set_hl(0, "Normal", { link = "ThemeTestNormal" })
vim.api.nvim_exec_autocmds("ColorScheme", {})
assert(theme.normal().background == "#fbf1c7", "global Normal links are followed")
highlight("AstraBackground", 0xfbf1c7, 4.5)
for _, mode in ipairs({ "light", "dark" }) do
  vim.o.background = mode
  vim.api.nvim_set_hl(0, "Normal", {})
  vim.api.nvim_exec_autocmds("ColorScheme", {})
  local normal = theme.normal()
  local expected = mode == "light" and "#f5f5f5" or "#101725"
  assert(normal.background == expected, "transparent themes use a matching opaque fallback")
  local hl = vim.api.nvim_get_hl(0, { name = "AstraBackground" })
  assert(readable(hl.fg, hl.bg, 4.5), "transparent fallback is legible")
end
vim.fn.delete(state_file)
print("PASS: light, dark, medium, low-contrast and transparent themes; sprites, text, borders and theme reloads")
vim.cmd("qa!")
