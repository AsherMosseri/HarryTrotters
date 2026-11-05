// The coins screen's Stats tab (3.2) and the gambling buddy. The numbers come
// from src/coinStats.js, worked out from the same history lines the History
// tab lists, so they always match it. The charts are plain SVG.
import { useEffect, useMemo, useRef, useState } from 'react';
import { coinScale, coinStats } from '../coinStats.js';
import { formatCoins } from '../coinFormat.js';
import { sciText } from '../../functions/shared/coinText.js';
import { CoinNum, useCoinFormat } from './CoinNum.jsx';
import { Avatar } from './common.jsx';
import { Icon } from './shell/icons.jsx';
import { confirmDialog } from './Dialogs.jsx';
import { BUDDY } from '../../functions/shared/buddy.js';

const first = (n) => String(n || '').split(' ')[0];
const dayText = (day, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, opts);
const atText = (at) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
// Axis labels: this device's style while short enough, else Short (1.2Qa, 1e40).
// From 1e21 up, powers of ten in scientific (1e25, 1e50), not "10Sp".
function axisText(v, style) {
  if (v >= 1e21) return sciText(v);
  const s = formatCoins(v, style);
  return s.length <= 6 ? s : formatCoins(v, 'short');
}

// ---------- the tab ----------

export function CoinStats({ wallet, buddy, roster = [], me }) {
  const f = useCoinFormat();
  const s = useMemo(() => coinStats(wallet.history), [wallet.history]);
  const g = s.gambling;
  const hasGambling = g.games.length > 0 || g.earlier !== 0;
  return (
    <div className="cs">
      {buddy && <BuddyCards buddy={buddy} roster={roster} me={me} />}

      <section className="cs-sec" aria-labelledby="cs-gamb">
        <h3 className="cs-head" id="cs-gamb">
          Gambling
        </h3>
        <div className="cs-tiles">
          <Tile label="Won" n={g.won} tone={g.won ? 'plus' : ''} />
          <Tile label="Lost" n={-g.lost} tone={g.lost ? 'minus' : ''} signed />
          <Tile label="Net" n={g.net} tone={g.net > 0 ? 'plus' : g.net < 0 ? 'minus' : ''} signed />
        </div>
        <p className="muted tiny cs-note">
          {g.plays ? `${g.plays} ${g.plays === 1 ? 'play' : 'plays'} · ${g.wins} ${g.wins === 1 ? 'win' : 'wins'}` : 'No casino games or bets yet.'}
          {g.held > 0 && <> · {f.n(g.held)} held in games still going</>}
          {g.adjusted !== 0 && <> · {f.signed(g.adjusted)} in refunds</>}
          {' · '}Casino games, the lottery, and bets in arcade games.
        </p>
        {g.earlier !== 0 && (
          <p className="muted tiny cs-note">
            Your older casino and economy lines are kept as one line ({f.signed(g.earlier)}), so they aren’t split by game here.
          </p>
        )}
        {buddy && <BuddyRow buddy={buddy} roster={roster} me={me} />}
      </section>

      <section className="cs-sec" aria-labelledby="cs-bal">
        <h3 className="cs-head" id="cs-bal">
          Balance over time
        </h3>
        {s.balance.length > 1 ? <LineChart points={s.balance} label="Balance" /> : <p className="muted small">Not enough history for a chart yet.</p>}
      </section>

      <section className="cs-sec" aria-labelledby="cs-daily">
        <h3 className="cs-head" id="cs-daily">
          Gambling each day <span className="cs-head-sub">last 30 days</span>
        </h3>
        {s.daily.some((d) => d.n) ? <BarChart days={s.daily} /> : <p className="muted small">No gambling in the last 30 days.</p>}
        {(s.days.bestGamb || s.days.worstGamb) && (
          <div className="cs-tiles two">
            {s.days.bestGamb && <Tile label={`Best: ${dayText(s.days.bestGamb.day)}`} n={s.days.bestGamb.net} tone="plus" signed />}
            {s.days.worstGamb && <Tile label={`Worst: ${dayText(s.days.worstGamb.day)}`} n={s.days.worstGamb.net} tone="minus" signed />}
          </div>
        )}
      </section>

      {hasGambling && g.games.length > 0 && (
        <section className="cs-sec" aria-labelledby="cs-games">
          <h3 className="cs-head" id="cs-games">
            By game
          </h3>
          <div className="cs-table-wrap">
            <table className="cs-table">
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col">Plays</th>
                  <th scope="col">Wins</th>
                  <th scope="col">Biggest win</th>
                  <th scope="col">Biggest loss</th>
                </tr>
              </thead>
              <tbody>
                {g.games.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">
                      <span className="cs-game">
                        <span aria-hidden="true">{x.icon}</span>
                        <span className="cs-game-name">
                          {x.name}
                          <span className="muted tiny">
                            {x.casino ? 'Casino' : 'Arcade bet'} · net{' '}
                            <CoinNum signed n={x.net} max={7} className={x.net > 0 ? 'coins-plus' : x.net < 0 ? 'coins-minus' : ''} />
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="mono">{x.plays}</td>
                    <td className="mono">{x.wins}</td>
                    <td>{x.best > 0 ? <CoinNum signed n={x.best} max={7} className="coins-plus" /> : <span className="muted">–</span>}</td>
                    <td>{x.worst < 0 ? <CoinNum signed n={x.worst} max={7} className="coins-minus" /> : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="cs-sec" aria-labelledby="cs-earned">
        <h3 className="cs-head" id="cs-earned">
          Earned <CoinNum n={s.earned.total} className="cs-head-num" max={9} />
        </h3>
        <Bars rows={s.earned.parts.filter((p) => p.n || p.id === 'task' || p.id === 'hours').map((p) => ({ id: p.id, label: p.label, n: p.coins, count: p.n }))} />
      </section>

      <section className="cs-sec" aria-labelledby="cs-moves">
        <h3 className="cs-head" id="cs-moves">
          Gifts, loans and the market
        </h3>
        <dl className="cs-list">
          <Row label="Gifts received" sub={count(s.src['gift-in'].n, 'gift')} n={s.src['gift-in'].coins} />
          <Row label="Gifts sent" sub={count(s.src['gift-out'].n, 'gift')} n={s.src['gift-out'].coins} />
          {s.loans.n > 0 ? (
            <>
              {s.loans.borrowed > 0 && <Row label="Borrowed" n={s.loans.borrowed} />}
              {s.loans.paidBack > 0 && <Row label="Paid back on loans" n={-s.loans.paidBack} />}
              {s.loans.lent > 0 && <Row label="Lent to teammates" n={-s.loans.lent} />}
              {s.loans.gotBack > 0 && <Row label="Paid back to you" n={s.loans.gotBack} />}
            </>
          ) : (
            <Row label="Loans" sub="none yet" n={0} />
          )}
          <Row label="Market spending" sub={count(s.src.market.n, 'buy', 'buys')} n={s.src.market.coins} />
          {s.src.spend.n > 0 && <Row label="Ad breaks and skips" n={s.src.spend.coins} />}
          {s.src.refund.n > 0 && <Row label="Refunds" n={s.src.refund.coins} />}
        </dl>
      </section>

      <section className="cs-sec" aria-labelledby="cs-days">
        <h3 className="cs-head" id="cs-days">
          Best and worst day
        </h3>
        {s.days.best || s.days.worst ? (
          <div className="cs-tiles two">
            {s.days.best ? <Tile label={dayText(s.days.best.day)} n={s.days.best.net} tone="plus" signed sub="Best day" /> : <Tile label="Best day" n={0} />}
            {s.days.worst ? <Tile label={dayText(s.days.worst.day)} n={s.days.worst.net} tone="minus" signed sub="Worst day" /> : <Tile label="No down days" n={0} />}
          </div>
        ) : (
          <p className="muted small">Nothing yet.</p>
        )}
        <p className="muted tiny cs-note">Everything that came in and went out that day (New York time).</p>
      </section>

      <p className="muted tiny cs-foot">
        Worked out from the {s.lines} {s.lines === 1 ? 'line' : 'lines'} in your history, which add up to your balance of{' '}
        <CoinNum n={s.total} max={13} />.
      </p>
    </div>
  );
}
const count = (n, one, many = `${one}s`) => (n ? `${n} ${n === 1 ? one : many}` : '');

function Tile({ label, n, tone = '', signed = false, sub = '' }) {
  return (
    <div className={`cs-tile ${tone}`}>
      <span className="cs-tile-k">{sub || label}</span>
      <CoinNum as="b" n={n} signed={signed && n !== 0} max={9} className="cs-tile-v" />
      {sub && <span className="muted tiny">{label}</span>}
    </div>
  );
}

function Row({ label, sub = '', n }) {
  return (
    <div className="cs-row">
      <dt>
        {label}
        {sub && <span className="muted tiny"> · {sub}</span>}
      </dt>
      <dd>
        <CoinNum signed={n !== 0} n={n} max={10} className={n > 0 ? 'coins-plus' : n < 0 ? 'coins-minus' : 'muted'} />
      </dd>
    </div>
  );
}

// Where earned coins came from, as bars (a share of the biggest one).
function Bars({ rows }) {
  const top = Math.max(1, ...rows.map((r) => Math.abs(r.n)));
  return (
    <ul className="cs-bars">
      {rows.map((r) => (
        <li key={r.id}>
          <span className="cs-bar-label">
            {r.label}
            {r.count > 0 && <span className="muted tiny"> · {r.count}</span>}
          </span>
          <CoinNum signed={r.n < 0} n={r.n} max={9} className={`cs-bar-num${r.n < 0 ? ' coins-minus' : ''}`} />
          <span className="cs-bar-track" aria-hidden="true">
            <span className={`cs-bar-fill${r.n < 0 ? ' neg' : ''}`} style={{ width: `${r.n ? Math.max(1.5, (Math.abs(r.n) / top) * 100) : 0}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- charts ----------

function useWidth(min = 260) {
  const ref = useRef(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(min, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, width];
}

// Ticks that don't crowd each other (at least `gap` px apart).
const spaced = (ticks, y, gap = 16) => {
  const out = [];
  for (const t of [...ticks].sort((a, b) => Math.abs(a) - Math.abs(b))) if (out.every((u) => Math.abs(y(u) - y(t)) >= gap)) out.push(t);
  return out;
};

function Axis({ scale, y, width, m, style }) {
  const ticks = spaced(scale.ticks, y);
  return (
    <g className="cs-axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'cs-zero' : 'cs-grid'} />
          <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {t < 0 ? `−${axisText(-t, style)}` : axisText(t, style)}
          </text>
        </g>
      ))}
    </g>
  );
}

// The balance after each line, with a crosshair readout (tap or hover).
function LineChart({ points, label }) {
  const f = useCoinFormat();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const H = 200;
  const m = { top: 12, right: 12, bottom: 24, left: 52 };
  const scale = useMemo(() => coinScale(points.map((p) => p.v)), [points]);
  const t0 = points[0].at;
  const t1 = Math.max(t0 + 1, points[points.length - 1].at);
  const x = (at) => m.left + ((at - t0) / (t1 - t0)) * (width - m.left - m.right);
  const y = (v) => m.top + (1 - scale.pos(v)) * (H - m.top - m.bottom);
  // A step line: the balance stays put until the next line.
  let d = '';
  points.forEach((p, i) => {
    d += i ? `H${x(p.at).toFixed(1)}V${y(p.v).toFixed(1)}` : `M${x(p.at).toFixed(1)},${y(p.v).toFixed(1)}`;
  });
  const area = `${d}V${y(Math.max(scale.lo, Math.min(0, scale.hi))).toFixed(1)}H${x(points[0].at).toFixed(1)}Z`;
  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    for (let i = 0; i < points.length; i++) if (Math.abs(x(points[i].at) - px) < Math.abs(x(points[best].at) - px)) best = i;
    setHover(best);
  };
  const shown = points[hover ?? points.length - 1];
  return (
    <div className="cs-chart" ref={ref}>
      <div className="cs-readout" aria-live="polite">
        <span className="muted tiny">{hover === null ? 'Now' : atText(shown.at)}</span>
        <CoinNum as="b" n={shown.v} max={13} />
        {scale.kind === 'log' && <span className="cs-scale">log scale</span>}
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${label} from ${atText(points[0].at)} to now, ending at ${f.n(points[points.length - 1].v)} coins.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        <Axis scale={scale} y={y} width={width} m={m} style={f.style} />
        <path d={area} className="cs-area" />
        <path d={d} className="cs-line" />
        <text x={m.left} y={H - 6} className="cs-x">
          {atText(t0)}
        </text>
        <text x={width - m.right} y={H - 6} className="cs-x" textAnchor="end">
          {atText(points[points.length - 1].at)}
        </text>
        {hover !== null && (
          <g className="cs-cross">
            <line x1={x(shown.at)} x2={x(shown.at)} y1={m.top} y2={H - m.bottom} />
            <circle cx={x(shown.at)} cy={y(shown.v)} r={4.5} />
          </g>
        )}
        {hover === null && <circle cx={x(shown.at)} cy={y(shown.v)} r={4} className="cs-dot" />}
      </svg>
    </div>
  );
}

// Each day's gambling net: up for a good day, down for a bad one.
function BarChart({ days }) {
  const f = useCoinFormat();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const H = 170;
  const m = { top: 10, right: 8, bottom: 24, left: 52 };
  const scale = useMemo(() => coinScale(days.map((d) => d.net)), [days]);
  const y = (v) => m.top + (1 - scale.pos(v)) * (H - m.top - m.bottom);
  const band = (width - m.left - m.right) / days.length;
  const barW = Math.max(3, Math.min(18, band - 2));
  const zero = y(Math.max(scale.lo, Math.min(0, scale.hi)));
  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left - m.left) / band);
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  };
  const lastPlayed = [...days].reverse().find((d) => d.n) || days[days.length - 1];
  const shown = hover === null ? lastPlayed : days[hover];
  return (
    <div className="cs-chart" ref={ref}>
      <div className="cs-readout" aria-live="polite">
        <span className="muted tiny">{dayText(shown.day)}</span>
        <CoinNum as="b" signed={shown.net !== 0} n={shown.net} max={13} className={shown.net > 0 ? 'coins-plus' : shown.net < 0 ? 'coins-minus' : ''} />
        <span className="muted tiny">{shown.n ? `${shown.n} ${shown.n === 1 ? 'line' : 'lines'}` : 'no gambling'}</span>
        {scale.kind === 'log' && <span className="cs-scale">log scale</span>}
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Gambling each day for the last ${days.length} days. Best ${f.signed(Math.max(...days.map((d) => d.net)))}, worst ${f.signed(Math.min(...days.map((d) => d.net)))}.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        <Axis scale={scale} y={y} width={width} m={m} style={f.style} />
        {hover !== null && <rect x={m.left + band * hover} y={m.top} width={band} height={H - m.top - m.bottom} className="cs-band" />}
        {days.map((d, i) => {
          if (!d.net) return null;
          const top = Math.min(y(d.net), zero);
          const h = Math.max(2, Math.abs(y(d.net) - zero));
          return (
            <rect
              key={d.day}
              x={m.left + band * i + (band - barW) / 2}
              y={d.net > 0 ? top : zero}
              width={barW}
              height={h}
              rx={Math.min(3, barW / 2)}
              className={d.net > 0 ? 'cs-up' : 'cs-down'}
            />
          );
        })}
        <text x={m.left} y={H - 6} className="cs-x">
          {dayText(days[0].day, { month: 'short', day: 'numeric' })}
        </text>
        <text x={width - m.right} y={H - 6} className="cs-x" textAnchor="end">
          Today
        </text>
      </svg>
    </div>
  );
}

// ---------- gambling buddy ----------
// buddy: { mine, asBuddy, others, isOwner, call(req) → { ok, done } | { note } }.

function useBuddyCall(call) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const run = async (req) => {
    setBusy(true);
    setMsg(null);
    const r = await call(req);
    setBusy(false);
    if (r?.note) setMsg({ bad: true, title: r.note.title, body: r.note.body });
    else if (r?.ok) setMsg({ bad: false, title: r.done || 'Done.' });
    return r;
  };
  return { busy, msg, run, clear: () => setMsg(null) };
}
const Msg = ({ msg }) =>
  msg ? (
    <p className={`small cs-msg${msg.bad ? ' bad' : ' good'}`} role="status">
      <b>{msg.title}</b> {msg.body}
    </p>
  ) : null;

function PasswordField({ value, onChange, label, isNew = false, onEnter }) {
  const [show, setShow] = useState(false);
  return (
    <div className="cs-pw">
      <input
        className="input"
        type={show ? 'text' : 'password'}
        autoComplete={isNew ? 'new-password' : 'off'}
        value={value}
        maxLength={BUDDY.max}
        placeholder={label}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
      <button type="button" className="link-btn small" onClick={() => setShow((v) => !v)} aria-pressed={show}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// Your own buddy and lock, at the end of the Gambling section.
function BuddyRow({ buddy, roster, me }) {
  const { mine } = buddy;
  const call = useBuddyCall(buddy.call);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [pw, setPw] = useState('');
  const others = roster.filter((n) => n !== me && n !== 'Trotbot');
  const b = first(mine?.buddy);
  if (!mine)
    return (
      <div className="cs-buddy">
        <div className="cs-buddy-head">
          <span className="cs-buddy-ic" aria-hidden="true">
            <Icon name="lock" size={16} />
          </span>
          <div className="grow">
            <b>Gambling buddy</b>
            <span className="muted small">A teammate who can lock your casino games with a password only they know.</span>
          </div>
          {!open && (
            <button className="btn small" onClick={() => setOpen(true)}>
              Add a buddy
            </button>
          )}
        </div>
        {open && (
          <div className="cs-buddy-form">
            <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Gambling buddy">
              <option value="">Pick a teammate…</option>
              {others.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="muted tiny">
              They’ll get a notification and set a password on their own phone. Until they unlock it, casino games and the lottery are off for you. Arcade
              games, gifts and loans still work.
            </p>
            <div className="row gap">
              <button className="btn" onClick={() => (setOpen(false), call.clear())}>
                Cancel
              </button>
              <button className="btn primary" disabled={!pick || call.busy} onClick={() => call.run({ action: 'ask', buddy: pick }).then((r) => r?.ok && setOpen(false))}>
                Ask {pick ? first(pick) : ''}
              </button>
            </div>
          </div>
        )}
        <Msg msg={call.msg} />
      </div>
    );
  return (
    <div className={`cs-buddy${mine.state === 'on' ? ' on' : ''}`}>
      <div className="cs-buddy-head">
        <Avatar name={mine.buddy} size={30} />
        <div className="grow">
          <b>
            {mine.state === 'on' ? `Casino games are locked by ${b}` : mine.state === 'asked' ? `Waiting for ${b}` : `${b} is your gambling buddy`}
          </b>
          <span className="muted small">
            {mine.state === 'on'
              ? `${b} can unlock them from their app, or type their password here. Arcade games, gifts and loans still work.`
              : mine.state === 'asked'
                ? `Once ${b} sets a password, your casino games lock. Nothing is locked yet.`
                : 'Casino games are unlocked. Lock them again any time; the same password unlocks them.'}
          </span>
        </div>
      </div>
      {mine.state === 'on' && (
        <div className="cs-buddy-form">
          {open ? (
            <>
              <PasswordField value={pw} onChange={setPw} label={`${b}’s password`} onEnter={() => pw && call.run({ action: 'unlock', password: pw }).then((r) => r?.ok && setPw(''))} />
              <div className="row gap">
                <button className="btn" onClick={() => (setOpen(false), setPw(''), call.clear())}>
                  Cancel
                </button>
                <button className="btn primary" disabled={!pw || call.busy} onClick={() => call.run({ action: 'unlock', password: pw }).then((r) => r?.ok && setPw(''))}>
                  Unlock
                </button>
              </div>
              <p className="muted tiny">{BUDDY.tries} tries an hour.</p>
            </>
          ) : (
            <button className="btn small" onClick={() => setOpen(true)}>
              <Icon name="lock" size={14} /> {b} is here to unlock it
            </button>
          )}
        </div>
      )}
      {mine.state === 'asked' && (
        <div className="row gap">
          <button className="btn small" disabled={call.busy} onClick={() => call.run({ action: 'cancel' })}>
            Take back the request
          </button>
        </div>
      )}
      {mine.state === 'off' && (
        <div className="row gap wrap">
          <button className="btn small primary" disabled={call.busy} onClick={() => call.run({ action: 'lock' })}>
            <Icon name="lock" size={14} /> Lock again
          </button>
          <button
            className="btn small"
            disabled={call.busy}
            onClick={async () => {
              if (await confirmDialog({ title: `Remove ${b} as your gambling buddy?`, body: 'You can add a buddy again any time.', okLabel: 'Remove' })) call.run({ action: 'remove' });
            }}
          >
            Remove buddy
          </button>
        </div>
      )}
      <Msg msg={call.msg} />
    </div>
  );
}

// People whose buddy you are (and their requests to you), at the top of Stats.
function BuddyCards({ buddy }) {
  if (!buddy.asBuddy.length) return null;
  return (
    <section className="cs-sec" aria-labelledby="cs-buddyof">
      <h3 className="cs-head" id="cs-buddyof">
        You’re a gambling buddy
      </h3>
      {buddy.asBuddy.map((l) => (
        <BuddyOf key={l.id || l.person} lock={l} call={buddy.call} />
      ))}
    </section>
  );
}

function BuddyOf({ lock, call: callFn }) {
  const call = useBuddyCall(callFn);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const p = first(lock.person);
  const person = lock.person;
  if (lock.state === 'asked') {
    const short = pw.length > 0 && pw.length < BUDDY.min;
    const differ = pw2.length > 0 && pw !== pw2;
    const set = () => !short && !differ && pw && pw === pw2 && call.run({ action: 'accept', person, password: pw });
    return (
      <div className="cs-buddy ask">
        <div className="cs-buddy-head">
          <Avatar name={person} size={30} />
          <div className="grow">
            <b>{p} asked you to be their gambling buddy</b>
            <span className="muted small">
              Set a password to lock {p}’s casino games. Keep it to yourself. You can unlock from here any time, or type it on {p}’s phone in person.
            </span>
          </div>
        </div>
        <div className="cs-buddy-form">
          <PasswordField value={pw} onChange={setPw} label="New password" isNew />
          <PasswordField value={pw2} onChange={setPw2} label="Type it again" isNew onEnter={set} />
          {short && <span className="danger small">At least {BUDDY.min} characters.</span>}
          {differ && <span className="danger small">The two don’t match.</span>}
          <div className="row gap">
            <button className="btn" disabled={call.busy} onClick={() => call.run({ action: 'decline', person })}>
              Not now
            </button>
            <button className="btn primary" disabled={call.busy || !pw || pw !== pw2 || short} onClick={set}>
              <Icon name="lock" size={14} /> Lock {p}’s casino
            </button>
          </div>
        </div>
        <Msg msg={call.msg} />
      </div>
    );
  }
  return (
    <div className={`cs-buddy${lock.state === 'on' ? ' on' : ''}`}>
      <div className="cs-buddy-head">
        <Avatar name={person} size={30} />
        <div className="grow">
          <b>{lock.state === 'on' ? `${p}’s casino games are locked` : `${p}’s casino games are unlocked`}</b>
          <span className="muted small">
            {lock.state === 'on' ? 'You can unlock them from here, no password needed.' : `${p} can lock them again; your password still unlocks them.`}
          </span>
        </div>
      </div>
      <div className="row gap wrap">
        {lock.state === 'on' && (
          <button
            className="btn small primary"
            disabled={call.busy}
            onClick={async () => {
              if (await confirmDialog({ title: `Unlock ${p}’s casino games?`, body: `${p} can play casino games again until they lock them.`, okLabel: 'Unlock' }))
                call.run({ action: 'unlock', person });
            }}
          >
            Unlock
          </button>
        )}
        <button
          className="btn small"
          disabled={call.busy}
          onClick={async () => {
            if (
              await confirmDialog({
                title: `Stop being ${p}’s gambling buddy?`,
                body: lock.state === 'on' ? `This unlocks ${p}’s casino games too.` : 'They can ask someone else.',
                okLabel: 'Step down',
              })
            )
              call.run({ action: 'leave', person });
          }}
        >
          Step down
        </button>
      </div>
      <Msg msg={call.msg} />
    </div>
  );
}

// The owner's list of every lock (Everyone tab), with Clear.
export function BuddyLocksAdmin({ locks = [], call: callFn }) {
  const call = useBuddyCall(callFn);
  if (!locks.length) return null;
  const label = { asked: 'asked', on: 'locked', off: 'unlocked' };
  return (
    <details className="cv-compare cs-admin">
      <summary>Gambling buddy locks ({locks.length})</summary>
      <ul className="cs-admin-list">
        {locks.map((l) => (
          <li key={l.id || l.person}>
            <Avatar name={l.person} size={24} />
            <span className="grow">
              <b>{l.person}</b>
              <span className="muted tiny">
                buddy {l.buddy} · {label[l.state] || l.state}
              </span>
            </span>
            <button
              className="link-btn small"
              disabled={call.busy}
              onClick={async () => {
                if (await confirmDialog({ title: `Clear ${first(l.person)}’s gambling lock?`, body: `Their casino games open again and ${first(l.buddy)} is no longer their buddy. Both are told.`, okLabel: 'Clear' }))
                  call.run({ action: 'clear', person: l.person });
              }}
            >
              Clear
            </button>
          </li>
        ))}
      </ul>
      <Msg msg={call.msg} />
    </details>
  );
}

