// Inactive members (functions/shared/activity.js, 3.2.8): 3 weeks with no lab
// time, new people's 3 weeks to come, team management's override, clocking in
// to come back, and the team's (New York) day edges.
// Run: node scripts/test-inactive.mjs
import {
  INACTIVE_DAYS,
  activityOf,
  inactiveSet,
  joinedByName,
  lastLabAt,
  lastLabText,
  overrideEntry,
  overrideOf,
  teamActivity,
} from '../functions/shared/activity.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const H = 3600000;
const D = 24 * H;
// Noon in New York on a fixed day (EST, UTC-5): 2026-11-06T17:00Z.
const NOW = Date.parse('2026-11-06T17:00:00Z');
const shift = (person, start, hours = 2) => ({ person, start, end: hours == null ? null : start + hours * H });
const A = 'Ira Kumar';

eq(INACTIVE_DAYS, 21, 'three weeks');

// ---------- the automatic rule ----------
eq(activityOf(A, { shifts: [shift(A, NOW - 2 * D)], now: NOW }).inactive, false, 'at the lab 2 days ago: active');
eq(activityOf(A, { shifts: [shift(A, NOW - 20 * D)], now: NOW }).inactive, false, '20 days ago: still active');
eq(activityOf(A, { shifts: [shift(A, NOW - 21 * D)], now: NOW }), { inactive: true, why: 'auto', kept: false, lastAt: NOW - 21 * D + 2 * H, override: '' }, '21 days ago: inactive (auto)');
eq(activityOf(A, { shifts: [shift(A, NOW - 40 * D), shift(A, NOW - 3 * D)], now: NOW }).inactive, false, 'the newest shift counts');
eq(activityOf(A, { shifts: [shift('Someone Else', NOW - D)], now: NOW }).inactive, true, 'someone else’s shift doesn’t count (and no join date: inactive)');
eq(activityOf(A, { shifts: [shift(A, NOW - 30 * D)], joinedAt: NOW - D, now: NOW }).inactive, true, 'old shifts: a recent sign-in doesn’t make them new');

// ---------- clocked in today ----------
const running = shift(A, NOW - H, null);
eq(activityOf(A, { shifts: [shift(A, NOW - 50 * D), running], now: NOW }).inactive, false, 'clocked in now: active at once');
eq(lastLabAt(A, [running], NOW), NOW, 'a running shift is at the lab now');
eq(lastLabAt(A, [shift(A, NOW - 3 * D)], NOW), NOW - 3 * D + 2 * H, 'last time = the end of the last shift');
eq(lastLabAt(A, [], NOW), 0, 'never');

// ---------- new people ----------
eq(activityOf(A, { joinedAt: NOW - 5 * D, now: NOW }).inactive, false, 'joined 5 days ago, not clocked in yet: not inactive');
eq(activityOf(A, { joinedAt: NOW - 20 * D, now: NOW }).inactive, false, 'joined 20 days ago: not yet');
eq(activityOf(A, { joinedAt: NOW - 21 * D, now: NOW }).inactive, true, 'joined 3 weeks ago, never came: inactive');
eq(activityOf(A, { joinedAt: 0, now: NOW }).inactive, true, 'no join date and never came: inactive');
eq(activityOf(A, { joinedAt: NOW + D, now: NOW }).inactive, false, 'a join date in the future counts as now');

// ---------- team management's override ----------
const off = { name: A, mode: 'inactive', at: NOW - 2 * D, by: 'Asher Mosseri' };
eq(activityOf(A, { shifts: [shift(A, NOW - 3 * D)], override: off, now: NOW }).why, 'manual', 'marked inactive: inactive even with a recent shift before it');
eq(activityOf(A, { shifts: [shift(A, NOW - D)], override: off, now: NOW }).inactive, false, 'clocked in after being marked: the mark is cleared');
eq(activityOf(A, { shifts: [shift(A, NOW - 2 * D)], override: off, now: NOW }).inactive, false, 'a shift starting at the very moment of the mark clears it');
eq(activityOf(A, { shifts: [shift(A, NOW - 3 * D, null)], override: off, now: NOW }).inactive, true, 'a shift already running when marked doesn’t clear it');
eq(activityOf(A, { shifts: [shift(A, NOW - 30 * D)], override: { mode: 'active', at: NOW - 40 * D }, now: NOW }), { inactive: false, why: '', kept: true, lastAt: NOW - 30 * D + 2 * H, override: 'active' }, 'kept active: beats the 3 weeks');
eq(activityOf(A, { override: { mode: 'active' }, now: NOW }).inactive, false, 'kept active: never came, still active');
eq(activityOf(A, { shifts: [shift(A, NOW - 30 * D)], override: { mode: 'bogus' }, now: NOW }).why, 'auto', 'an unknown mode is ignored');
eq(activityOf('Asher Mosseri', { override: { mode: 'inactive', at: NOW }, now: NOW }).inactive, false, 'team management are never inactive');
eq(activityOf('Sebastian Tolbert', { now: NOW }).inactive, false, 'team management: never, even with no shifts');

