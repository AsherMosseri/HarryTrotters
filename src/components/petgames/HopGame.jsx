import { useCallback, useEffect, useRef, useState } from 'react';
import * as Hop from '../../petgames/hop.js';
import { PetWithGear } from '../PetGear.jsx';
import { Icon } from '../shell/icons.jsx';
import { movingOn, sceneColors, useFitCanvas, useFrames, useNoScroll, useOnHide } from './kit.js';

// Pet Hop (3.2): tap anywhere (or Space / Up) and your pet hops up through
// the gaps in the field towers. The rules are in src/petgames/hop.js; this
// draws them on a canvas, with the pet itself (PetArt, in its colors and
// gear) moved over it.

const SPRITE = 13; // the pet's size in world units

export default function HopGame({ pet, stage, best, onEnd, onQuit }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const sprite = useRef(null);
  const [size, live] = useFitCanvas(wrap, canvas);
  const game = useRef(null);
  const flap = useRef(false);
  const acc = useRef(0);
  const colors = useRef(null);
  const [hud, setHud] = useState({ score: 0, status: 'ready' });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const overAt = useRef(0);
  const ended = useRef(false);
  useNoScroll(wrap);

  const fresh = useCallback(() => {
    const { w, h } = live.current;
    game.current = Hop.newHop({ width: h ? (w / h) * Hop.H : 60, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    acc.current = 0;
    ended.current = false;
    setHud({ score: 0, status: 'ready' });
  }, [live]);
  if (!game.current) game.current = Hop.newHop({ width: 60 });

  // The world is as wide as the screen's shape; it follows a turned device.
  useEffect(() => {
    if (!size.h) return;
    colors.current = sceneColors(wrap.current);
    const g = game.current;
    g.w = Math.max(48, Math.min(170, (size.w / size.h) * Hop.H));
    if (g.status === 'ready') g.x = Math.max(16, Math.min(g.w * 0.3, 40));
  }, [size]);

  const pause = useCallback((on) => {
    pausedRef.current = on;
    setPaused(on);
  }, []);
  useOnHide(() => {
    if (game.current?.status === 'go') pause(true);
  });

  const press = useCallback(() => {
    const g = game.current;
    if (pausedRef.current) return;
    if (g.status === 'over') return;
    flap.current = true;
  }, []);

  // Keys: Space, Up, W or Enter to hop; P or Escape to pause.
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      if ([' ', 'ArrowUp', 'w', 'W', 'Enter'].includes(e.key)) {
        e.preventDefault();
        if (pausedRef.current) return pause(false);
        if (game.current.status === 'over') {
          if (Date.now() - overAt.current > 600) fresh();
          return;
        }
        press();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (game.current.status === 'go') {
          e.preventDefault();
          e.stopPropagation();
          pause(!pausedRef.current);
        }
      }
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [press, pause, fresh]);

  useFrames((dt) => {
    const g = game.current;
    const { w, h, dpr } = live.current;
    if (!h || !canvas.current) return;
    if (!pausedRef.current) {
      acc.current += dt;
      let n = 0;
      while (acc.current >= Hop.DT && n < 24) {
        const before = g.score;
        const was = g.status;
        Hop.step(g, flap.current);
        flap.current = false;
        acc.current -= Hop.DT;
        n++;
        if (g.score !== before || g.status !== was) setHud({ score: g.score, status: g.status });
        if (g.status === 'over' && was !== 'over') {
          overAt.current = Date.now();
          if (!ended.current) {
            ended.current = true;
            onEnd?.(g.score);
          }
        }
      }
    }
    draw(canvas.current.getContext('2d'), g, w, h, dpr, colors.current || sceneColors(wrap.current));
    // The pet over the canvas: one transform a frame.
    const s = h / Hop.H;
    const el = sprite.current;
    if (el) {
      const px = SPRITE * s;
      el.style.transform = `translate3d(${(g.x * s - px / 2).toFixed(1)}px, ${(g.y * s - px / 2).toFixed(1)}px, 0) rotate(${Hop.tiltOf(g).toFixed(3)}rad)`;
    }
  });

  const px = Math.round((SPRITE * size.h) / Hop.H) || 48;
  const isBest = hud.status === 'over' && hud.score > 0 && hud.score > (best || 0);
  return (
    <div className="pg-play pg-hop">
      <div
        ref={wrap}
        className="pg-stage"
        onPointerDown={(e) => {
          if (e.target.closest('button')) return;
          e.preventDefault();
          if (game.current.status === 'over') return;
          press();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvas} className="pg-canvas" aria-label="Pet Hop" role="img" />
        <div ref={sprite} className="pg-sprite" style={{ width: px, height: px }} aria-hidden="true">
          <PetWithGear species={pet.species} gear={pet.gear} stage={stage} mood={hud.status === 'over' ? 'sad' : 'happy'} size={px} still={!movingOn()} />
        </div>
        <div className="pg-hud">
          <button className="pg-hud-btn" onClick={() => (hud.status === 'go' ? pause(true) : onQuit())} aria-label={hud.status === 'go' ? 'Pause' : 'Back to the games'}>
            <Icon name={hud.status === 'go' ? 'pause' : 'left'} size={20} />
          </button>
          <div className="pg-score" aria-live="polite">
            <b className="mono">{hud.score}</b>
            <span className="mono">Best {Math.max(best || 0, hud.score)}</span>
          </div>
          <span className="pg-hud-gap" />
        </div>
        {hud.status === 'ready' && !paused && (
          <div className="pg-hint">
            <b>Tap to hop</b>
            <span>Fly {pet.name} through the gaps. Space or Up works too.</span>
          </div>
        )}
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
        {hud.status === 'over' && (
          <div className="pg-panel" role="dialog" aria-label="Game over">
            <b className="pg-panel-title">{isBest ? 'New best!' : 'Bonk!'}</b>
            <span className="pg-panel-big mono">{hud.score}</span>
            <span className="muted">
              {hud.score === 1 ? '1 gap' : `${hud.score} gaps`} · best <span className="mono">{Math.max(best || 0, hud.score)}</span>
            </span>
            <div className="pg-panel-btns">
              <button className="btn primary" onClick={fresh} autoFocus>
                Play again
              </button>
              <button className="btn" onClick={onQuit}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- drawing ----------
const TAU = Math.PI * 2;

function draw(ctx, g, w, h, dpr, C) {
  const s = h / Hop.H;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, C.sky1);
  sky.addColorStop(1, C.sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(s, s);
  const W = w / s;
  // Clouds, slow.
  ctx.fillStyle = C.cloud;
  for (let i = 0; i < 5; i++) {
    const span = W + 60;
    const cx = ((((i * 47 - g.dist * 0.15) % span) + span) % span) - 30;
    const cy = 10 + ((i * 13) % 30);
    cloud(ctx, cx, cy, 6 + (i % 3) * 2);
  }
  // The field wall far back: clear panels on a metal frame.
  const wallTop = Hop.GROUND - 22;
  ctx.fillStyle = C.wall;
  ctx.fillRect(0, wallTop, W, Hop.GROUND - wallTop);
  ctx.fillStyle = C.frame;
  ctx.fillRect(0, wallTop, W, 1.2);
  const post = 24;
  const off = (g.dist * 0.4) % post;
  for (let x = -off; x < W + post; x += post) ctx.fillRect(x, wallTop, 1.2, Hop.GROUND - wallTop);
  // Towers.
  for (const t of g.towers) tower(ctx, t, g, C);
  // The floor: gray foam field tiles with seams, and a white tape line.
  ctx.fillStyle = C.tile;
  ctx.fillRect(0, Hop.GROUND, W, Hop.H - Hop.GROUND + 1);
  ctx.fillStyle = C.seam;
  ctx.fillRect(0, Hop.GROUND, W, 0.8);
  const tile = 12;
  const toff = g.dist % tile;
  for (let x = -toff; x < W + tile; x += tile) {
    ctx.fillRect(x, Hop.GROUND, 0.5, Hop.H - Hop.GROUND);
    // The tiles' puzzle edges: a little tab on each seam.
    ctx.beginPath();
    ctx.arc(x, Hop.GROUND + 6, 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, Hop.GROUND + 3, W, 0.9);
  ctx.restore();
}

function cloud(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.arc(x + r * 0.9, y + r * 0.2, r * 0.75, 0, TAU);
  ctx.arc(x - r * 0.9, y + r * 0.25, r * 0.65, 0, TAU);
  ctx.fill();
}

const METAL = '#b9c2ce';
const METAL_DARK = '#7f8a99';
const STEEL = '#5d6878';
const ORANGE = '#ff8a1f';

function tower(ctx, t, g, C) {
  const tw = Hop.HOP.towerW;
  const x0 = t.x - tw / 2;
  const top = t.top;
  const bot = t.bottom;
  if (t.kind === 'beam') {
    // Aluminum channel with a row of holes, an orange plate at each end.
    for (const [y0, y1, end] of [
      [-2, top, top],
      [bot, Hop.GROUND, bot],
    ]) {
      ctx.fillStyle = METAL;
      ctx.fillRect(x0, y0, tw, y1 - y0);
      ctx.fillStyle = METAL_DARK;
      ctx.fillRect(x0, y0, 1.3, y1 - y0);
      ctx.fillRect(x0 + tw - 1.3, y0, 1.3, y1 - y0);
      ctx.fillStyle = C.seam;
      const first = end === top ? top - 6 : bot + 6;
      const dir = end === top ? -1 : 1;
      for (let y = first; dir < 0 ? y > y0 : y < y1; y += 4.5 * dir) {
        ctx.beginPath();
        ctx.arc(t.x, y, 1.05, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = ORANGE;
      ctx.fillRect(x0 - 0.2, end === top ? top - 2.6 : bot, tw + 0.4, 2.6);
    }
    return;
  }
  if (t.kind === 'gear') {
    // A steel post with a turning gear at the end.
    ctx.fillStyle = STEEL;
    ctx.fillRect(x0 + 1.5, -2, tw - 3, top + 2 - 4);
    ctx.fillRect(x0 + 1.5, bot + 4, tw - 3, Hop.GROUND - bot - 4);
    const spin = t.spin + g.dist * 0.12;
    gear(ctx, t.x, top - tw / 2 + 0.6, tw / 2 - 0.2, spin, '#f2b82e', '#a8741a');
    gear(ctx, t.x, bot + tw / 2 - 0.6, tw / 2 - 0.2, -spin, '#f2b82e', '#a8741a');
    return;
  }
  // Cones: a blue post topped (or tipped) with a traffic cone.
  ctx.fillStyle = '#3a6fd8';
  ctx.fillRect(x0, -2, tw, top - 9 + 2);
  ctx.fillRect(x0, bot + 9, tw, Hop.GROUND - bot - 9);
  ctx.fillStyle = '#2a55b0';
  ctx.fillRect(x0, -2, 1.3, top - 9 + 2);
  ctx.fillRect(x0, bot + 9, 1.3, Hop.GROUND - bot - 9);
  cone(ctx, t.x, top, -1, tw);
  cone(ctx, t.x, bot, 1, tw);
}

function gear(ctx, cx, cy, r, a, fill, line) {
  const teeth = 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const ang = (i / (teeth * 2)) * TAU;
    const rr = i % 2 ? r * 0.8 : r;
    const half = (TAU / (teeth * 2)) * 0.42;
    ctx.lineTo(Math.cos(ang - half) * rr, Math.sin(ang - half) * rr);
    ctx.lineTo(Math.cos(ang + half) * rr, Math.sin(ang + half) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, TAU);
  ctx.fillStyle = line;
  ctx.fill();
  ctx.restore();
}

// A traffic cone whose tip is at y (dir 1: pointing up from below).
function cone(ctx, cx, y, dir, tw) {
  const hgt = 9;
  const base = y + dir * hgt;
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.moveTo(cx - tw * 0.22, y);
  ctx.lineTo(cx + tw * 0.22, y);
  ctx.lineTo(cx + tw * 0.5, base - dir * 1.2);
  ctx.lineTo(cx - tw * 0.5, base - dir * 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  const sy = y + dir * hgt * 0.42;
  ctx.fillRect(cx - tw * 0.36, sy - 0.9, tw * 0.72, 1.8);
  ctx.fillStyle = '#e06a10';
  ctx.fillRect(cx - tw / 2, base - (dir > 0 ? 1.3 : 0), tw, 1.3);
}
