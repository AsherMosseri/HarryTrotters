// Pet games' best scores and the team boards (3.2): Pet Hop and Pet Rally on
// the pet screen. The games run on each phone, so a best score is whatever
// the phone says; the server (functions/petgames.js) only keeps it sane:
// a whole number in range, a Rally time no faster than the car can drive,
// and Rally levels in order. The boards are just for fun: they pay nothing,
// and the games never touch coins or a pet's level.
//
//   petGames/{personId}  { person, hop: { best, at }, rally: { [level]: { ms, at } } }
//   (written only by the server; everyone on the team reads them)

import { RALLY_COUNT, RALLY_LENGTHS } from './petRally.js';

export const GAMES = ['hop', 'rally'];
export const HOP_MAX = 999;
export const RALLY_MAX_MS = 10 * 60 * 1000;
// Faster than the car can go, even downhill: a time under this is not real.
export const RALLY_TOP_SPEED = 30;
export const rallyMinMs = (level) => Math.ceil(((RALLY_LENGTHS[level - 1] || 0) / RALLY_TOP_SPEED) * 1000);
export const BOARD_SIZE = 10;

const note = (title, body = '') => ({ note: { title, body } });
const whole = (v) => typeof v === 'number' && Number.isInteger(v);

// A reported score, checked: { game, level, value } or { note }.
export function cleanScore(input = {}) {
  const game = input.game;
  if (!GAMES.includes(game)) return note('Which game?');
  const value = input.value;
  if (!whole(value)) return note('That score isn’t a number.');
  if (game === 'hop') {
    if (value < 1 || value > HOP_MAX) return note('That score is out of range.');
    return { game, level: 0, value };
  }
  const level = input.level;
  if (!whole(level) || level < 1 || level > RALLY_COUNT) return note('Which level?');
  if (value < rallyMinMs(level) || value > RALLY_MAX_MS) return note('That time is out of range.');
  return { game, level, value };
}

// A person's doc after a score: { doc, better } (better: it was a new best),
// or { note } (Rally levels go in order: level n needs level n − 1 cleared).
export function scoreAfter(doc, score, { me, now = Date.now() }) {
  const d = { person: me, hop: doc?.hop || null, rally: { ...(doc?.rally || {}) } };
  if (score.game === 'hop') {
    if (d.hop && d.hop.best >= score.value) return { doc: d, better: false };
    return { doc: { ...d, hop: { best: score.value, at: now } }, better: true };
  }
  const k = String(score.level);
  if (score.level > 1 && !d.rally[String(score.level - 1)]) return note('Clear the level before it first.');
  const had = d.rally[k];
  if (had && had.ms <= score.value) return { doc: d, better: false };
  return { doc: { ...d, rally: { ...d.rally, [k]: { ms: score.value, at: now } } }, better: true };
}

// The best of a phone's own record and the server's, for one person:
// { hop, rally: { [level]: ms } }.
export function mergeBests(...docs) {
  const out = { hop: 0, rally: {} };
  for (const d of docs) {
    if (!d) continue;
    const hop = typeof d.hop === 'number' ? d.hop : d.hop?.best;
    if (whole(hop) && hop > out.hop) out.hop = Math.min(hop, HOP_MAX);
    for (const [k, v] of Object.entries(d.rally || {})) {
      const ms = typeof v === 'number' ? v : v?.ms;
      if (!whole(ms) || Number(k) < 1 || Number(k) > RALLY_COUNT) continue;
      if (!out.rally[k] || ms < out.rally[k]) out.rally[k] = ms;
    }
  }
  return out;
}
// How many Rally levels in a row are cleared (level n unlocks n + 1).
export function rallyCleared(rally = {}) {
  let n = 0;
  while (n < RALLY_COUNT && rally[String(n + 1)] != null) n++;
  return n;
}

// The team board for a game from everyone's docs, under current names:
// hop: [{ name, best }] highest first; rally: [{ name, cleared, total }],
// most levels first, then the fastest total time over those levels.
// Ties go to whoever got there first.
export function boardOf(docs, game, { rename = (n) => n, size = BOARD_SIZE } = {}) {
  const rows = [];
  const seen = new Set();
  for (const d of docs || []) {
    const name = rename(d.person || '');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (game === 'hop') {
      const best = d.hop?.best;
      if (whole(best) && best > 0) rows.push({ name, best: Math.min(best, HOP_MAX), at: d.hop.at || 0 });
      continue;
    }
    const r = mergeBests({ rally: d.rally }).rally;
    const cleared = rallyCleared(r);
    if (!cleared) continue;
    let total = 0;
    let at = 0;
    for (let i = 1; i <= cleared; i++) {
      total += r[String(i)];
      at = Math.max(at, d.rally[String(i)]?.at || 0);
    }
    rows.push({ name, cleared, total, at });
  }
  if (game === 'hop') rows.sort((a, b) => b.best - a.best || a.at - b.at || a.name.localeCompare(b.name));
  else rows.sort((a, b) => b.cleared - a.cleared || a.total - b.total || a.at - b.at || a.name.localeCompare(b.name));
  return rows.slice(0, size);
}

// 12.34 s, or 1:02.50.
export function rallyTime(ms) {
  if (!Number.isFinite(ms)) return '–';
  const cs = Math.round(ms / 10);
  const m = Math.floor(cs / 6000);
  const s = (cs - m * 6000) / 100;
  return m ? `${m}:${s.toFixed(2).padStart(5, '0')}` : `${s.toFixed(2)} s`;
}
