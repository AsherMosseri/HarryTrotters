import { useSyncExternalStore } from 'react';

// The same test as data/store.js isDemo (that file imports this one).
const isDemo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

// Can the app reach the server right now? Two signals: the browser's own
// online/offline events (instant), and Firestore's word on whether its live
// listener is talking to the server (firebaseStore feeds it through
// setServerReachable), which also catches Wi-Fi that's connected but dead.
// Demo mode never feeds either one; it pretends to be offline with
// ?demo&offline or the switch on the demo banner (simulateOffline).
const BACK_SHOWN = 4000;

let realOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
let simulated = isDemo && new URLSearchParams(location.search).has('offline');
let browserOnline = realOnline && !simulated;
let serverReachable = true;
let online = browserOnline;
// 'online', 'offline', or 'back' (the few seconds after the connection returns).
let status = online ? 'online' : 'offline';
let backTimer = null;
const subs = new Set();
let snap = null;
const notify = () => {
  snap = null;
  subs.forEach((f) => f());
};

function update() {
  const wasBrowser = browserOnline;
  browserOnline = realOnline && !simulated;
  const next = browserOnline && serverReachable;
  if (next === online) {
    if (browserOnline !== wasBrowser) notify();
    return;
  }
  online = next;
  clearTimeout(backTimer);
  if (online) {
    // Only say "Back online" if the app was actually offline for a moment.
    status = 'back';
    holdBack();
  } else {
    status = 'offline';
    sentSome = count > 0;
  }
  notify();
}

// "Back online" stays while changes are still sending, then a few seconds
// more ("sent").
function holdBack() {
  clearTimeout(backTimer);
  backTimer = setTimeout(() => {
    if (count > 0) return;
    status = 'online';
    sentSome = false;
    notify();
  }, BACK_SHOWN);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    realOnline = true;
    update();
  });
  window.addEventListener('offline', () => {
    realOnline = false;
    update();
  });
}

// firebaseStore: whether the live listener is reaching the server.
export function setServerReachable(ok) {
  serverReachable = ok;
  update();
}

// Demo mode only: pretend there's no connection (or stop pretending).
export function simulateOffline(on) {
  simulated = !!on;
  update();
}
export const isSimulatedOffline = () => simulated;

export const isOnline = () => online;
// Only what the browser itself says: enough to refuse a call that can't go out,
// without blocking one on a wrong guess about the server.
export const browserIsOnline = () => browserOnline;
const subscribe = (f) => {
  subs.add(f);
  return () => subs.delete(f);
};
// 'online' | 'offline' | 'back'
export const useConnection = () => useSyncExternalStore(subscribe, () => status);
// For the buttons of things that need the server (coins, games, buying): true
// when they can't work right now, on the browser's own word, the same test
// the server calls themselves use (firebaseStore callable).
export const useNeedsConnection = () => useSyncExternalStore(subscribe, () => !browserOnline);

// ---------- Changes waiting to send ----------
// Every change the app makes to the team's data (firebaseStore's setDoc,
// updateDoc, deleteDoc and batches) is counted from the moment it's made
// until the server confirms it or turns it down: Firestore's own promise for
// the write, which only settles once the server answers. The count is kept
// in localStorage, so every tab shows the same number and it's still there
// when the app is closed and opened again offline; changes left from an
// earlier visit are counted until Firestore says all it had waiting has gone
// (settleLeftover). Background bookkeeping (who's online, what you've read)
// isn't counted.
const UNSENT_KEY = isDemo ? 'offline-unsent-demo' : 'offline-unsent';
let memoryCount = 0; // when localStorage isn't available
function readUnsent() {
  try {
    const n = Number(localStorage.getItem(UNSENT_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return memoryCount;
  }
}
let count = readUnsent();
let leftover = count;
// Some changes waited while offline (for "Back online · sent").
let sentSome = count > 0;
function adjust(d) {
  const next = Math.max(0, readUnsent() + d);
  memoryCount = next;
  try {
    if (next) localStorage.setItem(UNSENT_KEY, String(next));
    else localStorage.removeItem(UNSENT_KEY);
  } catch {
    /* private mode: memoryCount */
  }
  changed(next);
}
function changed(next) {
  if (next === count) return;
  if (next > 0 && status !== 'online') sentSome = true;
  count = next;
  // The last one went while "Back online" showed: keep it up a little longer.
  if (!count && status === 'back') holdBack();
  notify();
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === UNSENT_KEY || e.key === null) changed(readUnsent());
  });

// A change was made: counted until its promise settles (sent, or turned down).
export function trackWrite(p) {
  adjust(1);
  const done = () => adjust(-1);
  p.then(done, done);
  return p;
}
// Changes from an earlier visit: done once `drained` settles.
export function settleLeftover(drained) {
  if (!leftover) return;
  const n = leftover;
  leftover = 0;
  const done = () => adjust(-n);
  drained.then(done, done);
}

// { status, pending, sent }: pending = changes waiting to send; sent = some
// waited and have gone since (for "Back online · sent").
export const pendingCount = () => count;
export const useSync = () => useSyncExternalStore(subscribe, () => (snap ||= { status, pending: count, sent: sentSome }));

// What the offline strip says, as [what, more] (more can be ''), or null
// when there's nothing to say. syncText: the two in one line.
export function syncParts({ status: s, pending, sent }) {
  const changes = `${pending} change${pending === 1 ? '' : 's'}`;
  if (s === 'offline') return ['Offline', pending ? `${changes} waiting to send` : 'changes send when you’re back'];
  if (s === 'back') return ['Back online', pending ? `sending ${changes}…` : sent ? 'sent' : ''];
  return null;
}
export const syncText = (sync) => syncParts(sync)?.filter(Boolean).join(' · ') || '';

// Server calls (coins, games, buying, uploads) can't wait offline: they say so.
export const NEEDS_CONNECTION = 'Needs a connection';
export const NEEDS_INTERNET = 'Needs a connection. Try again when you’re back online.';
// An error the app throws when something needs the server and it can't be reached.
export function needsInternet(message = NEEDS_INTERNET, code = 'offline') {
  return Object.assign(new Error(message), { code });
}

// Errors that just mean "no connection" (browser fetch, Firebase auth,
// callable functions, Firestore reads of what isn't cached).
const NETWORK_CODES = new Set([
  'auth/network-request-failed',
  'functions/unavailable',
  'functions/deadline-exceeded',
  'unavailable',
  'storage/retry-limit-exceeded',
]);
export const isNetworkError = (e) =>
  !!e && (e.code === 'offline' || NETWORK_CODES.has(e.code) || (!online && /offline|network|fetch/i.test(String(e.message || ''))));

// For the screens that turn an error into a note ({ title, body }).
export const noteFor = (e, title) =>
  e?.code === 'offline'
    ? { title: NEEDS_CONNECTION, body: 'This works again once you’re back online.' }
    : { title, body: e?.message || String(e) };
