import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { STARTER_CHECKLISTS, starterItems } from '../checklists.js';
import * as CL from '../../functions/shared/checklists.js';
import { fullTime, relTime, useLocalStorage } from '../util.js';
import { Avatar, CloseIcon, DraftInput, Overlay, PlusIcon } from './common.jsx';
import { confirmDialog, promptDialog } from './Dialogs.jsx';
import { Sheet } from './PhoneChrome.jsx';
import { Icon } from './shell/icons.jsx';
import { useFlip } from '../motion.js';
import { STATUSES } from '../config.js';

// The Checklists tab (3.3): lists with sections, items you tap to edit, drag
// (by the handle, finger or mouse) within and between lists, a person, note,
// photo and task on each item, Undo, run history, auto-reset, pinning to
// Today and a full-screen run mode for the pit. The writes are in
// checklistApi.js; ordering and runs in functions/shared/checklists.js.

const first = (name = '') => name.split(' ')[0];
const statusOf = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

function useNow(every) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

// The match round per-match lists count ticks for (the pit screen's round).
export function useChecklistRound(matches, settings, checklists) {
  const now = useNow(30000);
  const tick = Math.floor(now / 30000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => CL.currentRound({ matches, settings, checklists, now }), [matches, settings, checklists, tick]);
}

export const RESET_LABEL = { '': 'Off', daily: 'Every day', match: 'Before each match' };
const RESET_CHIP = { daily: 'Resets every day', match: 'Resets every match' };

export function progressOf(list, round) {
  const items = CL.shownItems(list);
  return { items, done: items.filter((i) => CL.isDone(list, i, round)).length };
}

// ---------- dragging ----------
// Ids: i:<list>:<item> (rows), g:<list>:<section> (a group's body, for the
// end of it), s:<list>:<section> (headings), l:<list> (cards).
const DROPS = { item: ['item', 'group', 'section'], section: ['section'], list: ['list'] };
const RANK = { item: 0, section: 1, group: 2, list: 0 };
const collide = (args) => {
  const a = args.active.data.current || {};
  let cs = args.droppableContainers.filter((c) => (DROPS[a.type] || []).includes(c.data.current?.type));
  // Headings move within their own list.
  if (a.type === 'section') cs = cs.filter((c) => c.data.current.listId === a.listId);
  const scoped = { ...args, droppableContainers: cs };
  const hits = pointerWithin(scoped);
  const rank = (h) => RANK[cs.find((c) => c.id === h.id)?.data.current?.type] ?? 9;
  if (hits.length) return [...hits].sort((x, y) => rank(x) - rank(y));
  return a.type === 'list' ? rectIntersection(scoped) : [];
};

function useDragRow(id, data, disabled) {
  const drag = useDraggable({ id, data, disabled });
  const drop = useDroppable({ id, data });
  const ref = useCallback(
    (el) => {
      drag.setNodeRef(el);
      drop.setNodeRef(el);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drag.setNodeRef, drop.setNodeRef],
  );
  return { ref, handle: { ...drag.attributes, ...drag.listeners }, dragging: drag.isDragging };
}

// The handle: drag it (finger or mouse), or focus it and use the arrow keys.
function Grip({ id, handle, label, onKey, hidden }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      id={id}
      className="cl-grip"
      {...handle}
      aria-label={`${label} (or use the up and down arrow keys)`}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        onKey(e.key === 'ArrowUp' ? -1 : 1);
        setTimeout(() => document.getElementById(id)?.focus(), 60);
      }}
    >
      <Icon name="grip" size={18} />
    </button>
  );
}

