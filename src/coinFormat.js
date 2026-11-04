// How Jackson coin amounts are written, everywhere in the app. One of three
// styles, picked per device in Appearance → Coin numbers:
//   commas (the default)  1,234,567
//   plain                 1234567
//   short                 1.2m   (999 · 1k · 1.1k · 82.2k · 2.3m · 1.5b)
// Short is for showing only: confirm dialogs (refunds, Send, loans, paying,
// coin requests) always write the exact number with commas (exactCoins).
// Negative amounts use the app's minus sign (−, U+2212), never a hyphen.
// No React here, so scripts/test-coin-format.mjs can run it in Node; the hook
// and the <CoinNum> component are in components/CoinNum.jsx.

export const COIN_STYLES = [
  ['commas', '1,234', 'With commas'],
  ['plain', '1234', 'No commas'],
  ['short', '1.2k', 'Short'],
];
const IDS = COIN_STYLES.map(([id]) => id);
export const MINUS = '−';

// Whole coins (amounts are whole; animations pass in-between numbers).
const whole = (n) => Math.round(Math.abs(Number(n) || 0));
const commas = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const UNITS = [
  [1e3, 'k'],
  [1e6, 'm'],
  [1e9, 'b'],
  [1e12, 't'],
];
// One decimal, rounded to nearest, without a trailing ".0". Rounding that
// reaches 1000 of a unit moves up a unit: 999,950 is "1m", never "1000k".
function short(v) {
  if (v < 1000) return String(v);
  let i = UNITS.length - 1;
  while (i > 0 && v < UNITS[i][0]) i--;
  // Tenths of the unit, from whole numbers so 1,050 rounds up to 1.1k.
  let tenths = Math.round(v / (UNITS[i][0] / 10));
  if (tenths >= 10000 && i < UNITS.length - 1) {
    i++;
    tenths = Math.round(v / (UNITS[i][0] / 10));
  }
  return `${tenths % 10 ? (tenths / 10).toFixed(1) : tenths / 10}${UNITS[i][1]}`;
}

// The number alone, in a style. Negative numbers keep their sign (−1.2k).
export function formatCoins(n, style = 'commas') {
  const v = whole(n);
  const body = style === 'short' ? short(v) : style === 'plain' ? String(v) : commas(v);
  return Number(n) < 0 && v !== 0 ? `${MINUS}${body}` : body;
}

// With its sign for history lines: +1,234 · −1,234 · 0.
export function signedCoins(n, style = 'commas') {
  const v = whole(n);
  if (!v) return '0';
  return `${Number(n) > 0 ? '+' : MINUS}${formatCoins(v, style)}`;
}

// The exact amount with commas, whatever the style (confirm dialogs, hover).
export const exactCoins = (n) => formatCoins(n, 'commas');

// The exact number for a hover/long-press title, only when the style hides it
// (short, and the short text isn't already exact).
export function coinTitle(n, style) {
  if (style !== 'short') return undefined;
  return formatCoins(n, 'short') === formatCoins(n, 'plain') ? undefined : exactCoins(n);
}

// ---------- the setting (this device, localStorage "coin-format") ----------

const KEY = 'coin-format';
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return IDS.includes(v) ? v : 'commas';
  } catch {
    return 'commas';
  }
};
let current = typeof localStorage === 'undefined' ? 'commas' : read();
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

export const getCoinStyle = () => current;
export function setCoinStyle(style) {
  if (!IDS.includes(style) || style === current) return;
  current = style;
  try {
    localStorage.setItem(KEY, JSON.stringify(style));
  } catch {
    /* storage unavailable: still changes for this visit */
  }
  emit();
}
export function subscribeCoinStyle(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}
// Another tab on this device changed it.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const next = read();
    if (next !== current) {
      current = next;
      emit();
    }
  });

// For text built outside React components (toasts, card lines): the number
// in this device's style right now.
export const coinText = (n) => formatCoins(n, current);
