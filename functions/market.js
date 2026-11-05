// The market (F1) and pets (H3) on the server. Everything that costs coins
// happens here: the balance is read fresh (freshCoins) inside a transaction
// that also touches the buyer's bank doc, so two buys at once take turns and
// the second sees the first. The rules never let the app write purchases,
// pets, tournaments, refunds or market spends (firestore.rules).
//
// Callables:
//   buy({ item, text })            pet items, perks, chat extras
//   joinTournament({ id })         pay the entry, join, add it to the pot
//   marketManage({ action, … })    team management: approve/decline/redeem a
//                                  perk, take down a shout-out, start or
//                                  cancel a tournament, void a result, clear
//                                  or void a run held for review
//   pet({ action, … })             adopt, rename, show in chat, rehome, style,
//                                  hatch a baby, give a pet to a teammate,
//                                  photos of real pets (petphotos.js)
// Scheduled: payTournaments (every 10 minutes) pays out the ones that ended.
// The checks themselves are in shared/market.js and shared/pets.js (demo
// mode runs the same ones).

import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import * as market from './shared/market.js';
import { petsIn, withPet } from './shared/pets.js';
import { petFamily } from './petfamily.js';
import { petPhotos } from './petphotos.js';
import { PHOTO_ACTIONS } from './shared/petphotos.js';
import { memberOk } from './shared/team.js';
import { coinsText } from './shared/coinText.js';

const OPEN = { maxInstances: 5, invoker: 'public' };

