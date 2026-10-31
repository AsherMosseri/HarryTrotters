// Tetris and Minesweeper outside the board itself: the ways to play, what
// each pays, who wins a race, tournament scores, and the checks a finished
// game has to pass. The server (functions/index.js funGame and
// submitTournamentScore) runs these; demo mode runs the same file.
//
// A game is a "session": the server hands out the seed when you start, and
// you send back your moves when you finish. The server replays them, so the
// score is whatever the moves really scored, never a number from the app.

import * as tetris from './tetris.js';
import * as mines from './minesweeper.js';

export const GAMES = ['tetris', 'minesweep'];
export const GAME_LABEL = { tetris: 'Tetris', minesweep: 'Minesweeper' };
export const SPEEDS = ['easy', 'medium', 'hard'];

// Ways to play. Races and tournaments use a shared seed; the rest get a fresh one.
export const MODES = {
  tetris: {
    marathon: 'Marathon',
    sprint: 'Sprint (40 lines)',
    ultra: 'Ultra (2 minutes)',
    bot: 'Race Trotbot (40 lines)',
    race: 'Race (40 lines)',
    tournament: 'Tournament (3 minutes)',
  },
  minesweep: {
    solo: 'Solo',
    bot: 'Race Trotbot',
    race: 'Race',
    tournament: 'Tournament',
  },
};
export const COMPETITIVE = ['bot', 'race', 'tournament'];
export const TOURNAMENT_LEVEL = 'intermediate';

// How long a race can go before whoever hasn't finished is out (ms, from the start).
export const RACE_LIMIT = { tetris: 6 * 60000, beginner: 4 * 60000, intermediate: 8 * 60000, expert: 15 * 60000 };
export const raceLimit = (game, level) => (game === 'tetris' ? RACE_LIMIT.tetris : RACE_LIMIT[level] || RACE_LIMIT.beginner);
export const RACE_COUNTDOWN = 5000;
export const RACE_PRIZE = 3;

// The settings a session is played with (what newGame and replay take).
export function gameOpts(s) {
  if (s.game === 'tetris') {
    const mode = s.mode === 'marathon' ? 'marathon' : s.mode === 'ultra' || s.mode === 'tournament' ? 'ultra' : 'sprint';
    return {
      seed: s.seed,
      mode,
      level: s.mode === 'marathon' ? s.level || 1 : 1,
      frames: s.mode === 'tournament' ? tetris.TOURNAMENT_FRAMES : 0,
    };
  }
  // Tournament boards are played on the server (see serverRun), each player
  // on their own, so the first tap can be the safe one, like playing alone.
  return {
    seed: s.seed,
    level: mines.LEVELS[s.level] ? s.level : 'beginner',
    kind: s.mode === 'solo' || s.mode === 'tournament' ? 'classic' : 'shared',
  };
}

// A Minesweeper tournament game never leaves the server: the phone sends
// each tap and gets back only what it opened (funGame 'sweep'), so there's
// no board or seed on the phone to work a perfect game out from.
export const serverRun = (s) => s.game === 'minesweep' && s.mode === 'tournament';

export function replayGame(s, moves) {
  return s.game === 'tetris' ? tetris.replay(gameOpts(s), moves) : mines.replay(gameOpts(s), moves);
}

// Trotbot's whole game on the session's seed (races against Trotbot).
export function botResult(s) {
  if (s.game === 'tetris') return tetris.newBot({ seed: s.seed, pace: tetris.BOT_PACE[s.speed] || tetris.BOT_PACE.medium }).result();
  return mines.newBot({ seed: s.seed, level: gameOpts(s).level, pace: mines.BOT_PACE[s.speed] || mines.BOT_PACE.medium }).result();
}

// How long a finished game says it took, in ms.
export const playedMs = (game, r) => (game === 'tetris' ? Math.round((r.frames * 1000) / tetris.FPS) : r.ms);

// The clock in a game can't run faster than real time, and in anything
// against someone (a race, Trotbot, a tournament) it can't be paused or run
// in slow motion either: the time between starting and finishing has to
// match the game's own clock, give or take the network and a phone call.
export function timingProblem(s, r, elapsed) {
  const played = playedMs(s.game, r);
  if (played > elapsed + 5000) return 'That game’s clock ran faster than real time.';
  if (COMPETITIVE.includes(s.mode) && elapsed > played * 1.25 + 60000) return 'That game was paused too long to count.';
  return '';
}

// Is the result a win against Trotbot? (Who finished first, by the game's clock.)
export function beatBot(game, me, bot) {
  return rank(game, me, bot) > 0;
}
// > 0 if a did better than b, < 0 if worse, 0 for a tie. A missing result
// (didn't finish in time) loses to any result.
export function rank(game, a, b) {
  if (!a || !b) return a ? 1 : b ? -1 : 0;
  if (game === 'tetris') {
    if (a.finished !== b.finished) return a.finished ? 1 : -1;
    if (a.finished) return b.frames - a.frames;
    return a.lines - b.lines;
  }
  if (a.won !== b.won) return a.won ? 1 : -1;
  if (a.won) return b.ms - a.ms;
  return a.cells - b.cells;
}

