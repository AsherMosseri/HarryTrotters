// Wiring puzzle (G3): "which port?" questions on the Control Hub and
// Expansion Hub, using the same port ids and names as the app's hub drawings
// (src/electrical.js: m0-m3, e0-e3, s0-s5, i2c0-i2c3, d01/d23/d45/d67,
// a01/a23, rs485, pwr0/pwr1, and usb on the Control Hub only). A question
// lists every port that would be right in `ports` (for tapping the hub
// picture) and offers four port names as choices with exactly one right.
import { shuffle } from './util.js';

const KIND_IDS = {
  motor: ['m0', 'm1', 'm2', 'm3'],
  encoder: ['e0', 'e1', 'e2', 'e3'],
  servo: ['s0', 's1', 's2', 's3', 's4', 's5'],
  i2c: ['i2c0', 'i2c1', 'i2c2', 'i2c3'],
  digital: ['d01', 'd23', 'd45', 'd67'],
  analog: ['a01', 'a23'],
  rs485: ['rs485'],
  power: ['pwr0', 'pwr1'],
  usb: ['usb'],
};
export const HUBS = {
  controlHub: { name: 'Control Hub', ports: Object.values(KIND_IDS).flat() },
  expansionHub: { name: 'Expansion Hub', ports: Object.values(KIND_IDS).flat().filter((p) => p !== 'usb') },
};
const kindOf = (id) => Object.keys(KIND_IDS).find((k) => KIND_IDS[k].includes(id));

// The name the app shows for a port (portName in src/electrical.js).
export function portLabel(id) {
  const n = id.match(/\d+$/)?.[0];
  switch (kindOf(id)) {
    case 'motor': return `Motor ${n}`;
    case 'encoder': return `Encoder ${n}`;
    case 'servo': return `Servo ${n}`;
    case 'i2c': return `I²C bus ${n}`;
    case 'digital': return `Digital ${id[1]}-${id[2]}`;
    case 'analog': return `Analog ${id[1]}-${id[2]}`;
    case 'rs485': return 'RS485';
    case 'power': return 'XT30 power';
    case 'usb': return 'USB';
  }
  return id;
}

// Choices: one right port plus three wrong ones (never two of the same name).
function build(id, difficulty, hub, prompt, right, wrongPool, accepted, explain, device) {
  const wrong = [];
  for (const p of shuffle(wrongPool, id)) {
    if (accepted.includes(p) || !HUBS[hub].ports.includes(p)) continue;
    const label = portLabel(p);
    if (label === portLabel(right) || wrong.some((w) => portLabel(w) === label)) continue;
    wrong.push(p);
    if (wrong.length === 3) break;
  }
  const choices = shuffle([right, ...wrong], `${id}-c`).map(portLabel);
  return { id, bank: 'wiring', kind: 'choice', difficulty, hub, device, prompt, choices, answer: choices.indexOf(portLabel(right)), ports: accepted, explain };
}

const HUB_KEYS = ['controlHub', 'expansionHub'];
const MOTOR_NAMES = ['frontLeft', 'arm', 'lift', 'intake', 'flywheel', 'backRight', 'slide', 'hang'];
const SERVO_NAMES = ['claw', 'wrist', 'gate', 'pivot', 'kicker', 'turret', 'bucket', 'latch', 'pusher', 'flap', 'stopper', 'tilt'];
const all = (...kinds) => kinds.flatMap((k) => KIND_IDS[k]);

