// Pet battles (3.3), functions/shared/battles.js:
// - every kind of pet has its own four moves, the same shape, our own names
// - the numbers: health and hits by level, attacks, shields, dodges, heals,
//   dazes (a skipped turn), "not twice in a row"
// - a battle through move(): accept, picks hidden until both are in, a
//   round worked out, a second pick refused, only the two players pick,
//   timeouts with picks made for them, a late pick, the 12-round end, draws,
//   giving up, a pet that's gone
// - bets: held, paid once, back on a draw, decline, cancel, timeout or a pet
//   gone; exact for huge numbers
// - starting: the words, the checks (pets, coins off, day limit…)
// - records and the Battles board; the owner's refund numbers
// - the balance: thousands of random battles, no kind of pet ahead of the field
// Run: node scripts/test-battles.mjs
import * as B from '../functions/shared/battles.js';
import * as arcade from '../functions/shared/arcade.js';
import { SPECIES, newPet } from '../functions/shared/pets.js';
import { seeded } from '../functions/shared/rng.js';
import { buddyBlocks } from '../functions/shared/buddy.js';
import { cardNets, FIXABLE } from '../functions/shared/disputes.js';
import { capMoney, moneyLine } from '../functions/shared/arcade.js';
import { SHIFT_GAMES, SERVER_COMMANDS, bankAfter } from '../functions/shared/casino.js';
import { serverGroup, arcadeOnly } from '../functions/shared/commandRules.js';

let passes = 0;
let failures = 0;
function ok(cond, label) {
  if (cond) passes++;
  else {
    failures++;
    console.log('FAIL', label);
  }
}
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const rngOf = (seed) => {
  const r = seeded(seed);
  return () => r.next() / 2 ** 32;
};
// A fixed list of numbers, then 0.5 forever.
const seq = (...xs) => {
  let i = 0;
  return () => (i < xs.length ? xs[i++] : 0.5);
};

// ---------- move sets ----------
const kinds = Object.keys(B.KINDS);
for (const s of SPECIES) {
  const set = B.MOVES[s.id];
  ok(Array.isArray(set) && set.length === 4, `${s.id}: four moves of its own`);
  if (!set) continue;
  ok(set.every(([n, k]) => typeof n === 'string' && n.length >= 3 && n.length <= 24 && kinds.includes(k)), `${s.id}: names and kinds are real`);
  ok(new Set(set.map(([n]) => n.toLowerCase())).size === 4, `${s.id}: four different names`);
  // The same shape for everyone: an attack, a shield/dodge/heal, a dazing or heavy attack, a shield/dodge/heal.
  ok(['hit', 'strong', 'sure'].includes(set[0][1]), `${s.id}: starts with an attack`);
  ok(['guard', 'dodge', 'heal'].includes(set[1][1]) && ['guard', 'dodge', 'heal'].includes(set[3][1]) && set[1][1] !== set[3][1], `${s.id}: two different helpers`);
  ok(['daze', 'big'].includes(set[2][1]), `${s.id}: a dazing or heavy attack at level 10`);
}
ok(Object.keys(B.MOVES).every((id) => SPECIES.some((s) => s.id === id)), 'no moves for a kind of pet that does not exist');
eq(B.movesOf('dragon').map((m) => m.name), B.DEFAULT_MOVES.map(([n]) => n), 'a kind of pet added later gets the default moves');
// Our own names: none of the well-known names from that other game.
const theirs = ['tackle', 'scratch', 'headbutt', 'bite', 'quick attack', 'protect', 'recover', 'rest', 'agility', 'double team', 'hyper beam', 'peck', 'drill peck', 'hypnosis', 'sing', 'splash', 'charm', 'thunder wave', 'growl', 'tail whip', 'ember', 'water gun', 'vine whip', 'thunderbolt', 'pound', 'harden', 'leer', 'synthesis'];
const allNames = [...Object.values(B.MOVES).flat(), ...B.DEFAULT_MOVES].map(([n]) => n.toLowerCase());
ok(!allNames.some((n) => theirs.includes(n)), 'no borrowed move names');
eq(B.UNLOCK, [1, 1, 10, 25], 'two moves to start, then levels 10 and 25');
eq(B.unlockedMoves('goat', 1).length, 2, 'level 1: two moves');
eq(B.unlockedMoves('goat', 9).length, 2, 'level 9: still two');
eq(B.unlockedMoves('goat', 10).length, 3, 'level 10: three');
eq(B.unlockedMoves('goat', 25).length, 4, 'level 25: all four');
eq(B.nextMove('goat', 3)?.level, 10, 'the next move comes at 10');
ok(B.moveTip(B.movesOf('cat')[0], 1).includes('14 power'), 'a tip says the power');

