// 3.2 economy rules: coins and games only in #arcade (commandRules.js,
// commands.js arcadeNote) and loan length changes (shared/loans.js changeCheck).
// Run: node scripts/test-econ32.mjs
import { arcadeOnly, blocked, isCoinCommand, serverGroup, whereFor } from '../functions/shared/commandRules.js';
import { arcadeNote, parseCommand, runCommand } from '../src/commands.js';
import { isCoinAsk } from '../src/requestCommand.js';
import * as L from '../functions/shared/loans.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const roster = ['Asher Mosseri', 'Cooper Mlezcko', 'Mia Chen'];

// ---------- arcade only ----------
for (const name of ['slots', 'lottery', 'tetris', 'minesweep', 'battleship', 'trivia', 'hangman', 'typerace', 'rps', 'tictactoe', 'connect4', 'duel', 'heist', 'challenge', 'give', 'balance', 'leaderboard', 'loan', 'work', 'daily', 'beg', 'rob'])
  eq(isCoinCommand(name), true, `/${name} is a coins-and-games command`);
for (const name of ['roll', 'flip', 'bestof', 'whois', 'poll', 'task', 'request']) eq(isCoinCommand(name), false, `/${name} is not`);
eq(isCoinCommand('request', { coinAsk: true }), true, '/request for coins is');
eq(isCoinAsk('@Cooper 25 for pizza', roster), true, '/request @Cooper 25 asks for coins');
eq(isCoinAsk('Cooper 25 pizza', roster), true, '/request Cooper 25 asks for coins');
eq(isCoinAsk('coins', roster), true, '/request coins opens the coin form');
eq(isCoinAsk('dark mode for the robot tab', roster), false, 'an idea is not');
eq(isCoinAsk('channel build-log', roster), false, 'a channel request is not');
eq(arcadeOnly('give', 'arcade'), null, '/give works in #arcade');
eq(arcadeOnly('give', 'general')?.go, 'arcade', '/give in #general goes to #arcade');
eq(arcadeOnly('slots', 'dm:abc')?.title, 'Coins and games are in #arcade', '/slots in a DM says so');
eq(arcadeOnly('roll', 'general'), null, '/roll works anywhere');
// The Commands page's Where can't move coin groups out of #arcade.
const anywhere = { where: { casino: null, arcade: null, economy: null } };
eq(whereFor('casino', anywhere), ['arcade'], 'casino Where is #arcade whatever the setting');
eq(blocked('slots', serverGroup('slots'), 'general', anywhere)?.go, 'arcade', 'the play check refuses /slots in #general');
eq(blocked('work', serverGroup('work'), 'arcade', anywhere), null, 'the play check lets /work run in #arcade');
eq(blocked('give', 'economy', 'dm:x', {})?.go, 'arcade', 'coin requests refused in DMs (the give check)');
eq(blocked('slots', 'casino', 'arcade', { off: ['slots'] })?.title, '/slots is turned off', 'off still wins in #arcade');
const P = (t) => parseCommand(t);
eq(arcadeNote(P('/give @Cooper 5'), 'general', roster)?.go, 'arcade', 'composer: /give in #general');
eq(arcadeNote(P('/request @Cooper 5 pizza'), 'general', roster)?.go, 'arcade', 'composer: coin /request in #general');
eq(arcadeNote(P('/request a dark mode'), 'general', roster), null, 'composer: idea /request stays');
eq(arcadeNote(P('/balance'), 'arcade', roster), null, 'composer: /balance in #arcade sends');
eq(arcadeNote(P('/roll 2d6'), 'dm:x', roster), null, 'composer: /roll in a DM sends');
// runCommand checks too (in case the composer didn't).
const ctx = (conv) => ({ conv, actor: { name: 'Mia Chen' }, roster, commandCfg: {}, play: async () => ({ ok: true }), wallet: () => ({ balance: 10 }) });
eq((await runCommand(P('/slots 5'), ctx('general'))).note?.go, 'arcade', 'runCommand: /slots in #general is a note');
eq((await runCommand(P('/slots 5'), ctx('arcade'))).done, true, 'runCommand: /slots in #arcade runs');

