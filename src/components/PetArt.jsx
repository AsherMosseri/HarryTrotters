import { useId } from 'react';
import { petStage } from './petAnchors.js';

// The pets' art (H3). One 64x64 sticker-style mascot per species: soft
// gradients, a darker same-hue outline, glossy eyes, a lighter highlight on the
// head and a ground shadow. Each species draws a `back` (tails, long ears),
// a `body` and a `head`; PetArt below puts them together per stage (baby: big
// head and eyes, small body; grown: scarf and a gold pin). Below 40px the fine
// details (whiskers, fur tufts, toes, scallops, blush) are left out so the
// silhouette and the eyes carry it. The classes pet-bob / pet-eyes / pet-tail /
// pet-ear / pet-tongue (and the gem's pet-glint / pet-shimmer) are animation
// hooks (shell.css; transform and opacity only).

const INK = '#2a2730';
const BLUSH = '#ff7f95';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = hex(a);
  const B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

// body: main fur. dark: deep accent (ears, socks). belly: light patch. inner: ear/pad pink. line: outline.
const LOOK = {
  cat: { body: '#f6a85c', dark: '#b8662c', belly: '#fff0dc', inner: '#f48fa3', nose: '#ef7f95', line: '#a85a26', stripe: '#c9702f' },
  dog: { body: '#dcae7f', dark: '#8a5a34', belly: '#fbefdd', inner: '#f48fa3', nose: INK, line: '#8a5a34' },
  bunny: { body: '#f1ecf8', dark: '#a79bc2', belly: '#ffffff', inner: '#f8a8bd', nose: '#f47fa0', line: '#9d90b9' },
  fox: { body: '#f07c34', dark: '#3a2622', belly: '#fffaf2', inner: '#3a2622', nose: INK, line: '#a9491a', sock: '#3a2622' },
  owl: { body: '#b58d68', dark: '#6f4e36', belly: '#f1dfc3', inner: '#f1dfc3', nose: '#f5a623', line: '#6f4e36', wing: '#8d6746' },
  frog: { body: '#7cc86a', dark: '#3f8a3a', belly: '#e9f6c8', inner: '#f48fa3', nose: INK, line: '#3f8a3a' },
  panda: { body: '#fbfaf6', dark: '#26262c', belly: '#ffffff', inner: '#5a5a66', nose: '#26262c', line: '#a6a6b4' },
  // Glossy black feathers, a bright blue bare head and neck, a red wattle, a tan casque.
  cassowary: {
    body: '#363849', dark: '#1a1a24', light: '#6a6d88', shade: '#15151d', belly: '#4a4c60', inner: '#d6336c', nose: '#e8d4a2', line: '#62657f',
    blue: '#2f86e6', blueLine: '#1d55b0', casque: '#ecd59b', leg: '#d9c28f',
  },
  monkey: { body: '#c9733a', dark: '#7d431d', belly: '#f6d9b2', inner: '#f6b9a0', nose: '#f0916c', line: '#7d431d', face: '#f2c996' },
  // Rusty fur, a cream face, dark brown belly, legs and ear insides, darker rust tear marks and tail rings.
  redpanda: { body: '#c8532b', dark: '#432a25', light: '#ee8a4e', shade: '#9c3a1c', belly: '#fff3e4', inner: '#432a25', nose: '#2a1a18', line: '#9a3a18', tear: '#8e3213', ring: '#9a3c1d' },
  // Brown spines with tan tips over a darker underlayer, a cream face and belly, pink ears.
  hedgehog: { body: '#8a5a3a', dark: '#4e301d', light: '#c99d6a', shade: '#5c3a22', belly: '#f3dcc0', inner: '#f2aa9a', nose: '#2a1a18', line: '#5e3b22', tip: '#e2b985', foot: '#5a3a26' },
  // A warm cream hen with a soft tan outline and light-orange shading, a red comb and wattle, an orange beak and legs.
  chicken: { body: '#f6ecd6', dark: '#e9a95c', light: '#fffaf0', shade: '#ead3a6', belly: '#fffbf0', inner: '#e0483c', nose: '#f2a31e', line: '#c9a272', comb: '#e44a3c', combLine: '#a8302a', leg: '#f08a24', legLine: '#c4661a', wing: '#f0d3a0' },
  // A pale mint pear-cut gem (green amethyst): seafoam facets from deep to near-white, a lighter table.
  gem: { body: '#a3e2c6', dark: '#3f9e80', light: '#effdf6', shade: '#6cc6a4', belly: '#dcf8ea', inner: '#ff9fb2', nose: INK, line: '#3c937a', deep: '#47a888', table: '#d4f6e6' },
};

// --- shared face parts ----------------------------------------------------

const Drop = ({ x, y }) => (
  <path
    transform={`translate(${x} ${y})`}
    d="M0 -2.6 C1.7 -0.4 2.2 0.9 2.2 1.7 A2.2 2.2 0 1 1 -2.2 1.7 C-2.2 0.9 -1.7 -0.4 0 -2.6Z"
    fill="#8fd2ff"
    stroke="#4d9fe0"
    strokeWidth="0.6"
  />
);

// Two eyes. `r` is the eye radius, `ek` the stage's eye scale. Happy = closed
// arcs; ok = round eyes with two sparkles; sad = droopy brows and a tear.
function Eyes({ mood, xs, y, r, ek = 1, ink = INK, brow = INK, brows = true, detail, sparkle = '#fff', browGap = 1.55 }) {
  r *= ek;
  const [x1, x2] = xs;
  if (mood === 'happy')
    return (
      <g className="pet-eyes">
        {xs.map((x) => (
          <path
            key={x}
            d={`M${x - r * 1.05} ${y + r * 0.45} Q${x} ${y - r * 1.5} ${x + r * 1.05} ${y + r * 0.45}`}
            stroke={ink}
            strokeWidth={Math.max(1.7, r * 0.62)}
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </g>
    );
  const sad = mood === 'sad';
  const rr = sad ? r * 0.96 : r;
  return (
    <>
      <g className="pet-eyes">
        {xs.map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={rr} ry={rr * 1.1} fill={ink} />
            <circle cx={x - rr * 0.32} cy={y - rr * 0.42} r={rr * (sad ? 0.44 : 0.4)} fill={sparkle} />
            {detail && <circle cx={x + rr * 0.4} cy={y + rr * 0.48} r={rr * 0.18} fill={sparkle} opacity="0.9" />}
            {sad && detail && <ellipse cx={x} cy={y + rr * 0.78} rx={rr * 0.62} ry={rr * 0.24} fill={sparkle} opacity="0.35" />}
          </g>
        ))}
      </g>
      {sad && (
        <>
          {brows && (
            <>
              <path d={`M${x1 - r * 1.25} ${y - r * browGap + 0.9} L${x1 + r * 1.2} ${y - r * browGap - 1.5}`} stroke={brow} strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d={`M${x2 + r * 1.25} ${y - r * browGap + 0.9} L${x2 - r * 1.2} ${y - r * browGap - 1.5}`} stroke={brow} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </>
          )}
          <Drop x={x2 + r * 0.55} y={y + r * 2.1} />
        </>
      )}
    </>
  );
}

// Mouth under the nose at (x, y). kind 'w' = cat/dog "w" smile, 'u' = plain smile.
function Mouth({ mood, x = 32, y, w = 3.6, h = 3, kind = 'u', tongue = true, ink = INK }) {
  const st = { stroke: ink, strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (mood === 'happy')
    return (
      <>
        <path d={`M${x - w} ${y} Q${x} ${y + h * 2.1} ${x + w} ${y} Z`} fill="#6e2437" stroke="#6e2437" strokeWidth="1" strokeLinejoin="round" />
        {tongue && (
          <ellipse className="pet-tongue" cx={x} cy={y + h * 0.82} rx={w * 0.52} ry={h * 0.42} fill="#ff8fa6" />
        )}
      </>
    );
  if (mood === 'sad') return <path d={`M${x - w * 0.85} ${y + h * 0.9} Q${x} ${y - h * 0.5} ${x + w * 0.85} ${y + h * 0.9}`} {...st} />;
  if (kind === 'w') return <path d={`M${x} ${y - 0.4} Q${x - w * 0.45} ${y + h * 0.95} ${x - w} ${y + h * 0.1} M${x} ${y - 0.4} Q${x + w * 0.45} ${y + h * 0.95} ${x + w} ${y + h * 0.1}`} {...st} />;
  return <path d={`M${x - w * 0.85} ${y} Q${x} ${y + h * 1.25} ${x + w * 0.85} ${y}`} {...st} />;
}

const Blush = ({ y, dx = 10.6, rx = 3.1, ry = 2, o = 0.5, x = 32 }) => (
  <>
    <ellipse cx={x - dx} cy={y} rx={rx} ry={ry} fill={BLUSH} opacity={o} />
    <ellipse cx={x + dx} cy={y} rx={rx} ry={ry} fill={BLUSH} opacity={o} />
  </>
);

// A soft highlight on a head.
const Gloss = ({ id, cx = 24.5, cy = 18.5, rx = 8.5, ry = 4.2, rot = -22 }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} fill={`url(#${id}h)`} />
);

// Eyelid for sad owl/frog eyes: covers the upper part of a round eye on a slant.
function Lid({ id, n, x, y, r, side, color }) {
  const s = side; // -1 left eye, 1 right eye
  return (
    <>
      <clipPath id={`${id}c${n}`}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <path
        clipPath={`url(#${id}c${n})`}
        d={`M${x - s * (r + 2)} ${y + 0.4 - r * 0.15} L${x + s * (r + 2)} ${y - r * 0.9} L${x + s * (r + 2)} ${y - r - 3} L${x - s * (r + 2)} ${y - r - 3} Z`}
        fill={color}
      />
    </>
  );
}

// A ring of spines along part of an ellipse (angles in degrees, 0 = right, going
// up and over to the left). Returns the points as tips and valleys in order.
function spikes(cx, cy, rx, ry, a0, a1, n, dep) {
  const pt = (a, k) => [cx + rx * k * Math.cos((a * Math.PI) / 180), cy - ry * k * Math.sin((a * Math.PI) / 180)];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ tip: false, p: pt(a0 + ((a1 - a0) * i) / n, 1 - dep) });
    out.push({ tip: true, p: pt(a0 + ((a1 - a0) * (i + 0.5)) / n, 1) });
  }
  out.push({ tip: false, p: pt(a1, 1 - dep) });
  return out;
}
const f1 = (n) => n.toFixed(1);
const spikePath = (pts) => pts.map((q, i) => `${i ? 'L' : 'M'}${f1(q.p[0])} ${f1(q.p[1])}`).join(' ');
// The lighter tip of every spine: a small triangle from the tip toward its two valleys.
function spikeTips(pts, k = 0.5) {
  let d = '';
  for (let i = 1; i < pts.length - 1; i += 2) {
    const [x, y] = pts[i].p;
    const [ax, ay] = pts[i - 1].p;
    const [bx, by] = pts[i + 1].p;
    d += `M${f1(ax + (x - ax) * (1 - k))} ${f1(ay + (y - ay) * (1 - k))} L${f1(x)} ${f1(y)} L${f1(bx + (x - bx) * (1 - k))} ${f1(by + (y - by) * (1 - k))} Z `;
  }
  return d;
}

