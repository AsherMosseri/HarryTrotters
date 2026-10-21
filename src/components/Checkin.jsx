import { useEffect, useState } from 'react';
import { lunchOf } from '../config.js';
import { addDays, parseDay, todayISO } from '../milestones.js';
import { firstName } from '../util.js';
import { Avatar, CloseIcon } from './common.jsx';

export const SLOTS = [
  { id: 'lunch', label: 'Lunch', icon: '🥪' },
  { id: 'after', label: 'After school', icon: '🏫' },
];
const slotById = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
const dayLabel = (iso) =>
  iso === todayISO()
    ? 'Today'
    : iso === addDays(todayISO(), 1)
      ? 'Tomorrow'
      : parseDay(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

// Someone's answer, also under a name they had before a rename.
export const answerOf = (checkin, name, rename) => Object.entries(checkin.answers || {}).find(([k]) => rename(k) === name)?.[1] || null;

// Yes / No for each time of day; onDone gets { lunch: true, after: false }.
function AnswerForm({ checkin, initial, submitLabel, onDone }) {
  const [a, setA] = useState(() => Object.fromEntries((checkin.slots || []).map((s) => [s, initial?.[s] ?? null])));
  const done = Object.values(a).every((v) => v !== null);
  return (
    <div className="checkin-form">
      {(checkin.slots || []).map((s) => (
        <div key={s} className="checkin-slot">
          <span className="checkin-slot-label">
            {slotById[s]?.icon} {slotById[s]?.label || s}
          </span>
          <div className="checkin-yn">
            <button
              className={`checkin-yes${a[s] === true ? ' on' : ''}`}
              aria-pressed={a[s] === true}
              onClick={() => setA({ ...a, [s]: true })}
            >
              Yes
            </button>
            <button
              className={`checkin-no${a[s] === false ? ' on' : ''}`}
              aria-pressed={a[s] === false}
              onClick={() => setA({ ...a, [s]: false })}
            >
              No
            </button>
          </div>
        </div>
      ))}
      <button className="btn primary big-btn" disabled={!done} onClick={() => onDone(a)}>
        {submitLabel}
      </button>
    </div>
  );
}

// Today's check-in, unanswered: blocks the app until it's answered.
export function CheckinGate({ checkin, rename, onAnswer }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="checkin-gate" role="alertdialog" aria-labelledby="checkin-title">
      <div className="gate-card checkin-card">
        <div className="logo-mark big">🧪</div>
        <h1 id="checkin-title">{checkin.question || 'Are you going to the lab today?'}</h1>
        <p className="muted">
          Lab check-in from {firstName(rename(checkin.by || ''))} · {dayLabel(checkin.date)}. Answer to keep going.
        </p>
        <AnswerForm
          checkin={checkin}
          submitLabel={busy ? 'Saving…' : 'Done'}
          onDone={async (a) => {
            setBusy(true);
            await onAnswer(a);
            setBusy(false);
          }}
        />
        <p className="muted tiny">Plans changed? Change your answer anytime in the Shifts tab.</p>
      </div>
    </div>
  );
}

function Names({ names }) {
  if (!names.length) return <span className="muted small">Nobody</span>;
  return (
    <div className="checkin-names">
      {names.map((n) => (
        <span key={n} className="checkin-name">
          <Avatar name={n} size={20} /> {n}
        </span>
      ))}
    </div>
  );
}

// Results in the Shifts tab: who's going when (lunch split by middle and high
// school lunch), who isn't, and who hasn't answered.
export function CheckinCard({ checkin, roster, gradeOf, me, isManager, rename, onAnswer, onDelete }) {
  const [changing, setChanging] = useState(false);
  const answers = new Map(Object.entries(checkin.answers || {}).map(([k, v]) => [rename(k), v]));
  const mine = answers.get(me);
  const yes = (slot) => [...answers].filter(([, a]) => a[slot]).map(([n]) => n);
  const no = [...answers].filter(([, a]) => (checkin.slots || []).every((s) => !a[s])).map(([n]) => n);
  const waiting = roster.filter((n) => !answers.has(n));
  return (
    <section className="chart-card checkin-results">
      <div className="shift-sec-head">
        <h2>
          🧪 {checkin.question || 'Lab check-in'} <span className="muted small">· {dayLabel(checkin.date)}</span>
        </h2>
        <span className="spacer" />
        {mine && !changing && (
          <button className="btn small-btn" onClick={() => setChanging(true)}>
            Change my answer
          </button>
        )}
        {isManager && (
          <button
            className="icon-btn small"
            title="Delete this check-in"
            aria-label="Delete check-in"
            onClick={() => confirm('Delete this check-in?') && onDelete()}
          >
            <CloseIcon />
          </button>
        )}
      </div>
      {(changing || (!mine && checkin.date !== todayISO())) && (
        <AnswerForm
          checkin={checkin}
          initial={mine}
          submitLabel="Save"
          onDone={async (a) => {
            await onAnswer(a);
            setChanging(false);
          }}
        />
      )}
      <div className="checkin-grid">
        {(checkin.slots || []).includes('lunch') && (
          <>
            <div>
              <h3>🥪 Middle school lunch</h3>
              <Names names={yes('lunch').filter((n) => lunchOf(gradeOf(n)) === 'Middle school lunch')} />
            </div>
            <div>
              <h3>🥪 High school lunch</h3>
              <Names names={yes('lunch').filter((n) => lunchOf(gradeOf(n)) === 'High school lunch')} />
            </div>
          </>
        )}
        {(checkin.slots || []).includes('after') && (
          <div>
            <h3>🏫 After school</h3>
            <Names names={yes('after')} />
          </div>
        )}
        <div>
          <h3>Not going</h3>
          <Names names={no} />
        </div>
        <div className="checkin-waiting">
          <h3>Hasn’t answered ({waiting.length})</h3>
          <Names names={waiting} />
        </div>
      </div>
    </section>
  );
}

// Team management: ask who's going to the lab.
export function CheckinDialog({ onDone, onClose }) {
  const [date, setDate] = useState(todayISO());
  const [question, setQuestion] = useState('Who’s going to the lab today?');
  const [slots, setSlots] = useState(['lunch', 'after']);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const toggle = (s) =>
    setSlots(slots.includes(s) ? slots.filter((x) => x !== s) : SLOTS.map((x) => x.id).filter((x) => x === s || slots.includes(x)));
  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog shift-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Lab check-in">
        <div className="panel-head">
          <h2>🧪 Lab check-in</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="muted small">Everyone gets a notification, and the app asks them when they open it until they answer.</p>
        <div className="fields">
          <label className="field-label" htmlFor="ci-q">
            Question
          </label>
          <input id="ci-q" className="input" value={question} maxLength={120} onChange={(e) => setQuestion(e.target.value)} />
          <label className="field-label" htmlFor="ci-date">
            Day
          </label>
          <input id="ci-date" type="date" className="input" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
          <span className="field-label">When</span>
          <div className="segmented">
            {SLOTS.map((s) => (
              <button
                key={s.id}
                className={`plain-seg${slots.includes(s.id) ? ' on' : ''}`}
                aria-pressed={slots.includes(s.id)}
                onClick={() => toggle(s.id)}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row gap">
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!slots.length || !question.trim() || !date}
            onClick={() => onDone({ date, question: question.trim(), slots })}
          >
            Ask everyone
          </button>
        </div>
      </div>
    </div>
  );
}
