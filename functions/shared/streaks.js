// Shift streaks, the same on profiles, the lab log's "nice work" screen, and
// anything on the server that wants them. Days and weeks are the team's
// (New York), weeks start on Monday.
//
// weekly: weeks in a row with at least one shift.
// daily: school days in a row with at least one shift (shared/school.js).
// Days without school (weekends, holidays, breaks) never break the daily
// streak, and a shift on one doesn't add to it.
// The current week (or school day) counts once it has a shift; until then the
// streak still stands from before, since there's time left to keep it going.

import { teamDay } from './coins.js';
import { isSchoolDay } from './school.js';

export const addDay = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// The Monday of a day's week ('YYYY-MM-DD').
export const weekStart = (day) => addDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

// The team days someone had a shift on. A shift that runs past midnight
// counts for both days. shifts: under current names (rename first).
export function shiftDays(name, shifts, now = Date.now()) {
  const days = new Set();
  for (const s of shifts) {
    if (s.person !== name || !Number.isFinite(s.start)) continue;
    const last = teamDay(Math.max(s.start, s.end ?? now));
    for (let d = teamDay(s.start), i = 0; d <= last && i < 3; d = addDay(d, 1), i++) days.add(d);
  }
  return days;
}

// { daily, weekly, today, thisWeek }: the two streaks, and whether today
// (a school day) and this week already count.
export function streaksOf(name, shifts, now = Date.now()) {
  const days = shiftDays(name, shifts, now);
  const today = teamDay(now);

  let daily = 0;
  const todayCounts = isSchoolDay(today) && days.has(today);
  if (todayCounts) daily = 1;
  // Back from yesterday, skipping days without school; about two school years at most.
  for (let d = addDay(today, -1), i = 0; i < 800; d = addDay(d, -1), i++) {
    if (!isSchoolDay(d)) continue;
    if (!days.has(d)) break;
    daily++;
  }

  const weeks = new Set([...days].map(weekStart));
  const thisWeek = weekStart(today);
  let weekly = weeks.has(thisWeek) ? 1 : 0;
  for (let w = addDay(thisWeek, -7); weeks.has(w); w = addDay(w, -7)) weekly++;

  return { daily, weekly, today: todayCounts, thisWeek: weeks.has(thisWeek) };
}

// "3 school days", "1 week"
export const streakLabel = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;

// Short lines for the lab log's "nice work" screen, e.g.
// ["4 school days in a row at the lab", "6 weeks in a row"]. Empty when
// there's no streak worth a line.
export function streakLines({ daily, weekly }) {
  const out = [];
  if (daily > 1) out.push(`${streakLabel(daily, 'school day')} in a row at the lab`);
  if (weekly > 1) out.push(`${streakLabel(weekly, 'week')} in a row`);
  return out;
}
