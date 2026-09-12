-- Copy to ~/.config/nvim/lua/plugins/petsadhd.lua after publishing.
return {
  {
    "mruniverse8/PetsADHD",
    name = "PetsADHD",
    main = "petsadhd",
    lazy = false,
    dependencies = { "folke/snacks.nvim" },
    opts = {
      terminal = { height = 8, pixel_size = 1 },
    },
  },
}
