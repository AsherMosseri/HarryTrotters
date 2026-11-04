// Loans (3.1): borrow Jackson coins from the bank or from a teammate. No
// Firebase in here: the server (functions/loans.js) and demo mode
// (src/data/demoLoans.js) run the same checks and the same math.
//
// The bank is not a person. Its coins are made up when a loan starts and are
// gone again when they're paid back: nobody's balance pays for a bank loan or
// gets its repayments. Only the owner (Asher) answers bank loans. A teammate
// lends their own coins, which come back with the interest.
//
// A loan goes: pending (asked, maybe countered back and forth) → active (the
// coins moved) → repaid, or, on the due date, whatever is left is taken from
// the borrower even if that puts them below zero → overdue until their
// balance is back to 0 (then repaid). It can also end denied, declined (the
// borrower said no to a counter), cancelled, expired (nobody answered for a
// week) or forgiven.
//
// Money moves only as 'loan' entries in the coins ledger (shared/coins.js
// ledgerItems), so the balance math is the same everywhere:
//   lend     lender → borrower (no lender: the bank made it)
//   repay    borrower → lender (no lender: paid back to the bank)
//   collect  the same as repay, taken on the due date
//   forgive  / extend  lender → borrower: what a due-date collection took
//            past zero, given back (forgive ends the loan; extend puts it
//            back on the loan with a new due date).

import { nameKey } from './team.js';

export const WEEK = 7 * 86400000;
export const DAY = 86400000;
// Loan lengths, in weeks.
export const TERMS = [1, 2, 4];
// Interest is a whole percent from 0 to RATE_MAX.
export const RATE_MAX = 50;
// flat: once (100 at 10% → 110). weekly: simple interest for every week
// started (100 at 5% a week, paid back in week 2 → 110).
export const STYLES = ['flat', 'weekly'];
// A teammate's standard rate. The bank's is in the loan settings.
export const PEER_STANDARD = { style: 'flat', rate: 10 };
// The most a teammate can lend at once (the same as GIFT_MAX in shared/coins.js).
export const PEER_MAX = 5000;
export const LIMITS = {
  note: 200,
  // Lines kept in a loan's thread, and counters before someone has to say yes or no.
  history: 40,
  counters: 10,
  // New loan requests a person can make in a team day.
  perDay: 5,
  // A request nobody answers is dropped after this long.
  expire: 7 * DAY,
  // The borrower hears this long before the due date.
  remind: 2 * DAY,
};
// Asher's loan settings (settings/loans; Controls, Loans). Bank loans only,
// except `on`, which stops new loan requests of every kind.
export const LOAN_DEFAULTS = { on: true, bankMax: 500, bankOpen: 1, peerOpen: 2, bankStyle: 'flat', bankRate: 10, terms: [1, 2, 4] };
// Still going (they count toward the limits). LIVE: coins have moved.
export const OPEN = ['pending', 'active', 'overdue'];
export const LIVE = ['active', 'overdue'];

const int = (v) => ((typeof v === 'number' || typeof v === 'string') && v !== '' && Number.isInteger(Number(v)) ? Number(v) : NaN);
const clamp = (v, lo, hi, d) => {
  const n = int(v);
  return Number.isNaN(n) ? d : Math.min(hi, Math.max(lo, n));
};
export const cleanNote = (v) =>
  String(v || '')
    .trim()
    .slice(0, LIMITS.note);

export function loanSettings(raw) {
  const r = raw || {};
  const terms = TERMS.filter((t) => (Array.isArray(r.terms) ? r.terms.map(Number) : LOAN_DEFAULTS.terms).includes(t));
  return {
    on: r.on !== false,
    bankMax: clamp(r.bankMax, 1, PEER_MAX, LOAN_DEFAULTS.bankMax),
    bankOpen: clamp(r.bankOpen, 0, 5, LOAN_DEFAULTS.bankOpen),
    peerOpen: clamp(r.peerOpen, 0, 5, LOAN_DEFAULTS.peerOpen),
    bankStyle: STYLES.includes(r.bankStyle) ? r.bankStyle : LOAN_DEFAULTS.bankStyle,
    bankRate: clamp(r.bankRate, 0, RATE_MAX, LOAN_DEFAULTS.bankRate),
    terms: terms.length ? terms : [...LOAN_DEFAULTS.terms],
  };
}

