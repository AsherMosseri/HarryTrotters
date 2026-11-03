import { useCallback, useEffect, useRef, useState } from 'react';

// Sending moves from a live game card (blackjack, mines, high-low, crash, the
// arcade's challenges…). Every tap shows at once (the tapped button turns
// "pending", the others wait), one move is in flight per card, and the card
// takes the next tap as soon as the move shows up on it: the server writes the
// card, so its new state arriving means the move is done, even while the
// play function is still finishing its answer. A tap during a pending move is
// either kept for right after it (canQueue, e.g. another mines tile) or
// ignored; the same move again within a moment of the last one is a double
// tap and is ignored too. A move that fails or gets no answer frees the card
// and says so.
//
// onMove(move) → { ok } | { note } (never throws: api.play catches).
// version: anything that changes when the card's game changes (its snapshot).
// Returns { send, peek, pending, queued, error }.
const TIMEOUT = 15000;
const DOUBLE_TAP = 400;
export const RETRY = 'That didn’t go through. Tap again.';

export function useMove(onMove, version, { canQueue = () => false, stillOk = () => true } = {}) {
  const [pending, setPending] = useState(null);
  const [queued, setQueued] = useState(null);
  const [error, setError] = useState('');
  const s = useRef({ pending: null, queued: null, seq: 0, last: { move: null, at: 0 }, version });
  // The latest props, for callbacks made once.
  const live = useRef({ onMove, canQueue, stillOk });
  live.current = { onMove, canQueue, stillOk };

  const release = useCallback((token) => {
    const st = s.current;
    if (st.pending == null || (token != null && token !== st.seq)) return;
    st.last = { move: st.pending, at: performance.now() };
    st.pending = null;
    setPending(null);
    const next = st.queued;
    st.queued = null;
    setQueued(null);
    // A tap kept for after: send it if it still makes sense on the new card.
    if (next != null && live.current.stillOk(next)) queueMicrotask(() => sendRef.current(next));
  }, []);

  const send = useCallback(
    async (move) => {
      const st = s.current;
      if (st.pending != null) {
        if (move !== st.pending && st.queued == null && live.current.canQueue(move)) {
          st.queued = move;
          setQueued(move);
        }
        return null;
      }
      if (move === st.last.move && performance.now() - st.last.at < DOUBLE_TAP) return null;
      const token = ++st.seq;
      st.pending = move;
      setPending(move);
      setError('');
      let r;
      try {
        r = await Promise.race([live.current.onMove(move), new Promise((res) => setTimeout(() => res({ timedOut: true }), TIMEOUT))]);
      } catch {
        r = { failed: true };
      }
      if (token === st.seq) {
        // A note with ok is news (the lottery's "bought 1 ticket"), not a problem.
        const refused = (r?.note && !r.ok) || r?.timedOut || r?.failed;
        if (r?.note && !r.ok) setError(r.note.title || RETRY);
        else if (r?.timedOut || r?.failed) setError(RETRY);
        // A refused move may leave the kept tap pointless.
        if (refused) {
          st.queued = null;
          setQueued(null);
        }
        release(token);
      }
      return r;
    },
    [release],
  );
  const sendRef = useRef(send);
  sendRef.current = send;

  // The card changed: the move is in (its own answer may still be on the way).
  useEffect(() => {
    if (s.current.version === version) return;
    s.current.version = version;
    if (s.current.pending != null) release();
  }, [version, release]);

  // Quiet asks (a crash's "has it crashed?", a timer running out): never
  // touch the pending move or show anything.
  const peek = useCallback((move = 'peek') => Promise.resolve(live.current.onMove(move)).catch(() => null), []);

  return { send, peek, pending, queued, error, setError };
}
