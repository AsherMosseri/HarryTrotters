import { useContext, useEffect, useRef, useState } from 'react';
import { Avatar, usePeople } from '../common.jsx';
import { PetRequestContext } from '../PetRequest.jsx';
import { REQUEST_STATUSES } from '../Requests.jsx';
import { confirmDialog } from '../Dialogs.jsx';
import { serverNow } from '../../serverTime.js';
import { coinText } from '../../../functions/shared/coinRequests.js';

// /request cards in chat (src/requestCommand.js).
//   kind 'idea':  a feature request someone sent; 👍 and Open read the live
//                 request (Feature requests).
//   kind 'coins': "Asher asks Cooper for 25 🪙: for pizza". Only the person
//                 asked sees Pay and Decline, only the asker Cancel. The state
//                 (open, paid, declined, cancelled, expired) is the server's
//                 (functions/coinRequests.js); a tap only asks it.
//                 With rows: a request to a group (/request @Programming 5),
//                 one card with each person's state (GroupCoins).

const first = (n) => String(n || '').split(' ')[0];
const left = (ms) => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.ceil(m / 60)} h` : `${m} min`;
};
const at = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function Idea({ c, by, Name }) {
  const ctx = useContext(PetRequestContext);
  const r = ctx?.requests?.find((x) => x.id === c.id);
  const votes = Object.keys(r?.votes || {});
  const mine = !!ctx && votes.includes(ctx.me);
  const st = r && REQUEST_STATUSES.find((s) => s.id === r.status);
  return (
    <div className="ask-card ask-idea">
      <div className="muted tiny">
        <Name name={by} /> requested a feature
      </div>
      <p className="ask-idea-text">{c.text}</p>
      {r ? (
        <div className="ask-row">
          {st && st.id !== 'new' && <span className={`request-status s-${r.status}`}>{st.label}</span>}
          <button
            className={`vote-btn${mine ? ' on' : ''}`}
            aria-pressed={mine}
            aria-label="Want this too"
            title="Want this too"
            onClick={() => ctx.voteAs(r.id, mine ? null : 'up')}
          >
            👍 {votes.length || ''}
          </button>
          <button className="link-btn small" onClick={() => ctx.openList(r.id)}>
            Open in Feature requests
          </button>
        </div>
      ) : (
        c.id && ctx?.on && <div className="muted tiny">This request was removed.</div>
      )}
    </div>
  );
}

// The server's clock, every 30 s while the request is open.
function useClock(on) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(serverNow()), 30000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

function Coins({ c, me, onAsk }) {
  // Names as they are now (a card keeps the spelling it was made with).
  const people = usePeople();
  const rn = (n) => (people?.rename ? people.rename(n || '') : n);
  const a = { ...(c.ask || {}), from: rn(c.ask?.from), to: rn(c.ask?.to) };
  const open = c.status === 'open';
  const now = useClock(open);
  const { act, busy, error } = useAct(onAsk);
  // When its 24 hours are up, ask the server to close it (it checks the time).
  useEffect(() => {
    if (!open || !a.expiresAt) return;
    const wait = a.expiresAt - serverNow();
    if (wait > 2 ** 31 - 1) return;
    const t = setTimeout(() => act('peek', true), Math.max(0, wait) + 500 + Math.random() * 1500);
    return () => clearTimeout(t);
  }, [open, a.expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = async () => {
    const ok = await confirmDialog({
      title: `Pay ${first(a.from)} ${coinText(a.amount)}?`,
      body: `${a.reason ? `“${a.reason}”\n` : ''}It comes out of your Jackson coins, like /give.`,
      okLabel: `Pay ${a.amount}`,
    });
    if (ok) act('pay');
  };
  const timeLeft = open && a.expiresAt ? left(a.expiresAt - now) : '';
  const done = {
    paid: <>✅ {me === a.to ? 'You' : first(a.to)} paid {coinText(a.amount)}{c.paidAt ? ` at ${at(c.paidAt)}` : ''}</>,
    declined: <>{me === a.to ? 'You' : first(a.to)} declined.</>,
    cancelled: <>{me === a.from ? 'You' : first(a.from)} cancelled it.</>,
    expired: <>Nobody paid in 24 hours. It closed.</>,
  }[c.status];
  return (
    <div className={`ask-card ask-coins s-${c.status}`}>
      <div className="ask-coins-line">
        <span className="ask-coins-pics" aria-hidden="true">
          <Avatar name={a.from} size={28} />
          <Avatar name={a.to} size={28} />
        </span>
        <span>
          <b>{first(a.from)}</b> asks <b>{first(a.to)}</b> for <b className="ask-amount">{coinText(a.amount)}</b>
          {a.reason ? <span className="ask-reason">: {a.reason}</span> : null}
        </span>
      </div>
      {open && me === a.to && (
        <div className="casino-buttons ask-buttons">
          <button className="btn primary" disabled={busy} onClick={pay}>
            Pay {coinText(a.amount)}
          </button>
          <button className="btn" disabled={busy} onClick={() => act('decline')}>
            Decline
          </button>
          <span className="muted tiny">{timeLeft} left</span>
        </div>
      )}
      {open && me !== a.to && (
        <div className="arc-wait">
          <span className="muted small">
            Waiting for {first(a.to)} · {timeLeft} left
          </span>
          {me === a.from && (
            <button className="link-btn small" disabled={busy} onClick={() => act('cancel')}>
              Cancel
            </button>
          )}
        </div>
      )}
      {done && <div className={`ask-done muted small${c.status === 'paid' ? ' paid' : ''}`}>{done}</div>}
      {error && <div className="casino-error">{error}</div>}
    </div>
  );
}

// Taps on a coin card: one at a time (a second tap while the first is on its
// way does nothing); quiet ones (the peek when time's up) say nothing.
function useAct(onAsk) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const going = useRef(false);
  const act = async (move, quiet = false) => {
    if (going.current && !quiet) return;
    if (!quiet) {
      going.current = true;
      setBusy(true);
    }
    try {
      const r = await onAsk(move);
      if (!quiet) setError(r?.note ? [r.note.title, r.note.body].filter(Boolean).join(' ') : '');
    } finally {
      if (!quiet) {
        going.current = false;
        setBusy(false);
      }
    }
  };
  return { act, busy, error };
}

// What each row's state looks like on a group card.
// (Waiting, cancelled and expired show by the chip's look, not a mark.)
const ROW = {
  paid: { icon: '✓', word: 'paid' },
  declined: { icon: '✕', word: 'declined' },
  open: { icon: '', word: 'waiting' },
  cancelled: { icon: '', word: 'cancelled' },
  expired: { icon: '', word: 'ran out of time' },
};
const ORDER = ['paid', 'open', 'declined', 'cancelled', 'expired'];
const CHIPS = 12; // shown before "and N more"

// /request @Programming 5 for pizza: one card for the group. A chip per
// person with their state; only your own row has Pay and Decline, only the
// asker has Cancel (it closes every row still waiting). The rows are the
// server's (functions/coinRequests.js); a tap only asks it.
function GroupCoins({ c, me, onAsk }) {
  const people = usePeople();
  const rn = (n) => (people?.rename ? people.rename(n || '') : n);
  const a = { ...(c.ask || {}), from: rn(c.ask?.from) };
  const rows = Object.entries(c.rows || {})
    .map(([key, r]) => ({ key, ...r, to: rn(r.to) }))
    .sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status) || (x.paidAt || 0) - (y.paidAt || 0));
  const count = (s) => rows.filter((r) => r.status === s).length;
  const paid = count('paid');
  const waiting = count('open');
  const declined = count('declined');
  const open = c.status === 'open' && waiting > 0;
  const now = useClock(open);
  const { act, busy, error } = useAct(onAsk);
  const [all, setAll] = useState(false);
  const mine = rows.find((r) => r.to === me);
  useEffect(() => {
    if (!open || !a.expiresAt) return;
    const wait = a.expiresAt - serverNow();
    if (wait > 2 ** 31 - 1) return;
    const t = setTimeout(() => act('peek', true), Math.max(0, wait) + 500 + Math.random() * 1500);
    return () => clearTimeout(t);
  }, [open, a.expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = async () => {
    const ok = await confirmDialog({
      title: `Pay ${first(a.from)} ${coinText(a.amount)}?`,
      body: `${a.reason ? `“${a.reason}”\n` : ''}${first(a.from)} asked ${a.label || c.group?.label || 'a group'}. It comes out of your Jackson coins, like /give.`,
      okLabel: `Pay ${a.amount}`,
    });
    if (ok) act('pay');
  };
  const timeLeft = open && a.expiresAt ? left(a.expiresAt - now) : '';
  const shown = all ? rows : rows.slice(0, CHIPS);
  const tally = [declined && `${declined} declined`, waiting && (open ? `${waiting} waiting` : `${waiting} not answered`)].filter(Boolean);
  const closedBy = !open && count('cancelled') ? `${me === a.from ? 'You' : first(a.from)} cancelled the rest.` : !open && count('expired') ? 'The rest ran out of time.' : '';
  return (
    <div className={`ask-card ask-coins ask-group s-${open ? 'open' : 'closed'}`}>
      <div className="ask-coins-line">
        <span className="ask-coins-pics" aria-hidden="true">
          <Avatar name={a.from} size={28} />
        </span>
        <span>
          <b>{first(a.from)}</b> asks <b className="grp-label">{a.label || c.group?.label}</b> for <b className="ask-amount">{coinText(a.amount)}</b> each
          {a.reason ? <span className="ask-reason">: {a.reason}</span> : null}
        </span>
      </div>
      <div className="ask-group-tally">
        <div className="ask-group-bar" role="progressbar" aria-label="Paid" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={paid}>
          <span style={{ width: `${rows.length ? (100 * paid) / rows.length : 0}%` }} />
        </div>
        <span className="small">
          <b>
            {paid} of {rows.length} paid
          </b>
          {tally.length ? <span className="muted"> · {tally.join(' · ')}</span> : null}
        </span>
      </div>
      <ul className="ask-chips" aria-label="Who was asked">
        {shown.map((r) => {
          const st = ROW[r.status] || ROW.open;
          return (
            <li key={r.key} className={`ask-chip s-${r.status}${r.to === me ? ' me' : ''}`} title={`${r.to}: ${st.word}`}>
              <Avatar name={r.to} size={20} />
              <span className="ask-chip-name">{r.to === me ? 'You' : first(r.to)}</span>
              {st.icon && (
                <span className="ask-chip-icon" aria-hidden="true">
                  {st.icon}
                </span>
              )}
              <span className="sr-only">{st.word}</span>
            </li>
          );
        })}
        {rows.length > CHIPS && (
          <li>
            <button className="link-btn small ask-chip-more" aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `and ${rows.length - CHIPS} more`}
            </button>
          </li>
        )}
      </ul>
      {mine && mine.status === 'open' && open && (
        <div className="casino-buttons ask-buttons">
          <button className="btn primary" disabled={busy} onClick={pay}>
            Pay {coinText(a.amount)}
          </button>
          <button className="btn" disabled={busy} onClick={() => act('decline')}>
            Decline
          </button>
          <span className="muted tiny">{timeLeft} left</span>
        </div>
      )}
      {mine && mine.status !== 'open' && (
        <div className={`ask-done muted small${mine.status === 'paid' ? ' paid' : ''}`}>
          {mine.status === 'paid' ? (
            <>
              ✅ You paid {coinText(a.amount)}
              {mine.paidAt ? ` at ${at(mine.paidAt)}` : ''}
            </>
          ) : mine.status === 'declined' ? (
            'You declined.'
          ) : mine.status === 'expired' ? (
            'Yours ran out of time.'
          ) : (
            `${first(a.from)} cancelled yours.`
          )}
        </div>
      )}
      {open && (!mine || mine.status !== 'open') && (
        <div className="arc-wait">
          <span className="muted small">
            Waiting for {waiting} · {timeLeft} left
          </span>
          {me === a.from && (
            <button className="link-btn small" disabled={busy} onClick={() => act('cancel')}>
              Cancel
            </button>
          )}
        </div>
      )}
      {!open && <div className="ask-done muted small">Closed. {closedBy}</div>}
      {error && <div className="casino-error">{error}</div>}
    </div>
  );
}

export function AskBody({ m, me, Name, onAsk }) {
  const c = m.cmd;
  if (c.kind === 'idea') return <Idea c={c} by={m.by} Name={Name} />;
  return c.rows ? <GroupCoins c={c} me={me} onAsk={onAsk} /> : <Coins c={c} me={me} onAsk={onAsk} />;
}
