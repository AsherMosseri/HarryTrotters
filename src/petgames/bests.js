// The pet games' bests on this device (3.2), one record a person:
// { hop: score, rally: { [level]: ms } }. The server keeps them too, for the
// team boards (functions/petgames.js); this copy works offline and right away.
import { mergeBests } from '../../functions/shared/petgames.js';
import { personId } from '../data/diff.js';

export const localKey = (name) => `pet-games-v1-${personId(name || '')}`;
export function readLocal(name) {
  try {
    return mergeBests(JSON.parse(localStorage.getItem(localKey(name)) || 'null'));
  } catch {
    return mergeBests();
  }
}
// A finished game: keeps the better of the old best and this one.
export function recordLocal(name, game, level, value) {
  const cur = readLocal(name);
  const k = String(level);
  const next =
    game === 'hop' ? { ...cur, hop: Math.max(cur.hop || 0, value) } : { ...cur, rally: { ...cur.rally, [k]: Math.min(cur.rally[k] ?? Infinity, value) } };
  try {
    localStorage.setItem(localKey(name), JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}
