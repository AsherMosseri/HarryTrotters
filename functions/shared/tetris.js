// Tetris: the rules, run the same way on a phone and on the server. The game
// moves in frames (60 a second) and only changes on an input or a frame, so
// a seed plus the list of [frame, input] pairs replays to the exact same
// board and score. That's how the server checks a score before it pays coins
// or counts it in a tournament (it never trusts a number the app sends).
//
// Guideline rules: SRS rotation with wall kicks, a 7-piece bag, hold, a next
// queue, half a second of lock delay (15 moves to reset it), T-spins (three
// corners), back-to-back and combos. Integer math only, so every device gets
// the same result.

import { seeded } from './rng.js';

export const W = 10;
export const H = 24; // rows 0-3 are above the visible field
export const HIDDEN = 4;
export const PIECES = ' IJLOSTZ'; // 1-7, the number stored on the board
export const FPS = 60;
export const LOCK_FRAMES = 30;
export const MAX_RESETS = 15;
export const SPRINT_LINES = 40;
export const ULTRA_FRAMES = 2 * 60 * FPS; // 2 minutes
export const TOURNAMENT_FRAMES = 3 * 60 * FPS; // a tournament is a 3-minute Ultra
export const MAX_FRAMES = 40 * 60 * FPS; // nobody plays one game for 40 minutes
export const MAX_INPUTS = 60000;

// Inputs, as stored in the move list.
export const IN = { left: 0, right: 1, cw: 2, ccw: 3, soft: 4, hard: 5, hold: 6, end: 9 };
const VALID = new Set(Object.values(IN));

// Frames per row at each level (the guideline curve, rounded; level 13 and up
// fall a row every frame).
const GRAVITY = [60, 60, 48, 37, 28, 21, 16, 11, 8, 6, 4, 3, 2, 1, 1, 1];
export const framesPerRow = (level) => GRAVITY[Math.max(1, Math.min(15, level))];

// Each piece's cells in its box, spawn orientation, y down.
const SHAPES = {
  1: {
    n: 4,
    cells: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  }, // I
  2: {
    n: 3,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  }, // J
  3: {
    n: 3,
    cells: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  }, // L
  4: {
    n: 2,
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  }, // O
  5: {
    n: 3,
    cells: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
  }, // S
  6: {
    n: 3,
    cells: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  }, // T
  7: {
    n: 3,
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  }, // Z
};
// Rotating clockwise in an n×n box: (x, y) → (n-1-y, x).
export const ROT = {};
for (const [t, { n, cells }] of Object.entries(SHAPES)) {
  const states = [cells];
  for (let r = 1; r < 4; r++) states.push(states[r - 1].map(([x, y]) => [n - 1 - y, x]));
  ROT[t] = states;
}
export const cellsOf = (t, r) => ROT[t][r];

// SRS wall kicks, as (x, y) with y up, from the guideline tables. Key: from→to.
const KICKS = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};
const KICKS_I = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};
export const kicksFor = (t, from, to) => (t === 1 ? KICKS_I : KICKS)[`${from}>${to}`];

// T-spin corners of the T's 3×3 box, and the two in front for each rotation.
const T_CORNERS = [
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 2],
];
const T_FRONT = [
  [
    [0, 0],
    [2, 0],
  ],
  [
    [2, 0],
    [2, 2],
  ],
  [
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [0, 2],
  ],
];

// ---------- the board ----------

export const emptyBoard = () => new Array(W * H).fill(0);
const blocked = (board, x, y) => x < 0 || x >= W || y >= H || y < 0 || board[y * W + x] !== 0;
export function fits(board, t, r, x, y) {
  for (const [cx, cy] of ROT[t][r]) if (blocked(board, x + cx, y + cy)) return false;
  return true;
}
// Full rows cleared, the rest dropped: { board, rows }.
export function clearLines(board) {
  const keep = [];
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = board.slice(y * W, y * W + W);
    if (row.every((c) => c !== 0)) rows.push(y);
    else keep.push(row);
  }
  if (!rows.length) return { board, rows };
  const out = new Array(rows.length * W).fill(0);
  for (const row of keep) out.push(...row);
  return { board: out, rows };
}
// Where a piece lands if dropped straight down from y.
export function dropY(board, t, r, x, y) {
  while (fits(board, t, r, x, y + 1)) y++;
  return y;
}

// The guideline's points for a clear (before the level multiplier).
function basePoints(lines, spin) {
  if (spin === 'full') return [400, 800, 1200, 1600][lines] ?? 0;
  if (spin === 'mini') return [100, 200, 400][lines] ?? 0;
  return [0, 100, 300, 500, 800][lines] ?? 0;
}

