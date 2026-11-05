import { useState } from 'react';
import { DISPUTABLE, GAME_LABEL, LIMITS, REASONS, cardLoss, reportProblem } from '../../functions/shared/disputes.js';
import { relTime, useEscape } from '../util.js';
import { Avatar, CloseIcon, Overlay } from './common.jsx';
import { alertDialog, confirmDialog } from './Dialogs.jsx';
import { Icon } from './shell/icons.jsx';
import { REQUESTS_TO } from '../config.js';
import { CoinNum, useCoinFormat } from './CoinNum.jsx';
import { coinStyled, withExact } from '../coinFormat.js';

// Casino reports. Someone says a result looks wrong; the owner (Asher, the
// same person feature requests go to) looks at it and refunds by hand, or
// keeps the result. Other team managers don't get them. Nothing is refunded
// by itself. The checks and the money are on the server (functions/disputes.js).

export { DISPUTABLE, reportProblem };

const first = (n) => (n || '').split(' ')[0];
// Who handles reports, by first name ("Asher").
export const REPORTS_TO = first(REQUESTS_TO);
const WHEN = (ms) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Can I report this message, and what does the card say I lost?
export function reportInfo(m, me, rename) {
  if (!m?.cmd) return null;
  const problem = reportProblem(m, me, rename);
  if (problem) return null;
  return { game: m.cmd.name, ...cardLoss(m.cmd, me, rename) };
}

// `n` writes the refund in this device's coin style (exact with commas by default).
export function statusText(x, n = exactCoins) {
  return x.status === 'refunded'
    ? `Refunded ${n(x.refund)} coins`
    : x.status === 'dismissed'
      ? 'Kept as it was'
      : `Waiting for ${REPORTS_TO}`;
}

