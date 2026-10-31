import { useLayoutEffect, useRef } from 'react';

// The four kinds of animation, each with its own switch in Appearance (under
// Animations, which turns them all off). Stored on this device as
// anim-<id> (true/false), and shown to CSS as <html data-anim="celebrate move
// pages taps">, listing only the ones that play: none when Animations is off,
// or on Match device with Reduce Motion on. index.html sets it before the
// first paint with the same rules.
export const ANIM_AREAS = [
  ['celebrate', 'Celebrations', 'A little burst when a task is done.'],
  ['move', 'Moving things', 'Tasks slide to their new place, new ones fade in, numbers count up.'],
  ['pages', 'Page changes', 'A quick fade when you switch pages or open a pop-up.'],
  ['taps', 'Buttons and taps', 'Buttons and chips press in when you tap them.'],
];

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export function applyAnim() {
  if (typeof document === 'undefined') return;
  const m = read('motion', 'auto');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const on = m === 'on' || (m !== 'off' && !reduce);
  const areas = on ? ANIM_AREAS.map(([id]) => id).filter((id) => read(`anim-${id}`, true) !== false) : [];
  document.documentElement.dataset.anim = areas.join(' ');
}

// Keeps data-anim right when the device's Reduce Motion changes.
export function installAnim() {
  applyAnim();
  if (typeof matchMedia === 'function') matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyAnim);
}

export const animOn = (area) => typeof document !== 'undefined' && (document.documentElement.dataset.anim || '').split(' ').includes(area);

// Where the last tap or click ended, so a celebration can start there.
let lastTap = null;
if (typeof window !== 'undefined')
  window.addEventListener('pointerup', (e) => (lastTap = { x: e.clientX, y: e.clientY, at: performance.now() }), true);

const COLORS = ['#f43f5e', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#6366f1', '#d946ef'];

// A short burst of confetti, for finishing a task (and later: streaks, pets
// leveling up). Starts at { x, y }, an element's center ({ el }), or where
// the last tap ended (or the middle of the screen). Doesn't block anything
// and cleans up after itself. Skipped when Celebrations is off.
export function celebrate({ x, y, el, count = 18 } = {}) {
  if (!animOn('celebrate') || typeof document === 'undefined') return;
  if (el) {
    const r = el.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else if (x == null) {
    const recent = lastTap && performance.now() - lastTap.at < 2000;
    x = recent ? lastTap.x : innerWidth / 2;
    y = recent ? lastTap.y : innerHeight / 2;
  }
  const layer = document.createElement('div');
  layer.className = 'celebrate';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  document.body.appendChild(layer);
  // Transform and opacity only, with plain numbers per piece, so iPads keep it smooth.
  const ring = document.createElement('i');
  ring.className = 'celebrate-ring';
  layer.appendChild(ring);
  ring.animate(
    [
      { transform: 'scale(0.3)', opacity: 0.7 },
      { transform: 'scale(1.6)', opacity: 0 },
    ],
    { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' },
  );
  let longest = 420;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = i % 3 ? 'celebrate-bit' : 'celebrate-bit round';
    p.style.background = COLORS[i % COLORS.length];
    layer.appendChild(p);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 38 + Math.random() * 46;
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist - 14;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 260);
    const duration = 520 + Math.random() * 220;
    longest = Math.max(longest, duration);
    p.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg) scale(0.6)', opacity: 1 },
        {
          transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(spin * 0.6).toFixed(0)}deg) scale(1)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${(dx * 1.12).toFixed(1)}px, ${(dy + 26).toFixed(1)}px) rotate(${spin.toFixed(0)}deg) scale(0.8)`,
          opacity: 0,
        },
      ],
      { duration, easing: 'cubic-bezier(0.15, 0.7, 0.4, 1)', fill: 'forwards' },
    );
  }
  setTimeout(() => layer.remove(), longest + 60);
}

// FLIP: things that moved slide from where they were (across columns too),
// and new ones ease in. Give each item data-flip="<id>" and pass the list it
// shows as `sig` (a new array when it changes). Positions are read just
// before React changes the page. flipFrom() sets where one item should come
// from instead (a dropped card: where it was dropped).
const pending = new Map();
export function flipFrom(id, rect) {
  pending.set(id, { rect, at: performance.now() });
}

function measure(root) {
  const m = new Map();
  for (const el of root.querySelectorAll('[data-flip]')) m.set(el.dataset.flip, el.getBoundingClientRect());
  return m;
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export function useFlip(ref, sig) {
  const last = useRef({ sig, rects: null });
  if (last.current.sig !== sig) last.current = { sig, rects: ref.current && animOn('move') ? measure(ref.current) : null };
  useLayoutEffect(() => {
    const before = last.current.rects;
    last.current.rects = null;
    const root = ref.current;
    if (!before || !root) return;
    const now = performance.now();
    let n = 0;
    for (const el of root.querySelectorAll('[data-flip]')) {
      if (n > 60) break;
      const id = el.dataset.flip;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const forced = pending.get(id);
      const was = forced && now - forced.at < 2500 ? forced.rect : before.get(id);
      if (forced) pending.delete(id);
      if (was) {
        const dx = was.left - r.left;
        const dy = was.top - r.top;
        if (Math.abs(dx) + Math.abs(dy) < 2) continue;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 260, easing: EASE });
      } else if (before.size) {
        el.animate(
          [
            { opacity: 0, transform: 'scale(0.97)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 200, easing: 'ease-out' },
        );
      } else continue;
      n++;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}
