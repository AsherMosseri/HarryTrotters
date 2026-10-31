// "Before the event" on Today (D4): what's still open before the competition,
// worked out from the tasks, parts, checklists and runs the page already has.
import { isQueueChecklist } from './checklists.js';

// The checklists that matter before the event (the pit's "Before queueing"
// list is for match day and resets every match, so it doesn't count).
const BEFORE_EVENT = /inspection|packing|pack list/i;
export const isReadinessList = (c) => !isQueueChecklist(c) && BEFORE_EVENT.test(c?.title || '');

const total = (r) => (Number(r.auto) || 0) + (Number(r.teleop) || 0) + (Number(r.endgame) || 0);

export function readiness({ tasks = [], parts = [], checklists = [], runs = [], goal = 0, today, eventDate }) {
  // Shown from now until the event day; the pit screen takes over that day.
  const show = !!eventDate && !!today && today < eventDate;
  const open = (tasks || []).filter((t) => t.status !== 'done' && !t.deletedAt);
  const due = open.filter((t) => t.dueDate && t.dueDate < eventDate);
  const blocked = open.filter((t) => t.status === 'blocked');
  const pending = (parts || []).filter((p) => p.status !== 'arrived');
  const lists = (checklists || []).filter(isReadinessList).map((c) => {
    const items = Object.values(c.items || {});
    return { id: c.id, title: c.title, total: items.length, left: items.filter((i) => !i.done).length };
  }).filter((l) => l.total > 0);
  const practice = (runs || [])
    .filter((r) => r.type === 'practice')
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0))
    .at(-1);
  const score = practice ? { total: total(practice), date: practice.date } : null;
  const g = Number(goal) > 0 ? Number(goal) : 0;
  const result = {
    show,
    due: { n: due.length, overdue: due.filter((t) => t.dueDate < today).length },
    blocked,
    parts: { n: pending.length, needed: pending.filter((p) => p.status === 'needed').length, ordered: pending.filter((p) => p.status === 'ordered').length },
    lists,
    listsLeft: lists.filter((l) => l.left > 0),
    practice: score && { ...score, goal: g, met: !g || score.total >= g },
    goal: g,
  };
  // Ready when nothing is open; a practice score under the goal is open too.
  result.ready = !result.due.n && !blocked.length && !result.parts.n && !result.listsLeft.length && (!result.practice || result.practice.met);
  return result;
}
