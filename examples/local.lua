-- Copy to ~/.config/nvim/lua/plugins/petsadhd.lua for local development.
return {
  {
    dir = vim.fn.expand("~/PetsADHD"),
    name = "PetsADHD",
    main = "petsadhd",
    lazy = false,
    dependencies = { "folke/snacks.nvim" },
    opts = {},
  },
}
