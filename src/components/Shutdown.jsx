import { useEffect, useRef, useState } from 'react';
import { AutoTextarea, Avatar, CloseIcon, Overlay } from './common.jsx';
import { REQUESTS_TO } from '../config.js';
import { useEscape } from '../util.js';

// Asher can shut the app down for everyone else (settings/shutdown). They see
// a full screen with his message and a plain-text chat with him
// (shutdownReplies, one chat per person); it opens again by itself when he
// turns it back on.

const CACHE = 'shutdown-cache';
const firstName = (n) => (n || '').split(' ')[0];
const when = (ms) =>
  new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const clock = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const personOf = (r) => r.person || r.name;
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

// One shutdown chat, oldest first: plain text only. `me`'s messages are on
// the right.
function Thread({ messages, me, onDelete }) {
  const box = useRef(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages.length]);
  if (!messages.length) return null;
  return (
    <div className="sd-thread" ref={box} role="log" aria-label="Chat">
      {messages.map((m) => {
        const mine = m.name === me;
        return (
          <div key={m.id} className={`sd-msg${mine ? ' mine' : ''}`}>
            {!mine && <Avatar name={m.name} size={26} />}
            <div className="sd-bubble">
              <div className="sd-text">{m.text}</div>
              <div className="sd-meta">
                {mine ? '' : `${firstName(m.name)} · `}
                {clock(m.at)}
                {onDelete && (
                  <button className="link-btn" onClick={() => onDelete(m.id)} aria-label="Delete message">
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Plain text: Return sends, Shift+Return makes a new line.
function ChatBox({ onSend, placeholder }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    const t = text.trim().slice(0, 1000);
    if (!t || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSend(t);
      setText('');
    } catch (e) {
      setError(e.message?.includes('permission') ? 'Couldn’t send it. The app may be back on: reload.' : e.message || 'Couldn’t send it.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="sd-compose">
        <AutoTextarea
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          enterKeyHint="send"
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={1000}
          maxHeight={140}
        />
        <button className="btn primary" disabled={!text.trim() || busy} onClick={send}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
      {error && <div className="casino-error">{error}</div>}
    </>
  );
}

// New messages in each chat: theirs since Asher last wrote in it.
function unreadIn(messages, me) {
  let n = 0;
  for (const m of messages) n = m.name === me ? 0 : n + 1;
  return n;
}
export function shutdownUnread(replies, me) {
  const chats = {};
  for (const r of [...replies].sort((a, b) => a.at - b.at)) (chats[personOf(r)] ||= []).push(r);
  return Object.values(chats).reduce((t, msgs) => t + unreadIn(msgs, me), 0);
}

// What everyone but Asher sees while the app is shut down.
export function ShutdownScreen({ shutdown, store, actor }) {
  const [messages, setMessages] = useState([]);
  useEffect(() => store.subscribeShutdownThread(actor.name, setMessages), [store, actor.name]);
  const thread = messages.filter((m) => m.round === shutdown.at);
  const to = firstName(REQUESTS_TO);
  return (
    <div className="gate shutdown-gate">
      <button
        className="btn small-btn shutdown-switch"
        onClick={() => confirm('Switch user? You will need the team code again on this device.') && store.leave()}
      >
        Switch user
      </button>
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
        <div className="shutdown-chat">
          <b className="shutdown-question">{shutdown.question || `Anything to tell ${to}?`}</b>
          <Thread messages={thread} me={actor.name} />
          <ChatBox
            placeholder={thread.length ? `Message ${to}…` : 'Type your answer…'}
            onSend={(t) => store.sendShutdownReply(t, shutdown.at, actor)}
          />
        </div>
        <p className="muted tiny">The app opens again by itself when it’s back on.</p>
      </div>
    </div>
  );
}

// Asher's page: shut the app down (or back on), change the message, and chat
// with each person who wrote (switch between them at the top right).
export function ShutdownPage({ shutdown, replies, me, onSave, onDelete, onReply, onClose }) {
  useEscape(onClose);
  const on = !!shutdown?.on;
  const [message, setMessage] = useState(shutdown?.message || 'Massive bug. The app is shut down while I fix it.');
  const [question, setQuestion] = useState(shutdown?.question ?? 'How long do you want this to be shut down?');
  const [asking, setAsking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Everyone's chat, oldest message first; people with the newest message first.
  const chats = {};
  for (const r of [...replies].sort((a, b) => a.at - b.at)) (chats[personOf(r)] ||= []).push(r);
  const people = Object.keys(chats).sort((a, b) => chats[b].at(-1).at - chats[a].at(-1).at);
  const [picked, setPicked] = useState(null);
  const person = people.includes(picked) ? picked : people[0];
  const wrote = new Set(replies.filter((r) => r.round === shutdown?.at && r.name !== me).map(personOf)).size;
  const changed = on && (message.trim() !== shutdown.message || question.trim() !== (shutdown.question || ''));
  const save = async (data) => {
    setBusy(true);
    setError('');
    try {
      await onSave(data);
      setAsking(false);
      setEditing(false);
    } catch (e) {
      setError(e.message || 'Couldn’t save that.');
    } finally {
      setBusy(false);
    }
  };
  const fields = { message: message.trim(), question: question.trim() };
  const showFields = !on || editing;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog shutdown-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shut down app">
          <div className="panel-head">
            <h2>🛑 Shutdown</h2>
            <span className="spacer" />
            {people.length > 0 && (
              <select className="input sd-picker" value={person} onChange={(e) => setPicked(e.target.value)} aria-label="Switch chat">
                {people.map((p) => {
                  const n = unreadIn(chats[p], me);
                  return (
                    <option key={p} value={p}>
                      {p}
                      {n ? ` (${n} new)` : ''}
                    </option>
                  );
                })}
              </select>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className={`shutdown-status${on ? ' on' : ''}`}>
            {on ? (
              <>
                <b>🛑 Shut down for everyone but you</b>
                <span className="small">
                  Since {when(shutdown.at)} · {wrote} {wrote === 1 ? 'person' : 'people'} wrote
                </span>
              </>
            ) : (
              <>
                <b>✅ The app is on</b>
                <span className="small muted">
                  Shutting it down shows everyone but you a full screen with your message and a chat with you. Their messages come to you
                  here and in 🔔.
                </span>
              </>
            )}
          </div>
          {showFields && (
            <>
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
            </>
          )}
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
              {editing ? (
                <div className="row">
                  <button
                    className="btn grow"
                    disabled={!changed || busy}
                    onClick={() => save({ on: true, ...fields, at: shutdown.at, endedAt: null })}
                  >
                    Update message
                  </button>
                  <button className="btn" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="link-btn small" onClick={() => setEditing(true)}>
                  Edit message
                </button>
              )}
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
          {person ? (
            <div className="shutdown-chat sd-owner">
              <h3>
                <Avatar name={person} size={24} /> {person}
              </h3>
              <Thread key={person} messages={chats[person]} me={me} onDelete={onDelete} />
              <ChatBox key={`box-${person}`} placeholder={`Reply to ${firstName(person)}…`} onSend={(t) => onReply(person, t)} />
            </div>
          ) : (
            on && <p className="muted small">No one has written yet.</p>
          )}
        </div>
      </div>
    </Overlay>
  );
}
