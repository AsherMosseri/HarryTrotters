// Gambling buddy on the server (3.2). The decisions are in shared/buddy.js
// (demo mode runs the same file); this keeps the password and the lock.
//
// Callable:
//   buddy({ action, buddy?, person?, password? })
//     ask      the person picks a buddy ({ buddy })
//     cancel   the person takes back a request, or removes a buddy whose lock is off
//     decline  the buddy says no
//     accept   the buddy sets the password ({ person, password }): locked
//     unlock   the buddy (no password needed), or the person with the
//              buddy's password ({ person?, password })
//     lock     the person locks it again (the same password still unlocks it)
//     leave    the buddy steps down (unlocks it too)
//     clear    the owner turns a lock off ({ person }); an owner tool
// lockOf(name): the lock that's on for this person, or null (play checks it).
//
// The password is hashed here (scrypt with its own random salt) into
// buddySecrets, which the rules let nobody read or write; buddyLocks is
// readable by the person, the buddy and the owner, and written only here.
// Wrong passwords are counted on the secret, at most BUDDY.tries an hour,
// inside a transaction so two phones can't race past the limit.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { BUDDY, buddyAction, lockId, roleOf, triesState } from './shared/buddy.js';
import { cleanName, memberOk } from './shared/team.js';

const OPEN_FN = { maxInstances: 5, invoker: 'public' };
const hashOf = (password, salt) => scryptSync(String(password), salt, 64).toString('hex');
function sameHash(password, secret) {
  if (!secret?.salt || !secret?.hash) return false;
  const given = Buffer.from(hashOf(password, secret.salt), 'hex');
  const right = Buffer.from(secret.hash, 'hex');
  return given.length === right.length && timingSafeEqual(given, right);
}

export function buddyFunctions({ db, coinData, notify, owner }) {
  const lockRef = (name) => db.doc(`buddyLocks/${lockId(name)}`);
  const secretRef = (name) => db.doc(`buddySecrets/${lockId(name)}`);
  const tell = (list) => (list.length ? notify(list).catch((e) => logger.warn('buddy notify', e.message)) : null);

  // The person's lock doc, under their current name or an old one.
  async function findLock(name, rename, tx = null) {
    const ids = [...new Set(rename.aliases(name).slice(0, 10).map(lockId))].filter(Boolean);
    const snaps = tx ? await tx.getAll(...ids.map((id) => db.doc(`buddyLocks/${id}`))) : await db.getAll(...ids.map((id) => db.doc(`buddyLocks/${id}`)));
    return snaps.find((s) => s.exists) || null;
  }

  // For play: null, or the lock that's on.
  async function lockOf(name) {
    const data = await coinData();
    const snap = await findLock(data.rename(name), data.rename);
    const lock = snap?.data();
    return lock?.state === 'on' ? lock : null;
  }

  const buddy = onCall(OPEN_FN, async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    const rename = data.rename;
    const me = rename(member.get('name'));
    const boss = rename(owner);
    const isOwner = member.get('admin') === true && me === boss;
    const body = req.data && typeof req.data === 'object' ? req.data : {};
    const action = String(body.action || '');
    const password = typeof body.password === 'string' ? body.password.slice(0, BUDDY.max + 1) : '';
    // Whose lock: your own (ask, cancel, lock, unlock as the person), or the
    // person you're the buddy of (accept, decline, unlock, leave), or anyone's
    // for the owner (clear).
    const person = body.person ? rename(cleanName(String(body.person))) : me;
    const roster =
      action === 'ask' ? (await db.collection('people').get()).docs.map((d) => rename(d.get('name') || '')).filter(Boolean) : [];
    const now = Date.now();

    const res = await db.runTransaction(async (tx) => {
      const snap = await findLock(person, rename, tx);
      const lock = snap?.data() || null;
      // The doc and secret live under the id they were made with.
      const id = snap ? snap.id : lockId(person);
      const lRef = db.doc(`buddyLocks/${id}`);
      const sRef = db.doc(`buddySecrets/${id}`);
      const secretSnap = await tx.get(sRef);
      const secret = secretSnap.data() || null;
      // Asking someone (or the owner clearing) works on your own / any lock;
      // everything else only on a lock you're in.
      if (action !== 'clear' && action !== 'ask' && !roleOf(lock, me, rename)) return { note: { title: 'That isn’t your gambling buddy lock.', body: '' } };
      if (action === 'ask' && person !== me) return { note: { title: 'Ask for yourself.', body: '' } };
      let check = 'none';
      const tries = secret?.tries || [];
      if (action === 'unlock' && password && lock?.state === 'on') {
        const t = triesState(tries, now);
        check = t.blocked ? 'limited' : sameHash(password, secret) ? 'right' : 'wrong';
      }
      const r = buddyAction(lock, { action, buddy: body.buddy, password }, { me, isOwner, owner: boss, roster, now, rename, check, tries });
      if (r.error) {
        if (r.secret === 'wrong' && secret) tx.update(sRef, { tries: [...triesState(tries, now).recent, now] });
        return { note: { title: r.error, body: r.body || '' } };
      }
      if (r.lock) tx.set(lRef, r.lock);
      else if (snap) tx.delete(lRef);
      if (r.secret === 'set') {
        const salt = randomBytes(16).toString('hex');
        tx.set(sRef, { salt, hash: hashOf(password, salt), tries: [], setAt: now });
      } else if (r.secret === 'drop' && secret) tx.delete(sRef);
      else if (r.secret === 'reset' && secret) tx.update(sRef, { tries: [] });
      return { ok: true, done: r.done, lock: r.lock, tell: r.tell };
    });
    if (res.tell) await tell(res.tell.map((t) => ({ ...t, type: 'buddy', by: me })));
    const { tell: _t, ...out } = res;
    return out;
  });

  return { buddy, lockOf };
}
