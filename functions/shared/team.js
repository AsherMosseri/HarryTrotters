// Team management: these people are managers (they sign in with their own
// password; the server marks them as managers). The app and the server read
// this same list (src/config.js re-exports it).
export const MANAGER_NAMES = ['Asher Mosseri', 'Sebastian Tolbert'];
export const isManagerName = (name) => MANAGER_NAMES.some((n) => n.toLowerCase() === String(name || '').trim().toLowerCase());
// Passwords: at least this long.
export const PASSWORD_MIN = 6;

// Names: two names are the same person if they match ignoring capitals,
// spaces, and punctuation ("cooper  mlezcko." is Cooper Mlezcko), the same
// way personId (src/data/diff.js) makes ids. Nobody can join, sign in, or be
// added under a name that matches someone else's.
export const nameKey = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const cleanName = (name) =>
  String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
export const sameName = (a, b) => !!nameKey(a) && nameKey(a) === nameKey(b);
// The spelling already on the team for this name, or the cleaned-up name.
export const knownName = (name, names) => names.find((n) => sameName(n, name)) || cleanName(name);

// The starting roster (the sign-in screen's names). People added on the
// Roster, and anyone team management lets in, are added to these.
export const ROSTER = [
  'Asher Mosseri',
  'Sebastian Tolbert',
  'Jackson Lucks',
  'Cooper Mlezcko',
  'Michael Meidan',
  'Matthew Kuehl',
  'Katarina Jurasic',
  'Sophia Bermudez',
  'Shrey Kumar',
  'Ira Kumar',
];

// Is this name already someone on the team? Team management, the starting
// roster, people added on the Roster (roles) and anyone who has signed in
// before (people), all under current names (rename follows renames, so an
// old name counts too), minus people team management removed. A name that
// isn't waits for team management before it can do anything.
export function onTeam(name, { rename = (n) => n, roles = [], people = [] } = {}) {
  const me = rename(cleanName(name));
  if (!nameKey(me)) return false;
  if (isManagerName(me)) return true;
  const is = (n) => !!n && sameName(rename(n), me);
  if (roles.some((r) => r?.removed && is(r.name))) return false;
  return [...ROSTER, ...roles.filter((r) => r && !r.removed).map((r) => r.name), ...people.map((p) => p?.name)].some(is);
}

// A device that can use the app: signed in with a password, and (for a name
// new to the team) let in by team management. members docs from before
// approvals have no pending field, so they count as let in.
export const memberOk = (m) => !!m && m.via === 'password' && m.pending !== true;
