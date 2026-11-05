// Gambling buddy (3.2): someone asks a teammate to be their gambling buddy.
// The buddy sets a password on their own device, and from then on the
// person's casino games are locked (the server refuses them) until the buddy
// unlocks it: with the password (typed on either person's phone) or just
// from their own app, since they're signed in. The person can't take the
// lock or the buddy off by themselves; the owner can always clear a lock.
//
// No Firebase here: functions/buddy.js (the `buddy` callable) and demo mode
// (src/data/demoStore.js) both run buddyAction, so the two decide the same.
// The password itself is checked by the caller (a salted scrypt hash on the
// server, never readable by phones) and handed in as `check`.
//
// The lock doc (buddyLocks/{nameKey(person)}), readable by the person, the
// buddy and the owner, written only by the server:
//   { person, buddy, state: 'asked' | 'on' | 'off', askedAt, since?,
//     unlockedAt?, unlockedBy?, updatedAt }
//   asked: waiting for the buddy to set a password (nothing is locked yet)
//   on:    casino games are locked
//   off:   unlocked by the buddy; the buddy and password stay, so the person
//          can lock it again in one tap (or remove the buddy)
// The secret (buddySecrets/{same id}, nobody reads it): { salt, hash, tries }.

import { CASINO } from './casino.js';
import { BOT } from './groups.js';
import { cleanName, nameKey } from './team.js';

export const BUDDY = {
  min: 4, // password length
  max: 64,
  tries: 5, // wrong passwords allowed per lock in a rolling hour
  window: 3600000,
};
// The games a buddy lock stops: the casino and the lottery. Arcade games
// (challenges, heists, races), gifts, loans and requests still work.
export const LOCKED_GAMES = CASINO;
export const lockId = (name) => nameKey(name);
const first = (n) => String(n || 'Someone').split(' ')[0];

// Does this play request start (or add to) a casino bet? A new casino
// command, a lottery ticket, or doubling down in blackjack. Finishing a game
// that's already going (hit, stand, cash out) is fine: its bet is in.
export function buddyBlocks({ action, game, move } = {}) {
  if (action === 'move') return String(move) === 'double';
  if (action === 'gift' || action === 'prize') return false;
  return LOCKED_GAMES.includes(game);
}

// The note a locked person sees, on the server's answer and in the app.
export function lockNote(lock) {
  return {
    title: '🔒 Gambling is locked by your buddy',
    body: `${first(lock?.buddy)} is your gambling buddy, so casino games are paused until they unlock them. Arcade games, gifts and loans still work.`,
  };
}

// Wrong passwords in the last hour: { recent, left, blocked, retryAt }.
export function triesState(tries = [], now = Date.now()) {
  const recent = (Array.isArray(tries) ? tries : []).filter((t) => typeof t === 'number' && t > now - BUDDY.window).sort((a, b) => a - b);
  const blocked = recent.length >= BUDDY.tries;
  return { recent, left: Math.max(0, BUDDY.tries - recent.length), blocked, retryAt: blocked ? recent[recent.length - BUDDY.tries] + BUDDY.window : 0 };
}
const minutesTo = (at, now) => Math.max(1, Math.ceil((at - now) / 60000));

// Who the caller is to this lock: 'person', 'buddy' or ''.
export function roleOf(lock, me, rename = (n) => n) {
  if (!lock || !me) return '';
  if (rename(lock.person) === me) return 'person';
  if (rename(lock.buddy) === me) return 'buddy';
  return '';
}
export const isLocked = (lock) => lock?.state === 'on';
export const passwordProblem = (pw) => {
  const p = String(pw ?? '');
  if (p.length < BUDDY.min) return `Use at least ${BUDDY.min} characters.`;
  if (p.length > BUDDY.max) return `Use at most ${BUDDY.max} characters.`;
  return '';
};

