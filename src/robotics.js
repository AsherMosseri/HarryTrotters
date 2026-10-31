// Reference data and calculators for the robotics slash commands (/ticks,
// /gear, /speed, /wire, /convert, /ohm, /calc, /java, /explain, /tip…).
// Game facts cite the 2026-27 Competition Manual (BIOBUZZ, TU07) by section
// and PDF page, the same way the question banks do.

export const MANUAL_NAME = '2026-27 Competition Manual (TU07)';

// ---------- motors ----------

// goBILDA Yellow Jacket planetary motors (5203 series): free speed at 12 V,
// gearbox, encoder counts per output turn (28 at the motor, times the ratio).
export const YELLOW_JACKET = [
  { rpm: 6000, ratio: '1:1', ticks: 28 },
  { rpm: 1620, ratio: '3.7:1', ticks: 103.8 },
  { rpm: 1150, ratio: '5.2:1', ticks: 145.1 },
  { rpm: 435, ratio: '13.7:1', ticks: 384.5 },
  { rpm: 312, ratio: '19.2:1', ticks: 537.7 },
  { rpm: 223, ratio: '26.9:1', ticks: 751.8 },
  { rpm: 117, ratio: '50.9:1', ticks: 1425.1 },
  { rpm: 84, ratio: '71.2:1', ticks: 1993.6 },
  { rpm: 60, ratio: '99.5:1', ticks: 2786.2 },
  { rpm: 43, ratio: '139:1', ticks: 3895.9 },
  { rpm: 30, ratio: '188:1', ticks: 5281.1 },
];
// REV motors. HD Hex: 6000 RPM and 28 counts per motor turn; UltraPlanetary
// cartridges are sold as 3:1, 4:1 and 5:1 but are really 84/29, 76/21, 68/13.
// The older HD Hex gearboxes are a true 20:1 and 40:1. Core Hex: 125 RPM, 288
// counts per output turn.
export const REV = [
  { name: 'REV HD Hex, bare', rpm: 6000, ticks: 28 },
  { name: 'REV HD Hex, 20:1 gearbox', rpm: 300, ticks: 560 },
  { name: 'REV HD Hex, 40:1 gearbox', rpm: 150, ticks: 1120 },
  { name: 'REV Core Hex', rpm: 125, ticks: 288 },
];
export const ULTRA = { 3: 84 / 29, 4: 76 / 21, 5: 68 / 13 };

// "312", "435rpm", "yj 117" → a Yellow Jacket; "core", "hd 40" → REV; or null.
export function findMotor(text) {
  const t = String(text || '').toLowerCase();
  if (/core/.test(t)) return { ...REV[3] };
  if (/hd|ultra|rev/.test(t)) {
    // UltraPlanetary stacks: "hd 3 4" = 3:1 + 4:1 cartridges.
    const carts = (t.match(/\b[345]\b(?=:1|\b)/g) || []).filter((c) => ULTRA[c]);
    if (/\b40\b/.test(t)) return { ...REV[2] };
    if (/\b20\b/.test(t)) return { ...REV[1] };
    if (carts.length) {
      const ratio = carts.reduce((r, c) => r * ULTRA[c], 1);
      return { name: `REV HD Hex + UltraPlanetary ${carts.map((c) => `${c}:1`).join(' + ')}`, rpm: 6000 / ratio, ticks: 28 * ratio };
    }
    return { ...REV[0] };
  }
  const n = +(/(\d{2,4})\s*(rpm)?/.exec(t)?.[1] || 0);
  const yj = YELLOW_JACKET.find((m) => m.rpm === n);
  return yj ? { name: `goBILDA Yellow Jacket ${yj.rpm} RPM (${yj.ratio})`, rpm: yj.rpm, ticks: yj.ticks } : null;
}

