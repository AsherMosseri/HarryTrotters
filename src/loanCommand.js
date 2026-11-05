// /loan (3.1.1): opens the Loans form, filled in from what was typed. It
// never asks for a loan itself: the person still looks it over and taps Send
// request, so every check on the server (functions/loans.js) stays the same.
//   /loan                        the coins screen, on Loans
//   /loan 100 [why]              Ask the bank, 100 filled in
//   /loan bank 100 [why]         the same
//   /loan @Cooper 50 [why]       Ask a teammate, Cooper and 50 filled in
//   /loan pay                    My loans, to pay one back
// After the amount, the terms the form has: 10% (interest), once or weekly
// (how it works), 1w / 2w / 4w or "2 weeks" (when it's paid back). Anything
// else is the reason; anything unclear stays as the form's default.
// Groups (@Programming, @everyone) are refused in commands.js (groups.js:
// /loan is one person at a time).
// commands.js runs it; Workspace opens the coins screen (api.openLoan) and
// Loans.jsx (useLoanPrefill) fills in the form.

import { OVER_GOOGOL, amountTip, looksLikeAmount, readAmount } from '../functions/shared/amount.js';
import { parseAsk } from '../functions/shared/coinRequests.js';
import { BOT } from '../functions/shared/groups.js';
import * as L from '../functions/shared/loans.js';

export const LOAN_WORDS = [
  ['bank', 'Ask the bank'],
  ['pay', 'Pay back a loan'],
];
const PAY = /^(pay|repay|payback|payoff)$/i;
const WEEK_WORD = /^(w|wk|wks|week|weeks)$/i;

// One term at words[i]: { take, rate?, style?, term? } or null. strong: only
// words that can't be part of a reason ("10%", "2w", "once", "weekly").
function termAt(words, i, strong = false) {
  const w = words[i];
  const next = words[i + 1] || '';
  let m = /^(\d+(?:\.\d+)?)%$/.exec(w);
  if (m) return { take: 1, rate: Number(m[1]) };
  if (/^(once|flat)$/i.test(w)) return { take: 1, style: 'flat' };
  if (/^(weekly|\/week|\/wk)$/i.test(w)) return { take: 1, style: 'weekly' };
  if (/^standard$/i.test(w)) return { take: 1, style: 'standard' };
  m = /^(\d+)(w|wk|wks|week|weeks)$/i.exec(w);
  if (m) return { take: 1, term: Number(m[1]) };
  if (/^\d+$/.test(w) && WEEK_WORD.test(next)) return { take: 2, term: Number(w) };
  if (strong) return null;
  // "10% a week", "per week", "each week".
  if (/^(a|per|each|every)$/i.test(w) && /^(week|wk)$/i.test(next)) return { take: 2, style: 'weekly' };
  if (/^interest$/i.test(w)) return { take: 1 };
  return null;
}

// What was typed, read. Never looks anything up but the roster.
//   { open: true }   nothing after /loan
//   { pay: true }    /loan pay
//   { mode: 'bank' | 'person', who, known, ambiguous, amountWord, amount,
//     rate, style, term, note }
// amount: a whole number, NaN when the amount word isn't one (amountWord
// says what it was), undefined when there's none.
export function parseLoan(text, roster = []) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return { open: true };
  if (PAY.test(words[0])) return { pay: true };
  const out = { mode: 'bank', who: '', known: true };
  let rest = words;
  if (/^@?bank$/i.test(words[0])) rest = words.slice(1);
  else if (/^the$/i.test(words[0]) && /^bank$/i.test(words[1] || '')) rest = words.slice(2);
  else if (!looksLikeAmount(words[0])) {
    // A teammate: the words up to the amount (or the first term) name them.
    let at = words.findIndex((w, i) => looksLikeAmount(w) || termAt(words, i, true));
    if (at < 0) at = words.length;
    const p = parseAsk(words.slice(0, at).join(' '), roster);
    Object.assign(out, { mode: 'person', who: p.them || '', known: !!p.known, ambiguous: p.ambiguous || null });
    rest = words.slice(at);
  }
  if (rest.length && looksLikeAmount(rest[0]) && !termAt(rest, 0, true)) {
    out.amountWord = rest[0].replace('🪙', '');
    const r = readAmount(out.amountWord);
    out.amount = r && r.amount !== undefined ? r.amount : NaN;
    rest = rest.slice(1);
  }
  // Terms right after the amount, then the reason, then terms at the end.
  const take = (t) => {
    if (t.rate !== undefined && out.rate === undefined) out.rate = t.rate;
    if (t.style && !out.style) out.style = t.style;
    if (t.term !== undefined && out.term === undefined) out.term = t.term;
  };
  let i = 0;
  for (let t; i < rest.length && (t = termAt(rest, i)); i += t.take) take(t);
  let end = rest.length;
  for (;;) {
    // The last strong term (one word, or "2 weeks").
    const one = end - 1 >= i && termAt(rest, end - 1, true);
    const two = end - 2 >= i && termAt(rest, end - 2, true);
    if (two && two.take === 2) {
      take(two);
      end -= 2;
    } else if (one && one.take === 1) {
      take(one);
      end -= 1;
    } else break;
  }
  out.note = rest.slice(i, end).join(' ').slice(0, L.LIMITS.note);
  return out;
}

