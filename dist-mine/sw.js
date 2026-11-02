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
const BUILD = "mvyns80l";
const MANIFEST = ["apple-touch-icon.png","assets/FunGame-DgIBTBmH.js","assets/Learn-CzaQmXaI.js","assets/RobotView-sa6gCSpd.js","assets/Scout-C54zJndz.js","assets/autoPath-DJTrOiCk.js","assets/battery-BWGOiH89.webp","assets/control-hub-DhOpxgF9.webp","assets/demoStore-K5KcCUmv.js","assets/emoji-aSVGF2V7.js","assets/expansion-hub-BvtfFjoS.webp","assets/firebaseStore-CBKJxME6.js","assets/horse-whkblJAa.webp","assets/index-B-uCaLcv.css","assets/index-CHBZtBP7.js","assets/index.esm-3ZfibQ_9.js","assets/matches-CfzUm9gM.js","assets/motor-BRn1Tc2I.webp","assets/react-DvXU6kJ2.js","assets/robot-dance-D1HZuLta.webp","assets/rulebook-Cdv2A4ZJ.js","assets/servo-ClYyCoMg.webp","horse.webp","icon-192.png","icon-512.png","icon-maskable-512.png","manifest.webmanifest","old-icon.png","parts/01nd8e499s.webp","parts/0fonp06sht.webp","parts/0gkfbk2vpc.webp","parts/0oi55wdrpw.webp","parts/0oyiefh6fs.webp","parts/0xu4lo4noa.webp","parts/16brsvknxd.webp","parts/1jccl68qk9.webp","parts/1k7j1exsa8.webp","parts/1nzv8pnjs1.webp","parts/20yz1b2o2y.webp","parts/2g5jemj49t.webp","parts/2gfn9ew1zl.webp","parts/35viwz00lc.webp","parts/36nhvc49nh.webp","parts/3g81ajcfqq.webp","parts/3lsaz60ly8.webp","parts/3rbvhs2wnr.webp","parts/3zex77j23f.webp","parts/42axlxosgc.webp","parts/45ac3cywha.webp","parts/4bh8up6f41.webp","parts/4jd7lyhbab.webp","parts/4vyg3p1iia.webp","parts/52v0qs90wf.webp","parts/53ptljuf24.webp","parts/5aq0koolqf.webp","parts/5bho4tl0t0.webp","parts/5eyjb60d85.webp","parts/5f48098kfy.webp","parts/5o3xsti37r.webp","parts/5ppxrr1ddm.webp","parts/5q1j6v68a4.webp","parts/5z46c55kvt.webp","parts/6ao52o0c5g.webp","parts/6k2gqi3wyf.webp","parts/6qo0wlpug5.webp","parts/6r068daixw.webp","parts/6t18hxw65b.webp","parts/7kpw45olnv.webp","parts/7upnono1sv.webp","parts/888f48ue4z.webp","parts/88v6xf2zar.webp","parts/88xtsiloq2.webp","parts/8dnd8utf8u.webp","parts/8i2lmjx4c9.webp","parts/8ifyl7qp9p.webp","parts/8k6g9p8tel.webp","parts/8mkjrcrpoj.webp","parts/8q886k10as.webp","parts/94krabwka7.webp","parts/9fazxo5311.webp","parts/9hwk06lwbq.webp","parts/9kewuwox4i.webp","parts/9n8x4qnk74.webp","parts/9y1gz10v6m.webp","parts/a6ytza7jiq.webp","parts/a7s5a35sf1.webp","parts/atvkt8po49.webp","parts/b2ifhfgtes.webp","parts/b5a5roa9nc.webp","parts/bc8gamvm6v.webp","parts/bnhc2yhbfk.webp","parts/bqefgu30u7.webp","parts/btn5okb0eq.webp","parts/bwo4l6w2xn.webp","parts/bywxafmlys.webp","parts/c3esrvn5cs.webp","parts/c5852vhjup.webp","parts/c629jjb43s.webp","parts/c7wicriva1.webp","parts/cirkul7kk2.webp","parts/cjaibuxoei.webp","parts/cqzyruqxkw.webp","parts/cyh6i0jfkm.webp","parts/dabc6k3s08.webp","parts/dgh8mx66oo.webp","parts/dri3bbotv0.webp","parts/dw632okr3r.webp","parts/dwwybnttex.webp","parts/e9u6r28pgv.webp","parts/eaxbml0ayi.webp","parts/eouk6ojn6n.webp","parts/ep8dpxusu0.webp","parts/eq8j1jzmfi.webp","parts/ewfliziljt.webp","parts/ezw90n42b7.webp","parts/f324kdqbhp.webp","parts/fe2kykklx7.webp","parts/fueg26xxry.webp","parts/g736ztq4b8.webp","parts/ggcuadvt18.webp","parts/gt6v6kb1tr.webp","parts/h3k2f5yzo1.webp","parts/h575203ibq.webp","parts/h7ith7z9dd.webp","parts/hlpsm9w2v9.webp","parts/htabxls2lc.webp","parts/hzzuqulfgr.webp","parts/i7luwgr50f.webp","parts/i8htfitxfx.webp","parts/iilrpsq4tk.webp","parts/iincomizf4.webp","parts/ipxdcl6ujn.webp","parts/irp3m6rcl8.webp","parts/isy8uf5rc7.webp","parts/itq29e0k7p.webp","parts/iuomklmrdu.webp","parts/jpwr9e6zcb.webp","parts/jx2xyw8joe.webp","parts/kfbr016o2k.webp","parts/kh78tq59bw.webp","parts/khg3g9fmi7.webp","parts/kkzwhq19zp.webp","parts/l6mq63uxdq.webp","parts/la19eetr2r.webp","parts/lbh6t1vnql.webp","parts/lj9fpvkoa4.webp","parts/ljcg1z8yha.webp","parts/lqpa68yvd3.webp","parts/ltzhx83pli.webp","parts/lvef1ox7ui.webp","parts/m7j7p8x86f.webp","parts/m7rz1s8cfs.webp","parts/maehn075p0.webp","parts/mawvt5ijzv.webp","parts/mb3rymoerq.webp","parts/md3mlaytho.webp","parts/mf0tmz3w80.webp","parts/mz57ctz41a.webp","parts/nee16vselp.webp","parts/njsgiwn4d9.webp","parts/nq875cd2nh.webp","parts/nudd6w9yjt.webp","parts/nxxu39oppx.webp","parts/o3gca80rux.webp","parts/o506zocyk0.webp","parts/o7h9c4yws2.webp","parts/oplu1mn53k.webp","parts/ouh1zqhosa.webp","parts/p58gy4ng33.webp","parts/pvgxn31rms.webp","parts/px1o0w0i68.webp","parts/pz9utw67qk.webp","parts/q2br3eiz30.webp","parts/qllmog2ftu.webp","parts/qr4a46fzd6.webp","parts/r1nk3k5fcw.webp","parts/r8ml2avbku.webp","parts/rvf1nbe2z2.webp","parts/sd9qr6fn9s.webp","parts/se7ina43au.webp","parts/shf9ecg33p.webp","parts/skph1xddn0.webp","parts/sls1uh1vbi.webp","parts/sro1ap3kw3.webp","parts/stio2qyh7u.webp","parts/tadg1j5irl.webp","parts/tkqzwl42g0.webp","parts/trp0l9ulcw.webp","parts/ttjckcje3p.webp","parts/tuixiztjqg.webp","parts/u03zeop6jn.webp","parts/u5uqaak4hu.webp","parts/u6m8l8hfck.webp","parts/ux1i846k2u.webp","parts/uxluz55hcy.webp","parts/vjwitaqbyo.webp","parts/vklfdwpvc9.webp","parts/vv745kpt10.webp","parts/vy3tuu8mum.webp","parts/w4th9gjhp2.webp","parts/wcui777a7v.webp","parts/wg65zogvge.webp","parts/wgyv7sh672.webp","parts/x0lli8y0qd.webp","parts/x2jb7mpt58.webp","parts/xcppfn9b9h.webp","parts/xcw6845zbf.webp","parts/xfwcpyterh.webp","parts/xkynj2co56.webp","parts/xlf4tiiw7i.webp","parts/xnjl3fyqva.webp","parts/xpkfpkuhl1.webp","parts/xqruhvxnuh.webp","parts/xtrecgkkw3.webp","parts/xu9zk37buj.webp","parts/xweb2w3mzt.webp","parts/y6xoqjx81z.webp","parts/yefu90ov9l.webp","parts/ygq1yefn96.webp","parts/ykeli2uscy.webp","parts/yl7fswls5k.webp","parts/yqv7dh6re6.webp","parts/yyxsfy3ske.webp"];

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
    await saveExtras();
  })().finally(() => (saving = null));
  return saving;
}