const out = [];
// Motor power by configuration.
HUB_KEYS.forEach((hub, h) =>
  [0, 1, 2, 3].forEach((n) => {
    const name = MOTOR_NAMES[h * 4 + n];
    out.push(build(`w-motor-${hub}-${n}`, 1, hub, `The configuration says "${name}" is a motor on the ${HUBS[hub].name}, port ${n}. Where does its power cable plug in?`, `m${n}`, [...all('motor', 'encoder', 'servo')], [`m${n}`], `Motor port ${n} carries the power for the motor configured on port ${n}.`, 'motor'));
  }),
);
// Encoders follow their motor's port number.
HUB_KEYS.forEach((hub, h) =>
  [0, 1, 2, 3].forEach((n) => {
    const name = MOTOR_NAMES[7 - (h * 4 + n)];
    out.push(build(`w-enc-${hub}-${n}`, 2, hub, `"${name}" runs on ${HUBS[hub].name} motor port ${n} and uses RUN_TO_POSITION. Where does its encoder cable plug in?`, `e${n}`, [...all('encoder', 'motor', 'i2c', 'digital')], [`e${n}`], `The SDK reads motor ${n}'s position from encoder port ${n}, so the encoder goes in the matching port.`, 'motor'));
  }),
);
// Servos by configuration.
HUB_KEYS.forEach((hub, h) =>
  [0, 1, 2, 3, 4, 5].forEach((n) => {
    const name = SERVO_NAMES[h * 6 + n];
    out.push(build(`w-servo-${hub}-${n}`, 1, hub, `The "${name}" servo is configured on the ${HUBS[hub].name}, servo port ${n}. Where does it plug in?`, `s${n}`, [...all('servo', 'motor', 'digital')], [`s${n}`], `Servo port ${n} is the 3-pin port configured as servo ${n}.`, 'servo'));
  }),
);
// Devices by kind of port: any port of the right kind is right.
const DEVICES = [
  ['color', 'a REV Color Sensor V3', 'i2c', 'i2cSensor', 'It talks over I²C, so it goes on an I²C bus port.'],
  ['distance', 'a REV 2m Distance Sensor', 'i2c', 'i2cSensor', 'It is an I²C sensor, so it goes on an I²C bus port.'],
  ['pinpoint', 'a goBILDA Pinpoint odometry computer', 'i2c', 'i2cSensor', 'Pinpoint reports position over I²C.'],
  ['touch', 'a REV Touch Sensor', 'digital', 'digitalSensor', 'A touch sensor is on or off: a digital port.'],
  ['magnet', 'a REV Magnetic Limit Switch', 'digital', 'digitalSensor', 'A limit switch is a digital on/off sensor.'],
  ['pot', 'a REV Potentiometer', 'analog', 'analogSensor', 'A potentiometer outputs a voltage, read on an analog port.'],
  ['tbe', 'a REV Through Bore Encoder (incremental signal)', 'encoder', 'odometry', 'Hubs only read incremental encoders on the motor encoder ports.'],
  ['deadwheel', 'a dead-wheel odometry pod\'s encoder', 'encoder', 'odometry', 'A dead wheel is an encoder, so it uses an encoder port (one not needed by a motor).'],
  ['blinkin', 'a REV Blinkin LED Driver', 'servo', 'led', 'Blinkin takes a servo (PWM) signal, so it plugs into a servo port.'],
  ['sparkmini', 'a REV SPARKmini motor controller\'s signal', 'servo', 'led', 'SPARKmini is controlled by a servo (PWM) signal.'],
  ['srs', 'a REV Smart Robot Servo', 'servo', 'servo', 'A servo goes on a servo port.'],
  ['gbservo', 'a goBILDA Dual Mode Servo', 'servo', 'servo', 'A servo goes on a servo port.'],
];
for (const hub of HUB_KEYS) {
  for (const [key, name, kind, device, why] of DEVICES) {
    const ids = KIND_IDS[kind];
    const right = shuffle(ids, `${key}-${hub}`)[0];
    const pool = Object.keys(KIND_IDS).filter((k) => k !== kind && k !== 'power' && k !== 'rs485').flatMap((k) => KIND_IDS[k]);
    out.push(build(`w-dev-${key}-${hub}`, 2, hub, `Which ${HUBS[hub].name} port can ${name} plug into?`, right, pool, ids, why, device));
  }
}
// Digital and analog channels: each connector carries two channels.
for (const hub of HUB_KEYS) {
  for (let ch = 0; ch < 8; ch++) {
    const id = KIND_IDS.digital[Math.floor(ch / 2)];
    out.push(build(`w-dch-${hub}-${ch}`, 3, hub, `A digital sensor is configured on the ${HUBS[hub].name}, digital channel ${ch}. Which connector is that?`, id, [...all('digital', 'analog')], [id], `Each digital connector holds two channels: ${portLabel(id)} has channels ${id[1]} and ${id[2]}.`, 'digitalSensor'));
  }
  for (let ch = 0; ch < 4; ch++) {
    const id = KIND_IDS.analog[Math.floor(ch / 2)];
    out.push(build(`w-ach-${hub}-${ch}`, 3, hub, `An analog sensor is configured on the ${HUBS[hub].name}, analog channel ${ch}. Which connector is that?`, id, [...all('analog', 'digital')], [id], `Each analog connector holds two channels: ${portLabel(id)} has channels ${id[1]} and ${id[2]}.`, 'analogSensor'));
  }
  for (let bus = 0; bus < 4; bus++) {
    const id = `i2c${bus}`;
    out.push(build(`w-i2c-${hub}-${bus}`, 2, hub, `An I²C sensor is configured on the ${HUBS[hub].name}, I²C bus ${bus}. Where does it plug in?`, id, [...all('i2c', 'digital', 'analog')], [id], `Each I²C port is its own bus; this one is bus ${bus}.`, 'i2cSensor'));
  }
}
// The power and hub links.
out.push(
  build('w-sys-battery', 1, 'controlHub', 'The power switch\'s output cable goes to the Control Hub. Which port?', 'pwr0', all('rs485', 'usb', 'motor', 'servo'), ['pwr0', 'pwr1'], 'Battery power comes in on an XT30 port (through the main power switch).', 'switch'),
  build('w-sys-eh-power', 2, 'expansionHub', 'The Expansion Hub gets 12V from the Control Hub\'s second XT30 port. Where does that cable plug into the Expansion Hub?', 'pwr0', all('rs485', 'motor', 'servo', 'analog'), ['pwr0', 'pwr1'], 'Hubs are powered only through their XT30 connectors (R608), and they can be daisy-chained.', 'controlHub'),
  build('w-sys-rs485-ch', 2, 'controlHub', 'Connect the Expansion Hub so the Control Hub can talk to it. Which Control Hub port takes the data cable?', 'rs485', all('i2c', 'digital', 'usb', 'power'), ['rs485'], 'The hubs talk over RS485 with a JST PH 3-pin cable.', 'expansionHub'),
  build('w-sys-rs485-eh', 2, 'expansionHub', 'On the Expansion Hub, where does the data cable from the Control Hub plug in?', 'rs485', all('i2c', 'digital', 'power'), ['rs485'], 'The hubs talk over RS485 with a JST PH 3-pin cable.', 'controlHub'),
  build('w-sys-webcam', 1, 'controlHub', 'Where does a UVC webcam plug into the Control Hub?', 'usb', all('i2c', 'digital', 'servo', 'rs485'), ['usb'], 'Webcams use USB (R707 allows webcams over USB).', 'camera'),
  build('w-sys-imu', 3, 'controlHub', 'The Control Hub\'s built-in IMU shows up in the configuration on which I²C bus?', 'i2c0', all('i2c'), ['i2c0'], 'The built-in IMU is on I²C bus 0, so external sensors are often put on buses 1 to 3.', 'controlHub'),
);

export const WIRING = out;
