// The app's service worker: phone notifications (pushes come from the Cloud
// Functions in functions/) and the offline copy of the app.
//
// The offline copy: when this worker installs it saves every file of this
// build (vite.config.js fills in MANIFEST and BUILD at build time), so after
// one online visit the app opens with no internet. Rules, so nobody is ever
// stuck on an old version:
// - The page itself (index.html) goes to the network first, and only falls
//   back to the saved copy when there's no connection (or it's very slow).
// - Code and pictures have hashed names, so they come from the saved copy.
// - version.json, offline.json and this file are never served from a copy.
// - Each build saves into its own cache; the old ones are deleted when a new
//   worker takes over.
// - Kill switch: if offline.json says { "enabled": false } this worker clears
//   its caches and stops (see docs/3.0-launch.md, "Offline copy").
// Only the app's own files are touched. Firebase (sign-in, accounts, data,
// functions, pictures) is on other domains and never goes through here.
//
// Served from the root on the team's app and from /next/ for the redesign
// test copy; everything is relative to where this worker lives (its scope).

// Filled in by the build. In `vite dev` they stay empty: the worker only
// handles notifications and caches nothing.
const BUILD = /*__BUILD__*/ '';
const MANIFEST = /*__MANIFEST__*/ [];

const SCOPE = self.registration.scope; // https://host/path/
const SCOPE_PATH = new URL(SCOPE).pathname;
const PREFIX = `ftc-${SCOPE_PATH}|`;
const CACHE = PREFIX + BUILD;
const FONTS = `ftc-fonts|${SCOPE_PATH}`;
// The redesign's own worker (…/next/) is the one for pages under it.
const NESTED = SCOPE_PATH + 'next/';
// Waiting longer than this for the network on a page load falls back to the saved copy.
const SLOW = 5000;

// Files that never change under the same name, so an older build's copy is as good as a new download.
const same = (rel) => rel.startsWith('assets/') || rel.startsWith('parts/');
// Nice to have offline (part pictures), but not worth failing the install over.
const optional = (rel) => rel.startsWith('parts/');

self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (!BUILD) return;
  event.waitUntil(
    save().catch(async (e) => {
      // A failed update leaves the copy that's working in place. With no
      // copy yet, still install (notifications need this worker); the page
      // asks again on its next visit ('ensure').
      if ((await caches.keys()).some((k) => k.startsWith(PREFIX) && k !== CACHE)) throw e;
    }),
  );
});

// One save at a time; the page can ask for another try.
let saving = null;
function ensure() {
  saving ||= (async () => {
    if (!(await current())) await save();
  })().finally(() => (saving = null));
  return saving;
}

async function enabled() {
  try {
    const res = await fetch(SCOPE + 'offline.json', { cache: 'no-store' });
    if (res.ok) return (await res.json()).enabled !== false;
  } catch {
    /* offline, or no file: keep going */
  }
  return true;
}

async function save() {
  // The kill switch is on: install without saving anything.
  if (!(await enabled())) return;
  const cache = await caches.open(CACHE);
  const older = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE);
  const copyOver = async (rel) => {
    for (const k of older) {
      const hit = await (await caches.open(k)).match(SCOPE + rel);
      if (hit) return hit;
    }
    return null;
  };
  const get = async (rel) => {
    const url = SCOPE + rel;
    if (await cache.match(url)) return;
    const hit = same(rel) ? await copyOver(rel) : null;
    // The page and unhashed files skip the browser's own cache (GitHub Pages lets it keep them for 10 minutes).
    const res = hit || (await fetch(url, same(rel) ? undefined : { cache: 'reload' }));
    if (!res.ok) throw new Error(`${rel}: ${res.status}`);
    await cache.put(url, res.clone());
  };
  // The page last, so a copy of the app only exists once everything it uses is saved.
  const files = MANIFEST.filter((rel) => !optional(rel));
  const extra = MANIFEST.filter(optional);
  const queue = [...files];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let rel; (rel = queue.shift()); ) await get(rel);
    }),
  );
  await get('');
  // Part pictures: best effort, in the background of the install.
  const rest = [...extra];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let rel; (rel = rest.shift()); ) await get(rel).catch(() => {});
    }),
  );
}

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      // Drop every other build's copy.
      for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
      await killCheck(true);
    })(),
  ),
);

