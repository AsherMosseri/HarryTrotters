// A Jackson coin amount in text the server writes (notifications, notes,
// loan lines): with commas, like the app's default (1,234,567). The app's
// own Coin numbers setting (src/coinFormat.js) only changes what it draws.
// Anything that isn't a number is written as it was.
// Coins go up to a googol (3.1.5). From 1e21 up, writing every digit gets
// silly (and past 2^53 the digits aren't exact anyway), so it's scientific
// with one decimal ("2.5e40"), and a googol or more is "1 googol".
export const GOOGOL = 1e100;
export const SCI_FROM = 1e21;

// A big number (0 or more) in scientific notation, one decimal, no ".0":
// 1.2e36, 1e21. A googol or more: "1 googol".
export function sciText(v) {
  if (v >= GOOGOL) return '1 googol';
  const [m, e] = v.toExponential(1).split('e');
  // toExponential rounds 9.96e40 up to "1.0e+41" itself.
  return `${m.replace(/\.0$/, '')}e${Number(e)}`;
}

export const coinsText = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
  return Math.abs(n) >= SCI_FROM ? `${n < 0 ? '-' : ''}${sciText(Math.abs(n))}` : n.toLocaleString('en-US');
};
