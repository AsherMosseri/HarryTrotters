// Opening the Tetris / Minesweeper screen from anywhere (a slash command, a
// race card's Play button, a result card): openGame({ game, mode, … }) and
// the GameHost in Workspace shows it.
const listeners = new Set();
export const openGame = (opts) => listeners.forEach((fn) => fn(opts));
export function onOpenGame(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// What "/tetris …" or "/minesweep …" asks for, when it isn't a challenge:
// "bot hard", "expert", "sprint", "trotbot easy intermediate".
export function gameArgs(game, args) {
  const words = String(args || '')
    .toLowerCase()
    .replace(/@/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const has = (w) => words.includes(w);
  const out = { game };
  if (has('bot') || has('trotbot')) out.mode = 'bot';
  const speed = ['easy', 'medium', 'hard'].find(has);
  if (speed) out.speed = speed;
  if (game === 'tetris') {
    const mode = ['marathon', 'sprint', 'ultra'].find(has);
    if (mode && !out.mode) out.mode = mode;
  } else {
    const level = ['beginner', 'intermediate', 'expert'].find(has);
    if (level) out.level = level;
    if (!out.mode && level) out.mode = 'solo';
  }
  return out;
}
