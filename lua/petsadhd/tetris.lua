-- Astra Tetris: a ten-column board, seven-piece bag, and falling pixel blocks.
local M = {}
local ready, view
M.music_url = "https://www.youtube.com/watch?v=5vaaOqLHxrE"

function M.music_options(opts)
  return vim.tbl_extend("force", { enabled = opts ~= false, url = M.music_url }, type(opts) == "table" and opts or {})
end
local shapes = {
  I = { "    ", "IIII", "    ", "    " },
  O = { "OO", "OO" },
  T = { " T ", "TTT", "   " },
  S = { " SS", "SS ", "   " },
  Z = { "ZZ ", " ZZ", "   " },
  J = { "J  ", "JJJ", "   " },
  L = { "  L", "LLL", "   " },
}
local function cells(piece, callback)
  for y, row in ipairs(piece.shape) do
    for x = 1, #row do
      if row:sub(x, x) ~= " " then
        callback(piece.x + x - 1, piece.y + y - 1)
      end
    end
  end
end

local function fits(s, piece)
  local valid = true
  cells(piece, function(x, y)
    if x < 1 or x > s.width or y < 1 or y > s.height or s.board[y][x] then
      valid = false
    end
  end)
  return valid
end

local function take(s)
  if #s.bag == 0 then
    s.bag = { "I", "O", "T", "S", "Z", "J", "L" }
    for i = #s.bag, 2, -1 do
      s.seed = (s.seed * 16807) % 2147483647
      local j = 1 + s.seed % i
      s.bag[i], s.bag[j] = s.bag[j], s.bag[i]
    end
  end
  return table.remove(s.bag)
end

local function spawn(s)
  local kind = s.next or take(s)
  s.next = take(s)
  s.piece = { kind = kind, shape = shapes[kind], x = 4, y = 1 }
  s.tick = 0
  if not fits(s, s.piece) then
    s.over = true
  end
end

function M.new(opts)
  opts = opts or {}
  local s = {
    width = 10,
    height = 20,
    board = {},
    bag = {},
    score = 0,
    lines = 0,
    level = 1,
    tick = 0,
    speed = math.max(1, math.min(8, math.floor(opts.speed or 1))),
    seed = opts.seed or math.random(1, 2147483646),
    pending = 0,
    attack = 0,
    locks = 0,
  }
  for y = 1, s.height do
    s.board[y] = {}
  end
  spawn(s)
  return s
end

local function move(s, dx, dy)
  local p = s.piece
  local candidate = { kind = p.kind, shape = p.shape, x = p.x + dx, y = p.y + dy }
  if not fits(s, candidate) then
    return false
  end
  s.piece = candidate
  return true
end

