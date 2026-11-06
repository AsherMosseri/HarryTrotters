import { browserIsOnline, needsInternet, settleLeftover, trackWrite } from '../connection.js';
import { offlineStore } from './needsServer.js';

// Picks the backend: ?demo in the URL runs fully offline with sample data.
export const isDemo = new URLSearchParams(location.search).has('demo');

// After a new deploy, a page loaded earlier can ask for code files that no
// longer exist. Reload once to pick up the new version instead of failing.
export function reloadOnceForNewVersion() {
  const key = 'reloaded-for-new-version';
  // Offline (the pits' Wi-Fi dropped), a file fails because there's no
  // network, not because there's a new version; reloading would leave a blank
  // page instead of the app that was working.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    if (Date.now() - Number(sessionStorage.getItem(key) || 0) < 60000) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return false;
  }
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString(36));
  location.replace(url.toString());
  return true;
}

export async function loadStore() {
  try {
    if (isDemo) return demoOffline((await import('./demoStore.js')).demoStore);
    return (await import('./firebaseStore.js')).firebaseStore;
  } catch (e) {
    if (reloadOnceForNewVersion()) return new Promise(() => {});
    throw e;
  }
}

// Demo mode behaves like the real app with no connection while it pretends to
// be offline (?demo&offline, or the switch on the demo banner): see
// needsServer.js. Changes "send" a moment after it's back.
function demoOffline(store) {
  let back = null;
  const whenOnline = () =>
    (back ||= new Promise((resolve) => {
      const wait = setInterval(() => {
        if (!browserIsOnline()) return;
        clearInterval(wait);
        back = null;
        setTimeout(resolve, 900);
      }, 200);
    }));
  // Anything left from a visit that closed "offline" sends once it's online.
  settleLeftover(whenOnline());
  return offlineStore(store, { online: browserIsOnline, refusal: () => needsInternet(), track: trackWrite, whenOnline });
}
