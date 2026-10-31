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

function others(part, key, pick, n = 3) {
  const same = PARTS.filter((p) => p.category === part.category && kindOf(p) !== kindOf(part));
  const rest = PARTS.filter((p) => p.category !== part.category && kindOf(p) !== kindOf(part));
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
  if (part.photo) {
    out.push(
      choice(`${part.id}-photo`, 1, 'Name this part.', part.name, others(part, 'photo', (p) => p.name), {
        image: part.photo,
        explain: `That's the ${label} (${part.partNumber}). ${part.purpose}`,
        ...ref,
      }),
    );
  }
  return out;
}

export const PART_QUESTIONS = PARTS.flatMap(questionsFor);
