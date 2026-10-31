// Auto path planner (G7): a 30-second AUTO on the BIOBUZZ field, drawn as a
// path. The app runs this to preview a path while it's drawn; the server
// runs the same code on the path it's sent and pays from that, never from a
// score the app sends.
//
// The field, from the 2026-27 Competition Manual (TU07), in inches from the
// rear-left corner (x to the right, y toward the audience); the red ALLIANCE
// AREA is on the left (Section 9.5). You are a red ROBOT, so you stay in
// columns A-C (x < 72) during AUTO (G402).
//   - FIELD 144 x 144 in. (9.2). ROBOT: an 18 in. cube (R102).
//   - Red LOADING ZONE: 11 in. deep, 23 in. wide on the red wall (9.3, Fig. 9-2).
//   - Red GARDEN: 23 in. along the audience wall in the red corner, with 4 POLLEN (9.3, 10.3.1).
//   - FLOWERS on the red side: on the rear wall and on the red wall, 4 POLLEN each (9.7, Fig. 10-2).
//   - The HIVE structure in the middle (9.6.1); this game drives around its frame.
//   - Each ROBOT starts with 4 POLLEN (10.3.1) and may hold at most 4 (G407).
// Scoring (Table 10-2, AUTO): LEAVE 3 (not touching the perimeter wall at
// the end of AUTO), PARK 5 (at least partly in your LOADING ZONE), HIVE TIP 20.
// The manual says a HIVE tips when "enough" is LAUNCHED into the up CELL
// without a number, so this game counts a TIP for every 4 POLLEN LAUNCHED.

export const AUTO = {
  field: 144,
  half: 9, // half the robot's width
  seconds: 30,
  speed: 36, // in/s, an average with speeding up and slowing down
  collectS: 3, // taking POLLEN out of a FLOWER or the GARDEN
  launchS: 2.5,
  perTip: 4,
  hold: 4, // G407
  points: { leave: 3, park: 5, tip: 20 },
  midline: 72,
  // The HIVE frame's base (49.46 x 38.95 in.), centered on the field.
  frame: { x0: 52.5, y0: 47.3, x1: 91.5, y1: 96.7 },
  loadingZone: { x0: 0, y0: 25, x1: 11, y1: 48 },
  // Where this game lets you LAUNCH from: on your side, facing your HIVE.
  launch: { x0: 22, y0: 30, x1: 42, y1: 114 },
  stations: [
    { id: 'flower-rear', label: 'FLOWER (rear wall)', x: 48, y: 3, r: 16, pollen: 4 },
    { id: 'flower-red', label: 'FLOWER (red wall)', x: 3, y: 96, r: 16, pollen: 4 },
    { id: 'garden', label: 'Red GARDEN', x: 12, y: 140, r: 15, pollen: 4 },
  ],
  // Legal starts (G304): on your side, touching the wall, not in the
  // LOADING ZONE, not touching a FLOWER.
  starts: [
    { id: 'rear', label: 'Rear wall', x: 24, y: 9 },
    { id: 'wall', label: 'Alliance wall', x: 9, y: 72 },
    { id: 'garden', label: 'By the GARDEN', x: 9, y: 120 },
    { id: 'audience', label: 'Audience wall', x: 40, y: 135 },
  ],
  maxPoints: 600,
};

const inRect = (x, y, r, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
const round1 = (n) => Math.round(n * 10) / 10;

// Why a robot centered at (x, y) can't be there, or ''.
export function blockedAt(x, y) {
  const h = AUTO.half;
  if (x < h - 0.01 || y < h - 0.01 || y > AUTO.field - h + 0.01) return 'wall';
  if (x > AUTO.midline - h + 0.01) return 'midline';
  if (inRect(x, y, AUTO.frame, h)) return 'hive';
  return '';
}

// Clean up a path from the app: numbers only, inside the field, at most
// maxPoints, starting at a legal start. Returns { points, start } or { error }.
export function cleanPath(raw) {
  if (!Array.isArray(raw) || raw.length < 1) return { error: 'Draw a path first.' };
  const pts = [];
  for (const p of raw.slice(0, AUTO.maxPoints)) {
    if (!Array.isArray(p) || p.length !== 2) return { error: 'That path didn’t make sense.' };
    const [x, y] = p.map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'That path didn’t make sense.' };
    pts.push([round1(Math.min(AUTO.field, Math.max(0, x))), round1(Math.min(AUTO.field, Math.max(0, y)))]);
  }
  const start = AUTO.starts.find((s) => Math.hypot(s.x - pts[0][0], s.y - pts[0][1]) <= 3);
  if (!start) return { error: 'Start from one of the starting spots.' };
  pts[0] = [start.x, start.y];
  return { points: pts, start };
}