// --- the gem's shape -------------------------------------------------------

// A pear (teardrop) lying on its side, point to the right: t = 0 is the point,
// t = π the round end. g: { cx, cy, a (half length), b (half height) }.
const PEAR_M = 0.82;
const TAU = 2 * Math.PI;
const pearF = (t) => {
  t = ((t % TAU) + TAU) % TAU;
  return Math.sin(t) * Math.pow(Math.sin(t / 2), PEAR_M);
};
const PEAR_FMAX = (() => {
  let m = 0;
  for (let i = 0; i <= 720; i++) m = Math.max(m, pearF((i * Math.PI) / 360));
  return m;
})();
const pearPt = (t, g) => [g.cx + g.a * Math.cos(t), g.cy - (g.b * pearF(t)) / PEAR_FMAX];
const ptsPath = (pts) => pts.map((q, i) => `${i ? 'L' : 'M'}${f1(q[0])} ${f1(q[1])}`).join(' ') + ' Z';
// The light comes from the upper left: 0 (facing away) to 1 (facing it).
const LIGHT = [-0.56, -0.83];
const facing = (pts, o) => {
  const mx = pts.reduce((v, q) => v + q[0], 0) / pts.length - o[0];
  const my = pts.reduce((v, q) => v + q[1], 0) / pts.length - o[1];
  const n = Math.hypot(mx, my) || 1;
  return 0.5 + 0.5 * ((mx * LIGHT[0] + my * LIGHT[1]) / n);
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// A cut stone seen from above, like the photo: a table (a smaller pear in the
// middle), star facets around it, and the outer facets out to the girdle (each
// split in two, light and dark, when `split`). Returns the outline, the table
// and the facets as [path, light 0..1]. Cached: the shape never changes.
const GEM_CUT = {};
function gemCut(n, split) {
  const key = n + (split ? 's' : '');
  if (GEM_CUT[key]) return GEM_CUT[key];
  const g = { cx: 33.6, cy: 37.8, a: 23.2, b: 16.4 };
  const tk = 0.56; // the table's size
  const to = [29.6, 37]; // the table's middle, toward the round end
  const O = (t) => pearPt(t, g);
  const T = (t) => {
    const [x, y] = pearPt(t, g);
    return [to[0] + (x - g.cx) * tk, to[1] + (y - g.cy) * tk];
  };
  const arc = (t0, t1, k) => Array.from({ length: k + 1 }, (_, i) => O(t0 + ((t1 - t0) * i) / k));
  const tt = (i) => (TAU * i) / n;
  const facets = [];
  for (let i = 0; i < n; i++) {
    const star = [T(tt(i)), T(tt(i + 1)), O(tt(i + 0.5))];
    facets.push([star, clamp01(facing(star, to) * 0.8 + 0.26)]);
    if (split) {
      const a1 = [T(tt(i)), ...arc(tt(i - 0.5), tt(i), 4)];
      const a2 = [T(tt(i)), ...arc(tt(i), tt(i + 0.5), 4)];
      const f = facing([...a1, ...a2], to);
      facets.push([a1, clamp01(f + 0.1)], [a2, clamp01(f - 0.3)]);
    } else {
      const kite = [T(tt(i)), ...arc(tt(i - 0.5), tt(i + 0.5), 8)];
      facets.push([kite, clamp01(facing(kite, to) + (i % 2 ? -0.16 : 0.02))]);
    }
  }
  const out = Array.from({ length: 96 }, (_, i) => O((TAU * i) / 96));
  const table = Array.from({ length: n }, (_, i) => T(tt(i)));
  return (GEM_CUT[key] = { outline: ptsPath(out), table: ptsPath(table), facets: facets.map(([p, v]) => [ptsPath(p), v]) });
}

// The baby: a rough, uncut crystal (a lumpy stone with a few big flat planes).
const ROUGH_OUT = [[11.6, 42], [14.4, 30.2], [21.8, 22.6], [33.6, 19.8], [45, 22.6], [53.2, 30.4], [55.2, 41.4], [49, 51.4], [35.4, 55.4], [20.4, 53.6]];
const ROUGH_IN = [[19.4, 35.2], [24.4, 28], [34.6, 26.4], [44, 30], [47.4, 39.4], [43, 47.2], [33, 49.6], [22.4, 46.6]];
function roughCut() {
  if (GEM_CUT.rough) return GEM_CUT.rough;
  const o = [33, 38];
  const facets = [];
  for (let i = 0; i < ROUGH_OUT.length; i++) {
    // Each outer edge meets the inner face at the nearest inner corners.
    const a = ROUGH_OUT[i];
    const b = ROUGH_OUT[(i + 1) % ROUGH_OUT.length];
    const j = Math.round((i * ROUGH_IN.length) / ROUGH_OUT.length) % ROUGH_IN.length;
    const k = Math.round(((i + 1) * ROUGH_IN.length) / ROUGH_OUT.length) % ROUGH_IN.length;
    const p = j === k ? [a, b, ROUGH_IN[j]] : [a, b, ROUGH_IN[k], ROUGH_IN[j]];
    facets.push([ptsPath(p), clamp01(facing(p, o) * 0.8 + (i % 2 ? 0.02 : 0.12))]);
  }
  return (GEM_CUT.rough = { outline: ptsPath(ROUGH_OUT), table: ptsPath(ROUGH_IN), facets });
}

// A four-point sparkle centered at (x, y).
const Glint = ({ x, y, r, className, o = 1 }) => {
  const k = r * 0.16;
  return (
    <path
      className={className}
      d={`M${f1(x)} ${f1(y - r)} Q${f1(x + k)} ${f1(y - k)} ${f1(x + r)} ${f1(y)} Q${f1(x + k)} ${f1(y + k)} ${f1(x)} ${f1(y + r)} Q${f1(x - k)} ${f1(y + k)} ${f1(x - r)} ${f1(y)} Q${f1(x - k)} ${f1(y - k)} ${f1(x)} ${f1(y - r)}Z`}
      fill="#fff"
      opacity={o}
    />
  );
};

// --- species --------------------------------------------------------------

const DRAW = {
  cat({ c, id, mood, detail, ek, L }) {
    const stripe = { stroke: c.stripe, strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none' };
    return {
      back: (
        <g className="pet-tail">
          <path d="M43 54 C55 57 61.5 45 56 35" stroke={c.line} strokeWidth="7.4" fill="none" strokeLinecap="round" />
          <path d="M43 54 C55 57 61.5 45 56 35" stroke={c.body} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <path d="M59.4 43.5 C58.6 40 57.6 37 56 35" stroke={c.stripe} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          {detail && <path d="M52.6 54.2 l1.4 -3.8 M57.6 50.6 l2.6 -2.8" {...stripe} strokeWidth="1.4" />}
        </g>
      ),
      body: (
        <>
          <ellipse cx="32" cy="47" rx="14.6" ry="11" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="49.6" rx="8.6" ry="7.4" fill={`url(#${id}f)`} />
          {detail && <path d="M18.4 43.4 q3.2 0.6 4.4 3.4 M45.6 43.4 q-3.2 0.6 -4.4 3.4 M19.4 49 q2.6 0.2 3.6 2.2 M44.6 49 q-2.6 0.2 -3.6 2.2" {...stripe} />}
          <ellipse cx="25.4" cy="55.6" rx="4.7" ry="3" fill={`url(#${id}f)`} {...L} />
          <ellipse cx="38.6" cy="55.6" rx="4.7" ry="3" fill={`url(#${id}f)`} {...L} />
        </>
      ),
      head: (
        <>
          <g className="pet-ear">
            <path d="M47.6 26.5 C49.4 18 49 12 47.5 7.6 C47 6.5 46 6.6 45.2 7.2 C41.2 10 37.4 13 35 16.4 Z" fill={`url(#${id}b)`} {...L} />
            <path d="M45.8 21.4 C46.6 17 46.4 13.4 45.4 11 C42.6 12.8 40.6 15 39.2 17.6 Z" fill={c.inner} />
          </g>
          <path d="M16.4 26.5 C14.6 18 15 12 16.5 7.6 C17 6.5 18 6.6 18.8 7.2 C22.8 10 26.6 13 29 16.4 Z" fill={`url(#${id}b)`} {...L} />
          <path d="M18.2 21.4 C17.4 17 17.6 13.4 18.6 11 C21.4 12.8 23.4 15 24.8 17.6 Z" fill={c.inner} />
          <path d="M15.2 27 L10.4 30.4 L15.6 32.6 Z" fill={`url(#${id}b)`} {...L} />
          <path d="M48.8 27 L53.6 30.4 L48.4 32.6 Z" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="28.6" rx="17.6" ry="14.4" fill={`url(#${id}b)`} {...L} />
          <Gloss id={id} />
          {detail && <path d="M32 14.8 v4.4 M26.6 15.8 l1 3.6 M37.4 15.8 l-1 3.6" {...stripe} />}
          <ellipse cx="32" cy="34.2" rx="7.6" ry="5" fill={`url(#${id}f)`} />
          {detail && <Blush y={34.2} dx={11.2} />}
          <Eyes mood={mood} xs={[24.4, 39.6]} y={28.6} r={3.2} ek={ek} brow={c.dark} detail={detail} />
          <path d="M30.1 31.9 Q32 31 33.9 31.9 Q33.1 34 32 34.4 Q30.9 34 30.1 31.9Z" fill={c.nose} />
          <Mouth mood={mood} y={35} w={3.4} h={2.9} kind="w" />
          {detail && <path d="M19.6 34.4 L10.6 32.8 M19.8 36.6 L11.2 38.2 M44.4 34.4 L53.4 32.8 M44.2 36.6 L52.8 38.2" stroke={c.dark} strokeWidth="0.9" strokeLinecap="round" opacity="0.75" />}
        </>
      ),
    };
  },

  dog({ c, id, mood, detail, ek, L }) {
    return {
      back: (
        <g className="pet-tail">
          <path d="M44.5 52 C50.5 50 53.6 45 52.4 38.6" stroke={c.line} strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M44.5 52 C50.5 50 53.6 45 52.4 38.6" stroke={c.body} strokeWidth="4.4" fill="none" strokeLinecap="round" />
        </g>
      ),
      body: (
        <>
          <ellipse cx="32" cy="47" rx="14.8" ry="11" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="49.6" rx="8.6" ry="7.4" fill={`url(#${id}f)`} />
          {detail && <ellipse cx="22" cy="44.4" rx="3.6" ry="4.6" transform="rotate(14 22 44.4)" fill={c.dark} opacity="0.45" />}
          <ellipse cx="25.4" cy="55.6" rx="4.8" ry="3" fill={`url(#${id}f)`} {...L} />
          <ellipse cx="38.6" cy="55.6" rx="4.8" ry="3" fill={`url(#${id}f)`} {...L} />
        </>
      ),
      head: (
        <>
          <ellipse cx="32" cy="28.6" rx="17.2" ry="14.4" fill={`url(#${id}b)`} {...L} />
          <path d="M32 15.6 C28.8 15.6 28 20.6 28.5 25.6 C28.9 29 30.4 31 32 31 C33.6 31 35.1 29 35.5 25.6 C36 20.6 35.2 15.6 32 15.6Z" fill={`url(#${id}f)`} />
          <Gloss id={id} cx={23.5} cy={19.5} rx={7.5} ry={3.6} />
          <ellipse cx="32" cy="34.4" rx="9.6" ry="6.8" fill={`url(#${id}f)`} />
          {detail && <Blush y={34} dx={13} rx={2.6} ry={1.8} o={0.4} />}
          <g className="pet-ear">
            <path d="M46 17.8 C52.6 17.6 55.8 26.4 53.8 35.4 C52.8 40.2 48 40.8 45.6 36.4 C43.4 32.4 43.2 24.4 43.8 19.4 Z" fill={`url(#${id}k)`} {...L} />
          </g>
          <path d="M18 17.8 C11.4 17.6 8.2 26.4 10.2 35.4 C11.2 40.2 16 40.8 18.4 36.4 C20.6 32.4 20.8 24.4 20.2 19.4 Z" fill={`url(#${id}k)`} {...L} />
          {detail && <ellipse cx="24.4" cy="22.6" rx="2.2" ry="1.5" fill={c.belly} opacity="0.95" />}
          {detail && <ellipse cx="39.6" cy="22.6" rx="2.2" ry="1.5" fill={c.belly} opacity="0.95" />}
          <Eyes mood={mood} xs={[24.4, 39.6]} y={27.2} r={3.2} ek={ek} brow={c.dark} detail={detail} />
          <ellipse cx="32" cy="31.4" rx="3.5" ry="2.5" fill={c.nose} />
          <ellipse cx="31" cy="30.7" rx="1.1" ry="0.6" fill="#fff" opacity="0.7" />
          <path d="M32 33.6 v2" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
          <Mouth mood={mood} y={35.8} w={4.6} h={3.4} kind="w" />
          {detail && <path d="M25.6 33.2 h0.01 M23.8 35 h0.01 M38.4 33.2 h0.01 M40.2 35 h0.01" stroke={c.dark} strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />}
        </>
      ),
    };
  },

  bunny({ c, id, mood, detail, ek, L }) {
    const tilt = mood === 'sad' ? 34 : mood === 'happy' ? 11 : 6;
    const ear = (x, s, twitch) => {
      const g = (
        <g transform={`rotate(${s * tilt} ${x} 22)`}>
          <g className={twitch ? 'pet-ear' : undefined}>
            <ellipse cx={x} cy="10.4" rx="5.1" ry="11.8" fill={`url(#${id}b)`} {...L} />
            <ellipse cx={x} cy="11.6" rx="2.5" ry="8" fill={c.inner} opacity="0.75" />
          </g>
        </g>
      );
      return g;
    };
    return {
      back: (
        <>
          {ear(25.4, -1, false)}
          {ear(38.6, 1, true)}
          <g className="pet-tail">
            <circle cx="46.8" cy="53" r="5" fill="#fff" {...L} />
            {detail && <path d="M43.6 51.6 q1.2 -1.4 2.8 -0.8 M45 55.2 q1.6 0.2 2.4 -1" stroke={c.dark} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.6" />}
          </g>
        </>
      ),
      body: (
        <>
          <ellipse cx="20.6" cy="56" rx="6.2" ry="3.1" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="43.4" cy="56" rx="6.2" ry="3.1" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="47.4" rx="14.4" ry="11" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="50" rx="8.6" ry="7.2" fill={`url(#${id}f)`} />
          <ellipse cx="26" cy="55.4" rx="4.1" ry="2.9" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="38" cy="55.4" rx="4.1" ry="2.9" fill={`url(#${id}b)`} {...L} />
        </>
      ),
      head: (
        <>
          <ellipse cx="32" cy="29" rx="17.6" ry="14" fill={`url(#${id}b)`} {...L} />
          <Gloss id={id} cy={19.8} />
          <ellipse cx="32" cy="34.2" rx="8" ry="5.2" fill={`url(#${id}f)`} />
          <Blush y={34} dx={12} rx={3.4} ry={2.3} o={0.55} />
          <Eyes mood={mood} xs={[24, 40]} y={28.6} r={3.2} ek={ek} brow={c.dark} detail={detail} />
          <path d="M30.3 31.2 Q32 30.3 33.7 31.2 Q33 33.2 32 33.6 Q31 33.2 30.3 31.2Z" fill={c.nose} />
          {mood !== 'sad' && <rect x="30.2" y="35.3" width="3.6" height="3" rx="0.9" fill="#fff" stroke={c.line} strokeWidth="0.7" />}
          {mood === 'happy' ? <Mouth mood={mood} y={35} w={3.2} h={2.6} tongue={false} /> : <Mouth mood={mood} y={34.2} w={3.2} h={2.6} kind="w" />}
          {mood !== 'sad' && mood !== 'happy' && detail && <path d="M32 35.3 v2.8" stroke={c.line} strokeWidth="0.6" opacity="0.7" />}
          {detail && <path d="M20 35.4 L11.6 34.6 M20.2 37.4 L12.4 39 M44 35.4 L52.4 34.6 M43.8 37.4 L51.6 39" stroke={c.dark} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />}
        </>
      ),
    };
  },

  fox({ c, id, mood, detail, ek, L }) {
    const tail = 'M44.5 57 C54.5 59.5 62.4 52 60.6 41 C59.8 36 56.4 32.6 52.6 32 C53.4 40 50.2 47.6 44.5 50 Z';
    return {
      back: (
        <g className="pet-tail">
          <clipPath id={`${id}t`}>
            <path d={tail} />
          </clipPath>
          <path d={tail} fill={`url(#${id}b)`} />
          <path clipPath={`url(#${id}t)`} d="M44 41.4 Q47.4 44.6 50.8 41.6 Q54.2 45 57.4 41.8 Q60.4 44.6 64 41 L64 28 L44 28 Z" fill="#fffaf2" />
          <path d={tail} fill="none" {...L} />
        </g>
      ),
      body: (
        <>
          <ellipse cx="32" cy="47" rx="14" ry="11" fill={`url(#${id}b)`} {...L} />
          <path d="M32 38.4 C38.4 38.6 41.4 44.6 39.6 51.2 C38.4 55 35.6 56.4 32 56.4 C28.4 56.4 25.6 55 24.4 51.2 C22.6 44.6 25.6 38.6 32 38.4Z" fill={`url(#${id}f)`} />
          <ellipse cx="25.6" cy="55.6" rx="4.5" ry="2.9" fill={c.sock} {...L} />
          <ellipse cx="38.4" cy="55.6" rx="4.5" ry="2.9" fill={c.sock} {...L} />
        </>
      ),
      head: (
        <>
          <g className="pet-ear">
            <path d="M46.6 25.4 C48.6 16.5 48.6 9.6 47.6 4.8 C47.4 3.8 46.4 3.7 45.6 4.3 C41 7.6 37 11.6 34 16.4 Z" fill={`url(#${id}b)`} {...L} />
            <path d="M44.6 19.8 C45.2 14.6 45 10.6 44.3 8.2 C41.2 10.4 39 12.8 37.2 15.8 Z" fill={c.inner} />
          </g>
          <path d="M17.4 25.4 C15.4 16.5 15.4 9.6 16.4 4.8 C16.6 3.8 17.6 3.7 18.4 4.3 C23 7.6 27 11.6 30 16.4 Z" fill={`url(#${id}b)`} {...L} />
          <path d="M19.4 19.8 C18.8 14.6 19 10.6 19.7 8.2 C22.8 10.4 25 12.8 26.8 15.8 Z" fill={c.inner} />
          <path d="M14.4 31.6 L9.6 34.6 L15.2 36.2 Z" fill="#fffaf2" {...L} />
          <path d="M49.6 31.6 L54.4 34.6 L48.8 36.2 Z" fill="#fffaf2" {...L} />
          <path d="M32 14.2 C41.6 14.2 50.4 19.6 50.6 27.6 C50.7 32.6 47.6 37.6 42 40.8 Q37 43.4 32 43.4 Q27 43.4 22 40.8 C16.4 37.6 13.3 32.6 13.4 27.6 C13.6 19.6 22.4 14.2 32 14.2Z" fill={`url(#${id}b)`} {...L} />
          <path d="M14.2 29.4 C17 35.8 22.4 37.4 27.2 36 Q32 34.8 36.8 36 C41.6 37.4 47 35.8 49.8 29.4 C50.2 33.4 47.4 38.2 42.2 40.8 Q37 43.1 32 43.1 Q27 43.1 21.8 40.8 C16.6 38.2 13.8 33.4 14.2 29.4Z" fill={`url(#${id}f)`} />
          <Gloss id={id} cx={24} cy={19.5} />
          <Eyes mood={mood} xs={[24.2, 39.8]} y={28.4} r={3.1} ek={ek} brow={c.dark} detail={detail} />
          {detail && <Blush y={35} dx={13.4} rx={2.6} ry={1.7} o={0.35} />}
          <path d="M29.6 35.2 Q32 33.8 34.4 35.2 Q33.6 37.4 32 37.6 Q30.4 37.4 29.6 35.2Z" fill={INK} />
          <ellipse cx="31.2" cy="34.9" rx="1" ry="0.5" fill="#fff" opacity="0.65" />
          <Mouth mood={mood} y={38.2} w={3.2} h={2.4} kind="w" />
        </>
      ),
    };
  },

  owl({ c, id, mood, detail, ek, L }) {
    const rows = [
      [43.6, 25.1, 3],
      [48.4, 22.8, 4],
      [53.2, 25.1, 3],
    ];
    const happy = mood === 'happy';
    return {
      back: null,
      body: (
        <>
          <ellipse cx="26.6" cy="57" rx="4.2" ry="1.9" fill={c.nose} stroke="#c9801a" strokeWidth="0.8" />
          <ellipse cx="37.4" cy="57" rx="4.2" ry="1.9" fill={c.nose} stroke="#c9801a" strokeWidth="0.8" />
          <ellipse cx="32" cy="42.4" rx="16.8" ry="15.4" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="47.2" rx="10.8" ry="10" fill={`url(#${id}f)`} />
          {detail &&
            rows.map(([y, x, n]) => (
              <path key={y} d={`M${x} ${y} ${'q2.3 2.7 4.6 0 '.repeat(n)}`} stroke={c.dark} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
            ))}
          {!detail && <path d="M27 46 q2.5 2.8 5 0 q2.5 2.8 5 0" stroke={c.dark} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.5" />}
          <path d="M16.2 36 C11 40.4 10.6 51.4 16.2 55.4 C19.6 56 21.4 52 21.4 46 C21.4 41 19.8 37 16.2 36Z" fill={c.wing} {...L} />
          <path d="M47.8 36 C53 40.4 53.4 51.4 47.8 55.4 C44.4 56 42.6 52 42.6 46 C42.6 41 44.2 37 47.8 36Z" fill={c.wing} {...L} />
          {detail && <path d="M13.8 44 q2.4 1.2 3.4 3.4 M14.2 49.4 q2 0.8 3 2.6 M50.2 44 q-2.4 1.2 -3.4 3.4 M49.8 49.4 q-2 0.8 -3 2.6" stroke={c.dark} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.6" />}
        </>
      ),
      head: (
        <>
          <g className="pet-ear">
            <path d="M46.4 23 C47.8 17 47.4 11.4 46 7.4 C45.7 6.6 44.8 6.5 44.2 7 C40.4 10 37.4 13 35.4 16.4 Z" fill={`url(#${id}b)`} {...L} />
          </g>
          <path d="M17.6 23 C16.2 17 16.6 11.4 18 7.4 C18.3 6.6 19.2 6.5 19.8 7 C23.6 10 26.6 13 28.6 16.4 Z" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="28.2" rx="18" ry="14.6" fill={`url(#${id}b)`} {...L} />
          <Gloss id={id} cx={23} cy={18.5} rx={8} ry={3.6} />
          <circle cx="24.6" cy="29" r="9" fill={`url(#${id}f)`} stroke={c.dark} strokeWidth="0.7" strokeOpacity="0.4" />
          <circle cx="39.4" cy="29" r="9" fill={`url(#${id}f)`} stroke={c.dark} strokeWidth="0.7" strokeOpacity="0.4" />
          {!happy && (
            <>
              <circle cx="25" cy="29" r={6.5 * (ek > 1 ? 1.05 : 1)} fill="#fff" stroke={c.dark} strokeWidth="1" />
              <circle cx="39" cy="29" r={6.5 * (ek > 1 ? 1.05 : 1)} fill="#fff" stroke={c.dark} strokeWidth="1" />
              <circle cx="25" cy="29.2" r={4.6 * (ek > 1 ? 1.05 : 1)} fill="#f4a93a" />
              <circle cx="39" cy="29.2" r={4.6 * (ek > 1 ? 1.05 : 1)} fill="#f4a93a" />
            </>
          )}
          <Eyes mood={mood} xs={[25, 39]} y={29.2} r={3} ek={ek} ink={happy ? INK : '#241f2a'} brows={false} detail={detail} />
          {mood === 'sad' && (
            <>
              <Lid id={id} n={1} x={25} y={29} r={6.5} side={-1} color={mix(c.body, c.dark, 0.2)} />
              <Lid id={id} n={2} x={39} y={29} r={6.5} side={1} color={mix(c.body, c.dark, 0.2)} />
            </>
          )}
          <path d="M29.6 33.6 Q32 32.2 34.4 33.6 Q33.4 37.8 32 38.6 Q30.6 37.8 29.6 33.6Z" fill={c.nose} stroke="#c9801a" strokeWidth="0.8" strokeLinejoin="round" />
          {detail && <Blush y={35} dx={13.6} rx={2.6} ry={1.7} o={0.4} />}
        </>
      ),
    };
  },

  frog({ c, id, mood, detail, ek, L }) {
    const dot = { fill: c.dark, opacity: 0.28 };
    return {
      back: null,
      body: (
        <>
          <ellipse cx="17.4" cy="53.6" rx="6.6" ry="4.4" transform="rotate(-18 17.4 53.6)" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="46.6" cy="53.6" rx="6.6" ry="4.4" transform="rotate(18 46.6 53.6)" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="14.6" cy="57" rx="5.4" ry="2.2" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="49.4" cy="57" rx="5.4" ry="2.2" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="47" rx="16.2" ry="10.8" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="49.6" rx="10.4" ry="7.6" fill={`url(#${id}f)`} />
          <ellipse cx="24.6" cy="55.8" rx="4.4" ry="2.5" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="39.4" cy="55.8" rx="4.4" ry="2.5" fill={`url(#${id}b)`} {...L} />
          {detail && <path d="M22.6 57 v-0.01 M24.6 57.5 v-0.01 M26.6 57 v-0.01 M37.4 57 v-0.01 M39.4 57.5 v-0.01 M41.4 57 v-0.01" stroke={c.dark} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />}
        </>
      ),
      head: (
        <>
          <circle cx="22.4" cy="20.4" r="7" fill={`url(#${id}b)`} {...L} />
          <circle cx="41.6" cy="20.4" r="7" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="30.4" rx="18.2" ry="12.8" fill={`url(#${id}b)`} {...L} />
          <Gloss id={id} cx={24} cy={25} rx={8.5} ry={3.2} rot={-12} />
          {detail && (
            <>
              <circle cx="32" cy="22.4" r="1.7" {...dot} />
              <circle cx="28.4" cy="24.6" r="1.1" {...dot} />
              <circle cx="35.8" cy="24.4" r="1.2" {...dot} />
            </>
          )}
          {mood !== 'happy' && (
            <>
              <circle cx="22.4" cy="20.4" r="5.3" fill="#fff" />
              <circle cx="41.6" cy="20.4" r="5.3" fill="#fff" />
            </>
          )}
          <Eyes mood={mood} xs={[22.4, 41.6]} y={20.8} r={3} ek={ek} ink={mood === 'happy' ? INK : '#241f2a'} brows={false} detail={detail} />
          {mood === 'sad' && (
            <>
              <Lid id={id} n={1} x={22.4} y={20.4} r={5.3} side={-1} color={c.body} />
              <Lid id={id} n={2} x={41.6} y={20.4} r={5.3} side={1} color={c.body} />
            </>
          )}
          {detail && <path d="M30.2 30 h0.01 M33.8 30 h0.01" stroke={c.dark} strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />}
          {detail && <Blush y={34} dx={14} rx={3} ry={2} />}
          {mood === 'happy' ? (
            <>
              <path d="M20.6 33.4 Q32 47 43.4 33.4 Z" fill="#6e2437" stroke="#6e2437" strokeWidth="1" strokeLinejoin="round" />
              <ellipse className="pet-tongue" cx="32" cy="39.8" rx="5" ry="2.7" fill="#ff8fa6" />
            </>
          ) : mood === 'sad' ? (
            <path d="M23.4 38.6 Q32 33 40.6 38.6" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M20.6 33.6 Q32 41.6 43.4 33.6" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          )}
        </>
      ),
    };
  },

  panda({ c, id, mood, detail, ek, L }) {
    const sad = mood === 'sad';
    const tilt = sad ? 34 : 22;
    const px = (x, s) => (
      <ellipse cx={x} cy="28.8" rx="4.9" ry="5.9" transform={`rotate(${s * tilt} ${x} 28.8)`} fill={`url(#${id}k)`} />
    );
    const er = 2.8 * ek;
    return {
      back: (
        <g className="pet-tail">
          <circle cx="46.8" cy="53.6" r="3.6" fill="#fff" {...L} />
        </g>
      ),
      body: (
        <>
          <ellipse cx="32" cy="47" rx="15.6" ry="11.4" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="50" rx="9.6" ry="7.4" fill={`url(#${id}f)`} />
          <ellipse cx="17.8" cy="46" rx="4.9" ry="8" transform="rotate(14 17.8 46)" fill={`url(#${id}k)`}  {...L} />
          <ellipse cx="46.2" cy="46" rx="4.9" ry="8" transform="rotate(-14 46.2 46)" fill={`url(#${id}k)`}  {...L} />
          <ellipse cx="24.4" cy="55.4" rx="6" ry="3.4" fill={`url(#${id}k)`}  {...L} />
          <ellipse cx="39.6" cy="55.4" rx="6" ry="3.4" fill={`url(#${id}k)`}  {...L} />
          {detail && (
            <>
              <ellipse cx="24.4" cy="55.8" rx="2.6" ry="1.6" fill={c.inner} />
              <ellipse cx="39.6" cy="55.8" rx="2.6" ry="1.6" fill={c.inner} />
            </>
          )}
        </>
      ),
      head: (
        <>
          <circle cx="18.6" cy="16.6" r="6" fill={`url(#${id}k)`}  {...L} />
          <circle cx="45.4" cy="16.6" r="6" fill={`url(#${id}k)`}  {...L} />
          {detail && (
            <>
              <circle cx="18.8" cy="17.2" r="2.8" fill={c.inner} />
              <circle cx="45.2" cy="17.2" r="2.8" fill={c.inner} />
            </>
          )}
          <ellipse cx="32" cy="28.6" rx="17.8" ry="14.5" fill={`url(#${id}b)`} {...L} />
          <Gloss id={id} cx={23} cy={19} />
          {px(24.2, -1)}
          {px(39.8, 1)}
          {mood === 'happy' ? (
            <Eyes mood={mood} xs={[24.4, 39.6]} y={28.6} r={2.7} ek={ek} ink="#fff" />
          ) : (
            <>
              <g className="pet-eyes">
                {[24.4, 39.6].map((x) => (
                  <g key={x}>
                    <circle cx={x} cy="28.6" r={er * 1.08} fill="#fff" />
                    <circle cx={x} cy="28.8" r={er * 0.74} fill="#1c1b22" />
                    <circle cx={x - er * 0.3} cy={28.6 - er * 0.34} r={er * 0.34} fill="#fff" />
                  </g>
                ))}
              </g>
              {sad && <Drop x={41.6} y={34.4} />}
            </>
          )}
          <ellipse cx="32" cy="34.6" rx="6.8" ry="4.6" fill={`url(#${id}f)`} />
          {detail && <Blush y={35} dx={13} rx={2.7} ry={1.8} o={0.4} />}
          <path d="M29.2 31.8 Q32 30.4 34.8 31.8 Q33.8 34.4 32 34.6 Q30.2 34.4 29.2 31.8Z" fill={c.nose} />
          <ellipse cx="31" cy="31.6" rx="1" ry="0.5" fill="#fff" opacity="0.5" />
          <Mouth mood={mood} y={35.2} w={3.4} h={2.6} kind="w" />
        </>
      ),
    };
  },

  cassowary({ c, id, mood, detail, ek, L }) {
    const LB = { stroke: c.blueLine, strokeWidth: L.strokeWidth, strokeLinejoin: 'round' };
    const LQ = { stroke: '#9a7638', strokeWidth: L.strokeWidth, strokeLinejoin: 'round' };
    const leg = { fill: c.leg, stroke: '#8a6e3c', strokeWidth: L.strokeWidth * 0.8, strokeLinejoin: 'round' };
    const my = mood === 'happy' ? 29.8 : mood === 'sad' ? 33.6 : 31.8;
    const mc = mood === 'happy' ? 35.4 : mood === 'sad' ? 30.8 : 33.4;
    return {
      back: (
        <g className="pet-tail">
          <path d="M46 50 C52 45.4 58 46.6 60.6 51.6 L56.8 52.6 L60.4 56.2 L55.8 56.8 L57 60 C52.6 58 49 58.2 46 56.6 Z" fill={`url(#${id}b)`} {...L} />
        </g>
      ),
      body: (
        <>
          <rect x="21.4" y="52.6" width="5.8" height="6.8" rx="2.9" {...leg} />
          <rect x="36.8" y="52.6" width="5.8" height="6.8" rx="2.9" {...leg} />
          <ellipse cx="23.8" cy="59.4" rx="5" ry="1.9" {...leg} />
          <ellipse cx="40.2" cy="59.4" rx="5" ry="1.9" {...leg} />
          {detail && <path d="M20.4 59.6 v0.01 M23.8 60.6 v0.01 M27.2 59.6 v0.01 M36.8 59.6 v0.01 M40.2 60.6 v0.01 M43.6 59.6 v0.01" stroke="#8a6e3c" strokeWidth="1.1" strokeLinecap="round" />}
          <ellipse cx="32" cy="47" rx="17.2" ry="11.8" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="23.6" cy="42" rx="6.4" ry="3.2" transform="rotate(-24 23.6 42)" fill={`url(#${id}h)`} />
          {detail && <path d="M17.6 47 q2.6 2.8 1.2 6.4 M45.8 47 q-2.6 2.8 -1.2 6.4 M26.4 51 q1.6 2.4 0.6 4.6 M37.6 51 q-1.6 2.4 -0.6 4.6 M32 50.6 q0.8 2.4 0 4.4" stroke={c.light} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.7" />}
        </>
      ),
      head: (
        <>
          <ellipse cx="32" cy="37" rx="7.8" ry="8" fill={`url(#${id}u)`} {...LB} />
          <ellipse cx="25.6" cy="35.4" rx="1.9" ry="3" transform="rotate(28 25.6 35.4)" fill={c.inner} />
          <ellipse cx="38.4" cy="35.4" rx="1.9" ry="3" transform="rotate(-28 38.4 35.4)" fill={c.inner} />
          <ellipse cx="32" cy="22.6" rx="12.8" ry="11.6" fill={`url(#${id}u)`} {...LB} />
          <Gloss id={id} cx={25.5} cy={16.4} rx={6.6} ry={3} />
          <path d="M25.8 15.8 C25 10 28 5.4 33 4.6 C37.4 4.2 40.4 7.6 39.4 11.8 C39 13.8 38.4 15 37.8 15.8 Q31.6 13.6 25.8 15.8Z" fill={`url(#${id}q)`} {...LQ} />
          <path d="M28.4 11.2 C29.4 8.6 31.4 7.2 33.6 6.8" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
          {detail && <ellipse cx="23.4" cy="27.8" rx="3.2" ry="2" fill="#7fe0ff" opacity="0.55" />}
          {detail && <ellipse cx="40.6" cy="27.8" rx="3.2" ry="2" fill="#7fe0ff" opacity="0.55" />}
          <Eyes mood={mood} xs={[26, 38]} y={22.8} r={2.9} ek={ek} brow="#102a66" detail={detail} />
          <path d={`M29.2 ${my - 0.2} Q26 ${mc} 23.4 ${my - 2.4} M34.8 ${my - 0.2} Q38 ${mc} 40.6 ${my - 2.4}`} stroke="#102a66" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M28.8 25 Q32 23.2 35.2 25 Q34 30.4 32 33.2 Q30 30.4 28.8 25Z" fill={c.nose} stroke="#9a7638" strokeWidth="1" strokeLinejoin="round" />
          <path d="M32 24.4 v7.4" stroke="#9a7638" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
          <path d="M29.4 33.4 C27.8 38 29.4 42.4 32 42.8 C34.6 42.4 36.2 38 34.6 33.4 Q32 35.4 29.4 33.4Z" fill={`url(#${id}w)`} stroke="#8f1530" strokeWidth="1" strokeLinejoin="round" />
          {detail && <path d="M32 36 v5" stroke="#8f1530" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />}
        </>
      ),
    };
  },

  redpanda({ c, id, mood, detail, ek, L }) {
    const sad = mood === 'sad';
    const tilt = sad ? 30 : mood === 'happy' ? 12 : 17;
    const tail = 'M40 56 C50 60.6 59 54.4 58.2 46 C57.8 41.2 56 38.4 54.6 36.8';
    const tear = { stroke: c.tear, strokeWidth: detail ? 1.9 : 3, strokeLinecap: 'round', fill: 'none' };
    const ear = (x, s) => (
      <g transform={`rotate(${s * tilt} ${x} 24)`}>
        <ellipse cx={x} cy="15.6" rx="6.5" ry="7.6" fill={`url(#${id}f)`} {...L} />
        <ellipse cx={x} cy="17.2" rx="3.5" ry="4.4" fill={`url(#${id}k)`} />
      </g>
    );
    return {
      back: (
        <g className="pet-tail">
          <path d={tail} stroke={c.line} strokeWidth="11.4" fill="none" strokeLinecap="round" />
          <path d={tail} stroke={`url(#${id}b)`} strokeWidth="8.7" fill="none" strokeLinecap="round" />
          <path d={tail} stroke={c.ring} strokeWidth="8.7" fill="none" strokeDasharray="3.4 4.2" strokeDashoffset="-4.2" />
          <circle cx="54.6" cy="36.8" r="4.35" fill={`url(#${id}k)`} />
        </g>
      ),
      body: (
        <>
          <ellipse cx="32" cy="47" rx="14.8" ry="11" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="49.2" rx="10.6" ry="8.6" fill={`url(#${id}k)`} />
          {detail && <path d="M27.6 45 q4.4 -1.8 8.8 0" stroke="#7a5249" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.7" />}
          <ellipse cx="25.2" cy="55.6" rx="4.9" ry="3.1" fill={`url(#${id}k)`} {...L} />
          <ellipse cx="38.8" cy="55.6" rx="4.9" ry="3.1" fill={`url(#${id}k)`} {...L} />
        </>
      ),
      head: (
        <>
          <clipPath id={`${id}hc`}>
            <ellipse cx="32" cy="28.6" rx="17.6" ry="14.4" />
          </clipPath>
          {ear(17.8, -1)}
          <g className="pet-ear">{ear(46.2, 1)}</g>
          <ellipse cx="32" cy="28.6" rx="17.6" ry="14.4" fill={`url(#${id}b)`} {...L} />
          <Gloss id={id} cx={24} cy={18.6} />
          <path
            clipPath={`url(#${id}hc)`}
            d="M12 37 C12.4 31.6 17 30.6 20.4 32.6 C22.8 34 25.8 33.2 27.6 31.8 Q32 34 36.4 31.8 C38.2 33.2 41.2 34 43.6 32.6 C47 30.6 51.6 31.6 52 37 L52 46 L12 46 Z"
            fill={`url(#${id}f)`}
          />
          {detail && <ellipse cx="24.4" cy="21.6" rx="2.6" ry="1.5" fill={c.belly} opacity="0.95" />}
          {detail && <ellipse cx="39.6" cy="21.6" rx="2.6" ry="1.5" fill={c.belly} opacity="0.95" />}
          <path d="M26.4 32.2 Q23.2 35.6 23.8 39.6" {...tear} />
          <path d="M37.6 32.2 Q40.8 35.6 40.2 39.6" {...tear} />
          {detail && <Blush y={37.4} dx={13.2} rx={2.7} ry={1.8} o={0.45} />}
          <Eyes mood={mood} xs={[24.4, 39.6]} y={28.4} r={3.2} ek={ek} brow={c.dark} detail={detail} />
          <path d="M29.8 33 Q32 31.8 34.2 33 Q33.4 35.2 32 35.4 Q30.6 35.2 29.8 33Z" fill={c.nose} />
          <ellipse cx="31.1" cy="32.7" rx="1" ry="0.5" fill="#fff" opacity="0.55" />
          <Mouth mood={mood} y={36.2} w={3.2} h={2.5} kind="w" />
        </>
      ),
    };
  },

  hedgehog({ c, id, mood, detail, ek, L }) {
    const sad = mood === 'sad';
    // Sad: the spines lie flatter (shallower points).
    const dep = sad ? 0.12 : 0.21;
    const under = spikes(32, 36.5, 23.4, 26, 207, -27, 11, dep);
    const mid = spikes(32, 38, 20.4, 22.6, 200, -20, 10, dep);
    const cap = spikes(32, 29.4, 19.6, 16.8, 173, 7, 9, dep);
    const tilt = sad ? 22 : mood === 'happy' ? 6 : 12;
    const ear = (x, s) => (
      <g transform={`rotate(${s * tilt} ${x} 22.6)`}>
        <circle cx={x} cy="19.8" r="4.9" fill={c.inner} {...L} />
        <circle cx={x} cy="20.4" r="2.7" fill="#fbd3c6" />
      </g>
    );
    const hair = 'L50.6 27 C50.8 21.6 45 19.2 40.4 19.8 Q36 20.4 32 23.2 Q28 20.4 23.6 19.8 C19 19.2 13.2 21.6 13.4 27 Z';
    return {
      back: (
        <g className="pet-spines">
          <path d={`${spikePath(under)} L47 54 Q32 60 17 54 Z`} fill={`url(#${id}k)`} {...L} />
          <path d={`${spikePath(mid)} L45 54 Q32 58 19 54 Z`} fill={`url(#${id}b)`} />
          {detail && <path d={spikeTips(mid, 0.46)} fill={c.light} opacity="0.55" />}
          {detail && <path d={spikeTips(under, 0.34)} fill={c.light} opacity="0.4" />}
        </g>
      ),
      body: (
        <>
          <ellipse cx="32" cy="47.4" rx="13.6" ry="10.6" fill={`url(#${id}f)`} {...L} />
          <ellipse cx="22.6" cy="50" rx="3.1" ry="2.5" fill={c.belly} {...L} />
          <ellipse cx="41.4" cy="50" rx="3.1" ry="2.5" fill={c.belly} {...L} />
          <ellipse cx="25.8" cy="56.4" rx="4.3" ry="2.6" fill={c.foot} stroke={c.dark} strokeWidth={L.strokeWidth} />
          <ellipse cx="38.2" cy="56.4" rx="4.3" ry="2.6" fill={c.foot} stroke={c.dark} strokeWidth={L.strokeWidth} />
          {detail && <path d="M24.2 55.6 v1.2 M26 55.8 v1.2 M36.2 55.8 v1.2 M38 55.6 v1.2" stroke={c.tip} strokeWidth="0.7" strokeLinecap="round" opacity="0.7" />}
        </>
      ),
      head: (
        <>
          <ellipse cx="32" cy="29" rx="17.6" ry="14.4" fill={`url(#${id}f)`} {...L} />
          <path d={`${spikePath(cap)} ${hair}`} fill={`url(#${id}b)`} {...L} />
          <path d={spikeTips(cap, 0.5)} fill={c.light} opacity="0.7" />
          {ear(15.2, -1)}
          {ear(48.8, 1)}
          <Gloss id={id} cx={24} cy={17.4} rx={7} ry={3} />
          {detail && <Blush y={35.4} dx={13} rx={2.8} ry={1.8} o={0.45} />}
          <Eyes mood={mood} xs={[24.2, 39.8]} y={29.4} r={3.1} ek={ek} brow={c.dark} detail={detail} />
          <path d="M26.6 34 C26.6 31.8 29 30.4 32 30.4 C35 30.4 37.4 31.8 37.4 34 C37.4 36.6 34.2 39.2 32 40 C29.8 39.2 26.6 36.6 26.6 34Z" fill="#fbead4" stroke={c.line} strokeWidth="0.8" strokeOpacity="0.45" />
          <ellipse cx="32" cy="36.6" rx="2.7" ry="2.1" fill={c.nose} />
          <ellipse cx="31" cy="35.8" rx="0.9" ry="0.5" fill="#fff" opacity="0.8" />
          <Mouth mood={mood} y={39.4} w={2.8} h={1.8} kind="w" />
        </>
      ),
    };
  },

  chicken({ c, id, mood, detail, ek, L }) {
    const sad = mood === 'sad';
    const feather = (a, len, w) => (
      <path
        transform={`translate(43.6 51.4) rotate(${a})`}
        d={`M0 0 C${-w} ${-len * 0.3} ${-w} ${-len * 0.8} 0 ${-len} C${w} ${-len * 0.8} ${w} ${-len * 0.3} 0 0Z`}
        fill={`url(#${id}k)`}
        {...L}
      />
    );
    const toe = { stroke: c.legLine, strokeWidth: detail ? 1.5 : 2, strokeLinecap: 'round', fill: 'none' };
    const wing = (s) => (
      <g transform={s < 0 ? undefined : 'translate(64 0) scale(-1 1)'}>
        <path d="M17.2 40.4 C11.6 42.6 10.8 52 16.4 55 C19.8 54.6 21.6 50.4 21.4 45.6 C21.2 42.8 19.6 40.6 17.2 40.4Z" fill={c.wing} {...L} />
        {detail && <path d="M13.6 49.6 q1.8 2.2 3.8 0.6 M15.6 45.8 q1.8 2.2 3.8 0.6 M16.6 52.4 q1.4 1.2 2.8 0.2" stroke={c.light} strokeWidth="1.1" fill="none" strokeLinecap="round" />}
      </g>
    );
    const comb = (
      <g transform={sad ? 'rotate(20 32 17) translate(1.2 1.4)' : undefined}>
        {[[26.6, 13.6, 3.7], [32, 11.2, 4.3], [37.4, 13.6, 3.7]].map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} fill={c.comb} stroke={c.combLine} strokeWidth={L.strokeWidth * 2.1} />
        ))}
        <ellipse cx="32" cy="16.4" rx="6.9" ry="3.2" fill={c.comb} stroke={c.combLine} strokeWidth={L.strokeWidth * 2.1} />
        {[[26.6, 13.6, 3.7], [32, 11.2, 4.3], [37.4, 13.6, 3.7]].map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} fill={c.comb} />
        ))}
        <ellipse cx="32" cy="16.4" rx="6.9" ry="3.2" fill={c.comb} />
        <ellipse cx="30.4" cy="9.8" rx="1.7" ry="1" fill="#fff" opacity="0.5" transform="rotate(-20 30.4 9.8)" />
      </g>
    );
    return {
      back: (
        <g className="pet-tail">
          {feather(62, 19, 4.4)}
          {feather(32, 22.5, 4.8)}
          {feather(4, 20, 4.4)}
        </g>
      ),
      body: (
        <>
          <path d="M26 54.4 V58.6 M38 54.4 V58.6" stroke={c.leg} strokeWidth={detail ? 1.7 : 2.4} strokeLinecap="round" />
          <path d="M26 58.8 L22.4 60.2 M26 58.8 V60.6 M26 58.8 L29.6 60.2 M38 58.8 L34.4 60.2 M38 58.8 V60.6 M38 58.8 L41.6 60.2" {...toe} stroke={c.leg} />
          <ellipse cx="32" cy="46" rx="15.4" ry="10.8" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="49.4" rx="9.2" ry="7.2" fill={`url(#${id}f)`} />
          {wing(-1)}
          {wing(1)}
        </>
      ),
      head: (
        <>
          <g className="pet-peck">
            {comb}
            <ellipse cx="32" cy="29" rx="17.4" ry="14.4" fill={`url(#${id}b)`} {...L} />
            <Gloss id={id} cx={24} cy={19.4} rx={7.6} ry={3.6} />
            {detail && <Blush y={34} dx={12.4} rx={3} ry={2} o={0.5} />}
            <Eyes mood={mood} xs={[24.6, 39.4]} y={28.2} r={3.1} ek={ek} brow={c.line} detail={detail} />
            <path d="M32 36 C29.8 36 29 38.4 29.6 40.6 C30.2 42.8 33.8 42.8 34.4 40.6 C35 38.4 34.2 36 32 36Z" fill={c.comb} stroke={c.combLine} strokeWidth="0.8" strokeLinejoin="round" />
            {mood === 'happy' ? (
              <>
                <path d="M28.6 31.2 Q32 29.6 35.4 31.2 Q34 33.8 32 34 Q30 33.8 28.6 31.2Z" fill={c.nose} stroke="#c9801a" strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M29.2 34 Q32 33.2 34.8 34 Q33.8 37.6 32 37.8 Q30.2 37.6 29.2 34Z" fill="#6e2437" stroke="#c9801a" strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M29.8 33.7 L34.2 33.7 L32 35.8Z" fill={c.nose} />
              </>
            ) : (
              <>
                <path d={sad ? 'M28.4 31.8 Q32 30 35.6 31.8 Q34 36.4 32 36.8 Q30 36.4 28.4 31.8Z' : 'M28.4 31.2 Q32 29.4 35.6 31.2 Q34 35.8 32 36.2 Q30 35.8 28.4 31.2Z'} fill={c.nose} stroke="#c9801a" strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M29.2 32 Q32 33.2 34.8 32" stroke="#c9801a" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.7" />
                <ellipse cx="31" cy="31.4" rx="1" ry="0.5" fill="#fff" opacity="0.6" />
              </>
            )}
          </g>
        </>
      ),
    };
  },

  // A living pear-cut gem: mint and seafoam facets, a lighter table with the
  // face on it, white glints that twinkle now and then (pet-glint) and a slow
  // shimmer across the stone (pet-shimmer), on two stubby feet. The baby is a
  // small rough crystal; it gets cut as it grows, and fully faceted when grown.
  gem({ c, id, mood, detail, ek, L, stage }) {
    const sad = mood === 'sad';
    const happy = mood === 'happy';
    const rough = stage === 'baby';
    const cut = rough ? roughCut() : gemCut(detail ? (stage === 'grown' ? 10 : 8) : 6, detail && stage === 'grown');
    // Sad: the stone goes a little cloudy (duller facets, no sparkle). The rough baby is frostier.
    const tone = (v) => {
      const k = sad ? 0.25 + v * 0.55 : rough ? 0.18 + v * 0.66 : v;
      return k < 0.5 ? mix(c.deep, c.body, k / 0.5) : mix(c.body, c.light, (k - 0.5) / 0.5);
    };
    const edge = rough ? 0.18 : 0.42;
    return {
      body: (
        <>
          <ellipse cx="25" cy="56.6" rx="4" ry="2.7" fill={c.shade} {...L} />
          <ellipse cx="39" cy="56.6" rx="4" ry="2.7" fill={c.shade} {...L} />
          {detail && <ellipse cx="24.3" cy="55.8" rx="1.8" ry="0.8" fill="#fff" opacity="0.5" />}
          {detail && <ellipse cx="38.3" cy="55.8" rx="1.8" ry="0.8" fill="#fff" opacity="0.5" />}
        </>
      ),
      head: (
        <>
          <clipPath id={`${id}gc`}>
            <path d={cut.outline} />
          </clipPath>
          <path d={cut.outline} fill={c.body} />
          <g clipPath={`url(#${id}gc)`}>
            {cut.facets.map(([d, v], i) => (
              <path key={i} d={d} fill={tone(v)} stroke="#fff" strokeOpacity={detail ? edge : edge * 0.6} strokeWidth={detail ? 0.55 : 0.8} strokeLinejoin="round" />
            ))}
            <path d={cut.table} fill={`url(#${id}t)`} stroke="#fff" strokeOpacity={rough ? 0.35 : 0.85} strokeWidth={detail ? 0.7 : 0.9} strokeLinejoin="round" />
            {/* A slow band of light across the stone (hidden until it moves). */}
            <g className="pet-shimmer" opacity="0">
              <path d="M6 64 L20 64 L36 10 L22 10 Z" fill="#fff" opacity="0.5" />
              <path d="M23 64 L27 64 L43 10 L39 10 Z" fill="#fff" opacity="0.35" />
            </g>
            {/* glassy rim light along the upper left */}
            <path d={cut.outline} fill="none" stroke="#fff" strokeOpacity={rough ? 0.25 : 0.55} strokeWidth={detail ? 1 : 1.4} transform="translate(0.9 1.1)" />
          </g>
          <path d={cut.outline} fill="none" stroke={c.line} strokeWidth={L.strokeWidth} strokeLinejoin="round" />
          {detail && !rough && <ellipse cx="20.6" cy="28.2" rx="5.6" ry="2" transform="rotate(-38 20.6 28.2)" fill="#fff" opacity="0.6" />}
          {detail && rough && <ellipse cx="22.6" cy="27.4" rx="4" ry="1.6" transform="rotate(-36 22.6 27.4)" fill="#fff" opacity="0.4" />}
          {detail && <Blush y={39} x={30} dx={10.6} rx={2.8} ry={1.8} o={0.5} />}
          <Eyes mood={mood} xs={[23.5, 36.5]} y={34} r={2.9} ek={ek} brow={c.line} detail={detail} />
          <Mouth mood={mood} x={30} y={39.2} w={2.8} h={2.2} tongue={false} />
          {/* Sparkles: one that twinkles now and then; more when it's happy, none when it's sad. */}
          {!sad && <Glint className="pet-glint" x={rough ? 44.6 : 46.8} y={rough ? 27.6 : 29.2} r={detail ? 3.6 : 4.4} />}
          {!sad && detail && !rough && <Glint className="pet-glint g2" x={15.2} y={43.4} r={2.4} o={0.9} />}
          {happy && detail && <Glint className="pet-glint g3" x={57.4} y={22.4} r={2.8} o={0.95} />}
          {happy && detail && <Glint className="pet-glint g4" x={8.6} y={23.6} r={2} o={0.85} />}
        </>
      ),
      // It's all one piece: the grown scarf goes over the stone, a bit lower, like a bib.
      scarfY: 3,
      over: true,
    };
  },


  monkey({ c, id, mood, detail, ek, L }) {
    return {
      back: (
        <g className="pet-tail">
          <path d="M44.5 55.5 C58 60 63.5 45 56.4 40.4 C52.2 37.8 48.4 41.6 51.6 43.8" stroke={c.line} strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M44.5 55.5 C58 60 63.5 45 56.4 40.4 C52.2 37.8 48.4 41.6 51.6 43.8" stroke={c.body} strokeWidth="4.2" fill="none" strokeLinecap="round" />
        </g>
      ),
      body: (
        <>
          <ellipse cx="32" cy="47" rx="14.8" ry="11.2" fill={`url(#${id}b)`} {...L} />
          <ellipse cx="32" cy="49.8" rx="10.2" ry="8.2" fill={`url(#${id}f)`} />
          <ellipse cx="25.4" cy="55.6" rx="4.8" ry="3" fill={c.face} {...L} />
          <ellipse cx="38.6" cy="55.6" rx="4.8" ry="3" fill={c.face} {...L} />
        </>
      ),
      head: (
        <>
          <path d="M22.6 18 Q23.4 10.6 26.2 10.4 Q28 13 29 14.6 Q30.4 8.6 33.2 8.8 Q35 12 35.2 14.8 Q37.4 10 40 11.4 Q41.6 13.6 41.4 18 Z" fill={`url(#${id}b)`} {...L} />
          <g className="pet-ear">
            <circle cx="47.6" cy="28.2" r="5" fill={`url(#${id}b)`} {...L} />
            <circle cx="47.4" cy="28.2" r="2.7" fill={c.inner} />
          </g>
          <circle cx="16.4" cy="28.2" r="5" fill={`url(#${id}b)`} {...L} />
          <circle cx="16.6" cy="28.2" r="2.7" fill={c.inner} />
          <ellipse cx="32" cy="27.6" rx="16.6" ry="14" fill={`url(#${id}b)`} {...L} />
          <Gloss id={id} cx={24} cy={17.6} rx={8} ry={3.4} />
          <ellipse cx="32" cy="31.4" rx="12.8" ry="10.8" fill={`url(#${id}f2)`} />
          {detail && <Blush y={35} dx={12} rx={2.8} ry={1.9} o={0.45} />}
          {detail && <path d="M21.6 22.6 Q25.4 20.4 28.6 22 M42.4 22.6 Q38.6 20.4 35.4 22" stroke={c.dark} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.55" />}
          <Eyes mood={mood} xs={[25, 39]} y={27.8} r={3} ek={ek} brow={c.dark} detail={detail} />
          {mood === 'happy' ? (
            <path d="M23.4 37 Q32 49 40.6 37 Z" fill="#6e2437" stroke="#6e2437" strokeWidth="1" strokeLinejoin="round" />
          ) : mood === 'sad' ? (
            <path d="M24.6 42 Q32 35.6 39.4 42" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M24 38 Q32 46 40 38" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          )}
          <path d="M29.8 26.4 C29.6 31 27 34.2 27 39 C27 43.6 30.4 46 33.4 45.6 C37 45 38.6 41.4 37.4 37.6 C36.4 34.4 34.6 31 34.4 26.4 Z" fill={`url(#${id}n)`} stroke="#c25a45" strokeWidth="1" strokeLinejoin="round" />
          <ellipse cx="29.8" cy="36" rx="1.2" ry="3" transform="rotate(10 29.8 36)" fill="#fff" opacity="0.5" />
          <ellipse cx="30.6" cy="42.2" rx="1.1" ry="1.5" transform="rotate(-10 30.6 42.2)" fill="#8f3a30" opacity="0.85" />
          <ellipse cx="34.4" cy="42.4" rx="1.1" ry="1.5" transform="rotate(10 34.4 42.4)" fill="#8f3a30" opacity="0.85" />
        </>
      ),
    };
  },
};

// --- the whole pet --------------------------------------------------------

function Defs({ id, c }) {
  const light = c.light || mix(c.body, '#ffffff', 0.4);
  const shade = c.shade || mix(c.body, c.dark, 0.3);
  const bl = mix(c.belly, '#ffffff', 0.7);
  const bs = mix(c.belly, c.dark, 0.14);
  return (
    <defs>
      <radialGradient id={`${id}b`} cx="0.36" cy="0.26" r="0.9">
        <stop offset="0" stopColor={light} />
        <stop offset="0.55" stopColor={c.body} />
        <stop offset="1" stopColor={shade} />
      </radialGradient>
      <radialGradient id={`${id}f`} cx="0.4" cy="0.28" r="0.9">
        <stop offset="0" stopColor={bl} />
        <stop offset="1" stopColor={bs} />
      </radialGradient>
      <radialGradient id={`${id}k`} cx="0.36" cy="0.26" r="0.9">
        <stop offset="0" stopColor={mix(c.dark, '#ffffff', 0.22)} />
        <stop offset="1" stopColor={c.dark} />
      </radialGradient>
      <radialGradient id={`${id}h`}>
        <stop offset="0" stopColor="#fff" stopOpacity="0.62" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      {c.blue && (
        <>
          <radialGradient id={`${id}u`} cx="0.36" cy="0.26" r="0.9">
            <stop offset="0" stopColor={mix(c.blue, '#ffffff', 0.45)} />
            <stop offset="0.55" stopColor={c.blue} />
            <stop offset="1" stopColor={mix(c.blue, c.blueLine, 0.7)} />
          </radialGradient>
          <radialGradient id={`${id}q`} cx="0.36" cy="0.26" r="0.9">
            <stop offset="0" stopColor="#fff3cf" />
            <stop offset="0.6" stopColor={c.casque} />
            <stop offset="1" stopColor="#c19a55" />
          </radialGradient>
          <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff5c6c" />
            <stop offset="1" stopColor="#c81e3a" />
          </linearGradient>
        </>
      )}
      {c.table && (
        <radialGradient id={`${id}t`} cx="0.34" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#f6fffb" />
          <stop offset="0.6" stopColor={c.table} />
          <stop offset="1" stopColor={mix(c.table, c.deep, 0.22)} />
        </radialGradient>
      )}
      {c.face && (
        <radialGradient id={`${id}f2`} cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor={mix(c.face, '#ffffff', 0.45)} />
          <stop offset="1" stopColor={mix(c.face, c.dark, 0.12)} />
        </radialGradient>
      )}
      {c.face && (
        <radialGradient id={`${id}n`} cx="0.36" cy="0.3" r="0.9">
          <stop offset="0" stopColor={mix(c.nose, '#ffffff', 0.4)} />
          <stop offset="0.6" stopColor={c.nose} />
          <stop offset="1" stopColor={mix(c.nose, '#b04a3a', 0.4)} />
        </radialGradient>
      )}
    </defs>
  );
}

const Scarf = ({ detail }) => (
  <g strokeLinejoin="round">
    <path d="M38.4 47.4 L40.6 57.4 L46.4 55.8 L43.8 46 Z" fill="#cf3a50" stroke="#9c2a3d" strokeWidth="1" />
    <path d="M18.4 41.6 Q32 49.4 45.6 41.6 L45.2 47 Q32 55.2 18.8 47 Z" fill="#e24b61" stroke="#9c2a3d" strokeWidth="1" />
    <path d="M19.4 44.8 Q32 52.6 44.6 44.8" fill="none" stroke="#f4a5b0" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
    {detail && <path d="M40.8 55.6 l-0.4 1.8 M43 55 l-0.4 1.8 M45 54.4 l-0.4 1.8" stroke="#9c2a3d" strokeWidth="0.8" strokeLinecap="round" />}
    <path
      d="M24.6 45.6 l1.1 2.3 2.5 0.3 -1.8 1.8 0.5 2.5 -2.3 -1.2 -2.2 1.2 0.4 -2.5 -1.8 -1.8 2.5 -0.3 Z"
      transform="translate(1.2 -2.4)"
      fill="#ffd34d"
      stroke="#c99512"
      strokeWidth="0.6"
    />
  </g>
);

// neck: what the pet wears at the neck (PetGear's Neck, in this art's own
// coordinates). It's drawn under the head, so a long nose, a beak or a wattle
// stays in front of it.
export function PetArt({ species = 'cat', mood = 'ok', stage = 'young', size = 64, still = false, className = '', title, neck = null }) {
  const id = 'p' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = LOOK[species] || LOOK.cat;
  const detail = size >= 40;
  const baby = stage === 'baby';
  const grown = stage === 'grown';
  const st = petStage(species, stage);
  const s = st.s;
  const L = { stroke: c.line, strokeWidth: detail ? 1.35 : 1.9, strokeLinejoin: 'round' };
  const part = (DRAW[species] || DRAW.cat)({ c, id, mood, detail, ek: (baby ? 1.28 : 1) * (detail ? 1 : 1.16), L, stage });
  // A pet that's all one piece (the gem) wears its scarf over itself, lower down, and has no neck shadow.
  const scarf = grown && (
    <g transform={part.scarfY ? `translate(0 ${part.scarfY})` : undefined}>
      <Scarf detail={detail} />
    </g>
  );
  const headT = st.head !== 1 ? `translate(32 41) scale(${st.head}) translate(-32 -41)` : undefined;
  const bodyT = st.body !== 1 ? `translate(32 58) scale(${st.body}) translate(-32 -58)` : undefined;
  return (
    <svg
      className={`pet-art pet-${mood}${still ? '' : ' anim'} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <Defs id={id} c={c} />
      <ellipse cx="32" cy="60.4" rx={17 * s} ry="2.7" fill="currentColor" opacity="0.13" />
      <g className="pet-bob">
        <g transform={`translate(${32 - 32 * s} ${60 - 60 * s}) scale(${s})`}>
          {part.back}
          <g transform={bodyT}>{part.body}</g>
          {/* a soft shadow where the head sits on the body */}
          {!part.over && <ellipse cx="32" cy="41.6" rx="12" ry="3.4" fill={c.dark} opacity="0.22" />}
          {!part.over && scarf}
          {!part.over && neck}
          <g transform={headT}>{part.head}</g>
          {part.over && scarf}
          {part.over && neck}
        </g>
      </g>
    </svg>
  );
}
