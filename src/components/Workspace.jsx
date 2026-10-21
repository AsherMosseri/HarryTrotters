import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHANNELS, COMPETITION, RENAMED, ROBOT_TAB_PEOPLE, ROSTER, STATUSES, SUBTEAMS, PRIORITIES, TEAM_NAME } from '../config.js';
import { ONLINE_MS, TYPING_MS, buildPeopleInfo, buildProfiles } from '../people.js';
import { PALETTES } from '../nitro.js';
import { daysBetween, todayISO } from '../milestones.js';
import { newTaskDefaults, personId } from '../data/diff.js';
import { preparePhoto, useLocalStorage } from '../util.js';
import { Avatar, PeopleContext, PlusIcon } from './common.jsx';
import { ProfileCard, ProfileEditor } from './People.jsx';
import TableView from './TableView.jsx';
import BoardView from './BoardView.jsx';
import TaskPanel from './TaskPanel.jsx';
import NewTaskDialog from './NewTaskDialog.jsx';
import MilestonesView from './MilestonesView.jsx';
import TeamView from './TeamView.jsx';
import PartsView from './PartsView.jsx';
import ChecklistsView from './ChecklistsView.jsx';
import CatParty from './CatParty.jsx';
import TrashDialog from './TrashDialog.jsx';
import RunsView from './RunsView.jsx';
import ChatView from './ChatView.jsx';
// The 3D viewer pulls in three.js, so it loads only when the Robot tab opens.
const RobotView = lazy(() => import('./RobotView.jsx'));
import { HelpDialog, WelcomeCard } from './Help.jsx';
import { VersionLogDialog, WhatsNew } from './VersionLog.jsx';
import { VERSION, versionsSince } from '../changelog.js';
import Inbox from './Inbox.jsx';

