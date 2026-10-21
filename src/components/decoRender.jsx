import { gradientStops } from '../nitro.js';

// Draws a custom avatar decoration: a ring (style, colors, thickness, spin)
// and up to three stickers (emoji, GIF, or picture) placed anywhere on or
// around the avatar, each sized, rotated, and animated.
//
// custom = {
//   ring: { style, colors: [a, b, c?], width (% of avatar, up to 40), spin: '' | 'cw' | 'ccw', speed (s) },
//   badges: [{ kind: 'emoji' | 'image', value, path?, angle (°, 0 = top), dist (0 center … 0.75 outside),
//              size (× avatar), rotate (°), anim, dir: 'cw' | 'ccw', speed (s) }],
// }

export const RING_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'duo', label: 'Two-tone' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'glow', label: 'Glow' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dots', label: 'Dots' },
];
export const BADGE_ANIMS = [
  { id: 'none', label: 'Still' },
  { id: 'orbit', label: '🪐 Orbit' },
  { id: 'spin', label: '🌀 Spin' },
  { id: 'bob', label: '↕ Bob' },
  { id: 'pulse', label: '💓 Pulse' },
  { id: 'wiggle', label: '〰 Wiggle' },
  { id: 'float', label: '🎈 Float' },
];
export const DEFAULT_DECO = {
  ring: { style: 'gradient', colors: ['#8b5cf6', '#06b6d4'], width: 9, spin: 'cw', speed: 4 },
  badges: [{ kind: 'emoji', value: '⭐', angle: 45, dist: 0.5, size: 0.38, rotate: 0, anim: 'none', dir: 'cw', speed: 3 }],
};

function ringBackground({ style, colors = [] }) {
  const cs = colors.filter(Boolean);
  const [a = '#8b5cf6', b = '#06b6d4', c] = cs;
  switch (style) {
    case 'solid':
    case 'glow':
      return a;
    case 'gradient':
      return `linear-gradient(135deg, ${gradientStops([a, b, c])})`;
    case 'duo':
      return c ? `conic-gradient(${a} 0 33.3%, ${b} 33.3% 66.6%, ${c} 66.6% 100%)` : `conic-gradient(${a} 0 50%, ${b} 50% 100%)`;
    case 'rainbow':
      return 'conic-gradient(#ef4444, #f97316, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)';
    case 'dashed':
      return c
        ? `repeating-conic-gradient(${a} 0 12deg, transparent 12deg 20deg, ${b} 20deg 32deg, transparent 32deg 40deg, ${c} 40deg 52deg, transparent 52deg 60deg)`
        : `repeating-conic-gradient(${a} 0 14deg, transparent 14deg 22deg, ${b} 22deg 36deg, transparent 36deg 44deg)`;
    case 'dots':
      return `repeating-conic-gradient(${a} 0 8deg, transparent 8deg 30deg)`;
    default:
      return 'none';
  }
}

function Badge({ b }) {
  const rad = ((b.angle ?? 45) * Math.PI) / 180;
  const d = b.dist ?? 0.5;
  const at = { left: `${50 + Math.sin(rad) * d * 100}%`, top: `${50 - Math.cos(rad) * d * 100}%` };
  const vars = { '--r': `${b.rotate || 0}deg`, '--bs': b.size ?? 0.38, '--spd': `${b.speed || 3}s` };
  const dir = b.dir === 'ccw' ? ' ccw' : '';
  const placed = (
    <span className="deco-b-at" style={at}>
      <span className={`deco-b anim-${b.anim === 'orbit' ? 'none' : b.anim || 'none'}${dir}`} style={vars}>
        {b.kind === 'image' ? <img src={b.value} alt="" draggable="false" /> : b.value}
      </span>
    </span>
  );
  if (b.anim !== 'orbit') return placed;
  return (
    <span className={`deco-orbit${dir}`} style={{ '--spd': `${b.speed || 3}s` }}>
      {placed}
    </span>
  );
}

// A ring grows outward up to this much (× avatar). Thicker than that, it grows
// inward over the picture, so it never crowds the text next to an avatar.
const RING_OUT = 0.22;

export function CustomDecoration({ size, custom, children }) {
  const ring = custom?.ring || {};
  const style = ring.style || 'none';
  const w = (ring.width ?? 9) / 100;
  const out = Math.min(w, RING_OUT);
  const inward = Math.max(0, w - RING_OUT);
  const hole = `radial-gradient(circle closest-side, transparent calc(var(--s) * ${0.5 - inward}), #000 calc(var(--s) * ${0.5 - inward} + 0.5px))`;
  const color = ring.colors?.[0] || '#8b5cf6';
  return (
    <span
      className={`deco deco-custom${inward ? ' ring-in' : ''}`}
      style={{ width: size, height: size, '--s': `${size}px`, '--fit': 1 - 2 * inward }}
    >
      {style !== 'none' && (
        <span
          className={`deco-ring ring-${style}${ring.spin ? ` spin${ring.spin === 'ccw' ? ' ccw' : ''}` : ''}${inward ? ' thick' : ''}`}
          style={{
            inset: `calc(var(--s) * ${-out})`,
            ...(inward && { maskImage: hole, WebkitMaskImage: hole }),
            background: ringBackground(ring),
            '--spd': `${ring.speed || 4}s`,
            '--glow': color,
          }}
        />
      )}
      {children}
      {size >= 22 && (custom?.badges || []).filter((b) => b.value).map((b, i) => <Badge key={i} b={b} />)}
    </span>
  );
}