// ---------- one item ----------
function ItemRow({ list, item, round, api, canDrag, drop, onDetails, task, onOpenTask, flash }) {
  const { ref, handle, dragging } = useDragRow(`i:${list.id}:${item.id}`, { type: 'item', listId: list.id, itemId: item.id, secId: item.section || '' }, !canDrag);
  const on = CL.isDone(list, item, round);
  const box = useRef(null);
  return (
    <li
      ref={(el) => {
        box.current = el;
        ref(el);
      }}
      data-flip={item.id}
      data-item={item.id}
      data-drop={`i:${list.id}:${item.id}`}
      className={`cl-item${on ? ' done' : ''}${dragging ? ' dragging' : ''}${drop ? ` drop-${drop}` : ''}${flash ? ' flash' : ''}`}
    >
      <Grip id={`grip-${item.id}`} handle={handle} hidden={!canDrag} label={`Move “${item.text}”`} onKey={(d) => api.stepChecklistItem(list, item, d)} />
      <input
        type="checkbox"
        className="cl-check"
        checked={on}
        aria-label={item.text}
        onChange={(e) => api.toggleChecklistItem(list, item, e.target.checked, round)}
      />
      {/* Tapping the words checks it (people check far more than they edit);
          changing the words is in the item's details (the ⋯). */}
      <button
        type="button"
        className="cl-text cl-text-btn"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => api.toggleChecklistItem(list, item, !on, round)}
      >
        {item.text}
      </button>
      <span className="cl-badges">
        {on && item.doneBy && (
          <span className="cl-by" title={fullTime(item.doneAt)}>
            {first(item.doneBy)}
          </span>
        )}
        {item.taskId && (
          <button className={`cl-task${task?.status === 'done' ? ' done' : ''}`} onClick={() => onOpenTask(item.taskId)} title="Open the task">
            <Icon name="tasks" size={14} />
            <span>{task ? statusOf[task.status]?.short || statusOf[task.status]?.label || 'Task' : 'Task'}</span>
          </button>
        )}
        {item.photo && (
          <button className="cl-thumb" onClick={() => onDetails(item)} aria-label="Photo">
            <img src={item.photo.thumbUrl || item.photo.url} alt="" draggable="false" />
          </button>
        )}
        {item.note && (
          <button className="cl-badge" onClick={() => onDetails(item)} aria-label="Note" title={item.note}>
            <Icon name="doc" size={15} />
          </button>
        )}
        {item.who && (
          <button className="cl-who" onClick={() => onDetails(item)} aria-label={`Assigned to ${item.who}`} title={item.who}>
            <Avatar name={item.who} size={22} />
          </button>
        )}
        <button className="cl-more" onClick={() => onDetails(item)} aria-label={`Details for “${item.text}”`}>
          <Icon name="more" size={18} />
        </button>
      </span>
    </li>
  );
}

// ---------- a section heading ----------
function SectionHead({ list, sec, round, api, canDrag, drop, index, count }) {
  const { ref, handle, dragging } = useDragRow(`s:${list.id}:${sec.id}`, { type: 'section', listId: list.id, secId: sec.id }, !canDrag);
  const items = Object.values(list.items || {}).filter((i) => i?.id && i.section === sec.id);
  const done = items.filter((i) => CL.isDone(list, i, round)).length;
  const remove = async () => {
    if (!items.length) return api.removeChecklistSection(list, sec, false);
    const keep = await confirmDialog({
      title: `Remove the “${sec.title}” heading?`,
      body: `It has ${items.length} ${items.length === 1 ? 'item' : 'items'}. Keep them in the list, or remove them too?`,
      okLabel: 'Keep the items',
      altLabel: 'Remove them too',
    });
    if (keep === true) api.removeChecklistSection(list, sec, false);
    else if (keep === 'alt') api.removeChecklistSection(list, sec, true);
  };
  return (
    <div ref={ref} data-drop={`s:${list.id}:${sec.id}`} className={`cl-sec${dragging ? ' dragging' : ''}${drop ? ` drop-${drop}` : ''}`}>
      <Grip
        id={`grip-${sec.id}`}
        handle={handle}
        hidden={!canDrag}
        label={`Move the ${sec.title} heading`}
        onKey={(d) => index + d >= 0 && index + d < count && api.moveChecklistSection(list, sec, index + d, true)}
      />
      <DraftInput value={sec.title} className="cl-sec-title" aria-label="Section name" maxLength={80} onSave={(t) => t && api.renameChecklistSection(list, sec, t)} />
      <span className="cl-sec-count mono">
        {done}/{items.length}
      </span>
      <button className="cl-sec-remove" onClick={remove} aria-label={`Remove the ${sec.title} heading`}>
        <CloseIcon />
      </button>
    </div>
  );
}

function GroupBody({ list, group, children, drop, empty }) {
  const { setNodeRef } = useDroppable({ id: `g:${list.id}:${group.id}`, data: { type: 'group', listId: list.id, secId: group.id } });
  return (
    <ul ref={setNodeRef} data-drop={`g:${list.id}:${group.id}`} className={`cl-items${drop ? ' drop-end' : ''}${empty ? ' empty' : ''}`}>
      {children}
      {empty && <li className="cl-empty">{empty}</li>}
    </ul>
  );
}

