import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { STATUSES, priorityById } from '../config.js';
import { AvatarStack, PlusIcon } from './common.jsx';
import { Icon } from './shell/icons.jsx';
import { dueInfo, useLocalStorage, waitingNote } from '../util.js';
import { SponsoredCard, boardAdCount, useAds } from './Ads.jsx';
import { flipFrom, useFlip } from '../motion.js';
import CountUp from './CountUp.jsx';

// Drop into whichever column is under the finger/cursor; fall back to overlap.
const collision = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function byPriorityThenDue(a, b) {
  return (
    (priorityById[a.priority]?.rank ?? 9) - (priorityById[b.priority]?.rank ?? 9) ||
    (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
    (b.updatedAt || 0) - (a.updatedAt || 0)
  );
}

// A card: the title first, then one quiet line of details (priority only
// when it's urgent or high), then who and when.
function CardBody({ task }) {
  const due = dueInfo(task.dueDate, task.status);
  const prio = task.priority === 'urgent' || task.priority === 'high' ? priorityById[task.priority] : null;
  const meta = [task.subteam, task.milestoneTitle].filter(Boolean);
  const list = task.checklist || [];
  return (
    <>
      {task.photos?.length > 0 && (
        <img className="card-cover" src={task.photos[0].thumbUrl || task.photos[0].url} alt="" loading="lazy" draggable="false" />
      )}
      <div className="card-title">{task.title || <span className="muted">Untitled</span>}</div>
      {(prio || meta.length > 0) && (
        <div className="card-meta">
          {prio && <span className={`card-prio p-${task.priority}`}>{prio.label}</span>}
          {prio && meta.length > 0 && ' · '}
          {meta.join(' · ')}
        </div>
      )}
      {task.status === 'blocked' && task.blockedReason && <div className="blocked-note">{waitingNote(task.blockedReason)}</div>}
      <div className="card-foot">
        <AvatarStack names={task.assignees} size={22} />
        <span className="spacer" />
        {list.length > 0 && (
          <span className={`card-count${list.every((i) => i.done) ? ' all-done' : ''}`} title="Checklist">
            <Icon name="checklists" size={14} /> {list.filter((i) => i.done).length}/{list.length}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="card-count" title="Comments">
            <Icon name="chat" size={14} /> {task.commentCount}
          </span>
        )}
        {due && (
          <span className={`card-due ${due.tone}`} title={due.title}>
            {due.label}
          </span>
        )}
      </div>
    </>
  );
}

function Card({ task, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      data-flip={task.id}
      className={`card${isDragging ? ' dragging' : ''}${task.status === 'done' ? ' is-done' : ''}`}
      onClick={() => onOpen(task.id)}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onOpen(task.id);
      }}
    >
      <CardBody task={task} />
    </div>
  );
}

// Pretend ads: Sponsored cards after the 1st, 3rd, 5th… card; any left over go at the end.
function adSlots(n, count) {
  const after = new Map();
  const tail = [];
  for (let k = 0; k < n; k++) {
    if (k * 2 < count) after.set(k * 2, k);
    else tail.push(k);
  }
  return { after, tail };
}