// ---------- the numbers ----------
ok(B.mult(1) === 1 && B.mult(10) > B.mult(5) && B.mult(100) > B.mult(50), 'stronger with level');
ok(B.mult(100) < 1.3, 'but only a little (under 1.3x at level 100)');
eq([B.maxHp(1), B.maxHp(10), B.maxHp(100)], [100, 114, 128], 'full health by level');
eq(B.maxHp(0), 100, 'a level under 1 is level 1');
eq(B.maxHp(500), B.maxHp(100), 'a level over 100 is 100');
const side = (species, level = 1, name = 'Pet', born = 1) => B.sideOf({ ...newPet(species, name, born) }, level);
{
  const s = side('cat', 10, 'Mochi', 7);
  eq([s.born, s.name, s.species, s.level, s.hp, s.max, s.last, s.skip], [7, 'Mochi', 'cat', 10, 114, 114, -1, 0], 'a side as it starts');
}
// An attack: hits (rng 0 < acc), no crit (0.9 > 1/16), variance at 0.5 → 1.0x.
{
  const a = side('cat');
  const b = side('dog');
  const r = B.resolveRound(a, b, [0, 0], 1, seq(0, 0.9, 0.5, 0, 0.9, 0.5));
  eq([r.log.a.out, r.log.a.dmg, r.log.b.out, r.log.b.dmg], ['hit', 14, 'hit', 14], 'two attacks: 14 each at level 1');
  eq(r.log.hp, [86, 86], 'both lose 14');
  eq([r.a.last, r.b.last], [0, 0], 'each remembers its move');
}
{
  // A miss: the first number is over the move's chance to land.
  const r = B.resolveRound(side('cat'), side('dog'), [0, 1], 1, seq(0.99));
  eq(r.log.a.out, 'miss', 'a miss');
  eq(r.log.hp, [100, 100], 'a miss does nothing');
  eq(r.log.b.out, 'guard', 'the other put up a shield');
}
{
  // A shield: 70% of the hit stopped, 7 bounced back.
  const r = B.resolveRound(side('cat'), side('dog'), [0, 1], 1, seq(0, 0.9, 0.5, 0.5));
  eq([r.log.a.out, r.log.a.dmg, r.log.b.back], ['blocked', 4, 7], 'through a shield: 4 damage, 7 back');
  eq(r.log.hp, [93, 96], 'the attacker takes the bounce');
}
{
  // A dodge that works, and the quick hit back.
  const r = B.resolveRound(side('dog'), side('cat'), [0, 1], 1, seq(0, 0.1, 0.5));
  eq([r.log.a.out, r.log.b.out, r.log.b.back], ['dodged', 'dodge', 9], 'a dodge: no damage, 9 back');
  eq(r.log.hp, [91, 100], 'only the attacker is hurt');
  // A dodge that doesn't (0.9 > 70%).
  const r2 = B.resolveRound(side('dog'), side('cat'), [0, 1], 1, seq(0, 0.9, 0.9, 0.5));
  eq([r2.log.a.out, r2.log.a.dmg], ['hit', 14], 'a dodge can fail');
}
{
  // A heal: 11% of full health, never past full.
  const hurt = { ...side('redpanda'), hp: 50 };
  const r = B.resolveRound(hurt, side('cat'), [1, 1], 1, seq());
  eq([r.log.a.out, r.log.a.healed, r.a.hp], ['heal', 11, 61], 'a heal: 11 back');
  const r2 = B.resolveRound({ ...side('redpanda'), hp: 95 }, side('cat'), [1, 1], 1, seq());
  eq([r2.log.a.healed, r2.a.hp], [5, 100], 'a heal stops at full');
  ok(B.partLine(r2.log.a, side('redpanda', 1, 'Red'), side('cat')).includes('5 health back'), 'its line');
  // Heals come first: a heal and a hit in the same round.
  const r3 = B.resolveRound({ ...side('redpanda'), hp: 10 }, side('cat'), [1, 0], 1, seq(0, 0.9, 0.5));
  eq(r3.a.hp, 7, 'healed to 21, then hit for 14');
}
{
  // A daze: the other pet skips the next round, and can't be dazed again right away.
  const a = side('cat', 10);
  const b = side('dog', 10);
  const r = B.resolveRound(a, b, [2, 0], 1, seq(0, 0.9, 0.5, 0.1, 0, 0.9, 0.5));
  ok(r.log.a.dazes && r.b.skip === 2 && r.b.dazed === 2, 'a daze lands: skips round 2');
  eq(B.canPick(r.b, 2), [], 'a dazed pet has no moves to pick in round 2');
  eq(B.autoPick(r.b, 2), -1, 'and nothing is picked for it');
  const r2 = B.resolveRound(r.a, r.b, [0, 0], 2, seq(0, 0.9, 0.5));
  eq(r2.log.b.out, 'dazed', 'it sits round 2 out');
  ok(B.partLine(r2.log.b, r.b, r.a).includes('dazed'), 'its line says so');
  const r3 = B.resolveRound(r2.a, r2.b, [2, 0], 3, seq(0, 0.9, 0.5, 0.01, 0, 0.9, 0.5));
  ok(!r3.log.a.dazes && r3.b.skip !== 4, 'no daze the round right after');
  const r4 = B.resolveRound(r3.a, r3.b, [2, 0], 4, seq(0, 0.9, 0.5, 0.01, 0, 0.9, 0.5));
  ok(r4.log.a.dazes, 'then it can be dazed again');
}
{
  // Not twice in a row: shields, dodges and heals.
  const d = { ...side('dog'), last: 1 };
  eq(B.canPick(d, 2), [0], 'a shield right after a shield: no');
  eq(B.canPick({ ...d, last: 0 }, 2), [0, 1], 'after an attack: yes');
  eq(B.canPick({ ...side('dog', 25), last: 0 }, 2), [0, 1, 2, 3], 'attacks can go again and again');
}
{
  // A great hit (1 in 16): half again.
  const r = B.resolveRound(side('cat'), side('dog'), [0, 1], 1, seq(0, 0.01, 0.5, 0.9, 0.5, 0.5));
  ok(r.log.a.crit === true, 'a great hit');
}
{
  // Level: a level 50 cat hits harder than a level 1 cat.
  const lo = B.resolveRound(side('cat', 1), side('dog'), [0, -1], 1, seq(0, 0.9, 0.5)).log.a.dmg;
  const hi = B.resolveRound(side('cat', 50), side('dog'), [0, -1], 1, seq(0, 0.9, 0.5)).log.a.dmg;
  ok(hi > lo && hi <= Math.round(lo * 1.3), `a higher level hits a bit harder (${lo} → ${hi})`);
}
eq(B.ahead({ hp: 50, max: 100 }, { hp: 57, max: 114 }), 0, 'the same share of health: even');
eq(B.ahead({ hp: 51, max: 100 }, { hp: 57, max: 114 }), 1, 'a bigger share wins');

