// Can this browser get phone notifications? iPhones and iPads only allow them
// for the site added to the Home Screen (iOS 16.4 or later).
// iPads report themselves as a Mac; a touch screen gives them away.
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  ((/Macintosh/.test(navigator.userAgent) || navigator.platform === 'MacIntel') && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// iPhone/iPad visitors must use the Home Screen app (the only way notifications
// work there). In-app browsers (Gmail, Google, Instagram…) can't add it at all.
export function installNeeded() {
  if (!isIOS() || isStandalone()) return null;
  const ua = navigator.userAgent;
  const device = /iPhone|iPod/.test(ua) ? 'iPhone' : 'iPad';
  if (/GSA\/|FBAN|FBAV|Instagram|Snapchat|LinkedInApp|Line\//.test(ua)) return { device, browser: 'in-app' };
  if (/CriOS/.test(ua)) return { device, browser: 'chrome' };
  if (/FxiOS|EdgiOS/.test(ua)) return { device, browser: 'other' };
  return { device, browser: 'safari' };
}

// 3.0's new icon only shows on a newly added Home Screen app: iOS never
// updates the icon of one already there. The new app opens at ?home=3 (the
// Safari page and the manifest both point there, and it stays in the address),
// and it remembers that; an app added before 3.0 opens without it, so it's
// sent to add the new one and delete itself.
const HOME_KEY = 'home-app-3';
export function oldHomeApp() {
  if (!isIOS() || !isStandalone()) return false;
  try {
    if (new URL(location.href).searchParams.get('home') === '3') {
      localStorage.setItem(HOME_KEY, '1');
      return false;
    }
    return localStorage.getItem(HOME_KEY) !== '1';
  } catch {
    return false;
  }
}
// The Safari page's address, as it should be added to the Home Screen.
export function homeAppUrl(extra = {}) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('home', '3');
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return url.toString();
}

export function pushSupport() {
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (ok) return 'ok';
  return isIOS() && !isStandalone() ? 'home-screen' : 'unsupported';
}
