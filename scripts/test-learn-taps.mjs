// Learn touch test: real taps (a touch screen, taps at screen points, not
// clicks on elements) on every Learn board, the auto planner and the daily
// question card, on a phone (390x844) and an iPad held upright (820x1180),
// with demo mode answering at once and at a real round trip's pace
// (demo-learn-latency, see src/data/demoLearn.js).
//
//   npx vite build && npx vite preview --port 4173 &
//   node scripts/test-learn-taps.mjs http://localhost:4173 [phone|ipad] [latencies, e.g. 0,600] [rounds]
//   GAME='Robot timeline' (or Auto, Daily) runs just that one.
//
// What it does, per game and round (double taps 50, 150, 250 and 400 ms apart):
//   A  double tap the answer: the second tap must do nothing
//   B  double tap Next: exactly one new question, left alone
//   C  tap a pick on a new question where it was first drawn, 600 or 900 ms later
//   D  tap Next where it was first drawn, 400 or 700 ms after it showed
//   E  double tap Skip: one question skipped
// and double taps Run it on the auto planner and an answer on the daily card.
// It counts, per 100 taps:
//   wrong   - a tap did something other than what the finger was on (answered
//             the next question, picked a line or port, moved a timeline item,
//             opened Report, threw an auto run away)
//   dropped - an intended tap (C, D) did nothing
//   double  - one control went through twice (two questions skipped)
// Needs Playwright (see the paths below). Exit code 1 on any wrong or double tap.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: ['/opt/node-tools/node_modules', '/usr/local/lib/node_modules'] }));

const BASE = process.argv[2] || 'http://localhost:4173';
// The version this build says it is, so the "What's new" card doesn't cover the page.
const RELEASE = (await (await fetch(`${BASE}/version.json`)).json()).release;
const ONLY = process.argv[3] || '';
const LATS = (process.argv[4] || '0,600').split(',').map(Number);
const ROUNDS = Number(process.argv[5] || 4);
const ONLY_GAME = process.env.GAME || ''; // e.g. GAME='Robot timeline'
const GAP = [50, 150, 250, 400]; // double tap: ms between the two taps
const SEE = [400, 700]; // intended tap on Next: ms after it appeared
const READ = [600, 900]; // intended pick on a new question: ms after it appeared (time to read it)
const VERBOSE = !!process.env.VERBOSE;
const CONFIGS = [
  { name: 'phone', ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: 'ipad', ctx: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
].filter((c) => !ONLY || c.name === ONLY);
const GAMES = [
  ['Rules check', 'choice'],
  ['Strategy', 'choice'],
  ['Name that part', 'choice'],
  ['Gear ratios', 'choice'],
  ['Who did this?', 'choice'],
  ['Spot the problem', 'tag'],
  ['Fix the bug', 'code'],
  ['Wiring puzzle', 'port'],
  ['Robot timeline', 'order'],
];

// Instrumentation: every animation frame, note when the question on screen
// changes and when its feedback first shows, with where things were drawn
// right then (what the user saw).
const INSTRUMENT = () => {
  const L = (window.__lq = { qlog: [], fblog: [], clicks: [] });
  const SEL_Q = '.lq-stage :is(.lq-prompt,.lq-rule-text,.lq-part,.lq-photo figcaption,.lq-gear-q,.lq-who-text,.lq-device-q,.lq-board-top b,.lq-scene p)';
  const SEL_C = '.lq-stage :is(.lq-choice,.lq-tag span:last-child,.lq-line code,.lq-tl-main b)';
  const keyOf = () => {
    if (!document.querySelector('.lq-stage')) return '';
    const a = [...document.querySelectorAll(SEL_Q)].map((e) => e.textContent);
    const b = [...document.querySelectorAll(SEL_C)].map((e) => e.textContent).sort();
    return (a.join('|') + '#' + b.join('|')).slice(0, 600);
  };
  const rect = (e) => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  };
  const targets = () => ({
    pick: [...document.querySelectorAll('.lq-stage :is(.lq-choice,.lq-tag,.lq-line,.lq-port)')].map(rect),
    earlier: [...document.querySelectorAll('.lq-stage .lq-tl-moves button:first-child')].map(rect),
  });
  let lastKey = null;
  let lastFb = false;
  const tick = () => {
    const k = keyOf();
    if (k && k !== lastKey) {
      L.qlog.push({ at: performance.now(), key: k, order: [...document.querySelectorAll('.lq-stage .lq-tl-main b')].map((e) => e.textContent).join('|'), ...targets() });
      lastFb = false;
    }
    if (k) lastKey = k;
    const next = document.querySelector('.lq-next, .lq-fb-actions .btn.primary');
    const fb = !!(next && !next.disabled);
    if (fb && !lastFb) L.fblog.push({ at: performance.now(), next: rect(next) });
    lastFb = fb;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target.closest?.('button, a, summary') || e.target;
      L.clicks.push({ at: performance.now(), x: Math.round(e.clientX), y: Math.round(e.clientY), el: `${t.tagName.toLowerCase()}.${String(t.className?.baseVal ?? t.className).split(' ').join('.')}`, text: (t.textContent || '').trim().slice(0, 30) });
    },
    true,
  );
};
const SNAP = () => {
  const all = (s) => [...document.querySelectorAll(s)];
  const picks = all('.lq-stage .lq-choice, .lq-stage .lq-tag');
  let given = picks.findIndex((e) => e.classList.contains('is-wrong'));
  if (given < 0) given = picks.findIndex((e) => e.classList.contains('is-right'));
  return {
    pkey: ((k) => k.split('#')[0] || k)(window.__lq.qlog.at(-1)?.key || ''),
    qcount: window.__lq.qlog.length,
    answered: !!document.querySelector('.lq-feedback'),
    given,
    line: all('.lq-stage .lq-line').findIndex((e) => e.classList.contains('on')),
    port: all('.lq-stage .lq-port').findIndex((e) => e.classList.contains('on')),
    order: all('.lq-stage .lq-tl-main b').map((e) => e.textContent).join('|'),
    dialog: !!document.querySelector('.dialog'),
    empty: !!document.querySelector('.lq-empty'),
    loading: !!document.querySelector('.lq-loading'),
  };
};

