// Notifications for the task board. Each one is written to the person's
// inbox (the 🔔 on the site) and pushed to every device they turned
// notifications on for.
import { readFileSync } from 'node:fs';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Functions run next to the database. The deploy workflow writes location.json
// from the database's location; nam5 (the US multi-region) pairs with us-central1.
function region() {
  try {
    const { firestore } = JSON.parse(readFileSync(new URL('./location.json', import.meta.url)));
    return { nam5: 'us-central1', nam7: 'us-central1', eur3: 'europe-west1' }[firestore] || firestore;
  } catch {
    return 'us-central1';
  }
}
setGlobalOptions({ region: region(), maxInstances: 5 });

initializeApp();
const db = getFirestore();

const TIME_ZONE = 'America/New_York';
// Same as RENAMED in src/config.js (old spellings mapped to the right name).
const RENAMED = { 'Matthew Kuhle': 'Matthew Kuehl' };

// Same as personId in src/data/diff.js: the inbox doc id for a name.
const personId = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function renamer() {
  const snap = await db.doc('settings/names').get();
  const all = { ...RENAMED, ...(snap.get('renames') || {}) };
  return (name) => {
    let n = name;
    for (let i = 0; i < 10 && all[n] && all[n] !== n; i++) n = all[n];
    return n;
  };
}

const first = (name) => (name || 'Someone').split(' ')[0];
const clip = (text, n = 180) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

function messagePreview(m) {
  if (m.text) return clip(m.text);
  if (m.gif) return 'sent a GIF';
  if (m.photo) return 'sent a photo';
  return '';
}

// Writes inbox items and sends pushes. notes: [{ to, type, title, body, open, by }]
async function notify(notes) {
  if (!notes.length) return;
  const rename = await renamer();
  const batch = db.batch();
  const at = Date.now();
  for (const n of notes) {
    const { to, ...item } = n;
    batch.set(
      db
        .collection('inbox')
        .doc(personId(rename(to)))
        .collection('items')
        .doc(),
      { ...item, at, read: false },
    );
  }
  await batch.commit();

  // Whose phone is it? Trust the device's member record (the name it joined
  // with, mapped to the current spelling), not the name the device sent.
  const tokens = await db.collection('pushTokens').get();
  const uids = [...new Set(tokens.docs.map((t) => t.get('uid')).filter(Boolean))];
  const members = uids.length ? await db.getAll(...uids.map((uid) => db.doc(`members/${uid}`))) : [];
  const nameByUid = new Map(members.filter((m) => m.exists).map((m) => [m.id, m.get('name')]));
  const byPerson = new Map();
  const stale = [];
  for (const t of tokens.docs) {
    const name = nameByUid.get(t.get('uid'));
    // The device left the team (Switch): stop sending to it.
    if (!name) {
      stale.push(t.id);
      continue;
    }
    const person = rename(name);
    byPerson.set(person, [...(byPerson.get(person) || []), t.id]);
  }
  for (const n of notes) {
    const list = byPerson.get(rename(n.to)) || [];
    if (!list.length) continue;
    // Data-only, so the site's service worker decides how to show it.
    const res = await getMessaging().sendEachForMulticast({
      tokens: list,
      data: { title: n.title, body: n.body || '', open: n.open || '', tag: n.tag || n.open || n.type },
      webpush: { headers: { Urgency: 'high', TTL: String(24 * 3600) } },
    });
    res.responses.forEach((r, i) => {
      const code = r.error?.code || '';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') stale.push(list[i]);
      else if (r.error) logger.warn('push failed', code, r.error.message);
    });
  }
  await Promise.all(stale.map((t) => db.collection('pushTokens').doc(t).delete()));
}

// Announcements go to everyone; @mentions go to the people mentioned.
export const onChatMessage = onDocumentCreated('channels/{channelId}/messages/{messageId}', async (event) => {
  const m = event.data?.data();
  if (!m || m.deleted) return;
  const { channelId } = event.params;
  const rename = await renamer();
  const sender = rename(m.by || '');
  const open = `chat:${channelId}`;
  const notes = new Map();

  if (channelId === 'announcements') {
    const people = await db.collection('people').get();
    for (const p of people.docs) {
      const to = rename(p.get('name') || '');
      if (to && to !== sender)
        notes.set(to, { to, type: 'announcement', title: `Announcement from ${first(sender)}`, body: messagePreview(m), open, by: sender });
    }
  }
  for (const name of m.mentions || []) {
    const to = rename(name);
    if (to && to !== sender && !notes.has(to))
      notes.set(to, {
        to,
        type: 'mention',
        title: `${first(sender)} mentioned you in #${channelId}`,
        body: messagePreview(m),
        open,
        by: sender,
      });
  }
  await notify([...notes.values()]);
});

// Someone new on a task's assignee list (not the person who added them).
export const onTaskAssigned = onDocumentWritten('tasks/{taskId}', async (event) => {
  const after = event.data?.after?.data();
  if (!after || after.deletedAt || after.status === 'done') return;
  const before = event.data?.before?.data();
  const rename = await renamer();
  // Renames rewrite assignee lists; mapping both sides keeps those quiet.
  const had = new Set((before?.assignees || []).map(rename));
  const actor = rename((before ? after.updatedBy : after.createdBy) || '');
  const added = [...new Set((after.assignees || []).map(rename))].filter((n) => n && !had.has(n) && n !== actor);
  const due = after.dueDate ? ` · due ${formatDate(after.dueDate)}` : '';
  await notify(
    added.map((to) => ({
      to,
      type: 'assigned',
      title: `${first(actor)} gave you a task`,
      body: `${after.title || 'Untitled task'}${due}`,
      open: `task:${event.params.taskId}`,
      by: actor,
    })),
  );
});

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// YYYY-MM-DD in the team's time zone, `days` from now.
function localDate(days) {
  return new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

// Every morning: what's due tomorrow, one notification per person. Also
// clears inbox items older than 30 days.
export const dueTomorrow = onSchedule({ schedule: '30 7 * * *', timeZone: TIME_ZONE }, async () => {
  const rename = await renamer();
  const tomorrow = localDate(1);
  const tasks = await db.collection('tasks').where('dueDate', '==', tomorrow).get();
  const perPerson = new Map();
  for (const t of tasks.docs) {
    const task = t.data();
    if (task.deletedAt || task.status === 'done') continue;
    for (const name of new Set((task.assignees || []).map(rename)))
      perPerson.set(name, [...(perPerson.get(name) || []), { id: t.id, ...task }]);
  }
  await notify(
    [...perPerson].map(([to, list]) => ({
      to,
      type: 'due',
      title: list.length === 1 ? 'Due tomorrow' : `${list.length} tasks due tomorrow`,
      body: clip(list.map((t) => t.title || 'Untitled task').join(' · ')),
      open: list.length === 1 ? `task:${list[0].id}` : 'view:board',
      tag: `due-${tomorrow}`,
    })),
  );

  const cutoff = Date.now() - 30 * 86400000;
  for (const inbox of await db.collection('inbox').listDocuments()) {
    const old = await inbox.collection('items').where('at', '<', cutoff).get();
    await Promise.all(old.docs.map((d) => d.ref.delete()));
  }
});
