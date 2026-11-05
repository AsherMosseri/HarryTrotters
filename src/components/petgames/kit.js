import { useEffect, useRef, useState } from 'react';

// Shared bits for the pet games' canvases (3.2): a canvas that fills its
// box at the screen's sharpness, a fixed-step loop, pausing when the tab is
// hidden, and no page scrolling or zooming while a finger is on the game.

// Keeps the canvas the size of `wrap` in device pixels (capped so iPads
// keep up). Returns { w, h } in CSS pixels (state, so the sprites resize too)
// and a ref with { w, h, dpr } for the loop.
export function useFitCanvas(wrap, canvas) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const live = useRef({ w: 0, h: 0, dpr: 1 });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const fit = () => {
      // Layout size (not getBoundingClientRect: a dialog's opening zoom would shrink it).
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      // At most 2x, and about 2.4 million pixels in all (a big iPad at 2x
      // would be almost 4 million to fill 60 times a second).
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(2400000 / (w * h))));
      const cv = canvas.current;
      if (cv) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.width = `${w}px`;
        cv.style.height = `${h}px`;
      }
      live.current = { w, h, dpr };
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [wrap, canvas]);
  return [size, live];
}

// Calls tick(frameSeconds) on every animation frame; the game does its own
// fixed steps inside. Stops when the screen goes away.
export function useFrames(tick) {
  const fn = useRef(tick);
  fn.current = tick;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      fn.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

// Calls onHide when the tab or app is hidden (another app, the lock button).
export function useOnHide(onHide) {
  const fn = useRef(onHide);
  fn.current = onHide;
  useEffect(() => {
    const hide = () => document.hidden && fn.current();
    const away = () => fn.current();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', away);
    window.addEventListener('blur', away);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', away);
      window.removeEventListener('blur', away);
    };
  }, []);
}

// No scrolling, pull-to-refresh, pinch or double-tap zoom on `ref` while it's
// up (touch-action in CSS does most of it; iOS needs the rest).
export function useNoScroll(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const stop = (e) => {
      if (e.cancelable) e.preventDefault();
    };
    const opts = { passive: false };
    el.addEventListener('touchmove', stop, opts);
    el.addEventListener('dblclick', stop, opts);
    document.addEventListener('gesturestart', stop, opts);
    const html = document.documentElement;
    const had = html.style.overscrollBehavior;
    html.style.overscrollBehavior = 'none';
    return () => {
      el.removeEventListener('touchmove', stop, opts);
      el.removeEventListener('dblclick', stop, opts);
      document.removeEventListener('gesturestart', stop, opts);
      html.style.overscrollBehavior = had;
    };
  }, [ref]);
}

// The scene colors for light or dark (shell.css --pg-* tokens).
export function sceneColors(el) {
  const cs = getComputedStyle(el);
  const v = (k, d) => cs.getPropertyValue(k).trim() || d;
  return {
    sky1: v('--pg-sky1', '#9fd6ff'),
    sky2: v('--pg-sky2', '#eaf7ff'),
    far: v('--pg-far', '#a8d8a2'),
    far2: v('--pg-far2', '#8cc887'),
    cloud: v('--pg-cloud', 'rgba(255,255,255,0.9)'),
    dirt: v('--pg-dirt', '#c7905c'),
    dirt2: v('--pg-dirt2', '#a8743f'),
    grass: v('--pg-grass', '#57b65a'),
    water: v('--pg-water', '#4aa6e0'),
    wave: v('--pg-wave', 'rgba(255,255,255,0.55)'),
    tile: v('--pg-tile', '#9aa4b1'),
    seam: v('--pg-seam', '#7d8794'),
    wall: v('--pg-wall', 'rgba(255,255,255,0.35)'),
    frame: v('--pg-frame', '#8c96a3'),
    ink: v('--pg-ink', '#2a2730'),
  };
}

// Is "Moving things" on (Settings: animations)? The pet breathes only then.
export const movingOn = () => typeof document !== 'undefined' && (document.documentElement.dataset.anim || '').split(' ').includes('move');