// What /loan does. ctx is runCommand's (commands.js): actor, roster, isOn,
// and loans (Loans.jsx useLoans: cfg, owner, lock, borrowing), or null
// before they've loaded. Returns { note } or { loan } (what to fill in).
export function runLoan(args, ctx) {
  const note = (title, body = '') => ({ note: { title, body } });
  const me = ctx.actor?.name;
  const loans = ctx.loans || null;
  const cfg = loans?.cfg || L.loanSettings({});
  const owner = !!loans?.owner;
  const p = parseLoan(args, ctx.roster || []);
  if (p.open) return { loan: { open: true } };
  if (p.pay) {
    const mine = (loans?.borrowing || []).filter((l) => L.OPEN.includes(l.status));
    if (loans && !mine.length) return note('Nothing to pay back.', 'You don’t owe any coins right now.');
    const live = mine.filter((l) => L.LIVE.includes(l.status));
    return { loan: { pay: true, focus: live.length === 1 ? live[0].id : null } };
  }
  const bank = p.mode === 'bank';
  const usage = bank ? 'Try: /loan bank 100 for parts' : 'Try: /loan @Cooper 50 for parts';
  if (bank && owner) return note('You’re the bank.', 'Ask a teammate instead: /loan @Cooper 50');
  if (!bank) {
    if (p.ambiguous) return note('Which one?', `${p.ambiguous.join(', ')}. Use their full name, like /loan @${p.ambiguous[0]} ${p.amount || 50}`);
    if (!p.known) return note(`Who’s “${p.who}”?`, usage);
    if (p.who === me) return note('That’s you.', 'Ask the bank or a teammate: /loan bank 100');
    if (p.who === BOT) return note('Trotbot doesn’t lend coins.', 'Ask the bank or a teammate: /loan bank 100');
  }
  if (readAmount(p.amountWord || '')?.over) return note(OVER_GOOGOL, 'Nobody can hold more than that.');
  if (Number.isNaN(p.amount) || p.amount === 0)
    return note('Ask for a whole number of coins, at least 1.', amountTip(p.amountWord) || usage);
  // Up to a googol (3.1.5: the bank's and a teammate's limit is the ceiling).
  const max = bank ? cfg.bankMax : L.PEER_MAX;
  if (p.amount > max) return note(OVER_GOOGOL, 'Nobody can hold more than that.');
  if (p.rate !== undefined && !(Number.isInteger(p.rate) && p.rate <= L.RATE_MAX))
    return note(`Interest is a whole number from 0 to ${L.RATE_MAX}%.`, `${usage} 10%`);
  if (loans?.lock) return note(loans.lock.title, loans.lock.body);
  return {
    loan: {
      mode: p.mode,
      who: bank ? '' : p.who,
      amount: p.amount,
      rate: p.rate,
      style: p.style,
      term: p.term,
      note: p.note,
    },
  };
}

// Why /loan can't run at all, before anything else is read: coins or loans
// switched off (Controls). /loan pay still opens My loans while loans are off
// (loans already going keep going). null when it can.
export function loanOff(args, ctx) {
  if (ctx.isOn && !ctx.isOn('coins')) return { title: '🪙 Jackson coins are off right now.' };
  if (ctx.loans && !ctx.loans.cfg?.on && !ctx.loans.owner && !PAY.test(String(args || '').trim().split(/\s+/)[0]))
    return { title: 'Loans are off right now.', body: 'They’re switched off in Controls. Loans already going keep going: /loan pay opens yours.' };
  return null;
}

// What the message box suggests after "/loan ": bank and pay, then people.
export function loanOptions(q, { roster = [], me, owner = false }) {
  const lower = q.toLowerCase().replace(/^@/, '');
  const words = q.startsWith('@')
    ? []
    : LOAN_WORDS.filter(([w]) => !(w === 'bank' && owner) && w.startsWith(lower)).map(([word, desc]) => ({
        type: 'askword',
        key: `w-${word}`,
        insert: word,
        word,
        desc,
      }));
  const people = roster
    .filter((n) => n !== me && n !== BOT && (n.toLowerCase().startsWith(lower) || n.toLowerCase().split(' ').some((w) => w.startsWith(lower))))
    .map((n) => ({ type: 'person', key: `p-${n}`, insert: `@${n}`, name: n }));
  return [...words, ...people].slice(0, 8);
}

// From the command to the form: Workspace calls openLoanForm when /loan opens
// the coins screen, and the Loans panel takes it (Loans.jsx useLoanPrefill),
// once. No React in here.
let pending = null;
const listeners = new Set();
export function openLoanForm(prefill) {
  pending = { ...prefill, n: Date.now() + Math.random() };
  listeners.forEach((f) => f(pending));
}
export const peekLoanForm = () => pending;
export function takeLoanForm() {
  const p = pending;
  pending = null;
  return p;
}
export function onLoanForm(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}