local function lock(s)
  cells(s.piece, function(x, y)
    s.board[y][x] = s.piece.kind
  end)
  local cleared, y = 0, s.height
  while y > 0 do
    local full = true
    for x = 1, s.width do
      if not s.board[y][x] then
        full = false
        break
      end
    end
    if full then
      table.remove(s.board, y)
      table.insert(s.board, 1, {})
      cleared = cleared + 1
    else
      y = y - 1
    end
  end
  s.score = s.score + ({ [0] = 0, 100, 300, 500, 800 })[cleared] * s.level
  s.lines = s.lines + cleared
  s.level = 1 + math.floor(s.lines / 10)
  s.locks = s.locks + 1
  local attack = ({ [0] = 0, 0, 1, 2, 4 })[cleared]
  local cancelled = math.min(attack, s.pending)
  s.attack, s.pending = s.attack + attack - cancelled, s.pending - cancelled
  for _ = 1, s.pending do
    if next(s.board[1]) then
      s.over = true
      break
    end
    table.remove(s.board, 1)
    local row, hole = {}, 1 + (s.locks * 7) % s.width
    for x = 1, s.width do
      if x ~= hole then
        row[x] = "Garbage"
      end
    end
    s.board[#s.board + 1] = row
  end
  s.pending = 0
  if not s.over then
    spawn(s)
  end
end

local function rotate(s, clockwise)
  local p, result = s.piece, {}
  local n = #p.shape
  for y = 1, n do
    local row = {}
    for x = 1, n do
      row[x] = clockwise and p.shape[n - x + 1]:sub(y, y) or p.shape[x]:sub(n - y + 1, n - y + 1)
    end
    result[y] = table.concat(row)
  end
  -- Small wall/floor kicks let a rotated piece fit beside an edge or stack.
  for _, offset in ipairs({ { 0, 0 }, { -1, 0 }, { 1, 0 }, { -2, 0 }, { 2, 0 }, { 0, -1 }, { 0, -2 } }) do
    local candidate = { kind = p.kind, shape = result, x = p.x + offset[1], y = p.y + offset[2] }
    if fits(s, candidate) then
      s.piece = candidate
      return
    end
  end
end

function M.input(s, key)
  if s.over then
    return
  end
  if key == "faster" or key == "slower" then
    s.speed = math.max(1, math.min(8, s.speed + (key == "faster" and 1 or -1)))
    return
  end
  if key == "p" then
    s.paused = not s.paused
    return
  end
  if s.paused then
    return
  end
  if key == "h" then
    move(s, -1, 0)
  elseif key == "l" then
    move(s, 1, 0)
  elseif key == "k" or key == "x" then
    rotate(s, true)
  elseif key == "z" then
    rotate(s, false)
  elseif key == "j" then
    if move(s, 0, 1) then
      s.score = s.score + 1
    else
      lock(s)
    end
    s.tick = 0
  elseif key == "drop" then
    while move(s, 0, 1) do
      s.score = s.score + 2
    end
    lock(s)
  end
end

function M.step(s)
  if s.paused or s.over then
    return
  end
  s.tick = s.tick + 1
  if s.tick >= math.max(1, (9 - s.level) / s.speed) then
    s.tick = 0
    if not move(s, 0, 1) then
      lock(s)
    end
  end
end

function M.render(s)
  local grid = vim.deepcopy(s.board)
  if not s.over then
    local ghost = vim.deepcopy(s.piece)
    while fits(s, { kind = ghost.kind, shape = ghost.shape, x = ghost.x, y = ghost.y + 1 }) do
      ghost.y = ghost.y + 1
    end
    cells(ghost, function(x, y)
      grid[y][x] = "ghost"
    end)
    cells(s.piece, function(x, y)
      grid[y][x] = s.piece.kind
    end)
  end
  local side = {
    [1] = "Score  " .. s.score,
    [2] = "Lines  " .. s.lines,
    [3] = "Level  " .. s.level,
    [4] = "Speed  " .. s.speed .. "x (+/-)",
    [5] = "Next: " .. s.next,
    [11] = "h/l  Left / right",
    [12] = "j    Soft drop",
    [13] = "k/x  Rotate clockwise",
    [14] = "z    Rotate counterclockwise",
    [15] = "Space  Hard drop",
    [17] = "p Pause   r Restart",
    [18] = "m Minimize   M Music",
    [19] = "q / Esc   Quit",
    [20] = "Arrows also work",
  }
  for y, row in ipairs(shapes[s.next]) do
    side[y + 5] = row:gsub("%S", "[]"):gsub(" ", "  ")
  end
  local lines = {
    s.over and " ASTRA TETRIS - GAME OVER (r to restart)"
      or (s.paused and " ASTRA TETRIS - PAUSED (p to resume)" or " ASTRA TETRIS"),
    " +--------------------+",
  }
  local spans = {}
  for y = 1, s.height do
    local row = { " |" }
    for x = 1, s.width do
      local kind = grid[y][x]
      row[#row + 1] = kind and (kind == "ghost" and "::" or "[]") or "  "
      if kind then
        spans[#spans + 1] = { #lines, 2 + (x - 1) * 2, kind == "ghost" and "AstraGhost" or "Astra" .. kind }
      end
    end
    lines[#lines + 1] = table.concat(row) .. "|  " .. (side[y] or "")
  end
  lines[#lines + 1] = " +--------------------+"
  lines[#lines + 1] = " Fill rows to clear them. :: shows the landing spot."
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
    name = "AstraGame",
    title = "Astra Tetris",
    filetype = "astra",
    background = "AstraBackground",
    width = 54,
    height = 24,
    cell_width = 2,
    music = M.music_options(opts.music),
    render = M.render,
    step = M.step,
    input = M.input,
    new = function()
      return M.new({ speed = opts.speed })
    end,
    restart = function(s)
      return M.new({ speed = s.speed })
    end,
    keys = {
      h = "h",
      l = "l",
      j = "j",
      k = "k",
      x = "x",
      z = "z",
      p = "p",
      ["<Left>"] = "h",
      ["<Right>"] = "l",
      ["<Up>"] = "k",
      ["<Down>"] = "j",
      ["<Space>"] = "drop",
      ["+"] = "faster",
      ["="] = "faster",
      ["-"] = "slower",
    },
  })
  local group = vim.api.nvim_create_augroup("AstraGame", { clear = true })
  local function colors()
    vim.api.nvim_set_hl(0, "AstraBackground", { fg = "#c6d0f5", bg = "#171b2c" })
    for kind, color in pairs({
      I = "#8bd5ef",
      O = "#eed49f",
      T = "#c6a0f6",
      S = "#a6da95",
      Z = "#ed8796",
      J = "#8aadf4",
      L = "#f5a97f",
      Garbage = "#6e789e",
    }) do
      vim.api.nvim_set_hl(0, "Astra" .. kind, { fg = "#171b2c", bg = color, bold = true })
    end
    vim.api.nvim_set_hl(0, "AstraGhost", { fg = "#6e789e" })
  end
  colors()
  vim.api.nvim_create_autocmd("ColorScheme", { group = group, callback = colors })
  for _, name in ipairs({ "Tetris", "AstraGame", "PetGame" }) do
    vim.api.nvim_create_user_command(name, M.open, { desc = "Play or resume Astra Tetris" })
  end
  if opts.keymaps ~= false then
    vim.keymap.set("n", "<leader>uA", M.open, { desc = "Play Astra Tetris" })
  end
end
return M
