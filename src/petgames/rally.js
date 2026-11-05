// Pet Rally's physics (3.2): a little car with two sprung wheels on a
// side-view ground line (functions/shared/petRally.js builds the levels).
// Plain math, no DOM, so the game screen and scripts/test-pet-games.mjs run
// the very same thing. Meters and seconds, y up, angles counterclockwise.
//
// - The body is one rigid piece (position, angle, spin). Each wheel is a
//   small mass held to its spot under the body by a spring and a damper:
//   stiff front to back, softer up and down (the suspension).
// - A wheel touching the ground is pushed out of it, and grip turns its spin
//   into driving (limited by how hard it presses on the ground).
// - Gas spins the wheels up; the motor's push back lifts the nose. Brake
//   slows them, then backs up slowly. In the air, Gas tips the car back and
//   Brake tips it forward.
// - The pet's head touching the ground ends the run (flipped), and so does
//   falling into the water.

import { groundAt } from '../../functions/shared/petRally.js';

export const DT = 1 / 240;
export const CAR = {
  g: 13.5,
  bodyM: 1,
  bodyI: 0.45,
  wheelR: 0.36,
  wheelM: 0.22,
  anchors: [
    [-0.82, -0.36],
    [0.82, -0.36],
  ],
  kAlong: 2600,
  dAlong: 26,
  kSusp: 170,
  dSusp: 9,
  travel: 0.22, // how far a wheel can push up before it hits the stop
  grip: 1.15,
  drive: 2.6, // motor torque on each wheel at a standstill
  spinMax: 33, // wheel spin at top speed (rad/s): about 11.9 m/s
  brake: 5,
  reverse: 0.35, // backing up: this part of top speed
  airTilt: 10, // rad/s² from the buttons with no wheel on the ground
  groundTilt: 1.6, // a little from the buttons on the ground too
  maxSpin: 5.5,
  // Points on the body that bump the ground (body coordinates).
  hull: [
    [-1.08, -0.18],
    [1.12, -0.16],
    [-1.02, 0.32],
    [1.0, 0.24],
    [0, -0.34],
  ],
  head: [-0.1, 0.8],
  headR: 0.3,
};

const rot = (x, y, c, s) => [x * c - y * s, x * s + y * c];

// The closest point on the ground to (x, y) within reach: { dist, nx, ny }
// (the normal points out of the ground), or null.
export function nearestGround(level, x, y, reach) {
  const { pts } = level;
  let lo = 0;
  let hi = pts.length - 1;
  const from = x - reach;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= from) lo = mid;
    else hi = mid;
  }
  let best = null;
  for (let i = lo; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    if (ax > x + reach) break;
    const ex = bx - ax;
    const ey = by - ay;
    const len2 = ex * ex + ey * ey || 1e-9;
    let t = ((x - ax) * ex + (y - ay) * ey) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + ex * t;
    const qy = ay + ey * t;
    let dx = x - qx;
    let dy = y - qy;
    let d = Math.hypot(dx, dy);
    // Under the ground: the normal is the segment's own (pointing up).
    const under = y < groundAt(level, x) - 1e-6;
    if (d < 1e-9 || under) {
      const l = Math.sqrt(len2);
      dx = -ey / l;
      dy = ex / l;
      if (dy < 0) {
        dx = -dx;
        dy = -dy;
      }
      d = under ? -Math.max(d, groundAt(level, x) - y) : 0;
    } else {
      dx /= d;
      dy /= d;
    }
    if (!best || d < best.dist) best = { dist: d, nx: dx, ny: dy };
  }
  return best;
}

export function newCar(level) {
  const x = level.startX;
  const gy = groundAt(level, x);
  const y = gy + CAR.wheelR - CAR.anchors[0][1] + 0.05;
  return {
    x,
    y,
    a: 0,
    vx: 0,
    vy: 0,
    w: 0,
    wheels: CAR.anchors.map(([ax, ay]) => ({ x: x + ax, y: y + ay, vx: 0, vy: 0, spin: 0, turn: 0, ground: false })),
    t: 0, // seconds since the start
    status: 'ready', // ready → go → won | flipped | splash
    air: 0, // seconds with no wheel down
    best: 0, // farthest x
    landed: 0, // how hard the last landing was (for a little shake)
  };
}

