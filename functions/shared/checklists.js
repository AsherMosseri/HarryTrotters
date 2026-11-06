// Checklists (the Checklists tab, Today's pinned lists, the pit screen and the
// checklistResets / onChecklist functions): ordering, moves, sections, runs
// and auto-reset, shared by the site, the demo and the server so they agree.
//
// A checklist doc: { title, items: { [id]: item }, sections: { [id]: { id,
// title, order } }, order, autoReset: '' | 'daily' | 'match', lastReset:
// 'YYYY-MM-DD', queue, createdAt, createdBy }. An item: { id, text, done,
// order, doneBy, doneAt, doneRound, section, who, assignedBy, assignedAt,
// note, photo, taskId }. Every field past `order` is optional, so lists saved
// before 3.3 work as they are. Past runs live in checklists/{id}/history.
import { eventMatches, nextMatch, roundKey } from './matches.js';

// The checklist Today's pit screen runs before each match (found by name, so
// renaming it on the Checklists tab unhooks it).
export const QUEUE_CHECKLIST = 'Before queueing';
export const isQueueChecklist = (c) => (c?.title || '').trim().toLowerCase() === QUEUE_CHECKLIST.toLowerCase();

export const MAX_ITEMS = 200;
export const MAX_SECTIONS = 20;
export const MAX_TEXT = 300;
export const MAX_NOTE = 1000;
// Past runs kept per list (the server trims older ones).
export const RUNS_KEPT = 50;
// A tick from an earlier match is saved as that match's run (and cleared)
// only once it's this old, so a phone a minute ahead of the server can't
// have its fresh ticks taken for the last match's.
export const ROUND_GRACE = 10 * 60000;

const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// Off, every day (team midnight) or before each match. The pit's "Before
// queueing" list is always per match.
export function resetMode(list) {
  if (isQueueChecklist(list)) return 'match';
  return list?.autoReset === 'daily' || list?.autoReset === 'match' ? list.autoReset : '';
}

// Ticked for this round: a per-match list counts only ticks made for the
// match the pit is getting ready for (like the pit screen always has).
export function isDone(list, item, round) {
  if (!item?.done) return false;
  return resetMode(list) === 'match' ? item.doneRound === round : true;
}

// The round the pit is on: the next match, or a countdown started by hand
// (kept on the "Before queueing" list), else 'free'.
export function currentRound({ matches = [], settings = {}, checklists = [], now = Date.now() }) {
  const queue = (checklists || []).find(isQueueChecklist);
  const next = nextMatch(eventMatches(matches, settings?.compEvent?.code), now);
  return roundKey(next, queue?.queue || null);
}

export const sortedSections = (list) =>
  Object.values(list?.sections || {})
    .filter((s) => s && s.id)
    .sort((a, b) => num(a.order) - num(b.order) || String(a.id).localeCompare(String(b.id)));

const byOrder = (a, b) => num(a.order) - num(b.order) || String(a.id).localeCompare(String(b.id));

// The list as shown: items with no heading first, then each section in order.
// [{ id: '' | sectionId, title, items }]. An item whose section is gone sits
// with the ones that have none.
export function groupsOf(list) {
  const secs = sortedSections(list);
  const known = new Set(secs.map((s) => s.id));
  const items = Object.values(list?.items || {})
    .filter((i) => i && i.id)
    .sort(byOrder);
  const groups = [{ id: '', title: '', items: items.filter((i) => !i.section || !known.has(i.section)) }];
  for (const s of secs) groups.push({ id: s.id, title: s.title || '', items: items.filter((i) => i.section === s.id) });
  return groups;
}

// Every item in the order it's shown.
export const shownItems = (list) => groupsOf(list).flatMap((g) => g.items);

// Orders 0, 1, 2… down the list for the given groups, as field updates
// ({ 'items.<id>.order': n, 'items.<id>.section': s }) for only what changed.
function renumber(groups, before) {
  const fields = {};
  let n = 0;
  for (const g of groups) {
    for (const it of g.items) {
      const was = before[it.id];
      if (!was || num(was.order, -1) !== n) fields[`items.${it.id}.order`] = n;
      if (!was || (was.section || '') !== g.id) fields[`items.${it.id}.section`] = g.id;
      n++;
    }
  }
  return fields;
}

const clamp = (i, lo, hi) => Math.max(lo, Math.min(hi, i));

