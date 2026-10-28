// Notifications for the task board. Each one is written to the person's
// inbox (the 🔔 on the site) and pushed to every device they turned
// notifications on for.
import { readFileSync } from 'node:fs';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { fetchPage, firstLink, readPreview } from './preview.js';
import { coinSettings, wallet } from './shared/coins.js';
import * as casino from './shared/casino.js';
import * as arcade from './shared/arcade.js';
import { blocked, serverGroup } from './shared/commandRules.js';

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
  for (const n of notes) {
    if (n.quiet) continue; // inbox only (no buzz at night)
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
// days, at the chosen time (New York time), once a day. Skipped when the day
// already has a check-in, and if it's more than 6 hours past the time (so a
// late deploy doesn't ask at night). onCheckin then notifies everyone.
export const scheduledCheckin = onSchedule({ schedule: 'every 15 minutes', timeZone: TIME_ZONE }, async () => {
  const s = (await db.doc('settings/team').get()).get('checkinSchedule');
  if (!s?.on || !(s.slots || []).length || !/^\d\d:\d\d$/.test(s.time || '')) return;
  const today = localDate(0);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (!(s.days || []).includes(weekday)) return;
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

// ---------- Jackson coins casino and economy (slash commands) ----------
// The house: every roll, card, and coin change for /slots, /blackjack,
// /daily, /rob… happens here, so nobody can fake a win. Each person's
// winnings and losses live in bank/{personId}, which only this writes; the
// app adds it to what they earned (functions/shared/coins.js). The rules
// and odds are in functions/shared/casino.js (demo mode runs the same file).

// Tasks, shifts, and the ledger change slowly; keep them for 20 seconds so a
// run of bets doesn't reread the whole database every time.
let coinCache = { at: 0, data: null };
async function coinData() {
  if (coinCache.data && Date.now() - coinCache.at < 20000) return coinCache.data;
  const rename = await renamer();
  const [tasks, shifts, coins, adStats, team] = await Promise.all([
    db.collection('tasks').get(),
    db.collection('shifts').get(),
    db.collection('coins').get(),
    db.collection('adStats').get(),
    db.doc('settings/team').get(),
  ]);
  // Same as the app: assignees by their current names, deleted tasks left out.
  const taskList = tasks.docs
    .map((d) => d.data())
    .filter((t) => !t.deletedAt)
    .map((t) => (t.assignees ? { ...t, assignees: [...new Set(t.assignees.map(rename))] } : t));
  const data = {
    rename,
    tasks: taskList,
    shifts: shifts.docs.map((d) => d.data()),
    ledger: coins.docs.map((d) => d.data()),
    adStats: Object.fromEntries(adStats.docs.map((d) => [d.id, d.data()])),
    cfg: coinSettings(team.get('coins')),
  };
  coinCache = { at: Date.now(), data };
  return data;
}
const balanceOf = (name, bank, data) => wallet(name, { ...data, owner: name === REQUESTS_TO, bank: { [name]: bank } }).balance;
const bankRef = (name) => db.doc(`bank/${personId(name)}`);
const nyDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

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
async function payOut(tx, money, banks, now) {
  const names = [...new Set(money.map((x) => x.name))];
  for (const n of names) if (!banks[n]) banks[n] = (await tx.get(bankRef(n))).data() || {};
  for (const x of money) banks[x.name] = casino.bankAfter(banks[x.name], x.name, x.delta, x.entry, x.extra || {}, now);
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

export const play = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const member = await db.doc(`members/${uid}`).get();
  if (!member.exists) throw new HttpsError('permission-denied', 'Join the team first.');
  const data = await coinData();
  const me = data.rename(member.get('name'));
  const { action, game, conv = '', args = [], msgId, move, replyTo = null } = req.data || {};
  const now = Date.now();
  const words = (Array.isArray(args) ? args : []).map(String).slice(0, 6);

  // A move in a running game (or a peek at a crash).
  if (action === 'move') {
    if (!/^[\w-]{1,40}$/.test(conv) || !/^[\w-]{1,40}$/.test(msgId || '')) throw new HttpsError('invalid-argument', 'Which game?');
    const msgRef = db.doc(`channels/${conv}/messages/${msgId}`);
    const secretRef = db.doc(`gameSecrets/${msgId}`);
    return db.runTransaction(async (tx) => {
      const [msg, secret] = await Promise.all([tx.get(msgRef), tx.get(secretRef)]);
      const c = msg.get('cmd');
      if (!msg.exists || !c || !secret.exists) return note('That game is gone.');
      // Multiplayer: the game decides who may move (arcade.js).
      if (arcade.MULTI.includes(c.name)) {
        if (!arcade.isLive(c.status)) return { ok: true };
        const myBank = (await tx.get(bankRef(me))).data() || {};
        const r = arcade.move(c.name, {
          pub: { ...c.game, status: c.status },
          secret: secret.data(),
          me,
          move: String(move),
          balance: balanceOf(me, myBank, data),
          now,
        });
        if (r.error) return note(r.error);
        if (!r.write) return { ok: true, serverNow: now };
        await payOut(tx, r.money, { [me]: myBank }, now);
        const { status, ...game } = r.pub;
        if (arcade.isLive(status)) tx.set(secretRef, r.secret);
        else tx.delete(secretRef);
        tx.update(msgRef, { 'cmd.game': game, 'cmd.status': status });
        return { ok: true, serverNow: now };
      }
      const player = data.rename(msg.get('by'));
      if (move !== 'peek' && player !== me) return note('That’s not your game.');
      if (c.status !== 'playing') return { ok: true };
      const bank = (await tx.get(bankRef(player))).data() || {};
      // Doubling down puts in the bet again, so it has to be there.
      if (move === 'double' && balanceOf(player, bank, data) < c.bet) return note('Not enough coins to double.');
      const r = casino.moveGame(c.name, { ...c.game, status: c.status }, secret.data(), String(move), c.bet, now);
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
          label: `${LABEL[c.name]}: ${net >= 0 ? `won ${net}` : `lost ${-net}`}`,
          shown: net,
        };
        tx.set(bankRef(player), casino.bankAfter(bank, player, r.payout - (r.extraBet || 0), entry, {}, now));
        Object.assign(update, { 'cmd.payout': r.payout, 'cmd.net': net });
        tx.delete(secretRef);
      } else tx.set(secretRef, r.secret);
      tx.update(msgRef, update);
      return { ok: true, serverNow: now };
    });
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
    const balance = balanceOf(me, myBank, data);

    if (game === 'lottery') {
      const lot = (await tx.get(lotteryRef)).data() || {};
      const drawAt = lot.drawAt && lot.drawAt > now ? lot.drawAt : nextFriday(now);
      const n = words[0] ? casino.parseBet(words[0], Math.floor(balance / casino.TICKET)) : 0;
      if (words[0] && (!n || n < 1)) return note('How many tickets?', `Tickets are ${casino.TICKET} coins. Try: /lottery 3`);
      const cost = (n || 0) * casino.TICKET;
      if (cost > balance) return note(`That’s ${cost} coins. You have ${balance}.`);
      const tickets = { ...(lot.tickets || {}) };
      if (n) tickets[me] = (tickets[me] || 0) + n;
      const pot = (lot.pot || 0) + cost;
      tx.set(lotteryRef, { pot, tickets, drawAt, round: lot.round || 1, last: lot.last || null });
      if (n)
        tx.set(bankRef(me), casino.bankAfter(myBank, me, -cost, { icon: '🎟️', label: `Lottery: ${n} ticket${n > 1 ? 's' : ''}` }, {}, now));
      post(tx, { bought: n || 0, mine: tickets[me] || 0, pot, drawAt, people: Object.keys(tickets).length, last: lot.last || null });
      return { ok: true };
    }

    if (isArcade) {
      const r = arcade.start(game, { me, words, roster, balance, bank: myBank, now });
      if (r.error) return note(r.error);
      await payOut(tx, r.money, { [me]: myBank }, now);
      tx.set(db.doc(`gameSecrets/${msgRef.id}`), r.secret);
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
        tx.set(db.doc(`gameSecrets/${msgRef.id}`), r.secret);
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
      const r = casino.rob(myBank, balance, balanceOf(them, theirBank, data), now);
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

// Fridays at 6 PM (New York): draw the lottery. One ticket wins the whole pot.
export const drawLottery = onSchedule({ schedule: '0 18 * * 5', timeZone: TIME_ZONE }, async () => {
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const lot = (await tx.get(lotteryRef)).data();
    if (!lot || !lot.pot || !Object.keys(lot.tickets || {}).length) {
      tx.set(lotteryRef, { pot: 0, tickets: {}, drawAt: nextFriday(now + 60000), round: (lot?.round || 0) + 1, last: lot?.last || null });
      return;
    }
    const entries = Object.entries(lot.tickets);
    const total = entries.reduce((t, [, n]) => t + n, 0);
    let r = Math.floor(Math.random() * total);
    const [winner, theirs] = entries.find(([, n]) => (r -= n) < 0) || entries[0];
    const bank = (await tx.get(bankRef(winner))).data() || {};
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
