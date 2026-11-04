// Coins screen extras: comparing the app's balance with the server's, and
// (team management only) everyone's coin history.
import { useMemo, useState } from 'react';
import { breakdown, breakdownGaps, historyGroup, historyKey, wallet as walletOf } from '../coins.js';
import { Avatar } from './common.jsx';
import { Icon } from './shell/icons.jsx';
import { confirmDialog } from './Dialogs.jsx';

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
const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const when = (at) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// "They match", or by how much and where they don't.
export function compareLine(app, server) {
  const gaps = breakdownGaps(breakdown(app.history), server.breakdown || {});
  const off = server.balance - app.balance;
  // A running shift counts by the minute on both sides: a coin of slack.
  if (Math.abs(off) <= 1) return { match: true, gaps: [], text: 'They match.' };
  const where = gaps.filter((g) => g.diff).map((g) => KIND[g.kind] || g.kind);
  return {
    match: false,
    gaps,
    text: `The app and the server disagree by ${Math.abs(off)}${where.length ? `: ${where.join(', ')}` : ''}.`,
  };
}

// A collapsed section: the server's numbers next to the app's, per kind.
export function CompareWithServer({ name, mine, onCheck }) {
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
                  <tr key={r.k} className={r.app !== r.server ? 'off' : ''}>
                    <td>{KIND[r.k] || r.k}</td>
                    <td className="mono">{sign(r.app)}</td>
                    <td className="mono">{sign(r.server)}</td>
                    <td className="mono">{r.app === r.server ? '' : sign(r.app - r.server)}</td>
                  </tr>
                ))}
                <tr className={`total${mine.balance !== result.balance ? ' off' : ''}`}>
                  <td>Balance</td>
                  <td className="mono">{mine.balance}</td>
                  <td className="mono">{result.balance}</td>
                  <td className="mono">{mine.balance === result.balance ? '' : sign(mine.balance - result.balance)}</td>
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
export function EveryoneCoins({ roster, data, cfg, onCheck, onAdjust }) {
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
  if (who && wallets[who]) return <Person name={who} w={wallets[who]} casino={data.bank[who]?.net || 0} cfg={cfg} onCheck={onCheck} onAdjust={onAdjust} onBack={() => setWho(null)} />;
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
              <b className="mono">{r.w.balance}</b>
              <span className="mono muted">{r.w.earned}</span>
              <span className={`mono ${r.casino < 0 ? 'coins-minus' : r.casino > 0 ? 'coins-plus' : 'muted'}`}>{r.casino ? sign(r.casino) : '0'}</span>
            </button>
          </li>
        ))}
        {!rows.length && <li className="muted">Nobody by that name.</li>}
      </ul>
      <p className="muted tiny">Balance is everything counted now. Earned is tasks, lab hours, quizzes and bonuses. Casino is the net from /slots, /daily and the other commands.</p>
    </>
  );
}

function Person({ name, w, casino, cfg, onCheck, onAdjust, onBack }) {
  const [chip, setChip] = useState('all');
  // The balance after each entry: start from today's and walk back.
  const all = useMemo(() => {
    let run = w.balance;
    return w.history.map((x) => {
      const row = { ...x, after: run };
      run -= x.amount;
      return row;
    });
  }, [w]);
  const shown = chip === 'all' ? all : all.filter((x) => historyGroup(x) === chip);
  const rev = useReverse(name, w.history, onAdjust);
  const total = shown.reduce((t, x) => t + x.amount, 0);
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
            <span className="mono">{w.balance}</span> now · <span className="mono">{w.earned}</span> earned ·{' '}
            <span className="mono">{casino ? sign(casino) : '0'}</span> casino
          </span>
        </span>
      </div>
      {onAdjust && <AdjustCoins key={name} name={name} balance={w.balance} onCheck={onCheck} onAdjust={onAdjust} />}
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
                  {x.label} <ReversedTag rev={rev} x={x} />
                </span>
                <span className="muted tiny">
                  <span className="mono">{when(x.at)}</span>
                  {x.capped ? ` · counted ${cfg.dayCap} h max a day` : ''}
                  {x.note ? ` · ${x.note}` : ''}
                </span>
              </span>
              <span className="cv-amt">
                <b className={`mono ${x.amount < 0 ? 'coins-minus' : x.amount > 0 ? 'coins-plus' : 'muted'}`}>{sign(x.amount)}</b>
                <span className="mono muted tiny" title="Balance after this">
                  {x.after}
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
        <b className="mono">{sign(total)}</b>
      </p>
      <CompareWithServer key={name} name={name} mine={w} onCheck={onCheck} />
    </>
  );
}

