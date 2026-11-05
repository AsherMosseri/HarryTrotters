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
import { sameName } from './team.js';

// food: what it likes best (on its card and in "Pet items"; any item still
// feeds any pet, this is just for fun).
export const SPECIES = [
  { id: 'cat', name: 'Cat', food: 'tuna' },
  { id: 'dog', name: 'Dog', food: 'peanut butter biscuits' },
  { id: 'bunny', name: 'Bunny', food: 'carrot tops' },
  { id: 'fox', name: 'Fox', food: 'blackberries' },
  { id: 'owl', name: 'Owl', food: 'crunchy crickets' },
  { id: 'frog', name: 'Frog', food: 'fruit flies' },
  { id: 'panda', name: 'Panda', food: 'bamboo shoots' },
  { id: 'monkey', name: 'Proboscis monkey', food: 'mango leaves' },
  { id: 'cassowary', name: 'Cassowary', food: 'figs' },
  { id: 'redpanda', name: 'Red panda', food: 'bamboo leaves' },
  { id: 'hedgehog', name: 'Hedgehog', food: 'mealworms' },
  { id: 'chicken', name: 'Chicken', food: 'corn' },
  // also: other words for it, so "Request a pet" knows it's already here.
  { id: 'gem', name: 'Gem', food: 'sunshine', also: ['gemstone', 'crystal', 'jewel', 'green amethyst', 'prasiolite'] },
  { id: 'goat', name: 'Goat', food: 'clover', also: ['billy goat', 'nanny goat', 'pygmy goat'] },
  { id: 'molerat', name: 'Naked mole rat', food: 'sweet potato', also: ['mole rat', 'mole-rat', 'naked mole-rat', 'sand puppy'] },
  { id: 'starmole', name: 'Star-nosed mole', food: 'earthworms', also: ['star nosed mole', 'starnosed mole', 'mole'] },
  { id: 'goldendoodle', name: 'Goldendoodle', food: 'pupcakes', also: ['doodle', 'golden doodle', 'groodle'] },
];
export const isSpecies = (id) => SPECIES.some((s) => s.id === id);
export const speciesOf = (id) => SPECIES.find((s) => s.id === id) || null;

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
// Level 2 at 6 xp (about an hour and a half), 3 at 24, 5 at 96 and 10 at 486,
// the curve it always had. Past level 10 (3.2), every level costs the same 60
// xp, about four 3-hour lab days (16 xp a day): level 30 at 1,686 (~105 lab
// days), the level 50 Royal crown at 2,886 (~180, about a school year) and the
// level 100 jersey at 5,886 (~370). Any xp is the same level or higher than
// before 3.2, never lower.
export const MAX_LEVEL = 100;
export const CURVE_BEND = 10;
export const XP_PER_LEVEL = 60;
export const xpFor = (level) => (level <= CURVE_BEND ? 6 * (level - 1) ** 2 : xpFor(CURVE_BEND) + (level - CURVE_BEND) * XP_PER_LEVEL);
export function levelOf(xp) {
  const x = Math.max(0, Number(xp) || 0);
  const bend = xpFor(CURVE_BEND);
  const raw = x < bend + XP_PER_LEVEL ? 1 + Math.floor(Math.sqrt(x / 6)) : CURVE_BEND + Math.floor((x - bend) / XP_PER_LEVEL);
  const level = Math.min(MAX_LEVEL, raw);
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

// ---------------------------------------------------------------------------
// Levels unlock cosmetic things (nothing here touches coins or helps anyone):
// a title for each stretch of levels, gear to dress the pet in, fur tints,
// a ring around its little chat badge, and one baby per pet at level 10.
// The tables, the checks and the pet/gift moves are plain functions of the
// data, so the app, demo mode and the server (functions/market.js) agree.
// ---------------------------------------------------------------------------

export const TITLES = [
  { level: 1, title: 'Rookie' },
  { level: 3, title: 'Sidekick' },
  { level: 5, title: 'Regular' },
  { level: 10, title: 'Veteran' },
  { level: 13, title: 'Pit Crew' },
  { level: 16, title: 'Ace' },
  { level: 20, title: 'Champion' },
  { level: 25, title: 'Legend' },
  { level: 30, title: 'Hall of Famer' },
  { level: 40, title: 'Icon' },
  { level: 50, title: 'Royalty' },
  { level: 60, title: 'Titan' },
  { level: 75, title: 'Mythic' },
  { level: 90, title: 'Immortal' },
  { level: 100, title: 'All-Star' },
];
export const titleOf = (level) => [...TITLES].reverse().find((t) => t.level <= (level || 1))?.title || TITLES[0].title;

// slot: where it goes. One of each slot at a time (the palette tints the fur).
export const GEAR_SLOTS = [
  { id: 'head', name: 'Head' },
  { id: 'face', name: 'Face' },
  { id: 'neck', name: 'Neck' },
  { id: 'body', name: 'Outfit' },
  { id: 'extra', name: 'Extra' },
  { id: 'palette', name: 'Fur tint' },
];
export const GEAR = [
  { id: 'bandana', name: 'Bandana', slot: 'neck', level: 2 },
  { id: 'cap', name: 'Team cap', slot: 'head', level: 4 },
  { id: 'bowtie', name: 'Bow tie', slot: 'neck', level: 6 },
  { id: 'safety', name: 'Safety glasses', slot: 'face', level: 7 },
  { id: 'sunset', name: 'Sunset', slot: 'palette', level: 8 },
  { id: 'hardhat', name: 'Hard hat', slot: 'head', level: 10 },
  { id: 'headset', name: 'Headset', slot: 'head', level: 12 },
  { id: 'medal', name: 'Medal', slot: 'neck', level: 15 },
  { id: 'midnight', name: 'Midnight', slot: 'palette', level: 15 },
  { id: 'crimson', name: 'Crimson', slot: 'palette', level: 15 },
  { id: 'sunglasses', name: 'Sunglasses', slot: 'face', level: 18 },
  { id: 'goldmedal', name: 'Gold medal', slot: 'neck', level: 22 },
  { id: 'crown', name: 'Crown', slot: 'head', level: 25 },
  { id: 'golden', name: 'Golden', slot: 'palette', level: 25 },
  { id: 'monocle', name: 'Monocle', slot: 'face', level: 28 },
  { id: 'halo', name: 'Halo', slot: 'extra', level: 30 },
  // Past 30 (3.2): a grander crown than the level 25 one, and the team jersey.
  { id: 'royalcrown', name: 'Royal crown', slot: 'head', level: 50 },
  { id: 'jersey', name: 'Number 12 jersey', slot: 'body', level: 100 },
];
export const gearItem = (id) => GEAR.find((g) => g.id === id) || null;
export const unlockedGear = (level) => GEAR.filter((g) => g.level <= (level || 1));

// Event gear (team events, shared/events.js): limited items that a pet of any
// level can wear, but only for a person who earned it in the event (the
// server keeps that list in petUnlocks/{personId}). Not part of GEAR, so the
// level path and "next unlock" never mention it. `earn` finishes the sentence
// "Earn it in …" on the locked tile.
export const EVENT_GEAR = [
  { id: 'medal-nov14', name: 'Nov 14 medal', slot: 'neck', earn: 'Competition week' },
  { id: 'pitcrew-cap', name: 'Pit crew cap', slot: 'head', earn: 'Competition week' },
];
export const eventGearItem = (id) => EVENT_GEAR.find((g) => g.id === id) || null;
// Any piece a pet can wear, level gear or event gear.
const anyGear = (id) => gearItem(id) || eventGearItem(id);

// The ring around the small badge next to a name in chat.
export const RINGS = [
  { level: 10, id: 'bronze', name: 'Bronze ring' },
  { level: 20, id: 'silver', name: 'Silver ring' },
  { level: 30, id: 'gold', name: 'Gold ring' },
  { level: 50, id: 'platinum', name: 'Platinum ring' },
  { level: 75, id: 'diamond', name: 'Diamond ring' },
  { level: 100, id: 'allstar', name: 'All-Star ring' },
];
export const ringOf = (level) => [...RINGS].reverse().find((r) => r.level <= (level || 1))?.id || '';

// A pet can have one baby, once, from this level.
export const BABY_LEVEL = 10;
// How many pets a person can have (3.2): another one (adopted, a baby or a
// gift) once every pet they have is at GROW_LEVEL or more. No fixed number,
// just a safety limit of MAX_PETS.
export const GROW_LEVEL = 5;
export const MAX_PETS = 20;
// Why a person can't get another pet right now ({ note }), or null.
// pets: [{ name, level }] for every pet they have.
export function roomBlock(pets) {
  if (pets.length >= MAX_PETS) return note(`You have ${MAX_PETS} pets.`, 'That’s the most one person can have. Give one to a teammate first.');
  const young = pets.filter((p) => (p.level || 1) < GROW_LEVEL).sort((a, b) => (a.level || 1) - (b.level || 1));
  if (!young.length) return null;
  const who = young.map((p) => `${p.name || 'Your pet'} is level ${p.level || 1}`);
  const list = who.length > 2 ? `${who.slice(0, 2).join(', ')}, and ${who.length - 2} more aren’t there yet` : who.join(' and ');
  return note(
    `Grow your pets to level ${GROW_LEVEL} first.`,
    `You can get another pet once every pet you have is level ${GROW_LEVEL} or more. ${list}.`,
  );
}

// What the next level-up brings (gear or a ring), or null at the top.
export function nextUnlock(level) {
  const lv = level || 1;
  const all = [
    ...GEAR.map((g) => ({ kind: 'gear', id: g.id, name: g.name, slot: g.slot, level: g.level })),
    ...RINGS.map((r) => ({ kind: 'ring', id: r.id, name: r.name, slot: 'ring', level: r.level })),
  ].filter((u) => u.level > lv);
  all.sort((a, b) => a.level - b.level);
  return all[0] || null;
}
// Every level that brings something, for the "Level path" list.
export function levelPath() {
  const rows = new Map();
  const row = (level) => {
    if (!rows.has(level)) rows.set(level, { level, title: '', unlocks: [] });
    return rows.get(level);
  };
  for (const t of TITLES) row(t.level).title = t.title;
  for (const g of GEAR) row(g.level).unlocks.push({ kind: 'gear', name: g.name, slot: g.slot });
  for (const r of RINGS) row(r.level).unlocks.push({ kind: 'ring', name: r.name, slot: 'ring' });
  row(GROW_LEVEL).unlocks.push({ kind: 'room', name: 'Counts toward another pet', slot: 'room' });
  row(BABY_LEVEL).unlocks.push({ kind: 'baby', name: 'Can have a baby', slot: 'baby' });
  return [...rows.values()].sort((a, b) => a.level - b.level);
}

// What a pet wears: an id or '' for each slot.
export const emptyGear = () => ({ head: '', face: '', neck: '', body: '', extra: '', palette: '' });
export function cleanGear(gear) {
  const out = emptyGear();
  for (const s of GEAR_SLOTS) {
    const g = anyGear(gear?.[s.id]);
    if (g && g.slot === s.id) out[s.id] = g.id;
  }
  return out;
}
// A gear choice, checked against the pet's level: { gear } or { error }.
// earned: the event gear its owner has earned (ids); event gear needs it at
// any level, and level gear never does.
export function gearCheck(gear, level, earned = []) {
  if (!gear || typeof gear !== 'object') return { error: 'Pick what to wear.' };
  const out = emptyGear();
  for (const s of GEAR_SLOTS) {
    const id = gear[s.id];
    if (id === undefined || id === null || id === '') continue;
    const e = eventGearItem(String(id));
    if (e) {
      if (e.slot !== s.id) return { error: 'That doesn’t go there.' };
      if (!earned.includes(e.id)) return { error: `${e.name} is limited. Earn it in ${e.earn}.` };
      out[s.id] = e.id;
      continue;
    }
    const g = gearItem(String(id));
    if (!g || g.slot !== s.id) return { error: 'That doesn’t go there.' };
    if (g.level > level) return { error: `${g.name} unlocks at level ${g.level}.` };
    out[s.id] = g.id;
  }
  return { gear: out };
}

// ---- Pets in a doc: pets/{personId} holds a person's first pet at the top,
// the second (a baby, or a gift) in `extra`, and any more after that in the
// list `more` (3.2; older apps read the first two as before). Each pet is
// told apart by when it was born or came to its owner (adoptedAt).
const note = (title, body = '') => ({ note: { title, body } });
const first = (n) => (n || 'Someone').split(' ')[0];
export const cleanPetName = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

const bare = (p) => {
  const { person: _p, extra: _e, more: _m, id: _i, ...rest } = p || {};
  return rest;
};
export function petsIn(doc) {
  if (!doc) return [];
  const { extra, more, ...main } = doc;
  const rest = [extra, ...(Array.isArray(more) ? more : [])].filter((p) => p && typeof p === 'object');
  return [main, ...rest.map((p) => ({ ...bare(p), person: doc.person }))];
}
export function docOf(person, list) {
  if (!list.length) return null;
  const [a, b, ...rest] = list;
  const { extra: _e, more: _m, ...top } = a;
  return { ...top, person, ...(b && { extra: bare(b) }), ...(rest.length && { more: rest.map(bare) }) };
}
// The doc with one pet (by its place in petsIn) changed.
export function withPet(doc, i, patch) {
  const list = petsIn(doc);
  return docOf(doc.person, list.map((p, k) => (k === i ? { ...p, ...patch } : p)));
}
const pickPet = (list, born) => (born === undefined || born === null ? 0 : list.findIndex((p) => p.adoptedAt === Number(born)));
export const newPet = (species, name, now) => ({
  species,
  name,
  adoptedAt: now,
  food: { v: START_NEED, at: now },
  fun: { v: START_NEED, at: now },
  inChat: true,
  cared: 0,
  gear: emptyGear(),
  babyBorn: false,
});
const levelAt = (pet, shifts, now) => levelOf(petXp(pet.person, shifts, pet.adoptedAt || 0, now)).level;

// Why a pet can't have its baby yet, or null. levels: [{ name, level }] for
// every pet its owner has (the baby needs room, like any new pet).
export function hatchBlock(pet, level, levels = []) {
  if (level < BABY_LEVEL) return note(`${pet.name} isn’t ready yet.`, `A pet can have a baby at level ${BABY_LEVEL}.`);
  if (pet.babyBorn) return note(`${pet.name} already had a baby.`, 'Each pet can have just one.');
  return roomBlock(levels);
}
// Each of a person's pets with its level now, for roomBlock and hatchBlock.
export const levelsOf = (list, shifts = [], now = Date.now()) => list.map((p) => ({ name: p.name, level: levelAt(p, shifts, now) }));

// The moves on your own pets: adopt, rename, inChat, release, style, hatch.
// doc: your pets doc (or null). earned: the event gear you have earned.
// Returns { note }, { unknown } or
// { ok, doc } (doc: what to save, or null to delete it), plus `born` for a baby.
export function petEdit(action, input = {}, { me, doc, shifts = [], earned = [], now = Date.now() }) {
  const list = petsIn(doc);
  const name = cleanPetName(input.name);
  if (action === 'adopt') {
    const block = roomBlock(levelsOf(list.map((p) => ({ ...p, person: me })), shifts, now));
    if (block) return block;
    if (!isSpecies(input.species)) return note('Pick a pet.');
    if (!name) return note('Give your pet a name.');
    const born = Math.max(now, ...list.map((p) => (p.adoptedAt || 0) + 1));
    return { ok: true, doc: docOf(me, [...list, newPet(input.species, name, born)]), born };
  }
  if (!['rename', 'inChat', 'release', 'style', 'hatch'].includes(action)) return { unknown: true };
  if (!list.length) return note('You don’t have a pet.');
  const i = pickPet(list, input.born);
  if (i < 0) return note('That pet isn’t yours anymore.');
  const pet = { ...list[i], person: me };
  const swap = (patch, more = []) => ({
    ok: true,
    doc: docOf(me, [...list.map((p, k) => (k === i ? { ...p, ...patch } : p)), ...more]),
  });
  if (action === 'rename') return name ? swap({ name }) : note('Give your pet a name.');
  if (action === 'inChat') return swap({ inChat: input.on === true });
  // Releasing the first pet moves the next one up to the top of the doc.
  if (action === 'release') return { ok: true, doc: docOf(me, list.filter((_, k) => k !== i)) };
  const level = levelAt(pet, shifts, now);
  if (action === 'style') {
    const g = gearCheck(input.gear, level, earned);
    return g.error ? note(g.error) : swap({ gear: g.gear });
  }
  // hatch: one baby per pet, from level 10, when there's room for another pet.
  const block = hatchBlock(pet, level, levelsOf(list.map((p) => ({ ...p, person: me })), shifts, now));
  if (block) return block;
  if (!name) return note('Give the baby a name.');
  const born = Math.max(now, ...list.map((p) => (p.adoptedAt || 0) + 1));
  const r = swap({ babyBorn: true }, [{ ...newPet(pet.species, name, born), person: me }]);
  return { ...r, born };
}

// ---- Giving a pet to a teammate (petGifts/{id}). An offer waits a week.
export const GIFT_DAYS = 7;
export const giftOpen = (g, now = Date.now()) => !!g && g.status === 'pending' && (g.at || 0) + GIFT_DAYS * DAY > now;

// A new offer: { note } or { ok, gift }.
// to: the teammate (current name); toOk: they have joined the app and are let
// in. gifts: offers already made by you (any status).
export function giftOffer(input = {}, { me, doc, to, toOk, gifts = [], shifts = [], now = Date.now() }) {
  const list = petsIn(doc);
  if (!list.length) return note('You don’t have a pet.');
  const i = pickPet(list, input.born);
  if (i < 0) return note('That pet isn’t yours anymore.');
  const pet = { ...list[i], person: me };
  if (!to) return note('Pick a teammate.');
  if (sameName(to, me)) return note('That’s you.', 'Pick a teammate to give it to.');
  if (!toOk) return note(`${first(to)} isn’t on the team in the app yet.`, 'They need to be signed in and let in first.');
  if (gifts.some((g) => giftOpen(g, now) && g.pet?.adoptedAt === pet.adoptedAt))
    return note(`${pet.name} is already offered.`, 'Cancel that offer to change it.');
  return {
    ok: true,
    gift: {
      from: me,
      to,
      pet: {
        species: pet.species,
        name: pet.name,
        gear: cleanGear(pet.gear),
        adoptedAt: pet.adoptedAt,
        level: levelAt(pet, shifts, now),
        babyBorn: pet.babyBorn === true,
      },
      at: now,
      status: 'pending',
    },
  };
}

// The recipient says yes, if there's room for another pet (roomBlock). doc:
// your pets doc; giverDoc: theirs; giver: their current name; shifts: for
// your pets' levels. Returns { note } (with `status` when the offer itself is now
// void or out of time) or { ok, doc, giverDoc, pet }.
export function giftAccept(gift, { me, doc, giverDoc, giver, shifts = [], now = Date.now() }) {
  if (!gift || gift.status !== 'pending') return note('That offer is already settled.');
  if (!giftOpen(gift, now)) return { ...note('That offer ran out.', `Offers last ${GIFT_DAYS} days.`), status: 'expired' };
  const list = petsIn(doc);
  const block = roomBlock(levelsOf(list.map((p) => ({ ...p, person: me })), shifts, now));
  if (block) return block;
  const theirs = petsIn(giverDoc);
  const j = theirs.findIndex((p) => p.adoptedAt === gift.pet?.adoptedAt);
  if (j < 0) return { ...note(`${gift.pet?.name || 'That pet'} isn’t with ${first(giver)} anymore.`), status: 'void' };
  const { person: _p, ...kept } = theirs[j];
  // It keeps its name, needs and whether it had a baby; its level starts over
  // with the new owner's lab time, and its gear was for the level it had.
  const pet = { ...kept, adoptedAt: Math.max(now, ...list.map((p) => (p.adoptedAt || 0) + 1)), gear: emptyGear(), cared: 0, inChat: true };
  return { ok: true, doc: docOf(me, [...list, pet]), giverDoc: docOf(giver, theirs.filter((_, k) => k !== j)), pet };
}

// Cancel (the giver) or decline (the recipient): { note } or { ok, status }.
export function giftEnd(kind, gift, { me, rename = (n) => n, now = Date.now() }) {
  if (!gift) return note('That offer is gone.');
  if (rename(kind === 'cancel' ? gift.from : gift.to) !== me) return note('That isn’t yours to answer.');
  if (gift.status !== 'pending') return note('That offer is already settled.');
  if (!giftOpen(gift, now)) return { ...note('That offer ran out.', `Offers last ${GIFT_DAYS} days.`), status: 'expired' };
  return { ok: true, status: kind === 'cancel' ? 'cancelled' : 'declined' };
}
