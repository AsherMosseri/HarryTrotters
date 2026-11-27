// Pets can die (3.3). The rule Asher chose, as plain functions the server
// (functions/petdeath.js), the demo (src/data/demoPetDeath.js) and the app
// (the warning on a pet's card) all run, so they always agree:
//
// - A pet dies after a week of neglect: food AND fun both showing 0 for 7
//   days straight. Needs run down on their own (DECAY in pets.js), so the
//   streak's start is worked out from the stored needs: the moment the later
//   of the two reached 0. Any care that lifts food or fun above 0 moves that
//   moment later, which starts the streak over.
// - Warnings go to the owner on day 3, day 5 and day 6 of a streak, once each.
// - While the owner is inactive (shared/activity.js) the pet sleeps: it can't
//   die and the clock doesn't run. When they're active again it starts fresh.
// - Asher can turn pet death off for a person (they ask, he answers): their
//   pets still get hungry but can't die. Turning it back on starts fresh too.
// - When a pet dies, a funeral card goes up in #general, the owner is told,
//   the pet leaves their pets for a memorial everyone can see, and any open
//   offer to give it away is cancelled. They can adopt again once 3 teammates
//   paid respects, or after 3 days, whichever comes first.
//
// The server keeps a little on each pet (`neglect`, written only by it):
//   { from, start, stage, asleep, off }
//   from    the clock never counts from before this (when it was first
//           watched, woke up, or had death turned back on)
//   start   the streak the warnings in `stage` belong to
//   stage   the last warning sent for that streak (0, 3, 5 or 6)
//   asleep  the owner was inactive at the last check
//   off     pet death was off for the owner at the last check
// Nothing here touches coins.

import { DECAY, levelOf, petXp, stageOf, cleanGear } from './pets.js';
import { sameName } from './team.js';

export const NEGLECT_DAYS = 7;
export const WARN_DAYS = [3, 5, 6];
export const RESPECTS_NEEDED = 3;
export const ADOPT_WAIT_DAYS = 3;
export const REASON_MAX = 140;
// Pay respects to, ask, answer: the actions on the `pet` callable.
export const DEATH_ACTIONS = ['respects', 'deathAsk', 'deathAnswer'];
const DAY = 86400000;

const note = (title, body = '') => ({ note: { title, body } });
const first = (n) => (n || 'Someone').split(' ')[0];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// When a need first shows 0 (needNow rounds, so under half a point), in ms.
export function zeroAt(pet, key) {
  const n = pet?.[key];
  const born = Number(pet?.adoptedAt) || 0;
  if (!n || !Number.isFinite(n.v)) return born;
  // No time stored: needNow doesn't run it down.
  if (!n.at) return n.v < 0.5 ? born : Infinity;
  return Math.ceil(n.at + (Math.max(0, n.v - 0.5) * DAY) / DECAY[key]);
}

const kept = (n = {}) => ({
  from: Number(n.from) || 0,
  start: Number(n.start) || 0,
  stage: Number(n.stage) || 0,
  asleep: n.asleep === true,
  off: n.off === true,
});
const differs = (a, b) => ['from', 'start', 'stage', 'asleep', 'off'].some((k) => a[k] !== b[k]);

// When this streak began (both needs at 0 since then), or 0 when they aren't
// both at 0. Never earlier than the pet came to its owner or than `from`.
export function streakStart(pet, from, now = Date.now()) {
  const start = Math.max(zeroAt(pet, 'food'), zeroAt(pet, 'fun'), Number(pet?.adoptedAt) || 0, Number(from) || 0);
  return start <= now ? start : 0;
}

// What happens to one pet now. Run again on the saved result it changes
// nothing (a pet dies once, each warning goes once).
//   asleep: its owner is inactive; off: pet death is off for its owner.
// Returns { status, day, left, start, warn, patch }
//   status  'fine' | 'asleep' | 'off' | 'neglected' (the streak is running) | 'dies'
//   day     whole days into the streak (0 on its first day)
//   left    days until it dies, while neglected
//   warn    the warning to send now (3, 5 or 6), or 0
//   patch   the `neglect` to save on the pet, or null when nothing changed
export function petFate(pet, { now = Date.now(), asleep = false, off = false } = {}) {
  const was = kept(pet?.neglect);
  const n = { ...was };
  // Not watched yet (a pet from before 3.3, or a new one): from now on.
  if (!pet?.neglect || !was.from) n.from = now;
  if (asleep) n.asleep = true;
  else if (was.asleep) Object.assign(n, { asleep: false, from: now });
  if (off) n.off = true;
  else if (was.off) Object.assign(n, { off: false, from: now });
  const out = (status, extra = {}) => ({ status, day: 0, left: 0, start: 0, warn: 0, patch: !pet?.neglect || differs(n, was) ? n : null, ...extra });
  if (asleep) return out('asleep');
  if (off) return out('off');
  const start = streakStart(pet, n.from, now);
  if (!start) return out('fine');
  const day = Math.floor((now - start) / DAY);
  if (day >= NEGLECT_DAYS) return out('dies', { day, start });
  const stage = [...WARN_DAYS].reverse().find((d) => d <= day) || 0;
  const sent = n.start === start ? n.stage : 0;
  let warn = 0;
  if (stage > sent) {
    // Only the latest one (a check that was late doesn't send two at once).
    Object.assign(n, { start, stage });
    warn = stage;
  }
  return out('neglected', { day, start, left: NEGLECT_DAYS - day, warn });
}

