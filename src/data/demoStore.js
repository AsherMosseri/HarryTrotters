// In-browser backend used with ?demo in the URL: no sign-in, data kept in
// localStorage. Handy for trying the UI before Firebase is set up.
import { describeChanges, derivedFields, newTaskDefaults, newMilestoneDefaults } from './diff.js';

const KEY = 'ftc32313-demo-v3';
const listeners = new Set();
const uid = () => Math.random().toString(36).slice(2, 11);

function seed() {
  const now = Date.now();
  const day = 86400000;
  const iso = (offset) => new Date(now + offset * day).toISOString().slice(0, 10);
  const t = (title, extra) => ({
    id: uid(),
    ...newTaskDefaults({ title, ...extra }),
    createdAt: now - 5 * day,
    createdBy: 'Asher Mosseri',
    updatedAt: now - day,
    updatedBy: 'Asher Mosseri',
    completedAt: extra.status === 'done' ? now - day : null,
  });
  const tasks = [
    t('Finish intake roller CAD', {
      status: 'in_progress',
      assignees: ['Cooper Mlezcko'],
      subteam: 'CAD',
      priority: 'high',
      dueDate: iso(2),
    }),
    t('Tune autonomous path for left start', {
      status: 'todo',
      assignees: ['Jackson Lucks', 'Asher Mosseri'],
      subteam: '',
      priority: 'urgent',
      dueDate: iso(-1),
    }),
    t('Order 2 more GoBILDA 312 RPM motors', {
      status: 'blocked',
      assignees: ['Sophia Bermudez'],
      subteam: 'Team Management',
      priority: 'high',
      blockedReason: 'Waiting on coach to approve purchase order',
    }),
    t('Rewire control hub with labeled cables', {
      status: 'testing',
      assignees: ['Michael Meidan'],
      subteam: 'Electrical',
      priority: 'medium',
      dueDate: iso(4),
    }),
    t('Write portfolio page on drivetrain design', {
      status: 'backlog',
      assignees: ['Kasha Jurasic'],
      subteam: 'Team Management',
      priority: 'low',
    }),
    t('Library outreach demo signup', { status: 'done', assignees: ['Matthew Kuhle'], subteam: 'Team Management', priority: 'medium' }),
    t('Driver practice: 10 full matches', {
      status: 'todo',
      assignees: ['Sebastian Tolbert'],
      subteam: 'Assembly',
      priority: 'medium',
      dueDate: iso(6),
    }),
  ];
  const activity = {};
  for (const task of tasks) activity[task.id] = [{ id: uid(), type: 'created', by: 'Asher Mosseri', at: task.createdAt }];
  const m = (title, subteam, start, end, extra = {}) => ({
    id: uid(),
    ...newMilestoneDefaults({ title, subteam, start: iso(start), end: iso(end), ...extra }),
  });
  const milestones = [
    m('Review robot and pick revisions', 'Team Management', -1, 1, { owners: ['Sebastian Tolbert'], done: true }),
    m('CAD revised intake', 'CAD', 0, 6, { owners: ['Shrey', 'Matthew Kuhle'] }),
    m('Build and assemble revisions', 'Assembly', 7, 15, { owners: ['Cooper Mlezcko', 'Ira'] }),
    m('Autonomous + TeleOp updates', 'Programming', 10, 19, { owners: ['Kasha Jurasic', 'Asher Mosseri'] }),
    m('Full-robot testing', 'Assembly', 18, 23),
  ];
  tasks[0].milestoneId = milestones[1].id;
  tasks[1].milestoneId = milestones[3].id;
  tasks[3].milestoneId = milestones[2].id;
  return { tasks, activity, people: [], milestones, roles: [] };
}

let state;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || seed();
} catch {
  state = seed();
}

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep in memory */
  }
  for (const fn of listeners) fn();
}

function listen(fn) {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

export const demoStore = {
  mode: 'demo',

  onAuth(cb) {
    cb({ uid: 'demo' });
    return () => {};
  },
  async getMember() {
    return 'Asher Mosseri';
  },
  async join() {},
  async leave() {
    localStorage.removeItem(KEY);
    location.search = '';
  },
  subscribePeople(cb) {
    return listen(() => cb([...(state.people || [])]));
  },

  subscribeTasks(cb) {
    return listen(() => cb(state.tasks.map((t) => ({ ...t }))));
  },

  async createTask(data, actor) {
    const now = Date.now();
    const task = {
      id: uid(),
      ...newTaskDefaults(data),
      createdAt: now,
      createdBy: actor.name,
      updatedAt: now,
      updatedBy: actor.name,
      completedAt: data.status === 'done' ? now : null,
    };
    state.tasks.push(task);
    state.activity[task.id] = [{ id: uid(), type: 'created', by: actor.name, at: now }];
    commit();
    return task.id;
  },

  async updateTask(id, patch, actor, prev) {
    const changes = describeChanges(prev, patch);
    if (!changes.length) return;
    const now = Date.now();
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, ...patch, ...derivedFields(prev, patch, now), updatedAt: now, updatedBy: actor.name } : t,
    );
    const log = (state.activity[id] ||= []);
    for (const c of changes) log.push({ id: uid(), ...c, by: actor.name, at: now });
    commit();
  },

  async deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    delete state.activity[id];
    commit();
  },

  subscribeActivity(taskId, cb) {
    return listen(() => cb([...(state.activity[taskId] || [])]));
  },

  async addComment(taskId, text, actor) {
    (state.activity[taskId] ||= []).push({ id: uid(), type: 'comment', text, by: actor.name, at: Date.now() });
    state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, commentCount: (t.commentCount || 0) + 1 } : t));
    commit();
  },

  subscribeMilestones(cb) {
    return listen(() => cb([...(state.milestones || [])]));
  },
  async createMilestone(data, actor) {
    const now = Date.now();
    const ms = { id: uid(), ...newMilestoneDefaults(data), createdAt: now, createdBy: actor.name, updatedAt: now, updatedBy: actor.name };
    state.milestones = [...(state.milestones || []), ms];
    commit();
    return ms.id;
  },
  async updateMilestone(id, patch, actor) {
    state.milestones = state.milestones.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now(), updatedBy: actor.name } : m));
    commit();
  },
  async deleteMilestone(id, taskIds) {
    state.milestones = state.milestones.filter((m) => m.id !== id);
    state.tasks = state.tasks.map((t) => (taskIds.includes(t.id) ? { ...t, milestoneId: '' } : t));
    commit();
  },

  subscribeRoles(cb) {
    return listen(() => cb([...(state.roles || [])]));
  },
  async saveRole(id, data, actor) {
    state.roles = [...(state.roles || []).filter((r) => r.id !== id), { id, ...data, updatedAt: Date.now(), updatedBy: actor.name }];
    commit();
  },
};
