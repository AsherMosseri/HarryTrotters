// Notifications for the task board. Each one is written to the person's
// inbox (the 🔔 on the site) and pushed to every device they turned
// notifications on for.
import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { fetchPage, firstLink, readPreview } from './preview.js';
import { coinSettings, coinsByName, giftEntry, prizeEntry, wallet } from './shared/coins.js';
import * as casino from './shared/casino.js';
import * as arcade from './shared/arcade.js';
import { blocked, serverGroup } from './shared/commandRules.js';
import { MANAGER_NAMES, PASSWORD_MIN, cleanName, isManagerName, knownName } from './shared/team.js';
import { TEAM_NUMBER, fromSchedule, rankOf, scoreOf, seasonOf } from './shared/matches.js';
import { asksOn } from './shared/checkin.js';
import { marketFunctions } from './market.js';
import { lifeFunctions } from './life.js';

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
  const rename = (name) => {
    let n = name;
    for (let i = 0; i < 10 && all[n] && all[n] !== n; i++) n = all[n];
    return n;
  };
  // Every name someone has gone by (their current one first).
  rename.aliases = (name) => [name, ...Object.keys(all).filter((k) => k !== name && rename(k) === name)];
  return rename;
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
  if (m.cmd?.line) return clip(m.cmd.line);
  if (m.poll) return `📊 ${clip(m.poll.question)}`;
  if (m.sticker) return `sent a sticker: ${m.sticker.name}`;
  if (m.files?.length && !m.text) return `📎 ${m.files[0].name}`;
  if (m.text) return clip(plainText(m.text));
  if (m.gif) return 'sent a GIF';
  if (m.photo) return 'sent a photo';
  return '';
}