// "96mm", "4in", "104 mm", "3.78\"" → wheel diameter in mm.
export function parseLength(text) {
  const m = /(\d+(?:\.\d+)?)\s*(mm|cm|in|inch|inches|"|”)/i.exec(String(text || ''));
  if (!m) return null;
  const n = +m[1];
  const u = m[2].toLowerCase();
  return u === 'mm' ? n : u === 'cm' ? n * 10 : n * 25.4;
}

export const round = (n, places = 1) => {
  const k = 10 ** places;
  return Math.round(n * k) / k;
};

// Surface speed of a wheel: { inPerS, ftPerS, mPerS, fieldS } (fieldS: seconds to cross the 144 in. FIELD).
export function wheelSpeed(rpm, mm) {
  const inPerS = ((rpm / 60) * Math.PI * mm) / 25.4;
  return { inPerS, ftPerS: inPerS / 12, mPerS: inPerS * 0.0254, fieldS: 144 / inPerS };
}

// "2:1", "20 40", "20t 60t" → { ratio (output turns slower by), text }.
export function parseRatio(text) {
  const t = String(text || '');
  const colon = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/.exec(t);
  if (colon) return { ratio: +colon[1] / +colon[2], text: `${colon[1]}:${colon[2]}` };
  const teeth = /(\d+)\s*t?\s+(?:to\s+)?(\d+)\s*t\b/i.exec(t) || /(\d+)t\s*(?:->|→|to)?\s*(\d+)t/i.exec(t);
  if (teeth) return { ratio: +teeth[2] / +teeth[1], text: `${teeth[1]}T driving ${teeth[2]}T`, driver: +teeth[1], driven: +teeth[2] };
  return null;
}

// ---------- wire ----------

// Copper wire by AWG: diameter (mm) and resistance (ohms per 1000 ft), from
// the standard AWG table.
export const AWG = {
  12: { mm: 2.053, ohm: 1.588 },
  14: { mm: 1.628, ohm: 2.525 },
  16: { mm: 1.291, ohm: 4.016 },
  18: { mm: 1.024, ohm: 6.385 },
  20: { mm: 0.812, ohm: 10.15 },
  22: { mm: 0.644, ohm: 16.14 },
  24: { mm: 0.511, ohm: 25.67 },
  26: { mm: 0.405, ohm: 40.81 },
  28: { mm: 0.321, ohm: 64.9 },
};
// Table 12-8 (R609, pp. 134-135): the smallest wire allowed for each use.
export const WIRE_RULES = [
  ['12V main battery power', 18],
  ['Motor power (unless listed below)', 18],
  ['Circuits on an 11-20A fuse', 18],
  ['Motor power: TETRIX MAX 12V DC, REV Core Hex', 22],
  ['PWM / servo', 22],
  ['LEDs (5V / 12V)', 22],
  ['Circuits on a fuse of 10A or less', 22],
  ['Signal (≤1A: I2C, digital, analog, encoder, RS485)', 28],
];

// ---------- units ----------

// Each unit as a multiple of its kind's base unit (m, kg, N·m, m/s, rad, W, s).
const UNITS = {
  length: {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    km: 1000,
    in: 0.0254,
    inch: 0.0254,
    inches: 0.0254,
    '"': 0.0254,
    ft: 0.3048,
    feet: 0.3048,
    foot: 0.3048,
    yd: 0.9144,
    mi: 1609.344,
    tile: 0.6096,
    tiles: 0.6096,
  },
  mass: { g: 0.001, kg: 1, lb: 0.45359237, lbs: 0.45359237, oz: 0.028349523125 },
  torque: {
    nm: 1,
    'n-m': 1,
    'n·m': 1,
    kgcm: 0.0980665,
    'kg-cm': 0.0980665,
    'kgf-cm': 0.0980665,
    ozin: 0.0070615518,
    'oz-in': 0.0070615518,
    inlb: 0.112984829,
    'in-lb': 0.112984829,
    ftlb: 1.35581795,
    'ft-lb': 1.35581795,
  },
  speed: { 'm/s': 1, 'ft/s': 0.3048, 'in/s': 0.0254, mph: 0.44704, 'km/h': 1 / 3.6, kph: 1 / 3.6 },
  angle: { deg: Math.PI / 180, degrees: Math.PI / 180, rad: 1, radians: 1, rev: 2 * Math.PI, revs: 2 * Math.PI, rotations: 2 * Math.PI },
  power: { w: 1, kw: 1000, hp: 745.699872 },
  time: { ms: 0.001, s: 1, sec: 1, min: 60, h: 3600, hr: 3600 },
  current: { ma: 0.001, a: 1 },
  charge: { mah: 3.6, ah: 3600 },
};
const kindOf = (u) => Object.keys(UNITS).find((k) => UNITS[k][u] != null);
const TEMP = { c: 'C', f: 'F', k: 'K' };

// "10 in to mm", "5 kg-cm in nm", "70 f to c" → { value, from, to, result } or { error }.
export function convert(text) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*([a-z"°·/-]+)\s+(?:to|in|->|→)\s+([a-z"°·/-]+)\s*$/i.exec(String(text || ''));
  if (!m) return { error: 'Try: /convert 10 in to mm · /convert 5 kg-cm to oz-in · /convert 72 f to c' };
  const value = +m[1];
  const from = m[2].toLowerCase().replace('°', '');
  const to = m[3].toLowerCase().replace('°', '');
  if (TEMP[from] && TEMP[to]) {
    const c = from === 'c' ? value : from === 'f' ? ((value - 32) * 5) / 9 : value - 273.15;
    const result = to === 'c' ? c : to === 'f' ? (c * 9) / 5 + 32 : c + 273.15;
    return { value, from: `°${TEMP[from]}`, to: `°${TEMP[to]}`, result };
  }
  const kf = kindOf(from);
  const kt = kindOf(to);
  if (!kf || !kt) return { error: `I don’t know “${!kf ? m[2] : m[3]}”.` };
  if (kf !== kt) return { error: `Can’t turn ${kf} into ${kt}.` };
  return { value, from: m[2], to: m[3], result: (value * UNITS[kf][from]) / UNITS[kt][to], kind: kf };
}