// Coins for a finished game (playing alone or against Trotbot). Races pay
// RACE_PRIZE to the winner; tournaments pay their pot. All under the
// 'game' daily cap (AWARD_CAPS in coins.js).
const MS_WIN = { beginner: 0, intermediate: 2, expert: 5 };
const BOT_BONUS = { easy: 1, medium: 2, hard: 4 };
export function coinsFor(s, r, won = false) {
  if (s.game === 'tetris') {
    if (s.mode === 'marathon') return Math.min(4, Math.floor(r.lines / 20));
    if (s.mode === 'ultra') return Math.min(3, Math.floor(r.score / 10000));
    if (s.mode === 'sprint') return r.finished ? 2 : 0;
    if (s.mode === 'bot') return won ? BOT_BONUS[s.speed] || 2 : 0;
    return 0;
  }
  const level = gameOpts(s).level;
  if (s.mode === 'solo') return r.won ? MS_WIN[level] : 0;
  if (s.mode === 'bot') return won ? MS_WIN[level] + (BOT_BONUS[s.speed] || 2) - (level === 'beginner' ? 1 : 0) : 0;
  return 0;
}

// Tournaments (the market's tournaments/{id}) call Minesweeper "minesweeper"
// and say which way a score is better: Tetris by points (high), Minesweeper
// by seconds to clear the board (low; a game that hits a mine has no time).
export const tourGame = (game) => (game === 'minesweep' ? 'minesweeper' : game);
export const gameOfTour = (t) => (t?.game === 'minesweeper' ? 'minesweep' : t?.game);
export const betterOf = (t) => t?.better || (gameOfTour(t) === 'minesweep' ? 'low' : 'high');
// Seconds to a tenth, cut off the way the game clock shows them (clockText).
export const tournamentScore = (game, r) => (game === 'tetris' ? r.score : r.won ? Math.floor(r.ms / 100) / 10 : null);
export const beats = (better, score, before) => score != null && (before == null || (better === 'low' ? score < before : score > before));
export const tournamentText = (game, n) =>
  n == null ? '—' : game === 'tetris' ? `${Number(n).toLocaleString('en-US')} pts` : mines.clockText(Math.round(n * 1000));
// A tournament attempt has to finish within its game's length (plus a little)
// of starting, and start before the tournament ends.
export const tournamentGrace = (game) => (game === 'tetris' ? 5 * 60000 : 20 * 60000);

// ---------- runs held for review (Tetris tournaments) ----------
// The replay proves the moves are legal, not that a person made them. A
// tournament run whose timing no person could manage is saved but held for
// team management to look at, and doesn't count until they clear it. Every
// limit is far past the fastest human play, so a real player never trips one:
// - Pieces: more than 6 a second over any 10 seconds, or 4.5 a second over a
//   whole run of 60+ pieces. The best keyboard players in the world average
//   3 to 4 a second with instant key repeat; this game's key repeat is fixed
//   (10 frames, then every 2), and thumbs on a phone are slower still.
// - Taps (turns, hard drops, holds: keys that never repeat on their own):
//   more than 100 in any 5 seconds, 20 a second. People top out around 15 a
//   second on one button, and only for a burst.
// - Rhythm: with 40+ pieces hard-dropped, the time between pieces barely
//   varies (spread under a tenth of the average), or over half of them take
//   the exact same number of frames. A person's pieces take very different
//   times (an O drops straight in, a T-spin takes setting up); a script's don't.
export const REVIEW = {
  pieceWindow: 10 * tetris.FPS,
  piecesInWindow: 60,
  piecesPerSecond: 4.5,
  piecesForAverage: 60,
  tapWindow: 5 * tetris.FPS,
  tapsInWindow: 100,
  steadyPieces: 40,
  steadySpread: 0.1,
  sameGapShare: 0.5,
};
// The most of `frames` (sorted) that fall in any `span` frames.
function busiest(frames, span) {
  let most = 0;
  for (let a = 0, b = 0; b < frames.length; b++) {
    while (frames[b] - frames[a] >= span) a++;
    most = Math.max(most, b - a + 1);
  }
  return most;
}
// Why a Tetris tournament run needs a look (or '' if it doesn't). moves: what
// replay already accepted.
export function reviewReason(s, moves) {
  if (s.game !== 'tetris') return '';
  const R = REVIEW;
  const { locks, taps, frames } = tetris.timeline(gameOpts(s), moves);
  const lockFrames = locks.map((l) => l.frame);
  if (busiest(lockFrames, R.pieceWindow) > R.piecesInWindow) return 'Pieces placed faster than anyone can play.';
  if (locks.length >= R.piecesForAverage && locks.length / (frames / tetris.FPS) > R.piecesPerSecond)
    return 'Pieces placed faster than anyone can play.';
  if (busiest(taps, R.tapWindow) > R.tapsInWindow) return 'Taps faster than anyone can tap.';
  const gaps = [];
  for (let k = 1; k < locks.length; k++) if (locks[k].hard) gaps.push(locks[k].frame - locks[k - 1].frame);
  if (gaps.length >= R.steadyPieces) {
    const mean = gaps.reduce((t, x) => t + x, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((t, x) => t + (x - mean) ** 2, 0) / gaps.length);
    const counts = new Map();
    for (const x of gaps) counts.set(x, (counts.get(x) || 0) + 1);
    const same = Math.max(...counts.values()) / gaps.length;
    if (sd < R.steadySpread * mean || same > R.sameGapShare) return 'Every piece took about the same time, like a script.';
  }
  return '';
}

// The line a finished game shows (result cards, the end screen).
export function resultLine(game, mode, r) {
  if (game === 'tetris') {
    if (mode === 'sprint' || mode === 'bot' || mode === 'race')
      return r.finished ? `40 lines in ${mines.clockText(playedMs(game, r))}` : `${r.lines} lines (didn’t finish)`;
    return `${r.score.toLocaleString('en-US')} points · ${r.lines} lines · level ${r.level}`;
  }
  return r.won ? `Cleared ${mines.LEVELS[r.level].label} in ${mines.clockText(r.ms)}` : `Hit a mine after ${r.cells} of ${r.safe} cells`;
}
