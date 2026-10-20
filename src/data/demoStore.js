// In-browser backend used with ?demo in the URL: no sign-in, data kept in
// localStorage. Handy for trying the UI before Firebase is set up.
import { describeChanges, derivedFields, newTaskDefaults, newMilestoneDefaults, newPartDefaults, personId } from './diff.js';
import { STARTER_CHECKLISTS, starterItems } from '../checklists.js';

const KEY = 'ftc32313-demo-v6';
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
      assignees: ['Katarina Jurasic'],
      subteam: 'Team Management',
      priority: 'low',
    }),
    t('Library outreach demo signup', { status: 'done', assignees: ['Matthew Kuehl'], subteam: 'Team Management', priority: 'medium' }),
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
    m('CAD revised intake', 'CAD', 0, 6, { owners: ['Shrey Kumar', 'Matthew Kuehl'] }),
    m('Build and assemble revisions', 'Assembly', 7, 15, { owners: ['Cooper Mlezcko', 'Ira Kumar'] }),
    m('Autonomous + TeleOp updates', 'Programming', 10, 19, { owners: ['Katarina Jurasic', 'Asher Mosseri'] }),
    m('Full-robot testing', 'Assembly', 18, 23),
  ];
  tasks[0].milestoneId = milestones[1].id;
  tasks[1].milestoneId = milestones[3].id;
  tasks[3].milestoneId = milestones[2].id;
  tasks[0].checklist = [
    { id: 'c1', text: 'Sketch roller layout', done: true },
    { id: 'c2', text: 'Model side plates', done: true },
    { id: 'c3', text: 'Check clearance with drivetrain', done: false },
  ];
  const p = (name, vendor, qty, unitCost, status, extra = {}) => ({
    id: uid(),
    ...newPartDefaults({ name, vendor, qty, unitCost, status, ...extra }),
  });
  const parts = [
    p('5203 Yellow Jacket motor, 312 RPM', 'goBILDA', 2, 39.99, 'needed', { subteam: 'Mechanical', taskId: tasks[2].id }),
    p('Smart Robot Servo', 'REV Robotics', 3, 34.0, 'ordered', { subteam: 'Assembly' }),
    p('1/4" ID polycarbonate tubing, 1 ft', 'McMaster-Carr', 4, 6.5, 'arrived', { subteam: 'Mechanical' }),
  ];
  const checklists = STARTER_CHECKLISTS.slice(0, 2).map((c) => ({ id: uid(), title: c.title, items: starterItems(c) }));
  return { tasks, activity, people: [], milestones, roles: [], parts, checklists };
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
    // ?demo=member previews the app as a regular teammate.
    const asMember = new URLSearchParams(location.search).get('demo') === 'member';
    return asMember ? { name: 'Cooper Mlezcko', admin: false } : { name: 'Asher Mosseri', admin: true };
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

  // Demo keeps only the thumbnail, as a data URL, so localStorage doesn't fill up.
  async addTaskPhoto(taskId, { thumb, width, height }, actor) {
    const dataUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(thumb);
    });
    const photo = { id: uid(), url: dataUrl, thumbUrl: dataUrl, width, height, by: actor.name, at: Date.now() };
    state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, photos: [...(t.photos || []), photo] } : t));
    (state.activity[taskId] ||= []).push({ id: uid(), type: 'change', field: 'photos', to: 'added', by: actor.name, at: Date.now() });
    commit();
  },
  async removeTaskPhoto(taskId, photo, actor) {
    state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, photos: (t.photos || []).filter((p) => p.id !== photo.id) } : t));
    (state.activity[taskId] ||= []).push({ id: uid(), type: 'change', field: 'photos', to: 'removed', by: actor.name, at: Date.now() });
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

  subscribeNames(cb) {
    return listen(() => cb({ ...(state.renames || {}) }));
  },
  async renamePerson(oldName, newName, { renames, tasks, milestones, role }, actor) {
    const swap = (list) => list.map((n) => (n === oldName ? newName : n));
    const taskIds = new Set(tasks.map((t) => t.id));
    const msIds = new Set(milestones.map((m) => m.id));
    state.renames = { ...(state.renames || {}), ...renames };
    state.tasks = state.tasks.map((t) => (taskIds.has(t.id) ? { ...t, assignees: swap(t.assignees) } : t));
    state.milestones = state.milestones.map((m) => (msIds.has(m.id) ? { ...m, owners: swap(m.owners) } : m));
    state.roles = [
      ...(state.roles || []).filter((r) => r.id !== personId(oldName) && r.id !== personId(newName)),
      { id: personId(newName), ...role, name: newName, removed: false, updatedBy: actor.name },
    ];
    commit();
  },

  subscribeSettings(cb) {
    return listen(() => cb({ ...(state.settings || {}) }));
  },
  async saveSettings(patch) {
    state.settings = { ...(state.settings || {}), ...patch };
    commit();
  },

  subscribeParts(cb) {
    return listen(() => cb([...(state.parts || [])]));
  },
  async createPart(data, actor) {
    state.parts = [...(state.parts || []), { id: uid(), ...newPartDefaults(data), createdBy: actor.name, updatedAt: Date.now() }];
    commit();
  },
  async updatePart(id, patch, actor) {
    state.parts = state.parts.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now(), updatedBy: actor.name } : p));
    commit();
  },
  async deletePart(id) {
    state.parts = state.parts.filter((p) => p.id !== id);
    commit();
  },

  subscribeChecklists(cb) {
    return listen(() => cb((state.checklists || []).map((c) => ({ ...c, items: { ...c.items } }))));
  },
  async createChecklist(data, actor) {
    state.checklists = [
      ...(state.checklists || []),
      { id: uid(), title: '', items: {}, ...data, createdAt: Date.now(), createdBy: actor.name },
    ];
    commit();
  },
  async renameChecklist(id, title) {
    state.checklists = state.checklists.map((c) => (c.id === id ? { ...c, title } : c));
    commit();
  },
  async setChecklistItem(id, item) {
    state.checklists = state.checklists.map((c) => (c.id === id ? { ...c, items: { ...c.items, [item.id]: item } } : c));
    commit();
  },
  async patchChecklistItems(id, patches) {
    state.checklists = state.checklists.map((c) => {
      if (c.id !== id) return c;
      const items = { ...c.items };
      for (const [itemId, patch] of Object.entries(patches)) items[itemId] = { ...items[itemId], ...patch };
      return { ...c, items };
    });
    commit();
  },
  async removeChecklistItem(id, itemId) {
    state.checklists = state.checklists.map((c) => {
      if (c.id !== id) return c;
      const items = { ...c.items };
      delete items[itemId];
      return { ...c, items };
    });
    commit();
  },
  async deleteChecklist(id) {
    state.checklists = state.checklists.filter((c) => c.id !== id);
    commit();
  },
};
