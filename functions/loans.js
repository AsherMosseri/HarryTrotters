// Loans on the server (3.1). Borrow Jackson coins from the bank (the owner,
// Asher, says yes; the coins are made up and nobody's balance pays them) or
// from a teammate (their own coins). The rules and math are in
// shared/loans.js; demo mode runs the same file.
//
// Callables:
//   loanRequest({ lender, amount, style, rate, term, note })   lender: 'bank' or a name
//   loanRespond({ id, action, terms, note })   accept | deny | counter | cancel
//   loanRepay({ id, amount })                  pay some or all back
//   loanManage({ action, id, weeks, settings, note })
//                                              forgive | extend (the lender; the owner
//                                              for bank loans) | settings (the owner)
// Scheduled: loanTick (every 15 minutes) takes what's left on the due date,
// reminds borrowers 2 days before, ends overdue loans once the borrower is
// back above zero, and drops requests nobody answered in a week.
// Trigger: loanRenames keeps the names on loans current after a rename.
// lockOf(name): the overdue lock, for play (bets, gifts) and the market.
//
// Coin safety: the app never sends a balance and never moves coins. Every
// move is one transaction that reads the loan and checks its status first,
// writes a ledger entry with an id made from the loan and its move count (so
// it can only be written once), and touches the bank doc of whoever pays (the
// same way gifts and the market do), so it takes turns with their bets and
// buys and sees their real balance. The rules let nobody write loans.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as L from './shared/loans.js';
import { cleanName, memberOk } from './shared/team.js';
import { ceilingNote, overCeiling, teamDay } from './shared/coins.js';
import { coinsText } from './shared/coinText.js';

const OPEN_FN = { maxInstances: 5, invoker: 'public' };
// The time everything here goes by (tests move it to a due date).
export const loanClock = { now: () => Date.now() };

