import { renameMessage, sentByMe } from '../people.js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SUBTEAMS, SUBTEAM_COLORS } from '../config.js';
import { useControls } from '../controls.js';
import { Avatar, Nameplate, Overlay, PlusIcon, usePeople } from './common.jsx';
import PhotoViewer from './PhotoViewer.jsx';
import Composer from './chat/Composer.jsx';
import Message, { messageShows } from './chat/Message.jsx';
import { CommandNote } from './chat/Commands.jsx';
import { mentionPattern } from './chat/format.jsx';
import { EmojiManager, StickerManager } from './chat/Pickers.jsx';
import { useDraftKeys } from '../drafts.js';
import { ChannelDialog, ChannelIcon, MembersPanel, NewDmDialog, NotifyMenu, PinnedBar, PinsPanel, SearchPanel, slugChannel } from './chat/Panels.jsx';
import { Icon } from './shell/icons.jsx';
import { BotReplies, ChatAd, chatAdSpots, useAds } from './Ads.jsx';
import GameView from './chat/GameView.jsx';
import { keepHeight } from './chat/keepHeight.js';
import { onOpenGameView } from './chat/liveGames.js';
import { MULTI, isLive } from '../../functions/shared/arcade.js';

const GROUP_MINUTES = 5;
const PAGE = 60;
// Within this many px of the bottom counts as at the bottom (new messages follow).
const BOTTOM_PX = 32;
// After a tap on a card, how long the list keeps still (ms).
const CARD_HOLD = 4000;
// And while that card is on screen and has something to tap, this long (ms):
// the next tap on it (a Report after a spin, a second Buy) lands where it was.
const TAP_HOLD = 20000;
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

