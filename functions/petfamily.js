// Pets on the server (the `pet` callable in market.js): adopt, rename, show
// in chat, rehome, dress up (style), the one baby a pet can have (hatch), and
// giving a pet to a teammate (offer, cancelOffer, accept, decline). Each move
// is checked by the plain functions in shared/pets.js (demo mode runs the
// same ones); this file only reads and writes the docs:
//   pets/{personId}   a person's pets: the first at the top, the second in `extra`
//   petGifts/{id}     an offer to give a pet away (read by the two people)
//   petUnlocks/{id}   event gear a person earned (petevents.js); a style move checks it
// Nothing here costs or pays coins.

import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { cleanName } from './shared/team.js';
import { giftAccept, giftEnd, giftOffer, petEdit } from './shared/pets.js';
import { earnedIds } from './shared/events.js';

export function petFamily({ db, notify, personId }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const say = (n) => notify(n).catch((e) => logger.warn('pet notify', e.message));

  // A person's pets doc, under any name they've gone by.
  async function docOf(tx, aliases) {
    for (const n of aliases) {
      const ref = db.doc(`pets/${personId(n)}`);
      const snap = await tx.get(ref);
      if (snap.exists) return { ref, data: snap.data() };
    }
    return { ref: db.doc(`pets/${personId(aliases[0])}`), data: null };
  }
  const save = (tx, { ref }, doc) => (doc ? tx.set(ref, doc) : tx.delete(ref));
  // The event gear (limited, from team events) this person has earned: the
  // server alone writes petUnlocks, so a style move is checked against it.
  async function earnedGear(tx, aliases) {
    for (const n of aliases) {
      const snap = await tx.get(db.doc(`petUnlocks/${personId(n)}`));
      if (snap.exists) return earnedIds(snap.data());
    }
    return [];
  }
  const giftRef = (id) => db.doc(`petGifts/${id}`);
  const badId = (id) => !/^[\w-]{1,40}$/.test(String(id || ''));

  // ctx: the caller (me, data = coin data with rename and shifts, aliases).
  return async function run(ctx, input) {
    const { me, data, aliases } = ctx;
    const action = input?.action;
    const now = Date.now();

    if (['adopt', 'rename', 'inChat', 'release', 'style', 'hatch'].includes(action)) {
      return db.runTransaction(async (tx) => {
        const mine = await docOf(tx, aliases);
        const earned = action === 'style' ? await earnedGear(tx, aliases) : [];
        const r = petEdit(action, input, { me, doc: mine.data, shifts: data.shifts, earned, now });
        if (r.note) return r;
        save(tx, mine, r.doc);
        return { ok: true, ...(r.born && { born: r.born }) };
      });
    }

    if (action === 'offer') {
      const to = data.rename(cleanName(input.to));
      let after = null;
      const out = await db.runTransaction(async (tx) => {
        const mine = await docOf(tx, aliases);
        // Is the teammate a member who has been let in? (a waiting name isn't)
        const found = to ? await tx.get(db.collection('members').where('name', 'in', data.rename.aliases(to).slice(0, 30))) : { docs: [] };
        const toOk = found.docs.some((d) => d.get('via') === 'password' && d.get('pending') !== true);
        const mineGifts = await tx.get(db.collection('petGifts').where('from', 'in', aliases));
        const r = giftOffer(input, {
          me,
          doc: mine.data,
          to,
          toOk,
          gifts: mineGifts.docs.map((d) => d.data()),
          shifts: data.shifts,
          now,
        });
        if (r.note) return r;
        const ref = db.collection('petGifts').doc();
        tx.set(ref, r.gift);
        after = { id: ref.id, gift: r.gift };
        return { ok: true, id: ref.id };
      });
      if (after)
        await say([
          {
            to: after.gift.to,
            type: 'market',
            icon: '🐾',
            title: `${first(me)} wants to give you ${after.gift.pet.name}`,
            body: `A ${after.gift.pet.species}. Open Market, Pets to say yes or no thanks.`,
            open: 'view:market',
            by: me,
          },
        ]);
      return out;
    }

    if (action === 'cancelOffer' || action === 'decline' || action === 'accept') {
      if (badId(input.id)) return note('Which offer?');
      let after = null;
      const out = await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(giftRef(input.id));
        const gift = gSnap.exists ? gSnap.data() : null;
        if (action !== 'accept') {
          const r = giftEnd(action === 'decline' ? 'decline' : 'cancel', gift, { me, rename: data.rename, now });
          if (r.status) tx.update(gSnap.ref, { status: r.status, decidedAt: now });
          if (r.note) return r;
          after = { kind: r.status, gift };
          return { ok: true };
        }
        if (!gift || data.rename(gift.to) !== me) return note('That offer is gone.');
        const giver = data.rename(gift.from);
        const mine = await docOf(tx, aliases);
        const theirs = await docOf(tx, data.rename.aliases(giver).slice(0, 30));
        const r = giftAccept(gift, { me, doc: mine.data, giverDoc: theirs.data, giver, now });
        if (r.status && r.status !== 'accepted') tx.update(gSnap.ref, { status: r.status, decidedAt: now });
        if (r.note) return r;
        save(tx, mine, r.doc);
        save(tx, theirs, r.giverDoc);
        tx.update(gSnap.ref, { status: 'accepted', decidedAt: now });
        after = { kind: 'accepted', gift };
        return { ok: true, name: r.pet.name };
      });
      if (after && after.kind !== 'cancelled') {
        const g = after.gift;
        const yes = after.kind === 'accepted';
        await say([
          {
            to: g.from,
            type: 'market',
            icon: '🐾',
            title: yes ? `${first(me)} took ${g.pet.name}` : `${first(me)} said no thanks`,
            body: yes ? `${g.pet.name} has a new home.` : `${g.pet.name} stays with you.`,
            open: 'view:market',
            by: me,
            quiet: !yes,
          },
        ]);
      }
      return out;
    }

    throw new HttpsError('invalid-argument', 'Unknown action.');
  };
}
