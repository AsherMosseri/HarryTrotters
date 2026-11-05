// How Jackson coin amounts are written, everywhere in the app. One of three
// styles, picked per device in Appearance → Coin numbers:
//   commas                1,234,567
//   plain                 1234567
//   short (the default)   1.2m   (999 · 1k · 1.1k · 82.2k · 2.3m · 1.5b · 2t
//                                · 11Qa · 3Qi · 1Sx · 1Sp · 1Oc · 1No · 1Dc · 1.2e36)
// Coins go up to a googol (3.1.5): Short names every -illion up to decillion
// (Dc, 1e33), then scientific with one decimal ("1.2e36"), and a googol or
// more is "1 googol". Commas and plain write every digit below 1e21 and
// scientific from there (toLocaleString gets silly). Past 2^53 (about 9
// quadrillion) numbers are approximate, so the note under a confirm says
// "About …" instead of "Exactly …".
// Short is for showing only: confirm dialogs (refunds, Send, loans, paying,
// coin requests) always write the exact number with commas (exactCoins).
// Negative amounts use the app's minus sign (−, U+2212), never a hyphen.
// No React here, so scripts/test-coin-format.mjs can run it in Node; the hook
// and the <CoinNum> component are in components/CoinNum.jsx.

import { SCI_FROM, sciText } from '../functions/shared/coinText.js';

export const COIN_STYLES = [
  ['commas', '1,234', 'With commas'],
  ['plain', '1234', 'No commas'],
  ['short', '1.2k', 'Short'],
];
const IDS = COIN_STYLES.map(([id]) => id);
export const MINUS = '−';
// Whole numbers are exact up to here (2^53); past it, approximate.
const EXACT_LIMIT = 2 ** 53;

// Whole coins (amounts are whole; animations pass in-between numbers).
const whole = (n) => Math.round(Math.abs(Number(n) || 0));
const commas = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// Every digit below 1e21 (String() would switch to "1e+21" there itself).
const digits = (v, withCommas) => (v >= SCI_FROM ? sciText(v) : withCommas ? commas(v) : String(v));

const UNITS = [
  [1e3, 'k'],
  [1e6, 'm'],
  [1e9, 'b'],
  [1e12, 't'],
  [1e15, 'Qa'],
  [1e18, 'Qi'],
  [1e21, 'Sx'],
  [1e24, 'Sp'],
  [1e27, 'Oc'],
  [1e30, 'No'],
  [1e33, 'Dc'],
];
// Past the last unit (999.95Dc rounds to 1000Dc): scientific.
const SHORT_SCI = 1e36;
// One decimal, rounded to nearest, without a trailing ".0". Rounding that
// reaches 1000 of a unit moves up a unit: 999,950 is "1m", never "1000k";
// and past decillions, to scientific ("1e36", "1.2e40"), then "1 googol".
function short(v) {
  if (v < 1000) return String(v);
  if (v >= SHORT_SCI) return sciText(v);
  let i = UNITS.length - 1;
  while (i > 0 && v < UNITS[i][0]) i--;
  // Tenths of the unit, from whole numbers so 1,050 rounds up to 1.1k.
  let tenths = Math.round(v / (UNITS[i][0] / 10));
  if (tenths >= 10000) {
    if (i === UNITS.length - 1) return sciText(v);
    i++;
    tenths = Math.round(v / (UNITS[i][0] / 10));
  }
  return `${tenths % 10 ? (tenths / 10).toFixed(1) : tenths / 10}${UNITS[i][1]}`;
}

// The number alone, in a style. Negative numbers keep their sign (−1.2k).
export function formatCoins(n, style = 'commas') {
  const v = whole(n);
  const body = style === 'short' ? short(v) : digits(v, style !== 'plain');
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
// Past 2^53 it says "About …" (the number is approximate).
export function coinTitle(n, style) {
  if (style !== 'short') return undefined;
  if (formatCoins(n, 'short') === formatCoins(n, 'plain')) return undefined;
  return whole(n) >= EXACT_LIMIT ? `About ${exactCoins(n)}` : exactCoins(n);
}

// A coin history line's label with its amount in a style. Labels are saved
// with the plain number ("Slots: lost 12345", "Won the lottery (1500 coins)")
// and stay that way (they are part of each line's key for reversing), so the
// known coin amounts in them are rewritten only when shown. Other numbers in
// a label (hours, streaks, names, notes) are left alone. From 1e21 the saved
// number is JavaScript's own scientific text ("won 2.5e+40").
const LABEL_NUM = '(\\d+(?:\\.\\d+)?e\\+?\\d+|\\d{4,})';
const LABEL_COINS = new RegExp(
  `(: won |: lost |, lost |\\(won |\\(lost |Heist: got away with |Prize wheel: \\+|^Gave |^Balance set to |Won the lottery \\()${LABEL_NUM}(?=$|\\)| coins\\)| each to | \\(capped)|^(Bet held: .+ )${LABEL_NUM}(?= \\(playing\\)$)`,
  'g',
);
export function coinLabel(label, style = 'commas') {
  return String(label ?? '').replace(LABEL_COINS, (m, a, n, b, n2) => (a ? a + formatCoins(n, style) : b + formatCoins(n2, style)));
}

// ---------- the setting (this device, localStorage "coin-format") ----------

const KEY = 'coin-format';
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return IDS.includes(v) ? v : 'short';
  } catch {
    return 'short';
  }
};
let current = typeof localStorage === 'undefined' ? 'short' : read();
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
export const coinStyled = (n) => formatCoins(n, current);
// Confirm dialogs show the number in this device's style; with Short, the
// exact amount goes on a line under it so nobody misreads 135.9b for 13.59b.
// Past 2^53 (about 9 quadrillion) it can't be exact: "About 11,000,000,000,000,000 coins."
export const exactNote = (n) => {
  const a = Math.abs(Number(n) || 0);
  if (current !== 'short' || formatCoins(a, 'short') === exactCoins(a)) return '';
  return `${whole(a) >= EXACT_LIMIT ? 'About' : 'Exactly'} ${exactCoins(a)} coins.`;
};
export const withExact = (text, n) => {
  const e = exactNote(n);
  return e ? `${text}\n${e}` : text;
};
