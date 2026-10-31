// The match debrief (D4): "What went wrong? What do we fix before the next
// match?" turns the chips someone taps into fix tasks.
import { teamDay } from '../functions/shared/coins.js';
import { addDay } from '../functions/shared/streaks.js';

// A chip with a subteam hands its task to that subteam; the rest are left for
// team management to place.
export const DEBRIEF_CHIPS = [
  { id: 'auto', label: 'Auto', subteam: 'Programming' },
  { id: 'intake', label: 'Intake', subteam: 'Mechanical' },
  { id: 'drive', label: 'Drive', subteam: 'Mechanical' },
  { id: 'endgame', label: 'Endgame', subteam: 'Mechanical' },
  { id: 'battery', label: 'Battery', subteam: 'Electrical' },
  { id: 'communication', label: 'Communication', subteam: '' },
  { id: 'strategy', label: 'Strategy', subteam: '' },
  { id: 'other', label: 'Other', subteam: '' },
];

const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

// Tasks are day-based: due today when the next match is later today (team
// time), otherwise tomorrow.
export function fixDue(next, now = Date.now()) {
  const today = teamDay(now);
  return next?.time && next.time > now && teamDay(next.time) === today ? today : addDay(today, 1);
}

// The tasks for a debrief: one per chip, or one for the note alone. `match`
// is { id, label }; `next` the match after it (if any).
export function fixTasks({ match, chips = [], note = '', next = null, now = Date.now() }) {
  const text = note.trim().replace(/\s+/g, ' ');
  const dueDate = fixDue(next, now);
  const base = {
    status: 'todo',
    priority: 'high',
    dueDate,
    matchId: match.id || '',
    matchLabel: match.label || '',
  };
  const why = `From the ${match.label} debrief.${text ? ` ${text}` : ''}${next ? ` Fix before ${next.label}.` : ''}`;
  const picked = DEBRIEF_CHIPS.filter((c) => chips.includes(c.id));
  if (!picked.length) return text ? [{ ...base, title: `${match.label}: ${clip(text, 70)}`, description: why, subteam: '' }] : [];
  return picked.map((c) => ({
    ...base,
    title: `${match.label} ${c.label}: ${text ? clip(text, 60) : 'figure out what went wrong'}`,
    description: why,
    subteam: c.subteam,
  }));
}
