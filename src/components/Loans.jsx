import { useEffect, useMemo, useRef, useState } from 'react';
import * as L from '../../functions/shared/loans.js';
import { REQUESTS_TO } from '../config.js';
import { relTime } from '../util.js';
import { Avatar } from './common.jsx';
import { confirmDialog } from './Dialogs.jsx';
import { Switch } from './Ads.jsx';
import { Icon } from './shell/icons.jsx';

// Loans (3.1), a tab in the coins screen. Ask the bank (Asher answers; the
// coins are made up, not his) or a teammate (their own coins) for coins, with
// interest, and pay them back. Everything that moves coins happens on the
// server (functions/loans.js); this only asks and shows. The math is the
// server's own (functions/shared/loans.js).

const first = (n) => (n || '').split(' ')[0];
const DATE = (ms) => new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const errText = (r) => (r?.note ? [r.note.title, r.note.body].filter(Boolean).join(' ') : 'That didn’t go through.');

// Loans for one person: their own (either side) and, for the owner, every bank loan.
// call(fn, req): the store's loan function. balance: their coins now.
export function useLoans({ store, actor, call, balance, walletOf }) {
  const [list, setList] = useState([]);
  const [raw, setRaw] = useState({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => (store.subscribeLoans ? store.subscribeLoans(actor, setList) : undefined), [store, actor.name, actor.admin]);
  useEffect(() => (store.subscribeLoanSettings ? store.subscribeLoanSettings(setRaw) : undefined), [store]);
  // Due dates count down; demo mode also runs the server's scheduled step
  // here, a moment after opening so the coins have loaded first.
  const wallet = useRef(walletOf);
  wallet.current = walletOf;
  useEffect(() => {
    const run = () => {
      setNow(Date.now());
      store.loanTick?.({ balanceOf: (n) => wallet.current(n).balance });
    };
    const soon = setTimeout(run, 1200);
    const t = setInterval(run, 30000);
    return () => {
      clearTimeout(soon);
      clearInterval(t);
    };
  }, [store]);
  const owner = !!actor.admin && actor.name === REQUESTS_TO;
  const cfg = useMemo(() => L.loanSettings(raw), [raw]);
  return useMemo(() => {
    const opts = { owner: owner ? actor.name : REQUESTS_TO };
    const roleOf = (l) => L.roleOf(l, actor.name, opts);
    const { borrowing, lending } = L.loansOf(list, actor.name, opts);
    const lock = L.lockOf(
      borrowing.filter((l) => L.LIVE.includes(l.status)),
      balance,
      now,
    );
    const myTurn = list.filter(
      (l) => l.status === 'pending' && roleOf(l) && l.waitingOn === (roleOf(l) === 'borrower' ? 'borrower' : 'lender'),
    );
    const bankWaiting = owner ? list.filter((l) => l.bank && l.status === 'pending' && l.waitingOn === 'lender').length : 0;
    // Anyone's coins (the app has everyone's), for a lender looking at an overdue loan.
    const balanceOf = (n) => walletOf(n).balance;
    return { list, cfg, owner, borrowing, lending, lock, myTurn, bankWaiting, now, call, roleOf, balance, balanceOf };
  }, [list, cfg, owner, actor.name, balance, now, call, walletOf]);
}

// Lines for Today: a lock, requests waiting on you, a loan due soon.
export function loanLines(loans, open) {
  if (!loans) return [];
  const out = [];
  if (loans.lock) out.push({ tone: 'bad', text: loans.lock.title, go: () => open() });
  if (loans.bankWaiting)
    out.push({
      tone: 'warn',
      text: loans.bankWaiting === 1 ? 'A bank loan request is waiting' : `${loans.bankWaiting} bank loan requests are waiting`,
      go: () => open(),
    });
  for (const l of loans.myTurn.filter((x) => !(x.bank && loans.owner)).slice(0, 2)) {
    const asLender = loans.roleOf(l) === 'lender';
    out.push({
      tone: 'warn',
      text: asLender ? `${first(l.borrower)} asked you for a loan` : `${l.bank ? 'The bank' : first(l.lender)} countered your loan`,
      go: () => open(l.id),
    });
  }
  const soon = loans.borrowing.find((l) => l.status === 'active' && l.dueAt > loans.now && l.dueAt - loans.now <= L.LIMITS.remind);
  if (soon && !loans.lock)
    out.push({
      tone: 'warn',
      text: `Your loan is due ${new Date(soon.dueAt).toLocaleDateString('en-US', { weekday: 'long' })}: ${L.leftOf(soon, loans.now)} left`,
      go: () => open(soon.id),
    });
  return out;
}

export function LoansPanel({ loans, actor, roster, focus, onToast }) {
  const { cfg, owner, borrowing, lending, lock, now } = loans;
  const [ask, setAsk] = useState(null); // 'bank' | 'person' | null
  const [showPast, setShowPast] = useState(false);
  const [bankTab, setBankTab] = useState('waiting');
  const open = (l) => L.OPEN.includes(l.status);
  const bankLoans = owner ? lending.filter((l) => l.bank) : [];
  const gave = lending.filter((l) => !l.bank);
  const mine = borrowing.filter(open);
  const past = [...borrowing, ...gave].filter((l) => !open(l));
  // A notification opened this: scroll its loan into view.
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`loan-${focus}`);
    el?.scrollIntoView?.({ block: 'center' });
  }, [focus]);
  const card = (l) => <LoanCard key={l.id} loan={l} loans={loans} focus={focus === l.id} onToast={onToast} />;
  const bankShown =
    bankTab === 'waiting'
      ? bankLoans.filter((l) => l.status === 'pending')
      : bankTab === 'running'
        ? bankLoans.filter((l) => L.LIVE.includes(l.status))
        : bankLoans.filter((l) => !open(l));
  return (
    <div className="loans">
      {lock && (
        <div className="loan-lock" role="status">
          <Icon name="lock" size={20} />
          <div className="grow">
            <b>{lock.title}</b>
            <span className="small">{lock.body}</span>
          </div>
        </div>
      )}

      {owner && (
        <section className="loan-sec">
          <h3 className="loan-head">
            <Icon name="bank" size={16} /> Bank loans
          </h3>
          <div className="segmented loan-tabs" role="tablist" aria-label="Bank loans">
            {[
              ['waiting', `Waiting (${bankLoans.filter((l) => l.status === 'pending').length})`],
              ['running', `Running (${bankLoans.filter((l) => L.LIVE.includes(l.status)).length})`],
              ['done', 'Closed'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={bankTab === id}
                className={`plain-seg${bankTab === id ? ' on' : ''}`}
                onClick={() => setBankTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {bankShown.length ? (
            bankShown.map(card)
          ) : (
            <p className="muted small">
              {bankTab === 'waiting'
                ? 'No requests waiting. They show up here and on Today.'
                : bankTab === 'running'
                  ? 'No bank loans running.'
                  : 'Nothing closed yet.'}
            </p>
          )}
          <p className="muted tiny">
            The bank’s coins are made up when a loan starts and are gone when it’s paid back. They never come out of or go into your own
            coins.
          </p>
        </section>
      )}

      <section className="loan-sec">
        <h3 className="loan-head">Borrow</h3>
        {!cfg.on && !owner ? (
          <p className="muted small">Loans are off right now.</p>
        ) : ask ? (
          <AskForm
            loans={loans}
            actor={actor}
            roster={roster}
            mode={ask}
            setMode={setAsk}
            onDone={(text) => (setAsk(null), onToast?.(text))}
          />
        ) : (
          <div className="loan-ask-btns">
            {!owner && (
              <button className="btn" onClick={() => setAsk('bank')} disabled={!!lock}>
                <Icon name="bank" size={18} /> Ask the bank
              </button>
            )}
            <button className="btn" onClick={() => setAsk('person')} disabled={!!lock}>
              <Icon name="person" size={18} /> Ask a teammate
            </button>
          </div>
        )}
      </section>

      <section className="loan-sec">
        <h3 className="loan-head">My loans</h3>
        {mine.length ? mine.map(card) : <p className="muted small">Nothing borrowed right now.</p>}
      </section>

      {gave.some(open) && (
        <section className="loan-sec">
          <h3 className="loan-head">Loans I gave</h3>
          {gave.filter(open).map(card)}
        </section>
      )}

      {past.length > 0 && (
        <section className="loan-sec">
          <button className="link-btn loan-past" aria-expanded={showPast} onClick={() => setShowPast(!showPast)}>
            <Icon name={showPast ? 'chevronUp' : 'chevronDown'} size={16} /> Past loans ({past.length})
          </button>
          {showPast && past.map(card)}
        </section>
      )}
    </div>
  );
}

// Amount, interest and length, shared by asking and countering.
function TermsFields({ value, onChange, bank, cfg, idPrefix }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const std = L.standardOf(bank, cfg);
  const max = bank ? cfg.bankMax : L.PEER_MAX;
  const terms = bank ? cfg.terms : L.TERMS;
  return (
    <div className="loan-fields">
      <label className="field-label" htmlFor={`${idPrefix}-amount`}>
        Coins
      </label>
      <input
        id={`${idPrefix}-amount`}
        className="input loan-amount mono"
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value.amount}
        placeholder={`Up to ${max}`}
        onChange={(e) => set({ amount: e.target.value })}
      />
      <span className="field-label">Interest</span>
      <div className="loan-interest">
        <div className="segmented" role="radiogroup" aria-label="Interest">
          {[
            ['standard', 'Standard'],
            ['flat', 'Once'],
            ['weekly', 'Per week'],
          ].map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={value.style === id}
              className={`plain-seg${value.style === id ? ' on' : ''}`}
              onClick={() => set({ style: id })}
            >
              {label}
            </button>
          ))}
        </div>
        {value.style === 'standard' ? (
          <span className="muted small">
            {std.rate}% {std.style === 'weekly' ? 'a week' : 'once'}
          </span>
        ) : (
          <span className="loan-rate">
            <input
              className="input mono"
              type="number"
              inputMode="numeric"
              min={0}
              max={L.RATE_MAX}
              value={value.rate}
              onChange={(e) => set({ rate: e.target.value })}
              aria-label="Interest percent"
            />
            <span className="muted small">% {value.style === 'weekly' ? 'a week' : 'once'}</span>
          </span>
        )}
      </div>
      <span className="field-label">Pay back in</span>
      <div className="segmented loan-terms" role="radiogroup" aria-label="Pay back in">
        {terms.map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={Number(value.term) === t}
            className={`plain-seg${Number(value.term) === t ? ' on' : ''}`}
            onClick={() => set({ term: t })}
          >
            {t} week{t > 1 ? 's' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

// What these terms come to: "You’d pay back 110 by Wed, Nov 18."
function Preview({ value, bank, cfg, you = true }) {
  const r = L.cleanTerms(value, { bank, cfg });
  if (r.error) return <p className="muted small loan-preview">{value.amount ? r.error : 'Pick how many coins.'}</p>;
  const t = r.terms;
  const due = Date.now() + t.term * L.WEEK;
  const total = L.fullOwed(t);
  const oneWeek = L.owedOf({ terms: t, startAt: 0, dueAt: t.term * L.WEEK }, 1);
  return (
    <p className="small loan-preview">
      {you ? 'You’d pay back ' : 'They’d pay back '}
      <b className="mono">{total}</b> by <span className="mono">{DATE(due)}</span>
      {t.style === 'weekly' && t.term > 1 && t.rate > 0 ? (
        <span className="muted">
          {' '}
          if it runs the whole time; <span className="mono">{oneWeek}</span> if paid back in the first week.
        </span>
      ) : (
        '.'
      )}
      <span className="muted"> Whatever is left is taken on the due date, even if that puts {you ? 'you' : 'them'} below zero.</span>
    </p>
  );
}

function AskForm({ loans, actor, roster, mode, setMode, onDone }) {
  const { cfg, owner, call } = loans;
  const [who, setWho] = useState('');
  const [value, setValue] = useState({ amount: '', style: 'standard', rate: 10, term: cfg.terms.includes(2) ? 2 : cfg.terms[0] });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bank = mode === 'bank';
  const others = roster.filter((x) => x !== actor.name);
  // Lengths the bank allows can be fewer than a teammate's.
  useEffect(() => {
    const allowed = bank ? cfg.terms : L.TERMS;
    if (!allowed.includes(Number(value.term))) setValue((v) => ({ ...v, term: allowed[0] }));
  }, [bank, cfg.terms, value.term]);
  const send = async () => {
    setBusy(true);
    setError('');
    const r = await call('loanRequest', {
      lender: bank ? 'bank' : who,
      ...value,
      amount: Number(value.amount),
      rate: Number(value.rate),
      term: Number(value.term),
      note: text.trim(),
    });
    setBusy(false);
    if (r?.ok) onDone(bank ? `Asked the bank. ${first(REQUESTS_TO)} will answer.` : `Asked ${first(who)}.`);
    else setError(errText(r));
  };
  return (
    <div className="loan-ask">
      {!owner && (
        <div className="segmented loan-tabs" role="tablist" aria-label="Who from">
          {[
            ['bank', 'The bank'],
            ['person', 'A teammate'],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              className={`plain-seg${mode === id ? ' on' : ''}`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {bank ? (
        <p className="muted small">
          {first(REQUESTS_TO)} answers for the bank: yes, no, or a different offer. Any amount, {cfg.bankOpen} bank loan
          {cfg.bankOpen === 1 ? '' : 's'} at a time.
        </p>
      ) : (
        <>
          <label className="field-label" htmlFor="loan-who">
            From
          </label>
          <select id="loan-who" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Pick a teammate…</option>
            {others.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </>
      )}
      <TermsFields value={value} onChange={setValue} bank={bank} cfg={cfg} idPrefix="ask" />
      <Preview value={value} bank={bank} cfg={cfg} />
      <label className="field-label" htmlFor="loan-note">
        What’s it for? <span className="muted">(optional)</span>
      </label>
      <input
        id="loan-note"
        className="input"
        maxLength={L.LIMITS.note}
        value={text}
        placeholder="New wheels for my bike"
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="casino-error">{error}</div>}
      <div className="row gap loan-actions">
        <span className="spacer" />
        <button className="btn" onClick={() => setMode(null)}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy || (!bank && !who) || !Number(value.amount)} onClick={send}>
          Send request
        </button>
      </div>
    </div>
  );
}

function statusOf(loan, role, now) {
  if (loan.status === 'pending') {
    const mine = loan.waitingOn === (role === 'borrower' ? 'borrower' : 'lender');
    return {
      cls: mine ? 'turn' : 'wait',
      text: mine
        ? 'Your turn'
        : `Waiting for ${loan.waitingOn === 'lender' ? (loan.bank ? 'the bank' : first(loan.lender)) : first(loan.borrower)}`,
    };
  }
  if (loan.status === 'active') {
    const days = Math.ceil((loan.dueAt - now) / L.DAY);
    if (days <= 0) return { cls: 'late', text: 'Due now' };
    return { cls: days <= 2 ? 'soon' : 'on', text: days === 1 ? 'Due tomorrow' : `Due in ${days} days` };
  }
  return (
    {
      overdue: { cls: 'late', text: 'Overdue' },
      repaid: { cls: 'done', text: 'Paid off' },
      denied: { cls: 'closed', text: 'Said no' },
      declined: { cls: 'closed', text: 'Said no to the counter' },
      cancelled: { cls: 'closed', text: 'Cancelled' },
      expired: { cls: 'closed', text: 'No answer' },
      forgiven: { cls: 'done', text: 'Forgiven' },
    }[loan.status] || { cls: 'closed', text: loan.status }
  );
}

function LoanCard({ loan, loans, focus, onToast }) {
  const { call, now, cfg, balance } = loans;
  const role = loans.roleOf(loan);
  const asBorrower = role === 'borrower';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [countering, setCountering] = useState(false);
  const [value, setValue] = useState(() => ({ ...loan.terms, style: loan.terms.standard ? 'standard' : loan.terms.style }));
  const [text, setText] = useState('');
  const [thread, setThread] = useState(false);
  const [weeks, setWeeks] = useState(1);
  const left = L.leftOf(loan, now);
  const [pay, setPay] = useState('');
  const owed = loan.status === 'active' ? L.owedOf(loan, now) : 0;
  const st = statusOf(loan, role, now);
  const myTurn = st.cls === 'turn';
  const live = L.LIVE.includes(loan.status);
  const who = asBorrower ? (loan.bank ? 'the bank' : loan.lender) : loan.borrower;
  const title = asBorrower
    ? `From ${loan.bank ? 'the bank' : first(loan.lender)}`
    : loan.bank
      ? `${loan.borrower}`
      : `To ${first(loan.borrower)}`;
  const run = async (fn, req, done) => {
    setBusy(true);
    setError('');
    const r = await call(fn, { id: loan.id, ...req });
    setBusy(false);
    if (r?.ok) {
      setCountering(false);
      setText('');
      setPay('');
      if (done) onToast?.(typeof done === 'function' ? done(r) : done);
    } else setError(errText(r));
  };
  const accept = async () => {
    // A teammate lending hands over their own coins: say so first.
    if (!asBorrower && !loan.bank) {
      const ok = await confirmDialog({
        title: `Lend ${loan.terms.amount} coins to ${first(loan.borrower)}?`,
        body: `They come out of your coins now and come back with interest: ${L.fullOwed(loan.terms)} by the due date.`,
        okLabel: 'Lend',
      });
      if (!ok) return;
    }
    run(
      'loanRespond',
      { action: 'accept' },
      asBorrower ? 'Loan started. The coins are yours.' : `Loan started: ${loan.terms.amount} coins to ${first(loan.borrower)}.`,
    );
  };
  const forgive = async () => {
    const ok = await confirmDialog({
      title: `Forgive ${first(loan.borrower)}’s loan?`,
      body:
        loan.status === 'overdue'
          ? `What the due date took past zero goes back to them${loan.bank ? '' : ' from your coins'}, and they’re unlocked. It can’t be undone.`
          : `They won’t owe the ${left} left. It can’t be undone.`,
      okLabel: 'Forgive',
      danger: true,
    });
    if (ok) run('loanManage', { action: 'forgive' }, 'Forgiven.');
  };
  const n = Math.floor(Number(pay) || 0);
  // What the last ask or counter said, shown while it waits for an answer.
  const lastNote = [...(loan.history || [])].reverse().find((h) => h.act === 'ask' || h.act === 'counter');
  return (
    <article id={`loan-${loan.id}`} className={`loan-card ${st.cls}${focus ? ' focus' : ''}`}>
      <header className="loan-card-head">
        {asBorrower && loan.bank ? (
          <span className="loan-bank-ic" aria-hidden="true">
            <Icon name="bank" size={18} />
          </span>
        ) : (
          <Avatar name={who} size={30} />
        )}
        <span className="grow loan-title">
          <b>{title}</b>
          <span className="muted tiny">{L.termsText(loan.terms)}</span>
        </span>
        <span className={`loan-status ${st.cls}`}>{st.text}</span>
      </header>

      {live && (
        <div className="loan-facts">
          <div>
            <span className="loan-k">{loan.status === 'overdue' ? 'Below zero' : 'Left to pay'}</span>
            <b className="mono loan-big">
              {loan.status === 'overdue' ? Math.max(0, -(asBorrower ? balance : loans.balanceOf(loan.borrower))) : left}
            </b>
          </div>
          <div>
            <span className="loan-k">{loan.status === 'overdue' ? 'Was due' : 'Due'}</span>
            <b className="mono">{DATE(loan.dueAt)}</b>
          </div>
          <div>
            <span className="loan-k">Paid</span>
            <b className="mono">
              {loan.paid || 0}
              {owed ? ` of ${owed}` : ''}
            </b>
          </div>
          {loan.status === 'active' && (
            <div className="loan-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round(((loan.paid || 0) / Math.max(1, owed)) * 100))}%` }} />
            </div>
          )}
        </div>
      )}
      {loan.status === 'overdue' && (
        <p className="small loan-overdue-text">
          {asBorrower
            ? 'The due date took what was left. Coins you earn go toward getting back to 0, and then you’re unlocked.'
            : `The due date took what was left and ${first(loan.borrower)} went below zero. They’re locked until they’re back to 0.`}
        </p>
      )}

      {loan.status === 'pending' && lastNote?.note && <blockquote className="loan-note">“{lastNote.note}”</blockquote>}
      {/* Pending: the side whose turn it is answers. */}
      {loan.status === 'pending' && myTurn && !countering && (
        <>
          <input
            className="input"
            maxLength={L.LIMITS.note}
            value={text}
            placeholder="A note (optional)"
            aria-label="Note"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row gap wrap loan-buttons">
            <button className="btn primary" disabled={busy} onClick={accept}>
              {asBorrower ? 'Take it' : loan.bank ? 'Approve' : 'Lend'}
            </button>
            <button className="btn" disabled={busy} onClick={() => setCountering(true)}>
              Counter
            </button>
            <button className="btn" disabled={busy} onClick={() => run('loanRespond', { action: 'deny', note: text.trim() }, 'Said no.')}>
              Say no
            </button>
          </div>
        </>
      )}
      {countering && (
        <div className="loan-counter">
          <TermsFields value={value} onChange={setValue} bank={loan.bank} cfg={cfg} idPrefix={`c-${loan.id}`} />
          <Preview value={value} bank={loan.bank} cfg={cfg} you={asBorrower} />
          <input
            className="input"
            maxLength={L.LIMITS.note}
            value={text}
            placeholder="Why (optional)"
            aria-label="Note"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row gap loan-buttons">
            <span className="spacer" />
            <button className="btn" onClick={() => setCountering(false)}>
              Back
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                run(
                  'loanRespond',
                  {
                    action: 'counter',
                    terms: { ...value, amount: Number(value.amount), rate: Number(value.rate), term: Number(value.term) },
                    note: text.trim(),
                  },
                  'Counter sent.',
                )
              }
            >
              Send counter
            </button>
          </div>
        </div>
      )}
      {loan.status === 'pending' && asBorrower && !myTurn && (
        <div className="row gap loan-buttons">
          <span className="muted small grow">
            {loan.bank ? `${first(REQUESTS_TO)} will answer for the bank.` : `${first(loan.lender)} will answer.`}
          </span>
          <button className="btn" disabled={busy} onClick={() => run('loanRespond', { action: 'cancel' }, 'Request cancelled.')}>
            Cancel request
          </button>
        </div>
      )}

      {/* Paying back. */}
      {loan.status === 'active' && asBorrower && left > 0 && (
        <div className="loan-repay">
          <input
            className="input mono"
            type="number"
            inputMode="numeric"
            min={1}
            max={left}
            value={pay}
            placeholder={`1 to ${left}`}
            aria-label="Coins to pay back"
            onChange={(e) => setPay(e.target.value)}
          />
          <button
            className="btn"
            disabled={busy || n < 1 || n > left || n > balance}
            onClick={() => run('loanRepay', { amount: n }, (r) => (r.left ? `Paid ${r.paid}. ${r.left} left.` : 'Paid off.'))}
          >
            Pay
          </button>
          <button className="btn primary" disabled={busy || left > balance} onClick={() => run('loanRepay', { amount: left }, 'Paid off.')}>
            Pay all <span className="mono">{left}</span>
          </button>
          {(n > balance || left > balance) && <span className="muted tiny loan-have">You have {Math.max(0, balance)}.</span>}
        </div>
      )}

      {/* The lender (the owner for the bank): more time, or forgive. */}
      {live && !asBorrower && (
        <div className="row gap wrap loan-buttons">
          <div className="segmented loan-weeks" role="radiogroup" aria-label="Extend by">
            {L.TERMS.map((w) => (
              <button
                key={w}
                role="radio"
                aria-checked={weeks === w}
                className={`plain-seg${weeks === w ? ' on' : ''}`}
                onClick={() => setWeeks(w)}
              >
                +{w}w
              </button>
            ))}
          </div>
          <button
            className="btn"
            disabled={busy}
            onClick={() => run('loanManage', { action: 'extend', weeks }, `${weeks} more week${weeks > 1 ? 's' : ''}.`)}
          >
            Extend
          </button>
          <button className="btn danger-text" disabled={busy} onClick={forgive}>
            Forgive
          </button>
        </div>
      )}
      {error && <div className="casino-error">{error}</div>}

      <button className="link-btn small loan-thread-btn" aria-expanded={thread} onClick={() => setThread(!thread)}>
        <Icon name={thread ? 'chevronUp' : 'chevronDown'} size={14} /> History ({(loan.history || []).length})
      </button>
      {thread && (
        <ol className="loan-thread">
          {(loan.history || []).map((h, i) => (
            <li key={`${h.at}-${i}`} className={h.by}>
              <span className="grow">
                {L.lineText(h, loan)}
                {h.note && <span className="loan-quote">“{h.note}”</span>}
              </span>
              <span className="muted tiny mono">{relTime(h.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

// Asher's bank settings (Controls, Loans). Saved by the loanManage function.
export function LoanSettings({ cfg, call }) {
  const [draft, setDraft] = useState(cfg);
  const [state, setState] = useState('');
  useEffect(() => setDraft(cfg), [cfg]);
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setState('');
  };
  const save = async (next = draft) => {
    setState('saving');
    const r = await call('loanManage', {
      action: 'settings',
      settings: {
        ...next,
        bankMax: Number(next.bankMax),
        bankOpen: Number(next.bankOpen),
        peerOpen: Number(next.peerOpen),
        bankRate: Number(next.bankRate),
      },
    });
    setState(r?.ok ? 'saved' : errText(r));
  };
  const num = (label, key, hint, max) => (
    <div className="cmd-admin-row loan-set-row">
      <span className="grow loan-set-text">
        <b className="ctl-title">{label}</b>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      <input
        className="input mono coins-num"
        type="number"
        min={0}
        max={max}
        value={draft[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        aria-label={label}
      />
    </div>
  );
  return (
    <section className="cmd-admin-group loan-settings">
      <div className={`cmd-admin-row${draft.on ? '' : ' off'}`}>
        <b className="ctl-title">Loans</b>
        <span className="muted small grow">Asking the bank or a teammate. Off stops new requests; loans already going keep going.</span>
        <Switch
          checked={draft.on}
          onChange={(v) => {
            const next = { ...draft, on: v };
            setDraft(next);
            save(next);
          }}
          label="Loans on"
        />
      </div>
      {num('Bank loans at a time', 'bankOpen', 'Per person, waiting ones included. 0 stops the bank.', 5)}
      {num('Loans from teammates at a time', 'peerOpen', 'Per person, as the borrower.', 5)}
      <div className="cmd-admin-row loan-set-row">
        <span className="grow loan-set-text">
          <b className="ctl-title">Bank’s standard rate</b>
          <span className="muted small">What “Standard” means when someone asks the bank.</span>
        </span>
        <div className="segmented" role="radiogroup" aria-label="Standard rate style">
          {[
            ['flat', 'Once'],
            ['weekly', 'Per week'],
          ].map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={draft.bankStyle === id}
              className={`plain-seg${draft.bankStyle === id ? ' on' : ''}`}
              onClick={() => set({ bankStyle: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="loan-rate">
          <input
            className="input mono coins-num"
            type="number"
            min={0}
            max={L.RATE_MAX}
            value={draft.bankRate}
            onChange={(e) => set({ bankRate: e.target.value })}
            aria-label="Standard rate percent"
          />
          <span className="muted small">%</span>
        </span>
      </div>
      <div className="cmd-admin-row loan-set-row">
        <span className="grow loan-set-text">
          <b className="ctl-title">Bank loan lengths</b>
          <span className="muted small">Teammates can always pick 1, 2 or 4 weeks.</span>
        </span>
        <div className="segmented" role="group" aria-label="Bank loan lengths">
          {L.TERMS.map((t) => {
            const on = draft.terms.includes(t);
            return (
              <button
                key={t}
                aria-pressed={on}
                className={`plain-seg${on ? ' on' : ''}`}
                onClick={() => set({ terms: on ? draft.terms.filter((x) => x !== t) : [...draft.terms, t].sort((a, b) => a - b) })}
              >
                {t} week{t > 1 ? 's' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div className="row gap loan-actions">
        <span className={`small grow ${state && state !== 'saved' && state !== 'saving' ? 'danger' : 'muted'}`}>
          {state === 'saved' ? 'Saved.' : state === 'saving' ? 'Saving…' : state}
        </span>
        <button className="btn primary" disabled={state === 'saving'} onClick={() => save()}>
          Save
        </button>
      </div>
    </section>
  );
}