// Writes inbox items and sends pushes. notes: [{ to, type, title, body, open, by, icon?, quiet? }]
async function notify(notes) {
  if (!notes.length) return;
  const rename = await renamer();
  const batch = db.batch();
  const at = Date.now();
  for (const n of notes) {
    const { to, quiet, ...item } = n; // quiet only matters for the push below
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
  // How many unread notifications each person has now, for the number on the
  // app's Home Screen icon (the service worker sets it when the push arrives).
  const unreadOf = new Map();
  const unreadFor = async (person) => {
    if (!unreadOf.has(person))
      unreadOf.set(
        person,
        await db
          .collection('inbox')
          .doc(personId(person))
          .collection('items')
          .where('read', '==', false)
          .count()
          .get()
          .then((c) => c.data().count)
          .catch(() => 0),
      );
    return unreadOf.get(person);
  };
  for (const n of notes) {
    if (n.quiet) continue; // inbox only (no buzz at night)
    const list = byPerson.get(rename(n.to)) || [];
    if (!list.length) continue;
    const badge = String(await unreadFor(rename(n.to)));
    // Data-only, so the site's service worker decides how to show it.
    const res = await getMessaging().sendEachForMulticast({
      tokens: list,
      data: { title: n.title, body: n.body || '', open: n.open || '', tag: n.tag || n.open || n.type, badge },
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
// The shutdown chats: a teammate's message goes to Asher, and Asher's reply
// goes to that teammate (it opens to the shutdown screen, where the chat is).
export const onShutdownReply = onDocumentCreated('shutdownReplies/{id}', async (event) => {
  const r = event.data?.data();
  if (!r?.text) return;
  const rename = await renamer();
  const by = rename(r.name || '');
  const person = rename(r.person || r.name || '');
  const owner = rename(REQUESTS_TO);
  if (by === owner) {
    if (person && person !== owner)
      await notify([{ to: person, type: 'shutdown', title: `${first(by)} replied`, body: clip(r.text), open: 'shutdown', by }]);
    return;
  }
  await notify([{ to: owner, type: 'shutdown', title: `${first(by)} replied to the shutdown`, body: clip(r.text), open: 'shutdown', by }]);
});

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

// A new lab check-in: everyone gets a notification to answer it (the app
// also asks when it opens).
export const onCheckin = onDocumentCreated('checkins/{id}', async (event) => {
  const c = event.data?.data();
  if (!c) return;
  const rename = await renamer();
  const by = rename(c.by || '');
  const people = new Set((await db.collection('people').get()).docs.map((p) => rename(p.get('name') || '')));
  await notify(
    [...people]
      .filter((to) => to && to !== by)
      .map((to) => ({
        to,
        type: 'checkin',
        title: `Lab check-in from ${first(by)}`,
        body: c.question || 'Are you going to the lab today?',
        open: 'view:shifts',
        by,
      })),
  );
});

// Asking to add a missed shift or make one longer (Shifts): team management
// hears about it, and the person hears back when it's approved or declined.
export const onShiftRequest = onDocumentWritten('shiftRequests/{id}', async (event) => {
  const before = event.data?.before?.data();
  const r = event.data?.after?.data();
  if (!r) return;
  const rename = await renamer();
  const person = rename(r.person || '');
  const when = `${formatDate(nyDay(r.start))} · ${clock(r.start)}–${clock(r.end)}`;
  if (!before) {
    const managers = new Set(MANAGER_NAMES.map(rename));
    managers.delete(person);
    await notify(
      [...managers].map((to) => ({
        to,
        type: 'shift',
        title: r.kind === 'add' ? `${first(person)} asks to add a shift` : `${first(person)} asks to make a shift longer`,
        body: `${when}. Approve or decline it in Shifts.`,
        open: 'view:shifts',
        by: person,
      })),
    );
  } else if (before.status === 'pending' && (r.status === 'approved' || r.status === 'declined')) {
    const by = rename(r.decidedBy || '');
    if (by === person) return;
    await notify([
      {
        to: person,
        type: 'shift',
        title: `${first(by)} ${r.status} your ${r.kind === 'add' ? 'missed shift' : 'longer shift'}`,
        body: when,
        open: 'view:shifts',
        by,
      },
    ]);
  }
});

// Shifts, every 15 minutes:
// - clocked in 4+ hours: "Still at the lab?" (once per shift)
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

// The lab log (src/labLog.js): #lab-log has one Trotbot post per day, made
// with the day's first log. It shows everyone's logs live; this keeps the
// list of who logged (for the preview and notifications) up to date.
export const onLabLog = onDocumentWritten('labLogs/{id}', async (event) => {
  const log = event.data?.after?.data() || event.data?.before?.data();
  const day = log?.day;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const logs = await db.collection('labLogs').where('day', '==', day).get();
  const people = [...new Set(logs.docs.map((d) => d.get('person')).filter(Boolean))];
  const ref = db.doc(`channels/lab-log/messages/labday-${day}`);
  await db.runTransaction(async (tx) => {
    const post = await tx.get(ref);
    const text = `🧪 Lab log: ${people.join(', ')}`.slice(0, 400);
    if (post.exists) tx.update(ref, { text, 'cmd.people': people });
    else if (people.length)
      tx.set(ref, {
        text,
        by: 'Trotbot',
        byUid: 'trotbot',
        bot: true,
        at: Date.now(),
        cmd: { name: 'labday', day, people },
        mentions: [],
        taskIds: [],
        replyTo: null,
        reactions: {},
        photo: null,
      });
  });
});

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
        body: `Ended at ${clock(end)} (${span(end - shift.start)}). Tap to fix it if that's wrong. The app will ask what you did when you open it.`,
        open: 'view:shifts',
      });
    } else if (now - shift.start >= 4 * HOUR && !shift.reminded) {
      await s.ref.update({ reminded: true });
      notes.push({
        to,
        type: 'shift',
        title: 'Still at the lab?',
        body: `You've been clocked in for ${span(now - shift.start)}. Tap to end your shift.`,
        open: 'shift:end',
        tag: `shift-${s.id}`,
      });
    }
  }

  const plans = await db
    .collection('shiftPlans')
    .where('date', 'in', [today, localDate(1)])
    .get();
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

// Lab check-ins on a schedule (Shifts → Lab check-in → Repeat): on the chosen
// days or every school day (shared/checkin.js, shared/school.js), at the
// chosen time (New York time), once a day, except days team management
// skipped. Skipped when the day already has a check-in, and if it's more than
// 6 hours past the time (so a late deploy doesn't ask at night). onCheckin
// then notifies everyone.
export const scheduledCheckin = onSchedule({ schedule: 'every 15 minutes', timeZone: TIME_ZONE }, async () => {
  const s = (await db.doc('settings/team').get()).get('checkinSchedule');
  if (!s?.on || !(s.slots || []).length || !/^\d\d:\d\d$/.test(s.time || '')) return;
  const today = localDate(0);
  if (!asksOn(s, today)) return;
  const at = zonedMs(today, s.time);
  const now = Date.now();
  if (now < at || now > at + 6 * HOUR) return;
  const existing = await db.collection('checkins').where('date', '==', today).limit(1).get();
  if (!existing.empty) return;
  try {
    await db
      .collection('checkins')
      .doc(`auto-${today}`)
      .create({
        date: today,
        question: s.question || 'Who’s going to the lab today?',
        slots: s.slots,
        answers: {},
        by: s.by || 'Team management',
        byUid: '',
        auto: true,
        at: now,
      });
  } catch (e) {
    if (e.code !== 6) throw e; // 6 = already exists (another run got there first)
  }
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

// After you book / order / submit / subscribe from an ad (src/adOrders.js
// plans the timeline): every 5 minutes, send the notifications that are due.
// Only the newest due one goes out, so a backlog doesn't buzz five times, and
// between 10 PM and 7 AM (New York) they go to the inbox without a buzz.
export const adDeliveries = onSchedule({ schedule: 'every 5 minutes', timeZone: TIME_ZONE }, async () => {
  const now = Date.now();
  const due = await db.collection('adOrders').where('due', '<=', now).limit(200).get();
  if (due.empty) return;
  const hour = +zoneParts(now).hour % 24;
  const quiet = hour >= 22 || hour < 7;
  const notes = [];
  const batch = db.batch();
  for (const d of due.docs) {
    const o = d.data();
    const events = Array.isArray(o.events) ? o.events : [];
    let sent = Number(o.sent) || 0;
    let latest = null;
    while (sent < events.length && events[sent].at <= now) {
      if (events[sent].push) latest = events[sent];
      sent++;
    }
    const next = events.slice(sent).find((e) => e.push);
    batch.update(d.ref, { sent, due: next ? next.at : null });
    if (latest && o.by)
      notes.push({
        to: o.by,
        type: 'ad',
        icon: String(latest.icon || '📦').slice(0, 16),
        title: String(latest.title || '').slice(0, 120),
        body: String(latest.body || '').slice(0, 200),
        open: `adorder:${d.id}`,
        tag: `adorder-${d.id}`,
        quiet,
      });
  }
  await batch.commit();
  await notify(notes);
});

// /remind in chat: every minute, send the reminders that are due to their
// person's inbox (and phone), then delete them.
export const reminders = onSchedule({ schedule: 'every 1 minutes', timeZone: TIME_ZONE }, async () => {
  const due = await db.collection('reminders').where('at', '<=', Date.now()).limit(200).get();
  if (due.empty) return;
  const notes = due.docs
    .map((d) => d.data())
    .filter((r) => r.by && r.text)
    .map((r) => ({
      to: r.by,
      type: 'reminder',
      icon: '⏰',
      title: 'Reminder',
      body: String(r.text).slice(0, 200),
      open: r.conv ? `chat:${r.conv}` : '',
    }));
  await notify(notes);
  const batch = db.batch();
  for (const d of due.docs) batch.delete(d.ref);
  await batch.commit();
});

// A rename on the Roster (settings/names): move what's stored under the old
// name's id to the new one right away (notifications, password, a reset
// request), so the person keeps them. Everything shown by name already
// follows the rename in the app.
export const onRename = onDocumentWritten('settings/names', async (event) => {
  const before = event.data?.before?.get('renames') || {};
  const after = event.data?.after?.get('renames') || {};
  const moved = Object.entries(after).filter(([from, to]) => to && before[from] !== to && personId(from) !== personId(to));
  if (!moved.length) return;
  const rename = await renamer();
  for (const [from] of moved) {
    const to = rename(from);
    const oldId = personId(from);
    const newId = personId(to);
    if (!oldId || oldId === newId) continue;
    const items = await db.collection(`inbox/${oldId}/items`).get();
    for (let i = 0; i < items.docs.length; i += 200) {
      const batch = db.batch();
      for (const d of items.docs.slice(i, i + 200)) {
        batch.set(db.doc(`inbox/${newId}/items/${d.id}`), d.data());
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    const acc = await db.doc(`accounts/${oldId}`).get();
    if (acc.exists && acc.get('hash') && !(await db.doc(`accounts/${newId}`).get()).get('hash')) {
      await db.doc(`accounts/${newId}`).set({ ...acc.data(), name: to });
      await acc.ref.delete();
    }
    const ask = await db.doc(`resetRequests/${oldId}`).get();
    if (ask.exists) {
      await db.doc(`resetRequests/${newId}`).set({ ...ask.data(), name: to });
      await ask.ref.delete();
    }
    logger.info('moved to new name', from, '→', to, items.size, 'notifications');
  }
});

// ---------- accounts: everyone signs in with their own password ----------
// accounts/{personId}: { name, salt, hash, setAt, lastSignIn, fails, lockedUntil }
// (phones can't read or write it). A device counts as signed in once this
// writes its members/{uid} doc with via: 'password'; the rules only let
// those devices in, and only this sets who's team management (MANAGER_NAMES).
const accountRef = (name) => db.doc(`accounts/${personId(name)}`);
const hashOf = (password, salt) => scryptSync(String(password), salt, 64).toString('hex');
const LOCK_AFTER = 6;
const LOCK_MS = 10 * 60000;

async function signDeviceIn(uid, name) {
  const batch = db.batch();
  batch.set(db.doc(`members/${uid}`), { name, admin: isManagerName(name), via: 'password', joinedAt: Date.now() });
  batch.set(db.doc(`people/${uid}`), { name, joinedAt: Date.now() }, { merge: true });
  await batch.commit();
  return { name, admin: isManagerName(name), via: 'password' };
}

export const account = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const rename = await renamer();
  const { action } = req.data || {};
  // Everyone already on the team, so a typed name that matches one (any
  // capitals, spaces, dots) is that person, never a second copy.
  const typed = cleanName(req.data?.name).slice(0, 60);
  let name = '';
  if (typed) {
    const [people, roles, accounts] = await Promise.all([
      db.collection('people').get(),
      db.collection('roles').get(),
      db.collection('accounts').get(),
    ]);
    const names = [
      ...MANAGER_NAMES,
      ...accounts.docs.map((d) => d.get('name')),
      ...people.docs.map((d) => d.get('name')),
      ...roles.docs.map((d) => d.get('name')),
    ]
      .filter(Boolean)
      .map(rename);
    name = rename(knownName(rename(typed), names));
  }
  const password = String(req.data?.password || '');
  const now = Date.now();
  // Renamed on the Roster: a password (and a pending reset request) saved
  // under an old name moves to the new one.
  const follow = async (n) => {
    if (!n || (await accountRef(n).get()).get('hash')) return;
    for (const alias of rename.aliases(n)) {
      if (alias === n) continue;
      const old = await accountRef(alias).get();
      if (!old.get('hash')) continue;
      await accountRef(n).set({ ...old.data(), name: n });
      await old.ref.delete();
      const ask = await db.doc(`resetRequests/${personId(alias)}`).get();
      if (ask.exists) {
        await db.doc(`resetRequests/${personId(n)}`).set({ ...ask.data(), name: n });
        await ask.ref.delete();
      }
      return;
    }
  };
  await follow(name);
  const memberSnap = await db.doc(`members/${uid}`).get();
  const me = memberSnap.exists ? rename(memberSnap.get('name') || '') : '';
  if (me !== name) await follow(me);
  const signedIn = memberSnap.exists && memberSnap.get('via') === 'password';
  const fail = (message) => ({ error: message });

  // Does this name have a password yet? (The sign-in screen asks.)
  if (action === 'status') {
    if (!name) return { member: signedIn ? { name: me, admin: isManagerName(me) } : null };
    const acc = await accountRef(name).get();
    return { hasPassword: !!acc.get('hash'), thisDevice: me === name };
  }

  // A first password for a name that has none: from a device already signed
  // in as that person (before passwords), or with the team code (a setup
  // ticket the rules only accept with the right code).
  if (action === 'create') {
    if (!name) return fail('Pick your name.');
    if (password.length < PASSWORD_MIN) return fail(`Use at least ${PASSWORD_MIN} characters.`);
    const ticketRef = db.doc(`setupTickets/${uid}`);
    const ticket = await ticketRef.get();
    const viaTicket = ticket.exists && rename(ticket.get('name') || '') === name && now - (ticket.get('at') || 0) < 10 * 60000;
    if (me !== name && !viaTicket) return fail('Enter the team code to set up this name on a new device.');
    return db.runTransaction(async (tx) => {
      const acc = await tx.get(accountRef(name));
      if (acc.get('hash')) return fail('That name already has a password. Sign in with it.');
      const salt = randomBytes(16).toString('hex');
      tx.set(accountRef(name), { name, salt, hash: hashOf(password, salt), setAt: now, lastSignIn: now, fails: 0, lockedUntil: 0 });
      if (ticket.exists) tx.delete(ticketRef);
      return { ok: true };
    }).then(async (r) => (r.ok ? { ok: true, member: await signDeviceIn(uid, name) } : r));
  }

  if (action === 'signIn') {
    if (!name) return fail('Pick your name.');
    const ref = accountRef(name);
    const acc = await ref.get();
    if (!acc.get('hash')) return fail('That name has no password yet. Create one.');
    if ((acc.get('lockedUntil') || 0) > now)
      return fail(`Too many tries. Try again in ${Math.ceil((acc.get('lockedUntil') - now) / 60000)} min, or ask Asher to reset it.`);
    const given = Buffer.from(hashOf(password, acc.get('salt')), 'hex');
    const right = Buffer.from(acc.get('hash'), 'hex');
    if (given.length !== right.length || !timingSafeEqual(given, right)) {
      const fails = (acc.get('fails') || 0) + 1;
      await ref.update({ fails: fails >= LOCK_AFTER ? 0 : fails, lockedUntil: fails >= LOCK_AFTER ? now + LOCK_MS : 0 });
      return fail(fails >= LOCK_AFTER ? 'Too many tries. Try again in 10 min.' : 'That password isn’t right.');
    }
    await ref.update({ fails: 0, lockedUntil: 0, lastSignIn: now });
    return { ok: true, member: await signDeviceIn(uid, name) };
  }

  // Change your own password (signed in, knowing the old one).
  if (action === 'change') {
    if (!signedIn) return fail('Sign in first.');
    const ref = accountRef(me);
    const acc = await ref.get();
    const old = Buffer.from(hashOf(String(req.data?.old || ''), acc.get('salt') || ''), 'hex');
    const right = Buffer.from(acc.get('hash') || '', 'hex');
    if (!acc.get('hash') || old.length !== right.length || !timingSafeEqual(old, right)) return fail('Your current password isn’t right.');
    if (password.length < PASSWORD_MIN) return fail(`Use at least ${PASSWORD_MIN} characters.`);
    const salt = randomBytes(16).toString('hex');
    await ref.update({ salt, hash: hashOf(password, salt), setAt: now });
    return { ok: true };
  }

  // Answering Asher's reset request (resetRequests/{personId}), on your own
  // signed-in device: a new password (signs you out everywhere else), or no.
  if (action === 'answerReset') {
    if (!signedIn) return fail('Sign in first.');
    const reqRef = db.doc(`resetRequests/${personId(me)}`);
    if (!(await reqRef.get()).exists) return fail('There’s no reset request.');
    if (!req.data?.accept) {
      await reqRef.delete();
      await accountRef(me).set({ resetAnswer: { no: true, at: now } }, { merge: true });
      return { ok: true };
    }
    if (password.length < PASSWORD_MIN) return fail(`Use at least ${PASSWORD_MIN} characters.`);
    const salt = randomBytes(16).toString('hex');
    await accountRef(me).set(
      { name: me, salt, hash: hashOf(password, salt), setAt: now, fails: 0, lockedUntil: 0, resetAnswer: { yes: true, at: now } },
      { merge: true },
    );
    await reqRef.delete();
    const devices = await db.collection('members').get();
    const batch = db.batch();
    for (const d of devices.docs) if (rename(d.get('name') || '') === me && d.id !== uid) batch.delete(d.ref);
    await batch.commit();
    return { ok: true };
  }

  // Asher only: everyone's account (no passwords), and resetting one. A reset
  // asks the person first, on every device they're signed in on (they make a
  // new password there, or say no). Only someone signed in nowhere (who can't
  // be asked) can be reset straight away; then they make a new password the
  // next time they sign in.
  if (action === 'list' || action === 'reset' || action === 'cancelReset') {
    if (!signedIn || me !== REQUESTS_TO) throw new HttpsError('permission-denied', 'Only Asher can do that.');
    const [all, devices, asks] = await Promise.all([
      db.collection('accounts').get(),
      db.collection('members').where('via', '==', 'password').get(),
      db.collection('resetRequests').get(),
    ]);
    const devicesOf = (n) => devices.docs.filter((d) => rename(d.get('name') || '') === n).length;
    if (action === 'list')
      return {
        accounts: all.docs.map((d) => ({
          name: d.get('name'),
          hasPassword: !!d.get('hash'),
          setAt: d.get('setAt') || 0,
          lastSignIn: d.get('lastSignIn') || 0,
          locked: (d.get('lockedUntil') || 0) > now,
          devices: devicesOf(d.get('name')),
          asked: asks.docs.some((a) => a.id === d.id),
          answer: d.get('resetAnswer') || null,
        })),
      };
    if (!name) return fail('Who?');
    if (action === 'cancelReset') {
      await db.doc(`resetRequests/${personId(name)}`).delete();
      return { ok: true };
    }
    if (devicesOf(name) > 0 && !req.data?.force) {
      await db.doc(`resetRequests/${personId(name)}`).set({ name, by: me, at: now });
      await accountRef(name).set({ resetAnswer: null }, { merge: true });
      await notify([
        { to: name, type: 'account', title: `${first(me)} wants to reset your password`, body: 'Open the app to make a new one, or keep yours.', open: 'view:today', by: me },
      ]);
      return { ok: true, asked: true };
    }
    if (devicesOf(name) > 0) return fail(`${first(name)} is signed in somewhere, so they have to confirm it.`);
    await accountRef(name).set({ name, salt: '', hash: '', fails: 0, lockedUntil: 0, resetAt: now }, { merge: true });
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Unknown action.');
});

// ---------- Jackson coins casino and economy (slash commands) ----------
// The house: every roll, card, and coin change for /slots, /blackjack,
// /daily, /rob… happens here, so nobody can fake a win. Each person's
// winnings and losses live in bank/{personId}, which only this writes; the
// app adds it to what they earned (functions/shared/coins.js). The rules
// and odds are in functions/shared/casino.js (demo mode runs the same file).

// Tasks and shifts change slowly (and only ever add coins); keep
// them for 20 seconds so a run of bets doesn't reread the whole database every
// time. Spending and gifts are read fresh for each balance (balanceOf).
let coinCache = { at: 0, data: null };
async function coinData() {
  if (coinCache.data && Date.now() - coinCache.at < 20000) return coinCache.data;
  const rename = await renamer();
  const [tasks, shifts, team] = await Promise.all([
    db.collection('tasks').get(),
    db.collection('shifts').get(),
    db.doc('settings/team').get(),
  ]);
  // Same as the app: assignees by their current names, deleted tasks left out.
  const taskList = tasks.docs
    .map((d) => d.data())
    .filter((t) => !t.deletedAt)
    .map((t) => ({
      ...t,
      ...(t.assignees && { assignees: [...new Set(t.assignees.map(rename))] }),
      ...(t.createdBy && { createdBy: rename(t.createdBy) }),
    }));
  const data = {
    rename,
    tasks: taskList,
    shifts: coinsByName({ shifts: shifts.docs.map((d) => d.data()) }, rename).shifts,
    cfg: coinSettings(team.get('coins')),
    gameCap: team.get('ads')?.games?.cap ?? 10,
  };
  coinCache = { at: Date.now(), data };
  return data;
}
const bankRef = (name) => db.doc(`bank/${personId(name)}`);
// What someone has right now, the same sum the app shows. Their ledger entries
// (spending, gifts, prizes, bonuses) and any bank doc under an old name are
// read fresh, so a gift or a purchase from a second ago counts.
async function balanceOf(name, bank, data) {
  return (await freshCoins(name, bank, data)).balance;
}
async function freshCoins(name, bank, data) {
  const aliases = data.rename.aliases(name).slice(0, 30);
  const [found, old] = await Promise.all([
    Promise.all(['person', 'from', 'to'].map((f) => db.collection('coins').where(f, 'in', aliases).get())),
    aliases.length > 1 ? db.getAll(...aliases.slice(1).map(bankRef)) : [],
  ]);
  const ledger = new Map();
  for (const q of found) for (const d of q.docs) ledger.set(d.id, d.data());
  const banks = [{ ...bank, name }, ...old.filter((d) => d.exists).map((d) => d.data())];
  const mine = coinsByName({ ledger: [...ledger.values()], bank: banks }, data.rename);
  // Only the ledger and banks from here: coinsByName also hands back an empty
  // shifts list, which would hide the lab hours data.shifts already has.
  return { balance: wallet(name, { ...data, ledger: mine.ledger, bank: mine.bank }).balance, ledger: mine.ledger };
}
const nyDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

// The market and pets (functions/market.js): buying, tournaments, pet care.
export const { buy, joinTournament, marketManage, pet, payTournaments } = marketFunctions({
  db,
  coinData,
  freshCoins,
  notify,
  bankRef,
  personId,
  owner: REQUESTS_TO,
  timeZone: TIME_ZONE,
});

const ICON = {
  slots: '🎰',
  dice: '🎲',
  coinflip: '🪙',
  roulette: '🎡',
  blackjack: '🃏',
  crash: '🚀',
  mines: '💣',
  highlow: '🔼',
  lottery: '🎟️',
};
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
const note = (title, body = '') => ({ note: { title, body } });

// /work: is this person clocked in right now (read fresh, not cached), and
// what are their open tasks?
async function workContext(me, data) {
  const open = await db.collection('shifts').where('end', '==', null).get();
  return {
    onShift: open.docs.some((d) => data.rename(d.get('person') || '') === me),
    tasks: data.tasks.filter((t) => t.status !== 'done' && (t.assignees || []).includes(me)).map((t) => t.title || 'a task'),
  };
}

// Multiplayer games pay several people at once: read every bank first (a
// transaction reads before it writes), then apply each change in order.
// Winnings from the free games (x.free) stop at arcade.FREE_DAILY a day.
async function payOut(tx, money, banks, now) {
  const names = [...new Set(money.map((x) => x.name))];
  for (const n of names) if (!banks[n]) banks[n] = (await tx.get(bankRef(n))).data() || {};
  for (const x of money) banks[x.name] = casino.bankAfter(banks[x.name], x.name, ...arcade.paid(x, banks[x.name], nyDay(now)), now);
  for (const n of names) tx.set(bankRef(n), banks[n]);
}

// The Friday lottery: one doc, drawn by drawLottery.
const lotteryRef = db.doc('lottery/current');
function nextFriday(now = Date.now()) {
  for (let i = 0; i < 8; i++) {
    const day = new Date(now + i * 86400000).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
    const at = zonedMs(day, '18:00');
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 5 && at > now) return at;
  }
  return now + 7 * 86400000;
}

// Where a live game's card is, kept with its secret so settleGames can find it.
const secretWith = (secret, conv, now) => ({ ...secret, where: { conv, at: now } });

// A move in a running game: a player's, or the house settling a game nobody
// finished (house: true, from settleGames).
async function runMove({ conv, msgId, me, move, data, now, house = false }) {
  const msgRef = db.doc(`channels/${conv}/messages/${msgId}`);
  const secretRef = db.doc(`gameSecrets/${msgId}`);
  return db.runTransaction(async (tx) => {
    const [msg, secret] = await Promise.all([tx.get(msgRef), tx.get(secretRef)]);
    const c = msg.get('cmd');
    if (!msg.exists || !c || !secret.exists) {
      if (house && secret.exists) tx.delete(secretRef);
      return note('That game is gone.');
    }
    // Multiplayer: the game decides who may move (arcade.js).
    if (arcade.MULTI.includes(c.name)) {
      if (!arcade.isLive(c.status)) return { ok: true };
      const myBank = house ? null : (await tx.get(bankRef(me))).data() || {};
      const r = arcade.move(c.name, {
        pub: { ...c.game, status: c.status },
        secret: secret.data(),
        me,
        move,
        balance: house ? 0 : await balanceOf(me, myBank, data),
        now,
      });
      if (r.error) return note(r.error);
      if (!r.write) return { ok: true, serverNow: now };
      await payOut(tx, r.money, house ? {} : { [me]: myBank }, now);
      const { status, ...game } = r.pub;
      if (arcade.isLive(status)) tx.set(secretRef, secretWith(r.secret, conv, now));
      else tx.delete(secretRef);
      tx.update(msgRef, { 'cmd.game': game, 'cmd.status': status });
      return { ok: true, serverNow: now };
    }
    const player = data.rename(msg.get('by'));
    if (!house && move !== 'peek' && player !== me) return note('That’s not your game.');
    if (c.status !== 'playing') return { ok: true };
    const bank = (await tx.get(bankRef(player))).data() || {};
    // Doubling down puts in the bet again, so it has to be there.
    if (move === 'double' && (await balanceOf(player, bank, data)) < c.bet) return note('Not enough coins to double.');
    const r = casino.moveGame(c.name, { ...c.game, status: c.status }, secret.data(), move, c.bet, now);
    if (r.error) return note(r.error);
    // Still flying: nothing to write.
    if (move === 'peek' && !r.done) return { ok: true, serverNow: now };
    const bet = c.bet + (r.extraBet || 0);
    const { status, ...game } = r.pub;
    const update = { 'cmd.game': game, 'cmd.status': status, 'cmd.bet': bet };
    if (r.done) {
      // The bet was taken when the game started (and again when doubling):
      // pay back what it won; the history shows the overall result.
      const net = r.payout - bet;
      const entry = {
        game: c.name,
        icon: ICON[c.name],
        label: `${LABEL[c.name]}: ${net > 0 ? `won ${net}` : net < 0 ? `lost ${-net}` : 'bet back'}`,
        shown: net,
      };
      tx.set(bankRef(player), casino.bankAfter(bank, player, r.payout - (r.extraBet || 0), entry, {}, now));
      Object.assign(update, { 'cmd.payout': r.payout, 'cmd.net': net });
      tx.delete(secretRef);
    } else tx.set(secretRef, secretWith(r.secret, conv, now));
    tx.update(msgRef, update);
    return { ok: true, serverNow: now };
  });
}

export const play = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const member = await db.doc(`members/${uid}`).get();
  if (!member.exists || member.get('via') !== 'password') throw new HttpsError('permission-denied', 'Sign in first.');
  const data = await coinData();
  const me = data.rename(member.get('name'));
  const { action, game, conv = '', args = [], msgId, move, replyTo = null } = req.data || {};
  const now = Date.now();
  const words = (Array.isArray(args) ? args : []).map(String).slice(0, 6);

  // A gift to a teammate, or a prize from an ad game or the prize wheel. The
  // bank doc is read and touched so two at once (or one during a bet) take
  // turns, and the second one sees the first.
  if (action === 'gift' || action === 'prize') {
    if (me !== REQUESTS_TO) {
      const controls = (await db.doc('settings/controls').get()).data() || {};
      if ((controls.off || []).includes('coins')) return note('🪙 Jackson coins are off right now.');
    }
    const roster =
      action === 'gift' ? (await db.collection('people').get()).docs.map((d) => data.rename(d.get('name') || '')).filter(Boolean) : [];
    const body = req.data || {};
    return db.runTransaction(async (tx) => {
      const myBank = (await tx.get(bankRef(me))).data() || {};
      const mine = await freshCoins(me, myBank, data);
      const entry =
        action === 'gift'
          ? giftEntry(me, { ...body, to: data.rename(String(body.to || '')) }, { roster, balance: mine.balance, now })
          : prizeEntry(me, body, { ledger: mine.ledger, gameCap: data.gameCap, now });
      if (entry.error) return note(entry.error, entry.body);
      tx.set(db.collection('coins').doc(), entry);
      tx.set(bankRef(me), { ...myBank, name: me, touched: now });
      return { ok: true, entry };
    });
  }

  // A move in a running game (or a peek at a crash).
  if (action === 'move') {
    if (!/^[\w-]{1,40}$/.test(conv) || !/^[\w-]{1,40}$/.test(msgId || '')) throw new HttpsError('invalid-argument', 'Which game?');
    return runMove({ conv, msgId, me, move: String(move), data, now });
  }

  // A new command.
  if (!/^[\w-]{1,40}$/.test(conv) || conv === 'announcements')
    return note('Not here.', 'Use #arcade for the casino, or any channel for the rest.');
  const isCasino = casino.CASINO.includes(game);
  const isArcade = arcade.MULTI.includes(game);
  if (!isCasino && !isArcade && !casino.ECONOMY.includes(game)) throw new HttpsError('invalid-argument', 'Unknown command.');
  // Asher's switches: off, or not allowed in this channel (read fresh, not cached).
  const stop = blocked(game, serverGroup(game), conv, (await db.doc('settings/team').get()).get('commands'));
  if (stop) return { note: stop };
  // Asher's Controls (src/controls.js): coins or this channel switched off for everyone but him.
  if (me !== REQUESTS_TO) {
    const controls = (await db.doc('settings/controls').get()).data() || {};
    if ((controls.channelsOff || []).includes(conv)) return note('Not here.', 'This channel is off right now.');
    if ((controls.off || []).includes('coins')) return note('🪙 Jackson coins are off right now.');
  }
  const roster = isArcade ? (await db.collection('people').get()).docs.map((d) => data.rename(d.get('name') || '')).filter(Boolean) : [];
  const msgRef = db.collection(`channels/${conv}/messages`).doc();
  const text = `/${game}${words.length ? ` ${words.join(' ')}` : ''}`.slice(0, 200);
  const post = (tx, cmd, mentions = []) =>
    tx.set(msgRef, {
      text,
      by: me,
      byUid: uid,
      at: now,
      cmd: { ...cmd, name: game },
      mentions,
      taskIds: [],
      replyTo,
      reactions: {},
      photo: null,
    });

  return db.runTransaction(async (tx) => {
    const myBank = (await tx.get(bankRef(me))).data() || {};
    const balance = await balanceOf(me, myBank, data);

    if (game === 'lottery') {
      const lot = (await tx.get(lotteryRef)).data() || {};
      // One lottery card is open at a time: the round's first /lottery posts
      // it, and later tickets (typed, or its Buy buttons) go on that card.
      const openRef = lot.open ? db.doc(`channels/${lot.open.conv}/messages/${lot.open.id}`) : null;
      const open = openRef && (await tx.get(openRef)).exists ? lot.open : null;
      const drawAt = lot.drawAt && lot.drawAt > now ? lot.drawAt : nextFriday(now);
      const n = words[0] ? casino.parseBet(words[0], Math.floor(balance / casino.TICKET)) : 0;
      if (words[0] && (!n || n < 1)) return note('How many tickets?', `Tickets are ${casino.TICKET} coins. Try: /lottery 3`);
      const cost = (n || 0) * casino.TICKET;
      if (cost > balance) return note(`That’s ${cost} coins. You have ${balance}.`);
      const tickets = { ...(lot.tickets || {}) };
      if (n) tickets[me] = (tickets[me] || 0) + n;
      const pot = (lot.pot || 0) + cost;
      const people = Object.keys(tickets).length;
      tx.set(lotteryRef, { pot, tickets, drawAt, round: lot.round || 1, last: lot.last || null, open: open || { conv, id: msgRef.id } });
      if (n)
        tx.set(bankRef(me), casino.bankAfter(myBank, me, -cost, { icon: '🎟️', label: `Lottery: ${n} ticket${n > 1 ? 's' : ''}` }, {}, now));
      if (!open) {
        post(tx, { bought: n || 0, mine: tickets[me] || 0, pot, drawAt, people, last: lot.last || null });
        return { ok: true };
      }
      tx.update(openRef, { 'cmd.pot': pot, 'cmd.people': people });
      return { ok: true, note: casino.lotteryNote(n, tickets[me] || 0, pot, open.conv, conv) };
    }

    if (isArcade) {
      const r = arcade.start(game, { me, words, roster, balance, bank: myBank, now });
      if (r.error) return note(r.error);
      await payOut(tx, r.money, { [me]: myBank }, now);
      tx.set(db.doc(`gameSecrets/${msgRef.id}`), secretWith(r.secret, conv, now));
      const { status, ...g } = r.pub;
      post(tx, { game: g, status, bet: g.bet || 0 }, r.mentions);
      return { ok: true, serverNow: now };
    }

    if (isCasino) {
      const bet = casino.parseBet(words[0], balance);
      if (!bet || bet < 1) return note(`/${game} needs a bet`, `Try: /${game} 20 (or all, half, 25%). You have ${balance} coins.`);
      if (bet > balance) return note(`You only have ${balance} coins.`, 'Try /daily, /work, or /beg.');
      const r = casino.startGame(game, bet, words.slice(1), Math.random, now);
      if (r.error) return note(r.error);
      const { status = 'done', ...game2 } = r.pub;
      if (r.done) {
        const net = r.payout - bet;
        tx.set(
          bankRef(me),
          casino.bankAfter(
            myBank,
            me,
            net,
            { game, icon: ICON[game], label: `${LABEL[game]}: ${net >= 0 ? `won ${net}` : `lost ${-net}`}` },
            {},
            now,
          ),
        );
        post(tx, { game: game2, status, bet, payout: r.payout, net });
      } else {
        // Take the bet now; the end of the game pays back what it won.
        tx.set(bankRef(me), casino.bankAfter(myBank, me, -bet, null, {}, now));
        tx.set(db.doc(`gameSecrets/${msgRef.id}`), secretWith(r.secret, conv, now));
        post(tx, { game: game2, status, bet });
      }
      return { ok: true, serverNow: now };
    }

    // Economy
    if (game === 'rob') {
      const target = words.join(' ').replace(/^@/, '');
      const people = (await db.collection('people').get()).docs.map((d) => data.rename(d.get('name') || '')).filter(Boolean);
      const lower = target.toLowerCase();
      const them =
        people.find((n) => lower.includes(n.toLowerCase())) || people.find((n) => n.toLowerCase().split(' ')[0] === lower.split(' ')[0]);
      if (!them) return note('Rob who?', 'Try: /rob @name');
      if (them === me) return note('You can’t rob yourself.', 'You’d just be moving coins between pockets.');
      const theirBank = (await tx.get(bankRef(them))).data() || {};
      const r = casino.rob(myBank, balance, await balanceOf(them, theirBank, data), now);
      if (r.error) return note(r.error);
      tx.set(
        bankRef(me),
        casino.bankAfter(
          myBank,
          me,
          r.amount,
          { icon: r.card.ok ? '🦹' : '🚓', label: r.card.ok ? `Robbed ${them}` : `Caught robbing ${them}` },
          r.bank,
          now,
        ),
      );
      tx.set(
        bankRef(them),
        casino.bankAfter(
          theirBank,
          them,
          r.theirs,
          { icon: r.card.ok ? '😱' : '🚓', label: r.card.ok ? `Robbed by ${me}` : `${me} paid you a fine` },
          {},
          now,
        ),
      );
      post(
        tx,
        {
          ...r.card,
          to: them,
          line: r.card.ok ? `robbed you and got away with ${r.amount} coins` : `tried to rob you and paid you a ${r.amount} coin fine`,
        },
        [them],
      );
      return { ok: true };
    }
    const r =
      game === 'daily'
        ? casino.daily(myBank, nyDay(now), nyDay(now - 86400000))
        : game === 'work'
          ? casino.work(myBank, now, Math.random, await workContext(me, data))
          : casino.beg(myBank, now);
    if (r.error) return note(r.error);
    const label = { daily: `Daily coins (streak ${r.card.streak})`, work: `Work: ${r.card.job}`, beg: 'Begging' }[game];
    tx.set(
      bankRef(me),
      casino.bankAfter(myBank, me, r.amount, r.amount ? { icon: { daily: '📅', work: '🛠️', beg: '🥺' }[game], label } : null, r.bank, now),
    );
    post(tx, r.card);
    return { ok: true };
  });
});

// Every 10 minutes: finish games nobody finished, so no one's bet stays stuck
// on a card nobody has open. Multiplayer games settle by their own timers
// (an expired challenge, a type race that ended, a board game left alone);
// casino games left alone for casino.ABANDONED are played out for the player.
export const settleGames = onSchedule({ schedule: 'every 10 minutes', timeZone: TIME_ZONE }, async () => {
  const now = Date.now();
  const live = await db.collection('gameSecrets').get();
  if (live.empty) return;
  const data = await coinData();
  for (const d of live.docs) {
    const where = d.get('where');
    if (!where?.conv) continue; // games from before this was kept
    const msg = await db.doc(`channels/${where.conv}/messages/${d.id}`).get();
    const c = msg.get('cmd');
    let move = 'peek';
    if (c && !arcade.MULTI.includes(c.name)) {
      if (now - (where.at || 0) < casino.ABANDONED) continue;
      move = casino.abandonMove(c.name, c.game || {});
      if (!move) continue;
    }
    await runMove({ conv: where.conv, msgId: d.id, me: '', move, data, now, house: true }).catch((e) =>
      logger.warn('settle', d.id, e.message),
    );
  }
});

// Fridays at 6 PM (New York): draw the lottery. One ticket wins the whole pot.
export const drawLottery = onSchedule({ schedule: '0 18 * * 5', timeZone: TIME_ZONE }, async () => {
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const lot = (await tx.get(lotteryRef)).data();
    // The round's open card closes (unless someone deleted it).
    const openRef = lot?.open ? db.doc(`channels/${lot.open.conv}/messages/${lot.open.id}`) : null;
    const openCard = openRef && (await tx.get(openRef)).exists;
    if (!lot || !lot.pot || !Object.keys(lot.tickets || {}).length) {
      if (openCard) tx.update(openRef, { 'cmd.closed': true, 'cmd.pot': 0, 'cmd.people': 0, 'cmd.winner': null });
      tx.set(lotteryRef, { pot: 0, tickets: {}, drawAt: nextFriday(now + 60000), round: (lot?.round || 0) + 1, last: lot?.last || null });
      return;
    }
    const entries = Object.entries(lot.tickets);
    const total = entries.reduce((t, [, n]) => t + n, 0);
    let r = Math.floor(Math.random() * total);
    const [winner, theirs] = entries.find(([, n]) => (r -= n) < 0) || entries[0];
    const bank = (await tx.get(bankRef(winner))).data() || {};
    if (openCard) tx.update(openRef, { 'cmd.closed': true, 'cmd.pot': lot.pot, 'cmd.people': entries.length, 'cmd.winner': winner });
    tx.set(bankRef(winner), casino.bankAfter(bank, winner, lot.pot, { icon: '🎟️', label: `Won the lottery (${lot.pot} coins)` }, {}, now));
    const last = { winner, pot: lot.pot, tickets: theirs, of: total, people: entries.length, at: now };
    tx.set(lotteryRef, { pot: 0, tickets: {}, drawAt: nextFriday(now + 60000), round: (lot.round || 1) + 1, last });
    tx.set(db.collection('channels/arcade/messages').doc(), {
      text: `🎟️ ${winner} won the lottery: ${lot.pot} coins!`,
      by: 'Trotbot',
      byUid: 'trotbot',
      bot: true,
      at: now,
      cmd: { name: 'lottery', draw: last, line: `won the lottery: ${lot.pot} coins` },
      mentions: [winner],
      taskIds: [],
      replyTo: null,
      reactions: {},
      photo: null,
    });
  });
});

