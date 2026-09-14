-- Dynamic images use Snacks' terminal transport, not its file-preview buffers.
local M = {}

function M.supported()
  if vim.env.TERM_PROGRAM == "Apple_Terminal" or #vim.api.nvim_list_uis() == 0 or not _G.Snacks then
    return false
  end
  local ok, terminal = pcall(require, "snacks.image.terminal")
  if not ok then
    return false
  end
  local detected, env = pcall(terminal.env)
  return detected and env.supported == true
end

function M.new()
  local terminal = require("snacks.image.terminal")
  -- Image numbers allocate host IDs, allowing other image plugins to coexist.
  local number = math.floor(vim.uv.hrtime() % 2000000000) + 1
  local self = { numbers = { number, number + 1 }, slot = 1 }

  function self:clear()
    for _, id in ipairs(self.numbers) do
      terminal.request({ a = "d", d = "N", I = id })
    end
    self.frame = nil
  end

  function self:draw(win, frame)
    if not frame or not vim.api.nvim_win_is_valid(win) then
      self:clear()
      return
    end
    local width, height = vim.api.nvim_win_get_width(win), vim.api.nvim_win_get_height(win)
    if
      type(frame.data) ~= "string"
      or #frame.data > 250000
      or not frame.data:match("^[%w+/=]+$")
      or type(frame.width) ~= "number"
      or type(frame.height) ~= "number"
      or frame.width < 1
      or frame.width > 4000
      or frame.height < 1
      or frame.height > 64
      or type(frame.row) ~= "number"
      or type(frame.col) ~= "number"
      or type(frame.rows) ~= "number"
      or type(frame.columns) ~= "number"
      or frame.row < 0
      or frame.col < 0
      or frame.rows < 1
      or frame.columns < 1
      or frame.row + frame.rows > height
      or frame.col + frame.columns > width
    then
      self:clear()
      return
    end
    local pos = vim.api.nvim_win_get_position(win)
    for _, other in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
      if vim.api.nvim_win_get_config(other).relative ~= "" then
        local overlay = vim.api.nvim_win_get_position(other)
        if
          overlay[1] < pos[1] + frame.row + frame.rows
          and overlay[2] < pos[2] + frame.col + frame.columns
          and overlay[1] + vim.api.nvim_win_get_height(other) + 2 > pos[1] + frame.row
          and overlay[2] + vim.api.nvim_win_get_width(other) + 2 > pos[2] + frame.col
        then
          self:clear()
          return
        end
      end
    end
    local location = table.concat({ pos[1], pos[2], frame.row, frame.col, frame.rows, frame.columns }, ":")
    if self.frame and self.frame.data == frame.data and self.location == location then
      return
    end
    self.frame, self.location = frame, location
    vim.cmd("redraw")
    terminal.write("\27" .. "7") -- Preserve Neovim's cursor across graphics output.
    terminal.set_cursor({ pos[1] + frame.row + 1, pos[2] + frame.col })
    local id = self.numbers[self.slot]
    terminal.request({ a = "d", d = "N", I = id })
    for offset = 1, #frame.data, 4096 do
      local chunk = frame.data:sub(offset, offset + 4095)
      local opts = offset == 1 and { a = "t", I = id, f = 24, o = "z", s = frame.width, v = frame.height } or {}
      opts.m, opts.data = offset + 4096 <= #frame.data and 1 or 0, chunk
      terminal.request(opts)
    end
    local size = terminal.size()
    local placement = { a = "p", I = id, p = 1, C = 1, z = -1 }
    -- One dimension lets the host preserve aspect ratio in any monospace font.
    if frame.width / frame.height > frame.columns * size.cell_width / (frame.rows * size.cell_height) then
      placement.c = frame.columns
    else
      placement.r = frame.rows
    end
    terminal.request(placement)
    self.slot = self.slot == 1 and 2 or 1
    terminal.request({ a = "d", d = "N", I = self.numbers[self.slot] })
    terminal.write("\27" .. "8")
  end

  return self
end

return M
