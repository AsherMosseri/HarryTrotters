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

// Names shown on the join screen and in the assignee picker. Anyone who joins
// as "Someone else" is added to the picker automatically.
export const ROSTER = [
  'Asher Mosseri',
  'Sebastian Tolbert',
  'Jackson Lucks',
  'Cooper Mlezcko',
  'Michael Meidan',
  'Matthew Kuhle',
  'Katrina Jurasic',
  'Sophia Bermudez',
];

export const STATUSES = [
  { id: 'backlog', label: 'Backlog', color: 'var(--st-backlog)' },
  { id: 'todo', label: 'To Do', color: 'var(--st-todo)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--st-progress)' },
  { id: 'blocked', label: 'Blocked / Waiting on Parts', short: 'Blocked', color: 'var(--st-blocked)' },
  { id: 'testing', label: 'Testing / Review', short: 'Testing', color: 'var(--st-testing)' },
  { id: 'done', label: 'Done', color: 'var(--st-done)' },
];

export const SUBTEAMS = ['Assembly', 'Mechanical', 'Electrical', 'Team Management', 'CAD'];

export const PRIORITIES = [
  { id: 'urgent', label: 'Urgent', rank: 0 },
  { id: 'high', label: 'High', rank: 1 },
  { id: 'medium', label: 'Medium', rank: 2 },
  { id: 'low', label: 'Low', rank: 3 },
];

export const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
export const priorityById = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));
