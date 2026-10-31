import { useLayoutEffect, useRef } from 'react';
import { animOn } from '../motion.js';

const whole = (n) => Math.round(n).toLocaleString();

// A number that counts up to its value when it first shows, and from the old
// value to the new one when it changes (Moving things, in Appearance).
// `format` turns the in-between numbers into text (whole numbers by default).
export default function CountUp({ value, format = whole, duration = 450, from = 0, className = '', ...rest }) {
  const ref = useRef(null);
  const shown = useRef(null);
  const fmt = useRef(format);
  fmt.current = format;
  useLayoutEffect(() => {
    const el = ref.current;
    const start = shown.current ?? from;
    const target = Number(value) || 0;
    const set = (v) => {
      shown.current = v;
      el.textContent = fmt.current(v);
    };
    if (!animOn('move') || start === target) return set(target);
    set(start);
    const t0 = performance.now();
    let raf = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      set(k === 1 ? target : start + (target - start) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Interrupted (a new value, or gone): the next run starts from what's showing.
    return () => cancelAnimationFrame(raf);
  }, [value, duration, from]);
  // The text is written straight to the element so it can change every frame;
  // the label keeps the real number for screen readers.
  return <span ref={ref} className={`count-up ${className}`} aria-label={fmt.current(Number(value) || 0)} {...rest} />;
}
