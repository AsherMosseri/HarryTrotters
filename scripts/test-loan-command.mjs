// /loan (src/loanCommand.js): reading what was typed, the notes for
// mistakes, and the suggestions after "/loan ". Also runCommand: groups
// refused, Controls switches, hidden when loans or coins are off.
// Run: node scripts/test-loan-command.mjs
import { loanOff, loanOptions, parseLoan, runLoan } from '../src/loanCommand.js';
import { parseCommand, runCommand, matchCommands, COMMANDS } from '../src/commands.js';
import { commandCfgFor } from '../src/controls.js';
import { loanSettings } from '../functions/shared/loans.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const roster = ['Asher Mosseri', 'Cooper Mlezcko', 'Mia Chen', 'Ira Diaz', 'Ira Patel', 'Trotbot'];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const P = (t) => pick(parseLoan(t, roster), ['open', 'pay', 'mode', 'who', 'known', 'amount', 'rate', 'style', 'term', 'note']);

// Reading it.
eq(P(''), { open: true }, 'bare /loan opens Loans');
eq(P('pay'), { pay: true }, 'pay');
eq(P('Repay'), { pay: true }, 'Repay');
eq(P('100'), { mode: 'bank', who: '', known: true, amount: 100, note: '' }, '/loan 100 is the bank');
eq(P('100 new wheels'), { mode: 'bank', who: '', known: true, amount: 100, note: 'new wheels' }, '/loan 100 reason');
eq(P('bank 100 for parts'), { mode: 'bank', who: '', known: true, amount: 100, note: 'for parts' }, '/loan bank 100 for parts');
eq(P('the bank 2k'), { mode: 'bank', who: '', known: true, amount: 2000, note: '' }, '/loan the bank 2k');
eq(P('bank'), { mode: 'bank', who: '', known: true, note: '' }, '/loan bank (no amount)');
eq(P('@Cooper 50 pizza'), { mode: 'person', who: 'Cooper Mlezcko', known: true, amount: 50, note: 'pizza' }, '/loan @Cooper 50 pizza');
eq(P('@Cooper Mlezcko 50'), { mode: 'person', who: 'Cooper Mlezcko', known: true, amount: 50, note: '' }, 'full name');
eq(P('cooper 1.5k'), { mode: 'person', who: 'Cooper Mlezcko', known: true, amount: 1500, note: '' }, 'no @, 1.5k');
eq(P('@Cooper'), { mode: 'person', who: 'Cooper Mlezcko', known: true, note: '' }, '/loan @Cooper (no amount)');
eq(P('@Bob 50'), { mode: 'person', who: 'Bob', known: false, amount: 50, note: '' }, 'unknown person');
eq(parseLoan('@Ira 50', roster).ambiguous, ['Ira Diaz', 'Ira Patel'], 'two Iras');
eq(Number.isNaN(P('bank 1.2345k').amount), true, '1.2345k is not whole');
eq(Number.isNaN(P('bank -5').amount), true, '-5');
eq(P('bank 200,000').amount, 200000, '200,000');
eq(P('bank 2m').amount, 2000000, '2m');

// Terms.
eq(P('bank 100 10% weekly 2w for parts'), { mode: 'bank', who: '', known: true, amount: 100, rate: 10, style: 'weekly', term: 2, note: 'for parts' }, 'rate, style, term, reason');
eq(P('@Mia 50 5% once 4w'), { mode: 'person', who: 'Mia Chen', known: true, amount: 50, rate: 5, style: 'flat', term: 4, note: '' }, 'once 4w');
eq(P('bank 100 5% a week 1 week bike'), { mode: 'bank', who: '', known: true, amount: 100, rate: 5, style: 'weekly', term: 1, note: 'bike' }, '"a week" and "1 week"');
eq(P('bank 100 new bike 10% 2w'), { mode: 'bank', who: '', known: true, amount: 100, rate: 10, term: 2, note: 'new bike' }, 'terms at the end');
eq(P('bank 100 lunch for a week'), { mode: 'bank', who: '', known: true, amount: 100, note: 'lunch for a week' }, '"a week" at the end stays in the reason');
eq(P('bank 100 lunch for 2 weeks'), { mode: 'bank', who: '', known: true, amount: 100, term: 2, note: 'lunch for' }, '"2 weeks" at the end is the term');
eq(P('bank 100 standard 4 weeks'), { mode: 'bank', who: '', known: true, amount: 100, style: 'standard', term: 4, note: '' }, 'standard');
eq(P('bank 100 10% interest'), { mode: 'bank', who: '', known: true, amount: 100, rate: 10, note: '' }, '"10% interest"');
eq(P('@Cooper 2w 50').who, 'Cooper Mlezcko', 'a term before the amount ends the name');

