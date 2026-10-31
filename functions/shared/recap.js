// The weekly recap (3.0, E1): Trotbot's Sunday 6 PM post in #general, like a
// short team newsletter. The server builds it (functions/life.js) and posts
// it as a card; team management can preview it any time, post it early or
// skip a week; demo mode builds a sample from its own data. The app and the
// server use this same file.
//
// The week is the team's (New York), Monday to Sunday, up to `now`.
//
// Top contributor, by a balanced score. For everyone who did anything this week:
//   score = hours / most hours + tasks finished / most tasks finished
//           + lab log days / most lab log days
// Each part is 0 to 1 (the week's leader in that part gets 1; a part nobody
// scored in adds 0), so hours, tasks and lab logs count the same and a
// long week at the lab can't drown out finishing things. Ties go to more
// hours, then more tasks, then the name.

import { teamDay, teamMidnight } from './coins.js';
import { hoursOf, mergedMs, msByPerson } from './hours.js';
import { addDay, streaksOf, weekStart } from './streaks.js';

const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
const first = (name) => String(name || '').split(' ')[0];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

// Lab log areas (src/labLog.js AREAS), in the order they're shown.
export const RECAP_AREAS = [
  ['general', 'General'],
  ['coding', 'Coding'],
  ['mechanical', 'Mechanical'],
  ['cad', 'CAD'],
  ['electrical', 'Electrical'],
  ['assembly', 'Assembly'],
  ['outreach', 'Outreach'],
];
const AREA_IDS = RECAP_AREAS.map(([id]) => id);

// The week a recap is for: the Monday of `now`'s team week.
export const recapWeek = (now = Date.now()) => weekStart(teamDay(now));

