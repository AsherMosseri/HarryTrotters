// Scouting (the Scout page): the ratings and tags a scout can tap, the
// averages and the pick-list score worked out from them, and how FTC Events'
// team and ranking lines become our docs. The site and the ftcEvents function
// read this same file.

import { TEAM_NUMBER } from './matches.js';

// Ratings are 1-5 taps. Weight is how much each counts in the balanced score.
export const RATINGS = [
  ['auto', 'Auto', 0.2],
  ['teleop', 'TeleOp', 0.3],
  ['endgame', 'Endgame', 0.15],
  ['reliability', 'Reliability', 0.2],
  ['drive', 'Drive / defense', 0.15],
];
export const RATING_IDS = RATINGS.map(([id]) => id);

// Yes/no tags. "good" ones lift a team, "bad" ones are a warning.
export const TAGS = [
  ['autoScores', 'Scores in auto', 'good'],
  ['fastCycles', 'Fast cycles', 'good'],
  ['goodDefense', 'Good defense', 'good'],
  ['strongEndgame', 'Strong endgame', 'good'],
  ['consistent', 'Consistent', 'good'],
  ['brokeDown', 'Broke down', 'bad'],
  ['penalties', 'Penalties', 'bad'],
  ['tippy', 'Tips over', 'bad'],
];
export const TAG_IDS = TAGS.map(([id]) => id);
export const tagLabel = (id) => TAGS.find(([t]) => t === id)?.[1] || id;
export const tagKind = (id) => TAGS.find(([t]) => t === id)?.[2] || 'good';

// The plain line shown next to "Suggest order".
export const SCORE_FORMULA = 'Balanced score: TeleOp 30%, Auto 20%, Reliability 20%, Endgame 15%, Drive 15% of our 1 to 5 averages. Teams we haven’t scouted go last.';

export const NOTE_MAX = 200;
export const TEAM_NOTES_MAX = 1500;

// A team number is 1 to 5 digits; the text may have a # or spaces.
export function teamNumberOf(text) {
  const n = parseInt(String(text ?? '').replace(/[^0-9]/g, ''), 10);
  return n > 0 && n < 100000 ? n : 0;
}

// A match label as typed: "q12", "12" (qualification) or "P3" → "Q12", "P3".
export function matchLabelOf(text) {
  const m = String(text || '')
    .trim()
    .toUpperCase()
    .match(/^([QP]?)\s*(\d{1,3})(?:-(\d{1,2}))?$/);
  if (!m) return '';
  return `${m[1] || 'Q'}${Number(m[2])}${m[3] ? `-${Number(m[3])}` : ''}`;
}
// The qualification number after this label (Q12 → Q13), or '' for anything else.
export const nextMatchLabel = (label) => {
  const m = /^Q(\d{1,3})$/.exec(label || '');
  return m ? `Q${Math.min(999, Number(m[1]) + 1)}` : '';
};

// What goes in an entry doc from what the scout tapped (only real values).
export function cleanEntry({ team, match, ratings = {}, tags = [], note = '' }) {
  const out = {};
  for (const id of RATING_IDS) {
    const v = Number(ratings[id]);
    if (v >= 1 && v <= 5) out[id] = Math.round(v);
  }
  return {
    team: teamNumberOf(team),
    match: matchLabelOf(match),
    ratings: out,
    tags: [...new Set(tags)].filter((t) => TAG_IDS.includes(t)),
    note: String(note || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NOTE_MAX),
  };
}
// Worth saving: at least one tap or a note.
export const entryHasContent = (e) => Object.keys(e.ratings || {}).length > 0 || (e.tags || []).length > 0 || !!e.note;

// Averages for one team from its entries: { n, ratings: {id: avg|null}, tags: {id: count} }.
export function summarize(entries) {
  const sums = Object.fromEntries(RATING_IDS.map((id) => [id, [0, 0]]));
  const tags = {};
  for (const e of entries) {
    for (const id of RATING_IDS) {
      const v = Number(e.ratings?.[id]);
      if (v >= 1 && v <= 5) {
        sums[id][0] += v;
        sums[id][1]++;
      }
    }
    for (const t of e.tags || []) tags[t] = (tags[t] || 0) + 1;
  }
  return {
    n: entries.length,
    ratings: Object.fromEntries(RATING_IDS.map((id) => [id, sums[id][1] ? sums[id][0] / sums[id][1] : null])),
    tags,
  };
}

// The balanced score, 1 to 5 (null with no ratings). Missing ratings don't
// count against a team: the weights of the rest are scaled up.
export function balanced(summary) {
  let sum = 0;
  let weight = 0;
  for (const [id, , w] of RATINGS) {
    const v = summary?.ratings?.[id];
    if (v != null) {
      sum += v * w;
      weight += w;
    }
  }
  return weight ? sum / weight : null;
}

// Entries grouped by team number.
export function byTeam(entries) {
  const map = new Map();
  for (const e of entries) {
    const list = map.get(Number(e.team)) || [];
    list.push(e);
    map.set(Number(e.team), list);
  }
  return map;
}

// The suggested pick order: best balanced score first, scouted teams before
// unscouted ones (those keep their number order), never our own team.
export function suggestOrder(teamNumbers, entries, skip = [TEAM_NUMBER]) {
  const grouped = byTeam(entries);
  const rows = teamNumbers
    .filter((n) => !skip.includes(n))
    .map((n) => ({ n, score: balanced(summarize(grouped.get(n) || [])) }));
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.n - b.n);
  return rows.map((r) => r.n);
}

// ---------- FTC Events lines → our docs ----------

// One team from /teams?eventCode=: number, a short name, where it's from.
export function teamFromApi(t) {
  const number = teamNumberOf(t?.teamNumber);
  if (!number) return null;
  return {
    number,
    name: String(t.nameShort || t.nameFull || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80),
    city: [t.city, t.stateProv].filter(Boolean).join(', ').slice(0, 60),
  };
}

// One line from /rankings/{event}. The first sort order is ranking points,
// the next two are the tiebreakers.
export function rankingFromApi(r) {
  const number = teamNumberOf(r?.teamNumber);
  if (!number) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    number,
    rank: {
      rank: num(r.rank),
      wins: num(r.wins),
      losses: num(r.losses),
      ties: num(r.ties),
      played: num(r.matchesPlayed),
      rp: num(r.sortOrder1),
      tb1: num(r.sortOrder2),
      tb2: num(r.sortOrder3),
    },
  };
}

// "#4 · 3-1-0 · 8.5 RP" for a team's line.
export function rankText(rank) {
  if (!rank || !rank.rank) return '';
  const rp = Number.isInteger(rank.rp) ? rank.rp : Math.round(rank.rp * 100) / 100;
  return `#${rank.rank} · ${rank.wins}-${rank.losses}-${rank.ties} · ${rp} RP`;
}
