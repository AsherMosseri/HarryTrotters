import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROSTER, STATUSES, SUBTEAMS, PRIORITIES, TEAM_NAME } from '../config.js';
import { useLocalStorage } from '../util.js';
import { Avatar, PlusIcon } from './common.jsx';
import TableView from './TableView.jsx';
import BoardView from './BoardView.jsx';
import TaskPanel from './TaskPanel.jsx';
import NewTaskDialog from './NewTaskDialog.jsx';

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

const EMPTY_FILTERS = { q: '', person: '', subteam: '', priority: '', statuses: [], hideDone: false };

export default function Workspace({ store, actor }) {
  const [tasks, setTasks] = useState(null);
  const [people, setPeople] = useState([]);
  const [savedView, setView] = useLocalStorage('view', 'board');
  const view = savedView === 'table' ? 'table' : 'board';
  const [filters, setFilters] = useLocalStorage('filters', EMPTY_FILTERS);
  const [theme, setTheme] = useLocalStorage('theme', 'system');
  const [openId, setOpenId] = useState(null);
  const [newTask, setNewTask] = useState(null);
  const [toast, setToast] = useState('');

  const fail = useCallback((e) => {
    console.error(e);
    setToast(e?.code === 'permission-denied' ? "You don't have permission to do that." : e?.message || 'Something went wrong.');
  }, []);

  useEffect(() => store.subscribeTasks(setTasks, fail), [store, fail]);
  useEffect(() => store.subscribePeople(setPeople, fail), [store, fail]);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const roster = useMemo(() => {
    const names = new Set(ROSTER);
    for (const p of people) if (p.name) names.add(p.name);
    names.add(actor.name);
    return [...names];
  }, [people, actor.name]);

  // Store calls wrapped with the signed-in person and error reporting.
  const api = useMemo(
    () => ({
      create: (data) => store.createTask(data, actor).catch(fail),
      update: (task, patch) => store.updateTask(task.id, patch, actor, task).catch(fail),
      remove: (task) => store.deleteTask(task.id).catch(fail),
      comment: (task, text) => store.addComment(task.id, text, actor).catch(fail),
      subscribeActivity: (id, cb) => store.subscribeActivity(id, cb, fail),
    }),
    [store, actor, fail],
  );

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const q = filters.q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !`${t.title} ${t.description} ${t.subteam} ${(t.assignees || []).join(' ')}`.toLowerCase().includes(q)) return false;
      if (filters.person === '__me' && !(t.assignees || []).includes(actor.name)) return false;
      if (filters.person === '__none' && (t.assignees || []).length) return false;
      if (filters.person && !filters.person.startsWith('__') && !(t.assignees || []).includes(filters.person)) return false;
      if (filters.subteam && t.subteam !== filters.subteam) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.hideDone && t.status === 'done') return false;
      if (view === 'table' && filters.statuses.length && !filters.statuses.includes(t.status)) return false;
      return true;
    });
  }, [tasks, filters, actor.name, view]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s.id, 0]));
    for (const t of tasks || []) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [tasks]);

  const openTask = tasks?.find((t) => t.id === openId) || null;
  const setF = (patch) => setFilters({ ...EMPTY_FILTERS, ...filters, ...patch });
  const anyFilter = filters.q || filters.person || filters.subteam || filters.priority || filters.statuses.length || filters.hideDone;
  const views = [
    ['board', 'Board'],
    ['table', 'Table'],
  ];

  return (
    <div className="app">
      {store.mode === 'demo' && (
        <div className="demo-banner">
          Demo mode — sample data saved only in this browser. <a href="./">Go to the real board</a>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="logo-mark">✓</span>
          <span className="brand-text">
            {TEAM_NAME} <span className="muted">Tasks</span>
          </span>
        </div>
        <nav className="tabs" role="tablist">
          {views.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
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

      <main className="content">
        {tasks === null ? (
          <p className="empty">Loading tasks…</p>
        ) : view === 'table' ? (
          <TableView tasks={filtered} api={api} onOpen={setOpenId} total={tasks.length} />
        ) : (
          <BoardView tasks={filtered} api={api} onOpen={setOpenId} onAdd={(status) => setNewTask({ status })} />
        )}
      </main>

      {openTask && <TaskPanel task={openTask} api={api} roster={roster} onClose={() => setOpenId(null)} />}
      {newTask && (
        <NewTaskDialog
          initial={newTask}
          roster={roster}
          me={actor.name}
          onClose={() => setNewTask(null)}
          onCreate={async (data) => {
            setNewTask(null);
            await api.create(data);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="alert" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </div>
  );
}
