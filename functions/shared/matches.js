// Competition matches (Today's pit screen): the same ids and labels on the
// site and in the ftcEvents function, so a match typed in at the event and the
// same match pulled from FTC Events end up as one doc.

export const TEAM_NUMBER = 32313;
export const TEAM_TZ = 'America/New_York';
// A match counts as "next" until this long after its start (2:38 of play plus
// setup and reset), so the pit screen doesn't skip ahead while it's running.
export const MATCH_WINDOW = 10 * 60000;
// Queue this many minutes before the match unless team management changes it.
export const QUEUE_LEAD = 15;

// Q12 for qualification 12; P3 for playoff match 3 (P6-2 for game 2 of a series).
export function matchLabel(level, number, series = 0) {
  if (level === 'qual') return `Q${number}`;
  return series ? `P${series}${number > 1 ? `-${number}` : ''}` : `P${number}`;
}

// matches/{id}: the event code and the label, e.g. "usnynyq1-q12".
export function matchId(event, label) {
  const slug = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(event) || 'event'}-${slug(label)}`;
}

// FTC seasons are named by the year they start: Nov 2026 is the 2026 season.
export function seasonOf(ms) {
  const d = new Date(ms);
  return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

// Some systems name US time zones the Windows way.
const WINDOWS_TZ = {
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
};

// FTC Events gives times in the event's own time zone without an offset
// ("2026-11-14T09:30:00"); this turns one into ms. Typed times use it too.
export function zonedMs(local, tz = TEAM_TZ) {
  if (!local) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(local)) return Date.parse(local) || null;
  const m = String(local).match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?/);
  if (!m) return null;
  const want = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: WINDOWS_TZ[tz] || tz || TEAM_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  } catch {
    return tz === TEAM_TZ ? null : zonedMs(local, TEAM_TZ);
  }
  // Guess, see what wall-clock time that is there, and correct (twice covers DST edges).
  let t = want;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value]));
    t -= Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - want;
  }
  return t;
}

const levelOf = (s) => (/^qual/i.test(s || '') ? 'qual' : 'playoff');
const allianceOf = (station) => (/^red/i.test(station || '') ? 'red' : /^blue/i.test(station || '') ? 'blue' : '');

// One FTC Events schedule entry → our match doc (null if we're not in it).
export function fromSchedule(entry, event, tz, team = TEAM_NUMBER) {
  const teams = entry.teams || [];
  const us = teams.find((t) => Number(t.teamNumber) === team);
  if (!us) return null;
  const level = levelOf(entry.tournamentLevel);
  const number = Number(entry.matchNumber) || 0;
  const series = Number(entry.series) || 0;
  const alliance = allianceOf(us.station);
  const label = matchLabel(level, number, level === 'playoff' ? series : 0);
  const nums = (side) =>
    teams.filter((t) => allianceOf(t.station) === side && Number(t.teamNumber) !== team).map((t) => Number(t.teamNumber));
  return {
    id: matchId(event, label),
    event,
    label,
    level,
    number: level === 'playoff' ? series * 10 + number : number,
    time: zonedMs(entry.startTime, tz),
    alliance,
    partners: nums(alliance).slice(0, 3),
    opponents: nums(alliance === 'red' ? 'blue' : 'red').slice(0, 4),
    field: String(entry.field || '').slice(0, 8),
    source: 'api',
  };
}

// A played match from FTC Events: the label it belongs to and the final scores.
export function scoreOf(m) {
  const level = levelOf(m.tournamentLevel);
  const number = Number(m.matchNumber) || 0;
  const label = matchLabel(level, number, level === 'playoff' ? Number(m.series) || 0 : 0);
  if (m.scoreRedFinal == null && m.scoreBlueFinal == null) return null;
  return { label, score: { red: Number(m.scoreRedFinal) || 0, blue: Number(m.scoreBlueFinal) || 0 } };
}

// Our line in the event's rankings.
export function rankOf(rankings, team = TEAM_NUMBER) {
  const r = (rankings || []).find((x) => Number(x.teamNumber) === team);
  if (!r) return null;
  return {
    rank: Number(r.rank) || 0,
    wins: Number(r.wins) || 0,
    losses: Number(r.losses) || 0,
    ties: Number(r.ties) || 0,
    played: Number(r.matchesPlayed) || 0,
    of: (rankings || []).length,
  };
}

// "12345, 6789" or "12345 6789" → [12345, 6789] (team numbers only).
export function teamNumbers(text, max = 3) {
  return [
    ...new Set(
      String(text || '')
        .split(/[^0-9]+/)
        .map(Number)
        .filter((n) => n > 0 && n < 100000 && n !== TEAM_NUMBER),
    ),
  ].slice(0, max);
}

// The fast form at the event → a match doc (same id an FTC Events pull gives it).
export function typedMatch({ event, level = 'qual', number, date, time, alliance, partners, opponents }) {
  const n = Math.max(1, Math.min(999, parseInt(number, 10) || 0));
  const label = matchLabel(level, n);
  return {
    id: matchId(event, label),
    event: String(event || '').trim().toUpperCase(),
    label,
    level,
    number: level === 'playoff' ? n * 10 + 1 : n,
    time: date && time ? zonedMs(`${date}T${time}`) : null,
    alliance: alliance === 'red' || alliance === 'blue' ? alliance : '',
    partners: teamNumbers(partners, 3),
    opponents: teamNumbers(opponents, 4),
    source: 'typed',
  };
}

const byTime = (a, b) => (a.time ?? Infinity) - (b.time ?? Infinity) || (a.number || 0) - (b.number || 0);
export const sortMatches = (list) => [...list].sort(byTime);

// The match the pit is getting ready for: the first one that hasn't started
// yet (or started less than MATCH_WINDOW ago and has no score).
export function nextMatch(matches, now) {
  return sortMatches(matches).find((m) => m.time && (m.time > now || (!m.ours && m.time + MATCH_WINDOW > now))) || null;
}

// The match a score is most likely for: the latest one that has started and
// has no score yet.
export function matchToScore(matches, now) {
  return (
    sortMatches(matches)
      .filter((m) => m.time && m.time <= now && !m.ours)
      .at(-1) || null
  );
}

// When to leave for queueing: a time set by hand for this round, or the
// match time minus the lead.
export function queueTime(match, lead = QUEUE_LEAD, hand = null) {
  const key = roundKey(match, hand);
  if (hand?.at && hand.round === key) return hand.at;
  return match?.time ? match.time - (Number(lead) || QUEUE_LEAD) * 60000 : null;
}

// The "before queueing" checklist resets each round: ticks count only for the
// round they were made in. A round is a match, or a countdown started by hand
// when there's no match to go by.
export function roundKey(match, hand = null) {
  if (match) return match.id;
  return hand?.round?.startsWith('hand-') ? hand.round : 'free';
}

// Competition mode: on by hand, off by hand, or on during the competition
// day (team time).
export function competitionOn(mode, today, competitionDate) {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return !!competitionDate && today === competitionDate;
}

// The matches for one event (all of them while no event code is set); a match
// typed in without an event counts for any.
export function eventMatches(matches, code) {
  const want = String(code || '').toUpperCase();
  return want ? (matches || []).filter((m) => !m.event || m.event.toUpperCase() === want) : matches || [];
}

// ---------- queue alert (D4) ----------

// The queue alert is sent once per match per person. If the match then moves
// by this much (a delay at the field), the new time gets its own alert.
export const ALERT_MOVED = 5 * 60000;
// Same as COMPETITION in src/config.js (settings/team.competitionDate overrides it).
export const DEFAULT_COMPETITION_DATE = '2026-11-14';

// Minutes before the match to queue, as team management set it (1-60).
export const queueLeadOf = (settings) => Math.max(1, Math.min(60, Number(settings?.queueLead) || QUEUE_LEAD));

// The matches whose queue time has come: their queue time (match time minus
// the lead) is now or past, and the match hasn't started, has no score and
// isn't from another event. Nothing at all unless competition mode is on
// (the same rule that turns Today into the pit screen), and nothing without
// a match time. `today` is the team's day for `now`.
export function queueAlertsDue({ matches, settings = {}, now, today }) {
  if (!competitionOn(settings.compMode, today, settings.competitionDate || DEFAULT_COMPETITION_DATE)) return [];
  const lead = queueLeadOf(settings);
  return sortMatches(eventMatches(matches, settings.compEvent?.code))
    .filter((m) => m.time && !m.ours && !m.result && !m.score && m.time > now && queueTime(m, lead) <= now)
    .map((m) => ({ match: m, queueAt: queueTime(m, lead), minutes: Math.max(1, Math.round((m.time - now) / 60000)) }));
}

// Has this person already been told about the match at this time?
export const alreadyAlerted = (prev, matchTime) => !!prev && Math.abs((Number(prev.time) || 0) - matchTime) < ALERT_MOVED;

// "Match 12" for qual 12, "Playoff match 3" for P3.
export function matchWords(m) {
  if (m.level === 'qual' || /^q/i.test(m.label || '')) return `Match ${m.number || String(m.label).replace(/\D/g, '')}`;
  return `Playoff match ${String(m.label || '').replace(/^p/i, '')}`;
}

// The notification text: "Match 12 in 20 min" / "Time to queue — start the checklist".
export function queueAlertText(m, minutes) {
  return { title: `${matchWords(m)} in ${minutes} min`, body: 'Time to queue — start the checklist' };
}
