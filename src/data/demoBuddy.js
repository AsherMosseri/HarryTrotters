// Gambling buddy in demo mode: the same decisions as functions/buddy.js
// (functions/shared/buddy.js), on the demo's own data. The password is kept
// as a salted PBKDF2 hash (the server uses scrypt), never as typed, and the
// wrong tries count the same way (5 an hour). The demo's devices share one
// browser, so ?demo=member (Cooper) can ask ?demo=manager (Sebastian) and
// each answers from their own tab.
import { buddyAction, lockId, roleOf, triesState } from '../../functions/shared/buddy.js';
import { REQUESTS_TO } from '../config.js';

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hashOf(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}

export function demoBuddy({ get, commit, uid }) {
  const S = () => get();
  const locks = () => S().buddyLocks || {};
  const secrets = () => S().buddySecrets || {};
  // For play: the lock that's on for this person, or null.
  const lockFor = (name) => {
    const l = locks()[lockId(name)];
    return l?.state === 'on' ? l : null;
  };
  const visible = (actor) => {
    const owner = !!actor.admin && actor.name === REQUESTS_TO;
    return Object.values(locks()).filter((l) => owner || l.person === actor.name || l.buddy === actor.name);
  };

  async function call(req = {}, actor, { roster = [] } = {}) {
    const me = actor.name;
    const now = Date.now();
    const action = String(req.action || '');
    const person = req.person ? String(req.person) : me;
    const id = lockId(person);
    const lock = locks()[id] || null;
    const secret = secrets()[id] || null;
    const note = (title, body = '') => ({ note: { title, body } });
    if (action !== 'clear' && action !== 'ask' && !roleOf(lock, me)) return note('That isn’t your gambling buddy lock.');
    if (action === 'ask' && person !== me) return note('Ask for yourself.');
    const password = typeof req.password === 'string' ? req.password : '';
    let check = 'none';
    const tries = secret?.tries || [];
    if (action === 'unlock' && password && lock?.state === 'on') {
      const t = triesState(tries, now);
      check = t.blocked ? 'limited' : secret && (await hashOf(password, secret.salt)) === secret.hash ? 'right' : 'wrong';
    }
    const isOwner = !!actor.admin && me === REQUESTS_TO;
    const r = buddyAction(lock, { action, buddy: req.buddy, password }, { me, isOwner, owner: REQUESTS_TO, roster, now, rename: (n) => n, check, tries });
    if (r.error) {
      if (r.secret === 'wrong' && secret) {
        S().buddySecrets = { ...secrets(), [id]: { ...secret, tries: [...triesState(tries, now).recent, now] } };
        commit();
      }
      return note(r.error, r.body || '');
    }
    const nextLocks = { ...locks() };
    if (r.lock) nextLocks[id] = { id, ...r.lock };
    else delete nextLocks[id];
    const nextSecrets = { ...secrets() };
    if (r.secret === 'set') {
      const salt = uid() + uid();
      nextSecrets[id] = { salt, hash: await hashOf(password, salt), tries: [], setAt: now };
    } else if (r.secret === 'drop') delete nextSecrets[id];
    else if (r.secret === 'reset' && secret) nextSecrets[id] = { ...secret, tries: [] };
    S().buddyLocks = nextLocks;
    S().buddySecrets = nextSecrets;
    S().inbox = [
      ...r.tell.map((t) => ({ id: uid(), type: 'buddy', title: t.title, body: t.body, open: t.open, at: now, read: false, to: t.to, by: me })),
      ...(S().inbox || []),
    ];
    commit();
    return { ok: true, done: r.done, lock: r.lock };
  }

  return { call, lockFor, visible };
}
