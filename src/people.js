// Each person's org-chart info (title, subteams, responsibilities): what team
// management saved on the Team tab, else the defaults in config.js.
import { DEFAULT_GRADE, GRADE_DEFAULTS, ORG_DEFAULTS, SUBTEAM_COLORS } from './config.js';
import { personId } from './data/diff.js';

export function buildPeopleInfo(roster, roles, rename) {
  const saved = Object.fromEntries(roles.map((r) => [r.id, r]));
  const defaults = Object.fromEntries(Object.entries(ORG_DEFAULTS).map(([k, v]) => [rename(k), v]));
  const grades = Object.fromEntries(Object.entries(GRADE_DEFAULTS).map(([k, v]) => [rename(k), v]));
  const out = new Map();
  for (const name of roster) {
    const role = saved[personId(name)] || defaults[name] || {};
    const subteams = role.subteams || [];
    out.set(name, {
      title: role.title || '',
      subteams,
      responsibilities: role.responsibilities || [],
      grade: role.grade || grades[name] || DEFAULT_GRADE,
      // Name color in chat, like a Discord role color: their first subteam.
      color: SUBTEAM_COLORS[subteams[0]] || '',
    });
  }
  return out;
}

// Profiles keyed by current name (newest wins if a rename left an old one).
export function buildProfiles(docs, rename) {
  const out = new Map();
  for (const d of docs) {
    const name = rename(d.name || '');
    if (name && (!out.has(name) || (d.updatedAt || 0) > (out.get(name).updatedAt || 0))) out.set(name, d);
  }
  return out;
}

// A status that hasn't expired.
export function activeStatus(profile, now = Date.now()) {
  const s = profile?.status;
  if (!s || (!s.text && !s.emoji)) return null;
  if (s.until && s.until < now) return null;
  return s;
}

export const ONLINE_MS = 150000;
export const TYPING_MS = 6000;

// A chat message under people's current names (author, @mentions, and the
// message it replies to), so a rename on the Roster shows on every message
// right away. Unchanged messages are returned as they are.
export function renameMessage(m, rename) {
  const by = m.by && rename(m.by);
  const mentions = m.mentions?.some((n) => rename(n) !== n) ? [...new Set(m.mentions.map(rename))] : m.mentions;
  const replyBy = m.replyTo?.by && rename(m.replyTo.by);
  const votes = m.votes && renameVotes(m.votes, rename);
  // "@Old Name" typed in the text reads "@New Name".
  let text = m.text;
  for (const n of m.mentions || []) if (text && rename(n) !== n) text = text.split(`@${n}`).join(`@${rename(n)}`);
  if (by === m.by && mentions === m.mentions && replyBy === m.replyTo?.by && votes === m.votes && text === m.text) return m;
  return { ...m, by, mentions, votes, text, ...(m.replyTo && { replyTo: { ...m.replyTo, by: replyBy } }) };
}

// Poll votes are kept per person id ({ [option]: { [personId]: name } }, and
// text: { [personId]: { name, … } }): re-key them by current names so your
// old votes still count as yours after a rename.
function renameVotes(votes, rename) {
  let changed = false;
  const out = {};
  for (const [opt, who] of Object.entries(votes)) {
    const next = {};
    for (const [key, v] of Object.entries(who || {})) {
      const name = typeof v === 'string' ? v : v?.name;
      const now = name ? rename(name) : name;
      const id = now ? personId(now) : key;
      if (id !== key || now !== name) changed = true;
      next[id] = typeof v === 'string' ? now : v && { ...v, name: now };
    }
    out[opt] = next;
  }
  return changed ? out : votes;
}