// ---------- loan length changes ----------
const D = L.DAY;
const W = L.WEEK;
const now = 1_800_000_000_000;
const loan = {
  id: 'l1', borrower: 'Mia Chen', lender: 'Cooper Mlezcko', bank: false, status: 'active', startAt: now - 3 * D, dueAt: now - 3 * D + 2 * W,
  terms: { amount: 100, style: 'weekly', rate: 5, term: 2, standard: false }, paid: 0, history: [],
};
const apply = (l, r) => ({ ...l, ...r.patch, history: L.withLine(l.history, r.history) });
let r = L.changeCheck(loan, { role: 'borrower', action: 'ask', weeks: 4, now });
eq(r.patch?.change?.dueAt, loan.startAt + 4 * W, 'borrower asks for 4 weeks');
eq(r.patch?.dueAt, undefined, 'asking alone changes nothing');
let l2 = apply(loan, r);
eq(L.changeCheck(l2, { role: 'borrower', action: 'accept', now }).error, 'Waiting for the other side to answer.', 'the asker can’t accept their own ask');
eq(L.changeCheck(l2, { role: 'borrower', action: 'ask', weeks: 5, now }).error, 'You already asked. Take that one back first.', 'one ask at a time');
r = L.changeCheck(l2, { role: 'lender', action: 'accept', now: now + D });
const l3 = apply(l2, r);
eq([l3.dueAt, l3.terms.term, l3.change, l3.remindedAt], [loan.startAt + 4 * W, 4, null, null], 'lender accepts: due date and term move');
eq(L.owedOf(l3, l3.dueAt), Math.ceil(100 * 1.2), 'weekly interest follows the new length');
r = L.changeCheck(l2, { role: 'lender', action: 'decline', now });
eq([apply(l2, r).dueAt, apply(l2, r).change], [loan.dueAt, null], 'lender says no: nothing changes');
r = L.changeCheck(l2, { role: 'borrower', action: 'cancel', now });
eq(apply(l2, r).change, null, 'borrower takes it back');
eq(L.changeCheck(l2, { role: 'lender', action: 'cancel', now }).error, 'Only the one who asked can take it back.', 'only the asker cancels');
// Shorter, from the lender: the borrower has to agree.
r = L.changeCheck(loan, { role: 'lender', action: 'ask', dueAt: now + 2 * D, now });
eq(r.patch?.change?.by, 'lender', 'lender asks for a shorter loan');
eq(L.changeCheck(apply(loan, r), { role: 'borrower', action: 'accept', now: now + 2 * D - 1000 }).error, 'That date is too close now.', 'a date that got too close can’t be accepted');
eq(L.changeCheck(loan, { role: 'lender', action: 'ask', weeks: 4, now }).error, 'More time doesn’t need an answer: use Extend.', 'the lender gives more time with Extend, not an ask');
// Limits.
eq(L.changeCheck(loan, { role: 'borrower', action: 'ask', dueAt: now + 3600000, now }).error, 'The new due date has to be at least a day away.', 'at least a day away');
eq(L.changeCheck(loan, { role: 'borrower', action: 'ask', weeks: 13, now }).error, 'Pick 1 to 12 weeks.', 'at most 12 weeks');
eq(L.changeCheck(loan, { role: 'borrower', action: 'ask', dueAt: loan.dueAt, now }).error, 'That’s the due date it has now.', 'the same date');
eq(L.changeCheck({ ...loan, changes: 10 }, { role: 'borrower', action: 'ask', weeks: 3, now }).error, 'That’s a lot of asks on one loan.', 'ten asks a loan');
// Overdue: the due date already took it; only the lender's Extend helps.
eq(L.changeCheck({ ...loan, status: 'overdue' }, { role: 'borrower', action: 'ask', weeks: 4, now }).error, 'The due date already took what was left.', 'no change once overdue');
// Past due but not collected yet: asking is fine, and it still needs the lender.
const late = { ...loan, dueAt: now - 1000 };
eq(L.lockOf([late], 0, now)?.owe > 0, true, 'past due: locked');
r = L.changeCheck(late, { role: 'borrower', action: 'ask', weeks: 4, now });
eq(L.lockOf([apply(late, r)], 0, now)?.owe > 0, true, 'still locked after asking');
eq(L.lockOf([apply(apply(late, r), L.changeCheck(apply(late, r), { role: 'lender', action: 'accept', now }))], 0, now), null, 'unlocked only when the lender agrees');
// The due date clears an ask that's waiting.
eq(L.collectOf(l2, { balance: 500, now: l2.dueAt }).patch.change, null, 'collection clears a waiting ask');
eq(L.lineText({ act: 'change', by: 'borrower', dueAt: now }, loan).startsWith('Mia asked to move the due date to'), true, 'history line');

