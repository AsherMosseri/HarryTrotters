// The market's 3.2.7 changes (functions/shared/market.js): turning your own
// chat extra off and back on (extraSwitchCheck, and every reader of chat
// extras treating one that's off as off); tournament entries typed short
// (readEntry) with no limit but a googol, and pots and prizes exact past 2^53
// (potOf, exactParts, payoutOf, capPays).
// Run: node scripts/test-market327.mjs
import {
  BANNERS_MAX,
  activeExtras,
  buyCheck,
  capPays,
  exactParts,
  extraOn,
  extraSwitchCheck,
  glows,
  joinCheck,
  newTournament,
  payParts,
  payoutOf,
  potOf,
  readEntry,
} from '../functions/shared/market.js';
import { MAX_BALANCE, sumCoins } from '../functions/shared/coins.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const H = 3600000;
const now = 1_800_000_000_000;

// ---------- chat extras: off and back on ----------
const glow = { id: 'g1', item: 'extra:glow', kind: 'extra', person: 'Cooper Mlezcko', status: 'active', at: now - 2 * H, until: now + 22 * H, price: 25 };
const me = { aliases: ['Cooper Mlezcko', 'Cooper M'], now };
eq(extraOn(glow, now), true, 'bought: on');
eq(extraOn({ ...glow, paused: true }, now), false, 'paused: off');
eq(extraOn({ ...glow, until: now - 1 }, now), false, 'run out: off');
eq(extraOn({ ...glow, status: 'removed' }, now), false, 'taken down: off');

// Who can.
eq(extraSwitchCheck(glow, false, { aliases: ['Ira Kumar'], now }).error, 'That isn’t yours.', 'someone else can’t turn it off');
eq(extraSwitchCheck(null, false, me).error, 'That chat extra is gone.', 'missing purchase');
eq(extraSwitchCheck({ ...glow, kind: 'perk', item: 'perk:p1' }, false, me).error, 'That chat extra is gone.', 'not a chat extra');
eq(extraSwitchCheck({ ...glow, until: now }, false, me).error, 'It already ran out.', 'ran out');
eq(extraSwitchCheck({ ...glow, status: 'removed' }, false, me).error, 'Team management took that one down.', 'taken down');
eq(extraSwitchCheck({ ...glow, person: 'Cooper M' }, false, me).patch, { paused: true, pausedAt: now }, 'bought under an old name: still the buyer');

// Off, then back on, both idempotent.
const off = extraSwitchCheck(glow, false, me);
eq(off.patch, { paused: true, pausedAt: now }, 'turn off');
const paused = { ...glow, ...off.patch };
eq(extraSwitchCheck(paused, false, { ...me, now: now + 1000 }), { same: true }, 'turning off twice changes nothing');
eq(extraSwitchCheck(glow, true, me), { same: true }, 'turning on something on changes nothing');
const back = extraSwitchCheck(paused, true, { ...me, now: now + H });
eq(back.patch, { paused: false, pausedAt: null, offs: [{ from: now, to: now + H }] }, 'back on: the time it was off is kept');
eq(back.patch.until, undefined, 'the clock keeps running: until is unchanged');
const again = { ...paused, ...back.patch };
eq(extraOn(again, now + H), true, 'on again');

// Glow: messages sent while it was off don't glow; while it's off, none do.
const ex = (list, t) => activeExtras(list, t);
const msg = (at) => ({ by: 'Cooper Mlezcko', at });
eq(glows(ex([glow], now), msg(now - H)), true, 'on: a message glows');
eq(glows(ex([paused], now + 1), msg(now - H)), false, 'off: earlier messages stop glowing');
eq(glows(ex([again], now + H), msg(now - H)), true, 'back on: earlier messages glow again');
eq(glows(ex([again], now + H), msg(now + H / 2)), false, 'back on: a message sent while it was off doesn’t');
eq(glows(ex([again], now + 2 * H), msg(now + 1.5 * H)), true, 'back on: a new message glows');

// Mega and the shout-out banner.
const mega = { ...glow, id: 'm1', item: 'extra:mega' };
eq(ex([mega], now).mega.has('Cooper Mlezcko'), true, 'mega on');
eq(ex([{ ...mega, paused: true }], now).mega.has('Cooper Mlezcko'), false, 'mega off while paused');
const banner = (id, person, extra = {}) => ({ id, item: 'extra:banner', kind: 'extra', person, status: 'active', at: now - H, until: now + 23 * H, text: 'Hi', ...extra });
eq(ex([banner('b1', 'Cooper Mlezcko')], now).banners.length, 1, 'banner on Today');
eq(ex([banner('b1', 'Cooper Mlezcko', { paused: true })], now).banners.length, 0, 'paused banner not on Today');

