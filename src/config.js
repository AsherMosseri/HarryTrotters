// Firebase web config. These values are public by design; access is
// enforced by the team code in the Firestore security rules (firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyArsywiQyBAhiUr5RFJO-deMSV-lECZ89M',
  authDomain: 'ftc-32313-tasks.firebaseapp.com',
  projectId: 'ftc-32313-tasks',
  storageBucket: 'ftc-32313-tasks.firebasestorage.app',
  messagingSenderId: '779656354333',
  appId: '1:779656354333:web:79a4dc3c00d4c3722044f4',
};

export const TEAM_NAME = 'FTC 32313';
export const TEAM_NICKNAME = 'Harry Trotters';

// Team managers. Joining under one of these names also needs that person's
// manager code (checked by firestore.rules), and unlocks editing the org chart,
// adding and removing people, deleting milestones, and changing the competition date.
export const MANAGER_NAMES = ['Asher Mosseri', 'Sebastian Tolbert'];
// Old spellings still stored on devices or tasks, mapped to the right name.
// Renames made on the Team tab are stored in the database (settings/names).
export const RENAMED = { 'Matthew Kuhle': 'Matthew Kuehl' };

// Builds a function that maps any old name to the person's current name,
// following chains (A renamed to B, later B renamed to C).
export function makeRenamer(renames = {}) {
  const all = { ...RENAMED, ...renames };
  return (name) => {
    let n = name;
    for (let i = 0; i < 10 && all[n] && all[n] !== n; i++) n = all[n];
    return n;
  };
}

// Grade levels. Team management changes them on the Team tab; anyone not
// listed here (or saved there) is DEFAULT_GRADE. 8th grade and below eat
// middle school lunch, which the lab check-in shows separately.
export const GRADES = [6, 7, 8, 9, 10, 11, 12];
export const DEFAULT_GRADE = 9;
export const GRADE_DEFAULTS = { 'Matthew Kuehl': 8, 'Cooper Mlezcko': 8 };
export const gradeLabel = (g) => `${g}th grade`;
export const lunchOf = (g) => (g <= 8 ? 'Middle school lunch' : 'High school lunch');

// Feature requests (💡) go to this person's bell and phone. Same as
// REQUESTS_TO in functions/index.js.
export const REQUESTS_TO = 'Asher Mosseri';

// The Robot (3D) tab is in preview: only these people see it for now.
export const ROBOT_TAB_PEOPLE = ['Asher Mosseri'];

export const isManagerName = (name) => MANAGER_NAMES.some((n) => n.toLowerCase() === name.trim().toLowerCase());

// Names shown on the join screen and in the assignee picker. People the manager
// adds on the Team tab, and anyone who joins as "Someone else", are added too.
export const ROSTER = [
  'Asher Mosseri',
  'Sebastian Tolbert',
  'Jackson Lucks',
  'Cooper Mlezcko',
  'Michael Meidan',
  'Matthew Kuehl',
  'Katarina Jurasic',
  'Sophia Bermudez',
  'Shrey Kumar',
  'Ira Kumar',
];

export const STATUSES = [
  { id: 'backlog', label: 'Backlog', color: 'var(--st-backlog)' },
  { id: 'todo', label: 'To Do', color: 'var(--st-todo)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--st-progress)' },
  { id: 'blocked', label: 'Blocked / Waiting on Parts', short: 'Blocked', color: 'var(--st-blocked)' },
  { id: 'testing', label: 'Testing / Review', short: 'Testing', color: 'var(--st-testing)' },
  { id: 'done', label: 'Done', color: 'var(--st-done)' },
];

// "Design" means CAD. Colors are used for milestone bars and the org chart.
export const SUBTEAMS = ['Team Management', 'CAD', 'Mechanical', 'Assembly', 'Electrical', 'Programming'];
export const SUBTEAM_COLORS = {
  'Team Management': '#0d9488',
  CAD: '#8b5cf6',
  Mechanical: '#64748b',
  Assembly: '#ea580c',
  Electrical: '#ca8a04',
  Programming: '#16a34a',
  Secretary: '#db2777',
};

// Groups shown in the org chart. Secretary is a role there, not a subteam for tasks.
export const ORG_GROUPS = [...SUBTEAMS, 'Secretary'];

// Default; the manager can change the date on the Milestones tab.
// Chat: #announcements (only team management posts), #general, and one
// channel per subteam.
export const CHANNELS = [
  { id: 'announcements', subteam: '', announce: true },
  { id: 'general', subteam: '' },
  // Also shown inside the Parts tab.
  { id: 'parts', subteam: '' },
  ...SUBTEAMS.map((s) => ({ id: s.toLowerCase().replace(/[^a-z0-9]+/g, '-'), subteam: s })),
];

// GIF search in chat. Get a free key at developers.giphy.com (it's public by
// design, like the Firebase config). Leave empty to allow GIF uploads only.
export const GIPHY_API_KEY = 'vWoP1yFu6olIEx05kHqPgD3PIWSfZR0P';

// Phone notifications (Firebase Cloud Messaging). Optional: the Web Push key
// from Firebase console → Project settings → Cloud Messaging → Web Push
// certificates. Empty uses Firebase's built-in key.
export const VAPID_KEY = '';

export const COMPETITION = { name: 'Competition', date: '2026-11-14' };

// Starting org chart. Anything edited on the Team tab is saved to the database
// and overrides these.
export const ORG_DEFAULTS = {
  'Asher Mosseri': {
    title: '',
    subteams: ['Team Management', 'Programming', 'Secretary'],
    responsibilities: ['Programming', 'Secretary', 'Team management'],
  },
  'Sebastian Tolbert': {
    title: '',
    subteams: ['Team Management', 'Assembly'],
    responsibilities: ['Team management', 'Logistics', 'Assembly'],
  },
  'Katarina Jurasic': { title: '', subteams: ['Programming'], responsibilities: ['Programming'] },
  'Sophia Bermudez': {
    title: '',
    subteams: ['Mechanical', 'Assembly', 'Electrical'],
    responsibilities: ['Fabrication', 'Assembly', 'Logistics', 'Electrical'],
  },
  'Shrey Kumar': { title: '', subteams: ['CAD'], responsibilities: ['Design (CAD)'] },
  'Jackson Lucks': { title: '', subteams: ['Assembly', 'Electrical'], responsibilities: ['Assembly', 'Electrical'] },
  'Matthew Kuehl': { title: '', subteams: ['CAD'], responsibilities: ['Design (CAD)'] },
  'Cooper Mlezcko': { title: '', subteams: ['Assembly'], responsibilities: ['Assembly'] },
  'Ira Kumar': { title: '', subteams: ['Assembly'], responsibilities: ['Assembly'] },
  'Michael Meidan': { title: '', subteams: ['Programming', 'CAD'], responsibilities: ['Programming', 'Design (CAD)'] },
};

export const PRIORITIES = [
  { id: 'urgent', label: 'Urgent', rank: 0 },
  { id: 'high', label: 'High', rank: 1 },
  { id: 'medium', label: 'Medium', rank: 2 },
  { id: 'low', label: 'Low', rank: 3 },
];

export const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
export const priorityById = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));
