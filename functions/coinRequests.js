// Coin requests (/request @person amount [reason]) on the server. Asking only
// posts a card; the person asked pays with one tap, and the coins move the
// way /give moves them (the play function's 'gift': giftEntry, the same cap,
// the same balance check, the same switches), as a gift from them to the
// person asking with the reason as its note.
//
// Callable coinRequest({ action, … }):
//   create  { conv, to, amount, reason, replyTo }   ask someone (posts the card)
//   pay     { conv, id }                            the person asked: pay it
//   decline { conv, id }                            the person asked: say no
//   cancel  { conv, id }                            the person asking: take it back
//   peek    { conv, id }                            anyone: its 24 hours ran out
// Scheduled expireCoinRequests closes requests nobody answered in time.
//
// Data (all written here only; the rules let nobody else write them):
//   coinRequests/{msgId}       the request: from, to, amount, reason, conv,
//                              at, expiresAt, status (open, paid, declined,
//                              cancelled, expired), decidedAt, paidAt, entry
//   coinRequestsOpen/{person}  the asker's waiting request ids and how many
//                              they made today (the lock the "3 waiting at
//                              once" and "20 a day" limits are counted under)
//   the card: the message with the same id, cmd { name: 'request',
//   kind: 'coins', ask, status }, a copy for showing. Pay reads the request
//   doc, never the card or anything the app sends.
//   coins/req-{msgId}          the gift a paid request wrote (a fixed id, so
//                              a second pay can't add a second one)
//
// Pay is one transaction: the request's status, the payer's bank doc (read
// and touched, like a gift, so a bet or gift at the same moment takes turns
// and sees this one), the gift and the card. Two taps or two devices: the
// second finds the request paid and does nothing.
//
// Groups (/request @Programming 5 for pizza, /request @everyone 1):
//   create  { conv, group: { groups, everyone, people }, amount, reason, key }
// The server works out who's in the group from its own data (functions/
// groups.js; the app's list of people is never used) and makes one request
// per person, each with its own doc, paid or declined on its own exactly
// like a one-person request, under ONE card. Anyone already waiting on a
// request from the asker is skipped (and named in the answer). Not in DMs.
//   coinRequestGroups/{g-key-asker}  the group: from, conv, amount, reason,
//                              label, rows [{ id, to, row }], openTo (who
//                              hasn't answered yet; each answer takes its
//                              person off with arrayRemove, never a
//                              read-modify-write)
//   coinRequests/{g-…-N}       each person's request, as above, plus group
//                              and row (its key on the card)
//   the card: the message with the group's id, cmd { …, group: { label },
//   rows: { r0: { to, status, paidAt? }, … } }; each answer writes only its
//   own row's fields, so members paying at the same moment don't collide.
// A group counts as ONE open request toward the 3-waiting limit (the lock's
// `groups`; open while someone in openTo hasn't answered) and one toward 20
// a day. Its id comes from the app's key, so a double send makes one group.
// Taps on a group card send the card's id: Pay and Decline act on the
// caller's own row (found by their name here, so nobody can pay or decline
// for someone else); Cancel (the asker) and a peek after 24 hours close
// every row still open, each in its own transaction.
// Notifications: each person asked hears about it like a one-person
// request, but quietly (inbox, no push) when someone other than team
// management uses @everyone. Answers to an @everyone request reach the
// asker's inbox quietly too.
//
// Shapes and checks: functions/shared/coinRequests.js.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { SUBTEAMS, cleanName, memberOk, nameKey, onTeam } from './shared/team.js';
import { GROUP_MAX, groupLabel, resolveTargets } from './shared/groups.js';
import { groupTeam } from './groups.js';
import { blocked, isOff } from './shared/commandRules.js';
import * as ask from './shared/coinRequests.js';
import { teamDay } from './shared/coins.js';

