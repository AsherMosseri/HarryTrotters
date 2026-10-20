// Shared helpers for both data backends.

const TRACKED = ['title', 'description', 'status', 'assignees', 'subteam', 'priority', 'dueDate', 'blockedReason', 'links', 'milestoneId'];

export function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Turns a patch into activity entries describing what changed.
export function describeChanges(prev, patch) {
  const entries = [];
  for (const field of TRACKED) {
    if (!(field in patch)) continue;
    const from = prev?.[field] ?? null;
    const to = patch[field] ?? null;
    if (sameValue(from, to)) continue;
    entries.push({ type: 'change', field, from, to });
  }
  return entries;
}

// Fields that change automatically alongside a patch.
export function derivedFields(prev, patch, now) {
  const extra = {};
  if ('status' in patch && patch.status !== prev?.status) {
    if (patch.status === 'done') extra.completedAt = now;
    else if (prev?.status === 'done') extra.completedAt = null;
    if (patch.status !== 'blocked' && prev?.status === 'blocked' && !('blockedReason' in patch)) {
      extra.blockedReason = '';
    }
  }
  return extra;
}

export function newTaskDefaults(data) {
  return {
    title: '',
    description: '',
    status: 'todo',
    assignees: [],
    subteam: '',
    priority: 'medium',
    dueDate: '',
    blockedReason: '',
    links: [],
    milestoneId: '',
    commentCount: 0,
    ...data,
  };
}

export function newMilestoneDefaults(data) {
  return { title: '', subteam: '', owners: [], start: '', end: '', notes: '', done: false, ...data };
}

// Stable doc id for a person's org-chart entry.
export const personId = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
