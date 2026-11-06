// 3.3 checklists (functions/shared/checklists.js): sections and ordering,
// moves within and across lists, list order, duplicates, run records, and
// auto-reset timing (daily and per match).
// Run: node scripts/test-checklists.mjs
import * as C from '../functions/shared/checklists.js';
import { teamDay, teamMidnight } from '../functions/shared/coins.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const it = (id, order, extra = {}) => ({ id, text: id.toUpperCase(), done: false, order, ...extra });
const list = (items, sections = {}, extra = {}) => ({ id: 'L', title: 'Pit', items: Object.fromEntries(items.map((i) => [i.id, i])), sections, ...extra });
const ids = (l) => C.shownItems(l).map((i) => i.id).join('');
const apply = (l, fields, remove) => C.applyFields(l, fields, remove);

// ---------- groups and old docs ----------
const old = list([it('b', 1), it('a', 0), it('c', 2)]);
eq(ids(old), 'abc', 'an old list (no sections) shows by order');
eq(C.groupsOf(old).length, 1, 'one group with no headings');
const noOrder = list([{ id: 'x', text: 'X' }, { id: 'w', text: 'W' }]);
eq(ids(noOrder), 'wx', 'items with no order fall back to their ids, stably');
const secs = { e: { id: 'e', title: 'Electrical', order: 1 }, m: { id: 'm', title: 'Mechanical', order: 0 } };
const L1 = list([it('a', 0), it('b', 1, { section: 'e' }), it('c', 2, { section: 'm' }), it('d', 3, { section: 'e' }), it('z', 4, { section: 'gone' })], secs);
eq(
  C.groupsOf(L1).map((g) => `${g.title}:${g.items.map((i) => i.id).join('')}`),
  [':az', 'Mechanical:c', 'Electrical:bd'],
  'sections in order, items under them; a missing section falls back to no heading',
);

// ---------- moves within a list ----------
let f = C.planMove(L1, 'a', 'e', 1);
let L2 = apply(L1, f);
eq(C.groupsOf(L2).map((g) => g.items.map((i) => i.id).join('')), ['z', 'c', 'bad'], 'move a into Electrical after b');
eq(Object.keys(f).every((k) => /^items\.[a-z]+\.(order|section)$/.test(k)), true, 'a move writes only order and section fields');
eq(C.planMove(L2, 'a', 'e', 1), {}, 'moving to where it is writes nothing');
f = C.planStep(L2, 'c', -1);
eq(C.groupsOf(apply(L2, f)).map((g) => g.items.map((i) => i.id).join('')), ['zc', '', 'bad'], 'step up from the top of a section lands at the end of the one above');
f = C.planStep(L2, 'z', 1);
eq(C.groupsOf(apply(L2, f)).map((g) => g.items.map((i) => i.id).join('')), ['', 'zc', 'bad'], 'step down past the end goes to the start of the next section');
eq(C.planStep(L2, 'd', 1), {}, 'the last item can’t step down');
eq(C.planMove(L2, 'nope', '', 0), {}, 'moving a missing item does nothing');
eq(C.groupsOf(apply(L2, C.planMove(L2, 'd', '', 99))).map((g) => g.items.map((i) => i.id).join('')), ['zd', 'c', 'ba'], 'an index past the end clamps');

// ---------- across lists ----------
const src = list([it('a', 0, { done: true, doneBy: 'Mia Chen', doneAt: 5, who: 'Ira Kumar', assignedAt: 9, note: 'n', photo: { path: 'p' } }), it('b', 1)]);
const dst = { id: 'D', title: 'Other', items: { x: it('x', 0), y: it('y', 1, { section: 's' }) }, sections: { s: { id: 's', title: 'S', order: 0 } } };
const cm = C.planCrossMove(dst, src.items.a, 's', 0);
eq([cm.item.done, cm.item.doneBy, cm.item.who, cm.item.assignedAt, cm.item.note, cm.item.photo?.path, cm.item.section], [true, 'Mia Chen', 'Ira Kumar', 9, 'n', 'p', 's'], 'a moved item keeps its tick, person, note and photo, and takes the target section');
const D2 = apply(dst, { ...cm.fields, 'items.a': cm.item });
eq(C.groupsOf(D2).map((g) => g.items.map((i) => i.id).join('')), ['x', 'ay'], 'it lands where it was dropped');
eq(Object.keys(cm.fields).some((k) => k.startsWith('items.a.')), false, 'the moved item is written whole, not as field paths');
const cm2 = C.planCrossMove(dst, { ...src.items.a, section: 'gone' }, 'nope', 5);
eq([cm2.item.section, cm2.item.order], ['', 1], 'a section the target lacks becomes no heading, at the end of that group');