// Running it.
const loans = (extra = {}) => ({ cfg: loanSettings({}), owner: false, lock: null, borrowing: [], ...extra });
const ctx = (extra = {}) => ({ actor: { name: 'Asher Mosseri' }, roster, isOn: () => true, loans: loans(), ...extra });
const R = (t, c = ctx()) => runLoan(t, c);
const title = (r) => r.note?.title;
eq(R(''), { loan: { open: true } }, 'run: bare');
eq(R('bank 100 10% 2w parts').loan, { mode: 'bank', who: '', amount: 100, rate: 10, term: 2, note: 'parts' }, 'run: bank prefill');
eq(R('@Cooper 50').loan, { mode: 'person', who: 'Cooper Mlezcko', amount: 50, note: '' }, 'run: teammate prefill');
eq(title(R('@Bob 50')), 'Who’s “Bob”?', 'run: Who’s “Bob”?');
eq(title(R('Bob 50')), 'Who’s “Bob”?', 'run: Who’s “Bob”? without @');
eq(title(R('@Ira 50')), 'Which one?', 'run: Which one?');
eq(title(R('@Asher 50')), 'That’s you.', 'run: yourself');
eq(title(R('@Trotbot 50')), 'Trotbot doesn’t lend coins.', 'run: Trotbot');
eq(title(R('bank 1.2345k')), 'Ask for a whole number of coins, at least 1.', 'run: not whole');
eq(R('bank 1.2345k').note.body, '1.2345k is 1234.5 coins. Coins are whole: try 1235.', 'run: nearest whole amount');
eq(title(R('bank -5')), 'Ask for a whole number of coins, at least 1.', 'run: -5');
eq(title(R('bank 0')), 'Ask for a whole number of coins, at least 1.', 'run: 0');
eq(title(R('bank 2m')), 'Up to 500 coins from the bank.', 'run: 2m is over the bank cap');
eq(title(R('bank 501')), 'Up to 500 coins from the bank.', 'run: 501 is over the bank cap');
eq(R('bank 500').loan.amount, 500, 'run: 500 from the bank');
eq(title(R('@Cooper 5001')), 'Up to 5000 coins from a teammate.', 'run: over the teammate cap');
eq(R('@Cooper 5k').loan.amount, 5000, 'run: 5k from a teammate');
eq(title(R('bank 100 60%')), 'Interest is a whole number from 0 to 50%.', 'run: 60%');
eq(title(R('bank 100 2.5%')), 'Interest is a whole number from 0 to 50%.', 'run: 2.5%');
eq(title(R('bank 100', ctx({ loans: loans({ owner: true }) }))), 'You’re the bank.', 'run: the owner can’t ask the bank');
eq(title(R('100', ctx({ loans: loans({ owner: true }) }))), 'You’re the bank.', 'run: the owner, /loan 100');
eq(R('@Cooper 50', ctx({ loans: loans({ owner: true }) })).loan.who, 'Cooper Mlezcko', 'run: the owner can ask a teammate');
eq(title(R('bank 100', ctx({ loans: loans({ lock: { title: 'Locked: below zero', body: 'b' } }) }))), 'Locked: below zero', 'run: locked');
eq(title(R('pay')), 'Nothing to pay back.', 'run: pay with nothing borrowed');
eq(R('pay', ctx({ loans: loans({ borrowing: [{ id: 'a', status: 'active' }] }) })).loan, { pay: true, focus: 'a' }, 'run: pay with one loan focuses it');
eq(
  R('pay', ctx({ loans: loans({ borrowing: [{ id: 'a', status: 'active' }, { id: 'b', status: 'overdue' }] }) })).loan,
  { pay: true, focus: null },
  'run: pay with two loans opens My loans',
);
eq(R('pay', ctx({ loans: loans({ lock: { title: 'Locked' }, borrowing: [{ id: 'a', status: 'overdue' }] }) })).loan.pay, true, 'run: pay works while locked');
eq(R('bank 100', ctx({ loans: null })).loan.amount, 100, 'run: before loans load');

