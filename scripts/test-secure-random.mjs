// Every game the server runs draws from the secure generator
// (functions/shared/rng.js secureRandom), never Math.random:
// - no Math.random anywhere in functions/ (outside node_modules),
// - every shared game function that takes an rng defaults to secureRandom,
// - secureRandom gives floats in [0, 1) that look uniform.
// Run: node scripts/test-secure-random.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { secureRandom } from '../functions/shared/rng.js';

const ROOT = new URL('../functions/', import.meta.url).pathname;
let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log('FAIL', msg);
  }
};

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(m?js|cjs)$/.test(name)) files.push(p);
  }
};
walk(ROOT);
ok(files.length > 10, `found the server's files (${files.length})`);
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (/Math\.random/.test(line) && !/^\s*\/\//.test(line)) ok(false, `${f.replace(ROOT, 'functions/')}:${i + 1} uses Math.random`);
  });
  // A parameter named rng with a default must default to the secure one.
  for (const m of src.matchAll(/\brng\s*=\s*([\w.]+)/g)) {
    if (m[1] === 'seeded' || /^seeded\(/.test(m[1])) continue;
    ok(m[1] === 'secureRandom', `${f.replace(ROOT, 'functions/')}: rng defaults to ${m[1]}`);
  }
}

// The generator itself.
const N = 200000;
const bins = new Array(10).fill(0);
let min = 1;
let max = 0;
for (let i = 0; i < N; i++) {
  const x = secureRandom();
  if (!(x >= 0 && x < 1)) ok(false, `out of range: ${x}`);
  min = Math.min(min, x);
  max = Math.max(max, x);
  bins[Math.floor(x * 10)]++;
}
const chi = bins.reduce((t, b) => t + (b - N / 10) ** 2 / (N / 10), 0);
// 9 degrees of freedom: 27.9 is the 0.1% line.
ok(chi < 27.9, `uniform (chi² ${chi.toFixed(1)})`);
ok(min < 0.001 && max > 0.999, `covers the range (${min}, ${max})`);
// Two in a row are never the same (53 bits each).
const seen = new Set();
for (let i = 0; i < 50000; i++) seen.add(secureRandom());
ok(seen.size === 50000, 'no repeats in 50,000 draws');

console.log(failures ? `${failures} FAILURES` : `ALL OK (${files.length} files, chi² ${chi.toFixed(1)})`);
process.exit(failures ? 1 : 0);
