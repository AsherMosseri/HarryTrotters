import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHANNELS,
  COMPETITION,
  RENAMED,
  ROBOT_TAB_PEOPLE,
  ROSTER,
  STATUSES,
  SUBTEAMS,
  PRIORITIES,
  REQUESTS_TO,
  TEAM_NAME,
  TEAM_STARTED,
} from '../config.js';
import { ONLINE_MS, TYPING_MS, activeStatus, buildPeopleInfo, buildProfiles } from '../people.js';
import { PALETTES } from '../nitro.js';
import { daysBetween, mondayOf, parseDay, todayISO } from '../milestones.js';
import { newTaskDefaults, personId } from '../data/diff.js';
import { preparePhoto, useLocalStorage, useMedia } from '../util.js';
import { Avatar, Overlay, PeopleContext, PlusIcon } from './common.jsx';
import { ProfileCard, ProfileEditor } from './People.jsx';
import ProfilePage from './ProfilePage.jsx';
import TabsEditor from './TabsEditor.jsx';
import TableView from './TableView.jsx';
import BoardView from './BoardView.jsx';
import TaskPanel from './TaskPanel.jsx';
import NewTaskDialog from './NewTaskDialog.jsx';
import MilestonesView from './MilestonesView.jsx';
import TeamView from './TeamView.jsx';
import PartsView from './PartsView.jsx';
import ChecklistsView from './ChecklistsView.jsx';
import ResourcesView from './ResourcesView.jsx';
import CatParty from './CatParty.jsx';
import TrashDialog from './TrashDialog.jsx';
import RunsView from './RunsView.jsx';
import ChatView from './ChatView.jsx';
// The 3D viewer pulls in three.js, so it loads only when the Robot tab opens.
const RobotView = lazy(() => import('./RobotView.jsx'));
import { HelpDialog, UpdateCheck, WelcomeCard } from './Help.jsx';
import { VersionLogDialog, WhatsNew } from './VersionLog.jsx';
import { RequestsDialog } from './Requests.jsx';
import { BottomNav, MoreSheet, Sheet } from './PhoneChrome.jsx';
import ShiftsView, { ShiftButton } from './Shifts.jsx';
import { CheckinGate, PollGate, answerOf } from './Checkin.jsx';
import ThemeStudio, { AppBackdrop, CUSTOM_DEFAULT, applyThemeVars, themeFromProfile } from './ThemeStudio.jsx';
import { VERSION, versionsSince } from '../changelog.js';
import Inbox from './Inbox.jsx';
import {
  AdActionDialog,
  AdBanner,
  AdsProvider,
  AdsSettings,
  CouponDialog,
  FullScreenAd,
  TakeoverSplash,
  TakeoverStrip,
  takeoverStyle,
  PageAds,
  RemoveAdsDialog,
  SubmitAdDialog,
  useAdsEngine,
} from './Ads.jsx';
import CommandsPage from './CommandsPage.jsx';
import { CoinsDialog, Coins } from './Coins.jsx';
import { OrderTracker, OrdersDialog, orderActive } from './AdOrders.jsx';
import { setServerSkew } from '../serverTime.js';
import { AdBlockWall, GameDialog, PrizeWheel, VideoAd } from './AdGames.jsx';
import { coinSettings, wallet } from '../coins.js';

// Versions were renumbered once (2.0 became 1.9, 2.1 became 2.0, and so
// on). Move this device's "last seen" version along so What's new doesn't
// show again.
try {
  if (!localStorage.getItem('versions-renumbered')) {
    const seen = JSON.parse(localStorage.getItem('seen-version') || 'null');
    const m = /^2\.(\d+)$/.exec(seen || '');
    if (m) localStorage.setItem('seen-version', JSON.stringify(m[1] === '0' ? '1.9' : `2.${Number(m[1]) - 1}`));
    localStorage.setItem('versions-renumbered', '1');
  }
  // The first 2.46 (Member since) was folded into 2.45, and 2.46 is now
  // Edit tabs. Devices that saw the first one should still see the new one.
  if (!localStorage.getItem('v246-merged')) {
    if (localStorage.getItem('seen-version') === '"2.46"') localStorage.setItem('seen-version', '"2.45"');
    localStorage.setItem('v246-merged', '1');
  }
} catch {
  /* storage unavailable */
}

// Light / dark / automatic, plus the app color themes.
function ThemeMenu({
  theme,
  setTheme,
  palette,
  setPalette,
  customColors,
  profileColors,
  onCustom,
  onClose,
  calm,
  setCalm,
  inline = false,
}) {
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
    <div className={`theme-menu${inline ? ' inline' : ''}`} role="dialog" aria-label="Theme">
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
        <button className={`palette${palette === 'profile' ? ' on' : ''}`} onClick={() => setPalette('profile')}>
          <span className="palette-dot" style={{ background: `linear-gradient(135deg, ${profileColors[0]}, ${profileColors[1]})` }} />
          🪞 My profile
        </button>
        <button className={`palette${palette === 'custom' ? ' on' : ''}`} onClick={onCustom}>
          <span className="palette-dot" style={{ background: `linear-gradient(135deg, ${customColors[0]}, ${customColors[1]})` }} />
          🎨 Custom…
        </button>
      </div>
      <label className="calm-toggle">
        <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} />
        <span>
          <b>Calm chat</b>
          <span className="muted tiny">
            Animated pictures, names, decorations, borders, and nameplates in chat move only on the message you hover or tap.
          </span>
        </span>
      </label>
    </div>
  );
}

