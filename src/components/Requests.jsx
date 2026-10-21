import { useEffect, useRef, useState } from 'react';
import { REQUESTS_TO } from '../config.js';
import { firstName, relTime } from '../util.js';
import { Avatar, CloseIcon, DisplayName } from './common.jsx';

export const REQUEST_STATUSES = [
  { id: 'new', label: 'New', icon: '🆕' },
  { id: 'planned', label: 'Planned', icon: '🗓' },
  { id: 'working', label: 'In progress', icon: '🔧' },
  { id: 'done', label: 'Added', icon: '✅' },
  { id: 'declined', label: 'Not now', icon: '💤' },
];
const statusOf = (id) => REQUEST_STATUSES.find((s) => s.id === id) || REQUEST_STATUSES[0];

const TABS = [
  ['open', 'Open', (r) => ['new', 'planned', 'working'].includes(r.status)],
  ['done', 'Added', (r) => r.status === 'done'],
  ['declined', 'Not now', (r) => r.status === 'declined'],
];
const tabOf = (r) => TABS.find(([, , has]) => has(r))?.[0] || 'open';

// The idea box: type it, tap Send. onSend resolves false if it didn't save.
export function RequestBox({ onSend, autoFocus }) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await onSend(t);
    setBusy(false);
    if (ok === false) return;
    setText('');
    setSent(true);
  };
  return (
    <div className="request-box">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSent(false);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && send()}
        rows={2}
        maxLength={2000}
        placeholder="I wish the app could…"
        aria-label="Your idea"
        autoFocus={autoFocus}
      />
      <div className="request-box-foot">
        {sent ? (
          <span className="request-sent" role="status">
            ✓ Sent to {firstName(REQUESTS_TO)}. Thanks!
          </span>
        ) : (
          <span className="muted tiny">Goes straight to {firstName(REQUESTS_TO)}.</span>
        )}
        <button className="btn primary" disabled={!text.trim() || busy} onClick={send}>
          {busy ? 'Sending…' : 'Send idea'}
        </button>
      </div>
    </div>
  );
}

function RequestItem({ r, actor, api, focused, onMakeTask }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply || '');
  const ref = useRef(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' });
  }, [focused]);
  const votes = Object.keys(r.votes || {});
  const mine = votes.includes(actor.name);
  const st = statusOf(r.status);
  const canDelete = actor.admin || r.by === actor.name;
  return (
    <li ref={ref} className={`request${focused ? ' focused' : ''}${r.status === 'new' && actor.admin ? ' unseen' : ''}`}>
      <div className="request-head">
        <Avatar name={r.by} size={24} />
        <DisplayName name={r.by} className="request-by" />
        <span className="muted tiny">{relTime(r.at)}</span>
        <span className="spacer" />
        <span className={`request-status s-${r.status}`}>
          {st.icon} {st.label}
        </span>
      </div>
      <p className="request-text">{r.text}</p>
      {r.reply && !replying && (
        <p className="request-reply">
          <b>{firstName(r.updatedBy || REQUESTS_TO)}:</b> {r.reply}
        </p>
      )}
      {replying && (
        <div className="request-reply-edit">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={1000} placeholder="Reply…" autoFocus />
          <div className="row gap">
            <span className="spacer" />
            <button className="btn" onClick={() => setReplying(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                api.updateRequest(r.id, { reply: reply.trim() });
                setReplying(false);
              }}
            >
              Save reply
            </button>
          </div>
        </div>
      )}
      <div className="request-actions">
        <button
          className={`vote-btn${mine ? ' on' : ''}`}
          onClick={() => api.voteRequest(r.id, !mine)}
          aria-pressed={mine}
          title={votes.length ? `Wanted by ${votes.map(firstName).join(', ')}` : 'Want this too'}
        >
          👍 {votes.length || ''}
        </button>
        {actor.admin && (
          <>
            <select
              className="request-status-select"
              value={r.status}
              onChange={(e) => api.updateRequest(r.id, { status: e.target.value })}
              aria-label="Status"
            >
              {REQUEST_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>
            {!replying && (
              <button className="link-btn small" onClick={() => setReplying(true)}>
                {r.reply ? 'Edit reply' : 'Reply'}
              </button>
            )}
            <button className="link-btn small" onClick={() => onMakeTask(r)}>
              Make a task
            </button>
          </>
        )}
        <span className="spacer" />
        {canDelete && (
          <button
            className="link-btn small danger"
            onClick={() => confirm('Delete this idea?') && api.deleteRequest(r.id)}
            aria-label="Delete idea"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

// Every idea: send a new one, 👍 others; team management sets status and replies.
export function RequestsDialog({ requests, actor, api, focusId, onMakeTask, onClose }) {
  const focused = requests.find((r) => r.id === focusId);
  const [tab, setTab] = useState(focused ? tabOf(focused) : 'open');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const shown = requests.filter(TABS.find(([id]) => id === tab)[2]);
  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog requests" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="requests-title">
        <div className="panel-head">
          <h2 id="requests-title">💡 Feature requests</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="muted small">
          What should the app do next? Ideas go to {firstName(REQUESTS_TO)}, and you’ll get a notification when yours is planned or added.
          Tap 👍 on ideas you want too.
        </p>
        <RequestBox onSend={api.addRequest} autoFocus={!focused} />
        <div className="segmented request-tabs" role="tablist">
          {TABS.map(([id, label, has]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`plain-seg${tab === id ? ' on' : ''}`}
              onClick={() => setTab(id)}
            >
              {label} <span className="muted">{requests.filter(has).length}</span>
            </button>
          ))}
        </div>
        <ul className="request-list">
          {shown.map((r) => (
            <RequestItem key={r.id} r={r} actor={actor} api={api} focused={r.id === focusId} onMakeTask={onMakeTask} />
          ))}
          {!shown.length && (
            <li className="request-empty muted">{tab === 'open' ? 'No open ideas yet. Be the first!' : 'Nothing here yet.'}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
