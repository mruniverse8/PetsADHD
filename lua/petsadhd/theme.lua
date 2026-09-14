-- Resolve editor colors without assuming that a light/dark option matches its RGB background.
local M = {}

local function rgb(color)
  color = type(color) == "number" and string.format("#%06x", color) or color
  return { tonumber(color:sub(2, 3), 16), tonumber(color:sub(4, 5), 16), tonumber(color:sub(6, 7), 16) }
end

local function luminance(color)
  local value = 0
  for i, weight in ipairs({ 0.2126, 0.7152, 0.0722 }) do
    local channel = color[i] / 255
    value = value + weight * (channel <= 0.04045 and channel / 12.92 or ((channel + 0.055) / 1.055) ^ 2.4)
  end
  return value
end

function M.contrast(foreground, background, minimum)
  local fg, bg = rgb(foreground), luminance(rgb(background))
  local function ratio(color)
    local value = luminance(color)
    return (math.max(value, bg) + 0.05) / (math.min(value, bg) + 0.05)
  end
  if ratio(fg) >= minimum then
    return string.format("#%02x%02x%02x", unpack(fg))
  end
  local target = bg > 0.179 and 0 or 255
  -- Move toward black/white only as far as needed, retaining the source hue.
  for step = 1, 100 do
    local mixed = {}
    for i, channel in ipairs(fg) do
      mixed[i] = math.floor(channel + (target - channel) * step / 100 + 0.5)
    end
    if ratio(mixed) >= minimum then
      return string.format("#%02x%02x%02x", unpack(mixed))
    end
  end
  return target == 0 and "#000000" or "#ffffff"
end

function M.normal()
  -- Effective definitions (link=false) may use the active window's winhighlight.
  -- Follow the global links ourselves so a game/terminal cannot feed its old
  -- background back into the next theme's palette.
  local name, seen, normal = "Normal", {}, {}
  while not seen[name] do
    seen[name] = true
    normal = vim.api.nvim_get_hl(0, { name = name, link = true, create = false })
    if not normal.link then
      break
    end
    name = normal.link
  end
  local light = vim.o.background == "light"
  local bg = normal.bg or (light and 0xf5f5f5 or 0x101725)
  local fg = normal.fg or (light and 0x252932 or 0xcad7e5)
  return {
    background = string.format("#%06x", bg),
    foreground = M.contrast(fg, bg, 4.5),
  }
end

function M.border()
  local normal = M.normal()
  vim.api.nvim_set_hl(0, "PetsADHDGameBorder", { fg = normal.foreground, bg = normal.background })
end

return M
