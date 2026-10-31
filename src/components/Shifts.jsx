import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { SUBTEAMS } from '../config.js';
import { addDays, mondayOf, parseDay, toISO, todayISO } from '../milestones.js';
import { firstName } from '../util.js';
import { Avatar, AvatarStack, CloseIcon, Overlay, PlusIcon } from './common.jsx';
import { CheckinCard, CheckinDialog, scheduleText } from './Checkin.jsx';
import { hoursLabel, hoursOf, msByPerson, msOf } from '../../functions/shared/hours.js';
import { teamDay } from '../../functions/shared/coins.js';
import { cleanSkips, nextSchoolDay, scheduledOn } from '../../functions/shared/checkin.js';
import { seasonStats, versusLastWeek } from '../../functions/shared/stats.js';
import { streaksOf } from '../../functions/shared/streaks.js';
import { confirmDialog } from './Dialogs.jsx';

const MIN = 60000;
const HOUR = 60 * MIN;
const CANCEL_WITHIN = 15 * MIN; // matches firestore.rules

// Re-renders every `every` ms so running timers tick.
export function useNow(every = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  // The tick only forces re-renders; a shift started since then still reads right.
  return Math.max(now, Date.now());
}

const timer = (ms) => `${Math.floor(Math.max(0, ms) / HOUR)}:${String(Math.floor((Math.max(0, ms) % HOUR) / MIN)).padStart(2, '0')}`;
const hoursText = hoursLabel;
const clock = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso) => {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return parseDay(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const lengthOf = (s, now) => Math.max(0, (s.end ?? now) - s.start);
const planMs = (date, time) => new Date(`${date}T${time || '00:00'}`).getTime();
const toInput = (ms) => {
  const d = new Date(ms);
  return `${toISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// A time picked for "I started at": today; a few minutes ahead (a clock a
// little off) means now; well ahead means last night (11 PM picked at 1 AM).
const startFromTime = (hhmm, now) => {
  const t = planMs(todayISO(), hhmm);
  if (t <= now) return t;
  return t - now <= 2 * HOUR ? now : t - 24 * HOUR;
};

function TaskPicks({ tasks, value, onChange }) {
  if (!tasks.length) return null;
  return (
    <div className="shift-tasks">
      {tasks.slice(0, 8).map((t) => {
        const on = value.includes(t.id);
        return (
          <button
            key={t.id}
            className={`chip${on ? ' on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
          >
            {t.title || 'Untitled task'}
          </button>
        );
      })}
    </div>
  );
}

