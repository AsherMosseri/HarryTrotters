// Minesweeper: the rules, run the same way on a phone and on the server. The
// board comes from a seed, and a game is the list of [ms, action, cell] the
// player made, so the server replays it to check a win before it pays coins
// or counts it in a tournament.
//
// Two kinds of board:
//   'classic' (playing alone): mines are placed after your first tap, never
//     on it or next to it, so the first tap is always safe and opens an area.
//   'shared' (races, Trotbot, tournaments): everyone gets the same board,
//     so it can't depend on where someone taps first. It opens itself at the
//     same spot for everyone (a cell with no mines around it).

import { seeded } from './rng.js';

export const LEVELS = {
  beginner: { w: 9, h: 9, mines: 10, label: 'Beginner' },
  intermediate: { w: 16, h: 16, mines: 40, label: 'Intermediate' },
  expert: { w: 30, h: 16, mines: 99, label: 'Expert' },
};
export const ACT = { reveal: 0, flag: 1, chord: 2 };
export const MAX_MS = 60 * 60 * 1000;
export const MAX_ACTIONS = 5000;
const HIDDEN = 0;
const OPEN = 1;
const FLAG = 2;

export function neighbors(w, h, i) {
  const x = i % w;
  const y = (i - x) / w;
  const out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push(ny * w + nx);
    }
  return out;
}

// Mines anywhere except `keep` (cells), chosen by the seed.
function placeMines(rng, w, h, count, keep) {
  const banned = new Set(keep);
  const spots = [];
  for (let i = 0; i < w * h; i++) if (!banned.has(i)) spots.push(i);
  const mines = new Array(w * h).fill(false);
  for (let k = 0; k < count && k < spots.length; k++) {
    const j = k + rng.int(spots.length - k);
    [spots[k], spots[j]] = [spots[j], spots[k]];
    mines[spots[k]] = true;
  }
  return mines;
}

export function newGame({ seed, level = 'beginner', kind = 'classic' }) {
  const L = LEVELS[level] || LEVELS.beginner;
  const g = {
    level: LEVELS[level] ? level : 'beginner',
    kind,
    w: L.w,
    h: L.h,
    count: L.mines,
    rng: seeded(`${seed}|${level}`),
    mines: null,
    numbers: null,
    state: new Array(L.w * L.h).fill(HIDDEN),
    opened: 0,
    flags: 0,
    won: false,
    lost: false,
    boom: -1,
    ms: 0,
    start: -1,
  };
  if (kind === 'shared') {
    const start = g.rng.int(g.w * g.h);
    setMines(g, placeMines(g.rng, g.w, g.h, g.count, [start, ...neighbors(g.w, g.h, start)]));
    g.start = start;
    open(g, start);
  }
  return g;
}

function setMines(g, mines) {
  g.mines = mines;
  g.numbers = mines.map((m, i) => (m ? -1 : neighbors(g.w, g.h, i).filter((n) => mines[n]).length));
}

export const isDone = (g) => g.won || g.lost;
export const safeCells = (g) => g.w * g.h - g.count;
export const isOpen = (g, i) => g.state[i] === OPEN;
export const isFlag = (g, i) => g.state[i] === FLAG;

// Opens a cell (and the area around a 0). Returns false on a mine.
function open(g, i) {
  if (g.state[i] !== HIDDEN) return true;
  if (g.mines[i]) {
    g.state[i] = OPEN;
    g.lost = true;
    g.boom = i;
    return false;
  }
  const stack = [i];
  while (stack.length) {
    const c = stack.pop();
    if (g.state[c] !== HIDDEN) continue;
    g.state[c] = OPEN;
    g.opened++;
    if (g.numbers[c] === 0) for (const n of neighbors(g.w, g.h, c)) if (g.state[n] === HIDDEN) stack.push(n);
  }
  if (g.opened === safeCells(g)) g.won = true;
  return true;
}

// One action at ms (since the board showed). Returns true if it did something.
export function act(g, kind, i, ms = 0) {
  if (isDone(g) || !(i >= 0 && i < g.w * g.h)) return false;
  g.ms = ms;
  if (kind === ACT.flag) {
    if (g.state[i] === OPEN || !g.mines) return false;
    g.state[i] = g.state[i] === FLAG ? HIDDEN : FLAG;
    g.flags += g.state[i] === FLAG ? 1 : -1;
    return true;
  }
  if (kind === ACT.reveal) {
    if (g.state[i] !== HIDDEN) return false;
    // The first tap of a classic game: now the mines go in, away from it.
    if (!g.mines) setMines(g, placeMines(g.rng, g.w, g.h, g.count, [i, ...neighbors(g.w, g.h, i)]));
    open(g, i);
    return true;
  }
  if (kind === ACT.chord) {
    // Tapping an open number with that many flags around it opens the rest.
    if (g.state[i] !== OPEN || !(g.numbers[i] > 0)) return false;
    const around = neighbors(g.w, g.h, i);
    if (around.filter((n) => g.state[n] === FLAG).length !== g.numbers[i]) return false;
    const hidden = around.filter((n) => g.state[n] === HIDDEN);
    if (!hidden.length) return false;
    for (const n of hidden) if (!open(g, n)) break;
    return true;
  }
  return false;
}

export function summary(g) {
  return { won: g.won, lost: g.lost, ms: g.ms, cells: g.opened, safe: safeCells(g), level: g.level };
}