// Move an item within its list: to group `section` ('' for no heading) at
// `index` among that group's items (counted without the item itself).
// Returns field updates (empty when nothing moves).
export function planMove(list, itemId, section, index) {
  const items = list?.items || {};
  const item = items[itemId];
  if (!item) return {};
  const groups = groupsOf(list).map((g) => ({ ...g, items: g.items.filter((i) => i.id !== itemId) }));
  const g = groups.find((x) => x.id === (section || '')) || groups[0];
  g.items.splice(clamp(index, 0, g.items.length), 0, item);
  return renumber(groups, items);
}

// One step up or down the list as shown, crossing into the next section at
// its edge (the keyboard's arrow keys, Move up / Move down).
export function planStep(list, itemId, dir) {
  const groups = groupsOf(list);
  const gi = groups.findIndex((g) => g.items.some((i) => i.id === itemId));
  if (gi < 0) return {};
  const at = groups[gi].items.findIndex((i) => i.id === itemId);
  const to = at + dir;
  if (to >= 0 && to < groups[gi].items.length) return planMove(list, itemId, groups[gi].id, to);
  // Over the edge: into the end of the section above, or the start of the one below.
  const ng = gi + dir;
  if (ng < 0 || ng >= groups.length) return {};
  return planMove(list, itemId, groups[ng].id, dir < 0 ? groups[ng].items.length : 0);
}

// Move an item to another list (one write: off one, onto the other), keeping
// its ticks, note, photo and the rest. Returns { item, fields } for the
// target list: the item as it lands, and its new orders. Its section is kept
// only when the target has one with the same id (new lists never do), else
// the group asked for.
export function planCrossMove(dst, item, section, index) {
  const groups = groupsOf(dst);
  const g = groups.find((x) => x.id === (section || '')) || groups[0];
  const moved = { ...item, section: g.id };
  g.items.splice(clamp(index, 0, g.items.length), 0, moved);
  const fields = renumber(groups, dst?.items || {});
  const landed = { ...moved, order: fields[`items.${item.id}.order`] ?? 0 };
  delete fields[`items.${item.id}.order`];
  delete fields[`items.${item.id}.section`];
  return { item: landed, fields };
}

// Move a section (with its items) to `index` among the sections.
export function planSectionMove(list, sectionId, index) {
  const secs = sortedSections(list);
  const s = secs.find((x) => x.id === sectionId);
  if (!s) return {};
  const rest = secs.filter((x) => x.id !== sectionId);
  rest.splice(clamp(index, 0, rest.length), 0, s);
  const fields = {};
  rest.forEach((x, i) => {
    if (num(x.order, -1) !== i) fields[`sections.${x.id}.order`] = i;
  });
  return fields;
}

// Where a new item goes: the end of the last group shown (where the add box is).
export function nextOrder(list) {
  const all = Object.values(list?.items || {});
  return all.length ? Math.max(...all.map((i) => num(i.order))) + 1 : 0;
}
export const lastSection = (list) => sortedSections(list).at(-1)?.id || '';

// The cards themselves: an `order` when someone has dragged them, else when
// they were made (older docs; one with no time sorts first, as before).
export const listKey = (c) => (typeof c?.order === 'number' ? c.order : toMs(c?.createdAt));
export const sortLists = (lists) => [...(lists || [])].sort((a, b) => listKey(a) - listKey(b) || String(a.id).localeCompare(String(b.id)));
// New orders for every list after moving one to `index`: { [id]: order }.
export function planListMove(lists, id, index) {
  const sorted = sortLists(lists);
  const it = sorted.find((c) => c.id === id);
  if (!it) return {};
  const rest = sorted.filter((c) => c.id !== id);
  rest.splice(clamp(index, 0, rest.length), 0, it);
  const out = {};
  rest.forEach((c, i) => {
    if (c.order !== i) out[c.id] = i;
  });
  return out;
}

// A copy: "Copy of …", nothing ticked, new item ids, the same sections (new
// ids too), and no photos, people, notes' owners or task links.
export function duplicateList(list, newId) {
  const secMap = {};
  const sections = {};
  for (const s of sortedSections(list)) {
    const id = newId();
    secMap[s.id] = id;
    sections[id] = { id, title: s.title || '', order: num(s.order) };
  }
  const items = {};
  for (const it of shownItems(list)) {
    const id = newId();
    items[id] = { id, text: it.text || '', done: false, order: num(it.order), section: secMap[it.section] || '', ...(it.note ? { note: it.note } : {}) };
  }
  const title = `Copy of ${list?.title || 'checklist'}`.slice(0, 80);
  return { title, items, sections, autoReset: list?.autoReset === 'daily' || list?.autoReset === 'match' ? list.autoReset : '' };
}

