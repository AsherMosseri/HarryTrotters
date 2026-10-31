import { renameMessage, sentByMe } from '../people.js';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SUBTEAMS, SUBTEAM_COLORS } from '../config.js';
import { useControls } from '../controls.js';
import { Avatar, Nameplate, Overlay, PlusIcon, usePeople } from './common.jsx';
import PhotoViewer from './PhotoViewer.jsx';
import Composer from './chat/Composer.jsx';
import Message, { messageShows } from './chat/Message.jsx';
import { CommandNote } from './chat/Commands.jsx';
import { mentionPattern } from './chat/format.jsx';
import { EmojiManager, StickerManager } from './chat/Pickers.jsx';
import { ChannelDialog, ChannelIcon, MembersPanel, NewDmDialog, NotifyMenu, PinnedBar, PinsPanel, SearchPanel, slugChannel } from './chat/Panels.jsx';
import { Icon } from './shell/icons.jsx';
import { BotReplies, ChatAd, chatAdSpots, useAds } from './Ads.jsx';

const GROUP_MINUTES = 5;
const PAGE = 60;
const NONE = [];

// Messages by id, newest copy winning, oldest first.
function mergeMessages(a, b) {
  const byId = new Map(a.map((m) => [m.id, m]));
  for (const m of b) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.at - y.at);
}

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
            <span className="group-dm-icon">
              <Icon name="team" size={18} />
            </span>
          )
        ) : (
          <ChannelIcon conv={conv} />
        )}
        <span className="grow conv-name">{conv.kind === 'dm' ? conv.short : conv.name}</span>
        {unread?.muted && (
          <span className="muted tiny" title="Muted">
            <Icon name="bellOff" size={14} />
          </span>
        )}
        {unread?.count > 0 && !unread.muted && <span className={`unread${unread.mentions ? ' mention' : ''}`}>{unread.count}</span>}
      </button>
      {onSettings && (
        <button className="conv-gear" onClick={onSettings} title={`#${conv.name} settings`} aria-label={`#${conv.name} settings`}>
          <Icon name="more" size={16} />
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
  // Choosing messages to delete (Select on a message): their ids, or null.
  const [picks, setPicks] = useState(null);
  const [deleteAsk, setDeleteAsk] = useState(null); // the messages to delete, waiting for OK
  // A tapped message's buttons go away when you tap anything else: the text
  // box, a name or picture, the sidebar. Tapping another message moves them
  // there, and tapping the message itself again toggles them (its own click
  // does both).
  useEffect(() => {
    if (!selected) return;
    const away = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest('.msg-actions, .floating-picker, .picker-scrim')) return;
      // A tap on a message (this one, or another one that takes over) is left
      // to its own click: clearing now would move things (on phones the
      // buttons make room under the message) before the click lands.
      const inMsg = t.closest('.msg');
      if (inMsg && !t.closest('button, a, .avatar, .avatar-wrap, .msg-name, [role="button"], .spoiler')) return;
      setSelected(null);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [selected]);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  // Slash-command notes only you see, per conversation (gone on reload).
  const [notes, setNotes] = useState({});
  const [useCmd, setUseCmd] = useState(null);
  // Older pages of the conversation on screen. done: nothing older is left.
  const [older, setOlder] = useState({ key: current.key, msgs: [], done: false });
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
  // What's pinned here, newest first: the bar under the header and the count on the pin button.
  const [pins, setPins] = useState([]);
  const [pinAt, setPinAt] = useState(0);
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
    setOlder({ key: conv.key, msgs: [], done: false });
  }
  // The live window holds the newest PAGE messages, so as new ones come in the
  // oldest slide out of it. With older pages loaded, those are kept with the
  // pages, or they'd fall into a gap between the pages and the window.
  const live = messages[conv.key] || NONE;
  const [seenLive, setSeenLive] = useState({ key: conv.key, msgs: live });
  if (seenLive.key !== conv.key || seenLive.msgs !== live) {
    setSeenLive({ key: conv.key, msgs: live });
    if (seenLive.key === conv.key && older.key === conv.key && older.msgs.length && live.length >= PAGE) {
      const ids = new Set(live.map((m) => m.id));
      const slid = seenLive.msgs.filter((m) => !ids.has(m.id) && m.at < live[0].at);
      if (slid.length) setOlder((o) => (o.key === conv.key ? { ...o, msgs: mergeMessages(o.msgs, slid) } : o));
    }
  }
  // Older pages are fetched once, so they also get a live copy from the oldest
  // one loaded on: without it, pinning (or reacting to, or voting on) an older
  // message changed nothing on screen, and the pin button kept saying Pin.
  const oldestAt = older.key === conv.key && older.msgs.length ? older.msgs[0].at : null;
  const [since, setSince] = useState({ key: null, at: null, msgs: NONE });
  useEffect(() => {
    if (oldestAt == null) return;
    const key = conv.key;
    return api.subscribeSince(key, oldestAt, (msgs) => setSince({ key, at: oldestAt, msgs }));
  }, [api, conv.key, oldestAt]);
  const renameNow = usePeople()?.rename;
  // Older pages load here, so they get people's current names here too. A
  // message shows once: from the live window when it's there. Older ones the
  // window reaches again (after messages were removed for good) come from it,
  // and with the whole conversation in the window, the pages aren't needed.
  const all = useMemo(() => {
    const ids = new Set(live.map((m) => m.id));
    const fresh = since.key === conv.key && since.at === oldestAt ? new Map(since.msgs.map((m) => [m.id, m])) : null;
    const kept =
      older.key === conv.key && live.length >= PAGE
        ? older.msgs
            .filter((m) => !ids.has(m.id) && m.at < live[0].at)
            // The live copy wins; one it no longer has was removed for good.
            .flatMap((m) => (!fresh ? [m] : fresh.has(m.id) ? [fresh.get(m.id)] : []))
        : NONE;
    return [...kept, ...live].map((m) => (renameNow ? renameMessage(m, renameNow) : m));
  }, [older, live, since, oldestAt, conv.key, renameNow]);
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
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
  // The "New" line: above the first message that was unread when you opened
  // the conversation (read up to `since`, opened at `until`). Messages that
  // come in while you're here aren't "new" to you, and sending a message
  // clears the line. Taken while rendering, so the line and the jump use this
  // conversation's time right away (the parent marks it read right after).
  const opened = useRef({ key: null, since: 0, until: 0 });
  if (opened.current.key !== conv.key) opened.current = { key: conv.key, since: readAt[conv.key] ?? Date.now(), until: Date.now() };
  const lastMsg = all[all.length - 1];
  if (lastMsg && sentByMe(lastMsg, actor) && lastMsg.at > opened.current.until) opened.current.since = Infinity;
  const newSince = opened.current.since;
  const newUntil = opened.current.until;

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
    setPicks(null);
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
    } else if (atBottom.current || sentByMe(newest, actor)) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      setNewBelow(false);
    } else setNewBelow(true);
    if (pendingJump.current) jumpTo(pendingJump.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, actor]);

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
    const key = conv.key;
    const more = await api.loadOlderMessages(key, all[0].at);
    // A short page was the last one: the button goes away.
    setOlder((o) => (o.key === key ? { key, msgs: mergeMessages(more, o.msgs), done: more.length < PAGE } : o));
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

  useEffect(() => {
    setPins([]);
    setPinAt(0);
    if (!feat('pins')) return undefined;
    return api.subscribePins(conv.key, (rows) => setPins(rows.filter((m) => !m.deleted).sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, conv.key]);
  const myConvs = useMemo(() => [...convs.channels, ...convs.dms], [convs]);
  const canPost = conv.kind === 'dm' ? conv.mine : !conv.announce || isManager;
  const level = levelOf(conv);
  const memberNames = conv.kind === 'dm' ? conv.people : roster;
  let lastDay = '';
  let newShown = false;
  const myNotes = notes[conv.key] || NONE;
  const noteView = (n) => (
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
  );

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
                    {unread[c.key]?.count && !unread[c.key].muted ? ` (${unread[c.key].count})` : ''}
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
                  <Icon name="team" size={20} />
                )}{' '}
                <span className="chat-name">{conv.label}</span>
              </h2>
            ) : (
              <h2>
                <ChannelIcon conv={conv} />
                <span className="chat-name">{conv.name}</span>
              </h2>
            )}
            <span className="muted small chat-topic">
              {conv.kind === 'dm'
                ? conv.mine
                  ? 'Direct message'
                  : 'Viewing as team management (only the people in it can post)'
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
                    {pins.length > 0 && <span className="pin-count mono">{pins.length}</span>}
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
        {feat('pins') && pins.length > 0 && side !== 'pins' && (
          <PinnedBar
            pins={pins}
            at={Math.min(pinAt, pins.length - 1)}
            onJump={(m) => {
              jumpTo(m.id);
              setPinAt((i) => (pins.length > 1 ? (Math.min(i, pins.length - 1) + 1) % pins.length : 0));
            }}
            onAll={() => setSide('pins')}
          />
        )}
        <div className="msg-list" ref={list} onScroll={onScroll}>
          {/* Pretend ads, every N messages (Asher's Ads page). */}
          {live.length >= PAGE && !older.done && (
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
            const isNew = !newShown && m.at > newSince && m.at <= newUntil && !sentByMe(m, actor);
            if (isNew) newShown = true;
            const first =
              showDay ||
              isNew ||
              !prev ||
              prev.by !== m.by ||
              !!prev.bot !== !!m.bot ||
              m.at - prev.at > GROUP_MINUTES * 60000 ||
              !!m.replyTo ||
              !!m.poll;
            // Notes only you see go in time order with the messages.
            const notesHere = myNotes.filter((n) => n.at <= m.at && (!prev || n.at > prev.at));
            return (
              <div key={m.id} className={flash === m.id ? 'flash' : ''}>
                {notesHere.map(noteView)}
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
                  quoted={m.replyTo ? byId.get(m.replyTo.id) : null}
                  conv={conv.key}
                  ctx={ctx}
                  canPost={canPost}
                  first={first}
                  actor={actor}
                  isManager={isManager}
                  taskById={taskById}
                  selected={selected === m.id}
                  onSelect={setSelected}
                  picking={!!picks}
                  picked={!!picks?.has(m.id)}
                  onPick={(msg) =>
                    setPicks((cur) => {
                      const next = new Map(cur);
                      if (next.has(msg.id)) next.delete(msg.id);
                      else next.set(msg.id, msg);
                      return next;
                    })
                  }
                  onStartPick={(msg) => {
                    setSelected(null);
                    setPicks(new Map([[msg.id, msg]]));
                  }}
                  onAskDelete={(list) => {
                    setSelected(null);
                    setDeleteAsk(list);
                  }}
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
          {myNotes.filter((n) => !shownMessages.length || n.at > shownMessages[shownMessages.length - 1].at).map(noteView)}
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
        {deleteAsk && (
          <DeleteMessages
            msgs={deleteAsk}
            canErase={isManager}
            onClose={() => setDeleteAsk(null)}
            onDelete={async (hard) => {
              await api.deleteMessages(conv.key, deleteAsk, hard);
              // Older pages aren't live: show the change there too.
              const gone = new Set(deleteAsk.map((m) => m.id));
              setOlder((o) => ({
                ...o,
                msgs: hard
                  ? o.msgs.filter((m) => !gone.has(m.id))
                  : o.msgs.map((m) => (gone.has(m.id) ? { ...m, deleted: true, reactions: {}, supers: {}, pinned: false } : m)),
              }));
              setDeleteAsk(null);
              setPicks(null);
            }}
          />
        )}
        {picks ? (
          <div className="composer pick-bar">
            <b>
              {picks.size} selected
            </b>
            <span className="muted small grow">Tap messages to add or remove them.</span>
            <button className="btn" onClick={() => setPicks(null)}>
              Cancel
            </button>
            <button className="btn danger" disabled={!picks.size} onClick={() => setDeleteAsk([...picks.values()])}>
              <Icon name="trash" size={16} /> Delete
            </button>
          </div>
        ) : !canPost ? (
          <div className="composer read-only">
            {conv.kind === 'dm'
              ? 'You can read this DM because you’re on team management.'
              : 'Only team management can post announcements. You can still react.'}
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
            members={conv.kind === 'dm' ? conv.people : null}
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
                [conv.key]: [...(all[conv.key] || []).slice(-4), { ...n, id: `${Date.now()}-${Math.random()}`, at: Date.now() }],
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
        <PinsPanel conv={conv} api={api} ctx={ctx} canUnpin={canPost || isManager} onJump={(id) => openAt(conv.key, id)} onClose={() => setSide(null)} />
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

// Deleting one or more messages. Team management can remove them completely,
// with no "Message deleted" note left behind.
function DeleteMessages({ msgs, canErase, onClose, onDelete }) {
  const [erase, setErase] = useState(canErase);
  const [busy, setBusy] = useState(false);
  const n = msgs.length;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog delete-msgs" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Delete messages">
          <h2>{n === 1 ? 'Delete this message?' : `Delete ${n} messages?`}</h2>
          <p className="muted">
            {n === 1
              ? erase
                ? 'It’ll be gone for everyone, with nothing left in its place.'
                : 'It leaves a “Message deleted” note.'
              : erase
                ? 'They’ll be gone for everyone, with nothing left in their place.'
                : 'Each one leaves a “Message deleted” note.'}
          </p>
          {canErase && (
            <label className="row gap small">
              <input type="checkbox" checked={erase} onChange={(e) => setErase(e.target.checked)} /> Remove completely (no “Message deleted” note)
            </label>
          )}
          <div className="row gap">
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                // If it fails, the button works again (the error shows as a toast).
                try {
                  await onDelete(erase);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
