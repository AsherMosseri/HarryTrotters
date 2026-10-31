// Battleship: the board rules and Trotbot's aim. arcade.js runs the game
// (turns, timers, bets) and keeps everyone's ships in the game's secret, so
// nobody's phone ever has the other player's fleet.
//
// 10×10, the classic fleet (carrier 5, battleship 4, cruiser 3, submarine 3,
// destroyer 2). Ships can touch but not overlap. One shot a turn.

export const N = 10;
export const FLEET = [
  ['Carrier', 5],
  ['Battleship', 4],
  ['Cruiser', 3],
  ['Submarine', 3],
  ['Destroyer', 2],
];
export const CELLS = FLEET.reduce((t, [, n]) => t + n, 0);

// A ship at (x, y), across or down → its cells, or null if it's off the board.
export function shipCells(x, y, down, len) {
  const out = [];
  for (let k = 0; k < len; k++) {
    const cx = down ? x : x + k;
    const cy = down ? y + k : y;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return null;
    out.push(cy * N + cx);
  }
  return out;
}

// "x,y,d;x,y,d;…" (one per ship, fleet order, d = 1 for down) → the fleet as
// lists of cells, or null if it isn't a legal placement.
export function parseFleet(text) {
  const parts = String(text || '').split(';');
  if (parts.length !== FLEET.length) return null;
  const used = new Set();
  const ships = [];
  for (let k = 0; k < FLEET.length; k++) {
    const m = /^(\d),(\d),([01])$/.exec(parts[k]);
    if (!m) return null;
    const cells = shipCells(+m[1], +m[2], m[3] === '1', FLEET[k][1]);
    if (!cells || cells.some((c) => used.has(c))) return null;
    cells.forEach((c) => used.add(c));
    ships.push(cells);
  }
  return ships;
}
export function fleetText(ships) {
  return ships
    .map((cells) => {
      const down = cells.length > 1 && cells[1] - cells[0] === N;
      return `${cells[0] % N},${Math.floor(cells[0] / N)},${down ? 1 : 0}`;
    })
    .join(';');
}

// A random legal fleet.
export function randomFleet(rng = Math.random) {
  for (;;) {
    const used = new Set();
    const ships = [];
    for (const [, len] of FLEET) {
      let cells = null;
      for (let tries = 0; tries < 200 && !cells; tries++) {
        const down = rng() < 0.5;
        const c = shipCells(Math.floor(rng() * N), Math.floor(rng() * N), down, len);
        if (c && !c.some((x) => used.has(x))) cells = c;
      }
      if (!cells) break;
      cells.forEach((x) => used.add(x));
      ships.push(cells);
    }
    if (ships.length === FLEET.length) return ships;
  }
}

// Shots on one board: a string of N*N, '.' not shot, 'o' miss, 'x' hit.
export const emptyShots = () => '.'.repeat(N * N);

// Fire at cell i of a fleet. Returns { shots, hit, sunk (ship index or -1), all (every ship sunk) }.
export function fire(shots, ships, i) {
  const hit = ships.some((s) => s.includes(i));
  const next = shots.slice(0, i) + (hit ? 'x' : 'o') + shots.slice(i + 1);
  const k = hit ? ships.findIndex((s) => s.includes(i)) : -1;
  const sunk = k >= 0 && ships[k].every((c) => next[c] === 'x') ? k : -1;
  const all = ships.every((s) => s.every((c) => next[c] === 'x'));
  return { shots: next, hit, sunk, all };
}

// ---------- Trotbot's aim ----------

// Probability density: for every ship still afloat, count the places it could
// be (not over a miss or a sunk ship). Hits that aren't part of a sunk ship
// yet pull hard toward the cells next to them (target mode); with none, the
// count alone finds the likeliest cell (hunt mode). sunk: the cells of ships
// already sunk; left: the lengths still afloat.
export function botAim(shots, sunkCells, left, rng = Math.random, sloppy = 0.4) {
  const sunk = new Set(sunkCells);
  const open = [];
  for (let i = 0; i < N * N; i++) if (shots[i] === 'x' && !sunk.has(i)) open.push(i);
  const score = new Array(N * N).fill(0);
  for (const len of left)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        for (const down of [false, true]) {
          const cells = shipCells(x, y, down, len);
          if (!cells || cells.some((c) => shots[c] === 'o' || sunk.has(c))) continue;
          const covers = cells.filter((c) => shots[c] === 'x').length;
          if (open.length && !covers) continue;
          const w = open.length ? 1 + 20 * covers : 1;
          for (const c of cells) if (shots[c] === '.') score[c] += w;
        }
  const free = [];
  for (let i = 0; i < N * N; i++) if (shots[i] === '.') free.push(i);
  // Now and then, while hunting, it fires on a hunch (so it can be beaten).
  if (!open.length && rng() < sloppy) {
    const even = free.filter((i) => (i % N) % 2 === Math.floor(i / N) % 2);
    const from = even.length ? even : free;
    return from[Math.floor(rng() * from.length)];
  }
  let best = -1;
  let pick = [];
  for (const i of free) {
    if (score[i] > best) {
      best = score[i];
      pick = [i];
    } else if (score[i] === best) pick.push(i);
  }
  return pick[Math.floor(rng() * pick.length)];
}