const tally = {};
const bump = (bucket, k, n = 1) => {
  tally[bucket] = tally[bucket] || { taps: 0, ok: 0, wrong: 0, dropped: 0, double: 0, notes: {} };
  tally[bucket][k] += n;
};
let curGame = '';
const note = (bucket, what) => {
  what = `${curGame}: ${what}`;
  tally[bucket].notes[what] = (tally[bucket].notes[what] || 0) + 1;
  if (VERBOSE) console.log('  ', bucket, what);
};
const center = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];

const b = await chromium.launch();
let pageErrors = 0;
let harnessErrors = 0;
for (const c of CONFIGS)
  for (const lat of LATS) {
    const tag = `${c.name}/${lat}ms`;
    const ctx = await b.newContext({ ...c.ctx });
    await ctx.addInitScript(([lat, release]) => {
      localStorage.setItem('welcome-seen-v1', 'true');
      localStorage.setItem('seen-version', JSON.stringify(release));
      localStorage.setItem('seen-log-3.0', 'true');
      localStorage.setItem('versions-renumbered', '1');
      localStorage.setItem('v246-merged', '1');
      localStorage.setItem('demo-learn-latency', String(lat));
    }, [lat, RELEASE]);
    await ctx.addInitScript(INSTRUMENT);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => {
      pageErrors++;
      console.log('PAGE ERROR', e.message);
    });
    await p.goto(`${BASE}/?demo`);
    await p.waitForSelector('.app');
    await p.evaluate(() => document.querySelector('.demo-banner')?.remove());
    const tap = (x, y) => p.touchscreen.tap(x, y);
    const tapEl = async (loc) => {
      await loc.scrollIntoViewIfNeeded();
      await p.waitForTimeout(60);
      const bb = await loc.boundingBox();
      await tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
    };
    const snap = () => p.evaluate(SNAP);
    const settle = () => p.waitForTimeout(lat + 450);
    const openLearn = async () => {
      if (c.name === 'phone') {
        await tapEl(p.locator('.bottom-nav button', { hasText: 'More' }).first());
        await p.waitForTimeout(400);
        await tapEl(p.locator('.sheet button', { hasText: 'Learn' }).first());
      } else await tapEl(p.locator('.sb-row', { hasText: 'Learn' }).first());
      await p.waitForSelector('.lq-cards');
    };
    const waitQuestion = async (since) =>
      p
        .waitForFunction((n) => window.__lq.qlog.length > n || document.querySelector('.lq-empty'), since, { polling: 'raf', timeout: lat + 4000 })
        .then(() => true)
        .catch(() => false);
    const nextLoc = () => p.locator('.lq-next, .lq-fb-actions .btn.primary').first();
    // Get the board ready to answer, and return the screen point of the
    // control that answers (the choice, or the plug/check button).
    const prepare = async (kind, i) => {
      if (kind === 'choice' || kind === 'tag') {
        const all = p.locator(kind === 'tag' ? '.lq-stage .lq-tag' : '.lq-stage .lq-choice');
        await all.first().waitFor({ timeout: lat + 4000 });
        i = i % Math.max(1, await all.count());
        const loc = all.nth(i);
        await loc.scrollIntoViewIfNeeded();
        await p.waitForTimeout(80);
        const bb = await loc.boundingBox();
        return { at: [bb.x + bb.width / 2, bb.y + bb.height / 2], want: i };
      }
      if (kind === 'code' || kind === 'port') {
        const all = p.locator(kind === 'code' ? '.lq-stage .lq-line' : '.lq-stage .lq-port');
        await all.first().waitFor({ timeout: lat + 4000 });
        i = i % Math.max(1, await all.count());
        const loc = all.nth(i);
        await loc.scrollIntoViewIfNeeded();
        await p.waitForTimeout(500); // past any guard: this is a deliberate pick
        await tapEl(loc);
        await p.waitForTimeout(150);
      }
      const btn = p.locator('.lq-stage .lq-plug .btn.primary, .lq-stage .lq-timeline > .btn.primary').first();
      await btn.scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      const bb = await btn.boundingBox();
      return { at: [bb.x + bb.width / 2, bb.y + bb.height / 2], want: i };
    };
    const answeredRight = (kind, s, want, sel) => {
      if (!s.answered) return false;
      if (kind === 'choice' || kind === 'tag') return s.given === want;
      return true;
    };

    await openLearn();
    for (const [game, kind] of GAMES) {
      if (ONLY_GAME && game !== ONLY_GAME) continue;
      curGame = game;
      await tapEl(p.locator('.lq-card', { hasText: game }).first());
      await p.waitForSelector('.lq-title');
      const ok0 = await waitQuestion(0);
      await p.waitForTimeout(lat + 300);
      if (!ok0 || (await snap()).empty) {
        console.log(tag, game, 'no question (empty bank), skipped');
        await tapEl(p.locator('.lq-back'));
        await p.waitForSelector('.lq-cards');
        continue;
      }
      for (let r = 0; r < ROUNDS; r++) { try {
        const gap = GAP[r % GAP.length];
        const see = SEE[r % SEE.length];
        let s = await snap();
        if (s.empty) break;
        if (s.answered) {
          await tapEl(nextLoc());
          await waitQuestion(s.qcount);
          await p.waitForTimeout(lat + 700);
          s = await snap();
        }
        const npick = await p.locator('.lq-stage :is(.lq-choice,.lq-tag,.lq-line,.lq-port)').count();
        const i = kind === 'order' ? 0 : (r + 1) % Math.max(1, Math.min(npick, kind === 'port' ? 30 : 4));

        // E. Double tap on Skip (one question skipped, the next left alone).
        if (r % 2 === 0) {
          const B = `E skip-double ${kind}`;
          const sk = p.locator('.lq-skip-btn, .lq-skip .link-btn').first();
          if (await sk.count()) {
            await sk.scrollIntoViewIfNeeded();
            await p.waitForTimeout(500);
            const before = await snap();
            const bb = await sk.boundingBox();
            const at = center([bb.x, bb.y, bb.width, bb.height]);
            await tap(...at);
            await p.waitForTimeout(gap);
            await tap(...at);
            await waitQuestion(before.qcount);
            await settle();
            await p.waitForTimeout(lat);
            const sE = await snap();
            const keys = await p.evaluate((n) => window.__lq.qlog.slice(n).map((q) => q.key.split('#')[0] || q.key), before.qcount);
            bump(B, 'taps');
            if (sE.empty) bump(B, 'ok');
            else if (sE.pkey === before.pkey) (bump(B, 'dropped'), note(B, `Skip did nothing (${c.name} ${lat} gap ${gap})`));
            else if (sE.answered || sE.dialog) (bump(B, 'wrong'), note(B, `2nd tap answered or opened something (${c.name} ${lat} gap ${gap})`));
            else if (new Set(keys).size > 1) (bump(B, 'double'), note(B, `skipped twice (${c.name} ${lat} gap ${gap})`));
            else bump(B, 'ok');
            if ((await snap()).empty) break;
          }
        }
        // A. Double tap on the answer (the second tap must do nothing).
        {
          const B = `A answer-double ${kind}`;
          const before = await snap();
          const { at, want } = await prepare(kind, i);
          await tap(...at);
          await p.waitForTimeout(gap);
          await tap(...at);
          await settle();
          const s2 = await snap();
          bump(B, 'taps');
          if (s2.pkey !== before.pkey) (bump(B, 'wrong'), note(B, `2nd tap hit Next (${c.name} ${lat} gap ${gap})`));
          else if (s2.dialog) (bump(B, 'wrong'), note(B, `2nd tap opened Report (${c.name} ${lat} gap ${gap})`));
          else if (!s2.answered) (bump(B, 'dropped'), note(B, `answer not taken (${c.name} ${lat} gap ${gap})`));
          else if (!answeredRight(kind, s2, want)) (bump(B, 'wrong'), note(B, `answered ${s2.given} not ${want}`));
          else bump(B, 'ok');
          if (s2.dialog) {
            await p.keyboard.press('Escape');
            await p.waitForTimeout(200);
          }
        }
        // B. Double tap on Next (exactly one new question, left alone).
        let s3 = await snap();
        if (s3.answered) {
          const B = `B next-double ${kind}`;
          await nextLoc().scrollIntoViewIfNeeded();
          await p.waitForTimeout(500);
          const nb = await nextLoc().boundingBox();
          const at = center([nb.x, nb.y, nb.width, nb.height]);
          await tap(...at);
          await p.waitForTimeout(gap);
          await tap(...at);
          await waitQuestion(s3.qcount);
          await settle();
          await p.waitForTimeout(lat);
          const s4 = await snap();
          bump(B, 'taps');
          if (s4.pkey === s3.pkey) (bump(B, 'dropped'), note(B, `Next didn't load (${c.name} ${lat} gap ${gap})`));
          else if (s4.answered) (bump(B, 'wrong'), note(B, `2nd tap answered the new question (${c.name} ${lat} gap ${gap})`));
          else if (s4.line >= 0 || s4.port >= 0) (bump(B, 'wrong'), note(B, `2nd tap picked a ${kind === 'code' ? 'line' : 'port'} (${c.name} ${lat} gap ${gap})`));
          else if (s4.dialog) (bump(B, 'wrong'), note(B, `2nd tap opened a dialog`));
          else if (kind === 'order' && s4.order !== (await p.evaluate(() => window.__lq.qlog.at(-1).order))) (bump(B, 'wrong'), note(B, `2nd tap moved a timeline item (${c.name} ${lat} gap ${gap})`));
          else {
            // More than one new prompt since the tap: two questions went by.
            const keys = await p.evaluate((n) => window.__lq.qlog.slice(n).map((q) => q.key.split('#')[0] || q.key), s3.qcount);
            if (new Set(keys).size > 1) (bump(B, 'double'), note(B, `loaded twice (${c.name} ${lat} gap ${gap})`));
            else bump(B, 'ok');
          }
          if (s4.dialog) {
            await p.keyboard.press('Escape');
            await p.waitForTimeout(200);
          }
        }
        // C + D. Intended taps: answer, then tap Next where it first showed
        // (`see` ms later); then tap a pick where it first showed on the new
        // question (`see` ms later).
        let s5 = await snap();
        if (s5.empty) break;
        if (s5.answered) {
          await tapEl(nextLoc());
          await waitQuestion(s5.qcount);
          await p.waitForTimeout(lat + 700);
        }
        s5 = await snap();
        {
          const { at } = await prepare(kind, (i + 1) % Math.max(1, Math.min(npick, 4)));
          const fbBefore = await p.evaluate(() => window.__lq.fblog.length);
          await tap(...at);
          const got = await p
            .waitForFunction((n) => window.__lq.fblog.length > n, fbBefore, { polling: 'raf', timeout: lat + 3000 })
            .then(() => true)
            .catch(() => false);
          if (!got) {
            console.log(tag, game, 'feedback never showed', JSON.stringify(await snap()));
            continue;
          }
          const fb = await p.evaluate(() => window.__lq.fblog.at(-1));
          const vh = c.ctx.viewport.height;
          const D = `D next-as-seen ${kind}`;
          const nAt = center(fb.next);
          const qBefore = (await snap()).qcount;
          if (nAt[1] < 0 || nAt[1] > vh - 60) {
            // Next wasn't on screen when the feedback showed: the user has to scroll for it.
            bump(D, 'taps');
            bump(D, 'ok');
            note(D, `Next off screen at first (${c.name} ${lat}): y=${Math.round(nAt[1])}`);
            await nextLoc().scrollIntoViewIfNeeded();
            await p.waitForTimeout(500);
            await tapEl(nextLoc());
          } else {
            await p.evaluate((wait) => new Promise((res) => setTimeout(res, Math.max(0, window.__lq.fblog.at(-1).at + wait - performance.now()))), see);
            await tap(...nAt);
            bump(D, 'taps');
          }
          const loaded = await waitQuestion(qBefore);
          const s6 = await snap();
          if (!(nAt[1] < 0 || nAt[1] > vh - 60)) {
            if (s6.dialog) (bump(D, 'wrong'), note(D, `tap meant for Next opened Report (${c.name} ${lat} see ${see})`), await p.keyboard.press('Escape'));
            else if (!loaded) (bump(D, 'dropped'), note(D, `tap meant for Next did nothing (${c.name} ${lat} see ${see})`));
            else bump(D, 'ok');
          }
          if (!loaded) {
            await nextLoc().scrollIntoViewIfNeeded().catch(() => {});
            await p.waitForTimeout(500);
            const q0 = (await snap()).qcount;
            await tapEl(nextLoc()).catch(() => {});
            await waitQuestion(q0);
          }
          if ((await snap()).empty) break;
          // C. The new question's pick, tapped where it was first drawn.
          const C = `C pick-as-seen ${kind}`;
          const q = await p.evaluate(() => window.__lq.qlog.at(-1));
          const k = kind === 'order' ? 1 : (r + 2) % Math.max(1, Math.min(q.pick.length, 4));
          const rr = kind === 'order' ? q.earlier[k] : q.pick[k];
          if (!rr) continue;
          const pAt = center(rr);
          if (pAt[1] < 0 || pAt[1] > vh - 60) {
            bump(C, 'taps');
            bump(C, 'ok');
            note(C, `pick off screen at first (${c.name})`);
            continue;
          }
          const sBefore = await snap();
          await p.evaluate((wait) => new Promise((res) => setTimeout(res, Math.max(0, window.__lq.qlog.at(-1).at + wait - performance.now()))), READ[r % READ.length]);
          await tap(...pAt);
          await settle();
          const s7 = await snap();
          bump(C, 'taps');
          const expect =
            kind === 'choice' || kind === 'tag'
              ? s7.answered && s7.given === k
              : kind === 'code'
                ? s7.line === k
                : kind === 'port'
                  ? s7.port === k
                  : s7.order !== sBefore.order && s7.order.split('|')[k - 1] === sBefore.order.split('|')[k];
          const nothing = kind === 'choice' || kind === 'tag' ? !s7.answered : kind === 'code' ? s7.line < 0 : kind === 'port' ? s7.port < 0 : s7.order === sBefore.order;
          if (expect) bump(C, 'ok');
          else if (nothing && s7.qcount === sBefore.qcount && !s7.dialog) (bump(C, 'dropped'), note(C, `pick did nothing (${c.name} ${lat} see ${see})`));
          else (bump(C, 'wrong'), note(C, `tap hit something else (${c.name} ${lat} see ${see}): ${JSON.stringify({ given: s7.given, line: s7.line, port: s7.port, k })}`));
          if (s7.dialog) await p.keyboard.press('Escape');
        }
      } catch (e) {
        harnessErrors++;
        console.log(tag, game, 'harness error, next game:', e.message.split('\n')[0], JSON.stringify(await snap().catch(() => ({}))));
        break;
      } }
      await tapEl(p.locator('.lq-back'));
      await p.waitForSelector('.lq-cards');
      await p.waitForTimeout(200);
    }

    // The auto planner: double tap Run it (the result must stay).
    curGame = 'Auto';
    if (!ONLY_GAME || ONLY_GAME === 'Auto') {
      await tapEl(p.locator('.lq-card', { hasText: 'Auto path planner' }).first());
      await p.waitForSelector('.lq-field');
      for (let r = 0; r < ROUNDS; r++) {
        const gap = GAP[r % GAP.length];
        const B = 'A auto-run-double';
        if (await p.locator('.lq-auto-tools .btn.primary', { hasText: 'Draw another' }).count()) {
          await tapEl(p.locator('.lq-auto-tools .btn.primary'));
          await p.waitForTimeout(400);
        }
        await p.locator('.lq-field').scrollIntoViewIfNeeded();
        const box = await p.locator('.lq-field').boundingBox();
        const k = box.width / 156;
        const atF = (x, y) => [box.x + (x + 6) * k, box.y + (y + 6) * k];
        await p.locator('.lq-f-start rect').nth(1).dispatchEvent('pointerdown');
        await p.waitForTimeout(200);
        const pts = [[9, 72], [20, 72], [30, 72], [30, 60], [30, 48], [22, 42], [15, 40]];
        await p.mouse.move(...atF(...pts[0]));
        await p.mouse.down();
        for (const pt of pts.slice(1)) await p.mouse.move(...atF(...pt), { steps: 4 });
        await p.mouse.up();
        await p.waitForTimeout(300);
        const run = p.locator('.lq-auto-tools .btn.primary');
        await run.scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const bb = await run.boundingBox();
        const at = center([bb.x, bb.y, bb.width, bb.height]);
        await tap(...at);
        await p.waitForTimeout(gap);
        await tap(...at);
        await settle();
        bump(B, 'taps');
        const shown = await p.locator('.lq-auto-best').count();
        if (shown) bump(B, 'ok');
        else (bump(B, 'wrong'), note(B, `2nd tap hit Draw another and threw the run away (${c.name} ${lat} gap ${gap})`));
      }
      await tapEl(p.locator('.lq-back'));
      await p.waitForSelector('.lq-cards');
    }
    await ctx.close();

    // The daily card in #general: double tap an answer (fresh demo each time).
    curGame = 'Daily';
    for (let r = 0; r < (ONLY_GAME && ONLY_GAME !== 'Daily' ? 0 : Math.min(ROUNDS, 4)); r++) {
      const gap = GAP[r % GAP.length];
      const B = 'A daily-double';
      const dctx = await b.newContext({ ...c.ctx });
      await dctx.addInitScript(([lat, release]) => {
        localStorage.setItem('welcome-seen-v1', 'true');
        localStorage.setItem('seen-version', JSON.stringify(release));
        localStorage.setItem('seen-log-3.0', 'true');
        localStorage.setItem('versions-renumbered', '1');
        localStorage.setItem('v246-merged', '1');
        localStorage.setItem('demo-learn-latency', String(lat));
      }, [lat, RELEASE]);
      const dp = await dctx.newPage();
      dp.on('pageerror', (e) => {
        pageErrors++;
        console.log('PAGE ERROR', e.message);
      });
      await dp.goto(`${BASE}/?demo`);
      await dp.waitForSelector('.app');
      await dp.evaluate(() => document.querySelector('.demo-banner')?.remove());
      // Learn's daily tile opens #general at the card.
      if (c.name === 'phone') {
        await dp.locator('.bottom-nav button', { hasText: 'More' }).first().tap();
        await dp.waitForTimeout(400);
        await dp.locator('.sheet button', { hasText: 'Learn' }).first().tap();
      } else await dp.locator('.sb-row', { hasText: 'Learn' }).first().click();
      await dp.waitForSelector('.lq-daily-tile');
      await dp.locator('.lq-daily-tile').tap();
      const card = await dp.waitForSelector('.lq-daily .lq-choice', { timeout: 6000 }).catch(() => null);
      if (!card) {
        console.log(tag, 'daily card not found');
        await dctx.close();
        continue;
      }
      await dp.waitForTimeout(1200);
      const ch = dp.locator('.lq-daily .lq-choice').nth(r % 2);
      await ch.scrollIntoViewIfNeeded();
      await dp.waitForTimeout(400);
      const bb = await ch.boundingBox();
      const at = center([bb.x, bb.y, bb.width, bb.height]);
      const clicks0 = await dp.evaluate(() => window.__lq?.clicks.length ?? 0);
      await dp.touchscreen.tap(...at);
      await dp.waitForTimeout(gap);
      await dp.touchscreen.tap(...at);
      await dp.waitForTimeout(lat + 600);
      bump(B, 'taps');
      const st = await dp.evaluate(() => {
        const els = [...document.querySelectorAll('.lq-daily .lq-choice')];
        let g = els.findIndex((e) => e.classList.contains('is-wrong'));
        if (g < 0) g = els.findIndex((e) => e.classList.contains('is-right') && !document.querySelector('.lq-daily-reveal.is-wrong'));
        return { done: !!document.querySelector('.lq-daily-reveal'), given: g, dialog: !!document.querySelector('.dialog, .panel-backdrop'), path: location.pathname + location.hash };
      });
      if (!st.done) (bump(B, 'dropped'), note(B, `daily answer not taken (${c.name} ${lat} gap ${gap})`));
      else if (st.dialog) (bump(B, 'wrong'), note(B, `2nd tap opened something (${c.name} ${lat} gap ${gap})`));
      else bump(B, 'ok');
      void clicks0;
      await dctx.close();
    }
    console.log('done', tag);
  }