// The lender's standard rate.
export const standardOf = (bank, cfg) => (bank ? { style: cfg.bankStyle, rate: cfg.bankRate } : { ...PEER_STANDARD });

// What someone asked for (or countered with), checked: { terms } or { error }.
// style 'standard' becomes the lender's standard style and rate.
export function cleanTerms(input, { bank, cfg }) {
  const x = input || {};
  const amount = int(x.amount);
  const max = bank ? cfg.bankMax : PEER_MAX;
  if (!(amount >= 1)) return { error: 'How many coins?' };
  if (amount > max) return { error: `Up to ${max} coins${bank ? ' from the bank' : ''}.` };
  const term = int(x.term);
  const allowed = bank ? cfg.terms : TERMS;
  if (!allowed.includes(term)) return { error: `Pick ${allowed.map((t) => `${t} week${t > 1 ? 's' : ''}`).join(', ')}.` };
  if (x.style === 'standard') return { terms: { amount, ...standardOf(bank, cfg), term, standard: true } };
  if (!STYLES.includes(x.style)) return { error: 'Pick how the interest works.' };
  const rate = int(x.rate);
  if (!(rate >= 0 && rate <= RATE_MAX)) return { error: `Interest is a whole number from 0 to ${RATE_MAX}%.` };
  return { terms: { amount, style: x.style, rate, term, standard: false } };
}
const sameTerms = (a, b) => ['amount', 'style', 'rate', 'term'].every((k) => a?.[k] === b?.[k]);

// Weeks started since the coins moved, counted up to the due date (at least 1).
export function weeksStarted(loan, now) {
  const end = Math.min(now, loan.dueAt || now);
  return Math.max(1, Math.ceil((end - (loan.startAt || end)) / WEEK));
}
// Everything owed on a loan (rounded up to a whole coin, so no fraction is
// ever left over), before what's been paid.
export function owedOf(loan, now = Date.now()) {
  const { amount, style, rate } = loan.terms || {};
  const pct = style === 'weekly' ? rate * weeksStarted(loan, now) : rate;
  return Math.ceil((amount * (100 + pct)) / 100);
}
// What a set of terms comes to if it runs its full length.
export const fullOwed = (terms) => owedOf({ terms, startAt: 0, dueAt: terms.term * WEEK }, terms.term * WEEK);
export const leftOf = (loan, now = Date.now()) => (loan.status === 'active' ? Math.max(0, owedOf(loan, now) - (loan.paid || 0)) : 0);

// "100 coins · 10% once · 2 weeks", "100 coins · 5% a week · 4 weeks".
export function termsText(t) {
  if (!t) return '';
  const interest = t.rate === 0 ? 'no interest' : t.style === 'weekly' ? `${t.rate}% a week` : `${t.rate}% once`;
  return `${t.amount} coins · ${interest}${t.standard ? ' (standard)' : ''} · ${t.term} week${t.term > 1 ? 's' : ''}`;
}
export const lenderName = (loan) => (loan.bank ? 'the bank' : loan.lender);

// Who `me` is on this loan: 'borrower', 'lender' (the bank's lender is the
// owner), or ''.
export function roleOf(loan, me, { owner = '', rename = (n) => n } = {}) {
  if (!loan) return '';
  if (rename(loan.borrower) === me) return 'borrower';
  if (loan.bank ? me === owner : rename(loan.lender || '') === me) return 'lender';
  return '';
}
const sideOf = (role) => (role === 'borrower' ? 'borrower' : 'lender');

