-- One animated animal and a changing sky live entirely inside the left explorer.
local M = {}
local timer, state_file, win, buf
local enabled, focused, ready = false, true, false
local tick = 0
local companion = "trex"
local companions = { trex = "SidebarTRex", dog = "SidebarDog", duck = "SidebarDuck", sixseven = "SidebarSixSeven" }
local size_mode = "big"
local size_heights = { small = 7, big = 12 }
local footer_height = 12
local weather_mode = "auto"
local namespace = vim.api.nvim_create_namespace("SidebarPets")

local function close_window()
  if win and vim.api.nvim_win_is_valid(win) then
    vim.api.nvim_win_close(win, true)
  end
  win = nil
end

local function stop_timer()
  if timer then
    timer:stop()
    timer:close()
    timer = nil
  end
end

local palette = {
  g = "#8fbc62", -- dinosaur scales
  l = "#d5df9c", -- dinosaur belly
  d = "#826043", -- dog ears and patches
  b = "#d8a66e", -- dog coat
  c = "#f3dbab", -- muzzle, paws, and feathers
  y = "#f4cc58", -- duck feathers
  o = "#e9923c", -- bill and feet
  k = "#252932", -- eyes and nose
  w = "#fff5dd", -- teeth and eye glints
  s = "#587f45", -- shaded scales
  r = "#7bbbe8", -- rain and puddles
  h = "#a5afbf", -- clouds
}

