// Coin amounts (functions/shared/amount.js): 2k, 1.5k, 2.25m, 200,000, 2B,
// and everything that isn't one. Also the places that read bets and asks
// with it (casino parseBet, coinRequests parseAsk, coins giftEntry).
// Run: node scripts/test-amount.mjs
import { amountTip, looksLikeAmount, parseAmount, readAmount } from '../functions/shared/amount.js';
import { parseBet } from '../functions/shared/casino.js';
import { parseAsk } from '../functions/shared/coinRequests.js';
import { GIFT_MAX, giftEntry } from '../functions/shared/coins.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// The examples.
eq(parseAmount('2k'), 2000, '2k');
eq(parseAmount('1.5k'), 1500, '1.5k');
eq(parseAmount('2.25m'), 2250000, '2.25m');
eq(parseAmount('200,000'), 200000, '200,000');
eq(parseAmount('1,000,000'), 1000000, '1,000,000');
eq(parseAmount('2B'), 2000000000, '2B');
eq(parseAmount('2b'), 2000000000, '2b');
eq(parseAmount('2K'), 2000, '2K');
eq(parseAmount('2M'), 2000000, '2M');
eq(parseAmount('250'), 250, '250');
eq(parseAmount(' 2k '), 2000, 'spaces around');
eq(parseAmount('1,000'), 1000, '1,000');
eq(parseAmount('1,000.5k'), 1000500, '1,000.5k');
eq(parseAmount('0.5k'), 500, '0.5k');
eq(parseAmount('2.0'), 2, '2.0 is whole');
eq(parseAmount(25), 25, 'a number');

// Not amounts.
eq(parseAmount('1,00'), null, '1,00');
eq(parseAmount('1,0000'), null, '1,0000');
eq(parseAmount(',100'), null, ',100');
eq(parseAmount('100,'), null, '100,');
eq(parseAmount('1.2345k'), null, '1.2345k is not whole');
eq(parseAmount('1.5'), null, '1.5 is not whole');
eq(parseAmount('-5'), null, '-5');
eq(parseAmount('+5'), null, '+5');
eq(parseAmount('1e6'), 1000000, '1e6 (scientific since 3.1.5)');
eq(parseAmount('1E6'), 1000000, '1E6');
eq(parseAmount('k'), null, 'k');
eq(parseAmount(''), null, 'empty');
eq(parseAmount('   '), null, 'spaces');
eq(parseAmount(null), null, 'null');
eq(parseAmount(undefined), null, 'undefined');
eq(parseAmount('NaN'), null, 'NaN');
eq(parseAmount('Infinity'), null, 'Infinity');
eq(parseAmount(NaN), null, 'NaN number');
eq(parseAmount(Infinity), null, 'Infinity number');
eq(parseAmount('2 k'), null, '2 k (space inside)');
eq(parseAmount('2kk'), null, '2kk');
eq(parseAmount('2t'), 2000000000000, '2t (trillion, 3.1.4)');
eq(parseAmount('2x'), null, '2x');
eq(parseAmount('.5k'), null, '.5k');
eq(parseAmount('5.k'), null, '5.k');
eq(parseAmount('0x10'), null, '0x10');
eq(parseAmount('١٢'), null, 'other digits');
eq(parseAmount('9007199254740991'), Number.MAX_SAFE_INTEGER, 'MAX_SAFE_INTEGER');
eq(parseAmount('9007199254740992'), 9007199254740992, 'past MAX_SAFE_INTEGER: a double since 3.1.5');
eq(parseAmount('9007200b'), 9007200000000000, '9007200b is past MAX_SAFE_INTEGER: fine since 3.1.5');
eq(parseAmount('9007199b'), 9007199000000000, '9007199b fits');
eq(parseAmount('99999999999999999999999b'), 99999999999999999999999e9, 'huge but under a googol');