function Column({ status, tasks, onOpen, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const ads = useAds();
  const { after, tail } = adSlots(boardAdCount(ads, status.id), tasks.length);
  const k0 = STATUSES.findIndex((s) => s.id === status.id) * 3;
  return (
    // The whole column takes a drop, not just the cards in it.
    <section className={`column${isOver ? ' over' : ''}`} style={{ '--c': status.color }} ref={setNodeRef}>
      <header className="column-head">
        <span className="dot" />
        <h2>{status.label}</h2>
        <span className="count">
          <CountUp value={tasks.length} from={tasks.length} />
        </span>
        <button className="icon-btn small" title={`Add to ${status.label}`} onClick={() => onAdd(status.id)}>
          <PlusIcon />
        </button>
      </header>
      <div className="column-body">
        {tasks.map((t, i) => (
          <Fragment key={t.id}>
            <Card task={t} onOpen={onOpen} />
            {after.has(i) && <SponsoredCard slot="board" k={k0 + after.get(i)} />}
          </Fragment>
        ))}
        {!tasks.length && <div className="column-empty">Drop tasks here</div>}
        {tail.map((k) => (
          <SponsoredCard key={`ad-${k}`} slot="board" k={k0 + k} />
        ))}
      </div>
    </section>
  );
}

// Phones: one status at a time (chips with counts), full-width cards, no dragging.
function PhoneBoard({ columns, onOpen, onAdd }) {
  const [status, setStatus] = useLocalStorage('phone-status', 'todo');
  const current = STATUSES.find((s) => s.id === status) || STATUSES[1];
  const list = columns[current.id] || [];
  const ads = useAds();
  const { after, tail } = adSlots(boardAdCount(ads, current.id), list.length);
  const k0 = STATUSES.findIndex((s) => s.id === current.id) * 3;
  // Cards ease in and out as the list changes (Moving things).
  const cardsRef = useRef(null);
  useFlip(cardsRef, list);
  return (
    <div className="phone-board">
      <div className="phone-status-chips" role="tablist">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === current.id}
            className={`phone-status${s.id === current.id ? ' on' : ''}`}
            style={{ '--c': s.color }}
            onClick={() => setStatus(s.id)}
          >
            <span className="dot" />
            {s.short || s.label}
            <strong>{columns[s.id].length}</strong>
          </button>
        ))}
      </div>
      <div className="phone-cards" ref={cardsRef}>
        {list.map((t, i) => (
          <Fragment key={t.id}>
            <button data-flip={t.id} className={`card phone-card${t.status === 'done' ? ' is-done' : ''}`} onClick={() => onOpen(t.id)}>
              <CardBody task={t} />
            </button>
            {after.has(i) && <SponsoredCard slot="board" k={k0 + after.get(i)} />}
          </Fragment>
        ))}
        {tail.map((k) => (
          <SponsoredCard key={`ad-${k}`} slot="board" k={k0 + k} />
        ))}
        {!list.length && <p className="column-empty">Nothing in {current.short || current.label}.</p>}
        <button className="btn ghost phone-add" onClick={() => onAdd(current.id)}>
          <PlusIcon /> Add to {current.short || current.label}
        </button>
      </div>
    </div>
  );
}

export default function BoardView({ tasks, milestones = [], api, onOpen, onAdd, phone = false }) {
  const [activeId, setActiveId] = useState(null);
  // Mouse drags right away; touch needs a short press so the board still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const columns = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
    const msTitle = Object.fromEntries(milestones.map((m) => [m.id, m.title]));
    for (const t of tasks) (map[t.status] || map.todo).push({ ...t, milestoneTitle: msTitle[t.milestoneId] || '' });
    for (const k in map) map[k].sort(byPriorityThenDue);
    return map;
  }, [tasks, milestones]);

  // Where the finger or mouse really is while dragging. The board only scrolls
  // sideways with it right at an edge: dnd-kit sometimes judged a pointer in the
  // middle to be at the edge, and the board slid away mid-drag.
  const pointer = useRef(null);
  useEffect(() => {
    if (!activeId) return;
    const move = (e) => {
      const t = e.touches?.[0] || e;
      pointer.current = { x: t.clientX, y: t.clientY };
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('touchmove', move, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('touchmove', move, true);
      pointer.current = null;
    };
  }, [activeId]);
  const canScroll = useCallback((el) => {
    if (!el.classList?.contains('board')) return true;
    const at = pointer.current;
    if (!at) return false;
    const r = el.getBoundingClientRect();
    return at.x < r.left + 56 || at.x > r.right - 56;
  }, []);

  // A card that changes column slides there (Moving things); a dropped one
  // slides from where it was let go.
  const boardRef = useRef(null);
  useFlip(boardRef, tasks);

  // The column's copy, so the drag preview keeps its milestone name.
  const active = activeId ? Object.values(columns).flat().find((t) => t.id === activeId) : null;
  if (phone) return <PhoneBoard columns={columns} onOpen={onOpen} onAdd={onAdd} />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      autoScroll={{ threshold: { x: 0.08, y: 0.1 }, acceleration: 6, canScroll }}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(e) => {
        setActiveId(null);
        const task = tasks.find((t) => t.id === e.active.id);
        const to = e.over?.id;
        const dropped = document.querySelector('.card.overlay');
        if (task && to && to !== task.status && dropped) flipFrom(task.id, dropped.getBoundingClientRect());
        if (task && to && to !== task.status) api.update(task, { status: to });
      }}
    >
      <div className="board" ref={boardRef}>
        {STATUSES.map((s) => (
          <Column key={s.id} status={s} tasks={columns[s.id]} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="card overlay">
            <CardBody task={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