// The kill switch. Off: delete the saved copies; unregister unless this
// device has notifications on (they live on this worker), in which case it
// stays, saving nothing.
let lastCheck = 0;
async function killCheck(force) {
  if (!BUILD || (!force && Date.now() - lastCheck < 60000)) return;
  lastCheck = Date.now();
  if (await enabled()) return;
  for (const k of await caches.keys()) if (k.startsWith(PREFIX) || k === FONTS) await caches.delete(k);
  const sub = await self.registration.pushManager?.getSubscription().catch(() => null);
  if (!sub) await self.registration.unregister();
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'check') event.waitUntil(killCheck(true));
  if (event.data?.type === 'ensure') event.waitUntil(enabled().then((on) => on && ensure()).catch(() => {}));
  if (event.data?.type === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!BUILD || req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(SCOPE_PATH) || url.pathname.startsWith(NESTED)) return;
    const rel = url.pathname.slice(SCOPE_PATH.length);
    // Never from a copy.
    if (['sw.js', 'version.json', 'offline.json'].includes(rel)) return;
    if (req.mode === 'navigate' || rel === '' || rel === 'index.html') event.respondWith(page(event));
    else event.respondWith(file(req, url));
    return;
  }
  // The display-name fonts (Google Fonts): keep what was seen, refresh quietly.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(font(event));
});

// This build's saved copy, once it's complete (the page is saved last).
let complete = false;
async function current() {
  if (!(await caches.has(CACHE))) return null;
  const cache = await caches.open(CACHE);
  if (!complete) {
    if (!(await cache.match(SCOPE))) return null;
    complete = true;
  }
  return cache;
}

async function page(event) {
  const req = event.request;
  const cache = await current();
  if (!cache) return fetch(req); // no copy (kill switch, or still installing)
  event.waitUntil(killCheck(false));
  const saved = () => cache.match(SCOPE, { ignoreSearch: true });
  // A plain update (?v=) is asked for by hand: give the network longer.
  const wait = new URL(req.url).searchParams.has('v') ? SLOW * 2 : SLOW;
  try {
    const res = await Promise.race([
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }),
      new Promise((_, no) => setTimeout(no, wait)),
    ]);
    // GitHub Pages hiccups (5xx, 404) shouldn't hide the app.
    if (res.ok && !res.redirected) return res;
    return (await saved()) || res;
  } catch {
    return (await saved()) || Response.error();
  }
}

async function file(req, url) {
  const cache = await current();
  if (!cache) return fetch(req);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  // Something from this build that wasn't in the list: keep it for next time.
  if (res.ok && same(url.pathname.slice(SCOPE_PATH.length))) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function font(event) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(event.request);
  const fresh = fetch(event.request)
    .then((res) => {
      // Opaque (no-cors) answers are fine for a font; error pages aren't.
      if (res.ok || res.type === 'opaque') cache.put(event.request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => hit || Response.error());
  event.waitUntil(fresh.catch(() => {}));
  return hit || fresh;
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { data: { title: event.data?.text() || 'FTC 32313' } };
  }
  const d = { ...(payload.notification || {}), ...(payload.data || {}) };
  // The Home Screen icon's number: unread notifications, counted by the server.
  const count = Number(d.badge);
  const badge = Number.isFinite(count) && self.navigator.setAppBadge ? self.navigator.setAppBadge(count).catch(() => {}) : null;
  event.waitUntil(
    Promise.all([
      badge,
      self.registration.showNotification(d.title || 'FTC 32313 Tasks', {
        body: d.body || '',
        tag: d.tag || undefined,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        data: { open: d.open || '' },
      }),
    ]),
  );
});

// Tapping a notification opens the site (or the open tab) at the right place.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const open = event.notification.data?.open || '';
  const url = new URL(self.registration.scope);
  if (open) url.searchParams.set('open', open);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const tab = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (tab) {
        await tab.focus();
        tab.postMessage({ type: 'open', open });
      } else {
        await self.clients.openWindow(url.href);
      }
    })(),
  );
});
