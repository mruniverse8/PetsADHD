-- A real bottom terminal, sharing the five-line pixel renderer with VS Code.
local M = {}
local config, session
local root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h:h")
local modes = { pets = "1", tetris = "2", duel = "3", invaders = "4", menu = "\t" }

local function send(s, value)
  if s and s.job then
    pcall(vim.api.nvim_chan_send, s.job, value)
  end
end

local function visible(s)
  for _, win in ipairs(vim.fn.win_findbuf(s.buf)) do
    if vim.api.nvim_win_is_valid(win) then
      return win
    end
  end
end

local function fit(s)
  local win = visible(s)
  if not win then
    return
  end
  s.win = win
  local compact = s.mode == "pets" or s.mode == "menu"
  local height = compact and config.height or config.game_height
  -- Leave room for the editor, tab/status/command lines and other splits.
  height = math.min(height, math.max(1, vim.o.lines - 6))
  pcall(vim.api.nvim_win_set_height, win, height)
end

local function audio(s, value)
  local mode = value.mode == "duel" and "tetris" or value.mode
  if not value.enabled or mode ~= s.music_mode then
    if s.audio then
      s.audio:stop()
      s.audio = nil
    end
  end
  s.music_mode = mode
  if not value.enabled then
    return
  end
  if not s.audio then
    local opts = config.music
    if mode == "pets" then
      opts = require("petsadhd.tetris").music_options(opts)
    elseif mode == "tetris" then
      opts = require("petsadhd.tetris").music_options(config.tetris_music == nil and opts or config.tetris_music)
    end
    opts = vim.tbl_extend("force", type(opts) == "table" and opts or {}, { enabled = true })
    s.audio = require("petsadhd.audio").new(opts)
  end
  s.audio:pause(value.paused)
  if not value.paused then
    s.audio:start()
  end
end

function M.hide(from_child)
  local s = session
  if not s then
    return
  end
  if not from_child then
    send(s, "\15")
  end
  if s.audio then
    s.audio:pause(true)
  end
  for _, win in ipairs(vim.fn.win_findbuf(s.buf)) do
    if vim.api.nvim_win_is_valid(win) then
      if vim.api.nvim_get_current_win() == win then
        vim.cmd("stopinsert")
      end
      -- Neovim cannot close the last window in a tab. Replace only our buffer.
      if #vim.api.nvim_tabpage_list_wins(vim.api.nvim_win_get_tabpage(win)) == 1 then
        local buf = s.previous_buf
        if not buf or not vim.api.nvim_buf_is_valid(buf) then
          buf = vim.api.nvim_create_buf(true, false)
        end
        vim.api.nvim_win_set_buf(win, buf)
      else
        vim.api.nvim_win_close(win, true)
      end
    end
  end
  s.win = nil
end

function M.close()
  local s = session
  if not s then
    return
  end
  M.hide()
  session = nil
  if s.audio then
    s.audio:stop()
  end
  -- Ask the child to save and restore the terminal before ending its job.
  send(s, "\30")
  vim.defer_fn(function()
    if s.job then
      pcall(vim.fn.jobstop, s.job)
    end
    if vim.api.nvim_buf_is_valid(s.buf) then
      vim.api.nvim_buf_delete(s.buf, { force = true })
    end
  end, 200)
end

local function watch(s)
  local group = vim.api.nvim_create_augroup("PetsADHDTerminal" .. s.buf, { clear = true })
  s.group = group
  vim.api.nvim_create_autocmd("TermRequest", {
    group = group,
    buffer = s.buf,
    callback = function(ev)
      local payload = ev.data.sequence:match("^\27%]51;PetsADHD;(.+)$")
      if not payload then
        return
      end
      local ok, value = pcall(vim.json.decode, payload)
      if not ok or type(value) ~= "table" then
        return
      end
      vim.schedule(function()
        if session ~= s then
          return
        end
        if value.kind == "hide" then
          -- Already hidden requests must not create a request/response loop.
          if visible(s) then
            M.hide(true)
          end
        elseif value.kind == "mode" and modes[value.mode] then
          s.mode = value.mode
          fit(s)
        elseif value.kind == "audio" and modes[value.mode] then
          audio(s, value)
        elseif (value.kind == "help" or value.kind == "notice") and type(value.message) == "string" then
          vim.notify(
            "PetsADHD: " .. value.message,
            value.kind == "notice" and vim.log.levels.WARN or vim.log.levels.INFO
          )
        end
      end)
    end,
  })
  vim.api.nvim_create_autocmd({ "BufEnter", "BufLeave" }, {
    group = group,
    buffer = s.buf,
    callback = function(ev)
      send(s, ev.event == "BufEnter" and "\6" or "\16")
    end,
  })
  vim.api.nvim_create_autocmd("BufWinLeave", {
    group = group,
    buffer = s.buf,
    callback = function()
      vim.schedule(function()
        if session == s and not visible(s) then
          send(s, "\15")
          if s.audio then
            s.audio:pause(true)
          end
        end
      end)
    end,
  })
  vim.api.nvim_create_autocmd({ "FocusLost", "FocusGained" }, {
    group = group,
    callback = function(ev)
      local focused = ev.event == "FocusGained" and vim.api.nvim_get_current_buf() == s.buf
      send(s, focused and "\6" or "\16")
    end,
  })
  vim.api.nvim_create_autocmd("VimResized", {
    group = group,
    callback = function()
      fit(s)
    end,
  })
  vim.api.nvim_create_autocmd("BufWipeout", {
    group = group,
    buffer = s.buf,
    callback = function()
      if s.audio then
        s.audio:stop()
      end
      if session == s then
        session = nil
      end
      vim.schedule(function()
        pcall(vim.api.nvim_del_augroup_by_id, group)
      end)
    end,
  })
  vim.api.nvim_create_autocmd("VimLeavePre", {
    group = group,
    callback = function()
      send(s, "\30")
      if s.audio then
        s.audio:stop()
      end
      if s.job then
        vim.fn.jobwait({ s.job }, 200)
      end
    end,
  })
