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
import { REQUESTS_TO } from '../config.js';
import { deliver } from '../adOrders.js';
import * as casino from '../../functions/shared/casino.js';
import { dayOf } from '../labLog.js';
import * as arcade from '../../functions/shared/arcade.js';
import { blocked, serverGroup } from '../../functions/shared/commandRules.js';
import { giftEntry, prizeEntry, teamDay } from '../../functions/shared/coins.js';

const KEY = 'ftc32313-demo-v13';
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
    {
      id: 'sebastian-tolbert',
      name: 'Sebastian Tolbert',
      status: { emoji: '🔧', text: 'at the lab' },
      decoration: 'crown',
      effect: 'sparkles',
      nameStyle: { font: 'chunky', colors: ['#f97316', '#db2777'] },
      theme: { a: '#f97316', b: '#7c3aed' },
      about: 'Team management, logistics, and assembly. Ask me about parts orders.',
      pronouns: 'he/him',
      updatedAt: now,
    },
    {
      id: 'katarina-jurasic',
      name: 'Katarina Jurasic',
      status: { emoji: '💻', text: 'tuning auto' },
      decoration: 'rainbow',
      nameStyle: { font: 'script', colors: ['#22c55e'] },
      about: 'Programming. Autonomous is my thing.',
      updatedAt: now,
    },
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
  const shifts = demoShifts(now);
  const lab = demoLabLog(shifts, tasks);
  return {
    tasks,
    activity,
    people: [],
    milestones,
    roles: [],
    parts,
    checklists,
    runs,
    chat: { ...chat, 'lab-log': lab.posts },
    labLogs: lab.logs,
    robot,
    inbox,
    dms,
    profiles,
    channels: [],
    emoji: [],
    stickers: [],
    shifts,
    shiftPlans: demoPlans(),
    requests: [
      {
        id: uid(),
        text: 'A timer for driver practice that logs the run in the Match Log when it ends.',
        by: 'Sophia Bermudez',
        at: now - 26 * 3600000,
        status: 'planned',
        votes: { 'Sophia Bermudez': true, 'Jackson Lucks': true, 'Michael Meidan': true },
        reply: 'Good one. Adding it after the next competition.',
        updatedBy: 'Asher Mosseri',
      },
      {
        id: uid(),
        text: 'Dark mode for the robot viewer',
        by: 'Jackson Lucks',
        at: now - 4 * 86400000,
        status: 'done',
        votes: { 'Jackson Lucks': true },
        reply: 'Added in 2.2.',
        updatedBy: 'Asher Mosseri',
      },
    ],
  };
}

// Sample shifts: a few past ones this week and last, and Cooper at the lab now.
// Sample lab logs for the sample shifts that already ended, and #lab-log's
// post for each of those days (the onLabLog function makes these for real).
function demoLabLog(shifts, tasks) {
  const NOTES = {
    'Asher Mosseri': [
      'Tuned the autonomous path for the left start. It hits the backdrop 4 out of 5 times now.',
      'Planned the next two weeks with the leads and updated the milestones.',
    ],
    'Sebastian Tolbert': ['Mounted the shooter and re-tightened the drivetrain set screws.'],
    'Jackson Lucks': ['Labeled every wire on the Control Hub and redid the battery connector.'],
    'Cooper Mlezcko': ['Rebuilt the drivetrain: new bearings on the left side, and it drives straight again.'],
    'Sophia Bermudez': ['Finished the intake roller CAD and exported the plates for cutting.'],
    'Michael Meidan': ['Started the arm pivot in CAD.'],
  };
  const extra = {
    'Asher Mosseri': { next: 'Try the right start, and record a video for the portfolio.' },
    'Jackson Lucks': { blockers: 'Waiting on the new Anderson connectors to arrive.' },
    'Cooper Mlezcko': { next: 'Check the motor temperatures after a full match run.' },
  };
  const logs = [];
  const used = {};
  for (const sh of shifts.filter((x) => x.end)) {
    const day = dayOf(sh.start);
    const id = `${day}_${personId(sh.person)}`;
    if (logs.some((l) => l.id === id)) continue;
    const i = (used[sh.person] = (used[sh.person] ?? -1) + 1);
    const notes = NOTES[sh.person] || ['Helped out around the lab.'];
    const mine = tasks.filter((t) => (t.assignees || []).includes(sh.person)).slice(0, 1);
    logs.push({
      id,
      day,
      person: sh.person,
      uid: 'demo',
      note: notes[i % notes.length],
      taskIds: mine.map((t) => t.id),
      doneTaskIds: [],
      photos: [],
      blockers: i === 0 ? extra[sh.person]?.blockers || '' : '',
      next: i === 0 ? extra[sh.person]?.next || '' : '',
      at: sh.end,
    });
  }
  const days = [...new Set(logs.map((l) => l.day))].sort();
  const posts = days.map((day) => {
    const mine = logs.filter((l) => l.day === day);
    const people = mine.map((l) => l.person);
    return {
      id: `labday-${day}`,
      text: `🧪 Lab log: ${people.join(', ')}`,
      by: 'Trotbot',
      byUid: 'trotbot',
      bot: true,
      at: Math.min(...mine.map((l) => l.at)),
      cmd: { name: 'labday', day, people },
      mentions: [],
      taskIds: [],
      replyTo: null,
      reactions: {},
    };
  });
  return { logs, posts };
}