// Is this person locked by a loan: an active loan past its due date (the
// collection hasn't run yet), or one already collected that left them below
// zero. Returns null or { owe, title, body }. Paying back is never locked.
export function lockOf(asBorrower, balance, now = Date.now()) {
  let owe = 0;
  let overdue = false;
  for (const l of asBorrower) {
    if (l.status === 'active' && l.dueAt && now >= l.dueAt) owe += leftOf(l, now);
    if (l.status === 'overdue') overdue = true;
  }
  if (overdue && balance < 0) owe += -balance;
  if (owe <= 0) return null;
  return {
    owe,
    title: `Locked: pay back ${owe} to unlock`,
    body: 'A loan is overdue. Betting, the Market, sending coins, lending and new loans are off until it’s paid. Coins you earn go toward it.',
  };
}

// The loans a person is in, split by side (names under their current spelling).
export function loansOf(list, me, { owner = '', rename = (n) => n } = {}) {
  const borrowing = list.filter((l) => rename(l.borrower) === me);
  const lending = list.filter((l) => (l.bank ? me === owner : rename(l.lender || '') === me));
  return { borrowing, lending };
}

// A new request: '' or why not. mine: every loan this person is in (either
// side); theirs: the lender's (peer) loans; lock: lockOf for the borrower.
export function requestProblem({ me, lender, bank, owner, roster, cfg, mine, theirs = [], lock, coinsOff, today, rename = (n) => n }) {
  if (!cfg.on && me !== owner) return 'Loans are off right now.';
  if (coinsOff) return '🪙 Jackson coins are off right now.';
  if (lock) return 'You can’t take a new loan while one is overdue.';
  if (bank && me === owner) return 'You run the bank.';
  if (!bank) {
    if (!lender || !roster.includes(lender)) return 'Who do you want to borrow from?';
    if (lender === me) return 'You can’t lend to yourself.';
  }
  const asBorrower = mine.filter((l) => rename(l.borrower) === me);
  const open = asBorrower.filter((l) => OPEN.includes(l.status));
  if (bank && open.filter((l) => l.bank).length >= cfg.bankOpen)
    return cfg.bankOpen
      ? `Up to ${cfg.bankOpen} bank loan${cfg.bankOpen > 1 ? 's' : ''} at a time. Pay back the one you have first.`
      : 'The bank isn’t lending right now.';
  if (!bank && open.filter((l) => !l.bank).length >= cfg.peerOpen)
    return `Up to ${cfg.peerOpen} loan${cfg.peerOpen === 1 ? '' : 's'} from teammates at a time.`;
  // One loan between two people at a time, either way round, so coins can't
  // go round in a circle to get past the limits.
  if (!bank && mine.some((l) => !l.bank && OPEN.includes(l.status) && [rename(l.borrower), rename(l.lender || '')].includes(lender)))
    return `You and ${lender.split(' ')[0]} already have a loan going. Finish that one first.`;
  if (!bank && theirs.some((l) => rename(l.borrower) === lender && LIVE.includes(l.status)))
    return `${lender.split(' ')[0]} is paying back a loan, so they can’t lend right now.`;
  if (asBorrower.filter((l) => l.askedDay === today).length >= LIMITS.perDay)
    return `That’s ${LIMITS.perDay} loan requests today. Try again tomorrow.`;
  return '';
}

// A lender handing over their own coins: '' or why not (checked when the
// coins move). theirs: the lender's loans; lock: lockOf for the lender.
export function lendProblem({ lender, amount, balance, theirs, lock, coinsOff, rename = (n) => n }) {
  if (coinsOff) return '🪙 Jackson coins are off right now.';
  if (lock) return `${lender.split(' ')[0]} has an overdue loan and can’t lend right now.`;
  if (theirs.some((l) => rename(l.borrower) === lender && LIVE.includes(l.status)))
    return `${lender.split(' ')[0]} is paying back a loan, so they can’t lend right now.`;
  if (amount > PEER_MAX) return `Up to ${PEER_MAX} at a time.`;
  if (amount > balance) return `${lender.split(' ')[0]} only has ${Math.max(0, balance)} coins.`;
  return '';
}

