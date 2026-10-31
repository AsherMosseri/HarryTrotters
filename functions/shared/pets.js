// Pets (H3) and the team mascot. Everything here is plain math on the team's
// data, the same in the app, demo mode and on the server:
//
// - A pet grows (levels) only with its owner's lab time since adoption:
//   every full 15 minutes of a day's lab time (overlaps once, 10 h a day at
//   most, like coins) plus a little extra for each school day at the lab.
//   Coins never buy levels.
// - It has two needs, food and fun (0–100), that slowly run down. Pet items
//   from the market fill them; the server records each one on the pet's doc
//   (pets/{personId}, written only by the server), so a phone can't fake them.
// - Its mood comes from those needs and from showing up: it misses you after
//   a few school days away. It gets sad, but it never dies.
//
// The mascot (the team's robot on Today) runs on the whole team's last seven
// days: lab hours, tasks finished, lab logs, and teammates on a streak.

import { teamDay } from './coins.js';
import { addDay, shiftDays, streaksOf } from './streaks.js';
import { isSchoolDay } from './school.js';

export const SPECIES = [
  { id: 'cat', name: 'Cat' },
  { id: 'dog', name: 'Dog' },
  { id: 'bunny', name: 'Bunny' },
  { id: 'fox', name: 'Fox' },
  { id: 'owl', name: 'Owl' },
  { id: 'frog', name: 'Frog' },
];
export const isSpecies = (id) => SPECIES.some((s) => s.id === id);

// Pet items (sold in the market). food/fun: how much each fills.
export const PET_ITEMS = [
  { id: 'snack', name: 'Snack', desc: 'A quick bite.', price: 4, food: 25 },
  { id: 'meal', name: 'Full meal', desc: 'Fills it right up.', price: 9, food: 60 },
  { id: 'toy', name: 'New toy', desc: 'Something to chase.', price: 5, fun: 30 },
  { id: 'park', name: 'Trip to the park', desc: 'A whole afternoon out.', price: 10, fun: 60 },
  { id: 'treat', name: 'Treat', desc: 'A bit of both.', price: 6, food: 15, fun: 15 },
];
export const petItem = (id) => PET_ITEMS.find((x) => x.id === id) || null;

// How much each need runs down a day, and where a new pet starts.
export const DECAY = { food: 15, fun: 12 };
export const START_NEED = 80;
// Over this, a need is full: the market won't sell more of what fills it.
export const FULL = 95;
const DAY = 86400000;
const clamp = (n) => Math.max(0, Math.min(100, n));

// A need right now: stored as { v, at } and running down since then.
export function needNow(pet, key, now = Date.now()) {
  const n = pet?.[key];
  if (!n || !Number.isFinite(n.v)) return 0;
  return Math.round(clamp(n.v - (DECAY[key] * Math.max(0, now - (n.at || now))) / DAY));
}

// A pet after an item: { food, fun } as stored ({ v, at }), or { error }.
export function careAfter(pet, item, now = Date.now()) {
  if (!pet) return { error: 'Adopt a pet first.' };
  if (!item) return { error: 'That isn’t a pet item.' };
  const food = needNow(pet, 'food', now);
  const fun = needNow(pet, 'fun', now);
  const fills = (k, have) => (item[k] || 0) > 0 && have < FULL;
  if (!fills('food', food) && !fills('fun', fun))
    return { error: `${pet.name || 'Your pet'} is full.`, body: 'Save your coins for when it needs something.' };
  return {
    food: { v: clamp(food + (item.food || 0)), at: now },
    fun: { v: clamp(fun + (item.fun || 0)), at: now },
  };
}

// Growth: xp from lab time since adoption (shifts under current names; a
// shift running when the pet was adopted counts from then).
export const XP_PER_QUARTER = 1;
export const XP_PER_SCHOOL_DAY = 4;
const DAY_CAP_MIN = 600;
export function petXp(person, shifts = [], adoptedAt = 0, now = Date.now()) {
  const byDay = new Map();
  for (const s of shifts) {
    if (s.person !== person || !Number.isFinite(s.start)) continue;
    const end = s.end ?? now;
    if (end <= adoptedAt) continue;
    const start = Math.max(s.start, adoptedAt);
    const day = teamDay(start);
    byDay.set(day, [...(byDay.get(day) || []), [start, Math.min(end, now)]]);
  }
  let xp = 0;
  for (const [day, spans] of byDay) {
    // Overlapping shifts count once.
    spans.sort((a, b) => a[0] - b[0]);
    let ms = 0;
    let [cs, ce] = spans[0];
    for (const [s, e] of spans.slice(1)) {
      if (s <= ce) ce = Math.max(ce, e);
      else {
        ms += ce - cs;
        [cs, ce] = [s, e];
      }
    }
    ms += ce - cs;
    const minutes = Math.min(Math.max(0, ms / 60000), DAY_CAP_MIN);
    xp += Math.floor(minutes / 15) * XP_PER_QUARTER;
    if (minutes >= 15 && isSchoolDay(day)) xp += XP_PER_SCHOOL_DAY;
  }
  return xp;
}
// Level 2 at 6 xp (about an hour and a half), 3 at 24, 5 at 96, 10 at 486.
export const MAX_LEVEL = 30;
export const xpFor = (level) => 6 * (level - 1) ** 2;
export function levelOf(xp) {
  const level = Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 6)));
  const from = xpFor(level);
  const to = level >= MAX_LEVEL ? from : xpFor(level + 1);
  return { level, xp, from, to, progress: to > from ? (xp - from) / (to - from) : 1 };
}
// How grown-up it looks: baby, young, grown.
export const stageOf = (level) => (level >= 6 ? 'grown' : level >= 3 ? 'young' : 'baby');

