// Score predictions (3.0, G11): before a practice run or a competition match,
// teammates guess our total score. One guess each; guesses stay hidden until
// they lock (the run starts, or the score gets logged, by the server's clock),
// and the closest guess wins coins when the score comes in.
//
// predictions/{id} (readable by the team, written only by the server):
//   { kind: 'run' | 'match', matchId, label, status: 'open' | 'locked' | 'done' | 'void',
//     openedBy, openedAt, lockAt (a match's start time), lockedAt, lockedBy,
//     guessers: [names],                 ← who guessed, shown while it's open
//     guesses: { name: score },          ← filled in when it locks
//     runId, score, winners: [names], paid: { name: coins }, note, settledAt,
//     loggedBy: [names] }                ← who logged the run: their guess can't win
// The guesses themselves wait in predictions/{id}/secret/guesses until then.
// The app and the server use this same file.

import { nameKey } from './team.js';

export const MAX_SCORE = 999;
// A practice round nobody logged a run for goes away after this long.
export const ROUND_TTL = 12 * 3600000;
// The closest guess pays WIN_COINS; spot on pays EXACT_COINS (each within the
// 'predict' daily cap). With fewer than MIN_GUESSERS guesses nobody wins, so
// guessing alone can't pay.
export const WIN_COINS = 10;
export const EXACT_COINS = 20;
export const MIN_GUESSERS = 2;

export const runTotal = (r) => (Number(r?.auto) || 0) + (Number(r?.teleop) || 0) + (Number(r?.endgame) || 0);
export const matchRoundId = (matchId) => `match-${matchId}`;
export const isLive = (round) => round && (round.status === 'open' || round.status === 'locked');

// A guess as a whole number in range, or null.
export function cleanScore(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : null;
}

// Why this guess can't be taken (or '' if it can). round: the public doc
// (null for a match nobody has guessed on yet); match: the match, for match rounds.
export function guessProblem(round, me, now, match = null) {
  if (match) {
    if (match.ours) return 'That match is already scored.';
    if (!match.time) return 'That match has no start time yet.';
    if (now >= match.time) return 'Guesses locked when the match started.';
  }
  if (round) {
    if (round.status === 'done' || round.status === 'void') return 'That one’s over.';
    if (round.status === 'locked' || (round.lockAt && now >= round.lockAt)) return 'Guesses are locked: the run started.';
    if ((round.guessers || []).includes(me)) return 'You already guessed. One guess each.';
  }
  return '';
}

// Who wins: the closest guesses made before `before` (ms; the run's log
// time), all of them on a tie. guesses: { name: { score, at } }. out: names
// that can't win (whoever logged the run: they could type in their own
// guess); their guess still shows, and the rest settle as if it weren't there.
export function settle(guesses, score, before = Infinity, out = []) {
  const made = Object.entries(guesses || {}).filter(([, g]) => cleanScore(g?.score) !== null && (g.at || 0) <= before);
  const shown = Object.fromEntries(made.map(([n, g]) => [n, g.score]));
  const valid = made.filter(([n]) => !out.includes(n));
  if (valid.length < MIN_GUESSERS) return { guesses: shown, winners: [], off: null, pays: {} };
  const off = Math.min(...valid.map(([, g]) => Math.abs(g.score - score)));
  const winners = valid.filter(([, g]) => Math.abs(g.score - score) === off).map(([n]) => n);
  const each = off === 0 ? EXACT_COINS : WIN_COINS;
  return { guesses: shown, winners, off, pays: Object.fromEntries(winners.map((n) => [n, each])) };
}

// The one-time award key for a round's win.
export const predictKey = (roundId, name) => `predict-${roundId}-${nameKey(name)}`;

// "Cooper was closest with 92", "Cooper and Mia tied at 92", "Spot on: Cooper guessed 95".
export function winnerLine(round) {
  const w = round?.winners || [];
  if (round?.status !== 'done') return '';
  const counted = Object.keys(round.guesses || {}).filter((n) => !(round.loggedBy || []).includes(n));
  if (!w.length) return counted.length < MIN_GUESSERS ? 'Not enough guesses to pay out.' : '';
  const first = (n) => n.split(' ')[0];
  const g = round.guesses?.[w[0]];
  const names = w.length === 1 ? first(w[0]) : w.length === 2 ? `${first(w[0])} and ${first(w[1])}` : `${w.length} people`;
  if (g === round.score) return `Spot on: ${names} guessed ${g}`;
  return w.length === 1 ? `${names} was closest with ${g}` : `${names} tied, ${Math.abs(g - round.score)} off`;
}
