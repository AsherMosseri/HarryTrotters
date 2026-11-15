// The season's competitions (functions/shared/competitions.js, 3.2.11):
// sorting, the next one, multi-day events, the event being today, all past,
// empty, the old single competitionDate, the team's (New York) day against
// UTC, FTC Events imports, and competition mode following the list.
// Run: node scripts/test-competitions.mjs
import {
  DEFAULT_COMPETITION_DATE,
  cleanCompetition,
  compStatus,
  competitionList,
  countdownDay,
  dayDiff,
  daysUntil,
  isDay,
  kindFromName,
  lastDay,
  mergeFtcEvents,
  nextCompetition,
  recapCompetition,
  sortCompetitions,
  splitCompetitions,
  todaysCompetition,
  withCompetition,
} from '../functions/shared/competitions.js';
import { competitionOn, competitionOnFor, queueAlertsDue } from '../functions/shared/matches.js';
import { teamDay } from '../functions/shared/coins.js';
import { packOn, PACKS } from '../src/adPacks.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const ids = (list) => list.map((c) => c.id);

const scrim = { id: 's', name: 'Brooklyn Scrimmage', start: '2026-11-01', kind: 'scrimmage' };
const meet = { id: 'm', name: 'League Meet 2', start: '2026-12-05', code: 'usnyl2' };
const qual = { id: 'q', name: 'NYC Qualifier', start: '2027-01-16', end: '2027-01-17', place: 'Queens, NY' };
const champ = { id: 'c', name: 'State Championship', start: '2027-03-06', end: '2027-03-07' };
const all = [champ, qual, scrim, meet];

// ---------- days ----------
eq(isDay('2026-11-14'), true, 'a real day');
eq(isDay('2026-02-30'), false, 'Feb 30 is not a day');
eq(isDay('2026-1-4'), false, 'needs two-digit months and days');
eq(isDay(undefined), false, 'nothing is not a day');
eq(dayDiff('2026-11-14', '2026-11-15'), 1, 'one day');
eq(dayDiff('2026-03-07', '2026-03-09'), 2, 'across the spring DST change: still 2');
eq(dayDiff('2026-12-31', '2027-01-01'), 1, 'across the new year');

// ---------- cleaning ----------
eq(cleanCompetition({ name: '  ', start: '2026-12-01' }), null, 'no name: dropped');
eq(cleanCompetition({ name: 'X', start: 'soon' }), null, 'no real start: dropped');
eq(cleanCompetition({ id: 'a', name: 'X', start: '2026-12-02', end: '2026-12-01' }), { id: 'a', name: 'X', start: '2026-12-02' }, 'an end before the start is dropped');
eq(cleanCompetition({ id: 'a', name: 'X', start: '2026-12-02', end: '2026-12-02' }), { id: 'a', name: 'X', start: '2026-12-02' }, 'an end on the start day is dropped');
eq(cleanCompetition({ id: 'a', name: 'X', start: '2026-12-02', kind: 'party', code: 'us-ny q1!' }), { id: 'a', name: 'X', start: '2026-12-02', code: 'USNYQ1' }, 'unknown kind dropped, code tidied');
eq(cleanCompetition({ id: 'a', name: 'X'.repeat(300), start: '2026-12-02' }).name.length, 120, 'name capped at 120');
eq(!!cleanCompetition({ name: 'No id', start: '2026-12-02' }).id, true, 'gets an id when it has none');

// ---------- sorting ----------
eq(ids(sortCompetitions(all)), ['s', 'm', 'q', 'c'], 'sorted by start');
eq(
  ids(sortCompetitions([{ id: 'b', name: 'B', start: '2026-12-01', end: '2026-12-03' }, { id: 'a', name: 'A', start: '2026-12-01' }, { id: 'c', name: 'A2', start: '2026-12-01' }])),
  ['a', 'c', 'b'],
  'same start: the shorter first, then by name',
);
eq(all.map((c) => c.id), ['c', 'q', 's', 'm'], 'sorting leaves the original alone');

// ---------- the next one ----------
eq(nextCompetition(all, '2026-10-20')?.id, 's', 'before everything: the first');
eq(nextCompetition(all, '2026-11-01')?.id, 's', 'on a one-day event: that event');
eq(nextCompetition(all, '2026-11-02')?.id, 'm', 'the day after: the next one');
eq(nextCompetition(all, '2027-01-16')?.id, 'q', 'first day of a two-day event: that event');
eq(nextCompetition(all, '2027-01-17')?.id, 'q', 'second day of a two-day event: still that event');
eq(nextCompetition(all, '2027-01-18')?.id, 'c', 'the day after it ends: the next one');
eq(nextCompetition(all, '2027-03-08'), null, 'all past: none');
eq(nextCompetition([], '2026-11-15'), null, 'empty: none');

