// Pet Rally's levels (3.2): side-view tracks for the car game on the pet
// screen (src/petgames/rally.js drives on them). Each level is a list of
// pieces laid end to end; buildLevel turns it into a ground line (x always
// going right, so the ground is a height for each x) plus what to draw on it.
// Plain data and math, no Firebase: the app plays it, and the server reads
// each level's length to check a reported time is possible
// (shared/petgames.js).
//
// Units are meters, y up. Pieces:
//   ['flat', len]
//   ['hills', len, amp, waves]     smooth rolling hills that end where they start
//   ['bumps', len, amp, count]     short sharp bumps
//   ['slope', len, dy]             an S-shaped climb (dy > 0) or drop
//   ['ramp', len, h]               a kicker that lifts h, then drops off steeply
//   ['gap', width, depth]          a pit with water: jump it or splash
//   ['bridge', len, sag]           a wooden bridge over a river (it sags a bit)
//   ['steps', count, h, w]         rounded steps up (h > 0) or down
//   ['cones', ...xs]               traffic cones to drive past (just for show)

export const RALLY_LEVELS = [
  { id: 1, name: 'Pit Lane', tip: 'Hold Gas and roll to the flag.', pieces: [['flat', 10], ['hills', 36, 1.2, 2], ['flat', 6], ['bumps', 14, 0.25, 4], ['flat', 12]] },
  { id: 2, name: 'Practice Field', tip: 'Ease off on the big hills.', pieces: [['flat', 8], ['hills', 40, 2.4, 2], ['slope', 14, 3], ['hills', 30, 1.6, 2], ['slope', 14, -3], ['flat', 12]] },
  { id: 3, name: 'Bumpy Backlot', tip: 'Bumps bounce you. Keep it steady.', pieces: [['flat', 8], ['bumps', 24, 0.4, 7], ['hills', 24, 1.6, 1], ['bumps', 22, 0.5, 6], ['steps', 4, 0.45, 3.4], ['flat', 12]] },
  { id: 4, name: 'Bridge Day', tip: 'Bridges sag in the middle.', pieces: [['flat', 10], ['slope', 10, 1.5], ['bridge', 22, 0.9], ['hills', 26, 1.8, 2], ['bridge', 28, 1.2], ['slope', 10, -1.5], ['flat', 12]] },
  { id: 5, name: 'First Jump', tip: 'Speed up for the ramp. Tap Brake in the air to tip the nose down.', pieces: [['flat', 14], ['ramp', 7, 1.6], ['flat', 16], ['hills', 26, 1.8, 2], ['ramp', 7, 1.8], ['flat', 14]] },
  { id: 6, name: 'Gear Hills', tip: 'Steep climbs: Gas lifts the nose, Brake tips it down.', pieces: [['flat', 8], ['hills', 34, 3.2, 2], ['slope', 16, 4.5], ['hills', 26, 2.2, 2], ['slope', 16, -4.5], ['hills', 30, 3.4, 2], ['flat', 12]] },
  { id: 7, name: 'Over the Pit', tip: 'Full speed off the ramp to clear the water.', pieces: [['flat', 16], ['ramp', 7, 1.5], ['gap', 4.5, 4], ['flat', 12], ['bumps', 14, 0.4, 4], ['flat', 12], ['ramp', 7, 1.6], ['gap', 5.5, 4], ['flat', 14]] },
  { id: 8, name: 'River Run', tip: 'Bridges, bumps and a jump. Steady wins.', pieces: [['flat', 10], ['bridge', 24, 1.2], ['bumps', 18, 0.5, 5], ['slope', 12, 2.5], ['bridge', 26, 1.5], ['flat', 12], ['ramp', 7, 2.1], ['gap', 6, 4], ['hills', 28, 2, 2], ['flat', 12]] },
  { id: 9, name: 'Stair Climb', tip: 'Big steps. Keep the nose down.', pieces: [['flat', 10], ['steps', 5, 0.6, 3.6], ['hills', 24, 2.4, 1], ['steps', 5, -0.6, 3.6], ['bumps', 16, 0.55, 5], ['steps', 6, 0.55, 3.2], ['flat', 18], ['ramp', 7, 2.2], ['gap', 6, 5], ['flat', 14]] },
  { id: 10, name: 'Championship', tip: 'Everything at once. You and your pet can do it.', pieces: [['flat', 12], ['hills', 30, 3, 2], ['ramp', 7, 1.6], ['gap', 5.5, 5], ['flat', 10], ['bridge', 26, 1.5], ['steps', 4, 0.6, 3.4], ['bumps', 18, 0.6, 5], ['slope', 14, -3], ['flat', 10], ['ramp', 7, 2.3], ['gap', 6.5, 5], ['flat', 8], ['hills', 30, 3.4, 2], ['flat', 14]] },
];
export const RALLY_COUNT = RALLY_LEVELS.length;
export const rallyLevel = (n) => RALLY_LEVELS[n - 1] || null;

const STEP = 0.5;
const r3 = (n) => Math.round(n * 1000) / 1000;