const OPEN = { maxInstances: 5, invoker: 'public' };
const first = (n) => (n || 'Someone').split(' ')[0];
const note = (title, body = '') => ({ note: { title, body } });
const validId = (id) => typeof id === 'string' && /^[\w-]{1,100}$/.test(id);
// A group request's id (and its card's), made from the app's key and the asker.
const isGroupId = (id) => /^g-/.test(id);

// Where a conversation's messages are: a channel (not #announcements) or a DM.
export function messagesOf(conv) {
  if (typeof conv !== 'string') return null;
  const dm = /^dm:([\w-]{1,120})$/.exec(conv);
  if (dm) return { dm: dm[1], col: `dms/${dm[1]}/messages` };
  if (/^[\w-]{1,40}$/.test(conv) && conv !== 'announcements') return { channel: conv, col: `channels/${conv}/messages` };
  return null;
}

export function coinRequestFunctions({ db, coinData, freshCoins, bankRef, notify, owner, timeZone, loanLock = async () => null }) {
  const reqRef = (id) => db.doc(`coinRequests/${id}`);
  const groupRef = (id) => db.doc(`coinRequestGroups/${id}`);
  const lockRef = (name) => db.doc(`coinRequestsOpen/${nameKey(name)}`);

  async function caller(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    return { uid, me: data.rename(member.get('name')), data, admin: member.get('admin') === true };
  }

  // The switches /give has: Controls > Jackson coins (everyone but the owner)
  // and /give on the Commands page; asking also needs /request on and both
  // allowed in this channel. Read fresh each time.
  async function switchedOff(me, { conv = '', creating = false } = {}) {
    const [controlsDoc, teamDoc] = await Promise.all([db.doc('settings/controls').get(), db.doc('settings/team').get()]);
    const controls = controlsDoc.data() || {};
    const cfg = teamDoc.get('commands');
    if (me !== owner) {
      if ((controls.off || []).includes('coins')) return note('🪙 Jackson coins are off right now.');
      if (creating && (controls.channelsOff || []).includes(conv)) return note('Not here.', 'This channel is off right now.');
    }
    if (isOff('give', cfg)) return note('/give is turned off', 'Sending coins is off for now, so coin requests are too.');
    if (creating) {
      const stop = blocked('request', 'basics', conv, cfg) || blocked('give', 'economy', conv, cfg);
      if (stop) return { note: stop };
    } else if (isOff('request', cfg)) return note('/request is turned off', 'It’s off for now.');
    return null;
  }

  // Everyone on the team, under current names (who can be asked, and who a
  // gift can go to: the same list the play function's gifts use).
  async function rosterOf(rename) {
    return (await db.collection('people').get()).docs.map((d) => rename(d.get('name') || '')).filter(Boolean);
  }
  // Is this person on the team now: signed in on a device that's let in, and
  // not removed by team management.
  async function isActive(name, rename) {
    const aliases = rename.aliases(name).slice(0, 30);
    const [devices, roles, people] = await Promise.all([
      db.collection('members').where('name', 'in', aliases).get(),
      db.collection('roles').get(),
      db.collection('people').get(),
    ]);
    if (!devices.docs.some((d) => memberOk(d.data()))) return false;
    return onTeam(name, { rename, roles: roles.docs.map((d) => d.data()), people: people.docs.map((d) => d.data()) });
  }

  // My requests still waiting, read in a create's transaction: one-person
  // ones ({ id, to }) and groups ({ id, people: who hasn't answered }).
  async function openOf(tx, me, rename, now) {
    const lock = (await tx.get(lockRef(me))).data() || {};
    const ids = (Array.isArray(lock.ids) ? lock.ids : []).filter(validId).slice(-20);
    const gids = (Array.isArray(lock.groups) ? lock.groups : []).filter(validId).slice(-20);
    const [olds, groups] = await Promise.all([
      ids.length ? Promise.all(ids.map((x) => tx.get(reqRef(x)))) : [],
      gids.length ? Promise.all(gids.map((x) => tx.get(groupRef(x)))) : [],
    ]);
    const singles = olds
      .filter((d) => d.exists && d.get('status') === 'open' && (d.get('expiresAt') || 0) > now)
      .map((d) => ({ id: d.id, to: rename(d.get('to') || ''), expiresAt: d.get('expiresAt') }));
    const many = groups
      .filter((d) => d.exists && (d.get('openTo') || []).length && (d.get('expiresAt') || 0) > now)
      .map((d) => ({ id: d.id, people: (d.get('openTo') || []).map(rename), expiresAt: d.get('expiresAt') }));
    const day = teamDay(now);
    return { singles, many, open: [...singles, ...many], day, sentToday: lock.day === day ? lock.n || 0 : 0 };
  }

  async function create(who, body) {
    if (body.group != null) return createGroup(who, body);
    const { uid, me, data } = who;
    const conv = body.conv;
    const place = messagesOf(conv);
    if (!place) return note('Not here.', 'Ask in a channel or a DM.');
    const off = await switchedOff(me, { conv, creating: true });
    if (off) return off;
    const rename = data.rename;
    const to = rename(String(body.to || '').slice(0, 80));
    const roster = await rosterOf(rename);
    // The checks that don't need the transaction: who, how much.
    const pre = ask.startAsk({ me, to, amount: body.amount, reason: body.reason, roster, active: true, now: Date.now() });
    if (pre.error) return note(pre.error, pre.body);
    if (!(await isActive(to, rename))) return note(`${first(to)} isn’t on the team.`);
    // Who can see the card: a DM's people, or a private channel's members.
    let dmRef = null;
    if (place.dm) {
      dmRef = db.doc(`dms/${place.dm}`);
      const people = ((await dmRef.get()).get('people') || []).map(rename);
      if (!people.includes(me)) return note('Not here.');
      if (!people.includes(to)) return note(`${first(to)} isn’t in this conversation.`, 'Ask in a channel they can see, or in a DM with them.');
    } else {
      const priv = await db.doc(`privateChannels/${place.channel}`).get();
      if (priv.exists) {
        const members = (priv.get('members') || []).map(rename);
        if (!members.includes(me)) return note('Not here.');
        if (!members.includes(to)) return note(`${first(to)} can’t see this channel.`, 'Ask in a channel they can see, or in a DM.');
      }
    }
    const msgRef = db.collection(place.col).doc();
    const id = msgRef.id;
    const replyTo = body.replyTo && typeof body.replyTo === 'object' ? body.replyTo : null;
    const res = await db.runTransaction(async (tx) => {
      const now = Date.now();
      const { singles, many, open, day, sentToday } = await openOf(tx, me, rename, now);
      const r = ask.startAsk({ me, to, amount: body.amount, reason: body.reason, roster, active: true, open, sentToday, now });
      if (r.error) return note(r.error, r.body);
      const pub = r.pub;
      tx.set(reqRef(id), { ...pub, id, conv, by: uid });
      tx.set(lockRef(me), { name: me, ids: [...singles.map((x) => x.id), id], groups: many.map((x) => x.id), day, n: sentToday + 1, at: now });
      const text = `/request @${to} ${pub.amount}${pub.reason ? ` ${pub.reason}` : ''}`.slice(0, 300);
      tx.set(msgRef, {
        text,
        by: me,
        byUid: uid,
        at: now,
        cmd: { name: 'request', kind: 'coins', ask: { from: me, to, amount: pub.amount, reason: pub.reason, at: now, expiresAt: pub.expiresAt }, status: 'open', line: ask.askLine(pub) },
        mentions: [],
        taskIds: [],
        replyTo: replyTo ? { id: String(replyTo.id || '').slice(0, 60), by: String(replyTo.by || '').slice(0, 80), text: String(replyTo.text || '').slice(0, 120), what: String(replyTo.what || '').slice(0, 40) } : null,
        reactions: {},
        photo: null,
      });
      if (dmRef) tx.update(dmRef, { lastAt: now, lastBy: me, lastText: `${first(me)} ${ask.askLine(pub)}`.slice(0, 120) });
      return { ok: true, id, pub };
    });
    // The person asked hears about it (a DM already tells the people in it).
    if (res.ok && !place.dm)
      await notify([
        {
          to,
          type: 'coinRequest',
          title: `${first(me)} asks you for ${ask.coinText(res.pub.amount)}`,
          body: res.pub.reason || 'Tap to pay or decline.',
          open: `chat:${conv}`,
          by: me,
        },
      ]).catch((e) => logger.warn('coin request notify', e.message));
    return res.ok ? { ok: true, id } : res;
  }

  // A request to a group: one request per person, under one card.
  async function createGroup({ uid, me, data, admin }, body) {
    const conv = body.conv;
    const place = messagesOf(conv);
    if (!place) return note('Not here.', 'Ask in a channel.');
    if (place.dm) return note('Groups work in channels.', 'In a DM, ask people one by one.');
    const off = await switchedOff(me, { conv, creating: true });
    if (off) return off;
    const key = String(body.key || '');
    if (!/^[\w-]{8,40}$/.test(key)) throw new HttpsError('invalid-argument', 'Missing key.');
    const rename = data.rename;
    // Which groups and people were typed. Who's in them is the server's call.
    const g = body.group && typeof body.group === 'object' ? body.group : {};
    const groups = (Array.isArray(g.groups) ? g.groups : []).map(String);
    if (groups.some((x) => !SUBTEAMS.includes(x)) || groups.length > SUBTEAMS.length)
      return note('Which group?', `Groups: @everyone, ${SUBTEAMS.map((x) => `@${x}`).join(', ')}.`);
    const everyone = g.everyone === true;
    if (!groups.length && !everyone) return note('Which group?', 'Try: /request @Programming 5 for pizza');
    const team = await groupTeam(db, rename);
    const named = (Array.isArray(g.people) ? g.people : []).slice(0, GROUP_MAX).map((n) => rename(cleanName(String(n || ''))));
    for (const n of named) if (n !== me && !team.roster.includes(n)) return note(`Who’s ${n || 'that'}?`, 'They aren’t on the team. Nobody was asked.');
    const label = groupLabel({ groups, everyone });
    let people = resolveTargets({ groups, everyone, people: named }, { ...team, me });
    if (!people.length) return note(`Nobody in ${label} to ask.`, `${label} has nobody in it besides you.`);
    if (people.length > GROUP_MAX) return note(`That’s ${people.length} people.`, `Up to ${GROUP_MAX} at a time.`);
    // A private channel: only its members can see the card, so only they're asked.
    let unseen = [];
    const priv = await db.doc(`privateChannels/${place.channel}`).get();
    if (priv.exists) {
      const members = (priv.get('members') || []).map(rename);
      if (!members.includes(me)) return note('Not here.');
      unseen = people.filter((n) => !members.includes(n));
      people = people.filter((n) => members.includes(n));
      if (!people.length) return note(`Nobody in ${label} can see this channel.`, 'Ask in a channel they can see.');
    }
    const id = `g-${key}-${nameKey(me).slice(0, 40)}`;
    const msgRef = db.doc(`${place.col}/${id}`);
    const replyTo = body.replyTo && typeof body.replyTo === 'object' ? body.replyTo : null;
    // Quiet: someone other than team management used @everyone.
    const quiet = everyone && !admin;
    const res = await db.runTransaction(async (tx) => {
      const now = Date.now();
      // Sent before (a double tap, a retry): it's done, nothing more.
      const was = await tx.get(groupRef(id));
      if (was.exists) {
        if (rename(was.get('from') || '') !== me) return note('That didn’t go through.', 'Try again.');
        return { ok: true, repeat: true, asked: was.get('people') || [], skipped: was.get('skipped') || [], unseen: was.get('unseen') || [], amount: was.get('amount') };
      }
      const { singles, many, open, day, sentToday } = await openOf(tx, me, rename, now);
      const { ask: asking, skipped } = ask.skipAsked(people, open, now);
      if (!asking.length)
        return note(
          `You already asked ${skipped.length === 1 ? skipped[0].split(' ')[0] : `everyone in ${label}`}.`,
          'Wait for their answers, or cancel those first.',
        );
      const r = ask.startGroupAsk({ me, people: asking, label, amount: body.amount, reason: body.reason, open, sentToday, now });
      if (r.error) return note(r.error, r.body);
      const pub = r.pub;
      const rows = asking.map((to, i) => ({ id: `${id}-${i}`, to, row: `r${i}` }));
      tx.set(groupRef(id), {
        id,
        from: me,
        by: uid,
        conv,
        amount: pub.amount,
        reason: pub.reason,
        label,
        groups,
        everyone,
        quiet,
        at: now,
        expiresAt: pub.expiresAt,
        people: asking,
        skipped,
        unseen,
        rows,
        openTo: asking,
      });
      for (const x of rows)
        tx.set(reqRef(x.id), {
          from: me,
          to: x.to,
          amount: pub.amount,
          reason: pub.reason,
          at: now,
          expiresAt: pub.expiresAt,
          status: 'open',
          id: x.id,
          conv,
          by: uid,
          group: id,
          row: x.row,
          everyone,
        });
      tx.set(lockRef(me), { name: me, ids: singles.map((x) => x.id), groups: [...many.map((x) => x.id), id], day, n: sentToday + 1, at: now });
      tx.set(msgRef, {
        text: `/request ${label} ${pub.amount}${pub.reason ? ` ${pub.reason}` : ''}`.slice(0, 300),
        by: me,
        byUid: uid,
        at: now,
        cmd: {
          name: 'request',
          kind: 'coins',
          group: { label, count: rows.length },
          ask: { from: me, amount: pub.amount, reason: pub.reason, at: now, expiresAt: pub.expiresAt, label },
          rows: Object.fromEntries(rows.map((x) => [x.row, { to: x.to, status: 'open' }])),
          status: 'open',
          line: ask.groupAskLine(pub),
        },
        mentions: [],
        taskIds: [],
        replyTo: replyTo
          ? {
              id: String(replyTo.id || '').slice(0, 60),
              by: String(replyTo.by || '').slice(0, 80),
              text: String(replyTo.text || '').slice(0, 120),
              what: String(replyTo.what || '').slice(0, 40),
            }
          : null,
        reactions: {},
        photo: null,
      });
      return { ok: true, asked: asking, skipped, unseen, amount: pub.amount, reason: pub.reason };
    });
    if (!res.ok) return res;
    // Each person asked hears about it (quietly for a non-manager's @everyone).
    if (!res.repeat)
      await notify(
        res.asked.map((to) => ({
          to,
          type: 'coinRequest',
          title: `${first(me)} asks you for ${ask.coinText(res.amount)}`,
          body: `${label}${res.reason ? `: ${res.reason}` : '. Tap to pay or decline.'}`,
          open: `chat:${conv}`,
          by: me,
          ...(quiet && { quiet: true }),
        })),
      ).catch((e) => logger.warn('coin request notify', e.message));
    return {
      ok: true,
      id,
      group: label,
      asked: res.asked.length,
      skipped: res.skipped,
      unseen: res.unseen,
      quiet,
      ...(res.repeat && { repeat: true }),
      reply: ask.groupReply(res),
    };
  }

  // pay, decline, cancel or peek on request `id`. me: '' for the scheduled
  // sweep (it can only ever expire one).
  async function move({ me, data }, id, mv, { close = true } = {}) {
    const rename = data.rename;
    const now = Date.now();
    const roster = mv === 'pay' ? await rosterOf(rename) : [];
    // A group's row: its card is the group's message. It's read here, before
    // the transaction (only to know it's still there); inside, each row
    // writes only its own fields without reading the card, so members
    // answering at the same moment don't hold each other up.
    const peek = await reqRef(id).get();
    const gid = peek.get('group') || '';
    const gPlace = gid ? messagesOf(peek.get('conv')) : null;
    const gCard = gPlace ? await db.doc(`${gPlace.col}/${gid}`).get() : null;
    const gCardOk = !!gCard?.exists && gCard.get('cmd.name') === 'request' && !!gCard.get(`cmd.rows.${peek.get('row')}`);
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef(id));
      if (!snap.exists) return note('That request is gone.');
      const saved = snap.data();
      const pub = { ...saved, from: rename(saved.from || ''), to: rename(saved.to || '') };
      const place = messagesOf(saved.conv);
      const group = saved.group || '';
      const msgRef = place && !group ? db.doc(`${place.col}/${id}`) : null;
      const [msg, lock] = group ? [null, null] : await Promise.all([msgRef ? tx.get(msgRef) : null, tx.get(lockRef(pub.from))]);
      // Only the person asked pays, and only from their own bank (read in the
      // transaction, like a gift, so it takes turns with their bets and gifts).
      let bank = null;
      let balance = 0;
      if (mv === 'pay' && me && me === pub.to && pub.status === 'open' && now < pub.expiresAt) {
        bank = (await tx.get(bankRef(me))).data() || {};
        balance = (await freshCoins(me, bank, data)).balance;
      }
      const r = ask.askMove({ pub, me, move: mv, balance, roster, now });
      if (!r.write) return r.error ? note(r.error, r.body) : { ok: true, status: pub.status, ...(r.already && { already: r.already }) };
      const { status, decidedAt, paidAt } = r.pub;
      if (r.entry) {
        // The fixed id: a second gift for the same request can't be created.
        tx.create(db.doc(`coins/req-${id}`), { ...r.entry, request: id });
        tx.set(bankRef(me), { ...bank, name: me, touched: now });
      }
      tx.update(reqRef(id), { status, decidedAt, ...(paidAt && { paidAt }), ...(me && { decidedBy: me }), ...(r.entry && { entry: `req-${id}` }) });
      if (group) {
        // This person answered: off the group's waiting list, and their row on the card.
        tx.update(groupRef(group), { openTo: FieldValue.arrayRemove(saved.to) });
        if (gCardOk && gid === group && place) {
          const at = `cmd.rows.${saved.row}`;
          tx.update(db.doc(`${place.col}/${group}`), { [`${at}.status`]: status, [`${at}.at`]: decidedAt, ...(paidAt && { [`${at}.paidAt`]: paidAt }) });
        }
        return { ok: true, status, pub, group, ...(r.error && { note: { title: r.error, body: '' } }) };
      }
      if (msg?.exists && msg.get('cmd')?.name === 'request')
        tx.update(msgRef, { 'cmd.status': status, 'cmd.decidedAt': decidedAt, ...(paidAt && { 'cmd.paidAt': paidAt }) });
      const ids = (lock.get('ids') || []).filter((x) => x !== id);
      if (lock.exists) tx.update(lockRef(pub.from), { ids });
      return { ok: true, status, pub, ...(r.error && { note: { title: r.error, body: '' } }) };
    });
    if (res.ok && res.group && close) await closeCard(res.group, res.pub.conv);
    if (res.ok && res.pub) {
      const p = res.pub;
      // An @everyone request's answers reach the asker's inbox, without a push each.
      const quiet = !!p.group && p.everyone === true;
      const tell = (to, title, body) =>
        notify([{ to, type: 'coinRequest', title, body, open: `chat:${p.conv}`, by: me || p.to, ...(quiet && { quiet: true }) }]).catch((e) =>
          logger.warn('coin request notify', e.message),
        );
      if (res.status === 'paid') await tell(p.from, `${first(p.to)} paid your request: ${ask.coinText(p.amount)}`, p.reason || 'The coins are in your balance.');
      if (res.status === 'declined') await tell(p.from, `${first(p.to)} declined your request for ${ask.coinText(p.amount)}`, p.reason || '');
    }
    const { pub: _p, group: _g, ...out } = res;
    return out;
  }

  // When nobody in a group is left to answer, its card says it's closed.
  async function closeCard(gid, conv) {
    try {
      const g = await groupRef(gid).get();
      if (!g.exists || (g.get('openTo') || []).length) return;
      const place = messagesOf(conv);
      const msg = place && (await db.doc(`${place.col}/${gid}`).get());
      if (msg?.exists && msg.get('cmd.name') === 'request' && msg.get('cmd.status') === 'open')
        await msg.ref.update({ 'cmd.status': 'closed', 'cmd.decidedAt': Date.now() });
    } catch (e) {
      logger.warn('close group card', gid, e.message);
    }
  }

  // A tap on a group card (id: the group's). Pay and Decline: the caller's
  // own row, found by their name here. Cancel (the asker only) and a peek
  // after its time is up: every row still open, each on its own.
  async function groupMove(who, gid, mv) {
    const { me, data } = who;
    const rename = data.rename;
    const g = await groupRef(gid).get();
    if (!g.exists) return note('That request is gone.');
    const from = rename(g.get('from') || '');
    const rows = (g.get('rows') || []).filter((x) => x && validId(x.id));
    if (mv === 'pay' || mv === 'decline') {
      const mine = rows.find((x) => rename(x.to || '') === me);
      if (!mine)
        return me === from ? note('Waiting for their answers.') : note('This request isn’t for you.', `${first(from)} asked ${g.get('label') || 'a group'}.`);
      return move(who, mine.id, mv);
    }
    if (mv === 'cancel' && me !== from) return note(`Only ${first(from)} can cancel this.`);
    if (mv === 'peek' && Date.now() < (g.get('expiresAt') || 0)) return { ok: true, status: 'open' };
    const open = new Set((g.get('openTo') || []).map(String));
    const todo = rows.filter((x) => open.has(x.to));
    let closed = 0;
    for (let i = 0; i < todo.length; i += 10) {
      const outs = await Promise.all(
        todo.slice(i, i + 10).map((x) => move(who, x.id, mv, { close: false }).catch((e) => (logger.warn('group move', x.id, e.message), null))),
      );
      closed += outs.filter((o) => o?.ok && !o.already && (o.status === 'cancelled' || o.status === 'expired')).length;
    }
    await closeCard(gid, g.get('conv'));
    return { ok: true, status: mv === 'cancel' ? 'cancelled' : 'expired', closed };
  }

  const coinRequest = onCall(OPEN, async (req) => {
    const who = await caller(req);
    const body = req.data || {};
    const action = String(body.action || '');
    if (action === 'create') return create(who, body);
    if (!ask.MOVES.includes(action)) throw new HttpsError('invalid-argument', 'Unknown action.');
    if (!validId(body.id)) return note('Which request?');
    // Paying moves coins: the switches /give has, and its overdue-loan lock
    // (sending coins is off until the loan is paid). Declining, cancelling
    // and expiring move nothing, so they always work.
    if (action === 'pay') {
      const off = await switchedOff(who.me);
      if (off) return off;
      const lock = await loanLock(who.me);
      if (lock) return note(lock.title, lock.body);
    }
    const out = isGroupId(body.id) ? await groupMove(who, body.id, action) : await move(who, body.id, action);
    if (action !== 'pay' || !out.ok) return out;
    // The server's balance after paying, for the app to check its own number.
    try {
      const bank = (await bankRef(who.me).get()).data() || {};
      return { ...out, balance: (await freshCoins(who.me, bank, who.data)).balance };
    } catch {
      return out;
    }
  });

  // Every hour: requests nobody answered in 24 hours close (their cards say so).
  const expireCoinRequests = onSchedule({ schedule: 'every 60 minutes', timeZone }, async () => {
    const now = Date.now();
    const open = await db.collection('coinRequests').where('status', '==', 'open').get();
    const due = open.docs.filter((d) => (d.get('expiresAt') || 0) <= now);
    if (!due.length) return;
    const data = await coinData();
    for (const d of due) await move({ me: '', data }, d.id, 'peek').catch((e) => logger.warn('expire coin request', d.id, e.message));
  });

  return { coinRequest, expireCoinRequests };
}
