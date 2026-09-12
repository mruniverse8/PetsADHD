local M = {}
local ready = false

-- Keep this callable from a user's existing Snacks layout callback as well.
function M.explorer_layout(layout)
  require("petsadhd.pets").explorer_layout(layout)
end

function M.attach_snacks()
  local ok, snacks = pcall(require, "snacks")
  if not ok then
    return false
  end
  local picker = snacks.config.picker
  picker.sources = picker.sources or {}
  picker.sources.explorer = picker.sources.explorer or {}
  local explorer = picker.sources.explorer
  if explorer._petsadhd then
    return true
  end
  explorer._petsadhd = true
  local layout = type(explorer.layout) == "table" and explorer.layout or { preset = explorer.layout or "sidebar" }
  layout.preset = layout.preset or "sidebar"
  local previous = layout.config
  layout.config = function(resolved)
    if previous then
      previous(resolved)
    end
    M.explorer_layout(resolved)
  end
  explorer.layout = layout
  return true
end

function M.open()
  vim.ui.select(
    { "Terminal pets", "Tetris", "Competitive Tetris (2 players)", "Space Invaders", "Choose pet", "Toggle pets" },
    { prompt = "PetsADHD" },
    function(choice)
      if choice == "Terminal pets" then
        require("petsadhd.terminal").open("pets")
      elseif choice == "Tetris" then
        require("petsadhd.tetris").open()
      elseif choice == "Competitive Tetris (2 players)" then
        require("petsadhd.duel").open()
      elseif choice == "Space Invaders" then
        require("petsadhd.invaders").open()
      elseif choice == "Toggle pets" then
        vim.cmd("PetToggle")
      elseif choice == "Choose pet" then
        vim.ui.select({ "trex", "dog", "duck", "sixseven" }, { prompt = "Companion" }, function(kind)
          if kind then
            local pets = require("petsadhd.pets")
            pets.select(kind)
            pets.set(true, true)
          end
        end)
      end
    end
  )
end

function M.setup(opts)
  if ready then
    return
  end
  opts = opts or {}
  if vim.fn.has("nvim-0.11") == 0 then
    error("PetsADHD requires Neovim 0.11 or newer")
  end
  ready = true
  require("petsadhd.pets").setup(vim.tbl_extend("force", { keymaps = opts.keymaps ~= false }, opts.pets or {}))
  require("petsadhd.tetris").setup(
    vim.tbl_extend("force", { keymaps = opts.keymaps ~= false, music = opts.music }, opts.tetris or {})
  )
  require("petsadhd.duel").setup(vim.tbl_extend("force", { music = opts.music }, opts.tetris or {}))
  require("petsadhd.invaders").setup({ keymaps = opts.keymaps ~= false, music = opts.music })
  require("petsadhd.terminal").setup(vim.tbl_extend("force", {
    keymaps = opts.keymaps ~= false,
    music = opts.music,
    tetris_music = (opts.tetris or {}).music,
    speed = (opts.tetris or {}).speed,
  }, opts.terminal or {}))
  if opts.snacks ~= false then
    M.attach_snacks()
  end
  vim.api.nvim_create_user_command("PetsADHD", M.open, { desc = "PetsADHD games and companions" })
end

return M
