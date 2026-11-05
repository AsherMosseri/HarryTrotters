// The coins screen's Stats tab (src/coinStats.js): every number comes from
// the person's own history, so the sources add up to the balance exactly,
// the per-game numbers match the casino lines, and the chart scale copes
// with balances up to a googol.
// Run: node scripts/test-coin-stats.mjs
import { balanceSeries, classify, coinScale, coinStats } from '../src/coinStats.js';
import { coinInput, coinSettings, coinsAgree, sumCoins, teamDay, wallet } from '../functions/shared/coins.js';
import { bankAfter, holdEntry } from '../functions/shared/casino.js';
import { moneyLine } from '../functions/shared/arcade.js';

let failures = 0;
let passes = 0;
const ok = (cond, msg) => {
  if (cond) passes++;
  else {
    failures++;
    console.log('FAIL', msg);
  }
};
const eq = (got, want, msg) => ok(got === want, `${msg}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const ME = 'Cooper Mlezcko';
const HOUR = 3600000;
const now = Date.UTC(2026, 10, 5, 18, 0);
const t = (h) => now - h * HOUR;

// A bank doc built the way the server builds it (casino.bankAfter), so the
// labels are the real ones.
let bank = {};
const line = (delta, entry, at) => (bank = bankAfter(bank, ME, delta, entry, {}, at));
line(25, { game: 'slots', icon: '🎰', label: 'Slots: won 25' }, t(50));
line(-10, { game: 'slots', icon: '🎰', label: 'Slots: lost 10' }, t(49));
line(-40, { game: 'coinflip', icon: '🪙', label: 'Coin flip: lost 40' }, t(48));
line(300, { game: 'roulette', icon: '🎡', label: 'Roulette: won 300' }, t(26));
line(-15, { icon: '🎟️', label: 'Lottery: 3 tickets' }, t(25));
line(120, { icon: '🎟️', label: 'Won the lottery (120 coins)' }, t(24));
line(-50, holdEntry('🃏', 'Blackjack', 50, 'bj1'), t(3));
line(-20, holdEntry('💣', 'Mines', 20, 'mn1'), t(2.5));
line(20 + 35, { game: 'mines', icon: '💣', label: 'Mines: won 35', shown: 35, settles: 'mn1' }, t(2));
line(-15, holdEntry('🔼', 'High-low', 15, 'hl1'), t(1.95));
line(15, { game: 'highlow', icon: '🔼', label: 'High-low: bet back', shown: 0, settles: 'hl1' }, t(1.9));
line(30, { icon: '🛠️', label: 'Work: fixed the intake' }, t(1.5));
line(4, { icon: '🥺', label: 'Begging' }, t(1.4));
line(-12, { icon: '🚓', label: 'Caught robbing Ira Kumar' }, t(1.3));
// An arcade bet: a duel, held then won (arcade.moneyLine).
line(-30, moneyLine({ name: ME, delta: -30 }, 'duel', 'du1', 'arcade'), t(1.2));
line(60, moneyLine({ name: ME, delta: 60, entry: { game: 'duel', icon: '🤠', label: 'Duel: won 30', shown: 30 } }, 'duel', 'du1', 'arcade'), t(1.1));
// Older lines folded away: the bank's net is more than its lines say.
bank = { ...bank, net: bank.net - 500 };

const ledger = [
  { type: 'grant', to: ME, amount: 1000, note: 'Welcome', at: t(200) },
  { type: 'gift', from: 'Ira Kumar', to: ME, amount: 50, note: 'pizza', at: t(30) },
  { type: 'gift', from: ME, to: 'Ira Kumar', amount: 20, note: '', at: t(29) },
  { type: 'spend', person: ME, amount: 25, what: 'market', label: 'Sticker', at: t(28) },
  { type: 'spend', person: ME, amount: 2, what: 'skip', label: 'Skipped an ad', at: t(27) },
  { type: 'refund', person: ME, amount: 40, label: 'Refund: Coin flip', game: 'coinflip', at: t(20) },
  { type: 'award', person: ME, amount: 12, label: 'Tetris', at: t(10) },
  { type: 'prize', person: ME, amount: 5, what: 'wheel', label: 'Prize wheel: +5', at: t(9) },
  { type: 'loan', to: ME, from: 'Sophia Bermudez', amount: 200, what: 'lend', at: t(8) },
  { type: 'loan', to: 'Sophia Bermudez', from: ME, amount: 110, what: 'repay', at: t(7) },
  { type: 'loan', to: 'Ira Kumar', from: ME, amount: 60, what: 'lend', at: t(6) },
  { type: 'loan', to: ME, from: 'Ira Kumar', amount: 60, what: 'collect', at: t(5) },
];
const cfg = coinSettings({ start: '2026-08-28' });
const tasks = [{ id: 'a', status: 'done', assignees: [ME], createdBy: 'Asher Mosseri', completedAt: t(40), title: 'Wire the arm' }];
const shifts = [{ person: ME, start: t(33), end: t(31) }];
const data = coinInput({ tasks, shifts, ledger, bank: [{ ...bank, id: 'cooper-mlezcko' }], rename: (n) => n, cfg, names: [ME], now });
const w = wallet(ME, data);
const s = coinStats(w.history, { now });

// ---------- everything adds up ----------
eq(s.total, w.balance, 'total is the balance');
eq(sumCoins(s.sources.map((x) => ({ amount: x.coins }))), w.balance, 'the sources add up to the balance');
eq(s.sources.reduce((n, x) => n + x.n, 0), w.history.length, 'every line is in one source');
eq(s.balance[s.balance.length - 1].v, w.balance, 'the balance line ends at the balance');

// ---------- classifying ----------
eq(classify({ kind: 'casino', label: 'Earlier casino and economy', amount: -500 }).source, 'earlier', 'the folded line');
eq(classify({ kind: 'casino', label: 'Work: fixed the intake', amount: 30 }).source, 'economy', '/work');
eq(classify({ kind: 'casino', label: 'Robbed by Ira Kumar', amount: -30 }).source, 'economy', 'robbed');
eq(classify({ kind: 'casino', label: 'Ira Kumar paid you a fine', amount: 5 }).source, 'economy', 'a fine');
eq(classify({ kind: 'casino', label: 'Coin flip: lost 40', amount: -40 }).game, 'coinflip', 'coin flip by label');
eq(classify({ kind: 'casino', label: 'High-low: won 2.5e+40', amount: 2.5e40 }).game, 'highlow', 'high-low with a huge number');
eq(classify({ kind: 'casino', label: 'Bet held: Mines 20 (playing)', amount: -20, held: true }).kind, 'held', 'held bet');
eq(classify({ kind: 'casino', label: 'Mines: card deleted, lost 20', amount: -20 }).game, 'mines', 'deleted card');
eq(classify({ kind: 'casino', label: 'Heist: caught (lost 10)', amount: -10 }).game, 'heist', 'heist');
eq(classify({ kind: 'casino', label: 'Challenge: won 40', amount: 40 }).game, 'challenge', 'challenge');
eq(classify({ kind: 'grant', reverses: 'casino|123|-40|Slots: lost 40', amount: 40 }).game, 'slots', 'the owner reversing a slots line');
eq(classify({ kind: 'grant', amount: 5, label: 'Bonus' }).source, 'grant', 'a bonus');
eq(classify({ kind: 'spend', what: 'tournament', amount: -5 }).source, 'market', 'a tournament entry');

// ---------- gambling ----------
const g = s.gambling;
// Results: +25 −10 −40 +300 −15 (tickets) +120 (jackpot) +35 0 +30 (duel). Held: −50. Refund +40.
eq(g.won, 25 + 300 + 120 + 35 + 30, 'won');
eq(g.lost, 10 + 40 + 15, 'lost');
eq(g.held, 50, 'held in a game still going');
eq(g.adjusted, 40, 'refunds');
eq(g.net, g.won - g.lost - g.held + g.adjusted, 'net = won − lost − held + refunds');
eq(g.earlier, -500, 'the older lines, not split by game');
const game = (id) => g.games.find((x) => x.id === id);
eq(game('slots').plays, 2, 'slots plays');
eq(game('slots').wins, 1, 'slots wins');
eq(game('slots').best, 25, 'slots biggest win');
eq(game('slots').worst, -10, 'slots biggest loss');
eq(game('coinflip').net, 0, 'coin flip net with its refund');
eq(game('lottery').plays, 1, 'a lottery win isn’t a play');
eq(game('lottery').wins, 1, 'the lottery win');
eq(game('lottery').best, 120, 'the lottery jackpot');
eq(game('blackjack').plays, 0, 'a held bet isn’t a play yet');
eq(game('highlow').wins + game('highlow').plays, 1, 'a push is a play, not a win');
ok(game('duel') && !game('duel').casino && game('slots').casino, 'arcade bets are marked apart from the casino');
eq(sumCoins(g.games.map((x) => ({ amount: x.net }))), g.net, 'the games add up to the gambling net');

// ---------- the rest ----------
eq(s.src.task.coins, 15, 'tasks');
ok(s.src.hours.coins > 0, 'lab hours');
eq(s.src.economy.coins, 30 + 4 - 12, 'economy');
eq(s.src['gift-in'].coins, 50, 'gifts in');
eq(s.src['gift-out'].coins, -20, 'gifts out');
eq(s.src.market.coins, -25, 'market');
eq(s.src.spend.coins, -2, 'ad skips');
eq(s.loans.borrowed, 200, 'borrowed');
eq(s.loans.paidBack, 110, 'paid back');
eq(s.loans.lent, 60, 'lent');
eq(s.loans.gotBack, 60, 'got back');
eq(s.loans.net, 200 - 110 - 60 + 60, 'loan net');
eq(s.earned.total, s.earned.parts.reduce((n, p) => n + p.coins, 0), 'earned total');

// ---------- days ----------
ok(s.days.best && s.days.best.net > 0, 'a best day');
eq(s.daily.length, 30, '30 days in the chart');
eq(s.daily[s.daily.length - 1].day, teamDay(now), 'the chart ends today');
eq(new Set(s.daily.map((d) => d.day)).size, 30, 'no day twice');
const dayOf = (h) => s.daily.find((d) => d.day === teamDay(t(h)));
eq(dayOf(2).net, sumCoins(w.history.filter((x) => classify(x).source === 'gambling' && teamDay(x.at) === teamDay(t(2)))), 'a day’s gambling net');

// ---------- empty ----------
const e = coinStats([], { now });
eq(e.total, 0, 'empty total');
eq(e.balance.length, 0, 'no balance line');
eq(e.gambling.games.length, 0, 'no games');

// ---------- big numbers ----------
const big = [
  { kind: 'grant', at: 1, amount: 1e99, label: 'Bonus' },
  { kind: 'casino', at: 2, amount: 9e99, label: 'Slots: won 9e+99' },
  { kind: 'casino', at: 3, amount: -5, label: 'Dice: lost 5' },
];
const bs = coinStats(big, { now });
ok(coinsAgree(bs.total, 1e100), 'a googol in total');
ok(coinsAgree(bs.gambling.won, 9e99), 'a huge win');
eq(bs.gambling.games.find((x) => x.id === 'slots').best, 9e99, 'biggest win past 2^53');
eq(balanceSeries(big).length, 3, 'balance points');

// ---------- the scale ----------
const lin = coinScale([0, 15, 40, 120]);
eq(lin.kind, 'linear', 'small numbers are linear');
eq(lin.pos(lin.lo), 0, 'bottom');
eq(lin.pos(lin.hi), 1, 'top');
ok(lin.ticks.includes(0) && lin.ticks.every((v) => v >= lin.lo && v <= lin.hi), 'ticks in range with 0');
const lg = coinScale([15, 400, 2e12, 1e100]);
eq(lg.kind, 'log', 'a googol next to 15 is a log scale');
ok(lg.pos(1e100) <= 1 && lg.pos(1e100) > 0.99 && lg.pos(15) > 0 && lg.pos(15) < 0.05, 'log positions');
ok(lg.ticks.length >= 3 && lg.ticks.length <= 7, `log ticks: ${lg.ticks.length}`);
ok(lg.ticks.every((v) => Number.isFinite(v)), 'finite ticks');
const neg = coinScale([-3e30, 5, 1e40]);
eq(neg.kind, 'log', 'negative and huge: log');
ok(neg.pos(0) > 0 && neg.pos(0) < 1 && neg.ticks.includes(0) && neg.ticks.some((v) => v < 0), 'log goes below zero');
const flat = coinScale([1e100, 1e100]);
ok(flat.pos(1e100) >= 0 && flat.pos(1e100) <= 1 && Number.isFinite(flat.pos(1e100)), 'one huge value');
const zero = coinScale([0, 0]);
ok(Number.isFinite(zero.pos(0)) && zero.ticks.length >= 2, 'all zero');
const bigLin = coinScale([1e99, 2e99, 5e99]);
eq(bigLin.kind, 'linear', 'huge but similar numbers are linear');
ok(bigLin.ticks.length >= 3 && bigLin.ticks.length <= 8 && bigLin.ticks.every(Number.isFinite), 'huge linear ticks');

console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
