import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPETITION, ROSTER, STATUSES, SUBTEAMS, PRIORITIES, TEAM_NAME, fixName } from '../config.js';
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
  ['milestones', 'Milestones'],
  ['parts', 'Parts'],
  ['checklists', 'Checklists'],
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

const withFixedNames = (t) => (t.assignees?.some((n) => fixName(n) !== n) ? { ...t, assignees: t.assignees.map(fixName) } : t);

const EMPTY_FILTERS = { q: '', person: '', subteam: '', priority: '', statuses: [], hideDone: false };

export default function Workspace({ store, actor }) {
  const [tasks, setTasks] = useState(null);
  const [people, setPeople] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [roles, setRoles] = useState([]);
  const [parts, setParts] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [settings, setSettings] = useState({});
  const [cat, setCat] = useState(false);
  const [savedView, setView] = useLocalStorage('view', 'board');
  const view = VIEWS.some(([id]) => id === savedView) ? savedView : 'board';
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
  const loadFail = useCallback(
    (what) => (e) => {
      console.error(what, e);
      const why =
        e?.code === 'permission-denied' ? 'the database rules need updating (ask team management)' : e?.message || 'unknown error';
      setToast({ text: `Couldn't load ${what}: ${why}.` });
    },
    [],
  );

  useEffect(
    () =>
      store.subscribeTasks(
        (ts) => {
          setTasksError('');
          setTasks(ts.map(withFixedNames));
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
  const competitionDate = settings.competitionDate || COMPETITION.date;

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Default roster + people the manager added + anyone who joined under their
  // own name, minus people the manager removed.
  const roster = useMemo(() => {
    const removed = new Set(roles.filter((r) => r.removed).map((r) => r.name));
    const names = new Set(ROSTER);
    for (const r of roles) if (r.name) names.add(fixName(r.name));
    for (const p of people) if (p.name) names.add(fixName(p.name));
    return [...names].filter((n) => !removed.has(n) || n === actor.name);
  }, [people, roles, actor.name]);

  // Lets api.create see the current filters without rebuilding api on every change.
  const filterState = useRef();
  filterState.current = { filters, view, taskView };

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
      remove: (task) => store.deleteTask(task.id, task.photos || []).catch(fail),
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
    }),
    [store, actor, fail, setFilters],
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
  const setF = (patch) => setFilters({ ...EMPTY_FILTERS, ...filters, ...patch });
  const anyFilter = filters.q || filters.person || filters.subteam || filters.priority || filters.statuses.length || filters.hideDone;

  return (
    <div className="app">
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
          {VIEWS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <Countdown date={competitionDate} />
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
      ) : view === 'team' ? (
        <TeamView roster={roster} roles={roles} tasks={tasks} api={api} isManager={actor.admin} />
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
