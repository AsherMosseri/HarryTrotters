// Gear ratio challenge (G6): questions generated from real motor speeds and
// wheel sizes. Every question comes from a numbered spot in a fixed space of
// templates x parameters, so a seed always gives the same question and the
// picker can walk the whole space without repeats.
import { round, shuffle } from './util.js';

// goBILDA Yellow Jacket planetary gear motors (5203 series): free speed at
// 12V, gearbox ratio, and encoder counts per output turn (28 at the motor).
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
// REV HD Hex: 6000 RPM free speed, 28 counts per motor turn. UltraPlanetary
// cartridges are sold as 3:1, 4:1 and 5:1; their actual ratios are below.
export const HD_HEX = { rpm: 6000, ticks: 28 };
export const CARTRIDGES = [
  { name: '3:1', actual: 84 / 29 },
  { name: '4:1', actual: 76 / 21 },
  { name: '5:1', actual: 68 / 13 },
];
// REV Core Hex: 125 RPM free speed, 288 counts per output turn.
export const CORE_HEX = { rpm: 125, ticks: 288 };
export const WHEELS = [
  { mm: 96, name: '96 mm mecanum' },
  { mm: 104, name: '104 mm mecanum' },
  { mm: 140, name: '140 mm' },
];
const MM_PER_IN = 25.4;
const yj = (m) => `${m.rpm} RPM goBILDA Yellow Jacket`;

// Number choices: the answer plus common mistakes, all rounded the same way;
// mistakes that round to the answer (or to each other) are replaced by
// simple offsets so there are always 4 different choices.
function numChoices(answer, mistakes, places, unit) {
  const fmt = (n) => `${round(n, places)}${unit}`;
  const right = fmt(answer);
  const out = [right];
  const tryAdd = (n) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const s = fmt(n);
    if (!out.includes(s) && out.length < 4) out.push(s);
  };
  mistakes.forEach(tryAdd);
  [1.25, 0.8, 1.5, 0.5, 2, 0.67, 3, 1.1, 0.9].forEach((k) => tryAdd(answer * k));
  return out;
}

function q(id, difficulty, prompt, answer, mistakes, places, unit, explain) {
  const choices = numChoices(answer, mistakes, places, unit);
  // Numbers read best in order; the right one is wherever it falls.
  const sorted = [...choices].sort((a, b) => parseFloat(a) - parseFloat(b));
  return { id, bank: 'gear', kind: 'choice', difficulty, prompt, choices: sorted, answer: sorted.indexOf(choices[0]), explain };
}

// Each template: a list of parameter sets and a function making the question.
const PAIRS = [[12, 24], [15, 45], [20, 40], [16, 48], [30, 15], [24, 12], [20, 60], [36, 12], [14, 28], [20, 30]];
const REDUCTIONS = [1.5, 2, 3, 4, 5];
const STAGES = [[2, 3], [3, 2], [2, 2], [1.5, 2], [4, 2], [3, 3]];
const DISTANCES = [12, 18, 24, 36, 48];
const TORQUES = [5, 8, 12, 18.7, 24.3, 38, 68.4];
const cross = (...lists) => lists.reduce((acc, l) => acc.flatMap((a) => l.map((b) => [...a, b])), [[]]);
const combos = [];
for (let a = 0; a < 3; a++) {
  combos.push([a]);
  for (let b = a; b < 3; b++) {
    combos.push([a, b]);
    for (let c = b; c < 3; c++) combos.push([a, b, c]);
  }
}

