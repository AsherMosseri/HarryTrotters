// Loans in demo mode: the same checks and math the server runs
// (functions/loans.js, with the rules in functions/shared/loans.js), on the
// demo's own data. A few sample loans are already going: Cooper's from the
// bank, part paid back, and one he gave Michael; Jackson waiting on the bank;
// Michael asking Sebastian; Sebastian lending to Jackson; Ira overdue
// (locked); Sophia's paid off.
import * as L from '../../functions/shared/loans.js';
import { teamDay } from '../../functions/shared/coins.js';
import { REQUESTS_TO } from '../config.js';
import { coinsText } from '../../functions/shared/coinText.js';

export function demoLoans({ get, commit, uid }) {
  const S = () => get();
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const cfg = () => L.loanSettings(S().loanSettings);
  const all = () => S().loans || [];
  const find = (id) => all().find((l) => l.id === id) || null;
  const save = (loan) => (S().loans = all().map((l) => (l.id === loan.id ? loan : l)));
  const coinsOff = (name) => name !== REQUESTS_TO && (S().controls?.off || []).includes('coins');
  const isOwner = (actor) => !!actor.admin && actor.name === REQUESTS_TO;
  const tell = (to, title, body, id) =>
    (S().inbox = [{ id: uid(), type: 'loan', title, body, open: `loans:${id}`, at: Date.now(), read: false, to }, ...(S().inbox || [])]);
  const pay = (loan, what, amount, now) => {
    const id = L.entryId(loan.id, what, loan.moves || 0);
    if ((S().coins || []).some((c) => c.id === id)) return false;
    S().coins = [...(S().coins || []), { id, ...L.loanEntry(loan, what, amount, now) }];
    return true;
  };
  const lockFor = (name, balanceOf, now = Date.now()) =>
    L.lockOf(
      all().filter((l) => l.borrower === name && L.LIVE.includes(l.status)),
      balanceOf(name),
      now,
    );

  function request(req, actor, { balanceOf, roster }) {
    const me = actor.name;
    const now = Date.now();
    const bank = req.lender === 'bank';
    const lender = bank ? '' : String(req.lender || '');
    const c = cfg();
    const t = L.cleanTerms(req, { bank, cfg: c });
    if (t.error) return note(t.error);
    const mine = all().filter((l) => l.borrower === me || l.lender === me);
    const problem = L.requestProblem({
      me,
      lender,
      bank,
      owner: REQUESTS_TO,
      roster,
      cfg: c,
      mine,
      theirs: bank ? [] : all().filter((l) => l.borrower === lender || l.lender === lender),
      lock: lockFor(me, balanceOf, now),
      coinsOff: coinsOff(me),
      today: teamDay(now),
    });
    if (problem) return note(problem);
    const loan = { id: `loan${uid()}`, ...L.newLoan({ me, lender, bank, terms: t.terms, note: req.note, now, today: teamDay(now) }) };
    S().loans = [loan, ...all()];
    tell(
      bank ? REQUESTS_TO : lender,
      bank ? `${first(me)} asked the bank for ${coinsText(t.terms.amount)} coins` : `${first(me)} asked you for a loan`,
      L.termsText(t.terms),
      loan.id,
    );
    commit();
    return { ok: true, id: loan.id };
  }

  function respond(req, actor, { balanceOf }) {
    const now = Date.now();
    const loan = find(req.id);
    const role = L.roleOf(loan, actor.name, { owner: isOwner(actor) ? actor.name : REQUESTS_TO });
    if (!role) return note(loan ? 'That isn’t your loan.' : 'That loan is gone.');
    const r = L.respond(loan, { role, action: req.action, input: req.terms, note: req.note, cfg: cfg(), now });
    if (r.error) return note(r.error);
    if (r.move) {
      if (lockFor(loan.borrower, balanceOf, now))
        return note(`${role === 'borrower' ? 'You have' : `${first(loan.borrower)} has`} an overdue loan, so this one can’t start now.`);
      if (coinsOff(loan.borrower)) return note('🪙 Jackson coins are off right now.');
      if (!loan.bank) {
        const problem = L.lendProblem({
          lender: loan.lender,
          amount: loan.terms.amount,
          balance: balanceOf(loan.lender),
          theirs: all().filter((l) => l.borrower === loan.lender),
          lock: lockFor(loan.lender, balanceOf, now),
          coinsOff: coinsOff(loan.lender),
        });
        if (problem) return note(problem);
      }
      pay(loan, 'lend', loan.terms.amount, now);
    }
    const next = { ...loan, ...r.patch, history: L.withLine(loan.history, r.history), updatedAt: now };
    save(next);
    const to = role === 'borrower' ? (loan.bank ? REQUESTS_TO : loan.lender) : loan.borrower;
    const who = role === 'borrower' ? first(loan.borrower) : loan.bank ? 'The bank' : first(loan.lender);
    const title = {
      accept: role === 'borrower' ? `${who} took your counter: the loan started` : `${who} said yes to your loan`,
      deny: `${who} said no to your loan`,
      decline: `${who} said no to your counter`,
      counter: `${who} countered your loan`,
      cancel: `${who} cancelled their loan request`,
    }[r.history.act];
    tell(to, title, r.history.act === 'counter' ? L.termsText(next.terms) : r.history.note || '', loan.id);
    commit();
    return { ok: true, status: next.status };
  }

  function repay(req, actor, { balanceOf }) {
    const now = Date.now();
    const loan = find(req.id);
    const role = L.roleOf(loan, actor.name, { owner: REQUESTS_TO });
    if (!role) return note(loan ? 'That isn’t your loan.' : 'That loan is gone.');
    const r = L.repayCheck(loan, { role, amount: req.amount, balance: balanceOf(actor.name), now });
    if (r.error) return note(r.error, r.body);
    pay(loan, 'repay', r.amount, now);
    const done = r.left === 0;
    save({
      ...loan,
      paid: (loan.paid || 0) + r.amount,
      moves: (loan.moves || 0) + 1,
      ...(done && { status: 'repaid', closedAt: now }),
      history: L.withLine(loan.history, { act: 'repay', by: 'borrower', at: now, amount: r.amount }),
      updatedAt: now,
    });
    if (!loan.bank)
      tell(
        loan.lender,
        done ? `${first(actor.name)} paid off their loan` : `${first(actor.name)} paid back ${coinsText(r.amount)}`,
        done ? `${coinsText(r.amount)} coins, all done.` : `${coinsText(r.left)} left.`,
        loan.id,
      );
    commit();
    return { ok: true, paid: r.amount, left: r.left };
  }

  function manage(req, actor, { balanceOf }) {
    const now = Date.now();
    if (req.action === 'settings') {
      if (!isOwner(actor)) return note(`Only ${first(REQUESTS_TO)} can do that.`);
      S().loanSettings = { ...L.loanSettings(req.settings), by: actor.name, updatedAt: now };
      commit();
      return { ok: true, settings: L.loanSettings(req.settings) };
    }
    const loan = find(req.id);
    const role = L.roleOf(loan, actor.name, { owner: isOwner(actor) ? actor.name : REQUESTS_TO });
    if (!role) return note(loan ? 'That isn’t your loan.' : 'That loan is gone.');
    const r = L.manageCheck(loan, { role, action: req.action, weeks: req.weeks, balance: balanceOf(loan.borrower), note: req.note, now });
    if (r.error) return note(r.error);
    let patch = r.patch;
    if (r.give > 0) {
      if (!loan.bank && balanceOf(loan.lender) < r.give)
        return note(`That gives ${coinsText(r.give)} back to ${first(loan.borrower)}. You only have ${coinsText(Math.max(0, balanceOf(loan.lender)))}.`);
      pay(loan, req.action, r.give, now);
      patch = { ...patch, moves: (loan.moves || 0) + 1 };
    }
    const next = { ...loan, ...patch, history: L.withLine(loan.history, r.history), updatedAt: now };
    save(next);
    const who = loan.bank ? 'The bank' : first(loan.lender);
    tell(
      loan.borrower,
      req.action === 'forgive' ? `${who} forgave your loan` : `${who} gave you more time on your loan`,
      req.action === 'forgive'
        ? r.give
          ? `${coinsText(r.give)} coins back. You’re unlocked.`
          : 'You don’t owe the rest.'
        : `Now due ${new Date(next.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
      loan.id,
    );
    commit();
    return { ok: true, status: next.status, give: r.give };
  }

  // The scheduled step (loanTick on the server), run while the app is open.
  function tick({ balanceOf }) {
    // The balances passed in don't have the sample loans yet: wait for the next tick.
    if (!S().loansSeeded) {
      seedSamples(balanceOf);
      commit();
      return;
    }
    const now = Date.now();
    let changed = false;
    for (const loan of all()) {
      if (loan.status === 'pending' && now - (loan.updatedAt || loan.askedAt) >= L.LIMITS.expire) {
        save({
          ...loan,
          status: 'expired',
          waitingOn: null,
          closedAt: now,
          history: L.withLine(loan.history, { act: 'expire', by: 'bank', at: now }),
        });
        changed = true;
      } else if (loan.status === 'active' && now >= loan.dueAt) {
        const balance = balanceOf(loan.borrower);
        const c = L.collectOf(loan, { balance, now });
        if (c.take > 0) pay(loan, 'collect', c.take, now);
        save({ ...loan, ...c.patch, moves: (loan.moves || 0) + 1, history: L.withLine(loan.history, c.history), updatedAt: now });
        tell(
          loan.borrower,
          c.patch.status === 'overdue' ? 'Your loan was due: locked until you’re back to 0' : `Your loan was due: ${c.take} taken`,
          '',
          loan.id,
        );
        changed = true;
      } else if (loan.status === 'active' && !loan.remindedAt && loan.dueAt - now <= L.LIMITS.remind) {
        save({ ...loan, remindedAt: now });
        tell(loan.borrower, 'Your loan is due in 2 days', `${coinsText(L.leftOf(loan, now))} left to pay ${L.lenderName(loan)}.`, loan.id);
        changed = true;
      } else if (loan.status === 'overdue' && balanceOf(loan.borrower) >= 0) {
        save({ ...loan, status: 'repaid', closedAt: now, history: L.withLine(loan.history, { act: 'settled', by: 'bank', at: now }) });
        tell(loan.borrower, 'Your loan is paid off', 'You’re back above zero, so everything is unlocked.', loan.id);
        changed = true;
      }
    }
    if (changed) commit();
  }

  // Sample loans, once (the first time the app asks for loans: it needs the
  // wallet to leave Ira 30 below zero).
  function seedSamples(balanceOf) {
    const s = S();
    if (s.loansSeeded) return;
    const now = Date.now();
    const H = 3600000;
    const D = 86400000;
    const t = (amount, style, rate, term, standard = false) => ({ amount, style, rate, term, standard });
    const loans = [];
    const coins = [];
    const add = (l) => {
      loans.push(l);
      return l;
    };
    const entry = (l, what, amount, at, n = 0) => coins.push({ id: L.entryId(l.id, what, n), ...L.loanEntry(l, what, amount, at) });
    // Cooper: from the bank, Asher countered, 20 paid back so far.
    const c = add({
      id: 'loan-demo-cooper',
      ...L.newLoan({
        me: 'Cooper Mlezcko',
        lender: '',
        bank: true,
        terms: t(150, 'flat', 10, 2, true),
        note: 'New wheels for my bike',
        now: now - 4 * D - 3 * H,
        today: '',
      }),
    });
    c.history.push({ act: 'counter', by: 'lender', at: now - 4 * D - 2 * H, terms: t(100, 'flat', 10, 2), note: '100 for now' });
    c.history.push({ act: 'accept', by: 'borrower', at: now - 4 * D - H });
    c.history.push({ act: 'repay', by: 'borrower', at: now - D, amount: 20 });
    Object.assign(c, {
      terms: t(100, 'flat', 10, 2),
      status: 'active',
      waitingOn: null,
      counters: 1,
      startAt: now - 4 * D - H,
      dueAt: now - 4 * D - H + 2 * L.WEEK,
      paid: 20,
      moves: 1,
      updatedAt: now - D,
    });
    entry(c, 'lend', 100, c.startAt);
    entry(c, 'repay', 20, now - D, 0);
    // Jackson: waiting on the bank.
    add({
      id: 'loan-demo-jackson',
      ...L.newLoan({
        me: 'Jackson Lucks',
        lender: '',
        bank: true,
        terms: t(60, 'weekly', 5, 2),
        note: 'Tournament entry this weekend',
        now: now - 2 * H,
        today: teamDay(now),
      }),
    });
    // Cooper lent Michael 40 (before his own bank loan: nobody lends while
    // paying one back).
    const cm = add({
      id: 'loan-demo-cooper-michael',
      ...L.newLoan({
        me: 'Michael Meidan',
        lender: 'Cooper Mlezcko',
        bank: false,
        terms: t(40, 'flat', 10, 1, true),
        note: 'Pay you back Friday',
        now: now - 5 * D,
        today: '',
      }),
    });
    cm.history.push({ act: 'accept', by: 'lender', at: now - 5 * D + H });
    Object.assign(cm, {
      status: 'active',
      waitingOn: null,
      startAt: now - 5 * D + H,
      dueAt: now - 5 * D + H + L.WEEK,
      paid: 0,
      moves: 0,
      updatedAt: now - 5 * D + H,
    });
    entry(cm, 'lend', 40, cm.startAt);
    // Michael asks Sebastian.
    add({
      id: 'loan-demo-michael',
      ...L.newLoan({
        me: 'Michael Meidan',
        lender: 'Sebastian Tolbert',
        bank: false,
        terms: t(30, 'weekly', 5, 2),
        note: 'For the robot dance party snacks',
        now: now - 5 * H,
        today: teamDay(now),
      }),
    });
    // Sebastian lent Jackson 50 at 5% a week.
    const sj = add({
      id: 'loan-demo-seb',
      ...L.newLoan({
        me: 'Jackson Lucks',
        lender: 'Sebastian Tolbert',
        bank: false,
        terms: t(50, 'weekly', 5, 4),
        now: now - 9 * D,
        today: '',
      }),
    });
    sj.history.push({ act: 'accept', by: 'lender', at: now - 9 * D + H });
    Object.assign(sj, {
      status: 'active',
      waitingOn: null,
      startAt: now - 9 * D + H,
      dueAt: now - 9 * D + H + 4 * L.WEEK,
      paid: 0,
      moves: 0,
      updatedAt: now - 9 * D + H,
    });
    entry(sj, 'lend', 50, sj.startAt);
    // Sebastian's coins to lend (the demo gives him no earnings of his own).
    coins.push({
      id: 'loan-demo-seb-bonus',
      type: 'grant',
      to: 'Sebastian Tolbert',
      amount: 150,
      note: 'Ran the outreach demo',
      by: REQUESTS_TO,
      at: now - 10 * D,
    });
    // Ira: a bank loan that came due and left her below zero.
    const ira = add({
      id: 'loan-demo-ira',
      ...L.newLoan({ me: 'Ira Kumar', lender: '', bank: true, terms: t(80, 'flat', 10, 1, true), now: now - 9 * D, today: '' }),
    });
    ira.history.push({ act: 'accept', by: 'lender', at: now - 9 * D + H });
    ira.history.push({ act: 'collect', by: 'bank', at: now - 2 * D + H, amount: 88, short: 30 });
    Object.assign(ira, {
      status: 'overdue',
      waitingOn: null,
      startAt: now - 9 * D + H,
      dueAt: now - 2 * D + H,
      paid: 88,
      moves: 1,
      short: 30,
      collectedAt: now - 2 * D + H,
      updatedAt: now - 2 * D + H,
    });
    entry(ira, 'lend', 80, ira.startAt);
    entry(ira, 'collect', 88, ira.dueAt, 0);
    // Spent before the due date, so the collection took her 30 below zero.
    const spent = Math.max(0, balanceOf('Ira Kumar') + 22);
    if (spent)
      coins.push({
        id: 'loan-demo-ira-spend',
        type: 'spend',
        person: 'Ira Kumar',
        amount: spent,
        what: 'market',
        label: 'Market: new headphones',
        at: now - 6 * D,
      });
    // Sophia: paid off.
    const so = add({
      id: 'loan-demo-sophia',
      ...L.newLoan({ me: 'Sophia Bermudez', lender: '', bank: true, terms: t(30, 'flat', 0, 1), now: now - 20 * D, today: '' }),
    });
    so.history.push({ act: 'accept', by: 'lender', at: now - 20 * D + H }, { act: 'repay', by: 'borrower', at: now - 16 * D, amount: 30 });
    Object.assign(so, {
      status: 'repaid',
      waitingOn: null,
      startAt: now - 20 * D + H,
      dueAt: now - 13 * D + H,
      paid: 30,
      moves: 1,
      closedAt: now - 16 * D,
      updatedAt: now - 16 * D,
    });
    entry(so, 'lend', 30, so.startAt);
    entry(so, 'repay', 30, now - 16 * D, 0);
    s.loans = [...loans, ...(s.loans || [])];
    s.coins = [...(s.coins || []), ...coins];
    s.inbox = [
      {
        id: uid(),
        type: 'loan',
        title: 'Jackson asked the bank for 60 coins',
        body: L.termsText(loans[1].terms),
        open: 'loans:loan-demo-jackson',
        at: now - 2 * H,
        read: false,
        to: REQUESTS_TO,
      },
      {
        id: uid(),
        type: 'loan',
        title: 'Michael asked you for a loan',
        body: L.termsText(loans[3].terms),
        open: 'loans:loan-demo-michael',
        at: now - 5 * H,
        read: false,
        to: 'Sebastian Tolbert',
      },
      ...(s.inbox || []),
    ];
    s.loansSeeded = 1;
  }

  // fn: 'loanRequest' | 'loanRespond' | 'loanRepay' | 'loanManage'.
  function call(fn, req, actor, ctx) {
    if (fn === 'loanRequest') return request(req || {}, actor, ctx);
    if (fn === 'loanRespond') return respond(req || {}, actor, ctx);
    if (fn === 'loanRepay') return repay(req || {}, actor, ctx);
    if (fn === 'loanManage') return manage(req || {}, actor, ctx);
    return note('Unknown.');
  }
  // What a person sees: their own loans, and every bank loan for the owner.
  const visible = (actor) => all().filter((l) => l.borrower === actor.name || l.lender === actor.name || (l.bank && isOwner(actor)));
  return { call, tick, lockFor, visible };
}
