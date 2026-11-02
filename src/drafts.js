// Unsent messages, one per channel or DM, on this device. They live here (and
// in localStorage) rather than in the box itself, so they survive switching
// channels, leaving Chat for another page and coming back, and closing the
// app. The sidebar uses useDraftKeys to show a pencil on each one.
import { useMemo, useSyncExternalStore } from 'react';

const KEY = 'chat-drafts';
let cache = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    cache = {};
  }
  return cache;
}

export const getDraft = (conv) => load()[conv] || '';

export function setDraft(conv, text) {
  const all = load();
  const had = conv in all;
  if (String(text || '').trim()) all[conv] = text;
  else delete all[conv];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: it still lives for this session */
  }
  if (had !== conv in all) emit();
}

// A change made in another tab or window of the app.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    cache = null;
    emit();
  });

const subscribe = (f) => {
  subs.add(f);
  return () => subs.delete(f);
};
const snapshot = () => Object.keys(load()).sort().join('\n');

// Which conversations have an unsent draft.
export function useDraftKeys() {
  const s = useSyncExternalStore(subscribe, snapshot, () => '');
  return useMemo(() => new Set(s ? s.split('\n') : []), [s]);
}