// ---------- a small calculator ----------

// + - * / ^ ( ), sqrt, sin cos tan (degrees), asin acos atan (degrees out),
// abs, log (base 10), ln, round, pi, e. No eval.
export function calc(text) {
  const src = String(text || '')
    .toLowerCase()
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi');
  const tokens = src.match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?|[a-z]+|[-+*/^(),%]/g);
  if (!tokens || tokens.join('') !== src.replace(/\s+/g, '')) return { error: 'Use numbers, + - * / ^ ( ), and sqrt, sin, cos, tan, pi.' };
  let i = 0;
  const peek = () => tokens[i];
  const take = (t) => (tokens[i] === t ? (i++, true) : false);
  const D = Math.PI / 180;
  const FN = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    sin: (x) => Math.sin(x * D),
    cos: (x) => Math.cos(x * D),
    tan: (x) => Math.tan(x * D),
    asin: (x) => Math.asin(x) / D,
    acos: (x) => Math.acos(x) / D,
    atan: (x) => Math.atan(x) / D,
    log: Math.log10,
    ln: Math.log,
    round: Math.round,
  };
  const CONST = { pi: Math.PI, e: Math.E };
  const expr = () => {
    let v = term();
    for (;;) {
      if (take('+')) v += term();
      else if (take('-')) v -= term();
      else return v;
    }
  };
  const term = () => {
    let v = power();
    for (;;) {
      if (take('*')) v *= power();
      else if (take('/')) v /= power();
      else if (take('%')) v %= power();
      else return v;
    }
  };
  const power = () => {
    const b = unary();
    return take('^') ? b ** power() : b;
  };
  const unary = () => (take('-') ? -unary() : take('+') ? unary() : atom());
  const atom = () => {
    const t = peek();
    if (t == null) throw new Error('end');
    if (take('(')) {
      const v = expr();
      if (!take(')')) throw new Error(')');
      return v;
    }
    if (/^\d/.test(t)) {
      i++;
      return +t;
    }
    if (CONST[t] != null) {
      i++;
      return CONST[t];
    }
    if (FN[t]) {
      i++;
      if (!take('(')) throw new Error('(');
      const v = expr();
      if (!take(')')) throw new Error(')');
      return FN[t](v);
    }
    throw new Error(t);
  };
  try {
    const v = expr();
    if (i !== tokens.length || !Number.isFinite(v)) return { error: 'That doesn’t work out to a number.' };
    return { value: v };
  } catch {
    return { error: 'I couldn’t read that. Try: /calc 2*pi*48 or /calc sqrt(3^2+4^2)' };
  }
}
export const nice = (n) => (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(4) : String(round(n, 4)));

// ---------- text fun ----------