// ---------- a list ----------
function ChecklistCard({ list, ctx, fresh, index, count }) {
  const { api, round, mine, actor, target, pinned, taskById, focusItem } = ctx;
  const [text, setText] = useState('');
  const box = useRef(null);
  const drag = useDraggable({ id: `l:${list.id}`, data: { type: 'list', listId: list.id }, disabled: mine });
  const drop = useDroppable({ id: `l:${list.id}`, data: { type: 'list', listId: list.id } });
  const cardRef = useCallback(
    (el) => {
      box.current = el;
      drop.setNodeRef(el);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drop.setNodeRef],
  );
  // Just made: bring it into view with the cursor in its first item.
  useEffect(() => {
    if (!fresh || !box.current) return;
    box.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.current.querySelector('.check-add input')?.focus({ preventScroll: true });
  }, [fresh]);
  const groups = CL.groupsOf(list);
  const sections = CL.sortedSections(list);
  const shown = mine ? groups.map((g) => ({ ...g, items: g.items.filter((i) => i.who === actor.name) })) : groups;
  const { items, done } = progressOf(list, round);
  const listRef = useRef(null);
  useFlip(listRef, list.items);
  const mode = CL.resetMode(list);
  const isPinned = pinned.includes(list.id);
  const t = target?.listId === list.id ? target : null;
  const canDrag = !mine;

  const add = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    api.addChecklistItem(list, v);
    setText('');
  };
  const dropFor = (g, i) => (t?.kind === 'item' && t.secId === g.id && t.rowId === i.id ? (t.after ? 'after' : 'before') : null);

  return (
    <section
      ref={cardRef}
      data-drop={`l:${list.id}`}
      data-list={list.id}
      className={`checklist-card cl-card${fresh ? ' fresh' : ''}${drag.isDragging ? ' dragging' : ''}${t?.kind === 'list' ? ` drop-${t.after ? 'after' : 'before'}` : ''}`}
    >
      <header>
        <span ref={drag.setNodeRef} className="cl-card-grip">
          <Grip
            id={`grip-${list.id}`}
            handle={{ ...drag.attributes, ...drag.listeners }}
            hidden={!canDrag}
            label={`Move the ${list.title} list`}
            onKey={(d) => index + d >= 0 && index + d < count && api.moveChecklist(list, index + d)}
          />
        </span>
        <DraftInput value={list.title} className="checklist-title" placeholder="Checklist name" aria-label="Checklist name" onSave={(v) => v && api.renameChecklist(list, v)} />
        <span className="checklist-count">
          {done}/{items.length}
        </span>
        <button className="cl-run-btn" onClick={() => ctx.setRun(list.id)} aria-label={`Run ${list.title} full screen`} title="Run it full screen">
          <Icon name="play" size={14} />
          <span>Run</span>
        </button>
        <button className="icon-btn cl-menu-btn" onClick={() => ctx.setMenu(list.id)} aria-label={`More for ${list.title}`}>
          <Icon name="more" size={18} />
        </button>
      </header>
      <div className="ms-progress-bar" style={{ '--c': done === items.length && items.length ? 'var(--st-done)' : 'var(--accent)' }}>
        <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
      </div>
      {(mode || isPinned) && (
        <div className="cl-chips">
          {isPinned && (
            <span className="cl-chip">
              <Icon name="pin" size={13} /> On your Today
            </span>
          )}
          {mode && (
            <span className="cl-chip">
              <Icon name="repeat" size={13} /> {RESET_CHIP[mode]}
            </span>
          )}
        </div>
      )}
      <div className="cl-groups" ref={listRef}>
        {shown.map((g, gi) => {
          if (mine && !g.items.length) return null;
          const sec = g.id ? sections.find((s) => s.id === g.id) : null;
          const showBody = g.items.length > 0 || !!g.id || (t?.kind === 'end' && t.secId === '') || (!sections.length && !mine);
          return (
            <div key={g.id || 'top'} className="cl-group">
              {sec && (
                <SectionHead
                  list={list}
                  sec={sec}
                  round={round}
                  api={api}
                  canDrag={canDrag}
                  index={gi - 1}
                  count={sections.length}
                  drop={t?.kind === 'section' && t.secId === g.id ? (t.after ? 'after' : 'before') : t?.kind === 'into' && t.secId === g.id ? 'into' : null}
                />
              )}
              {showBody && (
                <GroupBody list={list} group={g} drop={t?.kind === 'end' && t.secId === g.id} empty={!mine && !g.items.length ? (g.id ? 'Drag items here' : 'No items yet') : ''}>
                  {g.items.map((i) => (
                    <ItemRow
                      key={i.id}
                      list={list}
                      item={i}
                      round={round}
                      api={api}
                      canDrag={canDrag}
                      drop={dropFor(g, i)}
                      onDetails={(it) => ctx.setDetails({ listId: list.id, itemId: it.id })}
                      task={i.taskId ? taskById.get(i.taskId) : null}
                      onOpenTask={ctx.onOpenTask}
                      flash={focusItem === i.id}
                    />
                  ))}
                </GroupBody>
              )}
            </div>
          );
        })}
      </div>
      {!mine && (
        <form className="check-add" onSubmit={add}>
          <input className="input" value={text} maxLength={CL.MAX_TEXT} onChange={(e) => setText(e.target.value)} placeholder="+ Add an item" aria-label={`Add an item to ${list.title}`} />
        </form>
      )}
      {!mine && (
        <footer className="row gap cl-foot">
          <button
            className="link-btn"
            onClick={async () => {
              const name = await promptDialog({ title: 'New section', label: 'A heading, like Electrical or Mechanical', maxLength: 80, okLabel: 'Add' });
              if (name?.trim()) api.addChecklistSection(list, name.trim());
            }}
          >
            + Section
          </button>
          {done > 0 && (
            <button className="link-btn" onClick={() => api.uncheckAll(list, round)}>
              Uncheck all
            </button>
          )}
          <span className="spacer" />
          <button className="link-btn" onClick={() => ctx.setHistory(list.id)}>
            History
          </button>
        </footer>
      )}
    </section>
  );
}