async function enabled() {
  try {
    // Dead Wi-Fi can hang instead of failing: don't wait long.
    const res = await fetch(SCOPE + 'offline.json', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (res.ok) return (await res.json()).enabled !== false;
  } catch {
    /* offline, or no file: keep going */
  }
  return true;
}

// Saves one file of this build into the cache (from an older build's copy when it's a hashed file, which never changes).
async function saveFile(cache, rel) {
  const url = SCOPE + rel;
  if (await cache.match(url)) return;
  let res = null;
  if (same(rel)) {
    for (const k of (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE)) {
      res = await (await caches.open(k)).match(url);
      if (res) break;
    }
  }
  // The page and unhashed files skip the browser's own cache (GitHub Pages lets it keep them for 10 minutes).
  res ||= await fetch(url, same(rel) ? undefined : { cache: 'reload' });
  if (!res.ok) throw new Error(`${rel}: ${res.status}`);
  await cache.put(url, res.clone());
}

async function saveAll(cache, files, parallel) {
  const queue = [...files];
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (let rel; (rel = queue.shift()); ) await saveFile(cache, rel);
    }),
  );
}

async function save() {
  // The kill switch is on: install without saving anything.
  if (!(await enabled())) return;
  const cache = await caches.open(CACHE);
  await saveAll(cache, MANIFEST.filter((rel) => !optional(rel)), 6);
  // The page last, so a copy of the app only exists once everything it uses is saved.
  await saveFile(cache, '');
}

// Part pictures: saved quietly after the copy is complete (the page asks on
// each visit, so a stop halfway picks up next time), never holding up an install.
async function saveExtras() {
  const cache = await current();
  if (cache) await saveAll(cache, MANIFEST.filter(optional), 2).catch(() => {});
}

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      // Drop every other build's copy.
      for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);
// Not waited for: activation holds up the page's requests, and the switch is
// also checked on every page load.
self.addEventListener('activate', () => {
  killCheck(true).catch(() => {});
});

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
