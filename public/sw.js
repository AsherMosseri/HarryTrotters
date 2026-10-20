// Service worker for phone notifications. It doesn't cache anything, so site
// updates work as before. Pushes come from the Cloud Functions in functions/.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { data: { title: event.data?.text() || 'FTC 32313' } };
  }
  const d = { ...(payload.notification || {}), ...(payload.data || {}) };
  event.waitUntil(
    self.registration.showNotification(d.title || 'FTC 32313 Tasks', {
      body: d.body || '',
      tag: d.tag || undefined,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { open: d.open || '' },
    }),
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
