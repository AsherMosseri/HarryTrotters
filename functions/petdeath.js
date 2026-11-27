// Pets can die (3.3) on the server. The rule itself is in
// shared/petdeath.js (the demo runs the same one); this file reads and
// writes the docs:
//   pets/{personId}            each pet's `neglect` (the clock and the warnings
//                              sent), and the pet taken out when it dies
//   petMemorials/{id}          a pet that died: everyone reads it ("In memory"),
//                              with who paid respects; id: pets doc id + adoptedAt
//   channels/general/messages/funeral-{id}   the funeral card (Trotbot)
//   petDeathOff/{personId}     asking Asher to turn pet death off, and his answer
//                              (read by that person and Asher)
//   petGifts/{id}              an open offer of a pet that died is cancelled
// petCare (scheduled, a few times a day) checks every pet. Each pets doc is
// changed in one transaction that re-reads it: a pet dies once (its memorial
// and card have fixed ids), each warning goes once (`neglect.stage`), and two
// runs at once take turns. Notifications go out only after the write held.
// Nothing here costs or pays coins.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { docOf, giftOpen, petsIn } from './shared/pets.js';
import {
  answerCheck,
  answerNote,
  askCheck,
  deathNote,
  funeralPost,
  giftsFor,
  memorialId,
  memorialOf,
  neglectWithOff,
  offNames,
  petFate,
  respectsCheck,
  warnNote,
} from './shared/petdeath.js';

