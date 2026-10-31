import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AutoTextarea, Avatar, CloseIcon, DisplayName, Overlay, usePeople } from './common.jsx';
import { Icon } from './shell/icons.jsx';
import { useEscape } from '../util.js';
import { animOn, celebrate } from '../motion.js';
import {
  AREAS,
  MIN_SHIFT,
  OUTCOMES,
  areaById,
  areasOfSubteams,
  chipById,
  chipIn,
  chipsFor,
  dayLabel,
  dayOf,
  entryAreas,
  entryTasks,
  hoursOn,
  logFields,
  outcomeById,
  previousLog,
  shortDay,
  sortAreas,
  taskArea,
  teammatesOn,
  toggleChip,
} from '../labLog.js';

// The lab log (labLog.js): the few taps you make when you end a shift, and
// Trotbot's daily card in #lab-log.

// What the #lab-log cards read (Workspace provides it): { logs, shifts,
// tasks, me, isManager, edit(log) }.
export const LabLogContext = createContext(null);

const MAX_PHOTOS = 4;
const MAX_VOICE = 30000;
// Team tasks shown per area before "Show more".
const TEAM_SHOWN = 4;

const firstName = (n) => (n || '').split(' ')[0];
const secs = (ms) => `0:${String(Math.max(1, Math.round((ms || 0) / 1000))).padStart(2, '0')}`;
const span = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'under a minute';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};
const otherKey = (area) => `other:${area}`;

// The form state for a log that's already saved (or for "Same as last time").
function fromLog(log, tasks) {
  const picks = {};
  const others = {};
  for (const t of entryTasks(log, tasks)) {
    if (t.id) picks[t.id] = { outcome: t.outcome || '', blocker: t.blocker || '' };
    else others[t.area] = { text: t.title === 'A task' ? '' : t.title, outcome: t.outcome || '', blocker: t.blocker || '' };
  }
  return { areas: entryAreas(log, tasks), picks, others };
}

