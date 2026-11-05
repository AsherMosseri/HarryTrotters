// Minesweeper: the rules, run the same way on a phone and on the server. The
// board comes from a seed, and a game is the list of [ms, action, cell] the
// player made, so the server replays it to check a win before it pays coins
// or counts it in a tournament.
//
// Two kinds of board:
//   'classic' (playing alone): mines are placed after your first tap, never
//     on it or next to it, so the first tap is always safe and opens an area.
//   'shared' (races, Trotbot): everyone gets the same board, so it can't
//     depend on where someone taps first. It opens itself at the same spot
//     for everyone (a cell with no mines around it).
// Tournaments are 'classic' boards played on the server (serverTurn), so the
// phone never has the board.

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

// ---------- played on the server (tournaments) ----------
// A tournament board never leaves the server: the phone sends its taps and
// gets back only the cells they opened. log: the server's [ms, action, cell]
// list so far (what replay takes; only taps that did something). acts: the
// new taps, [[action, cell], …]. ms: the server's clock since the first
// reveal. Returns the new log, the cells that opened as [cell, number]
// (-1 for the mine that went off), and once it's over, where the mines were.
export function serverTurn(opts, log, acts, ms) {
  const g = newGame(opts);
  for (let k = 0; k < log.length; k += 3) act(g, log[k + 1], log[k + 2], log[k]);
  const before = g.state.slice();
  const out = log.slice();
  for (const [kind, i] of acts) {
    if (isDone(g) || out.length >= MAX_ACTIONS * 3) break;
    if (act(g, kind, i, ms)) out.push(ms, kind, i);
  }
  const open = [];
  for (let i = 0; i < g.w * g.h; i++) if (g.state[i] === OPEN && before[i] !== OPEN) open.push([i, g.numbers[i]]);
  const done = isDone(g);
  return {
    log: out,
    open,
    done,
    won: g.won,
    lost: g.lost,
    boom: g.boom,
    full: out.length >= MAX_ACTIONS * 3,
    mines: done ? g.mines.flatMap((m, i) => (m ? [i] : [])) : null,
    game: g,
  };
}
// Every open cell so far, for a phone that missed an answer (see serverTurn).
export const openCells = (g) => g.state.flatMap((s, i) => (s === OPEN ? [[i, g.numbers[i]]] : []));

// ---------- Trotbot ----------