// ---------- a game ----------

// mode: 'marathon' (until you top out), 'sprint' (40 lines, against the clock),
// 'ultra' (score in 2 minutes; `frames` sets another length, like a tournament's 3).
export function newGame({ seed, mode = 'marathon', level = 1, frames = 0 }) {
  const g = {
    mode,
    startLevel: Math.max(1, Math.min(15, level | 0 || 1)),
    limit: mode === 'ultra' ? frames || ULTRA_FRAMES : 0,
    rng: seeded(String(seed)),
    board: emptyBoard(),
    queue: [],
    cur: null,
    hold: 0,
    held: false,
    frame: 0,
    gravity: 0,
    lock: 0,
    resets: 0,
    lowest: 0,
    lastRotate: false,
    lastKick: 0,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    b2b: false,
    pieces: 0,
    over: false,
    finished: false,
    reason: '',
    last: null, // the latest clear, for the screen: { lines, spin, b2b, combo, points, frame }
  };
  g.level = g.mode === 'sprint' ? 1 : g.startLevel;
  fillQueue(g);
  spawn(g, g.queue.shift());
  return g;
}

function fillQueue(g) {
  while (g.queue.length < 7) {
    const bag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = g.rng.int(i + 1);
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    g.queue.push(...bag);
  }
}

export const isDone = (g) => g.over || g.finished;

function spawn(g, t) {
  const x = t === 4 ? 4 : 3;
  const y = 2;
  g.cur = { t, r: 0, x, y };
  g.gravity = 0;
  g.lock = 0;
  g.resets = 0;
  g.lastRotate = false;
  g.lastKick = 0;
  if (!fits(g.board, t, 0, x, y)) {
    g.over = true;
    g.reason = 'topout';
    return;
  }
  // The guideline drops a new piece one row right away, if it can.
  if (fits(g.board, t, 0, x, y + 1)) g.cur.y++;
  g.lowest = g.cur.y;
  fillQueue(g);
}

const grounded = (g) => !fits(g.board, g.cur.t, g.cur.r, g.cur.x, g.cur.y + 1);

// A successful move or rotation restarts the lock delay, up to MAX_RESETS times.
function moved(g) {
  if (g.lock > 0 && g.resets < MAX_RESETS) {
    g.lock = 0;
    g.resets++;
  }
}

function lowered(g) {
  if (g.cur.y > g.lowest) {
    g.lowest = g.cur.y;
    g.resets = 0;
    g.lock = 0;
  }
}

function tSpin(g) {
  const { t, r, x, y } = g.cur;
  if (t !== 6 || !g.lastRotate) return '';
  const filled = ([cx, cy]) => blocked(g.board, x + cx, y + cy);
  const corners = T_CORNERS.filter(filled).length;
  if (corners < 3) return '';
  return T_FRONT[r].every(filled) || g.lastKick === 4 ? 'full' : 'mini';
}

function lockPiece(g) {
  const { t, r, x, y } = g.cur;
  const spin = tSpin(g);
  const cells = ROT[t][r].map(([cx, cy]) => [x + cx, y + cy]);
  for (const [cx, cy] of cells) g.board[cy * W + cx] = t;
  g.pieces++;
  g.cur = null;
  // Locked entirely above the field: game over.
  if (cells.every(([, cy]) => cy < HIDDEN)) {
    g.over = true;
    g.reason = 'topout';
    return;
  }
  const { board, rows } = clearLines(g.board);
  g.board = board;
  const n = rows.length;
  const level = g.level;
  let points = basePoints(n, spin);
  const hard = n === 4 || (spin && n > 0);
  const b2b = hard && g.b2b;
  if (b2b) points = (points * 3) / 2;
  if (n > 0) g.b2b = hard;
  points *= level;
  if (n > 0) {
    g.combo++;
    if (g.combo > 0) points += 50 * g.combo * level;
  } else g.combo = -1;
  g.score += points;
  g.lines += n;
  if (g.mode !== 'sprint') g.level = Math.min(15, g.startLevel + Math.floor(g.lines / 10));
  if (n || spin) g.last = { lines: n, spin, b2b, combo: Math.max(0, g.combo), points, frame: g.frame, rows };
  if (g.mode === 'sprint' && g.lines >= SPRINT_LINES) {
    g.finished = true;
    g.reason = 'done';
    return;
  }
  g.held = false;
  spawn(g, g.queue.shift());
}

