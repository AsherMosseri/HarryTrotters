import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as M from '../../../functions/shared/minesweeper.js';
import { Icon } from '../shell/icons.jsx';
import { celebrate } from '../../motion.js';

// Minesweeper on this device: the same rules the server replays
// (functions/shared/minesweeper.js). Every tap that does something is saved
// as [ms, action, cell], and that list is what gets sent in at the end.
// Tap to open, long-press (or right-click, or the flag switch) to flag; tap
// an open number with all its flags placed to open everything around it.

const LONG_PRESS = 380;

// A board as a string for the small picture: '.' hidden, 'o' open, 'f' flag, 'x' the mine that went off.
export const minesText = (g) => g.state.map((s, i) => (i === g.boom ? 'x' : s === 1 ? 'o' : s === 2 ? 'f' : '.')).join('');

export function MiniMines({ text, w, h, cell = 5, label, sub }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !text) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * cell * dpr;
    cv.height = h * cell * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(cv);
    const hidden = css.getPropertyValue('--mw-hidden').trim() || '#8a94a6';
    const open = css.getPropertyValue('--mw-open').trim() || '#e8ecf2';
    for (let i = 0; i < w * h; i++) {
      const c = text[i];
      ctx.fillStyle = c === 'o' ? open : c === 'f' ? '#e2373c' : c === 'x' ? '#111' : hidden;
      ctx.fillRect((i % w) * cell, Math.floor(i / w) * cell, cell - 1, cell - 1);
    }
  }, [text, w, h, cell]);
  return (
    <div className="tet-mini">
      {label && <div className="tet-mini-label">{label}</div>}
      <canvas ref={ref} style={{ width: w * cell, height: h * cell }} aria-hidden="true" />
      {sub && <div className="tet-mini-sub mono">{sub}</div>}
    </div>
  );
}