export const MORSE = {
  a: '.-',
  b: '-...',
  c: '-.-.',
  d: '-..',
  e: '.',
  f: '..-.',
  g: '--.',
  h: '....',
  i: '..',
  j: '.---',
  k: '-.-',
  l: '.-..',
  m: '--',
  n: '-.',
  o: '---',
  p: '.--.',
  q: '--.-',
  r: '.-.',
  s: '...',
  t: '-',
  u: '..-',
  v: '...-',
  w: '.--',
  x: '-..-',
  y: '-.--',
  z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '!': '-.-.--',
  '/': '-..-.',
  '-': '-....-',
  '(': '-.--.',
  ')': '-.--.-',
  '@': '.--.-.',
};
const FROM_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
export function morse(text) {
  const t = text.trim();
  if (/^[.\-\s/]+$/.test(t))
    return t
      .split(/\s*\/\s*|\s{3,}/)
      .map((w) =>
        w
          .split(/\s+/)
          .map((c) => FROM_MORSE[c] || '?')
          .join(''),
      )
      .join(' ')
      .toUpperCase();
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w) =>
      [...w]
        .map((c) => MORSE[c])
        .filter(Boolean)
        .join(' '),
    )
    .join(' / ');
}
export function binary(text) {
  const t = text.trim();
  if (/^[01\s]+$/.test(t) && t.replace(/\s/g, '').length % 8 === 0)
    return new TextDecoder().decode(
      new Uint8Array(
        t
          .replace(/\s/g, '')
          .match(/.{8}/g)
          .map((b) => parseInt(b, 2)),
      ),
    );
  return [...new TextEncoder().encode(t)].map((b) => b.toString(2).padStart(8, '0')).join(' ');
}
const FLIP = {
  a: 'ɐ',
  b: 'q',
  c: 'ɔ',
  d: 'p',
  e: 'ǝ',
  f: 'ɟ',
  g: 'ƃ',
  h: 'ɥ',
  i: 'ᴉ',
  j: 'ɾ',
  k: 'ʞ',
  l: 'l',
  m: 'ɯ',
  n: 'u',
  o: 'o',
  p: 'd',
  q: 'b',
  r: 'ɹ',
  s: 's',
  t: 'ʇ',
  u: 'n',
  v: 'ʌ',
  w: 'ʍ',
  x: 'x',
  y: 'ʎ',
  z: 'z',
  1: 'Ɩ',
  2: 'ᄅ',
  3: 'Ɛ',
  4: 'ㄣ',
  5: 'ϛ',
  6: '9',
  7: 'ㄥ',
  8: '8',
  9: '6',
  0: '0',
  '.': '˙',
  ',': "'",
  '?': '¿',
  '!': '¡',
  "'": ',',
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '<': '>',
  '>': '<',
  _: '‾',
};
export const upsideDown = (text) =>
  [...text.toLowerCase()]
    .map((c) => FLIP[c] ?? c)
    .reverse()
    .join('');
export const reverse = (text) => [...text].reverse().join('');

// ---------- the game (BIOBUZZ) ----------

