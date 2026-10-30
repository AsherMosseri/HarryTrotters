// Time at the lab, added up the same way everywhere: the Shifts page,
// profiles, /whois, the lab log, Today, and Jackson coins (here and on the
// server). A running shift counts up to now. Shifts that overlap for one
// person (clocked in on two devices, or a manager added a shift over one
// they already had) count once, not twice.

export const HOUR = 3600000;

// The total length of a list of shifts with the overlaps counted once.
export function mergedMs(shifts, now = Date.now()) {
  const spans = shifts
    .filter((s) => Number.isFinite(s.start))
    .map((s) => [s.start, Math.max(s.start, s.end ?? now)])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let at = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, at);
    if (end > from) total += end - from;
    at = Math.max(at, end);
  }
  return total;
}

// Each person's time: Map name → ms, for the shifts keep() accepts (by
// default all of them). Shifts' person names should already be current names.
export function msByPerson(shifts, now = Date.now(), keep = () => true) {
  const by = new Map();
  for (const s of shifts) if (s.person && Number.isFinite(s.start) && keep(s)) by.set(s.person, [...(by.get(s.person) || []), s]);
  return new Map([...by].map(([name, list]) => [name, mergedMs(list, now)]));
}

// One person's time.
export const msOf = (name, shifts, now = Date.now(), keep = () => true) =>
  mergedMs(
    shifts.filter((s) => s.person === name && keep(s)),
    now,
  );

// Hours to show: one decimal place, always (12.4, not "12").
export const hoursOf = (ms) => Math.round((ms / HOUR) * 10) / 10;
export const hoursLabel = (ms) => `${hoursOf(ms).toFixed(1)} h`;
