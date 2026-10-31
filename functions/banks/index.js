// Question banks for the educational games (plan section G). Server-only:
// these files hold the answers, so nothing under functions/banks may be
// imported by the app. Send players publicView(question) and check their
// answer here with checkAnswer().
import { RULES } from './rules.js';
import { STRATEGY } from './strategy.js';
import { CODE } from './code.js';
import { PARTS, PART_QUESTIONS } from './parts.js';
import { SPOT } from './spot.js';
import { WIRING } from './wiring.js';
import { GEAR_SPACE, gearQuestion, gearSeedOf } from './gear.js';
import { hash, shuffle } from './util.js';

export { PARTS, gearQuestion, GEAR_SPACE };

// The season the daily question runs over (no repeats inside it).
export const SEASON = { id: '2026-27', start: '2026-09-01', end: '2027-08-31' };

// Fixed banks. Gear questions are generated (gearQuestion) instead.
export const BANKS = { rules: RULES, strategy: STRATEGY, code: CODE, parts: PART_QUESTIONS, spot: SPOT, wiring: WIRING };
export const BANK_NAMES = {
  rules: 'Rules check',
  strategy: 'Strategy',
  code: 'Fix the bug',
  parts: 'Name that part',
  spot: 'Spot the problem',
  wiring: 'Wiring puzzle',
  gear: 'Gear ratio challenge',
};
export const ALL = Object.values(BANKS).flat();
const BY_ID = new Map(ALL.map((q) => [q.id, q]));

export function getQuestion(id) {
  if (BY_ID.has(id)) return BY_ID.get(id);
  const seed = gearSeedOf(id);
  return seed == null ? null : gearQuestion(seed);
}

// What a player may see before answering: no answer, explanation, fixed
// line, accepted ports, citation or part number (a part question's number
// would give its name away).
const SECRET = new Set(['answer', 'bugLine', 'fixed', 'explain', 'ports', 'source', 'fix', 'partId', 'partNumber', 'url']);
export function publicView(q) {
  if (!q) return null;
  return Object.fromEntries(Object.entries(q).filter(([k]) => !SECRET.has(k)));
}

// `given` is a choice index, a line index for a bug question, or a port id
// for a wiring question answered by tapping the hub picture.
export function checkAnswer(id, given) {
  const q = getQuestion(id);
  if (!q) return null;
  let correct;
  if (q.kind === 'bug') correct = given === q.bugLine;
  else if (typeof given === 'string' && q.ports) correct = q.ports.includes(given);
  else correct = given === q.answer;
  const reveal = {};
  for (const k of ['answer', 'bugLine', 'fixed', 'explain', 'ports', 'source', 'fix', 'partNumber', 'url']) if (q[k] !== undefined) reveal[k] = q[k];
  return { correct: !!correct, ...reveal };
}

// A bug question as multiple choice ("which line?"), for chat and the daily
// question: the broken line plus three other real lines, in order.
export function asChoice(q) {
  if (!q || q.kind !== 'bug') return q;
  const candidates = q.lines.map((l, i) => i).filter((i) => i !== q.bugLine && q.lines[i].trim().replace(/[{}();\s]/g, '').length > 2);
  const picks = [q.bugLine, ...shuffle(candidates, `${q.id}-lines`).slice(0, 3)].sort((a, b) => a - b);
  const choices = picks.map((i) => `Line ${i + 1}`);
  return { ...q, kind: 'choice', prompt: q.prompt, choices, answer: picks.indexOf(q.bugLine) };
}

// Gear questions are walked with a stride that has no common factor with the
// size of the space, so every spot comes up once before any repeats.
function coprimeStride(n) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let s = Math.max(1, Math.floor(n * 0.618));
  while (gcd(s, n) !== 1) s++;
  return s;
}
const GEAR_STRIDE = coprimeStride(GEAR_SPACE);

// A person's next question from one bank, never repeating until they have
// seen the whole bank. `state` is whatever this returned last time for that
// person and bank (start with {}); keep it on the server. `who` is a stable
// id for the person (their uid), so different people get different orders.
export function nextQuestion(bank, state = {}, who = '') {
  if (bank === 'gear') {
    let round = state.round || 1;
    let n = state.n || 0;
    if (n >= GEAR_SPACE) {
      round += 1;
      n = 0;
    }
    const offset = hash(`${who}|gear|${round}`) % GEAR_SPACE;
    const question = gearQuestion((offset + n * GEAR_STRIDE) % GEAR_SPACE);
    return { question, state: { round, n: n + 1 } };
  }
  const list = BANKS[bank];
  if (!list) throw new Error(`No bank "${bank}"`);
  let round = state.round || 1;
  let seen = new Set(state.seen || []);
  const ids = list.map((q) => q.id);
  // Questions removed from the bank no longer count as seen.
  seen = new Set([...seen].filter((id) => BY_ID.has(id)));
  if (ids.every((id) => seen.has(id))) {
    round += 1;
    seen = new Set();
  }
  const order = shuffle(ids, `${who}|${bank}|${round}`);
  let pick = order.find((id) => !seen.has(id));
  // At the start of a new round, don't open with the question just answered.
  if (seen.size === 0 && state.last === pick && order.length > 1) pick = order[1];
  seen.add(pick);
  return { question: BY_ID.get(pick), state: { round, seen: [...seen], last: pick } };
}

// Days since the season started (UTC calendar days of 'YYYY-MM-DD').
export function dayIndex(day) {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${SEASON.start}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// Which bank each day draws from, repeating every 12 days: rules most often,
// then parts, strategy and code, with wiring, spot and gear once each.
const ROTATION = ['rules', 'parts', 'strategy', 'code', 'rules', 'wiring', 'spot', 'gear', 'rules', 'strategy', 'parts', 'code'];

// The daily question for a team day ('YYYY-MM-DD', America/New_York per
// teamDay). The same for everyone that day, and no question repeats within
// the season. `history` (ids already used as daily questions, if the server
// keeps them) guards against repeats even after the banks change.
export function dailyQuestion(day, history = []) {
  const used = new Set(history);
  const i = ((dayIndex(day) % 365) + 365) % 365;
  const slot = i % ROTATION.length;
  const bank = ROTATION[slot];
  const perCycle = ROTATION.filter((b) => b === bank).length;
  let k = Math.floor(i / ROTATION.length) * perCycle + ROTATION.slice(0, slot).filter((b) => b === bank).length;
  if (bank === 'gear') {
    const offset = hash(`${SEASON.id}|daily|gear`) % GEAR_SPACE;
    for (let tries = 0; tries < GEAR_SPACE; tries++, k++) {
      const q = gearQuestion((offset + k * GEAR_STRIDE) % GEAR_SPACE);
      if (!used.has(q.id)) return q;
    }
  }
  const order = shuffle(
    BANKS[bank].map((q) => q.id),
    `${SEASON.id}|daily|${bank}`,
  );
  for (let tries = 0; tries < order.length; tries++, k++) {
    const id = order[k % order.length];
    if (!used.has(id)) return asChoice(BY_ID.get(id));
  }
  return asChoice(BY_ID.get(order[k % order.length]));
}