const TEMPLATES = [
  {
    key: 'teeth',
    params: cross(YELLOW_JACKET, PAIRS),
    make: ([m, [a, b]]) => {
      const out = (m.rpm * a) / b;
      const kind = b > a ? 'reduction' : 'speed-up';
      return [
        1,
        `A ${yj(m)} turns a ${a}-tooth gear that drives a ${b}-tooth gear. How fast does the ${b}-tooth gear turn?`,
        out,
        [(m.rpm * b) / a, m.rpm, m.rpm * (b - a) / b],
        1,
        ' RPM',
        `Speed scales by driver teeth / driven teeth: ${m.rpm} x ${a}/${b} = ${round(out)} RPM (a ${kind}).`,
      ];
    },
  },
  {
    key: 'reduce',
    params: cross(YELLOW_JACKET, REDUCTIONS),
    make: ([m, r]) => [
      1,
      `${m.rpm} RPM through a ${r}:1 reduction: what is the output speed?`,
      m.rpm / r,
      [m.rpm * r, m.rpm - r, m.rpm / (r + 1)],
      1,
      ' RPM',
      `A ${r}:1 reduction divides speed by ${r}: ${m.rpm} / ${r} = ${round(m.rpm / r)} RPM.`,
    ],
  },
  {
    key: 'wheel',
    params: cross(YELLOW_JACKET.filter((m) => m.rpm <= 1620), WHEELS, [1, 2]),
    make: ([m, w, r]) => {
      const rpm = m.rpm / r;
      const ips = (rpm * Math.PI * w.mm) / MM_PER_IN / 60;
      const via = r === 1 ? 'direct drive' : `through a ${r}:1 reduction`;
      return [
        2,
        `A ${yj(m)} drives a ${w.name} wheel, ${via}. Top (free) speed of the wheel's edge, in inches per second?`,
        ips,
        [ips * 60, (rpm * w.mm) / MM_PER_IN / 60, (rpm * Math.PI * w.mm) / 60, ips / 2],
        1,
        ' in/s',
        `Wheel RPM ${round(rpm)} x pi x ${w.mm} mm / 25.4 mm per in / 60 s = ${round(ips)} in/s.`,
      ];
    },
  },
  {
    key: 'ticks-rev',
    params: cross(YELLOW_JACKET, [1, 1.5, 2, 3]),
    make: ([m, r]) => {
      const t = m.ticks * r;
      const via = r === 1 ? 'on the motor shaft' : `after a ${r}:1 reduction`;
      return [
        2,
        `A ${yj(m)} reads ${m.ticks} encoder ticks per turn of its output shaft. How many ticks per turn of a wheel ${via}?`,
        t,
        [m.ticks / r, 28 * r, m.ticks + r],
        1,
        ' ticks',
        r === 1 ? `Direct drive: one wheel turn is one shaft turn, ${m.ticks} ticks.` : `The motor turns ${r} times per wheel turn: ${m.ticks} x ${r} = ${round(t)} ticks.`,
      ];
    },
  },
  {
    key: 'ticks-dist',
    params: cross(YELLOW_JACKET.filter((m) => [1150, 435, 312, 223, 117].includes(m.rpm)), WHEELS, DISTANCES),
    make: ([m, w, d]) => {
      const circIn = (Math.PI * w.mm) / MM_PER_IN;
      const t = (d / circIn) * m.ticks;
      return [
        3,
        `Direct drive, ${yj(m)} (${m.ticks} ticks per turn) on a ${w.name} wheel. How many ticks to drive ${d} inches?`,
        t,
        [(d / (w.mm / MM_PER_IN)) * m.ticks, (d * MM_PER_IN / (Math.PI * w.mm)) * 28, (d / ((Math.PI * w.mm) / 2 / MM_PER_IN)) * m.ticks, d * m.ticks / (Math.PI * w.mm)],
        0,
        ' ticks',
        `One turn travels pi x ${w.mm} mm = ${round(circIn, 2)} in. ${d} / ${round(circIn, 2)} = ${round(d / circIn, 3)} turns x ${m.ticks} = ${round(t, 0)} ticks.`,
      ];
    },
  },
  {
    key: 'ticks-inch',
    params: cross(YELLOW_JACKET, WHEELS),
    make: ([m, w]) => {
      const tpi = m.ticks / ((Math.PI * w.mm) / MM_PER_IN);
      return [
        2,
        `${yj(m)} (${m.ticks} ticks per turn), direct drive on a ${w.name} wheel: ticks per inch of travel?`,
        tpi,
        [m.ticks / (w.mm / MM_PER_IN), (m.ticks / (Math.PI * w.mm)), m.ticks * Math.PI * w.mm / MM_PER_IN / 100, tpi * 2],
        2,
        ' ticks/in',
        `Circumference pi x ${w.mm} / 25.4 = ${round((Math.PI * w.mm) / MM_PER_IN, 2)} in; ${m.ticks} / that = ${round(tpi, 2)} ticks per inch.`,
      ];
    },
  },
  {
    key: 'torque',
    params: cross(TORQUES, REDUCTIONS),
    make: ([t, r]) => [
      1,
      `A motor's stall torque is ${t} kg-cm. Through a ${r}:1 reduction, ignoring losses, what is the stall torque at the output?`,
      t * r,
      [t / r, t + r, t],
      1,
      ' kg-cm',
      `A reduction trades speed for torque: ${t} x ${r} = ${round(t * r)} kg-cm (real gears lose a little to friction).`,
    ],
  },
  {
    key: 'torque-up',
    params: cross(TORQUES, [2, 3]),
    make: ([t, r]) => [
      2,
      `A motor's stall torque is ${t} kg-cm. Geared UP 1:${r} for speed, ignoring losses, what is the output stall torque?`,
      t / r,
      [t * r, t - r, t],
      2,
      ' kg-cm',
      `Gearing up ${r}x for speed divides torque by ${r}: ${t} / ${r} = ${round(t / r, 2)} kg-cm.`,
    ],
  },
  {
    key: 'ultraplanetary',
    params: cross(combos, ['rpm', 'ticks']),
    make: ([combo, what]) => {
      const names = combo.map((i) => CARTRIDGES[i].name);
      const actual = combo.reduce((p, i) => p * CARTRIDGES[i].actual, 1);
      const nominal = combo.reduce((p, i) => p * parseInt(CARTRIDGES[i].name, 10), 1);
      const stack = names.join(' + ');
      const actuals = combo.map((i) => round(CARTRIDGES[i].actual, 2)).join(' x ');
      if (what === 'rpm') {
        return [
          3,
          `REV HD Hex (6000 RPM free) with UltraPlanetary cartridges ${stack}. The 3:1, 4:1 and 5:1 cartridges are really 2.89:1, 3.61:1 and 5.23:1. Output free speed?`,
          HD_HEX.rpm / actual,
          [HD_HEX.rpm / nominal, HD_HEX.rpm * actual, HD_HEX.rpm / (actual * 2)],
          0,
          ' RPM',
          `Ratios multiply: ${actuals} = ${round(actual, 2)}:1. 6000 / ${round(actual, 2)} = ${round(HD_HEX.rpm / actual, 0)} RPM (the labels would give ${round(HD_HEX.rpm / nominal, 0)}).`,
        ];
      }
      return [
        3,
        `REV HD Hex (28 ticks per motor turn) with UltraPlanetary cartridges ${stack} (actual ratios 2.89, 3.61, 5.23). Encoder ticks per output turn?`,
        HD_HEX.ticks * actual,
        [HD_HEX.ticks * nominal, HD_HEX.ticks / actual, 28 * actual * 4],
        1,
        ' ticks',
        `The encoder is on the motor, so ticks multiply by the ratio: 28 x ${round(actual, 2)} = ${round(HD_HEX.ticks * actual, 1)}.`,
      ];
    },
  },
  {
    key: 'core-hex',
    params: cross(WHEELS, [1, 2], ['speed', 'ticks']),
    make: ([w, r, what]) => {
      const via = r === 1 ? 'direct drive' : `through a ${r}:1 reduction`;
      if (what === 'speed') {
        const ips = ((CORE_HEX.rpm / r) * Math.PI * w.mm) / MM_PER_IN / 60;
        return [
          2,
          `A REV Core Hex motor (125 RPM free) drives a ${w.name} wheel, ${via}. Free speed in inches per second?`,
          ips,
          [ips * r * r, ((CORE_HEX.rpm / r) * w.mm) / MM_PER_IN / 60, ips * 60],
          2,
          ' in/s',
          `${round(CORE_HEX.rpm / r)} RPM x pi x ${w.mm} / 25.4 / 60 = ${round(ips, 2)} in/s.`,
        ];
      }
      const t = (CORE_HEX.ticks * r * 12) / ((Math.PI * w.mm) / MM_PER_IN);
      return [
        3,
        `A REV Core Hex (288 ticks per output turn) drives a ${w.name} wheel, ${via}. Ticks to drive 12 inches?`,
        t,
        [(CORE_HEX.ticks * 12) / ((Math.PI * w.mm) / MM_PER_IN) / r, (CORE_HEX.ticks * r * 12) / (w.mm / MM_PER_IN), 28 * r * 12 / ((Math.PI * w.mm) / MM_PER_IN)],
        0,
        ' ticks',
        `12 in / (pi x ${w.mm} / 25.4 in per turn) x 288${r === 1 ? '' : ` x ${r}`} = ${round(t, 0)} ticks.`,
      ];
    },
  },
  {
    key: 'two-stage',
    params: cross(YELLOW_JACKET, STAGES),
    make: ([m, [a, b]]) => {
      const out = m.rpm / (a * b);
      return [
        2,
        `A ${m.rpm} RPM motor goes through a ${a}:1 stage, then a ${b}:1 stage. Output speed?`,
        out,
        [m.rpm / (a + b), (m.rpm / a) * b, m.rpm / a],
        1,
        ' RPM',
        `Stages multiply: ${a} x ${b} = ${a * b}:1 overall. ${m.rpm} / ${a * b} = ${round(out)} RPM.`,
      ];
    },
  },
  {
    key: 'time',
    params: cross(YELLOW_JACKET.filter((m) => [1150, 435, 312, 223].includes(m.rpm)), WHEELS),
    make: ([m, w]) => {
      const ips = (m.rpm * Math.PI * w.mm) / MM_PER_IN / 60;
      const t = 120 / ips;
      return [
        3,
        `At free speed, how long does a direct-drive ${yj(m)} on ${w.name} wheels take to cross 10 feet? (Real robots are slower.)`,
        t,
        [10 / ips, 120 / ((m.rpm * w.mm) / MM_PER_IN / 60), t * 2],
        2,
        ' s',
        `Speed = ${m.rpm} x pi x ${w.mm} / 25.4 / 60 = ${round(ips)} in/s. 10 ft = 120 in, 120 / ${round(ips)} = ${round(t, 2)} s.`,
      ];
    },
  },
  {
    key: 'pick-motor',
    params: cross(YELLOW_JACKET.filter((m) => [1620, 1150, 435, 312, 223, 117].includes(m.rpm)), WHEELS),
    make: ([m, w]) => {
      const ips = (m.rpm * Math.PI * w.mm) / MM_PER_IN / 60;
      const target = Math.round(ips);
      // The right motor plus three others, compared by the speed they give.
      const others = YELLOW_JACKET.filter((o) => o.rpm !== m.rpm && o.rpm <= 1620 && o.rpm >= 84);
      const picks = shuffle(others, `${m.rpm}-${w.mm}`).slice(0, 3);
      const choices = [m, ...picks].map((o) => `${o.rpm} RPM`);
      return {
        difficulty: 3,
        prompt: `You want a direct-drive top speed close to ${target} in/s on ${w.name} wheels. Which Yellow Jacket fits best?`,
        choices,
        explain: `${m.rpm} RPM x pi x ${w.mm} / 25.4 / 60 = ${round(ips)} in/s, the closest to ${target}.`,
      };
    },
  },
];

