// Each person's org-chart info (title, subteams, responsibilities): what team
// management saved on the Team tab, else the defaults in config.js.
import { ORG_DEFAULTS, SUBTEAM_COLORS } from './config.js';
import { personId } from './data/diff.js';

export function buildPeopleInfo(roster, roles, rename) {
  const saved = Object.fromEntries(roles.map((r) => [r.id, r]));
  const defaults = Object.fromEntries(Object.entries(ORG_DEFAULTS).map(([k, v]) => [rename(k), v]));
  const out = new Map();
  for (const name of roster) {
    const role = saved[personId(name)] || defaults[name] || {};
    const subteams = role.subteams || [];
    out.set(name, {
      title: role.title || '',
      subteams,
      responsibilities: role.responsibilities || [],
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
