import { useEffect, useState } from 'react';
import { AutoTextarea, Avatar, CloseIcon, Overlay } from './common.jsx';
import { REQUESTS_TO } from '../config.js';
import { useEscape } from '../util.js';

// Asher can shut the app down for everyone else (settings/shutdown). They see
// a full screen with his message and a box to write back to him
// (shutdownReplies); it opens again by itself when he turns it back on.

const CACHE = 'shutdown-cache';
const SENT = 'shutdown-sent';
const firstName = (n) => (n || '').split(' ')[0];
const when = (ms) =>
  new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

// The shutdown setting, live once signed in. Remembered on this device, so a
// shut-down app opens straight to the shutdown screen instead of flashing the board.
export function useShutdown(store, signedIn) {
  const [shutdown, setShutdown] = useState(() => read(CACHE));
  useEffect(() => {
    if (!store || !signedIn) return;
    return store.subscribeShutdown((s) => {
      write(CACHE, s?.on ? s : null);
      setShutdown((prev) => (JSON.stringify(prev) === JSON.stringify(s) ? prev : s));
    });
  }, [store, signedIn]);
  return shutdown;
}

// What everyone but Asher sees while the app is shut down.
export function ShutdownScreen({ shutdown, store, actor }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // What you sent during this shutdown, on this device.
  const [sent, setSent] = useState(() => {
    const s = read(SENT);
    return s?.round === shutdown.at ? s.texts : [];
  });
  const to = firstName(REQUESTS_TO);
  const send = async () => {
    const t = text.trim().slice(0, 1000);
    if (!t || busy) return;
    setBusy(true);
    setError('');
    try {
      await store.sendShutdownReply(t, shutdown.at, actor);
      const next = [...sent, t];
      setSent(next);
      write(SENT, { round: shutdown.at, texts: next });
      setText('');
    } catch (e) {
      setError(e.message?.includes('permission') ? 'Couldn’t send it. The app may be back on: reload.' : e.message || 'Couldn’t send it.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="gate shutdown-gate">
      <div className="gate-card shutdown-card" role="main">
        <div className="shutdown-icon" aria-hidden="true">
          🛑
        </div>
        <h1>The app is shut down</h1>
        {shutdown.message && <p className="shutdown-msg">{shutdown.message}</p>}
        <p className="muted small">
          — {firstName(shutdown.by) || to}
          {shutdown.at ? `, ${when(shutdown.at)}` : ''}
        </p>
        <label className="shutdown-reply">
          <span>{shutdown.question || `Anything to tell ${to}?`}</span>
          <AutoTextarea
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            maxLength={1000}
          />
        </label>
        <button className="btn primary big-btn" disabled={!text.trim() || busy} onClick={send}>
          {busy ? 'Sending…' : `Send to ${to}`}
        </button>
        {error && <div className="casino-error">{error}</div>}
        {sent.length > 0 && (
          <div className="shutdown-sent">
            <div className="muted small">✓ Sent to {to}:</div>
            {sent.map((t, i) => (
              <div key={i} className="shutdown-sent-item">
                {t}
              </div>
            ))}
          </div>
        )}
        <p className="muted tiny">The app opens again by itself when it’s back on.</p>
      </div>
    </div>
  );
}

// Asher's page: shut the app down (or back on), change the message, and read replies.
export function ShutdownPage({ shutdown, replies, onSave, onDelete, onClose }) {
  useEscape(onClose);
  const on = !!shutdown?.on;
  const [message, setMessage] = useState(shutdown?.message || 'Massive bug. The app is shut down while I fix it.');
  const [question, setQuestion] = useState(shutdown?.question ?? 'How long do you want this to be shut down?');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [earlierOpen, setEarlierOpen] = useState(false);
  const round = shutdown?.at;
  const current = round ? replies.filter((r) => r.round === round) : [];
  const earlier = replies.filter((r) => r.round !== round);
  const changed = on && (message.trim() !== shutdown.message || question.trim() !== (shutdown.question || ''));
  const save = async (data) => {
    setBusy(true);
    setError('');
    try {
      await onSave(data);
      setAsking(false);
    } catch (e) {
      setError(e.message || 'Couldn’t save that.');
    } finally {
      setBusy(false);
    }
  };
  const fields = { message: message.trim(), question: question.trim() };
  const list = (rs) =>
    rs.map((r) => (
      <li key={r.id} className="shutdown-reply-item">
        <Avatar name={r.name} size={28} />
        <div className="grow">
          <div className="small">
            <b>{r.name}</b> <span className="muted tiny">{when(r.at)}</span>
          </div>
          <div className="shutdown-reply-text">{r.text}</div>
        </div>
        <button className="icon-btn" aria-label={`Delete ${firstName(r.name)}’s reply`} onClick={() => onDelete(r.id)}>
          <CloseIcon />
        </button>
      </li>
    ));
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog shutdown-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shut down app">
          <div className="panel-head">
            <h2>🛑 Shut down app</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className={`shutdown-status${on ? ' on' : ''}`}>
            {on ? (
              <>
                <b>🛑 Shut down for everyone but you</b>
                <span className="small">
                  Since {when(shutdown.at)} · {current.length} {current.length === 1 ? 'reply' : 'replies'}
                </span>
              </>
            ) : (
              <>
                <b>✅ The app is on</b>
                <span className="small muted">
                  Shutting it down shows everyone but you a full screen with your message and a box to write back. Replies come to you here
                  and in 🔔.
                </span>
              </>
            )}
          </div>
          <label className="lablog-field">
            <span>What everyone sees</span>
            <AutoTextarea className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
          </label>
          <label className="lablog-field">
            <span>Question for them (optional)</span>
            <AutoTextarea
              className="input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Anything to tell me?"
              maxLength={300}
            />
          </label>
          {error && <div className="casino-error">{error}</div>}
          {on ? (
            <div className="shutdown-actions">
              <button
                className="btn primary big-btn"
                disabled={busy}
                onClick={() => save({ on: false, ...fields, at: shutdown.at, endedAt: Date.now() })}
              >
                ✅ Turn the app back on
              </button>
              <button
                className="btn"
                disabled={!changed || busy}
                onClick={() => save({ on: true, ...fields, at: shutdown.at, endedAt: null })}
              >
                Update message
              </button>
            </div>
          ) : asking ? (
            <div className="poll-confirm" role="group" aria-label="Shut down the app?">
              <span className="small">Shut down the app for everyone else right now?</span>
              <button
                className="btn small-btn danger"
                disabled={busy || !fields.message}
                onClick={() => save({ on: true, ...fields, at: Date.now(), endedAt: null })}
              >
                Shut it down
              </button>
              <button className="btn small-btn" onClick={() => setAsking(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn danger big-btn" disabled={!fields.message} onClick={() => setAsking(true)}>
              🛑 Shut down app
            </button>
          )}
          {(on || current.length > 0) && (
            <div className="shutdown-replies">
              <h3>{on ? 'Replies' : 'Replies from the last shutdown'}</h3>
              {current.length ? <ul>{list(current)}</ul> : <p className="muted small">No replies yet.</p>}
            </div>
          )}
          {earlier.length > 0 && (
            <div className="shutdown-replies">
              <button className="link-btn small" onClick={() => setEarlierOpen(!earlierOpen)}>
                {earlierOpen ? 'Hide' : 'Show'} replies from earlier shutdowns ({earlier.length})
              </button>
              {earlierOpen && <ul>{list(earlier)}</ul>}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}