// The warning the owner gets (stage 3, 5 or 6).
export function warnNote(petName, stage) {
  const left = NEGLECT_DAYS - stage;
  return {
    title: `${petName} is starving and bored`,
    body: `Feed or play with it, or it won’t make it. ${left === 1 ? 'Less than a day' : `About ${plural(left, 'day')}`} left. Pet items are in Market, Pets.`,
  };
}

// On the pet's own card while the streak runs.
export function neglectLine(petName, fate) {
  if (fate?.status !== 'neglected') return '';
  const left = fate.left === 1 ? 'Less than a day left.' : `${fate.left} days left.`;
  return `${petName} has had no food or fun for ${plural(fate.day, 'day')}. ${left} A snack or a toy saves it.`;
}

// ---- When a pet dies ----

// "3 days", "2 weeks", "4 months".
export function livedText(adoptedAt, diedAt) {
  const days = Math.max(0, Math.floor((diedAt - (adoptedAt || diedAt)) / DAY));
  if (days < 1) return 'less than a day';
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.floor(days / 7), 'week');
  if (days < 730) return plural(Math.floor(days / 30), 'month');
  return plural(Math.floor(days / 365), 'year');
}

// The memorial's id: the pets doc's id and when the pet came to its owner,
// so the same pet can only ever have one (two checks at once write the same doc).
export const memorialId = (docId, pet) => `${docId}-${Number(pet?.adoptedAt) || 0}`;

// The memorial record (petMemorials/{id}) for a pet that died.
//   person: its owner's current name; shifts: under current names (its level)
//   photo: the approved photo when it showed as the pet ({ url, w, h }), or null
export function memorialOf(pet, { id, person, shifts = [], now = Date.now(), photo = null }) {
  const level = levelOf(petXp(person, shifts, pet.adoptedAt || 0, now)).level;
  return {
    id,
    person,
    species: pet.species,
    name: pet.name || 'Their pet',
    level,
    stage: stageOf(level),
    gear: cleanGear(pet.gear, pet.species),
    adoptedAt: Number(pet.adoptedAt) || 0,
    diedAt: now,
    lived: livedText(pet.adoptedAt, now),
    photo: photo?.url ? { url: photo.url, w: photo.w || 0, h: photo.h || 0 } : null,
    respects: [],
    msgId: `funeral-${id}`,
  };
}

// The card in #general: channels/general/messages/{memorial.msgId}.
export function funeralPost(m) {
  return {
    text: `🌈 ${m.name} crossed the rainbow bridge. In memory of ${first(m.person)}’s ${m.species}, level ${m.level}, who was with us for ${m.lived}.`,
    by: 'Trotbot',
    byUid: 'trotbot',
    bot: true,
    at: m.diedAt,
    cmd: {
      name: 'funeral',
      id: m.id,
      person: m.person,
      pet: { name: m.name, species: m.species, level: m.level, stage: m.stage, gear: m.gear, lived: m.lived, photo: m.photo },
      line: `${m.name} crossed the rainbow bridge`,
    },
    mentions: [],
    taskIds: [],
    replyTo: null,
    reactions: {},
    photo: null,
  };
}

// The owner's gentle notification.
export function deathNote(m) {
  return {
    title: `${m.name} crossed the rainbow bridge`,
    body: `We’re sorry. ${m.name} went a week without food or fun. Teammates can pay respects in #general, and you can adopt again once ${RESPECTS_NEEDED} of them do, or in ${ADOPT_WAIT_DAYS} days.`,
  };
}

// Who paid respects (current names, each once, never the owner).
export function respectsOf(m, rename = (n) => n) {
  const owner = rename(m?.person || '');
  const out = [];
  for (const r of m?.respects || []) {
    const n = rename(r?.name || '');
    if (n && !sameName(n, owner) && !out.some((x) => sameName(x, n))) out.push(n);
  }
  return out;
}

// Paying respects: { note } or { ok, already } or { ok, respects } (the list to save).
export function respectsCheck(m, { me, rename = (n) => n, now = Date.now() }) {
  if (!m) return note('That memorial is gone.');
  if (sameName(rename(m.person || ''), me)) return note('Your teammates pay respects here.', `${m.name} knew you loved it.`);
  if (respectsOf(m, rename).some((n) => sameName(n, me))) return { ok: true, already: true };
  if ((m.respects || []).length >= 200) return { ok: true, already: true };
  return { ok: true, respects: [...(m.respects || []), { name: me, at: now }] };
}

// When the owner can adopt again: once RESPECTS_NEEDED teammates paid
// respects, or ADOPT_WAIT_DAYS after it died, whichever comes first.
export const adoptAt = (m) => (Number(m?.diedAt) || 0) + ADOPT_WAIT_DAYS * DAY;
export const adoptFree = (m, now = Date.now(), rename = (n) => n) => respectsOf(m, rename).length >= RESPECTS_NEEDED || now >= adoptAt(m);