// ---------- sections ----------
f = C.planSectionMove(L1, 'e', 0);
eq(C.sortedSections(apply(L1, f)).map((s) => s.title), ['Electrical', 'Mechanical'], 'drag a section above another');
eq(C.planSectionMove(L1, 'm', 0), {}, 'a section already there writes nothing');
eq(C.lastSection(L1), 'e', 'new items go under the last section');
eq(C.nextOrder(L1), 5, 'next order is one past the highest');
eq(C.nextOrder(list([])), 0, 'first item order 0');

// ---------- list order ----------
const lists = [
  { id: 'old1', createdAt: 1000 },
  { id: 'old2', createdAt: { toMillis: () => 500 } },
  { id: 'new', createdAt: 3000, order: 1 },
  { id: 'pending' }, // no time at all (demo seeds): first, as before 3.3
];
eq(C.sortLists(lists).map((c) => c.id), ['pending', 'new', 'old2', 'old1'], 'no time first, then lists with an order, then by when they were made');
const lo = C.planListMove(lists, 'old1', 0);
eq(lo, { old1: 0, pending: 1, new: 2, old2: 3 }, 'moving a list numbers every list that changes');
eq(C.sortLists(lists.map((c) => ({ ...c, order: lo[c.id] ?? c.order }))).map((c) => c.id), ['old1', 'pending', 'new', 'old2'], 'and they sort the new way');

// ---------- duplicate ----------
let n = 0;
const dup = C.duplicateList({ ...L1, autoReset: 'daily', lastReset: '2026-11-05', order: 3, items: { ...L1.items, a: { ...L1.items.a, done: true, who: 'Mia Chen', photo: { path: 'x' }, taskId: 't1', note: 'keep me' } } }, () => `n${n++}`);
eq(dup.title, 'Copy of Pit', 'copy title');
eq(Object.values(dup.items).some((i) => i.done || i.who || i.photo || i.taskId), false, 'nothing ticked, no people, photos or tasks');
eq(Object.keys(dup.items).some((k) => L1.items[k]), false, 'new item ids');
eq(C.groupsOf(dup).map((g) => `${g.title}:${g.items.map((i) => i.text).join('')}`), [':AZ', 'Mechanical:C', 'Electrical:BD'], 'same sections and order');
eq([dup.autoReset, dup.lastReset, dup.order], ['daily', undefined, undefined], 'keeps the reset setting, not the stamp or position');
eq(Object.values(dup.items).find((i) => i.text === 'A').note, 'keep me', 'notes are kept');

// ---------- runs ----------
const R = list([it('a', 0, { done: true, doneBy: 'Mia Chen', doneAt: 100, section: 'e' }), it('b', 1), it('c', 2, { done: true, doneBy: 'Ira Kumar', doneAt: 200 })], { e: { id: 'e', title: 'Electrical', order: 0 } });
const run = C.runRecord(R, { by: 'Asher Mosseri', at: 999 });
eq([run.total, run.done, run.reason, run.by, run.at], [3, 2, 'manual', 'Asher Mosseri', 999], 'a run counts done of total');
eq(run.items.map((i) => [i.text, i.section, i.done, i.by, i.at]), [['B', '', false, '', 0], ['C', '', true, 'Ira Kumar', 200], ['A', 'Electrical', true, 'Mia Chen', 100]], 'who ticked each item when, in the order shown');
const unf = C.uncheckFields(Object.values(R.items));
eq(Object.keys(unf).length, 8, 'uncheck writes only the ticked items');
eq(C.shownItems(apply(R, unf)).filter((i) => i.done).length, 0, 'and unticks them');

