// The season's competitions (3.2.11): every event on the team's calendar,
// kept on settings/team.competitions (team management edits it on the
// Competitions screen). Shared by the app and the server, so both agree on
// which one is next and when competition mode turns on.
//
// A competition: { id, name, start: 'YYYY-MM-DD', end?: 'YYYY-MM-DD' (a
// multi-day event's last day), kind?, place?, code? (FTC event code), note? }.
// Days are the team's days (New York): pass `today` from teamDay() in
// functions/shared/coins.js.
//
// Before 3.2.11 the team had one date, settings/team.competitionDate (and
// before that, the date below). Old data with only that still works: it reads
// as a one-item list, and the first save from the Competitions screen writes
// it into the list. Nothing to migrate.

// The first season's date (src/config.js COMPETITION): what an empty
// settings doc falls back to.
export const DEFAULT_COMPETITION_DATE = '2026-11-14';
export const DEFAULT_COMPETITION_NAME = 'Competition';

export const COMP_KINDS = [
  { id: 'scrimmage', label: 'Scrimmage' },
  { id: 'league', label: 'League meet' },
  { id: 'qualifier', label: 'Qualifier' },
  { id: 'championship', label: 'Championship' },
];
const KIND_IDS = new Set(COMP_KINDS.map((k) => k.id));
export const kindLabel = (id) => COMP_KINDS.find((k) => k.id === id)?.label || '';

export const COMP_LIMITS = { name: 120, place: 120, code: 20, note: 500, count: 60 };

const DAY = 86400000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// A real calendar day as 'YYYY-MM-DD' (not 2026-02-30).
export function isDay(s) {
  const m = DAY_RE.exec(String(s || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
// Whole days from a to b (b - a), by the calendar (no clocks, no DST).
export function dayDiff(a, b) {
  const n = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((n(b) - n(a)) / DAY);
}

export const cleanCode = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, COMP_LIMITS.code);

// One competition, tidied: trimmed text within its limits, an end only when
// it's after the start, a known kind. null when it has no name or no start.
export function cleanCompetition(c) {
  if (!c || typeof c !== 'object') return null;
  const name = String(c.name || '')
    .trim()
    .slice(0, COMP_LIMITS.name);
  const start = String(c.start || '');
  if (!name || !isDay(start)) return null;
  const end = isDay(c.end) && c.end > start ? c.end : '';
  const out = { id: String(c.id || '') || `c-${start}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`, name, start };
  if (end) out.end = end;
  if (KIND_IDS.has(c.kind)) out.kind = c.kind;
  const place = String(c.place || '')
    .trim()
    .slice(0, COMP_LIMITS.place);
  if (place) out.place = place;
  const code = cleanCode(c.code);
  if (code) out.code = code;
  const note = String(c.note || '')
    .trim()
    .slice(0, COMP_LIMITS.note);
  if (note) out.note = note;
  return out;
}

// The last day of a competition (its start for a one-day event).
export const lastDay = (c) => (c.end && c.end > c.start ? c.end : c.start);

// Soonest first; a tie goes by the end, then the name.
export function sortCompetitions(list) {
  return [...(list || [])].sort((a, b) => a.start.localeCompare(b.start) || lastDay(a).localeCompare(lastDay(b)) || a.name.localeCompare(b.name));
}

// Every competition from settings/team, cleaned and sorted. Once the list
// has been saved (even emptied) it's the whole story; before that, the old
// single date reads as one competition.
export function competitionList(settings = {}) {
  if (Array.isArray(settings?.competitions)) return sortCompetitions(settings.competitions.map(cleanCompetition).filter(Boolean));
  const date = isDay(settings?.competitionDate) ? settings.competitionDate : DEFAULT_COMPETITION_DATE;
  const event = settings?.compEvent || {};
  return [cleanCompetition({ id: 'first', name: event.name || DEFAULT_COMPETITION_NAME, start: date, code: event.code })];
}

// 'today' from its first day through its last, 'upcoming' before, 'past' after.
export function compStatus(c, today) {
  if (today < c.start) return 'upcoming';
  if (today > lastDay(c)) return 'past';
  return 'today';
}

// The next competition: the first one that hasn't ended by the team's day.
// During a multi-day event, that event. null when none is coming up.
export function nextCompetition(list, today) {
  return sortCompetitions(list).find((c) => lastDay(c) >= today) || null;
}

// Days until it starts (0 while it's on), or null without one.
export function daysUntil(c, today) {
  if (!c) return null;
  return Math.max(0, dayDiff(today, c.start));
}

// The day a countdown counts to: its start, or today while it's on ('' with
// none). For the countdown-shaped readers (the ad pack, the recap).
export const countdownDay = (c, today) => (!c ? '' : c.start < today ? today : c.start);

// Upcoming (and today's) soonest first; past ones, latest first.
export function splitCompetitions(list, today) {
  const sorted = sortCompetitions(list);
  return {
    upcoming: sorted.filter((c) => lastDay(c) >= today),
    past: sorted.filter((c) => lastDay(c) < today).reverse(),
  };
}

// The competition going on today, or null.
export function todaysCompetition(list, today) {
  const c = nextCompetition(list, today);
  return c && compStatus(c, today) === 'today' ? c : null;
}

// What a list looks like after adding or changing one competition (by id),
// or removing it (c = null). Returns the new, sorted list.
export function withCompetition(list, id, c) {
  const rest = (list || []).filter((x) => x.id !== id);
  const clean = c && cleanCompetition({ ...c, id: id || c.id });
  return sortCompetitions(clean ? [...rest, clean] : rest);
}

export const newCompetitionId = (rand = Math.random) => `c${Date.now().toString(36)}${Math.floor(rand() * 1e6).toString(36)}`;

// A kind from the event's name ("NYC Qualifier" is a qualifier).
export function kindFromName(name = '') {
  if (/champ/i.test(name)) return 'championship';
  if (/qualif|tournament/i.test(name)) return 'qualifier';
  if (/league|meet/i.test(name)) return 'league';
  if (/scrimmage/i.test(name)) return 'scrimmage';
  return '';
}

// "Add from FTC Events": the team's registered events (the ftcEvents
// callable's 'events' answer: { code, name, start, end?, city }) added to the
// list, skipping any already on it (same event code). Returns the new list
// and what was added and skipped.
export function mergeFtcEvents(list, events) {
  const have = new Set((list || []).map((c) => cleanCode(c.code)).filter(Boolean));
  const added = [];
  let skipped = 0;
  for (const e of events || []) {
    const code = cleanCode(e?.code);
    if (code && have.has(code)) {
      skipped++;
      continue;
    }
    const start = String(e?.start || '').slice(0, 10);
    const c = cleanCompetition({
      id: code ? `ftc-${code}` : '',
      name: e?.name || code,
      start,
      end: String(e?.end || '').slice(0, 10),
      kind: kindFromName(e?.name),
      place: e?.city || '',
      code,
    });
    if (!c) continue;
    if (code) have.add(code);
    added.push(c);
  }
  return { list: sortCompetitions([...(list || []), ...added]), added, skipped };
}

// The weekly recap's countdown line: the next competition's name and start,
// or null when none is coming up (or one is on today: no countdown then).
export function recapCompetition(settings, today) {
  const c = nextCompetition(competitionList(settings), today);
  return c && c.start >= today ? { name: c.name, date: c.start } : null;
}
