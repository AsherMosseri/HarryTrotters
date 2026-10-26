import { Fragment, useMemo, useState } from 'react';
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
import { AvatarStack, DueChip, PriorityBadge, CommentIcon, PlusIcon } from './common.jsx';
import { useLocalStorage } from '../util.js';
import { SponsoredCard, boardAdCount, useAds } from './Ads.jsx';

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

function CardBody({ task }) {
  return (
    <>
      {task.photos?.length > 0 && (
        <img className="card-cover" src={task.photos[0].thumbUrl || task.photos[0].url} alt="" loading="lazy" draggable="false" />
      )}
      <div className="card-top">
        <PriorityBadge value={task.priority} />
        {task.subteam && <span className="tag">{task.subteam}</span>}
      </div>
      <div className="card-title">{task.title || <span className="muted">Untitled</span>}</div>
      {task.milestoneTitle && <div className="card-ms">◆ {task.milestoneTitle}</div>}
      {task.status === 'blocked' && task.blockedReason && <div className="blocked-note">⛔ {task.blockedReason}</div>}
      <div className="card-foot">
        <AvatarStack names={task.assignees} size={22} />
        <span className="spacer" />
        {task.checklist?.length > 0 && (
          <span className={`meta-count${task.checklist.every((i) => i.done) ? ' all-done' : ''}`} title="Checklist">
            ☑ {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="meta-count">
            <CommentIcon /> {task.commentCount}
          </span>
        )}
        <DueChip dueDate={task.dueDate} status={task.status} />
      </div>
    </>
  );
}

function Card({ task, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      className={`card${isDragging ? ' dragging' : ''}${task.status === 'done' ? ' is-done' : ''}`}
      onClick={() => onOpen(task.id)}
      {...attributes}
      {...listeners}
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
    <section className={`column${isOver ? ' over' : ''}`} style={{ '--c': status.color }}>
      <header className="column-head">
        <span className="dot" />
        <h2>{status.label}</h2>
        <span className="count">{tasks.length}</span>
        <button className="icon-btn small" title={`Add to ${status.label}`} onClick={() => onAdd(status.id)}>
          <PlusIcon />
        </button>
      </header>
      <div className="column-body" ref={setNodeRef}>
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
      <div className="phone-cards">
        {list.map((t, i) => (
          <Fragment key={t.id}>
            <button className={`card phone-card${t.status === 'done' ? ' is-done' : ''}`} onClick={() => onOpen(t.id)}>
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

  const active = tasks.find((t) => t.id === activeId);
  if (phone) return <PhoneBoard columns={columns} onOpen={onOpen} onAdd={onAdd} />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(e) => {
        setActiveId(null);
        const task = tasks.find((t) => t.id === e.active.id);
        const to = e.over?.id;
        if (task && to && to !== task.status) api.update(task, { status: to });
      }}
    >
      <div className="board">
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
