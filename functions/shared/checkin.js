// The lab check-in schedule (settings/team.checkinSchedule), shared by the
// app and the scheduledCheckin function so both agree on which days it's asked:
// { on, mode: 'school' | 'days', days: [0-6], time: 'HH:MM', skip: ['YYYY-MM-DD'], question, slots, off }
// mode 'school' asks on school days (school.js); 'days' (or no mode, as saved
// before school days existed) on the picked weekdays. Days in skip are never asked;
// off holds single times not asked on a day (below).

import { isSchoolDay } from './school.js';

export const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();

// Whether the schedule asks on this day, before any skips.
export function scheduledOn(s, day) {
  if (!s?.on) return false;
  return s.mode === 'school' ? isSchoolDay(day) : (s.days || []).includes(weekdayOf(day));
}

// The first school day after this one ("Not tomorrow" on a Friday is Monday,
// or later after a long weekend).
export function nextSchoolDay(day) {
  let d = addDays(day, 1);
  for (let i = 0; i < 60 && !isSchoolDay(d); i++) d = addDays(d, 1);
  return d;
}

// The next n days the schedule would ask on (skipped ones included), from `from` on.
export function upcomingDays(s, from, n = 15) {
  const out = [];
  for (let d = from, i = 0; out.length < n && i < 120; d = addDays(d, 1), i++) if (scheduledOn(s, d)) out.push(d);
  return out;
}

// Skipped days to save: no past days (so the list doesn't grow forever), no
// repeats, in order.
export const cleanSkips = (skip, today) => [...new Set((skip || []).filter((d) => /^\d{4}-\d\d-\d\d$/.test(d) && d >= today))].sort();

// ---------- times not asked (3.2.7) ----------
// Team management can mark one time of a day (lunch or after school) as not
// available, with a reason or none ("Lab closed for a teacher meeting"):
// - for a day the schedule will ask on: checkinSchedule.off =
//   { 'YYYY-MM-DD': { lunch: 'reason' } } (the scheduled check-in copies that
//   day's into its own `off` when it's made);
// - on a check-in already asked: checkins/{id}.off = { after: '' }.
// The reason is '' for none. A time that's off isn't asked: answers only need
// the open ones, and answers people already gave for it are kept but don't
// count or show while it's off. Every time off: that day isn't asked at all.
export const OFF_REASON_MAX = 100;
export const SLOT_IDS = ['lunch', 'after'];
export const cleanReason = (r) => String(r ?? '').replace(/\s+/g, ' ').trim().slice(0, OFF_REASON_MAX);

// A check-in's (or a schedule day's) times that are off: { slot: reason }, only
// the times it asks.
export function offOf(c) {
  const off = c?.off && typeof c.off === 'object' ? c.off : {};
  return Object.fromEntries((c?.slots || []).filter((s) => typeof off[s] === 'string').map((s) => [s, off[s]]));
}
// The times a check-in still asks.
export const openSlots = (c) => (c?.slots || []).filter((s) => !(s in offOf(c)));
// Has this answer (null: none) covered every time still asked?
export const answeredAll = (c, answer) => openSlots(c).every((s) => typeof answer?.[s] === 'boolean');

// The times off on one day of the schedule: { slot: reason }.
export function scheduleOffOn(s, day) {
  const off = s?.off?.[day];
  return offOf({ slots: s?.slots || [], off });
}
// Whether the schedule asks on this day: scheduled, not skipped, and at least
// one of its times still open.
export const asksOn = (s, day) =>
  scheduledOn(s, day) && !(s.skip || []).includes(day) && (s.slots || []).some((x) => !(x in scheduleOffOn(s, day)));

// What the scheduled check-in for this day starts with (the server's
// scheduledCheckin and the demo's): its times, and the ones off that day.
export function scheduledCheckinFields(s, day) {
  const off = scheduleOffOn(s, day);
  return { slots: s.slots, ...(Object.keys(off).length && { off }) };
}

// Times off to save on the schedule: only days from today on, known times,
// tidy reasons, no empty days.
export function cleanOff(off, today) {
  const out = {};
  for (const [day, v] of Object.entries(off && typeof off === 'object' ? off : {})) {
    if (!/^\d{4}-\d\d-\d\d$/.test(day) || day < today || !v || typeof v !== 'object') continue;
    const slots = Object.fromEntries(SLOT_IDS.filter((s) => typeof v[s] === 'string').map((s) => [s, cleanReason(v[s])]));
    if (Object.keys(slots).length) out[day] = slots;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
// One time turned off (reason a string, '' for none) or back on (reason null).
export function withOff(off, day, slot, reason) {
  const next = { ...(off || {}) };
  const dayOff = { ...(next[day] || {}) };
  if (reason == null) delete dayOff[slot];
  else dayOff[slot] = cleanReason(reason);
  if (Object.keys(dayOff).length) next[day] = dayOff;
  else delete next[day];
  return next;
}
// "Not available: Lab closed for a teacher meeting", or just "Not available".
export const offText = (reason) => (reason ? `Not available: ${reason}` : 'Not available');
// What changed between two schedules' times off: [{ day, slot, reason }]
// (reason null: back on), so a day's check-in already asked can follow.
export function offChanges(before, after) {
  const out = [];
  const days = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const day of [...days].sort())
    for (const slot of SLOT_IDS) {
      const a = before?.[day]?.[slot];
      const b = after?.[day]?.[slot];
      if (a !== b && (typeof a === 'string' || typeof b === 'string')) out.push({ day, slot, reason: typeof b === 'string' ? b : null });
    }
  return out;
}
