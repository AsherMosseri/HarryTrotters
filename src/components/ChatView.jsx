import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SUBTEAMS, SUBTEAM_COLORS } from '../config.js';
import { Avatar, usePeople } from './common.jsx';
import PhotoViewer from './PhotoViewer.jsx';
import Composer from './chat/Composer.jsx';
import Message from './chat/Message.jsx';
import { mentionPattern } from './chat/format.jsx';
import { EmojiManager } from './chat/Pickers.jsx';
import { ChannelDialog, ChannelIcon, MembersPanel, NewDmDialog, NotifyMenu, PinsPanel, SearchPanel, slugChannel } from './chat/Panels.jsx';

const GROUP_MINUTES = 5;
const PAGE = 60;

function dayLabel(ms) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function TypingLine({ names }) {
  if (!names.length) return <div className="typing-line" />;
  const first = names.map((n) => n.split(' ')[0]);
  const who = first.length === 1 ? first[0] : first.length === 2 ? `${first[0]} and ${first[1]}` : 'Several people';
  return (
    <div className="typing-line" aria-live="polite">
      <span className="typing-dots">
        <i />
        <i />
        <i />
      </span>{' '}
      <b>{who}</b> {first.length === 1 ? 'is' : 'are'} typing…
    </div>
  );
}

function ConvButton({ conv, active, unread, onClick, onSettings, actor }) {
  const others = conv.kind === 'dm' ? conv.people.filter((n) => n !== actor.name) : [];
  return (
    <div
      className={`conv-row${active ? ' active' : ''}${unread?.muted ? ' muted' : ''}${unread?.count && !unread.muted ? ' has-unread' : ''}`}
    >
      <button className="conv-main" onClick={onClick}>
        {conv.kind === 'dm' ? (
          others.length === 1 ? (
            <Avatar name={others[0]} size={24} showOnline />
          ) : (
            <span className="group-dm-icon">👥</span>
          )
        ) : (
          <ChannelIcon conv={conv} />
        )}
        <span className="grow conv-name">{conv.kind === 'dm' ? conv.short : conv.name}</span>
        {unread?.muted && (
          <span className="muted tiny" title="Muted">
            🔕
          </span>
        )}
        {unread?.count > 0 && !unread.muted && <span className={`unread${unread.mentions ? ' mention' : ''}`}>{unread.count}</span>}
      </button>
      {onSettings && (
        <button className="conv-gear" onClick={onSettings} title={`#${conv.name} settings`} aria-label={`#${conv.name} settings`}>
          ⚙
        </button>
      )}
    </div>
  );
}

