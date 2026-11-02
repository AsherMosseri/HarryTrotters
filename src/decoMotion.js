// One shared place that decides which avatar decorations, name effects and
// nameplates move. Every one registers itself with watchDeco (a ref), and:
//  - only the ones on screen move; the rest hold still (data-still, which the
//    CSS turns into animation-play-state: paused),
//  - at most a few move at once (your own picture in the corner always does),
//    the ones nearest the middle of the screen first,
//  - after the app comes back from the background, a rotation, or a pop-up
//    that covered the page, they get a nudge: iPad Safari can leave animations
//    frozen until their layer is redrawn.
// Whether anything moves at all is still the Animations setting (data-motion,
// Reduce Motion) and Calm chat, in CSS.

// How many of each kind move at once (not counting your own picture).
// Names (a gradient moving inside text) can't be handed to the graphics chip, so fewer.
const LIMIT = { deco: 8, text: 4 };

const seen = new Set(); // every watched element
const onScreen = new Set(); // the ones in or near the viewport
let io = null;
let timer = 0;

const kindOf = (el) => (el.classList.contains('deco') ? 'deco' : 'text');

function plan() {
  timer = 0;
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const by = { deco: [], text: [] };
  for (const el of onScreen) {
    if (!el.isConnected) {
      onScreen.delete(el);
      continue;
    }
    if (el.dataset.decoOwn) continue;
    const r = el.getBoundingClientRect();
    by[kindOf(el)].push([Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy), el]);
  }
  const moving = new Set();
  for (const k of Object.keys(by)) {
    by[k].sort((a, b) => a[0] - b[0]);
    for (const [, el] of by[k].slice(0, LIMIT[k])) moving.add(el);
  }
  for (const el of seen) {
    const go = el.dataset.decoOwn ? true : moving.has(el);
    if (go) {
      if (el.dataset.still) delete el.dataset.still;
    } else if (!el.dataset.still) el.dataset.still = '1';
  }
}

function soon(ms = 120) {
  if (!timer) timer = setTimeout(plan, ms);
}

function observer() {
  if (io || typeof IntersectionObserver === 'undefined') return io;
  installDecoMotion();
  io = new IntersectionObserver(
    (list) => {
      for (const e of list) (e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target));
      soon();
    },
    { rootMargin: '60px' },
  );
  return io;
}

// Use as a ref: <span ref={watchDeco}>. React 19 runs the returned function when the element goes away.
export function watchDeco(el) {
  if (!el) return;
  const o = observer();
  if (!o) return; // very old browser: everything just moves
  seen.add(el);
  // Hold still until the observer says it's on screen (a few ms), so a long
  // channel doesn't start every decoration at once.
  if (!el.dataset.decoOwn) el.dataset.still = '1';
  o.observe(el);
  return () => {
    o.unobserve(el);
    seen.delete(el);
    onScreen.delete(el);
  };
}

// Pause for two frames, then go on: gets stuck animations moving again.
let kicking = false;
export function kickDecorations() {
  if (kicking || typeof document === 'undefined') return;
  kicking = true;
  const root = document.documentElement;
  root.setAttribute('data-deco-kick', '1');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      root.removeAttribute('data-deco-kick');
      kicking = false;
    }),
  );
}

let installed = false;
export function installDecoMotion() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  let later = 0;
  const kick = (ms = 0) => {
    clearTimeout(later);
    later = setTimeout(() => {
      kickDecorations();
      soon(0);
    }, ms);
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && kick(50));
  window.addEventListener('pageshow', () => kick(50));
  window.addEventListener('focus', () => kick(100));
  window.addEventListener('orientationchange', () => kick(350));
  window.addEventListener('resize', () => kick(400));
  // Scrolling changes which ones are nearest the middle; look again when it settles.
  let scrolling = 0;
  document.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrolling);
      scrolling = setTimeout(() => soon(0), 180);
    },
    { capture: true, passive: true },
  );
  // A pop-up closing is when a covered page most often comes back frozen.
  let covers = 0;
  new MutationObserver(() => {
    const n = document.querySelectorAll('.panel-backdrop, .dialog, .sheet').length;
    if (covers > 0 && n === 0) kick(150);
    covers = n;
  }).observe(document.body, { childList: true });
}