// opts: newGame's options. bot: Trotbot's game (newBot) when racing it.
// other: { name, board, cells, done, over } from a live race. onChange(game)
// after each tap (for the race picture); onEnd({ moves, summary }).
export default function MinesPlay({ opts, bot, other, onChange, onEnd }) {
  const gRef = useRef(null);
  if (!gRef.current) gRef.current = M.newGame(opts);
  const g = gRef.current;
  const moves = useRef([]);
  const t0 = useRef(performance.now());
  const lastMs = useRef(0);
  const ended = useRef(false);
  const [, bump] = useState(0);
  const [now, setNow] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const wrapRef = useRef(null);
  const gridRef = useRef(null);
  const [layout, setLayout] = useState({ cell: 28, vertical: false });

  // Expert is wide: on a tall, narrow screen it's shown turned on its side.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const vertical = g.w > g.h && r.width < r.height * 0.9;
      const cols = vertical ? g.h : g.w;
      const rows = vertical ? g.w : g.h;
      // Each cell plus its 1px gap, and the 1px padding around the grid.
      const cell = Math.max(18, Math.min(44, Math.floor(Math.min((r.width - 2) / cols - 1, (Math.max(r.height, 200) - 2) / rows - 1))));
      setLayout({ cell, vertical });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [g]);

  // The clock (and Trotbot) tick until the game ends.
  useEffect(() => {
    const t = setInterval(() => {
      if (ended.current) return;
      const ms = performance.now() - t0.current;
      if (bot) bot.advance(ms);
      setNow(ms);
    }, 100);
    return () => clearInterval(t);
  }, [bot]);

  const act = (kind, i) => {
    if (ended.current) return;
    const ms = Math.max(lastMs.current, Math.round(performance.now() - t0.current));
    if (!M.act(g, kind, i, ms)) return;
    lastMs.current = ms;
    moves.current.push(ms, kind, i);
    bump((n) => n + 1);
    onChange?.(g);
    if (M.isDone(g)) {
      ended.current = true;
      if (g.won) celebrate({ el: gridRef.current });
      onEnd({ moves: moves.current, summary: M.summary(g) });
    }
  };
  const primary = (i) => {
    if (flagMode) return act(M.ACT.flag, i);
    if (M.isOpen(g, i)) return act(M.ACT.chord, i);
    if (!M.isFlag(g, i)) act(M.ACT.reveal, i);
  };

  // One pointer at a time: a short tap opens, a long press flags, a drag scrolls.
  const press = useRef(null);
  const cellAt = (e) => {
    const el = e.target.closest?.('[data-i]');
    return el ? +el.dataset.i : -1;
  };
  const onDown = (e) => {
    if (e.button === 2) return;
    const i = cellAt(e);
    if (i < 0) return;
    const p = { i, x: e.clientX, y: e.clientY, done: false };
    p.timer = setTimeout(() => {
      p.done = true;
      act(M.ACT.flag, i);
      navigator.vibrate?.(15);
    }, LONG_PRESS);
    press.current = p;
  };
  const onMove = (e) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) {
      clearTimeout(p.timer);
      press.current = null;
    }
  };
  const onUp = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (!p.done) primary(p.i);
  };
  const onContext = (e) => {
    e.preventDefault();
    const i = cellAt(e);
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
    if (i >= 0) act(M.ACT.flag, i);
  };

  const { cell, vertical } = layout;
  const cols = vertical ? g.h : g.w;
  const rows = vertical ? g.w : g.h;
  const order = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) order.push(vertical ? c * g.w + r : r * g.w + c);
  const done = M.isDone(g);
  const ms = done ? g.ms : now;
  const left = g.count - g.flags;
  const pct = Math.round((100 * g.opened) / M.safeCells(g));

  return (
    <div className="ms">
      <div className="mw-bar">
        <span className="mw-stat" title="Mines left">
          <Icon name="mine" /> <b className="mono">{left}</b>
        </span>
        <span className="mw-stat" title="Time">
          <Icon name="clock" /> <b className="mono">{M.clockText(ms)}</b>
        </span>
        <button className={`btn mw-flag${flagMode ? ' on' : ''}`} onClick={() => setFlagMode((f) => !f)} aria-pressed={flagMode}>
          <Icon name="flag" /> {flagMode ? 'Flagging' : 'Flag'}
        </button>
      </div>
      <div className="mw-body">
        <div className="mw-wrap" ref={wrapRef}>
          <div
            ref={gridRef}
            className={`mw-grid${done ? ' done' : ''}${g.lost ? ' lost' : ''}`}
            style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, '--cell': `${cell}px` }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => press.current && clearTimeout(press.current.timer)}
            onContextMenu={onContext}
            role="grid"
            aria-label={`Minesweeper, ${g.w} by ${g.h}`}
          >
            {order.map((i) => {
              const open = M.isOpen(g, i);
              const flag = M.isFlag(g, i);
              const mine = g.mines?.[i];
              const n = open && !mine ? g.numbers[i] : 0;
              const show = done && mine;
              const cls = open
                ? i === g.boom
                  ? 'boom'
                  : `open n${n}`
                : flag
                  ? done && !mine
                    ? 'flag wrong'
                    : 'flag'
                  : show
                    ? g.won
                      ? 'flag'
                      : 'mine'
                    : '';
              return (
                <span key={i} data-i={i} className={`mw-cell ${cls}${i === g.start && !open ? ' start' : ''}`} role="gridcell">
                  {open && n > 0 ? (
                    n
                  ) : i === g.boom || (show && !g.won && !flag) ? (
                    <Icon name="mine" size={Math.round(cell * 0.6)} />
                  ) : flag || (show && g.won) ? (
                    <Icon name="flag" size={Math.round(cell * 0.55)} />
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
        {(bot || other) && (
          <div className="mw-side">
            {bot && (
              <MiniMines
                text={minesText(bot.game)}
                w={g.w}
                h={g.h}
                cell={g.w > 16 ? 4 : 6}
                label="Trotbot"
                sub={
                  bot.game.won
                    ? `Done · ${M.clockText(bot.game.ms)}`
                    : bot.game.lost
                      ? 'Hit a mine'
                      : `${Math.round((100 * bot.game.opened) / M.safeCells(bot.game))}%`
                }
              />
            )}
            {other && (
              <MiniMines
                text={other.board}
                w={g.w}
                h={g.h}
                cell={g.w > 16 ? 4 : 6}
                label={other.name.split(' ')[0]}
                sub={other.done ? (other.over ? 'Hit a mine' : 'Done') : `${other.cells || 0} cells`}
              />
            )}
          </div>
        )}
      </div>
      <div className="mw-foot muted tiny">
        <span className="mono">{pct}%</span> cleared · Long-press to flag · Tap a number to open around it
      </div>
    </div>
  );
}
