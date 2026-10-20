// Date + status helpers for the milestone chart. Dates are local 'YYYY-MM-DD' strings.

const DAY = 86400000;

export function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// Whole days from a to b (b - a).
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / DAY);
}

export function mondayOf(iso) {
  const d = parseDay(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

export function shortDate(iso) {
  return parseDay(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function milestoneProgress(milestone, tasks) {
  const linked = tasks.filter((t) => t.milestoneId === milestone.id);
  const done = linked.filter((t) => t.status === 'done').length;
  return { tasks: linked, total: linked.length, done, pct: linked.length ? done / linked.length : milestone.done ? 1 : 0 };
}

export const MILESTONE_STATES = {
  done: { label: 'Done', color: 'var(--st-done)' },
  on_track: { label: 'On track', color: 'var(--st-todo)' },
  at_risk: { label: 'At risk', color: 'var(--st-progress)' },
  late: { label: 'Late', color: 'var(--st-blocked)' },
  not_started: { label: 'Not started', color: 'var(--st-backlog)' },
};

// Done is set by hand. Otherwise: past the end date = late; inside the window,
// "at risk" when finished tasks lag well behind the time already used up.
export function milestoneState(milestone, progress, today = todayISO()) {
  if (milestone.done) return 'done';
  if (!milestone.start || !milestone.end) return 'not_started';
  if (today > milestone.end) return 'late';
  if (today < milestone.start) return progress.done ? 'on_track' : 'not_started';
  const span = daysBetween(milestone.start, milestone.end) + 1;
  const used = (daysBetween(milestone.start, today) + 1) / span;
  if (progress.total && progress.pct < used - 0.34) return 'at_risk';
  return 'on_track';
}
