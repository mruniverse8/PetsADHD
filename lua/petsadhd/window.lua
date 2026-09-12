-- Shared floating-game lifecycle. Minimized games retain their buffer and state.
local M = {}
local foreground

function M.new(opts)
  local controller = {}
  local session
  local ns = vim.api.nvim_create_namespace(opts.name)
  local function geometry()
    local available_w = math.max(1, vim.o.columns - 4)
    local available_h = math.max(1, vim.o.lines - vim.o.cmdheight - 4)
    local width = math.min(opts.width, available_w)
    if opts.dynamic then
      width = math.min(width, math.floor(vim.o.columns * 0.85))
    end
    local height = math.min(opts.height, available_h)
    return {
      relative = "editor",
      width = math.max(1, width),
      height = height,
      row = math.max(0, math.floor((vim.o.lines - height - 2) / 2)),
      col = math.max(0, math.floor((vim.o.columns - width - 2) / 2)),
      style = "minimal",
      border = "rounded",
      title = " " .. opts.title .. " ",
      title_pos = "center",
    },
      width < (opts.min_width or opts.width) or height < (opts.min_height or opts.height)
  end
  local function draw(s)
    if session ~= s or s.hidden or not vim.api.nvim_win_is_valid(s.win) then
      return
    end
    s.music:pause(s.suspended or s.state.paused or s.state.over or false)
    local lines, spans
    if s.suspended then
      lines, spans = { "Resize terminal to resume.", "Then press p to continue." }, {}
    else
      lines, spans = opts.render(s.state)
    end
    local width = vim.api.nvim_win_get_width(s.win)
    for i, line in ipairs(lines) do
      lines[i] = line:sub(1, width)
    end
    vim.bo[s.buf].modifiable = true
    vim.api.nvim_buf_set_lines(s.buf, 0, -1, false, lines)
    vim.bo[s.buf].modifiable = false
    vim.api.nvim_buf_clear_namespace(s.buf, ns, 0, -1)
    for _, span in ipairs(spans) do
      vim.api.nvim_buf_set_extmark(
        s.buf,
        ns,
        span[1],
        span[2],
        { end_col = span[2] + (span[4] or opts.cell_width or 1), hl_group = span[3] }
      )
    end
    vim.api.nvim_win_set_cursor(s.win, { 1, 0 })
  end
  local function start_timer(s)
    s.timer:start(
      opts.interval or 100,
      opts.interval or 100,
      vim.schedule_wrap(function()
        if session ~= s or s.hidden then
          return
        end
        if not vim.api.nvim_win_is_valid(s.win) then
          controller.minimize()
          return
        end
        if not s.suspended and vim.api.nvim_get_current_win() == s.win and vim.api.nvim_get_mode().mode == "n" then
          opts.step(s.state)
          draw(s)
        end
      end)
    )
  end
  function controller.close()
    local s = session
    session = nil
    if foreground == controller then
      foreground = nil
    end
    if not s then
      return
    end
    s.music:stop()
    s.timer:stop()
    s.timer:close()
    if s.win and vim.api.nvim_win_is_valid(s.win) then
      vim.api.nvim_win_close(s.win, true)
    end
    if vim.api.nvim_buf_is_valid(s.buf) then
      vim.api.nvim_buf_delete(s.buf, { force = true })
    end
  end
  function controller.minimize()
    local s = session
    if not s or s.hidden then
      return
    end
    s.resume_paused = s.state.paused or false
    s.hidden, s.state.paused = true, true
    s.music:pause(true)
    s.timer:stop()
    if s.win and vim.api.nvim_win_is_valid(s.win) then
      vim.api.nvim_win_close(s.win, true)
    end
    s.win = nil
    if foreground == controller then
      foreground = nil
    end
  end
  function controller.open()
    if session and not session.hidden and vim.api.nvim_win_is_valid(session.win) then
      vim.api.nvim_set_current_win(session.win)
      return
    end
    local config, small = geometry()
    if small then
      vim.notify(
        opts.title
          .. " needs a larger terminal ("
          .. (opts.min_width or opts.width)
          .. " x "
          .. (opts.min_height or opts.height)
          .. " game cells).",
        vim.log.levels.INFO
      )
      return
    end
    if foreground and foreground ~= controller then
      foreground.minimize()
    end
    if session then
      local s = session
      s.hidden, s.suspended = false, false
      s.state.paused = s.resume_paused
      if opts.resize then
        opts.resize(s.state, config.width, config.height)
      end
      s.win = vim.api.nvim_open_win(s.buf, true, config)
      vim.wo[s.win].wrap = false
      vim.wo[s.win].winhighlight = "Normal:" .. opts.background .. ",NormalFloat:" .. opts.background
      foreground = controller
      start_timer(s)
      draw(s)
      return
    end
    local b = vim.api.nvim_create_buf(false, true)
    vim.bo[b].bufhidden, vim.bo[b].swapfile, vim.bo[b].undolevels = "hide", false, -1
    vim.bo[b].filetype = opts.filetype
    local s = {
      buf = b,
      win = vim.api.nvim_open_win(b, true, config),
      timer = assert(vim.uv.new_timer()),
      state = opts.new(config.width, config.height),
    }
    local music = vim.tbl_extend(
      "force",
      { enabled = true },
      type(opts.music) == "table" and opts.music or { enabled = opts.music ~= false }
    )
    music.enabled = music.enabled and vim.g.invaders_music ~= false
    s.music = require("petsadhd.audio").new(music)
    session, foreground = s, controller
    vim.wo[s.win].wrap = false
    vim.wo[s.win].winhighlight = "Normal:" .. opts.background .. ",NormalFloat:" .. opts.background
    local handlers = {}
    for key, action in pairs(opts.keys) do
      handlers[key] = function()
        if not s.suspended then
          opts.input(s.state, action)
          draw(s)
        end
      end
    end
    handlers.m = controller.minimize
    handlers.M = function()
      s.music:toggle()
      draw(s)
    end
    handlers.q, handlers["<Esc>"] = controller.close, controller.close
    handlers.r = function()
      if not s.suspended then
        s.state = opts.restart and opts.restart(s.state) or opts.new(config.width, config.height)
        draw(s)
      end
    end
    for _, key in ipairs({ "i", "a", "I", "A", "o", "O", "R", "v", "V", "<C-v>", "s", "S", "c", "C", "d" }) do
      if not handlers[key] then
        handlers[key] = function() end
      end
    end
    for key, action in pairs(handlers) do
      vim.keymap.set("n", key, function()
        if session == s and not s.hidden then
          action()
        end
      end, { buffer = b, nowait = true, silent = true })
    end
    vim.api.nvim_create_autocmd("BufLeave", {
      buffer = b,
      callback = function()
        if session == s then
          s.state.paused = true
          s.music:pause(true)
          draw(s)
        end
      end,
    })
    vim.api.nvim_create_autocmd("BufWipeout", {
      buffer = b,
      once = true,
      callback = function()
        vim.schedule(function()
          if session == s then
            controller.close()
          end
        end)
      end,
    })
    s.music:start()
    start_timer(s)
    draw(s)
  end
  local group = vim.api.nvim_create_augroup(opts.name .. "Window", { clear = true })
  vim.api.nvim_create_autocmd("FocusLost", {
    group = group,
    callback = function()
      if session then
        session.state.paused = true
        session.music:pause(true)
        draw(session)
      end
    end,
  })
  vim.api.nvim_create_autocmd("VimResized", {
    group = group,
    callback = function()
      local s = session
      if not s or s.hidden or not vim.api.nvim_win_is_valid(s.win) then
        return
      end
      local config, small = geometry()
      vim.api.nvim_win_set_config(s.win, config)
      s.suspended = small
      if small then
        s.state.paused = true
      elseif opts.resize then
        opts.resize(s.state, config.width, config.height)
      end
      draw(s)
    end,
  })
  vim.api.nvim_create_autocmd("VimLeavePre", { group = group, callback = controller.close })
  return controller
end
return M
