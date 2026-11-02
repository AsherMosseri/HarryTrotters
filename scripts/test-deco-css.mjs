// Static checks for the avatar decoration, name effect and nameplate motion
// (no browser needed): node scripts/test-deco-css.mjs
//  1. every @keyframes is defined once across styles.css and shell.css (the
//     later one silently replaced the earlier, so pages animated differently),
//  2. the decoration keyframes only move transform / opacity (and the
//     individual translate / rotate / scale), with fixed values: no var(), no
//     calc(), so iPad Safari can run them on the graphics chip,
//  3. the Animations switch (data-motion off, Reduce Motion) still covers the
//     decoration, nameplate and name effect classes.
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = ['styles.css', 'shell.css'].map((f) => [f, fs.readFileSync(path.join(src, f), 'utf8')]);
let fails = 0;
const fail = (msg) => {
  fails++;
  console.log('FAIL', msg);
};

// All @keyframes: name -> [{ file, body }]
const frames = new Map();
for (const [file, css] of files) {
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth && i < css.length) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0, i++;
    const list = frames.get(m[1]) || [];
    list.push({ file, body: css.slice(re.lastIndex, i - 1) });
    frames.set(m[1], list);
  }
}

// The decoration family: deco-*, adeco-*, np-*, the name effects, and the old ad-* names these used to share with the ads.
const family = (n) => /^(deco-|adeco-|np-|ne-)/.test(n) || ['ad-flick', 'ad-bolt', 'ad-bob', 'ad-ripple', 'ad-flip', 'ad-march', 'ad-twitch', 'ad-flop', 'ad-bop', 'ad-note', 'ad-blink', 'ad-flap'].includes(n);

for (const [name, defs] of frames) {
  if (defs.length < 2) continue;
  if (family(name)) fail(`@keyframes ${name} is defined ${defs.length} times (${defs.map((d) => d.file).join(', ')})`);
  else console.log(`note: @keyframes ${name} is defined ${defs.length} times (not a decoration; left alone)`);
}
// Of the family, these animate things that can't be layers (text gradients, clip-path); they're checked for duplicates only.
const TEXT_ONLY = new Set(['ne-slide', 'ne-slide-wide', 'ne-fire', 'ne-glitter', 'ne-g1', 'ne-g2']);
// np-gear and the nameplate strips are transform only too; ne-slide and friends move a gradient inside text (not in this list).
const ALLOWED = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale']);
let checked = 0;
for (const [name, defs] of frames) {
  if (!family(name) || TEXT_ONLY.has(name)) continue;
  checked++;
  const body = defs[0].body;
  if (/var\(|calc\(/.test(body)) fail(`@keyframes ${name} uses var() or calc()`);
  const props = new Set([...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]));
  for (const p of props) if (!ALLOWED.has(p)) fail(`@keyframes ${name} animates ${p} (only transform and opacity run on the graphics chip)`);
}

// The off switches still name the classes that move.
const all = files.map(([, c]) => c).join('\n');
for (const cls of ['.deco::before', '.deco::after', '.deco-ring', '.deco-orbit', '.deco-b', '.adeco *', '.nameplate *', '.ne::after']) {
  const covered = (mode) => all.split('\n').some((l) => l.includes(mode) && l.includes(cls));
  if (!covered("[data-motion='off']")) fail(`${cls} is not covered by :root[data-motion='off']`);
  if (!covered("not([data-motion='on'])")) fail(`${cls} is not covered by Reduce Motion`);
}

console.log(`${frames.size} keyframes, ${checked} in the decoration family checked`);
console.log(fails ? `FAILED: ${fails}` : 'PASSED');
process.exit(fails ? 1 : 0);
