import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHANNELS, COMPETITION, ROBOT_TAB_PEOPLE, ROSTER, STATUSES, SUBTEAMS, PRIORITIES, TEAM_NAME } from '../config.js';
import { daysBetween, todayISO } from '../milestones.js';
import { newTaskDefaults, personId } from '../data/diff.js';
import { preparePhoto, useLocalStorage } from '../util.js';
import { Avatar, PlusIcon } from './common.jsx';
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
import Inbox from './Inbox.jsx';

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
  useEffect(() => {
    const stops = CHANNELS.map((c) =>
      store.subscribeChannel(c.id, CHAT_PAGE, (msgs) => setChat((all) => ({ ...all, [c.id]: msgs })), loadFail('chat')),
    );
    return () => stops.forEach((stop) => stop());
  }, [store, loadFail]);
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
  }, [store, actor]);
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

  // Unread chat: other people's messages newer than what this device has read.
  // On first use everything already there counts as read.
  useEffect(() => {
    // First use, or a channel added since: start it as "read up to now".
    if (chatRead === null) setChatRead(Object.fromEntries(CHANNELS.map((c) => [c.id, Date.now()])));
    else if (CHANNELS.some((c) => !(c.id in chatRead))) {
      setChatRead({ ...Object.fromEntries(CHANNELS.map((c) => [c.id, Date.now()])), ...chatRead });
    }
  }, [chatRead, setChatRead]);
  const unread = useMemo(() => {
    const out = {};
    for (const c of CHANNELS) {
      const since = chatRead?.[c.id] ?? Date.now();
      const fresh = (chat[c.id] || []).filter((m) => m.at > since && m.byUid !== actor.uid && !m.deleted);
      // Announcements always count as important (red), like a mention.
      const important = c.announce ? fresh.length : fresh.filter((m) => (m.mentions || []).includes(actor.name)).length;
      out[c.id] = { count: fresh.length, mentions: important };
    }
    return out;
  }, [chat, chatRead, actor.uid, actor.name]);
  const unreadTotal = Object.values(unread).reduce((s, u) => s + u.count, 0);
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
      const msgs = chat[chatChannel] || [];
      const newest = msgs.length ? msgs[msgs.length - 1].at : 0;
      if (newest > (chatRead[chatChannel] || 0)) setChatRead({ ...chatRead, [chatChannel]: newest });
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [view, chat, chatChannel, chatRead, setChatRead]);

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

  // Lets api.create see the current filters without rebuilding api on every change.
  const filterState = useRef();
  filterState.current = { filters, view, taskView };
  const tasksRef = useRef(allTasks);
  tasksRef.current = allTasks;
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
      sendMessage: (channel, data, photoFiles) => store.sendMessage(channel, data, actor, photoFiles).catch(fail),
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
  const goTo = useCallback(
    (target) => {
      const [kind, id] = (target || '').split(/:(.*)/s);
      if (kind === 'task') setOpenId(id);
      else if (kind === 'chat') {
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
          <button
            className="icon-btn"
            title={`Theme: ${theme}`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
          >
            <ThemeIcon theme={theme} />
          </button>
          <div className="user-chip">
            <Avatar name={actor.name} size={30} />
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
            <b>{announcement.by.split(' ')[0]}:</b> {announcement.text || 'shared a photo'}
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
            <select className="filter" value={filters.priority} onChange={(e) => setF({ priority: e.target.value })} aria-label="Priority">
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
          channel={CHANNELS.some((c) => c.id === chatChannel) ? chatChannel : 'general'}
          setChannel={setChatChannel}
          messages={chat}
          unread={unread}
          actor={actor}
          isManager={actor.admin}
          roster={roster}
          tasks={tasks}
          api={api}
          onOpenTask={setOpenId}
          onMakeTask={(m, ch) =>
            setNewTask({
              status: 'todo',
              subteam: ch.subteam || '',
              title: (m.text || 'Follow up on chat photo').replace(/\s+/g, ' ').slice(0, 90),
              description: `From #${ch.id}, ${m.by}: ${m.text || '(photo)'}`,
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
      {!welcomed && <WelcomeCard name={actor.name} showRobot={showRobot} onClose={() => setWelcomed(true)} />}
      {showHelp && <HelpDialog isManager={actor.admin} showRobot={showRobot} onClose={() => setShowHelp(false)} />}
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
    </div>
  );
}