// ---------- earnings that grow with the balance ----------
const C = await import('../functions/shared/coins.js');
eq(C.scaledPay('hours', 4, 18e18), 18e18 * 1e-4, '4 an hour at 18 quintillion: 0.01% an hour');
eq(C.scaledPay('task', 15, 1e6), 100, 'a task at a million: 100');
eq(C.scaledPay('task', 15, 1000), 15, 'a small balance: the normal 15');
eq(C.scaledPay('task', 15, -1e9), 15, 'below zero: the normal 15');
eq(C.scaledPay('task', 0, 1e9), 0, 'nothing earned stays nothing');
eq(C.scaledPay('nope', 15, 1e18), 15, 'a source with no scale: the normal pay');
eq(C.scaledPay('task', 15, C.MAX_BALANCE) , 15, 'at the ceiling: the normal pay');
eq(C.scaledPay('quiz', 6, 1e9) , 2 * C.scaledPay('quiz', 3, 1e9), 'twice the normal pay, twice the share');
eq(Object.keys(C.EARN_SCALE).every((k) => C.EARN_SCALE[k].pct <= 0.01), true, 'no source pays more than 0.01% per normal earning');
const H = (amount, at) => ({ amount, at });
eq(C.earnBalance([H(100, now - 2 * D), H(1e9, now - 1000)], now), 100, 'a fortune from a minute ago doesn’t count yet');
eq(C.earnBalance([H(1e9, now - 2 * D), H(-1e9 + 5, now - 3600000), H(1e9, now - 1000)], now), 5, 'given away and back within the day: the low point');
eq(C.earnBalance([H(1e9, now - 2 * D)], now), 1e9, 'held all day: the balance');
// The wallet counts a top-up only while its task still pays.
const cfg = C.coinSettings({ ratesFrom: '2026-01-01', start: '2026-01-01' });
const t = { id: 't1', title: 'X', status: 'done', assignees: ['Mia Chen'], createdBy: 'Cooper Mlezcko', completedAt: Date.UTC(2026, 10, 5, 15) };
const top = { type: 'scale', person: 'Mia Chen', ref: 'task:t1', amount: 985, base: 15, at: t.completedAt };
const w = (tasks) => C.wallet('Mia Chen', C.coinInput({ tasks, shifts: [], ledger: [top], bank: [], rename: (x) => x, cfg, names: ['Mia Chen'], now: Date.UTC(2026, 10, 6) }));
eq(w([t]).balance, 1000, 'done task with a top-up: 15 + 985');
eq(w([{ ...t, status: 'doing' }]).balance, 0, 'out of Done: the top-up goes too');
eq(w([{ ...t, createdBy: 'Mia Chen' }]).balance, 0, 'a task that doesn’t pay: no top-up');

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
