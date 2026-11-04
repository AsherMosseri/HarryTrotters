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
// Shapes and checks: functions/shared/coinRequests.js.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { memberOk, nameKey, onTeam } from './shared/team.js';
import { blocked, isOff } from './shared/commandRules.js';
import * as ask from './shared/coinRequests.js';
import { teamDay } from './shared/coins.js';

const OPEN = { maxInstances: 5, invoker: 'public' };
const first = (n) => (n || 'Someone').split(' ')[0];
const note = (title, body = '') => ({ note: { title, body } });
const validId = (id) => typeof id === 'string' && /^[\w-]{1,60}$/.test(id);

// Where a conversation's messages are: a channel (not #announcements) or a DM.
export function messagesOf(conv) {
  if (typeof conv !== 'string') return null;
  const dm = /^dm:([\w-]{1,120})$/.exec(conv);
  if (dm) return { dm: dm[1], col: `dms/${dm[1]}/messages` };
  if (/^[\w-]{1,40}$/.test(conv) && conv !== 'announcements') return { channel: conv, col: `channels/${conv}/messages` };
  return null;
}

export function coinRequestFunctions({ db, coinData, freshCoins, bankRef, notify, owner, timeZone }) {
  const reqRef = (id) => db.doc(`coinRequests/${id}`);
  const lockRef = (name) => db.doc(`coinRequestsOpen/${nameKey(name)}`);

  async function caller(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    return { uid, me: data.rename(member.get('name')), data };
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

  async function create({ uid, me, data }, body) {
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
      const lock = (await tx.get(lockRef(me))).data() || {};
      const ids = (Array.isArray(lock.ids) ? lock.ids : []).filter(validId).slice(-20);
      const olds = ids.length ? await Promise.all(ids.map((x) => tx.get(reqRef(x)))) : [];
      const open = olds
        .filter((d) => d.exists && d.get('status') === 'open' && (d.get('expiresAt') || 0) > now)
        .map((d) => ({ id: d.id, to: rename(d.get('to') || ''), expiresAt: d.get('expiresAt') }));
      const day = teamDay(now);
      const sentToday = lock.day === day ? lock.n || 0 : 0;
      const r = ask.startAsk({ me, to, amount: body.amount, reason: body.reason, roster, active: true, open, sentToday, now });
      if (r.error) return note(r.error, r.body);
      const pub = r.pub;
      tx.set(reqRef(id), { ...pub, id, conv, by: uid });
      tx.set(lockRef(me), { name: me, ids: [...open.map((x) => x.id), id], day, n: sentToday + 1, at: now });
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

  // pay, decline, cancel or peek on request `id`. me: '' for the scheduled
  // sweep (it can only ever expire one).
  async function move({ me, data }, id, mv) {
    const rename = data.rename;
    const now = Date.now();
    const roster = mv === 'pay' ? await rosterOf(rename) : [];
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef(id));
      if (!snap.exists) return note('That request is gone.');
      const saved = snap.data();
      const pub = { ...saved, from: rename(saved.from || ''), to: rename(saved.to || '') };
      const place = messagesOf(saved.conv);
      const msgRef = place ? db.doc(`${place.col}/${id}`) : null;
      const [msg, lock] = await Promise.all([msgRef ? tx.get(msgRef) : null, tx.get(lockRef(pub.from))]);
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
      if (msg?.exists && msg.get('cmd')?.name === 'request')
        tx.update(msgRef, { 'cmd.status': status, 'cmd.decidedAt': decidedAt, ...(paidAt && { 'cmd.paidAt': paidAt }) });
      const ids = (lock.get('ids') || []).filter((x) => x !== id);
      if (lock.exists) tx.update(lockRef(pub.from), { ids });
      return { ok: true, status, pub, ...(r.error && { note: { title: r.error, body: '' } }) };
    });
    if (res.ok && res.pub) {
      const p = res.pub;
      const tell = (to, title, body) =>
        notify([{ to, type: 'coinRequest', title, body, open: `chat:${p.conv}`, by: me || p.to }]).catch((e) => logger.warn('coin request notify', e.message));
      if (res.status === 'paid') await tell(p.from, `${first(p.to)} paid your request: ${ask.coinText(p.amount)}`, p.reason || 'The coins are in your balance.');
      if (res.status === 'declined') await tell(p.from, `${first(p.to)} declined your request for ${ask.coinText(p.amount)}`, p.reason || '');
    }
    const { pub: _p, ...out } = res;
    return out;
  }

  const coinRequest = onCall(OPEN, async (req) => {
    const who = await caller(req);
    const body = req.data || {};
    const action = String(body.action || '');
    if (action === 'create') return create(who, body);
    if (!ask.MOVES.includes(action)) throw new HttpsError('invalid-argument', 'Unknown action.');
    if (!validId(body.id)) return note('Which request?');
    // Paying moves coins: the switches /give has. Declining, cancelling and
    // expiring move nothing, so they always work.
    if (action === 'pay') {
      const off = await switchedOff(who.me);
      if (off) return off;
    }
    const out = await move(who, body.id, action);
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
