// Seeded randomness for games the server replays (Tetris, Minesweeper):
// integer math only (Math.imul, shifts), so a phone's Safari and the server's
// Node get exactly the same numbers from the same seed.

// A string → a 32-bit number.
export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32: next() → an integer 0 … 2^32-1; int(n) → 0 … n-1.
export function seeded(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  // Modulo of a 32-bit number: tiny bias, the same everywhere.
  const int = (n) => next() % n;
  return { next, int };
}

// The seed for one attempt of a shared game: everyone's 1st attempt gets the
// same pieces or board, everyone's 2nd attempt the same (different) ones…
export const attemptSeed = (seed, attempt) => (attempt > 1 ? `${seed}#${attempt}` : String(seed));

// A fresh random seed (not for replays; for starting a game).
export function newSeed() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}