// Buying again while yours is off: still yours (turn it back on instead).
const bc = buyCheck('extra:glow', { me: 'Cooper Mlezcko', balance: 1000, now, purchases: [paused] });
eq(bc.error, 'You already have this.', 'can’t buy a second while yours is off');
eq(/turn it back on/.test(bc.body), true, 'says to turn it back on');

// Shout-out limit: off ones don't take a place; coming back on needs one.
const three = [banner('b1', 'A'), banner('b2', 'B'), banner('b3', 'C')];
eq(three.length, BANNERS_MAX, 'three shout-outs is the limit');
const mine = banner('b4', 'Cooper Mlezcko', { paused: true, pausedAt: now - 10 });
eq(buyCheck('extra:banner', { me: 'Ira Kumar', balance: 1000, now, text: 'Yo', purchases: [...three.slice(0, 2), { ...three[2], paused: true }] }).error, undefined, 'a paused shout-out leaves room to buy one');
eq(extraSwitchCheck(mine, true, { ...me, purchases: three }).error, 'Today is full of shout-outs.', 'back on refused when Today is full');
eq(extraSwitchCheck(mine, true, { ...me, purchases: three.slice(0, 2) }).patch?.paused, false, 'back on when there’s room');
eq(extraSwitchCheck(mine, false, { ...me, purchases: three }), { same: true }, 'off when already off, even when full');

// ---------- tournament entries ----------
eq(readEntry('10'), { entry: 10 }, 'entry 10');
eq(readEntry(10), { entry: 10 }, 'entry 10 as a number (older apps)');
eq(readEntry('2.5k'), { entry: 2500 }, 'entry 2.5k');
eq(readEntry('1,000'), { entry: 1000 }, 'entry 1,000');
eq(readEntry(' 7Sx '), { entry: 7e21 }, 'entry 7Sx');
eq(readEntry('2.5e40'), { entry: 2.5e40 }, 'entry 2.5e40');
eq(readEntry('googol'), { entry: MAX_BALANCE }, 'entry googol: the ceiling is fine');
eq(readEntry('501'), { entry: 501 }, 'over the old 500 limit');
eq(readEntry('1e101').error, 'That’s more than a googol.', 'over a googol');
eq(readEntry('0').error, 'The entry is at least 1 coin.', 'zero');
eq(readEntry('1.2345k').error, '1.2345k is 1234.5 coins. Coins are whole: try 1235.', 'not whole');
eq(readEntry('-5').error, 'Type the entry like 50, 2.5k, 7Sx or 2.5e40.', 'negative');
eq(readEntry('ten').error, 'Type the entry like 50, 2.5k, 7Sx or 2.5e40.', 'words');
eq(readEntry('').error, 'How much is the entry?', 'empty');
eq(readEntry(Infinity).error !== undefined, true, 'Infinity refused');
eq(readEntry(NaN).error !== undefined, true, 'NaN refused');
const T = (entry) => newTournament({ game: 'tetris', title: 'Big', entry, endsAt: now + 24 * H }, { by: 'Asher Mosseri', now, seed: 's' });
eq(T('5qa').entry, 5e15, 'newTournament reads 5qa');
eq(T('1e60').entry, 1e60, 'newTournament: 1e60');
eq(T('1e200').error, 'That’s more than a googol.', 'newTournament: over a googol');
eq(T(3.5).error, '3.5 is 3.5 coins. Coins are whole: try 4.', 'newTournament: a fraction');

