// The pet games (3.2), Pet Hop and Pet Rally:
// - Pet Hop: a scripted player passes gaps (several seeds and screen
//   shapes); no taps means a fall; the gap stays reachable and fair.
// - Pet Rally: every level's ground goes left to right, level 1 is finished
//   by just holding Gas, and every level is finished by a simple driver and
//   by a slower one (it reacts 0.15 s late, like a person), so all 10 can be
//   beaten; holding Gas alone flips on some later levels (they get harder).
// - Scores (shared/petgames.js, the server's checks): ranges, possible
//   times, levels in order, only a better best is written, the boards' order,
//   and the best of the phone's record and the server's.
// Run: node scripts/test-pet-games.mjs
import * as Hop from '../src/petgames/hop.js';
import * as Rally from '../src/petgames/rally.js';
import { RALLY_COUNT, RALLY_LEVELS, buildLevel } from '../functions/shared/petRally.js';
import * as S from '../functions/shared/petgames.js';

let failures = 0;
let passes = 0;
function ok(cond, label) {
  if (cond) passes++;
  else {
    failures++;
    console.log('FAIL', label);
  }
}

// ---------- Pet Hop ----------
for (const width of [46, 60, 100, 160])
  for (const seed of [1, 2, 3, 4]) {
    const g = Hop.newHop({ width, seed });
    for (let i = 0; i < 120 * 120 && g.status !== 'over' && g.score < 20; i++) Hop.step(g, Hop.botFlap(g) && i % 6 === 0);
    ok(g.score >= 5, `Hop: a scripted player passes gaps (width ${width}, seed ${seed}: ${g.score})`);
    for (const t of g.towers) {
      ok(t.bottom - t.top >= Hop.HOP.gapMin - 1e-9 && t.top >= Hop.HOP.margin - 1e-9 && t.bottom <= Hop.GROUND - Hop.HOP.margin + 1e-9, `Hop: a fair gap (${t.top.toFixed(1)}-${t.bottom.toFixed(1)})`);
    }
  }
{
  const g = Hop.newHop({ width: 60, seed: 9 });
  for (let i = 0; i < 600; i++) Hop.step(g, false);
  ok(g.status === 'ready', 'Hop: waits for the first tap');
  Hop.step(g, true);
  for (let i = 0; i < 600; i++) Hop.step(g, false);
  ok(g.status === 'over' && g.score === 0, 'Hop: no taps after the first, and it falls');
  const a = Hop.newHop({ width: 60, seed: 5 });
  const b = Hop.newHop({ width: 60, seed: 5 });
  for (let i = 0; i < 3000; i++) {
    Hop.step(a, Hop.botFlap(a) && i % 6 === 0);
    Hop.step(b, Hop.botFlap(b) && i % 6 === 0);
  }
  ok(a.score === b.score && a.y === b.y, 'Hop: the same seed and taps play the same');
}

// ---------- Pet Rally ----------
ok(RALLY_COUNT === 10 && RALLY_LEVELS.every((l, i) => l.id === i + 1 && l.name && l.tip), 'Rally: 10 named levels in order');
for (let n = 1; n <= RALLY_COUNT; n++) {
  const lv = buildLevel(n);
  ok(lv.pts.every((p, i) => i === 0 || p[0] > lv.pts[i - 1][0]), `Rally ${n}: the ground goes left to right`);
  ok(lv.flagX > lv.startX + 40 && lv.props.some((p) => p.kind === 'flag'), `Rally ${n}: a flag at the end`);
  const bot = Rally.simulate(lv);
  ok(bot.status === 'won', `Rally ${n}: a simple driver finishes (${bot.status} at ${bot.x.toFixed(1)} m, ${bot.ms} ms)`);
  const hist = [];
  const slow = Rally.simulate(lv, (car) => {
    hist.push(Rally.botInput(car));
    return hist[Math.max(0, hist.length - 36)];
  });
  ok(slow.status === 'won', `Rally ${n}: a driver 0.15 s late finishes too (${slow.status} at ${slow.x.toFixed(1)} m)`);
  ok(bot.ms >= S.rallyMinMs(n) * 2, `Rally ${n}: a real time is well over the server's floor (${bot.ms} vs ${S.rallyMinMs(n)} ms)`);
}
{
  const one = Rally.simulate(buildLevel(1), () => ({ gas: true }));
  ok(one.status === 'won' && one.ms < 15000, `Rally 1: holding Gas reaches the flag (${one.ms} ms)`);
  const hard = [6, 8, 9, 10].filter((n) => Rally.simulate(buildLevel(n), () => ({ gas: true })).status !== 'won');
  ok(hard.length >= 3, `Rally: holding Gas alone fails on the hard levels (${hard.join(', ')})`);
  // Resting car: settles on its wheels, level, without creeping.
  const lv = buildLevel(1);
  const car = Rally.newCar(lv);
  car.status = 'go';
  for (let i = 0; i < 960; i++) Rally.step(car, lv, {});
  ok(Math.abs(car.a) < 0.02 && Math.abs(car.x - lv.startX) < 0.05 && car.status === 'go', `Rally: a parked car stays put (x ${car.x.toFixed(3)}, angle ${car.a.toFixed(3)})`);
  // Upside down on the ground: flipped.
  const up = Rally.newCar(lv);
  up.status = 'go';
  up.a = Math.PI;
  up.y = 1.1;
  for (let i = 0; i < 240 && up.status === 'go'; i++) Rally.step(up, lv, {});
  ok(up.status === 'flipped', `Rally: landing on its head ends the run (${up.status})`);
  // Into the water.
  const pit = buildLevel(7);
  const [x0, x1] = pit.water[0];
  const wet = Rally.newCar(pit);
  wet.status = 'go';
  wet.x = (x0 + x1) / 2;
  wet.y = 0.5;
  wet.wheels.forEach((w, i) => Object.assign(w, { x: wet.x + (i ? 0.82 : -0.82), y: 0.14 }));
  for (let i = 0; i < 480 && wet.status === 'go'; i++) Rally.step(wet, pit, {});
  ok(wet.status === 'splash', `Rally: falling in the pit is a splash (${wet.status})`);
  // Nothing moves before the first press.
  const idle = Rally.newCar(lv);
  for (let i = 0; i < 240; i++) Rally.step(idle, lv, {});
  ok(idle.status === 'ready' && idle.t === 0, 'Rally: the clock starts with the first press');
}

