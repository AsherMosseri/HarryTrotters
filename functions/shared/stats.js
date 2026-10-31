// Season stats for the Shifts page and Today: team hours, tasks finished, and
// practice runs logged, for the season, this week, and last week. Weeks are
// the team's (New York), Monday to Sunday. Hours are added up like
// everywhere else (shared/hours.js): one person's overlapping shifts count once.

import { teamDay, teamMidnight } from './coins.js';
import { msByPerson } from './hours.js';
import { addDay, weekStart } from './streaks.js';

const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
const sum = (m) => [...m.values()].reduce((t, x) => t + x, 0);

// { hours, tasks, runs }, each { season, week, last } (hours in ms).
// shifts: under current names. runs: the match log ({ type, date }).
export function seasonStats({ shifts = [], tasks = [], runs = [], now = Date.now() }) {
  const monday = weekStart(teamDay(now));
  const weekFrom = teamMidnight(monday);
  const lastFrom = teamMidnight(addDay(monday, -7));
  const inWeek = (ms) => ms >= weekFrom;
  const inLast = (ms) => ms >= lastFrom && ms < weekFrom;

  const hours = {
    season: sum(msByPerson(shifts, now)),
    week: sum(msByPerson(shifts, now, (s) => inWeek(s.start))),
    last: sum(msByPerson(shifts, now, (s) => inLast(s.start))),
  };

  const done = tasks.filter((t) => t.status === 'done' && !t.deletedAt).map((t) => toMs(t.completedAt));
  const taskStats = { season: done.length, week: done.filter(inWeek).length, last: done.filter(inLast).length };

  // A run without a type is a practice run (the match log's default).
  const practice = runs.filter((r) => (r.type || 'practice') === 'practice').map((r) => r.date || '');
  const lastMonday = addDay(monday, -7);
  const runStats = {
    season: practice.length,
    week: practice.filter((d) => d >= monday).length,
    last: practice.filter((d) => d >= lastMonday && d < monday).length,
  };

  return { hours, tasks: taskStats, runs: runStats };
}

// "up 8 from last week", "down 2 from last week", "same as last week".
// diff in the same units as the numbers shown.
export function versusLastWeek(diff) {
  if (!diff) return 'same as last week';
  return `${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} from last week`;
}
