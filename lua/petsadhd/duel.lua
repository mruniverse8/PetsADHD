-- Local competitive Tetris: equal piece sequences and queued garbage attacks.
local M = {}
local tetris = require("petsadhd.tetris")
local ready, view

function M.new(opts)
  opts = opts or {}
  local seed = opts.seed or math.random(1, 2147483646)
  return {
    players = { tetris.new({ seed = seed, speed = opts.speed }), tetris.new({ seed = seed, speed = opts.speed }) },
    paused = false,
  }
end

local function resolve(s)
  local a, b = s.players[1], s.players[2]
  local cancel = math.min(a.attack, b.attack)
  a.pending, b.pending = a.pending + b.attack - cancel, b.pending + a.attack - cancel
  a.attack, b.attack = 0, 0
  if a.over or b.over then
    s.over = true
    s.winner = a.over and (b.over and 0 or 2) or 1
  end
end

function M.input(s, action)
  if s.over then
    return
  end
  if action == "pause" then
    s.paused = not s.paused
    return
  end
  if action == "faster" or action == "slower" then
    for _, player in ipairs(s.players) do
      tetris.input(player, action)
    end
    return
  end
  if s.paused then
    return
  end
  tetris.input(s.players[action[1]], action[2])
  resolve(s)
end

function M.step(s)
  if s.paused or s.over then
    return
  end
  for _, player in ipairs(s.players) do
    tetris.step(player)
  end
  resolve(s)
end

function M.render(s)
  local left, lh = tetris.render(s.players[1])
  local right, rh = tetris.render(s.players[2])
  local status = s.over and (s.winner == 0 and "DRAW" or "PLAYER " .. s.winner .. " WINS")
    or (s.paused and "PAUSED" or "TETRIS DUEL")
  local lines =
    { " " .. status .. " | Speed " .. s.players[1].speed .. "x (+/-)", " PLAYER 1                  PLAYER 2" }
  local side = {
    [2] = "P1 score: " .. s.players[1].score,
    [3] = "P2 score: " .. s.players[2].score,
    [5] = "P1 next: " .. s.players[1].next,
    [6] = "P2 next: " .. s.players[2].next,
    [8] = "P1 incoming: " .. s.players[1].pending,
    [9] = "P2 incoming: " .. s.players[2].pending,
    [11] = "2/3/4 lines send 1/2/4",
    [12] = "garbage rows on next lock.",
    [14] = "Same pieces, same speed.",
    [16] = "m Minimize   M Music",
    [17] = "p Pause   r Rematch",
    [18] = "q / Esc Quit",
  }
  for i = 2, 23 do
    lines[#lines + 1] = left[i]:sub(1, 23) .. "   " .. right[i]:sub(1, 23) .. "  " .. (side[i] or "")
  end
  lines[#lines + 1] = " P1: a/d move  s drop  w/g rotate  f HARD DROP"
  lines[#lines + 1] = " P2: arrows move/rotate/drop  / reverse rotate  Enter HARD DROP"
  local spans = {}
  for _, span in ipairs(lh) do
    spans[#spans + 1] = { span[1] + 1, span[2], span[3] }
  end
  for _, span in ipairs(rh) do
    spans[#spans + 1] = { span[1] + 1, span[2] + 26, span[3] }
  end
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
  tetris.setup(opts)
  view = require("petsadhd.window").new({
    name = "TetrisDuel",
    title = "Competitive Tetris - 2 Players",
    filetype = "tetrisduel",
    background = "AstraBackground",
    width = 80,
    height = 26,
    cell_width = 2,
    music = opts.music,
    new = function()
      return M.new({ speed = opts.speed })
    end,
    restart = function(s)
      return M.new({ speed = s.players[1].speed })
    end,
    render = M.render,
    step = M.step,
    input = M.input,
    keys = {
      a = { 1, "h" },
      d = { 1, "l" },
      s = { 1, "j" },
      w = { 1, "k" },
      g = { 1, "z" },
      f = { 1, "drop" },
      ["<Left>"] = { 2, "h" },
      ["<Right>"] = { 2, "l" },
      ["<Down>"] = { 2, "j" },
      ["<Up>"] = { 2, "k" },
      ["/"] = { 2, "z" },
      ["<CR>"] = { 2, "drop" },
      p = "pause",
      ["+"] = "faster",
      ["="] = "faster",
      ["-"] = "slower",
    },
  })
  for _, name in ipairs({ "TetrisDuel", "Tetris2P" }) do
    vim.api.nvim_create_user_command(name, M.open, { desc = "Play or resume local two-player competitive Tetris" })
  end
end
return M
