local M = {}

function M.cells(value)
  value = value or "auto"
  assert(
    value == "auto" or value == "half" or value == "cells",
    "PetsADHD: pixel_rendering must be auto, half or cells"
  )
  return value == "cells" or (value == "auto" and vim.env.TERM_PROGRAM == "Apple_Terminal")
end

return M
