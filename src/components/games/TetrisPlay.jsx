import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as T from '../../../functions/shared/tetris.js';
import { clockText } from '../../../functions/shared/minesweeper.js';
import { Icon } from '../shell/icons.jsx';
import { animOn } from '../../motion.js';
import { confirmDialog } from '../Dialogs.jsx';

// Tetris on this device: the same rules the server replays
// (functions/shared/tetris.js). Every input that does something is saved as
// [frame, input], and that list is what gets sent in at the end.
//
// Controls: arrow keys / Z X (or Up) / Space / C on a keyboard; on a touch
// screen, the buttons, or gestures on the board (tap to turn, drag sideways
// to move, drag down to drop faster, flick down to drop, flick up to hold).

export const COLORS = ['', '#22b8de', '#3f5fd0', '#ee8424', '#eec40c', '#3fae46', '#a04bc2', '#e2373c'];
const STEP = 1000 / T.FPS;
const DAS = 10; // frames before a held left/right starts repeating
const ARR = 2; // frames between repeats
const SOFT_EVERY = 2;
const LABELS = { 1: 'Single', 2: 'Double', 3: 'Triple', 4: 'Tetris!' };

export function clearLabel(last) {
  if (!last) return '';
  const spin = last.spin === 'full' ? 'T-spin' : last.spin === 'mini' ? 'Mini T-spin' : '';
  const kind = spin ? `${spin}${last.lines ? ` ${['', 'single', 'double', 'triple'][last.lines]}` : ''}` : LABELS[last.lines] || '';
  return [last.b2b ? 'Back-to-back' : '', kind, last.combo > 0 ? `Combo ×${last.combo}` : ''].filter(Boolean).join(' · ');
}

const themeColors = (el) => {
  const cs = getComputedStyle(el);
  return { bg: cs.getPropertyValue('--tet-bg').trim() || '#10151f', grid: cs.getPropertyValue('--tet-grid').trim() || '#1c2433' };
};

function drawBlock(ctx, x, y, c, color, ghost = false) {
  if (ghost) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, c / 12);
    ctx.strokeRect(x * c + 2, y * c + 2, c - 4, c - 4);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x * c + 1, y * c + 1, c - 2, c - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x * c + 1, y * c + 1, c - 2, Math.max(2, c / 6));
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x * c + 1, y * c + c - 1 - Math.max(2, c / 7), c - 2, Math.max(2, c / 7));
}

// A board as a string of 200 digits (the 20 rows you see), for the small
// picture of the other player.
export const boardText = (board) => board.slice(T.HIDDEN * T.W).join('');

// A small picture of a board (the other player's, or Trotbot's).
export function MiniBoard({ board, cell = 7, label, sub, over }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = T.W * cell * dpr;
    cv.height = 20 * cell * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { bg } = themeColors(cv);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, T.W * cell, 20 * cell);
    const cells = typeof board === 'string' ? [...board].map(Number) : board || [];
    for (let i = 0; i < 200; i++) {
      const v = cells[i];
      if (v) {
        ctx.fillStyle = COLORS[v] || '#888';
        ctx.fillRect((i % T.W) * cell, Math.floor(i / T.W) * cell, cell - 1, cell - 1);
      }
    }
  }, [board, cell]);
  return (
    <div className={`tet-mini${over ? ' over' : ''}`}>
      {label && <div className="tet-mini-label">{label}</div>}
      <canvas ref={ref} style={{ width: T.W * cell, height: 20 * cell }} aria-hidden="true" />
      {sub && <div className="tet-mini-sub mono">{sub}</div>}
    </div>
  );
}

