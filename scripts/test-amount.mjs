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
eq(parseAmount('1e6'), null, '1e6');
eq(parseAmount('1E6'), null, '1E6');
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
eq(parseAmount('2t'), null, '2t');
eq(parseAmount('.5k'), null, '.5k');
eq(parseAmount('5.k'), null, '5.k');
eq(parseAmount('0x10'), null, '0x10');
eq(parseAmount('١٢'), null, 'other digits');
eq(parseAmount('9007199254740991'), Number.MAX_SAFE_INTEGER, 'MAX_SAFE_INTEGER');
eq(parseAmount('9007199254740992'), null, 'past MAX_SAFE_INTEGER');
eq(parseAmount('9007200b'), null, '9007200b is past MAX_SAFE_INTEGER');
eq(parseAmount('9007199b'), 9007199000000000, '9007199b fits');
eq(parseAmount('99999999999999999999999b'), null, 'huge');

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

// Bets (casino.js parseBet: casino, arcade, challenge, heist, lottery).
eq(parseBet('1k', 5000), 1000, 'bet 1k');
eq(parseBet('2,500', 5000), 2500, 'bet 2,500');
eq(parseBet('1.5K', 5000), 1500, 'bet 1.5K');
eq(parseBet('2m', 5000), 2000000, 'bet 2m reads as 2000000 (the balance check refuses it)');
eq(parseBet('1.2345k', 5000), null, 'bet 1.2345k refused');
eq(parseBet('1e3', 5000), null, 'bet 1e3 refused');
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
eq(g('6k').error, 'That’s a lot.', `gift "6k" is over the ${GIFT_MAX} cap`);
eq(g('2m').error, 'That’s a lot.', 'gift "2m" is over the cap');
eq(g('2k', 100).error, 'You only have 100 coins.', 'gift "2k" with 100 coins');
eq(g('1.2345k').error, 'Send at least 1 coin.', 'gift "1.2345k" refused');
eq(g('1e3').error, 'Send at least 1 coin.', 'gift "1e3" refused');
eq(g(2.5).error, 'Send at least 1 coin.', 'gift 2.5 refused, as before');
eq(g(0).error, 'Send at least 1 coin.', 'gift 0 refused');

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
