local M = {}

function M.mode(value, bitmap)
  value = value or "auto"
  assert(
    vim.tbl_contains({ "auto", "half", "cells", "braille", "bitmap" }, value),
    "PetsADHD: pixel_rendering must be auto, half, cells, braille or bitmap"
  )
  if value == "bitmap" then
    return bitmap and "bitmap" or "cells"
  end
  return value == "auto" and (vim.env.TERM_PROGRAM == "Apple_Terminal" and "cells" or "half") or value
end

function M.cells(value)
  return M.mode(value) == "cells"
end

return M