// ---------- a battle through move() ----------
const T0 = Date.parse('2026-11-20T17:00:00Z');
const roster = ['Ira Harrison', 'Cooper Mlezcko', 'Asher Mosseri'];
const petsFor = (species, level, born, name = species) => [{ pet: newPet(species, name, born), level }];
function startBattle({ bet = 0, levels = [5, 5], species = ['goat', 'owl'], balance = 1000, peerBalance = 1000, now = T0 } = {}) {
  const words = ['@Ira', ...(bet ? [String(bet)] : [])];
  return B.start({
    me: 'Cooper Mlezcko',
    words,
    roster,
    balance,
    bank: {},
    now,
    myPets: petsFor(species[0], levels[0], 111, 'Billy'),
    peer: { name: 'Ira Harrison', active: true, balance: peerBalance, pets: petsFor(species[1], levels[1], 222, 'Hoot') },
  });
}
const C = 'Cooper Mlezcko';
const I = 'Ira Harrison';
{
  const s = startBattle({ bet: 50 });
  ok(!s.error, 'a battle starts');
  eq([s.pub.a, s.pub.b, s.pub.bet, s.pub.status, s.pub.pa.name, s.pub.pb.name, s.pub.pa.born, s.pub.pb.born], [C, I, 50, 'open', 'Billy', 'Hoot', 111, 222], 'the card');
  eq(s.money, [{ name: C, delta: -50, entry: null, extra: { btDay: { day: '2026-11-20', n: 1 } } }], 'the challenger’s bet is held');
  eq(s.mentions, [I], 'Ira is told');
  ok(s.open === true, 'it counts as one waiting');
  eq(moneyLine(s.money[0], 'battle', 'card1').label, 'Bet held: Pet battle 50 (playing)', 'the held line');
  // Only Ira can accept; Cooper waits; others can't.
  ok(B.move({ pub: s.pub, secret: s.secret, me: C, move: 'accept', now: T0 }).error, 'the challenger can’t accept');
  ok(B.move({ pub: s.pub, secret: s.secret, me: 'Asher Mosseri', move: 'accept', now: T0 }).error, 'nobody else can accept');
  ok(/50 coin bet/.test(B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', balance: 49, now: T0 }).error), 'Ira needs the bet');
  const acc = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', balance: 50, now: T0 + 1000 });
  eq([acc.pub.status, acc.pub.round, acc.pub.roundEnds], ['playing', 1, T0 + 1000 + B.ROUND_MS], 'accepted: round 1, 45 s');
  eq(acc.money, [{ name: I, delta: -50, entry: null }], 'Ira’s bet is held');
  // Cooper picks: hidden in the secret, only his name is on the card.
  const p1 = B.move({ pub: acc.pub, secret: acc.secret, me: C, move: 'm0', now: T0 + 2000 });
  eq([p1.pub.picked, p1.secret.picks[C], p1.pub.log.length], [[C], 0, 0], 'a pick: hidden, just “Cooper picked”');
  ok(!JSON.stringify(p1.pub).includes('"picks"'), 'no pick on the card');
  ok(/already picked/.test(B.move({ pub: p1.pub, secret: p1.secret, me: C, move: 'm1', now: T0 + 2100 }).error), 'a second pick (another device, a double tap) is refused');
  ok(/not in this battle/.test(B.move({ pub: p1.pub, secret: p1.secret, me: 'Asher Mosseri', move: 'm0', now: T0 + 2100 }).error), 'someone else can’t pick');
  ok(/learned/.test(B.move({ pub: p1.pub, secret: p1.secret, me: I, move: 'm3', now: T0 + 2100 }).error), 'a move not learned yet is refused');
  ok(/Pick a move/.test(B.move({ pub: p1.pub, secret: p1.secret, me: I, move: 'm9', now: T0 + 2100 }).error), 'not a move');
  // Ira picks: the round is worked out at once.
  const p2 = B.move({ pub: p1.pub, secret: p1.secret, me: I, move: 'm0', now: T0 + 3000, rng: rngOf(1) });
  eq([p2.pub.round, p2.pub.log.length, p2.pub.picked, p2.secret.picks], [2, 1, [], {}], 'both in: round 1 done, round 2 open');
  eq(p2.pub.roundEnds, T0 + 3000 + B.ROUND_MS, 'the next round has its own 45 s');
  eq(p2.pub.log[0].a.m, 0, 'the log has Cooper’s move');
  ok(p2.pub.n > p1.pub.n, 'every change counts up (n)');
  // Play on to the end with attacks only, and pay once.
  let st = p2;
  let t = T0 + 4000;
  const r = rngOf(9);
  while (st.pub.status === 'playing') {
    const k = st.pub.round;
    st = B.move({ pub: st.pub, secret: st.secret, me: C, move: 'm0', now: t, rng: r });
    if (st.pub.status !== 'playing' || st.pub.round !== k) break;
    st = B.move({ pub: st.pub, secret: st.secret, me: I, move: 'm0', now: t + 10, rng: r });
    t += 1000;
  }
  eq(st.pub.status, 'done', 'it ends');
  ok(['ko', 'rounds'].includes(st.pub.how), `by a knockout or 12 rounds (${st.pub.how})`);
  const w = st.pub.winner;
  if (w) {
    const lose = w === C ? I : C;
    eq(st.money.map((x) => [x.name, x.delta, x.entry.shown]), [[w, 100, 50], [lose, 0, -50]], 'the winner takes both bets');
    ok(st.money[0].entry.label === `Pet battle with ${lose}: won 50`, `the history line (${st.money[0].entry.label})`);
    ok(st.money[1].entry.label === `Pet battle with ${w}: lost 50`, 'and the loser’s');
    eq(B.recordOf(st.pub), w === C ? { a: 'w', b: 'l' } : { a: 'l', b: 'w' }, 'the records');
  }
  const again = B.move({ pub: st.pub, secret: st.secret, me: C, move: 'm0', now: t + 5000 });
  ok(again.write === false && again.money.length === 0, 'a move after the end does nothing (paid once)');
  ok(B.move({ pub: st.pub, secret: st.secret, me: '', move: 'peek', now: t + 99999 }).write === false, 'a late peek does nothing');
  ok(B.endLine(st.pub).length > 3, 'an end line');
}
{
  // Timeouts: nobody picks; a peek before the time (and its grace) does nothing.
  const s = startBattle();
  const acc = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', now: T0 });
  eq(acc.money, [], 'no bet: nothing held');
  const early = B.move({ pub: acc.pub, secret: acc.secret, me: '', move: 'peek', now: T0 + B.ROUND_MS + B.GRACE_MS - 1 });
  ok(early.write === false, 'a peek before the time is up does nothing');
  const one = B.move({ pub: acc.pub, secret: acc.secret, me: '', move: 'peek', now: T0 + B.ROUND_MS + B.GRACE_MS, rng: rngOf(2) });
  eq([one.pub.round, one.pub.log.length, one.pub.log[0].a.auto, one.pub.log[0].b.auto], [2, 1, true, true], 'out of time: both picked for them');
  eq(one.pub.roundEnds, T0 + 2 * B.ROUND_MS, 'the next round counts from when the last should have ended');
  // Cooper picked, Ira didn't: only Ira's is made for her.
  const p = B.move({ pub: one.pub, secret: one.secret, me: C, move: 'm0', now: T0 + B.ROUND_MS + 5000 });
  const two = B.move({ pub: p.pub, secret: p.secret, me: '', move: 'peek', now: T0 + 2 * B.ROUND_MS + B.GRACE_MS, rng: rngOf(3) });
  ok(!two.pub.log[1].a.auto && two.pub.log[1].b.auto, 'only the missing pick is made');
  eq(two.pub.log[1].a.m, 0, 'Cooper’s own pick stood');
  // A pick just after the time (inside the grace) still counts for that round.
  const late = B.move({ pub: two.pub, secret: two.secret, me: I, move: 'm0', now: two.pub.roundEnds + 1000 });
  eq([late.pub.round, late.pub.picked], [3, [I]], 'a pick a moment late counts for the round');
  // A battle left alone plays out on the house's peek (settleGames, every 10 minutes).
  const all = B.move({ pub: late.pub, secret: late.secret, me: '', move: 'peek', now: T0 + 60 * 60000, rng: rngOf(4) });
  eq(all.pub.status, 'done', 'left alone, the house finishes it');
  ok(all.pub.log.length <= B.ROUNDS, 'never more than 12 rounds');
}
{
  // The 12-round end and draws: every attack misses (rng 0.99), health stays full.
  const s = startBattle();
  let st = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', now: T0 });
  for (let k = 0; k < 12 && st.pub.status === 'playing'; k++) {
    st = B.move({ pub: st.pub, secret: st.secret, me: C, move: 'm0', now: T0 + k * 1000, rng: () => 0.99 });
    st = B.move({ pub: st.pub, secret: st.secret, me: I, move: 'm0', now: T0 + k * 1000 + 1, rng: () => 0.99 });
  }
  eq([st.pub.status, st.pub.how, st.pub.winner, st.pub.log.length], ['done', 'rounds', '', 12], 'after 12 rounds with the same health: a draw');
  eq(B.recordOf(st.pub), { a: 'd', b: 'd' }, 'a draw on both records');
  ok(/draw/i.test(B.endLine(st.pub)), 'the card says draw');
  eq(st.money, [], 'no bet: no money');
  // With a bet, a draw gives each their own back.
  const s2 = startBattle({ bet: 30 });
  let st2 = B.move({ pub: s2.pub, secret: s2.secret, me: I, move: 'accept', balance: 30, now: T0 });
  for (let k = 0; k < 12 && st2.pub.status === 'playing'; k++) {
    st2 = B.move({ pub: st2.pub, secret: st2.secret, me: C, move: 'm0', now: T0 + k, rng: () => 0.99 });
    st2 = B.move({ pub: st2.pub, secret: st2.secret, me: I, move: 'm0', now: T0 + k, rng: () => 0.99 });
  }
  eq(st2.money.map((x) => [x.name, x.delta, x.entry.shown]), [[C, 30, 0], [I, 30, 0]], 'a draw: bets back');
  ok(/draw, bet back/.test(st2.money[0].entry.label), 'the line says so');
  // 12 rounds and one ahead: the most health (as a share of its full) wins.
  const p = { ...st.pub, status: 'playing', how: '', round: 12, picked: [C], pa: { ...st.pub.pa, hp: 60 }, pb: { ...st.pub.pb, hp: 40 }, roundEnds: T0 + 1e6 };
  const end = B.move({ pub: p, secret: { picks: { [C]: 0 } }, me: I, move: 'm0', now: T0, rng: () => 0.99 });
  eq([end.pub.how, end.pub.winner], ['rounds', C], 'after 12 rounds, more health wins');
  ok(/more health/.test(B.endLine(end.pub)), 'and the card says why');
}
{
  // A knockout on both sides at once: a draw.
  const s = startBattle({ species: ['cat', 'dog'] });
  const acc = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', now: T0 });
  const p = { ...acc.pub, picked: [C], pa: { ...acc.pub.pa, hp: 5 }, pb: { ...acc.pub.pb, hp: 5 } };
  const one = B.move({ pub: p, secret: { picks: { [C]: 0 } }, me: I, move: 'm0', now: T0, rng: seq(0, 0.9, 0.5, 0, 0.9, 0.5) });
  eq([one.pub.status, one.pub.how, one.pub.winner], ['done', 'ko', ''], 'both down in the same round: a draw');
  const p2 = { ...acc.pub, picked: [C], pb: { ...acc.pub.pb, hp: 5 } };
  const two = B.move({ pub: p2, secret: { picks: { [C]: 0 } }, me: I, move: 'm0', now: T0, rng: seq(0, 0.9, 0.5, 0, 0.9, 0.5) });
  eq([two.pub.how, two.pub.winner], ['ko', C], 'a knockout');
  ok(B.endLine(two.pub) === 'Billy wins!', `the line (${B.endLine(two.pub)})`);
}
{
  // Giving up.
  const s = startBattle({ bet: 10 });
  const acc = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', balance: 10, now: T0 });
  const g = B.move({ pub: acc.pub, secret: acc.secret, me: I, move: 'resign', now: T0 + 5 });
  eq([g.pub.how, g.pub.winner], ['resigned', C], 'giving up: the other wins');
  eq(g.money.map((x) => x.delta), [20, 0], 'and takes the bets');
  eq(B.recordOf(g.pub), { a: 'w', b: 'l' }, 'it counts');
}
{
  // Decline, cancel, timeout: the challenger's bet back, once; no record.
  const s = startBattle({ bet: 40 });
  const d = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'decline', now: T0 });
  eq([d.pub.how, d.money], ['declined', [{ name: C, delta: 40, entry: null }]], 'declined: bet back');
  eq(moneyLine(d.money[0], 'battle', 'x').label, 'Pet battle: bet back', 'its line');
  eq(B.recordOf(d.pub), null, 'no record');
  ok(B.move({ pub: d.pub, secret: d.secret, me: I, move: 'decline', now: T0 }).write === false, 'a second decline does nothing');
  ok(/Only the person/.test(B.move({ pub: s.pub, secret: s.secret, me: I, move: 'cancel', now: T0 }).error), 'only the challenger cancels');
  eq(B.move({ pub: s.pub, secret: s.secret, me: C, move: 'cancel', now: T0 }).money, [{ name: C, delta: 40, entry: null }], 'cancelled: bet back');
  ok(B.move({ pub: s.pub, secret: s.secret, me: '', move: 'peek', now: T0 + B.EXPIRES - 1 }).write === false, 'not expired yet');
  const ex = B.move({ pub: s.pub, secret: s.secret, me: '', move: 'peek', now: T0 + B.EXPIRES });
  eq([ex.pub.how, ex.money], ['expired', [{ name: C, delta: 40, entry: null }]], 'nobody accepted: bet back');
  ok(/ran out/.test(B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', balance: 99, now: T0 + B.EXPIRES }).error), 'too late to accept');
}
{
  // A pet that's gone (died, given away, released): the battle is off, bets back.
  const s = startBattle({ bet: 25 });
  const g1 = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', balance: 25, now: T0, alive: { a: true, b: false } });
  eq([g1.pub.status, g1.pub.how, g1.money], ['done', 'gone', [{ name: C, delta: 25, entry: null }]], 'open, a pet gone: the challenger’s bet back');
  const acc = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', balance: 25, now: T0 });
  const g2 = B.move({ pub: acc.pub, secret: acc.secret, me: '', move: 'peek', now: T0 + 1, alive: { a: false, b: true } });
  eq(g2.money.map((x) => [x.name, x.delta]), [[C, 25], [I, 25]], 'playing, a pet gone: both bets back');
  eq(B.recordOf(g2.pub), null, 'no record');
  ok(/isn’t here anymore/.test(B.endLine(g2.pub)) && /Bets back/.test(B.endLine(g2.pub)), 'the card says so');
}
{
  // Huge numbers: past 2^53 a bet still pays exactly twice back, and the
  // three coin moves add up to nothing.
  for (const bet of [2 ** 53 + 2, 1e30, 3.7e99]) {
    const s = startBattle({ bet, balance: bet, peerBalance: bet });
    ok(!s.error, `a ${bet} bet starts`);
    const acc = B.move({ pub: s.pub, secret: s.secret, me: I, move: 'accept', balance: bet, now: T0 });
    const g = B.move({ pub: acc.pub, secret: acc.secret, me: I, move: 'resign', now: T0 });
    const all = [...s.money, ...acc.money, ...g.money];
    ok(g.money[0].delta === bet + bet && g.money[0].delta - bet === bet, `${bet}: the winner gets exactly both`);
    ok(all.reduce((t, x) => t + x.delta, 0) === 0, `${bet}: nothing made or lost`);
    // Near the ceiling the win is cut like any game's (capMoney).
    const capped = capMoney(g.money, { [C]: 1e100 - bet });
    ok(capped.money[0].delta <= 2 * bet, `${bet}: never more than the pot`);
  }
  const big = startBattle({ bet: 1e30, balance: 1e30, peerBalance: 1e29 });
  ok(/only has/.test(big.error), 'both must have the bet');
}

// ---------- starting ----------
{
  eq(B.parseWords(['@Ira', '50'], roster), { them: I, betWord: '50', born: null, theirBorn: null, known: true }, '"@Ira 50"');
  eq(B.parseWords(['@Ira Harrison', '2k', 'mine:5', 'theirs:9'], roster).betWord, '2k', 'a short amount');
  eq([B.parseWords(['@Ira', 'mine:5', 'theirs:9'], roster).born, B.parseWords(['@Ira', 'mine:5', 'theirs:9'], roster).theirBorn], [5, 9], 'which pets');
  eq(B.parseWords(['@Ira'], roster).betWord, '', 'no bet');
  eq(B.parseWords(['@Nobody'], roster).known, false, 'someone not on the team');
  ok(B.hasBet(['@Ira', '20']) && !B.hasBet(['@Ira']) && !B.hasBet(['@Ira', '0']) && !B.hasBet(['@Ira', 'Harrison']) && !B.hasBet(['@Ira', 'mine:4']), 'hasBet');
  eq(B.betIn(['@Ira', 'half'], roster, 100), 50, 'betIn: half');
  const base = { me: C, roster, balance: 100, bank: {}, now: T0, myPets: petsFor('goat', 5, 111), peer: { name: I, active: true, balance: 100, pets: petsFor('owl', 5, 222) } };
  ok(/Battle who/.test(B.start({ ...base, words: [] }).error), 'nobody named');
  ok(/itself/.test(B.start({ ...base, words: ['@Cooper'] }).error), 'not yourself');
  ok(/Trotbot/.test(B.start({ ...base, words: ['@Trotbot'] }).error), 'not Trotbot');
  ok(/only have/.test(B.start({ ...base, words: ['@Ira', '500'] }).error), 'not more than you have');
  ok(/Adopt a pet/.test(B.start({ ...base, words: ['@Ira'], myPets: [] }).error), 'you need a pet');
  ok(/doesn’t have a pet/.test(B.start({ ...base, words: ['@Ira'], peer: { ...base.peer, pets: [] } }).error), 'they need a pet (a pet that died is no longer theirs)');
  ok(/isn’t with you/.test(B.start({ ...base, words: ['@Ira', 'mine:999'] }).error), 'a pet that isn’t yours anymore');
  ok(/isn’t with Ira/.test(B.start({ ...base, words: ['@Ira', 'theirs:999'] }).error), 'a pet that isn’t theirs anymore');
  ok(/isn’t on the team/.test(B.start({ ...base, words: ['@Ira'], peer: { ...base.peer, active: false } }).error), 'they must be on the team');
  ok(/coins are off/.test(B.start({ ...base, words: ['@Ira', '5'], coinsOff: true }).error), 'coins off: no bet');
  ok(!B.start({ ...base, words: ['@Ira'], coinsOff: true }).error, 'coins off: a battle just for fun still works');
  ok(/already have a battle/.test(B.start({ ...base, words: ['@Ira'], hasOpen: true }).error), 'one waiting at a time');
  ok(/10 battles today/.test(B.start({ ...base, words: ['@Ira'], bank: { btDay: { day: '2026-11-20', n: 10 } } }).error), 'ten a day');
  ok(!B.start({ ...base, words: ['@Ira'], bank: { btDay: { day: '2026-11-19', n: 10 } } }).error, 'a new day starts over');
  const s = B.start({ ...base, words: ['@Ira', 'mine:111', 'theirs:222'] });
  eq([s.pub.pa.born, s.pub.pb.born, s.money[0].delta], [111, 222, 0], 'no bet: nothing held, the day still counts');
  ok(/That’s not a bet/.test(B.start({ ...base, words: ['@Ira', 'abc'] }).error) === false, 'a word after the name is part of the name, not a bet');
  // Through arcade.js, as the server and demo call it.
  ok(!arcade.start('battle', { ...base, words: ['@Ira'] }).error, 'arcade.start runs it');
  ok(arcade.MULTI.includes('battle') && arcade.LABEL.battle === 'Pet battle', 'an arcade game');
  const acc = arcade.move('battle', { pub: s.pub, secret: s.secret, me: I, move: 'accept', now: T0, alive: { a: true, b: false } });
  eq(acc.pub.how, 'gone', 'arcade.move passes alive through');
}

// ---------- the rest of the app's rules ----------
ok(buddyBlocks({ action: 'run', game: 'battle', args: ['@Ira', '20'] }), 'a gambling buddy’s lock stops a battle with a bet');
ok(!buddyBlocks({ action: 'run', game: 'battle', args: ['@Ira'] }), 'but not one just for fun');
ok(SHIFT_GAMES.includes('battle') && SERVER_COMMANDS.includes('battle'), 'a game on shift, a card only the server posts');
eq(serverGroup('battle'), 'arcade', 'an arcade game on the Commands page');
ok(arcadeOnly('battle', 'general') && !arcadeOnly('battle', 'arcade'), 'only in #arcade');
ok(FIXABLE.includes('battle'), 'the owner can refund a battle’s bet');
{
  const done = { name: 'battle', status: 'done', game: { a: C, b: I, bet: 50, winner: C, how: 'ko' } };
  eq(cardNets(done, C).nets, [{ name: C, net: 50 }, { name: I, net: -50 }], 'refund numbers: a win and a loss');
  eq(cardNets({ ...done, game: { ...done.game, how: 'declined', winner: '' } }, C).nets.map((x) => x.net), [0, 0], 'declined: nothing to refund');
  eq(cardNets({ ...done, game: { ...done.game, how: 'gone', winner: '' } }, C).nets.map((x) => x.net), [0, 0], 'a pet gone: nothing to refund');
}
{
  // The history: a held bet and its result share one line (bankAfter).
  let bank = {};
  bank = bankAfter(bank, C, -50, moneyLine({ name: C, delta: -50, entry: null }, 'battle', 'card9'), {}, T0);
  eq(bank.recent.map((x) => [x.amount, x.label]), [[-50, 'Bet held: Pet battle 50 (playing)']], 'held');
  const win = B.settle({ a: C, b: I, bet: 50 }, C)[0];
  bank = bankAfter(bank, C, win.delta, moneyLine(win, 'battle', 'card9', 'arcade'), {}, T0 + 1);
  eq(bank.recent.map((x) => [x.amount, x.label]), [[50, 'Pet battle with Ira Harrison: won 50']], 'then one line: “Pet battle with Ira Harrison: won 50”');
  eq(bank.net, 50, 'and the right total');
}

// ---------- records and the board ----------
{
  const s1 = side('goat', 5, 'Billy', 111);
  let doc = B.recordAfter(null, { person: C, side: s1, result: 'w', now: T0 });
  doc = B.recordAfter(doc, { person: C, side: s1, result: 'w', now: T0 });
  doc = B.recordAfter(doc, { person: C, side: s1, result: 'l', now: T0 });
  eq(doc.pets['111'], { name: 'Billy', species: 'goat', w: 2, l: 1, d: 0 }, 'a record adds up');
  const ira = B.recordAfter(null, { person: I, side: side('owl', 5, 'Hoot', 222), result: 'd', now: T0 });
  const old = { person: 'Ira Old', pets: { 222: { name: 'Hoot', species: 'owl', w: 1, l: 0, d: 0 } } };
  const rename = (n) => (n === 'Ira Old' ? I : n);
  eq(B.recordFor([doc, ira, old], I, 222, rename), { w: 1, l: 0, d: 1 }, 'a record under an old name still counts');
  eq(B.recordFor([doc], I, 222), null, 'no battles yet: no record');
  eq(B.recordLine({ w: 2, l: 1, d: 0 }), '2 wins · 1 loss', 'the line');
  eq(B.recordLine({ w: 1, l: 0, d: 2 }), '1 win · 0 losses · 2 draws', 'with draws');
  eq(B.recordLine({ w: 0, l: 0, d: 0 }), '', 'nothing before the first battle');
  const board = B.battleBoard([doc, ira, old], { rename });
  eq(board.map((r) => [r.owner, r.w, r.l, r.d]), [[C, 2, 1, 0], [I, 1, 0, 1]], 'the board: most wins first, old names merged');
  eq(B.battleBoard([doc, ira], { alive: (o) => o !== C }).length, 1, 'a pet that’s gone leaves the board');
}

// ---------- the balance ----------
// Random battles (each pet picks any move it can, like a missed pick): at
// the same level, no kind of pet wins more than 60% against all the others.
{
  const rng = rngOf(2026);
  const fight = (sa, la, sb, lb) => {
    let a = side(sa, la);
    let b = side(sb, lb);
    for (let round = 1; round <= B.ROUNDS; round++) {
      const r = B.resolveRound(a, b, [B.autoPick(a, round, rng), B.autoPick(b, round, rng)], round, rng);
      a = r.a;
      b = r.b;
      if (a.hp <= 0 || b.hp <= 0) return a.hp > 0 ? 1 : b.hp > 0 ? 0 : 0.5;
    }
    const k = B.ahead(a, b);
    return k > 0 ? 1 : k < 0 ? 0 : 0.5;
  };
  const ids = SPECIES.map((s) => s.id);
  const N = 120; // battles against each other kind, per level
  let total = 0;
  for (const level of [1, 10, 25, 50]) {
    const rates = ids.map((s) => {
      let w = 0;
      for (const o of ids) for (let i = 0; i < N; i++) w += fight(s, level, o, level);
      total += ids.length * N;
      return [s, w / (ids.length * N)];
    });
    rates.sort((x, y) => y[1] - x[1]);
    const top = rates[0];
    const low = rates[rates.length - 1];
    console.log(`  level ${level}: best ${top[0]} ${(top[1] * 100).toFixed(1)}%, lowest ${low[0]} ${(low[1] * 100).toFixed(1)}%`);
    ok(top[1] <= 0.6, `level ${level}: no kind of pet over 60% (${top[0]} ${(top[1] * 100).toFixed(1)}%)`);
    ok(low[1] >= 0.4, `level ${level}: none under 40% either (${low[0]} ${(low[1] * 100).toFixed(1)}%)`);
  }
  // Higher levels are stronger, but a lower level still wins sometimes.
  for (const [lo, hi, min, max] of [
    [1, 3, 0.25, 0.5],
    [5, 10, 0.2, 0.5],
    [1, 10, 0.05, 0.35],
    [10, 50, 0.1, 0.45],
    [1, 100, 0.01, 0.2],
  ]) {
    let w = 0;
    let n = 0;
    for (const s of ids)
      for (const o of ids)
        for (let i = 0; i < 12; i++) {
          w += fight(s, lo, o, hi);
          n++;
        }
    total += n;
    console.log(`  level ${lo} against level ${hi}: the lower level wins ${((w / n) * 100).toFixed(1)}%`);
    ok(w / n >= min && w / n <= max, `level ${lo} vs ${hi}: the lower level wins sometimes (${((w / n) * 100).toFixed(1)}%)`);
  }
  console.log(`  (${total.toLocaleString('en-US')} random battles)`);
}

console.log(`${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
