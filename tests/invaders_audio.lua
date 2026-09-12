-- No network or audio device required: exercise the child-process lifecycle.
vim.opt.runtimepath:prepend(vim.fn.getcwd())
local jobs, signals, timers, notifications = {}, {}, {}, {}
vim.fn.executable = function()
  return 1
end
vim.fn.exepath = function(name)
  return "/usr/bin/" .. name
end
vim.fn.jobstart = function(command, callbacks)
  local id = #jobs + 1
  jobs[id] = { command = command, callbacks = callbacks }
  return id
end
vim.fn.jobpid = function(job)
  return job + 10000
end
vim.fn.jobstop = function(job)
  jobs[job].stopped = true
end
vim.uv.kill = function(pid, signal)
  signals[#signals + 1] = { pid, signal }
end
vim.defer_fn = function(callback)
  timers[#timers + 1] = callback
end
vim.notify = function(message)
  notifications[#notifications + 1] = message
end
local audio = require("petsadhd.audio")
local track = audio.new({ enabled = true })
track:start()
assert(track.status == "loading" and #jobs == 1)
assert(jobs[1].command[#jobs[1].command] == audio.url)
assert(vim.tbl_contains(jobs[1].command, "--no-playlist"), "only the requested track is resolved")
track:pause(true)
jobs[1].callbacks.on_stdout(1, { "https://example.com/audio", "" })
jobs[1].callbacks.on_exit(1, 0)
assert(track.status == "playing" and #jobs == 2)
assert(jobs[2].command[1] == "ffplay" and jobs[2].command[#jobs[2].command] == "https://example.com/audio")
assert(signals[#signals][2] == "sigstop", "late-starting audio respects paused game")
track:pause(false)
assert(signals[#signals][2] == "sigcont")
track:stop()
assert(jobs[2].stopped and track.player == nil, "close owns and terminates player")
jobs[2].callbacks.on_exit(2, 143)
assert(#notifications == 0, "intentional termination is silent")

track = audio.new({ enabled = true })
track:start()
local pending = track.extractor
track:toggle()
assert(jobs[pending].stopped and not track.enabled)
local count = #jobs
jobs[pending].callbacks.on_stdout(pending, { "https://example.com/audio" })
jobs[pending].callbacks.on_exit(pending, 0)
assert(#jobs == count, "muting during extraction cannot launch orphan player")
track:toggle()
assert(track.enabled and track.extractor, "music can be re-enabled")
pending = track.extractor
jobs[pending].callbacks.on_stderr(pending, { "Network unavailable" })
jobs[pending].callbacks.on_exit(pending, 1)
assert(track.status == "unavailable" and track.extractor == nil)
track:stop()

track = audio.new({ enabled = true })
track:start()
pending = track.extractor
timers[#timers]()
assert(jobs[pending].stopped and track.status == "unavailable", "timeout stops stalled extraction")
track = audio.new({ enabled = false })
count = #jobs
track:start()
assert(#jobs == count, "disabled soundtrack makes no external requests")
print("PASS: soundtrack startup, pause, mute, cancellation, errors, and timeout")
vim.cmd("qa!")