export function loanFunctions({ db, coinData, freshCoins, bankRef, notify, owner, timeZone }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const validId = (id) => typeof id === 'string' && /^[\w-]{1,60}$/.test(id);
  const loanRef = (id) => db.doc(`loans/${id}`);
  const settingsRef = db.doc('settings/loans');
  const coinsRef = (id) => db.collection('coins').doc(id);
  const tell = (list) => notify(list.filter((n) => n.to)).catch((e) => logger.warn('loan notify', e.message));

  async function caller(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    const me = data.rename(member.get('name'));
    const boss = data.rename(owner);
    return { me, data, boss, isOwner: member.get('admin') === true && me === boss };
  }
  const cfgNow = async (tx) => L.loanSettings((tx ? await tx.get(settingsRef) : await settingsRef.get()).data());
  // Coins switched off in Controls (everyone but the owner).
  async function coinsOff(name, boss) {
    if (name === boss) return false;
    const controls = (await db.doc('settings/controls').get()).data() || {};
    return (controls.off || []).includes('coins');
  }
  const asList = (snaps) => {
    const seen = new Map();
    for (const s of snaps) for (const d of s.docs) seen.set(d.id, { id: d.id, ...d.data() });
    return [...seen.values()];
  };
  // Every loan a person is in, either side, under any name they've had.
  async function loansOf(name, data, tx = null) {
    const aliases = data.rename.aliases(name).slice(0, 30);
    const q = (f) => db.collection('loans').where(f, 'in', aliases);
    return asList(await Promise.all(['borrower', 'lender'].map((f) => (tx ? tx.get(q(f)) : q(f).get()))));
  }
  const balanceOf = async (name, data, bankData) =>
    (await freshCoins(name, bankData ?? ((await bankRef(name).get()).data() || {}), data)).balance;
  // Their lock, from their loans (the balance only matters with an overdue one).
  async function lockFrom(name, list, data, bankData, now) {
    const mine = list.filter((l) => data.rename(l.borrower) === name && L.LIVE.includes(l.status));
    if (!mine.length) return null;
    const balance = mine.some((l) => l.status === 'overdue') ? await balanceOf(name, data, bankData) : 0;
    return L.lockOf(mine, balance, now);
  }
  // For play and the market: null, or { owe, title, body }.
  async function lockOf(name) {
    const data = await coinData();
    const me = data.rename(name);
    return lockFrom(me, await loansOf(me, data), data, undefined, loanClock.now());
  }
  const touch = (tx, name, bankSnap, now) => tx.set(bankRef(name), { ...(bankSnap.data() || {}), name, touched: now });
  const withMove = (loan, patch) => ({ ...patch, moves: (loan.moves || 0) + 1 });
  // Who hears about a loan: the borrower, or the lender (the owner for the bank).
  const lenderOf = (loan, boss) => (loan.bank ? boss : loan.lender);

  const loanRequest = onCall(OPEN_FN, async (req) => {
    const { me, data, boss } = await caller(req);
    const body = req.data || {};
    const bank = body.lender === 'bank';
    const lender = bank ? '' : data.rename(cleanName(String(body.lender || '')));
    const cfg = await cfgNow();
    const t = L.cleanTerms(body, { bank, cfg });
    if (t.error) return note(t.error);
    const roster = bank ? [] : (await db.collection('people').get()).docs.map((d) => data.rename(d.get('name') || '')).filter(Boolean);
    const off = await coinsOff(me, boss);
    const now = loanClock.now();
    const res = await db.runTransaction(async (tx) => {
      // Reads first. The bank doc makes two requests at once take turns, so the
      // limits hold.
      const myBank = await tx.get(bankRef(me));
      const mine = await loansOf(me, data, tx);
      const theirs = bank || !lender ? [] : await loansOf(lender, data, tx);
      const lock = await lockFrom(me, mine, data, myBank.data() || {}, now);
      const problem = L.requestProblem({
        me,
        lender,
        bank,
        owner: boss,
        roster,
        cfg,
        mine,
        theirs,
        lock,
        coinsOff: off,
        today: teamDay(now),
        rename: data.rename,
      });
      if (problem) return note(problem);
      const ref = db.collection('loans').doc();
      tx.set(ref, L.newLoan({ me, lender, bank, terms: t.terms, note: body.note, now, today: teamDay(now) }));
      touch(tx, me, myBank, now);
      return { ok: true, id: ref.id };
    });
    if (!res.ok) return res;
    await tell([
      {
        to: bank ? boss : lender,
        type: 'loan',
        title: bank ? `${first(me)} asked the bank for ${coinsText(t.terms.amount)} coins` : `${first(me)} asked you for a loan`,
        body: L.termsText(t.terms),
        open: `loans:${res.id}`,
        by: me,
      },
    ]);
    return res;
  });

  const loanRespond = onCall(OPEN_FN, async (req) => {
    const { me, data, boss } = await caller(req);
    const { id, action, terms, note: text } = req.data || {};
    if (!validId(id)) return note('Which loan?');
    if (!['accept', 'deny', 'counter', 'cancel'].includes(action)) return note('Accept, say no, or counter?');
    const cfg = await cfgNow();
    const now = loanClock.now();
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(loanRef(id));
      const loan = snap.exists ? { id, ...snap.data() } : null;
      const role = L.roleOf(loan, me, { owner: boss, rename: data.rename });
      if (!role) return note(loan ? 'That isn’t your loan.' : 'That loan is gone.');
      const r = L.respond(loan, { role, action, input: terms, note: text, cfg, now });
      if (r.error) return note(r.error);
      let lenderBalance = null;
      if (r.move) {
        const borrower = data.rename(loan.borrower);
        const lender = loan.bank ? '' : data.rename(loan.lender);
        // The borrower can't have gone overdue somewhere since asking.
        const bList = await loansOf(borrower, data, tx);
        const lenderBank = lender ? await tx.get(bankRef(lender)) : null;
        const lList = lender ? await loansOf(lender, data, tx) : [];
        if (await lockFrom(borrower, bList, data, undefined, now))
          return note(`${role === 'borrower' ? 'You have' : `${first(borrower)} has`} an overdue loan, so this one can’t start now.`);
        if (await coinsOff(borrower, boss)) return note('🪙 Jackson coins are off right now.');
        // The ceiling (MAX_BALANCE): a loan that would put the borrower over
        // 1 quadrillion doesn't start. Their bank doc is read here too, so a
        // bet of theirs at the same moment takes turns with this.
        const borrowerBank = await tx.get(bankRef(borrower));
        if (overCeiling(await balanceOf(borrower, data, borrowerBank.data() || {}), loan.terms.amount)) {
          const c = ceilingNote(borrower, 'Nobody can hold more than that. The loan didn’t start.');
          return note(c.error, c.body);
        }
        if (lender) {
          // The lender's own coins: checked fresh, and their bank doc touched so
          // a bet or buy at the same moment waits for this.
          lenderBalance = await balanceOf(lender, data, lenderBank.data() || {});
          const problem = L.lendProblem({
            lender,
            amount: loan.terms.amount,
            balance: lenderBalance,
            theirs: lList,
            lock: await lockFrom(lender, lList, data, lenderBank.data() || {}, now),
            coinsOff: await coinsOff(lender, boss),
            rename: data.rename,
          });
          if (problem) return note(problem);
          touch(tx, lender, lenderBank, now);
        }
        tx.set(coinsRef(L.entryId(id, 'lend')), L.loanEntry({ ...loan, borrower, lender }, 'lend', loan.terms.amount, now));
      }
      tx.update(loanRef(id), { ...r.patch, history: L.withLine(loan.history, r.history), updatedAt: now });
      return { ok: true, loan: { ...loan, ...r.patch }, role, act: r.history.act };
    });
    if (!res.ok) return res;
    const loan = res.loan;
    const to = res.role === 'borrower' ? lenderOf(loan, boss) : loan.borrower;
    const who = res.role === 'borrower' ? first(loan.borrower) : loan.bank ? 'The bank' : first(loan.lender);
    const title = {
      accept: res.role === 'borrower' ? `${who} took your counter: the loan started` : `${who} said yes to your loan`,
      deny: `${who} said no to your loan`,
      decline: `${who} said no to your counter`,
      counter: `${who} countered your loan`,
      cancel: `${who} cancelled their loan request`,
    }[res.act];
    await tell([
      {
        to,
        type: 'loan',
        title,
        body:
          res.act === 'accept'
            ? `${L.termsText(loan.terms)}. Due ${new Date(loan.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })}.`
            : res.act === 'counter'
              ? L.termsText(loan.terms)
              : String(text || '').slice(0, 140),
        open: `loans:${id}`,
        by: me,
      },
    ]);
    return { ok: true, status: loan.status, ...(res.act === 'accept' && { balance: await balanceOf(me, data).catch(() => undefined) }) };
  });

  const loanRepay = onCall(OPEN_FN, async (req) => {
    const { me, data, boss } = await caller(req);
    const { id, amount } = req.data || {};
    if (!validId(id)) return note('Which loan?');
    const now = loanClock.now();
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(loanRef(id));
      const loan = snap.exists ? { id, ...snap.data() } : null;
      const role = L.roleOf(loan, me, { owner: boss, rename: data.rename });
      if (!role) return note(loan ? 'That isn’t your loan.' : 'That loan is gone.');
      const myBank = await tx.get(bankRef(me));
      const balance = await balanceOf(me, data, myBank.data() || {});
      const r = L.repayCheck(loan, { role, amount, balance, now });
      if (r.error) return note(r.error, r.body);
      const lender = loan.bank ? '' : data.rename(loan.lender);
      // The ceiling (MAX_BALANCE): a payment that would put a teammate lender
      // over 1 quadrillion is refused (the bank keeps nothing it's paid).
      if (lender) {
        const lenderBank = await tx.get(bankRef(lender));
        if (overCeiling(await balanceOf(lender, data, lenderBank.data() || {}), r.amount)) {
          const c = ceilingNote(lender, 'Nobody can hold more than that. Nothing was paid.');
          return note(c.error, c.body);
        }
      }
      tx.set(coinsRef(L.entryId(id, 'repay', loan.moves || 0)), L.loanEntry({ ...loan, borrower: me, lender }, 'repay', r.amount, now));
      const done = r.left === 0;
      tx.update(
        loanRef(id),
        withMove(loan, {
          paid: (loan.paid || 0) + r.amount,
          ...(done && { status: 'repaid', closedAt: now }),
          history: L.withLine(loan.history, { act: 'repay', by: 'borrower', at: now, amount: r.amount }),
          updatedAt: now,
        }),
      );
      touch(tx, me, myBank, now);
      return { ok: true, paid: r.amount, left: r.left, loan };
    });
    if (!res.ok) return res;
    if (!res.loan.bank)
      await tell([
        {
          to: res.loan.lender,
          type: 'loan',
          title: res.left ? `${first(me)} paid back ${coinsText(res.paid)}` : `${first(me)} paid off their loan`,
          body: res.left ? `${coinsText(res.left)} left.` : `${coinsText(res.paid)} coins, all done.`,
          open: `loans:${id}`,
          by: me,
        },
      ]);
    return { ok: true, paid: res.paid, left: res.left, balance: await balanceOf(me, data).catch(() => undefined) };
  });

  const loanManage = onCall(OPEN_FN, async (req) => {
    const { me, data, boss, isOwner } = await caller(req);
    const { action, id, weeks, settings, note: text } = req.data || {};
    if (action === 'settings') {
      if (!isOwner) throw new HttpsError('permission-denied', `Only ${first(boss)} can do that.`);
      const cfg = L.loanSettings(settings);
      await settingsRef.set({ ...cfg, by: me, updatedAt: Date.now() });
      return { ok: true, settings: cfg };
    }
    if (!validId(id)) return note('Which loan?');
    if (action !== 'forgive' && action !== 'extend') return note('Forgive or extend?');
    const now = loanClock.now();
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(loanRef(id));
      const loan = snap.exists ? { id, ...snap.data() } : null;
      const role = L.roleOf(loan, me, { owner: boss, rename: data.rename });
      if (!role) return note(loan ? 'That isn’t your loan.' : 'That loan is gone.');
      const borrower = data.rename(loan.borrower);
      const lender = loan.bank ? '' : data.rename(loan.lender);
      const lenderBank = lender ? await tx.get(bankRef(lender)) : null;
      const balance = loan.status === 'overdue' ? await balanceOf(borrower, data) : 0;
      const r = L.manageCheck(loan, { role, action, weeks, balance, note: text, now });
      if (r.error) return note(r.error);
      let patch = r.patch;
      if (r.give > 0) {
        // Giving back what the due date took past zero comes out of a person
        // lender's own coins (the bank just makes it).
        if (lender) {
          const have = await balanceOf(lender, data, lenderBank.data() || {});
          if (have < r.give) return note(`That gives ${coinsText(r.give)} back to ${first(borrower)}. You only have ${coinsText(Math.max(0, have))}.`);
          touch(tx, lender, lenderBank, now);
        }
        tx.set(coinsRef(L.entryId(id, action, loan.moves || 0)), L.loanEntry({ ...loan, borrower, lender }, action, r.give, now));
        patch = withMove(loan, patch);
      }
      tx.update(loanRef(id), { ...patch, history: L.withLine(loan.history, r.history), updatedAt: now });
      return { ok: true, loan: { ...loan, ...patch }, give: r.give };
    });
    if (!res.ok) return res;
    const who = res.loan.bank ? 'The bank' : first(res.loan.lender);
    await tell([
      {
        to: res.loan.borrower,
        type: 'loan',
        title: action === 'forgive' ? `${who} forgave your loan` : `${who} gave you more time on your loan`,
        body:
          action === 'forgive'
            ? res.give
              ? `${coinsText(res.give)} coins back. You’re unlocked.`
              : 'You don’t owe the rest.'
            : `Now due ${new Date(res.loan.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })}.`,
        open: `loans:${id}`,
        by: me,
      },
    ]);
    return { ok: true, status: res.loan.status, give: res.give };
  });

  // One loan's scheduled step. Each change re-reads the loan in a
  // transaction and checks its status, so two runs at once (or a retry)
  // change it once.
  async function tickOne(id, data, boss, now) {
    const out = [];
    await db.runTransaction(async (tx) => {
      out.length = 0;
      const snap = await tx.get(loanRef(id));
      if (!snap.exists) return;
      const loan = { id, ...snap.data() };
      const borrower = data.rename(loan.borrower);
      const lender = loan.bank ? '' : data.rename(loan.lender || '');
      if (loan.status === 'pending') {
        if (now - (loan.updatedAt || loan.askedAt || now) < L.LIMITS.expire) return;
        tx.update(loanRef(id), {
          status: 'expired',
          waitingOn: null,
          closedAt: now,
          updatedAt: now,
          history: L.withLine(loan.history, { act: 'expire', by: 'bank', at: now }),
        });
        out.push({
          to: borrower,
          type: 'loan',
          title: 'Your loan request closed',
          body: 'Nobody answered it in a week.',
          open: `loans:${id}`,
        });
        return;
      }
      if (loan.status === 'active' && now >= loan.dueAt) {
        // The due date: take what's left, even past zero.
        const myBank = await tx.get(bankRef(borrower));
        const balance = await balanceOf(borrower, data, myBank.data() || {});
        const c = L.collectOf(loan, { balance, now });
        if (c.take > 0)
          tx.set(coinsRef(L.entryId(id, 'collect', loan.moves || 0)), L.loanEntry({ ...loan, borrower, lender }, 'collect', c.take, now));
        tx.update(loanRef(id), { ...withMove(loan, c.patch), history: L.withLine(loan.history, c.history), updatedAt: now });
        touch(tx, borrower, myBank, now);
        const owe = c.take - Math.max(0, balance);
        out.push({
          to: borrower,
          type: 'loan',
          title: owe > 0 ? `Your loan was due: locked until you’re back to 0` : `Your loan was due: ${c.take} taken`,
          body: owe > 0 ? `${c.take} was taken and you’re ${owe} below zero. Coins you earn go toward it.` : `It’s paid off.`,
          open: `loans:${id}`,
        });
        if (lender)
          out.push({
            to: lender,
            type: 'loan',
            title: `${first(borrower)}’s loan was due`,
            body: `${coinsText(c.take)} coins came back to you.`,
            open: `loans:${id}`,
          });
        return;
      }
      if (loan.status === 'active' && !loan.remindedAt && loan.dueAt - now <= L.LIMITS.remind) {
        tx.update(loanRef(id), { remindedAt: now });
        out.push({
          to: borrower,
          type: 'loan',
          title: `Your loan is due in ${Math.max(1, Math.round((loan.dueAt - now) / L.DAY))} day${Math.round((loan.dueAt - now) / L.DAY) > 1 ? 's' : ''}`,
          body: `${coinsText(L.leftOf(loan, now))} left to pay ${L.lenderName(loan)}. Whatever is left is taken on the due date.`,
          open: `loans:${id}`,
        });
        return;
      }
      if (loan.status === 'overdue') {
        if ((await balanceOf(borrower, data)) < 0) return;
        tx.update(loanRef(id), {
          status: 'repaid',
          closedAt: now,
          updatedAt: now,
          history: L.withLine(loan.history, { act: 'settled', by: 'bank', at: now }),
        });
        out.push({
          to: borrower,
          type: 'loan',
          title: 'Your loan is paid off',
          body: 'You’re back above zero, so everything is unlocked.',
          open: `loans:${id}`,
        });
      }
    });
    return out;
  }
  async function tick(now = loanClock.now()) {
    const data = await coinData();
    const boss = data.rename(owner);
    const open = await db.collection('loans').where('status', 'in', L.OPEN).get();
    const notes = [];
    // Only the ones with something to do get a transaction.
    const due = (l) =>
      l.status === 'overdue' ||
      (l.status === 'pending' && now - (l.updatedAt || l.askedAt || now) >= L.LIMITS.expire) ||
      (l.status === 'active' && (now >= l.dueAt || (!l.remindedAt && l.dueAt - now <= L.LIMITS.remind)));
    for (const d of open.docs.filter((x) => due(x.data()))) {
      try {
        notes.push(...(await tickOne(d.id, data, boss, now)));
      } catch (e) {
        logger.warn('loan tick', d.id, e.message);
      }
    }
    await tell(notes);
    return { checked: open.size, notes: notes.length };
  }
  const loanTick = onSchedule({ schedule: 'every 15 minutes', timeZone }, async () => {
    await tick();
  });

  // A rename (settings/names): loans keep the person's current name, so the
  // app's own query (borrower or lender == their name) still finds them.
  const loanRenames = onDocumentWritten('settings/names', async (event) => {
    const before = event.data?.before?.get('renames') || {};
    const after = event.data?.after?.get('renames') || {};
    const moved = Object.keys(after).filter((from) => after[from] && before[from] !== after[from]);
    if (!moved.length) return;
    // Followed here from the new list (the cached renames can be a few seconds old).
    const follow = (n) => {
      let x = n;
      for (let i = 0; i < 10 && after[x] && after[x] !== x; i++) x = after[x];
      return x;
    };
    for (const from of moved) {
      const to = follow(from);
      if (to === from) continue;
      for (const f of ['borrower', 'lender']) {
        const snap = await db.collection('loans').where(f, '==', from).get();
        for (const d of snap.docs) await d.ref.update({ [f]: to }).catch((e) => logger.warn('loan rename', d.id, e.message));
      }
    }
  });

  return { loanRequest, loanRespond, loanRepay, loanManage, loanTick, loanRenames, lockOf, tick };
}
