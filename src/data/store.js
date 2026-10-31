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
    if (isDemo) return (await import('./demoStore.js')).demoStore;
    return (await import('./firebaseStore.js')).firebaseStore;
  } catch (e) {
    if (reloadOnceForNewVersion()) return new Promise(() => {});
    throw e;
  }
}