// ---------- per match ----------
const Q = { id: 'Q', title: 'Before queueing', items: { a: it('a', 0, { done: true, doneRound: 'm1', doneAt: 1000 }), b: it('b', 1, { done: true, doneRound: 'm2', doneAt: 5000 }) } };
eq(C.resetMode(Q), 'match', 'Before queueing is always per match');
eq(C.resetMode({ title: 'x', autoReset: 'daily' }), 'daily', 'daily');
eq(C.resetMode({ title: 'x', autoReset: 'weird' }), '', 'anything else is off');
eq([C.isDone(Q, Q.items.a, 'm2'), C.isDone(Q, Q.items.b, 'm2')], [false, true], 'per-match lists count this round’s ticks only');
eq(C.isDone({ title: 'x' }, Q.items.a, 'm2'), true, 'other lists count any tick');
const qr = C.runRecord(Q, { at: 1, reason: 'match', round: 'm1' });
eq([qr.done, qr.total, qr.round], [1, 2, 'm1'], 'a match run counts that round');
const now = 1000 + C.ROUND_GRACE + 1;
eq(Object.keys(C.staleRounds(Q, 'm2', now)), ['m1'], 'an old round past the grace is stale');
eq(Object.keys(C.staleRounds(Q, 'm2', 1000 + C.ROUND_GRACE - 1)), [], 'not before the grace');
eq(Object.keys(C.staleRounds(Q, 'm1', 5000 + C.ROUND_GRACE + 1)), ['m2'], 'fresh ticks for a round the server isn’t on yet wait');
eq(C.staleRounds({ ...Q, title: 'x' }, 'm2', now), {}, 'lists that aren’t per match have no rounds');
eq(C.roundRunId('demo-q1', [{ doneAt: 7 }, { doneAt: 3 }]), 'round-demo-q1-3', 'round run id is fixed by its round and first tick');
eq(C.roundRunId('a/b c', [{ doneAt: 1 }]), 'round-a-b-c-1', 'and safe as a doc id');
const matches = [
  { id: 'e-q1', event: 'E', time: 10 * 60000, ours: { total: 5 } },
  { id: 'e-q2', event: 'E', time: 40 * 60000 },
];
const cl = [{ title: 'Before queueing', queue: null }];
eq(C.currentRound({ matches, settings: { compEvent: { code: 'E' } }, checklists: cl, now: 15 * 60000 }), 'e-q2', 'the round is the next match');
eq(C.currentRound({ matches: [], settings: {}, checklists: [{ title: 'Before queueing', queue: { round: 'hand-5', at: 9 } }], now: 0 }), 'hand-5', 'or a countdown started by hand');
eq(C.currentRound({ matches: [], settings: {}, checklists: [], now: 0 }), 'free', 'or free');

// ---------- daily ----------
const D = { title: 'Daily', autoReset: 'daily', lastReset: '2026-11-05' };
eq(C.dailyDue(D, '2026-11-05'), null, 'not again the same day');
eq(C.dailyDue(D, '2026-11-06'), 'reset', 'the next team day');
eq(C.dailyDue({ ...D, lastReset: '' }, '2026-11-06'), 'stamp', 'no stamp yet: stamp only');
eq(C.dailyDue({ ...D, autoReset: '' }, '2026-11-06'), null, 'off');
// Team midnight (New York): 11:59 PM and 12:01 AM are different days.
const mid = teamMidnight('2026-11-06');
eq([teamDay(mid - 60000), teamDay(mid + 60000)], ['2026-11-05', '2026-11-06'], 'the team day turns at New York midnight');
eq(C.dayRunId('2026-11-05'), 'day-2026-11-05', 'day run id');

// ---------- assignments ----------
const before = { items: { a: it('a', 0, { who: 'Mia Chen', assignedAt: 5 }), b: it('b', 1) } };
eq(C.newAssignees(before, before), [], 'no change, no one new');
eq(C.newAssignees(before, { items: { ...before.items, b: { ...before.items.b, who: 'Ira Kumar', assignedBy: 'Mia Chen', assignedAt: 9 } } }).map((x) => [x.who, x.by]), [['Ira Kumar', 'Mia Chen']], 'a new person on an item');
eq(C.newAssignees({ items: {} }, { items: { a: before.items.a } }).length, 1, 'an item arriving with a person counts here (the server dedupes by item and time)');
eq(C.newAssignees(before, { items: { a: { ...before.items.a, who: 'Ira Kumar', assignedAt: 6 } } }).map((x) => x.who), ['Ira Kumar'], 'a different person');

// ---------- applyFields ----------
eq(C.applyFields({ a: { b: 1 } }, { 'a.c': 2, 'x.y': 3 }, ['a.b', 'no.such']), { a: { c: 2 }, x: { y: 3 } }, 'field paths set and remove like Firestore');

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
