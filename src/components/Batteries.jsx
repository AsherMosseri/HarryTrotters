import { useEffect, useMemo, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { CloseIcon, Overlay } from './common.jsx';
import { confirmDialog } from './Dialogs.jsx';
import { firstName, relTime, useEscape } from '../util.js';
import { nextMatch, sortMatches } from '../../functions/shared/matches.js';
import {
  BATTERY_COLORS,
  batteryWarning,
  charged,
  hasLabel,
  inRobot,
  live,
  nextLabel,
  ranIn,
  retired,
  sortBatteries,
  statusById,
  statusLabel,
  suggestNext,
  summary,
} from '../batteries.js';

// Robot batteries (D6): a big-button strip on the pit screen and a section on
// the Match log page. Both open the same sheet for one battery: put it on the
// robot for a match, start charging, mark it charged. Team management adds,
// renames, retires and deletes them. Changes save without waiting for the
// network, so they work with bad Wi-Fi in the pits.

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const when = (ms) => (sameDay(ms, Date.now()) ? clock(ms) : `${new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${clock(ms)}`);

function useNow(every = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

// The little colored tag (the number is what counts, so color is a hint).
function Dot({ color }) {
  return color ? <i className={`bat-dot bat-c-${color}`} aria-hidden="true" /> : null;
}

// ---------- One battery's sheet ----------
function BatterySheet({ battery, batteries, matches, isManager, api, onClose, onEdit }) {
  useEscape(onClose);
  const now = useNow(30000);
  const sorted = useMemo(() => sortMatches(matches).filter((m) => m.label), [matches]);
  const next = nextMatch(matches, now);
  const [match, setMatch] = useState(next?.label || '');
  const robot = inRobot(batteries);
  const suggested = suggestNext(batteries);
  const b = battery;
  const st = b.status;
  const swap = robot && robot.id !== b.id ? robot : null;
  const ran = ranIn(b);
  const done = (fn) => () => {
    fn();
    onClose();
  };
  const set = (status) => done(() => api.setBatteryStatus(b, status));
  const put = done(() => api.putBatteryOn(b, match));
  const hist = [...(b.history || [])].reverse().slice(0, 6);

  const Btn = ({ onClick, icon, children, primary }) => (
    <button className={`bat-act${primary ? ' primary' : ''}`} onClick={onClick}>
      <Icon name={icon} size={22} />
      <span>{children}</span>
    </button>
  );

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog bat-sheet" role="dialog" aria-modal="true" aria-label={`Battery ${b.label}`} onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2 className="bat-sheet-title">
              <span>Battery</span> <span className="mono bat-sheet-num">{b.label}</span>
              <Dot color={b.color} />
            </h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="bat-sheet-state">
            <span className={`bat-chip s-${st}`}>{statusLabel(st)}</span>
            {b.statusAt ? (
              <span className="muted">
                {st === 'robot' && b.match ? <>for <span className="mono">{b.match}</span> · </> : null}
                {relTime(b.statusAt)} · {firstName(b.statusBy)}
              </span>
            ) : null}
          </p>

          {st !== 'retired' && st !== 'robot' && (
            <>
              {sorted.length > 0 ? (
                <label className="bat-for">
                  <span>For match</span>
                  <select className="input mono" value={match} onChange={(e) => setMatch(e.target.value)}>
                    {sorted.map((m) => (
                      <option key={m.id} value={m.label}>
                        {m.label}
                        {m.time ? ` · ${clock(m.time)}` : ''}
                      </option>
                    ))}
                    <option value="">No match (practice)</option>
                  </select>
                </label>
              ) : (
                <label className="bat-for">
                  <span>For match (optional)</span>
                  <input className="input mono" value={match} maxLength={20} onChange={(e) => setMatch(e.target.value)} placeholder="Q12" />
                </label>
              )}
              {st !== 'charged' && <p className="bat-warn small">This one isn’t marked charged.</p>}
              {st === 'charged' && suggested?.id === b.id && charged(batteries).length > 1 && <p className="bat-hint small">It’s been rested the longest.</p>}
              {swap && (
                <p className="bat-hint small">
                  Battery <span className="mono">{swap.label}</span> comes off and goes to Needs charging.
                </p>
              )}
            </>
          )}

          <div className="bat-acts">
            {st === 'charged' && (
              <>
                <Btn primary icon="robot" onClick={put}>
                  {match ? `Put on the robot for ${match}` : 'Put on the robot'}
                </Btn>
                <Btn icon="bolt" onClick={set('charging')}>
                  Start charging
                </Btn>
              </>
            )}
            {st === 'robot' && (
              <>
                <Btn primary icon="battery" onClick={set('needs')}>
                  Needs charging
                </Btn>
                <Btn icon="bolt" onClick={set('charging')}>
                  Start charging
                </Btn>
                <Btn icon="check" onClick={set('charged')}>
                  Mark charged
                </Btn>
              </>
            )}
            {st === 'charging' && (
              <>
                <Btn primary icon="check" onClick={set('charged')}>
                  Mark charged
                </Btn>
                <Btn icon="robot" onClick={put}>
                  {match ? `Put on the robot for ${match}` : 'Put on the robot'}
                </Btn>
                <Btn icon="battery" onClick={set('needs')}>
                  Needs charging
                </Btn>
              </>
            )}
            {st === 'needs' && (
              <>
                <Btn primary icon="bolt" onClick={set('charging')}>
                  Start charging
                </Btn>
                <Btn icon="check" onClick={set('charged')}>
                  Mark charged
                </Btn>
                <Btn icon="robot" onClick={put}>
                  {match ? `Put on the robot for ${match}` : 'Put on the robot'}
                </Btn>
              </>
            )}
            {st === 'retired' && !isManager && <p className="muted small">Team management retired this battery.</p>}
          </div>

          <div className="bat-hist">
            <span className="bat-hist-h">Ran in</span>
            <span className="mono">{ran.length ? ran.join(', ') : 'No matches yet'}</span>
          </div>
          {hist.length > 0 && (
            <ul className="bat-log">
              {hist.map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <span className="mono bat-log-at">{when(h.at)}</span>
                  <span>
                    {statusLabel(h.status)}
                    {h.match ? (
                      <>
                        {' '}
                        for <span className="mono">{h.match}</span>
                      </>
                    ) : null}
                  </span>
                  <span className="muted">{firstName(h.by || '')}</span>
                </li>
              ))}
            </ul>
          )}

          {isManager && (
            <div className="bat-mgr">
              <button className="btn" onClick={onEdit}>
                <Icon name="edit" size={16} /> Rename
              </button>
              {st === 'retired' ? (
                <button
                  className="btn"
                  onClick={done(() => api.retireBattery(b, false))}
                >
                  Bring back
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={async () => {
                    if (await confirmDialog({ title: `Retire battery ${b.label}?`, body: 'It leaves the pit screen. You can bring it back later.', okLabel: 'Retire' })) {
                      api.retireBattery(b, true);
                      onClose();
                    }
                  }}
                >
                  Retire
                </button>
              )}
              <button
                className="btn danger"
                onClick={async () => {
                  if (await confirmDialog({ title: `Delete battery ${b.label}?`, body: 'Its history goes too. This can’t be undone.', okLabel: 'Delete', danger: true })) {
                    api.deleteBattery(b);
                    onClose();
                  }
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ---------- Add / rename (team management) ----------
function BatteryForm({ battery, batteries, api, onClose }) {
  useEscape(onClose);
  const editing = !!battery;
  const [label, setLabel] = useState(battery?.label || nextLabel(batteries));
  const [color, setColor] = useState(battery?.color || '');
  const [ready, setReady] = useState(false); // a new one starts as Charged?
  const clash = hasLabel(batteries, label, battery?.id);
  const ok = label.trim().length > 0 && !clash;
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    if (editing) api.editBattery(battery, { label: label.trim().slice(0, 20), color });
    else api.addBattery({ label, color, status: ready ? 'charged' : 'needs' });
    onClose();
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form className="dialog bat-form" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label={editing ? 'Rename battery' : 'Add a battery'}>
          <div className="panel-head">
            <h2>{editing ? `Battery ${battery.label}` : 'Add a battery'}</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <label className="mf-field">
            <span>Number or name</span>
            <input className="input mono" value={label} maxLength={20} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </label>
          {clash && <p className="bat-warn small">There’s already a battery with that number.</p>}
          <div>
            <span className="mf-label">Color tag</span>
            <div className="bat-colors" role="radiogroup" aria-label="Color tag">
              {BATTERY_COLORS.map(([id, name]) => (
                <button
                  type="button"
                  key={id || 'none'}
                  role="radio"
                  aria-checked={color === id}
                  aria-label={name}
                  title={name}
                  className={`bat-swatch bat-c-${id || 'none'}${color === id ? ' on' : ''}`}
                  onClick={() => setColor(id)}
                >
                  {color === id && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </div>
          {!editing && (
            <label className="done-toggle small">
              <input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
              It’s already charged
            </label>
          )}
          <div className="row gap end dialog-actions">
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!ok}>
              {editing ? 'Save' : 'Add battery'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

// ---------- What's in the robot, what's next, and the warning ----------
function Status({ batteries }) {
  const robot = inRobot(batteries);
  const next = suggestNext(batteries);
  const warn = batteryWarning(batteries);
  return (
    <div className="bat-status">
      {robot && (
        <p>
          <Icon name="robot" size={16} /> In the robot: <b className="mono">{robot.label}</b>
          {robot.match ? (
            <>
              {' '}
              for <span className="mono">{robot.match}</span>
            </>
          ) : null}
          <span className="muted"> · {relTime(robot.statusAt)}</span>
        </p>
      )}
      {next && (
        <p>
          <Icon name="check" size={16} /> Next up: <b className="mono">{next.label}</b>
          <span className="muted"> · rested the longest</span>
        </p>
      )}
      {warn && (
        <p className="bat-warn" role="alert">
          <Icon name="stuck" size={16} /> {warn}
        </p>
      )}
    </div>
  );
}

// Everything the two views share: which sheet is open.
function useSheet(batteries) {
  const [open, setOpen] = useState(null); // battery id
  const [form, setForm] = useState(null); // 'new' | battery id
  const byId = useMemo(() => new Map(batteries.map((b) => [b.id, b])), [batteries]);
  return { open: byId.get(open) || null, setOpen: (b) => setOpen(b ? b.id : null), form: form === 'new' ? 'new' : byId.get(form) || null, setForm: (f) => setForm(f && f !== 'new' ? f.id : f) };
}

// ---------- The pit screen's strip ----------
export function BatteryStrip({ batteries, matches, api, isManager }) {
  const mine = useMemo(() => sortBatteries(live(batteries)), [batteries]);
  useNow(30000); // keeps the "5m ago" times fresh
  const next = suggestNext(batteries);
  const sheet = useSheet(batteries);
  const sum = summary(batteries);
  return (
    <section className="today-sec pit-sec bat-sec">
      <div className="sec-head">
        <h2>Batteries</h2>
        {mine.length > 0 && (
          <span className="mono bat-count" title="Charged and ready">
            {sum.charged} ready
          </span>
        )}
      </div>
      {mine.length ? (
        <>
          <ul className="bat-strip">
            {mine.map((b) => (
              <li key={b.id}>
                <button className={`bat-tile s-${b.status}${next?.id === b.id ? ' next' : ''}`} onClick={() => sheet.setOpen(b)} aria-label={`Battery ${b.label}, ${statusLabel(b.status)}`}>
                  <Dot color={b.color} />
                  <span className="bat-num mono">{b.label}</span>
                  <span className="bat-state">{b.status === 'robot' ? 'On robot' : statusById[b.status].label}</span>
                  {b.status === 'robot' && b.match && <span className="bat-for-match mono">{b.match}</span>}
                  {next?.id === b.id && <span className="bat-next">Next up</span>}
                </button>
              </li>
            ))}
          </ul>
          <Status batteries={batteries} />
        </>
      ) : (
        <p className="today-empty">{isManager ? 'No batteries yet. Add them on the Match log page.' : 'No batteries yet. Team management adds them.'}</p>
      )}
      {sheet.open && (
        <BatterySheet
          battery={sheet.open}
          batteries={batteries}
          matches={matches}
          isManager={isManager}
          api={api}
          onClose={() => sheet.setOpen(null)}
          onEdit={() => {
            sheet.setForm(sheet.open);
            sheet.setOpen(null);
          }}
        />
      )}
      {sheet.form && sheet.form !== 'new' && <BatteryForm battery={sheet.form} batteries={batteries} api={api} onClose={() => sheet.setForm(null)} />}
    </section>
  );
}

// ---------- The Match log page's section ----------
export function BatteriesSection({ batteries, matches, api, isManager }) {
  const sheet = useSheet(batteries);
  useNow(30000);
  const [showOld, setShowOld] = useState(false);
  const mine = useMemo(() => sortBatteries(live(batteries)), [batteries]);
  const old = useMemo(() => sortBatteries(retired(batteries)), [batteries]);
  const next = suggestNext(batteries);
  const sum = summary(batteries);
  const card = (b) => (
    <li key={b.id}>
      <button className={`bat-card s-${b.status}${next?.id === b.id ? ' next' : ''}`} onClick={() => sheet.setOpen(b)} aria-label={`Battery ${b.label}, ${statusLabel(b.status)}`}>
        <span className="bat-card-top">
          <Dot color={b.color} />
          <span className="bat-num mono">{b.label}</span>
          <span className={`bat-chip s-${b.status}`}>{statusLabel(b.status)}</span>
        </span>
        <span className="bat-card-line muted">
          {b.status === 'robot' && b.match ? (
            <>
              For <span className="mono">{b.match}</span> ·{' '}
            </>
          ) : null}
          {relTime(b.statusAt)} · {firstName(b.statusBy || '')}
        </span>
        <span className="bat-card-line">
          {ranIn(b).length ? (
            <>
              Ran in <span className="mono">{ranIn(b).slice(-5).join(', ')}</span>
            </>
          ) : (
            <span className="muted">Hasn’t run in a match</span>
          )}
        </span>
        {next?.id === b.id && <span className="bat-next">Next up</span>}
      </button>
    </li>
  );
  return (
    <section className="chart-card bat-sec bat-page">
      <div className="shift-sec-head">
        <h2>Batteries</h2>
        {mine.length > 0 && (
          <span className="muted small">
            <span className="mono">{sum.charged}</span> charged · <span className="mono">{sum.charging}</span> charging · <span className="mono">{sum.needs}</span> need charging
          </span>
        )}
        <span className="spacer" />
        {isManager && (
          <button className="btn" onClick={() => sheet.setForm('new')}>
            <Icon name="plus" size={16} /> Add a battery
          </button>
        )}
      </div>
      {mine.length ? (
        <>
          <Status batteries={batteries} />
          <ul className="bat-cards">{mine.map(card)}</ul>
        </>
      ) : (
        <p className="muted">{isManager ? 'No batteries yet. Add the numbered packs the team has, then tap one to put it on the robot or start charging.' : 'No batteries yet. Team management adds them.'}</p>
      )}
      {old.length > 0 && (
        <>
          <button className="text-btn bat-old" onClick={() => setShowOld((v) => !v)} aria-expanded={showOld}>
            Retired <span className="mono">({old.length})</span>
          </button>
          {showOld && <ul className="bat-cards">{old.map(card)}</ul>}
        </>
      )}
      {sheet.open && (
        <BatterySheet
          battery={sheet.open}
          batteries={batteries}
          matches={matches}
          isManager={isManager}
          api={api}
          onClose={() => sheet.setOpen(null)}
          onEdit={() => {
            sheet.setForm(sheet.open);
            sheet.setOpen(null);
          }}
        />
      )}
      {sheet.form && <BatteryForm battery={sheet.form === 'new' ? null : sheet.form} batteries={batteries} api={api} onClose={() => sheet.setForm(null)} />}
    </section>
  );
}
