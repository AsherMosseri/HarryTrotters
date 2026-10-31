// Name that part (G1): questions built from the parts list. Wrong answers
// come from the same category but a different family, so two sizes of the
// same channel are never both offered as "the" answer to a description.
import { PARTS } from './parts-list.js';
import { shuffle } from './util.js';

export { PARTS };

// Families that do the same job across sizes or brands. A description of one
// could fit another, so they are never wrong answers for each other.
const KIND = {
  'yj-d': 'yj',
  nut: 'nut', 'rev-nut': 'nut',
  shcs: 'screw', bhcs: 'screw', 'rev-screw': 'screw',
  'gb-battery': 'battery', 'rev-battery': 'battery',
  switch: 'power-switch', 'rev-switch': 'power-switch',
  injector: 'servo-power', spm: 'servo-power', 'servo-hub': 'servo-power',
  color: 'color', color2: 'color',
  tbe: 'tbe', tbe2: 'tbe',
  'smart-servo': 'smart-servo', 'smart-servo2': 'smart-servo',
  'servo-frame': 'servo-mount', 'servo-plate': 'servo-mount', 'servo-pattern': 'servo-mount', servoblock: 'servo-mount', 'servoblock-compact': 'servo-mount',
  hub: 'hub', hub2: 'hub', 'rev-hub': 'hub',
  bearing: 'bearing', 'bearing-round': 'bearing', 'rev-bearing': 'bearing', 'rev-flanged': 'bearing',
  collar: 'collar', 'rev-collar': 'collar',
  shaft: 'shaft', 'rev-shaft': 'shaft',
  'hub-gear': 'gear', 'rev-gear': 'gear',
  sprocket: 'sprocket', 'rev-sprocket': 'sprocket',
  pulley: 'pulley', 'pinion-pulley': 'pulley', 'dual-pulley': 'pulley',
  'gb-mecanum': 'mecanum', gripforce: 'mecanum',
  gecko: 'traction', rhino: 'traction', 'rev-traction': 'traction', 'rev-grip': 'traction',
  'low-side': 'u-channel',
  'grid-plate': 'plate', 'poly-plate': 'plate',
  'rev-bracket-90': 'rev-bracket', 'rev-bracket-90m': 'rev-bracket', 'rev-inside': 'rev-bracket', 'rev-lap': 'rev-bracket', 'rev-motion': 'rev-bracket', 'rev-rod': 'rev-bracket', 'rev-index': 'rev-bracket', 'rev-gearbox': 'rev-bracket', 'rev-variable': 'rev-bracket',
  'rev-servo-br': 'rev-mount', 'rev-servo-br-m': 'rev-mount', 'rev-hd-br': 'rev-mount', 'rev-core-br': 'rev-mount',
  'rev-pillow-hex': 'rev-pillow', 'rev-pillow': 'rev-pillow',
  strafer: 'chassis-kit', outlaw: 'chassis-kit',
  'rev-starter': 'rev-starter', 'rev-starter-2018': 'rev-starter', 'rev-upgrade': 'rev-starter', 'rev-upgrade2': 'rev-starter', 'rev-edu': 'rev-starter',
  'enc-breakout': 'enc-cable', 'enc-adaptor': 'enc-cable', jst6: 'enc-cable',
};
export const kindOf = (p) => KIND[p.family] || p.family;

// Kinds that look alike in a product photo even though they do different jobs
// (a REV spacer and a through bore bearing are both black hex-bore tubes).
// Photo questions never offer one of these as a wrong answer for another.
const LOOK = {
  'u-beam': 'u-channel',
  sprocket: 'gear', 'rev-sprocket': 'gear',
  color: 'sensor-box', distance: 'sensor-box', mag: 'sensor-box', touch: 'sensor-box',
  'enc-cable': 'cable', jst3: 'cable', splitter: 'cable', 'servo-ext': 'cable', 'xt30-tamiya': 'cable', 'xt30-anderson': 'cable', ground: 'cable',
  'rev-bracket': 'rev-plate', 'rev-mount': 'rev-plate',
  'rev-spacer': 'bearing', 'tbe-insert': 'bearing',
  viper: 'slide', actuator: 'slide', 'slide-pack': 'slide',
  'rev-shaft-bundle': 'bundle',
  'sensor-bundle': 'flat-lay', 'cable-bundle': 'flat-lay', 'rev-starter': 'flat-lay',
  'up-hw': 'screw',
};
const lookOf = (p) => LOOK[kindOf(p)] || kindOf(p);

