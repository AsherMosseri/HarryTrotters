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
import { fetchPage, firstLink, readPreview } from './preview.js';

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

// Same as REQUESTS_TO in src/config.js: who feature requests go to.
const REQUESTS_TO = 'Asher Mosseri';

const first = (name) => (name || 'Someone').split(' ')[0];
const clip = (text, n = 180) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

// Message text without formatting marks, for notifications.
function plainText(text) {
  return text
    .replace(/\|\|[\s\S]*?\|\|/g, '(spoiler)')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/^(#{1,3}|-#|>)\s+/gm, '')
    .replace(/(\*\*\*|\*\*|__|~~|\*|_|`)(\S(?:[\s\S]*?\S)?)\1/g, '$2')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function messagePreview(m) {
  if (m.poll) return `📊 ${clip(m.poll.question)}`;
  if (m.sticker) return `sent a sticker: ${m.sticker.name}`;
  if (m.files?.length && !m.text) return `📎 ${m.files[0].name}`;
  if (m.text) return clip(plainText(m.text));
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

// Each person's notification setting for a conversation: 'all', 'mentions',
// or 'none' (from their profile; announcements and DMs default to 'all').
async function notifyLevels(rename) {
  const snap = await db.collection('profiles').get();
  const latest = new Map();
  for (const d of snap.docs) {
    const name = rename(d.get('name') || '');
    const prev = latest.get(name);
    if (name && (!prev || (d.get('updatedAt') || 0) > (prev.get('updatedAt') || 0))) latest.set(name, d);
  }
  return (name, conv, fallback) => latest.get(name)?.get('notify')?.[conv] || fallback;
}

// Announcements go to everyone; @mentions (people, @subteam, @everyone) to the
// people mentioned; "All messages" channels to everyone who chose that.
export const onChatMessage = onDocumentCreated('channels/{channelId}/messages/{messageId}', async (event) => {
  const m = event.data?.data();
  if (!m || m.deleted) return;
  const { channelId } = event.params;
  const rename = await renamer();
  const level = await notifyLevels(rename);
  const sender = rename(m.by || '');
  const open = `chat:${channelId}`;
  const channel = (await db.doc(`channels/${channelId}`).get()).get('name') || channelId;
  const announce = channelId === 'announcements';
  const mentioned = new Set((m.mentions || []).map(rename));
  const how = m.everyone ? '@everyone' : m.roles?.length ? `@${m.roles[0]}` : 'you';
  const body = messagePreview(m);

  const people = new Set([...mentioned]);
  for (const p of (await db.collection('people').get()).docs) people.add(rename(p.get('name') || ''));
  const notes = [];
  for (const to of people) {
    if (!to || to === sender) continue;
    const wants = level(to, channelId, announce ? 'all' : 'mentions');
    if (wants === 'none') continue;
    if (announce) notes.push({ to, type: 'announcement', title: `Announcement from ${first(sender)}`, body, open, by: sender });
    else if (mentioned.has(to))
      notes.push({ to, type: 'mention', title: `${first(sender)} mentioned ${how} in #${channel}`, body, open, by: sender });
    else if (wants === 'all')
      notes.push({ to, type: 'message', title: `${first(sender)} in #${channel}`, body, open, by: sender, tag: open });
  }
  await notify(notes);
});

// DMs go to the other people in the DM (unless they turned that DM off).
export const onDmMessage = onDocumentCreated('dms/{dmId}/messages/{messageId}', async (event) => {
  const m = event.data?.data();
  if (!m || m.deleted) return;
  const { dmId } = event.params;
  const dm = (await db.doc(`dms/${dmId}`).get()).data();
  if (!dm) return;
  const rename = await renamer();
  const level = await notifyLevels(rename);
  const sender = rename(m.by || '');
  const conv = `dm:${dmId}`;
  const group = dm.people.length > 2;
  const title = group
    ? `${first(sender)} in ${dm.name || dm.people.map(rename).map(first).join(', ')}`
    : `${first(sender)} sent you a message`;
  await notify(
    [...new Set(dm.people.map(rename))]
      .filter((to) => to && to !== sender && level(to, conv, 'all') !== 'none')
      .map((to) => ({ to, type: 'dm', title, body: messagePreview(m), open: `chat:${conv}`, by: sender, tag: conv })),
  );
});

// Feature requests go to REQUESTS_TO. The person who asked hears back when
// the status changes or someone replies.
const REQUEST_NEWS = {
  planned: 'Your idea is planned',
  working: 'Your idea is being worked on',
  done: 'Your idea was added',
  declined: 'Your idea is on hold for now',
};
export const onFeatureRequest = onDocumentWritten('requests/{id}', async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;
  const before = event.data?.before?.data();
  const rename = await renamer();
  const by = rename(after.by || '');
  const open = `requests:${event.params.id}`;
  if (!before) {
    const to = rename(REQUESTS_TO);
    if (to !== by) await notify([{ to, type: 'request', title: `${first(by)} requested a feature`, body: clip(after.text), open, by }]);
    return;
  }
  const actor = rename(after.updatedBy || '');
  const replied = after.reply && after.reply !== before.reply;
  const moved = after.status !== before.status && REQUEST_NEWS[after.status];
  if ((!replied && !moved) || !by || actor === by) return;
  await notify([
    {
      to: by,
      type: 'request',
      title: moved ? REQUEST_NEWS[after.status] : `${first(actor)} replied to your idea`,
      body: clip(replied ? `${first(actor)}: ${plainText(after.reply)}` : after.text),
      open,
      by: actor,
    },
  ]);
});