// Light / dark / automatic, plus the app color themes.
function ThemeMenu({ theme, setTheme, palette, setPalette, onClose }) {
  useEffect(() => {
    const away = (e) => !e.target.closest('.theme-wrap') && onClose();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  return (
    <div className="theme-menu" role="dialog" aria-label="Theme">
      <div className="segmented">
        {[
          ['light', '☀️ Light'],
          ['dark', '🌙 Dark'],
          ['system', 'Auto'],
        ].map(([id, label]) => (
          <button key={id} className={theme === id ? 'active' : ''} onClick={() => setTheme(id)}>
            {label}
          </button>
        ))}
      </div>
      <h4>Color theme</h4>
      <div className="palette-grid">
        {PALETTES.map((p) => (
          <button key={p.id} className={`palette${palette === p.id ? ' on' : ''}`} onClick={() => setPalette(p.id)}>
            <span className="palette-dot" style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }} />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeIcon({ theme }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
  };
  if (theme === 'dark')
    return (
      <svg {...common}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    );
  if (theme === 'light')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

function Countdown({ date }) {
  const left = daysBetween(todayISO(), date);
  if (left < 0) return null;
  return (
    <span className="countdown" title={`${COMPETITION.name}: ${date}`}>
      🏁{' '}
      {left === 0 ? (
        'Competition day!'
      ) : (
        <>
          <b>{left}</b>
          <span className="countdown-long"> day{left === 1 ? '' : 's'} to go</span>
          <span className="countdown-short">d</span>
        </>
      )}
    </span>
  );
}

const VIEWS = [
  ['board', 'Board'],
  ['table', 'Table'],
  ['chat', 'Chat'],
  ['milestones', 'Milestones'],
  ['parts', 'Parts'],
  ['checklists', 'Checklists'],
  ['runs', 'Match Log'],
  ['robot', 'Robot'],
  ['team', 'Team'],
];

function matchesFilters(t, filters, me, view) {
  const q = filters.q.trim().toLowerCase();
  const who = t.assignees || [];
  if (q && !`${t.title} ${t.description} ${t.subteam} ${who.join(' ')}`.toLowerCase().includes(q)) return false;
  if (filters.person === '__me' && !who.includes(me)) return false;
  if (filters.person === '__none' && who.length) return false;
  if (filters.person && !filters.person.startsWith('__') && !who.includes(filters.person)) return false;
  if (filters.subteam && t.subteam !== filters.subteam) return false;
  if (filters.priority && t.priority !== filters.priority) return false;
  if (filters.hideDone && t.status === 'done') return false;
  if (view === 'table' && filters.statuses.length && !filters.statuses.includes(t.status)) return false;
  return true;
}

const TRASH_DAYS = 30;
const CHAT_PAGE = 60;

const EMPTY_FILTERS = { q: '', person: '', subteam: '', priority: '', statuses: [], hideDone: false };

export default function Workspace({ store, actor, rename, renames }) {
  const [rawTasks, setRawTasks] = useState(null);
  const [people, setPeople] = useState([]);
  const [rawMilestones, setMilestones] = useState([]);
  const [roles, setRoles] = useState([]);
  const [parts, setParts] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [runs, setRuns] = useState([]);
  const [robot, setRobot] = useState({ versions: [], pins: [], layouts: [] });
  const [chat, setChat] = useState({}); // { [channelId]: newest messages }
  const [chatChannel, setChatChannel] = useLocalStorage('chat-channel', 'general');
  const [chatRead, setChatRead] = useLocalStorage('chat-read', null); // { [channelId]: ms read up to }
  const [settings, setSettings] = useState({});
  const [cat, setCat] = useState(false);
  const [welcomed, setWelcomed] = useLocalStorage('welcome-seen-v1', false);
  // "What's new" shows once per device after an update (not on a brand-new device).
  const [seenVersion, setSeenVersion] = useLocalStorage('seen-version', null);
  const [showLog, setShowLog] = useState(false);
  useEffect(() => {
    if (!welcomed && seenVersion !== VERSION) setSeenVersion(VERSION);
  }, [welcomed, seenVersion, setSeenVersion]);
  const whatsNew =
    welcomed && seenVersion && seenVersion !== VERSION ? versionsSince(seenVersion) : welcomed && !seenVersion ? versionsSince(null) : null;
  const [showHelp, setShowHelp] = useState(false);
  const [savedView, setView] = useLocalStorage('view', 'board');
  const showRobot = ROBOT_TAB_PEOPLE.includes(actor.name);
  const views = showRobot ? VIEWS : VIEWS.filter(([id]) => id !== 'robot');
  const view = views.some(([id]) => id === savedView) ? savedView : 'board';
  const taskView = view === 'board' || view === 'table';
  const tabsRef = useRef(null);
  // On narrow screens the tab strip scrolls sideways; keep the current tab visible.
  useEffect(() => {
    tabsRef.current?.querySelector('.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [view]);
  const [filters, setFilters] = useLocalStorage('filters', EMPTY_FILTERS);
  const [theme, setTheme] = useLocalStorage('theme', 'system');
  const [openId, setOpenId] = useState(null);
  const [newTask, setNewTask] = useState(null);
  const [toast, setToast] = useState(null); // { text, action?: { label, run } }
  const [tasksError, setTasksError] = useState('');

  const fail = useCallback((e) => {
    console.error(e);
    setToast({ text: e?.code === 'permission-denied' ? "You don't have permission to do that." : e?.message || 'Something went wrong.' });
  }, []);
  // Loading errors name what failed, so a screenshot tells us where to look.
  // Collects every part that failed to load into one message, so nothing is hidden.
  const loadFailures = useRef(new Map());
  const loadFail = useCallback(
    (what) => (e) => {
      console.error(what, e);
      const why =
        e?.code === 'permission-denied' ? 'the database rules need updating (ask team management)' : e?.message || 'unknown error';
      loadFailures.current.set(what, why);
      const byReason = new Map();
      for (const [name, reason] of loadFailures.current) byReason.set(reason, [...(byReason.get(reason) || []), name]);
      const text = [...byReason].map(([reason, names]) => `Couldn't load ${names.join(', ')}: ${reason}.`).join(' ');
      setToast({ text });
    },
    [],
  );

  useEffect(
    () =>
      store.subscribeTasks(
        (ts) => {
          setTasksError('');
          setRawTasks(ts);
        },
        (e) => {
          console.error('tasks', e);
          setTasksError(
            e?.code === 'permission-denied'
              ? "This device isn't allowed to read tasks. Tap Switch and join again."
              : e?.message || String(e),
          );
        },
      ),
    [store],
  );
  useEffect(() => store.subscribePeople(setPeople, loadFail('the team list')), [store, loadFail]);
  useEffect(() => store.subscribeMilestones(setMilestones, loadFail('milestones')), [store, loadFail]);
  useEffect(() => store.subscribeRoles(setRoles, loadFail('the org chart')), [store, loadFail]);
  useEffect(() => store.subscribeSettings(setSettings, loadFail('settings')), [store, loadFail]);
  useEffect(() => store.subscribeParts(setParts, loadFail('parts')), [store, loadFail]);
  useEffect(() => store.subscribeChecklists(setChecklists, loadFail('checklists')), [store, loadFail]);
  useEffect(() => store.subscribeRuns(setRuns, loadFail('the match log')), [store, loadFail]);
  useEffect(() => store.subscribeRobot(setRobot, loadFail('the robot')), [store, loadFail]);
  // Chat extras. Quiet on failure: the board works without them (e.g. before
  // the new rules are published).
  const quiet = useCallback((what) => (e) => console.warn(what, e), []);
  const [channelDocs, setChannelDocs] = useState([]);
  const [dmDocs, setDmDocs] = useState([]);
  const [profileDocs, setProfileDocs] = useState([]);
  const [presence, setPresence] = useState([]);
  const [teamEmoji, setTeamEmoji] = useState([]);
  const [stickers, setStickers] = useState([]);
  useEffect(() => store.subscribeChannels(setChannelDocs, quiet('channels')), [store, quiet]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => store.subscribeDms(actor, actor.admin, setDmDocs, quiet('dms')), [store, actor.name, actor.admin, quiet]);
  useEffect(() => store.subscribeProfiles(setProfileDocs, quiet('profiles')), [store, quiet]);
  useEffect(() => store.subscribePresence(setPresence, quiet('presence')), [store, quiet]);
  useEffect(() => store.subscribeEmoji(setTeamEmoji, quiet('emoji')), [store, quiet]);
  useEffect(() => store.subscribeStickers(setStickers, quiet('stickers')), [store, quiet]);
  const competitionDate = settings.competitionDate || COMPETITION.date;

  // Notifications: the bell's list, and phone notifications on this device.
  const [inbox, setInbox] = useState([]);
  const [pushStatus, setPushStatus] = useState(() => store.pushStatus());
  // Quiet if the rules for notifications aren't published yet: the bell just stays empty.
  useEffect(
    () =>
      store.subscribeInbox(actor.name, setInbox, (e) =>
        e?.code === 'permission-denied' ? console.warn('inbox', e) : loadFail('notifications')(e),
      ),
    [store, actor.name, loadFail],
  );
  useEffect(() => {
    store.refreshPush(actor).catch((e) => console.warn('push refresh', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, actor.uid, actor.name]);
  const inboxUnread = inbox.filter((n) => !n.read).length;
  // The red number on the Home Screen icon.
  useEffect(() => {
    if (!navigator.setAppBadge) return;
    (inboxUnread ? navigator.setAppBadge(inboxUnread) : navigator.clearAppBadge()).catch(() => {});
  }, [inboxUnread]);
  const enablePush = async () => {
    try {
      const status = await store.enablePush(actor);
      setPushStatus(status);
      if (status === 'on') setToast({ text: 'Notifications are on for this device.' });
    } catch (e) {
      console.error(e);
      setPushStatus(store.pushStatus());
      setToast({ text: `Couldn't turn on notifications: ${e?.message || e}` });
    }
  };
  const disablePush = async () => {
    try {
      setPushStatus(await store.disablePush());
    } catch (e) {
      fail(e);
    }
  };

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  // App color theme (per device), on top of light/dark.
  const [palette, setPalette] = useLocalStorage('palette', '');
  const [themeMenu, setThemeMenu] = useState(false);
  useEffect(() => {
    if (palette) document.documentElement.setAttribute('data-palette', palette);
    else document.documentElement.removeAttribute('data-palette');
  }, [palette]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Show everyone under their current name, even on tasks saved before a rename.
  const allTasks = useMemo(
    () =>
      rawTasks &&
      rawTasks.map((t) => (t.assignees?.some((n) => rename(n) !== n) ? { ...t, assignees: [...new Set(t.assignees.map(rename))] } : t)),
    [rawTasks, rename],
  );
  const tasks = useMemo(() => allTasks && allTasks.filter((t) => !t.deletedAt), [allTasks]);
  const trash = useMemo(() => (allTasks || []).filter((t) => t.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt), [allTasks]);
  const [showTrash, setShowTrash] = useState(false);

  // Tasks stay in Recently deleted for 30 days; a manager's device then removes them for good.
  const purged = useRef(new Set());
  useEffect(() => {
    if (!actor.admin) return;
    const cutoff = Date.now() - TRASH_DAYS * 86400000;
    for (const t of trash) {
      if (t.deletedAt < cutoff && !purged.current.has(t.id)) {
        purged.current.add(t.id);
        store.deleteTask(t.id, t.photos || []).catch((e) => console.warn('purge', e));
      }
    }
  }, [trash, actor.admin, store]);

  const milestones = useMemo(
    () => rawMilestones.map((m) => (m.owners?.some((n) => rename(n) !== n) ? { ...m, owners: [...new Set(m.owners.map(rename))] } : m)),
    [rawMilestones, rename],
  );

  // Default roster + people the manager added + anyone who joined under their
  // own name, minus people the manager removed.
  const roster = useMemo(() => {
    const removed = new Set(roles.filter((r) => r.removed).map((r) => rename(r.name)));
    const names = new Set(ROSTER.map(rename));
    for (const r of roles) if (r.name && !r.removed) names.add(rename(r.name));
    for (const p of people) if (p.name) names.add(rename(p.name));
    return [...names].filter((n) => !removed.has(n) || n === actor.name);
  }, [people, roles, actor.name, rename]);

  // Channels: the defaults in config.js, changed or added by team management.
  const convs = useMemo(() => {
    const docs = Object.fromEntries(channelDocs.map((d) => [d.id, d]));
    const merged = new Map(
      CHANNELS.map((c, i) => [c.id, { id: c.id, name: c.id, subteam: c.subteam, announce: !!c.announce, order: i, topic: '' }]),
    );
    for (const d of channelDocs)
      merged.set(d.id, { ...(merged.get(d.id) || { name: d.id, order: 99 }), ...d, announce: d.id === 'announcements' });
    const channels = [...merged.values()]
      .filter((c) => !c.deleted || c.id === 'announcements' || c.id === 'general')
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name))
      .map((c) => ({ ...c, key: c.id, kind: 'channel', label: `#${c.name}` }));
    const dms = dmDocs
      .map((d) => {
        const ppl = [...new Set((d.people || []).map(rename))];
        const others = ppl.filter((n) => n !== actor.name);
        const label = d.name || others.join(', ') || actor.name;
        const short = d.name || (others.length === 1 ? others[0] : others.map((n) => n.split(' ')[0]).join(', '));
        return { ...d, key: `dm:${d.id}`, kind: 'dm', people: ppl, label, short, mine: ppl.includes(actor.name) };
      })
      .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    return {
      channels,
      dms: dms.filter((d) => d.mine),
      teamDms: dms.filter((d) => !d.mine),
      allChannelIds: [...merged.keys(), ...Object.keys(docs)],
    };
  }, [channelDocs, dmDocs, rename, actor.name]);
  const allConvs = useMemo(() => [...convs.channels, ...convs.dms, ...convs.teamDms], [convs]);
  const currentConv = allConvs.find((c) => c.key === chatChannel) || convs.channels.find((c) => c.id === 'general') || convs.channels[0];

  // Live chat for every channel and my DMs (for unread counts), plus a team DM
  // being viewed.
  const liveKeys = useMemo(() => {
    const keys = [...convs.channels, ...convs.dms].map((c) => c.key);
    if (view === 'chat' && currentConv && !keys.includes(currentConv.key)) keys.push(currentConv.key);
    return keys.join('|');
  }, [convs, view, currentConv]);
  const chatSubs = useRef(new Map());
  useEffect(() => {
    const want = new Set(liveKeys.split('|').filter(Boolean));
    for (const [key, stop] of chatSubs.current)
      if (!want.has(key)) {
        stop();
        chatSubs.current.delete(key);
      }
    for (const key of want)
      if (!chatSubs.current.has(key))
        chatSubs.current.set(
          key,
          store.subscribeChannel(
            key,
            CHAT_PAGE,
            (msgs) => setChat((all) => ({ ...all, [key]: msgs })),
            key.startsWith('dm:') ? quiet('dm') : loadFail('chat'),
          ),
        );
  }, [liveKeys, store, loadFail, quiet]);
  useEffect(() => () => chatSubs.current.forEach((stop) => stop()), []);

  // People: pictures, statuses, org info, and who's online (rechecked every 30 s).
  const profiles = useMemo(() => buildProfiles(profileDocs, rename), [profileDocs, rename]);
  const peopleInfo = useMemo(() => buildPeopleInfo(roster, roles, rename), [roster, roles, rename]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), view === 'chat' ? 2000 : 30000);
    return () => clearInterval(t);
  }, [view]);
  const online = useMemo(() => {
    const out = new Set();
    for (const p of presence) if (p.name && (p.at || 0) > now - ONLINE_MS) out.add(rename(p.name));
    out.add(actor.name);
    return out;
  }, [presence, now, rename, actor.name]);
  const typingIn = useCallback(
    (key) => [
      ...new Set(
        presence
          .filter((p) => p.typing === key && (p.typingAt || 0) > now - TYPING_MS && rename(p.name || '') !== actor.name)
          .map((p) => rename(p.name)),
      ),
    ],
    [presence, now, rename, actor.name],
  );
  const [profileFor, setProfileFor] = useState(null);
  const [editProfileFor, setEditProfileFor] = useState(null);
  const peopleCtx = useMemo(
    () => ({
      photoOf: (name) => profiles.get(name)?.photo?.url || '',
      profileOf: (name) => profiles.get(name),
      isOnline: (name) => online.has(name),
      infoOf: (name) => peopleInfo.get(name) || { subteams: [], responsibilities: [], title: '', color: '' },
    }),
    [profiles, online, peopleInfo],
  );
  const openPerson = useCallback((name) => setProfileFor(name), []);

  // Heartbeat: this device is online while the app is open and visible.
  useEffect(() => {
    const beat = () => store.setPresence(actor, { at: document.visibilityState === 'visible' ? Date.now() : 0 }).catch(() => {});
    beat();
    const t = setInterval(() => document.visibilityState === 'visible' && beat(), 60000);
    document.addEventListener('visibilitychange', beat);
    window.addEventListener('pagehide', beat);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', beat);
      window.removeEventListener('pagehide', beat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, actor.uid, actor.name]);

  // Notification settings per conversation (announcements and DMs default to all).
  const levelOf = useCallback(
    (c) => {
      const saved = profiles.get(actor.name)?.notify?.[c.key];
      const fallback = c.kind === 'dm' || c.announce ? 'all' : 'mentions';
      return { value: saved || fallback, isDefault: !saved || saved === fallback };
    },
    [profiles, actor.name],
  );

  // The rules recognize renamed people through settings/names, so make sure
  // the renames built into config.js are there too.
  useEffect(() => {
    if (!actor.admin || store.mode === 'demo') return;
    const missing = Object.entries(RENAMED).filter(([from]) => !(from in (renames || {})));
    if (missing.length) store.mergeRenames(Object.fromEntries(missing)).catch((e) => console.warn('renames', e));
  }, [actor.admin, renames, store]);

  // Unread chat: other people's messages newer than what this device has read.
  // On first use everything already there counts as read.
  useEffect(() => {
    // First use, or a channel added since: start it as "read up to now". A new
    // DM starts unread, so its first message shows up.
    const keys = [...convs.channels, ...convs.dms];
    if (chatRead === null) setChatRead(Object.fromEntries(keys.map((c) => [c.key, c.kind === 'dm' ? (c.createdAt || 1) - 1 : Date.now()])));
    else if (keys.some((c) => !(c.key in chatRead))) {
      setChatRead({ ...Object.fromEntries(keys.map((c) => [c.key, c.kind === 'dm' ? (c.createdAt || 1) - 1 : Date.now()])), ...chatRead });
    }
  }, [chatRead, setChatRead, convs]);
  const unread = useMemo(() => {
    const out = {};
    const myRoles = peopleInfo.get(actor.name)?.subteams || [];
    for (const c of [...convs.channels, ...convs.dms]) {
      const since = chatRead?.[c.key] ?? Date.now();
      const fresh = (chat[c.key] || []).filter((m) => m.at > since && m.byUid !== actor.uid && !m.deleted);
      // Announcements and DMs always count as important (red), like a mention.
      const important =
        c.announce || c.kind === 'dm'
          ? fresh.length
          : fresh.filter((m) => (m.mentions || []).includes(actor.name) || m.everyone || (m.roles || []).some((r) => myRoles.includes(r)))
              .length;
      const muted = levelOf(c).value === 'none';
      out[c.key] = { count: fresh.length, mentions: important, muted };
    }
    return out;
  }, [chat, chatRead, actor.uid, actor.name, convs, levelOf, peopleInfo]);
  // Muted conversations don't count toward the Chat tab badge (mentions still do).
  const unreadTotal = Object.values(unread).reduce((s, u) => s + (u.muted ? u.mentions : u.count), 0);
  // Newest unread announcement from someone else, shown as a banner on the board.
  const announcement = useMemo(() => {
    const since = chatRead?.announcements ?? Date.now();
    const fresh = (chat.announcements || []).filter((m) => m.at > since && m.byUid !== actor.uid && !m.deleted);
    return fresh[fresh.length - 1] || null;
  }, [chat, chatRead, actor.uid]);
  const unreadMentions = Object.values(unread).reduce((s, u) => s + u.mentions, 0);

  // Mark the open channel read while it's on screen.
  useEffect(() => {
    if (view !== 'chat' || !chatRead) return;
    const markRead = () => {
      if (document.visibilityState !== 'visible') return;
      const key = currentConv?.key;
      const msgs = chat[key] || [];
      const newest = msgs.length ? msgs[msgs.length - 1].at : 0;
      if (key && newest > (chatRead[key] || 0)) setChatRead({ ...chatRead, [key]: newest });
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [view, chat, currentConv, chatRead, setChatRead]);

  // Lets api.create see the current filters without rebuilding api on every change.
  const filterState = useRef();
  filterState.current = { filters, view, taskView };
  const tasksRef = useRef(allTasks);
  tasksRef.current = allTasks;
  const dmsRef = useRef(dmDocs);
  dmsRef.current = dmDocs;
  const typingSent = useRef(0);
  const milestonesRef = useRef(milestones);
  milestonesRef.current = milestones;

  // Store calls wrapped with the signed-in person and error reporting.
  const api = useMemo(
    () => ({
      create: async (data) => {
        try {
          await store.createTask(data, actor);
        } catch (e) {
          return fail(e);
        }
        // A new task that the current filters hide looks like it never saved.
        const { filters: f, view: v, taskView: onTasks } = filterState.current;
        if (onTasks && !matchesFilters(newTaskDefaults(data), f, actor.name, v)) {
          setToast({
            text: 'Task added, but your filters are hiding it.',
            action: { label: 'Clear filters', run: () => setFilters(EMPTY_FILTERS) },
          });
        }
      },
      update: (task, patch) => store.updateTask(task.id, patch, actor, task).catch(fail),
      remove: async (task) => {
        try {
          await store.trashTask(task.id, actor);
        } catch (e) {
          return fail(e);
        }
        setToast({
          text: `Deleted “${task.title || 'Untitled'}”.`,
          action: { label: 'Undo', run: () => store.trashTask(task.id, actor, true).catch(fail) },
        });
      },
      restore: (task) => store.trashTask(task.id, actor, true).catch(fail),
      deleteForever: (task) => store.deleteTask(task.id, task.photos || []).catch(fail),
      addPhoto: async (task, file) => {
        try {
          await store.addTaskPhoto(task.id, await preparePhoto(file), actor);
        } catch (e) {
          fail(
            e?.code === 'storage/unauthorized'
              ? { message: 'Photo upload was blocked. The photo storage rules may need setting up (ask team management).' }
              : e,
          );
        }
      },
      removePhoto: (task, photo) => store.removeTaskPhoto(task.id, photo, actor).catch(fail),
      comment: (task, text) => store.addComment(task.id, text, actor).catch(fail),
      subscribeActivity: (id, cb) => store.subscribeActivity(id, cb, fail),
      createMilestone: (data) => store.createMilestone(data, actor).catch(fail),
      updateMilestone: (m, patch) => store.updateMilestone(m.id, patch, actor).catch(fail),
      deleteMilestone: (m, linked) =>
        store
          .deleteMilestone(
            m.id,
            linked.map((t) => t.id),
          )
          .catch(fail),
      saveRole: (data) => store.saveRole(personId(data.name), data, actor).catch(fail),
      renamePerson: (oldName, newName, role) => {
        // Point earlier names for this person at the new one too.
        const updated = Object.fromEntries(Object.entries(renames).map(([from, to]) => [from, to === oldName ? newName : to]));
        return store
          .renamePerson(
            oldName,
            newName,
            {
              renames: { ...updated, [oldName]: newName },
              tasks: (tasksRef.current || []).filter((t) => t.assignees?.includes(oldName)),
              milestones: milestonesRef.current.filter((m) => m.owners?.includes(oldName)),
              role,
              dms: dmsRef.current.filter((d) => d.people?.includes(oldName)),
            },
            actor,
          )
          .catch(fail);
      },
      saveSettings: (patch) => store.saveSettings(patch, actor).catch(fail),
      createPart: (data) => store.createPart(data, actor).catch(fail),
      updatePart: (p, patch) => store.updatePart(p.id, patch, actor).catch(fail),
      deletePart: (p) => store.deletePart(p.id).catch(fail),
      createChecklist: (data) => store.createChecklist(data, actor).catch(fail),
      renameChecklist: (list, title) => store.renameChecklist(list.id, title).catch(fail),
      setChecklistItem: (list, item) => store.setChecklistItem(list.id, item).catch(fail),
      toggleChecklistItem: (list, item, done) =>
        store
          .patchChecklistItems(list.id, { [item.id]: { done, doneBy: done ? actor.name : '', doneAt: done ? Date.now() : null } })
          .catch(fail),
      uncheckAll: (list, items) =>
        store
          .patchChecklistItems(list.id, Object.fromEntries(items.map((i) => [i.id, { done: false, doneBy: '', doneAt: null }])))
          .catch(fail),
      removeChecklistItem: (list, item) => store.removeChecklistItem(list.id, item.id).catch(fail),
      deleteChecklist: (list) => store.deleteChecklist(list.id).catch(fail),
      createRun: (data) => store.createRun(data, actor).catch(fail),
      uploadRobotVersion: (file, meta, onProgress) =>
        store.uploadRobotVersion(file, meta, actor, onProgress).catch((e) => {
          fail(
            e?.code === 'storage/unauthorized'
              ? { message: 'Upload was blocked. The Storage rules may need updating (ask team management).' }
              : e,
          );
          return false;
        }),
      deleteRobotVersion: (v, pins, layouts) => store.deleteRobotVersion(v, pins, layouts).catch(fail),
      createRobotPin: (data) => store.createRobotPin(data, actor).catch(fail),
      updateRobotPin: (id, patch) => store.updateRobotPin(id, patch).catch(fail),
      deleteRobotPin: (id) => store.deleteRobotPin(id).catch(fail),
      saveRobotLayout: (data) => store.saveRobotLayout(data, actor).catch(fail),
      deleteRobotLayout: (id) => store.deleteRobotLayout(id).catch(fail),
      sendMessage: (conv, data, photoFiles) => {
        store.setPresence(actor, { typing: '', typingAt: 0 }).catch(() => {});
        typingSent.current = 0;
        return store.sendMessage(conv, data, actor, photoFiles).catch(fail);
      },
      // "Typing…": at most one write every 3 seconds.
      typing: (conv) => {
        if (Date.now() - typingSent.current < 3000) return;
        typingSent.current = Date.now();
        store.setPresence(actor, { typing: conv, typingAt: Date.now(), at: Date.now() }).catch(() => {});
      },
      vote: (conv, msg, optionId, on) => store.vote(conv, msg, optionId, actor, on).catch(fail),
      pin: (conv, id, on) => store.pin(conv, id, on, actor).catch(fail),
      subscribePins: (conv, cb) => store.subscribePins(conv, cb, fail),
      hidePreview: (conv, id) => store.hidePreview(conv, id).catch(fail),
      recentMessages: (conv, count) =>
        store.recentMessages(conv, count).catch((e) => {
          console.warn('search', conv, e);
          return [];
        }),
      saveChannel: (id, data) => store.saveChannel(id, data, actor).catch(fail),
      openDm: (names, name) => store.openDm(names, actor, name).catch((e) => (fail(e), null)),
      saveProfile: (name, patch) => store.saveProfile(name, patch).catch(fail),
      uploadAvatar: (name, blob, oldPath) => store.uploadAvatar(name, blob, oldPath).catch(fail),
      removeAvatar: (name, oldPath) => store.removeAvatar(name, oldPath).catch(fail),
      addEmoji: (name, file) => store.addEmoji(name, file, actor),
      deleteEmoji: (e) => store.deleteEmoji(e).catch(fail),
      addSticker: (name, file) => store.addSticker(name, file, actor),
      deleteSticker: (st) => store.deleteSticker(st).catch(fail),
      superReact: (conv, id, emoji, on) => store.superReact(conv, id, emoji, actor, on).catch(fail),
      uploadChatFile: (conv, file, onProgress) =>
        store.uploadChatFile(conv, file, onProgress).catch((e) => {
          fail(e?.code === 'storage/unauthorized' ? { message: "Couldn't upload that file (25 MB max)." } : e);
          return null;
        }),
      uploadBanner: (name, blob, oldPath) => store.uploadBanner(name, blob, oldPath),
      removeBanner: (name, oldPath) => store.removeBanner(name, oldPath).catch(fail),
      editMessage: (channel, id, patch) => store.editMessage(channel, id, patch).catch(fail),
      uploadChatGif: (channel, file) => store.uploadChatGif(channel, file).catch((e) => (fail(e), null)),
      deleteMessage: (channel, m) => store.deleteMessage(channel, m).catch(fail),
      react: (channel, id, emoji, on) => store.react(channel, id, emoji, actor, on).catch(fail),
      removeReaction: (channel, id, emoji) => store.removeReaction(channel, id, emoji).catch(fail),
      loadOlderMessages: (channel, beforeAt) =>
        store.loadOlderMessages(channel, beforeAt, CHAT_PAGE).catch((e) => {
          fail(e);
          return [];
        }),
      updateRun: (r, patch) => store.updateRun(r.id, patch, actor).catch(fail),
      deleteRun: (r) => store.deleteRun(r.id).catch(fail),
    }),
    [store, actor, fail, setFilters, renames],
  );

  const filtered = useMemo(
    () => (tasks || []).filter((t) => matchesFilters(t, filters, actor.name, view)),
    [tasks, filters, actor.name, view],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s.id, 0]));
    for (const t of tasks || []) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [tasks]);

  const openTask = tasks?.find((t) => t.id === openId) || null;

  // Where a notification points: 'task:<id>', 'chat:<channel>', or 'view:<tab>'.
  const liveTasks = useRef(tasks);
  liveTasks.current = tasks;
  const goTo = useCallback(
    (target) => {
      const [kind, id] = (target || '').split(/:(.*)/s);
      if (kind === 'task') {
        if (liveTasks.current && !liveTasks.current.some((t) => t.id === id)) setToast({ text: 'That task was deleted.' });
        else setOpenId(id);
      } else if (kind === 'chat') {
        setChatChannel(id);
        setView('chat');
      } else if (kind === 'view') setView(id);
    },
    [setChatChannel, setView],
  );
  // Tapped a phone notification: it opens the site with ?open=…, or messages an open tab.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const target = params.get('open');
    if (target) {
      goTo(target);
      const rest = location.search
        .slice(1)
        .split('&')
        .filter((p) => p && !p.startsWith('open='))
        .join('&');
      history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`);
    }
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e) => e.data?.type === 'open' && goTo(e.data.open);
    sw.addEventListener('message', onMessage);
    sw.startMessages?.();
    return () => sw.removeEventListener('message', onMessage);
  }, [goTo]);
  const setF = (patch) => setFilters({ ...EMPTY_FILTERS, ...filters, ...patch });
  const anyFilter = filters.q || filters.person || filters.subteam || filters.priority || filters.statuses.length || filters.hideDone;

  return (
    <PeopleContext.Provider value={peopleCtx}>
      <div className={`app${view === 'chat' || view === 'robot' ? ' chat-mode' : ''}`}>
        {store.mode === 'demo' && (
          <div className="demo-banner">
            Demo mode — sample data saved only in this browser. <a href="./">Go to the real board</a>
          </div>
        )}
        <header className="topbar">
          <button className="brand" onClick={() => setCat(true)}>
            <span className="logo-mark">✓</span>
            <span className="brand-text">
              {TEAM_NAME} <span className="muted">Tasks</span>
            </span>
          </button>
          <nav className="tabs" role="tablist" ref={tabsRef}>
            {views.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
                {label}
                {id === 'chat' && unreadTotal > 0 && (
                  <span className={`tab-badge${unreadMentions ? ' mention' : ''}`} aria-label={`${unreadTotal} unread`}>
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="topbar-right">
            <Countdown date={competitionDate} />
            <Inbox
              items={inbox}
              pushStatus={pushStatus}
              onEnablePush={enablePush}
              onDisablePush={disablePush}
              onOpen={goTo}
              onMarkRead={(ids) => store.markInboxRead(actor.name, ids).catch(fail)}
              onClear={(ids) => store.clearInbox(actor.name, ids).catch(fail)}
            />
            <button className="icon-btn help-btn" title="Help" aria-label="Help" onClick={() => setShowHelp(true)}>
              ?
            </button>
            <span className="theme-wrap">
              <button
                className={`icon-btn${themeMenu ? ' on' : ''}`}
                title="Theme"
                aria-label="Theme"
                onClick={() => setThemeMenu(!themeMenu)}
              >
                <ThemeIcon theme={theme} />
              </button>
              {themeMenu && (
                <ThemeMenu
                  theme={theme}
                  setTheme={setTheme}
                  palette={palette}
                  setPalette={setPalette}
                  onClose={() => setThemeMenu(false)}
                />
              )}
            </span>
            <div className="user-chip">
              <button className="avatar-btn" onClick={() => setProfileFor(actor.name)} title="Your profile" aria-label="Your profile">
                <Avatar name={actor.name} size={30} />
              </button>
              <span className="user-name">{actor.name.split(' ')[0]}</span>
              <button
                className="link-btn"
                title="Not you? Switch to a different name (needs the team code again)"
                onClick={() => confirm('Switch user? You will need the team code again on this device.') && store.leave()}
              >
                Switch
              </button>
            </div>
          </div>
        </header>

        {taskView && announcement && (
          <div className="announce-banner" role="status">
            <span className="announce-icon">📣</span>
            <div className="grow">
              <b>{announcement.by.split(' ')[0]}:</b> {announcement.text || (announcement.gif ? 'sent a GIF' : 'shared a photo')}
            </div>
            <button
              className="btn small-btn"
              onClick={() => {
                setChatChannel('announcements');
                setView('chat');
              }}
            >
              Open
            </button>
            <button
              className="icon-btn small"
              aria-label="Dismiss"
              onClick={() => setChatRead({ ...chatRead, announcements: announcement.at })}
            >
              ✕
            </button>
          </div>
        )}

        {taskView && (
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Search tasks…"
              value={filters.q}
              onChange={(e) => setF({ q: e.target.value })}
            />
            <div className="filters">
              <button
                className={`chip${filters.person === '__me' ? ' on' : ''}`}
                onClick={() => setF({ person: filters.person === '__me' ? '' : '__me' })}
              >
                My tasks
              </button>
              <select className="filter" value={filters.person} onChange={(e) => setF({ person: e.target.value })} aria-label="Person">
                <option value="">Everyone</option>
                <option value="__me">Me ({actor.name.split(' ')[0]})</option>
                <option value="__none">Unassigned</option>
                {roster.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select className="filter" value={filters.subteam} onChange={(e) => setF({ subteam: e.target.value })} aria-label="Subteam">
                <option value="">All subteams</option>
                {SUBTEAMS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                className="filter"
                value={filters.priority}
                onChange={(e) => setF({ priority: e.target.value })}
                aria-label="Priority"
              >
                <option value="">Any priority</option>
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button className={`chip${filters.hideDone ? ' on' : ''}`} onClick={() => setF({ hideDone: !filters.hideDone })}>
                Hide done
              </button>
              {anyFilter ? (
                <button className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear
                </button>
              ) : null}
              {trash.length > 0 && (
                <button className="chip trash-chip" onClick={() => setShowTrash(true)}>
                  🗑 Recently deleted ({trash.length})
                </button>
              )}
            </div>
            <span className="spacer" />
            <button className="btn primary" onClick={() => setNewTask({ status: 'todo' })}>
              <PlusIcon /> New task
            </button>
          </div>
        )}

        {view === 'table' && (
          <div className="status-strip">
            {STATUSES.map((s) => {
              const on = filters.statuses.includes(s.id);
              return (
                <button
                  key={s.id}
                  className={`status-count${on ? ' on' : ''}`}
                  style={{ '--c': s.color }}
                  onClick={() => setF({ statuses: on ? filters.statuses.filter((x) => x !== s.id) : [...filters.statuses, s.id] })}
                >
                  <span className="dot" />
                  {s.short || s.label}
                  <strong>{counts[s.id]}</strong>
                </button>
              );
            })}
          </div>
        )}

        {tasks === null ? (
          <main className="content">
            {tasksError ? (
              <div className="empty-card">
                <h2>Couldn't load tasks</h2>
                <p className="muted">{tasksError}</p>
                <button className="btn primary" onClick={() => location.reload()}>
                  Reload
                </button>
              </div>
            ) : (
              <p className="empty">Loading…</p>
            )}
          </main>
        ) : view === 'milestones' ? (
          <MilestonesView
            milestones={milestones}
            competitionDate={competitionDate}
            isManager={actor.admin}
            tasks={tasks}
            roster={roster}
            api={api}
            onOpenTask={setOpenId}
            onAddTask={(m) => setNewTask({ status: 'todo', milestoneId: m.id, subteam: m.subteam || '' })}
          />
        ) : view === 'parts' ? (
          <PartsView parts={parts} tasks={tasks} api={api} onOpenTask={setOpenId} />
        ) : view === 'checklists' ? (
          <ChecklistsView checklists={checklists} api={api} isManager={actor.admin} />
        ) : view === 'chat' ? (
          <ChatView
            convs={convs}
            current={currentConv}
            setCurrent={setChatChannel}
            messages={chat}
            unread={unread}
            readAt={chatRead || {}}
            actor={actor}
            isManager={actor.admin}
            roster={roster}
            tasks={tasks}
            api={api}
            teamEmoji={teamEmoji}
            stickers={stickers}
            typing={typingIn(currentConv.key)}
            levelOf={levelOf}
            setLevel={(c, v) => api.saveProfile(actor.name, { notify: { [c.key]: v } })}
            onPerson={openPerson}
            onOpenTask={setOpenId}
            onMakeTask={(m, c) =>
              setNewTask({
                status: 'todo',
                subteam: c.subteam || '',
                title: (m.text || m.poll?.question || 'Follow up on chat photo').replace(/\s+/g, ' ').slice(0, 90),
                description: `From ${c.label}, ${m.by}: ${m.text || m.poll?.question || '(photo)'}`,
              })
            }
          />
        ) : view === 'robot' ? (
          <Suspense
            fallback={
              <main className="content">
                <p className="empty">Loading the 3D viewer…</p>
              </main>
            }
          >
            <RobotView
              robot={robot}
              tasks={tasks}
              parts={parts}
              actor={actor}
              isManager={actor.admin}
              api={api}
              theme={theme}
              onOpenTask={setOpenId}
              onMakeTask={(data) => setNewTask({ status: 'todo', ...data })}
            />
          </Suspense>
        ) : view === 'runs' ? (
          <RunsView runs={runs} roster={roster} api={api} />
        ) : view === 'team' ? (
          <TeamView roster={roster} roles={roles} tasks={tasks} api={api} isManager={actor.admin} rename={rename} />
        ) : (
          <main className="content">
            {view === 'table' ? (
              <TableView tasks={filtered} api={api} onOpen={setOpenId} total={tasks.length} />
            ) : (
              <BoardView tasks={filtered} milestones={milestones} api={api} onOpen={setOpenId} onAdd={(status) => setNewTask({ status })} />
            )}
          </main>
        )}

        {openTask && (
          <TaskPanel task={openTask} api={api} roster={roster} milestones={milestones} parts={parts} onClose={() => setOpenId(null)} />
        )}
        {newTask && (
          <NewTaskDialog
            initial={newTask}
            roster={roster}
            milestones={milestones}
            me={actor.name}
            onClose={() => setNewTask(null)}
            onCreate={async (data) => {
              setNewTask(null);
              await api.create(data);
            }}
          />
        )}
        {showTrash && <TrashDialog trash={trash} days={TRASH_DAYS} isManager={actor.admin} api={api} onClose={() => setShowTrash(false)} />}
        {!welcomed && (
          <WelcomeCard
            name={actor.name}
            showRobot={showRobot}
            pushStatus={pushStatus}
            onEnablePush={enablePush}
            onClose={() => setWelcomed(true)}
          />
        )}
        {showHelp && (
          <HelpDialog
            isManager={actor.admin}
            showRobot={showRobot}
            onClose={() => setShowHelp(false)}
            onVersionLog={() => {
              setShowHelp(false);
              setShowLog(true);
            }}
          />
        )}
        {whatsNew?.length > 0 && !showLog && (
          <WhatsNew
            versions={whatsNew}
            onClose={() => setSeenVersion(VERSION)}
            onFullLog={() => {
              setSeenVersion(VERSION);
              setShowLog(true);
            }}
          />
        )}
        {showLog && <VersionLogDialog current={VERSION} onClose={() => setShowLog(false)} />}
        {cat && <CatParty onClose={() => setCat(false)} />}
        {toast && (
          <div className="toast" role="alert" onClick={() => setToast(null)}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                className="toast-action"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.action.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
        {profileFor && (
          <ProfileCard
            name={profileFor}
            actor={actor}
            tasks={tasks || []}
            onClose={() => setProfileFor(null)}
            onEdit={() => {
              setEditProfileFor(profileFor);
              setProfileFor(null);
            }}
            onMessage={async () => {
              const key = await api.openDm([actor.name, profileFor]);
              setProfileFor(null);
              if (key) {
                setChatChannel(key);
                setView('chat');
              }
            }}
          />
        )}
        {editProfileFor && (
          <ProfileEditor name={editProfileFor} actor={actor} api={api} tasks={tasks || []} onClose={() => setEditProfileFor(null)} />
        )}
      </div>
    </PeopleContext.Provider>
  );
}
