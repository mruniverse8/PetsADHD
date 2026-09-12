-- Space Invaders with a live-resizing playfield and a separate simulation.
local M = {}
local active, ready
local music_options = { enabled = true }
local soundtrack = require("petsadhd.audio")
local ns = vim.api.nvim_create_namespace("SpaceInvaders")

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
  lines[#lines + 1] = s.width >= 58 and "h/l or arrows: move  a: fire  m: music  p/r/q"
    or "h/l <>  a fire  m music  p/r/q"
  return lines, spans
end

function M.close()
  local session = active
  active = nil
  if not session then
    return
  end
  session.music:stop()
  session.timer:stop()
  session.timer:close()
  if vim.api.nvim_win_is_valid(session.win) then
    vim.api.nvim_win_close(session.win, true)
  end
  if vim.api.nvim_buf_is_valid(session.buf) then
    vim.api.nvim_buf_delete(session.buf, { force = true })
  end
end

local function geometry()
  local width = math.max(1, math.min(92, math.floor(vim.o.columns * 0.85), vim.o.columns - 4))
  local height = math.max(1, math.min(32, vim.o.lines - vim.o.cmdheight - 4))
  return {
    relative = "editor",
    width = width,
    height = height,
    row = math.max(0, math.floor((vim.o.lines - height - 2) / 2)),
    col = math.max(0, math.floor((vim.o.columns - width - 2) / 2)),
    style = "minimal",
    border = "rounded",
    title = " Space Invaders ",
    title_pos = "center",
  },
    width < 34 or height < 14
end

local function draw(session)
  if active ~= session or not vim.api.nvim_win_is_valid(session.win) then
    return
  end
  session.music:pause(session.suspended or session.state.paused or session.state.over or false)
  local lines, spans
  if session.suspended then
    lines, spans = { "Resize terminal to resume.", "Minimum: 40 columns, 19 rows." }, {}
  else
    lines, spans = M.render(session.state)
  end
  local width = vim.api.nvim_win_get_width(session.win)
  for i, line in ipairs(lines) do
    lines[i] = line:sub(1, width)
  end
  vim.bo[session.buf].modifiable = true
  vim.api.nvim_buf_set_lines(session.buf, 0, -1, false, lines)
  vim.bo[session.buf].modifiable = false
  vim.api.nvim_buf_clear_namespace(session.buf, ns, 0, -1)
  for _, span in ipairs(spans) do
    vim.api.nvim_buf_set_extmark(session.buf, ns, span[1], span[2], { end_col = span[2] + 1, hl_group = span[3] })
  end
  vim.api.nvim_win_set_cursor(session.win, { 1, 0 })
end

function M.open()
  if active and vim.api.nvim_win_is_valid(active.win) then
    vim.api.nvim_set_current_win(active.win)
    return
  end
  local config, small = geometry()
  if small then
    vim.notify("Space Invaders needs at least 40 columns by 19 rows.", vim.log.levels.INFO)
    return
  end
  M.close()
  local b = vim.api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden, vim.bo[b].swapfile, vim.bo[b].undolevels = "wipe", false, -1
  vim.bo[b].filetype = "spaceinvaders"
  local session = {
    buf = b,
    win = vim.api.nvim_open_win(b, true, config),
    timer = assert(vim.uv.new_timer()),
    state = M.new(config.width - 2, config.height - 4),
  }
  session.music = soundtrack.new(
    vim.tbl_extend("force", music_options, { enabled = music_options.enabled and vim.g.invaders_music ~= false })
  )
  active = session
  session.music:start()
  vim.wo[session.win].wrap = false
  vim.wo[session.win].winhighlight = "Normal:InvadersBackground,NormalFloat:InvadersBackground"
  local function bind(keys, callback)
    for _, key in ipairs(keys) do
      vim.keymap.set("n", key, function()
        if active == session then
          callback()
        end
      end, { buffer = b, nowait = true, silent = true })
    end
  end
  for key, action in pairs({ h = "h", l = "l", ["<Left>"] = "h", ["<Right>"] = "l", a = "fire", p = "p" }) do
    bind({ key }, function()
      if not session.suspended then
        M.input(session.state, action)
        draw(session)
      end
    end)
  end
  bind({ "r" }, function()
    if not session.suspended then
      session.state = M.new(session.state.width, session.state.height)
      draw(session)
    end
  end)
  bind({ "m" }, function()
    session.music:toggle()
    draw(session)
  end)
  bind({ "q", "<Esc>" }, M.close)
  bind({ "i", "I", "A", "o", "O", "R", "v", "V", "<C-v>", "s", "S", "c", "C", "d" }, function() end)
  vim.api.nvim_create_autocmd("BufLeave", {
    buffer = b,
    callback = function()
      if active == session then
        session.state.paused = true
        draw(session)
      end
    end,
  })
  vim.api.nvim_create_autocmd("BufWipeout", {
    buffer = b,
    once = true,
    callback = function()
      vim.schedule(function()
        if active == session then
          M.close()
        end
      end)
    end,
  })
  session.timer:start(
    80,
    80,
    vim.schedule_wrap(function()
      if active ~= session then
        return
      end
      if not vim.api.nvim_win_is_valid(session.win) then
        M.close()
        return
      end
      if
        not session.suspended
        and vim.api.nvim_get_current_win() == session.win
        and vim.api.nvim_get_mode().mode == "n"
      then
        M.step(session.state)
        draw(session)
      end
    end)
  )
  draw(session)
end

function M.setup(opts)
  opts = opts or {}
  music_options = vim.tbl_extend(
    "force",
    { enabled = true },
    type(opts.music) == "table" and opts.music or { enabled = opts.music ~= false }
  )
  if ready then
    return
  end
  ready = true
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
  vim.api.nvim_create_autocmd("FocusLost", {
    group = group,
    callback = function()
      if active then
        active.state.paused = true
        draw(active)
      end
    end,
  })
  vim.api.nvim_create_autocmd("VimResized", {
    group = group,
    callback = function()
      if not active or not vim.api.nvim_win_is_valid(active.win) then
        return
      end
      local config, small = geometry()
      vim.api.nvim_win_set_config(active.win, config)
      active.suspended = small
      if small then
        active.state.paused = true
      else
        M.resize(active.state, config.width - 2, config.height - 4)
      end
      draw(active)
    end,
  })
  vim.api.nvim_create_autocmd("VimLeavePre", { group = group, callback = M.close })
  vim.api.nvim_create_user_command("SpaceInvaders", M.open, { desc = "Play Space Invaders in a resizable window" })
  if opts.keymaps ~= false then
    vim.keymap.set("n", "<leader>uI", M.open, { desc = "Play Space Invaders" })
  end
end

return M