const SIZES = TEMPLATES.map((t) => t.params.length);
export const GEAR_SPACE = SIZES.reduce((a, b) => a + b, 0);

// The question at spot `seed` (any integer; wraps around the space).
export function gearQuestion(seed) {
  let n = ((Math.floor(Number(seed) || 0) % GEAR_SPACE) + GEAR_SPACE) % GEAR_SPACE;
  let t = 0;
  while (n >= SIZES[t]) n -= SIZES[t++];
  const tpl = TEMPLATES[t];
  const id = `g-${tpl.key}-${n}`;
  const made = tpl.make(tpl.params[n]);
  if (!Array.isArray(made)) {
    // Pick-motor: text choices, right one first; sort by speed for reading.
    const sorted = [...made.choices].sort((a, b) => parseFloat(a) - parseFloat(b));
    return { id, bank: 'gear', kind: 'choice', difficulty: made.difficulty, prompt: made.prompt, choices: sorted, answer: sorted.indexOf(made.choices[0]), explain: made.explain };
  }
  const [difficulty, prompt, answer, mistakes, places, unit, explain] = made;
  return q(id, difficulty, prompt, answer, mistakes, places, unit, explain);
}

// Spot number from a gear question id, for checking answers later.
export function gearSeedOf(id) {
  const m = /^g-([a-z-]+?)-(\d+)$/.exec(String(id));
  if (!m) return null;
  const t = TEMPLATES.findIndex((x) => x.key === m[1]);
  const n = Number(m[2]);
  if (t < 0 || n >= SIZES[t]) return null;
  return SIZES.slice(0, t).reduce((a, b) => a + b, 0) + n;
}
