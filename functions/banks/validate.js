// Checks every question bank: run `node functions/banks/validate.js`.
// Exits non-zero on any problem and prints counts per bank.
import { existsSync } from 'fs';
import { BANKS, ALL, PARTS, gearQuestion, publicView, nextQuestion, dailyQuestion, dayIndex, SEASON } from './index.js';

const problems = [];
const bad = (id, msg) => problems.push(`${id}: ${msg}`);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function checkChoice(q) {
  if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 5) bad(q.id, `needs 2-5 choices, has ${q.choices?.length}`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.choices?.length || 0)) bad(q.id, `answer ${q.answer} out of range`);
  const seen = new Set();
  for (const c of q.choices || []) {
    if (typeof c !== 'string' || !c.trim()) bad(q.id, 'empty choice');
    if (seen.has(norm(c))) bad(q.id, `duplicate choice "${c}"`);
    seen.add(norm(c));
  }
}

function checkBug(q) {
  if (!Array.isArray(q.lines) || q.lines.length < 3) bad(q.id, 'needs at least 3 lines');
  if (!Number.isInteger(q.bugLine) || q.bugLine < 0 || q.bugLine >= (q.lines?.length || 0)) bad(q.id, `bugLine ${q.bugLine} out of range`);
  if (!q.fixed || q.fixed === q.lines?.[q.bugLine]) bad(q.id, 'fixed line missing or same as the bug');
  if (!['java', 'blocks'].includes(q.lang)) bad(q.id, `lang ${q.lang}`);
}

const counts = {};
const ids = new Set();
const prompts = new Map();
for (const [name, list] of Object.entries(BANKS)) {
  counts[name] = list.length;
  for (const q of list) {
    if (!q.id || typeof q.id !== 'string') bad(JSON.stringify(q).slice(0, 60), 'missing id');
    if (ids.has(q.id)) bad(q.id, 'duplicate id');
    ids.add(q.id);
    if (q.bank !== name) bad(q.id, `bank "${q.bank}" filed under "${name}"`);
    if (![1, 2, 3].includes(q.difficulty)) bad(q.id, `difficulty ${q.difficulty}`);
    if (!q.prompt || q.prompt.length < 8) bad(q.id, 'prompt missing');
    if (!q.explain || q.explain.length < 8) bad(q.id, 'explain missing');
    if ((name === 'rules' || name === 'strategy') && !/(\b[GRIEAT]\d{3}\b|Section \d|Table \d)/.test(q.source || '')) bad(q.id, `source "${q.source}" has no rule or section`);
    if ((name === 'rules' || name === 'strategy') && !/p(p)?\. \d/.test(q.source || '')) bad(q.id, `source "${q.source}" has no page`);
    if (q.kind === 'bug') checkBug(q);
    else checkChoice(q);
    // The same prompt twice is a repeat, unless the picture or code differs.
    const key = norm(q.prompt) + '|' + (q.image || '') + '|' + (q.lines ? q.lines.join('\n') : '') + '|' + (q.scene || '') + '|' + (q.hub || '');
    if (prompts.has(key)) bad(q.id, `same prompt as ${prompts.get(key)}`);
    prompts.set(key, q.id);
    // Nothing the client sees may give the answer away.
    const pub = JSON.stringify(publicView(q));
    for (const k of ['answer', 'bugLine', 'fixed', 'explain', 'ports']) if (pub.includes(`"${k}"`)) bad(q.id, `public view leaks ${k}`);
  }
}

// Part photos: the file exists, and its name doesn't give the part away.
for (const p of PARTS) {
  if (!p.photo) continue;
  if (!/^parts\/[a-z0-9]{10}\.webp$/.test(p.photo)) bad(p.id, `photo name "${p.photo}"`);
  if (!existsSync(new URL(`../../public/${p.photo}`, import.meta.url))) bad(p.id, `photo ${p.photo} missing`);
}

// Gear questions: a few thousand seeds, all well formed and stable.
let gearSeen = new Set();
for (let s = 0; s < 3000; s++) {
  const q = gearQuestion(s);
  checkChoice(q);
  if (q.bank !== 'gear') bad(q.id, 'gear bank');
  if (JSON.stringify(gearQuestion(s)) !== JSON.stringify(q)) bad(q.id, 'not deterministic');
  gearSeen.add(q.prompt);
}
counts.gear = `generated (${gearSeen.size} distinct prompts in 3000 seeds)`;

// The picker: no repeats until the whole bank has been seen.
for (const name of Object.keys(BANKS)) {
  let state = {};
  const got = new Set();
  const n = BANKS[name].length;
  for (let i = 0; i < n; i++) {
    const r = nextQuestion(name, state, 'tester');
    if (got.has(r.question.id)) {
      bad(name, `picker repeated ${r.question.id} after ${i}`);
      break;
    }
    got.add(r.question.id);
    state = r.state;
  }
  if (got.size !== n) bad(name, `picker saw ${got.size} of ${n}`);
  const again = nextQuestion(name, state, 'tester');
  if (again.state.round !== 2) bad(name, 'picker did not start round 2');
}

// Daily: one per day, no repeats across the season.
const used = new Set();
const start = new Date(SEASON.start + 'T12:00:00Z');
const end = new Date(SEASON.end + 'T12:00:00Z');
let days = 0;
const byBank = {};
for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
  const day = d.toISOString().slice(0, 10);
  const q = dailyQuestion(day);
  if (JSON.stringify(dailyQuestion(day)) !== JSON.stringify(q)) bad(day, 'daily not deterministic');
  if (used.has(q.id)) bad(day, `daily repeats ${q.id}`);
  if (q.kind !== 'choice') bad(day, 'daily is not multiple choice');
  checkChoice(q);
  used.add(q.id);
  byBank[q.bank] = (byBank[q.bank] || 0) + 1;
  days++;
}
if (dayIndex(SEASON.start) !== 0) bad('daily', 'day index');

console.log('Questions per bank:', counts);
console.log('Total fixed questions:', ALL.length);
console.log(`Daily: ${days} days, ${used.size} different questions, by bank:`, byBank);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(' -', p);
  process.exit(1);
}
console.log('All good.');