// The match schedule from FIRST's FTC Events API (Today's pit screen). Team
// management only. The key lives in two Firebase secrets, FTC_API_USER (the
// username it was issued to) and FTC_API_KEY (the authorization key). The
// deploy workflow fills them in from the GitHub secrets of the same names, or
// with "unset" until they're added; then this answers { notSetUp }.
const FTC_API_USER = defineSecret('FTC_API_USER');
const FTC_API_KEY = defineSecret('FTC_API_KEY');
const FTC_API = 'https://ftc-api.firstinspires.org/v2.0';

async function ftcGet(path, auth) {
  let res;
  try {
    res = await fetch(`${FTC_API}${path}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    logger.warn('ftc events fetch', path, e?.message);
    throw new HttpsError('unavailable', 'Couldn’t reach FTC Events. Try again, or type the matches in.');
  }
  if (res.status === 401 || res.status === 403)
    throw new HttpsError('failed-precondition', 'FTC Events turned down the API key. Check FTC_API_USER and FTC_API_KEY.');
  // An event with no schedule (or no playoffs) yet answers 404 or nothing.
  if (res.status === 404 || res.status === 204) return null;
  if (!res.ok) {
    logger.warn('ftc events', path, res.status);
    throw new HttpsError('unavailable', `FTC Events answered ${res.status}. Try again in a minute, or type the matches in.`);
  }
  return res.json().catch(() => null);
}

export const ftcEvents = onCall(
  { maxInstances: 2, invoker: 'public', secrets: [FTC_API_USER, FTC_API_KEY], timeoutSeconds: 60 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!member.exists || member.get('via') !== 'password' || member.get('admin') !== true)
      throw new HttpsError('permission-denied', 'Only team management can pull the schedule.');
    const user = (FTC_API_USER.value() || '').trim();
    const key = (FTC_API_KEY.value() || '').trim();
    if (!user || !key || user === 'unset' || key === 'unset') return { notSetUp: true };
    const auth = Buffer.from(`${user}:${key}`).toString('base64');
    const { action } = req.data || {};
    const season = Number(req.data?.season) || seasonOf(Date.now());

    // The team's events this season, to pick from.
    if (action === 'events') {
      const data = await ftcGet(`/${season}/events?teamNumber=${TEAM_NUMBER}`, auth);
      const events = (data?.events || []).map((e) => ({
        code: String(e.code || ''),
        name: String(e.name || ''),
        start: String(e.dateStart || '').slice(0, 10),
        tz: String(e.timezone || ''),
        city: [e.city, e.stateprov].filter(Boolean).join(', '),
      }));
      return { events: events.sort((a, b) => a.start.localeCompare(b.start)) };
    }

    if (action !== 'sync') throw new HttpsError('invalid-argument', 'Unknown action.');
    const event = String(req.data?.event || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{2,20}$/.test(event)) throw new HttpsError('invalid-argument', 'Type the event code first (like USNYNYQ1).');
    const info = (await ftcGet(`/${season}/events?eventCode=${event}`, auth))?.events?.[0];
    if (!info) return { error: `FTC Events has no event ${event} in the ${season} season. Check the code.` };
    const tz = String(info.timezone || '') || 'America/New_York';
    const team = `teamNumber=${TEAM_NUMBER}`;
    const [qual, playoff, qualScores, playoffScores, rankings] = await Promise.all([
      ftcGet(`/${season}/schedule/${event}?tournamentLevel=qual&${team}`, auth),
      ftcGet(`/${season}/schedule/${event}?tournamentLevel=playoff&${team}`, auth),
      ftcGet(`/${season}/matches/${event}?tournamentLevel=qual&${team}`, auth),
      ftcGet(`/${season}/matches/${event}?tournamentLevel=playoff&${team}`, auth),
      ftcGet(`/${season}/rankings/${event}`, auth),
    ]);
    const found = [...(qual?.schedule || []), ...(playoff?.schedule || [])].map((e) => fromSchedule(e, event, tz)).filter(Boolean);
    const scores = new Map(
      [...(qualScores?.matches || []), ...(playoffScores?.matches || [])]
        .map(scoreOf)
        .filter(Boolean)
        .map((s) => [s.label, s.score]),
    );
    // Merged, so what the team added (its own score, the checklist) stays.
    const existing = new Set((await db.collection('matches').where('event', '==', event).get()).docs.map((d) => d.id));
    const now = Date.now();
    const batch = db.batch();
    for (const { id, ...m } of found) {
      const score = scores.get(m.label);
      batch.set(db.doc(`matches/${id}`), { ...m, ...(score ? { score } : {}), syncedAt: now }, { merge: true });
    }
    const rank = rankOf(rankings?.rankings);
    const name = String(info.name || event).slice(0, 120);
    batch.set(db.doc('settings/team'), { compEvent: { code: event, name, tz }, compRank: rank, compSyncedAt: now }, { merge: true });
    await batch.commit();
    return {
      ok: true,
      name,
      count: found.length,
      added: found.filter((m) => !existing.has(m.id)).length,
      scored: found.filter((m) => scores.has(m.label)).length,
      rank,
    };
  },
);

// Team life (life.js): the weekly recap, lab bingo, score predictions and
// coins for streak milestones.
export const { claimBingo, bingoSweep, predict, onRunLogged, lockPredictions, onShiftEnded, weeklyRecap, recap } = lifeFunctions({
  db,
  renamer,
});
