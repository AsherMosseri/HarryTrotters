// Coins screen extras: comparing the app's balance with the server's, and
// (team management only) everyone's coin history.
import { useMemo, useState } from 'react';
import { EXACT_LIMIT, MAX_BALANCE, breakdown, breakdownGaps, ceilingNote, coinsAgree, historyGroup, historyKey, overCeiling, setParts, sumCoins, wallet as walletOf } from '../coins.js';
import { Avatar } from './common.jsx';
import { Icon } from './shell/icons.jsx';
import { alertDialog, confirmDialog } from './Dialogs.jsx';
import { useCoinFormat } from './CoinNum.jsx';
import { coinLabel, exactCoins, coinStyled, withExact } from '../coinFormat.js';
import { FIXABLE, gameLabel } from '../../functions/shared/disputes.js';
import { REQUESTS_TO } from '../config.js';

const OWNER = REQUESTS_TO.split(' ')[0];

const KIND = {
  task: 'Finished tasks',
  hours: 'Lab hours',
  award: 'Games and quizzes',
  grant: 'Bonuses from team management',
  spend: 'Spending',
  refund: 'Refunds',
  'gift-in': 'Gifts received',
  'gift-out': 'Gifts sent',
  prize: 'Prizes',
  casino: 'Casino and economy',
};
const when = (at) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// "They match", or by how much and where they don't.
export function compareLine(app, server) {
  const gaps = breakdownGaps(breakdown(app.history), server.breakdown || {});
  const off = server.balance - app.balance;
  // A running shift counts by the minute on both sides: a coin of slack.
  // Past 2^53 balances are approximate: within a billionth agrees (coinsAgree).
  if (Math.abs(off) <= 1 || coinsAgree(app.balance, server.balance)) return { match: true, gaps: [], text: 'They match.' };
  const where = gaps.filter((g) => g.diff).map((g) => KIND[g.kind] || g.kind);
  return {
    match: false,
    gaps,
    text: `The app and the server disagree by ${exactCoins(Math.abs(off))}${where.length ? `: ${where.join(', ')}` : ''}.`,
  };
}

// A collapsed section: the server's numbers next to the app's, per kind.
export function CompareWithServer({ name, mine, onCheck }) {
  const f = useCoinFormat();
  const [state, setState] = useState({ busy: false, result: null, error: '' });
  const run = async () => {
    setState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const result = await onCheck(name);
      setState({ busy: false, result, error: '' });
    } catch (e) {
      setState({ busy: false, result: null, error: e?.message || 'Couldn’t reach the server.' });
    }
  };
  const { result } = state;
  const line = result && result.name === name ? compareLine(mine, result) : null;
  const rows = useMemo(() => {
    if (!result) return [];
    const app = breakdown(mine.history);
    const kinds = [...new Set([...Object.keys(app), ...Object.keys(result.breakdown || {})])];
    return kinds
      .map((k) => ({ k, app: app[k]?.coins || 0, server: result.breakdown?.[k]?.coins || 0 }))
      .sort((a, b) => Object.keys(KIND).indexOf(a.k) - Object.keys(KIND).indexOf(b.k));
  }, [result, mine]);
  return (
    <details className="cv-compare" onToggle={(e) => e.currentTarget.open && !result && !state.busy && run()}>
      <summary>Compare with the server</summary>
      <div className="cv-compare-body">
        {state.busy && !result && <p className="muted small">Asking the server…</p>}
        {state.error && <p className="danger small">{state.error}</p>}
        {line && (
          <>
            <p className={`cv-verdict${line.match ? ' ok' : ' bad'}`} role="status">
              {line.text}
            </p>
            <table className="cv-table">
              <thead>
                <tr>
                  <th />
                  <th>App</th>
                  <th>Server</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.k} className={coinsAgree(r.app, r.server) ? '' : 'off'}>
                    <td>{KIND[r.k] || r.k}</td>
                    <td className="mono">{f.signed(r.app)}</td>
                    <td className="mono">{f.signed(r.server)}</td>
                    <td className="mono">{coinsAgree(r.app, r.server) ? '' : f.signed(r.app - r.server)}</td>
                  </tr>
                ))}
                <tr className={`total${coinsAgree(mine.balance, result.balance) ? '' : ' off'}`}>
                  <td>Balance</td>
                  <td className="mono" title={f.title(mine.balance)}>{f.n(mine.balance)}</td>
                  <td className="mono" title={f.title(result.balance)}>{f.n(result.balance)}</td>
                  <td className="mono">{coinsAgree(mine.balance, result.balance) ? '' : f.signed(mine.balance - result.balance)}</td>
                </tr>
              </tbody>
            </table>
            <p className="muted tiny">
              {result.demo
                ? 'Demo mode: there is no server, so the numbers come from the app.'
                : `The server counted ${result.items.length} entries${
                    result.bank?.docs?.length ? ` and ${result.bank.docs.length} casino record${result.bank.docs.length === 1 ? '' : 's'}` : ''
                  }. Tasks and lab hours it reads fresh; ${
                    result.cacheAgeMs > 1000 ? `team settings are ${Math.round(result.cacheAgeMs / 1000)} seconds old` : 'team settings just loaded'
                  }.`}
            </p>
          </>
        )}
        <button className="btn small" onClick={run} disabled={state.busy}>
          {state.busy ? 'Checking…' : result ? 'Check again' : 'Check now'}
        </button>
      </div>
    </details>
  );
}