// Accept, deny or counter a pending loan (or cancel your own request).
// Returns { error } or { patch, history, move } where move: the coins move now.
export function respond(loan, { role, action, input, note, cfg, now }) {
  if (!loan) return { error: 'That loan is gone.' };
  if (loan.status !== 'pending') return { error: loan.status === 'active' ? 'That loan already started.' : 'That loan is closed.' };
  const side = sideOf(role);
  const myTurn = loan.waitingOn === side;
  const text = cleanNote(note);
  const line = (act, extra = {}) => ({ act, by: side, at: now, ...(text && { note: text }), ...extra });
  if (action === 'cancel') {
    if (role !== 'borrower') return { error: 'Only the person who asked can cancel.' };
    return { patch: { status: 'cancelled', waitingOn: null, closedAt: now }, history: line('cancel') };
  }
  if (!myTurn)
    return {
      error:
        loan.waitingOn === 'lender'
          ? `Waiting for ${loan.bank ? 'the bank' : loan.lender.split(' ')[0]}.`
          : `Waiting for ${loan.borrower.split(' ')[0]}.`,
    };
  if (action === 'deny') {
    const status = side === 'lender' ? 'denied' : 'declined';
    return { patch: { status, waitingOn: null, closedAt: now }, history: line(status === 'denied' ? 'deny' : 'decline') };
  }
  if (action === 'counter') {
    if ((loan.counters || 0) >= LIMITS.counters) return { error: 'That’s a lot of back and forth. Accept or say no.' };
    const r = cleanTerms(input, { bank: loan.bank, cfg });
    if (r.error) return r;
    if (sameTerms(r.terms, loan.terms)) return { error: 'That’s the same as now. Change something, or accept.' };
    return {
      patch: { terms: r.terms, waitingOn: side === 'lender' ? 'borrower' : 'lender', counters: (loan.counters || 0) + 1 },
      history: line('counter', { terms: r.terms }),
    };
  }
  if (action === 'accept') {
    const t = loan.terms;
    return {
      move: true,
      patch: { status: 'active', waitingOn: null, startAt: now, dueAt: now + t.term * WEEK, paid: 0, moves: 0, remindedAt: null },
      history: line('accept'),
    };
  }
  return { error: 'Accept, say no, or counter?' };
}

// Paying some back: { error } or { amount }.
export function repayCheck(loan, { role, amount, balance, now }) {
  if (!loan) return { error: 'That loan is gone.' };
  if (role !== 'borrower') return { error: 'Only the borrower pays a loan back.' };
  if (loan.status === 'overdue') return { error: 'This one was already taken on the due date.', body: 'Coins you earn go toward it.' };
  if (loan.status !== 'active') return { error: 'That loan isn’t running.' };
  const left = leftOf(loan, now);
  const n = int(amount);
  if (!(n >= 1)) return { error: 'Pay back at least 1 coin.' };
  if (n > left) return { error: `You only owe ${left}.`, body: 'You can’t pay back more than that.' };
  if (n > balance) return { error: `You only have ${Math.max(0, balance)} coins.` };
  return { amount: n, left: left - n };
}

// Forgive or extend: { error } or { patch, history, give } (give: coins back
// from the lender to the borrower, for what a collection took past zero).
// balance: the borrower's balance now.
export function manageCheck(loan, { role, action, weeks, balance, note, now }) {
  if (!loan) return { error: 'That loan is gone.' };
  if (role !== 'lender') return { error: loan.bank ? 'Only the bank can do that.' : 'Only the lender can do that.' };
  if (!LIVE.includes(loan.status)) return { error: 'That loan isn’t running.' };
  const text = cleanNote(note);
  const give = loan.status === 'overdue' ? Math.max(0, Math.min(loan.short || 0, -balance)) : 0;
  const line = (act, extra = {}) => ({ act, by: 'lender', at: now, ...(text && { note: text }), ...extra });
  if (action === 'forgive')
    return {
      give,
      patch: { status: 'forgiven', closedAt: now, forgiven: loan.status === 'active' ? leftOf(loan, now) : give },
      history: line('forgive', { amount: loan.status === 'active' ? leftOf(loan, now) : give }),
    };
  if (action === 'extend') {
    const w = int(weeks);
    if (!TERMS.includes(w)) return { error: `Extend by ${TERMS.join(', ')} weeks.` };
    const dueAt = Math.max(loan.dueAt || now, now) + w * WEEK;
    return {
      give,
      patch: {
        status: 'active',
        dueAt,
        remindedAt: null,
        ...(give && { paid: Math.max(0, (loan.paid || 0) - give), short: (loan.short || 0) - give }),
      },
      history: line('extend', { weeks: w, dueAt }),
    };
  }
  return { error: 'Forgive or extend?' };
}