function demoShifts(now) {
  const h = 3600000;
  const day = (n, hour) => {
    const d = new Date(now - n * 86400000);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  const s = (person, start, hours, extra = {}) => ({
    id: uid(),
    person,
    start,
    end: hours == null ? null : start + hours * h,
    note: '',
    subteam: '',
    taskIds: [],
    createdBy: person,
    ...extra,
  });
  return [
    s('Cooper Mlezcko', now - 1.4 * h, null, { subteam: 'Mechanical' }),
    s('Asher Mosseri', day(1, 15), 3, { subteam: 'Programming', note: 'Tuned the autonomous path' }),
    s('Sebastian Tolbert', day(1, 15), 2.5, { subteam: 'Assembly', note: 'Shooter mount' }),
    s('Jackson Lucks', day(1, 16), 2),
    s('Cooper Mlezcko', day(2, 15), 3.5, { subteam: 'Mechanical', note: 'Drivetrain rebuild' }),
    s('Sophia Bermudez', day(3, 15), 2, { subteam: 'CAD' }),
    s('Asher Mosseri', day(8, 15), 4, { subteam: 'Team Management' }),
    s('Michael Meidan', day(8, 15), 3, { subteam: 'CAD', autoEnded: true }),
  ];
}
function demoPlans() {
  const iso = (n) => {
    const d = new Date(Date.now() + n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return [
    {
      id: uid(),
      date: iso(1),
      start: '15:30',
      end: '18:00',
      title: 'Build session',
      subteam: '',
      people: { 'Cooper Mlezcko': 'in', 'Sebastian Tolbert': 'in' },
    },
    {
      id: uid(),
      date: iso(3),
      start: '15:30',
      end: '17:30',
      title: 'Driver practice',
      subteam: 'Programming',
      people: { 'Jackson Lucks': 'out' },
    },
  ];
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

// Fridays at 6 PM, like the real draw (local time in the demo).
function nextFridayLocal(now) {
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  return d.getTime();
}
// Change fields on a command card's cmd (the open lottery card).
function setCard({ conv, id }, fields) {
  const list = state.chat?.[conv];
  if (!list) return;
  state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === id ? { ...x, cmd: { ...x.cmd, ...fields } } : x)) };
}

let reminderTimer = null;
function startReminders() {
  if (reminderTimer) return;
  const tick = () => {
    const now = Date.now();
    const due = (state.reminders || []).filter((r) => r.at <= now);
    if (!due.length) return;
    state.reminders = state.reminders.filter((r) => r.at > now);
    state.inbox = [
      ...due.map((r) => ({
        id: uid(),
        type: 'reminder',
        icon: '⏰',
        title: 'Reminder',
        body: r.text,
        open: r.conv ? `chat:${r.conv}` : '',
        at: now,
        read: false,
      })),
      ...(state.inbox || []),
    ];
    commit();
  };
  tick();
  reminderTimer = setInterval(tick, 5000);
}
if ((state.reminders || []).length) startReminders();

export const demoStore = {
  mode: 'demo',

  onAuth(cb) {
    cb({ uid: 'demo' });
    return () => {};
  },
  async getMember() {
    // ?demo=member previews the app as a regular teammate; ?demo=signin shows
    // the sign-in screen (Asher "has" a password there, everyone else makes one).
    const as = new URLSearchParams(location.search).get('demo');
    if (as === 'signin' && !sessionStorage.getItem('demo-signed-in')) return null;
    const asMember = as === 'member';
    return asMember ? { name: 'Cooper Mlezcko', admin: false, via: 'password' } : { name: 'Asher Mosseri', admin: true, via: 'password' };
  },
  async account({ action, name, password }) {
    if (action === 'answerReset') {
      state.resetRequest = null;
      commit();
      return { ok: true };
    }
    if (action === 'reset') {
      state.resetRequest = { name, by: 'Asher Mosseri', at: Date.now() };
      commit();
      return { ok: true, asked: true };
    }
    if (action === 'status') return { hasPassword: name === 'Asher Mosseri', thisDevice: false };
    if (action === 'signIn' && password !== 'trotters1') return { error: 'That password isn’t right.' };
    if (action === 'signIn' || action === 'create') {
      sessionStorage.setItem('demo-signed-in', '1');
      return { ok: true, member: { name, admin: name === 'Asher Mosseri', via: 'password' } };
    }
    if (action === 'list')
      return { accounts: ['Asher Mosseri', 'Sebastian Tolbert', 'Cooper Mlezcko'].map((name, i) => ({ name, hasPassword: i < 2, setAt: Date.now() - 864e5, lastSignIn: Date.now() - i * 36e5 })) };
    return { ok: true };
  },
  async saveSetupTicket() {},
  subscribeResetRequest(name, cb) {
    return listen(() => cb(state.resetRequest?.name === name ? state.resetRequest : null));
  },
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
  async saveAdSettings(ads) {
    state.settings = { ...(state.settings || {}), ads };
    commit();
  },
  subscribeAdStats(cb) {
    return listen(() => cb({ ...(state.adStats || {}) }));
  },
  subscribeAdPeople(cb) {
    return listen(() => cb({ ...(state.adPeople || {}) }));
  },
  async bumpAdStats(counts, name) {
    if (name) {
      const was = (state.adPeople || {})[name] || { name, views: 0, taps: 0 };
      const add = (k) => Object.values(counts).reduce((t, c) => t + (c[k] || 0), 0);
      state.adPeople = { ...(state.adPeople || {}), [name]: { name, views: was.views + add('views'), taps: was.taps + add('taps') } };
    }
    const stats = { ...(state.adStats || {}) };
    for (const [id, c] of Object.entries(counts)) {
      const was = stats[id] || { views: 0, taps: 0 };
      stats[id] = { views: was.views + (c.views || 0), taps: was.taps + (c.taps || 0) };
    }
    state.adStats = stats;
    commit();
  },
  subscribeCoins(cb) {
    return listen(() => cb([...(state.coins || [])]));
  },
  async addCoinTx(tx) {
    state.coins = [
      ...(state.coins || []),
      { ...tx, id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: Date.now() },
    ];
    commit();
  },
  async deleteCoinTx(id) {
    state.coins = (state.coins || []).filter((x) => x.id !== id);
    commit();
  },
  subscribeAdSubmissions(cb) {
    return listen(() => cb([...(state.adSubmissions || [])]));
  },
  async submitAd(data, actor) {
    state.adSubmissions = [
      ...(state.adSubmissions || []),
      { ...data, id: `sub${Date.now().toString(36)}`, by: actor.name, status: 'pending', note: '', at: Date.now() },
    ];
    commit();
  },
  async updateAdSubmission(id, patch) {
    state.adSubmissions = (state.adSubmissions || []).map((x) => (x.id === id ? { ...x, ...patch } : x));
    commit();
  },
  async deleteAdSubmission(id) {
    state.adSubmissions = (state.adSubmissions || []).filter((x) => x.id !== id);
    commit();
  },
  // What happens after an ad's booking / order (see adOrders.js). The demo
  // delivers the notifications itself, like the adDeliveries function does.
  subscribeAdOrders(name, cb) {
    const tick = () => {
      const now = Date.now();
      let changed = false;
      state.adOrders = (state.adOrders || []).map((o) => {
        if (o.due == null || o.due > now) return o;
        const { latest, sent, due } = deliver(o, now);
        if (latest) {
          state.inbox = [
            {
              id: uid(),
              type: 'ad',
              icon: latest.icon,
              title: latest.title,
              body: latest.body,
              open: `adorder:${o.id}`,
              at: now,
              read: false,
            },
            ...(state.inbox || []),
          ];
        }
        changed = true;
        return { ...o, sent, due };
      });
      if (changed) commit();
    };
    tick();
    const t = setInterval(tick, 5000);
    const off = listen(() => cb((state.adOrders || []).filter((o) => o.by === name)));
    return () => {
      clearInterval(t);
      off();
    };
  },
  async addAdOrder(order, actor) {
    const id = `ord${Date.now().toString(36)}`;
    state.adOrders = [...(state.adOrders || []), { ...order, id, by: actor.name }];
    commit();
    return id;
  },
  async deleteAdOrder(id) {
    state.adOrders = (state.adOrders || []).filter((o) => o.id !== id);
    commit();
  },
  // The casino and economy, run here the way the play function runs them on
  // the server (functions/index.js), with the same rules (casino.js).
  // balanceOf(name): the person's coins, from the app's wallet; roster: the team.
  async play(req, actor, { balanceOf, roster = [] }) {
    const now = Date.now();
    const me = actor.name;
    const { action, game, conv = '', args = [], msgId, move } = req;
    const words = args.map(String);
    const note = (title, body = '') => ({ note: { title, body } });
    const bank = (n) => (state.bank || {})[n] || {};
    const setBank = (n, b) => (state.bank = { ...(state.bank || {}), [n]: b });
    const ICON = { slots: '🎰', dice: '🎲', coinflip: '🪙', roulette: '🎡', blackjack: '🃏', crash: '🚀', mines: '💣', highlow: '🔼' };
    const LABEL = {
      slots: 'Slots',
      dice: 'Dice',
      coinflip: 'Coin flip',
      roulette: 'Roulette',
      blackjack: 'Blackjack',
      crash: 'Crash',
      mines: 'Mines',
      highlow: 'High-low',
    };
    const result = (net, g) => ({ game: g, icon: ICON[g], label: `${LABEL[g]}: ${net >= 0 ? `won ${net}` : `lost ${-net}`}` });
    const post = (cmd, mentions = []) => {
      const m = {
        id: uid(),
        text: `/${game}${words.length ? ` ${words.join(' ')}` : ''}`,
        by: me,
        byUid: actor.uid,
        at: now,
        cmd: { ...cmd, name: game },
        mentions,
        taskIds: [],
        replyTo: null,
        reactions: {},
      };
      state.chat = { ...(state.chat || {}), [conv]: [...((state.chat || {})[conv] || []), m] };
      return m;
    };
    const done = (r) => (commit(), r);
    // Several people's coins at once (multiplayer games).
    const payOut = (money) => {
      for (const x of money) setBank(x.name, casino.bankAfter(bank(x.name), x.name, ...arcade.paid(x, bank(x.name), teamDay(now)), now));
    };

    // Gifts and ad prizes, checked the way the server checks them.
    if (action === 'gift' || action === 'prize') {
      const entry =
        action === 'gift'
          ? giftEntry(me, req, { roster, balance: balanceOf(me), now })
          : prizeEntry(me, req, { ledger: state.coins || [], gameCap: state.settings?.ads?.games?.cap ?? 10, now });
      if (entry.error) return note(entry.error, entry.body);
      await demoStore.addCoinTx(entry);
      return { ok: true, entry };
    }

    if (action === 'move') {
      const list = (state.chat || {})[conv] || [];
      const m = list.find((x) => x.id === msgId);
      const secret = (state.gameSecrets || {})[msgId];
      if (!m?.cmd || !secret) return note('That game is gone.');
      const c = m.cmd;
      if (arcade.MULTI.includes(c.name)) {
        if (!arcade.isLive(c.status)) return { ok: true };
        const r = arcade.move(c.name, {
          pub: { ...c.game, status: c.status },
          secret,
          me,
          move: String(move),
          balance: balanceOf(me),
          now,
        });
        if (r.error) return note(r.error);
        if (!r.write) return { ok: true, serverNow: now };
        payOut(r.money);
        const { status, ...g } = r.pub;
        if (arcade.isLive(status)) state.gameSecrets = { ...state.gameSecrets, [msgId]: r.secret };
        else delete state.gameSecrets[msgId];
        state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === msgId ? { ...x, cmd: { ...c, game: g, status } } : x)) };
        return done({ ok: true, serverNow: now });
      }
      if (move !== 'peek' && m.by !== me) return note('That’s not your game.');
      if (c.status !== 'playing') return { ok: true };
      if (move === 'double' && balanceOf(m.by) < c.bet) return note('Not enough coins to double.');
      const r = casino.moveGame(c.name, { ...c.game, status: c.status }, secret, String(move), c.bet, now);
      if (r.error) return note(r.error);
      if (move === 'peek' && !r.done) return { ok: true, serverNow: now };
      const bet = c.bet + (r.extraBet || 0);
      const { status, ...g } = r.pub;
      const cmd = { ...c, game: g, status, bet };
      if (r.done) {
        const net = r.payout - bet;
        setBank(m.by, casino.bankAfter(bank(m.by), m.by, r.payout - (r.extraBet || 0), { ...result(net, c.name), shown: net }, {}, now));
        Object.assign(cmd, { payout: r.payout, net });
        delete state.gameSecrets[msgId];
      } else state.gameSecrets = { ...state.gameSecrets, [msgId]: r.secret };
      state.chat = { ...state.chat, [conv]: list.map((x) => (x.id === msgId ? { ...x, cmd } : x)) };
      return done({ ok: true, serverNow: now });
    }

    if (conv.startsWith('dm:') || conv === 'announcements')
      return note('Not here.', 'Use #arcade for the casino, or any channel for the rest.');
    const isCasino = casino.CASINO.includes(game);
    const stop = blocked(game, serverGroup(game), conv, state.settings?.commands);
    if (stop) return { note: stop };
    const balance = balanceOf(me);
    const mine = bank(me);
    if (arcade.MULTI.includes(game)) {
      const r = arcade.start(game, { me, words, roster, balance, bank: mine, now });
      if (r.error) return note(r.error);
      payOut(r.money);
      const { status, ...g } = r.pub;
      const m = post({ game: g, status, bet: g.bet || 0 }, r.mentions);
      state.gameSecrets = { ...(state.gameSecrets || {}), [m.id]: r.secret };
      return done({ ok: true, serverNow: now });
    }

    if (game === 'lottery') {
      const lot = state.lottery || {};
      const drawAt = lot.drawAt && lot.drawAt > now ? lot.drawAt : nextFridayLocal(now);
      const n = words[0] ? casino.parseBet(words[0], Math.floor(balance / casino.TICKET)) : 0;
      if (words[0] && (!n || n < 1)) return note('How many tickets?', `Tickets are ${casino.TICKET} coins. Try: /lottery 3`);
      const cost = (n || 0) * casino.TICKET;
      if (cost > balance) return note(`That’s ${cost} coins. You have ${balance}.`);
      const tickets = { ...(lot.tickets || {}) };
      if (n) tickets[me] = (tickets[me] || 0) + n;
      const pot = (lot.pot || 0) + cost;
      const people = Object.keys(tickets).length;
      // One open lottery card at a time (like the play function).
      const open = lot.open && (state.chat?.[lot.open.conv] || []).some((x) => x.id === lot.open.id) ? lot.open : null;
      if (n) setBank(me, casino.bankAfter(mine, me, -cost, { icon: '🎟️', label: `Lottery: ${n} ticket${n > 1 ? 's' : ''}` }, {}, now));
      if (!open) {
        const m = post({ bought: n || 0, mine: tickets[me] || 0, pot, drawAt, people, last: lot.last || null });
        state.lottery = { pot, tickets, drawAt, round: lot.round || 1, last: lot.last || null, open: { conv, id: m.id } };
        return done({ ok: true });
      }
      state.lottery = { pot, tickets, drawAt, round: lot.round || 1, last: lot.last || null, open };
      setCard(open, { pot, people });
      return done({ ok: true, note: casino.lotteryNote(n, tickets[me] || 0, pot, open.conv, conv) });
    }
    if (isCasino) {
      const bet = casino.parseBet(words[0], balance);
      if (!bet || bet < 1) return note(`/${game} needs a bet`, `Try: /${game} 20 (or all, half, 25%). You have ${balance} coins.`);
      if (bet > balance) return note(`You only have ${balance} coins.`, 'Try /daily, /work, or /beg.');
      const r = casino.startGame(game, bet, words.slice(1), Math.random, now);
      if (r.error) return note(r.error);
      const { status = 'done', ...g } = r.pub;
      if (r.done) {
        const net = r.payout - bet;
        setBank(me, casino.bankAfter(mine, me, net, result(net, game), {}, now));
        post({ game: g, status, bet, payout: r.payout, net });
      } else {
        setBank(me, casino.bankAfter(mine, me, -bet, null, {}, now));
        const m = post({ game: g, status, bet });
        state.gameSecrets = { ...(state.gameSecrets || {}), [m.id]: r.secret };
      }
      return done({ ok: true, serverNow: now });
    }
    if (game === 'rob') {
      const target = words.join(' ').replace(/^@/, '').toLowerCase();
      const people = roster;
      const them =
        people.find((n) => target.includes(n.toLowerCase())) || people.find((n) => n.toLowerCase().split(' ')[0] === target.split(' ')[0]);
      if (!them) return note('Rob who?', 'Try: /rob @name');
      if (them === me) return note('You can’t rob yourself.', 'You’d just be moving coins between pockets.');
      const r = casino.rob(mine, balance, balanceOf(them), now);
      if (r.error) return note(r.error);
      setBank(
        me,
        casino.bankAfter(
          mine,
          me,
          r.amount,
          { icon: r.card.ok ? '🦹' : '🚓', label: r.card.ok ? `Robbed ${them}` : `Caught robbing ${them}` },
          r.bank,
          now,
        ),
      );
      setBank(
        them,
        casino.bankAfter(
          bank(them),
          them,
          r.theirs,
          { icon: r.card.ok ? '😱' : '🚓', label: r.card.ok ? `Robbed by ${me}` : `${me} paid you a fine` },
          {},
          now,
        ),
      );
      post(
        {
          ...r.card,
          to: them,
          line: r.card.ok ? `robbed you and got away with ${r.amount} coins` : `tried to rob you and paid you a ${r.amount} coin fine`,
        },
        [them],
      );
      return done({ ok: true });
    }
    const r =
      game === 'daily'
        ? casino.daily(mine, teamDay(now), teamDay(now - 86400000))
        : game === 'work'
          ? casino.work(mine, now, Math.random, {
              onShift: (state.shifts || []).some((x) => !x.end && x.person === me),
              tasks: (state.tasks || [])
                .filter((t) => t.status !== 'done' && !t.deletedAt && (t.assignees || []).includes(me))
                .map((t) => t.title || 'a task'),
            })
          : casino.beg(mine, now);
    if (r.error) return note(r.error);
    const label = { daily: `Daily coins (streak ${r.card.streak})`, work: `Work: ${r.card.job}`, beg: 'Begging' }[game];
    setBank(
      me,
      casino.bankAfter(mine, me, r.amount, r.amount ? { icon: { daily: '📅', work: '🛠️', beg: '🥺' }[game], label } : null, r.bank, now),
    );
    post(r.card);
    return done({ ok: true });
  },
  subscribeBank(cb) {
    return listen(() => cb({ ...(state.bank || {}) }));
  },
  subscribeLottery(cb) {
    // Friday 6 PM came and went: draw it (the real one is a scheduled function).
    const check = () => state.lottery?.drawAt && state.lottery.drawAt <= Date.now() && state.lottery.pot && demoStore.drawLottery();
    check();
    const t = setInterval(check, 10000);
    const off = listen(() => cb(state.lottery || null));
    return () => {
      clearInterval(t);
      off();
    };
  },
  subscribeControls(cb) {
    return listen(() => cb(state.controls || {}));
  },
  async saveControls(patch, actor) {
    state.controls = { ...(state.controls || {}), ...patch, by: actor.name, updatedAt: Date.now() };
    commit();
  },
  subscribeShutdown(cb) {
    return listen(() => cb(state.shutdown || null));
  },
  async setShutdown(data, actor) {
    state.shutdown = { ...data, by: actor.name, updatedAt: Date.now() };
    commit();
  },
  async sendShutdownReply(text, round, actor, person = actor.name) {
    const sd = state.shutdown;
    const forMe = sd?.on && (!sd.people?.length || sd.people.includes(actor.name));
    if (!forMe && person === actor.name) throw new Error('The app is back on.');
    state.shutdownReplies = [
      { id: uid(), text, round, person, name: actor.name, byUid: actor.uid, at: Date.now() },
      ...(state.shutdownReplies || []),
    ];
    commit();
  },
  subscribeShutdownThread(person, cb) {
    return listen(() => cb((state.shutdownReplies || []).filter((r) => (r.person || r.name) === person).sort((a, b) => a.at - b.at)));
  },
  subscribeShutdownReplies(cb) {
    return listen(() => cb([...(state.shutdownReplies || [])]));
  },
  async deleteShutdownReply(id) {
    state.shutdownReplies = (state.shutdownReplies || []).filter((r) => r.id !== id);
    commit();
  },
  // The demo's Friday draw (the drawLottery function on the server).
  drawLottery() {
    const lot = state.lottery;
    const now = Date.now();
    if (!lot?.pot) return;
    const entries = Object.entries(lot.tickets || {});
    const total = entries.reduce((t, [, n]) => t + n, 0);
    let r = Math.floor(Math.random() * total);
    const [winner, theirs] = entries.find(([, n]) => (r -= n) < 0) || entries[0];
    state.bank = {
      ...(state.bank || {}),
      [winner]: casino.bankAfter(
        (state.bank || {})[winner] || {},
        winner,
        lot.pot,
        { icon: '🎟️', label: `Won the lottery (${lot.pot} coins)` },
        {},
        now,
      ),
    };
    const last = { winner, pot: lot.pot, tickets: theirs, of: total, people: entries.length, at: now };
    if (lot.open) setCard(lot.open, { closed: true, pot: lot.pot, people: entries.length, winner });
    state.lottery = { pot: 0, tickets: {}, drawAt: nextFridayLocal(now + 60000), round: (lot.round || 1) + 1, last };
    const m = {
      id: uid(),
      text: `🎟️ ${winner} won the lottery: ${lot.pot} coins!`,
      by: 'Trotbot',
      byUid: 'trotbot',
      bot: true,
      at: now,
      cmd: { name: 'lottery', draw: last },
      mentions: [winner],
      taskIds: [],
      replyTo: null,
      reactions: {},
    };
    state.chat = { ...(state.chat || {}), arcade: [...((state.chat || {}).arcade || []), m] };
    commit();
  },
  async ping() {
    return 18 + Math.floor(Math.random() * 40);
  },
  // /remind: the demo delivers them itself, like the reminders function does.
  async addReminder({ at, text, conv }, actor) {
    state.reminders = [...(state.reminders || []), { id: uid(), by: actor.name, at, text, conv: conv || '' }];
    commit();
    startReminders();
  },
  async resetAdStats() {
    state.adStats = {};
    state.adPeople = {};
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

  subscribeResources(cb) {
    return listen(() => cb([...(state.resources || [])]));
  },
  async addResource(data, actor) {
    state.resources = [...(state.resources || []), { id: uid(), ...data, by: actor.name, byUid: actor.uid, at: Date.now() }];
    commit();
  },
  async updateResource(id, patch, actor) {
    state.resources = (state.resources || []).map((r) =>
      r.id === id ? { ...r, ...patch, updatedBy: actor.name, updatedAt: Date.now() } : r,
    );
    commit();
  },
  async deleteResource(id) {
    state.resources = (state.resources || []).filter((r) => r.id !== id);
    commit();
  },
  subscribeChatReads(owner, cb) {
    return listen(() => cb({ ...(state.chatReads || {}) }));
  },
  async saveChatReads(owner, reads) {
    state.chatReads = { ...(state.chatReads || {}), ...reads };
    commit();
  },
  subscribeNotes(owner, cb) {
    return listen(() => cb({ ...(state.notes || {}) }));
  },
  async saveNote(owner, about, text) {
    const notes = { ...(state.notes || {}) };
    if (text) notes[about] = text.slice(0, 500);
    else delete notes[about];
    state.notes = notes;
    commit();
  },
  subscribeDiagram(id, cb) {
    return listen(() => cb(state.diagrams?.[id] ? { id, ...state.diagrams[id] } : null));
  },
  async saveDiagram(id, data, actor) {
    state.diagrams = { ...state.diagrams, [id]: { ...data, updatedBy: actor.name, updatedAt: Date.now() } };
    commit();
  },
  subscribeChecklists(cb) {
    return listen(() => cb((state.checklists || []).map((c) => ({ ...c, items: { ...c.items } }))));
  },
  async createChecklist(data, actor) {
    const id = uid();
    state.checklists = [...(state.checklists || []), { id, title: '', items: {}, ...data, createdAt: Date.now(), createdBy: actor.name }];
    commit();
    return id;
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
  async deleteMessages(conv, msgs, hard) {
    if (!hard) {
      for (const m of msgs) if (!m.deleted) await this.deleteMessage(conv, m);
      return;
    }
    const gone = new Set(msgs.map((m) => m.id));
    state.chat = { ...state.chat, [conv]: ((state.chat || {})[conv] || []).filter((m) => !gone.has(m.id)) };
    commit();
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
      supers: {},
      sticker: null,
      files: [],
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
  async superReact(conv, id, emoji, actor, on) {
    updateMsg(conv, id, (m) => {
      const who = { ...((m.supers || {})[emoji] || {}) };
      if (on) who[actor.uid] = actor.name;
      else delete who[actor.uid];
      return { ...m, supers: { ...m.supers, [emoji]: who } };
    });
  },
  // Demo files stay in this browser only (an object URL).
  async uploadChatFile(conv, file, onProgress) {
    onProgress?.(1);
    return { name: file.name, size: file.size, type: file.type || '', url: URL.createObjectURL(file), path: '' };
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
  // A written-answer poll: votes.text[person] = { name, text, at } (empty text removes it).
  async answerPoll(conv, msg, text, actor) {
    const me = personId(actor.name);
    updateMsg(conv, msg.id, (m) => {
      const answers = { ...(m.votes?.text || {}) };
      if (text) answers[me] = { name: actor.name, text, at: Date.now() };
      else delete answers[me];
      return { ...m, votes: { ...(m.votes || {}), text: answers } };
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
  async uploadAdImage(name, blob) {
    return dataUrl(blob);
  },
  async uploadBanner(name, blob) {
    await this.saveProfile(name, { banner: { url: await dataUrl(blob), path: '' } });
  },
  async uploadEffectImage(name, file) {
    return { url: await dataUrl(file), path: '' };
  },
  async removeBanner(name) {
    await this.saveProfile(name, { banner: null });
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

  subscribeStickers(cb) {
    return listen(() => cb([...(state.stickers || [])]));
  },
  async addSticker(name, file, actor) {
    if (file.size > 400000) throw new Error('Demo mode only keeps stickers under 400 KB.');
    state.stickers = [...(state.stickers || []), { id: uid(), name, url: await dataUrl(file), path: '', by: actor.name, at: Date.now() }];
    commit();
  },
  async deleteSticker(s) {
    state.stickers = (state.stickers || []).filter((x) => x.id !== s.id);
    commit();
  },

  // The lab log. The real app's onLabLog function makes #lab-log's day post;
  // the demo does it here.
  subscribeLabLogs(sinceDay, cb) {
    return listen(() => cb((state.labLogs || []).filter((l) => l.day >= sinceDay)));
  },
  async saveLabLog(id, log, actor) {
    const prev = (state.labLogs || []).find((l) => l.id === id) || {};
    const merged = { ...prev, ...log, id, updatedAt: Date.now(), updatedBy: actor.name };
    state.labLogs = [...(state.labLogs || []).filter((l) => l.id !== id), merged];
    const msgId = `labday-${merged.day}`;
    const list = (state.chat || {})['lab-log'] || [];
    const people = [...new Set(state.labLogs.filter((l) => l.day === merged.day).map((l) => l.person))];
    const day = list.find((m) => m.id === msgId);
    const post = {
      id: msgId,
      text: `🧪 Lab log: ${people.join(', ')}`,
      by: 'Trotbot',
      byUid: 'trotbot',
      bot: true,
      at: day?.at || Date.now(),
      cmd: { name: 'labday', day: merged.day, people },
      mentions: [],
      taskIds: [],
      replyTo: null,
      reactions: day?.reactions || {},
    };
    state.chat = { ...(state.chat || {}), 'lab-log': day ? list.map((m) => (m.id === msgId ? { ...m, ...post } : m)) : [...list, post] };
    commit();
  },
  async uploadLabPhoto(prepared) {
    const toUrl = (blob) =>
      new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(blob);
      });
    // Just the small one: the demo lives in this browser's storage, which is small.
    const thumb = await toUrl(prepared.thumb);
    return { url: thumb, thumbUrl: thumb, path: '', width: prepared.width, height: prepared.height };
  },
  subscribeShifts(cb) {
    return listen(() => cb([...(state.shifts || [])]));
  },
  async startShifts(people, start, extra, actor) {
    const add = people.map((person) => ({
      id: uid(),
      person,
      start,
      end: null,
      note: '',
      subteam: '',
      taskIds: [],
      ...extra,
      createdBy: actor.name,
    }));
    state.shifts = [...(state.shifts || []), ...add];
    commit();
  },
  async updateShift(id, patch, actor) {
    state.shifts = (state.shifts || []).map((s) => (s.id === id ? { ...s, ...patch, updatedBy: actor.name } : s));
    commit();
  },
  async deleteShift(id) {
    state.shifts = (state.shifts || []).filter((s) => s.id !== id);
    commit();
  },
  subscribeCheckins(cb) {
    return listen(() => cb([...(state.checkins || [])]));
  },
  async addCheckin(data, actor) {
    state.checkins = [...(state.checkins || []), { id: uid(), ...data, answers: {}, by: actor.name, at: Date.now() }];
    commit();
  },
  async answerCheckin(id, name, answer) {
    state.checkins = (state.checkins || []).map((c) =>
      c.id === id ? { ...c, answers: { ...c.answers, [name]: { ...answer, at: Date.now() } } } : c,
    );
    commit();
  },
  async deleteCheckin(id) {
    state.checkins = (state.checkins || []).filter((c) => c.id !== id);
    commit();
  },
  subscribeShiftPlans(cb) {
    return listen(() => cb([...(state.shiftPlans || [])]));
  },
  async addShiftPlans(plans, actor) {
    state.shiftPlans = [...(state.shiftPlans || []), ...plans.map((p) => ({ id: uid(), ...p, people: {}, createdBy: actor.name }))];
    commit();
  },
  async updateShiftPlan(id, patch) {
    state.shiftPlans = (state.shiftPlans || []).map((p) => (p.id === id ? { ...p, ...patch } : p));
    commit();
  },
  async rsvpShiftPlan(id, name, answer) {
    state.shiftPlans = (state.shiftPlans || []).map((p) => {
      if (p.id !== id) return p;
      const people = { ...p.people };
      if (answer) people[name] = answer;
      else delete people[name];
      return { ...p, people };
    });
    commit();
  },
  async deleteShiftPlans(ids) {
    state.shiftPlans = (state.shiftPlans || []).filter((p) => !ids.includes(p.id));
    commit();
  },

  subscribeRequests(cb) {
    return listen(() => cb([...(state.requests || [])].sort((a, b) => b.at - a.at)));
  },
  async addRequest(text, actor, kind = '') {
    const r = { id: uid(), text, by: actor.name, at: Date.now(), status: 'new', votes: {}, ...(kind ? { kind } : {}) };
    state.requests = [r, ...(state.requests || [])];
    // What the Cloud Function does: let REQUESTS_TO know (not about their own).
    if (actor.name !== REQUESTS_TO)
      state.inbox = [
        {
          id: uid(),
          type: 'request',
          title: `${actor.name.split(' ')[0]} requested a feature`,
          body: text,
          open: `requests:${r.id}`,
          at: r.at,
          read: false,
        },
        ...(state.inbox || []),
      ];
    commit();
  },
  async updateRequest(id, patch, actor) {
    state.requests = (state.requests || []).map((r) =>
      r.id === id ? { ...r, ...patch, updatedBy: actor.name, updatedAt: Date.now() } : r,
    );
    commit();
  },
  async voteRequest(id, name, vote) {
    state.requests = (state.requests || []).map((r) => {
      if (r.id !== id) return r;
      const votes = { ...r.votes };
      const downvotes = { ...r.downvotes };
      delete votes[name];
      delete downvotes[name];
      if (vote === 'up') votes[name] = true;
      if (vote === 'down') downvotes[name] = true;
      return { ...r, votes, downvotes };
    });
    commit();
  },
  async deleteRequest(id) {
    state.requests = (state.requests || []).filter((r) => r.id !== id);
    commit();
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
