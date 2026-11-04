// Steady taps for Learn. Right after the screen changes under your finger
// (an answer is graded, a new question shows up), a tap is almost always the
// second half of a double tap, or the first tap arriving late, not a choice
// about what's now there. Those taps are ignored for a moment.
import { useMemo, useRef } from 'react';

// After an answer is graded: the marks and Next appear.
export const AFTER_GRADE = 350;
// After a new question appears (nobody reads one and answers this fast), and
// after Next or Skip is tapped (so a double tap can't go through twice).
export const AFTER_NEW = 450;

export function useTapGuard() {
  const until = useRef(0);
  return useMemo(
    () => ({
      arm(ms) {
        until.current = Math.max(until.current, performance.now() + ms);
      },
      ok() {
        return performance.now() >= until.current;
      },
    }),
    [],
  );
}