// A small menu that closes when you tap outside it or press Escape.
function Popover({ wrap, className, onClose, children }) {
  useEffect(() => {
    const away = (e) => !e.target.closest(wrap) && onClose();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [wrap, onClose]);
  return (
    <div className={className} role="dialog">
      {children}
    </div>
  );
}
const MeMenu = ({ onClose, children }) => (
  <Popover wrap=".me-wrap" className="me-menu" onClose={onClose}>
    {children}
  </Popover>
);

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
  ['shifts', 'Shifts'],
  ['milestones', 'Milestones'],
  ['parts', 'Parts'],
  ['checklists', 'Checklists'],
  ['runs', 'Match Log'],
  ['robot', 'Robot'],
  ['resources', 'Resources'],
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
  // Calm chat (off by default, per device): when on, animations in chat wait
  // for hover or tap. A new key, so the old saved "on" doesn't stick.
  const [calm, setCalm] = useLocalStorage('calm-chat-v2', false);
  useEffect(() => {
    document.documentElement.classList.toggle('calm-chat', calm !== false);
  }, [calm]);
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
  // Phones get a slim top bar, a bottom tab bar, and sheets instead of the header's buttons.
  const phone = useMedia('(max-width: 760px)');
  const showRobot = ROBOT_TAB_PEOPLE.includes(actor.name);
  const [profileDocs, setProfileDocs] = useState([]);
  // Tabs: the owner can turn tabs off for everyone (settings.hiddenTabs);
  // each person orders their own (profile.tabOrder, on every device).
  const allViews = showRobot ? VIEWS : VIEWS.filter(([id]) => id !== 'robot');
  const hiddenTabs = settings.hiddenTabs || [];
  const tabOrder = profileDocs.find((d) => d.id === personId(actor.name))?.tabOrder;
  // No saved order: phones start with Board, Chat, Shifts, Parts on the tab bar.
  const order = tabOrder || (phone ? ['board', 'chat', 'shifts', 'parts'] : []);
  const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length + allViews.findIndex(([v]) => v === id));
  const shownViews = allViews.filter(([id]) => !hiddenTabs.includes(id));
  const byRank = (list) => [...list].sort((a, b) => rank(a[0]) - rank(b[0]));
  const views = byRank(shownViews.length ? shownViews : allViews);
  const [editTabs, setEditTabs] = useState(false);
  const [meMenu, setMeMenu] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const view = views.some(([id]) => id === savedView) ? savedView : views[0][0];
  const taskView = view === 'board' || view === 'table';
  const [phoneSheet, setPhoneSheet] = useState(null); // 'me' | 'more' | 'filters'
  const closeSheet = useCallback(() => setPhoneSheet(null), []);
  // The on-screen keyboard: see keyboard.js (installed in main.jsx).
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
  const botHook = useRef(null); // brand bots hear chat messages (set once ads are ready)
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
  // Resources: quiet on failure (works before the new rules are published).
  const [resources, setResources] = useState([]);
  const [diagram, setDiagram] = useState(null);
  useEffect(() => store.subscribeResources(setResources, (e) => console.warn('resources', e)), [store]);
  useEffect(() => store.subscribeDiagram('electrical', setDiagram, (e) => console.warn('diagram', e)), [store]);
  useEffect(() => store.subscribeRuns(setRuns, loadFail('the match log')), [store, loadFail]);
  useEffect(() => store.subscribeRobot(setRobot, loadFail('the robot')), [store, loadFail]);
  // Chat extras. Quiet on failure: the board works without them (e.g. before
  // the new rules are published).
  const quiet = useCallback((what) => (e) => console.warn(what, e), []);
  const [channelDocs, setChannelDocs] = useState([]);
  const [dmDocs, setDmDocs] = useState([]);
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
  // Feature requests (💡). showRequests is true, or the id of one to point at.
  const [requests, setRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(null);
  useEffect(() => store.subscribeRequests(setRequests, quiet('requests')), [store, quiet]);
  const newRequests = actor.name === REQUESTS_TO ? requests.filter((r) => r.status === 'new').length : 0;
  // Shifts (clock in/out) and the planned schedule.
  const [shifts, setShifts] = useState([]);
  const [shiftPlans, setShiftPlans] = useState([]);
  const [shiftPanel, setShiftPanel] = useState(false);
  useEffect(() => store.subscribeShifts(setShifts, quiet('shifts')), [store, quiet]);
  useEffect(() => store.subscribeShiftPlans(setShiftPlans, quiet('shift schedule')), [store, quiet]);
  // Lab check-ins: today's unanswered one blocks the app until it's answered.
  const [checkins, setCheckins] = useState([]);
  useEffect(() => store.subscribeCheckins(setCheckins, quiet('lab check-ins')), [store, quiet]);
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
  // Custom theme (🎨) and "match my profile" (🪞): colors, background, floating things.
  const [customTheme, setCustomTheme] = useLocalStorage('custom-theme', CUSTOM_DEFAULT);
  const [studio, setStudio] = useState(false);
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
      CHANNELS.map((c, i) => [c.id, { id: c.id, name: c.id, subteam: c.subteam, announce: !!c.announce, order: i, topic: c.topic || '' }]),
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
  // #parts also shows inside the Parts tab; the conversation on screen is that or the Chat tab's.
  const partsConv = convs.channels.find((c) => c.id === 'parts');
  const shownConv = view === 'chat' ? currentConv : view === 'parts' ? partsConv : null;

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
    const t = setInterval(() => setNow(Date.now()), view === 'chat' || view === 'parts' ? 2000 : 30000);
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
      roster,
    }),
    [profiles, online, peopleInfo, roster],
  );
  const openPerson = useCallback((name) => setProfileFor(name), []);
  // Going back: a pop-up opened from another pop-up returns to it when it's
  // closed (✕, Cancel, Escape, or Save), like a phone's back button.
  // Entries: { child, value, restore }. `value` (a name, a task id) keeps an
  // old entry from firing when the same kind of pop-up is opened elsewhere.
  const backStack = useRef([]);
  const openFrom = useCallback((child, value, restore) => {
    backStack.current = [...backStack.current.slice(-20), { child, value, restore }];
  }, []);
  const goBack = useCallback((child, value) => {
    const top = backStack.current[backStack.current.length - 1];
    if (!top || top.child !== child || (top.value !== undefined && value !== undefined && top.value !== value)) return;
    backStack.current = backStack.current.slice(0, -1);
    top.restore();
  }, []);
  const clearBack = useCallback(() => (backStack.current = []), []);
  const [fullProfileFor, setFullProfileFor] = useState(null);
  // Private notes about teammates (only you see yours).
  const [notes, setNotes] = useState({});
  useEffect(() => store.subscribeNotes(actor.name, setNotes, (e) => console.warn('notes', e)), [store, actor.name]);
  const lastSeenOf = useCallback(
    (name) => Math.max(0, ...presence.filter((p) => rename(p.name || '') === name).map((p) => p.at || 0)),
    [presence, rename],
  );
  const myProfile = profiles.get(actor.name);
  const myColor = peopleInfo.get(actor.name)?.color;
  const profileTheme = useMemo(() => themeFromProfile(myProfile, myColor), [myProfile, myColor]);
  const activeTheme = palette === 'custom' ? { ...CUSTOM_DEFAULT, ...customTheme } : palette === 'profile' ? profileTheme : null;
  const themeKey = JSON.stringify(activeTheme);
  useEffect(() => {
    applyThemeVars(themeKey === 'null' ? null : JSON.parse(themeKey));
  }, [themeKey]);
  const gradeOf = useCallback((name) => peopleInfo.get(name)?.grade || 9, [peopleInfo]);
  const today = todayISO();
  const pendingCheckin = checkins.find((c) => c.date === today && (c.slots || []).length && !answerOf(c, actor.name, rename));
  const upcomingCheckins = checkins
    .filter((c) => c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));

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
  // A required poll in #announcements this person hasn't voted on yet (asked
  // when they open the app, like a lab check-in).
  const pendingPoll = useMemo(() => {
    const me = personId(actor.name);
    return (chat.announcements || []).find(
      (m) =>
        m.poll?.required &&
        !m.poll.closed &&
        !m.deleted &&
        rename(m.by || '') !== actor.name &&
        !Object.values(m.votes || {}).some((v) => v?.[me]),
    );
  }, [chat, actor.name, rename]);

  // Mark the open channel read while it's on screen.
  useEffect(() => {
    if (!shownConv || !chatRead) return;
    const markRead = () => {
      if (document.visibilityState !== 'visible') return;
      const key = shownConv.key;
      const msgs = chat[key] || [];
      const newest = msgs.length ? msgs[msgs.length - 1].at : 0;
      if (key && newest > (chatRead[key] || 0)) setChatRead({ ...chatRead, [key]: newest });
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [chat, shownConv, chatRead, setChatRead]);

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
  // What slash commands look up (commands.js): filled in further down, once
  // coins and shifts are known; api reads it when a command runs.
  const cmdData = useRef({});
  const api = useMemo(
    () => ({
      create: async (data) => {
        let id;
        try {
          id = await store.createTask(data, actor);
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
        return id;
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
      saveAdSettings: (cfg) => store.saveAdSettings(JSON.parse(JSON.stringify(cfg)), actor).catch(fail),
      bumpAdStats: (counts) => store.bumpAdStats(counts, actor.name).catch(() => {}),
      // Pictures for ads: GIFs as they are (up to 4 MB), others shrunk to 480 px.
      uploadAdImage: async (file) => {
        try {
          const gif = file.type === 'image/gif';
          if (gif && file.size > 4 * 1024 * 1024) throw new Error('That GIF is over 4 MB.');
          const blob = gif ? file : (await preparePhoto(file)).thumb;
          return await store.uploadAdImage(actor.name, blob);
        } catch (e) {
          fail(e);
          return '';
        }
      },
      submitAd: (data) => store.submitAd(data, actor).catch(fail),
      placeAdOrder: (plan) => store.addAdOrder(plan, actor),
      deleteAdOrder: (id) => store.deleteAdOrder(id).catch(fail),
      addCoins: (tx) => store.addCoinTx(tx).catch(fail),
      undoCoins: (tx) => store.deleteCoinTx(tx.id).catch(fail),
      withdrawAd: (sub) => store.updateAdSubmission(sub.id, { status: 'withdrawn' }).catch(fail),
      reviewAd: (sub, patch) => store.updateAdSubmission(sub.id, patch).catch(fail),
      deleteAdSubmission: (sub) => store.deleteAdSubmission(sub.id).catch(fail),
      createPart: (data) => store.createPart(data, actor).catch(fail),
      updatePart: (p, patch) => store.updatePart(p.id, patch, actor).catch(fail),
      deletePart: (p) => store.deletePart(p.id).catch(fail),
      createChecklist: (data) => store.createChecklist(data, actor).catch(fail),
      addResource: (data) => store.addResource(data, actor).catch(fail),
      updateResource: (id, patch) => store.updateResource(id, patch, actor).catch(fail),
      deleteResource: (id) => store.deleteResource(id).catch(fail),
      saveDiagram: (data) => store.saveDiagram('electrical', data, actor),
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
      ping: () => store.ping(),
      play: (req) =>
        store
          .play(req, actor, { balanceOf: (n) => cmdData.current.wallet(n).balance, roster: cmdData.current.roster })
          .then((r) => (setServerSkew(r?.serverNow), r))
          .catch((e) => ({ note: { title: 'Trotbot couldn’t do that', body: e.message || String(e) } })),
      wallet: (name) => cmdData.current.wallet(name),
      richest: () => cmdData.current.richest(),
      lottery: () => cmdData.current.lottery,
      gift: (to, amount, note) => store.addCoinTx({ type: 'gift', from: actor.name, to, amount, note: note || '', at: Date.now() }),
      whois: (name) => cmdData.current.whois(name),
      // For the team commands (/task, /shift, /match…).
      team: () => cmdData.current.team,
      countdown: () => cmdData.current.countdown(),
      addReminder: (r) => store.addReminder(r, actor),
      sendMessage: (conv, data, photoFiles) => {
        botHook.current?.(conv, data?.text);
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
      answerPoll: (conv, msg, text) => store.answerPoll(conv, msg, text.trim().slice(0, 1000), actor).catch(fail),
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
      uploadEffectImage: (name, file, oldPath) => store.uploadEffectImage(name, file, oldPath),
      startShifts: (people, start, extra = {}) => store.startShifts(people, start, extra, actor).catch(fail),
      updateShift: (id, patch) => store.updateShift(id, patch, actor).catch(fail),
      deleteShift: (id) => store.deleteShift(id).catch(fail),
      addShiftPlans: (list) => store.addShiftPlans(list, actor).catch(fail),
      addCheckin: (data) => store.addCheckin(data, actor).catch(fail),
      answerCheckin: (id, answer) => store.answerCheckin(id, actor.name, answer).catch(fail),
      deleteCheckin: (id) => store.deleteCheckin(id).catch(fail),
      rsvpShiftPlan: (id, answer) => store.rsvpShiftPlan(id, actor.name, answer).catch(fail),
      deleteShiftPlans: (ids) => store.deleteShiftPlans(ids).catch(fail),
      addRequest: (text, kind) =>
        store.addRequest(text, actor, kind).then(
          () => true,
          (e) => {
            fail(e);
            return false;
          },
        ),
      updateRequest: (id, patch) => store.updateRequest(id, patch, actor).catch(fail),
      saveNote: (about, text) => store.saveNote(actor.name, about, text).catch(fail),
      voteRequest: (id, vote) => store.voteRequest(id, actor.name, vote).catch(fail),
      deleteRequest: (id) => store.deleteRequest(id).catch(fail),
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

  // Seeing something clears its notifications: in the bell, and on the phone
  // (the notification-center entries this app showed).
  const [pageVisible, setPageVisible] = useState(document.visibilityState === 'visible');
  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const seenTarget = useMemo(() => {
    if (!pageVisible) return [];
    const out = [];
    if (openId) out.push(`task:${openId}`);
    if (shownConv) out.push(`chat:${shownConv.key}`);
    if (view === 'board') out.push('view:board');
    if (showRequests) out.push(...requests.map((r) => `requests:${r.id}`));
    if (view === 'shifts') out.push('view:shifts');
    if (shiftPanel) out.push('shift:end');
    return out;
  }, [pageVisible, openId, view, shownConv, showRequests, requests, shiftPanel]);
  useEffect(() => {
    if (!seenTarget.length) return;
    const ids = inbox.filter((n) => !n.read && seenTarget.includes(n.open)).map((n) => n.id);
    if (ids.length) store.markInboxRead(actor.name, ids).catch((e) => console.warn('inbox read', e));
    navigator.serviceWorker
      ?.getRegistration?.()
      .then((reg) => reg?.getNotifications?.())
      .then((list) => list?.forEach((n) => seenTarget.includes(n.data?.open) && n.close()))
      .catch(() => {});
  }, [seenTarget, inbox, store, actor.name]);

  // This person's running shift, and starting one (with Undo for mis-taps).
  const myShift = useMemo(() => shifts.find((s) => !s.end && rename(s.person || '') === actor.name) || null, [shifts, rename, actor.name]);
  const liveMyShift = useRef(myShift);
  liveMyShift.current = myShift;
  const myOpenTasks = useMemo(
    () => (tasks || []).filter((t) => t.status !== 'done' && (t.assignees || []).includes(actor.name)),
    [tasks, actor.name],
  );
  const startMyShift = useCallback(
    async (extra = {}) => {
      if (liveMyShift.current) return setShiftPanel(true);
      await api.startShifts([actor.name], Date.now(), extra);
      setToast({
        text: '⏱ Shift started',
        action: { label: 'Undo', run: () => liveMyShift.current && api.deleteShift(liveMyShift.current.id) },
      });
    },
    [api, actor.name],
  );

  // Where a notification points: 'task:<id>', 'chat:<channel>', or 'view:<tab>'.
  const liveTasks = useRef(tasks);
  liveTasks.current = tasks;
  // What happens after you book / order from an ad (adOrders.js): only yours.
  const [adOrders, setAdOrders] = useState([]);
  useEffect(() => store.subscribeAdOrders(actor.name, setAdOrders), [store, actor.name]);
  const [trackId, setTrackId] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
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
      else if (kind === 'requests') setShowRequests(id || true);
      else if (kind === 'adorder') setTrackId(id);
      else if (kind === 'shift') {
        // "Still at the lab?": the End panel if the shift is still running.
        if (liveMyShift.current) setShiftPanel(true);
        else setView('shifts');
      }
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

  const shiftButton = (
    <ShiftButton
      shift={myShift}
      open={shiftPanel}
      setOpen={setShiftPanel}
      myTasks={myOpenTasks}
      onStart={startMyShift}
      onUpdate={(patch) => myShift && api.updateShift(myShift.id, patch)}
      onCancel={() => {
        setShiftPanel(false);
        if (myShift) api.deleteShift(myShift.id);
      }}
      onOpenTab={() => {
        setShiftPanel(false);
        setView('shifts');
      }}
    />
  );
  const themeMenuProps = {
    calm,
    setCalm,
    theme,
    setTheme,
    palette,
    setPalette,
    customColors: customTheme.colors || CUSTOM_DEFAULT.colors,
    profileColors: profileTheme.colors,
    onCustom: () => {
      setPalette('custom');
      setThemeMenu(false);
      setPhoneSheet(null);
      setMeMenu(false);
      setStudio(true);
    },
  };
  // Person, subteam, priority, Hide done, Clear, and Recently deleted (a sheet on phones).
  const filterControls = (
    <>
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
    </>
  );
  // Pretend ads (Asher's 📺 Ads page controls them).
  const isOwner = actor.admin && actor.name === REQUESTS_TO;
  const [adSubs, setAdSubs] = useState([]);
  useEffect(() => store.subscribeAdSubmissions(setAdSubs), [store]);
  const [adsPage, setAdsPage] = useState(false);
  const [commandsPage, setCommandsPage] = useState(false);
  const [adStats, setAdStats] = useState({});
  useEffect(() => store.subscribeAdStats(setAdStats), [store]);

  // Jackson coins: earned from tasks and hours (and, for Asher, the ad money);
  // spending, gifts, and bonuses are in the ledger.
  const [ledger, setLedger] = useState([]);
  useEffect(() => store.subscribeCoins(setLedger), [store]);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const coinCfg = useMemo(() => coinSettings(settings.coins), [settings.coins]);
  // Casino and economy winnings/losses (bank) and the Friday lottery; the
  // play function writes them.
  const [bank, setBank] = useState({});
  useEffect(() => store.subscribeBank(setBank), [store]);
  const [lottery, setLottery] = useState(null);
  useEffect(() => store.subscribeLottery(setLottery), [store]);
  const coinData = useMemo(
    () => ({ tasks: tasks || [], shifts, adStats, ledger, bank, cfg: coinCfg }),
    [tasks, shifts, adStats, ledger, bank, coinCfg],
  );
  const walletOf = useCallback((name) => wallet(name, { ...coinData, owner: name === REQUESTS_TO }), [coinData]);
  const myWallet = useMemo(() => walletOf(actor.name), [walletOf, actor.name]);
  cmdData.current = {
    roster,
    lottery,
    team: {
      commandCfg: settings.commands || {},
      tasks: tasks || [],
      runs: () => runs,
      createRun: (data) => api.createRun(data),
      subteamOf: (conv) => convs.channels.find((c) => c.id === conv)?.subteam || '',
      myShift: () => liveMyShift.current,
      startShift: () => startMyShift(),
      endShift: () => setShiftPanel(true),
      onShift: () =>
        shifts
          .filter((x) => !x.end)
          .map((x) => ({ name: rename(x.person || ''), since: x.start }))
          .sort((a, b) => a.since - b.since),
    },
    wallet: (name) => {
      const w = walletOf(name);
      return { balance: w.balance, earned: w.earned, casino: bank[name]?.net || 0, stats: bank[name]?.stats || {} };
    },
    richest: () =>
      roster
        .map((n) => ({ name: n, coins: walletOf(n).balance }))
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 10),
    whois: (name) => {
      const mine = shifts.filter((x) => x.person === name);
      const hours = (list) => Math.round(list.reduce((t, x) => t + ((x.end || Date.now()) - x.start), 0) / 360000) / 10;
      const monday = parseDay(mondayOf(todayISO())).getTime();
      const theirs = (tasks || []).filter((t) => (t.assignees || []).includes(name));
      const st = activeStatus(profiles.get(name));
      return {
        subteams: peopleInfo.get(name)?.subteams || [],
        week: hours(mine.filter((x) => x.start >= monday)),
        hours: hours(mine),
        done: theirs.filter((t) => t.status === 'done').length,
        open: theirs.filter((t) => t.status !== 'done').length,
        coins: walletOf(name).balance,
        onShift: mine.some((x) => !x.end),
        status: st ? `${st.emoji || ''} ${st.text || ''}`.trim() : '',
      };
    },
    countdown: () => {
      if (!competitionDate) return null;
      const days = Math.max(0, daysBetween(todayISO(), competitionDate));
      const hype =
        days === 0
          ? 'GO GO GO. Charge everything. 🔋'
          : days <= 3
            ? 'Final stretch. Check the zip ties. Check them again. 🔥'
            : days <= 7
              ? 'One week. Drive practice every day. 🏎️'
              : days <= 21
                ? 'Time to finish the robot and start the notebook. 📓'
                : 'Plenty of time. (There is never plenty of time.) ⏳';
      return {
        days,
        hype,
        label: COMPETITION.name,
        date: parseDay(competitionDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
      };
    },
  };
  const coins = useMemo(
    () => ({
      balance: myWallet.balance,
      cfg: coinCfg,
      // Never more than you have (the ledger can't check this itself).
      spend: (tx) => (tx.amount > myWallet.balance ? Promise.resolve() : api.addCoins({ type: 'spend', person: actor.name, ...tx })),
      prize: (tx) => api.addCoins({ type: 'prize', person: actor.name, ...tx }),
    }),
    [myWallet.balance, coinCfg, api, actor.name],
  );
  // The viewer's own numbers, for targeted ads that know a little too much.
  const viewer = useMemo(() => {
    const name = actor.name;
    const now = Date.now();
    const today = todayISO();
    const monday = parseDay(mondayOf(today)).getTime();
    const mine = (tasks || []).filter((t) => (t.assignees || []).includes(name));
    const myShifts = shifts.filter((x) => x.person === name);
    const ended = myShifts.filter((x) => x.end).sort((a, b) => b.end - a.end)[0];
    const latest = [...myShifts].sort((a, b) => b.start - a.start)[0];
    const endHour = ended ? new Date(ended.end).getHours() : -1;
    return {
      name,
      first: name.split(' ')[0],
      hoursWeek: Math.round(myShifts.filter((x) => x.start >= monday).reduce((h, x) => h + ((x.end || now) - x.start), 0) / 360000) / 10,
      overdue: mine.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length,
      open: mine.filter((t) => t.status !== 'done').length,
      doneWeek: mine.filter((t) => t.status === 'done' && (t.completedAt || 0) >= monday).length,
      balance: myWallet.balance,
      lastEndHour: endHour >= 0 && endHour < 4 ? endHour + 24 : endHour,
      lastEndText: ended ? new Date(ended.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
      onShift: myShifts.some((x) => !x.end),
      daysSinceLab: latest ? Math.floor((now - (latest.end || now)) / 86400000) : 999,
      daysToComp: daysBetween(today, competitionDate),
      subteams: peopleInfo.get(name)?.subteams || [],
    };
  }, [actor.name, tasks, shifts, myWallet.balance, competitionDate, peopleInfo]);
  const trackOrder = trackId ? adOrders.find((o) => o.id === trackId) : null;
  const activeOrders = useMemo(() => adOrders.filter((o) => orderActive(o, Date.now())).length, [adOrders]);
  const ads = useAdsEngine({ settings, actor, view, shifts, submissions: adSubs, ledger, coins, viewer, competitionDate, api });
  botHook.current = ads.onChatSent;
  const inboxButton = (
    <Inbox
      items={[
        ...inbox,
        ...ads.notes.map((n) => ({
          id: n.id,
          type: 'ad',
          icon: n.coupon ? '🎟️' : n.emoji,
          title: n.title,
          body: n.body,
          at: n.at,
          read: n.read,
          open: { ad: n.id },
        })),
      ].sort((a, b) => (b.at || 0) - (a.at || 0))}
      pushStatus={pushStatus}
      onEnablePush={enablePush}
      onDisablePush={disablePush}
      onOpen={(open) => (open?.ad ? ads.openNote(open.ad) : goTo(open))}
      onMarkRead={(ids) => {
        ads.markNotesRead(ids.filter((x) => String(x).startsWith('adn-')));
        const real = ids.filter((x) => !String(x).startsWith('adn-'));
        if (real.length) store.markInboxRead(actor.name, real).catch(fail);
      }}
      onClear={(ids) => {
        ads.clearNotes(ids.filter((x) => String(x).startsWith('adn-')));
        const real = ids.filter((x) => !String(x).startsWith('adn-'));
        if (real.length) store.clearInbox(actor.name, real).catch(fail);
      }}
    />
  );
  const [adPeople, setAdPeople] = useState({});
  useEffect(() => (adsPage ? store.subscribeAdPeople(setAdPeople) : undefined), [adsPage, store]);

  const filterCount = [filters.person && filters.person !== '__me', filters.subteam, filters.priority, filters.hideDone].filter(
    Boolean,
  ).length;

  return (
    <PeopleContext.Provider value={peopleCtx}>
      <AdsProvider value={ads.value}>
        <div className={`app${view === 'chat' || view === 'robot' ? ' chat-mode' : ''}`} style={takeoverStyle(ads.value.takeover)}>
          {store.mode === 'demo' && (
            <div className="demo-banner">
              Demo mode — sample data saved only in this browser. <a href="./">Go to the real board</a>
            </div>
          )}
          <AppBackdrop theme={activeTheme} />
          {phone ? (
            <header className="topbar phone-top">
              <button className="brand" onClick={() => setCat(true)} aria-label="Team logo">
                <span className="logo-mark">✓</span>
              </button>
              <h1 className="phone-title">{views.find(([id]) => id === view)?.[1] || 'Board'}</h1>
              <span className="spacer" />
              {shiftButton}
              {inboxButton}
              <button className="avatar-btn me-btn" onClick={() => setPhoneSheet('me')} aria-label="You: profile, theme, ideas, help">
                <Avatar name={actor.name} size={34} />
                {newRequests > 0 && <span className="bell-badge">{newRequests > 9 ? '9+' : newRequests}</span>}
              </button>
            </header>
          ) : (
            <header className="topbar">
              <button className="brand" onClick={() => setCat(true)}>
                <span className="logo-mark">✓</span>
                <span className="brand-text">
                  {TEAM_NAME} <span className="muted">Tasks</span>
                </span>
              </button>
              <nav className="tabs" role="tablist" ref={tabsRef}>
                {views.map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={view === id}
                    className={view === id ? 'active' : ''}
                    onClick={() => setView(id)}
                  >
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
                {shiftButton}
                {inboxButton}
                <div className="user-chip me-wrap">
                  <button
                    className={`me-chip${meMenu ? ' on' : ''}`}
                    onClick={() => setMeMenu(!meMenu)}
                    aria-label={newRequests ? `You: ${newRequests} new feature requests` : 'You: profile, ideas, help, theme'}
                    aria-expanded={meMenu}
                  >
                    <Avatar name={actor.name} size={30} />
                    <span className="user-name">{actor.name.split(' ')[0]}</span>
                    <span className="me-caret" aria-hidden="true">
                      ▾
                    </span>
                    {newRequests > 0 && <span className="bell-badge">{newRequests > 9 ? '9+' : newRequests}</span>}
                  </button>
                  {meMenu && (
                    <MeMenu onClose={() => setMeMenu(false)}>
                      <div className="me-list">
                        <button onClick={() => (setMeMenu(false), setProfileFor(actor.name))}>👤 My profile</button>
                        <button onClick={() => (setMeMenu(false), setEditProfileFor(actor.name))}>✏️ Edit profile</button>
                        <button onClick={() => (setMeMenu(false), setShowRequests(true))}>
                          💡 Request a feature {newRequests > 0 && <span className="me-badge">{newRequests}</span>}
                        </button>
                        <button onClick={() => (setMeMenu(false), setShowHelp(true))}>❓ Help</button>
                        <button onClick={() => (setMeMenu(false), setCoinsOpen(true))}>
                          🪙 Jackson coins{' '}
                          <span className="me-coins">
                            <Coins n={myWallet.balance} />
                          </span>
                        </button>
                        {adOrders.length > 0 && (
                          <button onClick={() => (setMeMenu(false), setOrdersOpen(true))}>
                            📦 Orders & bookings {activeOrders > 0 && <span className="me-badge">{activeOrders}</span>}
                          </button>
                        )}
                        <button onClick={() => (setMeMenu(false), setEditTabs(true))}>🗂 Edit tabs</button>
                        {isOwner && <button onClick={() => (setMeMenu(false), setAdsPage(true))}>📺 Ads</button>}
                        {isOwner && <button onClick={() => (setMeMenu(false), setCommandsPage(true))}>🤖 Commands</button>}
                      </div>
                      <ThemeMenu {...themeMenuProps} inline onClose={() => {}} />
                      <UpdateCheck />
                      <button
                        className="btn me-switch"
                        onClick={() => confirm('Switch user? You will need the team code again on this device.') && store.leave()}
                      >
                        Switch user
                      </button>
                    </MeMenu>
                  )}
                </div>
              </div>
            </header>
          )}
          <TakeoverStrip />
          <AdBanner position="top" />
          {/* Only this area scrolls; the header stays put above it. */}
          <div className="app-scroll">
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
              <div className={`toolbar${phone ? ' phone' : ''}`}>
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
                  {phone ? (
                    <button className={`chip${filterCount ? ' on' : ''}`} onClick={() => setPhoneSheet('filters')}>
                      Filters{filterCount ? ` · ${filterCount}` : ''}
                    </button>
                  ) : (
                    <span className="filters-wrap">
                      <button
                        className={`chip${filterCount || filtersOpen ? ' on' : ''}`}
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        aria-expanded={filtersOpen}
                      >
                        ⚙︎ Filters{filterCount ? ` · ${filterCount}` : ''}
                        {trash.length > 0 && !filterCount ? <span className="filters-dot" aria-hidden="true" /> : null}
                      </button>
                      {filtersOpen && (
                        <Popover wrap=".filters-wrap" className="filters-pop" onClose={() => setFiltersOpen(false)}>
                          {filterControls}
                        </Popover>
                      )}
                    </span>
                  )}
                </div>
                {!phone && (
                  <>
                    <span className="spacer" />
                    <button className="btn primary" onClick={() => setNewTask({ status: 'todo' })}>
                      <PlusIcon /> New task
                    </button>
                  </>
                )}
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

            <PageAds view={view} spot="top" />
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
              <div className="parts-layout">
                <PartsView parts={parts} tasks={tasks} api={api} onOpenTask={setOpenId} />
                {partsConv && (
                  <ChatView
                    embedded
                    convs={convs}
                    current={partsConv}
                    setCurrent={(key) => {
                      setChatChannel(key);
                      setView('chat');
                    }}
                    onOpenFull={() => {
                      setChatChannel(partsConv.key);
                      setView('chat');
                    }}
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
                    typing={typingIn(partsConv.key)}
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
                )}
              </div>
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
            ) : view === 'shifts' ? (
              <ShiftsView
                shifts={shifts}
                plans={shiftPlans}
                actor={actor}
                roster={roster}
                tasks={tasks || []}
                goal={settings.shiftGoal || 0}
                api={api}
                rename={rename}
                onStartMine={startMyShift}
                onOpenMine={() => setShiftPanel(true)}
                onOpenTask={setOpenId}
                checkins={upcomingCheckins}
                checkinSchedule={settings.checkinSchedule}
                gradeOf={gradeOf}
              />
            ) : view === 'resources' ? (
              <ResourcesView
                resources={resources}
                diagram={diagram}
                actor={actor}
                isManager={actor.admin}
                canEditDiagram={actor.admin || (peopleInfo.get(actor.name)?.subteams || []).includes('Electrical')}
                api={api}
              />
            ) : view === 'runs' ? (
              <RunsView runs={runs} roster={roster} api={api} />
            ) : view === 'team' ? (
              <TeamView roster={roster} roles={roles} tasks={tasks} api={api} isManager={actor.admin} rename={rename} />
            ) : (
              <main className="content">
                {view === 'table' ? (
                  <TableView tasks={filtered} api={api} onOpen={setOpenId} total={tasks.length} />
                ) : (
                  <BoardView
                    phone={phone}
                    tasks={filtered}
                    milestones={milestones}
                    api={api}
                    onOpen={setOpenId}
                    onAdd={(status) => setNewTask({ status })}
                  />
                )}
              </main>
            )}
            <PageAds view={view} spot="bottom" />

            {openTask && (
              <TaskPanel
                task={openTask}
                api={api}
                roster={roster}
                milestones={milestones}
                parts={parts}
                onClose={() => {
                  setOpenId(null);
                  goBack('task', openTask.id);
                }}
              />
            )}
            {newTask && (
              <NewTaskDialog
                initial={newTask}
                roster={roster}
                milestones={milestones}
                me={actor.name}
                onClose={() => {
                  setNewTask(null);
                  goBack('newtask');
                }}
                onCreate={async (data) => {
                  setNewTask(null);
                  clearBack();
                  await api.create(data);
                }}
              />
            )}
            {showTrash && (
              <TrashDialog trash={trash} days={TRASH_DAYS} isManager={actor.admin} api={api} onClose={() => setShowTrash(false)} />
            )}
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
                  openFrom('log', undefined, () => setShowHelp(true));
                  setShowHelp(false);
                  setShowLog(true);
                }}
                onRequests={() => {
                  openFrom('requests', undefined, () => setShowHelp(true));
                  setShowHelp(false);
                  setShowRequests(true);
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
                onRequest={api.addRequest}
              />
            )}
            {showRequests && (
              <RequestsDialog
                requests={requests}
                actor={actor}
                api={api}
                focusId={showRequests === true ? null : showRequests}
                onClose={() => {
                  setShowRequests(null);
                  goBack('requests');
                }}
                onMakeTask={(r) => {
                  const back = showRequests;
                  openFrom('newtask', undefined, () => setShowRequests(back));
                  setShowRequests(null);
                  if (r.status === 'new') api.updateRequest(r.id, { status: 'planned' });
                  setNewTask({
                    status: 'todo',
                    title: r.text.replace(/\s+/g, ' ').slice(0, 90),
                    description: `Feature request from ${r.by}:\n${r.text}`,
                  });
                }}
              />
            )}
            {showLog && (
              <VersionLogDialog
                current={VERSION}
                onClose={() => {
                  setShowLog(false);
                  goBack('log');
                }}
              />
            )}
            {cat && <CatParty onClose={() => setCat(false)} />}
            {studio && (
              <ThemeStudio
                value={customTheme}
                onChange={setCustomTheme}
                profile={myProfile}
                profileColor={myColor}
                upload={(file, oldPath) => api.uploadEffectImage(actor.name, file, oldPath)}
                onClose={() => setStudio(false)}
              />
            )}
            {!pendingCheckin && pendingPoll && (
              <PollGate
                msg={pendingPoll}
                rename={rename}
                onVote={async (ids) => {
                  for (const id of ids) await api.vote('announcements', pendingPoll, id, true);
                }}
                onAnswer={(text) => api.answerPoll('announcements', pendingPoll, text)}
              />
            )}
            {pendingCheckin && (
              <CheckinGate checkin={pendingCheckin} rename={rename} onAnswer={(a) => api.answerCheckin(pendingCheckin.id, a)} />
            )}
            {toast && (
              <Overlay>
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
              </Overlay>
            )}
            {profileFor && (
              <ProfileCard
                name={profileFor}
                actor={actor}
                tasks={tasks || []}
                onClose={() => setProfileFor(null)}
                onEdit={() => {
                  const n = profileFor;
                  openFrom('edit', n, () => setProfileFor(n));
                  setEditProfileFor(n);
                  setProfileFor(null);
                }}
                onFull={() => {
                  const n = profileFor;
                  openFrom('full', n, () => setProfileFor(n));
                  setFullProfileFor(n);
                  setProfileFor(null);
                }}
                onMessage={async () => {
                  const key = await api.openDm([actor.name, profileFor]);
                  clearBack();
                  setProfileFor(null);
                  if (key) {
                    setChatChannel(key);
                    setView('chat');
                  }
                }}
              />
            )}
            {editTabs && (
              <TabsEditor
                all={allViews}
                order={byRank(allViews).map(([id]) => id)}
                hidden={hiddenTabs}
                canHide={actor.admin && actor.name === REQUESTS_TO}
                onSave={(order, hidden) => {
                  api.saveProfile(actor.name, { tabOrder: order });
                  if (actor.admin && actor.name === REQUESTS_TO && hidden.join() !== hiddenTabs.join())
                    api.saveSettings({ hiddenTabs: hidden });
                }}
                onClose={() => setEditTabs(false)}
              />
            )}
            {fullProfileFor && (
              <ProfilePage
                name={fullProfileFor}
                actor={actor}
                tasks={tasks || []}
                shifts={shifts}
                joinedAt={TEAM_STARTED}
                lastSeen={lastSeenOf(fullProfileFor)}
                notes={notes}
                api={api}
                onPerson={(n) => {
                  const from = fullProfileFor;
                  openFrom('full', n, () => setFullProfileFor(from));
                  setFullProfileFor(n);
                }}
                onOpenTask={(id) => {
                  const from = fullProfileFor;
                  openFrom('task', id, () => setFullProfileFor(from));
                  setFullProfileFor(null);
                  setOpenId(id);
                }}
                onEdit={() => {
                  const n = fullProfileFor;
                  openFrom('edit', n, () => setFullProfileFor(n));
                  setEditProfileFor(n);
                  setFullProfileFor(null);
                }}
                onMessage={async () => {
                  const key = await api.openDm([actor.name, fullProfileFor]);
                  clearBack();
                  setFullProfileFor(null);
                  if (key) {
                    setChatChannel(key);
                    setView('chat');
                  }
                }}
                onClose={() => {
                  setFullProfileFor(null);
                  goBack('full', fullProfileFor);
                }}
              />
            )}
            {editProfileFor && (
              <ProfileEditor
                name={editProfileFor}
                actor={actor}
                api={api}
                tasks={tasks || []}
                onClose={() => {
                  setEditProfileFor(null);
                  goBack('edit', editProfileFor);
                }}
              />
            )}
          </div>
          <AdBanner position="bottom" />
          {ads.full &&
            (ads.full.video ? (
              <VideoAd
                key={`${ads.full.ad.id}-${ads.full.n}`}
                ad={ads.full.ad}
                n={ads.full.n}
                total={ads.full.total}
                skip={ads.value.cfg.full.skip}
                onCta={ads.value.cta}
                onNext={ads.closeFull}
              />
            ) : (
              <FullScreenAd key={`${ads.full.ad.id}-${ads.full.n}`} ad={ads.full.ad} onClose={ads.closeFull} />
            ))}
          {ads.game && <GameDialog ad={ads.game} capLeft={ads.gameCapLeft} onPrize={ads.winGame} onClose={ads.closeGame} />}
          {ads.wheel && <PrizeWheel onWin={ads.winWheel} onClose={ads.closeWheel} />}
          {ads.blockWall && (
            <AdBlockWall balance={myWallet.balance} onPay={ads.payBlock} onWatch={ads.watchBlock} onClose={ads.closeBlock} />
          )}
          {coinsOpen && (
            <CoinsDialog
              actor={actor}
              wallet={myWallet}
              roster={roster}
              data={coinData}
              cfg={coinCfg}
              onGift={(g) => (g.amount <= myWallet.balance ? api.addCoins({ type: 'gift', from: actor.name, ...g }) : Promise.resolve())}
              onClose={() => setCoinsOpen(false)}
            />
          )}
          {ads.splash && <TakeoverSplash ad={ads.value.takeover} />}
          {ads.couponShown && <CouponDialog coupon={ads.couponShown} onClose={ads.closeCoupon} />}
          {ads.action && (
            <AdActionDialog
              ad={ads.action}
              first={actor.name.split(' ')[0]}
              onClose={ads.closeAction}
              onPlace={api.placeAdOrder}
              onTrack={(id) => {
                ads.closeAction();
                setTrackId(id);
              }}
            />
          )}
          {ordersOpen && (
            <OrdersDialog
              orders={adOrders}
              onOpen={(id) => {
                setOrdersOpen(false);
                setTrackId(id);
              }}
              onClose={() => setOrdersOpen(false)}
            />
          )}
          {trackOrder && (
            <OrderTracker
              key={trackOrder.id}
              order={trackOrder}
              ad={ads.findAd(trackOrder.adId)}
              onClose={() => setTrackId(null)}
              onCancel={() => {
                setTrackId(null);
                api.deleteAdOrder(trackOrder.id);
              }}
              onAgain={() => {
                setTrackId(null);
                ads.openAction(ads.findAd(trackOrder.adId));
              }}
            />
          )}
          {ads.submitting && (
            <SubmitAdDialog
              mine={adSubs.filter((x) => x.by === actor.name).sort((x, y) => (y.at || 0) - (x.at || 0))}
              onSubmit={api.submitAd}
              onWithdraw={api.withdrawAd}
              onUpload={api.uploadAdImage}
              onClose={ads.closeSubmit}
            />
          )}
          {ads.removing && (
            <RemoveAdsDialog
              prices={coinCfg.prices}
              balance={myWallet.balance}
              coupon={ads.coupon}
              onBuy={ads.buyRemoval}
              onClose={ads.closeRemoving}
            />
          )}
          {commandsPage && (
            <CommandsPage
              cfg={settings.commands}
              channels={convs.channels}
              bank={bank}
              lottery={lottery}
              onSave={(commands) => api.saveSettings({ commands })}
              onClose={() => setCommandsPage(false)}
            />
          )}
          {adsPage && (
            <AdsSettings
              initial={settings.ads}
              roster={roster}
              stats={adStats}
              submissions={adSubs}
              onReview={api.reviewAd}
              onDeleteSubmission={api.deleteAdSubmission}
              preview={ads.preview}
              onPreview={ads.setPreview}
              onShowFull={(ad) => ads.value.showFull(ad)}
              onResetStats={() => store.resetAdStats()}
              onSave={(cfg) => api.saveAdSettings(cfg)}
              coinsInitial={coinCfg}
              onSaveCoins={(c) => JSON.stringify(c) !== JSON.stringify(coinCfg) && api.saveSettings({ coins: c })}
              coinBalances={Object.fromEntries(roster.map((n) => [n, walletOf(n).balance]))}
              ledger={ledger}
              onGrant={(g) => api.addCoins({ type: 'grant', by: actor.name, ...g })}
              onUndoGrant={api.undoCoins}
              competitionDate={competitionDate}
              peopleStats={adPeople}
              onTry={ads.value.tryIt}
              onUploadImage={api.uploadAdImage}
              onClose={() => setAdsPage(false)}
            />
          )}
          {phone && (
            <>
              {taskView && (
                <button className="fab" onClick={() => setNewTask({ status: 'todo' })} aria-label="New task">
                  <PlusIcon size={26} />
                </button>
              )}
              <BottomNav
                views={views}
                view={view}
                setView={(v) => {
                  setPhoneSheet(null);
                  setView(v);
                }}
                badges={{ chat: unreadTotal }}
                moreOn={phoneSheet === 'more'}
                onMore={() => setPhoneSheet(phoneSheet === 'more' ? null : 'more')}
              />
              {phoneSheet === 'more' && <MoreSheet views={views} view={view} setView={setView} onClose={closeSheet} />}
              {phoneSheet === 'filters' && (
                <Sheet title="Filters" onClose={closeSheet}>
                  <div className="sheet-filters">{filterControls}</div>
                  <button className="btn primary big-btn" onClick={closeSheet}>
                    Show tasks
                  </button>
                </Sheet>
              )}
              {phoneSheet === 'me' && (
                <Sheet title="You" onClose={closeSheet}>
                  <div className="me-head">
                    <Avatar name={actor.name} size={48} />
                    <div className="grow">
                      <b>{actor.name}</b>
                      <div>
                        <Countdown date={competitionDate} />
                      </div>
                    </div>
                  </div>
                  <div className="me-list">
                    <button onClick={() => (closeSheet(), setProfileFor(actor.name))}>👤 My profile</button>
                    <button onClick={() => (closeSheet(), setEditProfileFor(actor.name))}>✏️ Edit profile</button>
                    <button onClick={() => (closeSheet(), setShowRequests(true))}>
                      💡 Request a feature {newRequests > 0 && <span className="me-badge">{newRequests}</span>}
                    </button>
                    <button onClick={() => (closeSheet(), setShowHelp(true))}>❓ Help</button>
                    <button onClick={() => (closeSheet(), setCoinsOpen(true))}>
                      🪙 Jackson coins{' '}
                      <span className="me-coins">
                        <Coins n={myWallet.balance} />
                      </span>
                    </button>
                    {adOrders.length > 0 && (
                      <button onClick={() => (closeSheet(), setOrdersOpen(true))}>
                        📦 Orders & bookings {activeOrders > 0 && <span className="me-badge">{activeOrders}</span>}
                      </button>
                    )}
                    <button onClick={() => (closeSheet(), setEditTabs(true))}>🗂 Edit tabs</button>
                    {isOwner && <button onClick={() => (closeSheet(), setAdsPage(true))}>📺 Ads</button>}
                    {isOwner && <button onClick={() => (closeSheet(), setCommandsPage(true))}>🤖 Commands</button>}
                  </div>
                  <ThemeMenu {...themeMenuProps} inline onClose={() => {}} />
                  <UpdateCheck />
                  <button
                    className="btn me-switch"
                    onClick={() => confirm('Switch user? You will need the team code again on this device.') && store.leave()}
                  >
                    Switch user
                  </button>
                </Sheet>
              )}
            </>
          )}
        </div>
      </AdsProvider>
    </PeopleContext.Provider>
  );
}