// One input, applied before the frame's gravity. Returns true if it did something.
export function input(g, code) {
  if (isDone(g)) return false;
  if (code === IN.end) {
    g.over = true;
    g.reason = 'quit';
    return true;
  }
  const c = g.cur;
  if (!c) return false;
  if (code === IN.left || code === IN.right) {
    const dx = code === IN.left ? -1 : 1;
    if (!fits(g.board, c.t, c.r, c.x + dx, c.y)) return false;
    c.x += dx;
    g.lastRotate = false;
    moved(g);
    return true;
  }
  if (code === IN.cw || code === IN.ccw) {
    if (c.t === 4) return false;
    const to = (c.r + (code === IN.cw ? 1 : 3)) % 4;
    const kicks = kicksFor(c.t, c.r, to);
    for (let k = 0; k < kicks.length; k++) {
      const nx = c.x + kicks[k][0];
      const ny = c.y - kicks[k][1];
      if (fits(g.board, c.t, to, nx, ny)) {
        Object.assign(c, { r: to, x: nx, y: ny });
        g.lastRotate = true;
        g.lastKick = k;
        moved(g);
        lowered(g);
        return true;
      }
    }
    return false;
  }
  if (code === IN.soft) {
    if (grounded(g)) return false;
    c.y++;
    g.score += 1;
    g.gravity = 0;
    g.lastRotate = false;
    lowered(g);
    return true;
  }
  if (code === IN.hard) {
    const to = dropY(g.board, c.t, c.r, c.x, c.y);
    g.score += 2 * (to - c.y);
    if (to > c.y) g.lastRotate = false;
    c.y = to;
    lockPiece(g);
    return true;
  }
  if (code === IN.hold) {
    if (g.held) return false;
    const t = c.t;
    const next = g.hold || g.queue.shift();
    g.hold = t;
    spawn(g, next);
    g.held = true;
    return true;
  }
  return false;
}

// One frame: gravity, then the lock delay.
export function step(g) {
  if (isDone(g)) return;
  g.frame++;
  if (g.limit && g.frame >= g.limit) {
    g.finished = true;
    g.reason = 'time';
    return;
  }
  const c = g.cur;
  if (!c) return;
  if (!grounded(g)) {
    g.lock = 0;
    g.gravity++;
    if (g.gravity >= framesPerRow(g.level)) {
      g.gravity = 0;
      c.y++;
      g.lastRotate = false;
      lowered(g);
    }
    return;
  }
  g.lock++;
  // Out of resets: it locks the moment it touches down.
  if (g.lock >= LOCK_FRAMES || g.resets >= MAX_RESETS) lockPiece(g);
}

export const ghostY = (g) => (g.cur ? dropY(g.board, g.cur.t, g.cur.r, g.cur.x, g.cur.y) : 0);

// What a game ended with: the numbers the server pays and ranks on.
export function summary(g) {
  return {
    score: g.score,
    lines: g.lines,
    level: g.level,
    frames: g.frame,
    pieces: g.pieces,
    over: g.over,
    finished: g.finished,
    reason: g.reason,
  };
}

// ---------- replaying ----------

// moves: a flat list [frame, input, frame, input, …], frames never going
// back. The game ends with an `end` input (or on its own: topping out, 40
// lines, the Ultra clock). Returns { error } or the summary.
export function replay(opts, moves, { maxFrames = MAX_FRAMES } = {}) {
  if (!Array.isArray(moves) || moves.length % 2 || moves.length > MAX_INPUTS * 2) return { error: 'Those moves don’t look right.' };
  for (let i = 0; i < moves.length; i += 2) {
    const f = moves[i];
    const c = moves[i + 1];
    if (!Number.isInteger(f) || f < 0 || f > maxFrames || (i && f < moves[i - 2]) || !VALID.has(c))
      return { error: 'Those moves don’t look right.' };
  }
  const g = newGame(opts);
  let i = 0;
  while (!isDone(g)) {
    while (i < moves.length && moves[i] === g.frame && !isDone(g)) {
      input(g, moves[i + 1]);
      i += 2;
    }
    if (isDone(g)) break;
    // Out of inputs: an Ultra keeps falling until its clock runs out; any
    // other game stops here (the player stopped playing).
    if (i >= moves.length && g.mode !== 'ultra') {
      g.over = true;
      g.reason = 'quit';
      break;
    }
    if (g.frame >= maxFrames) return { error: 'That game ran too long.' };
    step(g);
  }
  return summary(g);
}