// Up to a googol (3.1.5): every -illion, scientific, and the word.
eq(parseAmount('5qa'), 5e15, '5qa');
eq(parseAmount('5QA'), 5e15, '5QA');
eq(parseAmount('5q'), 5e15, '5q (q is qa)');
eq(parseAmount('11qa'), 1.1e16, '11qa: past 2^53');
eq(parseAmount('3qi'), 3e18, '3qi');
eq(parseAmount('2sx'), 2e21, '2sx');
eq(parseAmount('2Sp'), 2e24, '2Sp');
eq(parseAmount('2oc'), 2e27, '2oc');
eq(parseAmount('2no'), 2e30, '2no');
eq(parseAmount('2NO'), 2e30, '2NO');
eq(parseAmount('1.5dc'), 1.5e33, '1.5dc');
eq(parseAmount('1e40'), 1e40, '1e40');
eq(parseAmount('2.5e50'), 2.5e50, '2.5e50');
eq(parseAmount('2.5E+50'), 2.5e50, '2.5E+50');
eq(parseAmount('1e100'), 1e100, '1e100: exactly a googol');
eq(parseAmount('googol'), 1e100, 'googol');
eq(parseAmount('Googol'), 1e100, 'Googol');
eq(parseAmount(1e100), 1e100, 'the number 1e100');
eq(parseAmount(2.5e40), 2.5e40, 'the number 2.5e40');
eq(parseAmount(1.1e16), 1.1e16, 'the number 1.1e16');
eq(parseAmount('1e101'), null, '1e101: over a googol');
eq(parseAmount('2e100'), null, '2e100: over a googol');
eq(parseAmount('10000000000dc'), 1e43, '10000000000dc');
eq(readAmount('1e101'), { over: true }, 'readAmount says over');
eq(amountTip('1e101'), 'That’s more than a googol.', 'the over-a-googol tip');
eq(amountTip('1.0000000001e100'), 'That’s more than a googol.', 'a hair over a googol');
eq(parseAmount('1e999'), null, '1e999');
eq(parseAmount('1e1000'), null, '1e1000 (exponent too long)');
eq(parseAmount('1e-5'), null, '1e-5');
eq(parseAmount('2.5e0'), null, '2.5e0 is not whole');
eq(amountTip('1.2345e3'), '1.2345e3 is 1234.5 coins. Coins are whole: try 1235.', '1.2345e3: whole-number tip below 2^53');
// At or past 2^53: rounded to a double, no whole-number complaint.
eq(parseAmount('9007199254740993'), 9007199254740992, '2^53 + 1 rounds to a double');
eq(parseAmount('9007199254740992.5'), 9007199254740992, '2^53 + 0.5: a double, no complaint');
eq(parseAmount('12.3456789012345678qa'), 12345678901234568, '12.3456789012345678qa rounds to a double');
eq(parseAmount('1.23456789012345678qa'), null, '1.23456789012345678qa is under 2^53 and not whole');
eq(amountTip('9007199254740992.5'), '', 'no tip past 2^53');
eq(parseAmount('1.5k'), 1500, 'still 1.5k');
eq(parseAmount('2nd'), null, '2nd');
eq(parseAmount('no'), null, 'no is not an amount');
eq(parseAmount('dc'), null, 'dc is not an amount');
eq(parseAmount('2qq'), null, '2qq');
eq(parseAmount('2e'), null, '2e');
eq(parseAmount('2ek'), null, '2ek');
eq(parseAmount('2e3k'), null, '2e3k');
eq(parseAmount('googols'), null, 'googols');

// Zero.
eq(parseAmount('0'), 0, '0');
eq(parseAmount('0k'), 0, '0k');
eq(parseAmount('0', { positive: true }), null, '0 when it must be positive');
eq(parseAmount('1', { positive: true }), 1, '1 when it must be positive');

// Not whole: refused with the nearest whole amount, never rounded.
eq(readAmount('1.2345k'), { near: 1235, exact: '1234.5' }, '1.2345k: 1234.5, nearest 1235');
eq(readAmount('1.2344k'), { near: 1234, exact: '1234.4' }, '1.2344k: nearest 1234');
eq(readAmount('2.5'), { near: 3, exact: '2.5' }, '2.5: nearest 3');
eq(readAmount('2k'), { amount: 2000 }, 'readAmount 2k');
eq(readAmount('bob'), null, 'readAmount bob');
eq(amountTip('1.2345k'), '1.2345k is 1234.5 coins. Coins are whole: try 1235.', 'the tip');
eq(amountTip('0.1'), '0.1 is 0.1 coins. Coins are whole: try 1.', 'the tip never says 0');
eq(amountTip('2k'), '', 'no tip for a whole amount');
eq(amountTip('bob'), '', 'no tip for a word');
eq(looksLikeAmount('2k'), true, 'looks like: 2k');
eq(looksLikeAmount('1.2345k'), true, 'looks like: 1.2345k');
eq(looksLikeAmount('-3'), true, 'looks like: -3');
eq(looksLikeAmount('1e6'), true, 'looks like: 1e6');
eq(looksLikeAmount('k'), false, 'looks like: k');
eq(looksLikeAmount('bob'), false, 'looks like: bob');
eq(looksLikeAmount('2nd'), false, 'looks like: 2nd');
eq(looksLikeAmount('5qa'), true, 'looks like: 5qa');
eq(looksLikeAmount('2.5e40'), true, 'looks like: 2.5e40');
eq(looksLikeAmount('googol'), true, 'looks like: googol');
eq(looksLikeAmount('2no'), true, 'looks like: 2no');
for (const w of ['no', 'No', 'sp', 'dc', 'oc', 'qa', 'qi', 'sx', 't', 'e', 'e5', 'nope', 'doc', 'spo'])
  eq(looksLikeAmount(w), false, `looks like: ${w} (a word, not an amount)`);