export function petDeathFunctions({ db, notify, personId, renamer, coinData, inactiveNames, owner, timeZone, clock = { now: () => Date.now() } }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const say = (n) => (n.length ? notify(n).catch((e) => logger.warn('pet death notify', e.message)) : null);

  // The approved photo, when the pet showed as it (only a person's first pet can).
  async function photoFor(aliases) {
    for (const n of aliases) {
      const s = await db.doc(`petPhotos/${personId(n)}`).get();
      if (s.exists) return s.data();
    }
    return null;
  }

  // One pets doc: works out every pet's fate and writes it in a transaction.
  // Returns the notifications to send (once the write held).
  async function checkDoc(ref, { rename, shifts, asleepSet, offSet, now }) {
    let notes = [];
    let deaths = [];
    await db.runTransaction(async (tx) => {
      notes = [];
      deaths = [];
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const doc = snap.data();
      const person = rename(doc.person || '');
      if (!person) return;
      const list = petsIn(doc);
      const ctx = { now, asleep: asleepSet.has(person), off: offSet.has(person) };
      const fates = list.map((p) => petFate(p, ctx));
      if (!fates.some((f) => f.patch || f.status === 'dies')) return;
      const dying = fates.map((f, i) => (f.status === 'dies' ? i : -1)).filter((i) => i >= 0);
      // Reads first: each memorial (already there means it already died) and
      // the owner's open offers.
      const aliases = rename.aliases(person).slice(0, 30);
      const memRefs = dying.map((i) => db.doc(`petMemorials/${memorialId(ref.id, list[i])}`));
      const memSnaps = await Promise.all(memRefs.map((r) => tx.get(r)));
      const gifts = dying.length ? (await tx.get(db.collection('petGifts').where('from', 'in', aliases))).docs : [];
      const photo = dying.includes(0) && list[0].photoAsPet === true ? await photoFor(aliases) : null;

      const keep = [];
      list.forEach((p, i) => {
        const f = fates[i];
        if (f.status !== 'dies') {
          keep.push(f.patch ? { ...p, neglect: f.patch } : p);
          if (f.warn) notes.push({ to: person, type: 'market', icon: '🐾', ...warnNote(p.name || 'Your pet', f.warn), open: 'view:market', tag: `pet-care-${p.adoptedAt}` });
          return;
        }
        const k = dying.indexOf(i);
        if (memSnaps[k].exists) return; // gone already (the memorial stays as it is)
        const m = memorialOf(p, { id: memRefs[k].id, person, shifts, now, photo: i === 0 ? photo : null });
        tx.set(memRefs[k], m);
        tx.set(db.doc(`channels/general/messages/${m.msgId}`), funeralPost(m));
        for (const g of giftsFor(gifts.map((d) => ({ ...d.data(), ref: d.ref })), p, (x) => giftOpen(x, now))) {
          tx.update(g.ref, { status: 'cancelled', decidedAt: now, why: 'died' });
          notes.push({
            to: rename(g.to),
            type: 'market',
            icon: '🌈',
            title: `${m.name} can’t come to you after all`,
            body: `${m.name} crossed the rainbow bridge, so ${first(person)}’s offer was cancelled.`,
            open: 'view:market',
            quiet: true,
          });
        }
        notes.push({ to: person, type: 'market', icon: '🌈', ...deathNote(m), open: 'view:market', tag: `pet-gone-${m.id}` });
        deaths.push(m.id);
      });
      const next = docOf(doc.person, keep);
      if (next) tx.set(ref, next);
      else tx.delete(ref);
    });
    if (deaths.length) logger.info('pets died', deaths.join(', '));
    return notes;
  }

  // Every pet, now. Exported for the emulator tests (they pass `now`).
  async function sweep(now = clock.now()) {
    const rename = await renamer();
    const data = await coinData();
    const pets = await db.collection('pets').get();
    if (pets.empty) return { checked: 0 };
    const owners = [...new Set(pets.docs.map((d) => rename(d.get('person') || '')).filter(Boolean))];
    const [asleepSet, offDocs] = await Promise.all([inactiveNames(rename, owners), db.collection('petDeathOff').get()]);
    const offSet = offNames(
      offDocs.docs.map((d) => d.data()),
      rename,
    );
    const notes = [];
    for (const d of pets.docs) {
      try {
        notes.push(...(await checkDoc(d.ref, { rename, shifts: data.shifts, asleepSet, offSet, now })));
      } catch (e) {
        logger.error('pet check', d.id, e.message);
      }
    }
    await say(notes);
    return { checked: pets.size, notes: notes.length };
  }

  // At 8 AM, noon, 4 PM and 8 PM (New York): never a buzz at night.
  const petCare = onSchedule({ schedule: '5 8,12,16,20 * * *', timeZone }, async () => {
    const r = await sweep();
    logger.info('pet care check', r);
  });

  // The `pet` callable's death actions (market.js routes them here).
  // ctx: the caller (me, admin, data = coin data with rename, aliases).
  async function run(ctx, input) {
    const { me, admin, data, aliases } = ctx;
    const action = input?.action;
    const now = clock.now();
    const rename = data.rename;

    if (action === 'respects') {
      const id = String(input.id || '');
      if (!/^[\w-]{1,120}$/.test(id)) return note('Which pet?');
      return db.runTransaction(async (tx) => {
        const ref = db.doc(`petMemorials/${id}`);
        const snap = await tx.get(ref);
        const r = respectsCheck(snap.exists ? snap.data() : null, { me, rename, now });
        if (r.note) return r;
        if (r.respects) tx.update(ref, { respects: r.respects });
        return { ok: true, already: !!r.already };
      });
    }

    if (action === 'deathAsk') {
      let asked = null;
      const out = await db.runTransaction(async (tx) => {
        let ref = db.doc(`petDeathOff/${personId(aliases[0])}`);
        let doc = null;
        for (const n of aliases) {
          const s = await tx.get(db.doc(`petDeathOff/${personId(n)}`));
          if (s.exists) {
            ref = s.ref;
            doc = s.data();
            break;
          }
        }
        const r = askCheck(input, { me, doc, owner, now });
        if (r.note) return r;
        // Asher's own: his pets are marked at once (no one to ask).
        if (r.doc.status === 'off') (await markPets(tx, aliases, true, now))();
        tx.set(ref, r.doc);
        asked = r.doc;
        return { ok: true, status: r.doc.status };
      });
      if (asked?.status === 'pending')
        await say([
          {
            to: owner,
            type: 'market',
            icon: '🐾',
            title: `${first(me)} asked to turn off pet death`,
            body: asked.reason ? `“${asked.reason}” Answer in Market, Pets.` : 'Answer in Market, Pets.',
            open: 'view:market',
            by: me,
          },
        ]);
      return out;
    }

    if (action === 'deathAnswer') {
      if (!admin || me !== owner) return note('Only Asher can answer these.');
      const id = String(input.id || '');
      if (!/^[\w-]{1,80}$/.test(id)) return note('Whose ask?');
      let told = null;
      const out = await db.runTransaction(async (tx) => {
        const ref = db.doc(`petDeathOff/${id}`);
        const snap = await tx.get(ref);
        const r = answerCheck(input, { doc: snap.exists ? snap.data() : null, me, now });
        if (r.note) return r;
        const who = rename(r.doc.by || '');
        // Their pets change at once (the next check would get there too).
        if (r.told !== 'declined') (await markPets(tx, rename.aliases(who).slice(0, 30), r.told === 'off', now))();
        tx.set(ref, r.doc);
        told = { who, ...answerNote(r.told, r.doc) };
        return { ok: true, status: r.doc.status };
      });
      if (told) await say([{ to: told.who, type: 'market', icon: '🐾', title: told.title, body: told.body, open: 'view:market', by: me }]);
      return out;
    }

    throw new HttpsError('invalid-argument', 'Unknown action.');
  }

  // Inside a transaction: reads the person's pets doc and returns the write
  // (call it after every other read) that switches pet death off or back on
  // for each of their pets.
  async function markPets(tx, aliases, off, now) {
    for (const n of aliases) {
      const ref = db.doc(`pets/${personId(n)}`);
      const s = await tx.get(ref);
      if (!s.exists) continue;
      const doc = s.data();
      const next = docOf(
        doc.person,
        petsIn(doc).map((p) => ({ ...p, neglect: neglectWithOff(p.neglect, off, now) })),
      );
      return () => tx.set(ref, next);
    }
    return () => {};
  }

  return { petCare, sweep, run };
}
