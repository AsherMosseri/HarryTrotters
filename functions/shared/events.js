// Team events (3.0.4): the whole team's lab time over a few days fills a
// meter, and every tier it reaches gives the people who helped something to
// wear on their pets. Plain math on the team's data, the same in the app,
// demo mode and on the server (functions/petevents.js):
//
// - Progress is the team's lab time inside the event's window, counted from
//   shift records only, the way coins count it: a shift is cut at team
//   midnight (America/New_York), each person's pieces of a day are merged
//   (overlaps count once) and a day is capped at the coin day cap (10 h).
//   A phone never sends hours.
// - A tier is reached once. The people with at least MIN_HOURS of their own
//   time in the window at that moment share in it (the list is frozen then).
// - The reward is event gear (shared/pets.js EVENT_GEAR): cosmetic only, and
//   nothing here touches coins.
//
// An event doc (petEvents/{id}), written only by the server:
//   { title, startsAt, endsAt, goalHours, tiers: [{ hours, label, gear? }],
//     reward: { gear: [ids] }, createdBy, createdAt, status: 'active'|'ended',
//     endedAt?, endedBy?, updatedAt?,
//     progress: { ms, hours, tier, contrib: [{ name, hours }], updatedAt },
//     reached: { [tierIndex]: { at, people: [names] } } }

import { COIN_DEFAULTS, nextMidnight, teamDay, teamMidnight } from './coins.js';
import { HOUR, mergedMs } from './hours.js';
import { eventGearItem } from './pets.js';

// Your own hours in the window before you share in a reward.
export const MIN_HOURS = 1;
export const MAX_TIERS = 6;
export const MAX_OPEN_EVENTS = 5;
export const MAX_DAYS = 31;
// How long a refresh stays fresh (the app asks often; the server does the sums).
export const REFRESH_MS = 60000;

// The first event, created by the server the first time anyone asks (and by
// the schedule): Competition week, Monday Nov 9 through Saturday Nov 14 2026,
// team time. 20 / 40 / 60 team hours; the cap at 40, the medal at 60.
export const SEED_ID = 'competition-week-2026';
export function seedEvent(createdBy = 'Team management', now = Date.now()) {
  const tiers = [
    { hours: 20, label: 'Warm-up' },
    { hours: 40, label: 'Halfway', gear: 'pitcrew-cap' },
    { hours: 60, label: 'Goal', gear: 'medal-nov14' },
  ];
  return {
    title: 'Competition week',
    startsAt: teamMidnight('2026-11-09'),
    endsAt: nextMidnight('2026-11-14'),
    goalHours: 60,
    tiers,
    reward: { gear: rewardGear(tiers) },
    createdBy,
    createdAt: now,
    status: 'active',
  };
}
const rewardGear = (tiers) => [...new Set(tiers.map((t) => t.gear).filter(Boolean))];

// Where an event stands: upcoming, live, over (its days passed) or ended
// (team management ended it early).
export function statusOf(ev, now = Date.now()) {
  if (ev.status === 'ended') return 'ended';
  if (now < ev.startsAt) return 'upcoming';
  return now < ev.endsAt ? 'live' : 'over';
}
// The moment lab time stops counting: the end of the window, or when it was ended.
export const countsUntil = (ev, now = Date.now()) => Math.min(now, ev.endsAt, ev.endedAt ?? Infinity);

// Everything counted already, so asking again changes nothing.
export function isFinal(ev, now = Date.now()) {
  const done = ev.status === 'ended' || now >= ev.endsAt;
  return done && (ev.progress?.updatedAt ?? 0) >= Math.min(ev.endsAt, ev.endedAt ?? Infinity);
}
// Does a refresh need to do the sums? Not before it starts, not once final,
// and not twice inside REFRESH_MS unless forced.
export function stale(ev, now = Date.now(), force = false) {
  if (ev.status !== 'ended' && now < ev.startsAt) return false;
  if (isFinal(ev, now)) return false;
  // Over (or ended) but last counted before the end: one more count, now.
  if (ev.status === 'ended' || now >= ev.endsAt) return true;
  return force || !ev.progress || now - (ev.progress.updatedAt || 0) >= REFRESH_MS;
}

