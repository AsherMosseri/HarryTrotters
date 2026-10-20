import { useEffect, useRef, useState } from 'react';
import { SUBTEAMS, PRIORITIES, statusById, priorityById } from '../config.js';
import { fullTime, relTime } from '../util.js';
import { Avatar, CloseIcon, DraftInput, StatusSelect } from './common.jsx';

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function describe(a, milestoneName) {
  const { field, from, to } = a;
  switch (field) {
    case 'status':
      return (
        <>
          moved this from <b>{statusById[from]?.label || from}</b> to <b>{statusById[to]?.label || to}</b>
        </>
      );
    case 'assignees': {
      const added = (to || []).filter((n) => !(from || []).includes(n));
      const removed = (from || []).filter((n) => !(to || []).includes(n));
      return [added.length && `assigned ${added.join(', ')}`, removed.length && `unassigned ${removed.join(', ')}`]
        .filter(Boolean)
        .join(' and ');
    }
    case 'title':
      return (
        <>
          renamed this to <b>“{to}”</b>
        </>
      );
    case 'description':
      return 'edited the description';
    case 'priority':
      return (
        <>
          set priority to <b>{priorityById[to]?.label || to}</b>
        </>
      );
    case 'dueDate':
      return to ? (
        <>
          set the due date to <b>{fmtDate(to)}</b>
        </>
      ) : (
        'removed the due date'
      );
    case 'subteam':
      return to ? (
        <>
          set subteam to <b>{to}</b>
        </>
      ) : (
        'cleared the subteam'
      );
    case 'blockedReason':
      return to ? <>noted the blocker: “{to}”</> : 'cleared the blocker';
    case 'links':
      return 'updated the links';
    case 'milestoneId':
      return to ? (
        <>
          added this to milestone <b>{milestoneName(to)}</b>
        </>
      ) : (
        'removed this from its milestone'
      );
    default:
      return `changed ${field}`;
  }
}

function Activity({ items, milestoneName }) {
  return (
    <ol className="activity">
      {items.map((a) =>
        a.type === 'comment' ? (
          <li key={a.id} className="comment">
            <Avatar name={a.by} size={28} />
            <div className="bubble">
              <div className="bubble-head">
                <b>{a.by}</b>{' '}
                <span className="muted tiny" title={fullTime(a.at)}>
                  {relTime(a.at)}
                </span>
              </div>
              <div className="bubble-text">{a.text}</div>
            </div>
          </li>
        ) : (
          <li key={a.id} className="event">
            <span className="event-dot" />
            <span>
              <b>{a.by?.split(' ')[0]}</b> {a.type === 'created' ? 'created this task' : describe(a, milestoneName)}{' '}
              <span className="muted tiny" title={fullTime(a.at)}>
                · {relTime(a.at)}
              </span>
            </span>
          </li>
        ),
      )}
    </ol>
  );
}

export default function TaskPanel({ task, api, roster, milestones = [], onClose }) {
  const milestoneName = (id) => milestones.find((m) => m.id === id)?.title || 'a deleted milestone';
  const [activity, setActivity] = useState([]);
  const [comment, setComment] = useState('');
  const [link, setLink] = useState('');
  const feedEnd = useRef(null);
  const set = (patch) => api.update(task, patch);

  useEffect(() => api.subscribeActivity(task.id, setActivity), [api, task.id]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !e.target.closest?.('input,textarea,select') && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleAssignee = (name) => {
    const cur = task.assignees || [];
    set({ assignees: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] });
  };

  const addLink = (e) => {
    e.preventDefault();
    let url = link.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    set({ links: [...(task.links || []), url] });
    setLink('');
  };

  const sendComment = (e) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    api.comment(task, text);
    setComment('');
    setTimeout(() => feedEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 150);
  };

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()} aria-label="Task details">
        <div className="panel-head">
          <StatusSelect value={task.status} onChange={(status) => set({ status })} />
          <span className="spacer" />
          <button
            className="link-btn danger"
            onClick={() => {
              if (confirm(`Delete “${task.title || 'Untitled'}”? This can't be undone.`)) {
                api.remove(task);
                onClose();
              }
            }}
          >
            Delete
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="panel-scroll">
          <DraftInput
            multiline
            className="panel-title"
            value={task.title}
            placeholder="Task title"
            onSave={(title) => title.trim() && set({ title: title.trim() })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />

          {task.status === 'blocked' && (
            <div className="blocked-box">
              <label className="field-label">What's it blocked on?</label>
              <DraftInput
                value={task.blockedReason}
                placeholder="e.g. Waiting on servo shipment"
                onSave={(blockedReason) => set({ blockedReason })}
              />
            </div>
          )}

          <div className="fields">
            <span className="field-label">Who</span>
            <div className="assignee-picker">
              {roster.map((n) => {
                const on = (task.assignees || []).includes(n);
                return (
                  <button key={n} className={`person${on ? ' on' : ''}`} onClick={() => toggleAssignee(n)}>
                    <Avatar name={n} size={20} /> {n.split(' ')[0]}
                  </button>
                );
              })}
            </div>

            <span className="field-label">Priority</span>
            <div className="segmented">
              {PRIORITIES.map((p) => (
                <button key={p.id} className={`prio-${p.id}${task.priority === p.id ? ' on' : ''}`} onClick={() => set({ priority: p.id })}>
                  {p.label}
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="f-subteam">
              Subteam
            </label>
            <select id="f-subteam" className="input" value={task.subteam || ''} onChange={(e) => set({ subteam: e.target.value })}>
              <option value="">None</option>
              {SUBTEAMS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <label className="field-label" htmlFor="f-due">
              Due
            </label>
            <div className="row gap">
              <input
                id="f-due"
                className="input"
                type="date"
                value={task.dueDate || ''}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
              {task.dueDate && (
                <button className="link-btn" onClick={() => set({ dueDate: '' })}>
                  Clear
                </button>
              )}
            </div>

            <label className="field-label" htmlFor="f-ms">
              Milestone
            </label>
            <select id="f-ms" className="input" value={task.milestoneId || ''} onChange={(e) => set({ milestoneId: e.target.value })}>
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <label className="field-label">Description</label>
          <DraftInput
            multiline
            className="input description"
            value={task.description}
            placeholder="Details, steps, measurements… (saves when you tap away)"
            onSave={(description) => set({ description })}
          />

          <label className="field-label">Links</label>
          <ul className="links">
            {(task.links || []).map((url, i) => (
              <li key={url + i}>
                <a href={url} target="_blank" rel="noreferrer">
                  🔗 {hostOf(url)}
                </a>
                <button className="link-btn" onClick={() => set({ links: task.links.filter((_, j) => j !== i) })} aria-label="Remove link">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form className="row gap" onSubmit={addLink}>
            <input
              className="input"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a CAD, GitHub, or photo link"
            />
            <button className="btn" disabled={!link.trim()}>
              Add
            </button>
          </form>

          <p className="meta muted tiny">
            Created by {task.createdBy || '?'} · {fullTime(task.createdAt)}
            {task.completedAt ? ` · Completed ${fullTime(task.completedAt)}` : ''}
          </p>

          <h3 className="section-title">Activity</h3>
          <Activity items={activity} milestoneName={milestoneName} />
          <div ref={feedEnd} />
        </div>

        <form className="comment-box" onSubmit={sendComment}>
          <textarea
            rows={1}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) sendComment(e);
            }}
            placeholder="Write a comment…"
          />
          <button className="btn primary" disabled={!comment.trim()}>
            Send
          </button>
        </form>
      </aside>
    </div>
  );
}
