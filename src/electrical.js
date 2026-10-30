// The electrical diagram (Resources tab): parts placed on a canvas and wires
// between their ports. Saved as diagrams/electrical:
//   parts: [{ id, type, x, y, label, side?, text?, size? }]
//   wires: [{ id, from: [partId, portId], to: [partId, portId], color? }]
// Hubs have fixed ports like the real REV hubs. Devices (motors, servos,
// sensors...) have one or two ports on the side you pick (`side`).

import controlHubPhoto from './assets/diagram/control-hub.webp';
import expansionHubPhoto from './assets/diagram/expansion-hub.webp';
import motorPhoto from './assets/diagram/motor.webp';
import servoPhoto from './assets/diagram/servo.webp';
import batteryPhoto from './assets/diagram/battery.webp';

// Hubs are drawn as their photos, this wide on the canvas.
export const HUB_W = 460;

// Port kinds: what plugs in where, and how a wire of that kind looks
// (an outer and inner color, like a two-conductor cable).
export const KINDS = {
  power: { label: 'Power (XT30)', outer: '#111827', inner: '#ef4444' },
  motor: { label: 'Motor power', outer: '#111827', inner: '#dc2626' },
  encoder: { label: 'Encoder', outer: '#0f766e', inner: '#5eead4' },
  servo: { label: 'Servo', outer: '#78350f', inner: '#facc15' },
  rs485: { label: 'RS485', outer: '#1d4ed8', inner: '#ffffff' },
  i2c: { label: 'I²C', outer: '#15803d', inner: '#86efac' },
  digital: { label: 'Digital', outer: '#6d28d9', inner: '#c4b5fd' },
  analog: { label: 'Analog', outer: '#c2410c', inner: '#fdba74' },
  usb: { label: 'USB', outer: '#334155', inner: '#94a3b8' },
};

// A hub from its photo: where each connector is in the photo (in the
// photo's own pixels), scaled to the canvas.
function hubFromPhoto(photo, iw, ih, spots) {
  const h = Math.round((HUB_W * ih) / iw);
  const ports = spots.map(([id, kind, label, x, y, side]) => ({ id, kind, label, x: (x * HUB_W) / iw, y: (y * h) / ih, side }));
  return { photo, w: HUB_W, h, ports };
}
// Shared layout: XT30 power on top, motors (and their encoders) down the
// left, servos along the bottom, RS485 / I²C / digital / analog on the right.
function spots({ pwrY, motorY, encY, servoX, servoY, rs485, i2c, digital, analog, usb }) {
  const out = [
    ['pwr0', 'power', 'XT30', 22, pwrY, 'top'],
    ['pwr1', 'power', 'XT30', 40, pwrY, 'top'],
  ];
  if (usb) out.push(['usb', 'usb', 'USB', usb, 2, 'top']);
  motorY.forEach((y, i) => out.push([`m${i}`, 'motor', `M${i}`, 8, y, 'left']));
  encY.forEach((y, i) => out.push([`e${i}`, 'encoder', `E${i}`, 25, y, 'left']));
  servoX.forEach((x, i) => out.push([`s${i}`, 'servo', `S${i}`, x, servoY, 'bottom']));
  out.push(['rs485', 'rs485', 'RS485', 362, rs485, 'right']);
  i2c.forEach((y, i) => out.push([`i2c${i}`, 'i2c', `I²C ${i}`, 362, y, 'right']));
  ['d01', 'd23', 'd45', 'd67'].forEach((id, i) => out.push([id, 'digital', `D ${id[1]}-${id[2]}`, 362, digital[i], 'right']));
  ['a01', 'a23'].forEach((id, i) => out.push([id, 'analog', `A ${id[1]}-${id[2]}`, 362, analog[i], 'right']));
  return out;
}
const CONTROL_HUB = hubFromPhoto(
  controlHubPhoto,
  395,
  284,
  spots({
    pwrY: 48,
    usb: 300,
    motorY: [97, 137, 175, 212],
    encY: [115, 154, 192, 229],
    servoX: [90, 117, 145, 173, 200, 228],
    servoY: 258,
    rs485: 87,
    i2c: [146, 133, 118, 105],
    digital: [206, 193, 178, 163],
    analog: [236, 223],
  }),
);
const EXPANSION_HUB = hubFromPhoto(
  expansionHubPhoto,
  392,
  294,
  spots({
    pwrY: 50,
    motorY: [98, 137, 180, 217],
    encY: [119, 158, 199, 237],
    servoX: [89, 117, 144, 172, 199, 227],
    servoY: 268,
    rs485: 89,
    i2c: [152, 137, 123, 107],
    digital: [213, 199, 185, 170],
    analog: [246, 230],
  }),
);

