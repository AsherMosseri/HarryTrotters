import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { SUBTEAMS } from '../config.js';
import { addDays, mondayOf, parseDay, toISO, todayISO } from '../milestones.js';
import { firstName } from '../util.js';
import { Avatar, AvatarStack, CloseIcon, Overlay, PlusIcon } from './common.jsx';
import { CheckinCard, CheckinDialog, scheduleText } from './Checkin.jsx';

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
const hoursText = (ms) => {
  const h = ms / HOUR;
  return h < 10 ? `${h.toFixed(1)} h` : `${Math.round(h)} h`;
};
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
// A time picked for "I started at": today, or yesterday if that's still ahead.
const startFromTime = (hhmm, now) => {
  const t = planMs(todayISO(), hhmm);
  return t > now ? t - 24 * HOUR : t;
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

// Edit a past shift (or add a missed one). Team management changes anything;
// everyone else only their own notes.
function ShiftDialog({ shift, roster, tasks, isManager, onSave, onDelete, onClose }) {
  const isNew = !shift.id;
  const [s, setS] = useState({
    person: shift.person || '',
    start: toInput(shift.start || Date.now() - 2 * HOUR),
    end: shift.end ? toInput(shift.end) : '',
    note: shift.note || '',
    subteam: shift.subteam || '',
    taskIds: shift.taskIds || [],
  });
  const set = (patch) => setS({ ...s, ...patch });
  const start = new Date(s.start).getTime();
  const end = s.end ? new Date(s.end).getTime() : null;
  const ok = s.person && start && (!isManager || !s.end || end > start);
  const theirTasks = tasks.filter((t) => (t.assignees || []).includes(s.person) || s.taskIds.includes(t.id));
  return (
    <Dialog title={isNew ? 'Add a missed shift' : 'Edit shift'} onClose={onClose}>
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
            <label className="field-label" htmlFor="sh-start">
              Start
            </label>
            <input id="sh-start" type="datetime-local" className="input" value={s.start} onChange={(e) => set({ start: e.target.value })} />
            <label className="field-label" htmlFor="sh-end">
              End
            </label>
            <input id="sh-end" type="datetime-local" className="input" value={s.end} onChange={(e) => set({ end: e.target.value })} />
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
      <div className="row gap">
        {!isNew && isManager && (
          <button className="link-btn danger" onClick={() => confirm('Delete this shift?') && onDelete()}>
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
          onClick={() =>
            onSave(
              isManager
                ? { person: s.person, start, end, note: s.note.trim(), subteam: s.subteam, taskIds: s.taskIds, autoEnded: false }
                : { note: s.note.trim(), subteam: s.subteam, taskIds: s.taskIds },
            )
          }
        >
          {isNew ? 'Add shift' : 'Save'}
        </button>
      </div>
    </Dialog>
  );
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

  const totals = useMemo(() => {
    const m = new Map();
    for (const s of all)
      if (inPeriod(s, hoursPeriod === 'all' ? 'all' : 'week')) m.set(s.person, (m.get(s.person) || 0) + lengthOf(s, now));
    if (!m.has(me)) m.set(me, 0);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [all, hoursPeriod, now, me]);
  const goalMs = (Number(goal) || 0) * HOUR;
  const barMax = hoursPeriod === 'all' && goalMs ? goalMs : Math.max(...totals.map(([, v]) => v), HOUR);
  const myAll = all.filter((s) => s.person === me).reduce((n, s) => n + lengthOf(s, now), 0);
  const myWeek = all.filter((s) => s.person === me && inPeriod(s, 'week')).reduce((n, s) => n + lengthOf(s, now), 0);
  const teamWeek = all.filter((s) => inPeriod(s, 'week')).reduce((n, s) => n + lengthOf(s, now), 0);

  const log = all
    .filter((s) => inPeriod(s, period) && (!who || s.person === who) && (!sub || s.subteam === sub))
    .sort((a, b) => b.start - a.start);

  const save = async (shift, patch) => {
    if (shift.id) await api.updateShift(shift.id, patch);
    else {
      const { person, start, ...rest } = patch;
      await api.startShifts([person], start, rest);
    }
    setDialog(null);
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
        <div className="checkin-schedule">
          <span>
            Lab check-in is asked <b>{scheduleText(checkinSchedule)}</b>
          </span>
          {isManager && (
            <>
              <span className="spacer" />
              <button className="link-btn small" onClick={() => setDialog('checkin')}>
                Edit
              </button>
              <button
                className="link-btn small danger"
                onClick={() =>
                  confirm('Stop asking automatically?') && api.saveSettings({ checkinSchedule: { ...checkinSchedule, on: false } })
                }
              >
                Stop
              </button>
            </>
          )}
        </div>
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
          <b>{(myWeek / HOUR).toFixed(1)}</b>
        </div>
        <div className="stat">
          <span>Your hours, season</span>
          <b>
            {(myAll / HOUR).toFixed(1)}
            {goal ? <small> of {goal}</small> : null}
          </b>
        </div>
        <div className="stat">
          <span>Team hours this week</span>
          <b>{(teamWeek / HOUR).toFixed(1)}</b>
        </div>
      </div>

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
                      <button className="btn small-btn" onClick={() => api.updateShift(s.id, { end: Date.now() })}>
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
                const answer = p.people?.[me] || '';
                const going = Object.entries(p.people || {})
                  .filter(([, v]) => v === 'in')
                  .map(([n]) => rename(n));
                const out = Object.values(p.people || {}).filter((v) => v === 'out').length;
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
                            onClick={() => api.rsvpShiftPlan(p.id, answer === 'in' ? null : 'in')}
                          >
                            I’m in
                          </button>
                          <button
                            className={`plain-seg${answer === 'out' ? ' on' : ''}`}
                            onClick={() => api.rsvpShiftPlan(p.id, answer === 'out' ? null : 'out')}
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
                          onClick={() => {
                            if (!confirm('Delete this planned shift?')) return;
                            const later = p.repeatId
                              ? plans.filter((x) => x.repeatId === p.repeatId && x.date > p.date).map((x) => x.id)
                              : [];
                            const alsoLater = later.length > 0 && confirm(`Also delete the ${later.length} later repeats?`);
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
          {isManager && (
            <button className="btn small-btn" onClick={() => setDialog({ shift: {} })}>
              <PlusIcon /> Add a missed shift
            </button>
          )}
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
                    </div>
                    {s.note && <p className="shift-note">{s.note}</p>}
                    {(s.taskIds || []).some((id) => tasksById.has(id)) && (
                      <div className="shift-task-links">
                        {s.taskIds
                          .filter((id) => tasksById.has(id))
                          .map((id) => (
                            <button key={id} className="link-btn small" onClick={() => onOpenTask(id)}>
                              📋 {tasksById.get(id).title}
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
          onClose={() => setDialog(null)}
          onSave={(patch) => save(dialog.shift, patch)}
          onDelete={async () => {
            await api.deleteShift(dialog.shift.id);
            setDialog(null);
          }}
        />
      )}
    </main>
  );
}
