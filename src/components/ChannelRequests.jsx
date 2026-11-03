import { useMemo, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { Avatar, CloseIcon, Overlay } from './common.jsx';
import { promptDialog } from './Dialogs.jsx';
import { firstName, isTouch, relTime, useEscape } from '../util.js';
import {
  MAX_INVITEES,
  MAX_OPEN,
  MAX_PER_DAY,
  NAME_MAX,
  PURPOSE_MAX,
  channelNameOk,
  cleanChannelName,
  finalChannelName,
  takenNames,
} from '../../functions/shared/channels.js';

// Asking for a channel (anyone), and team management's list of what's waiting.
// Rules and shapes: functions/shared/channels.js. The people who write to the
// database is the channelRequest function (or the demo store).

// Pick people: a search box, who's picked as chips, and a list with pictures.
export function PeoplePicker({ names, value, onChange, max = MAX_INVITEES }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return names.filter((n) => !k || n.toLowerCase().includes(k));
  }, [names, q]);
  const full = value.length >= max;
  const toggle = (n) => onChange(value.includes(n) ? value.filter((x) => x !== n) : full ? value : [...value, n]);
  return (
    <div className="cr-picker">
      {value.length > 0 && (
        <div className="cr-chips" aria-label="Invited">
          {value.map((n) => (
            <span key={n} className="cr-chip">
              <Avatar name={n} size={20} />
              {firstName(n)}
              <button type="button" onClick={() => toggle(n)} aria-label={`Remove ${n}`}>
                <CloseIcon />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people"
        aria-label="Search people"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
      <div className="cr-people" role="group" aria-label="People">
        {shown.map((n) => {
          const on = value.includes(n);
          return (
            <button
              type="button"
              key={n}
              className={`cr-person${on ? ' on' : ''}`}
              role="checkbox"
              aria-checked={on}
              disabled={!on && full}
              onClick={() => toggle(n)}
            >
              <Avatar name={n} size={26} />
              <span className="grow">{n}</span>
              {on && <Icon name="check" size={16} />}
            </button>
          );
        })}
        {!shown.length && <p className="muted small cr-none">Nobody matches “{q}”.</p>}
      </div>
      <p className="muted tiny cr-count">
        <span className="mono">{value.length}</span> of <span className="mono">{max}</span> picked
      </p>
    </div>
  );
}

// The name box: shows # in front and cleans what you type (lowercase letters,
// numbers, dashes).
function NameInput({ id, value, onChange, autoFocus }) {
  return (
    <div className="cr-name">
      <span aria-hidden="true">#</span>
      <input
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(cleanChannelName(e.target.value))}
        maxLength={NAME_MAX}
        placeholder="build-log"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        autoFocus={autoFocus && !isTouch}
      />
    </div>
  );
}

// What a name box says about the name so far: { error } or { ok }.
function nameState(name, taken) {
  const n = finalChannelName(name);
  if (!n) return {};
  if (!channelNameOk(n)) return { error: n.length < 2 ? 'At least 2 characters.' : 'Letters, numbers, and single dashes.' };
  const why = taken.get(n);
  if (why === 'exists') return { error: `There’s already a #${n}.` };
  if (why === 'pending') return { error: `Someone already asked for #${n}.` };
  return { ok: `Shows as #${n}` };
}

const STATUS = { pending: 'Waiting', approved: 'Approved', declined: 'Not now' };

// The person's own requests under the form: waiting ones (with Cancel) and the
// last few answers.
function MyRequests({ requests, onCancel }) {
  const [busy, setBusy] = useState('');
  const list = [
    ...requests.filter((r) => r.status === 'pending'),
    ...requests.filter((r) => r.status === 'approved' || r.status === 'declined').sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)).slice(0, 3),
  ];
  if (!list.length) return null;
  return (
    <section className="cr-mine" aria-label="Your requests">
      <h3 className="cr-sec">Your requests</h3>
      <ul>
        {list.map((r) => (
          <li key={r.id} className={`cr-mine-row ${r.status}`}>
            <span className="grow">
              <b>#{r.name}</b>
              <span className="muted small block">{r.status === 'declined' && r.note ? `“${r.note}”` : r.purpose}</span>
            </span>
            <span className={`cr-status ${r.status}`}>{r.kind === 'private' && r.status === 'pending' ? 'Private · ' : ''}{STATUS[r.status]}</span>
            {r.status === 'pending' && (
              <button
                className="btn small-btn"
                disabled={busy === r.id}
                onClick={async () => {
                  setBusy(r.id);
                  await onCancel(r.id);
                  setBusy('');
                }}
              >
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Anyone: ask for a channel. onSend resolves { error } or {}.
export function RequestChannelDialog({ roster, actor, channels, requests, onSend, onCancel, onClose }) {
  useEscape(onClose);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [kind, setKind] = useState('public');
  const [invitees, setInvitees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const taken = useMemo(() => takenNames({ channels: channels.map((c) => ({ id: c.id, name: c.name })), requests }), [channels, requests]);
  const ns = nameState(name, taken);
  const final = finalChannelName(name);
  const people = useMemo(() => roster.filter((n) => n !== actor.name), [roster, actor.name]);
  const waiting = requests.filter((r) => r.status === 'pending').length;
  const ready = !!ns.ok && purpose.trim().length > 0 && purpose.length <= PURPOSE_MAX && (kind === 'public' || invitees.length > 0);
  const send = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const res = await onSend({ name: final, purpose: purpose.trim(), kind, invitees: kind === 'private' ? invitees : [] });
    setBusy(false);
    if (res?.error) return setError(res.error);
    setSent(final);
    setName('');
    setPurpose('');
    setKind('public');
    setInvitees([]);
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form className="dialog cr-dialog" onClick={(e) => e.stopPropagation()} onSubmit={send} aria-label="Request a channel">
          <div className="panel-head">
            <h2>Request a channel</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small cr-lead">
            Team management reviews every request. You can have <span className="mono">{MAX_OPEN}</span> waiting at once and send up to{' '}
            <span className="mono">{MAX_PER_DAY}</span> a day.
          </p>
          {sent && (
            <p className="cr-sent" role="status">
              <Icon name="check" size={16} /> Sent. Team management will look at #{sent}.
            </p>
          )}
          <label className="field-label" htmlFor="cr-name">
            Name
          </label>
          <NameInput id="cr-name" value={name} onChange={(v) => (setSent(''), setName(v))} autoFocus />
          {ns.error ? <p className="form-error cr-hint">{ns.error}</p> : <p className="muted small cr-hint">{ns.ok || 'Lowercase letters, numbers, and dashes, like build-log.'}</p>}
          <label className="field-label" htmlFor="cr-purpose">
            What is it for?
          </label>
          <input
            id="cr-purpose"
            className="input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={PURPOSE_MAX}
            placeholder="Photos of what we built each day"
          />
          <p className="muted tiny cr-hint cr-count">
            <span className="mono">{purpose.length}</span>/<span className="mono">{PURPOSE_MAX}</span>
          </p>
          <span className="field-label" id="cr-who">
            Who can see it
          </span>
          <div className="cr-kinds" role="radiogroup" aria-labelledby="cr-who">
            <button type="button" role="radio" aria-checked={kind === 'public'} className={`cr-kind${kind === 'public' ? ' on' : ''}`} onClick={() => setKind('public')}>
              <Icon name="hash" size={18} />
              <span>
                <b>Everyone</b>
                <small>The whole team can read and join in</small>
              </span>
            </button>
            <button type="button" role="radio" aria-checked={kind === 'private'} className={`cr-kind${kind === 'private' ? ' on' : ''}`} onClick={() => setKind('private')}>
              <Icon name="lock" size={18} />
              <span>
                <b>Private</b>
                <small>Only people I invite</small>
              </span>
            </button>
          </div>
          {kind === 'private' && <PeoplePicker names={people} value={invitees} onChange={setInvitees} />}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="row gap">
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>
              Close
            </button>
            <button className="btn primary" disabled={!ready || busy || waiting >= MAX_OPEN}>
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
          {waiting >= MAX_OPEN && <p className="muted small">You have {MAX_OPEN} waiting. Cancel one below to ask for another.</p>}
          <MyRequests requests={requests} onCancel={onCancel} />
        </form>
      </div>
    </Overlay>
  );
}

// One waiting request, for team management: Approve, edit then approve, Decline.
function RequestCard({ r, roster, taken, onDecide }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [invitees, setInvitees] = useState(r.invitees || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const people = useMemo(() => roster.filter((n) => n !== r.by), [roster, r.by]);
  const ns = nameState(name, taken);
  const run = async (decision) => {
    setBusy(true);
    setError('');
    const res = await onDecide(r, decision);
    setBusy(false);
    if (res?.error) setError(res.error);
  };
  const decline = async () => {
    const note = await promptDialog({
      title: `Decline #${r.name}?`,
      body: `${firstName(r.by)} gets a note in their notifications.`,
      label: 'Note (optional)',
      placeholder: 'Why not, or what to do instead',
      okLabel: 'Decline',
      maxLength: 120,
    });
    if (note !== null) run({ decline: true, note });
  };
  const editReady = !!ns.ok && (r.kind === 'public' || invitees.length > 0);
  return (
    <li className="cr-card">
      <div className="cr-card-head">
        <Avatar name={r.by} size={32} />
        <span className="grow">
          <b>{r.by}</b>
          <span className="muted small block mono">{relTime(r.at)}</span>
        </span>
        <span className={`cr-kind-tag ${r.kind}`}>
          <Icon name={r.kind === 'private' ? 'lock' : 'hash'} size={14} />
          {r.kind === 'private' ? 'Private' : 'Everyone'}
        </span>
      </div>
      <h3 className="cr-card-name">#{r.name}</h3>
      <p className="cr-card-purpose">{r.purpose}</p>
      {r.kind === 'private' && (
        <p className="cr-invited small muted">
          Invited ({(r.invitees || []).length}): {(r.invitees || []).join(', ')}
        </p>
      )}
      {editing && (
        <div className="cr-edit">
          <label className="field-label" htmlFor={`cr-edit-${r.id}`}>
            Name
          </label>
          <NameInput id={`cr-edit-${r.id}`} value={name} onChange={setName} autoFocus />
          {ns.error ? <p className="form-error cr-hint">{ns.error}</p> : <p className="muted small cr-hint">{ns.ok}</p>}
          {r.kind === 'private' && (
            <>
              <span className="field-label">Who’s invited</span>
              <PeoplePicker names={people} value={invitees} onChange={setInvitees} />
            </>
          )}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="cr-actions">
        {editing ? (
          <>
            <button className="btn" disabled={busy} onClick={() => setEditing(false)}>
              Back
            </button>
            <span className="spacer" />
            <button className="btn primary" disabled={busy || !editReady} onClick={() => run({ approve: true, name: finalChannelName(name), invitees })}>
              {busy ? 'Approving…' : 'Approve with changes'}
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" disabled={busy} onClick={() => run({ approve: true })}>
              {busy ? 'Approving…' : 'Approve'}
            </button>
            <button className="btn" disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </button>
            <span className="spacer" />
            <button className="btn" disabled={busy} onClick={decline}>
              Decline
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// Team management: what's waiting. onDecide(request, decision) resolves { error } or {}.
export function ChannelRequestsDialog({ requests, roster, channels, onDecide, onNewChannel, onClose }) {
  useEscape(onClose);
  const waiting = requests.filter((r) => r.status === 'pending');
  const taken = useMemo(() => takenNames({ channels: channels.map((c) => ({ id: c.id, name: c.name })) }), [channels]);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog cr-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Channel requests">
          <div className="panel-head">
            <h2>
              Channel requests{' '}
              {waiting.length > 0 && <span className="cr-num mono">{waiting.length}</span>}
            </h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {waiting.length ? (
            <ul className="cr-list">
              {waiting.map((r) => (
                <RequestCard key={r.id} r={r} roster={roster} taken={taken} onDecide={onDecide} />
              ))}
            </ul>
          ) : (
            <p className="muted cr-empty">No requests waiting.</p>
          )}
          <div className="row gap">
            <span className="spacer" />
            <button className="btn" onClick={onNewChannel}>
              <Icon name="plus" size={16} /> New channel
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
