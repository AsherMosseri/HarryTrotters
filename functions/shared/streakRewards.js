// Coins for streak milestones (3.0): a few coins when your daily streak
// (school days in a row at the lab) or weekly streak (weeks in a row) reaches
// a milestone. Paid by the server when a shift ends (functions/life.js),
// through awardCoins with source 'streak' and a one-time key per milestone
// per streak, so a streak pays each milestone once; a new streak (after one
// breaks) can earn them again. Only the highest milestone reached so far is
// paid, so turning this on doesn't pay out a long streak's whole history.
// The app and the server use this same file.

import { teamDay } from './coins.js';
import { isSchoolDay } from './school.js';
import { addDay, shiftDays, streaksOf, weekStart } from './streaks.js';
import { nameKey } from './team.js';

// [streak length, coins]
export const DAILY_MILESTONES = [
  [5, 3],
  [10, 5],
  [20, 8],
  [40, 10],
  [60, 12],
  [100, 15],
];
export const WEEKLY_MILESTONES = [
  [4, 3],
  [8, 5],
  [12, 8],
  [16, 10],
  [26, 12],
  [40, 15],
];

// Where the current streaks started: the first school day (daily) and the
// Monday of the first week (weekly) of the run, or '' with no streak.
export function streakStarts(name, shifts, now = Date.now()) {
  const days = shiftDays(name, shifts, now);
  const { daily, weekly } = streaksOf(name, shifts, now);
  let dailyStart = '';
  if (daily) {
    let left = daily;
    for (let d = teamDay(now), i = 0; left > 0 && i < 900; d = addDay(d, -1), i++) {
      if (isSchoolDay(d) && days.has(d)) {
        dailyStart = d;
        left--;
      }
    }
  }
  let weeklyStart = '';
  if (weekly) {
    const weeks = new Set([...days].map(weekStart));
    let w = weekStart(teamDay(now));
    if (!weeks.has(w)) w = addDay(w, -7);
    while (weeks.has(addDay(w, -7))) w = addDay(w, -7);
    weeklyStart = w;
  }
  return { daily, weekly, dailyStart, weeklyStart };
}

const best = (list, n) => [...list].reverse().find(([at]) => n >= at) || null;

// The milestone awards due for this person right now (at most one daily and
// one weekly): [{ kind, n, amount, key, label }].
export function streakAwards(name, shifts, now = Date.now()) {
  const s = streakStarts(name, shifts, now);
  const pid = nameKey(name);
  const out = [];
  const d = best(DAILY_MILESTONES, s.daily);
  if (d)
    out.push({
      kind: 'daily',
      n: d[0],
      amount: d[1],
      key: `streak-daily-${d[0]}-${pid}-${s.dailyStart}`,
      label: `Streak: ${d[0]} school days in a row`,
    });
  const w = best(WEEKLY_MILESTONES, s.weekly);
  if (w)
    out.push({
      kind: 'weekly',
      n: w[0],
      amount: w[1],
      key: `streak-weekly-${w[0]}-${pid}-${s.weeklyStart}`,
      label: `Streak: ${w[0]} weeks in a row`,
    });
  return out;
}