// ---------- scores ----------
const bad = (x) => !!x.note;
ok(bad(S.cleanScore({ game: 'chess', value: 3 })), 'Scores: unknown game refused');
ok(bad(S.cleanScore({ game: 'hop', value: 0 })) && bad(S.cleanScore({ game: 'hop', value: 1000 })) && bad(S.cleanScore({ game: 'hop', value: 2.5 })) && bad(S.cleanScore({ game: 'hop', value: '9' })), 'Scores: Hop out of range or not a whole number refused');
ok(S.cleanScore({ game: 'hop', value: 999 }).value === 999, 'Scores: Hop 999 is fine');
ok(bad(S.cleanScore({ game: 'rally', level: 11, value: 20000 })) && bad(S.cleanScore({ game: 'rally', level: 0, value: 20000 })), 'Scores: Rally level out of range refused');
ok(bad(S.cleanScore({ game: 'rally', level: 1, value: S.rallyMinMs(1) - 1 })) && bad(S.cleanScore({ game: 'rally', level: 1, value: S.RALLY_MAX_MS + 1 })), 'Scores: impossible Rally times refused');
ok(S.cleanScore({ game: 'rally', level: 1, value: 7900 }).value === 7900, 'Scores: a real Rally time is fine');
{
  const me = 'Ira Kumar';
  let r = S.scoreAfter(null, { game: 'hop', level: 0, value: 12 }, { me, now: 1 });
  ok(r.better && r.doc.hop.best === 12 && r.doc.person === me, 'Scores: a first Hop best');
  r = S.scoreAfter(r.doc, { game: 'hop', level: 0, value: 8 }, { me, now: 2 });
  ok(!r.better && r.doc.hop.best === 12, 'Scores: a lower Hop score keeps the best');
  ok(bad(S.scoreAfter(r.doc, { game: 'rally', level: 2, value: 12000 }, { me })), 'Scores: Rally level 2 needs level 1 first');
  r = S.scoreAfter(r.doc, { game: 'rally', level: 1, value: 9000 }, { me, now: 3 });
  ok(r.better && r.doc.rally['1'].ms === 9000 && r.doc.hop.best === 12, 'Scores: Rally level 1 kept beside Hop');
  r = S.scoreAfter(r.doc, { game: 'rally', level: 1, value: 9500 }, { me, now: 4 });
  ok(!r.better, 'Scores: a slower time keeps the best');
  r = S.scoreAfter(r.doc, { game: 'rally', level: 2, value: 12000 }, { me, now: 5 });
  ok(r.better && S.rallyCleared(S.mergeBests(r.doc).rally) === 2, 'Scores: level 2 after level 1');
}
{
  const docs = [
    { person: 'A', hop: { best: 10, at: 5 }, rally: { 1: { ms: 9000, at: 1 }, 2: { ms: 12000, at: 2 } } },
    { person: 'B', hop: { best: 10, at: 3 }, rally: { 1: { ms: 8000, at: 1 }, 2: { ms: 12500, at: 2 } } },
    { person: 'Old C', hop: { best: 30, at: 9 }, rally: { 1: { ms: 7000, at: 1 }, 3: { ms: 5000, at: 1 } } },
    { person: 'D', hop: null, rally: {} },
  ];
  const rename = (n) => (n === 'Old C' ? 'C' : n);
  const hop = S.boardOf(docs, 'hop', { rename });
  ok(hop.map((r) => r.name).join() === 'C,B,A', `Boards: Hop highest first, a tie to whoever got there first (${hop.map((r) => r.name)})`);
  const rally = S.boardOf(docs, 'rally', { rename });
  ok(rally.map((r) => `${r.name}${r.cleared}`).join() === 'B2,A2,C1', `Boards: Rally by levels in a row, then total time (${rally.map((r) => `${r.name}${r.cleared}:${r.total}`)})`);
  const m = S.mergeBests({ hop: 5, rally: { 1: 9000 } }, { hop: { best: 7 }, rally: { 1: { ms: 9500 }, 2: { ms: 11000 } } });
  ok(m.hop === 7 && m.rally['1'] === 9000 && m.rally['2'] === 11000, 'Bests: the phone and the server, the better of each');
  ok(S.rallyTime(7912) === '7.91 s' && S.rallyTime(62500) === '1:02.50', 'Times read like 7.91 s and 1:02.50');
}

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL OK (${passes} checks)`);
process.exit(failures ? 1 : 0);
