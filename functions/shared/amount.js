// Coin amounts as people type them (3.1.1): "250", "200,000", "2k", "1.5k",
// "2.25m", "2b". The app and the server read amounts with this same code, so
// a word means the same number on both sides. No React or Firebase in here.
//
// - k, m, b, t and q (any case) are thousand, million, billion, trillion and
//   quadrillion (q since 3.1.4: the most anyone can hold is 1q).
// - Commas only separate thousands: "1,000" and "200,000", never "1,00".
// - The result is a whole number of coins. "1.5k" is 1500; "1.2345k" would
//   be 1234.5, which is refused (readAmount says the nearest whole amount),
//   never rounded.
// - Nothing else: no minus sign, no "1e6", nothing past MAX_SAFE_INTEGER.
// Limits (bet caps, the /give cap, loan caps, balances) are the caller's,
// checked after this, the same as for the number typed out.

const RE = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?([kmbtq])?$/i;
const SCALE = { '': 1n, k: 1000n, m: 1000000n, b: 1000000000n, t: 1000000000000n, q: 1000000000000000n };
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

// The whole story of one word:
//   { amount }        a whole number of coins (0 included)
//   { near, exact }   a number, but not a whole one: exact is what it comes
//                     to ("1234.5"), near the closest whole amount (1235)
//   null              not an amount at all
export function readAmount(word) {
  if (typeof word === 'number') word = Number.isFinite(word) ? String(word) : '';
  if (typeof word !== 'string') return null;
  const m = RE.exec(word.trim());
  if (!m) return null;
  const whole = m[1].replace(/,/g, '');
  const frac = m[2] || '';
  if (frac.length > 12 || whole.length > 20) return null;
  const den = 10n ** BigInt(frac.length);
  const num = (BigInt(whole) * den + BigInt(frac || '0')) * SCALE[(m[3] || '').toLowerCase()];
  const q = num / den;
  const r = num % den;
  if (r === 0n) return q > MAX ? null : { amount: Number(q) };
  const near = r * 2n >= den ? q + 1n : q;
  if (near > MAX) return null;
  // What it really comes to, without float noise: "1234.5".
  const digits = (r * 10n ** 12n / den).toString().padStart(12, '0').replace(/0+$/, '');
  return { near: Number(near), exact: `${q}.${digits}` };
}

// A whole number of coins, or null. positive: 0 is null too.
export function parseAmount(word, { positive = false } = {}) {
  const r = readAmount(word);
  if (!r || r.amount === undefined) return null;
  if (positive && r.amount < 1) return null;
  return r.amount;
}

// Looks like someone meant a number ("2k", "1,000", "1.5", "-3", "1e6"),
// whether or not it is one. For telling an amount word from a name.
export const looksLikeAmount = (word) => /^[-+]?(?:\d[\d,]*(?:\.\d*)?|\.\d+)(?:e\d+|[kmbtq])?$/i.test(String(word || '').trim());

// Why a word that looks like an amount isn't one, for the note that says
// so: "1.2345k is 1234.5 coins. Coins are whole: try 1235." '' when there's
// nothing to add (it is a whole amount, or not a number at all).
export function amountTip(word) {
  const r = readAmount(word);
  if (!r || r.amount !== undefined) return '';
  return `${String(word).trim()} is ${r.exact} coins. Coins are whole: try ${Math.max(1, r.near)}.`;
}
