import { isDemo } from './data/store.js';

// The offline copy of the app (public/sw.js). Registered once the page has
// loaded, so saving the app never competes with opening it. Only in the
// built app (the dev server has no copy), and not in demo mode.
export const swOptions = { scope: './', updateViaCache: 'none' };

async function killed() {
  try {
    const res = await fetch('offline.json', { cache: 'no-store' });
    return res.ok && (await res.json()).enabled === false;
  } catch {
    return false;
  }
}

async function start() {
  try {
    const sw = navigator.serviceWorker;
    // Kill switch (docs/3.0-launch.md): don't register; a worker that's
    // already here is asked to check and clear itself.
    if (await killed()) {
      (await sw.getRegistration())?.active?.postMessage({ type: 'check' });
      return;
    }
    const reg = await sw.register('./sw.js', swOptions);
    // If saving the app didn't finish last time (bad Wi-Fi), try again.
    const ready = await sw.ready;
    ready.active?.postMessage({ type: 'ensure' });
    return reg;
  } catch (e) {
    console.warn('offline copy', e);
  }
}

export function registerOffline() {
  if (!import.meta.env.PROD || isDemo || !('serviceWorker' in navigator)) return;
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// A newer version is out: have the worker look for it and save it now, so it's
// ready by the time someone taps Update.
export function checkWorkerNow() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => reg?.update())
    .catch(() => {});
}