end

function M.open(mode)
  if not config then
    M.setup({})
  end
  if mode and not modes[mode] then
    vim.notify("PetsADHD: choose pets, tetris, duel, invaders or menu", vim.log.levels.WARN)
    return
  end
  local node = config.node or vim.fn.exepath("node")
  if node == "" or vim.fn.executable(node) == 0 then
    vim.notify(
      "PetsADHD terminal needs Node.js 18+ on PATH (or terminal.node). Lua games remain available in :PetsADHD.",
      vim.log.levels.WARN
    )
    return
  end
  local previous_buf = vim.api.nvim_get_current_buf()
  local s = session
  local win = s and visible(s)
  if win then
    vim.api.nvim_set_current_win(win)
  else
    vim.cmd("botright " .. config.height .. "new")
    win = vim.api.nvim_get_current_win()
    local empty = vim.api.nvim_get_current_buf()
    if s then
      vim.api.nvim_win_set_buf(win, s.buf)
      vim.api.nvim_buf_delete(empty, { force = true })
    else
      s = { buf = empty, mode = mode or "pets", previous_buf = previous_buf }
      session = s
      watch(s)
      vim.bo[s.buf].bufhidden = "hide"
      local music = config.music
      local enabled = music ~= false
        and (type(music) ~= "table" or music.enabled ~= false)
        and vim.g.invaders_music ~= false
      local state_file = config.state_file
        or (vim.fn.stdpath("state") .. "/petsadhd/terminal-" .. vim.fn.sha256(vim.fn.getcwd()):sub(1, 16) .. ".json")
      s.job = vim.fn.jobstart({ node, root .. "/vscode/terminal-cli.js" }, {
        term = true,
        env = {
          PETSADHD_TERMINAL = vim.json.encode({
            stateFile = state_file,
            mode = mode,
            pet = config.pet,
            pixelSize = config.pixel_size,
            speed = config.speed,
            music = enabled,
          }),
          TERM = "xterm-256color",
          COLORTERM = "truecolor",
        },
        on_exit = function(_, code)
          if s.audio then
            s.audio:stop()
          end
          if session == s then
            M.hide(true)
            session = nil
            if vim.api.nvim_buf_is_valid(s.buf) then
              vim.api.nvim_buf_delete(s.buf, { force = true })
            end
            if code ~= 0 then
              vim.notify("PetsADHD terminal exited (" .. code .. "). Reopen with :PetTerminal.", vim.log.levels.WARN)
            end
          end
        end,
      })
      if s.job <= 0 then
        M.close()
        vim.notify("PetsADHD: could not start the terminal", vim.log.levels.ERROR)
        return
      end
      vim.bo[s.buf].filetype = "petsadhd-terminal"
      vim.bo[s.buf].scrollback = 1
      vim.keymap.set("n", "m", M.hide, { buffer = s.buf, desc = "Minimize PetsADHD" })
    end
  end
  s.win = win
  for option, value in pairs({
    number = false,
    relativenumber = false,
    signcolumn = "no",
    foldcolumn = "0",
    winfixheight = true,
    statusline = "PetsADHD",
  }) do
    vim.wo[win][option] = value
  end
  send(s, "\18" .. (mode and modes[mode] or ""))
  if mode then
    s.mode = mode
  end
  fit(s)
  vim.cmd("startinsert")
end

function M.toggle()
  if session and vim.api.nvim_get_current_buf() == session.buf then
    M.hide()
  else
    M.open()
  end
end

function M.setup(opts)
  config = vim.tbl_extend("force", { height = 8, game_height = 18, pixel_size = 1, speed = 1 }, opts or {})
  config.height = math.max(7, math.floor(tonumber(config.height) or 8))
  config.game_height = math.max(16, math.floor(tonumber(config.game_height) or 18))
  for _, name in ipairs({ "PetTerminal", "PetsADHDTerminal" }) do
    vim.api.nvim_create_user_command(name, function(args)
      M.open(args.args ~= "" and args.args or nil)
    end, {
      nargs = "?",
      desc = "Open or resume tiny pixel pets in a bottom terminal",
      complete = function()
        return { "pets", "tetris", "duel", "invaders", "menu" }
      end,
    })
  end
  vim.api.nvim_create_user_command("PetTerminalClose", M.close, { desc = "Save and close the PetsADHD terminal" })
  if config.keymaps ~= false then
    vim.keymap.set("n", "<leader>uP", M.toggle, { desc = "Toggle PetsADHD terminal" })
  end
end

return M