// The ground of level n: { pts: [[x, y]…], kind: [per segment: 'ground' |
// 'bridge' | 'pit'], water: [[x0, x1, y]…], props: [{ kind, x, y }],
// startX, flagX, length, killY }.
export function buildLevel(n) {
  const lv = rallyLevel(n);
  if (!lv) return null;
  const pts = [[-30, 0]];
  const kind = [];
  const water = [];
  const props = [];
  let x = 0;
  let y = 0;
  let minY = 0;
  const to = (nx, ny, k = 'ground') => {
    pts.push([r3(nx), r3(ny)]);
    kind.push(k);
    minY = Math.min(minY, ny);
  };
  to(0, 0);
  for (const [type, a, b, c] of lv.pieces) {
    if (type === 'flat') {
      for (let s = STEP * 4; s <= a + 1e-9; s += STEP * 4) to(x + s, y);
      x += a;
    } else if (type === 'hills') {
      // amp up and back down, `waves` times (cosine, so slopes start flat).
      const steps = Math.max(4, Math.round(a / STEP));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        to(x + a * t, y + (b * (1 - Math.cos(2 * Math.PI * c * t))) / 2);
      }
      x += a;
    } else if (type === 'bumps') {
      const w = a / c;
      for (let k = 0; k < c; k++) {
        const x0 = x + k * w;
        const flat = w * 0.35;
        to(x0 + flat, y);
        const bw = w - flat;
        for (let i = 1; i <= 6; i++) to(x0 + flat + (bw * i) / 6, y + b * Math.sin((Math.PI * i) / 6));
      }
      x += a;
    } else if (type === 'slope') {
      const steps = Math.max(4, Math.round(a / STEP));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        to(x + a * t, y + (b * (1 - Math.cos(Math.PI * t))) / 2);
      }
      x += a;
      y += b;
    } else if (type === 'ramp') {
      // A curved kicker: flat at the start, steepest at the lip.
      const steps = Math.max(6, Math.round(a / STEP));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        to(x + a * t, y + b * t * t);
      }
      props.push({ kind: 'ramp', x: x + a, y: y + b, h: b });
      // the drop back down, steep but not a wall (the ground is one height per x)
      to(x + a + 0.35, y);
      x += a + 0.35;
    } else if (type === 'gap') {
      const bottom = y - b;
      to(x + 0.3, bottom, 'pit');
      to(x + a - 0.3, bottom, 'pit');
      to(x + a, y, 'pit');
      water.push([x, x + a, bottom + b * 0.55]);
      x += a;
    } else if (type === 'bridge') {
      // The deck sags like a rope bridge; posts at both ends, a river below.
      const steps = Math.max(6, Math.round(a / STEP));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        to(x + a * t, y - b * Math.sin(Math.PI * t), 'bridge');
      }
      water.push([x, x + a, y - b - 1.6]);
      props.push({ kind: 'post', x, y }, { kind: 'post', x: x + a, y });
      x += a;
    } else if (type === 'steps') {
      // b: rise of each step (negative goes down), c: tread length.
      for (let k = 0; k < a; k++) {
        to(x + c * 0.55, y);
        const edge = Math.max(1, Math.abs(b) * 2.2);
        for (let i = 1; i <= 4; i++) {
          const t = i / 4;
          to(x + c * 0.55 + edge * t, y + (b * (1 - Math.cos(Math.PI * t))) / 2);
        }
        y += b;
        to(x + c, y);
        x += c;
      }
    }
  }
  const length = x;
  // The run-out after the flag.
  for (let s = 2; s <= 30; s += 2) to(x + s, y);
  const flagX = length - 4;
  const fy = groundAt({ pts }, flagX);
  props.push({ kind: 'flag', x: flagX, y: fy });
  // Cones by the start line and some field gear along the way (only drawn).
  props.push({ kind: 'cone', x: 2.5, y: 0 }, { kind: 'cone', x: 4.2, y: 0 });
  for (let gx = 22; gx < length - 10; gx += 31) {
    const gy = groundAt({ pts }, gx);
    const flat = Math.abs(groundAt({ pts }, gx - 0.6) - gy) + Math.abs(groundAt({ pts }, gx + 0.6) - gy) < 0.15;
    const inPit = water.some(([a, b]) => gx > a - 1 && gx < b + 1);
    if (flat && !inPit) props.push({ kind: gx % 2 ? 'cone' : 'gear', x: gx, y: gy });
  }
  return { n, name: lv.name, tip: lv.tip, pts, kind, water, props, startX: 2.4, flagX, length, killY: minY - 1.5 };
}

// The ground's height at x (the first segment that covers it).
export function groundAt(level, x) {
  const { pts } = level;
  let lo = 0;
  let hi = pts.length - 1;
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[hi][0]) return pts[hi][1];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = pts[lo];
  const [x1, y1] = pts[hi];
  return x1 === x0 ? Math.max(y0, y1) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

// The level lengths, for the server's "is this time possible" check.
export const RALLY_LENGTHS = RALLY_LEVELS.map((_, i) => buildLevel(i + 1).length);
