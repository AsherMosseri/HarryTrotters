// Robot batteries (D6): numbered packs with a status, when it changed, and
// which match each one ran in. One doc each in batteries/{id}:
//   { label: '3', color, order, status, statusAt, statusBy, match,
//     history: [{ at, by, status, match? }], createdAt, createdBy }
// Everyone on the team changes a battery's status; team management adds,
// edits, retires and deletes them (firestore.rules). The history is a short
// array on the doc (the last HISTORY_MAX changes), which keeps the rules simple.

export const HISTORY_MAX = 30;

export const BATTERY_STATUS = [
  { id: 'charged', label: 'Charged', icon: 'check' },
  { id: 'robot', label: 'On the robot', icon: 'robot' },
  { id: 'charging', label: 'Charging', icon: 'bolt' },
  { id: 'needs', label: 'Needs charging', icon: 'battery' },
  { id: 'retired', label: 'Retired', icon: 'cross' },
];
export const statusById = Object.fromEntries(BATTERY_STATUS.map((s) => [s.id, s]));
export const statusLabel = (id) => statusById[id]?.label || 'Unknown';

// A tag to tell packs apart at a glance (the number is still what counts).
export const BATTERY_COLORS = [
  ['', 'None'],
  ['red', 'Red'],
  ['orange', 'Orange'],
  ['yellow', 'Yellow'],
  ['green', 'Green'],
  ['blue', 'Blue'],
  ['purple', 'Purple'],
  ['gray', 'Gray'],
];
export const COLOR_IDS = BATTERY_COLORS.map(([id]) => id);

// Numbers sort as numbers ("2" before "10"), then by order added.
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
export const sortBatteries = (list) =>
  [...list].sort((a, b) => natural(a.label, b.label) || (a.order ?? 0) - (b.order ?? 0));

export const live = (list) => list.filter((b) => b.status !== 'retired');
export const retired = (list) => list.filter((b) => b.status === 'retired');
export const inRobot = (list) => sortBatteries(list).find((b) => b.status === 'robot') || null;
export const charged = (list) => sortBatteries(list).filter((b) => b.status === 'charged');

// The next number to offer when adding one: the highest number + 1.
export function nextLabel(list) {
  const top = Math.max(0, ...list.map((b) => parseInt(b.label, 10) || 0));
  return String(top + 1);
}
export const hasLabel = (list, label, exceptId = null) =>
  list.some((b) => b.id !== exceptId && String(b.label).trim().toLowerCase() === String(label).trim().toLowerCase());

// A new battery's fields (team management adds it as Charged or as Needs charging).
export function newBattery({ label, color = '', status = 'needs' }, by, at, order) {
  return {
    label: String(label).trim().slice(0, 20),
    color: COLOR_IDS.includes(color) ? color : '',
    order,
    status,
    statusAt: at,
    statusBy: by,
    match: '',
    history: [{ at, by, status }],
    createdAt: at,
    createdBy: by,
  };
}

// What changes on a battery when it gets a new status. `match` only means
// something for "on the robot" (the match it was put on for).
export function statusPatch(b, status, { by, at = Date.now(), match = '' }) {
  const m = status === 'robot' ? String(match || '').slice(0, 20) : '';
  const entry = { at, by, status, ...(m ? { match: m } : {}) };
  return {
    status,
    statusAt: at,
    statusBy: by,
    match: m,
    history: [...(b.history || []), entry].slice(-HISTORY_MAX),
  };
}

// Put one on the robot: whatever was on the robot before goes to "Needs
// charging" (it's been used). Returns [{ id, patch }] for the store.
export function putOnRobot(list, id, { by, at = Date.now(), match = '' }) {
  const out = [];
  for (const b of list) if (b.status === 'robot' && b.id !== id) out.push({ id: b.id, patch: statusPatch(b, 'needs', { by, at }) });
  const target = list.find((b) => b.id === id);
  if (target) out.push({ id, patch: statusPatch(target, 'robot', { by, at, match }) });
  return out;
}

// Matches this battery has run in, oldest first, each once.
export function ranIn(b) {
  const seen = [];
  for (const h of b.history || []) if (h.status === 'robot' && h.match && !seen.includes(h.match)) seen.push(h.match);
  return seen;
}

// How long a battery has been off the robot: when it came off, 0 if it
// never went on, Infinity while it's on.
export function restedSince(b) {
  const h = b.history || [];
  let at = -1;
  for (let i = 0; i < h.length; i++) if (h[i].status === 'robot') at = i;
  if (at < 0) return 0;
  return h[at + 1] ? h[at + 1].at : Infinity;
}

// Charged batteries, longest-rested first (never used counts as rested the longest).
export function readyOrder(list) {
  return charged(list)
    .map((b, i) => ({ b, i, r: restedSince(b) }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.b);
}
export const suggestNext = (list) => readyOrder(list)[0] || null;

// A plain warning when nothing is ready (null when there's nothing to say).
export function batteryWarning(list) {
  const mine = live(list);
  if (!mine.length) return null;
  if (charged(mine).length) return null;
  return inRobot(mine)
    ? 'No spare battery is marked charged. Put one on the charger.'
    : 'No battery is marked charged. Put one on the charger.';
}

// Plain counts for a summary line: "2 charged, 1 charging".
export function summary(list) {
  const mine = live(list);
  const n = (s) => mine.filter((b) => b.status === s).length;
  return { charged: n('charged'), robot: n('robot'), charging: n('charging'), needs: n('needs'), total: mine.length };
}