// Each person's counted time inside the event: Map name → ms. shifts: under
// current names. dayCapHours: the coin day cap.
export function eventMs(ev, shifts, { now = Date.now(), dayCapHours = COIN_DEFAULTS.dayCap } = {}) {
  const from = ev.startsAt;
  const to = countsUntil(ev, now);
  const out = new Map();
  if (!(to > from)) return out;
  const byPerson = new Map();
  for (const s of shifts) {
    if (!s.person || !Number.isFinite(s.start)) continue;
    // A shift still running counts up to now, like everywhere else.
    const end = Math.min(Math.max(s.start, s.end ?? now), to);
    const start = Math.max(s.start, from);
    if (end <= start) continue;
    const days = byPerson.get(s.person) || byPerson.set(s.person, new Map()).get(s.person);
    // Cut at team midnight so each day counts (and caps) only its own time.
    for (let day = teamDay(start), i = 0; i < 400; i++) {
      const next = nextMidnight(day);
      days.set(day, [...(days.get(day) || []), { start: Math.max(start, teamMidnight(day)), end: Math.min(end, next) }]);
      if (end <= next) break;
      day = teamDay(next);
    }
  }
  const cap = dayCapHours * HOUR;
  for (const [name, days] of byPerson) {
    let ms = 0;
    for (const list of days.values()) ms += Math.min(mergedMs(list, to), cap);
    if (ms > 0) out.set(name, ms);
  }
  return out;
}

// Hours to one decimal, rounded down, so "19.9 of 20" is never shown as "20".
export const hoursDown = (ms) => Math.floor((ms / HOUR) * 10 + 1e-9) / 10;

// The sums for one event right now. Returns the patch to save on the event
// doc and what is new: [{ tier, label, gear, people }] for each tier reached
// for the first time (people: names with MIN_HOURS or more, frozen now).
export function advance(ev, shifts, { now = Date.now(), dayCapHours } = {}) {
  const by = eventMs(ev, shifts, { now, dayCapHours });
  let total = 0;
  for (const ms of by.values()) total += ms;
  const tiers = ev.tiers || [];
  const reached = { ...(ev.reached || {}) };
  const newly = [];
  tiers.forEach((t, i) => {
    if (reached[i] || total < t.hours * HOUR) return;
    const people = [...by].filter(([, ms]) => ms >= MIN_HOURS * HOUR).map(([name]) => name).sort();
    reached[i] = { at: now, people };
    newly.push({ tier: i, label: t.label, hours: t.hours, gear: t.gear || '', people });
  });
  const contrib = [...by].map(([name, ms]) => ({ name, hours: hoursDown(ms) })).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const progress = { ms: total, hours: hoursDown(total), tier: tiers.filter((_, i) => reached[i]).length, contrib, updatedAt: now };
  return { patch: { progress, reached }, progress, newly };
}

// What an unlocks doc (petUnlocks/{personId}) holds after new gear.
// doc: what is there now (or null). Returns { person, gear: { [id]: { event, tier, at } } } to merge.
export function unlockAfter(doc, person, newGear = []) {
  const gear = { ...(doc?.gear || {}) };
  for (const g of newGear) if (!gear[g.id]) gear[g.id] = { event: g.event, title: g.title, tier: g.tier, at: g.at };
  return { person, gear };
}
// The event gear ids a person has earned.
export const earnedIds = (doc) => Object.keys(doc?.gear || {}).filter((id) => eventGearItem(id));
// Earned and not yet celebrated on any device.
export const unseenIds = (doc) => earnedIds(doc).filter((id) => !doc?.seen?.[id]);

// ---- Team management: make or change an event ----
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const goodDay = (d) => DAY_RE.test(String(d)) && teamDay(teamMidnight(d)) === d;
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : NaN;
};
export const anyReached = (ev) => Object.keys(ev?.reached || {}).length > 0;