// The due date: take whatever is left, even past zero. balance: the
// borrower's balance before. { take, patch, history } (take 0: nothing left).
export function collectOf(loan, { balance, now }) {
  const take = leftOf(loan, now);
  const short = Math.max(0, take - Math.max(0, balance));
  const after = balance - take;
  return {
    take,
    patch: {
      status: after < 0 ? 'overdue' : 'repaid',
      paid: (loan.paid || 0) + take,
      short,
      collectedAt: now,
      ...(after >= 0 && { closedAt: now }),
    },
    history: { act: 'collect', by: 'bank', at: now, amount: take, ...(short && { short }) },
  };
}

// A coins ledger entry for loan money (shared/coins.js turns it into history lines).
export function loanEntry(loan, what, amount, now) {
  const toLender = what === 'repay' || what === 'collect';
  const person = loan.bank ? {} : toLender ? { to: loan.lender } : { from: loan.lender };
  return { type: 'loan', loan: loan.id, what, amount, at: now, ...(toLender ? { from: loan.borrower } : { to: loan.borrower }), ...person };
}
// Ledger doc ids that make each move happen once: the start, and every later
// move by the loan's `moves` count (two payments at once read the same count,
// and the transaction makes the second one try again).
export const entryId = (loanId, what, n = 0) => `loan-${loanId}-${what === 'lend' ? 'lend' : `${what}-${n}`}`;

// Keep the thread short (the first ask, then the latest lines).
export const withLine = (history = [], line) => {
  const all = [...history, line];
  return all.length > LIMITS.history ? [all[0], ...all.slice(-(LIMITS.history - 1))] : all;
};

// The doc for a new request.
export function newLoan({ me, lender, bank, terms, note, now, today }) {
  const text = cleanNote(note);
  return {
    borrower: me,
    lender: bank ? '' : lender,
    bank,
    parties: [nameKey(me), bank ? 'bank' : nameKey(lender)],
    status: 'pending',
    waitingOn: 'lender',
    terms,
    counters: 0,
    askedAt: now,
    askedDay: today,
    updatedAt: now,
    history: [{ act: 'ask', by: 'borrower', at: now, terms, ...(text && { note: text }) }],
  };
}

// What a thread line says, for the loan's history.
export function lineText(line, loan) {
  const who =
    line.by === 'borrower'
      ? loan.borrower.split(' ')[0]
      : line.by === 'bank'
        ? 'On the due date'
        : loan.bank
          ? 'The bank'
          : (loan.lender || '').split(' ')[0];
  switch (line.act) {
    case 'ask':
      return `${who} asked for ${termsText(line.terms)}`;
    case 'counter':
      return `${who} countered: ${termsText(line.terms)}`;
    case 'accept':
      return `${who} accepted. The coins moved.`;
    case 'deny':
      return `${who} said no`;
    case 'decline':
      return `${who} said no to the counter`;
    case 'cancel':
      return `${who} cancelled the request`;
    case 'expire':
      return 'Nobody answered in a week, so it closed';
    case 'repay':
      return `${who} paid back ${line.amount}`;
    case 'collect':
      return `${who}, ${line.amount} was taken${line.short ? ` (${line.short} past zero)` : ''}`;
    case 'forgive':
      return `${who} forgave the rest`;
    case 'extend':
      return `${who} gave ${line.weeks} more week${line.weeks > 1 ? 's' : ''}`;
    case 'settled':
      return 'Back above zero. Paid off.';
    default:
      return '';
  }
}