// The number a tournament ranks by (higher is better): any win beats any
// loss, and a faster win beats a slower one; a loss counts the cells opened.
export const WIN_BASE = 10000000;
export const scoreOf = (s) => (s.won ? WIN_BASE - Math.min(WIN_BASE - 1000, s.ms) : s.cells);
export function scoreText(score) {
  if (score > 1000000) return clockText(WIN_BASE - score);
  return `${score} cells (no finish)`;
}
export function clockText(ms) {
  const s = Math.floor(ms / 100) / 10;
  const m = Math.floor(s / 60);
  return m ? `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)} s`;
}

// moves: a flat list [ms, action, cell, …] with ms never going back. Returns
// { error } or the summary. Someone can't tap faster than about 15 times a
// second all game, so a list that does is turned down.
export function replay(opts, moves) {
  if (!Array.isArray(moves) || moves.length % 3 || moves.length > MAX_ACTIONS * 3) return { error: 'Those moves don’t look right.' };
  const g = newGame(opts);
  let taps = 0;
  for (let k = 0; k < moves.length; k += 3) {
    const [ms, kind, i] = [moves[k], moves[k + 1], moves[k + 2]];
    if (!Number.isInteger(ms) || ms < 0 || ms > MAX_MS || (k && ms < moves[k - 3])) return { error: 'Those moves don’t look right.' };
    if (![0, 1, 2].includes(kind) || !Number.isInteger(i) || i < 0 || i >= g.w * g.h) return { error: 'Those moves don’t look right.' };
    if (isDone(g)) break;
    act(g, kind, i, ms);
    taps++;
  }
  if (taps > 3 && g.ms < taps * 60) return { error: 'That was faster than anyone can tap.' };
  return summary(g);
}

// ---------- Trotbot ----------

// What Trotbot can work out from the open numbers: { safe: [cells], mines: [cells] }.
// Each number says how many of its hidden neighbors are mines; where one
// number's hidden cells are inside another's, the difference is known too.
export function deduce(g, known = new Set()) {
  const cons = [];
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.state[i] !== OPEN || !(g.numbers[i] > 0)) continue;
    const around = neighbors(g.w, g.h, i);
    const cells = around.filter((n) => g.state[n] !== OPEN && !known.has(n));
    if (!cells.length) continue;
    const mines = g.numbers[i] - around.filter((n) => known.has(n)).length;
    cons.push({ cells, mines });
  }
  const safe = new Set();
  const mines = new Set();
  for (const c of cons) {
    if (c.mines === 0) c.cells.forEach((n) => safe.add(n));
    else if (c.mines === c.cells.length) c.cells.forEach((n) => mines.add(n));
  }
  if (!safe.size && !mines.size)
    for (const a of cons)
      for (const b of cons) {
        if (a === b || a.cells.length >= b.cells.length) continue;
        if (!a.cells.every((n) => b.cells.includes(n))) continue;
        const diff = b.cells.filter((n) => !a.cells.includes(n));
        const left = b.mines - a.mines;
        if (left === 0) diff.forEach((n) => safe.add(n));
        else if (left === diff.length) diff.forEach((n) => mines.add(n));
      }
  return { safe: [...safe].sort((x, y) => x - y), mines: [...mines], cons };
}

// No sure thing: the hidden cell least likely to be a mine (by the numbers
// around it, or the board's leftover density), ties broken by the seed.
function guess(g, known, cons, rng) {
  const hidden = [];
  for (let i = 0; i < g.w * g.h; i++) if (g.state[i] !== OPEN && !known.has(i)) hidden.push(i);
  if (!hidden.length) return -1;
  // Odds as whole numbers (per 1000) so every device picks the same cell.
  const odds = new Map();
  for (const c of cons) {
    const p = Math.floor((1000 * c.mines) / c.cells.length);
    for (const n of c.cells) odds.set(n, Math.max(odds.get(n) ?? 0, p));
  }
  const left = Math.max(0, g.count - known.size);
  const base = Math.floor((1000 * left) / hidden.length);
  let best = Infinity;
  let pick = [];
  for (const i of hidden) {
    const p = odds.get(i) ?? base;
    if (p < best) {
      best = p;
      pick = [i];
    } else if (p === best) pick.push(i);
  }
  return pick[rng.int(pick.length)];
}

// Trotbot's speed: ms per tap.
export const BOT_PACE = { easy: 1500, medium: 900, hard: 500 };

// Trotbot plays the same shared board, one tap every `pace` ms (marking
// mines in its head costs nothing). advance(ms) plays up to that time.
export function newBot({ seed, level, pace = BOT_PACE.medium }) {
  const g = newGame({ seed, level, kind: 'shared' });
  const rng = seeded(`${seed}|bot`);
  const known = new Set();
  let queue = [];
  let taps = 0;
  const advance = (ms) => {
    while (!isDone(g) && (taps + 1) * pace <= ms) {
      queue = queue.filter((i) => g.state[i] === HIDDEN);
      if (!queue.length) {
        const d = deduce(g, known);
        d.mines.forEach((i) => known.add(i));
        queue = d.safe.filter((i) => !known.has(i));
        // Learning more mines can make more cells safe right away.
        if (!queue.length && d.mines.length) queue = deduce(g, known).safe;
        if (!queue.length) {
          const i = guess(g, known, deduce(g, known).cons, rng);
          if (i < 0) break;
          queue = [i];
        }
      }
      taps++;
      act(g, ACT.reveal, queue.shift(), taps * pace);
    }
    return g;
  };
  return { game: g, known, advance, result: () => summary(advance(MAX_MS)) };
}
