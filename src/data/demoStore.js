// In-browser backend used with ?demo in the URL: no sign-in, data kept in
// localStorage. Handy for trying the UI before Firebase is set up.
import { describeChanges, derivedFields, newTaskDefaults } from './diff.js';
import { ADMIN_EMAILS } from '../config.js';

const KEY = 'ftc32313-demo-v1';
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
      subteam: 'Programming',
      priority: 'urgent',
      dueDate: iso(-1),
    }),
    t('Order 2 more GoBILDA 312 RPM motors', {
      status: 'blocked',
      assignees: ['Sophia Bermudez'],
      subteam: 'Business',
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
      assignees: ['Katrina Jurasic'],
      subteam: 'Portfolio / Notebook',
      priority: 'low',
    }),
    t('Library outreach demo signup', { status: 'done', assignees: ['Matthew Kuhle'], subteam: 'Outreach', priority: 'medium' }),
    t('Driver practice: 10 full matches', {
      status: 'todo',
      assignees: ['Sebastian Tolbert'],
      subteam: 'Drive Practice',
      priority: 'medium',
      dueDate: iso(6),
    }),
  ];
  const activity = {};
  for (const task of tasks) activity[task.id] = [{ id: uid(), type: 'created', by: 'Asher Mosseri', at: task.createdAt }];
  return { tasks, activity, members: [{ id: ADMIN_EMAILS[0], email: ADMIN_EMAILS[0], name: 'Asher Mosseri', addedAt: now }] };
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

const demoUser = { email: ADMIN_EMAILS[0], displayName: 'Asher Mosseri (demo)', photoURL: null };

export const demoStore = {
  mode: 'demo',

  onAuth(cb) {
    cb(demoUser);
    return () => {};
  },
  async signIn() {},
  async signOut() {
    localStorage.removeItem(KEY);
    location.search = '';
  },
  async checkMembership() {
    return { allowed: true, isAdmin: true, name: 'Asher Mosseri' };
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

  subscribeMembers(cb) {
    return listen(() => cb([...state.members]));
  },
  async addMember(email, name) {
    const id = email.trim().toLowerCase();
    state.members = [...state.members.filter((m) => m.id !== id), { id, email: id, name: name.trim(), addedAt: Date.now() }];
    commit();
  },
  async removeMember(email) {
    state.members = state.members.filter((m) => m.id !== email);
    commit();
  },
};