// The memorial still holding back a new adoption for `me` (the one that frees
// up last), or null. memorials: any list; only `me`'s count.
export function adoptWait(memorials, { me, now = Date.now(), rename = (n) => n }) {
  const mine = (memorials || []).filter((m) => sameName(rename(m?.person || ''), me) && !adoptFree(m, now, rename));
  if (!mine.length) return null;
  const m = mine.sort((a, b) => adoptAt(b) - adoptAt(a))[0];
  const have = respectsOf(m, rename).length;
  return { memorial: m, until: adoptAt(m), respects: have, need: RESPECTS_NEEDED - have };
}
// "in 2 days", "tomorrow", "in 5 hours".
export function untilText(until, now = Date.now()) {
  const h = Math.max(1, Math.ceil((until - now) / 3600000));
  if (h < 24) return `in ${plural(h, 'hour')}`;
  const d = Math.ceil(h / 24);
  return d === 1 ? 'tomorrow' : `in ${d} days`;
}
// The words for it (the adopt screen, the server's answer).
export function adoptWaitText(w, now = Date.now()) {
  if (!w) return '';
  return `You can adopt again once ${plural(w.need, 'more teammate')} ${w.need === 1 ? 'pays' : 'pay'} respects to ${w.memorial.name}, or ${untilText(w.until, now)}.`;
}
export function adoptWaitNote(w, now = Date.now()) {
  return note(`Not yet. ${w.memorial.name} is still being remembered.`, adoptWaitText(w, now));
}

// Open offers to give this pet away (shared/pets.js giftOpen), to cancel.
export const giftsFor = (gifts, pet, open) => (gifts || []).filter((g) => open(g) && Number(g.pet?.adoptedAt) === Number(pet?.adoptedAt));

// ---- Asking Asher to turn pet death off (petDeathOff/{personId}) ----
// One doc per person (under the id of the name they first asked with):
//   { by, status, reason, at, note, decidedBy, decidedAt }
//   status 'pending'   waiting for Asher
//          'declined'  he said no (note: why); they can ask again
//          'off'       approved: their pets can't die (they still get hungry)
//          'on'        he turned it back on (note: why); they can ask again
export const cleanReason = (s) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, REASON_MAX);
export const deathOff = (doc) => doc?.status === 'off';

// The names (current spellings) with pet death off.
export function offNames(docs, rename = (n) => n) {
  return new Set((docs || []).filter(deathOff).map((d) => rename(d.by || '')).filter(Boolean));
}

// Asking: { note } or { doc } to save. owner: Asher (his own ask is just done).
export function askCheck(input, { me, doc, owner, now = Date.now() }) {
  if (doc?.status === 'pending') return note('You already asked.', 'Asher will answer soon.');
  if (doc?.status === 'off') return note('Pet death is already off for you.');
  const reason = cleanReason(input?.reason);
  const base = { by: me, reason, at: now, note: '', decidedBy: '', decidedAt: 0 };
  if (owner && sameName(me, owner)) return { doc: { ...base, status: 'off', decidedBy: me, decidedAt: now } };
  return { doc: { ...base, status: 'pending' } };
}

// Asher's answer: decision 'approve' | 'decline' (a waiting ask) or
// 'restore' (turn it back on for someone it's off for). note: why (they see it).
// Returns { note } or { doc, told }.
export function answerCheck(input, { doc, me, now = Date.now() }) {
  const decision = input?.decision;
  if (!['approve', 'decline', 'restore'].includes(decision)) return note('Approve, decline or turn back on?');
  const why = cleanReason(input?.note);
  if (decision === 'restore') {
    if (!deathOff(doc)) return note('Pet death isn’t off for them.');
    return { doc: { ...doc, status: 'on', note: why || 'Asher turned it back on.', decidedBy: me, decidedAt: now }, told: 'on' };
  }
  if (doc?.status !== 'pending') return note('That ask was already answered.');
  if (decision === 'decline') return { doc: { ...doc, status: 'declined', note: why || 'Asher said no for now.', decidedBy: me, decidedAt: now }, told: 'declined' };
  return { doc: { ...doc, status: 'off', note: why || 'Asher said yes.', decidedBy: me, decidedAt: now }, told: 'off' };
}

// What the person hears.
export function answerNote(told, doc) {
  if (told === 'off') return { title: 'Pet death is off for you', body: `${doc.note} Your pets can’t die now, but they still get hungry.` };
  if (told === 'declined') return { title: 'Pet death stays on for you', body: `${doc.note} You can ask again later.` };
  return { title: 'Pet death is back on for you', body: `${doc.note} The week starts fresh from now.` };
}

// A pet's `neglect` when pet death is switched for its owner right away (the
// server's next check would get there too): off marks it; back on starts the
// clock fresh.
export function neglectWithOff(neglect, off, now = Date.now()) {
  const n = kept(neglect);
  if (off) return { ...n, from: n.from || now, off: true };
  if (n.off) return { ...n, off: false, from: now };
  return neglect ? n : { ...n, from: now };
}
