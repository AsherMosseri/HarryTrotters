// No game or casino card may move under a tap. Real touch taps (a touch
// screen, taps at screen points) on every game card and game view in chat,
// in demo mode, while teammates keep posting, reacting and playing their own
// cards above and below yours.
//
//   npx vite build && npx vite preview --port 5444 --strictPort &
//   node scripts/test-no-shift.mjs [options]
//
//   --port 5444          the preview (demo mode, ?demo)
//   --vp phone,ipad,land phone 390x844, iPad upright 820x1180, iPad on its side 1180x820
//   --engine safari      Chromium with scroll anchoring off (* { overflow-anchor: none
//                        !important }): Safari has none (the default)
//            chromium    Chromium as it is
//            webkit      Playwright's WebKit (PLAYWRIGHT_BROWSERS_PATH must have it)
//   --only mines,crash   games to play (default: all, see GAMES): mines (and minesfirst,
//                        minesfast, minesstale), blackjack, highlow, crash, slots, dice,
//                        coinflip, roulette, lottery (Buy), challenge (Accept, Decline,
//                        Cancel, Report), rps, tictactoe, connect4 (card and game view),
//                        duel, heist (Join), trivia, hangman, typerace, battleship (card
//                        and game view), launch (Tetris/Minesweeper Play), economy
//                        (/daily, /balance, /leaderboard), owner (Refund, Undo gift and
//                        their confirms), request (Pay, Decline), learn
//                        (the daily question in #general)
//   --rounds 2           rounds per game (one trivia, hangman, type race or request runs at
//                        a time: list a viewport twice, --vp phone,phone, for more of those)
//   --lag 150            demo answers to moves come this late (ms), like a server
//   --quiet              no busy chat
//   --json out.json      every tap's record
//   --slow               every tap after a 5-10 s pause, with a message arriving as it lands
//   -v                   print every tap
//
// Per tap, from the finger coming down until the move's answer has shown and
// settled (lag + 1.4 s):
//   moved  - the control the finger aimed at (or, once it's gone, its card)
//            moved on screen by more than 2 px
//   wrong  - the finger landed on something other than what it aimed at
//            (the screen moved between aiming and the tap)
//   next   - afterwards the same spot is a different control (the next tap
//            there wouldn't hit what the player expects)
// and how far the chat (and the page) scrolled. Some taps come after a pause
// longer than the chat's 4 s card hold, with a teammate's message arriving
// just as the finger comes down. Exit code 1 on any moved, wrong or next.
import { createRequire } from 'module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);

function playwright() {
  for (const paths of [null, ['/opt/node-tools/node_modules'], ['/usr/local/lib/node_modules']]) {
    try {
      return require(paths ? require.resolve('playwright', { paths }) : 'playwright');
    } catch {
      /* next */
    }
  }
  throw new Error('Playwright is needed (npm i -g playwright, or /opt/node-tools)');
}

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const PORT = Number(opt('port', 5444));
const BASE = `http://localhost:${PORT}`;
const VPS = opt('vp', 'phone,ipad,land').split(',');
const ENGINE = opt('engine', 'safari');
const ROUNDS = Number(opt('rounds', 2));
const LAG = Number(opt('lag', 150));
const BUSY = !argv.includes('--quiet');
const JSON_OUT = opt('json', '');
const VERBOSE = argv.includes('-v');
// --slow: every tap comes after a 5-10 s pause (the chat's card hold long
// over), with a teammate's message arriving as the finger comes down.
const SLOW = argv.includes('--slow');
const SIZES = {
  phone: { width: 390, height: 844, phone: true },
  ipad: { width: 820, height: 1180 },
  land: { width: 1180, height: 820 },
};
// The version this build says it is, so the "What's new" card doesn't cover the chat.
const RELEASE = await fetch(`${BASE}/version.json`)
  .then((r) => r.json())
  .then((j) => j.release)
  .catch(() => '3.1');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// ---------- in the page ----------

