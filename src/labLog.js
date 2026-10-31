// The lab log: what each person did at the lab, one log per person per day
// (labLogs/<day>_<person-id>). Ending a shift asks for it; #lab-log shows a
// Trotbot post per day with everyone's logs (made by the onLabLog function).
//
// Since 3.0 a log is mostly taps: the areas you worked in, the tasks and how
// each went, then an optional line, photo, voice note and who you worked
// with. Stored structured so it can become engineering notebook pages later:
//   { v: 2, day, person, uid, at, shiftId,
//     areas: ['coding', …],
//     tasks: [{ id | null, title, area, outcome, blocker }],
//     note, chips: ['coding-auto', …], photos: [...], voice: { url, path, type, ms } | null,
//     workedWith: [names],
//     taskIds, doneTaskIds, blockers }   ← kept filled in for older readers
// Logs from before 3.0 have only note, taskIds, doneTaskIds, photos,
// blockers and next; everything here reads both.
import { personId } from './data/diff.js';
import { hoursOf, msByPerson } from '../functions/shared/hours.js';

export const LAB_LOG_CHANNEL = 'lab-log';
// Shifts shorter than this (a mis-tap, a quick stop) don't need a log: ending
// one offers "Quick visit, nothing to log".
export const MIN_SHIFT = 15 * 60000;
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
export const shortDay = (day) => new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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

// ---------- areas, outcomes and chips ----------

// What you can say you worked on. Coding is the Programming subteam; General
// covers Team Management and tasks with no subteam; Outreach isn't a
// subteam, so it has no tasks of its own.
export const AREAS = [
  { id: 'general', label: 'General', icon: 'team', subteams: ['Team Management', 'Secretary', ''] },
  { id: 'coding', label: 'Coding', icon: 'code', subteams: ['Programming'] },
  { id: 'mechanical', label: 'Mechanical', icon: 'wrench', subteams: ['Mechanical'] },
  { id: 'cad', label: 'CAD', icon: 'ruler', subteams: ['CAD'] },
  { id: 'electrical', label: 'Electrical', icon: 'bolt', subteams: ['Electrical'] },
  { id: 'assembly', label: 'Assembly', icon: 'nut', subteams: ['Assembly'] },
  { id: 'outreach', label: 'Outreach', icon: 'announce', subteams: [] },
];
export const areaById = Object.fromEntries(AREAS.map((a) => [a.id, a]));
const AREA_OF_SUBTEAM = Object.fromEntries(AREAS.flatMap((a) => a.subteams.map((s) => [s, a.id])));
export const areaOfSubteam = (s) => AREA_OF_SUBTEAM[s || ''] || 'general';
export const taskArea = (t) => areaOfSubteam(t?.subteam);
// Areas in the order they're shown.
export const sortAreas = (ids) => AREAS.map((a) => a.id).filter((id) => ids.includes(id));

export const OUTCOMES = [
  { id: 'done', label: 'Finished', icon: 'check' },
  { id: 'progress', label: 'Made progress', icon: 'progress' },
  { id: 'stuck', label: 'Stuck', icon: 'stuck' },
  { id: 'started', label: 'Just started', icon: 'play' },
];
export const outcomeById = Object.fromEntries(OUTCOMES.map((o) => [o.id, o]));
// Outcomes that count as moving a task forward (for the "nice work" screen).
export const FORWARD = ['done', 'progress', 'started'];

// Suggestion chips under "Anything worth noting?". Ids are stored (and
// counted in labChips/counts), so keep them when rewording a chip.
export const CHIPS = {
  coding: [
    ['coding-auto', 'Tuned auto'],
    ['coding-bug', 'Fixed a bug'],
    ['coding-test', 'Tested on the robot'],
    ['coding-teleop', 'Worked on TeleOp'],
    ['coding-vision', 'Vision / Limelight'],
  ],
  mechanical: [
    ['mech-built', 'Built'],
    ['mech-rebuilt', 'Took apart / rebuilt'],
    ['mech-fixed', 'Fixed something broken'],
    ['mech-tested', 'Measured / tested'],
  ],
  cad: [
    ['cad-part', 'Modeled a part'],
    ['cad-assembly', 'Updated the assembly'],
    ['cad-drawing', 'Made a drawing'],
    ['cad-print', 'Exported for printing'],
  ],
  electrical: [
    ['elec-wired', 'Wired'],
    ['elec-cables', 'Cable managed'],
    ['elec-connection', 'Fixed a connection'],
    ['elec-tested', 'Tested motors / sensors'],
  ],
  assembly: [
    ['asm-subsystem', 'Put a subsystem together'],
    ['asm-mounted', 'Mounted parts on the robot'],
    ['asm-screws', 'Tightened / replaced screws'],
    ['asm-swap', 'Swapped a part'],
    ['asm-fit', 'Fit check'],
  ],
  outreach: [
    ['out-demo', 'Demo for visitors'],
    ['out-sponsor', 'Talked to a sponsor'],
    ['out-social', 'Social media post'],
    ['out-team', 'Helped another team'],
    ['out-portfolio', 'Worked on the portfolio'],
  ],
  general: [
    ['gen-cleanup', 'Cleaned up'],
    ['gen-helped', 'Helped someone'],
    ['gen-driving', 'Practiced driving'],
    ['gen-meeting', 'Meeting'],
    ['gen-outreach', 'Outreach'],
  ],
};
export const chipById = Object.fromEntries(Object.values(CHIPS).flatMap((list) => list.map(([id, text]) => [id, text])));

