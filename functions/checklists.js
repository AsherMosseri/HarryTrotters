// Checklists 3.3 on the server. index.js makes these with its database,
// notify() and renamer (checklistFunctions) and exports them.
//
// - onChecklist: someone given an item hears about it (once per item and
//   assignment: a fixed claim doc, so a retry, a move to another list or an
//   Undo can't send it twice). A deleted list takes its history and photos
//   with it.
// - onChecklistRun: keeps each list's newest RUNS_KEPT runs.
// - checklistResets (every 5 minutes): "Every day" lists save a run and
//   uncheck at the team's midnight (a lastReset day stamp, in a transaction,
//   so it happens once); "Before each match" lists save each finished
//   match's ticks as a run and clear them (a fixed run id, in a transaction).
// - onTaskChecklist: finishing a task made from an item ticks the item.
//
// No coins anywhere here. Every write is in a transaction or keyed, so a
// retried run of any of these changes nothing the second time.
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getStorage } from 'firebase-admin/storage';
import { teamDay } from './shared/coins.js';
import * as CL from './shared/checklists.js';

const TIME_ZONE = 'America/New_York';
// Tests set a fixed clock.
export const checklistClock = { now: () => Date.now() };
const first = (name) => (name || 'Someone').split(' ')[0];
const clip = (text, n = 140) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

