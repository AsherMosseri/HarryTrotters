// Small helpers shared by the question banks. Server-only: the banks hold the
// answers, so nothing under functions/banks may be imported by the app.

// 32-bit FNV-1a hash of a string, for stable seeds and orderings.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Deterministic random numbers in [0, 1) from a seed (mulberry32).
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hash(String(seed))) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, seed) {
  const out = [...list];
  const r = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A leading number ("20 points", "0:30", "-5"), or NaN.
function lead(s) {
  const m = String(s).match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

// Order choices the same way every time: numbers ascending (easier to read),
// anything else shuffled by the question's id. Returns { choices, answer }.
export function arrange(id, correctFirst) {
  const numeric = correctFirst.every((c) => !Number.isNaN(lead(c)));
  const tagged = correctFirst.map((text, i) => ({ text, ok: i === 0 }));
  const ordered = numeric ? [...tagged].sort((a, b) => lead(a.text) - lead(b.text) || a.text.localeCompare(b.text)) : shuffle(tagged, id);
  return { choices: ordered.map((c) => c.text), answer: ordered.findIndex((c) => c.ok) };
}

// Multiple choice: the correct choice is written first and moved by arrange().
export function mc(bank, id, difficulty, prompt, correctFirst, explain, source) {
  return { id, bank, kind: 'choice', difficulty, prompt, ...arrange(id, correctFirst), explain, source };
}

// True or false, always in that order.
export function tf(bank, id, difficulty, prompt, isTrue, explain, source) {
  return { id, bank, kind: 'choice', difficulty, prompt, choices: ['True', 'False'], answer: isTrue ? 0 : 1, explain, source };
}

// Round for display: at most `places` decimals, no trailing zeros.
export function round(n, places = 1) {
  const f = 10 ** places;
  return String(Math.round(n * f) / f);
}