// "Balance may be out of date": the server's answer didn't match the app's number.
export function StaleBanner({ stale, onRefresh }) {
  if (!stale) return null;
  return (
    <button className="cv-stale" onClick={onRefresh}>
      <Icon name="repeat" size={16} />
      <span>
        Balance may be out of date: tap to refresh
        <span className="muted tiny"> The server says {stale.server}, this app says {stale.app}.</span>
      </span>
    </button>
  );
}

const CHIPS = [
  ['all', 'All'],
  ['earned', 'Earned'],
  ['spent', 'Spent'],
  ['casino', 'Casino'],
  ['gifts', 'Gifts'],
  ['loans', 'Loans'],
  ['prizes', 'Prizes'],
  ['market', 'Market'],
];

// Team management: everyone's coins. A list of people, then one person's full history.
export function EveryoneCoins({ roster, data, cfg, onCheck, onAdjust, onFix }) {
  const f = useCoinFormat();
  const [who, setWho] = useState(null);
  const [q, setQ] = useState('');
  const wallets = useMemo(() => Object.fromEntries(roster.map((n) => [n, walletOf(n, data)])), [roster, data]);
  const rows = useMemo(
    () =>
      roster
        .filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()))
        .map((name) => ({ name, w: wallets[name], casino: data.bank[name]?.net || 0 }))
        .sort((a, b) => b.w.balance - a.w.balance || a.name.localeCompare(b.name)),
    [roster, wallets, data, q],
  );
  if (who && wallets[who])
    return <Person name={who} w={wallets[who]} casino={data.bank[who]?.net || 0} cfg={cfg} onCheck={onCheck} onAdjust={onAdjust} onFix={onFix} onBack={() => setWho(null)} />;
  return (
    <>
      <label className="cv-search">
        <Icon name="search" size={16} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone" aria-label="Find someone" />
      </label>
      <ul className="cv-people">
        <li className="cv-head" aria-hidden="true">
          <span className="grow">Person</span>
          <span>Balance</span>
          <span>Earned</span>
          <span>Casino</span>
        </li>
        {rows.map((r) => (
          <li key={r.name}>
            <button className="cv-person" onClick={() => setWho(r.name)}>
              <Avatar name={r.name} size={28} />
              <span className="grow cv-name">{r.name}</span>
              <b className="mono" title={f.title(r.w.balance)}>{f.n(r.w.balance)}</b>
              <span className="mono muted" title={f.title(r.w.earned)}>{f.n(r.w.earned)}</span>
              <span className={`mono ${r.casino < 0 ? 'coins-minus' : r.casino > 0 ? 'coins-plus' : 'muted'}`}>{f.signed(r.casino)}</span>
            </button>
          </li>
        ))}
        {!rows.length && <li className="muted">Nobody by that name.</li>}
      </ul>
      <p className="muted tiny">Balance is everything counted now. Earned is tasks, lab hours, quizzes and bonuses. Casino is the net from /slots, /daily and the other commands.</p>
    </>
  );
}

