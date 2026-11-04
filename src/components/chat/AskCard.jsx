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

export function AskBody({ m, me, Name, onAsk }) {
  const c = m.cmd;
  return c.kind === 'idea' ? <Idea c={c} by={m.by} Name={Name} /> : <Coins c={c} me={me} onAsk={onAsk} />;
}