// The chips for the areas picked, most-tapped by the team first (counts from
// labChips/counts); ties keep the order above.
export function chipsFor(areas, counts = {}) {
  const list = sortAreas(areas).flatMap((a) => (CHIPS[a] || []).map(([id, text], i) => ({ id, text, area: a, i })));
  const seen = new Set();
  return list
    .filter((c) => !seen.has(c.text) && seen.add(c.text))
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || sortAreas(areas).indexOf(a.area) - sortAreas(areas).indexOf(b.area) || a.i - b.i);
}

// Tapping a chip adds its words to the line ("Tuned auto, fixed a bug");
// tapping it again takes them out.
const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const chipIn = (note, text) => new RegExp(`(^|[,.;]\\s*)${escapeRe(text)}(?=$|[,.;\\s])`, 'i').test(note || '');
export function toggleChip(note, text) {
  const n = (note || '').trim();
  if (chipIn(n, text)) {
    return n
      .replace(new RegExp(`(^|[,.;]\\s*)${escapeRe(text)}(?=$|[,.;\\s])`, 'i'), '$1')
      .replace(/^[,;.\s]+|[,;\s]+$/g, '')
      .replace(/([,;])\s*[,;]\s*/g, '$1 ')
      .trim();
  }
  if (!n) return text;
  return `${n.replace(/[,;\s]+$/, '')}, ${lowerFirst(text)}`;
}

// ---------- reading logs of either shape ----------

export const isStructured = (log) => Array.isArray(log?.areas) && log.areas.length > 0;

// A log's tasks as [{ id, title, area, outcome, blocker }], for old logs too.
export function entryTasks(log, tasks = []) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  if (Array.isArray(log?.tasks)) return log.tasks.map((x) => ({ ...x, title: (x.id && byId.get(x.id)?.title) || x.title || 'A task' }));
  const done = log?.doneTaskIds || [];
  return (log?.taskIds || []).map((id) => {
    const t = byId.get(id);
    return { id, title: t?.title || 'A task', area: taskArea(t), outcome: done.includes(id) ? 'done' : '', blocker: '' };
  });
}

// A log's areas: what was picked, or (for old logs) the areas of its tasks.
export function entryAreas(log, tasks = []) {
  if (isStructured(log)) return sortAreas(log.areas);
  return sortAreas([...new Set(entryTasks(log, tasks).map((x) => x.area))]);
}

// Hours on each area this month for one person: each day's lab time is
// split evenly between the areas logged that day.
export function areaHoursThisMonth(person, logs, shifts, tasks = [], now = Date.now()) {
  const month = dayOf(now).slice(0, 7);
  const out = {};
  for (const l of logs || []) {
    if (l.person !== person || !l.day?.startsWith(month)) continue;
    const areas = entryAreas(l, tasks);
    const h = hoursOn(l.day, shifts, now)[person] || 0;
    if (!areas.length || !h) continue;
    for (const a of areas) out[a] = (out[a] || 0) + h / areas.length;
  }
  return Object.fromEntries(Object.entries(out).map(([a, h]) => [a, Math.round(h * 10) / 10]));
}

// The person's last log before this day (for "Same as last time").
export function previousLog(person, logs, day) {
  return (
    (logs || [])
      .filter((l) => l.person === person && l.day !== day && l.day < day)
      .sort((a, b) => b.day.localeCompare(a.day) || (b.at || 0) - (a.at || 0))[0] || null
  );
}

// Who else had a shift that day (for "Worked with").
export function teammatesOn(day, person, shifts) {
  return [...new Set((shifts || []).filter((s) => s.person && s.person !== person && s.start && dayOf(s.start) === day).map((s) => s.person))];
}

// ---------- tasks you touched today ----------
// Opening, moving or commenting on a task marks it for today's log (it's
// already picked when you log). Kept on this device and in labTouches/
// <day>_<person> so it follows you to your other devices.
const TOUCH_KEY = 'lablog-touched';
export function localTouches(day) {
  try {
    const v = JSON.parse(localStorage.getItem(TOUCH_KEY) || 'null');
    return v && v.day === day && Array.isArray(v.ids) ? v.ids : [];
  } catch {
    return [];
  }
}
// Adds a task to today's list; true if it wasn't there yet.
export function addLocalTouch(day, id) {
  const ids = localTouches(day);
  if (ids.includes(id)) return false;
  try {
    localStorage.setItem(TOUCH_KEY, JSON.stringify({ day, ids: [...ids, id].slice(-100) }));
  } catch {
    /* private mode: the database copy still has it */
  }
  return true;
}