await b.close();

let bad = 0;
console.log('\nper 100 taps (taps, wrong, dropped, double):');
for (const [k, v] of Object.entries(tally).sort()) {
  const per = (n) => ((100 * n) / v.taps).toFixed(0);
  console.log(`${k.padEnd(28)} n=${String(v.taps).padStart(3)}  wrong ${per(v.wrong).padStart(3)}  dropped ${per(v.dropped).padStart(3)}  double ${per(v.double).padStart(3)}`);
  for (const [n, cnt] of Object.entries(v.notes)) console.log(`    ${cnt}x ${n}`);
  bad += v.wrong + v.double;
}
const T = Object.values(tally).reduce((t, v) => ({ taps: t.taps + v.taps, wrong: t.wrong + v.wrong, dropped: t.dropped + v.dropped, double: t.double + v.double }), { taps: 0, wrong: 0, dropped: 0, double: 0 });
console.log(`ALL n=${T.taps} wrong/100 ${((100 * T.wrong) / T.taps).toFixed(1)} dropped/100 ${((100 * T.dropped) / T.taps).toFixed(1)} double/100 ${((100 * T.double) / T.taps).toFixed(1)}  page errors ${pageErrors}  harness errors ${harnessErrors}`);
process.exit(bad || pageErrors ? 1 : 0);