// Off.
eq(loanOff('bank 100', ctx({ isOn: (id) => id !== 'coins' }))?.title, '🪙 Jackson coins are off right now.', 'off: coins');
const off = ctx({ loans: loans({ cfg: loanSettings({ on: false }) }) });
eq(loanOff('bank 100', off)?.title, 'Loans are off right now.', 'off: loans');
eq(loanOff('pay', off), null, 'off: /loan pay still works');
eq(loanOff('bank 100', { ...off, loans: { ...off.loans, owner: true } }), null, 'off: not for the owner');
eq(loanOff('bank 100', ctx()), null, 'on');

// Suggestions after "/loan ".
const S = (q, extra = {}) => loanOptions(q, { roster, me: 'Asher Mosseri', ...extra }).map((o) => o.insert);
eq(S(''), ['bank', 'pay', '@Cooper Mlezcko', '@Mia Chen', '@Ira Diaz', '@Ira Patel'], 'suggest: bank, pay, people (not me or Trotbot)');
eq(S('b'), ['bank'], 'suggest: b');
eq(S('p'), ['pay', '@Ira Patel'], 'suggest: p');
eq(S('@co'), ['@Cooper Mlezcko'], 'suggest: @co');
eq(S('', { owner: true })[0], 'pay', 'suggest: no bank for the owner');

// The command itself.
const loanCmd = COMMANDS.find((c) => c.name === 'loan');
eq(!!loanCmd, true, '/loan is a command');
eq(loanCmd?.bare, true, '/loan sends on one Return');
eq(loanCmd?.group, 'economy', '/loan is with the coin commands');
eq(COMMANDS.length, 112, '112 commands');
eq(matchCommands('loa', {})[0]?.name, 'loan', '/loa suggests /loan');
const run = (text, extra = {}) =>
  runCommand(parseCommand(text), { conv: 'general', commandCfg: {}, ...ctx(), ...extra });
eq(await run('/loan'), { loan: { open: true } }, 'runCommand: /loan');
eq((await run('/loan @Programming 50')).note?.title, '/loan is one person at a time.', 'runCommand: a group is refused');
eq((await run('/loan @everyone 50')).note?.title, '/loan is one person at a time.', 'runCommand: @everyone is refused');
eq((await run('/loan @Cooper 50')).loan?.who, 'Cooper Mlezcko', 'runCommand: a teammate');
eq((await run('/loan bank 100', { isOn: (id) => id !== 'coins' })).note?.title, '🪙 Jackson coins are off right now.', 'runCommand: coins off');
eq((await run('/loan bank 100', { loans: loans({ cfg: loanSettings({ on: false }) }) })).note?.title, 'Loans are off right now.', 'runCommand: loans off');
eq((await run('/loan bank 100', { commandCfg: { off: ['loan'] } })).note?.title, '/loan is turned off', 'runCommand: switched off on the Commands page');
// Hidden when coins or loans are off (the menu, /help and the Commands page read commandCfg.off).
const controls = (off = []) => ({ isOn: (id) => !off.includes(id) });
eq(commandCfgFor({}, controls(['coins'])).off.includes('loan'), true, 'hidden: coins off');
eq((commandCfgFor({}, controls(), { loansOn: false }).off || []).includes('loan'), true, 'hidden: loans off');
eq((commandCfgFor({}, controls(), { loansOn: true }).off || []).includes('loan'), false, 'shown: loans on');
eq(matchCommands('loa', commandCfgFor({}, controls(), { loansOn: false })).some((c) => c.name === 'loan'), false, 'not in the menu while loans are off');
eq(
  (await run('/loan pay', { commandCfg: commandCfgFor({}, controls(), { loansOn: false }), loans: loans({ cfg: loanSettings({ on: false }), borrowing: [{ id: 'a', status: 'active' }] }) })).loan,
  { pay: true, focus: 'a' },
  'runCommand: /loan pay while loans are off',
);

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
