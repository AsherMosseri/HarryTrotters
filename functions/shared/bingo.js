// Lab bingo (3.0, E3): a 4x4 card each team week (Monday to Sunday, New
// York). Everyone gets the same squares that week, picked from POOL with a
// seed made from the week, and squares fill in by themselves from the team's
// data: shifts, lab logs, tasks, the match log, planned shifts and score
// guesses. Nobody taps a square.
//
// A full row, column or diagonal pays LINE_COINS, and the whole card pays
// FULL_COINS more, once per person per week (one-time award keys, paid by the
// server through awardCoins, source 'bingo'). The app and the server use this
// same file; only the server's answer pays.

import { teamDay, teamMidnight } from './coins.js';
import { addDay, weekStart } from './streaks.js';
import { mergedMs, HOUR } from './hours.js';
import { nameKey } from './team.js';

export const SIZE = 4;
export const LINE_COINS = 5;
export const FULL_COINS = 15;

const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);

// Lab log chips (src/labLog.js CHIPS) that count for a square.
const FIX_CHIPS = ['coding-bug', 'mech-fixed', 'elec-connection'];
const HELP_CHIPS = ['gen-helped', 'out-team'];
const TEST_CHIPS = ['coding-test', 'mech-tested', 'elec-tested', 'asm-fit'];
const FORWARD = ['done', 'progress', 'started'];

const days = (list, at) => new Set(list.map((x) => teamDay(at(x))));
const logsWithChip = (ctx, ids) => ctx.logs.some((l) => (l.chips || []).some((c) => ids.includes(c)));

// Tasks this person finished this week: assigned tasks marked done this week,
// and "Finished" in their lab logs (tasks not on the board count by title).
function finishedCount(ctx) {
  const keys = new Set();
  for (const t of ctx.tasks) {
    if (t.status !== 'done' || t.deletedAt || !(t.assignees || []).includes(ctx.me)) continue;
    const at = toMs(t.completedAt);
    if (at >= ctx.from && at < ctx.to) keys.add(`id:${t.id}`);
  }
  for (const l of ctx.logs)
    for (const t of l.tasks || []) if (t.outcome === 'done') keys.add(t.id ? `id:${t.id}` : `title:${String(t.title || '').toLowerCase()}`);
  return keys.size;
}

// Did a shift of theirs overlap a planned shift they said "I'm in" to?
function cameToPlan(ctx) {
  return ctx.plans.some((p) => {
    if (!p.date || !p.start || p.people?.[ctx.me] !== 'in') return false;
    const [h, m] = String(p.start).split(':').map(Number);
    const [eh, em] = String(p.end || p.start)
      .split(':')
      .map(Number);
    const from = teamMidnight(p.date) + (h * 60 + m) * 60000;
    const to = Math.max(from + 30 * 60000, teamMidnight(p.date) + (eh * 60 + em) * 60000);
    return ctx.shifts.some((s) => s.start < to && (s.end ?? ctx.now) > from);
  });
}

// Every square that can be on a card. tier: 1 easy, 2 medium, 3 hard.
// Ids are kept in award labels and on screen, so keep them when rewording.
export const POOL = [
  { id: 'shift', tier: 1, label: 'Logged a shift', test: (c) => c.shifts.length > 0 },
  { id: 'log', tier: 1, label: 'Wrote a lab log', test: (c) => c.logs.length > 0 },
  {
    id: 'forward',
    tier: 1,
    label: 'Moved a task forward',
    test: (c) => c.logs.some((l) => (l.tasks || []).some((t) => FORWARD.includes(t.outcome))),
  },
  { id: 'with', tier: 1, label: 'Worked with a teammate', test: (c) => c.logs.some((l) => (l.workedWith || []).length > 0) },
  { id: 'photo', tier: 1, label: 'Photo in a lab log', test: (c) => c.logs.some((l) => (l.photos || []).length > 0) },
  { id: 'guess', tier: 1, label: 'Guessed a run’s score', test: (c) => c.guesses > 0 },
  { id: 'days3', tier: 2, label: 'At the lab 3 days', test: (c) => days(c.shifts, (s) => s.start).size >= 3 },
  { id: 'hours5', tier: 2, label: '5 hours at the lab', test: (c) => c.ms >= 5 * HOUR },
  { id: 'long', tier: 2, label: 'A 2-hour shift', test: (c) => c.shifts.some((s) => (s.end ?? c.now) - s.start >= 2 * HOUR) },
  { id: 'logs3', tier: 2, label: 'Lab logs on 3 days', test: (c) => new Set(c.logs.map((l) => l.day)).size >= 3 },
  { id: 'finished', tier: 2, label: 'Finished a task', test: (c) => finishedCount(c) >= 1 },
  { id: 'fixed', tier: 2, label: 'Fixed something', sub: 'a bug, a part or a connection', test: (c) => logsWithChip(c, FIX_CHIPS) },
  { id: 'helped', tier: 2, label: 'Helped someone', test: (c) => logsWithChip(c, HELP_CHIPS) },
  { id: 'tested', tier: 2, label: 'Tested on the robot', test: (c) => logsWithChip(c, TEST_CHIPS) },
  { id: 'cleanup', tier: 2, label: 'Cleaned up', test: (c) => logsWithChip(c, ['gen-cleanup']) },
  { id: 'voice', tier: 2, label: 'Voice note in a lab log', test: (c) => c.logs.some((l) => !!l.voice?.url) },
  {
    id: 'newpal',
    tier: 2,
    label: 'Worked with someone new',
    sub: 'someone you haven’t logged before',
    test: (c) => c.logs.some((l) => (l.workedWith || []).some((n) => !c.workedBefore.has(n))),
  },
  {
    id: 'run',
    tier: 2,
    label: 'Practice run logged',
    sub: 'you logged it or drove',
    test: (c) => c.runs.some((r) => (r.type || 'practice') === 'practice' && (r.createdBy === c.me || (r.drivers || []).includes(c.me))),
  },
  { id: 'planned', tier: 2, label: 'Came to a planned shift', test: cameToPlan },
  { id: 'hours10', tier: 3, label: '10 hours at the lab', test: (c) => c.ms >= 10 * HOUR },
  { id: 'days4', tier: 3, label: 'At the lab 4 days', test: (c) => days(c.shifts, (s) => s.start).size >= 4 },
  { id: 'finished2', tier: 3, label: 'Finished 2 tasks', test: (c) => finishedCount(c) >= 2 },
  { id: 'outreach', tier: 3, label: 'Did outreach', test: (c) => c.logs.some((l) => (l.areas || []).includes('outreach')) },
  // The daily question (G10). Hook: once it's live, set DAILY_FROM to the
  // first Monday it should be on cards and pass `dailyAnswers` (the days this
  // person answered) in the inputs. Weeks before DAILY_FROM keep their cards.
  { id: 'daily', tier: 1, label: 'Answered the daily question', hook: 'daily', test: (c) => c.dailyAnswers > 0 },
];
export const DAILY_FROM = null; // 'YYYY-MM-DD' (a Monday), or null while the daily question isn't live
const squareById = Object.fromEntries(POOL.map((s) => [s.id, s]));

