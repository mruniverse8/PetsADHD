-- Copy to ~/.config/nvim/lua/plugins/petsadhd.lua after publishing.
return {
  {
    "YOUR_GITHUB_USERNAME/PetsADHD",
    name = "PetsADHD",
    main = "petsadhd",
    lazy = false,
    dependencies = { "folke/snacks.nvim" },
    opts = {},
  },
}