export default function ChatView({
  convs,
  current,
  setCurrent,
  messages,
  unread,
  readAt,
  actor,
  isManager,
  roster,
  tasks,
  api,
  teamEmoji,
  typing,
  levelOf,
  setLevel,
  onPerson,
  onOpenTask,
  onMakeTask,
}) {
  const people = usePeople();
  const [selected, setSelected] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [older, setOlder] = useState({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [newBelow, setNewBelow] = useState(false);
  const [side, setSide] = useState(() =>
    typeof matchMedia === 'function' && matchMedia('(min-width: 1200px)').matches ? 'members' : null,
  );
  const [dialog, setDialog] = useState(null); // { type: 'channel', channel? } | { type: 'dm' } | { type: 'emoji' }
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [showTeamDms, setShowTeamDms] = useState(false);
  const [flash, setFlash] = useState(null);
  const list = useRef(null);
  const atBottom = useRef(true);
  const lastCount = useRef(0);
  const pendingJump = useRef(null);

  const conv = current;
  const all = useMemo(() => [...(older[conv.key] || []), ...(messages[conv.key] || [])], [older, messages, conv.key]);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const emojiMap = useMemo(() => new Map(teamEmoji.map((e) => [e.name, e.url])), [teamEmoji]);
  const myRoles = people?.infoOf(actor.name)?.subteams || [];
  const ctx = useMemo(
    () => ({
      me: actor.name,
      mentionRe: mentionPattern(['everyone', ...SUBTEAMS, ...roster, ...all.map((m) => m.by)]),
      roles: SUBTEAMS,
      myRoles,
      everyoneOk: true,
      roleColor: (s) => SUBTEAM_COLORS[s],
      emoji: emojiMap,
      onPerson,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actor.name, roster, all, emojiMap, onPerson, myRoles.join()],
  );
  // Where "new" starts: what was read when this conversation was opened.
  const [newSince, setNewSince] = useState(readAt[conv.key] ?? Date.now());

  // Start at the newest message when switching conversations.
  useLayoutEffect(() => {
    setSelected(null);
    setReplyTo(null);
    setEditing(null);
    setNewBelow(false);
    setNotifyOpen(false);
    setNewSince(readAt[conv.key] ?? Date.now());
    lastCount.current = 0;
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.key]);

  // Follow new messages if already at the bottom (or if they're mine).
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const newest = all[all.length - 1];
    const grew = all.length > lastCount.current;
    const firstLoad = lastCount.current === 0;
    lastCount.current = all.length;
    if (!grew) return;
    // On opening, show the first unread message near the top (Discord-style).
    if (firstLoad) {
      const firstNew = all.find((m) => m.at > newSince && m.byUid !== actor.uid);
      const node = firstNew && document.getElementById(`msg-${firstNew.id}`);
      if (node) node.scrollIntoView({ block: 'center' });
      else el.scrollTop = el.scrollHeight;
    } else if (atBottom.current || newest?.byUid === actor.uid) {
      el.scrollTop = el.scrollHeight;
      setNewBelow(false);
    } else setNewBelow(true);
    if (pendingJump.current) jumpTo(pendingJump.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, actor.uid]);

  const onScroll = () => {
    const el = list.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom.current) setNewBelow(false);
  };

  const loadOlder = async () => {
    if (!all.length) return [];
    setLoadingOlder(true);
    const el = list.current;
    const before = el.scrollHeight;
    const more = await api.loadOlderMessages(conv.key, all[0].at);
    setOlder((o) => ({ ...o, [conv.key]: [...more, ...(o[conv.key] || [])] }));
    setLoadingOlder(false);
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - before));
    return more;
  };

  // Scroll to a message (loading older pages if needed) and flash it.
  const jumpTo = async (id, tries = 0) => {
    const node = document.getElementById(`msg-${id}`);
    if (node) {
      pendingJump.current = null;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlash(id);
      setTimeout(() => setFlash((f) => (f === id ? null : f)), 1800);
      return;
    }
    if (tries >= 6) return;
    const more = await loadOlder();
    if (more.length) requestAnimationFrame(() => jumpTo(id, tries + 1));
  };

  const openAt = (key, id) => {
    if (key !== conv.key) {
      pendingJump.current = id;
      setCurrent(key);
    } else jumpTo(id);
    if (typeof matchMedia === 'function' && !matchMedia('(min-width: 1200px)').matches) setSide(null);
  };

  const myConvs = useMemo(() => [...convs.channels, ...convs.dms], [convs]);
  const canPost = conv.kind === 'dm' ? conv.mine : !conv.announce || isManager;
  const level = levelOf(conv);
  const memberNames = conv.kind === 'dm' ? conv.people : roster;
  let lastDay = '';
  let newShown = false;

  const moveChannel = (channel, dir) => {
    const ordered = [...convs.channels];
    const i = ordered.findIndex((c) => c.id === channel.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    ordered.forEach((c, k) => c.order !== k && api.saveChannel(c.id, { order: k }));
  };

  const sideList = (
    <>
      <div className="side-section">
        <h2>Channels</h2>
        {isManager && (
          <button className="side-add" onClick={() => setDialog({ type: 'channel' })} title="New channel" aria-label="New channel">
            ＋
          </button>
        )}
      </div>
      {convs.channels.map((c) => (
        <ConvButton
          key={c.key}
          conv={c}
          actor={actor}
          active={c.key === conv.key}
          unread={unread[c.key]}
          onClick={() => setCurrent(c.key)}
          onSettings={isManager ? () => setDialog({ type: 'channel', channel: c }) : null}
        />
      ))}
      <div className="side-section">
        <h2>Direct messages</h2>
        <button className="side-add" onClick={() => setDialog({ type: 'dm' })} title="New message" aria-label="New direct message">
          ＋
        </button>
      </div>
      {convs.dms.map((c) => (
        <ConvButton
          key={c.key}
          conv={c}
          actor={actor}
          active={c.key === conv.key}
          unread={unread[c.key]}
          onClick={() => setCurrent(c.key)}
        />
      ))}
      {!convs.dms.length && <p className="muted tiny side-hint">Tap ＋ to message someone.</p>}
      {isManager && convs.teamDms.length > 0 && (
        <>
          <button className="side-section team-dms-toggle" onClick={() => setShowTeamDms(!showTeamDms)}>
            <h2>
              {showTeamDms ? '▾' : '▸'} Team DMs ({convs.teamDms.length})
            </h2>
          </button>
          {showTeamDms &&
            convs.teamDms.map((c) => (
              <ConvButton key={c.key} conv={c} actor={actor} active={c.key === conv.key} onClick={() => setCurrent(c.key)} />
            ))}
        </>
      )}
    </>
  );

  return (
    <main className={`content chat${side ? ' with-side' : ''}`}>
      <aside className="channel-list">{sideList}</aside>
      <div className="chat-mobile-bar">
        <select className="input channel-select" value={conv.key} onChange={(e) => setCurrent(e.target.value)} aria-label="Channel or DM">
          <optgroup label="Channels">
            {convs.channels.map((c) => (
              <option key={c.key} value={c.key}>
                #{c.name}
                {unread[c.key]?.count && !unread[c.key].muted ? ` (${unread[c.key].count})` : ''}
              </option>
            ))}
          </optgroup>
          {convs.dms.length > 0 && (
            <optgroup label="Direct messages">
              {convs.dms.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.short}
                  {unread[c.key]?.count ? ` (${unread[c.key].count})` : ''}
                </option>
              ))}
            </optgroup>
          )}
          {isManager && convs.teamDms.length > 0 && (
            <optgroup label="Team DMs (view only)">
              {convs.teamDms.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.short}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button className="btn" onClick={() => setDialog({ type: 'dm' })} aria-label="New direct message">
          ✉️ New
        </button>
      </div>

      <section className="chat-main">
        <header className="chat-head">
          <div className="chat-title">
            {conv.kind === 'dm' ? (
              <h2>
                {conv.people.length === 2 ? (
                  <Avatar name={conv.people.find((n) => n !== actor.name) || conv.people[0]} size={24} showOnline />
                ) : (
                  '👥'
                )}{' '}
                {conv.label}
              </h2>
            ) : (
              <h2>
                <ChannelIcon conv={conv} />
                {conv.name}
              </h2>
            )}
            <span className="muted small chat-topic">
              {conv.kind === 'dm'
                ? conv.mine
                  ? 'Direct message · team management can read DMs'
                  : '👁 Viewing as team management (only the people in it can post)'
                : conv.topic ||
                  (conv.announce ? 'Only team management posts here' : conv.subteam ? `${conv.subteam} subteam` : 'The whole team')}
            </span>
          </div>
          <div className="chat-tools">
            <button
              className={`icon-btn${side === 'search' ? ' on' : ''}`}
              onClick={() => setSide(side === 'search' ? null : 'search')}
              title="Search"
              aria-label="Search messages"
            >
              🔍
            </button>
            <button
              className={`icon-btn${side === 'pins' ? ' on' : ''}`}
              onClick={() => setSide(side === 'pins' ? null : 'pins')}
              title="Pinned messages"
              aria-label="Pinned messages"
            >
              📌
            </button>
            {(conv.kind !== 'dm' || conv.mine) && (
              <span className="notify-wrap">
                <button
                  className={`icon-btn notify-btn${notifyOpen ? ' on' : ''}`}
                  onClick={() => setNotifyOpen(!notifyOpen)}
                  title="Notification settings"
                  aria-label="Notification settings"
                >
                  {level.value === 'none' ? '🔕' : level.value === 'all' ? '🔔' : '🔔'}
                  {level.value === 'all' && <span className="notify-all-dot" />}
                </button>
                {notifyOpen && (
                  <NotifyMenu
                    level={level.value}
                    isDefault={level.isDefault}
                    onChange={(v) => {
                      setLevel(conv, v);
                      setNotifyOpen(false);
                    }}
                    onClose={() => setNotifyOpen(false)}
                  />
                )}
              </span>
            )}
            <button
              className={`icon-btn${side === 'members' ? ' on' : ''}`}
              onClick={() => setSide(side === 'members' ? null : 'members')}
              title="Members"
              aria-label="Members"
            >
              👥
            </button>
          </div>
        </header>
        <div className="msg-list" ref={list} onScroll={onScroll}>
          {all.length >= PAGE && (
            <button className="btn ghost load-older" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          )}
          {!all.length && (
            <div className="empty conv-empty">
              {conv.kind === 'dm' ? (
                <p>This is the start of your messages with {conv.label}. Say hi! 👋</p>
              ) : (
                <>
                  <div className="conv-empty-icon">
                    <ChannelIcon conv={conv} />
                  </div>
                  <h3>Welcome to #{conv.name}!</h3>
                  <p className="muted">This is the start of the channel.</p>
                </>
              )}
            </div>
          )}
          {all.map((m, i) => {
            const prev = all[i - 1];
            const day = dayLabel(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            const isNew = !newShown && m.at > newSince && m.byUid !== actor.uid;
            if (isNew) newShown = true;
            const first =
              showDay || isNew || !prev || prev.byUid !== m.byUid || m.at - prev.at > GROUP_MINUTES * 60000 || !!m.replyTo || !!m.poll;
            return (
              <div key={m.id} className={flash === m.id ? 'flash' : ''}>
                {showDay && (
                  <div className="day-sep">
                    <span>{day}</span>
                  </div>
                )}
                {isNew && (
                  <div className="new-sep">
                    <span>New</span>
                  </div>
                )}
                <Message
                  m={m}
                  conv={conv.key}
                  ctx={ctx}
                  canPost={canPost}
                  first={first}
                  actor={actor}
                  isManager={isManager}
                  taskById={taskById}
                  selected={selected === m.id}
                  onSelect={setSelected}
                  api={api}
                  teamEmoji={teamEmoji}
                  onManageEmoji={() => setDialog({ type: 'emoji' })}
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
                    onMakeTask(msg, conv);
                  }}
                  onOpenTask={onOpenTask}
                  onPhoto={setViewing}
                  onJump={(id) => jumpTo(id)}
                  onPerson={onPerson}
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
        <TypingLine names={typing} />
        {!canPost ? (
          <div className="composer read-only">
            {conv.kind === 'dm'
              ? '👁 You can read this DM because you’re on team management.'
              : '📣 Only team management can post announcements. You can still react.'}
          </div>
        ) : (
          <Composer
            key={conv.key}
            conv={conv.key}
            label={conv.kind === 'dm' ? conv.label : `#${conv.name}`}
            isDm={conv.kind === 'dm'}
            actor={actor}
            isManager={isManager}
            roster={roster}
            tasks={tasks}
            api={api}
            replyTo={replyTo}
            editing={editing}
            teamEmoji={teamEmoji}
            onManageEmoji={() => setDialog({ type: 'emoji' })}
            onTyping={() => api.typing(conv.key)}
            onDone={() => {
              setReplyTo(null);
              setEditing(null);
            }}
          />
        )}
      </section>

      {side === 'members' && <MembersPanel names={memberNames} onPerson={onPerson} onClose={() => setSide(null)} />}
      {side === 'pins' && (
        <PinsPanel conv={conv} api={api} ctx={ctx} canUnpin={canPost} onJump={(id) => openAt(conv.key, id)} onClose={() => setSide(null)} />
      )}
      {side === 'search' && (
        <SearchPanel convs={myConvs} current={conv} api={api} roster={roster} onOpen={openAt} onClose={() => setSide(null)} />
      )}

      {dialog?.type === 'channel' && (
        <ChannelDialog
          channel={dialog.channel}
          channels={convs.channels}
          onClose={() => setDialog(null)}
          onMove={(dir) => moveChannel(dialog.channel, dir)}
          onDelete={() => {
            api.saveChannel(dialog.channel.id, { deleted: true });
            if (conv.key === dialog.channel.key) setCurrent('general');
            setDialog(null);
          }}
          onSave={async (data) => {
            if (dialog.channel) await api.saveChannel(dialog.channel.id, data);
            else {
              // New channels get an id from their name (kept if renamed later).
              let id = slugChannel(data.name);
              const ids = new Set(convs.allChannelIds);
              for (let n = 2; ids.has(id); n++) id = `${slugChannel(data.name)}-${n}`;
              await api.saveChannel(id, { ...data, order: convs.channels.length, deleted: false });
              setCurrent(id);
            }
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === 'dm' && (
        <NewDmDialog
          roster={roster}
          actor={actor}
          onClose={() => setDialog(null)}
          onStart={async (names, name) => {
            const key = await api.openDm(names, name);
            setDialog(null);
            if (key) setCurrent(key);
          }}
        />
      )}
      {dialog?.type === 'emoji' && <EmojiManager teamEmoji={teamEmoji} api={api} onClose={() => setDialog(null)} />}
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
