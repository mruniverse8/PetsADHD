vim.opt.runtimepath:prepend(vim.fn.getcwd())
assert(vim.env.PETSADHD_SNACKS_PATH, "set PETSADHD_SNACKS_PATH to a Snacks checkout")
vim.opt.runtimepath:append(vim.env.PETSADHD_SNACKS_PATH)
vim.o.columns, vim.o.lines = 110, 45
local snacks = require("snacks")
snacks.setup({ picker = { enabled = true }, explorer = { enabled = true } })
local state_file = vim.fn.tempname()
require("petsadhd").setup({ music = false, pets = { kind = "sixseven", state_file = state_file } })
local picker = snacks.explorer({ cwd = vim.fn.getcwd() })
assert(
  vim.wait(3000, function()
    return picker.layout and picker.layout.root and picker.layout.root.win
  end),
  "explorer opens"
)
local function footers()
  local count = 0
  for _, box in ipairs(picker.resolved_layout.layout) do
    if box.sidebar_pets then
      count = count + 1
    end
  end
  return count
end
assert(footers() == 1, "actual Snacks explorer reserves one footer")
vim.cmd("PetSmall")
assert(footers() == 1, "pet resizing preserves one footer")
vim.cmd("PetOff")
assert(footers() == 0, "disabling pets returns footer space")
picker:close()
vim.fn.delete(state_file)
print("PASS: actual Snacks explorer layout and pet toggles")
vim.cmd("qa!")
