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
  { id: 'orbit', label: 'Orbit' },
  { id: 'spin', label: 'Spin' },
  { id: 'bob', label: 'Bob' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'wiggle', label: '〰 Wiggle' },
  { id: 'float', label: 'Float' },
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

// A sticker reaches at most this far from the picture's center (in picture
// widths; the edge is 0.5), so it sticks out by no more than 15% of the
// picture. Every screen leaves that much room, so stickers never cover the
// names and text next to an avatar.
const STICKER_REACH = 0.65;
// How far out a sticker of this size can sit (an emoji is about 1.3 × its
// size wide, so its half-width is about 0.65 × size).
export const maxStickerDist = (size = 0.38) => Math.max(0, Math.min(0.75, STICKER_REACH - size * 0.65));

function Badge({ b }) {
  const rad = ((b.angle ?? 45) * Math.PI) / 180;
  const d = Math.min(b.dist ?? 0.5, maxStickerDist(b.size ?? 0.38));
  // The tilt sits on the outer span, so the animations' keyframes use no
  // variables (iPad Safari only runs those smoothly).
  const at = {
    left: `${50 + Math.sin(rad) * d * 100}%`,
    top: `${50 - Math.cos(rad) * d * 100}%`,
    transform: `translate(-50%, -50%) rotate(${b.rotate || 0}deg)`,
  };
  const vars = { '--bs': b.size ?? 0.38, '--spd': `${b.speed || 3}s` };
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

// Animated decorations (Discord-style): drawn in SVG around the avatar. The
// avatar is the circle (50, 50) r 50; the SVG covers 30% more on each side.
const SPARK = 'M0,-6 Q0,0 6,0 Q0,0 0,6 Q0,0 -6,0 Q0,0 0,-6Z';
const PETAL = 'M0,-7 C6,-4 4,5 0,7 C-4,5 -6,-4 0,-7Z';
const FLAME = 'M-6,2 C-8,-7 -2,-11 0,-22 C2,-11 8,-7 6,2 Z';

// The same jagged ring every time (seeded), three variants to flicker between.
function jagged(seed) {
  let s = seed;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const rad = 54 + (r() - 0.5) * 9;
    pts.push(`${(50 + Math.cos(a) * rad).toFixed(1)},${(50 + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}
const BOLTS = [jagged(7), jagged(31), jagged(97)];

export function AnimatedDecoration({ id, small }) {
  // Pieces that only turn are drawn as their own layers (`layers`, or `spin`
  // for the whole drawing) and turned as a whole: iPad Safari runs that on the
  // graphics chip, where turning shapes inside a drawing stalled whenever the
  // app was busy.
  let body = null;
  let layers = null;
  let spin = null;
  if (id === 'comets') {
    layers = [
      { body: <circle cx="50" cy="50" r="57" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" /> },
      ...[
        ['#a5f3fc', 3.2, false],
        ['#f0abfc', 5.4, true],
        ['#fde68a', 7.8, false],
      ].map(([c, spd, ccw], k) => ({
        spin: `${spd}s`,
        ccw,
        delay: `${-k * 1.1}s`,
        body: (
          <>
            {Array.from({ length: 9 }, (_, i) => {
              // The tail trails behind, whichever way it spins.
              const a = ((-90 + (ccw ? 1 : -1) * i * 7) * Math.PI) / 180;
              return <circle key={i} cx={50 + Math.cos(a) * 57} cy={50 + Math.sin(a) * 57} r={4 - i * 0.38} fill={c} opacity={1 - i / 9} />;
            })}
            <circle className="ad-glow" cx="50" cy="-7" r="4.5" fill="#fff" style={{ '--c': c }} />
          </>
        ),
      })),
    ];
  } else if (id === 'flamering') {
    body = (
      <>
        <defs>
          <linearGradient id="adFlame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ef4444" />
            <stop offset="0.55" stopColor="#f97316" />
            <stop offset="1" stopColor="#fde047" />
          </linearGradient>
        </defs>
        <circle className="ad-glow" cx="50" cy="50" r="51.5" fill="none" stroke="#f97316" strokeWidth="3.5" style={{ '--c': '#f97316' }} />
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 30} 50 50) translate(50 1)`}>
            <path className="ad-flick" d={FLAME} fill="url(#adFlame)" style={{ '--d': `${-((i * 0.37) % 1)}s` }} />
          </g>
        ))}
      </>
    );
  } else if (id === 'electric') {
    spin = '9s';
    body = (
      <g>
        {BOLTS.map((d, i) => (
          <path
            key={i}
            className={`ad-bolt ad-bolt${i}`}
            d={d}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="2.6"
            strokeLinejoin="round"
            style={{ '--c': '#22d3ee' }}
          />
        ))}
        <circle
          className="ad-glow"
          cx="50"
          cy="50"
          r="52.5"
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2.4"
          opacity="0.8"
          style={{ '--c': '#06b6d4' }}
        />
      </g>
    );
  } else if (id === 'halo') {
    body = (
      <>
        <g className="ad-bob">
          <ellipse
            className="ad-glow"
            cx="50"
            cy="-4"
            rx="34"
            ry="8.5"
            fill="none"
            stroke="#fcd34d"
            strokeWidth="4.5"
            style={{ '--c': '#f59e0b' }}
          />
        </g>
        {[
          [4, 18, 0],
          [98, 30, -0.6],
          [-2, 74, -1.2],
          [104, 82, -1.8],
          [86, -6, -0.9],
        ].map(([x, y, d], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path className="ad-twinkle" d={SPARK} fill="#fef08a" style={{ '--d': `${d}s` }} />
          </g>
        ))}
      </>
    );
  } else if (id === 'ripple') {
    body = (
      <g className="ad-ripple-color">
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            className="ad-ripple"
            cx="50"
            cy="50"
            r="51"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            style={{ '--d': `${-i * 0.8}s` }}
          />
        ))}
      </g>
    );
  } else if (id === 'petals') {
    spin = '14s';
    body = (
      <g>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return (
            <g key={i} transform={`translate(${50 + Math.cos(a) * 58} ${50 + Math.sin(a) * 58}) rotate(${(a * 180) / Math.PI + 90})`}>
              <path
                className="ad-flip"
                d={PETAL}
                fill={i % 2 ? '#fbcfe8' : '#f9a8d4'}
                stroke="#ec4899"
                strokeWidth="0.6"
                style={{ '--d': `${-i * 0.4}s` }}
              />
            </g>
          );
        })}
      </g>
    );
  } else if (id === 'circuit') {
    body = (
      <>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          const x1 = 50 + Math.cos(a) * 55;
          const y1 = 50 + Math.sin(a) * 55;
          const x2 = 50 + Math.cos(a) * 66;
          const y2 = 50 + Math.sin(a) * 66;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#34d399" strokeWidth="2" />
              <circle cx={x2} cy={y2} r="2.6" fill="#0f172a" stroke="#34d399" strokeWidth="1.6" />
            </g>
          );
        })}
        <circle cx="50" cy="50" r="55" fill="none" stroke="#10b981" strokeWidth="2.4" strokeDasharray="5 3" className="ad-march" />
        <circle
          className="ad-pulse ad-glow"
          cx="50"
          cy="50"
          r="55"
          fill="none"
          stroke="#a7f3d0"
          strokeWidth="3.4"
          strokeDasharray="14 332"
          style={{ '--c': '#34d399' }}
        />
      </>
    );
  } else if (id === 'catears') {
    // Mirror images that twitch together, so both tips stay level.
    body = (
      <>
        {[
          ['M10,24 L4,-14 L40,6 Z', 'M14,18 L11,-4 L32,8 Z', -1],
          ['M90,24 L96,-14 L60,6 Z', 'M86,18 L89,-4 L68,8 Z', 1],
        ].map(([outer, inner, side], i) => (
          <g key={i} className="ad-ear ad-twitch" style={{ transformOrigin: i ? '78px 16px' : '22px 16px', '--r': `${side * 10}deg` }}>
            <path d={outer} fill="#334155" stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={inner} fill="#f9a8d4" />
          </g>
        ))}
      </>
    );
  } else if (id === 'bunny') {
    body = (
      <>
        {[
          [30, -1],
          [70, 1],
        ].map(([x, side], i) => (
          // The tilt is on the outer group; the inner one flops (mirrored, in sync).
          <g key={i} transform={`rotate(${side * 12} ${x} 14)`}>
            <g className="ad-ear ad-flop" style={{ transformOrigin: `${x}px 14px`, '--r': `${side * 7}deg` }}>
              <ellipse cx={x} cy="-12" rx="11" ry="27" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
              <ellipse cx={x} cy="-10" rx="5.5" ry="19" fill="#fbcfe8" />
            </g>
          </g>
        ))}
      </>
    );
  } else if (id === 'wizard') {
    body = (
      <g className="ad-sway" style={{ transformOrigin: '50px 16px' }}>
        <path d="M12,20 C30,12 70,12 88,20 C70,30 30,30 12,20 Z" fill="#3b0764" stroke="#1e1b4b" strokeWidth="2" />
        <path d="M26,20 C36,-8 52,-30 78,-26 C64,-16 66,0 74,20 Z" fill="#6d28d9" stroke="#1e1b4b" strokeWidth="2" strokeLinejoin="round" />
        <path d="M30,15 C46,12 60,12 72,16 L73,20 C58,16 44,16 29,19 Z" fill="#facc15" />
        {[
          [48, 0],
          [60, -12],
          [42, -8],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(0.6)`}>
            <path className="ad-twinkle" d={SPARK} fill="#fde68a" style={{ '--d': `${-i * 0.5}s` }} />
          </g>
        ))}
      </g>
    );
  } else if (id === 'horns') {
    body = (
      <>
        {['M22,16 C10,6 6,-8 12,-20 C16,-6 26,2 36,6 Z', 'M78,16 C90,6 94,-8 88,-20 C84,-6 74,2 64,6 Z'].map((d, i) => (
          <path
            key={i}
            className="ad-glow"
            d={d}
            fill="#dc2626"
            stroke="#7f1d1d"
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ '--c': '#ef4444' }}
          />
        ))}
      </>
    );
  } else if (id === 'headphones') {
    body = (
      <g className="ad-bop" style={{ transformOrigin: '50px 50px' }}>
        <path d="M2,52 C2,0 98,0 98,52" fill="none" stroke="#1f2937" strokeWidth="7" strokeLinecap="round" />
        <path d="M2,52 C2,0 98,0 98,52" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
        {[-6, 92].map((x, i) => (
          <g key={i}>
            <rect x={x} y="40" width="14" height="30" rx="7" fill="#111827" />
            <rect x={x + 3} y="45" width="8" height="20" rx="4" fill="#6366f1" />
          </g>
        ))}
        {[0, 1, 2].map((i) => (
          <text key={i} className="ad-note" x={104 + i * 6} y={34 - i * 10} fontSize="13" fill="#a5b4fc" style={{ '--d': `${-i * 0.6}s` }}>
            ♪
          </text>
        ))}
      </g>
    );
  } else if (id === 'antenna') {
    body = (
      <>
        <line x1="50" y1="2" x2="50" y2="-20" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" />
        <circle className="ad-blink ad-glow" cx="50" cy="-24" r="6" fill="#ef4444" style={{ '--c': '#ef4444' }} />
        {[
          [1, 50],
          [99, 50],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 6} y={y - 9} width="12" height="18" rx="3" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
            <circle cx={x} cy={y} r="2.5" fill="#475569" />
          </g>
        ))}
      </>
    );
  }
  // Small avatars (lists, the sidebar) skip the glow blurs: they're barely
  // visible that size and are the most expensive part to draw.
  const cls = `adeco adeco-${id}${small ? ' small' : ''}`;
  const layer = (l, k) => (
    <svg
      key={k}
      className={`${cls}${l.spin ? ` adeco-spin${l.ccw ? ' ccw' : ''}` : ''}`}
      style={l.spin ? { '--spd': l.spin, '--d': l.delay || '0s' } : undefined}
      viewBox="-30 -30 160 160"
      aria-hidden="true"
    >
      {l.body}
    </svg>
  );
  if (layers) return <>{layers.map(layer)}</>;
  if (!body) return null;
  return layer({ body, spin });
}

// Wings sit behind the avatar.
export function DecorationBehind({ id }) {
  if (id !== 'wings') return null;
  const wing = 'M0,0 C-26,-20 -44,-8 -48,10 C-38,8 -34,14 -40,24 C-28,20 -24,28 -28,36 C-16,30 -6,24 0,14 Z';
  return (
    <svg className="adeco adeco-behind" viewBox="-30 -30 160 160" aria-hidden="true">
      {[
        [8, 46, 1],
        [92, 46, -1],
      ].map(([x, y, sx], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${sx} 1)`}>
          <g className="ad-flap" style={{ transformOrigin: '0 0' }}>
            <path d={wing} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d="M-8,4 C-20,-4 -30,0 -34,8" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
          </g>
        </g>
      ))}
    </svg>
  );
}