function PieceBox({ pieces, cell, dim, rows = 1 }) {
  const ref = useRef(null);
  const sig = pieces.join(',') + (dim ? 'd' : '');
  useEffect(() => {
    const cv = ref.current;
    const dpr = window.devicePixelRatio || 1;
    const h = rows * 3 * cell;
    cv.width = 4.5 * cell * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 4.5 * cell, h);
    pieces.slice(0, rows).forEach((t, k) => {
      if (!t) return;
      const cells = T.cellsOf(t, 0);
      const xs = cells.map(([x]) => x);
      const ys = cells.map(([, y]) => y);
      const w = Math.max(...xs) - Math.min(...xs) + 1;
      const hh = Math.max(...ys) - Math.min(...ys) + 1;
      const ox = (4.5 - w) / 2 - Math.min(...xs);
      const oy = k * 3 + (3 - hh) / 2 - Math.min(...ys);
      ctx.save();
      ctx.translate(ox * cell, oy * cell);
      ctx.globalAlpha = dim ? 0.35 : 1;
      for (const [x, y] of cells) drawBlock(ctx, x, y, cell, COLORS[t]);
      ctx.restore();
    });
  }, [sig, cell, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} style={{ width: 4.5 * cell, height: rows * 3 * cell }} aria-hidden="true" />;
}

