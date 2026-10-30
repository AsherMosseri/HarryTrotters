import { createContext, useContext, useRef, useState } from 'react';
import { AutoTextarea, Avatar, CloseIcon, DisplayName, Overlay } from './common.jsx';
import { dayLabel, dayOf, hoursOn } from '../labLog.js';

// The lab log (labLog.js): the "what did you do today?" form you fill in when
// you end a shift, and Trotbot's daily post in #lab-log.

// What the #lab-log cards read (Workspace provides it): { logs, shifts,
// tasks, me, isManager, edit(log) }.
export const LabLogContext = createContext(null);

const MAX_PHOTOS = 4;

export function LabLogDialog({ day, person, log, shift, tasks, hours, mode, onSave, onCancel, onSkip, uploadPhoto }) {
  const [note, setNote] = useState(log?.note ?? shift?.note ?? '');
  const [taskIds, setTaskIds] = useState(log?.taskIds ?? shift?.taskIds ?? []);
  const [done, setDone] = useState(log?.doneTaskIds ?? []);
  const [photos, setPhotos] = useState(log?.photos ?? []);
  const [blockers, setBlockers] = useState(log?.blockers ?? '');
  const [next, setNext] = useState(log?.next ?? '');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileInput = useRef(null);
  // Their open tasks, plus any already in the log (even if done since).
  const list = tasks.filter(
    (t) => !t.deletedAt && (((t.assignees || []).includes(person) && t.status !== 'done') || taskIds.includes(t.id)),
  );
  const toggle = (id) => {
    if (taskIds.includes(id)) {
      setTaskIds(taskIds.filter((x) => x !== id));
      setDone(done.filter((x) => x !== id));
    } else setTaskIds([...taskIds, id]);
  };
  const today = day === dayOf(Date.now());
  const title = mode === 'end' ? 'Before you go: what did you do today?' : `What did you do ${today ? 'today' : `on ${dayLabel(day)}`}?`;
  const addPhotos = async (files) => {
    setErr('');
    const room = MAX_PHOTOS - photos.length;
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (!picked.length) return;
    setBusy('photos');
    try {
      const up = [];
      for (const f of picked) up.push(await uploadPhoto(f));
      setPhotos((p) => [...p, ...up].slice(0, MAX_PHOTOS));
    } catch (e) {
      setErr(e.message || 'Couldn’t add that photo.');
    } finally {
      setBusy('');
    }
  };
  const save = async () => {
    if (!note.trim() || busy) return;
    setBusy('save');
    setErr('');
    try {
      await onSave({
        note: note.trim().slice(0, 4000),
        taskIds,
        doneTaskIds: done.filter((id) => taskIds.includes(id)),
        photos,
        blockers: blockers.trim().slice(0, 2000),
        next: next.trim().slice(0, 2000),
      });
    } catch (e) {
      setErr(e.message || 'Couldn’t save it. Try again.');
      setBusy('');
    }
  };
  return (
    <Overlay>
      <div className="panel-backdrop center">
        <div className="dialog lablog-dialog" role="dialog" aria-label="Lab log">
          <div className="panel-head">
            <h2>{title}</h2>
            <span className="spacer" />
            {onCancel && mode !== 'end' && (
              <button className="icon-btn" onClick={onCancel} aria-label="Close">
                <CloseIcon />
              </button>
            )}
          </div>
          {mode === 'missing' && (
            <p className="muted small lablog-why">
              You were at the lab {today ? 'today' : dayLabel(day)}
              {hours ? ` (${hours} h)` : ''}. Write down what you did to keep going. It goes in #lab-log for the team.
            </p>
          )}
          {mode === 'edit' && person && (
            <p className="muted small lablog-why">
              {person}’s log for {dayLabel(day)}
            </p>
          )}
          <label className="lablog-field">
            <span>What you did</span>
            <AutoTextarea
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything: what you built, fixed, tested, learned, or decided"
              maxLength={4000}
              autoFocus
            />
          </label>
          {list.length > 0 && (
            <div className="lablog-field">
              <span>Tasks you worked on</span>
              <div className="lablog-tasks">
                {list.map((t) => {
                  const on = taskIds.includes(t.id);
                  return (
                    <div key={t.id} className={`lablog-task${on ? ' on' : ''}`}>
                      <button type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(t.id)}>
                        {on ? '✓ ' : ''}
                        {t.title || 'Untitled task'}
                      </button>
                      {on && t.status !== 'done' && (
                        <label className="lablog-done">
                          <input
                            type="checkbox"
                            checked={done.includes(t.id)}
                            onChange={(e) => setDone(e.target.checked ? [...done, t.id] : done.filter((x) => x !== t.id))}
                          />{' '}
                          Finished it
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="lablog-field">
            <span>Photos</span>
            <div className="lablog-photos">
              {photos.map((p, i) => (
                <span key={p.url} className="lablog-photo">
                  <img src={p.thumbUrl || p.url} alt="" />
                  <button
                    type="button"
                    className="lablog-photo-x"
                    aria-label="Remove photo"
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </span>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" className="lablog-add-photo" disabled={busy === 'photos'} onClick={() => fileInput.current?.click()}>
                  {busy === 'photos' ? 'Adding…' : '＋ Photo'}
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <label className="lablog-field">
            <span>Anything blocking you? (optional)</span>
            <AutoTextarea
              className="input"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Waiting on parts, stuck on a bug…"
              maxLength={2000}
            />
          </label>
          <label className="lablog-field">
            <span>Next time (optional)</span>
            <AutoTextarea
              className="input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="What to do next session"
              maxLength={2000}
            />
          </label>
          {err && <div className="casino-error">{err}</div>}
          <button className="btn primary big-btn" disabled={!note.trim() || !!busy} onClick={save}>
            {busy === 'save' ? 'Saving…' : mode === 'end' ? 'Save and end shift' : 'Save'}
          </button>
          {mode === 'end' && onSkip && (
            <button className="btn lablog-skip" disabled={!!busy} onClick={onSkip}>
              Skip the log and end shift
            </button>
          )}
          {mode === 'end' && onCancel && (
            <button className="link-btn small lablog-notyet" onClick={onCancel}>
              Not yet, keep my shift going
            </button>
          )}
          {!note.trim() && !onSkip && <p className="muted tiny lablog-hint">Write at least a short note to save.</p>}
        </div>
      </div>
    </Overlay>
  );
}

// Trotbot's post for a day in #lab-log: everyone's logs, live.
export function LabDay({ c, onPerson }) {
  const ctx = useContext(LabLogContext);
  if (!ctx) return null;
  const logs = ctx.logs.filter((l) => l.day === c.day).sort((a, b) => (a.at || 0) - (b.at || 0));
  const hours = hoursOn(c.day, ctx.shifts);
  const total = Math.round(Object.values(hours).reduce((t, h) => t + h, 0) * 10) / 10;
  const logged = new Set(logs.map((l) => l.person));
  // Who was at the lab that day but hasn't logged: still there, or gone without logging.
  const dayShifts = ctx.shifts.filter((s) => s.start && dayOf(s.start) === c.day && !logged.has(s.person));
  const atLab = [...new Set(dayShifts.filter((s) => !s.end).map((s) => s.person))];
  const stillToLog = [...new Set(dayShifts.filter((s) => s.end && !atLab.includes(s.person)).map((s) => s.person))];
  const taskTitle = (id) => ctx.tasks.find((t) => t.id === id)?.title || 'A task';
  return (
    <div className="lablog-day">
      <div className="lablog-day-head">
        <b className="cmd-big">{dayLabel(c.day)}</b>
        <span className="muted small">
          {logs.length} {logs.length === 1 ? 'log' : 'logs'}
          {total ? ` · ${total} h at the lab` : ''}
        </span>
      </div>
      {logs.map((l) => (
        <div key={l.id} className="lablog-entry">
          <div className="lablog-entry-head">
            <button className="avatar-btn" onClick={(e) => onPerson?.(l.person, e)} aria-label={l.person}>
              <Avatar name={l.person} size={28} />
            </button>
            <DisplayName as="button" name={l.person} className="name-btn" onClick={onPerson ? (e) => onPerson(l.person, e) : undefined} />
            {hours[l.person] ? <span className="chip lablog-hours">{hours[l.person]} h</span> : null}
            <span className="spacer" />
            {(l.person === ctx.me || ctx.isManager) && (
              <button className="link-btn small" onClick={() => ctx.edit(l)}>
                Edit
              </button>
            )}
          </div>
          <div className="lablog-note">{l.note}</div>
          {(l.taskIds || []).length > 0 && (
            <div className="lablog-entry-tasks">
              {l.taskIds.map((id) => (
                <span key={id} className={`chip${(l.doneTaskIds || []).includes(id) ? ' done' : ''}`}>
                  {taskTitle(id)}
                  {(l.doneTaskIds || []).includes(id) ? ' (done)' : ''}
                </span>
              ))}
            </div>
          )}
          {(l.photos || []).length > 0 && (
            <div className="lablog-photos">
              {l.photos.map((p) => (
                <a key={p.url} className="lablog-photo" href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.thumbUrl || p.url} alt={`Photo from ${l.person}`} loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {l.blockers && (
            <div className="lablog-blockers">
              <b>Blocked:</b> {l.blockers}
            </div>
          )}
          {l.next && (
            <div className="lablog-next">
              <b>Next time:</b> {l.next}
            </div>
          )}
        </div>
      ))}
      {atLab.length > 0 && <div className="muted small">At the lab now: {atLab.map((n) => n.split(' ')[0]).join(', ')}</div>}
      {stillToLog.length > 0 && <div className="muted small">Still to log: {stillToLog.map((n) => n.split(' ')[0]).join(', ')}</div>}
    </div>
  );
}
