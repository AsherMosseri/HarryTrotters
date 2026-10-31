import { useSyncExternalStore } from 'react';

// Can the app reach the server right now? Two signals: the browser's own
// online/offline events (instant), and Firestore's word on whether its live
// listener is talking to the server (firebaseStore feeds it through
// setServerReachable), which also catches Wi-Fi that's connected but dead.
// Demo mode never feeds either one, so it always reads as online.
const BACK_SHOWN = 4000;

let browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
let serverReachable = true;
let online = browserOnline;
// 'online', 'offline', or 'back' (the few seconds after the connection returns).
let status = online ? 'online' : 'offline';
let backTimer = null;
const subs = new Set();

function update() {
  const next = browserOnline && serverReachable;
  if (next === online) return;
  online = next;
  clearTimeout(backTimer);
  if (online) {
    // Only say "Back online" if the app was actually offline for a moment.
    status = 'back';
    backTimer = setTimeout(() => {
      status = 'online';
      subs.forEach((f) => f());
    }, BACK_SHOWN);
  } else {
    status = 'offline';
  }
  subs.forEach((f) => f());
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    browserOnline = true;
    update();
  });
  window.addEventListener('offline', () => {
    browserOnline = false;
    update();
  });
}

// firebaseStore: whether the live listener is reaching the server.
export function setServerReachable(ok) {
  serverReachable = ok;
  update();
}

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

export const NEEDS_INTERNET = 'Needs internet. Try again when you’re back online.';
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
    ? { title: 'Needs internet', body: 'This works again once you’re back online.' }
    : { title, body: e?.message || String(e) };
