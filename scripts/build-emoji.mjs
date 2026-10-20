// Builds src/data/emoji.json (the emoji picker's list and :shortcodes:) from
// emojibase-data (MIT): newest emoji from v18, Slack/Discord-style shortcodes
// (iamcal) from v15 plus CLDR names. Emoji newer than Unicode 15.0 are left out:
// iPads on iOS 16 show those as empty boxes. Run with the two package folders:
//   node scripts/build-emoji.mjs <emojibase-data@18> <emojibase-data@15>
import { readFileSync, writeFileSync } from 'node:fs';

const [v18, v15] = process.argv.slice(2);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const emoji = read(`${v18}/en/compact.json`);
const version = Object.fromEntries(read(`${v18}/en/data.json`).map((e) => [e.hexcode, e.version]));
const cldr = read(`${v18}/en/shortcodes/cldr.json`);
const iamcal = read(`${v15}/en/shortcodes/iamcal.json`);
const list = (v) => (v ? (Array.isArray(v) ? v : [v]) : []);

// Groups, in picker order (2 = skin tone components, skipped).
const GROUPS = { 0: 0, 1: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8 };
const out = emoji
  .filter((e) => e.group in GROUPS && (version[e.hexcode] ?? 99) <= 15)
  .sort((a, b) => a.order - b.order)
  .map((e) => [e.unicode, [...new Set([...list(iamcal[e.hexcode]), ...list(cldr[e.hexcode])])], GROUPS[e.group], (e.tags || []).join(' ')]);
writeFileSync('src/data/emoji.json', JSON.stringify(out));
console.log(out.length, 'emoji');
