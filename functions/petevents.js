// Team events on the server (shared/events.js has the math): the team's lab
// time inside an event's window fills a meter, each tier reached shares event
// gear with the people who helped, and each of them gets one inbox item.
//
//   petEvents/{id}        the event, its cached progress and the tiers reached
//                         (read by every member; written only here)
//   petUnlocks/{personId} the event gear a person has earned (server only)
//
// Callable petEvent({ action, … }):
//   refresh               any member: makes the first event if it isn't there
//                         yet (Competition week), then does the sums for every
//                         event that is running (at most once a minute)
//   seen { gear }         any member: that reward's celebration was shown
//   create / edit / end   team management: make, change or end an event
// Scheduled: petEventTick (every 15 minutes) does the same sums, so a tier
// reached while nobody has the app open still gets its notifications.
// Hours come from the shifts collection only (coinData), never from the app.
// Nothing here costs or pays coins.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { memberOk } from './shared/team.js';
import { eventGearItem } from './shared/pets.js';
import { MAX_OPEN_EVENTS, SEED_ID, advance, cleanEvent, seedEvent, stale, statusOf, unlockAfter } from './shared/events.js';

const OPEN = { maxInstances: 5, invoker: 'public' };

export function petEventFunctions({ db, coinData, notify, personId, owner, timeZone }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const events = () => db.collection('petEvents');

  // The caller: a password member, under their current name.
  async function caller(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    const me = data.rename(member.get('name'));
    return { me, admin: member.get('admin') === true, data, aliases: data.rename.aliases(me).slice(0, 30) };
  }

  // The first event, once. Never again if it was ended or the days passed.
  let seeded = false;
  async function seed() {
    if (seeded) return;
    const ref = events().doc(SEED_ID);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return;
      const ev = seedEvent(owner);
      if (Date.now() < ev.endsAt) tx.create(ref, ev);
    });
    seeded = true;
  }

  // A person's unlock doc, under any name they've gone by.
  async function unlockOf(tx, aliases) {
    for (const n of aliases) {
      const ref = db.doc(`petUnlocks/${personId(n)}`);
      const snap = await tx.get(ref);
      if (snap.exists) return { ref, data: snap.data() };
    }
    return { ref: db.doc(`petUnlocks/${personId(aliases[0])}`), data: null };
  }

  // Does the sums for one event. Everything that gets given happens in one
  // transaction with marking the tier as reached, so asking twice (or two
  // phones at once) gives each reward once. Returns what was reached now.
  async function settle(id, { force = false } = {}) {
    const data = await coinData();
    const dayCapHours = data.cfg.dayCap;
    const out = await db.runTransaction(async (tx) => {
      const ref = events().doc(id);
      const snap = await tx.get(ref);
      const ev = snap.data();
      const now = Date.now();
      if (!ev || !stale(ev, now, force)) return null;
      const r = advance(ev, data.shifts, { now, dayCapHours });
      // Reads before writes: the unlock docs of everyone who shares in a gear tier.
      const docs = new Map();
      for (const n of r.newly)
        if (n.gear)
          for (const p of n.people) if (!docs.has(p)) docs.set(p, await unlockOf(tx, data.rename.aliases(p).slice(0, 30)));
      tx.update(ref, r.patch);
      const give = new Map();
      for (const n of r.newly)
        if (n.gear) for (const p of n.people) give.set(p, [...(give.get(p) || []), { id: n.gear, event: id, title: ev.title, tier: n.tier, at: now }]);
      for (const [p, list] of give) {
        const d = docs.get(p);
        tx.set(d.ref, { ...(d.data || {}), ...unlockAfter(d.data, p, list) });
      }
      return { ev, newly: r.newly };
    });
    if (out?.newly.length) await tell(out.ev, out.newly);
    return out;
  }

  // One inbox item for each person for each tier, once (the tier was marked
  // reached in the transaction above, so this runs once per tier).
  async function tell(ev, newly) {
    const notes = [];
    for (const n of newly)
      for (const p of n.people) {
        const gear = n.gear ? eventGearItem(n.gear) : null;
        notes.push({
          to: p,
          type: 'market',
          icon: '🎉',
          title: `${ev.title}: ${n.label} reached`,
          body: gear ? `The team hit ${n.hours} hours. You earned the ${gear.name}. Open Market, Pets, Style to put it on.` : `The team hit ${n.hours} hours. Thanks for putting in your time.`,
          open: gear ? 'view:market' : 'view:today',
          by: ev.createdBy || '',
        });
      }
    if (notes.length) await notify(notes).catch((e) => logger.warn('event notify', e.message));
  }

  async function refreshAll({ force = false } = {}) {
    await seed();
    const snap = await events().get();
    for (const d of snap.docs) await settle(d.id, { force }).catch((e) => logger.error('petEvent settle', d.id, e));
  }

  const petEvent = onCall(OPEN, async (req) => {
    const { me, admin, data, aliases } = await caller(req);
    const action = req.data?.action;

    if (action === 'refresh') {
      await refreshAll();
      return { ok: true };
    }

    if (action === 'seen') {
      const gear = String(req.data?.gear || '');
      if (!eventGearItem(gear)) return note('Which reward?');
      return db.runTransaction(async (tx) => {
        const u = await unlockOf(tx, aliases);
        if (!u.data?.gear?.[gear]) return note('That isn’t yours.');
        if (!u.data.seen?.[gear]) tx.set(u.ref, { ...u.data, seen: { ...(u.data.seen || {}), [gear]: Date.now() } });
        return { ok: true };
      });
    }

    if (!['create', 'edit', 'end'].includes(action)) throw new HttpsError('invalid-argument', 'Unknown action.');
    if (!admin) throw new HttpsError('permission-denied', 'Team management only.');
    await seed();
    const now = Date.now();

    if (action === 'create') {
      const r = cleanEvent(req.data, { me, now });
      if (r.error) return note(r.error);
      const open = (await events().get()).docs.filter((d) => ['upcoming', 'live'].includes(statusOf(d.data(), now))).length;
      if (open >= MAX_OPEN_EVENTS) return note('That’s a lot of events.', `End one before starting another (${MAX_OPEN_EVENTS} at a time).`);
      const ref = events().doc();
      await ref.set(r.event);
      await settle(ref.id, { force: true });
      return { ok: true, id: ref.id };
    }

    const id = String(req.data?.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) return note('Which event?');
    const ref = events().doc(id);
    const r = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const ev = snap.data();
      if (!ev) return note('That event is gone.');
      if (action === 'end') {
        if (statusOf(ev, now) === 'ended') return note('Already ended.');
        tx.update(ref, { status: 'ended', endedAt: now, endedBy: me });
        return { ok: true };
      }
      const c = cleanEvent(req.data, { me, now, existing: ev });
      if (c.error) return note(c.error);
      // Keep the progress and the tiers reached; the rest comes from the form.
      tx.set(ref, { ...c.event, ...(ev.progress && { progress: ev.progress }), ...(ev.reached && { reached: ev.reached }) });
      return { ok: true };
    });
    if (r.ok) await settle(id, { force: true });
    return r.ok ? { ok: true, id } : r;
  });

  const petEventTick = onSchedule({ schedule: 'every 15 minutes', timeZone }, async () => {
    await refreshAll({ force: true });
  });

  return { petEvent, petEventTick };
}