eq(compStatus(qual, '2027-01-15'), 'upcoming', 'the day before: upcoming');
eq(compStatus(qual, '2027-01-16'), 'today', 'first day: today');
eq(compStatus(qual, '2027-01-17'), 'today', 'last day: today');
eq(compStatus(qual, '2027-01-18'), 'past', 'after: past');
eq(lastDay(qual), '2027-01-17', 'last day of a two-day event');
eq(lastDay(meet), '2026-12-05', 'last day of a one-day event');
eq(todaysCompetition(all, '2027-01-17')?.id, 'q', 'today’s competition during a two-day event');
eq(todaysCompetition(all, '2027-01-15'), null, 'no competition today the day before');

eq(daysUntil(meet, '2026-11-15'), 20, '20 days to go');
eq(daysUntil(meet, '2026-12-05'), 0, '0 on the day');
eq(daysUntil(qual, '2027-01-17'), 0, '0 on the second day, never negative');
eq(daysUntil(null, '2026-11-15'), null, 'no competition: null, never NaN');
eq(countdownDay(qual, '2027-01-17'), '2027-01-17', 'the countdown day during an event is today');
eq(countdownDay(meet, '2026-11-15'), '2026-12-05', 'the countdown day before is the start');
eq(countdownDay(null, '2026-11-15'), '', 'no countdown day without one');

const split = splitCompetitions(all, '2026-12-06');
eq([ids(split.upcoming), ids(split.past)], [['q', 'c'], ['m', 's']], 'upcoming soonest first, past latest first');
eq(ids(splitCompetitions(all, '2027-01-17').upcoming)[0], 'q', 'an event on now is with the upcoming ones');

// ---------- old data ----------
eq(competitionList({ competitionDate: '2026-11-14' }), [{ id: 'first', name: 'Competition', start: '2026-11-14' }], 'only competitionDate: one competition');
eq(
  competitionList({ competitionDate: '2026-12-12', compEvent: { code: 'usnyq1', name: 'NYC Qualifier' } }),
  [{ id: 'first', name: 'NYC Qualifier', start: '2026-12-12', code: 'USNYQ1' }],
  'the old date takes the pit screen’s event name and code',
);
eq(competitionList({}), [{ id: 'first', name: 'Competition', start: DEFAULT_COMPETITION_DATE }], 'nothing saved: the first season’s date');
eq(competitionList({ competitions: [], competitionDate: '2026-12-12' }), [], 'a saved, emptied list stays empty (the old date doesn’t come back)');
eq(ids(competitionList({ competitions: [champ, { name: '', start: 'x' }, scrim], competitionDate: '2026-12-12' })), ['s', 'c'], 'a saved list wins, cleaned and sorted');
eq(nextCompetition(competitionList({ competitionDate: '2026-11-14' }), '2026-11-15'), null, 'the old date, now past: nothing upcoming');

// ---------- New York's day, not UTC ----------
// 11:30 PM in New York on Dec 4 is already Dec 5 in UTC.
const lateNY = Date.parse('2026-12-05T04:30:00Z');
eq(new Date(lateNY).toISOString().slice(0, 10), '2026-12-05', 'UTC already says Dec 5');
eq(teamDay(lateNY), '2026-12-04', 'the team’s day is still Dec 4');
eq(daysUntil(nextCompetition(all, teamDay(lateNY)), teamDay(lateNY)), 1, 'so the meet is 1 day away, not today');
eq(competitionOn('auto', teamDay(lateNY), nextCompetition(all, teamDay(lateNY))), false, 'and competition mode isn’t on yet');
const justAfterMidnightNY = Date.parse('2026-12-05T05:01:00Z');
eq(competitionOn('auto', teamDay(justAfterMidnightNY), nextCompetition(all, teamDay(justAfterMidnightNY))), true, 'just after midnight in New York: it’s on');
// The second day of the qualifier, late evening in New York (UTC is the 18th).
const lastNight = Date.parse('2027-01-18T03:00:00Z');
eq(nextCompetition(all, teamDay(lastNight))?.id, 'q', 'late on the last day (UTC says the next day): still the qualifier');

