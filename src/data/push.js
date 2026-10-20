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

export function pushSupport() {
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (ok) return 'ok';
  return isIOS() && !isStandalone() ? 'home-screen' : 'unsupported';
}
