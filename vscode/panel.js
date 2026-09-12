"use strict";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// VS Code exposes measured PTY dimensions but no public panel-size setter.
// Grow the focused panel in native increments and stop at its layout limit.
async function fitPanel(vscode, terminal, session, options, wait = delay) {
  if (!options.autoSize) return;
  const token = (session.fitGeneration = (session.fitGeneration || 0) + 1);
  const available = () =>
    session.fitGeneration === token &&
    !session.closed &&
    !session.hidden &&
    session.focused;
  const active = () => available() && vscode.window.activeTerminal === terminal;
  const axis = options.position === "bottom" ? "rows" : "columns";
  const target = options[axis];
  session.sizing = true;
  session.redraw();
  try {
    // Initial dimensions may arrive after createTerminal/show completes.
    for (
      let i = 0;
      i < 20 &&
      available() &&
      (!session.hasDimensions || vscode.window.activeTerminal !== terminal);
      i++
    )
      await wait(50);
    // Let docking/reopening deliver its new dimensions before using old ones.
    if (active()) await wait(100);
    if (
      !active() ||
      !session.hasDimensions ||
      session.dimensions[axis] >= target
    )
      return;
    await vscode.commands.executeCommand("workbench.action.terminal.focus");
    for (let step = 0; step < 16 && active(); step++) {
      const before = session.dimensions[axis];
      if (before >= target) break;
      await vscode.commands.executeCommand("workbench.action.increaseViewSize");
      for (
        let i = 0;
        i < 6 && active() && session.dimensions[axis] === before;
        i++
      )
        await wait(50);
      // Stop at the window limit, or if the user resized in the other direction.
      if (!active() || session.dimensions[axis] <= before) break;
    }
  } finally {
    if (session.fitGeneration === token) {
      session.sizing = false;
      session.redraw();
    }
  }
}
module.exports = { fitPanel };