// School days since the owner was last at the lab (today not counted, so
// it doesn't miss you in the morning). Before any shift: since adoption.
export function schoolDaysAway(person, shifts = [], adoptedAt = 0, now = Date.now()) {
  const today = teamDay(now);
  const days = shiftDays(person, shifts, now);
  if (days.has(today)) return 0;
  const since = teamDay(adoptedAt || now);
  let away = 0;
  for (let d = addDay(today, -1), i = 0; i < 120 && d >= since; d = addDay(d, -1), i++) {
    if (days.has(d)) break;
    if (isSchoolDay(d)) away++;
  }
  return away;
}

// Everything the app shows about a pet.
export function petState(pet, { shifts = [], now = Date.now() } = {}) {
  if (!pet) return null;
  const person = pet.person;
  const food = needNow(pet, 'food', now);
  const fun = needNow(pet, 'fun', now);
  const away = schoolDaysAway(person, shifts, pet.adoptedAt, now);
  const lv = levelOf(petXp(person, shifts, pet.adoptedAt || 0, now));
  const score = Math.round((food + fun) / 2 - Math.max(0, away - 2) * 15);
  const mood = score >= 60 ? 'happy' : score >= 30 ? 'ok' : 'sad';
  const needs = [];
  if (food < 30) needs.push('hungry');
  if (fun < 30) needs.push('bored');
  if (away >= 3) needs.push('misses you');
  return { ...lv, stage: stageOf(lv.level), food, fun, away, score, mood, needs };
}

// "Biscuit is hungry and bored", "Biscuit misses you", for the profile.
export function moodLine(name, st) {
  if (!st) return '';
  const wants = [st.food < 30 && 'hungry', st.fun < 30 && 'bored'].filter(Boolean);
  const line = wants.length ? `${name} is ${wants.join(' and ')}` : '';
  if (st.away >= 3) return line ? `${line}, and misses you` : `${name} misses you`;
  return line || (st.mood === 'happy' ? `${name} is happy` : `${name} is doing OK`);
}

// The mascot: how the team's last seven days went, against weekly goals.
export const MASCOT_GOALS = { hours: 25, tasks: 6, logs: 10, streaks: 4 };
const WEIGHTS = { hours: 0.35, tasks: 0.25, logs: 0.2, streaks: 0.2 };
const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
export function mascotState({ shifts = [], tasks = [], logs = [], roster = [], now = Date.now() } = {}) {
  const from = now - 7 * DAY;
  const fromDay = teamDay(from);
  // Lab hours: each person's shifts merged (overlaps once), clipped to the window.
  const byPerson = new Map();
  for (const s of shifts) {
    if (!s.person || !Number.isFinite(s.start)) continue;
    const end = s.end ?? now;
    if (end <= from) continue;
    byPerson.set(s.person, [...(byPerson.get(s.person) || []), [Math.max(s.start, from), Math.min(end, now)]]);
  }
  let ms = 0;
  for (const spans of byPerson.values()) {
    spans.sort((a, b) => a[0] - b[0]);
    let [cs, ce] = spans[0];
    for (const [s, e] of spans.slice(1)) {
      if (s <= ce) ce = Math.max(ce, e);
      else {
        ms += Math.max(0, ce - cs);
        [cs, ce] = [s, e];
      }
    }
    ms += Math.max(0, ce - cs);
  }
  const have = {
    hours: Math.round((ms / 3600000) * 10) / 10,
    tasks: tasks.filter((t) => t.status === 'done' && !t.deletedAt && toMs(t.completedAt) >= from).length,
    logs: logs.filter((l) => (l.day || '') >= fromDay && !l.quick).length,
    streaks: roster.filter((n) => {
      const st = streaksOf(n, shifts, now);
      return st.daily >= 2 || st.weekly >= 3;
    }).length,
  };
  const parts = Object.keys(MASCOT_GOALS).map((k) => ({ key: k, have: have[k], goal: MASCOT_GOALS[k], pct: Math.min(1, have[k] / MASCOT_GOALS[k]) }));
  const energy = Math.round(100 * parts.reduce((t, p) => t + p.pct * WEIGHTS[p.key], 0));
  const mood = energy >= 70 ? 'happy' : energy >= 35 ? 'ok' : 'sad';
  // What would cheer it up most: the biggest gaps first.
  const tip = (p) => {
    const n = Math.ceil(p.goal - p.have);
    if (p.key === 'hours') return `${n} more lab ${n === 1 ? 'hour' : 'hours'} as a team`;
    if (p.key === 'tasks') return `Finish ${n} more ${n === 1 ? 'task' : 'tasks'}`;
    if (p.key === 'logs') return `${n} more lab ${n === 1 ? 'log' : 'logs'}`;
    return `${n} more ${n === 1 ? 'teammate' : 'teammates'} on a streak`;
  };
  const tips = parts
    .filter((p) => p.pct < 1)
    .sort((a, b) => (1 - b.pct) * WEIGHTS[b.key] - (1 - a.pct) * WEIGHTS[a.key])
    .slice(0, 3)
    .map(tip);
  return { energy, mood, parts, tips };
}
