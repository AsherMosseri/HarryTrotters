// Gambling buddy in the app (3.2). The rules are in functions/shared/buddy.js
// (the server and demo mode run them); this keeps this device's own lock where
// the chat's casino cards and the commands can see it without passing it down
// through every component. Workspace sets it from the buddyLocks it watches.
import { useSyncExternalStore } from 'react';
import { LOCKED_GAMES, buddyBlocks, lockNote } from '../functions/shared/buddy.js';

export { LOCKED_GAMES, lockNote };

let current = null; // my lock while it's on, else null
const listeners = new Set();
export const getBuddyLock = () => current;
export function setBuddyLock(lock) {
  const next = lock?.state === 'on' ? lock : null;
  const key = (l) => (l ? `${l.buddy}|${l.since || 0}` : '');
  if (key(next) === key(current)) return;
  current = next;
  listeners.forEach((f) => f());
}
const subscribe = (f) => (listeners.add(f), () => listeners.delete(f));
// The lock that's on for me (re-renders when it changes), or null.
export const useBuddyLock = () => useSyncExternalStore(subscribe, getBuddyLock, getBuddyLock);

// A casino command while locked: the note to show instead of asking the
// server (which refuses it too). null when it's fine.
export function buddyCommandNote(name, args = []) {
  return current && buddyBlocks({ action: 'run', game: name, args }) ? lockNote(current) : null;
}

// The locks this person is in: { mine (my own lock, any state), asBuddy
// (people whose buddy I am), waiting (their requests to me), others (every
// other lock, for the owner) }.
export function buddyView(locks = [], me, rename = (n) => n) {
  const mine = locks.find((l) => rename(l.person) === me) || null;
  const asBuddy = locks.filter((l) => rename(l.buddy) === me);
  return {
    mine,
    asBuddy,
    waiting: asBuddy.filter((l) => l.state === 'asked'),
    others: locks.filter((l) => l !== mine && !asBuddy.includes(l)),
  };
}