// session: { game, mode, seed, level } (funGames.gameOpts makes the options).
// opts: newGame's options. bot: Trotbot's game object (newBot) when racing it.
// other: { name, board, lines, done, over } from a live race. onLock(game)
// after each piece (to send the race picture); onEnd({ moves, summary }).
export default function TetrisPlay({ opts, bot, other, canPause, onLock, onEnd }) {
  const gRef = useRef(null);
  if (!gRef.current) gRef.current = T.newGame(opts);
  const g = gRef.current;
  const moves = useRef([]);
  const queue = useRef([]);
  const held = useRef({ dir: null, dirFrames: 0, soft: false, softFrames: 0 });
  const paused = useRef(false);
  const ended = useRef(false);
  const boardRef = useRef(null);
  const wrapRef = useRef(null);
  const [cell, setCell] = useState(24);
  const cellRef = useRef(24);
  const [hud, setHud] = useState({ score: 0, lines: 0, level: g.level, frame: 0, next: g.queue.slice(0, 5), hold: 0, held: false, botLines: 0, botDone: false });
  const [label, setLabel] = useState(null);
  const [isPaused, setPaused] = useState(false);
  const lastSeen = useRef(null);
  const colors = useRef(null);
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  // The board's size: as big as fits.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const c = Math.max(12, Math.floor(Math.min(r.width / T.W, r.height / 20)));
      cellRef.current = c;
      setCell(c);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const press = (code) => {
    if (!paused.current) queue.current.push(code);
  };
  const holdDir = (dir, on) => {
    const h = held.current;
    if (on) {
      if (paused.current) return;
      h.dir = dir;
      h.dirFrames = 1;
      queue.current.push(dir === 'left' ? T.IN.left : T.IN.right);
    } else if (h.dir === dir) h.dir = null;
  };
  const holdSoft = (on) => {
    const h = held.current;
    h.soft = on && !paused.current;
    if (h.soft) {
      h.softFrames = 1;
      queue.current.push(T.IN.soft);
    }
  };
  const setPause = (on) => {
    if (!canPause || ended.current) return;
    paused.current = on;
    held.current.dir = null;
    held.current.soft = false;
    setPaused(on);
  };
  const quit = () => {
    if (ended.current) return;
    paused.current = false;
    moves.current.push(g.frame, T.IN.end);
    T.input(g, T.IN.end);
  };

  // The game loop: fixed 60 frames a second, drawn every animation frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let colorAt = 0;
    const doInput = (code) => {
      const f = g.frame;
      if (T.input(g, code)) moves.current.push(f, code);
    };
    const frame = () => {
      const pieces = g.pieces;
      while (queue.current.length && !T.isDone(g)) doInput(queue.current.shift());
      const h = held.current;
      if (h.dir && !T.isDone(g)) {
        const n = h.dirFrames++;
        if (n >= DAS && (n - DAS) % ARR === 0) doInput(h.dir === 'left' ? T.IN.left : T.IN.right);
      }
      if (h.soft && !T.isDone(g) && h.softFrames++ % SOFT_EVERY === 0) doInput(T.IN.soft);
      T.step(g);
      if (g.pieces !== pieces) onLock?.(g);
    };
    const draw = (now) => {
      const cv = boardRef.current;
      if (!cv) return;
      const c = cellRef.current;
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== T.W * c * dpr) {
        cv.width = T.W * c * dpr;
        cv.height = 20 * c * dpr;
      }
      if (!colors.current || now - colorAt > 500) {
        colors.current = themeColors(cv);
        colorAt = now;
      }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.current.bg;
      ctx.fillRect(0, 0, T.W * c, 20 * c);
      ctx.strokeStyle = colors.current.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < T.W; x++) {
        ctx.moveTo(x * c + 0.5, 0);
        ctx.lineTo(x * c + 0.5, 20 * c);
      }
      for (let y = 1; y < 20; y++) {
        ctx.moveTo(0, y * c + 0.5);
        ctx.lineTo(T.W * c, y * c + 0.5);
      }
      ctx.stroke();
      for (let y = T.HIDDEN; y < T.H; y++)
        for (let x = 0; x < T.W; x++) {
          const v = g.board[y * T.W + x];
          if (v) drawBlock(ctx, x, y - T.HIDDEN, c, g.over ? '#7b8494' : COLORS[v]);
        }
      if (g.cur && !T.isDone(g)) {
        const { t, r, x, y } = g.cur;
        const gy = T.ghostY(g);
        for (const [cx, cy] of T.cellsOf(t, r)) if (gy + cy >= T.HIDDEN) drawBlock(ctx, x + cx, gy + cy - T.HIDDEN, c, COLORS[t], true);
        for (const [cx, cy] of T.cellsOf(t, r)) if (y + cy >= T.HIDDEN) drawBlock(ctx, x + cx, y + cy - T.HIDDEN, c, COLORS[t]);
      }
    };
    const tick = (now) => {
      if (!paused.current && !T.isDone(g)) {
        acc += Math.min(250, now - last);
        while (acc >= STEP && !T.isDone(g)) {
          frame();
          acc -= STEP;
        }
      }
      last = now;
      if (bot) bot.advance(g.frame);
      draw(now);
      if (g.last && g.last !== lastSeen.current) {
        lastSeen.current = g.last;
        const text = clearLabel(g.last);
        if (text) setLabel({ text, big: g.last.lines === 4 || !!g.last.spin, key: g.last.frame });
      }
      if (now - hudAt > 90 || T.isDone(g)) {
        hudAt = now;
        setHud({
          score: g.score,
          lines: g.lines,
          level: g.level,
          frame: g.frame,
          next: g.queue.slice(0, 5),
          hold: g.hold,
          held: g.held,
          botLines: bot ? bot.game.lines : 0,
          botDone: bot ? T.isDone(bot.game) : false,
        });
      }
      if (T.isDone(g) && !ended.current) {
        ended.current = true;
        onEnd({ moves: moves.current, summary: T.summary(g) });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard (iPad keyboards too).
  useEffect(() => {
    const keys = {
      ArrowLeft: ['dir', 'left'],
      ArrowRight: ['dir', 'right'],
      ArrowDown: ['soft'],
      ArrowUp: ['tap', T.IN.cw],
      KeyX: ['tap', T.IN.cw],
      KeyZ: ['tap', T.IN.ccw],
      ControlLeft: ['tap', T.IN.ccw],
      Space: ['tap', T.IN.hard],
      KeyC: ['tap', T.IN.hold],
      ShiftLeft: ['tap', T.IN.hold],
      ShiftRight: ['tap', T.IN.hold],
    };
    const down = (e) => {
      if (e.key === 'Escape' || e.code === 'KeyP') {
        if (canPause) setPause(!paused.current);
        e.preventDefault();
        return;
      }
      const k = keys[e.code];
      if (!k) return;
      e.preventDefault();
      if (e.repeat) return;
      if (k[0] === 'dir') holdDir(k[1], true);
      else if (k[0] === 'soft') holdSoft(true);
      else press(k[1]);
    };
    const up = (e) => {
      const k = keys[e.code];
      if (!k) return;
      if (k[0] === 'dir') holdDir(k[1], false);
      if (k[0] === 'soft') holdSoft(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    // Away from the app: pause (when pausing is allowed).
    const hide = () => document.hidden && setPause(true);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gestures on the board.
  const gesture = useRef(null);
  const onDown = (e) => {
    if (e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gesture.current = { x: e.clientX, y: e.clientY, t: performance.now(), sx: 0, sy: 0, moved: false };
  };
  const onMove = (e) => {
    const s = gesture.current;
    if (!s) return;
    const c = cellRef.current;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const wantX = Math.trunc(dx / (c * 0.9));
    while (s.sx < wantX) {
      press(T.IN.right);
      s.sx++;
      s.moved = true;
    }
    while (s.sx > wantX) {
      press(T.IN.left);
      s.sx--;
      s.moved = true;
    }
    // A slow drag down drops a row per cell dragged.
    if (performance.now() - s.t > 140) {
      const wantY = Math.max(0, Math.trunc(dy / c));
      while (s.sy < wantY) {
        press(T.IN.soft);
        s.sy++;
        s.moved = true;
      }
    }
  };
  const onUp = (e) => {
    const s = gesture.current;
    gesture.current = null;
    if (!s) return;
    const c = cellRef.current;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = performance.now() - s.t;
    if (dt < 260 && dy > 1.5 * c && Math.abs(dx) < 1.5 * c) press(T.IN.hard);
    else if (dt < 300 && dy < -1.5 * c && Math.abs(dx) < 1.5 * c) press(T.IN.hold);
    else if (!s.moved && Math.abs(dx) < c * 0.5 && Math.abs(dy) < c * 0.5 && dt < 350) press(e.clientX - e.currentTarget.getBoundingClientRect().left < (T.W * c) / 3 ? T.IN.ccw : T.IN.cw);
  };

  // Hold-to-repeat buttons.
  const hold = (on, off) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      on();
    },
    onPointerUp: off,
    onPointerCancel: off,
    onContextMenu: (e) => e.preventDefault(),
  });
  const tap = (code) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      press(code);
    },
    onContextMenu: (e) => e.preventDefault(),
  });

  const mode = opts.mode;
  const seconds = (f) => clockText(Math.round((f * 1000) / T.FPS));
  const timeText = g.limit ? seconds(Math.max(0, g.limit - hud.frame)) : seconds(hud.frame);
  const small = Math.max(10, Math.round(cell * 0.55));
  const showLabels = animOn('celebrate');
  // Pause (playing alone), or give up (a race, Trotbot, a tournament: the clock can't stop).
  const stop = () =>
    canPause
      ? setPause(true)
      : confirmDialog({ title: 'Give up this game?', body: 'It counts as not finishing.', okLabel: 'Give up', danger: true }).then((ok) => ok && quit());

  return (
    <div className={`tet${touch ? ' touch' : ''}`}>
      <div className="tet-side tet-left">
        <div className="tet-box">
          <div className="tet-cap">Hold</div>
          <PieceBox pieces={[hud.hold]} cell={small} dim={hud.held} />
        </div>
        <div className="tet-stats">
          <div>
            <span className="tet-cap">Score</span>
            <b className="mono">{hud.score.toLocaleString('en-US')}</b>
          </div>
          <div>
            <span className="tet-cap">{mode === 'sprint' ? 'Lines left' : 'Lines'}</span>
            <b className="mono">{mode === 'sprint' ? Math.max(0, T.SPRINT_LINES - hud.lines) : hud.lines}</b>
          </div>
          {mode !== 'sprint' && (
            <div>
              <span className="tet-cap">Level</span>
              <b className="mono">{hud.level}</b>
            </div>
          )}
          <div>
            <span className="tet-cap">{g.limit ? 'Time left' : 'Time'}</span>
            <b className="mono">{timeText}</b>
          </div>
        </div>
        <button className="btn small tet-stop" onClick={stop}>
          <Icon name={canPause ? 'pause' : 'flag'} /> {canPause ? 'Pause' : 'Give up'}
        </button>
      </div>
      <div className="tet-center">
        <div className="tet-board-wrap" ref={wrapRef}>
          <canvas
            ref={boardRef}
            className="tet-board"
            style={{ width: T.W * cell, height: 20 * cell }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => (gesture.current = null)}
            aria-label="Tetris board"
          />
          {label && showLabels && (
            <div key={label.key} className={`tet-label${label.big ? ' big' : ''}`} onAnimationEnd={() => setLabel(null)}>
              {label.text}
            </div>
          )}
          {isPaused && (
            <div className="tet-paused">
              <b>Paused</b>
              <button className="btn primary" onClick={() => setPause(false)}>
                <Icon name="play" /> Resume
              </button>
              <button className="btn" onClick={quit}>
                End game
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="tet-side tet-right">
        <div className="tet-box">
          <div className="tet-cap">Next</div>
          <PieceBox pieces={hud.next} cell={small} rows={touch ? 3 : 5} />
        </div>
        {bot && (
          <MiniBoard
            board={boardText(bot.game.board)}
            cell={Math.max(4, Math.round(cell / 4))}
            label="Trotbot"
            sub={hud.botDone ? (bot.game.finished ? `Done · ${seconds(bot.game.frame)}` : 'Topped out') : `${hud.botLines}/40`}
            over={bot.game.over}
          />
        )}
        {other && (
          <MiniBoard
            board={other.board}
            cell={Math.max(4, Math.round(cell / 4))}
            label={other.name.split(' ')[0]}
            sub={other.done ? (other.over ? 'Topped out' : 'Done') : `${other.lines || 0}/40`}
            over={other.over}
          />
        )}
        {!bot && !other && (
          <ul className="tet-keys muted tiny">
            {(touch
              ? [['Tap', 'turn'], ['Drag', 'move'], ['Flick ↓', 'drop'], ['Flick ↑', 'hold']]
              : [['← →', 'move'], ['↑ X', 'turn'], ['Z', 'turn back'], ['↓', 'soft drop'], ['Space', 'drop'], ['C', 'hold'], ['Esc', 'pause']]
            ).map(([k, v]) => (
              <li key={k}>
                <kbd>{k}</kbd> {v}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="tet-pad tet-pad-left" aria-label="Move">
        <button className="tet-btn" aria-label="Hold" {...tap(T.IN.hold)}>
          <Icon name="swap" size={22} />
        </button>
        <span />
        <button className="tet-btn" aria-label={canPause ? 'Pause' : 'Give up'} onClick={stop}>
          <Icon name={canPause ? 'pause' : 'flag'} size={20} />
        </button>
        <button className="tet-btn" aria-label="Left" {...hold(() => holdDir('left', true), () => holdDir('left', false))}>
          <Icon name="left" size={26} />
        </button>
        <button className="tet-btn" aria-label="Soft drop" {...hold(() => holdSoft(true), () => holdSoft(false))}>
          <Icon name="down" size={26} />
        </button>
        <button className="tet-btn" aria-label="Right" {...hold(() => holdDir('right', true), () => holdDir('right', false))}>
          <Icon name="right" size={26} />
        </button>
      </div>
      <div className="tet-pad tet-pad-right" aria-label="Turn and drop">
        <button className="tet-btn" aria-label="Turn left" {...tap(T.IN.ccw)}>
          <Icon name="rotateCcw" size={24} />
        </button>
        <button className="tet-btn" aria-label="Turn right" {...tap(T.IN.cw)}>
          <Icon name="rotateCw" size={24} />
        </button>
        <button className="tet-btn wide primary" aria-label="Drop" {...tap(T.IN.hard)}>
          <Icon name="drop" size={24} />
        </button>
      </div>
    </div>
  );
}
