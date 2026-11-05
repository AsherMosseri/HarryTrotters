// Pet Hop (3.2): tap to hop up, and slip through the gaps in the field
// towers. Plain math, no DOM, so the game screen and
// scripts/test-pet-games.mjs run the same thing.
//
// The world is 100 units tall (y down, the ground strip starts at GROUND)
// and as wide as the screen's shape makes it. The pet stays at one x and the
// towers slide past; the score is the number of gaps passed.

export const DT = 1 / 120;
export const H = 100;
export const GROUND = 88;
export const HOP = {
  g: 230, // units/s² down
  flap: -74, // the speed one tap gives (up)
  fall: 110, // fastest fall
  r: 4.4, // the pet's hit circle (a bit smaller than it looks: fair)
  towerW: 11,
  spacing: 44, // between towers
  speed: 31, // at the start…
  speedMax: 44, // …up to this
  gap: 36, // the gap at the start…
  gapMin: 27, // …down to this
  margin: 13, // a gap's middle stays this far from the top and the ground
};
// Kinds of tower, picked in turn with some luck: drawn differently, the same to hit.
export const KINDS = ['beam', 'gear', 'cone'];

// A small seeded random (mulberry32), so a test run is the same every time.
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// width: the world's width in units (100 × the screen's width / height).
export function newHop({ width = 60, seed = Date.now() } = {}) {
  const w = Math.max(48, Math.min(170, width));
  return {
    w,
    x: Math.max(16, Math.min(w * 0.3, 40)),
    y: 44,
    vy: 0,
    t: 0,
    dist: 0,
    score: 0,
    status: 'ready', // ready → go → over
    towers: [],
    nextAt: w + 8, // where the next tower appears (in dist units)
    rand: rng(seed),
    lastMid: 44,
    flaps: 0,
    bob: 0,
  };
}

// How fast and how wide, by score.
export const speedAt = (score) => Math.min(HOP.speedMax, HOP.speed + score * 0.45);
export const gapAt = (score) => Math.max(HOP.gapMin, HOP.gap - score * 0.3);

function addTower(g) {
  const half = gapAt(g.score) / 2;
  const lo = HOP.margin + half;
  const hi = GROUND - HOP.margin - half;
  // Not too far from the last gap, so it's always reachable.
  const reach = 30;
  const mid = Math.max(lo, Math.min(hi, g.lastMid + (g.rand() * 2 - 1) * reach));
  g.lastMid = mid;
  const kind = KINDS[Math.floor(g.rand() * KINDS.length)];
  g.towers.push({ x: g.w + 4, top: mid - half, bottom: mid + half, kind, passed: false, spin: g.rand() * Math.PI * 2 });
}

const hitsBox = (cx, cy, r, x0, y0, x1, y1) => {
  const nx = Math.max(x0, Math.min(cx, x1));
  const ny = Math.max(y0, Math.min(cy, y1));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
};

// One fixed step; flap: a tap since the last step. Returns the game.
export function step(g, flap = false) {
  if (g.status === 'over') {
    // Fall to the ground after a bump.
    if (g.y < GROUND - HOP.r) {
      g.vy = Math.min(HOP.fall * 1.4, g.vy + HOP.g * DT);
      g.y = Math.min(GROUND - HOP.r, g.y + g.vy * DT);
    }
    return g;
  }
  if (g.status === 'ready') {
    g.bob += DT;
    g.y = 44 + Math.sin(g.bob * 4) * 2;
    if (!flap) return g;
    g.status = 'go';
  }
  if (flap) {
    g.vy = HOP.flap;
    g.flaps++;
  }
  g.t += DT;
  g.vy = Math.min(HOP.fall, g.vy + HOP.g * DT);
  g.y += g.vy * DT;
  // The top is a soft ceiling, not a crash.
  if (g.y < HOP.r) {
    g.y = HOP.r;
    g.vy = Math.max(0, g.vy);
  }
  const v = speedAt(g.score) * DT;
  g.dist += v;
  for (const t of g.towers) t.x -= v;
  g.towers = g.towers.filter((t) => t.x > -HOP.towerW - 4);
  const last = g.towers[g.towers.length - 1];
  if (!last || last.x <= g.w + 4 - HOP.spacing) addTower(g);
  for (const t of g.towers) {
    const x0 = t.x - HOP.towerW / 2;
    const x1 = t.x + HOP.towerW / 2;
    if (hitsBox(g.x, g.y, HOP.r, x0, -50, x1, t.top) || hitsBox(g.x, g.y, HOP.r, x0, t.bottom, x1, GROUND + 50)) {
      g.status = 'over';
      g.vy = Math.max(g.vy, 0);
      return g;
    }
    if (!t.passed && x1 < g.x - HOP.r) {
      t.passed = true;
      g.score++;
    }
  }
  if (g.y >= GROUND - HOP.r) {
    g.y = GROUND - HOP.r;
    g.status = 'over';
  }
  return g;
}

// The pet's tilt (radians): nose up going up, down when falling.
export const tiltOf = (g) => (g.status === 'ready' ? 0 : Math.max(-0.45, Math.min(1.1, g.vy * 0.009)));

// A simple autopilot for tests: hop when below the next gap's middle and falling.
export function botFlap(g) {
  const next = g.towers.find((t) => t.x + HOP.towerW / 2 > g.x - HOP.r) || null;
  const target = next ? (next.top + next.bottom) / 2 + 3 : 44;
  return g.status === 'ready' || (g.y > target && g.vy > -10);
}