// ---------- the list's menu ----------
function ListMenu({ list, ctx, index, count, onClose }) {
  const { api, pinned, isManager, actor } = ctx;
  const mode = CL.resetMode(list);
  const isPinned = pinned.includes(list.id);
  const queue = CL.isQueueChecklist(list);
  const go = (fn) => () => {
    onClose();
    fn();
  };
  const created = typeof list.createdAt === 'number' ? list.createdAt : 0;
  // Team management, or whoever made it in the last 10 minutes (an Undo, or a slip).
  const canDelete = isManager || (list.createdBy === actor.name && created > 0 && Date.now() - created < 10 * 60000);
  return (
    <Sheet title={list.title || 'Checklist'} onClose={onClose} className="cl-sheet">
      <div className="cl-menu">
        <button className="cl-menu-row" onClick={go(() => ctx.setRun(list.id))}>
          <Icon name="play" /> Run it full screen
        </button>
        <button className="cl-menu-row" onClick={go(() => api.pinChecklist(list, !isPinned))}>
          <Icon name="pin" /> {isPinned ? 'Unpin from my Today' : 'Pin to my Today'}
        </button>
        <button className="cl-menu-row" onClick={go(() => ctx.setHistory(list.id))}>
          <Icon name="history" /> History
        </button>
        <button className="cl-menu-row" onClick={go(() => api.duplicateChecklist(list))}>
          <Icon name="copy" /> Duplicate
        </button>
        <div className="cl-menu-moves">
          <button className="btn" disabled={index <= 0} onClick={() => api.moveChecklist(list, index - 1)}>
            Move list up
          </button>
          <button className="btn" disabled={index >= count - 1} onClick={() => api.moveChecklist(list, index + 1)}>
            Move list down
          </button>
        </div>
      </div>
      <div className="cl-reset">
        <span className="field-label">Reset on its own</span>
        <div className="cl-seg" role="radiogroup" aria-label="Reset on its own">
          {['', 'daily', 'match'].map((m) => (
            <button key={m || 'off'} role="radio" aria-checked={mode === m} className={`cl-seg-btn${mode === m ? ' on' : ''}`} disabled={queue} onClick={() => api.setChecklistReset(list, m)}>
              {RESET_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="muted small">
          {queue
            ? 'The pit screen runs this list before every match, so it always starts fresh for each match.'
            : mode === 'daily'
              ? 'Unchecks everything at midnight. What was done is saved in History first.'
              : mode === 'match'
                ? 'Ticks count for the next match only, like Before queueing on the pit screen. Each match’s ticks are saved in History.'
                : 'Uncheck all saves what was done in History first.'}
        </p>
      </div>
      {canDelete && (
        <button
          className="link-btn danger cl-delete"
          onClick={async () => {
            if (
              await confirmDialog({
                title: `Delete the “${list.title}” checklist?`,
                body: 'Its items, photos and history go too. This can’t be undone.',
                okLabel: 'Delete',
                danger: true,
              })
            ) {
              onClose();
              api.deleteChecklist(list);
            }
          }}
        >
          Delete checklist
        </button>
      )}
    </Sheet>
  );
}

// ---------- an item's details ----------
function ItemDetails({ list, item, ctx, onClose }) {
  const { api, roster, actor, checklists, round, taskById } = ctx;
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const task = item.taskId ? taskById.get(item.taskId) : null;
  const others = checklists.filter((c) => c.id !== list.id);
  const on = CL.isDone(list, item, round);
  const people = item.who && !roster.includes(item.who) ? [item.who, ...roster] : roster;
  return (
    <Sheet title="Item" onClose={onClose} className="cl-sheet cl-details">
      <label className="cl-d-done">
        <input type="checkbox" checked={on} onChange={(e) => api.toggleChecklistItem(list, item, e.target.checked, round)} />
        <DraftInput
          multiline
          rows={1}
          className="cl-d-text"
          aria-label="Item text"
          value={item.text}
          maxLength={CL.MAX_TEXT}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onSave={(t) => {
            const text = t.replace(/\s+/g, ' ').trim();
            if (text && text !== item.text) api.editChecklistItem(list, item, { text });
          }}
        />
      </label>
      <p className="muted small cl-d-meta">
        {list.title}
        {on && item.doneBy ? ` · checked by ${item.doneBy}, ${relTime(item.doneAt)}` : ''}
      </p>

      <label className="field-label" htmlFor="cl-d-who">
        Who’s doing it
      </label>
      <div className="row gap cl-d-who">
        {item.who && <Avatar name={item.who} size={30} />}
        <select id="cl-d-who" className="input" value={item.who || ''} onChange={(e) => api.assignChecklistItem(list, item, e.target.value)}>
          <option value="">Nobody yet</option>
          {people.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {item.who !== actor.name && (
          <button className="btn" onClick={() => api.assignChecklistItem(list, item, actor.name)}>
            Me
          </button>
        )}
      </div>

      <label className="field-label" htmlFor="cl-d-note">
        Note
      </label>
      <DraftInput
        multiline
        id="cl-d-note"
        className="input"
        value={item.note || ''}
        maxLength={CL.MAX_NOTE}
        placeholder="Torque, part numbers, where it’s packed… (saves when you tap away)"
        onSave={(note) => api.editChecklistItem(list, item, { note: note.trim().slice(0, CL.MAX_NOTE) })}
      />

      <span className="field-label">Photo proof</span>
      <div className="cl-d-photo">
        {item.photo && (
          <a href={item.photo.url} target="_blank" rel="noreferrer" className="cl-d-img">
            <img src={item.photo.thumbUrl || item.photo.url} alt={`Photo for ${item.text}`} />
          </a>
        )}
        <div className="cl-d-photo-actions">
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setBusy(true);
              await api.addChecklistPhoto(list, item, f);
              setBusy(false);
            }}
          />
          <button className="btn" disabled={busy} onClick={() => file.current?.click()}>
            <Icon name="camera" size={16} /> {busy ? 'Uploading…' : item.photo ? 'Replace photo' : 'Add a photo'}
          </button>
          {item.photo && (
            <button className="link-btn danger" onClick={async () => (await confirmDialog({ title: 'Remove this photo?', okLabel: 'Remove', danger: true })) && api.removeChecklistPhoto(list, item)}>
              Remove photo
            </button>
          )}
        </div>
      </div>

      <span className="field-label">Task</span>
      {item.taskId ? (
        <button
          className="cl-d-task"
          onClick={() => {
            onClose();
            ctx.onOpenTask(item.taskId);
          }}
        >
          <Icon name="tasks" size={16} />
          <span className="grow">{task ? task.title || 'Untitled' : 'The task'}</span>
          <span className="muted small">{task ? statusOf[task.status]?.label : 'deleted'}</span>
        </button>
      ) : (
        <button
          className="btn cl-d-maketask"
          onClick={async () => {
            const id = await api.checklistItemToTask(list, item);
            if (id) api.checklistToast('Made a task. Finishing it checks this item.', { label: 'Open', run: () => ctx.onOpenTask(id) });
          }}
        >
          <Icon name="tasks" size={16} /> Make it a task
        </button>
      )}

      <span className="field-label">Move</span>
      <div className="row gap cl-d-move">
        <button className="btn" onClick={() => api.stepChecklistItem(list, item, -1)} aria-label="Move up">
          Up
        </button>
        <button className="btn" onClick={() => api.stepChecklistItem(list, item, 1)} aria-label="Move down">
          Down
        </button>
        {others.length > 0 && (
          <select
            className="input"
            value=""
            aria-label="Move to another list"
            onChange={(e) => {
              const to = others.find((c) => c.id === e.target.value);
              if (!to) return;
              onClose();
              api.moveChecklistItemTo(list, to, item, CL.lastSection(to));
            }}
          >
            <option value="">Move to list…</option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || 'Untitled'}
              </option>
            ))}
          </select>
        )}
      </div>
      <button
        className="link-btn danger cl-delete"
        onClick={() => {
          onClose();
          api.removeChecklistItem(list, item);
        }}
      >
        Remove item
      </button>
    </Sheet>
  );
}

