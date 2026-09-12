vim.opt.runtimepath:prepend(vim.fn.getcwd())
local previous_called = 0
package.preload.snacks = function()
  return {
    config = {
      picker = {
        sources = {
          explorer = {
            layout = {
              preset = "sidebar",
              config = function()
                previous_called = previous_called + 1
              end,
            },
          },
        },
      },
    },
  }
end
local plugin = require("petsadhd")
local state_file = vim.fn.tempname()
plugin.setup({
  keymaps = false,
  music = false,
  pets = { enabled = false, kind = "sixseven", size = "small", weather = "rain", state_file = state_file },
})
plugin.setup({})
for _, name in ipairs({ "PetsADHD", "Pet67", "PetToggle", "Tetris", "AstraGame", "SpaceInvaders" }) do
  assert(vim.fn.exists(":" .. name) == 2, "command registered: " .. name)
end
local pets = require("petsadhd.pets")
assert(pets.kind() == "sixseven" and pets.size() == "small" and pets.weather() == "rain")
assert(not pets.is_enabled(), "disabled pet option respected")
for _, map in ipairs(vim.api.nvim_get_keymap("n")) do
  assert(
    not vim.tbl_contains({ "Toggle sidebar pets", "Play Astra Tetris", "Play Space Invaders" }, map.desc),
    "leader mappings can be disabled"
  )
end
local snacks = require("snacks")
local callback = snacks.config.picker.sources.explorer.layout.config
plugin.attach_snacks()
assert(snacks.config.picker.sources.explorer.layout.config == callback, "integration attaches once")
local layout = { layout = { { box = "vertical" } } }
callback(layout)
assert(previous_called == 1 and #layout.layout == 1, "existing layout callback is preserved")
pets.set(true, false)
callback(layout)
callback(layout)
assert(#layout.layout == 2 and layout.layout[2].sidebar_pets and layout.layout[2].height == 7, "footer added only once")
pets.set(false, false)
callback(layout)
assert(#layout.layout == 1, "disabled pet removes footer")
local select = vim.ui.select
vim.ui.select = function(_, _, callback)
  callback("Toggle pets")
end
vim.cmd("PetsADHD")
assert(pets.is_enabled(), "chooser dispatches actions")
vim.ui.select = select
pets.set(false, false)
vim.fn.delete(state_file)
print("PASS: package setup, options, commands, chooser, and layout integration")
vim.cmd("qa!")