// type → how it looks (icon: a line icon's name, shell/icons.jsx) and its ports. Device ports have no x/y: they sit on
// the device's chosen side (see portPos).
export const PART_TYPES = {
  controlHub: { name: 'Control Hub', hub: true, ...CONTROL_HUB },
  expansionHub: { name: 'Expansion Hub', hub: true, ...EXPANSION_HUB },
  battery: { name: 'Battery', icon: 'battery', photo: batteryPhoto, ports: [{ id: 'out', kind: 'power', label: '' }] },
  switch: {
    name: 'Power switch',
    icon: 'power',
    ports: [
      { id: 'in', kind: 'power', label: 'in', fixedSide: 'left' },
      { id: 'out', kind: 'power', label: 'out', fixedSide: 'right' },
    ],
  },
  motor: {
    name: 'Motor',
    icon: 'gear',
    photo: motorPhoto,
    ports: [
      { id: 'pwr', kind: 'motor', label: '' },
      { id: 'enc', kind: 'encoder', label: 'enc' },
    ],
  },
  servo: { name: 'Servo', icon: 'servo', photo: servoPhoto, ports: [{ id: 'sig', kind: 'servo', label: '' }] },
  i2cSensor: { name: 'I²C sensor', icon: 'signal', hint: 'Distance, color, IMU', ports: [{ id: 'i2c', kind: 'i2c', label: '' }] },
  digitalSensor: { name: 'Digital sensor', icon: 'touch', hint: 'Touch, limit switch', ports: [{ id: 'dig', kind: 'digital', label: '' }] },
  analogSensor: { name: 'Analog sensor', icon: 'sliders', hint: 'Potentiometer', ports: [{ id: 'ana', kind: 'analog', label: '' }] },
  odometry: { name: 'Odometry pod', icon: 'wheel', ports: [{ id: 'enc', kind: 'encoder', label: '' }] },
  camera: { name: 'Camera', icon: 'camera', ports: [{ id: 'usb', kind: 'usb', label: '' }] },
  led: { name: 'LED / other', icon: 'bulb', ports: [{ id: 'sig', kind: 'servo', label: '' }] },
  text: { name: 'Text', ports: [] },
};
export const ADDABLE = [
  'motor',
  'servo',
  'i2cSensor',
  'digitalSensor',
  'analogSensor',
  'odometry',
  'camera',
  'led',
  'battery',
  'switch',
  'controlHub',
  'expansionHub',
  'text',
];

export const DEV_W = 132;
export const DEV_H = 48;

export function partSize(p) {
  const t = PART_TYPES[p.type];
  if (t?.hub) return { w: t.w, h: t.h };
  if (p.type === 'text') {
    const size = p.size || 18;
    const lines = String(p.text || 'Text').split('\n');
    return { w: Math.max(40, Math.max(...lines.map((l) => l.length)) * size * 0.56), h: lines.length * size * 1.25 };
  }
  return { w: DEV_W, h: DEV_H };
}