// Link previews: the server fetches the first link's title, description, and
// image (see preview.js).
async function previewFor(event) {
  const after = event.data?.after?.data();
  if (!after || after.deleted || after.preview === false) return;
  const before = event.data?.before?.data();
  if (before && before.text === after.text) return;
  const url = firstLink(after.text);
  if (!url) {
    if (after.preview) await event.data.after.ref.update({ preview: null });
    return;
  }
  if (after.preview?.url === url) return;
  let preview = null;
  try {
    const page = await fetchPage(url);
    preview = readPreview(page.html, url);
  } catch (e) {
    logger.info('no preview', url, e.message);
  }
  await event.data.after.ref.update({ preview });
}
export const channelLinkPreview = onDocumentWritten('channels/{channelId}/messages/{messageId}', previewFor);
export const dmLinkPreview = onDocumentWritten('dms/{dmId}/messages/{messageId}', previewFor);

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

// Shifts, every 15 minutes:
// - clocked in 4+ hours: "Still at the shop?" (once per shift)
// - still running from before today (New York time): ended at the person's
//   last activity in the app, marked autoEnded, and they're told
// - a planned shift starting within the hour: reminds everyone who said "I'm in"
const HOUR = 3600000;
const zoneParts = (ms) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
// ms for a wall-clock date ('YYYY-MM-DD') and time ('HH:MM') in TIME_ZONE.
function zonedMs(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = zoneParts(guess);
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return guess - (shown - guess);
}
const clock = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE });
const span = (ms) => `${Math.floor(ms / HOUR)}h ${String(Math.floor((ms % HOUR) / 60000)).padStart(2, '0')}m`;

export const shiftChecks = onSchedule({ schedule: 'every 15 minutes', timeZone: TIME_ZONE }, async () => {
  const now = Date.now();
  const rename = await renamer();
  const notes = [];
  const today = localDate(0);
  const midnight = zonedMs(today, '00:00');

  const open = await db.collection('shifts').where('end', '==', null).get();
  let lastActive = null;
  for (const s of open.docs) {
    const shift = s.data();
    const to = rename(shift.person || '');
    if (!to) continue;
    if (shift.start < midnight) {
      if (!lastActive) {
        lastActive = new Map();
        for (const p of (await db.collection('presence').get()).docs) {
          const name = rename(p.get('name') || '');
          lastActive.set(name, Math.max(lastActive.get(name) || 0, p.get('at') || 0, p.get('typingAt') || 0));
        }
      }
      const seen = lastActive.get(to) || 0;
      // Last seen in the app during the shift, else a 4-hour shift (never past midnight).
      const end = seen > shift.start && seen < midnight ? seen : Math.min(shift.start + 4 * HOUR, midnight);
      await s.ref.update({ end, autoEnded: true });
      notes.push({
        to,
        type: 'shift',
        title: 'Your shift was ended automatically',
        body: `Ended at ${clock(end)} (${span(end - shift.start)}). Tap to fix it if that's wrong.`,
        open: 'view:shifts',
      });
    } else if (now - shift.start >= 4 * HOUR && !shift.reminded) {
      await s.ref.update({ reminded: true });
      notes.push({
        to,
        type: 'shift',
        title: 'Still at the shop?',
        body: `You've been clocked in for ${span(now - shift.start)}. Tap to end your shift.`,
        open: 'shift:end',
        tag: `shift-${s.id}`,
      });
    }
  }

  const plans = await db.collection('shiftPlans').where('date', 'in', [today, localDate(1)]).get();
  for (const p of plans.docs) {
    const plan = p.data();
    if (plan.reminded || !plan.start) continue;
    const at = zonedMs(plan.date, plan.start);
    if (at - now > HOUR || at < now) continue;
    await p.ref.update({ reminded: true });
    const going = Object.entries(plan.people || {})
      .filter(([, v]) => v === 'in')
      .map(([n]) => rename(n));
    for (const to of new Set(going))
      notes.push({
        to,
        type: 'shift',
        title: `${plan.title || 'Shift'} starts at ${clock(at)}`,
        body: `${plan.subteam ? `${plan.subteam} · ` : ''}Until ${clock(zonedMs(plan.date, plan.end || plan.start))}`,
        open: 'view:shifts',
      });
  }
  await notify(notes);
});

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// YYYY-MM-DD in the team's time zone, `days` from now.
function localDate(days) {
  return new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

// Every morning at 7:30 (New York time): what's due tomorrow, one
// notification per person. Also clears inbox items older than 30 days.
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
