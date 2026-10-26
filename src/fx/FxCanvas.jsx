import { useEffect, useRef } from 'react';
import { FX } from './effects.js';

const INTRO_S = 1.8;

// Plays an effect (fx/effects.js) on a canvas that fills its parent. Runs at
// the screen's frame rate (or `fps`), pauses while off screen or in a hidden
// tab, and shows one still frame when the device asks for reduced motion.
// `density` scales the particle counts; `replayKey` restarts the intro.
export default function FxCanvas({ id, className = '', fps = 60, density = 1, intro = true, replayKey }) {
  const ref = useRef(null);
  useEffect(() => {
    const def = FX[id];
    const canvas = ref.current;
    if (!def || !canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let frame = null;
    let t = intro ? 0 : INTRO_S;
    let last = 0;
    let raf = 0;
    let onScreen = true;
    const setup = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // About this many particles on a 360×480 card; more on bigger areas, fewer on small ones.
      const area = Math.min(3, Math.max(0.45, (w * h) / (360 * 480)));
      frame = def.make({ w, h, n: (k) => Math.max(1, Math.round(k * area * density)) });
      return true;
    };
    const draw = (dt) => {
      ctx.clearRect(0, 0, w, h);
      frame(ctx, dt, t, Math.max(0, 1 - t / INTRO_S));
    };
    if (!setup()) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      // One calm still frame, a few seconds in.
      t = INTRO_S;
      for (let i = 0; i < 90; i++) {
        t += 1 / 30;
        frame(ctx, 1 / 30, t, 0);
        ctx.clearRect(0, 0, w, h);
      }
      draw(0);
      return;
    }
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!onScreen || document.hidden) {
        last = now;
        return;
      }
      if (last && now - last < 1000 / fps - 2) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      draw(dt);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      if (Math.abs(r.width - w) > 1 || Math.abs(r.height - h) > 1) setup();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [id, fps, density, intro, replayKey]);
  return <canvas ref={ref} className={`fx-canvas ${className}`} aria-hidden="true" />;
}
