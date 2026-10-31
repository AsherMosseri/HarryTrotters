import { useEffect, useState } from 'react';
import { lunchOf } from '../config.js';
import { addDays, parseDay, todayISO } from '../milestones.js';
import { firstName } from '../util.js';
import { AutoTextarea, Avatar, CloseIcon, Overlay } from './common.jsx';
import { sameName } from '../../functions/shared/team.js';
import { teamDay } from '../../functions/shared/coins.js';
import { cleanSkips, upcomingDays } from '../../functions/shared/checkin.js';

export const SLOTS = [
  { id: 'lunch', label: 'Lunch', icon: '' },
  { id: 'after', label: 'After school', icon: '' },
];
const slotById = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
const dayLabel = (iso) =>
  iso === todayISO()
    ? 'Today'
    : iso === addDays(todayISO(), 1)
      ? 'Tomorrow'
      : parseDay(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

// Someone's answer, also under a name they had before a rename, or saved with
// a slightly different spelling (an extra space, other capitals).
export const answerOf = (checkin, name, rename) =>
  Object.entries(checkin.answers || {}).find(([k]) => sameName(rename(k), name))?.[1] || null;

// Everyone's answers by person: through renames, and look-alike spellings
// matched to the roster's name, so nobody shows up twice. An answer saved
// under the exact name wins over a look-alike.
function answersByPerson(checkin, rename, roster) {
  const out = new Map();
  for (const [k, v] of Object.entries(checkin.answers || {})) {
    const saved = rename(k);
    const name = roster.find((n) => sameName(n, saved)) || saved;
    if (!out.has(name) || saved === name) out.set(name, v);
  }
  return out;
}

// Yes / No for each time of day; onDone gets { lunch: true, after: false }.
function AnswerForm({ checkin, initial, submitLabel, onDone }) {
  const [a, setA] = useState(() => Object.fromEntries((checkin.slots || []).map((s) => [s, initial?.[s] ?? null])));
  const done = Object.values(a).every((v) => v !== null);
  return (
    <div className="checkin-form">
      {(checkin.slots || []).map((s) => (
        <div key={s} className="checkin-slot">
          <span className="checkin-slot-label">{slotById[s]?.label || s}</span>
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
export function CheckinGate({ checkin, rename, onAnswer, onSkip }) {
  const [busy, setBusy] = useState(false);
  return (
    <Overlay>
      <div className="checkin-gate" role="alertdialog" aria-labelledby="checkin-title">
        <div className="gate-card checkin-card">
          <p className="gate-eyebrow">Lab check-in</p>
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
          {onSkip && <PreviewSkip onSkip={onSkip} />}
        </div>
      </div>
    </Overlay>
  );
}

// Asher previewing (Controls → View as): required screens can be skipped,
// since nothing can be answered in a look-only preview.
export function PreviewSkip({ onSkip }) {
  return (
    <button className="link-btn small preview-skip" onClick={onSkip}>
      Skip (preview)
    </button>
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
  const answers = answersByPerson(checkin, rename, roster);
  const mine = answers.get(me);
  const yes = (slot) => [...answers].filter(([, a]) => a[slot]).map(([n]) => n);
  const no = [...answers].filter(([, a]) => (checkin.slots || []).every((s) => !a[s])).map(([n]) => n);
  const waiting = roster.filter((n) => !answers.has(n));
  return (
    <section className="chart-card checkin-results">
      <div className="shift-sec-head">
        <h2>
          {checkin.question || 'Lab check-in'}
          {/* "Who's going to the lab today?" already says when. */}
          {!(dayLabel(checkin.date) === 'Today' && /\btoday\b/i.test(checkin.question || '')) && (
            <span className="muted small"> · {dayLabel(checkin.date)}</span>
          )}
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
              <h3>Middle school lunch</h3>
              <Names names={yes('lunch').filter((n) => lunchOf(gradeOf(n)) === 'Middle school lunch')} />
            </div>
            <div>
              <h3>High school lunch</h3>
              <Names names={yes('lunch').filter((n) => lunchOf(gradeOf(n)) === 'High school lunch')} />
            </div>
          </>
        )}
        {(checkin.slots || []).includes('after') && (
          <div>
            <h3>After school</h3>
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

const WEEKDAYS = [1, 2, 3, 4, 5];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clock12 = (hhmm) => {
  const [h, m] = (hhmm || '07:00').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
// "every school day at 12:00 AM" / "every weekday at 7:00 AM" / "Mon, Wed, Fri at 3:00 PM"
export function scheduleText(s) {
  if (s.mode === 'school') return `every school day at ${clock12(s.time)}`;
  const days = [...(s.days || [])].sort();
  const which =
    days.join() === WEEKDAYS.join() ? 'every weekday' : days.length === 7 ? 'every day' : days.map((d) => DAY_NAMES[d]).join(', ');
  return `${which} at ${clock12(s.time)}`;
}
const repeatOf = (s) =>
  !s?.on || s.mode === 'school' ? 'school' : (s.days || []).join() === WEEKDAYS.join() ? 'weekdays' : 'days';
const chipDay = (d) => parseDay(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// Team management: ask who's going to the lab, once or on a schedule.
// A schedule (settings.checkinSchedule, shared/checkin.js) is asked by the
// server at that time (New York time): every school day (shared/school.js),
// or on the picked weekdays, except the days picked to skip.
export function CheckinDialog({ schedule, onDone, onSchedule, onClose }) {
  const today = teamDay(Date.now());
  const [date, setDate] = useState(todayISO());
  const [question, setQuestion] = useState(schedule?.question || 'Who’s going to the lab today?');
  const [slots, setSlots] = useState(schedule?.slots || ['lunch', 'after']);
  const [repeat, setRepeat] = useState(() => (schedule?.on ? repeatOf(schedule) : 'once'));
  const [days, setDays] = useState(schedule?.days || WEEKDAYS);
  // Every school day is asked at midnight unless changed.
  const [time, setTime] = useState(schedule?.time || (repeatOf(schedule) === 'school' ? '00:00' : '07:00'));
  const [skip, setSkip] = useState(() => cleanSkips(schedule?.skip, today));
  const [moreDays, setMoreDays] = useState(false);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const toggle = (s) =>
    setSlots(slots.includes(s) ? slots.filter((x) => x !== s) : SLOTS.map((x) => x.id).filter((x) => x === s || slots.includes(x)));
  const draft = {
    on: true,
    mode: repeat === 'school' ? 'school' : 'days',
    days: repeat === 'weekdays' ? WEEKDAYS : days,
    time,
    question: question.trim(),
    slots,
    skip: cleanSkips(skip, today),
  };
  // The next days it would ask on, to tap the ones to skip.
  const upcoming = repeat === 'once' ? [] : upcomingDays(draft, today, moreDays ? 30 : 10);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog shift-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Lab check-in">
          <div className="panel-head">
            <h2>Lab check-in</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small">
            Everyone gets a notification, and the app asks them when they open it until they answer.
            {repeat !== 'once' &&
              ' On a schedule, it’s asked automatically at that time (New York time), unless there’s already a check-in that day.'}
          </p>
          <div className="fields">
            <label className="field-label" htmlFor="ci-q">
              Question
            </label>
            <input id="ci-q" className="input" value={question} maxLength={120} onChange={(e) => setQuestion(e.target.value)} />
            <span className="field-label">Repeat</span>
            <div className="segmented">
              {[
                ['once', 'Just once'],
                ['school', 'Every school day'],
                ['weekdays', 'Every weekday'],
                ['days', 'Pick days'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={`plain-seg${repeat === id ? ' on' : ''}`}
                  aria-pressed={repeat === id}
                  onClick={() => {
                    // Every school day starts out at midnight, so it's waiting when people wake up.
                    if (id === 'school' && repeat !== 'school') setTime('00:00');
                    setRepeat(id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {repeat === 'once' ? (
              <>
                <label className="field-label" htmlFor="ci-date">
                  Day
                </label>
                <input id="ci-date" type="date" className="input" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
              </>
            ) : (
              <>
                {repeat === 'days' && (
                  <>
                    <span className="field-label">Days</span>
                    <div className="checkin-days">
                      {DAY_NAMES.map((n, d) => (
                        <button
                          key={n}
                          className={`chip${days.includes(d) ? ' on' : ''}`}
                          aria-pressed={days.includes(d)}
                          onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort())}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <label className="field-label" htmlFor="ci-time">
                  Ask at
                </label>
                <input id="ci-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                <span className="field-label">Skip</span>
                <div>
                  <p className="muted small ci-skip-help">Tap the days not to ask.</p>
                  <div className="checkin-days ci-skip-days">
                    {upcoming.map((d) => {
                      const off = skip.includes(d);
                      return (
                        <button
                          key={d}
                          className={`chip ci-skip-chip${off ? ' skipped' : ''}`}
                          aria-pressed={off}
                          aria-label={`${chipDay(d)}${off ? ', skipped' : ''}`}
                          onClick={() => setSkip(off ? skip.filter((x) => x !== d) : [...skip, d])}
                        >
                          <span className="mono">{chipDay(d)}</span>
                        </button>
                      );
                    })}
                    {!upcoming.length && <span className="muted small">No days to ask on.</span>}
                  </div>
                  {!moreDays && upcoming.length >= 10 && (
                    <button className="link-btn small" onClick={() => setMoreDays(true)}>
                      More days
                    </button>
                  )}
                </div>
              </>
            )}
            <span className="field-label">When</span>
            <div className="segmented">
              {SLOTS.map((s) => (
                <button
                  key={s.id}
                  className={`plain-seg${slots.includes(s.id) ? ' on' : ''}`}
                  aria-pressed={slots.includes(s.id)}
                  onClick={() => toggle(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row gap">
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            {repeat === 'once' ? (
              <button
                className="btn primary"
                disabled={!slots.length || !question.trim() || !date}
                onClick={() => onDone({ date, question: question.trim(), slots })}
              >
                Ask everyone
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={!slots.length || !question.trim() || !time || (repeat === 'days' && !days.length)}
                onClick={() => onSchedule(draft)}
              >
                Save schedule
              </button>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// A required poll from #announcements, not voted on yet: blocks the app,
// like a lab check-in, until it's answered (or the poll is ended).
export function PollGate({ msg, rename, onVote, onAnswer, onSkip }) {
  const [picked, setPicked] = useState([]);
  const [answer, setAnswer] = useState('');
  const written = msg.poll.kind === 'text';
  // A choice poll that also takes written answers: pick, write, or both.
  const both = !written && !!msg.poll.write;
  const [busy, setBusy] = useState(false);
  const { poll } = msg;
  const toggle = (id) => setPicked(poll.multi ? (picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]) : [id]);
  return (
    <Overlay>
      <div className="checkin-gate" role="alertdialog" aria-labelledby="pollgate-title">
        <div className="gate-card checkin-card">
          <p className="gate-eyebrow">Poll</p>
          <h1 id="pollgate-title">{poll.question}</h1>
          <p className="muted">
            Poll from {firstName(rename(msg.by || ''))} in #announcements.{' '}
            {written ? 'Write your answer' : `${poll.multi ? 'Pick one or more' : 'Pick one'}${both ? ', or write your own' : ''}`} to keep
            going.
          </p>
          {written && (
            <AutoTextarea
              className="input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer"
              maxLength={1000}
              autoFocus
            />
          )}
          <div className="pollgate-options" hidden={written}>
            {poll.options.map((o) => (
              <button
                key={o.id}
                className={`pollgate-opt${picked.includes(o.id) ? ' on' : ''}`}
                aria-pressed={picked.includes(o.id)}
                onClick={() => toggle(o.id)}
              >
                <span className="poll-check">{picked.includes(o.id) ? '✓' : ''}</span>
                {o.text}
              </button>
            ))}
          </div>
          {both && (
            <AutoTextarea
              className="input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Or write your own answer"
              maxLength={1000}
            />
          )}
          <button
            className="btn primary big-btn"
            disabled={(written ? !answer.trim() : !picked.length && !(both && answer.trim())) || busy}
            onClick={async () => {
              setBusy(true);
              if (written) await onAnswer(answer);
              else {
                if (picked.length) await onVote(picked);
                if (both && answer.trim()) await onAnswer(answer.trim());
              }
              setBusy(false);
            }}
          >
            {busy ? 'Saving…' : written ? 'Send answer' : 'Vote'}
          </button>
          <p className="muted tiny">You can change your {written ? 'answer' : 'vote'} anytime in #announcements.</p>
          {onSkip && <PreviewSkip onSkip={onSkip} />}
        </div>
      </div>
    </Overlay>
  );
}
