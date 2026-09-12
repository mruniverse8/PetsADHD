-- Optional integration with installed lazy.nvim and Snacks checkouts.
assert(vim.env.PETSADHD_LAZY_PATH and vim.env.PETSADHD_SNACKS_PATH)
vim.go.loadplugins = true -- -u NONE disables the loader unless explicitly restored.
vim.opt.runtimepath:prepend(vim.env.PETSADHD_LAZY_PATH)
local state_file, lockfile = vim.fn.tempname(), vim.fn.tempname()
require("lazy").setup({
  spec = {
    {
      dir = vim.fn.getcwd(),
      name = "PetsADHD",
      main = "petsadhd",
      lazy = false,
      dependencies = {
        { dir = vim.env.PETSADHD_SNACKS_PATH, name = "snacks.nvim", opts = { picker = { enabled = true } } },
      },
      opts = { music = false, pets = { enabled = false, state_file = state_file } },
    },
  },
  lockfile = lockfile,
  install = { missing = false },
  checker = { enabled = false },
  change_detection = { enabled = false },
})
assert(vim.fn.exists(":PetsADHD") == 2 and vim.fn.exists(":SpaceInvaders") == 2)
assert(package.loaded["petsadhd"] and not package.loaded["config.pet"], "plugin loads without personal config")
assert(require("snacks").config.picker.sources.explorer._petsadhd, "dependency loaded before automatic integration")
vim.fn.delete(state_file)
vim.fn.delete(lockfile)
print("PASS: single-entry lazy.nvim install and automatic dependency integration")
vim.cmd("qa!")
