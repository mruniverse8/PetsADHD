-- Space Invaders with a live-resizing playfield and a separate simulation.
local M = {}
local ready, view

local function clamp(n, low, high)
  return math.max(low, math.min(high, n))
end

-- Fit seven distinct silhouettes across the window; use compact art when needed.
function M.metrics(s)
  local radius = s.width >= 56 and 3 or (s.width >= 42 and 2 or 1)
  return radius, math.min(radius, s.height >= 22 and 3 or (s.height >= 14 and 2 or 1))
end

local function wave(s)
  s.wave = s.wave + 1
  s.enemies, s.shots, s.bombs = {}, {}, {}
  s.direction = 1
  local radius, rows = M.metrics(s)
  local spacing = radius * 2 + 2
  local start = math.floor((s.width - (6 * spacing + radius * 2 + 1)) / 2) + radius + 1
  for row = 1, 3 do
    for col = 1, 7 do
      s.enemies[#s.enemies + 1] = { x = start + (col - 1) * spacing, y = row * (rows + 1), row = row }
    end
  end
end

function M.new(width, height)
  local s = {
    width = width,
    height = height,
    x = math.floor(width / 2),
    lives = 3,
    score = 0,
    wave = 0,
    tick = 0,
    cooldown = 0,
    shield = 0,
    explosions = {},
  }
  wave(s)
  return s
end

function M.resize(s, width, height)
  local radius, rows = M.metrics({ width = width, height = height })
  local function scale_x(x)
    return clamp(math.floor(2 + (x - 2) * (width - 3) / (s.width - 3) + 0.5), radius + 1, width - radius)
  end
  local function scale_y(y)
    return clamp(math.floor(1 + (y - 1) * (height - 3) / (s.height - 3) + 0.5), rows, height - rows - 1)
  end
  s.x = scale_x(s.x)
  -- Preserve distinct alien columns and rows when compressing a large window.
  local function remap(axis, scale, spacing, maximum)
    local values = {}
    for _, e in ipairs(s.enemies) do
      values[e[axis]] = true
    end
    local sorted = vim.tbl_keys(values)
    table.sort(sorted)
    local mapped, previous = {}, 1 - spacing
    for _, value in ipairs(sorted) do
      mapped[value] = math.max(scale(value), previous + spacing)
      previous = mapped[value]
    end
    local overflow = math.max(0, previous - maximum)
    for _, e in ipairs(s.enemies) do
      e[axis] = mapped[e[axis]] - overflow
    end
  end
  remap("x", scale_x, radius * 2 + 2, width - radius)
  remap("y", scale_y, rows + 1, height - rows - 1)
  for _, list in ipairs({ s.shots, s.bombs, s.explosions }) do
    for _, item in ipairs(list) do
      item.x, item.y = scale_x(item.x), scale_y(item.y)
    end
  end
  s.width, s.height = width, height
end

function M.input(s, key)
  if s.over then
    return
  end
  if key == "p" then
    s.paused = not s.paused
    return
  end
  if s.paused then
    return
  end
  local radius, rows = M.metrics(s)
  if key == "h" then
    s.x = math.max(radius + 1, s.x - 1)
  elseif key == "l" then
    s.x = math.min(s.width - radius, s.x + 1)
  elseif key == "fire" and s.cooldown == 0 then
    s.shots[#s.shots + 1] = { x = s.x, y = s.height - rows - 1 }
    s.cooldown = 3
  end
end

local function hit(s, shot)
  local radius, rows = M.metrics(s)
  for i, enemy in ipairs(s.enemies) do
    if shot.y <= enemy.y and shot.y > enemy.y - rows and math.abs(enemy.x - shot.x) <= radius then
      s.explosions[#s.explosions + 1] = { x = enemy.x, y = enemy.y, life = 5 }
      table.remove(s.enemies, i)
      s.score = s.score + (4 - enemy.row) * 10
      return true
    end
  end
  return false
end

function M.step(s)
  if s.paused or s.over then
    return
  end
  local radius, rows = M.metrics(s)
  s.tick = s.tick + 1
  for i = #s.explosions, 1, -1 do
    s.explosions[i].life = s.explosions[i].life - 1
    if s.explosions[i].life <= 0 then
      table.remove(s.explosions, i)
    end
  end
  s.cooldown, s.shield = math.max(0, s.cooldown - 1), math.max(0, s.shield - 1)
  for i = #s.shots, 1, -1 do
    local shot = s.shots[i]
    local struck = hit(s, shot)
    if not struck then
      shot.y = shot.y - 1
      struck = hit(s, shot)
    end
    if struck or shot.y < 1 then
      table.remove(s.shots, i)
    end
  end
  if #s.enemies == 0 then
    wave(s)
    return
  end
  local speed = math.max(2, 9 - s.wave - math.floor((21 - #s.enemies) / 5))
  if s.tick % speed == 0 then
    local descend = false
    for _, e in ipairs(s.enemies) do
      if e.x + s.direction < radius + 1 or e.x + s.direction > s.width - radius then
        descend = true
      end
    end
    if descend then
      s.direction = -s.direction
    end
    for _, e in ipairs(s.enemies) do
      if descend then
        e.y = e.y + 1
      else
        e.x = e.x + s.direction
      end
      if e.y >= s.height - rows then
        s.over = true
      end
    end
  end
  if s.tick % math.max(5, 18 - s.wave) == 0 then
    -- Only the lowest alien in a column shoots through that column.
    local shooters = {}
    for _, e in ipairs(s.enemies) do
      if not shooters[e.x] or e.y > shooters[e.x].y then
        shooters[e.x] = e
      end
    end
    local columns = vim.tbl_keys(shooters)
    table.sort(columns)
    local e = shooters[columns[1 + math.floor(s.tick / 3) % #columns]]
    s.bombs[#s.bombs + 1] = { x = e.x, y = e.y }
  end
  if s.tick % 2 == 0 then
    for i = #s.bombs, 1, -1 do
      local bomb = s.bombs[i]
      bomb.y = bomb.y + 1
      if bomb.y >= s.height - rows and bomb.y <= s.height - 1 and math.abs(bomb.x - s.x) <= radius then
        if s.shield == 0 then
          s.lives, s.shield = s.lives - 1, 16
          if s.lives <= 0 then
            s.over = true
          end
        end
        table.remove(s.bombs, i)
      elseif bomb.y >= s.height then
        table.remove(s.bombs, i)
      end
    end
  end
end

function M.render(s)
  local radius, rows = M.metrics(s)
  local status = s.over and "GAME OVER (r)" or (s.paused and "PAUSED (p)" or "INVADERS")
  local lines =
    { string.format("%s  %d pts  W%d  HP%d", status, s.score, s.wave, s.lives), "+" .. string.rep("-", s.width) .. "+" }
  local grid, spans = {}, {}
  for y = 1, s.height do
    grid[y] = {}
    for x = 1, s.width do
      local star = (x * 31 + (y - math.floor(s.tick / 5)) * 17) % 137
      grid[y][x] = { star == 0 and "+" or (star == 33 and "." or (star == 77 and "`" or " ")), "InvadersStars" }
    end
  end
  local function paint(x, y, sprite, color)
    for i = 1, #sprite do
      if grid[y] and grid[y][x + i - 1] then
        grid[y][x + i - 1] = { sprite:sub(i, i), color }
      end
    end
  end
  local function sprite(x, bottom, art, color)
    for row, line in ipairs(art) do
      paint(x - math.floor(#line / 2), bottom - #art + row, line, color)
    end
  end
  local animated = s.tick % 8 < 4
  for _, e in ipairs(s.enemies) do
    local art
    if radius == 3 then
      art = ({
        { "  .^.  ", " /o o\\ ", animated and "<|_V_|>" or " /_V_\\ " },
        { " \\| |/ ", "[=o o=]", animated and " /|_|\\ " or " \\|_|/ " },
        { "  ___  ", " /===\\ ", animated and "<_o_o_>" or " <o_o> " },
      })[e.row]
    elseif radius == 2 then
      art = { e.row == 3 and " ___ " or " /V\\ ", animated and "<o=o>" or "[o=o]" }
    else
      art = { animated and "[o]" or "<o>" }
    end
    while #art > rows do
      table.remove(art, 1)
    end
    sprite(e.x, e.y, art, "InvadersAlien" .. e.row)
  end
  for _, shot in ipairs(s.shots) do
    paint(shot.x, shot.y, "|", "InvadersLaser")
    paint(shot.x, shot.y + 1, ":", "InvadersLaserTrail")
  end
  for _, bomb in ipairs(s.bombs) do
    paint(bomb.x, bomb.y, animated and "v" or "!", "InvadersBomb")
  end
  local ship = radius == 3 and { "   ^   ", "  /A\\  ", "</_#_\\>" }
    or (radius == 2 and { "  ^  ", "</A\\>" } or { "/^\\" })
  while #ship > rows do
    table.remove(ship, 1)
  end
  sprite(s.x, s.height - 1, ship, s.shield > 0 and "InvadersShield" or "InvadersShip")
  paint(s.x, s.height, animated and "V" or ":", "InvadersExhaust")
  for _, blast in ipairs(s.explosions) do
    sprite(
      blast.x,
      blast.y,
      blast.life > 2 and { "\\|/", "-*-", "/|\\" } or { ". .", " + ", ". ." },
      "InvadersExplosion"
    )
  end
  for y = 1, s.height do
    local row = { "|" }
    for x, cell in ipairs(grid[y]) do
      row[#row + 1] = cell[1]
      if cell[1] ~= " " then
        spans[#spans + 1] = { #lines, x, cell[2] }
      end
    end
    lines[#lines + 1] = table.concat(row) .. "|"
  end
  lines[#lines + 1] = "+" .. string.rep("-", s.width) .. "+"
  lines[#lines + 1] = s.width >= 58 and "h/l or arrows: move  a: fire  m: hide  M: music  p/r/q"
    or "h/l a:fire m:hide M:music p/r/q"
  return lines, spans
end

function M.open()
  view.open()
end
function M.close()
  if view then
    view.close()
  end
end
function M.minimize()
  if view then
    view.minimize()
  end
end

function M.setup(opts)
  if ready then
    return
  end
  ready = true
  opts = opts or {}
  view = require("petsadhd.window").new({
    name = "SpaceInvaders",
    title = "Space Invaders",
    filetype = "spaceinvaders",
    background = "InvadersBackground",
    width = 92,
    height = 32,
    min_width = 34,
    min_height = 14,
    dynamic = true,
    interval = 80,
    music = opts.music,
    render = M.render,
    step = M.step,
    input = M.input,
    new = function(w, h)
      return M.new(w - 2, h - 4)
    end,
    restart = function(s)
      return M.new(s.width, s.height)
    end,
    resize = function(s, w, h)
      M.resize(s, w - 2, h - 4)
    end,
    keys = { h = "h", l = "l", ["<Left>"] = "h", ["<Right>"] = "l", a = "fire", p = "p" },
  })
  local group = vim.api.nvim_create_augroup("SpaceInvaders", { clear = true })
  local function colors()
    vim.api.nvim_set_hl(0, "InvadersBackground", { fg = "#c6d0f5", bg = "#111827" })
    for name, color in pairs({
      Alien1 = "#c6a0f6",
      Alien2 = "#a6da95",
      Alien3 = "#eed49f",
      Ship = "#8bd5ef",
      Shield = "#ffffff",
      Laser = "#b8ffda",
      LaserTrail = "#4a997b",
      Exhaust = "#ffad5c",
      Explosion = "#ffd77c",
      Bomb = "#ff8095",
      Stars = "#46516a",
    }) do
      vim.api.nvim_set_hl(0, "Invaders" .. name, { fg = color, bold = name ~= "Stars" })
    end
  end
  colors()
  vim.api.nvim_create_autocmd("ColorScheme", { group = group, callback = colors })
  vim.api.nvim_create_user_command("SpaceInvaders", M.open, { desc = "Play or resume Space Invaders" })
  if opts.keymaps ~= false then
    vim.keymap.set("n", "<leader>uI", M.open, { desc = "Play Space Invaders" })
  end
end
return M