// ---------- history ----------
const REASON = { manual: 'Unchecked', daily: 'Daily reset', match: 'Match' };
export function HistoryDialog({ list, api, isManager, onClose }) {
  const [runs, setRuns] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => api.subscribeChecklistRuns(list, setRuns), [api, list.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet title={`History · ${list.title}`} onClose={onClose} className="cl-sheet cl-history">
      {runs == null ? (
        <p className="muted">Loading…</p>
      ) : !runs.length ? (
        <p className="muted">No runs yet. Uncheck all (or an auto-reset) saves what was done here first.</p>
      ) : (
        <ul className="cl-runs">
          {runs.map((r) => (
            <li key={r.id} className={open === r.id ? 'open' : ''}>
              <button className="cl-run-row" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                <span className="grow">
                  <b>{new Date(r.at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b>
                  <span className="muted small">
                    {' '}
                    · {REASON[r.reason] || 'Run'}
                    {r.label ? ` ${r.label}` : ''}
                    {r.by ? ` by ${first(r.by)}` : ''}
                  </span>
                </span>
                <span className={`cl-run-score mono${r.done === r.total && r.total ? ' all' : ''}`}>
                  {r.done}/{r.total}
                </span>
                <Icon name="chevron" size={16} className="cl-run-chev" />
              </button>
              {open === r.id && (
                <div className="cl-run-items">
                  <ul>
                    {(r.items || []).map((i, k) => (
                      <li key={k} className={i.done ? 'done' : ''}>
                        <span className="cl-run-mark" aria-hidden="true">
                          {i.done ? <Icon name="check" size={14} /> : null}
                        </span>
                        <span className="grow">
                          {i.section && <span className="muted small">{i.section} · </span>}
                          {i.text}
                        </span>
                        {i.done && (
                          <span className="muted small nowrap">
                            {first(i.by)} {i.at ? new Date(i.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {isManager && (
                    <button className="link-btn danger" onClick={async () => (await confirmDialog({ title: 'Delete this run from the history?', okLabel: 'Delete', danger: true })) && api.deleteChecklistRun(list, r)}>
                      Delete this run
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

// ---------- run mode: one list, full screen, big rows ----------
export function RunMode({ list, round, api, onClose }) {
  const groups = CL.groupsOf(list);
  const { items, done } = progressOf(list, round);
  const next = items.find((i) => !CL.isDone(list, i, round));
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // The next one to do stays in view.
  useEffect(() => {
    const el = next && box.current?.querySelector(`[data-run="${next.id}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const b = box.current.getBoundingClientRect();
    if (r.top < b.top + 40 || r.bottom > b.bottom - 40) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [next?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = items.length > 0 && done === items.length;
  return (
    <Overlay>
      <div className="runmode" role="dialog" aria-modal="true" aria-label={`Run ${list.title}`}>
        <header className="rm-head">
          <div className="rm-title">
            <h2>{list.title}</h2>
            <span className="rm-count mono">
              {done}/{items.length}
            </span>
            <button className="rm-close" onClick={onClose} aria-label="Close run mode">
              <CloseIcon />
            </button>
          </div>
          <div className="rm-bar" aria-hidden="true">
            <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
        </header>
        <div className="rm-body" ref={box}>
          {groups.map((g) =>
            g.items.length ? (
              <section key={g.id || 'top'} className="rm-group">
                {g.title && (
                  <h3>
                    <span>{g.title}</span>
                    <span className="mono">
                      {g.items.filter((i) => CL.isDone(list, i, round)).length}/{g.items.length}
                    </span>
                  </h3>
                )}
                <ul>
                  {g.items.map((i) => {
                    const on = CL.isDone(list, i, round);
                    return (
                      <li key={i.id}>
                        <button
                          data-run={i.id}
                          className={`rm-item${on ? ' on' : ''}${next?.id === i.id ? ' next' : ''}`}
                          aria-pressed={on}
                          onClick={() => api.toggleChecklistItem(list, i, !on, round)}
                        >
                          <span className="rm-box" aria-hidden="true">
                            {on && <Icon name="check" size={26} />}
                          </span>
                          <span className="rm-text">
                            {next?.id === i.id && <span className="rm-next">Next</span>}
                            {i.text}
                          </span>
                          {on && i.doneBy && <span className="rm-by">{first(i.doneBy)}</span>}
                          {!on && i.who && <Avatar name={i.who} size={26} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null,
          )}
          {!items.length && <p className="rm-empty">This list is empty. Add items on the Checklists tab.</p>}
        </div>
        <footer className="rm-foot">
          {all ? <span className="rm-done">All done</span> : <span className="rm-left">{items.length - done} to go</span>}
          <span className="spacer" />
          {done > 0 && (
            <button className="btn" onClick={() => api.uncheckAll(list, round)}>
              Uncheck all
            </button>
          )}
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </Overlay>
  );
}

// ---------- the page ----------
// New checklist asks for the name first: one made blank and left without a
// name stayed behind, and only team management can delete it.
function NewChecklistCard({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const box = useRef(null);
  useEffect(() => {
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.current?.querySelector('input')?.focus({ preventScroll: true });
  }, []);
  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim());
  };
  return (
    <form className="checklist-card new-checklist" ref={box} onSubmit={submit}>
      <header>
        <input
          className="input checklist-name"
          value={name}
          maxLength={80}
          placeholder="Checklist name"
          aria-label="Checklist name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        />
      </header>
      <footer className="row gap">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={!name.trim()}>
          Create
        </button>
      </footer>
    </form>
  );
}

export default function ChecklistsView({ checklists, api, actor = {}, isManager, roster = [], tasks = [], matches = [], settings = {}, pinned = [], focus = null, onOpenTask = () => {} }) {
  // The one just made with New checklist (it opens at the end of the list).
  const [fresh, setFresh] = useState(null);
  const [naming, setNaming] = useState(false);
  const [mine, setMine] = useLocalStorage('checklists-mine', false);
  const [details, setDetails] = useState(null); // { listId, itemId }
  const [menu, setMenu] = useState(null);
  const [history, setHistory] = useState(null);
  const [run, setRun] = useState(null);
  const [focusItem, setFocusItem] = useState(null);
  const round = useChecklistRound(matches, settings, checklists);
  const newList = () => setNaming(true);
  const create = async (title) => {
    setNaming(false);
    const ordered = checklists.filter((c) => typeof c.order === 'number');
    const id = await api.createChecklist({ title, items: {}, ...(ordered.length ? { order: Math.max(...ordered.map((c) => c.order)) + 1 } : {}) });
    if (id) setFresh(id);
  };
  const sorted = useMemo(() => CL.sortLists(checklists), [checklists]);
  const missingStarters = STARTER_CHECKLISTS.filter((s) => !checklists.some((c) => c.title === s.title));
  const addStarters = () => missingStarters.forEach((s) => api.createChecklist({ title: s.title, items: starterItems(s) }));
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const isMine = (i) => i.who === actor.name;
  const mineLeft = useMemo(
    () => checklists.reduce((n, c) => n + Object.values(c.items || {}).filter((i) => i.who === actor.name && !CL.isDone(c, i, round)).length, 0),
    [checklists, actor.name, round],
  );
  const shownLists = mine ? sorted.filter((c) => Object.values(c.items || {}).some(isMine)) : sorted;

  // A notification or a task opened an item: scroll to it and light it up.
  useEffect(() => {
    if (!focus?.id) return;
    const itemId = focus.id.split('/')[1];
    setMine(false);
    setFocusItem(itemId);
    const t = setTimeout(() => document.querySelector(`[data-item="${itemId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    const u = setTimeout(() => setFocusItem(null), 2600);
    return () => {
      clearTimeout(t);
      clearTimeout(u);
    };
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- dragging (dnd-kit, as on the board: mouse at once, touch after a short hold on the handle) -----
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }));
  const [active, setActive] = useState(null); // the drag's data
  const [target, setTarget] = useState(null);
  const pointer = useRef(null);
  useEffect(() => {
    if (!active) return;
    const move = (e) => {
      const t = e.touches?.[0] || e;
      pointer.current = { x: t.clientX, y: t.clientY };
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('touchmove', move, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('touchmove', move, true);
    };
  }, [active]);
  const byId = useMemo(() => new Map(checklists.map((c) => [c.id, c])), [checklists]);
  // Where it would land: { kind: item | end | into | section | list, listId, secId, rowId, after, index }.
  const aim = (e) => {
    const a = e.active.data.current;
    const o = e.over?.data.current;
    const at = pointer.current;
    if (!a || !o || !at) return null;
    const r = document.querySelector(`[data-drop="${e.over.id}"]`)?.getBoundingClientRect();
    const after = r ? at.y > r.top + r.height / 2 : true;
    const list = byId.get(o.listId);
    if (!list) return null;
    if (a.type === 'list') {
      if (o.listId === a.listId) return null;
      const i = sorted.filter((c) => c.id !== a.listId).findIndex((c) => c.id === o.listId);
      return { kind: 'list', listId: o.listId, after, index: i + (after ? 1 : 0) };
    }
    if (a.type === 'section') {
      if (o.secId === a.secId) return null;
      const i = CL.sortedSections(list)
        .filter((s) => s.id !== a.secId)
        .findIndex((s) => s.id === o.secId);
      return { kind: 'section', listId: o.listId, secId: o.secId, after, index: i + (after ? 1 : 0) };
    }
    const groups = CL.groupsOf(list);
    const group = groups.find((g) => g.id === (o.secId || '')) || groups[0];
    const rest = group.items.filter((i) => i.id !== a.itemId);
    if (o.type === 'item') {
      if (o.itemId === a.itemId) return null;
      const i = rest.findIndex((x) => x.id === o.itemId);
      return { kind: 'item', listId: o.listId, secId: group.id, rowId: o.itemId, after, index: i + (after ? 1 : 0) };
    }
    if (o.type === 'section') return { kind: 'into', listId: o.listId, secId: o.secId, index: 0 };
    return { kind: 'end', listId: o.listId, secId: group.id, index: rest.length };
  };
  const onDragEnd = (e) => {
    const a = e.active.data.current;
    const t = aim(e);
    setActive(null);
    setTarget(null);
    if (!a || !t) return;
    const list = byId.get(a.listId);
    if (!list) return;
    if (a.type === 'list') return api.moveChecklist(list, t.index);
    if (a.type === 'section') return api.moveChecklistSection(list, list.sections?.[a.secId], t.index);
    const item = list.items?.[a.itemId];
    if (!item) return;
    if (t.listId === list.id) api.moveChecklistItem(list, item, t.secId, t.index);
    else api.moveChecklistItemTo(list, byId.get(t.listId), item, t.secId, t.index);
  };
  const activeLabel = (() => {
    if (!active) return '';
    const list = byId.get(active.listId);
    if (active.type === 'list') return list?.title;
    if (active.type === 'section') return list?.sections?.[active.secId]?.title;
    return list?.items?.[active.itemId]?.text;
  })();

  const ctx = { api, round, mine, actor, target, isManager, pinned, taskById, roster, checklists: sorted, focusItem, onOpenTask, setDetails, setMenu, setHistory, setRun };
  const detailList = details && byId.get(details.listId);
  // An item moved to another list while its details were open: follow it.
  const detailHome = details && (detailList?.items?.[details.itemId] ? detailList : checklists.find((c) => c.items?.[details.itemId]));
  const detailItem = detailHome?.items?.[details.itemId];
  const menuList = menu && byId.get(menu);
  const historyList = history && byId.get(history);
  const runList = run && byId.get(run);

  return (
    <main className="content checklists">
      <div className="ms-header">
        <div>
          <h1>Competition checklists</h1>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={newList}>
          <PlusIcon /> New checklist
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="cl-filter" role="tablist" aria-label="Show">
          <button role="tab" aria-selected={!mine} className={`chip${!mine ? ' on' : ''}`} onClick={() => setMine(false)}>
            All items
          </button>
          <button role="tab" aria-selected={mine} className={`chip${mine ? ' on' : ''}`} onClick={() => setMine(true)}>
            Mine{mineLeft ? ` · ${mineLeft}` : ''}
          </button>
        </div>
      )}

      {sorted.length || naming ? (
        <DndContext
          sensors={sensors}
          collisionDetection={collide}
          // Scrolls only with the finger near the top or bottom edge (long lists, other lists).
          autoScroll={{ threshold: { x: 0, y: 0.12 }, acceleration: 8 }}
          onDragStart={(e) => {
            const ev = e.activatorEvent;
            const t = ev?.touches?.[0] || ev;
            pointer.current = t && t.clientX != null ? { x: t.clientX, y: t.clientY } : null;
            setActive(e.active.data.current);
          }}
          onDragMove={(e) => setTarget(aim(e))}
          onDragOver={(e) => setTarget(aim(e))}
          onDragCancel={() => {
            setActive(null);
            setTarget(null);
          }}
          onDragEnd={onDragEnd}
        >
          <div className={`checklist-grid${active ? ' cl-dragging' : ''}`}>
            {shownLists.map((c) => (
              <ChecklistCard key={c.id} list={c} ctx={ctx} fresh={fresh === c.id} index={sorted.indexOf(c)} count={sorted.length} />
            ))}
            {mine && !shownLists.length && <p className="muted cl-mine-empty">Nothing on any list is yours yet. Open an item’s details (⋯) to give it to someone.</p>}
            {naming && <NewChecklistCard onCreate={create} onCancel={() => setNaming(false)} />}
          </div>
          <DragOverlay dropAnimation={null}>
            {active ? (
              <div className={`cl-overlay ${active.type}`}>
                <Icon name="grip" size={16} />
                <span>{activeLabel}</span>
              </div>
            ) : null}
          </DragOverlay>
          {missingStarters.length > 0 && !mine && (
            <p className="muted small starter-hint">
              Want a ready-made list?{' '}
              <button className="link-btn" onClick={addStarters}>
                Add {missingStarters.map((s) => s.title).join(', ')}
              </button>
            </p>
          )}
        </DndContext>
      ) : (
        <div className="empty-card">
          <h2>No checklists yet</h2>
          <p className="muted">
            Start with ready-made lists for robot inspection, packing the pit, and competition day, then edit them to fit the team. Check
            the inspection list against this season's Competition Manual.
          </p>
          <div className="row gap center-row">
            <button className="btn primary" onClick={addStarters}>
              Add starter checklists
            </button>
            <button className="btn" onClick={newList}>
              Start blank
            </button>
          </div>
        </div>
      )}
      {detailItem && <ItemDetails list={detailHome} item={detailItem} ctx={ctx} onClose={() => setDetails(null)} />}
      {menuList && <ListMenu list={menuList} ctx={ctx} index={sorted.indexOf(menuList)} count={sorted.length} onClose={() => setMenu(null)} />}
      {historyList && <HistoryDialog list={historyList} api={api} isManager={isManager} onClose={() => setHistory(null)} />}
      {runList && <RunMode list={runList} round={round} api={api} onClose={() => setRun(null)} />}
    </main>
  );
}