// The owner only: add, take away, or set someone's Jackson coins. It goes in
// as a grant (bonus or "taken away") with a note, like the Ads page's grants;
// "set" works out the difference from the server's balance when it can.
function AdjustCoins({ name, balance, onCheck, onAdjust }) {
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const n = Math.floor(Number(amount));
  const ok = Number.isFinite(n) && amount !== '' && (mode === 'set' ? n >= 0 : n > 0) && n <= 100000;
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setMsg('');
    try {
      let now = balance;
      if (mode === 'set' && onCheck) {
        const r = await onCheck(name).catch(() => null);
        if (Number.isFinite(r?.balance)) now = r.balance;
      }
      const delta = mode === 'add' ? n : mode === 'remove' ? -n : n - now;
      if (!delta) {
        setMsg(`${name.split(' ')[0]} already has ${now}.`);
        return;
      }
      const after = now + delta;
      const yes = await confirmDialog({
        title: mode === 'set' ? `Set ${name.split(' ')[0]} to ${n}?` : `${delta > 0 ? 'Give' : 'Take'} ${Math.abs(delta)} coins?`,
        body: `${name} goes from ${now} to ${after} coins.${after < 0 ? ' That’s below zero.' : ''}`,
        okLabel: delta > 0 ? 'Give' : 'Take',
        danger: delta < 0,
      });
      if (!yes) return;
      const label = note.trim() || (mode === 'set' ? `Balance set to ${n}` : delta > 0 ? 'Bonus' : 'Taken away');
      const done = await onAdjust({ to: name, amount: delta, note: label.slice(0, 140), at: Date.now() });
      if (done !== false) {
        setMsg(`Done: ${name.split(' ')[0]} has ${after} now.`);
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
        <input className="input mono" type="number" inputMode="numeric" min={0} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={mode === 'set' ? String(balance) : '0'} aria-label="Coins" />
        <input className="input grow" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (they see it in their history)" aria-label="Note" />
        <button className="btn primary" disabled={!ok || busy} onClick={go}>
          {busy ? '…' : 'Save'}
        </button>
      </div>
      {msg && <p className="muted tiny">{msg}</p>}
    </div>
  );
}

// The owner only: tap a history line to reverse it. A loss is refunded, a
// gain is taken away, as a grant that names the line (historyKey), so the
// balance and the history still add up, the line shows "Reversed", and it
// can't be reversed twice. onAdjust is null for everyone else.
export function useReverse(name, history, onAdjust) {
  const reversed = useMemo(() => new Set(history.filter((x) => x.reverses).map((x) => x.reverses)), [history]);
  const [busy, setBusy] = useState('');
  const can = (x) => !!onAdjust && x.amount !== 0 && !x.reverses && !reversed.has(historyKey(x));
  const reverse = async (x) => {
    if (!can(x) || busy) return;
    const key = historyKey(x);
    const refund = x.amount < 0;
    const n = Math.abs(x.amount).toLocaleString();
    const first = name.split(' ')[0];
    const ok = await confirmDialog({
      title: refund ? `Refund ${n} coins to ${first}?` : `Take ${n} coins away from ${first}?`,
      body: `“${x.label}” (${when(x.at)}). ${first}’s history keeps the line, marked Reversed, with a “Reversed” line for the ${refund ? 'refund' : 'take-away'}.`,
      okLabel: refund ? 'Refund' : 'Take away',
      danger: !refund,
    });
    if (!ok) return;
    setBusy(key);
    await onAdjust({ to: name, amount: -x.amount, note: `Reversed: ${x.label}`.slice(0, 140), reverses: key, at: Date.now() });
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
