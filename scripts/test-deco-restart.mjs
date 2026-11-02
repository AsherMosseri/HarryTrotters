// Checks that the corner profile picture's animated decoration never restarts
// while the app churns (messages, typing, page changes, menus).
//
//   npx vite build && npx vite preview --port 4173 &
//   node scripts/test-deco-restart.mjs http://localhost:4173 [--quick]
//
// For each decoration it samples the footer avatar's animations (sidebar on
// iPad / desktop, the top-right picture on phones) every 100ms for 10s and
// requires: the same Animation objects the whole time (none replaced, none
// added), currentTime only ever going up, and no DOM changes inside the
// decoration; nothing may be held still (paused). A second check opens a busy
// channel: at most 8 decorations move at once, the corner picture always does,
// and coming back to the app nudges the animations and they carry on.
// Needs Playwright (see the paths below). Exit code 1 on failure.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: ['/opt/node-tools/node_modules', '/usr/local/lib/node_modules'] }));

const BASE = process.argv[2] || 'http://localhost:4173';
const QUICK = process.argv.includes('--quick');
const KEY = 'ftc32313-demo-v13';
const SECONDS = QUICK ? 6 : 10;
// The version this build says it is, so the "What's new" card doesn't cover the page.
const RELEASE = (await (await fetch(`${BASE}/version.json`)).json()).release;

const ring = (style, spin = 'cw') => ({ ring: { style, colors: ['#8b5cf6', '#06b6d4', '#f97316'], width: 9, spin, speed: 4 }, badges: [] });
const badge = (anim, angle) => ({ kind: 'emoji', value: '⭐', angle, dist: 0.55, size: 0.38, rotate: 25, anim, dir: 'cw', speed: 3 });
const custom = (c) => ({ decoration: 'custom', decorationCustom: c });
const ALL = {
  comets: { decoration: 'comets' },
  flamering: { decoration: 'flamering' },
  electric: { decoration: 'electric' },
  halo: { decoration: 'halo' },
  ripple: { decoration: 'ripple' },
  petals: { decoration: 'petals' },
  circuit: { decoration: 'circuit' },
  catears: { decoration: 'catears' },
  wings: { decoration: 'wings' },
  neon: { decoration: 'neon' },
  rainbow: { decoration: 'rainbow' },
  'custom glow ring': custom(ring('glow')),
  'custom rainbow ring + sticker animations': custom({ ...ring('rainbow'), badges: ['orbit', 'spin', 'bob', 'pulse', 'wiggle', 'float'].map((a, i) => badge(a, i * 60)) }),
};
const CASES = QUICK ? ['comets', 'neon', 'custom glow ring', 'custom rainbow ring + sticker animations'] : Object.keys(ALL);

