// The Jackson coin number formatter (src/coinFormat.js): commas, no commas,
// and short (1k, 1.1k, 82.2k, 2.3m, 1.5b), signs, rounding, and the exact
// hover text.
// Run: node scripts/test-coin-format.mjs
import { coinTitle, exactCoins, formatCoins, signedCoins } from '../src/coinFormat.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  if (got === want) passes++;
  else {
    failures++;
    console.log('FAIL', `${msg}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
};

// [n, commas, plain, short]
const CASES = [
  [0, '0', '0', '0'],
  [7, '7', '7', '7'],
  [999, '999', '999', '999'],
  [1000, '1,000', '1000', '1k'],
  [1049, '1,049', '1049', '1k'],
  [1050, '1,050', '1050', '1.1k'],
  [1100, '1,100', '1100', '1.1k'],
  [9999, '9,999', '9999', '10k'],
  [12345, '12,345', '12345', '12.3k'],
  [82200, '82,200', '82200', '82.2k'],
  [99950, '99,950', '99950', '100k'],
  [99949, '99,949', '99949', '99.9k'],
  [429149, '429,149', '429149', '429.1k'],
  [999949, '999,949', '999949', '999.9k'],
  [999950, '999,950', '999950', '1m'],
  [999999, '999,999', '999999', '1m'],
  [1e6, '1,000,000', '1000000', '1m'],
  [1234567, '1,234,567', '1234567', '1.2m'],
  [2300000, '2,300,000', '2300000', '2.3m'],
  [999950000, '999,950,000', '999950000', '1b'],
  [1e9, '1,000,000,000', '1000000000', '1b'],
  [1.5e9, '1,500,000,000', '1500000000', '1.5b'],
  // Negatives keep their sign, with the app's minus (U+2212).
  [-1, '−1', '−1', '−1'],
  [-999, '−999', '−999', '−999'],
  [-1234, '−1,234', '−1234', '−1.2k'],
  [-1050, '−1,050', '−1050', '−1.1k'],
  [-999950, '−999,950', '−999950', '−1m'],
  [-1234567, '−1,234,567', '−1234567', '−1.2m'],
  // Non-integers round to whole coins (count-up frames pass these).
  [0.4, '0', '0', '0'],
  [-0.4, '0', '0', '0'],
  [999.4, '999', '999', '999'],
  [999.6, '1,000', '1000', '1k'],
  [1234.5, '1,235', '1235', '1.2k'],
  [1049.6, '1,050', '1050', '1.1k'],
  [-1049.6, '−1,050', '−1050', '−1.1k'],
  // Not a number: shows 0.
  [undefined, '0', '0', '0'],
  [null, '0', '0', '0'],
  [NaN, '0', '0', '0'],
  ['1234', '1,234', '1234', '1.2k'],
];
for (const [n, c, p, s] of CASES) {
  eq(formatCoins(n), c, `default style is commas (${n})`);
  eq(formatCoins(n, 'commas'), c, `commas ${n}`);
  eq(formatCoins(n, 'plain'), p, `plain ${n}`);
  eq(formatCoins(n, 'short'), s, `short ${n}`);
  eq(exactCoins(n), c, `exact ${n}`);
  // Never "1000k" or "1000m".
  if (/^−?1000[kmb]$/.test(formatCoins(n, 'short'))) eq(formatCoins(n, 'short'), 'not 1000x', `short ${n} rolls over`);
}
// No hyphen-minus anywhere.
for (let n = -2e6; n <= 2e6; n += 7919)
  for (const st of ['commas', 'plain', 'short']) if (formatCoins(n, st).includes('-')) eq(formatCoins(n, st), 'no hyphen', `${st} ${n}`);
// Short never shows 1000 of a unit, and always one decimal at most.
for (let n = 990000; n <= 1010000; n += 1) {
  const s = formatCoins(n, 'short');
  if (!/^\d{1,3}(\.\d)?[km]$/.test(s) || s.startsWith('1000')) {
    eq(s, 'well formed', `short ${n}`);
    break;
  }
}

// Signed (history lines).
eq(signedCoins(0), '0', 'signed 0');
eq(signedCoins(5), '+5', 'signed +5');
eq(signedCoins(429149), '+429,149', 'signed +429,149');
eq(signedCoins(-429149), '−429,149', 'signed −429,149');
eq(signedCoins(-429149, 'plain'), '−429149', 'signed plain');
eq(signedCoins(429149, 'short'), '+429.1k', 'signed short +');
eq(signedCoins(-1234567, 'short'), '−1.2m', 'signed short −');
eq(signedCoins(0.2, 'short'), '0', 'signed rounds to 0');

// The hover text: only in short, and only when short hides something.
eq(coinTitle(1234567, 'commas'), undefined, 'no title with commas');
eq(coinTitle(1234567, 'plain'), undefined, 'no title with no commas');
eq(coinTitle(1234567, 'short'), '1,234,567', 'title with short');
eq(coinTitle(-1234, 'short'), '−1,234', 'negative title');
eq(coinTitle(999, 'short'), undefined, 'no title when short is exact');
eq(coinTitle(1000, 'short'), '1,000', 'title for 1k');

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
