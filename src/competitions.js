// The season's competitions: the rules are shared with the server
// (functions/shared/competitions.js); these are the words and dates the
// screens show.
import { parseDay } from './milestones.js';
import { dayDiff, daysUntil, kindLabel, lastDay } from '../functions/shared/competitions.js';

export * from '../functions/shared/competitions.js';

// "Sat, Dec 5", or "Sat, Dec 5 – Sun, Dec 6" for a two-day event.
// style 'long': "Saturday, December 5"; 'short': "Dec 5" / "Dec 5–6".
export function compDates(c, style = 'medium') {
  if (!c) return '';
  const opts =
    style === 'long'
      ? { weekday: 'long', month: 'long', day: 'numeric' }
      : style === 'short'
        ? { month: 'short', day: 'numeric' }
        : { weekday: 'short', month: 'short', day: 'numeric' };
  const fmt = (d) => parseDay(d).toLocaleDateString(undefined, opts);
  const end = lastDay(c);
  if (end === c.start) return fmt(c.start);
  if (style === 'short' && c.start.slice(0, 7) === end.slice(0, 7)) return `${fmt(c.start)}–${parseDay(end).getDate()}`;
  return `${fmt(c.start)} – ${fmt(end)}`;
}

// "Today", "Tomorrow", "In 12 days", or for past ones "3 days ago".
export function whenText(c, today) {
  if (today > lastDay(c)) {
    const ago = dayDiff(lastDay(c), today);
    return ago === 1 ? 'Yesterday' : ago < 60 ? `${ago} days ago` : '';
  }
  const n = daysUntil(c, today);
  if (n === 0) return lastDay(c) > c.start ? 'On now' : 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}

// "Qualifier · Queens, NY" (the kind and the place, whichever there are).
export const compSub = (c) => [kindLabel(c.kind), c.place].filter(Boolean).join(' · ');

// A new competition's id (the app makes it; FTC Events imports use ftc-CODE).
export const newCompetitionId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