// ---------- the team's day (New York), not the phone's ----------
// Last shift ended 11:30 PM New York on Oct 16 (03:30Z Oct 17). Inactive from
// New York's Nov 6 (21 days later), active through Nov 5 (11:59 PM New York).
const late = Date.parse('2026-10-17T03:30:00Z');
const lateShift = [{ person: A, start: late - H, end: late }];
const nov5late = Date.parse('2026-11-06T04:30:00Z'); // 11:30 PM Nov 5, New York; already Nov 6 in UTC
eq(activityOf(A, { shifts: lateShift, now: nov5late }).inactive, false, '20 New York days: active although UTC says 21');
const nov6early = Date.parse('2026-11-06T05:30:00Z'); // 12:30 AM Nov 6, New York
eq(activityOf(A, { shifts: lateShift, now: nov6early }).inactive, true, 'past midnight in New York: 21 days, inactive');
// A shift that runs past midnight counts for the day it ended.
const overnight = [{ person: A, start: Date.parse('2026-10-16T03:00:00Z'), end: Date.parse('2026-10-16T05:30:00Z') }];
eq(activityOf(A, { shifts: overnight, now: Date.parse('2026-11-06T04:30:00Z') }).inactive, false, 'started Oct 15, ended Oct 16 (New York): 11:30 PM Nov 5 is 20 days');
eq(activityOf(A, { shifts: overnight, now: NOW }).inactive, true, 'ended Oct 16 (New York): Nov 6 is 21 days');
eq(activityOf(A, { shifts: overnight, now: Date.parse('2026-11-05T16:00:00Z') }).inactive, false, 'Nov 5 is 20 days');
// Across daylight saving time (Nov 1): calendar days, not 24-hour blocks.
const beforeDst = [{ person: A, start: Date.parse('2026-10-16T20:00:00Z'), end: Date.parse('2026-10-16T22:00:00Z') }];
eq(activityOf(A, { shifts: beforeDst, now: Date.parse('2026-11-06T04:59:00Z') }).inactive, false, '11:59 PM New York Nov 5: still 20 days across the clock change');
eq(activityOf(A, { shifts: beforeDst, now: Date.parse('2026-11-06T05:00:00Z') }).inactive, true, 'midnight New York Nov 6: 21 days');

// ---------- overrides by name ----------
const overrides = { 'ira-kumar': off, 'old-name': { name: 'Old Name', mode: 'active', at: 1 } };
eq(overrideOf(A, overrides)?.mode, 'inactive', 'found by person id');
eq(overrideOf('New Name', overrides, (n) => (n === 'Old Name' ? 'New Name' : n))?.mode, 'active', 'found through a rename');
eq(overrideOf(A, null), null, 'no overrides');
eq(overrideOf(A, { 'ira-kumar': { mode: 'nope' } }), null, 'a broken entry is ignored');
eq(overrideEntry(A, 'inactive', 'Asher Mosseri', 5), { name: A, mode: 'inactive', at: 5, by: 'Asher Mosseri' }, 'the entry saved');
eq(overrideEntry(A, '', 'Asher Mosseri'), null, 'clear: nothing saved');

// ---------- join dates ----------
const joined = joinedByName(
  [
    { name: A, joinedAt: NOW - 3 * D },
    { name: A, joinedAt: NOW - 30 * D },
    { name: 'Old Name', joinedAt: NOW - 2 * D },
  ],
  [{ name: 'Shrey Kumar', addedAt: NOW - D }, { name: 'Gone', addedAt: NOW, removed: true }],
  (n) => (n === 'Old Name' ? 'New Name' : n),
);
eq(joined.get(A), NOW - 30 * D, 'the earliest device');
eq(joined.get('New Name'), NOW - 2 * D, 'under the current name');
eq(joined.get('Shrey Kumar'), NOW - D, 'added on the Roster');
eq(joined.has('Gone'), false, 'removed people don’t count');

// ---------- the whole team ----------
const team = teamActivity(['Asher Mosseri', A, 'Shrey Kumar', 'New Name', 'Cooper Mlezcko'], {
  shifts: [shift('Old Name', NOW - 40 * D), shift('Cooper Mlezcko', NOW - D), shift(A, NOW - 25 * D)],
  people: [{ name: 'Shrey Kumar', joinedAt: NOW - 4 * D }],
  overrides: { 'cooper-mlezcko': { name: 'Cooper Mlezcko', mode: 'inactive', at: NOW - 2 * D } },
  rename: (n) => (n === 'Old Name' ? 'New Name' : n),
  now: NOW,
});
eq([...inactiveSet(team)].sort(), [A, 'New Name'], 'the team: Ira (25 days) and New Name (renamed, 40 days)');
eq(team.get('Cooper Mlezcko').inactive, false, 'Cooper clocked in after being marked');
eq(team.get('Shrey Kumar').inactive, false, 'Shrey joined 4 days ago');
eq(team.get('New Name').lastAt, NOW - 40 * D + 2 * H, 'old-name shifts count for the new name');

// ---------- words ----------
eq(lastLabText(0, NOW), 'Never clocked in', 'never');
eq(lastLabText(NOW - H, NOW), 'At the lab today', 'today');
eq(lastLabText(NOW - D, NOW), 'Last at the lab yesterday', 'yesterday');
eq(lastLabText(NOW - 23 * D, NOW), 'Last at the lab 23 days ago', 'days');
eq(lastLabText(NOW - 95 * D, NOW), 'Last at the lab 3 months ago', 'months');

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
