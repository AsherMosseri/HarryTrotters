// The full emoji list (src/data/emoji.json) loads on first use: entries are
// [emoji, shortcodes[], group, search words].
export const GROUPS = ['Smileys', 'People', 'Nature', 'Food', 'Travel', 'Activities', 'Objects', 'Symbols', 'Flags'];
export const GROUP_ICONS = ['😀', '👋', '🐶', '🍕', '🚗', '⚽', '💡', '❤️', '🏁'];

let list = null;
let loading = null;
export function loadEmoji() {
  loading ||= import('../../data/emoji.json').then((m) => (list = m.default));
  return loading;
}
export const emojiList = () => list;

// Shortcode or keyword search: exact shortcode first, then prefixes, then words.
export function searchEmoji(q, max = 40) {
  if (!list) return [];
  const query = q.toLowerCase().replace(/^:/, '');
  if (!query) return [];
  const scored = [];
  for (const [char, codes, , words] of list) {
    let score = 0;
    if (codes.includes(query)) score = 4;
    else if (codes.some((c) => c.startsWith(query))) score = 3;
    else if (codes.some((c) => c.includes(query))) score = 2;
    else if (words.includes(query)) score = 1;
    if (score) scored.push({ char, code: codes[0] || '', score });
  }
  // Best match first; among equals, the shorter shortcode (:fire: before :firefighter:).
  return scored.sort((a, b) => b.score - a.score || a.code.length - b.code.length).slice(0, max);
}

// The first emoji typed into a box (from the emoji keyboard or Globe + E),
// whole, with skin tones, flags, and ZWJ sequences kept together.
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣/u;
export function firstEmoji(text) {
  if (!text || !EMOJI_RE.test(text)) return null;
  const parts =
    typeof Intl !== 'undefined' && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment)
      : Array.from(text);
  return parts.find((g) => EMOJI_RE.test(g)) || null;
}

// Recently used, per device.
const RECENT_KEY = 'ftc32313-recent-emoji';
export function recentEmoji() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}
export function rememberEmoji(e) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...recentEmoji().filter((x) => x !== e)].slice(0, 24)));
  } catch {
    /* private mode */
  }
}

// Custom team emoji are written :name: in text and reactions.
export const CUSTOM_RE = /^:([a-z0-9_]{2,32}):$/;
