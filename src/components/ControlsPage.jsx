import { useEffect, useState } from 'react';
import { relTime } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';
import { Switch } from './Ads.jsx';
import { FEATURE_GROUPS, LAB_LOG_MODES, offCount } from '../controls.js';
import { useEscape } from '../util.js';

// Asher's Controls (controls.js): turn tabs, channels, and features off for
// everyone but him, preview what they see, and get to Shutdown and Commands.
export default function ControlsPage({
  doc = {},
  views,
  channels,
  people,
  shutdown,
  commandsOff,
  covered,
  onSave,
  onPreview,
  onShutdown,
  onCommands,
  onAds,
  account,
  me,
  onClose,
}) {
  // Shutdown or Commands open on top: Escape closes that one, not this.
  useEscape(onClose, !covered);
  const [tab, setTab] = useState('features');
  const [as, setAs] = useState('');
  const list = (key) => doc[key] || [];
  // Turn ids on or off in one of the lists (off, tabsOff, channelsOff).
  const set = (key, ids, on) => {
    const cur = list(key);
    onSave({ [key]: on ? cur.filter((x) => !ids.includes(x)) : [...new Set([...cur, ...ids])] });
  };
  const n = offCount(doc);
  const row = (key, id, title, hint) => (
    <div key={id} className={`cmd-admin-row${list(key).includes(id) ? ' off' : ''}`}>
      <b className="ctl-title">{title}</b>
      {hint && <span className="muted small grow">{hint}</span>}
      {!hint && <span className="grow" />}
      <Switch checked={!list(key).includes(id)} onChange={(v) => set(key, [id], v)} label={`${title} on`} />
    </div>
  );
  const group = (key, label, items) => {
    const ids = items.map(([id]) => id);
    const allOn = ids.every((id) => !list(key).includes(id));
    return (
      <section key={label} className="cmd-admin-group">
        <div className="cmd-admin-head">
          <h4>{label}</h4>
          <span className="spacer" />
          <button className="link-btn small" onClick={() => set(key, ids, !allOn)}>
            {allOn ? 'Turn all off' : 'Turn all on'}
          </button>
        </div>
        {items.map(([id, title, hint]) => row(key, id, title, hint))}
      </section>
    );
  };

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog ads-settings controls-page" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Controls">
          <div className="panel-head">
            <h2>Controls</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="ads-pause">
            <div className="grow">
              <b>{n ? `${n} ${n === 1 ? 'thing' : 'things'} off for everyone but you` : 'Everything is on'}</b>
              <span className="muted small">Changes apply right away. Off means hidden everywhere; nothing is deleted.</span>
            </div>
          </div>
          <div className="ctl-quick">
            <button className={`btn${shutdown?.on ? ' danger' : ''}`} onClick={onShutdown}>
              Shutdown{shutdown?.on ? ': ON' : ''}
            </button>
            <button className="btn" onClick={onCommands}>
              Commands{commandsOff ? ` (${commandsOff} off)` : ''}
            </button>
            <button className="btn" onClick={onAds}>
              Ads
            </button>
          </div>
          <div className="ctl-preview">
            <button className="btn" onClick={() => onPreview({ as: null })}>
              View as teammate
            </button>
            <select className="input" value={as} onChange={(e) => setAs(e.target.value)} aria-label="Person to view as">
              <option value="">View as…</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button className="btn" disabled={!as} onClick={() => onPreview({ as })}>
              View
            </button>
          </div>
          <div className="segmented ads-tabs" role="tablist">
            {[
              ['features', 'Features'],
              ['tabs', 'Tabs'],
              ['channels', 'Channels'],
              ['accounts', 'Accounts'],
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
          <div className="ads-body">
            {tab === 'accounts' && <Accounts people={people} account={account} me={me} />}
            {tab === 'features' && (
              <>
                {FEATURE_GROUPS.map(([g, label, items]) => group('off', label, items))}
                <section className="cmd-admin-group">
                  <div className="cmd-admin-head">
                    <h4>Lab log</h4>
                  </div>
                  <div className="cmd-admin-row">
                    <span className="muted small grow">
                      When people end a shift. Required: they have to write it. Optional: asked, can skip. Off: not asked.
                    </span>
                  </div>
                  <div className="segmented ctl-lablog" role="radiogroup" aria-label="Lab log">
                    {LAB_LOG_MODES.map(([v, text]) => (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={(doc.labLog || 'required') === v}
                        className={`plain-seg${(doc.labLog || 'required') === v ? ' on' : ''}`}
                        onClick={() => onSave({ labLog: v })}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
            {tab === 'tabs' && (
              <>
                <p className="muted small">Each person still puts the tabs that are on in their own order (Edit tabs).</p>
                {group(
                  'tabsOff',
                  'Tabs',
                  views.map(([id, label]) => [id, label]),
                )}
              </>
            )}
            {tab === 'channels' && (
              <>
                {group(
                  'channelsOff',
                  'Channels',
                  channels.map((c) => [c.id, `#${c.name}`]),
                )}
                {group('off', 'Direct messages', [['dms', 'All DMs', 'Sending and reading DMs']])}
              </>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// Who has a password and when they last signed in. Reset asks the person
// first: a popup they have to answer on every device they're signed in on.
// Someone signed in nowhere can't be asked, so they can be reset straight away
// (they make a new password the next time they sign in).
function Accounts({ people, account, me }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [asking, setAsking] = useState('');
  const [note, setNote] = useState('');
  const load = () =>
    account({ action: 'list' })
      .then((r) => setList(r.accounts || []))
      .catch((e) => setErr(e?.message || String(e)));
  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // see answers come in
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="form-error">{err}</p>;
  if (!list) return <p className="muted">Loading…</p>;
  const by = new Map(list.map((a) => [a.name, a]));
  const names = [...new Set([...people, ...list.map((a) => a.name)])].sort();
  const set = names.filter((n) => by.get(n)?.hasPassword).length;
  // A failed reset or cancel says so (it used to show nothing).
  const failed = (e) => setNote(`That didn’t work: ${e?.message || String(e)}`);
  const reset = (n) =>
    account({ action: 'reset', name: n })
      .then((r) => {
        setAsking('');
        setNote(
          r?.error ||
            (r?.asked
              ? `Asked ${n.split(' ')[0]} to confirm on their screen.`
              : `${n.split(' ')[0]}’s password was cleared. They’ll make a new one next time they sign in.`),
        );
        load();
      })
      .catch(failed);
  const cancelReset = (n) =>
    account({ action: 'cancelReset', name: n })
      .then((r) => {
        if (r?.error) setNote(r.error);
        load();
      })
      .catch(failed);
  return (
    <section className="cmd-admin-group">
      <p className="muted small">
        {set} of {names.length} have a password. Everyone signs in with their own; nobody can sign in as someone else. Resetting asks the
        person to confirm on their screen first.
      </p>
      {note && <p className="small">{note}</p>}
      {names.map((n) => {
        const a = by.get(n);
        const answered = a?.answer && Date.now() - a.answer.at < 7 * 864e5 ? (a.answer.yes ? ' · made a new password' : ' · said no to the reset') : '';
        return (
          <div key={n} className="cmd-admin-row acct-row">
            <b className="ctl-title">{n}</b>
            <span className="muted small grow">
              {a?.hasPassword
                ? `Password set ${relTime(a.setAt)}${a.lastSignIn ? ` · last signed in ${relTime(a.lastSignIn)}` : ''}${a.locked ? ' · locked after wrong tries' : ''}${a.asked ? '' : answered}`
                : 'No password yet'}
              {a?.asked && <b className="acct-waiting"> · Waiting for them to confirm</b>}
            </span>
            {a?.hasPassword && a.asked && (
              <button className="btn small-btn" onClick={() => cancelReset(n)}>
                Cancel request
              </button>
            )}
            {/* Not your own: you change yours from your menu. */}
            {a?.hasPassword &&
              !a.asked &&
              n !== me &&
              (asking === n ? (
                <span className="acct-confirm">
                  <span className="muted tiny">
                    {a.devices ? 'They’ll get a popup to confirm.' : 'Not signed in anywhere, so they can’t be asked.'}
                  </span>
                  <button className="btn small-btn danger" onClick={() => reset(n)}>
                    {a.devices ? 'Ask them' : 'Reset anyway'}
                  </button>
                  <button className="btn small-btn" onClick={() => setAsking('')}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="btn small-btn" onClick={() => setAsking(n)}>
                  Reset password
                </button>
              ))}
          </div>
        );
      })}
    </section>
  );
}