// What Trotbot can work out from the open numbers: { safe: [cells], mines: [cells] }.
// Each number says how many of its hidden neighbors are mines; where one
// number's hidden cells are inside another's, the difference is known too
// (unless subset is false: the lower levels only see one number at a time).
export function deduce(g, known = new Set(), { subset = true } = {}) {
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
  if (subset && !safe.size && !mines.size)
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

// Every way the mines could lie around the open numbers (each group of
// touching cells worked through on its own, up to LAYOUT_LIMIT steps): the
// cells that are safe in every layout, the ones that are a mine in every
// layout, and how often each is a mine, as [mines, layouts]. A group with
// too many layouts to count is left out.
const LAYOUT_LIMIT = 40000;
export function layouts(g, known) {
  const { cons } = deduce(g, known, { subset: false });
  const touch = new Map();
  cons.forEach((c, k) => c.cells.forEach((n) => (touch.has(n) ? touch.get(n).push(k) : touch.set(n, [k]))));
  const cells = [...touch.keys()].sort((a, b) => a - b);
  const done = new Set();
  const safe = [];
  const mines = [];
  const odds = new Map();
  for (const first of cells) {
    if (done.has(first)) continue;
    // One group: the cells linked to `first` through shared numbers, in the
    // order they're reached (so each step checks numbers it just touched).
    const group = [first];
    done.add(first);
    for (let k = 0; k < group.length; k++)
      for (const ci of touch.get(group[k]))
        for (const n of cons[ci].cells)
          if (!done.has(n)) {
            done.add(n);
            group.push(n);
          }
    const ks = [...new Set(group.flatMap((n) => touch.get(n)))];
    const placed = new Map(ks.map((k) => [k, 0]));
    const left = new Map(ks.map((k) => [k, cons[k].cells.length]));
    const mine = new Array(group.length).fill(0);
    const count = new Array(group.length).fill(0);
    let total = 0;
    let steps = 0;
    const ok = (n) => touch.get(n).every((k) => placed.get(k) <= cons[k].mines && placed.get(k) + left.get(k) >= cons[k].mines);
    const walk = (d) => {
      if (++steps > LAYOUT_LIMIT) return;
      if (d === group.length) {
        total++;
        for (let j = 0; j < group.length; j++) count[j] += mine[j];
        return;
      }
      const n = group[d];
      for (const m of [0, 1]) {
        mine[d] = m;
        for (const k of touch.get(n)) {
          left.set(k, left.get(k) - 1);
          placed.set(k, placed.get(k) + m);
        }
        if (ok(n)) walk(d + 1);
        for (const k of touch.get(n)) {
          left.set(k, left.get(k) + 1);
          placed.set(k, placed.get(k) - m);
        }
      }
      mine[d] = 0;
    };
    walk(0);
    if (steps > LAYOUT_LIMIT || !total) continue;
    group.forEach((n, j) => {
      odds.set(n, [count[j], total]);
      if (count[j] === 0) safe.push(n);
      else if (count[j] === total) mines.push(n);
    });
  }
  return { safe: safe.sort((a, b) => a - b), mines: mines.sort((a, b) => a - b), odds, cons };
}

// The safest cell to guess by every layout (layouts' odds next to the open
// numbers; the board's leftover mines spread over the cells away from them),
// as whole numbers per 1000, ties broken by the seed.
function bestGuess(g, known, rng) {
  const { odds, cons } = layouts(g, known);
  const hidden = [];
  for (let i = 0; i < g.w * g.h; i++) if (g.state[i] === HIDDEN && !known.has(i)) hidden.push(i);
  if (!hidden.length) return -1;
  const near = new Set(cons.flatMap((c) => c.cells));
  const p = new Map();
  let expected = 0;
  for (const i of hidden) {
    if (odds.has(i)) {
      const [m, t] = odds.get(i);
      p.set(i, Math.floor((1000 * m) / t));
      expected += Math.floor((1000 * m) / t);
    } else if (near.has(i)) {
      // A group too big to count: the plain odds from the numbers next to it.
      let worst = 0;
      for (const c of cons) if (c.cells.includes(i)) worst = Math.max(worst, Math.floor((1000 * c.mines) / c.cells.length));
      p.set(i, worst);
      expected += worst;
    }
  }
  const away = hidden.filter((i) => !p.has(i));
  const rest = Math.max(0, 1000 * (g.count - known.size) - expected);
  for (const i of away) p.set(i, Math.floor(rest / away.length));
  let best = Infinity;
  let pick = [];
  for (const i of hidden) {
    const v = p.get(i);
    if (v < best) {
      best = v;
      pick = [i];
    } else if (v === best) pick.push(i);
  }
  return pick[rng.int(pick.length)];
}

// Trotbot's speed before 3.1.1: ms per tap, every tap as good as it can work
// out. Games started then (and apps that still send 'easy', 'medium' or
// 'hard' with no level) keep playing exactly this way.
export const BOT_PACE = { easy: 1500, medium: 900, hard: 500 };

// Trotbot's levels (3.1.1): each one plays at its own speed AND its own skill.
//   pace: ms per tap on average, give or take `jitter`;
//   think: per-1000 chance of a long, hesitant pause (up to thinkMs more);
//   logic: what it can work out: 'single' (one number at a time), 'subset'
//     (one number's cells inside another's), 'full' (every way the mines
//     could lie around the open numbers);
//   guess: when nothing is sure: 'odds' (the least likely by the numbers
//     next to it) or 'best' (the safest, by every layout);
//   flags: per-1000 of the mines it finds that it stops to flag (a tap each);
//   misflag: per-1000 chance of a misclick, a flag on a cell it wasn't sure
//     of, which it then stops and takes back (two taps and a pause);
//   rash: per-1000 chance it opens a cell it hasn't worked out yet, which
//     can be a mine (Beginner only).
export const BOT_SKILL = {
  beginner: { pace: 1700, jitter: 600, think: 150, thinkMs: 4500, logic: 'single', guess: 'odds', flags: 1000, misflag: 90, rash: 4 },
  easy: { pace: 1150, jitter: 400, think: 100, thinkMs: 3500, logic: 'subset', guess: 'odds', flags: 1000, misflag: 50, rash: 0 },
  medium: { pace: 800, jitter: 280, think: 60, thinkMs: 2500, logic: 'subset', guess: 'odds', flags: 500, misflag: 25, rash: 0 },
  hard: { pace: 560, jitter: 160, think: 30, thinkMs: 1500, logic: 'full', guess: 'best', flags: 0, misflag: 10, rash: 0 },
  insane: { pace: 380, jitter: 90, think: 0, thinkMs: 0, logic: 'full', guess: 'best', flags: 0, misflag: 0, rash: 0 },
};

// Trotbot at a level (BOT_SKILL), on the same shared board. Its pauses,
// misclicks and guesses come from a generator seeded by the game's seed and
// the level (never Math.random), so the phone's live picture and the
// server's replay are the same game.
function levelBot(seed, level, skill, S) {
  const g = newGame({ seed, level, kind: 'shared' });
  const rng = seeded(`${seed}|trotbot|${skill}`);
  const known = new Set();
  let queue = []; // cells it has worked out are safe, to open
  let flagging = []; // mines it found and will flag
  let undo = -1; // a wrong flag to take back
  let taps = 0;
  const delay = () => {
    let d = S.pace - S.jitter + rng.int(2 * S.jitter + 1);
    if (S.think && rng.int(1000) < S.think) d += Math.floor(S.thinkMs / 3) + rng.int(S.thinkMs);
    // Noticing a misclick takes a moment.
    if (undo >= 0) d += S.pace;
    return Math.max(120, d);
  };
  const learn = (i) => {
    if (known.has(i)) return;
    known.add(i);
    if (S.flags && rng.int(1000) < S.flags) flagging.push(i);
  };
  // A hidden cell next to an open number that it hasn't worked out (for a
  // misclick or a rash tap), or -1.
  const unsure = () => {
    const out = [];
    for (let i = 0; i < g.w * g.h; i++)
      if (g.state[i] === HIDDEN && !known.has(i) && !queue.includes(i) && neighbors(g.w, g.h, i).some((n) => g.state[n] === OPEN)) out.push(i);
    return out.length ? out[rng.int(out.length)] : -1;
  };
  const plan = () => {
    for (let round = 0; round < 4 && !queue.length; round++) {
      const d = deduce(g, known, { subset: S.logic !== 'single' });
      d.mines.forEach(learn);
      queue = d.safe.filter((i) => g.state[i] === HIDDEN && !known.has(i));
      if (!d.mines.length) break;
    }
    if (!queue.length && S.logic === 'full') {
      const e = layouts(g, known);
      e.mines.forEach(learn);
      queue = e.safe.filter((i) => g.state[i] === HIDDEN && !known.has(i));
    }
    if (queue.length) return;
    const i = S.guess === 'best' ? bestGuess(g, known, rng) : guess(g, known, deduce(g, known).cons, rng);
    if (i >= 0) queue = [i];
  };
  // One tap at `at` ms. false: nothing left to do.
  const tap = (at) => {
    if (undo >= 0) {
      act(g, ACT.flag, undo, at);
      undo = -1;
      return true;
    }
    flagging = flagging.filter((i) => g.state[i] === HIDDEN);
    if (flagging.length) return act(g, ACT.flag, flagging.shift(), at);
    queue = queue.filter((i) => g.state[i] === HIDDEN);
    if (!queue.length) plan();
    if (!queue.length) return false;
    if (S.misflag && rng.int(1000) < S.misflag) {
      const i = unsure();
      if (i >= 0) {
        act(g, ACT.flag, i, at);
        undo = i;
        return true;
      }
    }
    if (S.rash && rng.int(1000) < S.rash) {
      const i = unsure();
      if (i >= 0) return act(g, ACT.reveal, i, at);
    }
    return act(g, ACT.reveal, queue.shift(), at);
  };
  let at = delay();
  const advance = (ms) => {
    while (!isDone(g) && at <= ms && at <= MAX_MS && taps < MAX_ACTIONS) {
      taps++;
      if (!tap(at)) {
        at = Infinity;
        break;
      }
      at += delay();
    }
    return g;
  };
  return { game: g, known, level: skill, advance, result: () => summary(advance(MAX_MS)) };
}

// Trotbot plays the same shared board. With a `skill` (BOT_SKILL's levels)
// it plays at that level; without one (games from before 3.1.1), one tap
// every `pace` ms (marking mines in its head costs nothing). advance(ms)
// plays up to that time.
export function newBot({ seed, level, pace = BOT_PACE.medium, skill = '' }) {
  const S = BOT_SKILL[skill];
  if (S) return levelBot(seed, level, skill, S);
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