// The same replay, noting when things happened (the checks on tournament
// runs in funGames.js use it): the frame each piece locked and whether a
// hard drop locked it, and the frame of every tap that did something (a
// turn, a hard drop or a hold: keys that never repeat on their own, unlike a
// held left/right or soft drop). Call it only on moves replay accepted.
const TAPS = new Set([IN.cw, IN.ccw, IN.hard, IN.hold]);
export function timeline(opts, moves) {
  const g = newGame(opts);
  const locks = [];
  const taps = [];
  let i = 0;
  while (!isDone(g) && g.frame < MAX_FRAMES) {
    while (i < moves.length && moves[i] === g.frame && !isDone(g)) {
      const code = moves[i + 1];
      const pieces = g.pieces;
      if (input(g, code) && TAPS.has(code)) taps.push(g.frame);
      if (g.pieces !== pieces) locks.push({ frame: g.frame, hard: code === IN.hard });
      i += 2;
    }
    if (isDone(g) || (i >= moves.length && g.mode !== 'ultra')) break;
    const pieces = g.pieces;
    step(g);
    if (g.pieces !== pieces) locks.push({ frame: g.frame, hard: false });
  }
  return { locks, taps, frames: g.frame };
}

// ---------- Trotbot ----------

// Trotbot places pieces with the El-Tetris weights (Pierre Dellacherie's
// features: landing height, cleared cells, row and column transitions, holes,
// wells), scaled to whole numbers so every device picks the same move.
function evaluate(board, t, r, x, y) {
  const placed = board.slice();
  const cells = ROT[t][r].map(([cx, cy]) => [x + cx, y + cy]);
  for (const [cx, cy] of cells) placed[cy * W + cx] = t;
  const { board: after, rows } = clearLines(placed);
  const eroded = rows.length * cells.filter(([, cy]) => rows.includes(cy)).length;
  const ys = cells.map(([, cy]) => cy);
  // Landing height in half rows from the floor (the piece's middle).
  const landing2 = 2 * H - (Math.min(...ys) + Math.max(...ys) + 1);
  let rowT = 0;
  let colT = 0;
  let holes = 0;
  let wells = 0;
  const at = (cx, cy) => cx < 0 || cx >= W || cy >= H || (cy >= 0 && after[cy * W + cx] !== 0);
  for (let cy = 0; cy < H; cy++) {
    let prev = true;
    for (let cx = 0; cx <= W; cx++) {
      const cur = at(cx, cy);
      if (cur !== prev) rowT++;
      prev = cur;
    }
  }
  for (let cx = 0; cx < W; cx++) {
    let prev = false;
    let roof = false;
    let well = 0;
    for (let cy = 0; cy <= H; cy++) {
      const cur = at(cx, cy);
      if (cur !== prev) colT++;
      prev = cur;
      if (cy < H) {
        if (cur) roof = true;
        else if (roof) holes++;
        // Wells: empty cells with filled (or wall) on both sides; deeper counts more.
        if (!cur && at(cx - 1, cy) && at(cx + 1, cy)) {
          well++;
          wells += well;
        } else well = 0;
      }
    }
  }
  return -2250 * landing2 + 3418 * eroded - 3218 * rowT - 9349 * colT - 7899 * holes - 3386 * wells;
}

// Trotbot's best spot for piece t: { r, x, y } (null if nothing fits).
export function botMove(board, t) {
  let best = null;
  const seen = new Set();
  for (let r = 0; r < 4; r++) {
    const key = ROT[t][r]
      .map(([x, y]) => `${x},${y}`)
      .sort()
      .join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    for (let x = -3; x < W; x++) {
      if (!fits(board, t, r, x, 0)) continue;
      const y = dropY(board, t, r, x, 0);
      const v = evaluate(board, t, r, x, y);
      if (!best || v > best.v) best = { r, x, y, v };
    }
  }
  return best;
}

// Trotbot's speed: frames per piece.
export const BOT_PACE = { easy: 75, medium: 45, hard: 27 };

// Trotbot's own Sprint game on the same pieces, a piece every `pace` frames.
// advance(frame) plays up to that frame (for the live picture); the server
// calls result() for the whole race.
export function newBot({ seed, pace = BOT_PACE.medium }) {
  const g = newGame({ seed, mode: 'sprint' });
  const advance = (frame) => {
    while (!isDone(g) && (g.pieces + 1) * pace <= frame) {
      const m = botMove(g.board, g.cur.t);
      g.frame = (g.pieces + 1) * pace;
      if (!m) {
        g.over = true;
        g.reason = 'topout';
        break;
      }
      Object.assign(g.cur, { r: m.r, x: m.x, y: m.y });
      g.lastRotate = false;
      lockPiece(g);
    }
    return g;
  };
  return { game: g, advance, result: (maxFrames = MAX_FRAMES) => summary(advance(maxFrames)) };
}
