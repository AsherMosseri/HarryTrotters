// Earnings that grow with your balance, and hidden coins (3.2). The share
// of the balance each earning pays is in shared/coins.js (EARN_SCALE).
//
// Tasks and lab time are worked out from the tasks and shifts themselves, so
// their top-up for a big balance is a 'scale' entry in the coins ledger, one
// per task and person (scale-task-…) and one per lab day and person
// (scale-hours-…), written by the server when a task is done or a shift ends.
// The wallet counts a top-up only while its task or day still pays (move the
// task out of Done and its top-up goes too; back in Done, the same one comes
// back: a task's top-up is written once, ever). A lab day's top-up can grow
// as more of the day's shifts end, never past the day's 10-hour limit.
//
// Hidden coins: hiddenCoin({ action: 'spawn' }) maybe hands out a token (up
// to FIND.perDay a team day, at least FIND.gap apart, each good for FIND.ttl);
// hiddenCoin({ action: 'claim', token }) pays it once, through awardCoins
// ('find'), the amount rolled by the server when the token was made. The app
// only shows the coin; it can't make one up or claim one twice.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { randomBytes } from 'node:crypto';
import { earnBalance, scaleId, scaledPay, teamDay, nextMidnight, teamMidnight } from './shared/coins.js';
import { memberOk, nameKey } from './shared/team.js';
import { secureRandom } from './shared/rng.js';
import { prepareAward } from './award.js';
import { FIND } from './shared/hiddenCoins.js';

export { FIND };

const OPEN = { maxInstances: 5, invoker: 'public' };
// The time everything here goes by (tests move it).
export const earnClock = { now: () => Date.now() };

