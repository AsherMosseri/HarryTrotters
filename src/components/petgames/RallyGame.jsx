import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RALLY_COUNT, buildLevel } from '../../../functions/shared/petRally.js';
import { rallyTime } from '../../../functions/shared/petgames.js';
import * as Rally from '../../petgames/rally.js';
import { PetWithGear } from '../PetGear.jsx';
import { Icon } from '../shell/icons.jsx';
import { movingOn, sceneColors, useFitCanvas, useFrames, useNoScroll, useOnHide } from './kit.js';

// Pet Rally (3.2): your pet drives a little car over hills, bumps, bridges
// and jumps to the flag. Gas and Brake (on screen, or the arrow keys) drive
// it and tip it. The physics is src/petgames/rally.js; this draws the ground
// on a canvas, the wheels too, and moves the car body with the pet in it
// (PetArt, in its colors and gear) over them.

const FAIL = {
  flipped: ['Flipped!', (n) => `${n} bumped its head. Ease off the gas on big hills, and tap Brake in the air to level out.`],
  splash: ['Splash!', (n) => `${n} went for a swim. Go full speed off the ramp.`],
  stuck: ['Stuck!', (n) => `${n} can’t get going from there. Try it again.`],
};

export default function RallyGame({ pet, stage, level: n, best, onEnd, onQuit, onLevel }) {
  const level = useMemo(() => buildLevel(n), [n]);
  const wrap = useRef(null);
  const canvas = useRef(null);
  const carEl = useRef(null);
  const [size, live] = useFitCanvas(wrap, canvas);
  const car = useRef(null);
  const cam = useRef({ x: 0, y: 0, lead: 0 });
  const keys = useRef({ gas: false, brake: false });
  const pads = useRef({ gas: new Set(), brake: new Set() });
  const [pressed, setPressed] = useState({ gas: false, brake: false });
  const acc = useRef(0);
  const colors = useRef(null);
  const [hud, setHud] = useState({ status: 'ready', t: 0, pct: 0 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const ended = useRef(false);
  const timeEl = useRef(null);
  // The best before this run (the parent's changes as soon as it ends).
  const before = useRef(best);
  const barEl = useRef(null);
  useNoScroll(wrap);

  const fresh = useCallback(() => {
    before.current = best;
    car.current = Rally.newCar(level);
    cam.current = { x: car.current.x, y: car.current.y, lead: 0 };
    acc.current = 0;
    ended.current = false;
    keys.current = { gas: false, brake: false };
    pads.current = { gas: new Set(), brake: new Set() };
    setPressed({ gas: false, brake: false });
    setHud({ status: 'ready', t: 0, pct: 0 });
  }, [level, best]);
  // One level a screen (the parent keys this by level).
  if (!car.current) {
    car.current = Rally.newCar(level);
    cam.current = { x: car.current.x, y: car.current.y, lead: 0 };
  }

  useEffect(() => {
    if (size.h) colors.current = sceneColors(wrap.current);
  }, [size]);

  const pause = useCallback((on) => {
    pausedRef.current = on;
    setPaused(on);
    keys.current = { gas: false, brake: false };
    pads.current = { gas: new Set(), brake: new Set() };
    setPressed({ gas: false, brake: false });
  }, []);
  useOnHide(() => {
    if (car.current?.status === 'go') pause(true);
  });

  // Keys: Right / Up / D / W for gas, Left / Down / A / S to brake,
  // R to start over, P or Escape to pause.
  useEffect(() => {
    const GAS = ['ArrowRight', 'ArrowUp', 'd', 'D', 'w', 'W'];
    const BRAKE = ['ArrowLeft', 'ArrowDown', 'a', 'A', 's', 'S'];
    const set = (e, on) => {
      if (GAS.includes(e.key)) keys.current.gas = on;
      else if (BRAKE.includes(e.key)) keys.current.brake = on;
      else return false;
      e.preventDefault();
      if (on && pausedRef.current) pause(false);
      return true;
    };
    const down = (e) => {
      if (set(e, true) || e.repeat) return;
      const st = car.current.status;
      if (e.key === 'r' || e.key === 'R') fresh();
      else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && st === 'go') {
        e.preventDefault();
        e.stopPropagation();
        pause(!pausedRef.current);
      }
    };
    const up = (e) => set(e, false);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [fresh, pause]);

  // The on-screen pedals: any finger on one holds it (two thumbs work).
  const pedal = (which) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pads.current[which].add(e.pointerId);
      setPressed((p) => ({ ...p, [which]: true }));
      if (pausedRef.current) pause(false);
    },
    onPointerUp: (e) => release(which, e.pointerId),
    onPointerCancel: (e) => release(which, e.pointerId),
    onLostPointerCapture: (e) => release(which, e.pointerId),
    onContextMenu: (e) => e.preventDefault(),
  });
  const release = (which, id) => {
    pads.current[which].delete(id);
    if (!pads.current[which].size) setPressed((p) => (p[which] ? { ...p, [which]: false } : p));
  };

  useFrames((dt) => {
    const c = car.current;
    const { w, h, dpr } = live.current;
    if (!h || !canvas.current) return;
    wrap.current.pgState = c; // read by the Playwright check (scripts) only
    const input = { gas: keys.current.gas || pads.current.gas.size > 0, brake: keys.current.brake || pads.current.brake.size > 0 };
    if (!pausedRef.current) {
      acc.current += dt;
      let k = 0;
      const was = c.status;
      while (acc.current >= Rally.DT && k < 40) {
        Rally.step(c, level, input);
        acc.current -= Rally.DT;
        k++;
      }
      if (c.status !== was) {
        setHud({ status: c.status, t: c.t, pct: Math.min(1, (c.x - level.startX) / (level.flagX - level.startX)) });
        if (c.status !== 'go' && !ended.current) {
          ended.current = true;
          onEnd?.({ status: c.status, ms: Math.round(c.t * 1000), level: n });
        }
      }
    }
    // The timer and the progress bar without re-rendering anything.
    if (timeEl.current) timeEl.current.textContent = rallyTime(c.t * 1000);
    if (barEl.current) barEl.current.style.transform = `scaleX(${Math.max(0.01, Math.min(1, (c.x - level.startX) / (level.flagX - level.startX))).toFixed(3)})`;
    const view = camera(cam.current, c, w, h, dt);
    draw(canvas.current.getContext('2d'), level, c, view, w, h, dpr, colors.current || sceneColors(wrap.current));
    const el = carEl.current;
    if (el) {
      const { ppm } = view;
      const k = ppm / 100;
      const sx = view.sx(c.x);
      const sy = view.sy(c.y);
      el.style.transform = `translate3d(${(sx - 140 * k).toFixed(1)}px, ${(sy - 175 * k).toFixed(1)}px, 0) rotate(${(-c.a).toFixed(4)}rad)`;
    }
  });

  const ppm = scaleOf(size.w, size.h);
  const k = ppm / 100;
  const st = hud.status;
  const won = st === 'won';
  const failed = FAIL[st];
  const newBest = won && (!before.current || Math.round(hud.t * 1000) < before.current);
  return (
    <div className="pg-play pg-rally">
      <div ref={wrap} className="pg-stage" onContextMenu={(e) => e.preventDefault()}>
        <canvas ref={canvas} className="pg-canvas" aria-label={`Pet Rally, level ${n}`} role="img" />
        <div
          ref={carEl}
          className="pr-car"
          style={{ width: 280 * k, height: 235 * k, transformOrigin: `${140 * k}px ${175 * k}px` }}
          aria-hidden="true"
        >
          <CarBack />
          <div className="pr-pet" style={{ left: (140 - 12 - PET / 2) * k, top: (175 - PET_Y - PET / 2) * k, width: PET * k, height: PET * k }}>
            <PetWithGear species={pet.species} gear={pet.gear} stage={stage} mood={failed ? 'sad' : 'happy'} size={PET * k} still={!movingOn()} />
          </div>
          <CarFront />
        </div>
        <div className="pg-hud">
          <button className="pg-hud-btn" onClick={() => (st === 'go' ? pause(true) : onQuit())} aria-label={st === 'go' ? 'Pause' : 'Back to the levels'}>
            <Icon name={st === 'go' ? 'pause' : 'left'} size={20} />
          </button>
          <div className="pr-top">
            <span className="pr-level">
              <b>Level {n}</b> <span className="pr-name">{level.name}</span>
            </span>
            <span className="pr-bar" aria-hidden="true">
              <span ref={barEl} />
            </span>
            <span className="pr-times mono">
              <span ref={timeEl}>0.00 s</span>
              {best ? <span className="pr-best"> · best {rallyTime(best)}</span> : null}
            </span>
          </div>
          <button className="pg-hud-btn" onClick={fresh} aria-label="Start over">
            <Icon name="rotateCcw" size={19} />
          </button>
        </div>
        {st === 'ready' && !paused && (
          <div className="pg-hint pr-hint">
            <b>Hold Gas to go</b>
            <span>{level.tip}</span>
          </div>
        )}
        <div className="pr-pedals">
          <button className={`pr-pedal brake${pressed.brake ? ' on' : ''}`} {...pedal('brake')} aria-label="Brake (Left arrow)">
            <span className="pr-pedal-icon" aria-hidden="true">
              <Icon name="left" size={22} />
            </span>
            Brake
          </button>
          <button className={`pr-pedal gas${pressed.gas ? ' on' : ''}`} {...pedal('gas')} aria-label="Gas (Right arrow)">
            Gas
            <span className="pr-pedal-icon" aria-hidden="true">
              <Icon name="right" size={22} />
            </span>
          </button>
        </div>
        {paused && (
          <div className="pg-panel" role="dialog" aria-label="Paused">
            <b className="pg-panel-title">Paused</b>
            <div className="pg-panel-btns">
              <button className="btn primary" onClick={() => pause(false)} autoFocus>
                Keep going
              </button>
              <button className="btn" onClick={onQuit}>
                Quit
              </button>
            </div>
          </div>
        )}
        {won && (
          <div className="pg-panel" role="dialog" aria-label="Finished">
            <b className="pg-panel-title">{newBest ? 'New best!' : 'Finished!'}</b>
            <span className="pg-panel-big mono">{rallyTime(hud.t * 1000)}</span>
            <span className="muted">
              Level {n}, {level.name}
              {!newBest && best ? ` · best ${rallyTime(best)}` : ''}
            </span>
            <div className="pg-panel-btns">
              {n < RALLY_COUNT ? (
                <button className="btn primary" onClick={() => onLevel(n + 1)} autoFocus>
                  Next level
                </button>
              ) : (
                <span className="pg-champ">All {RALLY_COUNT} levels done!</span>
              )}
              <button className="btn" onClick={fresh}>
                Again
              </button>
              <button className="btn" onClick={onQuit}>
                Levels
              </button>
            </div>
          </div>
        )}
        {failed && (
          <div className="pg-panel" role="dialog" aria-label={failed[0]}>
            <b className="pg-panel-title">{failed[0]}</b>
            <span className="muted pg-panel-body">{failed[1](pet.name)}</span>
            <div className="pg-panel-btns">
              <button className="btn primary" onClick={fresh} autoFocus>
                Try again
              </button>
              <button className="btn" onClick={onQuit}>
                Levels
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- the car (drawn in cm, 0,0 at the body's middle, y down) ----------
// The pet sits in it: PET cm tall, its middle PET_Y cm above the body's.
const PET = 148;
const PET_Y = 60;
const RED = '#e0475b';
const RED_DARK = '#9b2335';
function CarBack() {
  return (
    <svg className="pr-svg" viewBox="-140 -175 280 235" aria-hidden="true">
      {/* the roll bar and the seat back, behind the pet */}
      <path d="M-96 -12 L-86 -104 Q-82 -118 -66 -118 L-40 -118" stroke="#4a5363" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-78 -12 L-72 -58 Q-70 -66 -60 -66 L-46 -66 L-48 -12 Z" fill="#3a4152" />
      {/* the little wing at the back */}
      <path d="M-120 -14 L-114 -40" stroke="#4a5363" strokeWidth="5" strokeLinecap="round" />
      <rect x="-136" y="-50" width="40" height="11" rx="4" fill={RED_DARK} />
    </svg>
  );
}
function CarFront() {
  return (
    <svg className="pr-svg" viewBox="-140 -175 280 235" aria-hidden="true">
      <path
        d="M-118 -16 L94 -16 Q124 -14 129 6 L126 20 L123 20 A44 44 0 0 0 41 20 L-41 20 A44 44 0 0 0 -123 20 L-125 4 Q-125 -16 -118 -16 Z"
        fill={RED}
        stroke={RED_DARK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M-112 -4 L112 -4" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      <path d="M-104 -11 L80 -11" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      <circle cx="117" cy="2" r="6" fill="#ffd84d" stroke={RED_DARK} strokeWidth="2" />
      <rect x="-122" y="2" width="8" height="8" rx="2" fill="#ff8a8a" />
      <g transform="translate(-6 8)">
        <rect x="-26" y="-7" width="52" height="15" rx="4" fill="#fff" stroke={RED_DARK} strokeWidth="1.5" />
        <text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="system-ui, sans-serif" fill={RED_DARK}>
          32313
        </text>
      </g>
    </svg>
  );
}

// ---------- the camera ----------
// Pixels a meter: about 12 m across a phone, more on an iPad.
export function scaleOf(w, h) {
  if (!w || !h) return 40;
  return Math.max(26, Math.min(64, Math.min(w / 10.5, h / 7.5)));
}
function camera(cam, c, w, h, dt) {
  const ppm = scaleOf(w, h);
  // Look ahead when going fast; follow up and down softly.
  const lead = Math.max(-1, Math.min(4, (w * 0.2) / ppm, c.vx * 0.35));
  const f = 1 - Math.exp(-dt * 3);
  cam.lead += (lead - cam.lead) * f;
  cam.x = c.x + cam.lead;
  cam.y += (c.y - cam.y) * (1 - Math.exp(-dt * 5));
  const ox = w * 0.42;
  // Above the pedals: they take the bottom corners.
  const oy = h > w ? h * 0.56 : h < 500 ? h * 0.5 : h * 0.6;
  return {
    ppm,
    sx: (x) => ox + (x - cam.x) * ppm,
    sy: (y) => oy - (y - cam.y) * ppm,
    x0: cam.x - ox / ppm,
    x1: cam.x + (w - ox) / ppm,
    camX: cam.x,
    camY: cam.y,
  };
}

// ---------- drawing ----------
const TAU = Math.PI * 2;
function draw(ctx, level, c, v, w, h, dpr, C) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, C.sky1);
  sky.addColorStop(1, C.sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const { ppm } = v;
  // Clouds and far hills move slower (parallax).
  ctx.fillStyle = C.cloud;
  for (let i = 0; i < 6; i++) {
    const span = w + 240;
    const cx = ((((i * 211 - v.camX * ppm * 0.12) % span) + span) % span) - 120;
    const cy = 30 + ((i * 53) % Math.max(60, h * 0.3));
    const r = ppm * (0.5 + (i % 3) * 0.18);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.arc(cx + r * 0.9, cy + r * 0.2, r * 0.75, 0, TAU);
    ctx.arc(cx - r * 0.9, cy + r * 0.25, r * 0.65, 0, TAU);
    ctx.fill();
  }
  const base = h * 0.62 + v.camY * ppm * 0.25;
  for (const [layer, color, amp, speed] of [
    [0, C.far, 1.0, 0.25],
    [1, C.far2, 0.7, 0.45],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let sx = 0; sx <= w + 8; sx += 8) {
      const X = (sx + v.camX * ppm * speed) / ppm;
      const y = base + layer * ppm * 0.9 - ppm * amp * (2.2 + Math.sin(X * 0.17 + layer) * 1.3 + Math.sin(X * 0.41 + layer * 2) * 0.5);
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // Water under bridges and in the pits.
  for (const [a, b, wy] of level.water) {
    if (b < v.x0 - 1 || a > v.x1 + 1) continue;
    const x0 = v.sx(a);
    const x1 = v.sx(b);
    const y0 = v.sy(wy);
    ctx.fillStyle = C.water;
    ctx.fillRect(x0, y0, x1 - x0, h - y0 + 2);
    ctx.fillStyle = C.wave;
    const t = c.t;
    for (let x = x0 + ((t * 30) % 24) - 24; x < x1; x += 24) ctx.fillRect(Math.max(x0, x), y0 + 3, Math.min(10, x1 - Math.max(x0, x)), 2);
  }

  // The ground: filled runs (not under a bridge), grass on top.
  const { pts, kind } = level;
  let i0 = 0;
  while (i0 < pts.length - 2 && pts[i0 + 1][0] < v.x0 - 1) i0++;
  let i1 = i0;
  while (i1 < pts.length - 1 && pts[i1][0] < v.x1 + 1) i1++;
  let run = null;
  const flush = (end) => {
    if (!run) return;
    ctx.beginPath();
    ctx.moveTo(v.sx(pts[run][0]), h + 2);
    for (let i = run; i <= end; i++) ctx.lineTo(v.sx(pts[i][0]), v.sy(pts[i][1]));
    ctx.lineTo(v.sx(pts[end][0]), h + 2);
    ctx.closePath();
    ctx.fillStyle = C.dirt;
    ctx.fill();
    // a darker band deeper down
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = C.dirt2;
    ctx.lineWidth = ppm * 0.9;
    ctx.beginPath();
    for (let i = run; i <= end; i++) ctx.lineTo(v.sx(pts[i][0]), v.sy(pts[i][1]) + ppm * 1.4);
    ctx.stroke();
    ctx.restore();
    run = null;
  };
  for (let i = i0; i < i1; i++) {
    if (kind[i] === 'bridge') {
      flush(i);
      continue;
    }
    if (run === null) run = i;
  }
  flush(i1);
  // Grass along the top (dirt on pit walls).
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, ppm * 0.2);
  ctx.strokeStyle = C.grass;
  ctx.beginPath();
  for (let i = i0; i < i1; i++) {
    if (kind[i] !== 'ground') continue;
    ctx.moveTo(v.sx(pts[i][0]), v.sy(pts[i][1]));
    ctx.lineTo(v.sx(pts[i + 1][0]), v.sy(pts[i + 1][1]));
  }
  ctx.stroke();
  // Bridges: planks on the deck and a rope rail.
  ctx.lineWidth = Math.max(4, ppm * 0.22);
  ctx.strokeStyle = '#9a6a3a';
  ctx.beginPath();
  for (let i = i0; i < i1; i++) {
    if (kind[i] !== 'bridge') continue;
    ctx.moveTo(v.sx(pts[i][0]), v.sy(pts[i][1]) + ctx.lineWidth / 2);
    ctx.lineTo(v.sx(pts[i + 1][0]), v.sy(pts[i + 1][1]) + ctx.lineWidth / 2);
  }
  ctx.stroke();
  ctx.lineWidth = Math.max(1, ppm * 0.04);
  ctx.strokeStyle = '#5e3d1d';
  ctx.beginPath();
  for (let i = i0; i < i1; i++) {
    if (kind[i] !== 'bridge') continue;
    const x = v.sx(pts[i][0]);
    const y = v.sy(pts[i][1]);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + Math.max(4, ppm * 0.22));
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(94,61,29,0.75)';
  ctx.lineWidth = Math.max(1.5, ppm * 0.05);
  ctx.beginPath();
  for (let i = i0; i < i1; i++) {
    if (kind[i] !== 'bridge') continue;
    ctx.moveTo(v.sx(pts[i][0]), v.sy(pts[i][1] + 0.85));
    ctx.lineTo(v.sx(pts[i + 1][0]), v.sy(pts[i + 1][1] + 0.85));
  }
  ctx.stroke();

  // Field things along the way.
  for (const p of level.props) {
    if (p.x < v.x0 - 3 || p.x > v.x1 + 3) continue;
    prop(ctx, p, v, c);
  }

  // The wheels (the car body is drawn over them, outside the canvas).
  for (const wh of c.wheels) wheel(ctx, v.sx(wh.x), v.sy(wh.y), Rally.CAR.wheelR * ppm, wh.turn);
}

function wheel(ctx, x, y, r, turn) {
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c9d1dc';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.56, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7f8a99';
  for (let k = 0; k < 5; k++) {
    const a = -turn + (k * TAU) / 5;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32, r * 0.1, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#4a5363';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.13, 0, TAU);
  ctx.fill();
}

function prop(ctx, p, v, c) {
  const { ppm } = v;
  const x = v.sx(p.x);
  const y = v.sy(p.y);
  if (p.kind === 'flag') {
    ctx.fillStyle = '#4a5363';
    ctx.fillRect(x - ppm * 0.05, y - ppm * 2.6, ppm * 0.1, ppm * 2.6);
    const fw = ppm * 1.1;
    const fh = ppm * 0.72;
    const sq = fw / 6;
    const wave = Math.sin(c.t * 6) * ppm * 0.04;
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#222' : '#fff';
        ctx.fillRect(x + ppm * 0.05 + i * sq, y - ppm * 2.6 + j * (fh / 4) + (i % 2 ? wave : -wave), sq + 0.5, fh / 4 + 0.5);
      }
    return;
  }
  if (p.kind === 'cone') {
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.moveTo(x - ppm * 0.08, y - ppm * 0.6);
    ctx.lineTo(x + ppm * 0.08, y - ppm * 0.6);
    ctx.lineTo(x + ppm * 0.24, y - ppm * 0.06);
    ctx.lineTo(x - ppm * 0.24, y - ppm * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - ppm * 0.15, y - ppm * 0.38, ppm * 0.3, ppm * 0.08);
    ctx.fillStyle = '#e06a10';
    ctx.fillRect(x - ppm * 0.3, y - ppm * 0.08, ppm * 0.6, ppm * 0.08);
    return;
  }
  if (p.kind === 'gear') {
    ctx.fillStyle = '#5d6878';
    ctx.fillRect(x - ppm * 0.04, y - ppm * 1.2, ppm * 0.08, ppm * 1.2);
    const r = ppm * 0.38;
    ctx.save();
    ctx.translate(x, y - ppm * 1.3);
    ctx.rotate(c.t * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rr = i % 2 ? r * 0.78 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#f2b82e';
    ctx.fill();
    ctx.fillStyle = '#a8741a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (p.kind === 'post') {
    ctx.fillStyle = '#7a5330';
    ctx.fillRect(x - ppm * 0.08, y - ppm * 1.0, ppm * 0.16, ppm * 2.4);
    ctx.fillStyle = '#5e3d1d';
    ctx.fillRect(x - ppm * 0.12, y - ppm * 1.05, ppm * 0.24, ppm * 0.12);
    return;
  }
  if (p.kind === 'ramp') {
    // Yellow and black stripes under the lip.
    const hgt = Math.min(p.h, 1.2) * ppm;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - ppm * 0.3, y, ppm * 0.3, hgt);
    ctx.clip();
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(x - ppm * 0.3, y, ppm * 0.3, hgt);
    ctx.fillStyle = '#2a2730';
    for (let k = -2; k < 10; k++) {
      ctx.beginPath();
      const yy = y + k * ppm * 0.25;
      ctx.moveTo(x - ppm * 0.3, yy);
      ctx.lineTo(x, yy - ppm * 0.15);
      ctx.lineTo(x, yy - ppm * 0.03);
      ctx.lineTo(x - ppm * 0.3, yy + ppm * 0.12);
      ctx.fill();
    }
    ctx.restore();
  }
}
