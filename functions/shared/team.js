// Team management: these people are managers (they sign in with their own
// password; the server marks them as managers). The app and the server read
// this same list (src/config.js re-exports it).
export const MANAGER_NAMES = ['Asher Mosseri', 'Sebastian Tolbert'];
export const isManagerName = (name) => MANAGER_NAMES.some((n) => n.toLowerCase() === String(name || '').trim().toLowerCase());
// Passwords: at least this long.
export const PASSWORD_MIN = 6;
