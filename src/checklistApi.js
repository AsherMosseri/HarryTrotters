// What the Checklists tab, Today's pinned lists and run mode call (3.3),
// wrapped with the signed-in person, error toasts and Undo. Workspace spreads
// these into its api. Moves, sections and runs are worked out by
// functions/shared/checklists.js, the same code the demo and server use.
import * as CL from '../functions/shared/checklists.js';
import { itemId } from './data/diff.js';
import { preparePhoto } from './util.js';
import { teamDay } from '../functions/shared/coins.js';

const UNDO_MS = 8000; // how long the toast (and its Undo) stays

export function checklistApi({ store, actor, fail, toast, lists, createTask, pins, savePins }) {
  const find = (id) => lists.current.find((c) => c.id === id);
  const save = (list, fields, remove = []) => store.saveChecklistFields(list.id, fields, remove).catch(fail);
  const undoable = (text, undo) => toast({ text, action: { label: 'Undo', run: undo } });
  // The fields as they are now, to put back with Undo.
  const restoreOf = (list, fields) => {
    const back = {};
    const gone = [];
    for (const k of Object.keys(fields)) {
      const v = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), list);
      if (v === undefined) gone.push(k);
      else back[k] = v;
    }
    return { back, gone };
  };
  // A photo on a removed item goes once the Undo is gone, unless it came back.
  const dropPhotoLater = (photo, id) => {
    if (!photo?.path) return;
    setTimeout(() => {
      if (lists.current.some((c) => c.items?.[id]?.photo?.path === photo.path)) return;
      store.deleteChecklistPhoto(photo).catch((e) => console.warn('checklist photo', e));
    }, UNDO_MS + 1500);
  };

  return {
    toggleChecklistItem: (list, item, done, round = '') =>
      save(list, {
        [`items.${item.id}.done`]: done,
        [`items.${item.id}.doneBy`]: done ? actor.name : '',
        [`items.${item.id}.doneAt`]: done ? Date.now() : null,
        [`items.${item.id}.doneRound`]: done ? round : '',
      }),
    addChecklistItem: (list, text) => {
      if (Object.keys(list.items || {}).length >= CL.MAX_ITEMS) return fail({ message: `A list holds up to ${CL.MAX_ITEMS} items.` });
      const id = itemId();
      return store
        .setChecklistItem(list.id, { id, text: text.slice(0, CL.MAX_TEXT), done: false, order: CL.nextOrder(list), section: CL.lastSection(list) })
        .catch(fail);
    },
    editChecklistItem: (list, item, patch) =>
      save(list, Object.fromEntries(Object.entries(patch).map(([k, v]) => [`items.${item.id}.${k}`, v]))),
    removeChecklistItem: (list, item) => {
      save(list, {}, [`items.${item.id}`]);
      dropPhotoLater(item.photo, item.id);
      undoable(`Removed “${clip(item.text)}”.`, () => {
        const now = find(list.id);
        if (now) store.setChecklistItem(list.id, item).catch(fail);
      });
    },
    // Uncheck all: the run is saved first (History), in the same write.
    uncheckAll: (list, round = '') => {
      const items = Object.values(list.items || {}).filter((i) => i?.id);
      const run = CL.runRecord(list, { by: actor.name, at: Date.now(), reason: 'manual', round });
      const fields = CL.uncheckFields(items);
      const { back } = restoreOf(list, fields);
      const { id, done } = store.saveChecklistRun(list.id, run, fields);
      done.catch(fail);
      undoable(`Unchecked “${clip(list.title)}”. Saved in its history.`, () => {
        save(list, back);
        store.deleteChecklistRun(list.id, id).catch((e) => console.warn('undo run', e));
      });
    },
    // Drag within a list (or a section's arrow keys, with quiet).
    moveChecklistItem: (list, item, section, index, quiet = false) => {
      const fields = CL.planMove(list, item.id, section, index);
      if (!Object.keys(fields).length) return;
      const { back } = restoreOf(list, fields);
      save(list, fields);
      if (!quiet) undoable(`Moved “${clip(item.text)}”.`, () => save(list, back));
    },
    stepChecklistItem: (list, item, dir) => {
      const fields = CL.planStep(list, item.id, dir);
      if (Object.keys(fields).length) save(list, fields);
    },
    // To another list: one write, ticks and all. Undo moves it back where it was.
    moveChecklistItemTo: (from, to, item, section = '', index = Infinity) => {
      if (from.id === to.id) return;
      if (Object.keys(to.items || {}).length >= CL.MAX_ITEMS) return fail({ message: `“${to.title}” is full (${CL.MAX_ITEMS} items).` });
      const groups = CL.groupsOf(from);
      const g = groups.find((x) => x.items.some((i) => i.id === item.id));
      const at = { section: g?.id || '', index: g ? g.items.findIndex((i) => i.id === item.id) : 0 };
      const { item: landed, fields } = CL.planCrossMove(to, item, section, index);
      store.moveChecklistItem(from.id, to.id, landed, fields).catch(fail);
      undoable(`Moved “${clip(item.text)}” to ${clip(to.title, 30)}.`, () => {
        const src = find(to.id);
        const dst = find(from.id);
        const cur = src?.items?.[item.id];
        if (!cur || !dst) return;
        const back = CL.planCrossMove(dst, { ...cur, section: item.section }, at.section, at.index);
        store.moveChecklistItem(to.id, from.id, back.item, back.fields).catch(fail);
      });
    },
    // Sections: headings items sit under.
    addChecklistSection: (list, title) => {
      if (CL.sortedSections(list).length >= CL.MAX_SECTIONS) return fail({ message: `A list holds up to ${CL.MAX_SECTIONS} sections.` });
      const id = itemId();
      const order = CL.sortedSections(list).length;
      return save(list, { [`sections.${id}`]: { id, title: title.slice(0, 80), order } });
    },
    renameChecklistSection: (list, sec, title) => save(list, { [`sections.${sec.id}.title`]: title.slice(0, 80) }),
    moveChecklistSection: (list, sec, index, quiet = false) => {
      const fields = CL.planSectionMove(list, sec.id, index);
      if (!Object.keys(fields).length) return;
      const { back } = restoreOf(list, fields);
      save(list, fields);
      if (!quiet) undoable(`Moved “${clip(sec.title)}”.`, () => save(list, back));
    },
    // withItems: its items go too; else they stay, with no heading.
    removeChecklistSection: (list, sec, withItems) => {
      const items = Object.values(list.items || {}).filter((i) => i?.id && i.section === sec.id);
      const fields = {};
      const remove = [`sections.${sec.id}`];
      if (withItems) items.forEach((i) => remove.push(`items.${i.id}`));
      else items.forEach((i) => (fields[`items.${i.id}.section`] = ''));
      save(list, fields, remove);
      if (withItems) items.forEach((i) => dropPhotoLater(i.photo, i.id));
      undoable(withItems ? `Removed “${clip(sec.title)}” and ${items.length} ${items.length === 1 ? 'item' : 'items'}.` : `Removed the “${clip(sec.title)}” heading.`, () => {
        const back = { [`sections.${sec.id}`]: sec };
        items.forEach((i) => (back[`items.${i.id}`] = i));
        save(list, back);
      });
    },
    // The cards' order (drag the card by its handle).
    moveChecklist: (list, index) => {
      const orders = CL.planListMove(lists.current, list.id, index);
      if (Object.keys(orders).length) store.orderChecklists(orders).catch(fail);
    },
    duplicateChecklist: async (list) => {
      const copy = CL.duplicateList(list, itemId);
      const order = Math.max(-1, ...lists.current.map((c) => (typeof c.order === 'number' ? c.order : -1))) + 1;
      let id;
      try {
        id = await store.createChecklist({ ...copy, ...(lists.current.some((c) => typeof c.order === 'number') ? { order } : {}) }, actor);
      } catch (e) {
        return fail(e);
      }
      // The person who made it can delete it for 10 minutes (firestore.rules).
      undoable(`Made “${clip(copy.title)}”.`, () => store.deleteChecklist(id).catch(fail));
      return id;
    },
    setChecklistReset: (list, mode) =>
      save(list, { autoReset: mode, ...(mode === 'daily' ? { lastReset: teamDay(Date.now()) } : {}) }),
    assignChecklistItem: (list, item, who) =>
      who
        ? save(list, { [`items.${item.id}.who`]: who, [`items.${item.id}.assignedBy`]: actor.name, [`items.${item.id}.assignedAt`]: Date.now() })
        : save(list, {}, [`items.${item.id}.who`, `items.${item.id}.assignedBy`, `items.${item.id}.assignedAt`]),
    addChecklistPhoto: async (list, item, file) => {
      try {
        const photo = await store.uploadChecklistPhoto(item.id, await preparePhoto(file), actor);
        const cur = find(list.id);
        // Gone while it uploaded (removed or moved): put it where the item is now.
        const home = cur?.items?.[item.id] ? cur : lists.current.find((c) => c.items?.[item.id]);
        if (!home) return store.deleteChecklistPhoto(photo).catch(() => {});
        await store.saveChecklistFields(home.id, { [`items.${item.id}.photo`]: photo });
        if (item.photo?.path) store.deleteChecklistPhoto(item.photo).catch((e) => console.warn('old photo', e));
      } catch (e) {
        fail(
          e?.code === 'storage/unauthorized'
            ? { message: 'Photo upload was blocked. The photo storage rules may need setting up (ask team management).' }
            : e,
        );
      }
    },
    removeChecklistPhoto: (list, item) => {
      if (!item.photo) return;
      save(list, {}, [`items.${item.id}.photo`]);
      store.deleteChecklistPhoto(item.photo).catch((e) => console.warn('checklist photo', e));
    },
    // Turn an item into a task (the board's add-task path). The task names the
    // list; the item shows the task. Finishing the task ticks the item (the
    // onTaskChecklist function on the server; the demo store does the same).
    checklistItemToTask: async (list, item) => {
      const id = await createTask({
        title: item.text,
        description: `From the “${list.title}” checklist.${item.note ? `\n\n${item.note}` : ''}`,
        assignees: item.who ? [item.who] : [actor.name],
        status: 'todo',
        fromList: { list: list.id, item: item.id, title: list.title },
      });
      if (!id) return null;
      const home = lists.current.find((c) => c.items?.[item.id]) || list;
      save(home, { [`items.${item.id}.taskId`]: id });
      return id;
    },
    subscribeChecklistRuns: (list, cb) => store.subscribeChecklistRuns(list.id, cb, (e) => console.warn('checklist history', e)),
    deleteChecklistRun: (list, run) => store.deleteChecklistRun(list.id, run.id).catch(fail),
    // Pinned to your own Today (saved on your profile, like your tab order).
    pinChecklist: (list, on) => {
      const cur = pins.current || [];
      savePins(on ? [...new Set([...cur, list.id])] : cur.filter((id) => id !== list.id));
    },
    checklistToast: (text, action) => toast({ text, ...(action ? { action } : {}) }),
  };
}

function clip(text = '', n = 40) {
  const t = String(text || '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t || 'item';
}