export const SCORING = {
  cite: 'Section 10.5.5, Tables 10-2 and 10-3, p. 89',
  rows: [
    ['LEAVE', '3 (AUTO)'],
    ['PARK', '5 in AUTO, 5 in TELEOP'],
    ['HIVE TIP', '20 in AUTO, 20 in TELEOP'],
    ['POLLEN / NECTAR left in a CELL', '2 (TELEOP)'],
    ['Bottom NECTAR bonus', '5 (TELEOP)'],
    ['POLLEN / NECTAR in an owned FLOWER', '2 (TELEOP)'],
    ['POLLEN / NECTAR in the GARDEN', '1 (TELEOP)'],
  ],
  rp: [
    ['SWARM RP', 'LEAVE + PARK points ≥ 16', '1 RP'],
    ['POLLINATOR 1 RP', '4 TIPS or more', '1 RP'],
    ['POLLINATOR 2 RP', '7 TIPS or more', '1 RP'],
    ['Win', 'more MATCH points', '3 RP'],
    ['Tie', 'same MATCH points', '1 RP'],
  ],
  note: 'RP thresholds are for most events; Regional Championships and the FIRST Championship announce theirs in Team Updates.',
};
export const MATCH_TIMES = {
  cite: 'Section 10.4, p. 83 (and MATCH in the Glossary, p. 169)',
  rows: [
    ['AUTO', '30 seconds, robots run on their own (no driver input)'],
    ['Transition', '8 seconds between AUTO and TELEOP: no powered movement (G403)'],
    ['TELEOP', '2 minutes (2:00), drivers in control'],
    ['Whole MATCH', '2:38 of play'],
  ],
};
export const PENALTIES = {
  cite: 'Section 10.6, Table 10-4, p. 90; 10.6.1, p. 91',
  rows: [
    ['MINOR FOUL', '5 points to the other alliance'],
    ['MAJOR FOUL', '20 points to the other alliance'],
    ['YELLOW CARD', 'a warning; a second one in the same tournament phase becomes a RED CARD'],
    ['RED CARD', 'DISQUALIFIED for that MATCH'],
    ['DISABLED', 'the REFEREE has the team stop the robot for the rest of the MATCH'],
    ['DISQUALIFIED', '0 MATCH points and 0 RANKING POINTS (in playoffs: the alliance gets 0)'],
  ],
};
export const SIZE = {
  rows: [
    ['Start (R102, p. 119)', '18 in. × 18 in. × 18 in. (45.7 cm cube); pre-loaded SCORING ELEMENTS may stick out'],
    ['After the start (R105, p. 120)', 'always inside 18 in. × 24 in. × 29 in. tall, fully expanded, limited by hardware (not software)'],
    ['Weight (R104, p. 119)', 'no weight limit'],
    ['One assembly (R105)', 'no designs that deliberately drop parts'],
  ],
};
export const MOTOR_RULES = {
  rows: [
    ['How many (R503, p. 131)', 'at most 8 motors and 8 servos, counting every configuration'],
    [
      'Which motors (R501, p. 129)',
      'only the listed 12V DC motors: goBILDA Yellow Jacket 5201-5204 and 5000 series, REV HD Hex and Core Hex, AndyMark NeveRest, TETRIX MAX and TorqueNADO, Studica Maverick, NFR Yuksel, SWYFT Spike, WATTOS Stingray',
    ],
    ['Servos (R502, p. 130)', 'at most 8 W of output power and 4 A stall current at 6V (linear servos: 1 A)'],
    ['Changes (R504, p. 131)', 'don’t modify actuators unless the rules say you can'],
    ['Power (R505, p. 131)', 'every actuator is controlled and powered through approved devices'],
  ],
};
export const BATTERY = {
  rows: [
    [
      'The rule (R601, p. 132)',
      'exactly 1 approved 12V NiMH main battery, unaltered except the fuse (a COTS 20A ATM mini blade) and the connector',
    ],
    [
      'Allowed packs',
      'AndyMark am-5290, goBILDA 3100-0012-0020, Matrix 14-0014, REV REV-31-1302, Studica 70025, TETRIX W39057, WATTOS WT-NMH1230',
    ],
    ['Main switch (R603, p. 132)', 'the battery connects through the Main Power Switch'],
    ['Cells', '10 NiMH cells × 1.2 V = 12 V nominal'],
  ],
  // Rules of thumb, not rules: resting voltage after a few minutes off the charger.
  levels: [
    ['13.5 V and up', 'freshly charged'],
    ['about 12.8–13.4 V', 'good for a match'],
    ['about 12.3–12.7 V', 'getting low: practice only'],
    ['under 12.3 V', 'swap it and charge it'],
  ],
  tip: 'Voltage at rest doesn’t show how a pack holds up under load; a load tester (like a Battery Beak) or the Driver Station’s robot voltage during a match tells you more.',
};
export const AWARDS = [
  ['Inspire', 'a strong role model for all FIRST programs and top contender for many judged awards', '6.3.1, p. 51'],
  ['Think', 'an excellent PORTFOLIO: a clear record of the engineering journey', '6.3.2, p. 52'],
  ['Connect', 'meaningful partnerships with the STEM community', '6.3.3, p. 52'],
  ['Reach', 'introducing and recruiting new people into FIRST', '6.3.4, p. 53'],
  ['Sustain', 'the leadership, resources and practices to keep the team going and growing', '6.3.5, p. 53'],
  ['Innovate (sponsored by RTX)', 'a creative, original design for the robot or a mechanism', '6.3.6, p. 54'],
  ['Control', 'creative use of sensors and software (like autonomous)', '6.3.7, p. 54'],
  ['Design', 'industrial design: form, function and appearance', '6.3.8, p. 54'],
  ['Judges’ Choice', 'optional; a team whose efforts don’t fit another award', '6.3.9, p. 55'],
  ['Winning and Finalist Alliance', 'the alliances in the last playoff match', '6.4, p. 55'],
  ['FIRST Leadership Award', 'individual student leadership', '6.5.1, p. 56'],
  ['Compass Award', 'an adult coach or mentor (optional; Regional Championship level)', '6.5.2, p. 56'],
];