// One fixed step. input: { gas, brake } (booleans). Returns the car (changed).
export function step(car, level, input = {}) {
  if (car.status !== 'go' && car.status !== 'ready') return car;
  if (car.status === 'ready') {
    if (!input.gas && !input.brake) return car;
    car.status = 'go';
  }
  const dt = DT;
  const C = CAR;
  const gas = !!input.gas && !input.brake;
  const brake = !!input.brake && !input.gas;
  const c = Math.cos(car.a);
  const s = Math.sin(car.a);
  let fx = 0;
  let fy = -C.g * C.bodyM;
  let tq = 0;
  let downCount = 0;

  // Springs between the body and each wheel.
  car.wheels.forEach((wh, i) => {
    const [lx, ly] = C.anchors[i];
    const [ox, oy] = rot(lx, ly, c, s);
    const ax = car.x + ox;
    const ay = car.y + oy;
    const avx = car.vx - car.w * oy;
    const avy = car.vy + car.w * ox;
    // In body axes: u along the body, v up through it.
    const dx = ax - wh.x;
    const dy = ay - wh.y;
    const du = dx * c + dy * s;
    const dv = -dx * s + dy * c;
    const rvx = avx - wh.vx;
    const rvy = avy - wh.vy;
    const ru = rvx * c + rvy * s;
    const rv = -rvx * s + rvy * c;
    let Fu = C.kAlong * du + C.dAlong * ru;
    let Fv = C.kSusp * dv + C.dSusp * rv;
    // The bump stop: a wheel pushed up past its travel meets the body.
    const comp = -dv - C.travel;
    if (comp > 0) Fv -= 2600 * comp + 40 * Math.max(0, -rv);
    const Fx = Fu * c - Fv * s;
    const Fy = Fu * s + Fv * c;
    wh.vx += (Fx / C.wheelM) * dt;
    wh.vy += (Fy / C.wheelM - C.g) * dt;
    fx -= Fx;
    fy -= Fy;
    tq -= ox * Fy - oy * Fx;
    if (wh.ground) downCount++;
  });

  // The motor and the brakes, on the wheels; the body feels the push back.
  const J = 0.5 * C.wheelM * C.wheelR * C.wheelR;
  for (const wh of car.wheels) {
    let t = 0;
    if (gas) t = wh.spin < 0 ? C.brake : C.drive * Math.max(0, 1 - wh.spin / C.spinMax);
    else if (brake) {
      if (wh.spin > 0.6) t = -C.brake;
      else t = -C.drive * 0.8 * Math.max(0, 1 + wh.spin / (C.spinMax * C.reverse));
    } else t = -Math.sign(wh.spin) * Math.min(Math.abs(wh.spin) * J / dt, 0.12);
    wh.spin += (t / J) * dt;
    if (gas || brake) tq += t * 0.55;
  }
  // Tipping from the buttons: strong in the air, a little on the ground.
  const tilt = gas ? 1 : brake ? -1 : 0;
  tq += tilt * (downCount ? C.groundTilt : C.airTilt) * C.bodyI;

  car.vx += (fx / C.bodyM) * dt;
  car.vy += (fy / C.bodyM) * dt;
  car.w += (tq / C.bodyI) * dt;
  car.w = Math.max(-C.maxSpin, Math.min(C.maxSpin, car.w)) * (1 - 0.15 * dt);
  car.vx *= 1 - 0.02 * dt;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.a += car.w * dt;

  // Wheels: move, then the ground pushes back and grips.
  for (const wh of car.wheels) {
    wh.x += wh.vx * dt;
    wh.y += wh.vy * dt;
    wh.turn -= wh.spin * dt;
    wh.ground = false;
    const hit = nearestGround(level, wh.x, wh.y, C.wheelR + 0.1);
    if (!hit || hit.dist >= C.wheelR) continue;
    wh.ground = true;
    const pen = C.wheelR - hit.dist;
    wh.x += hit.nx * pen;
    wh.y += hit.ny * pen;
    const vn = wh.vx * hit.nx + wh.vy * hit.ny;
    let jn = 0;
    if (vn < 0) {
      jn = -vn * C.wheelM * 1.05;
      if (-vn > 4) car.landed = Math.max(car.landed, -vn);
      wh.vx -= hit.nx * vn * 1.05;
      wh.vy -= hit.ny * vn * 1.05;
    }
    // The tangent points forward (right) along the ground.
    const tx = hit.ny;
    const ty = -hit.nx;
    const slip = wh.vx * tx + wh.vy * ty - wh.spin * C.wheelR;
    const k = 1 / C.wheelM + (C.wheelR * C.wheelR) / J;
    let jt = -slip / k;
    const lim = C.grip * (jn + C.wheelM * C.g * Math.max(0, hit.ny) * dt);
    jt = Math.max(-lim, Math.min(lim, jt));
    wh.vx += (jt / C.wheelM) * tx;
    wh.vy += (jt / C.wheelM) * ty;
    wh.spin -= (jt * C.wheelR) / J;
  }

  // The body's corners and belly bump the ground.
  const c2 = Math.cos(car.a);
  const s2 = Math.sin(car.a);
  for (const [lx, ly] of C.hull) {
    const [ox, oy] = rot(lx, ly, c2, s2);
    const hit = nearestGround(level, car.x + ox, car.y + oy, 0.4);
    if (!hit || hit.dist >= 0.04) continue;
    const pen = 0.04 - hit.dist;
    car.x += hit.nx * pen;
    car.y += hit.ny * pen;
    const pvx = car.vx - car.w * oy;
    const pvy = car.vy + car.w * ox;
    const vn = pvx * hit.nx + pvy * hit.ny;
    if (vn >= 0) continue;
    const rn = ox * hit.ny - oy * hit.nx;
    const j = (-1.1 * vn) / (1 / C.bodyM + (rn * rn) / C.bodyI);
    car.vx += (j * hit.nx) / C.bodyM;
    car.vy += (j * hit.ny) / C.bodyM;
    car.w += (rn * j) / C.bodyI;
    // A little scrape along the ground.
    const tx = hit.ny;
    const ty = -hit.nx;
    const vt = pvx * tx + pvy * ty;
    const rt = ox * ty - oy * tx;
    let jt = -vt / (1 / C.bodyM + (rt * rt) / C.bodyI);
    const lim = 0.5 * j;
    jt = Math.max(-lim, Math.min(lim, jt));
    car.vx += (jt * tx) / C.bodyM;
    car.vy += (jt * ty) / C.bodyM;
    car.w += (rt * jt) / C.bodyI;
  }

  car.t += dt;
  car.air = car.wheels.some((w) => w.ground) ? 0 : car.air + dt;
  // Stuck: no headway for a while (hung on an edge, or on its back).
  if (car.x > car.best + 0.4) {
    car.best = car.x;
    car.since = car.t;
  } else if (car.t - (car.since || 0) > 8) car.status = 'stuck';
  // The pet's head on the ground: flipped.
  const [hx, hy] = rot(C.head[0], C.head[1], c2, s2);
  const head = nearestGround(level, car.x + hx, car.y + hy, C.headR + 0.1);
  if (head && head.dist < C.headR) car.status = 'flipped';
  else if (car.y < level.killY || level.water.some(([x0, x1, wy]) => car.x > x0 && car.x < x1 && car.y < wy + 0.3)) car.status = 'splash';
  else if (car.x >= level.flagX) car.status = 'won';
  return car;
}