-- Reduce each 2x2 pixel block, keeping eyes and the strongest coat color.
local function compact(pixels)
  local result = {}
  for row = 1, #pixels, 2 do
    local line = {}
    for col = 1, #pixels[1], 2 do
      local counts, chosen, count = {}, " ", 0
      for y = row, row + 1 do
        for x = col, col + 1 do
          local color = pixels[y]:sub(x, x)
          if color ~= " " then
            counts[color] = (counts[color] or 0) + 1
            if counts[color] > count then
              chosen, count = color, counts[color]
            end
          end
        end
      end
      line[#line + 1] = counts.k and "k" or chosen
    end
    result[#result + 1] = table.concat(line)
  end
  return result
end

-- Rendering a frame is deterministic, so movement and weather can be previewed.
function M.render(width, frame)
  width = width or 40
  local t = frame or tick
  local dog = {
    "              ddd     ",
    "             ddbbb    ",
    "             dbbbbb   ",
    "            ddbbkbbb  ",
    "            ddbbbbcckk",
    "            ddbbbcccc ",
    "            ddbbbcc   ",
    "   b    bbbbbbbbcc    ",
    "  bb  bbbbbbbbbbbc    ",
    "  bbbbbbbbbbbbbbbcc   ",
    "   bbbdddbbbbbbbbcc   ",
    "    bbdddbbbbbbbcc    ",
    "    bbbb     bbbb     ",
    "    bbbc     bbbc     ",
    "    bb        bb      ",
    t % 2 == 0 and "    ccc       ccc     " or "     ccc     ccc      ",
  }
  if t % 4 >= 2 then
    dog[8] = "        bbbbbbbbcc    "
    dog[9] = " bb   bbbbbbbbbbbc    "
  end
  if t % 29 == 28 then
    dog[4] = "            ddbbdbbb  "
  end
  local trex = {
    "              ggggggg ",
    "             ggggggggg",
    "             gglgggggg",
    "             ggkgggggg",
    "             ggggggggg",
    "             gggwwwww ",
    "             ggg      ",
    "            ggglll    ",
    "           gggglllgg  ",
    "          ggggglll g  ",
    " g       gggggglll    ",
    " gg     ggggggglll    ",
    "  gggggggggggglll     ",
    "   sssssggggggll      ",
    "      gggg ggg        ",
    t % 2 == 0 and "      cc    cc        " or "       cc     cc      ",
  }
  if t % 16 >= 12 then
    trex[6] = "             gggw w w "
    trex[7] = "             ggg   gg "
  end
  if t % 4 >= 2 then
    trex[11] = "         gggggglll    "
    trex[12] = "ggg     ggggggglll    "
  end
  local duck = {
    "          ",
    "          ",
    "          ",
    "          ",
    "    yyy   ",
    "   yyyyy  ",
    "   ykyyy  ",
    "   yyyyooo",
    "   yyyyy  ",
    "   yycc   ",
    " yyyyyyy  ",
    t % 4 < 2 and "yyyyyccyy " or "yyyccyyyy ",
    " yyycccyy ",
    "  yyyyyy  ",
    "   o  o   ",
    t % 2 == 0 and "  oo  oo  " or "   oo  oo ",
  }
  -- A clean 5x7 pixel font, enlarged without resampling in big mode.
  local sixseven = {
    " rrr   yyyyy ",
    "r          y ",
    "r         y  ",
    "rrrr     y   ",
    "r   r   y    ",
    "r   r   y    ",
    " rrr    y    ",
  }
  local pixels = ({ dog = dog, trex = trex, duck = duck, sixseven = sixseven })[companion]
  if companion == "sixseven" and size_mode == "big" then
    pixels = {}
    for _, line in ipairs(sixseven) do
      local enlarged = line:gsub(".", function(pixel)
        return pixel .. pixel
      end)
      pixels[#pixels + 1] = enlarged
      pixels[#pixels + 1] = enlarged
    end
  elseif companion ~= "sixseven" and size_mode == "small" then
    pixels = compact(pixels)
  end
  local sprite_width, canvas_height = #pixels[1], footer_height * 2
  if width < sprite_width + 2 then
    return {}, {}
  end
  local weather = weather_mode == "auto" and (t % 180 < 110 and "sun" or "rain") or weather_mode
  local canvas = {}
  for row = 1, canvas_height do
    canvas[row] = {}
    for col = 1, width do
      canvas[row][col] = " "
    end
  end
  local function put(x, y, color)
    if x >= 0 and x < width and y >= 0 and y < canvas_height and color ~= " " then
      canvas[y + 1][x + 1] = color
    end
  end
  local function paint(art, x, y, mirror)
    for row, line in ipairs(art) do
      for col = 1, #line do
        put(
          x + col - 1,
          y + row - 1,
          line:sub(mirror and (#line - col + 1) or col, mirror and (#line - col + 1) or col)
        )
      end
    end
  end
  if weather == "sun" then
    local rays = t % 8 < 4
    paint({ rays and "  o  " or "o   o", " yyy ", "oyyyo", " yyy ", rays and "  o  " or "o   o" }, width - 7, 0)
    paint({ "  ww  ", " wwwww" }, 2 + math.floor(t / 12) % math.max(1, width - 15), 1)
  else
    paint({ "  hhhhh  ", " hhhhhhh ", "hhhhhhhhh" }, 1 + math.floor(t / 10) % math.max(1, width - 11), 0)
    for drop = 1, math.floor(width / 3) do
      local x = (drop * 7 + math.floor(t / 4)) % width
      local y = 3 + (drop * 5 + t * 2) % (canvas_height - 4)
      put(x, y, "r")
      put(x, y + 1, "r")
    end
  end
  for x = 0, width - 1 do
    if x % 3 == 0 then
      put(x, canvas_height - 1, weather == "rain" and "r" or "s")
    end
  end
  local function bounce(step, distance)
    if distance == 0 then
      return 0, false
    end
    local phase = step % (distance * 2)
    return phase <= distance and phase or (distance * 2 - phase), phase > distance
  end
  local x, mirror = bounce(math.floor(t / 2), width - sprite_width - 2)
  local y = bounce(math.floor(t / 3), canvas_height - #pixels - 4)
  x, y = x + 1, y + 3
  if companion == "sixseven" then
    -- Keep the counters and gap empty even when rain passes behind the digits.
    y = y - y % 2
    for row = y, y + #pixels + 1 do
      for col = x, x + sprite_width + 1 do
        if canvas[row] and canvas[row][col] then
          canvas[row][col] = " "
        end
      end
    end
  end
  -- Paint just one animal over the sky and rain, preserving its silhouette.
  paint(pixels, x, y, companion ~= "sixseven" and mirror)
  local lines, highlights = {}, {}
  for row = 1, canvas_height, 2 do
    local cells, bytes = {}, 0
    for col = 1, width do
      local top, bottom = canvas[row][col], canvas[row + 1][col]
      local glyph = top ~= " " and (bottom ~= " " and (top == bottom and "█" or "▀") or "▀")
        or (bottom ~= " " and "▄" or " ")
      cells[#cells + 1] = glyph
      if top ~= " " or bottom ~= " " then
        highlights[#highlights + 1] = {
          #lines,
          bytes,
          bytes + #glyph,
          "PetPixel" .. (top == " " and "_" or top) .. (bottom == " " and "_" or bottom),
        }
      end
      bytes = bytes + #glyph
    end
    lines[#lines + 1] = table.concat(cells)
  end
  return lines, highlights, { animal = companion, x = x, y = y, weather = weather, size = size_mode }
end

function M.is_enabled()
  return enabled
end

function M.explorer_layout(layout)
  layout.layout = layout.layout or {}
  layout.layout.position = "left"
  for i = #layout.layout, 1, -1 do
    if layout.layout[i].sidebar_pets then
      table.remove(layout.layout, i)
    end
  end
  if enabled then
    table.insert(layout.layout, { box = "vertical", height = footer_height, sidebar_pets = true })
  end
end

local function explorers()
  return package.loaded["snacks.picker"] and Snacks.picker.get({ source = "explorer" }) or {}
end

local function tree_window()
  for _, picker in ipairs(explorers()) do
    local root = picker.layout and picker.layout.root.win
    if root and vim.api.nvim_win_is_valid(root) then
      for _, box in ipairs(picker.resolved_layout.layout) do
        if box.sidebar_pets then
          return root, nil, true
        end
      end
    end
  end
  for _, candidate in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
    local tree_buf = vim.api.nvim_win_get_buf(candidate)
    if vim.bo[tree_buf].filetype == "neo-tree" and vim.api.nvim_win_get_config(candidate).relative == "" then
      return candidate, tree_buf
    end
  end
end

local function draw()
  local tree, tree_buf, footer = tree_window()
  if not enabled or not tree then
    close_window()
    return
  end
  local width = vim.api.nvim_win_get_width(tree)
  local lines, highlights = M.render(width)
  local height = #lines
  local tree_height = vim.api.nvim_win_get_height(tree)
  if height == 0 or tree_height < height + 3 then
    close_window()
    return
  end
  -- Never cover a filename: only use empty rows below the last tree item.
  local row = tree_height - height
  if not footer then
    local last = vim.fn.screenpos(tree, vim.api.nvim_buf_line_count(tree_buf), 1)
    local tree_top = vim.api.nvim_win_get_position(tree)[1]
    if last.row == 0 or last.row >= tree_top + row then
      close_window()
      return
    end
  elseif height > footer_height then
    close_window()
    return
  end
  if not buf or not vim.api.nvim_buf_is_valid(buf) then
    buf = vim.api.nvim_create_buf(false, true)
    vim.bo[buf].bufhidden = "hide"
    vim.bo[buf].swapfile = false
    vim.bo[buf].undolevels = -1
  end
  vim.bo[buf].modifiable = true
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.api.nvim_buf_clear_namespace(buf, namespace, 0, -1)
  for _, span in ipairs(highlights) do
    vim.api.nvim_buf_set_extmark(buf, namespace, span[1], span[2], {
      end_col = span[3],
      hl_group = span[4],
    })
  end
  local config = {
    relative = "win",
    win = tree,
    row = row,
    col = 0,
    width = width,
    height = height,
    focusable = false,
    mouse = false,
    style = "minimal",
    border = "none",
    zindex = 70,
  }
  if win and vim.api.nvim_win_is_valid(win) then
    vim.api.nvim_win_set_config(win, config)
  else
    config.noautocmd = true
    win = vim.api.nvim_open_win(buf, false, config)
    vim.wo[win].winblend = 0
    vim.wo[win].wrap = false
  end
  local hl = companions[companion]
  vim.wo[win].winhighlight = "Normal:" .. hl .. ",NormalFloat:" .. hl .. ",EndOfBuffer:" .. hl
end

function M.set(value, persist)
  enabled = value
  stop_timer()
  close_window()
  for _, picker in ipairs(explorers()) do
    picker:set_layout()
  end
  if enabled then
    timer = assert(vim.uv.new_timer())
    local current_timer = timer
    timer:start(
      280,
      280,
      vim.schedule_wrap(function()
        if not enabled or timer ~= current_timer then
          return
        end
        if focused and vim.api.nvim_get_mode().mode == "n" then
          tick = tick + 1
        end
        draw()
      end)
    )
  else
    close_window()
    if buf and vim.api.nvim_buf_is_valid(buf) then
      vim.api.nvim_buf_delete(buf, { force = true })
    end
    buf = nil
  end
  if persist then
    local ok, err = pcall(function()
      vim.fn.mkdir(vim.fn.fnamemodify(state_file, ":h"), "p")
      assert(vim.fn.writefile({ enabled and "on" or "off", companion, weather_mode, size_mode }, state_file) == 0)
    end)
    if not ok then
      vim.notify("Could not save the pets' setting: " .. tostring(err), vim.log.levels.WARN)
    end
  end
  draw()
end

function M.select(kind)
  assert(companions[kind], "Choose dog, trex, duck, or sixseven")
  companion = kind
  tick = 0
  M.set(enabled, true)
end

function M.weather(mode)
  if mode then
    assert(mode == "auto" or mode == "sun" or mode == "rain", "Choose auto, sun, or rain")
    weather_mode = mode
    M.set(enabled, true)
  end
  return weather_mode
end

function M.kind()
  return companion
end

function M.size(value)
  if value then
    assert(size_heights[value], "Choose small or big")
    size_mode, footer_height = value, size_heights[value]
    M.set(enabled, true)
  end
  return size_mode
end

function M.setup(opts)
  if ready then
    return
  end
  ready = true
  opts = opts or {}
  state_file = opts.state_file or (vim.fn.stdpath("state") .. "/petsadhd/pets-state")
  local ok, saved = pcall(vim.fn.readfile, state_file)
  if ok and companions[saved[2]] then
    companion = saved[2]
  end
  if ok and (saved[3] == "auto" or saved[3] == "sun" or saved[3] == "rain") then
    weather_mode = saved[3]
  end
  if ok and size_heights[saved[4]] then
    size_mode, footer_height = saved[4], size_heights[saved[4]]
  end
  if opts.kind then
    assert(companions[opts.kind], "PetsADHD: invalid pet kind")
    companion = opts.kind
  end
  if opts.size then
    assert(size_heights[opts.size], "PetsADHD: choose small or big")
    size_mode, footer_height = opts.size, size_heights[opts.size]
  end
  if opts.weather then
    assert(vim.tbl_contains({ "auto", "sun", "rain" }, opts.weather), "PetsADHD: invalid weather")
    weather_mode = opts.weather
  end
  local group = vim.api.nvim_create_augroup("SidebarPets", { clear = true })
  local function colors()
    local theme = require("petsadhd.theme")
    local bg = theme.normal().background
    for name, color in pairs({
      SidebarDog = "#d9ad78",
      SidebarTRex = "#a3c76f",
      SidebarDuck = "#e5c76b",
      SidebarSixSeven = "#7bbbe8",
    }) do
      vim.api.nvim_set_hl(0, name, { fg = theme.contrast(color, bg, 3), bg = bg })
    end
    local colors_with_space = { _ = bg }
    for key, color in pairs(palette) do
      -- Eyes and glints contrast with the coat, rather than the editor surface.
      colors_with_space[key] = (key == "k" or key == "w") and color or theme.contrast(color, bg, 3)
    end
    for top, top_color in pairs(colors_with_space) do
      for bottom, bottom_color in pairs(colors_with_space) do
        local fg = top == "_" and bottom_color or top_color
        local cell_bg = top ~= "_" and bottom ~= "_" and top ~= bottom and bottom_color or bg
        vim.api.nvim_set_hl(0, "PetPixel" .. top .. bottom, { fg = fg, bg = cell_bg })
      end
    end
  end
  colors()
  vim.api.nvim_create_autocmd("ColorScheme", { group = group, callback = colors })
  vim.api.nvim_create_autocmd("FileType", {
    group = group,
    pattern = { "neo-tree", "snacks_picker_list" },
    callback = function()
      colors()
      vim.schedule(draw)
    end,
  })
  vim.api.nvim_create_autocmd("FocusLost", {
    group = group,
    callback = function()
      focused = false
    end,
  })
  vim.api.nvim_create_autocmd("FocusGained", {
    group = group,
    callback = function()
      focused = true
    end,
  })
  vim.api.nvim_create_autocmd("TabLeave", { group = group, callback = close_window })
  vim.api.nvim_create_autocmd({ "TabEnter", "WinResized", "WinScrolled", "WinClosed", "BufWinEnter", "TextChanged" }, {
    group = group,
    callback = function()
      vim.schedule(draw)
    end,
  })
  vim.api.nvim_create_autocmd("VimLeavePre", {
    group = group,
    callback = function()
      enabled = false
      stop_timer()
      close_window()
    end,
  })
  vim.api.nvim_create_user_command("PetSmall", function()
    M.size("small")
  end, { desc = "Small animal with a seven-row habitat" })
  vim.api.nvim_create_user_command("PetBig", function()
    M.size("big")
  end, { desc = "Detailed animal with a twelve-row habitat" })
  vim.api.nvim_create_user_command("PetDuck", function()
    M.select("duck")
  end, { desc = "Choose Quackers the duck" })
  vim.api.nvim_create_user_command("Pet67", function()
    companion = "sixseven"
    tick = 0
    M.set(true, true)
  end, { desc = "Six seven! Bouncing meme companion" })
  vim.api.nvim_create_user_command("PetWeather", function(args)
    local mode = args.args:lower()
    if mode ~= "auto" and mode ~= "sun" and mode ~= "rain" then
      vim.notify("Use :PetWeather auto, sun, or rain", vim.log.levels.WARN)
      return
    end
    M.weather(mode)
  end, {
    nargs = 1,
    desc = "Choose the pet habitat's weather",
    complete = function()
      return { "auto", "sun", "rain" }
    end,
  })
  vim.api.nvim_create_user_command("PetDog", function()
    M.select("dog")
  end, { desc = "Choose Biscuit the dog" })
  vim.api.nvim_create_user_command("PetTRex", function()
    M.select("trex")
  end, { desc = "Choose Rex the T-rex" })
  for name, action in pairs({
    PetOn = function()
      M.set(true, true)
    end,
    PetOff = function()
      M.set(false, true)
    end,
    PetToggle = function()
      M.set(not enabled, true)
    end,
  }) do
    vim.api.nvim_create_user_command(name, action, { desc = name .. ": Animated pets in the left explorer" })
  end
  if opts.keymaps ~= false then
    vim.keymap.set("n", "<leader>uP", "<cmd>PetToggle<cr>", { desc = "Toggle sidebar pets" })
  end
  local start_enabled = not (ok and saved[1] == "off")
  if opts.enabled ~= nil then
    start_enabled = opts.enabled
  end
  M.set(start_enabled, false)
end

return M