function inPage({ engine, busy }) {
  if (engine === 'safari') {
    const add = () => {
      const s = document.createElement('style');
      s.textContent = '* { overflow-anchor: none !important; }';
      document.head.appendChild(s);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add);
  }
  const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
  const CTL = 'button, input, textarea, select, a[href], [role="button"]';
  const ctlOf = (el) => (el && el.closest ? el.closest(CTL) : null);
  // What a control belongs to: the game view, a message, or a dialog.
  const holderOf = (el) =>
    (el && el.closest && (el.closest('.game-sheet[data-msg]') || el.closest('.msg[id]') || el.closest('[role="dialog"], [role="alertdialog"]'))) || null;
  const holderKey = (h) => (!h ? 'out' : h.dataset.msg ? `view:${h.dataset.msg}` : h.id ? h.id : 'dialog');
  // A control's identity: where it is, its kind and place among its kind, and
  // (outside grids) the first word on it.
  const keyOf = (el) => {
    if (!el) return 'none';
    const hk = holderKey(holderOf(el));
    const c = ctlOf(el);
    if (!c) return `${hk}|body`;
    if (c.dataset.i != null) return `${hk}|i${c.dataset.i}`;
    const kind = (x) => x.classList[0] || x.tagName.toLowerCase();
    const sibs = c.parentElement ? [...c.parentElement.children].filter((x) => kind(x) === kind(c)) : [c];
    const i = sibs.indexOf(c);
    if (sibs.length >= 6) return `${hk}|${kind(c)}#${i}`;
    const word = ((c.getAttribute('aria-label') || c.textContent || '').match(/[A-Za-z]+/) || [''])[0].toLowerCase();
    return `${hk}|${kind(c)}#${i}:${word}`;
  };
  // Where a control is laid out (its own little animations, a shake or a
  // flip, don't count): its offset in its positioned parent.
  const spot = (el) => {
    const op = el.offsetParent;
    if (!op) return el.getBoundingClientRect();
    const r = op.getBoundingClientRect();
    return { top: r.top + op.clientTop + el.offsetTop, left: r.left + op.clientLeft + el.offsetLeft };
  };
  const holderByKey = (k) => (k.startsWith('view:') ? document.querySelector(`.game-sheet[data-msg="${k.slice(5)}"]`) : k.startsWith('msg-') ? document.getElementById(k) : null);
  const find = (key) => {
    const h = holderByKey(key.split('|')[0]);
    if (!h) return null;
    if (key.endsWith('|body')) return h;
    return [...h.querySelectorAll(CTL)].find((x) => keyOf(x) === key) || null;
  };
  const scrollers = () => {
    const out = { list: document.querySelector('.msg-list'), page: document.scrollingElement, root: document.getElementById('root') };
    const v = document.querySelector('.game-sheet .gv-body');
    if (v) out.view = v;
    return out;
  };
  const ns = {
    rec: null,
    keyOf,
    // Arm one tap: the control marked data-ns-aim, aimed at (its box then) at x, y.
    arm({ x, y, aimTop, aimLeft, watch, label }) {
      const aimEl = document.querySelector('[data-ns-aim]');
      const want = keyOf(aimEl);
      const rec = { label, want, x, y, t0: null, done: false, moved: 0, movedCard: 0, movedAt: null, scroll: {}, pre: 0 };
      ns.rec = rec;
      const start = (e) => {
        if (rec.t0 != null) return;
        rec.t0 = performance.now();
        const t = e.touches?.[0] ? document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY) : e.target;
        rec.hit = keyOf(t);
        rec.hitTag = t ? `${t.tagName.toLowerCase()}.${String(t.className || '').split(' ')[0]}` : '';
        // The control was gone by then, its card where it was (the game ended
        // on its own: Trotbot shot first): nothing moved, there was nothing to hit.
        rec.gone = !(aimEl && aimEl.isConnected && !aimEl.disabled);
        const el = aimEl && aimEl.isConnected ? aimEl : find(want);
        const r = el ? spot(el) : null;
        const b0 = el?.getBoundingClientRect();
        rec.top0 = r ? r.top : null;
        rec.left0 = r ? r.left : null;
        rec.pre = b0 ? Math.max(Math.abs(b0.top - aimTop), Math.abs(b0.left - aimLeft)) : 0;
        const card = holderByKey(want.split('|')[0]);
        rec.card0 = card ? card.getBoundingClientRect().top : null;
        rec.cardKey = want.split('|')[0];
        const sc = scrollers();
        rec.s0 = Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, v ? v.scrollTop : 0]));
        rec.vv0 = window.visualViewport ? window.visualViewport.offsetTop : 0;
        aimEl?.removeAttribute('data-ns-aim');
        let el0 = el;
        const loop = () => {
          const dt = performance.now() - rec.t0;
          const cur = el0 && el0.isConnected && keyOf(el0) === want ? el0 : find(want);
          el0 = cur;
          if (cur && rec.top0 != null) {
            const b = spot(cur);
            const d = Math.max(Math.abs(b.top - rec.top0), Math.abs(b.left - rec.left0));
            if (d > rec.moved) rec.moved = d;
            if (d > 2 && rec.movedAt == null) rec.movedAt = Math.round(dt);
          }
          const h = holderByKey(rec.cardKey);
          if (h && rec.card0 != null) {
            const d = Math.abs(h.getBoundingClientRect().top - rec.card0);
            if (d > rec.movedCard) rec.movedCard = d;
            if (d > 2 && rec.movedAt == null) rec.movedAt = Math.round(dt);
          }
          for (const [k, v] of Object.entries(scrollers())) {
            if (!v || rec.s0[k] == null) continue;
            rec.scroll[k] = Math.max(rec.scroll[k] || 0, Math.abs(v.scrollTop - rec.s0[k]));
          }
          if (window.visualViewport) rec.scroll.vv = Math.max(rec.scroll.vv || 0, Math.abs(window.visualViewport.offsetTop - rec.vv0));
          if (dt < watch) return requestAnimationFrame(loop);
          // The next tap at the same spot.
          const at = document.elementFromPoint(x, y);
          rec.nextKey = keyOf(at);
          rec.overlay = !!at?.closest?.('.panel-backdrop, [role="dialog"], [role="alertdialog"], .fun-dialog, .game-sheet') && !rec.want.startsWith('view:');
          const still = find(want);
          // (A dialog's OK closes it: nothing more to tap there.)
          rec.next = rec.overlay || rec.nextKey === want || (!still && (rec.nextKey.split('|')[0] === rec.cardKey || rec.cardKey === 'dialog'));
          rec.moved = Math.round(rec.moved * 10) / 10;
          rec.movedCard = Math.round(rec.movedCard * 10) / 10;
          rec.done = true;
        };
        requestAnimationFrame(loop);
      };
      addEventListener('touchstart', start, { capture: true, once: true });
      addEventListener('pointerdown', start, { capture: true, once: true });
    },
    // Teammates at work. conv: where; focus(): the message being played (for "above").
    busyConv: null,
    me: 'Asher Mosseri',
    focusId: null,
    n: 0,
    post(kind) {
      const conv = ns.busyConv;
      if (!conv) return;
      // Teammates: never the one playing (a message of yours takes the chat to the bottom, as it should).
      const people = ['Cooper Mlezcko', 'Sophia Lee', 'Ethan Park', 'Maya Patel', 'Liam Chen'].filter((x) => x !== ns.me);
      const by = people[Math.floor(Math.random() * people.length)];
      const n = ++ns.n;
      const lines = [
        'lol',
        'who has the 3/8 allen key',
        'anyone want to grab food after the meeting? the place on 5th is open late',
        'ok the intake is jamming again when the second ring comes in fast, we need to look at the roller spacing before Saturday',
        'nice',
        '😂😂',
        'GG',
      ];
      const reels = ['🔩', '⚙️', '🔋', '🔧', '🤖', '🏆', '💎'];
      const card = () => {
        const g = pick(['slots', 'dice', 'coinflip', 'roulette']);
        const net = Math.random() < 0.4 ? 5 : -5;
        const game = {
          slots: { reels: [pick(reels), pick(reels), pick(reels)], line: 'No match.' },
          dice: { you: [1 + (n % 6), 2], house: [3, 1 + ((n * 7) % 6)] },
          coinflip: { call: 'heads', side: net > 0 ? 'heads' : 'tails' },
          roulette: { n: n % 37, color: n % 2 ? 'red' : 'black', spot: 'red' },
        }[g];
        return { text: `/${g} 5`, cmd: { name: g, bet: 5, net, payout: net > 0 ? 10 : 0, status: 'done', game } };
      };
      const above = () => {
        const me = ns.focusId && document.getElementById(`msg-${ns.focusId}`);
        if (!me) return [];
        const all = [...document.querySelectorAll('.msg-list .msg[id]')];
        const i = all.indexOf(me);
        return all.slice(Math.max(0, i - 6), Math.max(0, i)).map((x) => x.id.slice(4));
      };
      const msgs = () => {
        try {
          return JSON.parse(localStorage.getItem('ftc32313-demo-v13') || '{}').chat?.[conv] || [];
        } catch {
          return [];
        }
      };
      kind = kind || pick(['text', 'text', 'text', 'card', 'mines', 'gif', 'react', 'react', 'unreact', 'edit', 'shrink']);
      const post = (m) => dispatchEvent(new CustomEvent('demo-post', { detail: { conv, m: { by, ...m } } }));
      const edit = (id, patch) => dispatchEvent(new CustomEvent('demo-edit', { detail: { conv, id, patch } }));
      if (kind === 'text') post({ text: pick(lines) });
      else if (kind === 'card') post(card());
      // Someone else starts their own Mines game.
      else if (kind === 'mines') post({ text: '/mines 5 3', cmd: { name: 'mines', bet: 5, status: 'playing', game: { bombs: 3, open: [], multiplier: 1 } } });
      else if (kind === 'gif') post({ text: '', gif: { url: `/__ns/gif-${n}.svg`, title: 'GIF' } });
      else {
        const ids = above();
        if (!ids.length) return post({ text: pick(lines) });
        const id = pick(ids);
        const m = msgs().find((x) => x.id === id);
        if (!m) return;
        if (kind === 'react') edit(id, { reactions: { ...(m.reactions || {}), [pick(['👍', '😂', '🔥', '✅', '🎉'])]: { [`u${n}`]: by } } });
        else if (kind === 'unreact' && Object.keys(m.reactions || {}).length) edit(id, { reactions: {} });
        else if (kind === 'edit' && !m.cmd && m.text) edit(id, { text: `${m.text} (and one more thing: ${pick(lines)})`, editedAt: Date.now() });
        else if (kind === 'shrink' && !m.cmd && m.text && m.text.length > 4) edit(id, { text: m.text.slice(0, 3), editedAt: Date.now() });
        else post({ text: pick(lines) });
      }
    },
    busy(on) {
      clearTimeout(ns.timer);
      if (!on) return;
      const tick = () => {
        ns.post();
        ns.timer = setTimeout(tick, 500 + Math.random() * 900);
      };
      ns.timer = setTimeout(tick, 400);
    },
  };
  // Every error line a card shows ("Pick a closed tile").
  ns.said = [];
  const watchErrors = () =>
    new MutationObserver(() => {
      for (const e of document.querySelectorAll('.casino-error')) {
        const t = e.textContent.trim();
        if (t && ns.said[ns.said.length - 1] !== t) ns.said.push(t);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  if (document.body) watchErrors();
  else addEventListener('DOMContentLoaded', watchErrors);
  window.__ns = ns;
  void busy;
}

// ---------- the harness ----------

const pw = playwright();
const browserType = ENGINE === 'webkit' ? pw.webkit : pw.chromium;
const browser = await browserType.launch();
const taps = [];
const logic = [];
const problems = [];
const errors = [];
// A picture sent slowly, with nothing on the page keeping its size (a GIF loading).
const IMG = '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160"><rect width="220" height="160" fill="#8ac"/></svg>';

async function newPage(vpName, as = '') {
  const vp = SIZES[vpName];
  const phone = !!vp.phone;
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: true,
    isMobile: phone,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  await ctx.addInitScript((release) => {
    if (sessionStorage.getItem('ns-seeded')) return;
    sessionStorage.setItem('ns-seeded', '1');
    localStorage.clear();
    localStorage.setItem('welcome-seen-v1', 'true');
    localStorage.setItem('seen-version', JSON.stringify(release));
    localStorage.setItem('seen-log-3.0', 'true');
    localStorage.setItem('versions-renumbered', '1');
    localStorage.setItem('v246-merged', '1');
  }, RELEASE);
  await ctx.addInitScript((lag) => localStorage.setItem('demo-lag', String(lag)), LAG);
  await ctx.addInitScript(inPage, { engine: ENGINE, busy: BUSY });
  // DEBUG_SCROLL=1: who scrolls the chat (printed with each tap that moved).
  if (process.env.DEBUG_SCROLL)
    await ctx.addInitScript(() => {
      const log = (window.__scrolls = []);
      const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
      Object.defineProperty(Element.prototype, 'scrollTop', {
        get: d.get,
        set(v) {
          if (this.classList?.contains('msg-list')) log.push(`${Math.round(performance.now())} set ${Math.round(this.scrollTop)}→${Math.round(v)} ${new Error().stack.split('\n').slice(1, 4).join(' < ')}`);
          return d.set.call(this, v);
        },
      });
      const st = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function (...a) {
        if (this.classList?.contains('msg-list')) log.push(`${Math.round(performance.now())} scrollTo ${JSON.stringify(a)} ${new Error().stack.split('\n').slice(1, 4).join(' < ')}`);
        return st.apply(this, a);
      };
      const si = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (...a) {
        log.push(`${Math.round(performance.now())} scrollIntoView ${this.className} ${new Error().stack.split('\n').slice(1, 4).join(' < ')}`);
        return si.apply(this, a);
      };
      addEventListener('scroll', (e) => e.target?.classList?.contains?.('msg-list') && log.push(`${Math.round(performance.now())} scroll event ${Math.round(e.target.scrollTop)}`), true);
      // Every message's height change, and what the chat holds for (data-live).
      const sizes = new Map();
      const ro = new ResizeObserver((es) => {
        for (const e of es) {
          const h = Math.round(e.target.getBoundingClientRect().height);
          const was = sizes.get(e.target);
          sizes.set(e.target, h);
          if (was != null && was !== h) log.push(`${Math.round(performance.now())} size ${e.target.id || e.target.className} ${was}→${h} top ${Math.round(e.target.getBoundingClientRect().top)}`);
        }
      });
      const watch = () => document.querySelectorAll('.msg-list > *').forEach((x) => ro.observe(x));
      setInterval(watch, 200);
      new MutationObserver((ms) => {
        for (const m of ms)
          if (m.attributeName === 'data-live') log.push(`${Math.round(performance.now())} data-live ${m.target.closest('.msg')?.id} ${m.oldValue}→${m.target.getAttribute('data-live')}`);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-live'], attributeOldValue: true });
    });
  await ctx.route('**/__ns/*', async (route) => {
    await sleep(rand(300, 900));
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: IMG });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${vpName}: ${e.message}`));
  p.vp = vpName;
  p.phone = phone;
  await p.goto(`${BASE}/?demo${as ? `=${as}` : ''}`);
  await p.waitForSelector('.shell, .bottom-nav', { timeout: 20000 });
  await p.waitForTimeout(800);
  return p;
}
async function goChannel(p, name) {
  await closeDialogs(p);
  await p.evaluate(() => document.querySelector('.demo-banner')?.remove());
  const got = p.locator('button:has-text("Got it")');
  if (await got.count()) await got.first().click({ force: true }).catch(() => {});
  if (p.phone) {
    const chat = p.locator('.bottom-nav button:has-text("Chat")');
    if (await chat.count()) await chat.click({ force: true });
    await p.waitForTimeout(300);
    // (Its label can carry an unread count: "#arcade (3)".)
    const sel = p.locator('select.channel-select');
    const value = await sel.locator('option').evaluateAll((os, n) => os.find((o) => o.textContent.trim().split(/\s/)[0] === `#${n}`)?.value, name);
    await sel.selectOption(value);
  } else await p.click(`.sidebar .sb-row:has-text("${name}")`);
  await p.waitForSelector('.composer textarea');
  await p.waitForTimeout(400);
  await p.evaluate(({ c, me }) => Object.assign(window.__ns, { busyConv: c, me }), { c: name, me: ME[p.who || 'asher'] });
}
// Switch who's playing (demo: one saved state, so it's a reload).
async function as(p, who, channel = 'arcade') {
  p.who = who;
  await p.evaluate(() => window.__ns.busy(false));
  await p.goto(`${BASE}/?demo${who === 'cooper' ? '=member' : ''}`);
  await p.waitForSelector('.shell, .bottom-nav', { timeout: 20000 });
  await p.waitForTimeout(600);
  await goChannel(p, channel);
  if (BUSY) await p.evaluate(() => window.__ns.busy(true));
}
async function send(p, text) {
  const t = p.locator('.composer textarea');
  await t.fill(text);
  await t.press('Enter');
  await p.waitForTimeout(150);
  if ((await t.inputValue()).trim()) await t.press('Enter');
  // Done typing: the keyboard goes away (the next taps are on the card).
  await t.evaluate((x) => x.blur());
}
// The newest card of a game in the chat (by: whose; teammates post their own
// cards of the same games all the time).
async function newest(p, game, { before = null, by = null, timeout = 8000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const id = await p.evaluate(
      ({ game, before, by }) => {
        const conv = window.__ns.busyConv || 'arcade';
        const msgs = JSON.parse(localStorage.getItem('ftc32313-demo-v13') || '{}').chat?.[conv] || [];
        const m = msgs.filter((x) => x.cmd?.name === game && (!by || x.by === by)).pop();
        return m && m.id !== before && document.querySelector(`#msg-${m.id} .cmd-card`) ? m.id : null;
      },
      { game, before, by },
    );
    if (id) return id;
    await sleep(100);
  }
  throw new Error(`no ${game} card`);
}
const ME = { asher: 'Asher Mosseri', cooper: 'Cooper Mlezcko' };
async function start(p, game, cmd, wait = 900) {
  const by = ME[p.who || 'asher'];
  const before = await p.evaluate(
    ({ game, by }) => {
      const msgs = JSON.parse(localStorage.getItem('ftc32313-demo-v13') || '{}').chat?.[window.__ns.busyConv || 'arcade'] || [];
      return msgs.filter((x) => x.cmd?.name === game && x.by === by).pop()?.id || null;
    },
    { game, by },
  );
  await send(p, cmd);
  const id = await newest(p, game, { before, by });
  await p.evaluate((id) => (window.__ns.focusId = id), id);
  await sleep(wait);
  return id;
}
const card = (p, id) => p.locator(`#msg-${id} .cmd-card`);

let current = { game: '', vp: '' };
// One tap, aimed like a person: look at the control (its box now), then the
// finger comes down a moment later near its middle. think: a pause first
// (longer than the chat's card hold); ambush: a teammate's message arrives
// as the finger comes down.
async function tap(p, loc, label, { think = false, ambush = false, watch = LAG + 1400, at = null, loose = false } = {}) {
  loc = loc.first();
  if (!(await loc.count())) return null;
  if (SLOW) {
    think = true;
    ambush = true;
  }
  if (think) await sleep(SLOW ? rand(5000, 10000) : 4400);
  // Something left open over the chat (a profile, a dialog): what opened it?
  // (Not the one the tap is in: a dialog's own button, the game view.)
  const cover = await loc.evaluate((el) => {
    const c = document.querySelector('.panel-backdrop, [role=dialog]:not(.game-sheet), [role=alertdialog]');
    return c && !c.contains(el) && !el.closest('.game-sheet') ? c.className : '';
  });
  if (cover) problems.push(`${current.vp} ${current.game}: "${cover}" open before "${label}" (the tap before: ${taps.at(-1)?.label} hit ${taps.at(-1)?.hit})`);
  // Off screen (or under the composer): scroll it in first, then aim.
  const inView = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const box = (el.closest('.gv-body, .game-sheet, .msg-list, [role="dialog"]') || document.documentElement).getBoundingClientRect();
    return r.top >= box.top + 4 && r.bottom <= Math.min(box.bottom, innerHeight) - 4;
  });
  if (!inView) {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await sleep(500);
  }
  await loc.evaluate((el) => {
    document.querySelectorAll('[data-ns-aim]').forEach((x) => x.removeAttribute('data-ns-aim'));
    el.setAttribute('data-ns-aim', '1');
  });
  const box = await loc.boundingBox();
  if (!box) return null;
  const jx = Math.min(6, box.width * 0.2);
  const jy = Math.min(6, box.height * 0.2);
  const x = at ? at.x : box.x + box.width / 2 + rand(-jx, jx);
  const y = at ? at.y : box.y + box.height / 2 + rand(-jy, jy);
  await p.evaluate((a) => window.__ns.arm(a), { x, y, aimTop: box.y, aimLeft: box.x, watch, label });
  if (ambush) await p.evaluate((k) => window.__ns.post(k), typeof ambush === 'string' ? ambush : pick(['text', 'text', 'mines', 'card']));
  await sleep(rand(110, 190));
  await p.touchscreen.tap(x, y);
  await p.waitForFunction(() => window.__ns.rec?.done, null, { timeout: watch + 8000 }).catch(() => {});
  const rec = await p.evaluate(() => window.__ns.rec);
  if (!rec || rec.t0 == null) {
    problems.push(`${current.vp} ${current.game} ${label}: the tap never arrived`);
    return null;
  }
  const r = {
    vp: current.vp,
    game: current.game,
    label,
    think,
    ambush,
    moved: rec.moved,
    movedCard: rec.movedCard,
    movedAt: rec.movedAt,
    pre: Math.round(rec.pre * 10) / 10,
    scroll: Math.round(rec.scroll.list || 0),
    page: Math.round(Math.max(rec.scroll.page || 0, rec.scroll.root || 0, rec.scroll.vv || 0)),
    view: Math.round(rec.scroll.view || 0),
    wrong: loose || (rec.gone && rec.pre <= 2) ? rec.hit.split('|')[0] !== rec.want.split('|')[0] : rec.hit !== rec.want,
    next: !loose && !rec.gone && !rec.next,
    gone: rec.gone,
    hit: rec.hit,
    hitTag: rec.hitTag,
    want: rec.want,
    nextKey: rec.nextKey,
  };
  r.shift = Math.max(r.moved, r.movedCard) > 2;
  taps.push(r);
  if (VERBOSE || r.shift || r.wrong || r.next)
    console.log(
      `${r.shift || r.wrong || r.next ? 'BAD ' : '    '}${r.vp} ${r.game} ${label}${think ? ' (after a pause)' : ''}${ambush ? ' (+msg)' : ''}: moved ${r.moved}/${r.movedCard}px${r.movedAt != null ? ` at ${r.movedAt}ms` : ''} pre ${r.pre} scroll ${r.scroll} page ${r.page}${r.gone ? ' (control gone)' : ''}${r.wrong ? ` WRONG hit ${r.hit} (${r.hitTag}) want ${r.want}` : ''}${r.next ? ` NEXT ${r.nextKey}` : ''}`,
    );
  // DEBUG_SCROLL: a picture of the screen right after a bad tap.
  if (process.env.DEBUG_SCROLL && (r.shift || r.wrong || r.next))
    await p.screenshot({ path: `${process.env.DEBUG_SCROLL_DIR || '.'}/bad-${r.vp}-${r.game}-${taps.length}.png` }).catch(() => {});
  if (process.env.DEBUG_SCROLL && (r.shift || r.wrong || r.next))
    console.log((await p.evaluate((t0) => window.__scrolls.filter((x) => +x.split(' ')[0] >= t0 - 1500), rec.t0)).join('\n'));
  await sleep(rand(120, 300));
  return r;
}
const btn = (p, id, re) => card(p, id).locator('button', { hasText: re }).filter({ visible: true });
const live = async (p, id) => (await card(p, id).locator('.cz-done').count()) === 0;
const closeDialogs = async (p) => {
  for (let k = 0; k < 3; k++) {
    if (!(await p.locator('.panel-backdrop, .fun-dialog, [role="dialog"]').count())) return;
    await p.keyboard.press('Escape');
    await sleep(300);
  }
};

// ---------- the games ----------

const GAMES = {
  async mines(p, r) {
    const id = await start(p, 'mines', '/mines 5 3');
    for (let k = 0; k < 5 && (await live(p, id)); k++) {
      if (k === 1) {
        // Just missing a tile: the gap between two (a touch screen may still give it to one of them).
        const ba = await card(p, id).locator('.mine-tile').nth(6).boundingBox();
        const bb = await card(p, id).locator('.mine-tile').nth(7).boundingBox();
        await tap(p, card(p, id).locator('.mines-grid'), 'the gap between tiles', { loose: true, at: { x: (ba.x + ba.width + bb.x) / 2, y: ba.y + ba.height / 2 } });
      }
      const open = card(p, id).locator('.mine-tile.open');
      if (k === 3 && (await open.count())) await tap(p, open.first(), 'an open tile again');
      const tiles = card(p, id).locator('.mine-tile:not(.open):not(:disabled)');
      const n = await tiles.count();
      if (!n) break;
      await tap(p, tiles.nth(Math.floor(Math.random() * n)), 'tile', { think: k === 0 || (r === 0 && k === 2), ambush: k === 0 || k === 2 });
    }
    const cash = btn(p, id, /Cash out/);
    if (await cash.count()) await tap(p, cash, 'Cash out', { think: r === 1, ambush: true });
    await tap(p, card(p, id).locator('.mine-tile:disabled').nth(12), 'a tile after the game');
  },
  // Asher's own report: his /mines card posted, someone else posted their own
  // /mines card before his first tap, and the chat moved his card up.
  async minesfirst(p) {
    const id = await start(p, 'mines', '/mines 5 3', 1200);
    const tiles = card(p, id).locator('.mine-tile:not(.open):not(:disabled)');
    await tap(p, tiles.nth(Math.floor(Math.random() * (await tiles.count()))), 'first tile', { ambush: 'mines' });
    if (await live(p, id)) await tap(p, tiles.nth(Math.floor(Math.random() * (await tiles.count()))), 'second tile', { think: true, ambush: 'mines' });
    const cash = btn(p, id, /Cash out/);
    if (await cash.count()) await tap(p, cash, 'Cash out', { think: true, ambush: 'mines' });
  },
  // Fast taps (100-400 ms apart, during the move before): the game must open
  // exactly the tiles tapped, in order (the queue keeps them; useMove).
  async minesfast(p) {
    const id = await start(p, 'mines', '/mines 5 1', 900);
    // The whole board on screen first (a person scrolls to it).
    await card(p, id).locator('.mines-grid').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await sleep(500);
    const want = [];
    for (let k = 0; k < 4; k++) {
      const tiles = card(p, id).locator('.mine-tile:not(.open):not(:disabled)');
      const n = await tiles.count();
      if (!n) break;
      // One element, found once (a locator would find the nth closed tile again
      // later, after the last tap's tile opened: its neighbor).
      const t = await tiles.nth(Math.floor(Math.random() * n)).elementHandle();
      const i = await t.evaluate((el) => [...el.parentElement.children].indexOf(el));
      if (want.includes(i) || !(await t.evaluate((el) => !el.disabled))) continue;
      const b = await t.boundingBox();
      await p.touchscreen.tap(b.x + b.width / 2 + rand(-5, 5), b.y + b.height / 2 + rand(-5, 5));
      want.push(i);
      await sleep(rand(100, 400));
    }
    await sleep(LAG * 5 + 1500);
    const m = await p.evaluate((id) => JSON.parse(localStorage.getItem('ftc32313-demo-v13') || '{}').chat?.arcade?.find((x) => x.id === id), id);
    const g = m?.cmd?.game || {};
    if (!m) problems.push(`${current.vp} mines fast taps: card ${id} not in the demo's saved state`);
    const got = [...(g.open || []), ...(g.hit != null ? [g.hit] : [])];
    // A bomb ends it: the taps after it don't open anything.
    const ok = got.length >= 1 && got.every((x, k) => x === want[k]) && (g.hit != null || got.length === want.length);
    logic.push({ vp: current.vp, want, got, ok });
    if (!ok || VERBOSE) console.log(`${ok ? '    ' : 'BAD '}${current.vp} mines fast taps: tapped ${want.join(',')} → opened ${got.join(',')}${g.hit != null ? ` (bomb at ${g.hit})` : ''} [${m?.cmd?.status} ${m?.by} said: ${(await p.evaluate(() => window.__ns.said)).join("/")}]`);
    if (await btn(p, id, /Cash out/).count()) await btn(p, id, /Cash out/).first().click();
  },
  // A slow connection: the card's snapshot comes 2-3 s after the play answer
  // (round 2: an answer without the card, like the server before 3.1.1). The
  // tile tapped again, then a neighbor: no "Pick a closed tile", only those
  // two tiles opened, in order.
  async minesstale(p, r) {
    // (A quiet chat: anyone else's message would bring the card up to date.)
    await p.evaluate((r) => {
      window.__ns.busy(false);
      localStorage.setItem('demo-snap-lag', '2000-3000');
      if (r % 2) localStorage.setItem('demo-no-card', '1');
      window.__ns.said = [];
    }, r);
    try {
      const id = await start(p, 'mines', '/mines 5 1', 3500);
      const tile = (i) => card(p, id).locator('.mine-tile').nth(i);
      const a = Math.floor(Math.random() * 20);
      const b = a + 1 + (a % 5 === 4 ? 4 : 0);
      const want = [a];
      await tap(p, tile(a), 'a tile', { watch: LAG + 300 });
      await sleep(rand(450, 900));
      await tap(p, tile(a), 'the same tile again (card not caught up)', { watch: 300, loose: true });
      await tap(p, tile(b), 'its neighbor', { watch: 300 });
      want.push(b);
      await sleep(LAG + 4000);
      const m = await p.evaluate((id) => JSON.parse(localStorage.getItem('ftc32313-demo-v13') || '{}').chat?.arcade?.find((x) => x.id === id), id);
      const g = m?.cmd?.game || {};
      const got = [...(g.open || []), ...(g.hit != null ? [g.hit] : [])];
      const said = await p.evaluate(() => window.__ns.said);
      const ok = got.every((x, k) => x === want[k]) && (g.hit != null || got.length === want.length) && !said.some((t) => /closed tile|didn.t go through/i.test(t));
      logic.push({ vp: current.vp, want, got, said, ok, stale: true });
      if (!ok || VERBOSE)
        console.log(`${ok ? '    ' : 'BAD '}${current.vp} mines, slow card${r % 2 ? ', no card in the answer' : ''}: tapped ${want.join(',')} → opened ${got.join(',')}${said.length ? ` · said: ${said.join(' / ')}` : ''}`);
      if (await btn(p, id, /Cash out/).count()) await btn(p, id, /Cash out/).first().click();
      await sleep(3000);
    } finally {
      await p.evaluate((busy) => {
        localStorage.removeItem('demo-snap-lag');
        localStorage.removeItem('demo-no-card');
        window.__ns.busy(busy);
      }, BUSY);
    }
  },
  async blackjack(p, r) {
    const id = await start(p, 'blackjack', '/blackjack 5');
    for (let k = 0; k < 5 && (await live(p, id)); k++) {
      const v = Number((await card(p, id).locator('.bj-hand').nth(1).locator('.cz-chip').textContent().catch(() => '20')) || 20);
      const dbl = btn(p, id, /^Double/);
      if (k === 0 && r === 1 && (await dbl.isEnabled().catch(() => false))) await tap(p, dbl, 'Double', { think: true, ambush: true });
      else if (v < 16) await tap(p, btn(p, id, /^Hit/), 'Hit', { think: k === 0, ambush: k === 0 });
      else await tap(p, btn(p, id, /^Stand/), 'Stand', { ambush: true });
    }
  },
  async highlow(p, r) {
    const id = await start(p, 'highlow', '/highlow 5');
    for (let k = 0; k < 3 && (await live(p, id)); k++) {
      const subs = await card(p, id).locator('.cz-actions button').evaluateAll((bs) => bs.slice(0, 2).map((b) => (b.disabled ? 99 : parseFloat(b.querySelector('.cz-sub')?.textContent) || 99)));
      const which = subs[0] <= subs[1] ? /Higher/ : /Lower/;
      await tap(p, btn(p, id, which), String(which).replace(/\W/g, ''), { think: k === 0 && r === 0, ambush: k !== 1 });
    }
    if (await live(p, id)) await tap(p, btn(p, id, /Cash out/), 'Cash out', { ambush: true });
  },
  async crash(p, r) {
    const id = await start(p, 'crash', '/crash 5', 300);
    await sleep(r ? 1600 : 700);
    await tap(p, btn(p, id, /Cash out/), 'Cash out', { ambush: true });
  },
  async slots(p) {
    const id = await start(p, 'slots', '/slots 5', 2600);
    await tap(p, card(p, id).locator('.cz-machine'), 'the machine');
    await report(p, id);
  },
  async dice(p) {
    const id = await start(p, 'dice', '/dice 5', 2200);
    await tap(p, card(p, id).locator('.cz-table'), 'the table');
    await dare(p, id);
    await report(p, id);
  },
  async coinflip(p) {
    const id = await start(p, 'coinflip', '/coinflip 5 heads', 2400);
    await dare(p, id);
    await report(p, id);
  },
  async roulette(p) {
    const id = await start(p, 'roulette', '/roulette 5 red', 2600);
    await tap(p, card(p, id).locator('.cz-table'), 'the wheel');
    await report(p, id);
  },
  async lottery(p) {
    const id = await start(p, 'lottery', '/lottery');
    await tap(p, btn(p, id, /Buy 1/), 'Buy 1', { think: true, ambush: true });
    await tap(p, btn(p, id, /Buy 1/), 'Buy 1');
  },
  async challenge(p, r) {
    // Asher dares Cooper; Cooper accepts (or declines); Asher cancels one.
    const kind = r % 2 ? 'coinflip' : 'dice';
    await start(p, 'challenge', `/challenge @Cooper ${kind} 5${kind === 'coinflip' ? ' heads' : ''}`, 500);
    await as(p, 'cooper');
    let id = await newest(p, 'challenge', { by: ME.asher });
    await p.evaluate((id) => (window.__ns.focusId = id), id);
    await tap(p, btn(p, id, r % 2 ? /^Decline/ : /^Accept/), r % 2 ? 'Decline' : 'Accept', { think: true, ambush: true, watch: LAG + 2400 });
    await report(p, id);
    await as(p, 'asher');
    id = await start(p, 'challenge', '/challenge @Cooper dice 5', 500);
    await tap(p, btn(p, id, /^Cancel/), 'Cancel', { ambush: true });
  },
  async rps(p) {
    const id = await start(p, 'rps', '/rps @Trotbot');
    await tap(p, card(p, id).locator('.rps-picks button').nth(Math.floor(Math.random() * 3)), 'rock/paper/scissors', { think: true, ambush: true });
  },
  async tictactoe(p) {
    const id = await start(p, 'tictactoe', '/tictactoe @Trotbot');
    for (let k = 0; k < 4; k++) {
      const cells = card(p, id).locator('.ttt-cell:not(:disabled)');
      const n = await cells.count();
      if (!n) break;
      await tap(p, cells.nth(Math.floor(Math.random() * n)), 'square', { think: k === 0, ambush: k < 2, watch: LAG + 2200 });
    }
    await view(p, id, '.ttt-cell');
  },
  async connect4(p) {
    const id = await start(p, 'connect4', '/connect4 @Trotbot');
    for (let k = 0; k < 4; k++) {
      const cols = card(p, id).locator('.c4-col:not(:disabled)');
      const n = await cols.count();
      if (!n) break;
      await tap(p, cols.nth(Math.floor(Math.random() * n)), 'column', { think: k === 0, ambush: k < 2, watch: LAG + 2200 });
    }
    await view(p, id, '.c4-col');
  },
  async duel(p) {
    const id = await start(p, 'duel', '/duel @Trotbot', 300);
    await p.waitForSelector(`#msg-${id} .duel-shoot.primary`, { timeout: 15000 }).catch(() => {});
    await tap(p, card(p, id).locator('.duel-shoot'), 'SHOOT', { ambush: true });
  },
  async heist(p) {
    await start(p, 'heist', '/heist 5', 400);
    await as(p, 'cooper');
    const id = await newest(p, 'heist', { by: ME.asher });
    await p.evaluate((id) => (window.__ns.focusId = id), id);
    await tap(p, btn(p, id, /Join/), 'Join', { think: true, ambush: true });
    await as(p, 'asher');
  },
  async trivia(p) {
    const id = await start(p, 'trivia', '/trivia');
    await tap(p, card(p, id).locator('.trivia-choice').nth(Math.floor(Math.random() * 4)), 'answer', { think: true, ambush: true });
  },
  async hangman(p) {
    const id = await start(p, 'hangman', '/hangman');
    for (const L of ['E', 'A', 'R', 'S', 'T', 'O']) {
      const key = card(p, id).locator('.hang-key:not(:disabled)', { hasText: new RegExp(`^${L}$`) });
      if (!(await key.count())) break;
      await tap(p, key, 'letter', { think: L === 'E', ambush: L !== 'A' });
    }
    if (await card(p, id).locator('.hang-solve input').count()) await tap(p, card(p, id).locator('.hang-solve input'), 'the solve box', { ambush: true });
    await p.evaluate(() => document.activeElement?.blur?.());
  },
  async typerace(p) {
    const id = await start(p, 'typerace', '/typerace', 300);
    await p.waitForSelector(`#msg-${id} .race-input`, { timeout: 20000 }).catch(() => {});
    await tap(p, card(p, id).locator('.race-input'), 'the typing box', { ambush: true });
    await p.keyboard.type('The ', { delay: 60 });
    await p.evaluate(() => document.activeElement?.blur?.());
  },
  async battleship(p) {
    const id = await start(p, 'battleship', '/battleship @Trotbot', 600);
    await tap(p, card(p, id).locator('.game-open'), 'Open (place ships)', { ambush: true });
    const sheet = p.locator(`.game-sheet[data-msg="${id}"]`);
    await sheet.waitFor({ timeout: 6000 }).catch(() => {});
    const ready = sheet.locator('button', { hasText: /^Ready/ });
    if (await ready.count()) await tap(p, ready, 'Ready', { watch: LAG + 2000 });
    await sleep(800);
    for (let k = 0; k < 6; k++) {
      const cells = sheet.locator('[data-board="target"] [data-i]:not(:disabled)');
      const n = await cells.count();
      if (!n) break;
      await tap(p, cells.nth(Math.floor(Math.random() * n)), 'fire', { ambush: k % 2 === 0, think: k === 3, watch: LAG + 2400 });
    }
    await closeDialogs(p);
    await tap(p, card(p, id).locator('.game-open'), 'Open (again)');
    await closeDialogs(p);
  },
  async launch(p) {
    // A posted Tetris / Minesweeper result: its Play button opens the game.
    for (const [g, line] of [
      ['tetris', '12,840 points · level 7'],
      ['minesweep', 'Cleared in 48.2 s'],
    ]) {
      await p.evaluate(
        ({ g, line }) =>
          dispatchEvent(
            new CustomEvent('demo-post', {
              detail: { conv: 'arcade', m: { by: 'Sophia Lee', text: `/${g}`, cmd: { name: g, share: true, mode: g === 'tetris' ? 'marathon' : 'classic', level: 'beginner', line } } },
            }),
          ),
        { g, line },
      );
      const id = await newest(p, g);
      await p.evaluate((id) => (window.__ns.focusId = id), id);
      await sleep(400);
      await tap(p, btn(p, id, /^Play/), `Play ${g}`, { ambush: true });
      await closeDialogs(p);
      await sleep(300);
    }
  },
  async request(p, r) {
    await start(p, 'request', '/request @Cooper 5 for pizza', 400);
    await as(p, 'cooper');
    const id = await newest(p, 'request', { by: ME.asher });
    await p.evaluate((id) => (window.__ns.focusId = id), id);
    if (r % 2) await tap(p, btn(p, id, /^Decline/), 'Decline', { think: true, ambush: true });
    else {
      await tap(p, btn(p, id, /^Pay/), 'Pay', { think: true, ambush: true });
      const ok = p.locator('.dialog.ask button', { hasText: /^Pay/ });
      if (await ok.count()) await tap(p, ok, 'Pay (confirm)');
    }
    await as(p, 'asher');
  },
  async economy(p) {
    for (const cmd of ['/daily', '/balance', '/leaderboard']) {
      const g = cmd.slice(1);
      const id = await start(p, g, cmd, 600);
      const name = card(p, id).locator('.cmd-name, .name-btn').filter({ visible: true });
      if (await name.count()) {
        await tap(p, name.first(), `${g}: a name`, { ambush: true });
        await closeDialogs(p);
      }
      // (Its middle can be a name: any spot on the card is the card.)
      await tap(p, card(p, id).locator('.cz-econ, .cz-leaderboard, .cmd-whois').first(), `${g}: the card`, { loose: true });
    }
  },
  // The owner's buttons on cards (Asher is the owner in demo): Refund / Take
  // back on a finished game card, Undo on a /give card, each with its confirm.
  async owner(p, r) {
    const g = r % 2 ? 'dice' : 'coinflip';
    const id = await start(p, g, g === 'dice' ? '/dice 5' : '/coinflip 5 heads', 2400);
    const fix = card(p, id).locator('.card-fix').filter({ visible: true });
    if (await fix.count()) {
      await tap(p, fix.first(), 'Refund / Take back', { think: true, ambush: true });
      const ok = p.locator('.dialog.ask button', { hasText: /^(Refund|Take back)/ });
      if (await ok.count()) await tap(p, ok, 'Refund / Take back (confirm)', { watch: LAG + 2000 });
    } else problems.push(`${current.vp} owner: no Refund / Take back on the ${g} card`);
    await closeDialogs(p);
    const gid = await start(p, 'give', '/give @Cooper 5', 800);
    const undo = btn(p, gid, /Undo gift/);
    if (await undo.count()) {
      await tap(p, undo, 'Undo gift', { ambush: true });
      const ok = p.locator('.dialog.ask button', { hasText: /^Undo gift/ });
      if (await ok.count()) await tap(p, ok, 'Undo gift (confirm)', { watch: LAG + 2000 });
    } else problems.push(`${current.vp} owner: no Undo gift on the /give card`);
    await closeDialogs(p);
  },
  async learn(p) {
    await goChannel(p, 'general');
    const c = p.locator('.msg-list .cmd-card-dailyq').last();
    if (!(await c.count())) return problems.push(`${current.vp} learn: no daily question card in #general`);
    const id = (await c.evaluate((x) => x.closest('.msg[id]').id)).slice(4);
    await p.evaluate((id) => (window.__ns.focusId = id), id);
    const choice = c.locator('button:not(:disabled)').filter({ hasNotText: /Report|Challenge/ });
    if (await choice.count()) await tap(p, choice.first(), 'an answer', { think: true, ambush: true, watch: LAG + 2000 });
    await goChannel(p, 'arcade');
  },
};
async function dare(p, id) {
  const b = btn(p, id, /Challenge someone/);
  if (!(await b.count())) return;
  await tap(p, b, 'Challenge someone (open)');
  await tap(p, btn(p, id, /Challenge someone/), 'Challenge someone (close)');
}
async function report(p, id) {
  const b = card(p, id).locator('.card-report');
  if (!(await b.count())) return;
  await tap(p, b, 'Report', { ambush: true });
  await closeDialogs(p);
}
// Battleship, tic-tac-toe and connect four: the same moves in the game view.
async function view(p, id, cell) {
  const open = card(p, id).locator('.game-open');
  if (!(await open.count())) return;
  await tap(p, open, 'Open');
  const sheet = p.locator(`.game-sheet[data-msg="${id}"]`);
  if (!(await sheet.count())) return;
  for (let k = 0; k < 2; k++) {
    const cells = sheet.locator(`${cell}:not(:disabled)`);
    const n = await cells.count();
    if (!n) break;
    await tap(p, cells.nth(Math.floor(Math.random() * n)), 'move in the game view', { ambush: true, watch: LAG + 2200 });
  }
  await closeDialogs(p);
}

// ---------- run ----------

const ONLY = opt('only', '')
  .split(',')
  .filter(Boolean);
const names = ONLY.length ? ONLY : Object.keys(GAMES);
for (const vp of VPS) {
  const p = await newPage(vp);
  await goChannel(p, 'arcade');
  // Plenty of coins for every bet.
  if (BUSY) await p.evaluate(() => window.__ns.busy(true));
  for (const g of names) {
    current = { game: g, vp };
    for (let r = 0; r < ROUNDS; r++) {
      try {
        await closeDialogs(p);
        await GAMES[g](p, r);
      } catch (e) {
        problems.push(`${vp} ${g} round ${r + 1}: ${e.message.split('\n')[0]}`);
        await closeDialogs(p).catch(() => {});
      }
    }
  }
  await p.evaluate(() => window.__ns.busy(false));
  await p.context().close();
}
await browser.close();

// ---------- report ----------

const rows = {};
for (const t of taps) {
  const k = `${t.game}`;
  const r = (rows[k] ||= { taps: 0, shift: 0, wrong: 0, next: 0, maxMoved: 0, maxScroll: 0 });
  r.taps++;
  r.shift += t.shift ? 1 : 0;
  r.wrong += t.wrong ? 1 : 0;
  r.next += t.next ? 1 : 0;
  r.maxMoved = Math.max(r.maxMoved, t.moved, t.movedCard);
  r.maxScroll = Math.max(r.maxScroll, t.scroll);
}
const per100 = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
console.log(`\n${ENGINE} · ${VPS.join(', ')} · ${ROUNDS} rounds · lag ${LAG} ms · ${BUSY ? 'busy chat' : 'quiet chat'}`);
console.log('game         taps  shifts/100  wrong  next  max moved  max scroll');
for (const [g, r] of Object.entries(rows))
  console.log(
    `${g.padEnd(12)} ${String(r.taps).padStart(4)}  ${String(per100(r.shift, r.taps)).padStart(10)}  ${String(r.wrong).padStart(5)}  ${String(r.next).padStart(4)}  ${String(r.maxMoved).padStart(9)}  ${String(r.maxScroll).padStart(10)}`,
  );
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ engine: ENGINE, vps: VPS, lag: LAG, busy: BUSY, rows, taps, logic, problems, errors }, null, 1));
for (const x of problems) console.log(`NOTE ${x}`);
for (const x of errors.slice(0, 10)) console.log(`PAGE ERROR ${x}`);
const badLogic = logic.filter((x) => !x.ok).length;
if (logic.length) console.log(`mines logic: ${logic.length - badLogic} of ${logic.length} games opened exactly the tiles tapped, in order, with no "Pick a closed tile"`);
const bad = taps.filter((t) => t.shift || t.wrong || t.next).length + badLogic;
console.log(!(taps.length || logic.length) ? 'FAIL: no taps' : bad ? `FAIL: ${bad} of ${taps.length} taps moved or missed` : `PASS: ${taps.length} taps, nothing moved`);
process.exit(bad || !(taps.length || logic.length) ? 1 : 0);
