import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CHANNELS, SUBTEAM_COLORS } from '../config.js';
import { preparePhoto } from '../util.js';
import { Avatar, CloseIcon, StatusDot } from './common.jsx';
import PhotoViewer from './PhotoViewer.jsx';

const QUICK_REACTIONS = ['👍', '✅', '😂', '❤️', '🔥', '👀'];
const MORE_EMOJIS = [
  '😀',
  '😄',
  '😁',
  '😅',
  '🤣',
  '😊',
  '😍',
  '🥳',
  '😎',
  '🤔',
  '😮',
  '😢',
  '😭',
  '😤',
  '😬',
  '🙃',
  '🙌',
  '👏',
  '💪',
  '🙏',
  '👌',
  '🤝',
  '✌️',
  '👋',
  '🫡',
  '🤞',
  '👎',
  '💯',
  '⭐',
  '✨',
  '🎉',
  '🏆',
  '🥇',
  '🚀',
  '⚡',
  '💥',
  '🛠️',
  '🔧',
  '🔩',
  '⚙️',
  '🪛',
  '🔌',
  '🔋',
  '💻',
  '🤖',
  '📐',
  '📏',
  '📷',
  '📦',
  '🧰',
  '⏰',
  '📅',
  '✔️',
  '❌',
  '⚠️',
  '❓',
  '❗',
  '🐐',
  '🐱',
  '🍕',
  '☕',
  '🎯',
];
const GROUP_MINUTES = 5;

const channelName = (id) => `#${id}`;
const timeOf = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
function dayLabel(ms) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// Keeps the first character the person typed if it's an emoji.
function firstEmoji(text) {
  const t = text.trim();
  if (!t) return '';
  const first = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter().segment(t)][0].segment : [...t][0];
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first) ? first : '';
}

// Splits message text into plain text, @mentions, and links.
function renderText(text, names, me) {
  if (!text) return null;
  const sorted = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(https?://[^\\s]+)${sorted.length ? `|@(${sorted.join('|')})` : ''}`, 'g');
  const out = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <a key={m.index} href={m[1]} target="_blank" rel="noreferrer">
          {m[1]}
        </a>,
      );
    } else {
      out.push(
        <span key={m.index} className={`mention${m[2] === me ? ' me' : ''}`}>
          @{m[2]}
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function EmojiPicker({ onPick, onClose }) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
      <div className="emoji-grid">
        {[...QUICK_REACTIONS, ...MORE_EMOJIS].map((e) => (
          <button key={e} onClick={() => onPick(e)} aria-label={`React ${e}`}>
            {e}
          </button>
        ))}
      </div>
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault();
          const em = firstEmoji(typed);
          if (em) onPick(em);
        }}
      >
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type any emoji" />
        <button className="btn" disabled={!firstEmoji(typed)}>
          Add
        </button>
      </form>
    </div>
  );
}

