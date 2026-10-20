import { useMemo, useState } from 'react';
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

function Column({ status, tasks, onOpen, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
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
        {tasks.map((t) => (
          <Card key={t.id} task={t} onOpen={onOpen} />
        ))}
        {!tasks.length && <div className="column-empty">Drop tasks here</div>}
      </div>
    </section>
  );
}

export default function BoardView({ tasks, milestones = [], api, onOpen, onAdd }) {
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