// Drive the path. Stops where the 30 seconds run out or something is in the
// way. Driving into a FLOWER or the GARDEN with room in the robot picks up
// POLLEN; driving into the launch spots with POLLEN launches it all.
export function simulate(raw) {
  const clean = cleanPath(raw);
  if (clean.error) return { error: clean.error, score: 0, events: [], trail: [] };
  const pts = clean.points;
  const left = Object.fromEntries(AUTO.stations.map((s) => [s.id, s.pollen]));
  let t = 0;
  let held = 4;
  let launched = 0;
  let tips = 0;
  let [x, y] = pts[0];
  const events = [];
  const trail = [[x, y, 0]];
  let stoppedBy = '';
  const inside = new Set(AUTO.stations.filter((s) => Math.hypot(s.x - x, s.y - y) <= s.r).map((s) => s.id));
  let inLaunch = inRect(x, y, AUTO.launch);
  const act = (seconds) => {
    if (t + seconds > AUTO.seconds) {
      t = AUTO.seconds;
      return false;
    }
    t += seconds;
    return true;
  };
  const arrive = () => {
    for (const s of AUTO.stations) {
      const near = Math.hypot(s.x - x, s.y - y) <= s.r;
      if (near && !inside.has(s.id) && held < AUTO.hold && left[s.id] > 0) {
        const take = Math.min(AUTO.hold - held, left[s.id]);
        if (!act(AUTO.collectS)) return false;
        left[s.id] -= take;
        held += take;
        events.push({ t: round1(t), type: 'collect', at: s.id, n: take, label: `Picked up ${take} POLLEN at the ${s.label}` });
      }
      if (near) inside.add(s.id);
      else inside.delete(s.id);
    }
    const nowIn = inRect(x, y, AUTO.launch);
    if (nowIn && !inLaunch && held > 0) {
      if (!act(AUTO.launchS)) return false;
      const before = Math.floor(launched / AUTO.perTip);
      launched += held;
      events.push({ t: round1(t), type: 'launch', n: held, label: `Launched ${held} POLLEN` });
      held = 0;
      const after = Math.floor(launched / AUTO.perTip);
      for (let k = before; k < after; k++) {
        tips += 1;
        events.push({ t: round1(t), type: 'tip', label: `HIVE TIP ${tips}` });
      }
    }
    inLaunch = nowIn;
    return true;
  };
  for (let i = 1; i < pts.length && !stoppedBy; i++) {
    const [nx, ny] = pts[i];
    const ox = x;
    const oy = y;
    // Walk long steps in small pieces so walls and zones are checked.
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - ox, ny - oy) / 2));
    for (let k = 1; k <= steps; k++) {
      const px = ox + ((nx - ox) * k) / steps;
      const py = oy + ((ny - oy) * k) / steps;
      const why = blockedAt(px, py);
      if (why) {
        stoppedBy = why;
        break;
      }
      const dt = Math.hypot(px - x, py - y) / AUTO.speed;
      if (t + dt > AUTO.seconds) {
        t = AUTO.seconds;
        stoppedBy = 'time';
        break;
      }
      t += dt;
      x = px;
      y = py;
      if (!arrive()) {
        stoppedBy = 'time';
        break;
      }
    }
    trail.push([round1(x), round1(y), round1(t)]);
  }
  const h = AUTO.half;
  const touching = x <= h + 0.5 || y <= h + 0.5 || y >= AUTO.field - h - 0.5 || x >= AUTO.field - h - 0.5;
  const lz = AUTO.loadingZone;
  const park = x - h < lz.x1 && y + h > lz.y0 && y - h < lz.y1;
  const leave = !touching;
  const score = (leave ? AUTO.points.leave : 0) + (park ? AUTO.points.park : 0) + tips * AUTO.points.tip;
  return {
    start: clean.start.id,
    score,
    leave,
    park,
    tips,
    launched,
    held,
    time: round1(t),
    end: [round1(x), round1(y)],
    stoppedBy,
    events,
    trail,
  };
}

// Score tiers that pay coins the first time you reach them.
export const AUTO_TIERS = [8, 28, 48, 68, 88];
