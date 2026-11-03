import { useState } from 'react';
import { MAX_BET } from '../../../functions/shared/challenge.js';
import { BOT } from '../../../functions/shared/arcade.js';
import { usePeople } from '../common.jsx';
import { Icon } from '../shell/icons.jsx';
import { reportInfo } from '../Disputes.jsx';

// Two small actions under a finished casino card: dare someone to the same
// coin flip or dice roll ("Challenge someone", functions/shared/challenge.js),
// and report the result to team management ("Report", Disputes.jsx). Money
// is only ever moved by the server.

// Coin flip and dice are the games that can be played head to head.
const DARES = ['coinflip', 'dice'];

export function CardActions({ m, me, onChallenge, onReport }) {
  const people = usePeople();
  const [asking, setAsking] = useState(false);
  const c = m.cmd;
  const rename = people?.rename;
  const done = typeof c.net === 'number';
  const info = reportInfo(m, me, rename);
  const mine = (rename ? rename(m.by) : m.by) === me;
  const canDare = DARES.includes(c.name) && mine && done && !!onChallenge;
  if (!(canDare || (info && onReport && (done || c.status === 'done')))) return null;
  return (
    <div className="card-actions">
      <div className="card-actions-row">
        {canDare && (
          <button className="link-btn small" aria-expanded={asking} onClick={() => setAsking((v) => !v)}>
            <Icon name="swap" size={15} /> Challenge someone
          </button>
        )}
        {info && onReport && (
          <button className="link-btn small card-report" onClick={onReport} title="Something look wrong? Tell team management">
            <Icon name="flag" size={15} /> Report
          </button>
        )}
      </div>
      {asking && canDare && <Dare c={c} me={me} roster={people?.roster || []} onChallenge={onChallenge} onDone={() => setAsking(false)} />}
    </div>
  );
}

// Who, and how much (the card's bet to start with; the server holds the
// bet and checks everything).
function Dare({ c, me, roster, onChallenge, onDone }) {
  const others = roster.filter((n) => n !== me && n !== BOT);
  const [who, setWho] = useState('');
  const [bet, setBet] = useState(String(Math.max(1, Math.min(MAX_BET, c.bet || 1))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = Math.floor(Number(bet));
  const send = async () => {
    setBusy(true);
    setError('');
    const call = c.name === 'coinflip' ? [c.game.call] : [];
    const r = await onChallenge([...who.split(' '), c.name, String(n), ...call]);
    setBusy(false);
    if (r?.note) setError([r.note.title, r.note.body].filter(Boolean).join(' '));
    else onDone();
  };
  return (
    <div className="dare">
      <div className="muted small">
        Same {c.name === 'coinflip' ? 'coin flip' : 'dice roll'}, head to head.{' '}
        {c.name === 'coinflip' ? `You call ${c.game.call}. ` : 'Higher roll wins. '}
        Winner takes both bets.
      </div>
      <div className="dare-row">
        <select className="input" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Challenge who">
          <option value="">Pick a teammate…</option>
          {others.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <input
          className="input dare-bet mono"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_BET}
          value={bet}
          onChange={(e) => setBet(e.target.value)}
          aria-label="Bet in coins"
        />
        <button className="btn primary" disabled={!who || !(n >= 1) || n > MAX_BET || busy} onClick={send}>
          Send
        </button>
      </div>
      {error && <div className="casino-error">{error}</div>}
    </div>
  );
}
