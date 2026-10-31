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
    return { seed: s.seed, mode, level: s.mode === 'marathon' ? s.level || 1 : 1, frames: s.mode === 'tournament' ? tetris.TOURNAMENT_FRAMES : 0 };
  }
  return { seed: s.seed, level: mines.LEVELS[s.level] ? s.level : 'beginner', kind: s.mode === 'solo' ? 'classic' : 'shared' };
}

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
export const tournamentScore = (game, r) => (game === 'tetris' ? r.score : r.won ? Math.round(r.ms / 100) / 10 : null);
export const beats = (better, score, before) => score != null && (before == null || (better === 'low' ? score < before : score > before));
export const tournamentText = (game, n) =>
  n == null ? '—' : game === 'tetris' ? `${Number(n).toLocaleString('en-US')} pts` : mines.clockText(Math.round(n * 1000));
// A tournament attempt has to finish within its game's length (plus a little)
// of starting, and start before the tournament ends.
export const tournamentGrace = (game) => (game === 'tetris' ? 5 * 60000 : 20 * 60000);

// The line a finished game shows (result cards, the end screen).
export function resultLine(game, mode, r) {
  if (game === 'tetris') {
    if (mode === 'sprint' || mode === 'bot' || mode === 'race')
      return r.finished ? `40 lines in ${mines.clockText(playedMs(game, r))}` : `${r.lines} lines (didn’t finish)`;
    return `${r.score.toLocaleString('en-US')} points · ${r.lines} lines · level ${r.level}`;
  }
  return r.won ? `Cleared ${mines.LEVELS[r.level].label} in ${mines.clockText(r.ms)}` : `Hit a mine after ${r.cells} of ${r.safe} cells`;
}