// "Oct 26 – Nov 1"
export function weekLabel(week) {
  const f = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${f(week)} – ${f(addDay(week, 6))}`;
}

// "up 8 from last week" / "down 2.5" / "same as last week"
function versus(now, last, unit = '') {
  const d = Math.round((now - last) * 10) / 10;
  if (!d) return 'same as last week';
  return `${d > 0 ? 'up' : 'down'} ${Math.abs(d)}${unit} from last week`;
}

// The balanced score (see the top of this file). rows: [{ name, hours, tasks, logs }].
export function rankContributors(rows) {
  const max = (k) => Math.max(0, ...rows.map((r) => r[k]));
  const mh = max('hours');
  const mt = max('tasks');
  const ml = max('logs');
  const part = (v, m) => (m > 0 ? v / m : 0);
  return rows
    .map((r) => ({ ...r, score: Math.round((part(r.hours, mh) + part(r.tasks, mt) + part(r.logs, ml)) * 1000) / 1000 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.hours - a.hours || b.tasks - a.tasks || a.name.localeCompare(b.name));
}

// Everything in `data` under current names (rename first):
// { shifts, tasks, logs (this week and last), runs, roster, competition: { name, date } }.
export function buildRecap(data, now = Date.now(), week = recapWeek(now)) {
  const { shifts = [], tasks = [], logs = [], runs = [], roster = [], competition = null } = data;
  const from = teamMidnight(week);
  const to = Math.min(now, teamMidnight(addDay(week, 7)));
  const lastWeek = addDay(week, -7);
  const lastFrom = teamMidnight(lastWeek);
  const nextWeek = addDay(week, 7);
  const inWeek = (ms) => ms >= from && ms < teamMidnight(nextWeek);
  const inLast = (ms) => ms >= lastFrom && ms < from;

  // Hours (one person's overlapping shifts count once).
  const weekShifts = shifts.filter((s) => s.person && Number.isFinite(s.start) && inWeek(s.start));
  const byPerson = msByPerson(weekShifts, to);
  const hoursMs = [...byPerson.values()].reduce((t, x) => t + x, 0);
  const lastMs = [...msByPerson(shifts.filter((s) => s.person && Number.isFinite(s.start) && inLast(s.start)), to).values()].reduce(
    (t, x) => t + x,
    0,
  );

  // Hours by area: each person's day at the lab is split evenly between the
  // areas in their lab log that day; days nobody logged are "Not logged".
  const weekLogs = logs.filter((l) => l.day >= week && l.day < nextWeek && l.person);
  const lastLogs = logs.filter((l) => l.day >= lastWeek && l.day < week && l.person);
  const logOf = new Map(weekLogs.map((l) => [`${l.day}|${l.person}`, l]));
  const perDay = new Map();
  for (const s of weekShifts) {
    const k = `${teamDay(s.start)}|${s.person}`;
    perDay.set(k, [...(perDay.get(k) || []), s]);
  }
  const areaMs = {};
  for (const [k, list] of perDay) {
    const ms = mergedMs(list, to);
    const areas = (logOf.get(k)?.areas || []).filter((a) => AREA_IDS.includes(a));
    if (!areas.length) areaMs.unlogged = (areaMs.unlogged || 0) + ms;
    else for (const a of areas) areaMs[a] = (areaMs[a] || 0) + ms / areas.length;
  }
  const areas = [...RECAP_AREAS, ['unlogged', 'Not logged']]
    .map(([id, label]) => ({ id, label, hours: hoursOf(areaMs[id] || 0) }))
    .filter((a) => a.hours > 0)
    .sort((a, b) => (a.id === 'unlogged') - (b.id === 'unlogged') || b.hours - a.hours);

  // Tasks finished this week, and by whom.
  const done = tasks.filter((t) => t.status === 'done' && !t.deletedAt);
  const finished = done
    .filter((t) => inWeek(toMs(t.completedAt)))
    .sort((a, b) => toMs(a.completedAt) - toMs(b.completedAt))
    .map((t) => ({ id: t.id, title: clip(String(t.title || 'A task'), 90), who: [...new Set(t.assignees || [])] }));
  const finishedLast = done.filter((t) => inLast(toMs(t.completedAt))).length;

  // Practice runs (a run without a type is practice).
  const practice = (list) => list.filter((r) => (r.type || 'practice') === 'practice');
  const total = (r) => (Number(r.auto) || 0) + (Number(r.teleop) || 0) + (Number(r.endgame) || 0);
  const weekRuns = practice(runs.filter((r) => r.date >= week && r.date < nextWeek));
  const lastRuns = practice(runs.filter((r) => r.date >= lastWeek && r.date < week));
  const avg = (list) => (list.length ? Math.round(list.reduce((t, r) => t + total(r), 0) / list.length) : 0);
  const runStats = {
    count: weekRuns.length,
    last: lastRuns.length,
    best: weekRuns.length ? Math.max(...weekRuns.map(total)) : 0,
    avg: avg(weekRuns),
    avgLast: avg(lastRuns),
  };

  // From the lab log: a few lines worth reading, one per person. Longer notes
  // with a photo or a finished task first.
  const highlights = weekLogs
    .filter((l) => String(l.note || '').trim().length >= 12)
    .map((l) => ({
      person: l.person,
      day: l.day,
      text: clip(String(l.note).trim().replace(/\s+/g, ' '), 160),
      photo: (l.photos || [])[0]?.thumbUrl || (l.photos || [])[0]?.url || '',
      rank:
        Math.min(String(l.note).length, 120) + ((l.photos || []).length ? 30 : 0) + 20 * (l.tasks || []).filter((t) => t.outcome === 'done').length,
    }))
    .sort((a, b) => b.rank - a.rank)
    .filter((h, i, all) => all.findIndex((x) => x.person === h.person) === i)
    .slice(0, 3)
    .map(({ rank, ...h }) => h);

  // Top contributor (the balanced score at the top of this file).
  const people = new Set([...byPerson.keys(), ...weekLogs.map((l) => l.person), ...finished.flatMap((t) => t.who)]);
  const rows = [...people].map((name) => ({
    name,
    hours: hoursOf(byPerson.get(name) || 0),
    tasks: finished.filter((t) => t.who.includes(name)).length,
    logs: new Set(weekLogs.filter((l) => l.person === name).map((l) => l.day)).size,
  }));
  const ranked = rankContributors(rows);
  const top = ranked[0] || null;

  // Streak shout-outs: 5+ school days or 4+ weeks in a row, longest first.
  const names = [...new Set([...roster, ...byPerson.keys()])];
  const streaks = names
    .map((name) => ({ name, ...streaksOf(name, shifts, to) }))
    .filter((s) => s.daily >= 5 || s.weekly >= 4)
    .sort((a, b) => b.daily - a.daily || b.weekly - a.weekly || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map(({ name, daily, weekly }) => ({ name, daily, weekly }));

  // This week against last week.
  const hours = hoursOf(hoursMs);
  const hoursLast = hoursOf(lastMs);
  const logDays = (list) => new Set(list.map((l) => `${l.day}|${l.person}`)).size;
  const vs = [
    { id: 'hours', label: 'Hours at the lab', now: hours, last: hoursLast, unit: 'h' },
    { id: 'people', label: 'People at the lab', now: byPerson.size, last: new Set(shifts.filter((s) => inLast(s.start)).map((s) => s.person)).size },
    { id: 'tasks', label: 'Tasks finished', now: finished.length, last: finishedLast },
    { id: 'runs', label: 'Practice runs', now: runStats.count, last: runStats.last },
    { id: 'logs', label: 'Lab logs', now: logDays(weekLogs), last: logDays(lastLogs) },
  ];

  // The words.
  const intro = [];
  if (!hours && !finished.length && !runStats.count) intro.push('A quiet week: nobody clocked in, and the board stayed put.');
  else {
    if (hours)
      intro.push(
        `${hours.toFixed(1)} hours at the lab from ${plural(byPerson.size, 'person', 'people')}, ${versus(hours, hoursLast, ' h')}.`,
      );
    const bits = [finished.length && plural(finished.length, 'task') + ' finished', runStats.count && plural(runStats.count, 'practice run')].filter(
      Boolean,
    );
    if (bits.length) intro.push(`${bits.join(' and ')}.`.replace(/^./, (c) => c.toUpperCase()));
  }
  const topWhy = top
    ? [top.hours && `${top.hours.toFixed(1)} h at the lab`, top.tasks && `${plural(top.tasks, 'task')} finished`, top.logs && `${plural(top.logs, 'lab log')}`]
        .filter(Boolean)
        .join(', ')
    : '';
  let outro = 'See you at the lab this week.';
  if (competition?.date) {
    const left = Math.round((teamMidnight(competition.date) - teamMidnight(teamDay(now))) / 86400000);
    if (left > 1) outro = `${plural(left, 'day')} until ${competition.name || 'the competition'}. See you at the lab.`;
    else if (left === 1) outro = `${competition.name || 'The competition'} is tomorrow. Pack the robot and get some sleep.`;
  }

  const parts = [
    hours ? `${hours.toFixed(1)} h at the lab` : 'no lab hours',
    finished.length && `${plural(finished.length, 'task')} finished`,
    runStats.count && plural(runStats.count, 'practice run'),
  ].filter(Boolean);
  const text = `Weekly recap, ${weekLabel(week)}: ${parts.join(', ')}.${top ? ` Top contributor: ${top.name}.` : ''}`;

  return {
    v: 1,
    week,
    label: weekLabel(week),
    intro: intro.join(' '),
    hours,
    hoursLast,
    people: byPerson.size,
    areas,
    finished: finished.slice(0, 8),
    finishedCount: finished.length,
    runs: runStats,
    highlights,
    top: top ? { name: top.name, hours: top.hours, tasks: top.tasks, logs: top.logs, why: topWhy } : null,
    runnersUp: ranked.slice(1, 3).map((r) => r.name),
    streaks,
    vs,
    outro,
    text: clip(text, 400),
  };
}

// "Cooper: 12 school days in a row" style lines for the streak shout-outs.
export function streakShout(s) {
  const parts = [];
  if (s.daily >= 5) parts.push(`${s.daily} school days in a row`);
  if (s.weekly >= 4) parts.push(`${s.weekly} weeks in a row`);
  return `${first(s.name)}: ${parts.join(', ')}`;
}
