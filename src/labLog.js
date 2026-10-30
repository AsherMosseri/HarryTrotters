// The lab log: what each person did at the lab, one log per person per day
// (labLogs/<day>_<person-id>). Ending a shift asks for it; #lab-log shows a
// Trotbot post per day with everyone's logs (made by the onLabLog function).
import { personId } from './data/diff.js';
import { hoursOf, msByPerson } from '../functions/shared/hours.js';

export const LAB_LOG_CHANNEL = 'lab-log';
// Shifts shorter than this (a mis-tap, a quick stop) don't need a log.
export const MIN_SHIFT = 10 * 60000;
// Logs are asked for shifts that ended after the lab log came out (version 2.70).
export const LAB_LOG_START = Date.parse('2026-10-28T16:30:00Z');

const pad = (n) => String(n).padStart(2, '0');
// The day a time falls on, on this device: 2026-10-28.
export const dayOf = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const logId = (day, name) => `${day}_${personId(name)}`;
export const dayLabel = (day) =>
  new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

// Hours each person spent at the lab on a day (shifts that started that day).
export function hoursOn(day, shifts, now = Date.now()) {
  const by = msByPerson(shifts || [], now, (s) => dayOf(s.start) === day);
  return Object.fromEntries([...by].filter(([, ms]) => ms > 0).map(([n, ms]) => [n, hoursOf(ms)]));
}

// The first day this person still owes a log for: a shift of theirs that
// ended (by them, by team management, or by itself overnight) with no log
// for its day. Null if they're all caught up.
export function missingLogDay(name, shifts, logs) {
  const have = new Set((logs || []).filter((l) => l.person === name).map((l) => l.day));
  const owed = (shifts || [])
    .filter((s) => s.person === name && s.end && s.end >= LAB_LOG_START && s.end - s.start >= MIN_SHIFT && !have.has(dayOf(s.start)))
    .sort((a, b) => a.start - b.start);
  return owed.length ? dayOf(owed[0].start) : null;
}