async function run(browser, name, phone) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1180, height: 820 },
    hasTouch: phone,
    isMobile: phone,
  });
  await ctx.addInitScript((release) => {
    localStorage.setItem('welcome-seen-v1', 'true');
    localStorage.setItem('seen-version', JSON.stringify(release));
    localStorage.setItem('seen-log-3.0', 'true');
    localStorage.setItem('versions-renumbered', '1');
    localStorage.setItem('v246-merged', '1');
  }, RELEASE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?demo`);
  await page.waitForSelector('.sidebar, .bottom-nav');
  await page.evaluate(
    ([KEY, patch]) => {
      const st = JSON.parse(localStorage.getItem(KEY));
      st.profiles = [...(st.profiles || []).filter((p) => p.id !== 'asher-mosseri'), { ...patch, id: 'asher-mosseri', name: 'Asher Mosseri', updatedAt: Date.now() }];
      localStorage.setItem(KEY, JSON.stringify(st));
    },
    [KEY, ALL[name]],
  );
  await page.reload();
  await page.waitForSelector('.sidebar, .bottom-nav');
  await page.evaluate(() => document.querySelectorAll('.demo-banner').forEach((e) => e.remove()));
  await page.waitForTimeout(500);

  const root = phone ? '.me-btn' : '.sb-foot';
  // Watch the animations and the decoration's DOM.
  await page.evaluate(
    ([root, seconds]) => {
      const ids = new WeakMap();
      let next = 1;
      const st = { seen: new Set(), samples: 0, added: 0, lost: 0, backwards: 0, paused: 0, first: null, mutations: 0, maxCount: 0, minCount: 1e9 };
      window.__deco = st;
      const deco = () => document.querySelector(`${root} .deco`);
      const el = deco();
      if (!el) return;
      new MutationObserver((list) => (st.mutations += list.length)).observe(el, { attributes: true, childList: true, subtree: true, characterData: true });
      const last = new Map();
      const tick = () => {
        const cur = deco()?.getAnimations({ subtree: true }) || [];
        st.samples++;
        st.maxCount = Math.max(st.maxCount, cur.length);
        st.minCount = Math.min(st.minCount, cur.length);
        const now = new Set();
        for (const a of cur) {
          if (!ids.has(a)) ids.set(a, next++);
          const id = ids.get(a);
          now.add(id);
          const t = Number(a.currentTime);
          if (a.playState !== 'running') st.paused++;
          if (st.first && !st.first.has(id)) st.added++;
          if (last.has(id) && t < last.get(id) - 0.5) st.backwards++;
          last.set(id, t);
        }
        if (!st.first) st.first = now;
        else for (const id of st.first) if (!now.has(id)) st.lost++;
      };
      tick();
      window.__decoTimer = setInterval(tick, 100);
      setTimeout(() => clearInterval(window.__decoTimer), seconds * 1000 + 500);
    },
    [root, SECONDS],
  );
  const count = await page.evaluate(() => window.__deco?.first?.size ?? 0);

  // Churn: pages, chat, typing, sending, the menu: a few actions a second.
  const pages = phone ? ['Today', 'Tasks', 'Chat', 'Today'] : ['Today', 'Tasks', 'Resources', 'general'];
  const chat = phone ? page.locator('.bottom-nav button', { hasText: 'Chat' }) : page.locator('.sb-row', { hasText: 'general' });
  await chat.first().click().catch(() => {});
  const end = Date.now() + SECONDS * 1000;
  let n = 0;
  const did = { typed: 0, nav: 0, menu: 0 };
  while (Date.now() < end) {
    n++;
    try {
      if (n % 5 === 0) {
        const label = pages[(n / 5) % pages.length];
        const btn = phone ? page.locator('.bottom-nav button', { hasText: label }) : page.locator('.sb-row', { hasText: label });
        await btn.first().click({ timeout: 1000 });
        did.nav++;
      } else if (n % 7 === 0 && !phone) {
        await page.locator('.sb-foot .me-chip').click({ timeout: 1000 });
        did.menu++;
      } else {
        const box = page.locator('.composer textarea, textarea.composer-input, .composer [contenteditable]').first();
        if (await box.count()) {
          await box.click({ timeout: 500 });
          await page.keyboard.type('hi ', { delay: 20 });
          did.typed++;
          if (n % 3 === 0) await page.keyboard.press('Enter');
        }
      }
    } catch {
      /* the target may be mid-change; the next action tries again */
    }
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const s = window.__deco;
    return s && { samples: s.samples, count: s.first?.size ?? 0, added: s.added, lost: s.lost, backwards: s.backwards, paused: s.paused, mutations: s.mutations, minCount: s.minCount, maxCount: s.maxCount };
  });
  await ctx.close();
  return { r, errors, count, did };
}

// Part 2: a busy channel. Only a few decorations on screen move at once (the
// corner picture always does), and coming back to the app nudges them.
async function busyChannel(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.addInitScript((release) => {
    localStorage.setItem('welcome-seen-v1', 'true');
    localStorage.setItem('seen-version', JSON.stringify(release));
    localStorage.setItem('seen-log-3.0', 'true');
    localStorage.setItem('versions-renumbered', '1');
    localStorage.setItem('v246-merged', '1');
  }, RELEASE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?demo`);
  await page.waitForSelector('.sidebar');
  await page.evaluate((KEY) => {
    const st = JSON.parse(localStorage.getItem(KEY));
    const names = ['Asher Mosseri', 'Sebastian Tolbert', 'Jackson Lucks', 'Cooper Mlezcko', 'Michael Meidan', 'Matthew Kuehl', 'Katarina Jurasic', 'Sophia Bermudez', 'Shrey Kumar', 'Ira Kumar'];
    const decos = ['comets', 'flamering', 'electric', 'halo', 'ripple', 'petals', 'circuit', 'catears', 'bunny', 'wizard'];
    const id = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    st.profiles = names.map((name, i) => ({ id: id(name), name, decoration: decos[i], updatedAt: Date.now() }));
    const now = Date.now();
    st.chat = { ...st.chat, general: Array.from({ length: 24 }, (_, i) => ({ id: `m${i}`, text: `message ${i}`, by: names[(i + 1) % 10], byUid: 'x', at: now - (30 - i) * 60000, mentions: [], taskIds: [], replyTo: null, photo: null, reactions: {} })) };
    localStorage.setItem(KEY, JSON.stringify(st));
  }, KEY);
  await page.reload();
  await page.waitForSelector('.sidebar');
  await page.locator('.sb-row', { hasText: 'general' }).first().click();
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const decos = [...document.querySelectorAll('.msg .deco')];
    const corner = document.querySelector('.sb-foot .deco');
    return {
      onPage: decos.length,
      moving: decos.filter((d) => !d.dataset.still).length,
      cornerMoving: !!corner && !corner.dataset.still && corner.getAnimations({ subtree: true }).every((a) => a.playState === 'running'),
    };
  });
  const checks = [];
  checks.push([r.onPage >= 12, `a busy channel has many decorations (${r.onPage})`]);
  checks.push([r.moving <= 8, `at most 8 of them move at once (${r.moving})`]);
  checks.push([r.moving >= 1, 'some of them do move']);
  checks.push([r.cornerMoving, 'the corner picture moves']);
  // Back from the background: a nudge (a two-frame pause) that then clears, and the corner keeps going.
  const t0 = await page.evaluate(() => Number(document.querySelector('.sb-foot .deco').getAnimations({ subtree: true })[0].currentTime));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const nudged = await page.waitForFunction(() => document.documentElement.hasAttribute('data-deco-kick'), null, { timeout: 1500 }).then(() => true, () => false);
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-deco-kick'), null, { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => {
    const a = document.querySelector('.sb-foot .deco').getAnimations({ subtree: true })[0];
    return [Number(a.currentTime), a.playState, document.documentElement.hasAttribute('data-deco-kick')];
  });
  checks.push([nudged, 'coming back nudges the animations']);
  checks.push([!t1[2] && t1[1] === 'running' && t1[0] > t0, `and they carry on afterwards (${Math.round(t0)} -> ${Math.round(t1[0])} ms, ${t1[1]})`]);
  checks.push([!errors.length, 'no page errors']);
  await ctx.close();
  let bad = 0;
  for (const [ok, label] of checks) {
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} busy channel: ${label}`);
  }
  return bad;
}

const browser = await chromium.launch();
let failed = await busyChannel(browser);
for (const phone of [false, true]) {
  for (const name of CASES) {
    if (phone && QUICK && name !== 'comets' && name !== 'custom glow ring') continue;
    const { r, errors, did } = await run(browser, name, phone);
    const animated = r && r.count > 0;
    // Plain decorations that only have a still ring have no animations to check; they still must not change the DOM.
    const ok = r && r.added === 0 && r.lost === 0 && r.backwards === 0 && r.paused === 0 && r.mutations === 0 && r.minCount === r.maxCount && !errors.length && did.typed >= 3 && did.nav >= 2; // and the churn really happened
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${phone ? 'phone' : 'ipad '} ${name.padEnd(42)} animations=${r?.count} samples=${r?.samples} added=${r?.added} lost=${r?.lost} backwards=${r?.backwards} paused=${r?.paused} domChanges=${r?.mutations} churn=${did.typed} typed/${did.nav} pages/${did.menu} menus${animated ? '' : ' (no animations)'}${errors.length ? ' errors=' + errors.join('|') : ''}`);
  }
}
await browser.close();
console.log(failed ? `FAILED: ${failed}` : 'PASSED: no decoration animation restarted');
process.exit(failed ? 1 : 0);