// Bets (casino.js parseBet: casino, arcade, challenge, heist, lottery).
eq(parseBet('1k', 5000), 1000, 'bet 1k');
eq(parseBet('2,500', 5000), 2500, 'bet 2,500');
eq(parseBet('1.5K', 5000), 1500, 'bet 1.5K');
eq(parseBet('2m', 5000), 2000000, 'bet 2m reads as 2000000 (the balance check refuses it)');
eq(parseBet('1.2345k', 5000), null, 'bet 1.2345k refused');
eq(parseBet('1e3', 5000), 1000, 'bet 1e3 reads as 1000 (3.1.5)');
eq(parseBet('5qa', 1.1e16), 5e15, 'bet 5qa');
eq(parseBet('all', 1.1e16), 1.1e16, 'bet all of 1.1e16');
eq(parseBet('half', 3e45), 1.5e45, 'bet half of 3e45');
eq(parseBet('25%', 1.1e16), 2.75e15, 'bet 25% of 1.1e16');
eq(parseBet('2e101', 5000), null, 'bet over a googol refused');
eq(parseBet('all', 5000), 5000, 'bet all still works');
eq(parseBet('half', 5000), 2500, 'bet half still works');
eq(parseBet('25%', 5000), 1250, 'bet 25% still works');
eq(parseBet('0', 5000), 0, 'bet 0 is 0, as before');
eq(parseBet('-5', 5000), null, 'bet -5 refused');

// Coin requests (coinRequests.js parseAsk).
const roster = ['Asher Mosseri', 'Cooper Mlezcko', 'Mia Chen'];
eq(parseAsk('@Mia 200,000 for a car', roster), { them: 'Mia Chen', known: true, amount: 200000, reason: 'for a car' }, 'ask @Mia 200,000');
eq(parseAsk('@Cooper Mlezcko 2k', roster).amount, 2000, 'ask 2k');
eq(parseAsk('@Cooper 1.5k pizza', roster).amount, 1500, 'ask 1.5k');
eq(Number.isNaN(parseAsk('@Cooper 1.2345k', roster).amount), true, 'ask 1.2345k is NaN (not whole)');
eq(Number.isNaN(parseAsk('@Cooper 2.5', roster).amount), true, 'ask 2.5 is NaN, as before');
eq(Number.isNaN(parseAsk('@Cooper -3', roster).amount), true, 'ask -3 is NaN, as before');
eq(parseAsk('@Cooper', roster).amount, null, 'ask with no amount');