// Families whose sizes share one photo (every Yellow Jacket ratio looks the
// same). Only the named part gets a photo question ('' = none of them); the
// rest would show the same picture with a different answer.
const ONE_PHOTO = {
  yj: '5203-2402-0019', 'yj-d': '',
  'gb-servo': '2000-0025-0002',
  standoff: '1501-0006-0240',
  shcs: '2800-0004-0008',
  bearing: '1611-0514-4008', 'bearing-round': '',
  'gb-mecanum': '3213-3606-0002',
  gecko: '3613-0014-0096',
  rhino: '3614-0014-0096',
  strafer: '3209-0001-0007',
  viper: '3210-0003-0004',
  pinpoint: '3110-0002-0002',
  'servo-ext': '3802-1718-0300',
  'up-cart': 'REV-41-1601',
  color: 'REV-31-1557', color2: '',
  extrusion: 'REV-41-1431',
};
const photoQuestion = (p) => !!p.photo && (!(p.family in ONE_PHOTO) || ONE_PHOTO[p.family] === p.partNumber);

function others(part, key, pick, n = 3, kind = kindOf) {
  const same = PARTS.filter((p) => p.category === part.category && kind(p) !== kind(part));
  const rest = PARTS.filter((p) => p.category !== part.category && kind(p) !== kind(part));
  const pool = [...shuffle(same, `${part.id}-${key}`), ...shuffle(rest, `${part.id}-${key}-x`)];
  const out = [];
  for (const p of pool) {
    const v = pick(p);
    if (v && v !== pick(part) && !out.includes(v)) out.push(v);
    if (out.length === n) break;
  }
  return out;
}

function choice(id, difficulty, prompt, right, wrong, extra) {
  const all = shuffle([right, ...wrong], id);
  return { id, bank: 'parts', kind: 'choice', difficulty, prompt, choices: all, answer: all.indexOf(right), ...extra };
}

function questionsFor(part) {
  const label = `${part.brand} ${part.name}`;
  const ref = { partId: part.id, partNumber: part.partNumber, url: part.url };
  const out = [
    choice(`${part.id}-what`, 1, `Which part is this? "${part.purpose}"`, part.name, others(part, 'what', (p) => p.name), {
      explain: `That's the ${label} (${part.partNumber}).`,
      ...ref,
    }),
    choice(`${part.id}-for`, 2, `What is the ${label} for?`, part.purpose, others(part, 'for', (p) => p.purpose), {
      explain: `${part.name} (${part.partNumber}): ${part.purpose}`,
      ...ref,
    }),
  ];
  // Part numbers inside a family: only for numbers seen on vendor pages.
  const family = PARTS.filter((p) => p.family === part.family);
  if (family.length >= 3 && part.skuChecked) {
    const wrong = shuffle(family.filter((p) => p.id !== part.id), `${part.id}-pn`).slice(0, 3).map((p) => p.name);
    out.push(
      choice(`${part.id}-pn`, 3, `Which part is ${part.brand} part number ${part.partNumber}?`, part.name, wrong, {
        explain: `${part.partNumber} is the ${part.name}.`,
        ...ref,
      }),
    );
  }
  if (photoQuestion(part)) {
    // Wrong answers must look clearly different, so the photo alone decides.
    const wrong = others(part, 'photo', (p) => p.name, 3, lookOf);
    out.push(
      choice(`${part.id}-photo`, 1, 'Name this part.', part.name, wrong, {
        image: part.photo,
        explain: `That's the ${label} (${part.partNumber}). ${part.purpose}`,
        ...ref,
      }),
    );
  }
  return out;
}

export const PART_QUESTIONS = PARTS.flatMap(questionsFor);
