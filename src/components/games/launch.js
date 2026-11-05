// Opening the Tetris / Minesweeper screen from anywhere (a slash command, a
// race card's Play button, a result card): openGame({ game, mode, … }) and
// the GameHost in Workspace shows it.
const listeners = new Set();
export const openGame = (opts) => listeners.forEach((fn) => fn(opts));
export function onOpenGame(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Trotbot's levels, as typed (the same as funGames.js BOT_LEVELS).
const BOT_LEVELS = ['beginner', 'easy', 'medium', 'hard', 'insane'];

// What "/tetris …" or "/minesweep …" asks for, when it isn't a challenge:
// "bot insane", "expert", "sprint", "trotbot easy intermediate". In
// Minesweeper, "beginner" is both a board and a Trotbot level: with "bot"
// and no other level word it's Trotbot's level (and the board stays the
// default, Beginner); with another level word ("bot hard beginner") it's
// the board.
export function gameArgs(game, args) {
  // "tournament <id>": the market's Play button types this.
  const tour = /\btournament\s+([\w-]{1,40})/i.exec(String(args || ''));
  if (tour) return { game, mode: 'tournament', tournament: tour[1] };
  const words = String(args || '')
    .toLowerCase()
    .replace(/@/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const has = (w) => words.includes(w);
  const out = { game };
  const bot = has('bot') || has('trotbot');
  const named = BOT_LEVELS.filter((w) => w !== 'beginner').find(has);
  const botLevel = named || (has('beginner') && (game === 'tetris' || bot) ? 'beginner' : '');
  const alone = game === 'tetris' ? ['marathon', 'sprint', 'ultra'].find(has) : '';
  // A Trotbot level on its own ("/tetris insane") means racing Trotbot too.
  if (bot || (botLevel && !alone)) out.mode = 'bot';
  else if (alone) out.mode = alone;
  if (out.mode === 'bot' && botLevel) {
    out.botLevel = botLevel;
    // The old name for easy / medium / hard, for anything still reading it.
    if (botLevel !== 'beginner' && botLevel !== 'insane') out.speed = botLevel;
  }
  if (game === 'minesweep') {
    const board = ['beginner', 'intermediate', 'expert'].find(has);
    if (board) out.level = board;
    if (!out.mode && board) out.mode = 'solo';
  }
  return out;
}