// The ⏱ in the top bar: one tap starts a shift; while running it shows the
// time, and tapping opens this panel to fix the start, add notes, or end it.
export function ShiftButton({ shift, open, setOpen, myTasks, onStart, onUpdate, onEnd, onCancel, onOpenTab }) {
  const now = useNow(shift ? 15000 : 60000);
  const box = useRef(null);
  const [note, setNote] = useState('');
  const [subteam, setSubteam] = useState('');
  const [taskIds, setTaskIds] = useState([]);
  const [at, setAt] = useState('');
  const shiftId = shift?.id;
  useEffect(() => {
    setNote(shift?.note || '');
    setSubteam(shift?.subteam || '');
    setTaskIds(shift?.taskIds || []);
    // Only when a different shift starts, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);
  useEffect(() => {
    if (!open) return;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open, setOpen]);

  if (!shift)
    return (
      <button className="icon-btn shift-btn" title="Start a shift now" aria-label="Start a shift now" onClick={() => onStart()}>
        <Icon name="shifts" size={20} />
      </button>
    );
  const details = { note: note.trim(), subteam, taskIds };
  const moveStart = (start) => start < now && onUpdate({ start });
  return (
    <div className="shift-wrap" ref={box}>
      <button
        className={`shift-pill${open ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`On shift for ${timer(now - shift.start)}`}
        title="Your shift"
      >
        <span className="shift-live" aria-hidden="true" />
        <span className="shift-pill-label">On shift</span>
        {timer(now - shift.start)}
      </button>
      {open && (
        <div className="shift-pop" role="dialog" aria-label="Your shift">
          <div className="shift-pop-head">
            <b>On shift since {clock(shift.start)}</b>
            <span className="muted small">{timer(now - shift.start)} so far</span>
          </div>
          <div className="shift-earlier">
            <span className="muted small">Started earlier?</span>
            {[15, 30, 60].map((m) => (
              <button key={m} className="chip" onClick={() => moveStart(shift.start - m * MIN)}>
                −{m < 60 ? `${m} min` : '1 h'}
              </button>
            ))}
            <input
              type="time"
              className="input shift-time"
              value={at}
              aria-label="Started at"
              onChange={(e) => {
                setAt(e.target.value);
                if (e.target.value) moveStart(startFromTime(e.target.value, now));
              }}
            />
          </div>
          <textarea
            className="input"
            rows={2}
            maxLength={500}
            placeholder="What are you working on?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== (shift.note || '') && onUpdate({ note: note.trim() })}
          />
          <select
            className="input"
            value={subteam}
            aria-label="Subteam"
            onChange={(e) => {
              setSubteam(e.target.value);
              onUpdate({ subteam: e.target.value });
            }}
          >
            <option value="">Subteam (optional)</option>
            {SUBTEAMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <TaskPicks
            tasks={myTasks}
            value={taskIds}
            onChange={(ids) => {
              setTaskIds(ids);
              onUpdate({ taskIds: ids });
            }}
          />
          <button
            className="btn primary big-btn"
            onClick={() => {
              // With the lab log, ending asks what you did first (onEnd).
              if (onEnd) onEnd(details);
              else onUpdate({ ...details, end: Date.now() });
              setOpen(false);
            }}
          >
            End shift now
          </button>
          <div className="row gap">
            <button className="link-btn small" onClick={onOpenTab}>
              Open Shifts tab
            </button>
            <span className="spacer" />
            {now - shift.start < CANCEL_WITHIN && (
              <button className="link-btn small danger" onClick={onCancel}>
                Cancel shift
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Dialog({ title, onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog shift-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
          <div className="panel-head">
            <h2>{title}</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Overlay>
  );
}

// Team management: clock in several people at once (e.g. at the start of a meeting).
function ClockInDialog({ roster, onShift, onDone, onClose }) {
  const [pick, setPick] = useState([]);
  const free = roster.filter((n) => !onShift.includes(n));
  return (
    <Dialog title="Clock people in" onClose={onClose}>
      <p className="muted small">Starts a shift now for everyone you pick.</p>
      <div className="assignee-picker">
        {free.map((n) => {
          const on = pick.includes(n);
          return (
            <button key={n} className={`person${on ? ' on' : ''}`} onClick={() => setPick(on ? pick.filter((x) => x !== n) : [...pick, n])}>
              <Avatar name={n} size={20} /> {firstName(n)}
            </button>
          );
        })}
      </div>
      <div className="row gap">
        <button className="link-btn small" onClick={() => setPick(pick.length === free.length ? [] : free)}>
          {pick.length === free.length ? 'Clear' : 'Everyone'}
        </button>
        <span className="spacer" />
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!pick.length} onClick={() => onDone(pick)}>
          Clock in {pick.length || ''}
        </button>
      </div>
    </Dialog>
  );
}

// Team management: plan a shift, optionally every week.
function PlanDialog({ onDone, onClose }) {
  const [p, setP] = useState({ date: addDays(todayISO(), 1), start: '15:30', end: '18:00', title: '', subteam: '', weeks: 1 });
  const set = (patch) => setP({ ...p, ...patch });
  const ok = p.date && p.start && p.end && p.end > p.start;
  return (
    <Dialog title="Plan a shift" onClose={onClose}>
      <div className="fields">
        <label className="field-label" htmlFor="sp-title">
          What
        </label>
        <input
          id="sp-title"
          className="input"
          value={p.title}
          placeholder="e.g. Build session"
          onChange={(e) => set({ title: e.target.value })}
        />
        <label className="field-label" htmlFor="sp-date">
          Date
        </label>
        <input id="sp-date" type="date" className="input" value={p.date} onChange={(e) => set({ date: e.target.value })} />
        <span className="field-label">Time</span>
        <div className="row gap">
          <input type="time" className="input" value={p.start} aria-label="Starts" onChange={(e) => set({ start: e.target.value })} />
          <span className="muted">to</span>
          <input type="time" className="input" value={p.end} aria-label="Ends" onChange={(e) => set({ end: e.target.value })} />
        </div>
        <label className="field-label" htmlFor="sp-sub">
          Subteam
        </label>
        <select id="sp-sub" className="input" value={p.subteam} onChange={(e) => set({ subteam: e.target.value })}>
          <option value="">Whole team</option>
          {SUBTEAMS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="field-label" htmlFor="sp-rep">
          Repeat
        </label>
        <select id="sp-rep" className="input" value={p.weeks} onChange={(e) => set({ weeks: Number(e.target.value) })}>
          <option value={1}>Just once</option>
          {[4, 8, 12].map((w) => (
            <option key={w} value={w}>
              Weekly for {w} weeks
            </option>
          ))}
        </select>
      </div>
      <div className="row gap">
        <span className="spacer" />
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!ok}
          onClick={() => {
            const repeatId = p.weeks > 1 ? `r${Date.now().toString(36)}` : '';
            onDone(
              Array.from({ length: p.weeks }, (_, i) => ({
                date: addDays(p.date, i * 7),
                start: p.start,
                end: p.end,
                title: p.title.trim(),
                subteam: p.subteam,
                ...(repeatId ? { repeatId } : {}),
              })),
            );
          }}
        >
          Add {p.weeks > 1 ? `${p.weeks} shifts` : 'shift'}
        </button>
      </div>
    </Dialog>
  );
}

// Requests to add a shift reach back at most this far (matches firestore.rules).
const REQUEST_DAYS = 60;

// Edit a past shift (or add a missed one). Team management changes anything.
// Everyone else, on their own finished shifts: shorter saves right away,
// longer (or a missed one) goes to team management to approve first.
function ShiftDialog({ shift, roster, tasks, isManager, me, pending, history, rename, onSave, onDelete, onTakeBack, onClose }) {
  const isNew = !shift.id;
  const [s, setS] = useState({
    person: shift.person || (isManager ? '' : me),
    start: toInput(shift.start || Date.now() - 2 * HOUR),
    end: shift.end ? toInput(shift.end) : isNew && !isManager ? toInput(Date.now() - HOUR) : '',
    note: shift.note || '',
    subteam: shift.subteam || '',
    taskIds: shift.taskIds || [],
  });
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setS({ ...s, ...patch });
  // The boxes show whole minutes; a time left as it was keeps its seconds, so
  // it doesn't read as a change (or as a longer shift).
  const start = shift.start && s.start === toInput(shift.start) ? shift.start : new Date(s.start).getTime();
  const end = shift.end && s.end === toInput(shift.end) ? shift.end : s.end ? new Date(s.end).getTime() : null;
  // Teammates change the times of their own finished shifts (or ask for a missed one).
  const ownTimes = !isManager && (isNew || !!shift.end);
  const showTimes = isManager || ownTimes;
  const longer = ownTimes && !isNew && start && end && (start < shift.start || end > shift.end);
  const shorter = ownTimes && !isNew && !longer && start && end && (start !== shift.start || end !== shift.end);
  // A missed or finished shift needs its end (without one it would count as
  // still running, from back then until now); only a shift that is still
  // running can stay open. Over 16 hours is almost always a typo in the date.
  const problem = !showTimes
    ? ''
    : !start
      ? 'Pick when it started.'
      : (isNew || shift.end) && !end
        ? 'Pick when it ended.'
        : end && end <= start
          ? 'It has to end after it starts.'
          : end && end - start > 16 * HOUR
            ? `That’s ${hoursLabel(end - start)}. Check the dates.`
            : start > Date.now() + 5 * MIN || (end && end > Date.now() + 5 * MIN)
              ? 'That’s in the future.'
              : !isManager && (isNew || longer) && start < Date.now() - REQUEST_DAYS * 24 * HOUR
                ? `That’s more than ${REQUEST_DAYS} days ago. Ask team management.`
                : '';
  const ok = s.person && start && !problem && !busy;
  const theirTasks = tasks.filter((t) => (t.assignees || []).includes(s.person) || s.taskIds.includes(t.id));
  const asks = !isManager && (isNew || longer);
  const title = isNew ? (isManager ? 'Add a missed shift' : 'Ask to add a missed shift') : 'Edit shift';
  const run = async (fn) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  return (
    <Dialog title={title} onClose={onClose}>
      {asks && <p className="muted small">Team management approves it first. Until then it doesn’t count toward hours or coins.</p>}
      {pending && (
        <div className="shift-pending-note">
          <span className="shift-badge wait">waiting for approval</span>
          <span className="small">
            You asked for <span className="mono">{clock(pending.start)}–{clock(pending.end)}</span>
          </span>
          <span className="spacer" />
          <button className="link-btn small" onClick={() => run(onTakeBack)}>
            Take back
          </button>
        </div>
      )}
      <div className="fields">
        {isManager && (
          <>
            <label className="field-label" htmlFor="sh-person">
              Who
            </label>
            <select id="sh-person" className="input" value={s.person} onChange={(e) => set({ person: e.target.value })}>
              <option value="">Pick someone</option>
              {roster.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </>
        )}
        {showTimes && (
          <>
            <label className="field-label" htmlFor="sh-start">
              Start
            </label>
            <input id="sh-start" type="datetime-local" className="input" value={s.start} onChange={(e) => set({ start: e.target.value })} />
            <label className="field-label" htmlFor="sh-end">
              End
            </label>
            <input id="sh-end" type="datetime-local" className="input" value={s.end} onChange={(e) => set({ end: e.target.value })} />
            <span />
            <span className={`small${problem ? ' danger' : ' muted'}`}>
              {problem ||
                (end
                  ? `${hoursLabel(end - start)}${
                      longer ? ' · longer, so team management approves it' : shorter ? ' · shorter, saves right away' : ''
                    }`
                  : 'Still running')}
            </span>
          </>
        )}
        <label className="field-label" htmlFor="sh-sub">
          Subteam
        </label>
        <select id="sh-sub" className="input" value={s.subteam} onChange={(e) => set({ subteam: e.target.value })}>
          <option value="">None</option>
          {SUBTEAMS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <label className="field-label" htmlFor="sh-note">
          Worked on
        </label>
        <textarea id="sh-note" className="input" rows={2} maxLength={500} value={s.note} onChange={(e) => set({ note: e.target.value })} />
        {theirTasks.length > 0 && (
          <>
            <span className="field-label">Tasks</span>
            <TaskPicks tasks={theirTasks} value={s.taskIds} onChange={(taskIds) => set({ taskIds })} />
          </>
        )}
      </div>
      {isManager && history?.length > 0 && (
        <div className="shift-history">
          <span className="field-label">Changes</span>
          <ul>
            {history.map((e) => (
              <li key={e.id} className="small">
                <EditLine edit={e} rename={rename} withPerson={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {sure ? (
        <div className="row gap shift-sure" role="group" aria-label="Delete this shift?">
          <span className="small">
            <b>Delete this shift?</b> {isManager ? '' : 'Its hours and coins go away.'}
          </span>
          <span className="spacer" />
          <button className="btn" onClick={() => setSure(false)}>
            Keep it
          </button>
          <button className="btn danger" disabled={busy} onClick={() => run(onDelete)}>
            Delete
          </button>
        </div>
      ) : (
        <div className="row gap">
          {!isNew && (isManager || shift.end) && (
            <button className="link-btn danger" onClick={() => setSure(true)}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!ok}
            onClick={() => {
              const details = { note: s.note.trim(), subteam: s.subteam, taskIds: s.taskIds };
              run(() =>
                onSave(
                  isManager
                    ? { person: s.person, start, end, ...details, autoEnded: false }
                    : ownTimes
                      ? { start, end, ...details }
                      : details,
                  { longer, shorter },
                ),
              );
            }}
          >
            {asks ? 'Ask team management' : isNew ? 'Add shift' : 'Save'}
          </button>
        </div>
      )}
    </Dialog>
  );
}

// One change from shiftEdits, in plain words: "Cooper made their shift
// shorter: 3:00–5:00 PM → 3:00–4:30 PM · Tue 4:12 PM".
const EDIT_WORDS = {
  shorten: 'made a shift shorter',
  delete: 'deleted a shift',
  edit: 'changed a shift',
  add: 'added a shift',
  approve: 'approved a request',
};
function EditLine({ edit: e, rename, withPerson = true }) {
  const by = rename(e.by || '');
  const person = rename(e.person || '');
  const whose = person === by ? '' : ` for ${firstName(person)}`;
  const times = (t) => (t ? `${clock(t.start)}–${t.end ? clock(t.end) : 'now'}` : '');
  return (
    <>
      <b>{firstName(by)}</b> {EDIT_WORDS[e.kind] || 'changed a shift'}
      {withPerson ? whose : ''}
      {': '}
      <span className="mono">
        {e.before ? `${dayLabel(toISO(new Date(e.before.start)))} ${times(e.before)}` : ''}
        {e.before && e.after ? ' → ' : ''}
        {e.after ? `${e.before ? '' : `${dayLabel(toISO(new Date(e.after.start)))} `}${times(e.after)}` : ''}
      </span>
      <span className="muted">
        {' · '}
        {dayLabel(toISO(new Date(e.at)))} {clock(e.at)}
      </span>
    </>
  );
}

// Asking to add a missed shift or make one longer. Team management sees
// everyone's with Approve / Decline; everyone else sees their own, waiting.
function ShiftRequests({ requests, shiftsById, isManager, me, rename, api }) {
  const [busy, setBusy] = useState('');
  const mine = (r) => rename(r.person || '') === me;
  const shown = requests
    .filter((r) => (isManager ? r.status === 'pending' : mine(r) && (r.status === 'pending' || r.decidedAt > Date.now() - 3 * 24 * HOUR)))
    .sort((a, b) => a.at - b.at);
  if (!shown.length) return null;
  const act = async (id, fn) => {
    setBusy(id);
    await fn();
    setBusy('');
  };
  return (
    <section className="chart-card shift-requests">
      <div className="shift-sec-head">
        <h2>{isManager ? 'Waiting for approval' : 'Your requests'}</h2>
        <span className="muted small mono">{shown.length}</span>
      </div>
      <ul className="shift-req-list">
        {shown.map((r) => {
          const person = rename(r.person || '');
          const shift = r.kind === 'extend' ? shiftsById.get(r.shiftId) : null;
          const gone = r.kind === 'extend' && !shift;
          return (
            <li key={r.id}>
              <Avatar name={person} size={26} />
              <div className="grow">
                <div className="shift-log-top">
                  <b>{isManager ? person : r.kind === 'add' ? 'Add a missed shift' : 'Make a shift longer'}</b>
                  {isManager && <span className="muted small">{r.kind === 'add' ? 'asks to add a missed shift' : 'asks to make a shift longer'}</span>}
                </div>
                <span className="small block shift-req-when">
                  {dayLabel(toISO(new Date(r.start)))} ·{' '}
                  {r.kind === 'extend' && (
                    <>
                      <s className="muted mono">
                        {clock(r.oldStart)}–{clock(r.oldEnd)}
                      </s>{' '}
                      →{' '}
                    </>
                  )}
                  <b className="mono">
                    {clock(r.start)}–{clock(r.end)}
                  </b>
                  <span className="muted mono"> · {hoursLabel(r.end - r.start)}</span>
                </span>
                {r.note && <p className="shift-note">{r.note}</p>}
                {gone && <span className="small danger block">That shift was deleted.</span>}
              </div>
              {isManager ? (
                <div className="shift-req-actions">
                  <button
                    className="btn small-btn"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, () => api.decideShiftRequest(r, false, shift))}
                  >
                    Decline
                  </button>
                  <button
                    className="btn primary small-btn"
                    disabled={busy === r.id || gone}
                    onClick={() => act(r.id, () => api.decideShiftRequest(r, true, shift))}
                  >
                    Approve
                  </button>
                </div>
              ) : r.status === 'pending' ? (
                <div className="shift-req-actions">
                  <span className="shift-badge wait">waiting for approval</span>
                  <button className="link-btn small" disabled={busy === r.id} onClick={() => act(r.id, () => api.cancelShiftRequest(r.id))}>
                    Take back
                  </button>
                </div>
              ) : (
                <div className="shift-req-actions">
                  <span className={`shift-badge ${r.status === 'approved' ? 'ok' : 'no'}`}>{r.status}</span>
                  <button className="link-btn small" disabled={busy === r.id} onClick={() => act(r.id, () => api.cancelShiftRequest(r.id))}>
                    OK
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Team management: the latest changes to finished shifts, newest first.
function ShiftChanges({ edits, rename }) {
  const [all, setAll] = useState(false);
  if (!edits.length) return null;
  return (
    <section className="chart-card shift-changes">
      <div className="shift-sec-head">
        <h2>Shift changes</h2>
        <span className="muted small">Only team management sees these</span>
      </div>
      <ul className="shift-change-list">
        {(all ? edits : edits.slice(0, 5)).map((e) => (
          <li key={e.id} className="small">
            <Avatar name={rename(e.person || '')} size={20} />
            <span className="grow">
              <EditLine edit={e} rename={rename} />
            </span>
          </li>
        ))}
      </ul>
      {edits.length > 5 && (
        <button className="link-btn small" onClick={() => setAll(!all)}>
          {all ? 'Show less' : `Show all ${edits.length}`}
        </button>
      )}
    </section>
  );
}

// Shift RSVPs under current names. They're saved by name, so after a rename
// an old key still counts as that person; one saved under the current name wins.
function answersByName(people, rename) {
  const out = new Map();
  for (const [k, v] of Object.entries(people || {})) {
    const name = rename(k);
    if (k === name || !out.has(name)) out.set(name, v);
  }
  return out;
}

function downloadCsv(rows, tasksById) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Name', 'Date', 'Start', 'End', 'Hours', 'Subteam', 'Worked on', 'Tasks', 'Auto-ended']];
  for (const s of rows) {
    if (!s.end) continue;
    lines.push([
      s.person,
      toISO(new Date(s.start)),
      clock(s.start),
      clock(s.end),
      ((s.end - s.start) / HOUR).toFixed(2),
      s.subteam,
      s.note,
      (s.taskIds || [])
        .map((id) => tasksById.get(id)?.title || '')
        .filter(Boolean)
        .join('; '),
      s.autoEnded ? 'yes' : '',
    ]);
  }
  const blob = new Blob([lines.map((l) => l.map(q).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shifts-${todayISO()}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

const PERIODS = [
  ['week', 'This week'],
  ['last', 'Last week'],
  ['all', 'All'],
];
function inPeriod(s, period) {
  if (period === 'all') return true;
  const monday = parseDay(mondayOf(todayISO())).getTime();
  const from = period === 'week' ? monday : monday - 7 * 24 * HOUR;
  const to = period === 'week' ? Infinity : monday;
  return s.start >= from && s.start < to;
}

// The team's season: hours, tasks finished, practice runs, each with this
// week against last week (shared/stats.js).
const round1 = (x) => Math.round(x * 10) / 10;
export function SeasonStrip({ stats }) {
  const hourDiff = round1(hoursOf(stats.hours.week) - hoursOf(stats.hours.last));
  const items = [
    ['Team hours', hoursOf(stats.hours.season).toFixed(1), hoursOf(stats.hours.week).toFixed(1), hourDiff],
    ['Tasks finished', stats.tasks.season, stats.tasks.week, stats.tasks.week - stats.tasks.last],
    ['Practice runs logged', stats.runs.season, stats.runs.week, stats.runs.week - stats.runs.last],
  ];
  return (
    <section className="season-strip" aria-labelledby="season-strip-h">
      <h2 id="season-strip-h">Team this season</h2>
      <div className="ss-items">
        {items.map(([label, season, week, diff]) => (
          <div key={label} className="ss-item">
            <b className="mono">{season}</b>
            <span className="ss-label">{label}</span>
            <span className="ss-week">
              <span className="mono">{week}</span> this week,{' '}
              <span className={diff > 0 ? 'ss-up' : diff < 0 ? 'ss-down' : ''}>{versusLastWeek(diff)}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// "Lab check-in is asked every school day at 12:00 AM", with team
// management's quick skips: "Not today" and "Not tomorrow" (the next school
// day), each undoable. Skipping today also takes back today's automatic
// check-in if it was already asked (Undo puts it back, answers and all).
function ScheduleLine({ schedule, checkins, isManager, api, onEdit }) {
  const today = teamDay(Date.now());
  const skip = schedule.skip || [];
  const [stopping, setStopping] = useState(false);
  const [busy, setBusy] = useState(false);
  const removed = useRef(new Map());
  const save = (nextSkip) => api.saveSettings({ checkinSchedule: { ...schedule, skip: cleanSkips(nextSkip, today) } });
  const run = async (fn) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const skipDay = (day) =>
    run(async () => {
      await save([...skip, day]);
      const asked = day === today && checkins.find((c) => c.date === today && c.auto);
      if (asked) {
        removed.current.set(day, asked);
        await api.deleteCheckin(asked.id);
      }
    });
  const undo = (day) =>
    run(async () => {
      await save(skip.filter((d) => d !== day));
      const back = removed.current.get(day);
      if (back) {
        removed.current.delete(day);
        await api.restoreCheckin(back);
      }
    });
  const next = nextSchoolDay(today);
  const nameOf = (d) =>
    d === today ? 'today' : d === addDays(today, 1) ? 'tomorrow' : parseDay(d).toLocaleDateString(undefined, { weekday: 'long' });
  const quick = [today, next].filter((d) => scheduledOn(schedule, d));
  const later = skip.filter((d) => d >= today && !quick.includes(d));
  return (
    <div className="checkin-schedule">
      {stopping ? (
        <>
          <span>
            <b>Stop asking automatically?</b>
          </span>
          <span className="spacer" />
          <button className="btn small-btn" onClick={() => setStopping(false)}>
            Keep asking
          </button>
          <button
            className="btn small-btn danger"
            onClick={() => api.saveSettings({ checkinSchedule: { ...schedule, on: false } }).then(() => setStopping(false))}
          >
            Stop
          </button>
        </>
      ) : (
        <>
          <span className="ci-sched-text">
            Lab check-in is asked <b>{scheduleText(schedule)}</b>
            {later.length > 0 && (
              <span className="muted small">
                {' '}
                · skipping <span className="mono">{later.map(shortDay).join(', ')}</span>
              </span>
            )}
          </span>
          <span className="ci-quick">
            {quick.map((d) =>
              skip.includes(d) ? (
                <span key={d} className="ci-skipped">
                  Skipped {nameOf(d)}
                  {isManager && (
                    <>
                      {' · '}
                      <button className="link-btn small" disabled={busy} onClick={() => undo(d)}>
                        Undo
                      </button>
                    </>
                  )}
                </span>
              ) : (
                isManager && (
                  <button key={d} className="chip" disabled={busy} onClick={() => skipDay(d)}>
                    Not {nameOf(d)}
                  </button>
                )
              ),
            )}
          </span>
          {isManager && (
            <>
              <span className="spacer" />
              <button className="link-btn small" onClick={onEdit}>
                Edit
              </button>
              <button className="link-btn small danger" onClick={() => setStopping(true)}>
                Stop
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
const shortDay = (d) => parseDay(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function ShiftsView({
  shifts,
  plans,
  actor,
  roster,
  tasks,
  goal,
  api,
  rename,
  onStartMine,
  onOpenMine,
  onOpenTask,
  checkins = [],
  checkinSchedule,
  gradeOf,
  requests = [],
  edits = [],
  runs = [],
}) {
  const now = useNow(30000);
  const isManager = actor.admin;
  const me = actor.name;
  const [dialog, setDialog] = useState(null); // 'clockin' | 'plan' | 'checkin' | { shift }
  const [hoursPeriod, setHoursPeriod] = useState('all');
  const [period, setPeriod] = useState('week');
  const [who, setWho] = useState('');
  const [sub, setSub] = useState('');
  const [more, setMore] = useState(false);
  const [moreLog, setMoreLog] = useState(40);

  const all = useMemo(() => shifts.map((s) => ({ ...s, person: rename(s.person || '') })), [shifts, rename]);
  const running = all.filter((s) => !s.end).sort((a, b) => a.start - b.start);
  const onShift = running.map((s) => s.person);
  const mine = running.find((s) => s.person === me);
  const tasksById = useMemo(() => new Map((tasks || []).map((t) => [t.id, t])), [tasks]);

  const upcoming = plans.filter((p) => planMs(p.date, p.end) > now).sort((a, b) => planMs(a.date, a.start) - planMs(b.date, b.start));
  const shownPlans = more ? upcoming : upcoming.slice(0, 6);

  // Overlapping shifts for one person count once (shared/hours.js), here and
  // in the tiles, profiles, and coins.
  const totals = useMemo(() => {
    const m = msByPerson(all, now, (s) => inPeriod(s, hoursPeriod === 'all' ? 'all' : 'week'));
    if (!m.has(me)) m.set(me, 0);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [all, hoursPeriod, now, me]);
  const goalMs = (Number(goal) || 0) * HOUR;
  const barMax = hoursPeriod === 'all' && goalMs ? goalMs : Math.max(...totals.map(([, v]) => v), HOUR);
  const myAll = msOf(me, all, now);
  const myWeek = msOf(me, all, now, (s) => inPeriod(s, 'week'));
  const stats = useMemo(() => seasonStats({ shifts: all, tasks: tasks || [], runs, now }), [all, tasks, runs, now]);
  const streak = useMemo(() => streaksOf(me, all, now), [me, all, now]);

  const log = all
    .filter((s) => inPeriod(s, period) && (!who || s.person === who) && (!sub || s.subteam === sub))
    .sort((a, b) => b.start - a.start);

  // Shifts as saved (their person under the name they were saved with): the
  // rules check the change against exactly that.
  const savedById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const pendingFor = useMemo(
    () => new Map(requests.filter((r) => r.status === 'pending' && r.kind === 'extend').map((r) => [r.shiftId, r])),
    [requests],
  );
  const editsFor = (id) => edits.filter((e) => e.shiftId === id);

  // Team management: anything, each change to the times recorded. Everyone
  // else, on their own finished shifts: shorter saves right away (recorded),
  // longer or missed ones are asked for; notes save as before.
  const save = async (shift, patch, { longer, shorter }) => {
    const saved = savedById.get(shift.id);
    let done;
    if (isManager) {
      if (!shift.id) done = await api.addShift(patch);
      else if (patch.start !== saved.start || patch.end !== saved.end || patch.person !== shift.person)
        done = await api.editShift(saved, { ...patch, person: patch.person === shift.person ? saved.person : patch.person }, 'edit');
      else done = (await api.updateShift(shift.id, { ...patch, person: saved.person })) !== false;
    } else if (!shift.id) {
      done = await api.requestShift({ kind: 'add', person: me, ...patch });
    } else {
      const { start, end, ...details } = patch;
      const detailsChanged =
        details.note !== (saved.note || '') ||
        details.subteam !== (saved.subteam || '') ||
        (details.taskIds || []).join() !== (saved.taskIds || []).join();
      if (shorter) done = await api.editShift(saved, patch, 'shorten');
      else {
        done = true;
        if (detailsChanged) done = (await api.updateShift(shift.id, details)) !== false;
        if (longer && done)
          done = await api.requestShift({
            kind: 'extend',
            person: saved.person,
            shiftId: saved.id,
            start,
            end,
            oldStart: saved.start,
            oldEnd: saved.end,
            note: details.note,
          });
      }
    }
    if (done) setDialog(null);
  };
  const remove = async (shift) => {
    const saved = savedById.get(shift.id);
    if (await api.removeShift(saved)) setDialog(null);
  };

  return (
    <main className="content shifts">
      <div className="ms-header">
        <div>
          <h1>Shifts</h1>
        </div>
        <span className="spacer" />
        {isManager && (
          <button className="btn" onClick={() => setDialog('checkin')}>
            Lab check-in
          </button>
        )}
        {mine ? (
          <button className="btn primary" onClick={onOpenMine}>
            End my shift
          </button>
        ) : (
          <button className="btn primary" onClick={() => onStartMine()}>
            Start shift now
          </button>
        )}
      </div>

      {checkinSchedule?.on && (
        <ScheduleLine
          schedule={checkinSchedule}
          checkins={checkins}
          isManager={isManager}
          api={api}
          onEdit={() => setDialog('checkin')}
        />
      )}
      {checkins.map((c) => (
        <CheckinCard
          key={c.id}
          checkin={c}
          roster={roster}
          gradeOf={gradeOf}
          me={me}
          isManager={isManager}
          rename={rename}
          onAnswer={(a) => api.answerCheckin(c.id, a)}
          onDelete={() => api.deleteCheckin(c.id)}
        />
      ))}

      <div className="stat-tiles">
        <div className="stat">
          <span>Your hours this week</span>
          <b>{hoursOf(myWeek).toFixed(1)}</b>
        </div>
        <div className="stat">
          <span>Your hours, season</span>
          <b>
            {hoursOf(myAll).toFixed(1)}
            {goal ? <small> of {goal}</small> : null}
          </b>
        </div>
        <div className="stat" title="School days in a row with a shift (days without school don’t break it), and weeks in a row">
          <span>Your streaks</span>
          <b>
            {streak.daily}
            <small> {streak.daily === 1 ? 'day' : 'days'}</small> · {streak.weekly}
            <small> {streak.weekly === 1 ? 'week' : 'weeks'}</small>
          </b>
        </div>
      </div>

      <SeasonStrip stats={stats} />

      <ShiftRequests requests={requests} shiftsById={savedById} isManager={isManager} me={me} rename={rename} api={api} />

      <div className="shift-grid">
        <section className="chart-card">
          <div className="shift-sec-head">
            <h2>At the lab now</h2>
            <span className="spacer" />
            {isManager && (
              <button className="btn small-btn" onClick={() => setDialog('clockin')}>
                Clock in…
              </button>
            )}
          </div>
          {running.length ? (
            <ul className="shift-now">
              {running.map((s) => (
                <li key={s.id}>
                  <Avatar name={s.person} size={30} />
                  <div className="grow">
                    <b>{s.person}</b>
                    <span className="muted small block">
                      since {clock(s.start)}
                      {s.subteam ? ` · ${s.subteam}` : ''}
                      {s.note ? ` · ${s.note}` : ''}
                    </span>
                  </div>
                  <span className="shift-elapsed">{timer(now - s.start)}</span>
                  {s.person === me ? (
                    <button className="btn small-btn" onClick={onOpenMine}>
                      End
                    </button>
                  ) : (
                    isManager && (
                      <button
                        className="btn small-btn"
                        // Ending it for them skips the lab log they'd fill in when ending it themselves.
                        onClick={async () =>
                          (await confirmDialog({
                            title: `End ${s.person.split(' ')[0]}’s shift now?`,
                            body: 'They won’t get to fill in their lab log first.',
                            okLabel: 'End shift',
                          })) && api.updateShift(s.id, { end: Date.now() })
                        }
                      >
                        End
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nobody’s clocked in.</p>
          )}
        </section>

        <section className="chart-card">
          <div className="shift-sec-head">
            <h2>Schedule</h2>
            <span className="spacer" />
            {isManager && (
              <button className="btn small-btn" onClick={() => setDialog('plan')}>
                <PlusIcon /> Plan a shift
              </button>
            )}
          </div>
          {shownPlans.length ? (
            <ul className="shift-plans">
              {shownPlans.map((p) => {
                const answers = answersByName(p.people, rename);
                const answer = answers.get(me) || '';
                const going = [...answers].filter(([, v]) => v === 'in').map(([n]) => n);
                const out = [...answers.values()].filter((v) => v === 'out').length;
                // Answers saved under an old name of mine get replaced by this one.
                const oldKeys = Object.keys(p.people || {}).filter((k) => k !== me && rename(k) === me);
                const rsvp = (a) => api.rsvpShiftPlan(p.id, a, oldKeys);
                const live = now >= planMs(p.date, p.start) - 15 * MIN && now < planMs(p.date, p.end);
                return (
                  <li key={p.id} className={live ? 'live' : ''}>
                    <div className="plan-when">
                      <b>{dayLabel(p.date)}</b>
                      <span className="muted small">
                        {clock(planMs(p.date, p.start))}–{clock(planMs(p.date, p.end))}
                      </span>
                    </div>
                    <div className="grow">
                      <b>{p.title || 'Shift'}</b>
                      {p.subteam && <span className="tag plan-sub">{p.subteam}</span>}
                      <div className="plan-who">
                        {going.length > 0 && <AvatarStack names={going} max={5} size={22} />}
                        <span className="muted small">
                          {going.length} going{out ? ` · ${out} can’t` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="plan-actions">
                      {live && !mine ? (
                        <button className="btn primary small-btn" onClick={() => onStartMine({ planId: p.id, subteam: p.subteam })}>
                          Clock in now
                        </button>
                      ) : (
                        <div className="segmented">
                          <button
                            className={`plain-seg${answer === 'in' ? ' on' : ''}`}
                            onClick={() => rsvp(answer === 'in' ? null : 'in')}
                          >
                            I’m in
                          </button>
                          <button
                            className={`plain-seg${answer === 'out' ? ' on' : ''}`}
                            onClick={() => rsvp(answer === 'out' ? null : 'out')}
                          >
                            Can’t
                          </button>
                        </div>
                      )}
                      {isManager && (
                        <button
                          className="icon-btn small"
                          aria-label="Delete planned shift"
                          title="Delete"
                          onClick={async () => {
                            if (!(await confirmDialog({ title: 'Delete this planned shift?', okLabel: 'Delete', danger: true }))) return;
                            const later = p.repeatId
                              ? plans.filter((x) => x.repeatId === p.repeatId && x.date > p.date).map((x) => x.id)
                              : [];
                            const alsoLater =
                              later.length > 0 &&
                              (await confirmDialog({
                                title: `Also delete the ${later.length} later ${later.length === 1 ? 'repeat' : 'repeats'}?`,
                                okLabel: 'Delete them too',
                                cancelLabel: 'Just this one',
                                danger: true,
                              }));
                            api.deleteShiftPlans([p.id, ...(alsoLater ? later : [])]);
                          }}
                        >
                          <CloseIcon />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted small">{isManager ? 'Nothing planned. Tap Plan a shift.' : 'Nothing planned yet.'}</p>
          )}
          {upcoming.length > 6 && (
            <button className="link-btn small" onClick={() => setMore(!more)}>
              {more ? 'Show less' : `Show all ${upcoming.length}`}
            </button>
          )}
        </section>
      </div>

      <section className="chart-card">
        <div className="shift-sec-head">
          <h2>Hours</h2>
          <div className="segmented">
            {[
              ['all', 'Season'],
              ['week', 'This week'],
            ].map(([id, label]) => (
              <button key={id} className={`plain-seg${hoursPeriod === id ? ' on' : ''}`} onClick={() => setHoursPeriod(id)}>
                {label}
              </button>
            ))}
          </div>
          <span className="spacer" />
          {isManager ? (
            <label className="muted small shift-goal">
              Season goal
              <input
                type="number"
                min="0"
                max="1000"
                className="input"
                // Remounts when the goal changes elsewhere, so the box shows it.
                key={goal || 0}
                defaultValue={goal || ''}
                placeholder="—"
                onBlur={(e) =>
                  Number(e.target.value) !== (Number(goal) || 0) && api.saveSettings({ shiftGoal: Number(e.target.value) || 0 })
                }
              />
              h
            </label>
          ) : (
            goal > 0 && <span className="muted small">Season goal: {goal} h</span>
          )}
          <button
            className="btn small-btn"
            onClick={() =>
              downloadCsv(
                [...all].sort((a, b) => a.start - b.start),
                tasksById,
              )
            }
          >
            Export CSV
          </button>
        </div>
        <ol className="shift-board">
          {totals.map(([name, ms], i) => (
            <li key={name} className={name === me ? 'me' : ''}>
              <span className="rank">{ms ? i + 1 : '–'}</span>
              <Avatar name={name} size={24} />
              <span className="shift-name">{name}</span>
              <span className="shift-bar">
                <span style={{ width: `${Math.min(100, (ms / barMax) * 100)}%` }} />
              </span>
              <b className="shift-hours">{hoursText(ms)}</b>
            </li>
          ))}
        </ol>
      </section>

      <section className="chart-card">
        <div className="shift-sec-head">
          <h2>Log</h2>
          <span className="spacer" />
          <button className="btn small-btn" onClick={() => setDialog({ shift: {} })}>
            <PlusIcon /> Add a missed shift
          </button>
        </div>
        <div className="parts-filters">
          {PERIODS.map(([id, label]) => (
            <button key={id} className={`chip${period === id ? ' on' : ''}`} onClick={() => setPeriod(id)}>
              {label}
            </button>
          ))}
          <select className="input small-select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
            <option value="">Everyone</option>
            {roster.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select className="input small-select" value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Subteam">
            <option value="">All subteams</option>
            {SUBTEAMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {log.length ? (
          <ul className="shift-log">
            {log.slice(0, moreLog).map((s) => {
              const canEdit = isManager || (s.person === me && s.end);
              return (
                <li key={s.id}>
                  <Avatar name={s.person} size={26} />
                  <div className="grow">
                    <div className="shift-log-top">
                      <b>{s.person}</b>
                      <span className="muted small">
                        {dayLabel(toISO(new Date(s.start)))} · {clock(s.start)}–{s.end ? clock(s.end) : 'now'}
                      </span>
                      {s.subteam && <span className="tag">{s.subteam}</span>}
                      {!s.end && <span className="shift-badge live">on shift</span>}
                      {s.autoEnded && (
                        <span className="shift-badge" title="Ended automatically after midnight">
                          auto-ended
                        </span>
                      )}
                      {pendingFor.has(s.id) && <span className="shift-badge wait">waiting for approval</span>}
                      {s.editedAt && (
                        <span className="muted tiny shift-edited">
                          edited by {firstName(rename(s.editedBy || ''))}{' '}
                          {toISO(new Date(s.editedAt)) === toISO(new Date(now))
                            ? `at ${clock(s.editedAt)}`
                            : `· ${dayLabel(toISO(new Date(s.editedAt)))}`}
                        </span>
                      )}
                    </div>
                    {s.note && <p className="shift-note">{s.note}</p>}
                    {(s.taskIds || []).some((id) => tasksById.has(id)) && (
                      <div className="shift-task-links">
                        {s.taskIds
                          .filter((id) => tasksById.has(id))
                          .map((id) => (
                            <button key={id} className="link-btn small" onClick={() => onOpenTask(id)}>
                              {tasksById.get(id).title}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <b className="shift-hours">{hoursText(lengthOf(s, now))}</b>
                  {canEdit && (
                    <button className="link-btn small" onClick={() => setDialog({ shift: s })}>
                      Edit
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted small">No shifts here yet.</p>
        )}
        {log.length > moreLog && (
          <button className="link-btn small" onClick={() => setMoreLog(moreLog + 40)}>
            Show more
          </button>
        )}
      </section>

      {isManager && <ShiftChanges edits={edits} rename={rename} />}

      {dialog === 'clockin' && (
        <ClockInDialog
          roster={roster}
          onShift={onShift}
          onClose={() => setDialog(null)}
          onDone={async (people) => {
            await api.startShifts(people, Date.now());
            setDialog(null);
          }}
        />
      )}
      {dialog === 'checkin' && (
        <CheckinDialog
          schedule={checkinSchedule}
          onClose={() => setDialog(null)}
          onDone={async (data) => {
            await api.addCheckin(data);
            setDialog(null);
          }}
          onSchedule={async (sched) => {
            await api.saveSettings({ checkinSchedule: { ...sched, by: actor.name } });
            setDialog(null);
          }}
        />
      )}
      {dialog === 'plan' && (
        <PlanDialog
          onClose={() => setDialog(null)}
          onDone={async (list) => {
            await api.addShiftPlans(list);
            setDialog(null);
          }}
        />
      )}
      {dialog?.shift && (
        <ShiftDialog
          shift={dialog.shift}
          roster={roster}
          tasks={tasks || []}
          isManager={isManager}
          me={me}
          rename={rename}
          pending={!isManager && pendingFor.get(dialog.shift.id)}
          history={isManager && dialog.shift.id ? editsFor(dialog.shift.id) : []}
          onClose={() => setDialog(null)}
          onSave={(patch, how) => save(dialog.shift, patch, how)}
          onDelete={() => remove(dialog.shift)}
          onTakeBack={async () => {
            if (await api.cancelShiftRequest(pendingFor.get(dialog.shift.id).id)) setDialog(null);
          }}
        />
      )}
    </main>
  );
}