// One request to the buddy callable.
// lock: the lock doc now (or null). req: { action, buddy?, password? }.
// ctx: { me, isOwner, owner, roster, now, rename, check, tries }. check is
// what the caller found for req.password: 'right', 'wrong', 'limited' (too
// many tries; not checked) or 'none' (no password sent). Only for an unlock
// by the person or the buddy (roleOf), on a lock that's on. tries: the
// secret's wrong tries before this one (triesState).
// Returns { error, body? } or { lock: the next doc (null: deleted),
// secret: 'keep' | 'set' | 'drop' | 'wrong' | 'reset', tell: [{ to, title,
// body }], done: what to say }.
export function buddyAction(lock, req = {}, ctx = {}) {
  const { me, isOwner = false, owner = '', roster = [], now = Date.now(), rename = (n) => n, check = 'none', tries = [] } = ctx;
  const action = String(req.action || '');
  const role = roleOf(lock, me, rename);
  const buddy = lock ? rename(lock.buddy) : '';
  const person = lock ? rename(lock.person) : '';
  const ownerFirst = first(owner);
  const err = (error, body = '') => ({ error, ...(body && { body }) });
  const out = (next, secret, tell, done) => ({ lock: next, secret, tell: tell.filter((t) => t.to && t.to !== me), done });
  const open = 'coins:stats';

  if (action === 'ask') {
    const want = rename(cleanName(req.buddy));
    if (!want || !roster.includes(want) || want === BOT) return err('Pick a teammate.');
    if (want === me) return err('Your buddy has to be someone else.', 'Pick a teammate you trust.');
    if (lock && role === 'person' && lock.state === 'on') return err('Your casino games are already locked.', `${first(buddy)} can unlock them.`);
    if (lock && role === 'person' && lock.state === 'asked' && buddy === want) return out(lock, 'keep', [], `Still waiting for ${first(want)}.`);
    const next = { person: me, buddy: want, state: 'asked', askedAt: now, updatedAt: now };
    const tell = [
      { to: want, title: `${first(me)} asked you to be their gambling buddy`, body: 'Set a password to lock their casino games. Only you will know it.', open },
      ...(lock && buddy && buddy !== want ? [{ to: buddy, title: `${first(me)} picked a different gambling buddy`, body: 'Thanks for helping out.', open }] : []),
    ];
    return out(next, 'drop', tell, `Asked ${first(want)}. Casino games lock once they set a password.`);
  }

  if (action === 'clear') {
    if (!isOwner) return err('Only the owner can do that.');
    if (!lock) return out(null, 'drop', [], 'There’s no lock there.');
    return out(
      null,
      'drop',
      [
        { to: person, title: `${ownerFirst} turned off your gambling lock`, body: 'Casino games are open again.', open },
        { to: buddy, title: `${ownerFirst} turned off ${first(person)}’s gambling lock`, body: 'You’re no longer their gambling buddy.', open },
      ],
      `Cleared ${first(person)}’s lock.`,
    );
  }

  if (!lock || !role) return err('That isn’t your gambling buddy lock.');

  if (action === 'cancel' || action === 'remove') {
    if (role !== 'person') return err('That isn’t yours to remove.');
    if (lock.state === 'on')
      return err(`Only ${first(buddy)} can unlock it.`, `They can unlock it from their app, or type their password here. ${ownerFirst} can help too.`);
    const tell = [{ to: buddy, title: lock.state === 'asked' ? `${first(me)} took back their buddy request` : `${first(me)} removed you as their gambling buddy`, body: 'Nothing for you to do.', open }];
    return out(null, 'drop', tell, lock.state === 'asked' ? 'Request taken back.' : `${first(buddy)} is no longer your gambling buddy.`);
  }

  if (action === 'decline') {
    if (role !== 'buddy' || lock.state !== 'asked') return err('There’s nothing to say no to.');
    return out(null, 'drop', [{ to: person, title: `${first(me)} can’t be your gambling buddy right now`, body: 'You can ask someone else from the coins screen.', open }], 'Said no. No hard feelings.');
  }

  if (action === 'accept') {
    if (role !== 'buddy') return err('Only the buddy sets the password.');
    if (lock.state !== 'asked') return err(lock.state === 'on' ? 'It’s already locked.' : 'There’s no request waiting.');
    const bad = passwordProblem(req.password);
    if (bad) return err(bad);
    const next = { ...lock, person, buddy, state: 'on', since: now, updatedAt: now };
    return out(
      next,
      'set',
      [{ to: person, title: `${first(me)} is your gambling buddy now`, body: 'Casino games are locked until they unlock them. Arcade games, gifts and loans still work.', open }],
      `You’re ${first(person)}’s gambling buddy. Their casino games are locked.`,
    );
  }

  if (action === 'unlock') {
    if (lock.state !== 'on') return out(lock, 'keep', [], 'It’s already unlocked.');
    // The buddy is signed in: no password needed. Anyone else types it.
    if (!(role === 'buddy' && check === 'none')) {
      const t = triesState(tries, now);
      if (check === 'limited' || t.blocked)
        return err('Too many wrong tries.', `Try again in ${minutesTo(t.retryAt, now)} min, or ${first(buddy)} can unlock it from their own app.`);
      if (check === 'none') return err(`Type ${first(buddy)}’s password.`, 'Or ask them to unlock it from their app.');
      if (check === 'wrong') {
        const left = t.left - 1;
        return {
          error: 'That password isn’t right.',
          body: left > 0 ? `${left} ${left === 1 ? 'try' : 'tries'} left this hour.` : `That was the last try for now. ${first(buddy)} can still unlock it from their app.`,
          secret: 'wrong',
        };
      }
      if (check !== 'right') return err('That password isn’t right.');
    }
    const next = { ...lock, person, buddy, state: 'off', unlockedAt: now, unlockedBy: me, updatedAt: now };
    const tell =
      role === 'buddy'
        ? [{ to: person, title: `${first(me)} unlocked your casino games`, body: 'You can lock them again any time from the coins screen.', open }]
        : [{ to: buddy, title: `${first(me)} unlocked their casino games with your password`, body: 'You can still unlock or step down from the coins screen.', open }];
    return out(next, 'reset', tell, role === 'buddy' ? `Unlocked ${first(person)}’s casino games.` : 'Unlocked. Have fun, and go easy.');
  }

  if (action === 'lock') {
    if (role !== 'person') return err('Only they can lock it again.');
    if (lock.state === 'on') return out(lock, 'keep', [], 'It’s already locked.');
    if (lock.state !== 'off') return err(`Waiting for ${first(buddy)} to set a password.`);
    const next = { ...lock, person, buddy, state: 'on', since: now, updatedAt: now };
    return out(next, 'keep', [{ to: buddy, title: `${first(me)} locked their casino games again`, body: 'Your password still unlocks them.', open, quiet: true }], 'Locked again.');
  }

  if (action === 'leave') {
    if (role !== 'buddy') return err('Only the buddy can step down.');
    return out(null, 'drop', [{ to: person, title: `${first(me)} stepped down as your gambling buddy`, body: lock.state === 'on' ? 'Your casino games are unlocked.' : 'You can ask someone else from the coins screen.', open }], `You’re no longer ${first(person)}’s gambling buddy.`);
  }

  return err('Unknown action.');
}
