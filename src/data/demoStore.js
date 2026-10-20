// In-browser backend used with ?demo in the URL: no sign-in, data kept in
// localStorage. Handy for trying the UI before Firebase is set up.
import {
  describeChanges,
  derivedFields,
  newTaskDefaults,
  newMilestoneDefaults,
  newPartDefaults,
  newRunDefaults,
  personId,
} from './diff.js';
import { STARTER_CHECKLISTS, starterItems } from '../checklists.js';

const KEY = 'ftc32313-demo-v12';
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
  const r = (offset, type, auto, teleop, endgame, extra = {}) => ({
    id: uid(),
    ...newRunDefaults({ date: iso(offset), type, auto, teleop, endgame, drivers: ['Sebastian Tolbert', 'Jackson Lucks'], ...extra }),
    createdAt: now + offset * day,
  });
  const runs = [
    r(-9, 'practice', 10, 42, 8, { issues: 'Intake jammed twice' }),
    r(-8, 'practice', 15, 48, 10),
    r(-6, 'practice', 15, 40, 0, { issues: 'Lift string snapped' }),
    r(-5, 'practice', 20, 55, 15),
    r(-3, 'practice', 25, 58, 15),
    r(-2, 'match', 20, 61, 20, { matchNumber: 'Q4', result: 'win' }),
    r(-1, 'practice', 30, 64, 20),
  ];
  const msg = (minsAgo, by, text, extra = {}) => ({
    id: uid(),
    text,
    by,
    byUid: by,
    at: now - minsAgo * 60000,
    mentions: [],
    taskIds: [],
    replyTo: null,
    photo: null,
    reactions: {},
    ...extra,
  });
  const chat = {
    announcements: [
      msg(45, 'Sebastian Tolbert', 'Inspection practice Thursday at 4pm. Everyone bring safety glasses 🥽', { byUid: 'sebastian' }),
    ],
    general: [
      msg(180, 'Sebastian Tolbert', 'Practice moved to 4pm tomorrow, everyone bring safety glasses'),
      msg(170, 'Sophia Bermudez', 'got it 👍', { reactions: { '👍': { 'Jackson Lucks': 'Jackson Lucks' } } }),
      msg(30, 'Cooper Mlezcko', '@Asher Mosseri can you check the auto path before practice?', {
        mentions: ['Asher Mosseri'],
        taskIds: [tasks[1].id],
      }),
    ],
    assembly: [msg(60, 'Ira Kumar', 'Intake side plates are printed')],
    programming: [
      msg(
        240,
        'Katarina Jurasic',
        '## Auto plan for Saturday\n- **Left start:** score preload, park\n- *Right start:* 2 samples\n> Test both before 5pm\n-# updated after Tuesday practice',
        {
          pinned: true,
          pinnedBy: 'Asher Mosseri',
          pinnedAt: now - 200 * 60000,
        },
      ),
      msg(90, 'Michael Meidan', 'Which day works for the code review?', {
        poll: {
          question: 'Which day works for the code review?',
          multi: false,
          options: [
            { id: 'a', text: 'Thursday' },
            { id: 'b', text: 'Friday' },
            { id: 'c', text: 'Saturday' },
          ],
        },
        votes: {
          a: { 'katarina-jurasic': 'Katarina Jurasic' },
          c: { 'michael-meidan': 'Michael Meidan', 'asher-mosseri': 'Asher Mosseri' },
        },
      }),
      msg(20, 'Michael Meidan', 'Odometry docs: https://gm0.org/en/latest/docs/software/concepts/odometry.html ||spoiler: it works now||', {
        preview: {
          url: 'https://gm0.org/en/latest/docs/software/concepts/odometry.html',
          site: 'gm0.org',
          title: 'Odometry — Game Manual 0',
          description: 'A guide to odometry for FTC robots: dead wheels, localization, and tuning.',
        },
      }),
    ],
    'dm:asher-mosseri--cooper-mlezcko': [msg(15, 'Cooper Mlezcko', 'hey, can you send me the intake CAD link?', { byUid: 'cooper' })],
  };
  const dms = [
    {
      id: 'asher-mosseri--cooper-mlezcko',
      people: ['Asher Mosseri', 'Cooper Mlezcko'],
      name: '',
      createdBy: 'Cooper Mlezcko',
      createdAt: now - 15 * 60000,
      lastAt: now - 15 * 60000,
      lastBy: 'Cooper Mlezcko',
      lastText: 'hey, can you send me the intake CAD link?',
    },
  ];
  const profiles = [
    { id: 'sebastian-tolbert', name: 'Sebastian Tolbert', status: { emoji: '🔧', text: 'at the shop' }, updatedAt: now },
    { id: 'katarina-jurasic', name: 'Katarina Jurasic', status: { emoji: '💻', text: 'tuning auto' }, updatedAt: now },
  ];
  const robot = {
    versions: [
      { id: 'sample-1', name: 'v1 – original robot', notes: 'Built-in sample model', sample: 1, by: 'Shrey Kumar', at: now - 6 * day },
      { id: 'sample-2', name: 'v2 – raised intake + claw', notes: 'Built-in sample model', sample: 2, by: 'Matthew Kuehl', at: now - day },
    ],
    pins: [
      {
        id: uid(),
        versionId: 'sample-2',
        key: 'Intake/Intake Roller',
        point: [0, 0.028, 0],
        text: 'Roller slips on the hex shaft, add a set screw',
        taskId: tasks[0].id,
        partId: '',
        resolved: false,
        by: 'Cooper Mlezcko',
        byUid: 'Cooper Mlezcko',
        at: now - 3 * 3600000,
      },
    ],
    layouts: [],
  };
  // Sample notifications, the same for whoever the demo signs in as.
  const inbox = [
    {
      id: uid(),
      type: 'announcement',
      title: 'Announcement from Sebastian',
      body: chat.announcements?.[0]?.text || 'Team meeting Friday',
      open: 'chat:announcements',
      at: now - 2 * 3600000,
      read: false,
    },
    {
      id: uid(),
      type: 'assigned',
      title: 'Asher gave you a task',
      body: tasks[0].title,
      open: `task:${tasks[0].id}`,
      at: now - 5 * 3600000,
      read: false,
    },
    {
      id: uid(),
      type: 'mention',
      title: 'Jackson mentioned you in #assembly',
      body: 'Can you check the drivetrain bolts?',
      open: 'chat:assembly',
      at: now - day,
      read: true,
    },
    { id: uid(), type: 'due', title: 'Due tomorrow', body: tasks[1].title, open: `task:${tasks[1].id}`, at: now - 1.5 * day, read: true },
  ];
  return {
    tasks,
    activity,
    people: [],
    milestones,
    roles: [],
    parts,
    checklists,
    runs,
    chat,
    robot,
    inbox,
    dms,
    profiles,
    channels: [],
    emoji: [],
  };
}

