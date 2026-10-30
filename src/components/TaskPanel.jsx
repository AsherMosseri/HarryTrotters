import { useEffect, useRef, useState } from 'react';
import { SUBTEAMS, PRIORITIES, STATUSES, statusById, priorityById } from '../config.js';
import { fullTime, relTime } from '../util.js';
import { Avatar, CloseIcon, DraftInput, Overlay, StatusSelect } from './common.jsx';
import { Icon } from './shell/icons.jsx';
import { PartStatusSelect } from './PartsView.jsx';
import PhotoViewer from './PhotoViewer.jsx';
import { itemId } from '../data/diff.js';
import { PopupAds } from './Ads.jsx';

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
    case 'deleted':
      return to === 'restored' ? 'restored this task' : 'deleted this task';
    case 'photos':
      return to === 'removed' ? 'removed a photo' : 'added a photo';
    case 'checklist': {
      const before = Object.fromEntries((from || []).map((i) => [i.id, i]));
      const after = Object.fromEntries((to || []).map((i) => [i.id, i]));
      const names = (list) => list.map((i) => `“${i.text}”`).join(', ');
      const checked = (to || []).filter((i) => before[i.id] && i.done && !before[i.id].done);
      const unchecked = (to || []).filter((i) => before[i.id] && !i.done && before[i.id].done);
      const added = (to || []).filter((i) => !before[i.id]);
      const removed = (from || []).filter((i) => !after[i.id]);
      const bits = [
        checked.length && `checked off ${names(checked)}`,
        unchecked.length && `unchecked ${names(unchecked)}`,
        added.length && `added ${names(added)} to the checklist`,
        removed.length && `removed ${names(removed)} from the checklist`,
      ].filter(Boolean);
      return bits.join(' and ') || 'updated the checklist';
    }
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

function TaskPhotos({ task, api }) {
  const [uploading, setUploading] = useState(0);
  const [viewing, setViewing] = useState(null);
  const input = useRef(null);
  const photos = task.photos || [];

  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setUploading((n) => n + files.length);
    for (const f of files) {
      await api.addPhoto(task, f);
      setUploading((n) => n - 1);
    }
  };

  return (
    <div className="task-photos">
      <div className="row">
        <label className="field-label grow">Photos{photos.length ? ` · ${photos.length}` : ''}</label>
        <button className="btn" onClick={() => input.current?.click()}>
          Add photos
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      </div>
      {(photos.length > 0 || uploading > 0) && (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <button key={p.id} className="photo-thumb" onClick={() => setViewing(i)} aria-label="Open photo">
              <img src={p.thumbUrl || p.url} alt="" loading="lazy" />
            </button>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up${i}`} className="photo-thumb uploading">
              Uploading…
            </div>
          ))}
        </div>
      )}
      {viewing !== null && (
        <PhotoViewer
          photos={photos}
          index={Math.min(viewing, photos.length - 1)}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onDelete={(p) => {
            setViewing(null);
            api.removePhoto(task, p);
          }}
        />
      )}
    </div>
  );
}

// Steps inside a task, e.g. "cut plate", "drill holes", "mount".
function TaskChecklist({ items, onChange }) {
  const [text, setText] = useState('');
  const done = items.filter((i) => i.done).length;
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: itemId(), text: t, done: false }]);
    setText('');
  };
  return (
    <div className="task-checklist">
      <label className="field-label">Checklist{items.length ? ` · ${done}/${items.length}` : ''}</label>
      {items.length > 0 && (
        <div className="ms-progress-bar" style={{ '--c': done === items.length ? 'var(--st-done)' : 'var(--accent)' }}>
          <span style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}
      <ul className="check-items">
        {items.map((i) => (
          <li key={i.id} className={i.done ? 'done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={!!i.done}
                onChange={(e) => onChange(items.map((x) => (x.id === i.id ? { ...x, done: e.target.checked } : x)))}
              />
              <span className="check-text">{i.text}</span>
            </label>
            <button className="check-remove" aria-label={`Remove ${i.text}`} onClick={() => onChange(items.filter((x) => x.id !== i.id))}>
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
      <form className="check-add" onSubmit={add}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="+ Add a step" />
      </form>
    </div>
  );
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

export default function TaskPanel({ task, api, roster, milestones = [], parts = [], onClose }) {
  const myParts = parts.filter((p) => p.taskId === task.id);
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
    <Overlay>
      <div className="panel-backdrop" onClick={onClose}>
        <aside className="panel" onClick={(e) => e.stopPropagation()} aria-label="Task details">
          <div className="panel-head">
            <StatusSelect value={task.status} onChange={(status) => set({ status })} />
            <span className="spacer" />
            <button
              className="link-btn danger"
              onClick={() => {
                // Goes to Recently deleted, with an Undo button, so no confirm needed.
                api.remove(task);
                onClose();
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
              <span className="field-label">Status</span>
              <div className="segmented status-segs">
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    className={`status-seg${task.status === s.id ? ' on' : ''}`}
                    style={{ '--c': s.color }}
                    aria-pressed={task.status === s.id}
                    onClick={() => set({ status: s.id })}
                  >
                    {s.short || s.label}
                  </button>
                ))}
              </div>

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
                  <button
                    key={p.id}
                    className={`prio-${p.id}${task.priority === p.id ? ' on' : ''}`}
                    onClick={() => set({ priority: p.id })}
                  >
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

            <TaskChecklist items={task.checklist || []} onChange={(checklist) => set({ checklist })} />

            <TaskPhotos task={task} api={api} />

            {myParts.length > 0 && (
              <>
                <label className="field-label">Parts for this task</label>
                <ul className="task-parts">
                  {myParts.map((p) => (
                    <li key={p.id}>
                      <span className="grow">
                        {p.name}
                        {p.qty > 1 ? ` × ${p.qty}` : ''}
                        {p.vendor && <span className="muted small"> · {p.vendor}</span>}
                      </span>
                      <PartStatusSelect value={p.status} onChange={(status) => api.updatePart(p, { status })} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <label className="field-label">Links</label>
            <ul className="links">
              {(task.links || []).map((url, i) => (
                <li key={url + i}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {hostOf(url)}
                  </a>
                  <button
                    className="link-btn link-remove"
                    onClick={() => set({ links: task.links.filter((_, j) => j !== i) })}
                    aria-label="Remove link"
                  >
                    <CloseIcon />
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

            <PopupAds where="task" />
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
    </Overlay>
  );
}