export function marketFunctions({ db, coinData, freshCoins, notify, bankRef, personId, owner, timeZone, loanLock = async () => null }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];

  // The caller: a password member, under their current name.
  async function caller(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    const me = data.rename(member.get('name'));
    return { uid, me, admin: member.get('admin') === true, data, aliases: data.rename.aliases(me).slice(0, 30) };
  }
  // The balance after a sale, sent back with the answer so the app can check
  // its own number against it (null if it couldn't be worked out).
  async function balanceAfter(me, data) {
    try {
      return (await freshCoins(me, (await bankRef(me).get()).data() || {}, data)).balance;
    } catch (e) {
      logger.warn('balanceAfter', e.message);
      return null;
    }
  }
  // Coins switched off in Controls: nobody but Asher buys anything.
  async function coinsOff(me) {
    if (me === owner) return false;
    const controls = (await db.doc('settings/controls').get()).data() || {};
    return (controls.off || []).includes('coins');
  }
  // An overdue loan (functions/loans.js) locks buying until it's paid.
  async function locked(me) {
    const lock = await loanLock(me);
    return lock ? note(lock.title, lock.body) : null;
  }
  // Team management's names (current spellings), for notifications.
  async function managers(rename) {
    const snap = await db.collection('members').where('admin', '==', true).get();
    return [...new Set(snap.docs.map((d) => rename(d.get('name') || '')).filter(Boolean))];
  }
  // A person's pet doc, under any name they've gone by (the id follows the
  // name they adopted it with).
  async function petRefOf(aliases, tx) {
    for (const n of aliases) {
      const ref = db.doc(`pets/${personId(n)}`);
      const snap = tx ? await tx.get(ref) : await ref.get();
      if (snap.exists) return { ref, snap };
    }
    return { ref: db.doc(`pets/${personId(aliases[0])}`), snap: null };
  }

  const buy = onCall(OPEN, async (req) => {
    const { me, data, aliases } = await caller(req);
    if (await coinsOff(me)) return note('🪙 Jackson coins are off right now.');
    const lock = await locked(me);
    if (lock) return lock;
    const item = String(req.data?.item || '').slice(0, 80);
    const [kind, id] = item.split(/:(.*)/s);
    if (!['pet', 'perk', 'extra'].includes(kind) || !id || !/^[\w-]{1,40}$/.test(id)) return note('That isn’t for sale.');
    const result = await db.runTransaction(async (tx) => {
      // Reads first (a transaction reads before it writes).
      const myBank = (await tx.get(bankRef(me))).data() || {};
      const pet = kind === 'pet' ? await petRefOf(aliases, tx) : null;
      // Which of your pets (the first, unless the app says which one).
      const pets = pet?.snap ? petsIn(pet.snap.data()) : [];
      const at = req.data?.born == null ? 0 : pets.findIndex((p) => p.adoptedAt === Number(req.data.born));
      const perkSnap = kind === 'perk' ? await tx.get(db.doc(`perks/${id}`)) : null;
      const bought = kind === 'pet' ? null : await tx.get(db.collection('purchases').where('item', '==', item));
      const { balance } = await freshCoins(me, myBank, data);
      const now = Date.now();
      const r = market.buyCheck(item, {
        me,
        aliases,
        balance,
        now,
        pet: pets[at] || null,
        perk: perkSnap?.exists ? perkSnap.data() : null,
        purchases: bought ? bought.docs.map((d) => d.data()) : [],
        text: req.data?.text,
      });
      if (r.error) return note(r.error, r.body);
      tx.set(db.collection('coins').doc(), market.spendEntry(me, item, r.price, r.label, now));
      tx.set(bankRef(me), { ...myBank, name: me, touched: now });
      let purchaseId = null;
      if (r.purchase) {
        const ref = db.collection('purchases').doc();
        purchaseId = ref.id;
        tx.set(ref, r.purchase);
      }
      // The whole doc again (it was read in this transaction), with the one pet fed.
      if (r.pet) tx.set(pet.ref, withPet({ ...pet.snap.data(), person: me }, at, { ...r.pet, cared: (pets[at].cared || 0) + 1, caredAt: now }));
      return { ok: true, price: r.price, purchase: r.purchase ? { id: purchaseId, ...r.purchase } : null, pet: r.pet || null };
    });
    // A perk: tell team management (after the sale, outside the transaction).
    if (result.ok && result.purchase?.kind === 'perk') {
      const p = result.purchase;
      const to = (await managers(data.rename)).filter((n) => n !== me);
      await notify(
        to.map((n) => ({
          to: n,
          type: 'market',
          icon: '🛍️',
          title: `${first(me)} bought “${p.name}”`,
          body: p.status === 'pending' ? 'Approve or decline it in the Market.' : 'Mark it done in the Market once it happens.',
          open: 'view:market',
          by: me,
        })),
      ).catch((e) => logger.warn('market notify', e.message));
    }
    if (result.ok) result.balance = await balanceAfter(me, data);
    return result;
  });

  const joinTournament = onCall(OPEN, async (req) => {
    const { me, data, aliases } = await caller(req);
    if (await coinsOff(me)) return note('🪙 Jackson coins are off right now.');
    const lock = await locked(me);
    if (lock) return lock;
    const id = String(req.data?.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) return note('Which tournament?');
    const ref = db.doc(`tournaments/${id}`);
    const res = await db.runTransaction(async (tx) => {
      const [snap, bank] = await Promise.all([tx.get(ref), tx.get(bankRef(me))]);
      const myBank = bank.data() || {};
      const t = snap.exists ? snap.data() : null;
      const { balance } = await freshCoins(me, myBank, data);
      const now = Date.now();
      const r = market.joinCheck(t, { me, aliases, balance, now });
      if (r.error) return note(r.error);
      tx.set(db.collection('coins').doc(), {
        type: 'spend',
        person: me,
        amount: t.entry,
        what: 'tournament',
        item: `tour:${id}`,
        label: `Tournament entry: ${t.title}`.slice(0, 80),
        at: now,
      });
      tx.set(bankRef(me), { ...myBank, name: me, touched: now });
      // A FieldPath, so a name with a dot in it stays one key.
      tx.update(ref, 'pot', r.pot, new FieldPath('players', me), r.player);
      return { ok: true, pot: r.pot };
    });
    return res.ok ? { ...res, balance: await balanceAfter(me, data) } : res;
  });

  // Pays one tournament that has ended (or is being cancelled). Returns the
  // payout, or null if it was already settled.
  async function settle(id, { cancel = false, by = '' } = {}) {
    const ref = db.doc(`tournaments/${id}`);
    const data = await coinData();
    const rename = data.rename;
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const t = snap.data();
      const now = Date.now();
      if (!t || t.status !== 'open' || (!cancel && t.endsAt > now)) return null;
      // A held run that could still win: wait for team management (a while).
      if (!cancel && market.reviewHolds(t, now)) return null;
      const r0 = cancel
        ? { winners: [], pays: [], refunds: Object.keys(t.players || {}).map((n) => ({ name: rename(n), amount: t.entry })) }
        : market.payoutOf(t, rename);
      // Nobody ends up over a googol (MAX_BALANCE): each prize or entry
      // back pays up to it at most; the rest isn't paid to anyone.
      const names = [...new Set([...r0.pays, ...r0.refunds].map((p) => p.name))];
      const banks = await Promise.all(names.map((n) => tx.get(bankRef(n))));
      const have = Object.fromEntries(
        await Promise.all(names.map(async (n, i) => [n, (await freshCoins(n, banks[i].data() || {}, data)).balance])),
      );
      const r = { ...r0, pays: market.capPays(r0.pays, have), refunds: market.capPays(r0.refunds, have) };
      for (const p of r.pays)
        tx.set(db.collection('coins').doc(), {
          type: 'prize',
          person: p.name,
          amount: p.amount,
          what: 'tournament',
          label: market.prizeLabel(t),
          item: `tour:${id}`,
          at: now,
        });
      for (const p of r.refunds) tx.set(db.collection('coins').doc(), market.refundEntry(p.name, p.amount, t.title, `tour:${id}`, now));
      tx.update(ref, {
        status: 'done',
        winners: r.winners,
        paid: r.pays,
        paidAt: now,
        ...(cancel && { cancelled: true, cancelledBy: by }),
      });
      return { t, ...r };
    });
    if (out && !cancel) {
      const names = Object.keys(out.t.players || {}).map(rename);
      const won = new Map(out.pays.map((p) => [p.name, p.amount]));
      await notify(
        names.map((n) => ({
          to: n,
          type: 'market',
          icon: '🏆',
          title: won.has(n) ? `You won ${coinsText(won.get(n))} coins in ${out.t.title}` : `${out.t.title} is over`,
          body: out.winners.length
            ? won.has(n)
              ? 'Best score. Nice.'
              : `Winner: ${out.winners.join(', ')}`
            : 'Nobody played, so everyone got their entry back.',
          open: 'view:market',
          quiet: !won.has(n),
        })),
      ).catch((e) => logger.warn('tournament notify', e.message));
    }
    return out;
  }

  const payTournaments = onSchedule({ schedule: 'every 10 minutes', timeZone }, async () => {
    // Only a few are open at a time; filtering here needs no composite index.
    const open = await db.collection('tournaments').where('status', '==', 'open').get();
    const due = open.docs.filter((d) => (d.get('endsAt') || 0) <= Date.now());
    for (const d of due) await settle(d.id).catch((e) => logger.error('tournament payout', d.id, e));
  });

  const marketManage = onCall(OPEN, async (req) => {
    const { me, admin, data } = await caller(req);
    if (!admin) throw new HttpsError('permission-denied', 'Team management only.');
    const { action, id = '' } = req.data || {};
    if (action !== 'createTournament' && !/^[\w-]{1,40}$/.test(String(id))) return note('Which one?');

    if (action === 'decide') {
      const ref = db.doc(`purchases/${id}`);
      const r = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const p = snap.data();
        const d = market.decideCheck(p, req.data.status);
        if (d.error) return note(d.error);
        const now = Date.now();
        tx.update(ref, { status: d.status, decidedBy: me, decidedAt: now });
        if (d.refund) tx.set(db.collection('coins').doc(), market.refundEntry(p.person, p.price, p.name, p.item, now));
        return { ok: true, p, status: d.status };
      });
      if (r.ok && r.status !== 'redeemed') {
        const buyer = data.rename(r.p.person);
        await notify([
          {
            to: buyer,
            type: 'market',
            icon: r.status === 'approved' ? '✅' : '↩️',
            title: r.status === 'approved' ? `“${r.p.name}” is approved` : `“${r.p.name}” was declined`,
            body: r.status === 'approved' ? 'Team management will make it happen.' : `Your ${coinsText(r.p.price)} coins are back.`,
            open: 'view:market',
            by: me,
          },
        ]).catch((e) => logger.warn('market notify', e.message));
      }
      return r.ok ? { ok: true, status: r.status } : r;
    }

    if (action === 'removeBanner') {
      const ref = db.doc(`purchases/${id}`);
      const snap = await ref.get();
      if (!snap.exists || snap.get('item') !== 'extra:banner') return note('That shout-out is gone.');
      await ref.update({ status: 'removed', removedBy: me, removedAt: Date.now() });
      return { ok: true };
    }

    if (action === 'createTournament') {
      const { seed, ...t } = market.newTournament(req.data || {}, { by: me, now: Date.now(), seed: randomBytes(6).toString('hex') });
      if (t.error) return note(t.error);
      // The seed goes where only the server reads it.
      const ref = db.collection('tournaments').doc();
      const batch = db.batch();
      batch.set(ref, t);
      batch.set(db.doc(`tournamentSecrets/${ref.id}`), { seed });
      await batch.commit();
      return { ok: true, id: ref.id };
    }

    // Void a player's result: it stops counting. Before the payout the pot
    // goes to the next best; after it, nothing is taken back (the
    // tournament just shows who was voided).
    if (action === 'voidResult') {
      const ref = db.doc(`tournaments/${id}`);
      return db.runTransaction(async (tx) => {
        const t = (await tx.get(ref)).data();
        const name = String(req.data?.name || '');
        if (!t || t.cancelled) return note('That tournament is gone.');
        if (!t.players?.[name]) return note('They’re not in that tournament.');
        if (t.players[name].voided) return note('Already voided.');
        const now = Date.now();
        const patch = [new FieldPath('players', name, 'voided'), { by: me, at: now, afterPayout: t.status === 'done' }];
        // Their runs waiting for review go too.
        for (const r of market.pendingReview(t)) if (r.name === name) patch.push(new FieldPath('review', r.id), FieldValue.delete());
        tx.update(ref, ...patch);
        return { ok: true };
      });
    }

    // A run held for review (too fast for a person): clear it (it counts, if
    // it's their best) or void it.
    if (action === 'review') {
      const ref = db.doc(`tournaments/${id}`);
      const run = String(req.data?.run || '');
      if (!/^[\w-]{1,40}$/.test(run)) return note('Which run?');
      const clear = req.data?.clear === true;
      return db.runTransaction(async (tx) => {
        const t = (await tx.get(ref)).data();
        const r = t?.review?.[run];
        if (!r) return note('That run was already checked.');
        const now = Date.now();
        const patch = [new FieldPath('review', run), FieldValue.delete()];
        const best = clear && t.status === 'open' ? market.clearedBest(t, r) : null;
        if (best) patch.push(new FieldPath('players', r.name, 'best'), best.best, new FieldPath('players', r.name, 'at'), best.at);
        tx.update(ref, ...patch);
        tx.set(db.doc(`funGames/${run}`), { review: clear ? 'cleared' : 'voided', reviewedBy: me, reviewedAt: now }, { merge: true });
        return { ok: true, counted: !!best };
      });
    }

    if (action === 'cancelTournament') {
      const out = await settle(id, { cancel: true, by: me });
      return out ? { ok: true } : note('That tournament is already over.');
    }
    throw new HttpsError('invalid-argument', 'Unknown action.');
  });

  // Pets: free to adopt, name, show, dress up and rehome; a pet can have one
  // baby, and can be given to a teammate (petfamily.js). Care is bought (buy).
  const runPet = petFamily({ db, notify, personId });
  // Photos of real pets (petphotos.js) ride on the same callable.
  const runPhotos = petPhotos({ db, notify, personId, managers, owner });
  const pet = onCall(OPEN, async (req) => {
    const ctx = await caller(req);
    if (PHOTO_ACTIONS.includes(req.data?.action)) return runPhotos(ctx, req.data);
    return runPet(ctx, req.data || {});
  });

  return { buy, joinTournament, marketManage, pet, payTournaments, settleTournament: settle };
}
