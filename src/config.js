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

// Names shown on the join screen and in the assignee picker. Anyone who joins
// as "Someone else" is added to the picker automatically.
export const ROSTER = [
  'Asher Mosseri',
  'Sebastian Tolbert',
  'Jackson Lucks',
  'Cooper Mlezcko',
  'Michael Meidan',
  'Matthew Kuhle',
  'Kasha Jurasic',
  'Sophia Bermudez',
  'Shrey',
  'Ira',
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
};

export const COMPETITION = { name: 'Competition', date: '2026-11-14' };

// Starting org chart. Anything edited on the Team tab is saved to the database
// and overrides these.
export const ORG_DEFAULTS = {
  'Asher Mosseri': {
    title: 'Secretary',
    subteams: ['Programming', 'Team Management'],
    responsibilities: ['Programming', 'Secretary', 'Team management'],
  },
  'Sebastian Tolbert': {
    title: '',
    subteams: ['Team Management', 'Assembly'],
    responsibilities: ['Team management', 'Logistics', 'Assembly'],
  },
  'Kasha Jurasic': { title: '', subteams: ['Programming'], responsibilities: ['Programming'] },
  'Sophia Bermudez': {
    title: '',
    subteams: ['Mechanical', 'Assembly', 'Electrical'],
    responsibilities: ['Fabrication', 'Assembly', 'Logistics', 'Electrical'],
  },
  Shrey: { title: '', subteams: ['CAD'], responsibilities: ['Design (CAD)'] },
  'Jackson Lucks': { title: '', subteams: ['Assembly', 'Electrical'], responsibilities: ['Assembly', 'Electrical'] },
  'Matthew Kuhle': { title: '', subteams: ['CAD'], responsibilities: ['Design (CAD)'] },
  'Cooper Mlezcko': { title: '', subteams: ['Assembly'], responsibilities: ['Assembly'] },
  Ira: { title: '', subteams: ['Assembly'], responsibilities: ['Assembly'] },
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