function Message({
  m,
  first,
  actor,
  isManager,
  names,
  taskById,
  selected,
  onSelect,
  api,
  channel,
  onReply,
  onEdit,
  onMakeTask,
  onOpenTask,
  onPhoto,
}) {
  const [picker, setPicker] = useState(false);
  const [removing, setRemoving] = useState(false);
  const mine = m.byUid === actor.uid;
  const reactions = Object.entries(m.reactions || {}).filter(([, who]) => who && Object.keys(who).length);
  const mentionsMe = (m.mentions || []).includes(actor.name);
  const react = (emoji) => {
    const on = !(m.reactions?.[emoji] && m.reactions[emoji][actor.uid]);
    api.react(channel, m.id, emoji, on);
    setPicker(false);
  };

  return (
    <div
      className={`msg${first ? ' first' : ''}${selected ? ' selected' : ''}${mentionsMe ? ' mentions-me' : ''}`}
      id={`msg-${m.id}`}
      onClick={(e) => {
        if (e.target.closest('a,button,input,.emoji-picker')) return;
        onSelect(selected ? null : m.id);
      }}
    >
      <div className="msg-gutter">{first ? <Avatar name={m.by} size={34} /> : <span className="msg-time-hover">{timeOf(m.at)}</span>}</div>
      <div className="msg-body">
        {first && (
          <div className="msg-head">
            <b>{m.by}</b> <span className="muted tiny">{timeOf(m.at)}</span>
          </div>
        )}
        {m.replyTo && (
          <button
            className="msg-reply-quote"
            onClick={() => document.getElementById(`msg-${m.replyTo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            ↩ <b>{m.replyTo.by?.split(' ')[0]}</b> {m.replyTo.text || 'a photo'}
          </button>
        )}
        {m.deleted ? (
          <div className="msg-text muted">
            <i>Message deleted</i>
          </div>
        ) : (
          <>
            {m.text && (
              <div className="msg-text">
                {renderText(m.text, names, actor.name)}
                {m.editedAt && <span className="muted tiny"> (edited)</span>}
              </div>
            )}
            {m.photo && (
              <button className="msg-photo" onClick={() => onPhoto(m)} aria-label="Open photo">
                <img src={m.photo.thumbUrl || m.photo.url} alt="" loading="lazy" />
              </button>
            )}
            {(m.taskIds || []).filter((id) => taskById[id]).length > 0 && (
              <div className="msg-tasks">
                {m.taskIds
                  .filter((id) => taskById[id])
                  .map((id) => (
                    <button key={id} className="task-chip" onClick={() => onOpenTask(id)}>
                      <StatusDot status={taskById[id].status} /> {taskById[id].title}
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
        {reactions.length > 0 && (
          <div className="msg-reactions">
            {reactions.map(([emoji, who]) => (
              <button
                key={emoji}
                className={`reaction${who[actor.uid] ? ' mine' : ''}`}
                title={Object.values(who).join(', ')}
                onClick={() => react(emoji)}
              >
                {emoji} {Object.keys(who).length}
              </button>
            ))}
          </div>
        )}
        {removing && (
          <div className="msg-reactions remove-mode">
            <span className="muted small">Remove a reaction:</span>
            {reactions.map(([emoji]) => (
              <button
                key={emoji}
                className="reaction"
                onClick={() => {
                  api.removeReaction(channel, m.id, emoji);
                  if (reactions.length <= 1) setRemoving(false);
                }}
              >
                {emoji} ✕
              </button>
            ))}
            <button className="link-btn" onClick={() => setRemoving(false)}>
              Done
            </button>
          </div>
        )}
      </div>
      {!m.deleted && (
        <div className="msg-actions" onClick={(e) => e.stopPropagation()}>
          {QUICK_REACTIONS.slice(0, 3).map((e) => (
            <button key={e} onClick={() => react(e)} aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
          <button onClick={() => setPicker((p) => !p)} aria-label="More reactions" title="More reactions">
            ☺+
          </button>
          <button onClick={() => onReply(m)} title="Reply">
            ↩
          </button>
          <button onClick={() => onMakeTask(m)} title="Make a task from this message">
            ＋Task
          </button>
          {mine && (
            <button onClick={() => onEdit(m)} title="Edit">
              ✏️
            </button>
          )}
          {isManager && reactions.length > 0 && (
            <button onClick={() => setRemoving(true)} title="Remove reactions">
              🚫☺
            </button>
          )}
          {(mine || isManager) && (
            <button className="danger-text" onClick={() => confirm('Delete this message?') && api.deleteMessage(channel, m)} title="Delete">
              🗑
            </button>
          )}
          {picker && <EmojiPicker onPick={react} onClose={() => setPicker(false)} />}
        </div>
      )}
    </div>
  );
}

function Composer({ channel, actor, roster, tasks, api, replyTo, editing, onDone }) {
  const [text, setText] = useState('');
  const [taskIds, setTaskIds] = useState([]);
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [suggest, setSuggest] = useState(null); // { kind: '@' | '#', query, start }
  const [sending, setSending] = useState(false);
  const box = useRef(null);
  const fileInput = useRef(null);
  const caretAfterUpdate = useRef(null);
  // Short placeholder on phones so it fits on one line.
  const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 761px)').matches;

  useEffect(() => {
    if (editing) {
      setText(editing.text || '');
      setTaskIds(editing.taskIds || []);
      box.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (replyTo) box.current?.focus();
  }, [replyTo]);
  // Put the cursor after an inserted @name/#task before the next keystroke lands.
  useLayoutEffect(() => {
    const pos = caretAfterUpdate.current;
    if (pos === null || !box.current) return;
    caretAfterUpdate.current = null;
    box.current.focus();
    box.current.setSelectionRange(pos, pos);
  }, [text]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text]);

  const options = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    if (suggest.kind === '@')
      return roster
        .filter(
          (n) =>
            n
              .toLowerCase()
              .split(' ')
              .some((w) => w.startsWith(q)) || n.toLowerCase().startsWith(q),
        )
        .slice(0, 6);
    return tasks.filter((t) => (t.title || '').toLowerCase().includes(q)).slice(0, 6);
  }, [suggest, roster, tasks]);

  const onChange = (e) => {
    const value = e.target.value;
    setText(value);
    const caret = e.target.selectionStart;
    const m = /(^|\s)([@#])([^\s@#]{0,30})$/.exec(value.slice(0, caret));
    setSuggest(m ? { kind: m[2], query: m[3], start: caret - m[3].length - 1, end: caret } : null);
  };

  const pick = (opt) => {
    const insert = suggest.kind === '@' ? `@${opt} ` : `#${opt.title} `;
    const next = text.slice(0, suggest.start) + insert + text.slice(suggest.end);
    setText(next);
    if (suggest.kind === '#') setTaskIds((ids) => [...new Set([...ids, opt.id])]);
    setSuggest(null);
    caretAfterUpdate.current = suggest.start + insert.length;
  };

  const reset = () => {
    setText('');
    setTaskIds([]);
    setPhoto(null);
    setSuggest(null);
    onDone();
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !photo) || sending) return;
    const mentions = roster.filter((n) => body.includes(`@${n}`));
    const linked = taskIds.filter((id) => tasks.some((t) => t.id === id && body.includes(`#${t.title}`)));
    setSending(true);
    try {
      if (editing) {
        await api.editMessage(channel, editing.id, { text: body, mentions, taskIds: linked });
      } else {
        const replyInfo = replyTo ? { id: replyTo.id, by: replyTo.by, text: (replyTo.text || '').slice(0, 120) } : null;
        await api.sendMessage(channel, { text: body, mentions, taskIds: linked, replyTo: replyInfo }, photo?.file);
      }
      reset();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="composer">
      {(replyTo || editing) && (
        <div className="composer-context">
          {editing ? (
            <span>✏️ Editing your message</span>
          ) : (
            <span>
              ↩ Replying to <b>{replyTo.by.split(' ')[0]}</b>: {replyTo.text?.slice(0, 80) || 'a photo'}
            </span>
          )}
          <button className="icon-btn small" onClick={reset} aria-label="Cancel">
            <CloseIcon />
          </button>
        </div>
      )}
      {photo && (
        <div className="composer-photo">
          <img src={photo.preview} alt="" />
          <button className="icon-btn small" onClick={() => setPhoto(null)} aria-label="Remove photo">
            <CloseIcon />
          </button>
        </div>
      )}
      {suggest && options.length > 0 && (
        <ul className="suggest">
          {options.map((o) => (
            <li key={suggest.kind === '@' ? o : o.id}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
                {suggest.kind === '@' ? (
                  <>
                    <Avatar name={o} size={22} /> {o}
                  </>
                ) : (
                  <>
                    <StatusDot status={o.status} /> {o.title}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="composer-row">
        {!editing && (
          <>
            <button className="icon-btn" onClick={() => fileInput.current?.click()} aria-label="Add a photo" title="Add a photo">
              📷
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files[0];
                e.target.value = '';
                if (f) {
                  const prepared = await preparePhoto(f);
                  setPhoto({ file: prepared, preview: URL.createObjectURL(prepared.thumb) });
                }
              }}
            />
          </>
        )}
        <textarea
          ref={box}
          rows={1}
          value={text}
          onChange={onChange}
          onKeyDown={(e) => {
            if (suggest && options.length && (e.key === 'Enter' || e.key === 'Tab')) {
              e.preventDefault();
              pick(options[0]);
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            } else if (e.key === 'Escape') {
              if (suggest) setSuggest(null);
              else if (editing || replyTo) reset();
            }
          }}
          placeholder={wide ? `Message ${channelName(channel)}  ·  @ to mention, # to link a task` : `Message ${channelName(channel)}`}
        />
        <button className="btn primary" onClick={send} disabled={sending || (!text.trim() && !photo)}>
          {editing ? 'Save' : sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default function ChatView({ channel, setChannel, messages, unread, actor, isManager, roster, tasks, api, onOpenTask, onMakeTask }) {
  const [selected, setSelected] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [older, setOlder] = useState({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [newBelow, setNewBelow] = useState(false);
  const list = useRef(null);
  const atBottom = useRef(true);
  const lastCount = useRef(0);

  const all = useMemo(() => [...(older[channel] || []), ...(messages[channel] || [])], [older, messages, channel]);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const names = useMemo(() => [...new Set([...roster, ...all.map((m) => m.by)])], [roster, all]);

  // Start at the newest message when switching channels.
  useLayoutEffect(() => {
    setSelected(null);
    setReplyTo(null);
    setEditing(null);
    setNewBelow(false);
    lastCount.current = 0;
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [channel]);

  // Follow new messages if already at the bottom (or if they're mine).
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const newest = all[all.length - 1];
    const grew = all.length > lastCount.current;
    lastCount.current = all.length;
    if (!grew) return;
    if (atBottom.current || newest?.byUid === actor.uid) {
      el.scrollTop = el.scrollHeight;
      setNewBelow(false);
    } else setNewBelow(true);
  }, [all, actor.uid]);

  const onScroll = () => {
    const el = list.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom.current) setNewBelow(false);
  };

  const loadOlder = async () => {
    if (!all.length) return;
    setLoadingOlder(true);
    const el = list.current;
    const before = el.scrollHeight;
    const more = await api.loadOlderMessages(channel, all[0].at);
    setOlder((o) => ({ ...o, [channel]: [...more, ...(o[channel] || [])] }));
    setLoadingOlder(false);
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - before));
  };

  const ch = CHANNELS.find((c) => c.id === channel) || CHANNELS[0];
  let lastDay = '';

  return (
    <main className="content chat">
      <aside className="channel-list">
        <h2>Channels</h2>
        {CHANNELS.map((c) => (
          <button key={c.id} className={c.id === channel ? 'active' : ''} onClick={() => setChannel(c.id)}>
            <span className="hash" style={{ color: SUBTEAM_COLORS[c.subteam] || 'var(--accent)' }}>
              #
            </span>
            <span className="grow">{c.id}</span>
            {unread[c.id]?.count > 0 && <span className={`unread${unread[c.id].mentions ? ' mention' : ''}`}>{unread[c.id].count}</span>}
          </button>
        ))}
      </aside>
      <select className="input channel-select" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
        {CHANNELS.map((c) => (
          <option key={c.id} value={c.id}>
            #{c.id}
            {unread[c.id]?.count ? ` (${unread[c.id].count})` : ''}
          </option>
        ))}
      </select>

      <section className="chat-main">
        <header className="chat-head">
          <h2>#{ch.id}</h2>
          <span className="muted small">{ch.subteam ? `${ch.subteam} subteam` : 'The whole team'}</span>
        </header>
        <div className="msg-list" ref={list} onScroll={onScroll}>
          {all.length >= 60 && (
            <button className="btn ghost load-older" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          )}
          {!all.length && <p className="empty">No messages in #{ch.id} yet. Say hi! 👋</p>}
          {all.map((m, i) => {
            const prev = all[i - 1];
            const day = dayLabel(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            const first = showDay || !prev || prev.byUid !== m.byUid || m.at - prev.at > GROUP_MINUTES * 60000 || !!m.replyTo;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="day-sep">
                    <span>{day}</span>
                  </div>
                )}
                <Message
                  m={m}
                  first={first}
                  actor={actor}
                  isManager={isManager}
                  names={names}
                  taskById={taskById}
                  selected={selected === m.id}
                  onSelect={setSelected}
                  api={api}
                  channel={channel}
                  onReply={(msg) => {
                    setEditing(null);
                    setReplyTo(msg);
                    setSelected(null);
                  }}
                  onEdit={(msg) => {
                    setReplyTo(null);
                    setEditing(msg);
                    setSelected(null);
                  }}
                  onMakeTask={(msg) => {
                    setSelected(null);
                    onMakeTask(msg, ch);
                  }}
                  onOpenTask={onOpenTask}
                  onPhoto={setViewing}
                />
              </div>
            );
          })}
        </div>
        {newBelow && (
          <button
            className="new-below"
            onClick={() => {
              list.current.scrollTop = list.current.scrollHeight;
              setNewBelow(false);
            }}
          >
            New messages ↓
          </button>
        )}
        <Composer
          channel={channel}
          actor={actor}
          roster={roster}
          tasks={tasks}
          api={api}
          replyTo={replyTo}
          editing={editing}
          onDone={() => {
            setReplyTo(null);
            setEditing(null);
          }}
        />
      </section>
      {viewing && (
        <PhotoViewer
          photos={[{ ...viewing.photo, by: viewing.by, at: viewing.at }]}
          index={0}
          onIndex={() => {}}
          onClose={() => setViewing(null)}
        />
      )}
    </main>
  );
}