// "What looks wrong?": a reason, and an optional note.
export function ReportDialog({ m, conv, api, onClose }) {
  useEscape(onClose);
  const [reason, setReason] = useState('unfair');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const send = async () => {
    setBusy(true);
    setError('');
    const r = await api.dispute({ conv, msgId: m.id, reason, note: text.trim() });
    setBusy(false);
    if (r?.ok) setSent(true);
    else setError(r?.note ? [r.note.title, r.note.body].filter(Boolean).join(' ') : 'That didn’t go through.');
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog report-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Report a casino result">
          <div className="panel-head">
            <h2>
              <Icon name="flag" size={20} /> What looks wrong?
            </h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {sent ? (
            <div className="report-sent">
              <div className="ad-pop coins-sent-ic" aria-hidden="true">
                ✓
              </div>
              <h3>Sent to {REPORTS_TO}</h3>
              <p className="muted small">
                {REPORTS_TO} will look at it and let you know. You can follow it under Jackson coins, Reports.
              </p>
              <button className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="muted small report-about">
                {GAME_LABEL[m.cmd.name]} · {WHEN(m.at)}. Only {REPORTS_TO} sees it, and nothing changes until he looks.
              </p>
              <div className="report-reasons" role="radiogroup" aria-label="What looks wrong?">
                {Object.entries(REASONS).map(([id, label]) => (
                  <label key={id} className={`report-reason${reason === id ? ' on' : ''}`}>
                    <input type="radio" name="report-reason" checked={reason === id} onChange={() => setReason(id)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="field-label" htmlFor="report-note">
                Anything else? <span className="muted">(optional)</span>
              </label>
              <textarea
                id="report-note"
                className="input report-note"
                rows={3}
                maxLength={LIMITS.note}
                value={text}
                placeholder="What happened?"
                onChange={(e) => setText(e.target.value)}
              />
              <div className="muted tiny mono report-count">
                {text.length}/{LIMITS.note}
              </div>
              {error && <div className="casino-error">{error}</div>}
              <div className="row gap report-actions">
                <span className="spacer" />
                <button className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn primary" disabled={busy} onClick={send}>
                  Send report
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// Your own reports and what happened to them (a tab in the coins screen).
export function MyReports({ list }) {
  const f = useCoinFormat();
  if (!list.length) return <p className="muted">Nothing reported. If a casino result looks wrong, use the flag on it in chat.</p>;
  return (
    <ul className="coins-history report-list">
      {list.map((x) => (
        <li key={x.id}>
          <span className="coins-icon" aria-hidden="true">
            <Icon name="flag" size={16} />
          </span>
          <span className="grow">
            <span className="coins-label">{GAME_LABEL[x.cmd] || 'Casino'} result</span>
            <span className="muted tiny">
              {relTime(x.at)} · {REASONS[x.reason]}
            </span>
            {x.resolutionNote && <span className="muted tiny">“{x.resolutionNote}”</span>}
          </span>
          <span className={`report-status ${x.status}`}>{statusText(x, f.n)}</span>
        </li>
      ))}
    </ul>
  );
}

// The owner: reports waiting, and the ones already handled.
export function DisputesDialog({ list, api, wallet, onToast, onClose }) {
  useEscape(onClose);
  const [tab, setTab] = useState('open');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const allOpen = list.filter((x) => x.status === 'open');
  // Who has reports waiting, most first, for the picker.
  const people = [...allOpen.reduce((m, x) => m.set(x.by, (m.get(x.by) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const person = people.some(([n]) => n === who) ? who : '';
  const open = person ? allOpen.filter((x) => x.by === person) : allOpen;
  const shown = tab === 'open' ? open : list.filter((x) => x.status !== 'open');
  // Refund all: every waiting report shown (everyone's, or one person's). The
  // server checks each one like its own Refund button and skips any it can't.
  const refundAll = async () => {
    const n = open.length;
    const known = open.reduce((t, x) => t + (x.snapshot?.final ? x.snapshot.loss || 0 : 0), 0);
    const unsure = open.some((x) => !x.snapshot?.final);
    const ok = await confirmDialog({
      title: `Refund ${n === 1 ? 'this report' : `all ${n} reports`}${person ? ` from ${first(person)}` : ''}?`,
      body: withExact(`${unsure ? 'At least' : 'About'} ${coinStyled(known)} coins: each one pays back what its result shows they lost, once, checked like its own Refund button. Any already put right from their card are closed; any that can’t be refunded stay waiting. It can’t be undone.`, known),
      okLabel: n === 1 ? 'Refund' : `Refund ${n}`,
    });
    if (!ok) return;
    setBusy(true);
    const r = await api.disputeRefundAll({ ...(person && { person }) });
    setBusy(false);
    if (!r?.ok) {
      await alertDialog({ title: r?.note?.title || 'That didn’t go through.', body: r?.note?.body || '' });
      return;
    }
    const parts = [
      r.refunded && `Refunded ${r.refunded} report${r.refunded === 1 ? '' : 's'}: ${coinStyled(r.coins)} coins.`,
      r.closed && `Closed ${r.closed} already put right.`,
    ].filter(Boolean);
    if (parts.length) onToast?.(parts.join(' '));
    if (r.skipped?.length)
      await alertDialog({
        title: `${r.skipped.length} stayed waiting`,
        body: r.skipped
          .slice(0, 12)
          .map((x) => `${first(x.by)}, ${GAME_LABEL[x.game] || 'Casino'}: ${x.why}`)
          .join('\n') + (r.skipped.length > 12 ? `\n…and ${r.skipped.length - 12} more.` : ''),
      });
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog disputes-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Casino reports">
          <div className="panel-head">
            <h2>
              <Icon name="flag" size={20} /> Casino reports
            </h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="segmented coins-tabs" role="tablist">
            {[
              ['open', `Waiting (${allOpen.length})`],
              ['done', 'Handled'],
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
          {tab === 'open' && allOpen.length > 0 && (
            <div className="row gap wrap disputes-bulk">
              {people.length > 1 && (
                <select className="input disputes-who" value={person} aria-label="Whose reports" onChange={(e) => setWho(e.target.value)}>
                  <option value="">Everyone ({allOpen.length})</option>
                  {people.map(([n, c]) => (
                    <option key={n} value={n}>
                      {n} ({c})
                    </option>
                  ))}
                </select>
              )}
              <button className="btn" disabled={busy || !open.length} onClick={refundAll}>
                {busy ? 'Refunding…' : open.length === 1 ? 'Refund it' : `Refund all ${open.length}`}
              </button>
            </div>
          )}
          <div className="coins-body disputes-body">
            {shown.length === 0 && (
              <p className="muted">{tab === 'open' ? 'Nothing waiting. Reports show up here.' : 'Nothing handled yet.'}</p>
            )}
            {shown.map((x) => (
              <Report key={x.id} x={x} api={api} wallet={wallet} onToast={onToast} />
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Report({ x, api, wallet, onToast }) {
  const f = useCoinFormat();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = x.snapshot || {};
  const waiting = x.status === 'open';
  // Their coins around then: what the card says, and what their history shows.
  const near = wallet(x.by)
    .history.filter((h) => Math.abs(h.at - (s.cardAt || x.at)) <= 2 * 3600000)
    .slice(0, 6);
  const decide = async (decision) => {
    if (decision === 'refund') {
      const ok = await confirmDialog({
        title: `Refund ${s.final ? coinStyled(s.loss) : 'the loss'} coins to ${first(x.by)}?`,
        body: withExact('It pays back what the result shows they lost, once. It can’t be undone.', s.final ? s.loss : 0),
        okLabel: 'Refund',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError('');
    const r = await api.disputeDecide({ id: x.id, decision, note: text.trim() });
    setBusy(false);
    if (r?.ok) onToast?.(decision === 'refund' ? `Refunded ${coinStyled(r.refund)} coins to ${first(x.by)}.` : 'Kept as it was.');
    else setError(r?.note ? [r.note.title, r.note.body].filter(Boolean).join(' ') : 'That didn’t go through.');
  };
  return (
    <article className={`report-card ${x.status}`}>
      <header className="report-head">
        <Avatar name={x.by} size={28} />
        <span className="grow">
          <b>{x.by}</b>
          <span className="muted tiny">
            {GAME_LABEL[x.cmd] || 'Casino'} · reported {relTime(x.at)}
          </span>
        </span>
        {!waiting && <span className={`report-status ${x.status}`}>{statusText(x, f.n)}</span>}
      </header>
      <div className="report-reason-line">{REASONS[x.reason]}</div>
      {x.note && <blockquote className="report-quote">{x.note}</blockquote>}
      <dl className="report-facts">
        <div>
          <dt>The card</dt>
          <dd>{s.text || '(nothing kept)'}</dd>
        </div>
        <div>
          <dt>Bet</dt>
          <dd className="mono" title={f.title(s.bet)}>{s.bet == null ? '' : f.n(s.bet)}</dd>
        </div>
        <div>
          <dt>Shows they lost</dt>
          <dd className="mono">{s.final ? (s.loss ? f.n(s.loss) : '0 (not a loss)') : 'not finished'}</dd>
        </div>
        <div>
          <dt>Played</dt>
          <dd className="mono">{WHEN(s.cardAt || x.at)}</dd>
        </div>
      </dl>
      <div className="muted tiny report-sec">Their coins around then</div>
      {near.length ? (
        <ul className="report-history">
          {near.map((h, i) => (
            <li key={`${h.kind}-${h.at}-${i}`}>
              <span aria-hidden="true">{h.icon}</span>
              <span className="grow">{f.label(h.label)}</span>
              <span className="muted tiny mono">{WHEN(h.at)}</span>
              <CoinNum as="b" signed n={h.amount} className={`mono ${h.amount < 0 ? 'coins-minus' : 'coins-plus'}`} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="muted small">Nothing in their history near that time.</div>
      )}
      {waiting ? (
        <>
          <input
            className="input"
            maxLength={LIMITS.resolution}
            value={text}
            placeholder="A short note for them (optional)"
            aria-label="Note for them"
            onChange={(e) => setText(e.target.value)}
          />
          {error && <div className="casino-error">{error}</div>}
          <div className="row gap wrap report-buttons">
            <button className="btn primary" disabled={busy} onClick={() => decide('refund')}>
              Refund the bet{s.final && s.loss ? ` (${coinStyled(s.loss)})` : ''}
            </button>
            <button className="btn" disabled={busy} onClick={() => decide('dismiss')}>
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <div className="muted small">
          {first(x.handledBy)} · {relTime(x.handledAt)}
          {x.resolutionNote ? ` · “${x.resolutionNote}”` : ''}
        </div>
      )}
    </article>
  );
}