// Gifts (coins.js giftEntry): a number, as before, or the text of one.
const g = (amount, balance = 1e9) => giftEntry('Asher Mosseri', { to: 'Cooper Mlezcko', amount }, { roster, balance, now: 1 });
eq(g(2000).amount, 2000, 'gift 2000');
eq(g('2k').amount, 2000, 'gift "2k"');
eq(g('6k').error, undefined, 'gift "6k" is fine (no 5000 cap since 3.1.3)');
eq(g('2m').error, undefined, 'gift "2m" is fine');
eq(g('2t', 1e13).error, undefined, 'gift "2t" is fine (no trillion cap since 3.1.5)');
eq(g('2t').error, 'You only have 1,000,000,000 coins.', 'gift "2t" with 1b: the balance check');
eq(GIFT_MAX, 1e100, 'the gift cap is a googol');
eq(g('5qa', 1.1e16).amount, 5e15, 'gift "5qa" with 1.1e16');
eq(g('2.5e40', 3e45).amount, 2.5e40, 'gift "2.5e40" with 3e45');
eq(g(1.1e16, 1.1e16).amount, 1.1e16, 'gift all of 1.1e16');
eq(g(1.1e16 + 2, 1.1e16).error, 'You only have 11,000,000,000,000,000 coins.', 'gift over a big balance');
eq(g('5qa', 1.1e16, ).amount, 5e15, 'gift 5qa');
eq(giftEntry('Asher Mosseri', { to: 'Cooper Mlezcko', amount: 10 }, { roster, balance: 100, toBalance: 1e100, now: 1 }).error, 'That would put Cooper over a googol coins.', 'a gift past a googol is refused');
eq(giftEntry('Asher Mosseri', { to: 'Cooper Mlezcko', amount: 2e90 }, { roster, balance: 3e95, toBalance: 1e100 - 1e90, now: 1 }).error, 'That would put Cooper over a googol coins.', 'a big gift to someone near a googol is refused');
eq(giftEntry('Asher Mosseri', { to: 'Cooper Mlezcko', amount: 1e16 }, { roster, balance: 3e45, toBalance: 1e100 - 1e90, now: 1 }).amount, 1e16, 'a gift that fits under a googol is fine');
eq(giftEntry('Asher Mosseri', { to: 'Cooper Mlezcko', amount: 1 }, { roster, balance: 3e45, toBalance: 2e100, now: 1 }).error, 'That would put Cooper over a googol coins.', 'someone already over a googol gets nothing');
eq(g('2k', 100).error, 'You only have 100 coins.', 'gift "2k" with 100 coins');
eq(g('1.2345k').error, 'Send at least 1 coin.', 'gift "1.2345k" refused');
eq(g('1e3').amount, 1000, 'gift "1e3" is 1000 (3.1.5)');
eq(g('1.5e0').error, 'Send at least 1 coin.', 'gift "1.5e0" refused');
eq(g(NaN).error, 'Send at least 1 coin.', 'gift NaN refused');
eq(g(Infinity, Infinity).error, 'Send at least 1 coin.', 'gift Infinity refused');
eq(g('2e101', Infinity).error, 'That’s more than a googol.', 'gift "2e101" refused: over a googol');
eq(g(2e100, Infinity).error, 'That’s more than a googol.', 'gift number over a googol refused');
eq(g(2.5).error, 'Send at least 1 coin.', 'gift 2.5 refused, as before');
eq(g(0).error, 'Send at least 1 coin.', 'gift 0 refused');

// 3.2.10: every -illion on up to a googol, typed in any case, and the
// formatter's short text reads back as the same number.
{
  const NAMES = [['ud', 36], ['dd', 39], ['td', 42], ['qad', 45], ['qid', 48], ['sxd', 51], ['spd', 54], ['ocd', 57], ['nod', 60],
    ['vg', 63], ['uvg', 66], ['dvg', 69], ['tvg', 72], ['qavg', 75], ['qivg', 78], ['sxvg', 81], ['spvg', 84], ['ocvg', 87], ['novg', 90],
    ['tg', 93], ['utg', 96], ['dtg', 99]];
  for (const [n, e] of NAMES) {
    eq(parseAmount(`1${n}`), Number(`1e${e}`), `1${n}`);
    eq(parseAmount(`2.5${n.toUpperCase()}`), Number(`2.5e${e}`), `2.5${n.toUpperCase()}`);
    eq(parseAmount(n), null, `${n} alone is not an amount`);
    eq(looksLikeAmount(`3${n}`), true, `looks like: 3${n}`);
  }
  eq(parseAmount('10Dtg'), 1e100, '10Dtg is a googol');
  eq(readAmount('10.1Dtg')?.over, true, '10.1Dtg is over a googol');
  eq(readAmount('11dtg')?.over, true, '11dtg is over a googol');
  eq(parseAmount('1.5Qavg'), 1.5e75, '1.5Qavg');
  eq(parseAmount('7Nod'), 7e60, '7Nod (not 7No then d)');
  eq(parseAmount('3Tg'), 3e93, '3Tg (not 3T then g)');
  eq(parseAmount('5qad'), 5e45, '5qad');
  eq(parseAmount('5qa'), 5e15, '5qa still quadrillion');
  eq(parseAmount('2dc'), 2e33, '2dc still decillion');
  for (const w of ['vg', 'Tg', 'nod', 'ud', 'dd', 'td'])
    eq(looksLikeAmount(w), false, `${w} on its own is a word`);
}

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
