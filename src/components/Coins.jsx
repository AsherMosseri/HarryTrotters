import { useMemo, useState } from 'react';
import { leaderboard } from '../coins.js';
import { mondayOf, parseDay, todayISO } from '../milestones.js';
import { relTime, useEscape } from '../util.js';
import { Avatar, CloseIcon, Overlay } from './common.jsx';

// A Jackson coin: a little gold coin with a J.
export const Coin = ({ size = 16 }) => (
  <span className="jcoin" style={{ '--jc': `${size}px` }} aria-hidden="true">
    J
  </span>
);
export const Coins = ({ n, size }) => (
  <span className="jcoins">
    <Coin size={size} />
    {Number(n || 0).toLocaleString()}
  </span>
);

const WHO = (n) => n.split(' ')[0];

export function CoinsDialog({ actor, wallet, roster, data, cfg, onGift, onClose }) {
  useEscape(onClose);
  const [tab, setTab] = useState('wallet');
  const [range, setRange] = useState('week');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(null);
  const monday = parseDay(mondayOf(todayISO())).getTime();
  const board = useMemo(() => leaderboard(roster, data, range === 'week' ? monday : 0), [roster, data, range, monday]);
  const n = Math.floor(Number(amount));
  const canSend = to && n > 0 && n <= wallet.balance;
  const others = roster.filter((x) => x !== actor.name);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog coins-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Jackson coins">
          <div className="panel-head">
            <h2>
              <Coin size={22} /> Jackson coins
            </h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="coins-balance">
            <span className="muted small">Your balance</span>
            <b>
              <Coins n={wallet.balance} size={30} />
            </b>
            <span className="muted small">
              {cfg.perTask} for each task you finish · {cfg.perHour} an hour at the lab
            </span>
          </div>
          <div className="segmented coins-tabs" role="tablist">
            {[
              ['wallet', 'History'],
              ['send', 'Send'],
              ['board', 'Leaderboard'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`plain-seg${tab === id ? ' on' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="coins-body">
            {tab === 'wallet' &&
              (wallet.history.length ? (
                <ul className="coins-history">
                  {wallet.history.map((x, i) => (
                    <li key={`${x.kind}-${x.at}-${i}`}>
                      <span className="coins-icon" aria-hidden="true">
                        {x.icon}
                      </span>
                      <span className="grow">
                        <span className="coins-label">{x.label}</span>
                        <span className="muted tiny">
                          {relTime(x.at)}
                          {x.capped ? ` · counted ${cfg.dayCap} h max a day` : ''}
                        </span>
                      </span>
                      <b className={x.amount < 0 ? 'coins-minus' : 'coins-plus'}>
                        {x.amount > 0 ? '+' : '−'}
                        {Math.abs(x.amount)}
                      </b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nothing yet. Finish a task someone gave you, or clock in at the lab.</p>
              ))}

            {tab === 'send' &&
              (sent ? (
                <div className="coins-sent">
                  <div className="ad-pop" aria-hidden="true">
                    🎁
                  </div>
                  <h3>
                    Sent <Coins n={sent.amount} /> to {WHO(sent.to)}
                  </h3>
                  <button
                    className="btn"
                    onClick={() => {
                      setSent(null);
                      setAmount('');
                      setNote('');
                    }}
                  >
                    Send more
                  </button>
                </div>
              ) : (
                <div className="fields coins-send">
                  <label className="field-label">To</label>
                  <select className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send to">
                    <option value="">Pick a teammate…</option>
                    {others.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                  <label className="field-label">Coins</label>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={wallet.balance}
                    value={amount}
                    placeholder={`Up to ${wallet.balance}`}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-label="How many coins"
                  />
                  <label className="field-label">Note</label>
                  <input
                    className="input"
                    maxLength={140}
                    value={note}
                    placeholder="Thanks for the help!"
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <span />
                  <div className="row gap">
                    {n > wallet.balance && <span className="danger small">You only have {wallet.balance}.</span>}
                    <span className="spacer" />
                    <button
                      className="btn primary"
                      disabled={!canSend}
                      onClick={async () => {
                        await onGift({ to, amount: n, note: note.trim() });
                        setSent({ to, amount: n });
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              ))}

            {tab === 'board' && (
              <>
                <div className="segmented coins-range">
                  {[
                    ['week', 'This week'],
                    ['season', 'This season'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={`plain-seg${range === id ? ' on' : ''}`}
                      aria-pressed={range === id}
                      onClick={() => setRange(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ol className="coins-board">
                  {board.map((r, i) => (
                    <li key={r.name} className={r.name === actor.name ? 'me' : ''}>
                      <span className="coins-rank">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                      <Avatar name={r.name} size={28} />
                      <span className="grow">{r.name}</span>
                      <Coins n={r.coins} />
                    </li>
                  ))}
                </ol>
                <p className="muted tiny">Earned from tasks, hours, and bonuses. Gifts don’t count.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// Asher's coin controls (a tab on the Ads page).
export function CoinsAdmin({ cfg, setCfg, roster, balances, onGrant, ledger, onUndo }) {
  const [who, setWho] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const setPrice = (k, v) => setCfg({ ...cfg, prices: { ...cfg.prices, [k]: num(v) } });
  const grants = ledger.filter((x) => x.type === 'grant').sort((a, b) => b.at - a.at);
  const n = Math.trunc(Number(amount));
  const field = (label, value, onChange, hint) => (
    <div className="ads-row">
      <div className="ads-row-text">
        <b>{label}</b>
        {hint && <span className="muted small">{hint}</span>}
      </div>
      <input
        className="input coins-num"
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
    </div>
  );
  return (
    <>
      <h4>Earning</h4>
      {field('Coins per task', cfg.perTask, (v) => setCfg({ ...cfg, perTask: num(v) }), 'Tasks assigned to them, created by someone else.')}
      {field('Coins per hour at the lab', cfg.perHour, (v) => setCfg({ ...cfg, perHour: num(v) }))}
      {field('Most hours counted a day', cfg.dayCap, (v) => setCfg({ ...cfg, dayCap: Math.max(1, num(v)) }))}
      {field(
        'Your ad money: views per coin',
        cfg.viewsPerCoin,
        (v) => setCfg({ ...cfg, viewsPerCoin: Math.max(1, num(v)) }),
        `Plus ${cfg.perTap} a tap. Only you earn this.`,
      )}
      <h4>Prices</h4>
      {field('Remove ads for 1 hour', cfg.prices.hour, (v) => setPrice('hour', v))}
      {field('Remove ads for the rest of today', cfg.prices.today, (v) => setPrice('today', v))}
      {field('Remove ads for a week', cfg.prices.week, (v) => setPrice('week', v))}
      {field('Skip a full-screen ad', cfg.prices.skip, (v) => setPrice('skip', v))}
      <p className="muted small">Earning and prices save with Save. Giving coins happens right away.</p>
      <h4>Give or take coins</h4>
      <div className="row gap wrap coins-grant">
        <select className="input" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who">
          <option value="">Who…</option>
          {roster.map((x) => (
            <option key={x} value={x}>
              {x} ({balances[x] ?? 0})
            </option>
          ))}
        </select>
        <input
          className="input coins-num"
          type="number"
          value={amount}
          placeholder="+50 or -20"
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Coins"
        />
        <input
          className="input grow"
          maxLength={140}
          value={note}
          placeholder="Why (they’ll see this)"
          onChange={(e) => setNote(e.target.value)}
          aria-label="Why"
        />
        <button
          className="btn primary"
          disabled={!who || !n}
          onClick={() => {
            onGrant({ to: who, amount: n, note: note.trim() });
            setAmount('');
            setNote('');
          }}
        >
          {n < 0 ? 'Take' : 'Give'}
        </button>
      </div>
      {grants.length > 0 && (
        <ul className="coins-history">
          {grants.slice(0, 20).map((g) => (
            <li key={g.id}>
              <span className="coins-icon">{g.amount >= 0 ? '⭐' : '⚠️'}</span>
              <span className="grow">
                <span className="coins-label">
                  {g.to}
                  {g.note ? `: ${g.note}` : ''}
                </span>
                <span className="muted tiny">{relTime(g.at)}</span>
              </span>
              <b className={g.amount < 0 ? 'coins-minus' : 'coins-plus'}>
                {g.amount > 0 ? '+' : '−'}
                {Math.abs(g.amount)}
              </b>
              <button className="link-btn small" onClick={() => onUndo(g)}>
                Undo
              </button>
            </li>
          ))}
        </ul>
      )}
      <h4>Balances</h4>
      <ul className="coins-board">
        {[...roster]
          .sort((a, b) => (balances[b] ?? 0) - (balances[a] ?? 0))
          .map((x) => (
            <li key={x}>
              <Avatar name={x} size={24} />
              <span className="grow">{x}</span>
              <Coins n={balances[x] ?? 0} />
            </li>
          ))}
      </ul>
    </>
  );
}
