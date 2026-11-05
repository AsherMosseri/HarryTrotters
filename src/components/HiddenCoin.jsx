import { useEffect, useRef, useState } from 'react';
import { FIND_ASK_MS, FIND_SHOW_MS } from '../../functions/shared/hiddenCoins.js';
import { coinStyled } from '../coinFormat.js';

// Hidden coins (3.2): now and then a little coin shows up somewhere in the
// app. Tap it to pick it up. The server decides when one shows (a token, at
// most 5 a day) and pays it once (functions/earn.js hiddenCoin); this only
// finds a free spot and shows it. Never on chat messages, never over a
// button or a field, never under the phone keyboard, and only while the app
// is in front. Controls, Hidden coins turns them off.

// Things a coin never sits on (or next to).
const KEEP_CLEAR =
  'button, a, input, textarea, select, label, summary, [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="menuitem"], [role="slider"], [contenteditable="true"], [tabindex]:not([tabindex="-1"]), .composer, .messages, .msg, .message, .chat-messages, .suggest, .bottom-nav, .panel-backdrop, .toast, .composer-more, [data-no-coin]';
const SIZE = 34;
const PAD = 10;

// Where the keyboard isn't: the visible part of the screen (phones shrink
// visualViewport while it's up). null while a keyboard looks open.
function visibleArea() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const w = vv ? vv.width : window.innerWidth;
  if (h < window.innerHeight - 120) return null;
  const typing = document.activeElement?.matches?.('input, textarea, [contenteditable="true"]');
  if (typing && window.matchMedia?.('(pointer: coarse)').matches) return null;
  return { w, h };
}
// Is the box at (x, y) clear of everything it shouldn't cover?
function clearAt(x, y, self) {
  for (const [dx, dy] of [
    [-PAD, -PAD], [SIZE / 2, -PAD], [SIZE + PAD, -PAD],
    [-PAD, SIZE / 2], [SIZE / 2, SIZE / 2], [SIZE + PAD, SIZE / 2],
    [-PAD, SIZE + PAD], [SIZE / 2, SIZE + PAD], [SIZE + PAD, SIZE + PAD],
  ]) {
    const els = document.elementsFromPoint(x + dx, y + dy).filter((el) => el !== self && !self?.contains(el));
    const top = els[0];
    if (!top || top.closest(KEEP_CLEAR)) return false;
    // Inside a dialog or sheet that's open: those are busy, leave them be.
    if (top.closest('[role="dialog"], .overlay, .sheet')) return false;
  }
  return true;
}
function findSpot(self) {
  const area = visibleArea();
  if (!area) return null;
  const top = 64;
  const bottom = area.h - 96;
  if (bottom - top < SIZE * 3) return null;
  for (let i = 0; i < 60; i++) {
    const x = PAD + Math.random() * (area.w - SIZE - PAD * 2);
    const y = top + Math.random() * (bottom - top - SIZE);
    if (clearAt(x, y, self)) return { x: Math.round(x), y: Math.round(y) };
  }
  return null;
}

export default function HiddenCoin({ ask, demo = false }) {
  const [coin, setCoin] = useState(null); // { token, x, y, until }
  const [found, setFound] = useState(null); // { x, y, text }
  const el = useRef(null);
  const busy = useRef(false);
  const active = useRef(Date.now());
  const showing = useRef(false);
  showing.current = !!coin;

  // Someone using the app (not a phone left on the table).
  useEffect(() => {
    const mark = () => (active.current = Date.now());
    window.addEventListener('pointerdown', mark, { passive: true });
    window.addEventListener('keydown', mark);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, []);

  // Now and then, ask the server whether a coin shows.
  useEffect(() => {
    let stop = false;
    let t;
    const next = (ms) => {
      t = setTimeout(tick, ms);
    };
    const tick = async () => {
      if (stop) return;
      const idle = Date.now() - active.current > 3 * 60000;
      if (showing.current || busy.current || document.visibilityState !== 'visible' || idle || !visibleArea()) return next(30000);
      busy.current = true;
      const r = await ask({ action: 'spawn' }).catch(() => null);
      busy.current = false;
      if (stop) return;
      if (r?.off) return; // switched off: stop asking until the app opens again
      if (r?.token) {
        const spot = findSpot(el.current);
        if (spot) setCoin({ token: r.token, ...spot, until: Math.min(r.exp || Infinity, Date.now() + FIND_SHOW_MS) });
      }
      if (r?.left === 0) return;
      next(demo ? 20000 : FIND_ASK_MS * (0.7 + Math.random() * 0.6));
    };
    next(demo ? 12000 : 60000 + Math.random() * 90000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [ask, demo]);

  // While it's showing: gone when its time is up; moves (or hides) if
  // something it would cover scrolls under it or the keyboard comes up.
  useEffect(() => {
    if (!coin) return undefined;
    const check = () => {
      if (Date.now() > coin.until) return setCoin(null);
      if (document.visibilityState !== 'visible') return;
      if (!visibleArea()) return setCoin((c) => (c ? { ...c, hidden: true } : c));
      if (!clearAt(coin.x, coin.y, el.current)) {
        const spot = findSpot(el.current);
        setCoin((c) => (c ? (spot ? { ...c, ...spot, hidden: false } : { ...c, hidden: true }) : c));
      } else if (coin.hidden) setCoin((c) => (c ? { ...c, hidden: false } : c));
    };
    const t = setInterval(check, 900);
    window.addEventListener('scroll', check, true);
    window.visualViewport?.addEventListener('resize', check);
    return () => {
      clearInterval(t);
      window.removeEventListener('scroll', check, true);
      window.visualViewport?.removeEventListener('resize', check);
    };
  }, [coin]);

  useEffect(() => {
    if (!found) return undefined;
    const t = setTimeout(() => setFound(null), 1800);
    return () => clearTimeout(t);
  }, [found]);

  const pick = async () => {
    const c = coin;
    if (!c) return;
    setCoin(null);
    const r = await ask({ action: 'claim', token: c.token }).catch(() => null);
    setFound({ x: c.x, y: c.y, text: r?.ok ? (r.paid ? `+${coinStyled(r.paid)}` : 'That’s today’s last one') : r?.note?.title || 'It got away' });
  };

  return (
    <>
      {coin && !coin.hidden && (
        <button
          ref={el}
          className="hidden-coin"
          style={{ left: coin.x, top: coin.y }}
          onClick={pick}
          aria-label="A hidden Jackson coin. Tap to pick it up"
          title="A hidden coin!"
        >
          <span className="hidden-coin-face" aria-hidden="true">
            J
          </span>
          <span className="hidden-coin-spark s1" aria-hidden="true" />
          <span className="hidden-coin-spark s2" aria-hidden="true" />
          <span className="hidden-coin-spark s3" aria-hidden="true" />
        </button>
      )}
      {found && (
        <div className="hidden-coin-found mono" style={{ left: found.x, top: found.y }} role="status">
          {found.text}
        </div>
      )}
    </>
  );
}
