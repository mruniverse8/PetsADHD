-- Stream the requested track through ffplay; own every child process we start.
local M = {}
M.url = "https://www.youtube.com/watch?v=z0FRc-51_V4"

function M.new(opts)
  opts = opts or {}
  local url = opts.url or M.url
  local volume = tostring(math.max(0, math.min(100, opts.volume or 25)))
  local player = opts.player or "ffplay"
  local self = { enabled = opts.enabled, generation = 0, paused = false, status = "off" }

  local function signal(job, name)
    if job then
      local ok, pid = pcall(vim.fn.jobpid, job)
      if ok and pid > 0 then
        pcall(vim.uv.kill, pid, name)
      end
    end
  end

  function self:stop()
    self.generation = self.generation + 1
    -- A stopped process must be resumed before it can handle termination.
    signal(self.player, "sigcont")
    for _, job in ipairs({ self.player or false, self.extractor or false }) do
      if job then
        pcall(vim.fn.jobstop, job)
      end
    end
    self.player, self.extractor, self.status = nil, nil, "off"
  end

  function self:pause(value)
    value = not not value
    if self.paused == value then
      return
    end
    self.paused = value
    signal(self.player, value and "sigstop" or "sigcont")
  end

  function self:start()
    if not self.enabled or self.player or self.extractor then
      return
    end
    local extractor = opts.extractor or (vim.fn.stdpath("data") .. "/invaders-audio/bin/yt-dlp")
    if not opts.extractor and vim.fn.executable(extractor) == 0 then
      extractor = "yt-dlp"
    end
    if vim.fn.executable(extractor) == 0 or vim.fn.executable(player) == 0 then
      self.status = "unavailable"
      vim.notify("Game music needs yt-dlp and ffplay. Press M to retry after installing them.", vim.log.levels.WARN)
      return
    end
    local generation = self.generation
    local function failure(message)
      self.status = "unavailable"
      vim.notify("Game soundtrack: " .. message, vim.log.levels.WARN)
    end
    local function launch(stream)
      local errors = {}
      self.player = vim.fn.jobstart(
        { player, "-nodisp", "-vn", "-autoexit", "-loglevel", "error", "-volume", volume, "-loop", "0", stream },
        {
          stderr_buffered = true,
          on_stderr = function(_, data)
            errors = data
          end,
          on_exit = function(_, code)
            if self.generation ~= generation then
              return
            end
            self.player = nil
            if code ~= 0 then
              failure("audio playback failed; check your audio output. " .. (errors[1] or ""))
            else
              self.status = "off"
            end
          end,
        }
      )
      if self.player <= 0 then
        self.player = nil
        failure("could not start ffplay")
        return
      end
      self.status = "playing"
      if self.paused then
        signal(self.player, "sigstop")
      end
    end
    self.status = "loading"
    local output, errors = {}, {}
    local command = {
      extractor,
      "--ignore-config",
      "--no-playlist",
      "--no-warnings",
      "--socket-timeout",
      "10",
      "--retries",
      "1",
      "--format",
      "bestaudio",
      "--get-url",
    }
    if vim.fn.executable("node") == 1 then
      vim.list_extend(command, { "--js-runtimes", "node:" .. vim.fn.exepath("node") })
    end
    command[#command + 1] = url
    self.extractor = vim.fn.jobstart(command, {
      stdout_buffered = true,
      stderr_buffered = true,
      on_stdout = function(_, data)
        output = data
      end,
      on_stderr = function(_, data)
        errors = data
      end,
      on_exit = function(_, code)
        if self.generation ~= generation then
          return
        end
        self.extractor = nil
        if code ~= 0 or not output[1] or not output[1]:match("^https://") then
          local reason = table.concat(errors, " "):gsub("%s+", " "):sub(1, 220)
          failure(reason ~= "" and reason or "could not resolve the YouTube audio stream")
          return
        end
        launch(output[1])
      end,
    })
    if self.extractor <= 0 then
      self.extractor = nil
      failure("could not start yt-dlp")
      return
    end
    local job = self.extractor
    vim.defer_fn(function()
      if self.generation == generation and self.extractor == job then
        self:stop()
        failure("YouTube did not respond in time. Press M twice to retry.")
      end
    end, 30000)
  end

  function self:toggle()
    self.enabled = not self.enabled
    if self.enabled then
      self:start()
    else
      self:stop()
    end
    vim.notify("Game music " .. (self.enabled and "on" or "off"))
  end

  return self
end

return M