// A new or changed event from the form: { startDay, endDay, title, goalHours,
// tiers: [{ hours, label, gear }] } (days are team days, both included).
// existing: the event being changed. Returns { error } or { event } (the
// doc, without progress).
export function cleanEvent(input = {}, { me = 'Team management', now = Date.now(), existing = null } = {}) {
  if (existing && statusOf(existing, now) === 'ended') return { error: 'That event was ended.' };
  const title = clean(input.title, 60);
  if (!title) return { error: 'Give the event a title.' };
  if (!goodDay(input.startDay) || !goodDay(input.endDay)) return { error: 'Pick the first and last day.' };
  if (input.endDay < input.startDay) return { error: 'The last day comes before the first.' };
  const startsAt = teamMidnight(input.startDay);
  const endsAt = nextMidnight(input.endDay);
  if ((endsAt - startsAt) / 86400000 > MAX_DAYS + 0.1) return { error: `An event can run ${MAX_DAYS} days at most.` };
  if (endsAt <= now) return { error: 'That event would already be over. Pick later days.' };
  const goalHours = num(input.goalHours);
  if (!(goalHours >= 1 && goalHours <= 1000)) return { error: 'The goal is between 1 and 1000 hours.' };
  const raw = Array.isArray(input.tiers) ? input.tiers : [];
  if (!raw.length || raw.length > MAX_TIERS) return { error: `Add 1 to ${MAX_TIERS} tiers.` };
  const tiers = [];
  for (const t of raw) {
    const hours = num(t?.hours);
    if (!(hours > 0)) return { error: 'Each tier needs a number of hours.' };
    if (tiers.length && hours <= tiers.at(-1).hours) return { error: 'Tiers go up: each needs more hours than the one before.' };
    if (hours > goalHours) return { error: 'A tier can’t be past the goal.' };
    const gear = String(t?.gear || '');
    if (gear && !eventGearItem(gear)) return { error: 'That reward isn’t one the app has.' };
    if (gear && tiers.some((x) => x.gear === gear)) return { error: 'Each reward can go on one tier only.' };
    tiers.push({ hours, label: clean(t?.label, 24) || `${hours} h`, ...(gear && { gear }) });
  }
  if (existing && anyReached(existing)) {
    // Someone already got a reward: what they were promised stays put.
    const same = JSON.stringify(existing.tiers) === JSON.stringify(tiers) && existing.startsAt === startsAt;
    if (!same) return { error: 'A tier was reached, so the first day, the tiers and the rewards are locked. You can change the title, the last day and the goal.' };
  }
  const event = {
    title,
    startsAt,
    endsAt,
    goalHours,
    tiers,
    reward: { gear: rewardGear(tiers) },
    createdBy: existing?.createdBy || me,
    createdAt: existing?.createdAt || now,
    status: 'active',
    ...(existing && { updatedAt: now, updatedBy: me }),
  };
  return { event };
}

// ---- What the screens show ----
// ev with the viewer's name (current spelling) → plain numbers and flags.
export function eventView(ev, { me = '', now = Date.now(), rename = (n) => n } = {}) {
  const status = statusOf(ev, now);
  const p = ev.progress || { hours: 0, tier: 0, contrib: [] };
  const goal = ev.goalHours || 1;
  const mine = (p.contrib || []).filter((c) => rename(c.name) === me).reduce((t, c) => t + c.hours, 0);
  const tiers = (ev.tiers || []).map((t, i) => ({
    ...t,
    i,
    done: !!ev.reached?.[i],
    at: pctOf(t.hours, goal),
    gearName: t.gear ? eventGearItem(t.gear)?.name || '' : '',
  }));
  const next = tiers.find((t) => !t.done) || null;
  const left = status === 'live' ? ev.endsAt - now : status === 'upcoming' ? ev.startsAt - now : 0;
  return {
    status,
    hours: p.hours || 0,
    goal,
    pct: pctOf(p.hours || 0, goal),
    mine: Math.round(mine * 10) / 10,
    tiers,
    next,
    toNext: next ? Math.max(0, Math.ceil((next.hours - (p.hours || 0)) * 10) / 10) : 0,
    left,
    done: tiers.length > 0 && tiers.every((t) => t.done),
    shares: (who) => tiers.filter((t) => t.done && (ev.reached[t.i].people || []).some((n) => rename(n) === who)),
  };
}
const pctOf = (h, goal) => Math.max(0, Math.min(100, Math.round((h / goal) * 1000) / 10));

// The events to show on Today and in the park: the ones running or coming up
// soon, then recent ones (this week) so a finished party isn't missed.
export function shownEvents(events = [], now = Date.now()) {
  const WEEK = 7 * 86400000;
  return events
    .filter((e) => {
      const s = statusOf(e, now);
      if (s === 'live') return true;
      if (s === 'upcoming') return e.startsAt - now < 14 * 86400000;
      return now - Math.min(e.endsAt, e.endedAt ?? Infinity) < WEEK;
    })
    .sort((a, b) => rank(a, now) - rank(b, now) || a.startsAt - b.startsAt);
}
const rank = (e, now) => ({ live: 0, upcoming: 1, over: 2, ended: 3 })[statusOf(e, now)];

// "2 days left", "6 hours left", "starts in 3 days".
export function leftLabel(v) {
  const m = Math.max(0, Math.round(v.left / 60000));
  const h = Math.round(m / 60);
  const d = Math.floor(m / 1440);
  const span = m < 60 ? `${Math.max(1, m)} min` : m < 2880 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${d} days`;
  if (v.status === 'live') return `${span} left`;
  if (v.status === 'upcoming') return `starts in ${span}`;
  return v.status === 'ended' ? 'Ended early' : 'Over';
}