// ---------- exact pots past 2^53 ----------
const big = 2.5e40; // a double: exactly 25000000000000000304240406893063389380608
const players = (names, best = {}) => Object.fromEntries(names.map((n, i) => [n, { joinedAt: i, best: best[n] ?? null, at: best[n] != null ? 100 + i : null }]));
const t3 = { game: 'tetris', better: 'high', entry: big, players: players(['A', 'B', 'C'], { A: 10, B: 30, C: 20 }) };
eq(potOf(t3), BigInt(big) * 3n, 'potOf: entry × players, exactly');
// Joining: the pot shown is the exact pot rounded once, not a running double sum.
const j = joinCheck({ ...t3, status: 'open', endsAt: now + H, pot: Number(potOf(t3)) }, { me: 'D', balance: 1e41, now });
eq(j.pot, Number(BigInt(big) * 4n), 'joinCheck pot is entry × 4');
eq(joinCheck({ status: 'open', endsAt: now + H, entry: 10, pot: 20, players: players(['A', 'B']) }, { me: 'D', balance: 100, now }).pot, 30, 'small pots as before');
eq(joinCheck({ status: 'open', endsAt: now + H, entry: big, pot: 0, players: {} }, { me: 'D', balance: 1e40, now }).error, 'The entry is 2.5e40 coins. You have 1e40.', 'can’t afford a huge entry');
// One winner gets the whole pot, to the coin.
const exactSum = (list) => list.reduce((t, x) => t + BigInt(x), 0n);
let po = payoutOf(t3);
eq(po.winners, ['B'], 'B wins');
eq(exactSum(payParts(po.pays[0])), BigInt(big) * 3n, 'the prize lines add up to the pot exactly');
eq(payParts(po.pays[0]).every((x) => Number.isInteger(x) && x >= 1), true, 'every prize line is a whole, positive amount');
eq(sumCoins(payParts(po.pays[0]).map((amount) => ({ amount }))), Number(BigInt(big) * 3n), 'the wallet’s sum of them is the pot');
eq(po.pays[0].amount, Number(BigInt(big) * 3n), 'amount: the pot rounded once');
// A tie splits it exactly: shares differ by at most 1 and add up to the pot.
const tie = { ...t3, entry: big, players: players(['A', 'B', 'C', 'D', 'E', 'F', 'G'], { A: 9, B: 9, C: 9, D: 1 }) };
po = payoutOf(tie);
eq(po.winners, ['A', 'B', 'C'], 'three-way tie');
const shares = po.pays.map((p) => exactSum(payParts(p)));
eq(shares.reduce((a, b) => a + b, 0n), BigInt(big) * 7n, 'tie shares add up to the pot exactly');
eq(shares[0] - shares[2] <= 1n && shares[0] >= shares[1] && shares[1] >= shares[2], true, 'shares differ by at most a coin, first first');
// Small pots: one line each, exactly as before.
const small = { game: 'tetris', better: 'high', entry: 15, pot: 45, players: players(['A', 'B', 'C'], { A: 5, B: 5 }) };
eq(payoutOf(small).pays, [{ name: 'A', amount: 23 }, { name: 'B', amount: 22 }], 'small tie: 23 and 22, no parts');
eq(payoutOf({ ...small, players: players(['A', 'B']) }).refunds, [{ name: 'A', amount: 15 }, { name: 'B', amount: 15 }], 'nobody scored: entries back');
// A googol entry: three players is 3 googol; the cap keeps the winner at a googol.
const gg = { game: 'tetris', better: 'high', entry: MAX_BALANCE, players: players(['A', 'B', 'C'], { A: 1 }) };
po = payoutOf(gg);
eq(exactSum(payParts(po.pays[0])), BigInt(MAX_BALANCE) * 3n, 'googol entries: exact pot of 3 googol before the cap');
eq(capPays(po.pays, { A: 0 }), [{ name: 'A', amount: MAX_BALANCE, capped: true }], 'capped at a googol, one line');
eq(capPays(po.pays, { A: MAX_BALANCE }), [], 'already at a googol: nothing paid');
eq(capPays(payoutOf(t3).pays, { B: 0 }), payoutOf(t3).pays, 'far from the ceiling: parts unchanged');
// exactParts.
eq(exactParts(0n), [], 'exactParts(0)');
eq(exactParts(12345n), [12345], 'exactParts small');
eq(exactParts(2n ** 53n + 1n).length, 2, 'just past 2^53: two lines');
eq(exactSum(exactParts(2n ** 53n + 1n)), 2n ** 53n + 1n, 'just past 2^53: exact');
const g3 = 3n * 10n ** 100n + 12345678901234567890123n;
eq(exactSum(exactParts(g3)), g3, 'exactParts near 3 googol: exact');
eq(exactParts(g3).length <= 12 && exactParts(g3).every((x) => x >= 1), true, 'exactParts: a few positive lines');
// Same answer every time (the payout is idempotent by the tournament's status; the math is pure).
eq(JSON.stringify(payoutOf(tie)) === JSON.stringify(payoutOf(tie)), true, 'payoutOf is deterministic');

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