// A port's position on the canvas and the direction its wire leaves in.
export function portPos(part, portId) {
  const t = PART_TYPES[part.type];
  const ports = t?.ports || [];
  const i = ports.findIndex((p) => p.id === portId);
  const port = ports[i];
  if (!port) return null;
  if (t.hub) return { x: part.x + port.x, y: part.y + port.y, side: port.side, port };
  const side = port.fixedSide || part.side || 'right';
  // Devices: ports spread along the chosen side.
  const same = ports.filter((p) => (p.fixedSide || part.side || 'right') === side);
  const k = same.findIndex((p) => p.id === portId);
  const frac = (k + 1) / (same.length + 1);
  const pos = {
    left: { x: part.x, y: part.y + DEV_H * frac },
    right: { x: part.x + DEV_W, y: part.y + DEV_H * frac },
    top: { x: part.x + DEV_W * frac, y: part.y },
    bottom: { x: part.x + DEV_W * frac, y: part.y + DEV_H },
  }[side];
  return { ...pos, side, port };
}

const NORMAL = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

// An orthogonal path through points, with rounded corners.
function rounded(points, r = 16) {
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const r1 = Math.min(r, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
    const ax = x - Math.sign(x - px) * r1;
    const ay = y - Math.sign(y - py) * r1;
    const bx = x + Math.sign(nx - x) * r1;
    const by = y + Math.sign(ny - y) * r1;
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L${lx},${ly}`;
}

// A smooth cable from port to port, leaving each port straight out. When
// both ports face the same way and one is behind the other (two hubs' XT30
// ports, both on top), the cable goes around the side instead of through.
export function wirePath(a, b) {
  if (a.side === b.side) {
    const vertical = a.side === 'top' || a.side === 'bottom';
    const behind = vertical ? Math.abs(b.y - a.y) > 60 : Math.abs(b.x - a.x) > 60;
    if (behind) {
      const out = 26;
      const s = a.side === 'top' || a.side === 'left' ? -1 : 1;
      if (vertical) {
        const ya = a.y + s * out;
        const yb = b.y + s * out;
        const x = Math.min(a.x, b.x) - 70;
        return rounded([
          [a.x, a.y],
          [a.x, ya],
          [x, ya],
          [x, yb],
          [b.x, yb],
          [b.x, b.y],
        ]);
      }
      const xa = a.x + s * out;
      const xb = b.x + s * out;
      const y = Math.min(a.y, b.y) - 70;
      return rounded([
        [a.x, a.y],
        [xa, a.y],
        [xa, y],
        [xb, y],
        [xb, b.y],
        [b.x, b.y],
      ]);
    }
  }
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const k = Math.max(30, Math.min(160, d * 0.45));
  const [ax, ay] = NORMAL[a.side] || [0, 0];
  const [bx, by] = NORMAL[b.side] || [0, 0];
  return `M${a.x},${a.y} C${a.x + ax * k},${a.y + ay * k} ${b.x + bx * k},${b.y + by * k} ${b.x},${b.y}`;
}

// A wire's kind: the hub end's kind (devices can carry two kinds).
export function wireKind(parts, w) {
  const ends = [w.from, w.to].map(([pid, port]) => {
    const p = parts.find((x) => x.id === pid);
    const def = PART_TYPES[p?.type]?.ports.find((x) => x.id === port);
    return { hub: !!PART_TYPES[p?.type]?.hub, kind: def?.kind };
  });
  const hubEnd = ends.find((e) => e.hub) || ends[0];
  // Plugged into the wrong kind of port (power and motor power are both power).
  const group = (k) => (k === 'motor' ? 'power' : k);
  const mismatch = !!(
    ends[0].kind &&
    ends[1].kind &&
    group(ends[0].kind) !== group(ends[1].kind) &&
    !(ends[0].kind === 'motor' && ends[1].kind === 'motor')
  );
  return { kind: hubEnd.kind || ends[1].kind || 'usb', mismatch };
}

// "Control Hub · Motor 0" for every connection of a part.
export function connectionsOf(parts, wires, partId) {
  const out = [];
  for (const w of wires) {
    for (const [mine, other] of [
      [w.from, w.to],
      [w.to, w.from],
    ]) {
      if (mine[0] !== partId) continue;
      const op = parts.find((p) => p.id === other[0]);
      if (!op) continue;
      const def = PART_TYPES[op.type]?.ports.find((x) => x.id === other[1]);
      out.push({ wire: w.id, part: op, port: def, text: `${op.label || PART_TYPES[op.type]?.name} · ${portName(op, def)}` });
    }
  }
  return out;
}

export function portName(part, def) {
  if (!def) return '?';
  if (!PART_TYPES[part.type]?.hub) return def.label || KINDS[def.kind]?.label || def.id;
  const n = def.id.match(/\d+$/)?.[0];
  return {
    power: 'XT30 power',
    motor: `Motor ${n}`,
    encoder: `Encoder ${n}`,
    servo: `Servo ${n}`,
    rs485: 'RS485',
    i2c: `I²C bus ${n}`,
    digital: `Digital ${def.label.slice(2)}`,
    analog: `Analog ${def.label.slice(2)}`,
    usb: 'USB',
  }[def.kind];
}

// The team's diagram to start from (their drawing from October 2026).
export function defaultDiagram() {
  const parts = [
    { id: 'bat', type: 'battery', x: 40, y: 30, label: 'Battery', side: 'right' },
    { id: 'sw', type: 'switch', x: 230, y: 30, label: 'Power switch' },
    { id: 'ch', type: 'controlHub', x: 440, y: 110, label: 'Control Hub' },
    { id: 'eh', type: 'expansionHub', x: 440, y: 680, label: 'Expansion Hub' },
    { id: 'fl', type: 'motor', x: 160, y: 150, label: 'Front Left Wheel' },
    { id: 'fr', type: 'motor', x: 160, y: 210, label: 'Front Right Wheel' },
    { id: 'bl', type: 'motor', x: 160, y: 270, label: 'Back Left Wheel' },
    { id: 'br', type: 'motor', x: 160, y: 330, label: 'Back Right Wheel' },
    { id: 'wm', type: 'servo', x: 420, y: 520, label: 'Windmill', side: 'top' },
    { id: 'li', type: 'servo', x: 590, y: 520, label: 'Left intake', side: 'top' },
    { id: 'mi', type: 'motor', x: 160, y: 765, label: 'Main Intake' },
    { id: 'fw', type: 'motor', x: 160, y: 830, label: 'Flywheel' },
    { id: 'ri', type: 'servo', x: 480, y: 1090, label: 'Right intake', side: 'top' },
  ];
  const wires = [
    ['bat', 'out', 'sw', 'in'],
    ['sw', 'out', 'ch', 'pwr0'],
    ['ch', 'pwr1', 'eh', 'pwr0'],
    ['ch', 'rs485', 'eh', 'rs485'],
    ['fl', 'pwr', 'ch', 'm0'],
    ['fr', 'pwr', 'ch', 'm1'],
    ['bl', 'pwr', 'ch', 'm2'],
    ['br', 'pwr', 'ch', 'm3'],
    ['wm', 'sig', 'ch', 's0'],
    ['li', 'sig', 'ch', 's1'],
    ['mi', 'pwr', 'eh', 'm0'],
    ['fw', 'pwr', 'eh', 'm1'],
    ['ri', 'sig', 'eh', 's0'],
  ].map(([a, ap, b, bp], i) => ({ id: `w${i}`, from: [a, ap], to: [b, bp] }));
  return { parts, wires };
}

// Everything's bounding box, for "fit" and the preview.
export function bounds(parts, pad = 40) {
  if (!parts.length) return { x: 0, y: 0, w: 800, h: 600 };
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of parts) {
    const { w, h } = partSize(p);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + w);
    y1 = Math.max(y1, p.y + h);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}
