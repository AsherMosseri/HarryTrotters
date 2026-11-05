import { useState } from 'react';
import { MAX_BET } from '../../../functions/shared/challenge.js';
import { BOT } from '../../../functions/shared/arcade.js';
import { adjustOf, cardNets, fixEntry, gameLabel } from '../../../functions/shared/disputes.js';
import { usePeople } from '../common.jsx';
import { Icon } from '../shell/icons.jsx';
import { confirmDialog } from '../Dialogs.jsx';
import { REPORTS_TO, reportInfo } from '../Disputes.jsx';

// Small actions under a finished game card: dare someone to the same coin
// flip or dice roll ("Challenge someone", functions/shared/challenge.js),
// report the result to the owner ("Report", Disputes.jsx), and, for the owner
// (Asher) only, Refund a loss or Take back a win for each person in the game
// (functions/disputes.js ownerRefund). Everyone sees the "Refunded by Asher"
// tag the server puts on the card. Money is only ever moved by the server.

// Coin flip and dice are the games that can be played head to head.
const DARES = ['coinflip', 'dice'];
const commas = (n) => Math.abs(n).toLocaleString('en-US');
const first = (n) => (n || '').split(' ')[0];

export function CardActions({ m, me, onChallenge, onReport, onFix }) {
  const people = usePeople();
  const [asking, setAsking] = useState(false);
  const c = m.cmd;
  const rename = people?.rename;
  const done = typeof c.net === 'number';
  const info = reportInfo(m, me, rename);
  const mine = (rename ? rename(m.by) : m.by) === me;
  const canDare = DARES.includes(c.name) && mine && done && !!onChallenge;
  const canReport = !!(info && onReport && (done || c.status === 'done'));
  // Each person's result, and whether it was put right already.
  const { final, nets } = cardNets(c, m.by, rename);
  const multi = nets.length > 1;
  const rows = nets.map((x) => ({ ...x, tag: adjustOf(c, x.name) }));
  const tags = rows.filter((x) => x.tag);
  const fixes = onFix && final ? rows.filter((x) => !x.tag && x.net) : [];
  if (!(canDare || canReport || tags.length || fixes.length)) return null;
  return (
    <div className="card-actions">
      {tags.length > 0 && (
        <div className="card-fixed">
          {tags.map((x) => (
            <span key={x.name} className={`card-fixed-tag ${x.tag.mode}`} title={`${x.tag.mode === 'takeback' ? '−' : '+'}${commas(x.tag.amount || 0)} coins`}>
              <Icon name="rotateCcw" size={13} />
              {multi ? `${first(x.name)}: ` : ''}
              {multi ? (x.tag.mode === 'takeback' ? 'taken back' : 'refunded') : x.tag.mode === 'takeback' ? 'Taken back' : 'Refunded'} by {first(x.tag.by)}
            </span>
          ))}
        </div>
      )}
      {(canDare || canReport || fixes.length > 0) && (
        <div className="card-actions-row">
          {canDare && (
            <button className="link-btn small" aria-expanded={asking} onClick={() => setAsking((v) => !v)}>
              <Icon name="swap" size={15} /> Challenge someone
            </button>
          )}
          {fixes.map((x) => (
            <FixButton key={x.name} c={c} row={x} multi={multi} me={me} onFix={onFix} />
          ))}
          {canReport && (
            <button className="link-btn small card-report" onClick={onReport} title={`Report this result to ${REPORTS_TO}`}>
              <Icon name="flag" size={15} /> Report
            </button>
          )}
        </div>
      )}
      {asking && canDare && <Dare c={c} me={me} roster={people?.roster || []} onChallenge={onChallenge} onDone={() => setAsking(false)} />}
    </div>
  );
}

// The owner's Refund (a loss) or Take back (a win) for one person, after a
// confirm that says who, which game, exactly how much, and what happens.
function FixButton({ c, row, multi, me, onFix }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refund = row.net < 0;
  const n = commas(row.net);
  const game = gameLabel(c.name);
  const who = row.name === me ? 'you' : first(row.name);
  const go = async () => {
    if (busy) return;
    setError('');
    const line = fixEntry({ person: row.name, mode: refund ? 'refund' : 'takeback', amount: Math.abs(row.net), game: c.name, by: me }).label;
    const ok = await confirmDialog({
      title: refund ? `Refund ${n} coins to ${who === 'you' ? 'yourself' : who}?` : `Take back ${n} coins from ${who}?`,
      body: (
        <>
          <b>{row.name}</b> {refund ? 'lost' : 'won'} <b>{n}</b> at {game}.{' '}
          {refund ? `${n} coins go back to them` : `${n} coins come off their balance`}, once, as “{line}” in their coin history
          {row.name === me ? '' : ', and they’re told'}. The card will say “{refund ? 'Refunded' : 'Taken back'} by {first(me)}”.
          {!refund && ' If they’ve spent it, their balance can go below zero.'}
        </>
      ),
      okLabel: refund ? `Refund ${n}` : `Take back ${n}`,
      danger: !refund,
    });
    if (!ok) return;
    setBusy(true);
    const r = await onFix(row.name, refund ? 'refund' : 'takeback');
    setBusy(false);
    if (!r?.ok) setError(r?.note ? [r.note.title, r.note.body].filter(Boolean).join(' ') : 'That didn’t go through.');
  };
  return (
    <>
      <button className={`link-btn small card-fix ${refund ? 'refund' : 'takeback'}`} onClick={go} disabled={busy} title={`${refund ? 'Refund' : 'Take back'} ${n} coins (${row.name})`}>
        <Icon name="rotateCcw" size={15} /> {busy ? '…' : `${refund ? 'Refund' : 'Take back'}${multi ? ` ${first(row.name)}` : ''}`}
      </button>
      {error && (
        <span className="casino-error card-fix-error" role="status">
          {error}
        </span>
      )}
    </>
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
