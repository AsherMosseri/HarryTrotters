import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SUBTEAMS, SUBTEAM_COLORS } from '../config.js';
import { useControls } from '../controls.js';
import { Avatar, Nameplate, PlusIcon, usePeople } from './common.jsx';
import PhotoViewer from './PhotoViewer.jsx';
import Composer from './chat/Composer.jsx';
import Message, { messageShows } from './chat/Message.jsx';
import { CommandNote } from './chat/Commands.jsx';
import { mentionPattern } from './chat/format.jsx';
import { EmojiManager, StickerManager } from './chat/Pickers.jsx';
import { ChannelDialog, ChannelIcon, MembersPanel, NewDmDialog, NotifyMenu, PinsPanel, SearchPanel, slugChannel } from './chat/Panels.jsx';
import { Icon } from './shell/icons.jsx';
import { BotReplies, ChatAd, chatAdSpots, useAds } from './Ads.jsx';

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
  const people = usePeople();
  const others = conv.kind === 'dm' ? conv.people.filter((n) => n !== actor.name) : [];
  return (
    <div
      className={`conv-row${active ? ' active' : ''}${unread?.muted ? ' muted' : ''}${unread?.count && !unread.muted ? ' has-unread' : ''}`}
    >
      <button className="conv-main" onClick={onClick}>
        {others.length === 1 && <Nameplate plate={people?.profileOf(others[0])?.nameplate} />}
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
  teamEmoji: allTeamEmoji,
  stickers,
  typing,
  levelOf,
  setLevel,
  onPerson,
  onOpenTask,
  onMakeTask,
  // Shown inside another tab (Parts): one conversation, no channel list or
  // side panels, and a button to open it in the Chat tab.
  embedded = false,
  onOpenFull,
  onCollapse,
  // The app's sidebar lists the channels (iPads and computers), and asks for
  // the new-message and channel dialogs through `ask`.
  noList = false,
  ask,
  onAsked,
}) {
  // Asher's Controls: what's switched off isn't shown here at all.
  const feat = useControls().isOn;
  const teamEmoji = feat('teamEmoji') ? allTeamEmoji : [];
  const people = usePeople();
  const [selected, setSelected] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  // Slash-command notes only you see, per conversation (gone on reload).
  const [notes, setNotes] = useState({});
  const [useCmd, setUseCmd] = useState(null);
  const [older, setOlder] = useState({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [newBelow, setNewBelow] = useState(false);
  const [side, setSide] = useState(() =>
    !embedded && typeof matchMedia === 'function' && matchMedia('(min-width: 1200px)').matches ? 'members' : null,
  );
  const [dialog, setDialog] = useState(null); // { type: 'channel', channel? } | { type: 'dm' } | { type: 'emoji' }
  useEffect(() => {
    if (!ask) return;
    setDialog({ type: ask.type, ...(ask.channel ? { channel: ask.channel } : {}) });
    onAsked?.();
  }, [ask, onAsked]);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [showTeamDms, setShowTeamDms] = useState(false);
  const [flash, setFlash] = useState(null);
  const list = useRef(null);
  const atBottom = useRef(true);
  const lastCount = useRef(0);
  const lastNewest = useRef(null);
  const pendingJump = useRef(null);

  const conv = current;
  // Switching conversations drops the reply, edit, and picked command right
  // away, before the new conversation's composer first renders, so they
  // can't land in its text (and its saved draft).
  const [stateFor, setStateFor] = useState(conv.key);
  if (stateFor !== conv.key) {
    setStateFor(conv.key);
    setReplyTo(null);
    setEditing(null);
    setUseCmd(null);
  }
  const all = useMemo(() => [...(older[conv.key] || []), ...(messages[conv.key] || [])], [older, messages, conv.key]);
  const ads = useAds();
  const adSpots = chatAdSpots(ads, all.length);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const emojiMap = useMemo(() => new Map(teamEmoji.map((e) => [e.name, e.url])), [teamEmoji]);
  // Messages with nothing left to show once Controls switch things off.
  const shownMessages = useMemo(() => all.filter((m) => messageShows(m, feat)), [all, feat]);
  const myRoles = people?.infoOf(actor.name)?.subteams || [];
  const ctx = useMemo(
    () => ({
      me: actor.name,
      mentionRe: feat('mentions') ? mentionPattern(['everyone', ...SUBTEAMS, ...roster, ...all.map((m) => m.by)]) : null,
      plain: !feat('formatting'),
      roles: SUBTEAMS,
      myRoles,
      everyoneOk: true,
      roleColor: (s) => SUBTEAM_COLORS[s],
      emoji: emojiMap,
      onPerson,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actor.name, roster, all, emojiMap, onPerson, myRoles.join(), feat],
  );
  // Where "new" starts: what this device had read when the conversation was
  // opened. Taken while rendering, so the "New" line and the jump use this
  // conversation's time right away (the parent marks it read right after).
  const opened = useRef({ key: null, since: 0 });
  if (opened.current.key !== conv.key) opened.current = { key: conv.key, since: readAt[conv.key] ?? Date.now() };
  const newSince = opened.current.since;

  // Scrolls only the message list (never the page around it) so `node` sits
  // `offset` px below the top.
  const scrollListTo = (node, offset, smooth = false) => {
    const el = list.current;
    if (!el || !node) return;
    const top = el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - offset;
    el.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  };

  // Opening a conversation: unread messages start at the red "New" line near
  // the top, so you read down from where you left off (like Discord).
  // Nothing new: the newest message, at the bottom.
  const showStart = () => {
    const el = list.current;
    if (!el) return;
    const sep = el.querySelector('.new-sep');
    if (sep) {
      scrollListTo(sep, 56);
      const below = el.scrollHeight - el.scrollTop - el.clientHeight > 120;
      atBottom.current = !below;
      setNewBelow(below);
    } else {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
    }
  };

  useLayoutEffect(() => {
    setSelected(null);
    setNewBelow(false);
    setNotifyOpen(false);
    lastCount.current = all.length;
    lastNewest.current = all[all.length - 1]?.id ?? null;
    if (all.length) showStart();
    // Opened from search or a pin in another conversation: go to that message.
    if (pendingJump.current) jumpTo(pendingJump.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.key]);

  // Follow new messages if already at the bottom (or if they're mine). "New"
  // means a different newest message: the live window is capped at PAGE, so
  // the count stays the same once a channel is busy.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const newest = all[all.length - 1];
    const firstLoad = lastCount.current === 0 && all.length > 0;
    const newestChanged = !!newest && newest.id !== lastNewest.current;
    lastCount.current = all.length;
    lastNewest.current = newest?.id ?? null;
    // Messages arriving for a conversation that just opened empty.
    if (firstLoad) showStart();
    else if (!newestChanged) {
      // Same messages, changed (an edit, a reaction, a link preview): stay at the bottom.
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    } else if (atBottom.current || newest.byUid === actor.uid) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      setNewBelow(false);
    } else setNewBelow(true);
    if (pendingJump.current) jumpTo(pendingJump.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, actor.uid]);

  // At the bottom, stay there when things grow later: photos, GIFs, and videos
  // finishing loading, or the list getting shorter (a reply bar, the keyboard).
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const stick = () => atBottom.current && (el.scrollTop = el.scrollHeight);
    el.addEventListener('load', stick, true);
    el.addEventListener('loadedmetadata', stick, true);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(stick) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('load', stick, true);
      el.removeEventListener('loadedmetadata', stick, true);
      ro?.disconnect();
    };
  }, []);

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
      scrollListTo(node, list.current ? list.current.clientHeight / 3 : 0, true);
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
            <PlusIcon />
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
      {feat('dms') && (
        <div className="side-section">
          <h2>Direct messages</h2>
          <button className="side-add" onClick={() => setDialog({ type: 'dm' })} title="New message" aria-label="New direct message">
            <PlusIcon />
          </button>
        </div>
      )}
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
    <main className={`content chat${side ? ' with-side' : ''}${embedded ? ' embedded' : ''}${noList ? ' no-list' : ''}`}>
      {!embedded && !noList && <aside className="channel-list">{sideList}</aside>}
      {!embedded && !noList && (
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
          {feat('dms') && (
            <button className="btn" onClick={() => setDialog({ type: 'dm' })} aria-label="New direct message">
              <Icon name="plus" size={16} /> New
            </button>
          )}
        </div>
      )}

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
                  ? 'Direct message'
                  : '👁 Viewing as team management (only the people in it can post)'
                : conv.topic ||
                  (conv.announce ? 'Only team management posts here' : conv.subteam ? `${conv.subteam} subteam` : 'The whole team')}
            </span>
          </div>
          <div className="chat-tools">
            {embedded && (
              <button className="btn small-btn" onClick={onOpenFull} title="Search, pins, and members are in the Chat tab">
                Open in Chat ↗
              </button>
            )}
            {embedded && onCollapse && (
              <button className="btn small-btn" onClick={onCollapse} title="Hide the chat (the list gets the whole page)">
                Hide
              </button>
            )}
            {!embedded && (
              <>
                {feat('search') && (
                  <button
                    className={`icon-btn${side === 'search' ? ' on' : ''}`}
                    onClick={() => setSide(side === 'search' ? null : 'search')}
                    title="Search"
                    aria-label="Search messages"
                  >
                    <Icon name="search" />
                  </button>
                )}
                {feat('pins') && (
                  <button
                    className={`icon-btn${side === 'pins' ? ' on' : ''}`}
                    onClick={() => setSide(side === 'pins' ? null : 'pins')}
                    title="Pinned messages"
                    aria-label="Pinned messages"
                  >
                    <Icon name="pin" />
                  </button>
                )}
              </>
            )}
            {(conv.kind !== 'dm' || conv.mine) && (
              <span className="notify-wrap">
                <button
                  className={`icon-btn notify-btn${notifyOpen ? ' on' : ''}`}
                  onClick={() => setNotifyOpen(!notifyOpen)}
                  title="Notification settings"
                  aria-label="Notification settings"
                >
                  <Icon name={level.value === 'none' ? 'bellOff' : 'bell'} />
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
            {!embedded && (
              <button
                className={`icon-btn${side === 'members' ? ' on' : ''}`}
                onClick={() => setSide(side === 'members' ? null : 'members')}
                title="Members"
                aria-label="Members"
              >
                <Icon name="team" />
              </button>
            )}
          </div>
        </header>
        <div className="msg-list" ref={list} onScroll={onScroll}>
          {/* Pretend ads, every N messages (Asher's Ads page). */}
          {all.length >= PAGE && (
            <button className="btn ghost load-older" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          )}
          {!all.length && (
            <div className="empty conv-empty">
              {conv.kind === 'dm' ? <p>No messages with {conv.label} yet.</p> : <p>Nothing in #{conv.name} yet.</p>}
            </div>
          )}
          {shownMessages.map((m, i) => {
            const prev = shownMessages[i - 1];
            const adHere = adSpots.has(i);
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
                {adHere && <ChatAd k={i} />}
              </div>
            );
          })}
          <BotReplies conv={conv.key} />
          {(notes[conv.key] || []).map((n) => (
            <CommandNote
              key={n.id}
              note={n}
              onDismiss={() => setNotes((all) => ({ ...all, [conv.key]: all[conv.key].filter((x) => x.id !== n.id) }))}
              onUse={(c) => setUseCmd({ ...c, at: Date.now() })}
              onGo={(id) => setCurrent(id)}
              tasks={tasks}
              onOpenTask={onOpenTask}
              onTaskDone={(t) => api.update(t, { status: 'done' })}
            />
          ))}
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
            stickers={stickers}
            onManageStickers={() => setDialog({ type: 'stickers' })}
            onTyping={() => api.typing(conv.key)}
            useCommand={useCmd}
            onNote={(n) => {
              setNotes((all) => ({
                ...all,
                [conv.key]: [...(all[conv.key] || []).slice(-4), { ...n, id: `${Date.now()}-${Math.random()}` }],
              }));
              requestAnimationFrame(() => list.current && (list.current.scrollTop = list.current.scrollHeight));
            }}
            onDone={() => {
              setReplyTo(null);
              setEditing(null);
            }}
          />
        )}
      </section>

      {side === 'members' && <MembersPanel names={memberNames} onPerson={onPerson} onClose={() => setSide(null)} />}
      {side === 'pins' && feat('pins') && (
        <PinsPanel conv={conv} api={api} ctx={ctx} canUnpin={canPost} onJump={(id) => openAt(conv.key, id)} onClose={() => setSide(null)} />
      )}
      {side === 'search' && feat('search') && (
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
      {dialog?.type === 'stickers' && <StickerManager stickers={stickers} api={api} onClose={() => setDialog(null)} />}
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