// ---------- competition mode ----------
eq(competitionOn('auto', '2027-01-17', qual), true, 'on during the second day');
eq(competitionOn('auto', '2027-01-18', qual), false, 'off after');
eq(competitionOn('auto', '2026-11-14', '2026-11-14'), true, 'a plain day still works');
eq(competitionOn('auto', '2026-11-14', null), false, 'nothing coming up: off');
eq(competitionOn('off', '2027-01-16', qual), false, 'off by hand');
eq(competitionOn('on', '2026-11-20', null, 1000, 2000), true, 'on by hand, even with nothing coming up');
eq(competitionOnFor({ competitions: all }, '2027-01-17'), true, 'from settings: on during the qualifier');
eq(competitionOnFor({ competitions: all }, '2027-01-18'), false, 'from settings: off the day after');
eq(competitionOnFor({ competitionDate: '2026-11-14' }, '2026-11-14'), true, 'old settings: on on the old date');
eq(competitionOnFor({ competitions: [] }, '2026-11-14'), false, 'an empty list: off (not the old default)');
{
  const now = Date.parse('2027-01-17T15:00:00Z');
  const matches = [{ id: 'x-q3', event: 'X', label: 'Q3', level: 'qual', number: 3, time: now + 10 * 60000 }];
  eq(queueAlertsDue({ matches, settings: { competitions: all }, now, today: teamDay(now) }).length, 1, 'queue alerts on the second day of the event');
  eq(queueAlertsDue({ matches, settings: { competitions: [scrim] }, now, today: teamDay(now) }).length, 0, 'no queue alerts with no event today');
}

// ---------- the recap's countdown ----------
eq(recapCompetition({ competitions: all }, '2026-11-15'), { name: 'League Meet 2', date: '2026-12-05' }, 'the recap counts to the next one');
eq(recapCompetition({ competitions: all }, '2027-01-17'), null, 'no recap countdown while one is on');
eq(recapCompetition({ competitions: [scrim] }, '2026-11-15'), null, 'none coming up: no countdown');

// ---------- the competition ad pack ----------
const pack = PACKS.find((p) => p.id === 'competition');
eq(packOn(pack, 'auto', '2026-11-25', countdownDay(nextCompetition(all, '2026-11-25'), '2026-11-25')), true, '10 days before the meet: the pack runs');
eq(packOn(pack, 'auto', '2026-11-15', countdownDay(nextCompetition(all, '2026-11-15'), '2026-11-15')), false, '20 days before: not yet');
eq(packOn(pack, 'auto', '2027-01-17', countdownDay(nextCompetition(all, '2027-01-17'), '2027-01-17')), true, 'second day of an event: still on');
eq(packOn(pack, 'auto', '2027-03-20', countdownDay(nextCompetition(all, '2027-03-20'), '2027-03-20')), false, 'all past: off');

// ---------- editing ----------
{
  const added = withCompetition([scrim], 'n', { name: 'New', start: '2026-10-01' });
  eq(ids(added), ['n', 's'], 'adding keeps the list sorted');
  eq(ids(withCompetition(added, 'n', { name: 'New', start: '2027-05-01' })), ['s', 'n'], 'moving a date re-sorts');
  eq(ids(withCompetition(added, 'n', null)), ['s'], 'removing one');
  eq(ids(withCompetition(added, 'n', { name: '', start: '2027-05-01' })), ['s'], 'a change that empties the name removes nothing else');
}

// ---------- FTC Events ----------
eq(kindFromName('NYC Qualifier'), 'qualifier', 'a qualifier');
eq(kindFromName('NY Excelsior League Meet 2'), 'league', 'a league meet');
eq(kindFromName('New York State Championship'), 'championship', 'a championship');
eq(kindFromName('Fall Scrimmage'), 'scrimmage', 'a scrimmage');
eq(kindFromName('Robot Expo'), '', 'unknown: no kind');
{
  const events = [
    { code: 'USNYL2', name: 'League Meet 2', start: '2026-12-05', city: 'Queens, NY' },
    { code: 'USNYQ9', name: 'NYC Qualifier', start: '2027-02-13', end: '2027-02-14', city: 'New York, NY' },
    { code: 'USNYQ9', name: 'NYC Qualifier (again)', start: '2027-02-13', city: '' },
    { code: 'USNYBAD', name: 'No date', start: '' },
  ];
  const r = mergeFtcEvents([scrim, meet], events);
  eq(r.skipped, 2, 'skips the one already on the list (same code) and a repeat');
  eq(r.added, [{ id: 'ftc-USNYQ9', name: 'NYC Qualifier', start: '2027-02-13', end: '2027-02-14', kind: 'qualifier', place: 'New York, NY', code: 'USNYQ9' }], 'fills name, dates, kind, place and code');
  eq(ids(r.list), ['s', 'm', 'ftc-USNYQ9'], 'the new list, sorted');
  eq(mergeFtcEvents([scrim], []).added.length, 0, 'no events: nothing added');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