export function earnFunctions({ db, coinData, freshCoins, bankRef, renamer, owner, clock = earnClock }) {
  const note = (title, body = '') => ({ note: { title, body } });
  async function switchedOff(name, which = []) {
    if (name === owner) return false;
    const off = ((await db.doc('settings/controls').get()).data() || {}).off || [];
    return ['coins', ...which].some((x) => off.includes(x));
  }
  async function walletOf(name, data) {
    return freshCoins(name, (await bankRef(name).get()).data() || {}, data);
  }
  // For award.js: the balance earnings go by, and the balance now.
  async function balanceFor(name, now = clock.now()) {
    const data = await coinData();
    const w = await walletOf(data.rename(name), data);
    return { low: earnBalance(w.history, now), balance: w.balance };
  }

  // One task's top-up for one person: written once, if the task pays them
  // now and their balance makes it worth more than the normal pay.
  async function boostTask(taskId, name, now = clock.now()) {
    const data = await coinData();
    const w = await walletOf(name, data);
    const item = w.history.find((x) => x.kind === 'task' && x.id === taskId);
    if (!item || item.boost || !(item.amount > 0)) return 0;
    const extra = scaledPay('task', item.amount, earnBalance(w.history, now)) - item.amount;
    if (!(extra > 0)) return 0;
    const ref = db.doc(`coins/${scaleId('task', taskId, name)}`);
    return db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return 0;
      tx.set(ref, { type: 'scale', person: name, ref: `task:${taskId}`, source: 'task', amount: extra, base: item.amount, label: item.label, at: now });
      return extra;
    });
  }
  // One lab day's top-up for one person: the day's pay so far, scaled; it only
  // ever goes up (the same day's later shifts), and the same reads give the
  // same answer, so running it twice changes nothing.
  async function boostHours(name, day, now = clock.now()) {
    const data = await coinData();
    const w = await walletOf(name, data);
    const item = w.history.find((x) => x.kind === 'hours' && x.day === day && !x.note);
    if (!item) return 0;
    const base = item.base ?? item.amount;
    if (!(base > 0)) return 0;
    // The balance without this day's own pay (so the top-up doesn't feed itself).
    const low = earnBalance(w.history.filter((x) => x !== item), now);
    const extra = scaledPay('hours', base, low) - base;
    if (!(extra > 0)) return 0;
    const ref = db.doc(`coins/${scaleId('hours', day, name)}`);
    return db.runTransaction(async (tx) => {
      const had = await tx.get(ref);
      if (had.exists && (had.get('amount') || 0) >= extra) return 0;
      tx.set(ref, { type: 'scale', person: name, ref: `hours:${day}`, source: 'hours', amount: extra, base, label: item.label, at: had.exists ? had.get('at') : now, updatedAt: now });
      return extra;
    });
  }

  const onTaskEarn = onDocumentWritten('tasks/{taskId}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after || after.status !== 'done' || after.deletedAt) return;
    const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v || 0);
    if (before?.status === 'done' && ms(before.completedAt) === ms(after.completedAt)) return;
    const rename = await renamer();
    const people = [...new Set((after.assignees || []).map(rename))].filter((n) => n && n !== rename(after.createdBy || ''));
    for (const name of people) {
      if (await switchedOff(name)) continue;
      await boostTask(event.params.taskId, name).catch((e) => logger.warn('boostTask', event.params.taskId, e.message));
    }
  });

  const onShiftEarn = onDocumentWritten('shifts/{id}', async (event) => {
    const after = event.data?.after?.data();
    if (!after || after.end == null || !after.person || !after.start) return;
    const rename = await renamer();
    const name = rename(after.person);
    if (await switchedOff(name)) return;
    // Every team day the shift touched (a shift past midnight counts on both).
    const days = [];
    for (let day = teamDay(after.start), i = 0; i < 3 && teamMidnight(day) <= after.end; i++) {
      days.push(day);
      day = teamDay(nextMidnight(day));
    }
    for (const day of days) await boostHours(name, day).catch((e) => logger.warn('boostHours', day, e.message));
  });

  // ---------- hidden coins ----------
  const dayRef = (name, day) => db.doc(`coinFinds/${nameKey(name)}-${day}`);
  const tokenRef = (token) => db.doc(`coinTokens/${token}`);
  async function spawn(me, now) {
    const day = teamDay(now);
    return db.runTransaction(async (tx) => {
      const d = (await tx.get(dayRef(me, day))).data() || {};
      const issued = d.issued || 0;
      if (issued >= FIND.perDay) return { ok: true, none: true, left: 0 };
      if (now - (d.lastAt || 0) < FIND.gap) return { ok: true, none: true, left: FIND.perDay - issued };
      // Not every time it could: a coin is a surprise. A miss still waits
      // the gap, so asking over and over doesn't help.
      if (secureRandom() >= FIND.chance) {
        tx.set(dayRef(me, day), { person: me, day, issued, lastAt: now, tries: (d.tries || 0) + 1 });
        return { ok: true, none: true, left: FIND.perDay - issued };
      }
      const token = randomBytes(16).toString('hex');
      const base = FIND.min + Math.floor(secureRandom() * (FIND.max - FIND.min + 1));
      tx.set(tokenRef(token), { person: me, day, at: now, exp: now + FIND.ttl, base, claimed: false });
      tx.set(dayRef(me, day), { person: me, day, issued: issued + 1, lastAt: now, tries: (d.tries || 0) + 1 });
      return { ok: true, token, exp: now + FIND.ttl, left: FIND.perDay - issued - 1 };
    });
  }
  async function claim(me, token, now) {
    if (typeof token !== 'string' || !/^[0-9a-f]{32}$/.test(token)) return note('That coin isn’t real.');
    const res = await db.runTransaction(async (tx) => {
      const t = await tx.get(tokenRef(token));
      if (!t.exists || t.get('person') !== me) return note('That coin isn’t yours.');
      if (t.get('claimed')) return note('Already picked up.');
      if (now > t.get('exp')) return note('Too late: it rolled away.');
      const a = await prepareAward(
        tx,
        db,
        { person: me, amount: t.get('base'), source: 'find', label: 'Found a hidden coin', key: `find-${token}` },
        now,
      );
      tx.update(t.ref, { claimed: true, claimedAt: now, paid: a.pay });
      a.write(tx);
      return { ok: true, paid: a.pay };
    });
    return res;
  }
  const hiddenCoin = onCall(OPEN, async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const rename = await renamer();
    const me = rename(member.get('name') || '');
    const now = clock.now();
    if (await switchedOff(me, ['hiddenCoins'])) return { ok: true, none: true, off: true };
    const { action, token } = req.data || {};
    if (action === 'spawn') return spawn(me, now);
    if (action === 'claim') return claim(me, token, now);
    return note('Unknown.');
  });

  return { onTaskEarn, onShiftEarn, hiddenCoin, boostTask, boostHours, balanceFor };
}