export function LabLogDialog({
  day,
  person,
  mine,
  log,
  shift,
  mode,
  tasks,
  logs,
  shifts,
  subteams,
  hours,
  loadTouched,
  subscribeChips,
  onSave,
  onCancel,
  onSkip,
  onQuick,
  uploadPhoto,
  uploadVoice,
  deleteVoice,
}) {
  const people = usePeople();
  const live = useMemo(() => tasks.filter((t) => !t.deletedAt), [tasks]);
  const byId = useMemo(() => new Map(live.map((t) => [t.id, t])), [live]);
  const start = useMemo(() => (log ? fromLog(log, tasks) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [areas, setAreas] = useState(() => (start?.areas?.length ? start.areas : areasOfSubteams(subteams)));
  // Tasks picked: id → { outcome, blocker }. "Something else" per area: area → { text, outcome, blocker }.
  const [picks, setPicks] = useState(() => start?.picks || {});
  const [others, setOthers] = useState(() => start?.others || {});
  // Tasks touched today are picked for you once their area is; unpicking one sticks.
  const [touched, setTouched] = useState(() => new Set());
  const [unpicked, setUnpicked] = useState(() => new Set());
  const [moveDone, setMoveDone] = useState(() => new Set());
  const [markBlocked, setMarkBlocked] = useState(() => new Set());
  const [note, setNote] = useState(log?.note || '');
  const [chips, setChips] = useState(log?.chips || []);
  const [photos, setPhotos] = useState(log?.photos || []);
  const [voice, setVoice] = useState(log?.voice || null);
  const [workedWith, setWorkedWith] = useState(log?.workedWith || []);
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState({});
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [filled, setFilled] = useState('');
  const shiftMs = shift ? Date.now() - shift.start : Infinity;
  const [quick, setQuick] = useState(mode === 'end' && !!onQuick && shiftMs < MIN_SHIFT);
  const body = useRef(null);
  const areasChanged = useRef(false);
  const camera = useRef(null);

  // Once, when the log opens.
  useEffect(() => {
    let on = true;
    Promise.resolve(loadTouched?.())
      .then((ids) => {
        if (!on || !ids) return;
        setTouched(new Set(ids));
        // A new log also picks the areas of the tasks you touched (until you change them).
        const extra = ids.map((id) => byId.get(id)).filter(Boolean).map(taskArea);
        if (!log && extra.length) setAreas((a) => (areasChanged.current ? a : sortAreas([...new Set([...a, ...extra])])));
      })
      .catch(() => {});
    const off = subscribeChips?.(setCounts);
    return () => {
      on = false;
      off?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mineOpen = (t) => (t.assignees || []).includes(person) && t.status !== 'done';
  // Teammates you worked with: the tasks in their logs today.
  const teammates = useMemo(() => teammatesOn(day, person, shifts), [day, person, shifts]);
  const suggested = useMemo(() => {
    const out = new Map();
    for (const l of logs || []) {
      if (l.day !== day || !workedWith.includes(l.person)) continue;
      for (const t of entryTasks(l, tasks)) if (t.id && byId.has(t.id)) out.set(t.id, [...(out.get(t.id) || []), l.person]);
    }
    return out;
  }, [logs, day, workedWith, tasks, byId]);

  const isPicked = (id) => !!picks[id] || (touched.has(id) && !unpicked.has(id) && areas.includes(taskArea(byId.get(id))));
  const pickedIds = live.filter((t) => isPicked(t.id)).map((t) => t.id);
  // Tasks saved in this log that were deleted since still count.
  const goneIds = Object.keys(picks).filter((id) => !byId.has(id));
  const otherAreas = Object.keys(others).filter((a) => others[a]);
  const pickList = [
    ...[...pickedIds, ...goneIds].map((id) => {
      const t = byId.get(id);
      const saved = entryTasks(log, tasks).find((x) => x.id === id);
      return { key: id, id, title: t?.title || saved?.title || 'A task', area: t ? taskArea(t) : saved?.area || 'general', task: t, ...(picks[id] || {}) };
    }),
    ...sortAreas(otherAreas).map((a) => ({
      key: otherKey(a),
      id: null,
      title: others[a].text?.trim() || `Something else (${areaById[a].label})`,
      area: a,
      ...others[a],
    })),
  ];
  // Areas whose tasks are listed: the ones picked, plus any a teammate's log or a pick brings in.
  const shownAreas = sortAreas([
    ...areas,
    ...pickList.map((p) => p.area),
    ...[...suggested.keys()].map((id) => taskArea(byId.get(id))),
  ]);
  // Four steps; "How did it go?" is passed over when no task is picked.
  const steps = ['areas', 'tasks', 'how', 'note'];
  const stepId = steps[step];
  const atLast = step === steps.length - 1;
  const go = (dir) => {
    let to = step + dir;
    if (steps[to] === 'how' && !pickList.length) to += dir;
    setStep(Math.max(0, Math.min(steps.length - 1, to)));
  };
  const canSave = areas.length > 0 || pickList.length > 0;
  // Page changes: each step slides in from the side you're heading to.
  const shownStep = useRef(step);
  useEffect(() => {
    const dir = Math.sign(step - shownStep.current);
    shownStep.current = step;
    if (!dir || !animOn('pages')) return;
    body.current?.animate(
      [
        { opacity: 0, transform: `translateX(${dir * 14}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }, [step]);

  useEffect(() => {
    body.current?.scrollTo?.(0, 0);
  }, [stepId]);

  const prev = useMemo(() => previousLog(person, logs, day), [person, logs, day]);
  const sameAsLast = () => {
    const f = fromLog(prev, tasks);
    // Tasks finished last time are done; the rest carry over with how they went.
    const carry = Object.fromEntries(
      Object.entries(f.picks).filter(([id, p]) => byId.has(id) && byId.get(id).status !== 'done' && p.outcome !== 'done'),
    );
    setAreas(f.areas);
    setPicks(carry);
    setOthers(f.others);
    setNote(prev.note || '');
    setChips(prev.chips || []);
    setWorkedWith((prev.workedWith || []).filter((n) => teammates.includes(n)));
    setFilled(shortDay(prev.day));
    areasChanged.current = true;
  };

  const toggleArea = (a) => {
    areasChanged.current = true;
    setFilled('');
    if (areas.includes(a)) {
      setAreas(areas.filter((x) => x !== a));
      // Unpicking an area drops what was picked in it.
      setPicks(Object.fromEntries(Object.entries(picks).filter(([id]) => taskArea(byId.get(id)) !== a)));
      setOthers({ ...others, [a]: undefined });
    } else setAreas(sortAreas([...areas, a]));
  };
  const toggleTask = (t) => {
    if (isPicked(t.id)) {
      const { [t.id]: _, ...rest } = picks;
      setPicks(rest);
      setUnpicked(new Set([...unpicked, t.id]));
    } else {
      setPicks({ ...picks, [t.id]: { outcome: '', blocker: '' } });
      setUnpicked(new Set([...unpicked].filter((x) => x !== t.id)));
    }
  };
  const setHow = (p, patch) => {
    if (p.id) setPicks({ ...picks, [p.id]: { outcome: '', blocker: '', ...(picks[p.id] || {}), ...patch } });
    else setOthers({ ...others, [p.area]: { ...others[p.area], ...patch } });
  };
  const flip = (set, setter, id) => setter(set.has(id) ? new Set([...set].filter((x) => x !== id)) : new Set([...set, id]));

  const addPhotos = async (files) => {
    setErr('');
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length);
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
  const addVoice = async (blob, ms) => {
    setErr('');
    setBusy('voice');
    try {
      setVoice(await uploadVoice(blob, ms));
    } catch (e) {
      setErr(e.message || 'Couldn’t save the voice note.');
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!canSave || busy) return;
    setBusy('save');
    setErr('');
    const list = pickList.map((p) => ({ ...p, outcome: p.outcome || '' }));
    try {
      const fields = logFields({ areas, picks: list, note, chips, photos, voice, workedWith });
      // A log from before 3.0 keeps its written blockers unless a task now says what's blocking it.
      if (!fields.blockers && log?.blockers) fields.blockers = log.blockers;
      await onSave(fields, {
        done: list.filter((p) => p.task && p.outcome === 'done' && moveDone.has(p.id)).map((p) => p.id),
        blocked: list
          .filter((p) => p.task && p.outcome === 'stuck' && markBlocked.has(p.id))
          .map((p) => ({ id: p.id, reason: (p.blocker || '').trim().slice(0, 300) })),
        // Chips counted once per log (labChips): the ones new in this save.
        chips: chips.filter((id) => chipById[id] && chipIn(note, chipById[id]) && !(log?.chips || []).includes(id)),
      });
    } catch (e) {
      setErr(e.message || 'Couldn’t save it. Try again.');
      setBusy('');
    }
  };
  const chipList = useMemo(
    () => chipsFor(shownAreas.filter((a) => areas.includes(a) || pickList.some((p) => p.area === a)), counts),
    // Ordered when the step opens, so chips don't move while you tap them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepId === 'note', areas.join()],
  );

  const today = day === dayOf(Date.now());
  const closable = mode !== 'missing' || !!onCancel;
  useEscape(() => closable && !busy && onCancel?.(), closable);

  const sub =
    mode === 'end'
      ? `Ending your shift${shift ? ` · ${span(shiftMs)}` : ''}`
      : mode === 'missing'
        ? `You were at the lab ${today ? 'today' : dayLabel(day)}${hours ? ` (${hours} h)` : ''}. Log it to keep going.`
        : mine
          ? shortDay(day)
          : `${firstName(person)}’s log · ${shortDay(day)}`;

  if (quick)
    return (
      <Overlay>
        <div className="panel-backdrop center ll-backdrop">
          <div className="dialog ll-sheet ll-quick" role="dialog" aria-label="Quick visit">
            <div className="ll-quick-body">
              <span className="ll-quick-icon" aria-hidden="true">
                <Icon name="clock" size={28} />
              </span>
              <h2>Quick visit</h2>
              <p className="muted">
                You’ve been here {shiftMs < 60000 ? 'under a minute' : <span className="mono">{span(shiftMs)}</span>}. Nothing to log for
                that.
              </p>
            </div>
            {err && <div className="casino-error">{err}</div>}
            <div className="ll-quick-actions">
              <button
                className="btn primary ll-big"
                disabled={!!busy}
                onClick={async () => {
                  setBusy('quick');
                  try {
                    await onQuick();
                  } catch (e) {
                    setErr(e.message || 'Couldn’t end your shift. Try again.');
                    setBusy('');
                  }
                }}
              >
                <Icon name="check" size={20} /> Quick visit, nothing to log
              </button>
              <button className="link-btn small" disabled={!!busy} onClick={() => setQuick(false)}>
                Log it anyway
              </button>
              {onCancel && (
                <button className="link-btn small" disabled={!!busy} onClick={onCancel}>
                  Not yet, keep my shift going
                </button>
              )}
            </div>
          </div>
        </div>
      </Overlay>
    );

  const title = { areas: 'What did you work on?', tasks: 'Which task?', how: 'How did it go?', note: 'Anything worth noting?' }[stepId];
  return (
    <Overlay>
      <div className="panel-backdrop center ll-backdrop">
        <div className="dialog ll-sheet" role="dialog" aria-label="Lab log">
          <div className="ll-head">
            <div className="ll-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
              {steps.map((s, i) => (
                <span key={s} className={i <= step ? 'on' : ''} />
              ))}
            </div>
            <div className="ll-head-row">
              <div className="ll-titles">
                <span className="ll-kicker">
                  <span className="mono">
                    {step + 1}/{steps.length}
                  </span>{' '}
                  · {sub}
                </span>
                <h2>{title}</h2>
              </div>
              {closable && (
                <button
                  className="icon-btn"
                  onClick={onCancel}
                  disabled={!!busy}
                  aria-label={mode === 'end' ? 'Not yet, keep my shift going' : 'Close'}
                  title={mode === 'end' ? 'Not yet, keep my shift going' : 'Close'}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>

          <div className="ll-body" ref={body}>
            {stepId === 'areas' && (
              <>
                {prev && (
                  <button type="button" className={`ll-same${filled ? ' on' : ''}`} onClick={sameAsLast}>
                    <Icon name="repeat" size={18} />
                    <span>
                      <b>{filled ? `Filled in from ${filled}` : 'Same as last time'}</b>
                      <small>
                        {filled
                          ? 'Change what’s different.'
                          : [shortDay(prev.day), ...entryAreas(prev, tasks).map((a) => areaById[a].label)].join(' · ')}
                      </small>
                    </span>
                  </button>
                )}
                <div className="ll-areas" role="group" aria-label="Areas">
                  {[...areasOfSubteams(subteams), ...AREAS.map((a) => a.id).filter((a) => !areasOfSubteams(subteams).includes(a))].map((id) => {
                    const a = areaById[id];
                    const on = areas.includes(id);
                    return (
                      <button key={id} type="button" className={`ll-area${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleArea(id)}>
                        <Icon name={a.icon} size={22} />
                        <span>{a.label}</span>
                        <span className="ll-tick" aria-hidden="true">
                          {on && <Icon name="check" size={14} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!canSave && <p className="muted small ll-hint">Pick at least one.</p>}
              </>
            )}

            {stepId === 'tasks' && (
              <>
                {teammates.length > 0 && (
                  <div className="ll-group">
                    <h3 className="ll-label">Worked with</h3>
                    <div className="ll-faces">
                      {teammates.map((n) => {
                        const on = workedWith.includes(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            className={`ll-face${on ? ' on' : ''}`}
                            aria-pressed={on}
                            onClick={() => setWorkedWith(on ? workedWith.filter((x) => x !== n) : [...workedWith, n])}
                          >
                            <Avatar name={n} size={44} />
                            <span>{firstName(people?.rename ? people.rename(n) : n)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {shownAreas.map((a) => {
                  const inArea = live.filter((t) => taskArea(t) === a);
                  const rank = (t) => (isPicked(t.id) ? 0 : suggested.has(t.id) ? 1 : touched.has(t.id) ? 2 : 3);
                  const order = (list) => [...list].sort((x, y) => rank(x) - rank(y) || (y.updatedAt || 0) - (x.updatedAt || 0));
                  const mine = order(inArea.filter(mineOpen));
                  // The team's other open tasks, plus any done ones you picked or touched today.
                  const team = order(
                    inArea.filter((t) => !mineOpen(t) && (t.status !== 'done' || isPicked(t.id) || touched.has(t.id) || suggested.has(t.id))),
                  );
                  const shown = showAll[a] ? team : team.filter((t, i) => i < TEAM_SHOWN || rank(t) < 3);
                  const other = others[a];
                  return (
                    <div key={a} className="ll-group">
                      <h3 className="ll-label">
                        <Icon name={areaById[a].icon} size={15} /> {areaById[a].label}
                      </h3>
                      <div className="ll-tasks">
                        {mine.map((t) => (
                          <TaskPick key={t.id} t={t} on={isPicked(t.id)} with={suggested.get(t.id)} onClick={() => toggleTask(t)} />
                        ))}
                        {team.length > 0 && mine.length > 0 && <span className="ll-sublabel">Team’s other tasks</span>}
                        {shown.map((t) => (
                          <TaskPick key={t.id} t={t} on={isPicked(t.id)} with={suggested.get(t.id)} onClick={() => toggleTask(t)} />
                        ))}
                        {shown.length < team.length && (
                          <button type="button" className="ll-more" onClick={() => setShowAll({ ...showAll, [a]: true })}>
                            Show <span className="mono">{team.length - shown.length}</span> more
                          </button>
                        )}
                        <button
                          type="button"
                          className={`ll-task ll-else${other ? ' on' : ''}`}
                          aria-pressed={!!other}
                          onClick={() => setOthers({ ...others, [a]: other ? undefined : { text: '', outcome: '', blocker: '' } })}
                        >
                          <span className="ll-tick" aria-hidden="true">
                            {other ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />}
                          </span>
                          <span className="ll-task-title">Something else</span>
                        </button>
                        {other && (
                          <input
                            className="input ll-short"
                            value={other.text}
                            onChange={(e) => setOthers({ ...others, [a]: { ...other, text: e.target.value } })}
                            placeholder="What was it? (a few words)"
                            maxLength={120}
                            aria-label={`Something else in ${areaById[a].label}`}
                            autoFocus
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {stepId === 'how' &&
              pickList.map((p) => {
                const t = p.task;
                return (
                  <div key={p.key} className="ll-how">
                    <div className="ll-how-title">
                      <span>{p.title}</span>
                      <span className="ll-area-tag">{areaById[p.area].label}</span>
                    </div>
                    <div className="ll-outcomes" role="group" aria-label={`How did “${p.title}” go?`}>
                      {OUTCOMES.map((o) => {
                        const on = p.outcome === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            className={`ll-outcome o-${o.id}${on ? ' on' : ''}`}
                            aria-pressed={on}
                            onClick={() => setHow(p, { outcome: on ? '' : o.id })}
                          >
                            <Icon name={o.icon} size={18} />
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                    {p.outcome === 'done' && t && t.status !== 'done' && (
                      <button
                        type="button"
                        className={`ll-offer${moveDone.has(p.id) ? ' on' : ''}`}
                        aria-pressed={moveDone.has(p.id)}
                        onClick={() => flip(moveDone, setMoveDone, p.id)}
                      >
                        <span className="ll-tick" aria-hidden="true">
                          {moveDone.has(p.id) && <Icon name="check" size={14} />}
                        </span>
                        Move it to Done
                      </button>
                    )}
                    {p.outcome === 'stuck' && (
                      <div className="ll-stuck">
                        <input
                          className="input ll-short"
                          value={p.blocker || ''}
                          onChange={(e) => setHow(p, { blocker: e.target.value })}
                          placeholder="What’s blocking it?"
                          maxLength={300}
                          aria-label="What’s blocking it?"
                        />
                        {t && t.status !== 'blocked' && (
                          <button
                            type="button"
                            className={`ll-offer${markBlocked.has(p.id) ? ' on' : ''}`}
                            aria-pressed={markBlocked.has(p.id)}
                            onClick={() => flip(markBlocked, setMarkBlocked, p.id)}
                          >
                            <span className="ll-tick" aria-hidden="true">
                              {markBlocked.has(p.id) && <Icon name="check" size={14} />}
                            </span>
                            Mark it Blocked
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            {stepId === 'note' && (
              <>
                <AutoTextarea
                  className="input ll-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional: a line about what you did or learned"
                  maxLength={1000}
                  maxHeight={160}
                  aria-label="Anything worth noting?"
                />
                {chipList.length > 0 && (
                  <div className="ll-chips" role="group" aria-label="Suggestions">
                    {chipList.map((c) => {
                      const on = chipIn(note, c.text);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`chip ll-chip${on ? ' on' : ''}`}
                          aria-pressed={on}
                          onClick={() => {
                            setNote(toggleChip(note, c.text));
                            if (!on && !chips.includes(c.id)) setChips([...chips, c.id]);
                          }}
                        >
                          {on && <Icon name="check" size={13} />}
                          {c.text}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="ll-extras">
                  {photos.length < MAX_PHOTOS && (
                    <button type="button" className="ll-extra" disabled={busy === 'photos'} onClick={() => camera.current?.click()}>
                      <Icon name="camera" size={22} />
                      <span>{busy === 'photos' ? 'Adding…' : photos.length ? 'Another photo' : 'Photo'}</span>
                    </button>
                  )}
                  {!voice && <VoiceButton disabled={busy === 'voice'} busy={busy === 'voice'} onRecorded={addVoice} onError={setErr} />}
                  <input
                    ref={camera}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>
                {(photos.length > 0 || voice) && (
                  <div className="ll-attached">
                    {photos.map((p, i) => (
                      <span key={p.url} className="lablog-photo">
                        <img src={p.thumbUrl || p.url} alt="" />
                        <button
                          type="button"
                          className="lablog-photo-x"
                          aria-label="Remove photo"
                          onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        >
                          <CloseIcon />
                        </button>
                      </span>
                    ))}
                    {voice && (
                      <span className="ll-voice-row">
                        <VoicePlayer voice={voice} />
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Remove voice note"
                          onClick={() => {
                            // Not saved anywhere yet: remove the file too.
                            if (voice.url !== log?.voice?.url) deleteVoice?.(voice);
                            setVoice(null);
                          }}
                        >
                          <CloseIcon />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            {err && <div className="casino-error">{err}</div>}
          </div>

          <div className="ll-foot">
            {step > 0 ? (
              <button type="button" className="btn ll-back" onClick={() => go(-1)} disabled={!!busy} aria-label="Back">
                <Icon name="chevron" size={18} className="ll-back-icon" />
              </button>
            ) : mode === 'end' && onSkip ? (
              <button type="button" className="btn ll-skip" onClick={onSkip} disabled={!!busy}>
                Skip
              </button>
            ) : null}
            <button
              type="button"
              className={`btn ll-done${atLast ? ' primary' : ''}`}
              disabled={!canSave || !!busy}
              onClick={save}
            >
              {busy === 'save' ? 'Saving…' : 'Done'}
            </button>
            {!atLast && (
              <button type="button" className="btn primary ll-next" disabled={!canSave || !!busy} onClick={() => go(1)}>
                Next
                <Icon name="chevron" size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function TaskPick({ t, on, with: names, onClick }) {
  const people = usePeople();
  return (
    <button type="button" className={`ll-task${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="ll-tick" aria-hidden="true">
        {on && <Icon name="check" size={14} />}
      </span>
      <span className="ll-task-title">{t.title || 'Untitled task'}</span>
      {names?.length > 0 && (
        <span className="ll-with">with {names.map((n) => firstName(people?.rename ? people.rename(n) : n)).join(', ')}</span>
      )}
      {t.status === 'done' && <span className="ll-with">Done</span>}
    </button>
  );
}

// Hold to record a voice note (up to 30 seconds). iPad and iPhone Safari
// record audio/mp4; other browsers usually WebM.
const VOICE_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const canRecord = () =>
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';

function VoiceButton({ onRecorded, onError, disabled, busy }) {
  const [since, setSince] = useState(0);
  const [now, setNow] = useState(0);
  const [hint, setHint] = useState('');
  const held = useRef(false);
  const rec = useRef(null);
  const timer = useRef(null);
  const stop = () => {
    held.current = false;
    clearTimeout(timer.current);
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    rec.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [since]);
  if (!canRecord()) return null;
  const start = async () => {
    if (disabled || rec.current) return;
    held.current = true;
    setHint('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      held.current = false;
      onError?.('The microphone is blocked. Allow it in your browser’s settings to record.');
      return;
    }
    // Let go while the browser asked for the microphone: nothing to record yet.
    if (!held.current) {
      stream.getTracks().forEach((t) => t.stop());
      setHint('Hold the button while you talk.');
      return;
    }
    const type = VOICE_TYPES.find((t) => window.MediaRecorder.isTypeSupported?.(t));
    const r = new window.MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const parts = [];
    const t0 = Date.now();
    r.ondataavailable = (e) => e.data?.size && parts.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setSince(0);
      const ms = Math.min(Date.now() - t0, MAX_VOICE);
      if (ms < 800 || !parts.length) return setHint('Hold the button while you talk.');
      onRecorded(new Blob(parts, { type: r.mimeType || type || 'audio/mp4' }), ms);
    };
    r.start(250);
    rec.current = r;
    setSince(t0);
    setNow(t0);
    timer.current = setTimeout(stop, MAX_VOICE);
  };
  const left = since ? Math.max(0, MAX_VOICE - (now - since)) : MAX_VOICE;
  return (
    <button
      type="button"
      className={`ll-extra ll-mic${since ? ' recording' : ''}`}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), start())}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && stop()}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Hold to record a voice note"
    >
      <Icon name="mic" size={22} />
      <span>
        {busy ? (
          'Saving…'
        ) : since ? (
          <>
            Recording <span className="mono">{secs(left)}</span>
          </>
        ) : (
          hint || 'Hold to talk'
        )}
      </span>
      {since > 0 && <span className="ll-mic-bar" style={{ transform: `scaleX(${1 - left / MAX_VOICE})` }} aria-hidden="true" />}
    </button>
  );
}

// A voice note: play/pause and how long it is.
export function VoicePlayer({ voice }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  if (!voice?.url) return null;
  return (
    <span className="ll-voice">
      <button
        type="button"
        className="ll-voice-play"
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        onClick={() => (playing ? audio.current?.pause() : audio.current?.play().catch(() => {}))}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} />
      </button>
      <span className="ll-voice-track" aria-hidden="true">
        <i style={{ transform: `scaleX(${pos})` }} />
      </span>
      <span className="mono ll-voice-len">{secs(voice.ms)}</span>
      <audio
        ref={audio}
        src={voice.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onTimeUpdate={(e) => voice.ms && setPos(Math.min(1, (e.currentTarget.currentTime * 1000) / voice.ms))}
      />
    </span>
  );
}

// After you log: what it adds up to.
export function LabPayoff({ lines, ended, onClose }) {
  useEscape(onClose);
  // A little burst from the check mark (Celebrations).
  const check = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => check.current && celebrate({ el: check.current }), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <Overlay>
      <div className="panel-backdrop center ll-backdrop" onClick={onClose}>
        <div className="dialog ll-payoff" role="dialog" aria-label="Logged" onClick={(e) => e.stopPropagation()}>
          <span className="ll-payoff-check" aria-hidden="true" ref={check}>
            <Icon name="check" size={30} />
          </span>
          <h2>Logged. Nice work.</h2>
          {ended && <p className="muted small">Your shift is over.</p>}
          {lines.length > 0 && (
            <ul className="ll-payoff-lines">
              {lines.map((l) => (
                <li key={l.text}>
                  <Icon name={l.icon} size={18} />
                  <b className="mono">{l.num}</b>
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="btn primary ll-big" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// Trotbot's card for a day in #lab-log: everyone's logs, filling in live.
export function LabDay({ c, onPerson }) {
  const ctx = useContext(LabLogContext);
  const people = usePeople();
  if (!ctx) return null;
  const logs = ctx.logs.filter((l) => l.day === c.day).sort((a, b) => (a.at || 0) - (b.at || 0));
  const hours = hoursOn(c.day, ctx.shifts);
  const total = Math.round(Object.values(hours).reduce((t, h) => t + h, 0) * 10) / 10;
  const logged = new Set(logs.map((l) => l.person));
  // Who was at the lab that day but hasn't logged: still there, or gone without logging.
  const dayShifts = ctx.shifts.filter((s) => s.start && dayOf(s.start) === c.day && !logged.has(s.person));
  const atLab = [...new Set(dayShifts.filter((s) => !s.end).map((s) => s.person))];
  const stillToLog = [
    ...new Set(dayShifts.filter((s) => s.end && s.end - s.start >= MIN_SHIFT && !atLab.includes(s.person)).map((s) => s.person)),
  ];
  return (
    <div className="lablog-day">
      <div className="lablog-day-head">
        <b className="cmd-big">{dayLabel(c.day)}</b>
        <span className="muted small">
          <span className="mono">{logs.length}</span> {logs.length === 1 ? 'log' : 'logs'}
          {total ? (
            <>
              {' · '}
              <span className="mono">{total} h</span> at the lab
            </>
          ) : null}
        </span>
      </div>
      {logs.map((l) => {
        const areas = entryAreas(l, ctx.tasks);
        const items = entryTasks(l, ctx.tasks);
        return (
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
            {areas.length > 0 && (
              <div className="ll-entry-areas">
                {areas.map((a) => (
                  <span key={a} className="ll-area-tag">
                    <Icon name={areaById[a].icon} size={13} /> {areaById[a].label}
                  </span>
                ))}
              </div>
            )}
            {items.length > 0 && (
              <ul className="ll-entry-tasks">
                {items.map((t, i) => {
                  const o = outcomeById[t.outcome];
                  return (
                    <li key={t.id || `o${i}`} className={o ? `o-${o.id}` : ''}>
                      <Icon name={o?.icon || 'tasks'} size={15} />
                      <span>
                        {t.title}
                        {o && <span className="ll-entry-outcome"> · {o.label}</span>}
                        {t.blocker && <span className="ll-entry-blocker"> · {t.blocker}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {l.note && <div className="lablog-note">{l.note}</div>}
            {l.voice?.url && <VoicePlayer voice={l.voice} />}
            {(l.photos || []).length > 0 && (
              <div className="lablog-photos">
                {l.photos.map((p) => (
                  <a key={p.url} className="lablog-photo" href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.thumbUrl || p.url} alt={`Photo from ${l.person}`} loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            {(l.workedWith || []).length > 0 && (
              <div className="muted small ll-entry-with">
                With {l.workedWith.map((n) => firstName(people?.rename ? people.rename(n) : n)).join(', ')}
              </div>
            )}
            {/* Logs from before 3.0 kept blockers and next time as text. */}
            {l.blockers && !items.some((t) => t.blocker) && (
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
        );
      })}
      {atLab.length > 0 && <div className="muted small">At the lab now: {atLab.map(firstName).join(', ')}</div>}
      {stillToLog.length > 0 && <div className="muted small">Still to log: {stillToLog.map(firstName).join(', ')}</div>}
    </div>
  );
}
