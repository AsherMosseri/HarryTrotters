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