function Person({ name, w, casino, cfg, onCheck, onAdjust, onFix, onBack }) {
  const f = useCoinFormat();
  const [chip, setChip] = useState('all');
  // The balance after each entry: start from today's and walk back. Past
  // 2^53 a subtraction can lose the small lines (3e45 − 3e45 + 11Qa would say
  // 0), so then each one is the exact sum of it and everything older,
  // rounded once (the same sum as the balance, sumCoins).
  const all = useMemo(() => {
    const big = w.history.some((x) => Math.abs(x.amount) >= EXACT_LIMIT) || Math.abs(w.balance) >= EXACT_LIMIT;
    if (!big) {
      let run = w.balance;
      return w.history.map((x) => {
        const row = { ...x, after: run };
        run -= x.amount;
        return row;
      });
    }
    const out = new Array(w.history.length);
    let whole = 0n;
    let rest = 0;
    for (let i = w.history.length - 1; i >= 0; i--) {
      const x = w.history[i];
      const v = Number.isFinite(x.amount) ? x.amount : 0;
      whole += BigInt(Math.trunc(v));
      rest += v - Math.trunc(v);
      out[i] = { ...x, after: Number(whole) + rest };
    }
    return out;
  }, [w]);
  const shown = chip === 'all' ? all : all.filter((x) => historyGroup(x) === chip);
  const rev = useReverse(name, w.history, onAdjust, onFix);
  const total = sumCoins(shown);
  return (
    <>
      <div className="cv-who">
        <button className="icon-btn cv-back" onClick={onBack} aria-label="Back to everyone">
          <Icon name="chevron" size={18} />
        </button>
        <Avatar name={name} size={36} />
        <span className="grow">
          <b>{name}</b>
          <span className="muted tiny">
            <span className="mono" title={f.title(w.balance)}>{f.n(w.balance)}</span> now ·{' '}
            <span className="mono" title={f.title(w.earned)}>{f.n(w.earned)}</span> earned ·{' '}
            <span className="mono">{f.signed(casino)}</span> casino
          </span>
        </span>
      </div>
      {onAdjust && <AdjustCoins key={name} name={name} balance={w.balance} history={w.history} onCheck={onCheck} onAdjust={onAdjust} />}
      {onAdjust && <p className="muted tiny cv-rev-hint">Tap a line to reverse it: a loss is refunded, a gain is taken away.</p>}
      <div className="cv-chips" role="group" aria-label="Show">
        {CHIPS.map(([id, label]) => (
          <button key={id} className={`chip${chip === id ? ' on' : ''}`} aria-pressed={chip === id} onClick={() => setChip(id)}>
            {label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className="coins-history cv-history">
          {shown.map((x, i) => (
            <li key={`${x.kind}-${x.at}-${i}`} className={`${rev.can(x) ? 'cv-rev' : ''}${rev.isReversed(x) ? ' is-reversed' : ''}`} {...reverseProps(rev, x)}>
              <span className="coins-icon" aria-hidden="true">
                {x.icon}
              </span>
              <span className="grow">
                <span className="coins-label">
                  {f.label(x.label)} <ReversedTag rev={rev} x={x} />
                </span>
                <span className="muted tiny">
                  <span className="mono">{when(x.at)}</span>
                  {x.capped ? ` · counted ${cfg.dayCap} h max a day` : ''}
                  {x.note ? ` · ${x.note}` : ''}
                </span>
              </span>
              <span className="cv-amt">
                <b className={`mono ${x.amount < 0 ? 'coins-minus' : x.amount > 0 ? 'coins-plus' : 'muted'}`}>{f.signed(x.amount)}</b>
                <span className="mono muted tiny" title="Balance after this">
                  {f.n(x.after)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing in this part.</p>
      )}
      <p className="cv-total">
        <span>
          {shown.length} {shown.length === 1 ? 'entry' : 'entries'}
          {chip === 'all' ? '' : ` in ${CHIPS.find(([id]) => id === chip)[1]}`}
        </span>
        <b className="mono">{f.signed(total)}</b>
      </p>
      <CompareWithServer key={name} name={name} mine={w} onCheck={onCheck} />
    </>
  );
}

// The owner only: add, take away, or set someone's Jackson coins. It goes in
// as a grant (bonus or "taken away") with a note, like the Ads page's grants;
// "set" works out the difference from the server's balance when it can.
// The most the owner can add or take away at once is the ceiling itself, a
// googol (MAX_BALANCE; the rules allow the same). Grants are written from
// here (the rules can't read balances), so the ceiling is checked here too:
// an Add or Set that would put them over it is refused, against the server's
// balance when it answers (the rules allow any finite amount from the owner).
// Past 2^53 (about 9 quadrillion) amounts are rounded, like every big balance.
const OWNER_MAX = MAX_BALANCE;
function AdjustCoins({ name, balance, history = [], onCheck, onAdjust }) {
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const n = Math.floor(Number(amount));
  // Set to more than the ceiling can never work, whatever the difference.
  const ok = Number.isFinite(n) && amount !== '' && (mode === 'set' ? n >= 0 : n > 0) && n <= OWNER_MAX;
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setMsg('');
    try {
      let now = balance;
      if (mode !== 'remove' && onCheck) {
        const r = await onCheck(name).catch(() => null);
        if (Number.isFinite(r?.balance)) now = r.balance;
      }
      const delta = mode === 'add' ? n : mode === 'remove' ? -n : n - now;
      if (!delta) {
        setMsg(`${name.split(' ')[0]} already has ${coinStyled(now)}.`);
        return;
      }
      if (overCeiling(now, delta)) {
        const c = ceilingNote(name);
        setMsg(`${c.error} ${c.body}`);
        return;
      }
      if (Math.abs(delta) > OWNER_MAX) {
        setMsg('That’s a change of more than a googol.');
        return;
      }
      // Set: they end at the number asked for (past 2^53, about it).
      const after = mode === 'set' ? n : now + delta;
      const yes = await confirmDialog({
        title: mode === 'set' ? `Set ${name.split(' ')[0]} to ${coinStyled(n)}?` : `${delta > 0 ? 'Give' : 'Take'} ${coinStyled(Math.abs(delta))} coins?`,
        body: withExact(`${name} goes from ${coinStyled(now)} to ${coinStyled(after)} coins.${after < 0 ? ' That’s below zero.' : ''}`, mode === 'set' ? n : delta),
        okLabel: delta > 0 ? 'Give' : 'Take',
        danger: delta < 0,
      });
      if (!yes) return;
      const label = note.trim() || (mode === 'set' ? `Balance set to ${exactCoins(n)}` : delta > 0 ? 'Bonus' : 'Taken away');
      // Set past 2^53: the exact gap from this history (when the server
      // counts the same balance), as one grant or a few that add up exactly.
      const big = Math.max(Math.abs(now), Math.abs(n)) >= EXACT_LIMIT;
      const parts = mode === 'set' && big && coinsAgree(sumCoins(history), now) ? setParts(n, history) : [delta];
      let done;
      for (const [i, amount] of parts.entries()) {
        const line = i ? `${label.slice(0, 120)} (part ${i + 1})` : label.slice(0, 140);
        done = await onAdjust({ to: name, amount, note: line, at: Date.now() });
        if (done === false) break;
      }
      if (done !== false) {
        setMsg(`Done: ${name.split(' ')[0]} has ${coinStyled(after)} now.`);
        setAmount('');
        setNote('');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cv-adjust">
      <div className="segmented" role="group" aria-label="Change coins">
        {[
          ['add', 'Add'],
          ['remove', 'Take away'],
          ['set', 'Set to'],
        ].map(([id, label]) => (
          <button key={id} className={`plain-seg${mode === id ? ' on' : ''}`} aria-pressed={mode === id} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="cv-adjust-row">
        <input className="input mono" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={mode === 'set' ? String(balance) : '0'} aria-label="Coins" />
        <input className="input grow" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (they see it in their history)" aria-label="Note" />
        <button className="btn primary" disabled={!ok || busy} onClick={go}>
          {busy ? '…' : 'Save'}
        </button>
      </div>
      {amount !== '' && n > OWNER_MAX && <p className="muted tiny">Nobody can hold more than a googol coins.</p>}
      {msg && <p className="muted tiny">{msg}</p>}
    </div>
  );
}

// A casino line from a game card, by its label ("Mines: lost 50", "Heist: caught…").
const GAME_LINE = new RegExp(`^(${[...new Set(FIXABLE.map((g) => (g === 'heist' ? 'Heist' : gameLabel(g))))].join('|')}):`);

// The owner only: tap a history line to reverse it. A loss is refunded, a
// gain is taken away, as a grant that names the line (historyKey), so the
// balance and the history still add up, the line shows "Reversed", and it
// can't be reversed twice. onAdjust is null for everyone else.
// A game's line (3.1.1 on) names its card: that goes through the card instead
// (onFix: the ownerRefund function), so the card and coin history share one
// refund key and can't both pay. A bet still held in a live game can't be
// reversed (the game's end pays it).
export function useReverse(name, history, onAdjust, onFix) {
  const reversed = useMemo(() => new Set(history.filter((x) => x.reverses).map((x) => x.reverses)), [history]);
  const [busy, setBusy] = useState('');
  const can = (x) => !!onAdjust && x.amount !== 0 && !x.reverses && !x.held && !reversed.has(historyKey(x));
  const reverse = async (x) => {
    if (!can(x) || busy) return;
    const key = historyKey(x);
    const refund = x.amount < 0;
    const n = coinStyled(Math.abs(x.amount));
    const first = name.split(' ')[0];
    const viaCard = !!(x.card && onFix);
    const [conv, msgId] = viaCard ? String(x.card).split('/') : [];
    // A refund written from here (a grant) can't put them over a googol
    // either (the card's refund is checked by the server).
    if (refund && !viaCard && overCeiling(sumCoins(history), -x.amount)) {
      const c = ceilingNote(name);
      await alertDialog({ title: c.error, body: c.body });
      return;
    }
    const older = !viaCard && x.kind === 'casino' && GAME_LINE.test(x.label || '');
    const ok = await confirmDialog({
      title: refund ? `Refund ${n} coins to ${first}?` : `Take ${n} coins away from ${first}?`,
      body: withExact(viaCard
        ? `“${coinLabel(x.label)}” (${when(x.at)}). This goes through the game’s card: ${first} is told, the card says “${refund ? 'Refunded' : 'Taken back'} by ${OWNER}”, and the line shows Reversed. It can’t also be done from the card.`
        : `“${coinLabel(x.label)}” (${when(x.at)}). ${first}’s history keeps the line, marked Reversed, with a “Reversed” line for the ${refund ? 'refund' : 'take-away'}.${
            older ? ' This line is from before 3.1.1, so it isn’t linked to its card: if the card says “Refunded” or “Taken back”, don’t do this too.' : ''
          }`, x.amount),
      okLabel: refund ? 'Refund' : 'Take away',
      danger: !refund,
    });
    if (!ok) return;
    setBusy(key);
    if (viaCard) {
      const r = await onFix({ conv, msgId, person: name, mode: refund ? 'refund' : 'takeback' });
      if (!r?.ok) await alertDialog({ title: r?.note?.title || 'That didn’t go through.', body: r?.note?.body || '' });
    } else await onAdjust({ to: name, amount: -x.amount, note: `Reversed: ${x.label}`.slice(0, 140), reverses: key, at: Date.now() });
    setBusy('');
  };
  return { can, reverse, isReversed: (x) => reversed.has(historyKey(x)), busy: (x) => busy === historyKey(x) };
}

// What a history row gets when the owner can reverse it: tap (or Enter) to reverse.
export function reverseProps(rev, x) {
  if (!rev.can(x)) return {};
  return {
    role: 'button',
    tabIndex: 0,
    title: x.amount < 0 ? 'Refund this' : 'Take this away',
    onClick: () => rev.reverse(x),
    onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), rev.reverse(x)),
  };
}

export const ReversedTag = ({ rev, x }) =>
  rev.isReversed(x) ? <span className="cv-reversed">Reversed</span> : rev.busy(x) ? <span className="cv-reversed busy">Reversing…</span> : null;