// children: the "new messages" button while a game is played (see ChatView).
function TypingLine({ names, children }) {
  if (!names.length) return <div className="typing-line">{children}</div>;
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
      {children}
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
  // Channel requests: everyone else asks (null when switched off); team management sees what's waiting.
  onRequestChannel,
  chanWaiting = 0,
  onReviewChannels,
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
      // On a game card, after its click: the tile or button under the finger
      // is the one that gets the tap, and the card is held in place
      // (takeAnchor) while the buttons go away.
      if (t.closest('.cmd-card')) {
        let done = false;
        const clear = () => {
          if (done) return;
          done = true;
          setTimeout(() => setSelected(null), 0);
        };
        document.addEventListener('click', clear, { capture: true, once: true });
        setTimeout(clear, 800);
        return;
      }
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
  // How many messages came in below while you were scrolled up (0: none; the pill shows the count).
  const [newBelow, setNewBelow] = useState(0);
  // While a game is played the button sits in the line under the chat, not
  // over it: one popping up over the card would take the next tap.
  const [pillDocked, setPillDocked] = useState(false);
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
  const draftKeys = useDraftKeys();
  const [flash, setFlash] = useState(null);
  // What's pinned here, newest first: the bar under the header and the count on the pin button.
  const [pins, setPins] = useState([]);
  const [pinAt, setPinAt] = useState(0);
  const list = useRef(null);
  const atBottom = useRef(true);
  // No automatic scrolling while a finger is on the list (or its fling is
  // still going), for a few seconds after a tap on a card (playing a game), or
  // while the game view is open: then new messages only light up the pill.
  const hold = useRef({ touching: false, until: 0 });
  // The last card tapped: the control under the finger and its message.
  const tapped = useRef({ node: null, msg: null, at: 0 });
  const viewOpen = useRef(false);
  // What stays put when things change size (a game card growing, a photo
  // loading, a reaction above): the control you just tapped on a card, else a
  // game you're playing, else the message at the top of the list. The list
  // moves by as much as it did. (Done here rather than with CSS scroll
  // anchoring, which Safari doesn't have, and which would hold the top
  // message still while a card further down slid under your finger.)
  const anchor = useRef(null);
  // Set before the app scrolls the list itself, so onScroll can tell.
  const selfScroll = useRef(false);
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
  // pages, or they'd fall into a gap between the pages and the window. They're
  // kept too while you're scrolled up (what you're reading doesn't vanish), and
  // a game still being played always is (in a busy #arcade, a long Battleship
  // game used to drop out of the chat mid-game).
  const live = messages[conv.key] || NONE;
  const [seenLive, setSeenLive] = useState({ key: conv.key, msgs: live });
  if (seenLive.key !== conv.key || seenLive.msgs !== live) {
    setSeenLive({ key: conv.key, msgs: live });
    if (seenLive.key === conv.key && older.key === conv.key && live.length >= PAGE) {
      const ids = new Set(live.map((m) => m.id));
      const slid = seenLive.msgs.filter((m) => !ids.has(m.id) && m.at < live[0].at);
      const keep = older.msgs.length || !atBottom.current || slid.some((m) => MULTI.includes(m.cmd?.name) && isLive(m.cmd.status));
      if (slid.length && keep) setOlder((o) => (o.key === conv.key ? { ...o, msgs: mergeMessages(o.msgs, slid) } : o));
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

  // A card waiting for your tap (data-live on it, Commands.jsx), on screen:
  // a game you're playing or a request waiting on you; one anyone plays that
  // you've tapped; yours or one that invites a tap, for a while after it
  // showed up ('fresh', with something to tap); or any card you tapped in the
  // last TAP_HOLD. Not in its first moment, so a game you just started still
  // shows in full as it fills in.
  const liveCard = () => {
    const el = list.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const now = performance.now();
    const t = tapped.current;
    const onScreen = (c) => {
      const r = c.getBoundingClientRect();
      return r.bottom > box.top + 24 && r.top < box.bottom - 24;
    };
    const canTap = (c) => !!c.querySelector('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)');
    for (const c of el.querySelectorAll('.cmd-card[data-live]')) {
      const live = c.dataset.live;
      if (live === 'all' && !t.msg?.contains(c)) continue;
      if (now - Number(c.dataset.since || 0) < 600) continue;
      if (live === 'fresh' && !canTap(c)) continue;
      if (onScreen(c)) return c;
    }
    const last = t.msg?.isConnected && el.contains(t.msg) && now - t.at < TAP_HOLD ? t.msg.querySelector('.cmd-card') : null;
    return last && canTap(last) && onScreen(last) ? last : null;
  };
  // Hands off: while a game is being played on screen nothing follows new
  // messages (the pill counts them), however long you think between taps.
  const holding = () => viewOpen.current || hold.current.touching || performance.now() < hold.current.until || !!liveCard();
  const distance = (el) => el.scrollHeight - el.scrollTop - el.clientHeight;
  // why: 'anchor' when it only puts the anchor back (onScroll keeps it then).
  const setTop = (el, top, why = true) => {
    if (Math.abs(el.scrollTop - top) < 1) return;
    selfScroll.current = why;
    el.scrollTop = top;
  };
  const toBottom = (el) => {
    setTop(el, el.scrollHeight - el.clientHeight);
    atBottom.current = true;
    setNewBelow(0);
  };
  // Where the anchor (see above) is now.
  const takeAnchor = () => {
    const el = list.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const at = (node) => (node ? { node, off: node.getBoundingClientRect().top - top } : null);
    const t = tapped.current;
    if (performance.now() < hold.current.until && t.msg?.isConnected && el.contains(t.msg)) {
      anchor.current = { ...at(t.node?.isConnected && t.msg.contains(t.node) ? t.node : t.msg), back: at(t.msg) };
      return;
    }
    const game = liveCard();
    if (game) {
      anchor.current = at(game);
      return;
    }
    // The first message still showing at the top (its bottom below the list's top edge).
    const nodes = el.querySelectorAll('.msg[id]');
    let lo = 0;
    let hi = nodes.length - 1;
    let k = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nodes[mid].getBoundingClientRect().bottom > top) {
        k = mid;
        hi = mid - 1;
      } else lo = mid + 1;
    }
    anchor.current = k >= 0 ? at(nodes[k]) : null;
  };
  const keepAnchor = () => {
    const el = list.current;
    let a = anchor.current;
    // The tapped control is gone (the game ended): its message instead.
    if (a && !(a.node.isConnected && el?.contains(a.node))) a = a.back;
    if (!el || !a || !a.node.isConnected || !el.contains(a.node)) return takeAnchor();
    const moved = a.node.getBoundingClientRect().top - el.getBoundingClientRect().top - a.off;
    if (Math.abs(moved) >= 1) setTop(el, el.scrollTop + moved, 'anchor');
    // The anchor for the next change (it can be another one now). The same
    // one keeps where it should be, so moves under a pixel don't add up.
    const was = anchor.current;
    takeAnchor();
    if (was && anchor.current?.node === was.node) anchor.current = was;
  };
  // After anything changed size: at the bottom (and free to move), stay there;
  // otherwise keep what you're looking at where it is.
  const settle = () => {
    const el = list.current;
    if (!el) return;
    if (atBottom.current && !holding()) return toBottom(el);
    keepAnchor();
    // Only you going down (or the pill) makes it follow again.
    if (distance(el) >= BOTTOM_PX) atBottom.current = false;
  };

  // Opening a conversation: unread messages start at the red "New" line near
  // the top, so you read down from where you left off (like Discord).
  // Nothing new: the newest message, at the bottom.
  const showStart = () => {
    const el = list.current;
    if (!el) return;
    const sep = el.querySelector('.new-sep');
    if (sep) {
      selfScroll.current = true;
      scrollListTo(sep, 56);
      const below = distance(el) >= BOTTOM_PX;
      atBottom.current = !below;
      const unread = all.filter((m) => m.at > newSince && m.at <= newUntil && !sentByMe(m, actor)).length;
      setPillDocked(false);
      setNewBelow(below ? Math.max(1, unread) : 0);
    } else toBottom(el);
    takeAnchor();
  };

  useLayoutEffect(() => {
    setSelected(null);
    setPicks(null);
    setNewBelow(0);
    setNotifyOpen(false);
    setGameView(null);
    viewOpen.current = false;
    lastCount.current = all.length;
    lastNewest.current = all[all.length - 1]?.id ?? null;
    if (all.length) showStart();
    // Opened from search or a pin in another conversation: go to that message.
    if (pendingJump.current) jumpTo(pendingJump.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.key]);

  // Follow new messages only when you're at the bottom and not busy with
  // something (or when they're yours). Scrolled up, nothing moves: the pill
  // counts them. "New" means a different newest message: the live window is
  // capped at PAGE, so the count stays the same once a channel is busy.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const newest = all[all.length - 1];
    const firstLoad = lastCount.current === 0 && all.length > 0;
    const newestChanged = !!newest && newest.id !== lastNewest.current;
    const was = all.findIndex((m) => m.id === lastNewest.current);
    lastCount.current = all.length;
    lastNewest.current = newest?.id ?? null;
    // Messages arriving for a conversation that just opened empty.
    if (firstLoad) showStart();
    // Same messages, changed (an edit, a reaction, a game's move): stay put.
    else if (!newestChanged) settle();
    else if (sentByMe(newest, actor) && !viewOpen.current) {
      // You sent something: you're done with the card you were playing, and
      // the new one (a game you just started) shows in full as it fills in.
      hold.current.until = 0;
      toBottom(el);
    }
    else if (atBottom.current && !holding()) toBottom(el);
    else {
      keepAnchor();
      // Held still (a finger, a card, the game view): it didn't follow, so it
      // won't later either, until you go down (or tap the pill).
      // (Room for them below without moving: still at the bottom, no pill.)
      atBottom.current = distance(el) < BOTTOM_PX;
      const added = (was >= 0 ? all.slice(was + 1) : [newest]).filter((m) => !sentByMe(m, actor)).length;
      if (!atBottom.current && added) {
        // In the line under the chat while it's held (never over a card you
        // play), including when the hold starts after the button showed up.
        if (holding()) setPillDocked(true);
        else if (!newBelow) setPillDocked(false);
        setNewBelow((n) => n + added);
      }
    }
    if (pendingJump.current) jumpTo(pendingJump.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, actor]);

  // Things changing size later: photos, GIFs, and videos finishing loading, a
  // game card growing, the list getting shorter (a reply bar, the keyboard).
  // At the bottom, stay there; scrolled up, what you're looking at stays put.
  const sizes = useRef(null);
  useEffect(() => {
    const el = list.current;
    if (!el) return undefined;
    const fit = () => settle();
    el.addEventListener('load', fit, true);
    el.addEventListener('loadedmetadata', fit, true);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    sizes.current = ro;
    // A finger on the list: hands off until it lifts (and its fling stops).
    const down = () => (hold.current.touching = true);
    const up = () => {
      if (!hold.current.touching) return;
      hold.current.touching = false;
      hold.current.until = Math.max(hold.current.until, performance.now() + 350);
    };
    el.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', up, { passive: true });
    return () => {
      el.removeEventListener('load', fit, true);
      el.removeEventListener('loadedmetadata', fit, true);
      el.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Every message on screen is watched for size changes (observing one again is a no-op).
  useLayoutEffect(() => {
    const ro = sizes.current;
    if (!ro || !list.current) return;
    for (const node of list.current.children) ro.observe(node);
  });

  const onScroll = () => {
    const el = list.current;
    const mine = selfScroll.current;
    selfScroll.current = false;
    // Putting the anchor back leaves it where it should be (re-measuring
    // would keep the scroll's rounding, and those add up).
    if (mine !== 'anchor') takeAnchor();
    if (mine) return;
    atBottom.current = distance(el) < BOTTOM_PX;
    if (atBottom.current) setNewBelow(0);
    // A fling goes on after the finger lifts: wait for it to stop.
    if (!hold.current.touching) hold.current.until = Math.max(hold.current.until, performance.now() + 150);
  };
  // A tap on a game card (or any card): hands off for a few seconds.
  const onListPointerDown = (e) => {
    const cardEl = e.target.closest?.('.cmd-card');
    if (!cardEl) return;
    hold.current.until = Math.max(hold.current.until, performance.now() + CARD_HOLD);
    tapped.current = { node: e.target.closest('button, input, textarea, select, a') || cardEl, msg: cardEl.closest('.msg') || cardEl, at: performance.now() };
    // A game card you tap keeps at least its height until you leave it alone
    // for CARD_HOLD: a game that ends with the tap (a duel's shot, a request
    // paid) doesn't pull what's under it up under your finger.
    if (cardEl.matches('.cmd-arcade, .cmd-money, .cmd-card-request, .cmd-card-dailyq') && !e.target.closest('.card-actions')) keepHeight(cardEl, CARD_HOLD);
    setPillDocked(true);
    takeAnchor();
  };

  // The game view (GameView.jsx), opened from a card. The list stays exactly
  // where it was underneath, and is back there when it closes.
  const [gameView, setGameView] = useState(null);
  useEffect(
    () =>
      onOpenGameView((o) => {
        if (o.conv !== conv.key) return;
        takeAnchor();
        viewOpen.current = true;
        setGameView(o);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conv.key],
  );
  const closeGameView = useCallback(() => {
    setGameView(null);
    requestAnimationFrame(() => {
      viewOpen.current = false;
      const el = list.current;
      if (!el) return;
      keepAnchor();
      if (distance(el) >= BOTTOM_PX) atBottom.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    requestAnimationFrame(() => setTop(el, el.scrollHeight - before));
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

  const pill = newBelow > 0 && (
    <button
      className={`new-below${pillDocked ? ' docked' : ''}`}
      onClick={() => {
        hold.current.until = 0;
        toBottom(list.current);
      }}
    >
      {newBelow} new message{newBelow === 1 ? '' : 's'} ↓
    </button>
  );

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
  // A private channel team management isn't in: they can read it, not post.
  const canPost = conv.kind === 'dm' ? conv.mine : conv.private && !conv.mine ? false : !conv.announce || isManager;
  const level = levelOf(conv);
  const memberNames = conv.kind === 'dm' ? conv.people : conv.private ? conv.members : roster;
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
                  {c.private ? ' (private)' : ''}
                  {unread[c.key]?.count && !unread[c.key].muted ? ` (${unread[c.key].count})` : ''}
                  {draftKeys.has(c.key) && c.key !== conv.key ? ' · draft' : ''}
                </option>
              ))}
            </optgroup>
            {convs.dms.length > 0 && (
              <optgroup label="Direct messages">
                {convs.dms.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.short}
                    {unread[c.key]?.count && !unread[c.key].muted ? ` (${unread[c.key].count})` : ''}
                    {draftKeys.has(c.key) && c.key !== conv.key ? ' · draft' : ''}
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
            {isManager && convs.teamPrivate.length > 0 && (
              <optgroup label="Private channels (view only)">
                {convs.teamPrivate.map((c) => (
                  <option key={c.key} value={c.key}>
                    #{c.name}
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
          {isManager ? (
            <button
              className="btn chan-new"
              onClick={() => setDialog({ type: 'channel' })}
              aria-label={chanWaiting ? `New channel (${chanWaiting} requests waiting)` : 'New channel'}
              title="New channel"
            >
              <Icon name="plus" size={16} /> Channel
              {chanWaiting > 0 && <span className="sb-add-badge mono">{chanWaiting}</span>}
            </button>
          ) : (
            onRequestChannel && (
              <button className="btn chan-new" onClick={onRequestChannel} aria-label="Request a channel" title="Request a channel">
                <Icon name="plus" size={16} /> Channel
              </button>
            )
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
                : conv.private && !conv.mine
                  ? 'Private. Viewing as team management (only the people in it can post)'
                  : conv.topic ||
                    (conv.private
                      ? 'Private: only people invited can see this'
                      : conv.announce
                        ? 'Only team management posts here'
                        : conv.subteam
                          ? `${conv.subteam} subteam`
                          : 'The whole team')}
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
        <div className="msg-list" ref={list} onScroll={onScroll} onPointerDown={onListPointerDown}>
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
        {!pillDocked && pill}
        <TypingLine names={typing}>{pillDocked && pill}</TypingLine>
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
              : conv.private
                ? 'You can read this channel because you’re on team management. Only the people in it can post.'
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

      {gameView && <GameView conv={gameView.conv} m={gameView.m} api={api} actor={actor} onClose={closeGameView} />}
      {side === 'members' && <MembersPanel names={memberNames} onPerson={onPerson} onClose={() => setSide(null)} />}
      {side === 'pins' && feat('pins') && (
        <PinsPanel conv={conv} api={api} ctx={ctx} canUnpin={canPost || isManager} onJump={(id) => openAt(conv.key, id)} onClose={() => setSide(null)} />
      )}
      {side === 'search' && feat('search') && (
        <SearchPanel convs={myConvs} current={conv} api={api} roster={roster} onOpen={openAt} onClose={() => setSide(null)} />
      )}

      {dialog?.type === 'channel' && (
        <ChannelDialog
          waiting={dialog.channel ? 0 : chanWaiting}
          onReview={() => {
            setDialog(null);
            onReviewChannels?.();
          }}
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