// The pose to draw: body and wheels, plus the head point.
export function pose(car) {
  const c = Math.cos(car.a);
  const s = Math.sin(car.a);
  const [hx, hy] = rot(CAR.head[0], CAR.head[1], c, s);
  return { x: car.x, y: car.y, a: car.a, head: [car.x + hx, car.y + hy], wheels: car.wheels.map((w) => ({ x: w.x, y: w.y, turn: w.turn })) };
}

// Speed along the ground, for the speedometer (m/s).
export const speedOf = (car) => Math.hypot(car.vx, car.vy);

// A simple driver for tests (and nothing else): gas, but keep the nose in
// check on the ground and level in the air.
export function botInput(car) {
  const a = Math.atan2(Math.sin(car.a), Math.cos(car.a));
  const air = car.air > 0.08;
  if (air) {
    if (a > 0.25 || car.w > 2) return { brake: true };
    if (a < -0.35 || car.w < -2) return { gas: true };
    return {};
  }
  if (a > 0.75 && car.w > 0) return { brake: true };
  return { gas: true };
}

// Runs a whole level with a driver: { status, ms, x }.
export function simulate(level, driver = botInput, maxSeconds = 120) {
  const car = newCar(level);
  const steps = Math.round(maxSeconds / DT);
  for (let i = 0; i < steps && (car.status === 'go' || car.status === 'ready'); i++) step(car, level, driver(car, i));
  return { status: car.status, ms: Math.round(car.t * 1000), x: car.x };
}
