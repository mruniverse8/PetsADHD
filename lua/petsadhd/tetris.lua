-- Astra Tetris: a ten-column board, seven-piece bag, and falling pixel blocks.
local M = {}
local active, ready
local ns = vim.api.nvim_create_namespace("AstraGame")
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
      local j = math.random(i)
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

function M.new()
  local s = { width = 10, height = 20, board = {}, bag = {}, score = 0, lines = 0, level = 1, tick = 0 }
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
  spawn(s)
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
  if s.tick >= math.max(1, 9 - s.level) then
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
    [5] = "Next: " .. s.next,
    [11] = "h/l  Left / right",
    [12] = "j    Soft drop",
    [13] = "k/x  Rotate clockwise",
    [14] = "z    Rotate counterclockwise",
    [15] = "Space  Hard drop",
    [17] = "p Pause   r Restart",
    [18] = "q / Esc   Close",
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

function M.close()
  local session = active
  active = nil
  if not session then
    return
  end
  session.timer:stop()
  session.timer:close()
  if vim.api.nvim_win_is_valid(session.win) then
    vim.api.nvim_win_close(session.win, true)
  end
  if vim.api.nvim_buf_is_valid(session.buf) then
    vim.api.nvim_buf_delete(session.buf, { force = true })
  end
end

local function draw(session)
  if active ~= session or not vim.api.nvim_win_is_valid(session.win) then
    return
  end
  local lines, spans = M.render(session.state)
  vim.bo[session.buf].modifiable = true
  vim.api.nvim_buf_set_lines(session.buf, 0, -1, false, lines)
  vim.bo[session.buf].modifiable = false
  vim.api.nvim_buf_clear_namespace(session.buf, ns, 0, -1)
  for _, span in ipairs(spans) do
    vim.api.nvim_buf_set_extmark(session.buf, ns, span[1], span[2], { end_col = span[2] + 2, hl_group = span[3] })
  end
  vim.api.nvim_win_set_cursor(session.win, { 1, 0 })
end

local function geometry()
  local width, height = 54, 24
  if vim.o.columns < width + 4 or vim.o.lines - vim.o.cmdheight < height + 4 then
    return
  end
  return {
    relative = "editor",
    width = width,
    height = height,
    row = math.floor((vim.o.lines - height - 2) / 2),
    col = math.floor((vim.o.columns - width - 2) / 2),
    style = "minimal",
    border = "rounded",
    title = " Astra Tetris ",
    title_pos = "center",
  }
end

function M.open()
  if active and vim.api.nvim_win_is_valid(active.win) then
    vim.api.nvim_set_current_win(active.win)
    return
  end
  local config = geometry()
  if not config then
    vim.notify("Astra needs a terminal at least 58 columns by 29 rows.", vim.log.levels.INFO)
    return
  end
  M.close()
  local b = vim.api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden, vim.bo[b].swapfile, vim.bo[b].undolevels = "wipe", false, -1
  vim.bo[b].filetype = "astra"
  local session = {
    buf = b,
    win = vim.api.nvim_open_win(b, true, config),
    timer = assert(vim.uv.new_timer()),
    state = M.new(),
  }
  active = session
  vim.wo[session.win].wrap = false
  vim.wo[session.win].winhighlight = "Normal:AstraBackground,NormalFloat:AstraBackground"
  local function bind(keys, action)
    for _, key in ipairs(keys) do
      vim.keymap.set("n", key, function()
        if active == session then
          action()
        end
      end, { buffer = b, nowait = true, silent = true })
    end
  end
  for key, arrow in pairs({ h = "<Left>", j = "<Down>", k = "<Up>", l = "<Right>" }) do
    bind({ key, arrow }, function()
      M.input(session.state, key)
      draw(session)
    end)
  end
  for key, action in pairs({ ["<Space>"] = "drop", x = "x", z = "z", p = "p" }) do
    bind({ key }, function()
      M.input(session.state, action)
      draw(session)
    end)
  end
  bind({ "q", "<Esc>" }, M.close)
  bind({ "r" }, function()
    session.state = M.new()
    draw(session)
  end)
  -- Keep editing commands out of the scratch game.
  bind({ "i", "a", "I", "A", "o", "O", "R", "v", "V", "<C-v>", "s", "S", "c", "C", "d" }, function() end)
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
      if active == session then
        vim.schedule(function()
          if active == session then
            M.close()
          end
        end)
      end
    end,
  })
  session.timer:start(
    100,
    100,
    vim.schedule_wrap(function()
      if active ~= session then
        return
      end
      if not vim.api.nvim_win_is_valid(session.win) then
        M.close()
        return
      end
      if vim.api.nvim_get_current_win() == session.win and vim.api.nvim_get_mode().mode == "n" then
        M.step(session.state)
        draw(session)
      end
    end)
  )
  draw(session)
end

function M.setup(opts)
  if ready then
    return
  end
  ready = true
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
    }) do
      vim.api.nvim_set_hl(0, "Astra" .. kind, { fg = "#171b2c", bg = color, bold = true })
    end
    vim.api.nvim_set_hl(0, "AstraGhost", { fg = "#6e789e" })
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
      if not active then
        return
      end
      local config = geometry()
      if not config then
        M.close()
        vim.notify("Astra closed because the terminal became too small.", vim.log.levels.INFO)
        return
      end
      config.col = math.floor((vim.o.columns - config.width - 2) / 2)
      config.row = math.floor((vim.o.lines - config.height - 2) / 2)
      vim.api.nvim_win_set_config(active.win, config)
    end,
  })
  vim.api.nvim_create_autocmd("VimLeavePre", { group = group, callback = M.close })
  vim.api.nvim_create_user_command("AstraGame", M.open, { desc = "Play Astra Tetris" })
  vim.api.nvim_create_user_command("PetGame", M.open, { desc = "Play Astra Tetris" })
  vim.api.nvim_create_user_command("Tetris", M.open, { desc = "Play Astra Tetris" })
  if not opts or opts.keymaps ~= false then
    vim.keymap.set("n", "<leader>uA", M.open, { desc = "Play Astra Tetris" })
  end
end

return M