// A run: what was ticked when a list was reset (by hand or on its own).
// reason: 'manual' | 'daily' | 'match'. For a per-match list, `round` says
// which match's ticks count.
export function runRecord(list, { by, at, reason = 'manual', round = '', label = '' }) {
  const secTitle = Object.fromEntries(sortedSections(list).map((s) => [s.id, s.title || '']));
  const match = resetMode(list) === 'match';
  const items = shownItems(list).map((i) => {
    const on = match ? !!i.done && i.doneRound === round : !!i.done;
    return {
      text: String(i.text || '').slice(0, MAX_TEXT),
      section: secTitle[i.section] || '',
      done: on,
      by: on ? i.doneBy || '' : '',
      at: on ? num(i.doneAt) : 0,
    };
  });
  return {
    title: String(list?.title || '').slice(0, 120),
    at,
    by: by || '',
    reason,
    round: round || '',
    label: label || '',
    total: items.length,
    done: items.filter((i) => i.done).length,
    items,
  };
}

// The field updates that untick everything (what Uncheck all writes).
export function uncheckFields(items) {
  const f = {};
  for (const i of items) {
    if (!i.done && !i.doneBy && !i.doneRound) continue;
    f[`items.${i.id}.done`] = false;
    f[`items.${i.id}.doneBy`] = '';
    f[`items.${i.id}.doneAt`] = null;
    f[`items.${i.id}.doneRound`] = '';
  }
  return f;
}

// Daily lists: reset when the team day has moved past the last reset. A list
// with no stamp yet just gets one (switching Every day on stamps today).
export function dailyDue(list, today) {
  if (resetMode(list) !== 'daily') return null;
  if (!list.lastReset) return 'stamp';
  return list.lastReset < today ? 'reset' : null;
}

// Per-match lists: ticks from rounds that are over (not the current one, and
// all at least ROUND_GRACE old). { [round]: [items] }.
export function staleRounds(list, round, now) {
  if (resetMode(list) !== 'match') return {};
  const by = {};
  for (const i of Object.values(list?.items || {})) {
    if (!i?.done || !i.doneRound || i.doneRound === round) continue;
    (by[i.doneRound] ||= []).push(i);
  }
  for (const [r, items] of Object.entries(by)) if (items.some((i) => now - num(i.doneAt) < ROUND_GRACE)) delete by[r];
  return by;
}

// Run doc ids, fixed so a retry can't save the same run twice.
export const dayRunId = (day) => `day-${day}`;
export const roundRunId = (round, items) => `round-${String(round).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80)}-${Math.min(...items.map((i) => num(i.doneAt)))}`;

// Apply field updates ('a.b.c': value) and removals to a plain object (the
// demo store, and tests): the same result Firestore's updateDoc gives.
export function applyFields(doc, fields = {}, remove = []) {
  const out = structuredClone(doc || {});
  const walk = (path, make) => {
    const keys = path.split('.');
    let o = out;
    for (const k of keys.slice(0, -1)) {
      if (o[k] == null || typeof o[k] !== 'object') {
        if (!make) return null;
        o[k] = {};
      }
      o = o[k];
    }
    return [o, keys.at(-1)];
  };
  for (const [path, v] of Object.entries(fields)) {
    const [o, k] = walk(path, true);
    o[k] = v;
  }
  for (const path of remove) {
    const hit = walk(path, false);
    if (hit) delete hit[0][hit[1]];
  }
  return out;
}

// Items assigned to someone new (for the notification): [{ item, who, by }].
// The same item with the same assignedAt (moved to another list, or put back
// with Undo) isn't new.
export function newAssignees(before, after) {
  const was = before?.items || {};
  const out = [];
  for (const it of Object.values(after?.items || {})) {
    if (!it?.who) continue;
    const old = was[it.id];
    if (old && old.who === it.who && num(old.assignedAt) === num(it.assignedAt)) continue;
    out.push({ item: it, who: it.who, by: it.assignedBy || '' });
  }
  return out;
}