// Demo uploads: version id -> object URL (not saved across reloads).
const demoFiles = new Map();

const dataUrl = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });

function updateMsg(conv, id, fn) {
  state.chat = { ...state.chat, [conv]: (state.chat[conv] || []).map((m) => (m.id === id ? fn(m) : m)) };
  commit();
}

function demoPreview(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { url, site: host, title: `A page on ${host}`, description: 'Link previews are made by the server on the real board.' };
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
  subscribeInbox(name, cb) {
    return listen(() => cb([...(state.inbox || [])].sort((a, b) => b.at - a.at)));
  },
  async markInboxRead(name, ids) {
    state.inbox = (state.inbox || []).map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
    commit();
  },
  async clearInbox(name, ids) {
    state.inbox = (state.inbox || []).filter((n) => !ids.includes(n.id));
    commit();
  },
  pushStatus: () => 'demo',
  async enablePush() {
    return 'demo';
  },
  async disablePush() {
    return 'demo';
  },
  async refreshPush() {},

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

  async trashTask(id, actor, restore = false) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, deletedAt: restore ? null : Date.now(), deletedBy: restore ? '' : actor.name } : t,
    );
    (state.activity[id] ||= []).push({
      id: uid(),
      type: 'change',
      field: 'deleted',
      to: restore ? 'restored' : 'deleted',
      by: actor.name,
      at: Date.now(),
    });
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

  async mergeRenames(map) {
    state.renames = { ...(state.renames || {}), ...map };
    commit();
  },
  subscribeNames(cb) {
    return listen(() => cb({ ...(state.renames || {}) }));
  },
  async renamePerson(oldName, newName, { renames, tasks, milestones, role }, actor) {
    const swap = (list) => list.map((n) => (n === oldName ? newName : n));
    state.dms = (state.dms || []).map((d) => ({ ...d, people: swap(d.people) }));
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

  subscribeRuns(cb) {
    return listen(() => cb([...(state.runs || [])]));
  },
  async createRun(data, actor) {
    state.runs = [...(state.runs || []), { id: uid(), ...newRunDefaults(data), createdAt: Date.now(), createdBy: actor.name }];
    commit();
  },
  async updateRun(id, patch, actor) {
    state.runs = state.runs.map((r) => (r.id === id ? { ...r, ...patch, updatedBy: actor.name } : r));
    commit();
  },
  async deleteRun(id) {
    state.runs = state.runs.filter((r) => r.id !== id);
    commit();
  },

  // Chat: messages kept per conversation (channel id or 'dm:<id>'); photos
  // stored as small data URLs.
  subscribeChannel(conv, count, cb) {
    return listen(() => cb([...((state.chat || {})[conv] || [])].sort((a, b) => a.at - b.at).slice(-count)));
  },
  async loadOlderMessages(conv, beforeAt, count) {
    return [...((state.chat || {})[conv] || [])]
      .filter((m) => m.at < beforeAt)
      .sort((a, b) => a.at - b.at)
      .slice(-count);
  },
  async recentMessages(conv, count) {
    return [...((state.chat || {})[conv] || [])].sort((a, b) => b.at - a.at).slice(0, count);
  },
  async sendMessage(conv, data, actor, photoFiles) {
    let photo = null;
    if (photoFiles) {
      const url = await dataUrl(photoFiles.thumb);
      photo = { id: uid(), url, thumbUrl: url, width: photoFiles.width, height: photoFiles.height };
    }
    const m = {
      id: uid(),
      text: '',
      mentions: [],
      taskIds: [],
      replyTo: null,
      reactions: {},
      ...data,
      photo,
      by: actor.name,
      byUid: actor.uid,
      at: Date.now(),
    };
    // Pretend the server found a preview for the first link.
    const link = /https?:\/\/[^\s<>()]+/.exec(m.text || '')?.[0];
    if (link) m.preview = demoPreview(link);
    state.chat = { ...(state.chat || {}), [conv]: [...((state.chat || {})[conv] || []), m] };
    if (conv.startsWith('dm:'))
      state.dms = state.dms.map((d) =>
        `dm:${d.id}` === conv ? { ...d, lastAt: m.at, lastBy: actor.name, lastText: m.text || 'Photo' } : d,
      );
    commit();
  },
  async uploadChatGif(conv, file) {
    if (file.size > 1.5e6) throw new Error('Demo mode only keeps GIFs under 1.5 MB.');
    return { url: await dataUrl(file) };
  },
  async editMessage(conv, id, patch) {
    updateMsg(conv, id, (m) => ({ ...m, ...patch, editedAt: Date.now() }));
  },
  async deleteMessage(conv, msg) {
    updateMsg(conv, msg.id, (m) => ({
      ...m,
      deleted: true,
      text: '',
      photo: null,
      gif: null,
      poll: null,
      preview: null,
      taskIds: [],
      mentions: [],
      reactions: {},
      votes: {},
      pinned: false,
    }));
  },
  async react(conv, id, emoji, actor, on) {
    updateMsg(conv, id, (m) => {
      const who = { ...((m.reactions || {})[emoji] || {}) };
      if (on) who[actor.uid] = actor.name;
      else delete who[actor.uid];
      return { ...m, reactions: { ...m.reactions, [emoji]: who } };
    });
  },
  async removeReaction(conv, id, emoji) {
    updateMsg(conv, id, (m) => {
      const reactions = { ...m.reactions };
      delete reactions[emoji];
      return { ...m, reactions };
    });
  },
  async vote(conv, msg, optionId, actor, on) {
    const me = personId(actor.name);
    updateMsg(conv, msg.id, (m) => {
      const votes = Object.fromEntries(Object.entries(m.votes || {}).map(([k, v]) => [k, { ...v }]));
      if (on && !m.poll.multi) for (const k of Object.keys(votes)) delete votes[k][me];
      votes[optionId] = votes[optionId] || {};
      if (on) votes[optionId][me] = actor.name;
      else delete votes[optionId][me];
      return { ...m, votes };
    });
  },
  async pin(conv, id, on, actor) {
    updateMsg(conv, id, (m) => ({ ...m, pinned: on, pinnedBy: on ? actor.name : '', pinnedAt: on ? Date.now() : 0 }));
  },
  subscribePins(conv, cb) {
    return listen(() => cb(((state.chat || {})[conv] || []).filter((m) => m.pinned)));
  },
  async hidePreview(conv, id) {
    updateMsg(conv, id, (m) => ({ ...m, preview: false }));
  },

  subscribeChannels(cb) {
    return listen(() => cb([...(state.channels || [])]));
  },
  async saveChannel(id, data) {
    const rest = (state.channels || []).filter((c) => c.id !== id);
    const prev = (state.channels || []).find((c) => c.id === id) || {};
    state.channels = [...rest, { ...prev, ...data, id }];
    commit();
  },

  subscribeDms(actor, all, cb) {
    return listen(() => cb((state.dms || []).filter((d) => all || d.people.includes(actor.name))));
  },
  async openDm(people, actor, name = '') {
    const sorted = [...new Set(people)].sort();
    const id = sorted.length === 2 ? sorted.map(personId).join('--') : uid();
    if (!(state.dms || []).some((d) => d.id === id)) {
      state.dms = [
        ...(state.dms || []),
        { id, people: sorted, name, createdBy: actor.name, createdAt: Date.now(), lastAt: Date.now(), lastBy: '', lastText: '' },
      ];
      commit();
    }
    return `dm:${id}`;
  },
  async renameDm(id, name) {
    state.dms = state.dms.map((d) => (d.id === id ? { ...d, name } : d));
    commit();
  },

  subscribeProfiles(cb) {
    return listen(() => cb([...(state.profiles || [])]));
  },
  async saveProfile(name, patch) {
    const id = personId(name);
    const prev = (state.profiles || []).find((p) => p.id === id) || {};
    const merged = { ...prev, ...patch, id, name, updatedAt: Date.now() };
    if (patch.notify) merged.notify = { ...(prev.notify || {}), ...patch.notify };
    state.profiles = [...(state.profiles || []).filter((p) => p.id !== id), merged];
    commit();
  },
  async uploadAvatar(name, blob) {
    const photo = { url: await dataUrl(blob), path: '' };
    await this.saveProfile(name, { photo });
    return photo;
  },
  async removeAvatar(name) {
    await this.saveProfile(name, { photo: null });
  },

  // A few teammates look online, and one is "typing" in #general.
  subscribePresence(cb) {
    return listen(() => {
      const now = Date.now();
      cb([
        ...(state.presence || []),
        { id: 'p-seb', name: 'Sebastian Tolbert', at: now },
        { id: 'p-cooper', name: 'Cooper Mlezcko', at: now, typing: 'general', typingAt: now + 3600000 },
        { id: 'p-sophia', name: 'Sophia Bermudez', at: now - 60000 },
      ]);
    });
  },
  async setPresence(actor, patch) {
    state.presence = [...(state.presence || []).filter((p) => p.id !== actor.uid), { id: actor.uid, name: actor.name, ...patch }];
    // Presence isn't saved, so skip localStorage and just notify.
    for (const fn of listeners) fn();
  },

  subscribeEmoji(cb) {
    return listen(() => cb([...(state.emoji || [])]));
  },
  async addEmoji(name, file, actor) {
    if (file.size > 300000) throw new Error('Demo mode only keeps emoji under 300 KB.');
    state.emoji = [
      ...(state.emoji || []).filter((e) => e.id !== name),
      { id: name, name, url: await dataUrl(file), path: '', by: actor.name, at: Date.now() },
    ];
    commit();
  },
  async deleteEmoji(e) {
    state.emoji = (state.emoji || []).filter((x) => x.id !== e.id);
    commit();
  },

  // Robot: uploaded files stay in memory only (they disappear on reload).
  subscribeRobot(cb) {
    return listen(() => {
      const r = state.robot || { versions: [], pins: [], layouts: [] };
      cb({
        versions: r.versions.filter((v) => v.sample || demoFiles.has(v.id)).map((v) => ({ ...v, url: demoFiles.get(v.id) })),
        pins: [...r.pins],
        layouts: [...r.layouts],
      });
    });
  },
  async uploadRobotVersion(file, meta, actor, onProgress) {
    const id = uid();
    demoFiles.set(id, URL.createObjectURL(file));
    onProgress?.(1);
    state.robot.versions = [...state.robot.versions, { id, ...meta, size: file.size, by: actor.name, byUid: actor.uid, at: Date.now() }];
    commit();
  },
  async deleteRobotVersion(version) {
    state.robot.versions = state.robot.versions.filter((v) => v.id !== version.id);
    state.robot.pins = state.robot.pins.filter((p) => p.versionId !== version.id);
    state.robot.layouts = state.robot.layouts.filter((l) => l.versionId !== version.id);
    commit();
  },
  async createRobotPin(data, actor) {
    state.robot.pins = [
      ...state.robot.pins,
      { id: uid(), resolved: false, taskId: '', partId: '', ...data, by: actor.name, byUid: actor.uid, at: Date.now() },
    ];
    commit();
  },
  async updateRobotPin(id, patch) {
    state.robot.pins = state.robot.pins.map((p) => (p.id === id ? { ...p, ...patch } : p));
    commit();
  },
  async deleteRobotPin(id) {
    state.robot.pins = state.robot.pins.filter((p) => p.id !== id);
    commit();
  },
  async saveRobotLayout(data, actor) {
    state.robot.layouts = [...state.robot.layouts, { id: uid(), ...data, by: actor.name, byUid: actor.uid, at: Date.now() }];
    commit();
  },
  async deleteRobotLayout(id) {
    state.robot.layouts = state.robot.layouts.filter((l) => l.id !== id);
    commit();
  },
};
