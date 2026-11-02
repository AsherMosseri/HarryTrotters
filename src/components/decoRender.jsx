import { memo } from 'react';
import { gradientStops } from '../nitro.js';
import { watchDeco } from '../decoMotion.js';

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

export function CustomDecoration({ size, custom, own, children }) {
  const ring = custom?.ring || {};
  const style = ring.style || 'none';
  const w = (ring.width ?? 9) / 100;
  const out = Math.min(w, RING_OUT);
  const inward = Math.max(0, w - RING_OUT);
  const hole = `radial-gradient(circle closest-side, transparent calc(var(--s) * ${0.5 - inward}), #000 calc(var(--s) * ${0.5 - inward} + 0.5px))`;
  const color = ring.colors?.[0] || '#8b5cf6';
  const at = `calc(var(--s) * ${-out})`;
  // The ring only turns. A glow is two still layers (the ring's own shadow and
  // a bigger one that fades in and out), so nothing is redrawn each frame.
  const disc = (
    <span
      className={`deco-ring ring-${style}${ring.spin ? ` spin${ring.spin === 'ccw' ? ' ccw' : ''}` : ''}`}
      style={{ ...(!inward && { inset: at }), background: ringBackground(ring), '--spd': `${ring.speed || 4}s` }}
    />
  );
  return (
    <span
      ref={watchDeco}
      data-deco-own={own ? '1' : undefined}
      className={`deco deco-custom${inward ? ' ring-in' : ''}${style === 'glow' ? ' has-glow' : ''}`}
      style={{ width: size, height: size, '--s': `${size}px`, '--fit': 1 - 2 * inward, '--ro': out, '--glow': color }}
    >
      {style !== 'none' &&
        (inward ? (
          // The mask sits on a still box and the ring turns inside it, so the mask isn't redrawn as it turns.
          <span className="deco-ring-clip" style={{ inset: at, maskImage: hole, WebkitMaskImage: hole }}>
            {disc}
          </span>
        ) : (
          disc
        ))}
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

// Where a point of the drawing (viewBox -30 -30 160 160) sits inside its box,
// as a CSS transform-origin.
const at = (x, y) => `${(((x + 30) / 160) * 100).toFixed(3)}% ${(((y + 30) / 160) * 100).toFixed(3)}%`;

// Every moving piece is its own box (a span) holding a still drawing, and only
// that box moves (turns, scales, fades). Browsers, iPad Safari most of all,
// hand a moving box to the graphics chip, but redraw a whole SVG every frame
// when a shape inside it moves, which stalled whenever the app was busy.
//   node = { cls, style, body (still SVG shapes), kids (boxes inside this one, they move with it) }
function Node({ n, top, small, id }) {
  const cls = `${top ? `adeco adeco-${id}${small ? ' small' : ''}` : 'ad-sub'}${n.cls ? ` ${n.cls}` : ''}`;
  return (
    <span className={cls} style={n.style}>
      {n.body && (
        <svg className="ad-part" viewBox="-30 -30 160 160" aria-hidden="true">
          {n.body}
        </svg>
      )}
      {n.kids?.map((k, i) => (
        <Node key={i} n={k} />
      ))}
    </span>
  );
}

const spin = (secs, delay, ccw, extra) => ({ cls: `adeco-spin${ccw ? ' ccw' : ''}`, style: { '--spd': secs, '--d': delay || '0s' }, ...extra });

function shapes(id) {
  switch (id) {
    case 'comets':
      return [
        { body: <circle cx="50" cy="50" r="57" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" /> },
        ...[
          ['#a5f3fc', 3.2, false],
          ['#f0abfc', 5.4, true],
          ['#fde68a', 7.8, false],
        ].map(([c, spd, ccw], k) =>
          spin(`${spd}s`, `${-k * 1.1}s`, ccw, {
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
          }),
        ),
      ];
    case 'flamering':
      return [
        {
          body: <circle className="ad-glow" cx="50" cy="50" r="51.5" fill="none" stroke="#f97316" strokeWidth="3.5" style={{ '--c': '#f97316' }} />,
        },
        // Each flame is drawn upright at the top; a still box turns it into place and the inner one flickers.
        ...Array.from({ length: 12 }, (_, i) => ({
          style: { transform: `rotate(${i * 30}deg)` },
          kids: [
            {
              cls: 'ad-flick',
              style: { '--d': `${-((i * 0.37) % 1)}s`, transformOrigin: at(50, 3) },
              body: (
                <>
                  <defs>
                    <linearGradient id="adFlame" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0" stopColor="#ef4444" />
                      <stop offset="0.55" stopColor="#f97316" />
                      <stop offset="1" stopColor="#fde047" />
                    </linearGradient>
                  </defs>
                  <path d={FLAME} transform="translate(50 1)" fill="url(#adFlame)" />
                </>
              ),
            },
          ],
        })),
      ];
    case 'electric':
      return [
        spin('9s', '0s', false, {
          kids: [
            ...BOLTS.map((d, i) => ({
              cls: `ad-bolt ad-bolt${i}`,
              body: <path className="ad-bolt-line" d={d} fill="none" stroke="#67e8f9" strokeWidth="2.6" strokeLinejoin="round" style={{ '--c': '#22d3ee' }} />,
            })),
            {
              body: (
                <circle className="ad-glow" cx="50" cy="50" r="52.5" fill="none" stroke="#22d3ee" strokeWidth="2.4" opacity="0.8" style={{ '--c': '#06b6d4' }} />
              ),
            },
          ],
        }),
      ];
    case 'halo':
      return [
        {
          cls: 'ad-bob',
          body: <ellipse className="ad-glow" cx="50" cy="-4" rx="34" ry="8.5" fill="none" stroke="#fcd34d" strokeWidth="4.5" style={{ '--c': '#f59e0b' }} />,
        },
        ...[
          [4, 18, 0],
          [98, 30, -0.6],
          [-2, 74, -1.2],
          [104, 82, -1.8],
          [86, -6, -0.9],
        ].map(([x, y, d]) => ({
          cls: 'ad-twinkle',
          style: { '--d': `${d}s`, transformOrigin: at(x, y) },
          body: (
            <g transform={`translate(${x} ${y})`}>
              <path d={SPARK} fill="#fef08a" />
            </g>
          ),
        })),
      ];
    case 'ripple':
      return [0, 1, 2].map((i) => ({
        cls: 'ad-ripple',
        style: { '--d': `${-i * 0.8}s` },
        body: <circle cx="50" cy="50" r="51" fill="none" stroke="currentColor" strokeWidth="3" />,
      }));
    case 'petals':
      return [
        spin('14s', '0s', false, {
          kids: Array.from({ length: 7 }, (_, i) => {
            const deg = (i / 7) * 360 + 90;
            return {
              style: { transform: `rotate(${deg}deg)` },
              kids: [
                {
                  cls: 'ad-flip',
                  style: { '--d': `${-i * 0.4}s`, transformOrigin: at(50, -8) },
                  body: (
                    <path
                      d={PETAL}
                      transform="translate(50 -8)"
                      fill={i % 2 ? '#fbcfe8' : '#f9a8d4'}
                      stroke="#ec4899"
                      strokeWidth="0.6"
                    />
                  ),
                },
              ],
            };
          }),
        }),
      ];
    case 'circuit':
      return [
        {
          body: (
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
            </>
          ),
        },
        // The dashes march and the bright dash runs round by turning the whole still ring.
        { cls: 'ad-march', body: <circle cx="50" cy="50" r="55" fill="none" stroke="#10b981" strokeWidth="2.4" strokeDasharray="5 3" /> },
        {
          cls: 'ad-run',
          body: (
            <circle className="ad-glow" cx="50" cy="50" r="55" fill="none" stroke="#a7f3d0" strokeWidth="3.4" strokeDasharray="14 332" style={{ '--c': '#34d399' }} />
          ),
        },
      ];
    case 'catears':
      // Mirror images that twitch together, so both tips stay level.
      return [
        ['M10,24 L4,-14 L40,6 Z', 'M14,18 L11,-4 L32,8 Z', 22, 'l'],
        ['M90,24 L96,-14 L60,6 Z', 'M86,18 L89,-4 L68,8 Z', 78, 'r'],
      ].map(([outer, inner, x, side]) => ({
        cls: `ad-twitch-${side}`,
        style: { transformOrigin: at(x, 16) },
        body: (
          <>
            <path d={outer} fill="#334155" stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={inner} fill="#f9a8d4" />
          </>
        ),
      }));
    case 'bunny':
      return [
        [30, -1, 'l'],
        [70, 1, 'r'],
      ].map(([x, side, k]) => ({
        // The tilt is drawn in; the box flops (mirrored, in sync) about the same point.
        cls: `ad-flop-${k}`,
        style: { transformOrigin: at(x, 14) },
        body: (
          <g transform={`rotate(${side * 12} ${x} 14)`}>
            <ellipse cx={x} cy="-12" rx="11" ry="27" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
            <ellipse cx={x} cy="-10" rx="5.5" ry="19" fill="#fbcfe8" />
          </g>
        ),
      }));
    case 'wizard':
      return [
        {
          cls: 'ad-sway',
          style: { transformOrigin: at(50, 16) },
          kids: [
            {
              body: (
                <>
                  <path d="M12,20 C30,12 70,12 88,20 C70,30 30,30 12,20 Z" fill="#3b0764" stroke="#1e1b4b" strokeWidth="2" />
                  <path d="M26,20 C36,-8 52,-30 78,-26 C64,-16 66,0 74,20 Z" fill="#6d28d9" stroke="#1e1b4b" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M30,15 C46,12 60,12 72,16 L73,20 C58,16 44,16 29,19 Z" fill="#facc15" />
                </>
              ),
            },
            ...[
              [48, 0],
              [60, -12],
              [42, -8],
            ].map(([x, y], i) => ({
              cls: 'ad-twinkle',
              style: { '--d': `${-i * 0.5}s`, transformOrigin: at(x, y) },
              body: (
                <g transform={`translate(${x} ${y}) scale(0.6)`}>
                  <path d={SPARK} fill="#fde68a" />
                </g>
              ),
            })),
          ],
        },
      ];
    case 'horns':
      return [
        {
          body: (
            <>
              {['M22,16 C10,6 6,-8 12,-20 C16,-6 26,2 36,6 Z', 'M78,16 C90,6 94,-8 88,-20 C84,-6 74,2 64,6 Z'].map((d, i) => (
                <path key={i} className="ad-glow" d={d} fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" strokeLinejoin="round" style={{ '--c': '#ef4444' }} />
              ))}
            </>
          ),
        },
      ];
    case 'headphones':
      return [
        {
          cls: 'ad-bop',
          kids: [
            {
              body: (
                <>
                  <path d="M2,52 C2,0 98,0 98,52" fill="none" stroke="#1f2937" strokeWidth="7" strokeLinecap="round" />
                  <path d="M2,52 C2,0 98,0 98,52" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                  {[-6, 92].map((x, i) => (
                    <g key={i}>
                      <rect x={x} y="40" width="14" height="30" rx="7" fill="#111827" />
                      <rect x={x + 3} y="45" width="8" height="20" rx="4" fill="#6366f1" />
                    </g>
                  ))}
                </>
              ),
            },
            ...[0, 1, 2].map((i) => ({
              cls: 'ad-note',
              style: { '--d': `${-i * 0.6}s` },
              body: (
                <text x={104 + i * 6} y={34 - i * 10} fontSize="13" fill="#a5b4fc">
                  ♪
                </text>
              ),
            })),
          ],
        },
      ];
    case 'antenna':
      return [
        {
          body: (
            <>
              <line x1="50" y1="2" x2="50" y2="-20" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="50" cy="-24" r="6" fill="#7f1d1d" />
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
          ),
        },
        // The light blinks by fading a lit copy in and out over the dark one.
        { cls: 'ad-blink', body: <circle className="ad-glow" cx="50" cy="-24" r="6" fill="#ef4444" style={{ '--c': '#ef4444' }} /> },
      ];
    default:
      return null;
  }
}

// Built once per decoration and size class, so nothing here is touched when the
// page around it re-renders (it re-renders on every message, tick and typing dot).
export const AnimatedDecoration = memo(function AnimatedDecoration({ id, small }) {
  const nodes = shapes(id);
  if (!nodes) return null;
  return nodes.map((n, i) => <Node key={i} n={n} top small={small} id={id} />);
});

// Wings sit behind the avatar and flap about their roots.
const WING = 'M0,0 C-26,-20 -44,-8 -48,10 C-38,8 -34,14 -40,24 C-28,20 -24,28 -28,36 C-16,30 -6,24 0,14 Z';
export const DecorationBehind = memo(function DecorationBehind({ id }) {
  if (id !== 'wings') return null;
  return [
    [8, 46, 1, 'l'],
    [92, 46, -1, 'r'],
  ].map(([x, y, sx, k]) => (
    <span key={k} className={`adeco adeco-behind adeco-wings ad-flap-${k}`} style={{ transformOrigin: at(x, y) }}>
      <svg className="ad-part" viewBox="-30 -30 160 160" aria-hidden="true">
        <g transform={`translate(${x} ${y}) scale(${sx} 1)`}>
          <path d={WING} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M-8,4 C-20,-4 -30,0 -34,8" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
        </g>
      </svg>
    </span>
  ));
});