export function checklistFunctions({ db, notify, renamer, personId, storage = () => getStorage().bucket() }) {
  const listsCol = db.collection('checklists');

  // The pit's round (only read when a per-match list has a tick to judge:
  // the schedule isn't read every 5 minutes for nothing).
  async function roundNow(lists, now) {
    if (!lists.some((c) => CL.resetMode(c) === 'match' && Object.values(c.items || {}).some((i) => i?.done && i.doneRound))) return 'free';
    const [settings, matches] = await Promise.all([db.doc('settings/team').get(), db.collection('matches').get()]);
    return CL.currentRound({
      matches: matches.docs.map((d) => ({ id: d.id, ...d.data() })),
      settings: settings.data() || {},
      checklists: lists,
      now,
    });
  }
  const labelOf = async (round) => {
    if (!round || round === 'free' || round.startsWith('hand-')) return '';
    const m = await db.doc(`matches/${round}`).get();
    return m.exists ? m.get('label') || '' : '';
  };

  const onChecklist = onDocumentWritten('checklists/{listId}', async (event) => {
    const listId = event.params.listId;
    const before = event.data?.before?.data() || null;
    const after = event.data?.after?.data() || null;

    // Deleted: its history and photos go too (a photo whose item was moved to
    // another list first stays).
    if (before && !after) {
      const runs = await listsCol.doc(listId).collection('history').listDocuments();
      for (let i = 0; i < runs.length; i += 400) {
        const batch = db.batch();
        runs.slice(i, i + 400).forEach((r) => batch.delete(r));
        await batch.commit();
      }
      const others = (await listsCol.get()).docs.map((d) => d.data());
      const photos = Object.values(before.items || {}).filter((i) => i?.photo?.path && !others.some((c) => c.items?.[i.id]));
      await Promise.all(
        photos.map((i) =>
          Promise.all([`${i.photo.path}.jpg`, `${i.photo.path}-thumb.jpg`].map((p) => storage().file(p).delete({ ignoreNotFound: true }))).catch((e) =>
            logger.warn('checklist photo', i.photo.path, e.message),
          ),
        ),
      );
      return;
    }
    if (!after) return;

    const fresh = CL.newAssignees(before, after);
    if (!fresh.length) return;
    const rename = await renamer();
    const notes = [];
    for (const { item, who, by } of fresh) {
      const to = rename(who);
      const from = rename(by || '');
      // One claim per item, person and assignment.
      const ref = db.doc(`checklistAssigns/${item.id}_${personId(to)}_${Number(item.assignedAt) || 0}`);
      const mine = await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) return false;
        tx.set(ref, { list: listId, item: item.id, to, by: from, at: checklistClock.now() });
        return true;
      });
      if (!mine || !to || to === from) continue;
      notes.push({
        to,
        type: 'checklist',
        title: `${first(from)} gave you a checklist item`,
        body: clip(`${item.text || 'An item'} · ${after.title || 'Checklist'}`),
        open: `checklist:${listId}/${item.id}`,
        by: from,
      });
    }
    await notify(notes);
  });

  // The newest RUNS_KEPT runs per list stay.
  const onChecklistRun = onDocumentCreated('checklists/{listId}/history/{runId}', async (event) => {
    const col = listsCol.doc(event.params.listId).collection('history');
    const old = await col.orderBy('at', 'desc').offset(CL.RUNS_KEPT).get();
    if (old.empty) return;
    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });

  // One pass over every list (the scheduled function, and the tests).
  async function resetPass(now = checklistClock.now()) {
    const today = teamDay(now);
    const snap = await listsCol.get();
    const lists = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const round = await roundNow(lists, now);
    const done = [];
    for (const list of lists) {
      const ref = listsCol.doc(list.id);
      const due = CL.dailyDue(list, today);
      if (due) {
        const r = await db.runTransaction(async (tx) => {
          const cur = (await tx.get(ref)).data();
          if (!cur) return null;
          const still = CL.dailyDue(cur, today);
          if (still === 'stamp') {
            tx.update(ref, { lastReset: today });
            return 'stamp';
          }
          if (still !== 'reset') return null;
          const items = Object.values(cur.items || {});
          if (items.some((i) => i?.done)) {
            const runRef = ref.collection('history').doc(CL.dayRunId(cur.lastReset));
            const had = await tx.get(runRef);
            if (!had.exists) tx.set(runRef, CL.runRecord(cur, { at: now, reason: 'daily' }));
          }
          tx.update(ref, { ...CL.uncheckFields(items), lastReset: today });
          return 'reset';
        });
        if (r) done.push(`${list.id}:${r}`);
        continue;
      }
      const stale = CL.staleRounds(list, round, now);
      for (const r of Object.keys(stale)) {
        const label = await labelOf(r);
        const ok = await db.runTransaction(async (tx) => {
          const cur = (await tx.get(ref)).data();
          if (!cur) return false;
          const items = CL.staleRounds({ ...cur, id: list.id }, round, now)[r];
          if (!items?.length) return false;
          const runRef = ref.collection('history').doc(CL.roundRunId(r, items));
          const had = await tx.get(runRef);
          if (!had.exists) tx.set(runRef, CL.runRecord(cur, { at: now, reason: 'match', round: r, label }));
          tx.update(ref, CL.uncheckFields(items));
          return true;
        });
        if (ok) done.push(`${list.id}:${r}`);
      }
    }
    return done;
  }
  const checklistResets = onSchedule({ schedule: 'every 5 minutes', timeZone: TIME_ZONE }, async () => {
    const done = await resetPass();
    if (done.length) logger.info('checklist resets', done);
  });

  // A task made from an item ("Make it a task") is done: tick the item, as
  // whoever finished the task. Found by the item's id, so it's found even
  // after the item moved to another list.
  const onTaskChecklist = onDocumentWritten('tasks/{taskId}', async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const ref = after?.fromList;
    if (!ref?.item || after.status !== 'done' || before?.status === 'done' || after.deletedAt) return;
    const now = checklistClock.now();
    let list = ref.list ? await listsCol.doc(ref.list).get() : null;
    if (!list?.exists || !list.get(`items.${ref.item}`)) {
      list = (await listsCol.get()).docs.find((d) => d.get(`items.${ref.item}`)) || null;
    }
    if (!list) return;
    const mine = { id: list.id, ...list.data() };
    const round =
      CL.resetMode(mine) === 'match'
        ? CL.currentRound({
            matches: (await db.collection('matches').get()).docs.map((d) => ({ id: d.id, ...d.data() })),
            settings: (await db.doc('settings/team').get()).data() || {},
            checklists: (await listsCol.get()).docs.map((d) => ({ id: d.id, ...d.data() })),
            now,
          })
        : '';
    const rename = await renamer();
    const by = rename(after.updatedBy || after.createdBy || '');
    await db.runTransaction(async (tx) => {
      const cur = (await tx.get(list.ref)).data();
      const item = cur?.items?.[ref.item];
      if (!item || CL.isDone({ ...cur }, item, round)) return;
      tx.update(list.ref, {
        [`items.${ref.item}.done`]: true,
        [`items.${ref.item}.doneBy`]: by,
        [`items.${ref.item}.doneAt`]: now,
        [`items.${ref.item}.doneRound`]: round,
      });
    });
  });

  return { onChecklist, onChecklistRun, checklistResets, onTaskChecklist, resetPass };
}
