// Coin amounts as people type them (3.1.1): "250", "200,000", "2k", "1.5k",
// "2.25m", "2b", "5qa", "2.5e40", "googol". The app and the server read
// amounts with this same code, so a word means the same number on both
// sides. No React or Firebase in here.
//
// - Suffixes (any case): k thousand, m million, b billion, t trillion,
//   qa (or q) quadrillion 1e15, qi quintillion 1e18, sx sextillion 1e21,
//   sp septillion 1e24, oc octillion 1e27, no nonillion 1e30, dc decillion
//   1e33 (all but k–t since 3.1.5, when coins went up to a googol).
// - Scientific: "1e40", "2.5e50", "1E6" (3.1.5), and the word "googol"
//   (1e100). Nothing over a googol: that's the most anyone can hold.
// - Commas only separate thousands: "1,000" and "200,000", never "1,00".
// - Below 2^53 (about 9 quadrillion) the result is an exact whole number of
//   coins. "1.5k" is 1500; "1.2345k" would be 1234.5, which is refused
//   (readAmount says the nearest whole amount), never rounded.
// - From 2^53 up, numbers are approximate doubles anyway: the amount is
//   rounded to the nearest one, with no whole-number complaint.
// - Nothing else: no minus sign, no "0x10".
// Limits (bet caps, balances, the ceiling) are the caller's, checked after
// this, the same as for the number typed out.

const SUFFIX = 'qa|qi|sx|sp|oc|no|dc|[kmbtq]';
const RE = new RegExp(`^(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?(?:e\\+?(\\d{1,3})|(${SUFFIX}))?$`, 'i');
const POWER = { '': 0, k: 3, m: 6, b: 9, t: 12, q: 15, qa: 15, qi: 18, sx: 21, sp: 24, oc: 27, no: 30, dc: 33 };
// Exact whole numbers stop here (2^53, Number.MAX_SAFE_INTEGER + 1).
const EXACT = 2n ** 53n;
export const GOOGOL = 10n ** 100n;
export const OVER_GOOGOL = 'That’s more than a googol.';

// The whole story of one word:
//   { amount }        a whole number of coins (0 included); from 2^53 up, the
//                     nearest double
//   { near, exact }   a number below 2^53, but not a whole one: exact is what
//                     it comes to ("1234.5"), near the closest whole amount (1235)
//   { over: true }    a number, but more than a googol
//   null              not an amount at all
export function readAmount(word) {
  if (typeof word === 'number') word = Number.isFinite(word) ? String(word) : '';
  if (typeof word !== 'string') return null;
  const w = word.trim();
  if (/^googol$/i.test(w)) return { amount: 1e100 };
  const m = RE.exec(w);
  if (!m) return null;
  const whole = m[1].replace(/,/g, '');
  const frac = m[2] || '';
  if (frac.length > 40 || whole.length > 120) return null;
  const power = m[3] !== undefined ? Number(m[3]) : POWER[(m[4] || '').toLowerCase()];
  const den = 10n ** BigInt(frac.length);
  const num = (BigInt(whole) * den + BigInt(frac || '0')) * 10n ** BigInt(power);
  const q = num / den;
  const r = num % den;
  const near = r * 2n >= den ? q + 1n : q;
  if (q > GOOGOL || (q === GOOGOL && r > 0n)) return { over: true };
  if (r === 0n || near >= EXACT) return { amount: Number(near) };
  // What it really comes to, without float noise: "1234.5".
  // (den is 10^frac.length and r < den, so r is the decimals themselves.)
  const digits = r.toString().padStart(frac.length, '0').replace(/0+$/, '');
  return { near: Number(near), exact: `${q}.${digits}` };
}

// A whole number of coins, or null. positive: 0 is null too.
export function parseAmount(word, { positive = false } = {}) {
  const r = readAmount(word);
  if (!r || r.amount === undefined) return null;
  if (positive && r.amount < 1) return null;
  return r.amount;
}

// Looks like someone meant a number ("2k", "1,000", "1.5", "-3", "1e6",
// "5qa", "googol"), whether or not it is one. For telling an amount word from
// a name: only a word that starts with a digit (or a sign or point and then
// digits) counts, so "no", "sp" or "dc" on their own are words, not amounts.
export const looksLikeAmount = (word) => {
  const w = String(word || '').trim();
  return /^googol$/i.test(w) || new RegExp(`^[-+]?(?:\\d[\\d,]*(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+|${SUFFIX})?$`, 'i').test(w);
};

// Why a word that looks like an amount isn't one, for the note that says
// so: "1.2345k is 1234.5 coins. Coins are whole: try 1235.", or "That’s more
// than a googol." '' when there's nothing to add (it is a whole amount, or
// not a number at all).
export function amountTip(word) {
  const r = readAmount(word);
  if (!r || r.amount !== undefined) return '';
  if (r.over) return OVER_GOOGOL;
  return `${String(word).trim()} is ${r.exact} coins. Coins are whole: try ${Math.max(1, r.near)}.`;
}