// A small seeded random number generator (mulberry32), so a week always
// gets the same card on every phone and on the server.
function rng(seedText) {
  let a = 0;
  for (const ch of String(seedText)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The week's 16 square ids, in card order (row by row): 5 easy, 8 medium and
// 3 hard ones, mixed up.
export function cardSquares(week) {
  const rand = rng(`bingo-${week}`);
  const pool = POOL.filter((s) => !s.hook || (s.hook === 'daily' && DAILY_FROM && week >= DAILY_FROM));
  const pick = (tier, n) =>
    shuffle(
      pool.filter((s) => s.tier === tier),
      rand,
    ).slice(0, n);
  return shuffle([...pick(1, 5), ...pick(2, 8), ...pick(3, 3)], rand).map((s) => s.id);
}

// Rows, columns and the two diagonals, as lists of square positions.
export const LINES = [
  ...Array.from({ length: SIZE }, (_, r) => ({
    id: `r${r}`,
    label: `Row ${r + 1}`,
    cells: Array.from({ length: SIZE }, (_, c) => r * SIZE + c),
  })),
  ...Array.from({ length: SIZE }, (_, c) => ({
    id: `c${c}`,
    label: `Column ${c + 1}`,
    cells: Array.from({ length: SIZE }, (_, r) => r * SIZE + c),
  })),
  { id: 'd0', label: 'Diagonal', cells: Array.from({ length: SIZE }, (_, i) => i * SIZE + i) },
  { id: 'd1', label: 'Diagonal', cells: Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)) },
];

// The team week a time falls in: its Monday, and where it starts and ends (ms).
export function bingoWeek(now = Date.now()) {
  const week = weekStart(teamDay(now));
  return { week, from: teamMidnight(week), to: teamMidnight(addDay(week, 7)) };
}

// One person's card for a week. Everything in `data` is under current
// names (rename first): { shifts, logs (this person's, any time), tasks,
// runs, plans, guesses (how many score guesses they made this week),
// dailyAnswers }.
export function bingoCard(me, data, { week, now = Date.now() } = {}) {
  const w = week || bingoWeek(now).week;
  const from = teamMidnight(w);
  const to = teamMidnight(addDay(w, 7));
  const inWeek = (ms) => ms >= from && ms < to;
  const myLogs = (data.logs || []).filter((l) => l.person === me);
  const shifts = (data.shifts || []).filter((s) => s.person === me && Number.isFinite(s.start) && inWeek(s.start));
  const ctx = {
    me,
    now,
    from,
    to,
    shifts,
    ms: mergedMs(shifts, Math.min(now, to)),
    logs: myLogs.filter((l) => l.day >= w && l.day < addDay(w, 7)),
    workedBefore: new Set(myLogs.filter((l) => l.day < w).flatMap((l) => l.workedWith || [])),
    tasks: data.tasks || [],
    runs: (data.runs || []).filter((r) => r.date >= w && r.date < addDay(w, 7)),
    plans: (data.plans || []).filter((p) => p.date >= w && p.date < addDay(w, 7)),
    guesses: data.guesses || 0,
    dailyAnswers: data.dailyAnswers || 0,
  };
  const squares = cardSquares(w).map((id) => {
    const s = squareById[id];
    return { id, label: s.label, sub: s.sub || '', tier: s.tier, done: !!s.test(ctx) };
  });
  const lines = LINES.map((l) => ({ ...l, done: l.cells.every((i) => squares[i].done) }));
  return { week: w, squares, lines, full: squares.every((s) => s.done), filled: squares.filter((s) => s.done).length };
}

// The one-time award keys (functions/award.js) for a card's lines and the
// full card: what's owed, in the order it's paid.
export function bingoAwards(me, card) {
  const pid = nameKey(me);
  const out = card.lines
    .filter((l) => l.done)
    .map((l) => ({
      line: l.id,
      amount: LINE_COINS,
      key: `bingo-${card.week}-${l.id}-${pid}`,
      label: `Lab bingo, ${l.label.toLowerCase()}`,
    }));
  if (card.full) out.push({ line: 'full', amount: FULL_COINS, key: `bingo-${card.week}-full-${pid}`, label: 'Lab bingo, full card' });
  return out;
}
