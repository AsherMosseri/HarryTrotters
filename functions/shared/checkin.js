// The lab check-in schedule (settings/team.checkinSchedule), shared by the
// app and the scheduledCheckin function so both agree on which days it's asked:
// { on, mode: 'school' | 'days', days: [0-6], time: 'HH:MM', skip: ['YYYY-MM-DD'], question, slots }
// mode 'school' asks on school days (school.js); 'days' (or no mode, as saved
// before school days existed) on the picked weekdays. Days in skip are never asked.

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
export const asksOn = (s, day) => scheduledOn(s, day) && !(s.skip || []).includes(day);

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
