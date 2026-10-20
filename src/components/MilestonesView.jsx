import { useMemo, useState } from 'react';
import { SUBTEAMS, SUBTEAM_COLORS, STATUSES } from '../config.js';
import {
  MILESTONE_STATES,
  addDays,
  daysBetween,
  milestoneProgress,
  milestoneState,
  mondayOf,
  parseDay,
  shortDate,
  todayISO,
} from '../milestones.js';
import { Avatar, AvatarStack, CloseIcon, DraftInput, PlusIcon, StatusDot } from './common.jsx';

const colorOf = (subteam) => SUBTEAM_COLORS[subteam] || 'var(--accent)';

function StatePill({ state }) {
  const s = MILESTONE_STATES[state];
  return (
    <span className="ms-state" style={{ '--c': s.color }}>
      {s.label}
    </span>
  );
}

function OwnerPicker({ roster, value, onChange }) {
  return (
    <div className="assignee-picker">
      {roster.map((n) => {
        const on = value.includes(n);
        return (
          <button
            type="button"
            key={n}
            className={`person${on ? ' on' : ''}`}
            onClick={() => onChange(on ? value.filter((x) => x !== n) : [...value, n])}
          >
            <Avatar name={n} size={20} /> {n.split(' ')[0]}
          </button>
        );
      })}
    </div>
  );
}

function Timeline({ items, competitionDate, onOpen }) {
  const today = todayISO();
  const comp = competitionDate;
  const starts = items.map((i) => i.m.start).filter(Boolean);
  const ends = items.map((i) => i.m.end).filter(Boolean);
  const first = mondayOf([today, ...starts].sort()[0]);
  const last = [comp, ...ends].sort().at(-1);
  const days = daysBetween(first, last) + 1;
  const dayList = Array.from({ length: days }, (_, i) => addDays(first, i));
  const pos = (iso) => (daysBetween(first, iso) / days) * 100;
  const weeks = [];
  for (let i = 0; i < days; i += 7) weeks.push({ col: i, label: `Week of ${shortDate(dayList[i])}`, span: Math.min(7, days - i) });

  return (
    <div className="tl-scroll">
      <div className="tl" style={{ '--days': days }}>
        <div className="tl-head">
          <div className="tl-corner">Milestone</div>
          <div className="tl-days">
            {weeks.map((w) => (
              <div key={w.col} className="tl-week" style={{ gridColumn: `${w.col + 1} / span ${w.span}` }}>
                {w.label}
              </div>
            ))}
            {dayList.map((d, i) => {
              const dow = parseDay(d).getDay();
              const cls = ['tl-day', dow === 0 || dow === 6 ? 'weekend' : '', d === today ? 'today' : '', d === comp ? 'comp' : ''].join(
                ' ',
              );
              return (
                <div key={d} className={cls} style={{ gridColumn: i + 1 }} title={shortDate(d)}>
                  <span>{'SMTWTFS'[dow]}</span>
                  <b>{d === comp ? '🏁' : parseDay(d).getDate()}</b>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tl-body">
          {items.map(({ m, progress, state }) => {
            const s = m.start || today;
            const e = m.end || s;
            return (
              <div className="tl-row" key={m.id}>
                <button className="tl-label" onClick={() => onOpen(m.id)}>
                  <span className="dot" style={{ background: colorOf(m.subteam) }} />
                  <span className="tl-title">{m.title || 'Untitled'}</span>
                  <StatePill state={state} />
                </button>
                <div className="tl-track">
                  <button
                    className={`tl-bar state-${state}`}
                    style={{ left: `${pos(s)}%`, width: `${((daysBetween(s, e) + 1) / days) * 100}%`, '--c': colorOf(m.subteam) }}
                    onClick={() => onOpen(m.id)}
                    title={`${m.title} · ${shortDate(s)} – ${shortDate(e)}`}
                  >
                    <span className="tl-fill" style={{ width: `${progress.pct * 100}%` }} />
                    <span className="tl-bar-text">
                      {state === 'done' ? '✓ ' : ''}
                      {progress.total ? `${progress.done}/${progress.total}` : ''}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
          <div className="tl-lines">
            {dayList.map((d, i) => {
              const dow = parseDay(d).getDay();
              return dow === 0 || dow === 6 ? (
                <span key={d} className="tl-weekend" style={{ left: `${(i / days) * 100}%`, width: `${100 / days}%` }} />
              ) : null;
            })}
            {today >= first && today <= last && (
              <span className="tl-today" style={{ left: `${pos(today) + 50 / days}%` }}>
                <em>Today</em>
              </span>
            )}
            <span className="tl-comp" style={{ left: `${pos(comp) + 50 / days}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MilestoneDialog({ roster, onClose, onCreate }) {
  const today = todayISO();
  const [form, setForm] = useState({ title: '', subteam: '', owners: [], start: today, end: addDays(today, 6), notes: '' });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const badDates = form.end < form.start;

  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (form.title.trim() && !badDates) onCreate({ ...form, title: form.title.trim() });
        }}
      >
        <div className="panel-head">
          <h2>New milestone</h2>
          <span className="spacer" />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <input
          className="input big"
          autoFocus
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="e.g. CAD the new intake"
        />
        <div className="fields">
          <label className="field-label" htmlFor="m-sub">
            Subteam
          </label>
          <select id="m-sub" className="input" value={form.subteam} onChange={(e) => set({ subteam: e.target.value })}>
            <option value="">Whole team</option>
            {SUBTEAMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="field-label">Owners</span>
          <OwnerPicker roster={roster} value={form.owners} onChange={(owners) => set({ owners })} />
          <label className="field-label" htmlFor="m-start">
            Starts
          </label>
          <input id="m-start" className="input" type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} required />
          <label className="field-label" htmlFor="m-end">
            Ends
          </label>
          <input id="m-end" className="input" type="date" value={form.end} onChange={(e) => set({ end: e.target.value })} required />
        </div>
        {badDates && <p className="form-error">The end date is before the start date.</p>}
        <textarea
          className="input description"
          rows={3}
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Notes (optional)"
        />
        <div className="row gap end">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!form.title.trim() || badDates}>
            Create milestone
          </button>
        </div>
      </form>
    </div>
  );
}

function MilestonePanel({ item, roster, api, isManager, onClose, onOpenTask, onAddTask }) {
  const { m, progress, state } = item;
  const set = (patch) => api.updateMilestone(m, patch);
  const statusRank = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));
  const tasks = [...progress.tasks].sort((a, b) => statusRank[a.status] - statusRank[b.status]);

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()} aria-label="Milestone details">
        <div className="panel-head">
          <StatePill state={state} />
          <span className="spacer" />
          {isManager && (
            <button
              className="link-btn danger"
              onClick={() => {
                if (confirm(`Delete milestone “${m.title}”? Its tasks stay on the board, just unlinked.`)) {
                  api.deleteMilestone(m, progress.tasks);
                  onClose();
                }
              }}
            >
              Delete
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="panel-scroll">
          <DraftInput
            multiline
            className="panel-title"
            value={m.title}
            placeholder="Milestone title"
            onSave={(title) => title.trim() && set({ title: title.trim() })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />

          <div className="ms-progress">
            <div className="ms-progress-bar" style={{ '--c': colorOf(m.subteam) }}>
              <span style={{ width: `${progress.pct * 100}%` }} />
            </div>
            <span className="small muted">
              {progress.total ? `${progress.done} of ${progress.total} tasks done` : 'No tasks linked yet'}
            </span>
          </div>

          <label className="done-toggle">
            <input type="checkbox" checked={!!m.done} onChange={(e) => set({ done: e.target.checked })} />
            Milestone is complete
          </label>

          <div className="fields">
            <label className="field-label" htmlFor="mp-sub">
              Subteam
            </label>
            <select id="mp-sub" className="input" value={m.subteam || ''} onChange={(e) => set({ subteam: e.target.value })}>
              <option value="">Whole team</option>
              {SUBTEAMS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <span className="field-label">Owners</span>
            <OwnerPicker roster={roster} value={m.owners || []} onChange={(owners) => set({ owners })} />
            <label className="field-label" htmlFor="mp-start">
              Starts
            </label>
            <input
              id="mp-start"
              className="input"
              type="date"
              value={m.start || ''}
              onChange={(e) =>
                e.target.value && set({ start: e.target.value, ...(m.end && m.end < e.target.value ? { end: e.target.value } : {}) })
              }
            />
            <label className="field-label" htmlFor="mp-end">
              Ends
            </label>
            <input
              id="mp-end"
              className="input"
              type="date"
              value={m.end || ''}
              min={m.start}
              onChange={(e) => e.target.value && set({ end: e.target.value })}
            />
          </div>

          <label className="field-label">Notes</label>
          <DraftInput
            multiline
            className="input description"
            value={m.notes}
            placeholder="Goals, parts list, risks…"
            onSave={(notes) => set({ notes })}
          />

          <div className="row">
            <h3 className="section-title grow">Tasks</h3>
            <button className="btn" onClick={onAddTask}>
              <PlusIcon /> Add task
            </button>
          </div>
          <ul className="ms-tasks">
            {tasks.map((t) => (
              <li key={t.id}>
                <button onClick={() => onOpenTask(t.id)} className={t.status === 'done' ? 'is-done' : ''}>
                  <StatusDot status={t.status} />
                  <span className="grow">{t.title || 'Untitled'}</span>
                  <AvatarStack names={t.assignees} size={20} />
                </button>
              </li>
            ))}
            {!tasks.length && <li className="muted small">Add tasks here, or pick this milestone in any task's details.</li>}
          </ul>
          <p className="meta muted tiny">Last updated by {m.updatedBy || m.createdBy || '?'}</p>
        </div>
      </aside>
    </div>
  );
}

export default function MilestonesView({ milestones, competitionDate, isManager, tasks, roster, api, onOpenTask, onAddTask }) {
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const today = todayISO();

  const items = useMemo(
    () =>
      milestones
        .map((m) => {
          const progress = milestoneProgress(m, tasks);
          return { m, progress, state: milestoneState(m, progress, today) };
        })
        .sort((a, b) => (a.m.start || '9').localeCompare(b.m.start || '9') || (a.m.end || '9').localeCompare(b.m.end || '9')),
    [milestones, tasks, today],
  );
  const counts = useMemo(() => {
    const c = {};
    for (const i of items) c[i.state] = (c[i.state] || 0) + 1;
    return c;
  }, [items]);
  const open = items.find((i) => i.m.id === openId);
  const left = daysBetween(today, competitionDate);

  return (
    <main className="content milestones">
      <div className="ms-header">
        <div>
          <h1>Road to {shortDate(competitionDate)}</h1>
          <p className="muted">
            {left > 0
              ? `${left} day${left === 1 ? '' : 's'} until the competition`
              : left === 0
                ? 'Competition day! Good luck!'
                : 'Competition is over'}
            {' · '}
            {parseDay(competitionDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {isManager && !editingDate && (
              <button className="link-btn" onClick={() => setEditingDate(true)}>
                Change date
              </button>
            )}
          </p>
          {editingDate && (
            <input
              className="input date-edit"
              type="date"
              autoFocus
              defaultValue={competitionDate}
              onBlur={() => setEditingDate(false)}
              onChange={(e) => {
                if (e.target.value) api.saveSettings({ competitionDate: e.target.value });
              }}
            />
          )}
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          <PlusIcon /> New milestone
        </button>
      </div>

      {items.length > 0 && (
        <div className="status-strip flush">
          {Object.entries(MILESTONE_STATES).map(([id, s]) =>
            counts[id] ? (
              <span key={id} className="status-count" style={{ '--c': s.color }}>
                <span className="dot" />
                {s.label}
                <strong>{counts[id]}</strong>
              </span>
            ) : null,
          )}
        </div>
      )}

      {items.length ? (
        <Timeline items={items} competitionDate={competitionDate} onOpen={setOpenId} />
      ) : (
        <div className="empty-card">
          <h2>No milestones yet</h2>
          <p className="muted">
            Milestones are the big steps to get the revised robot ready, like “CAD the new intake” or “Full-robot testing.” Give each one
            dates and link tasks to it, and the chart shows what's on track.
          </p>
          <button className="btn primary" onClick={() => setCreating(true)}>
            <PlusIcon /> Add the first milestone
          </button>
        </div>
      )}

      {open && (
        <MilestonePanel
          isManager={isManager}
          item={open}
          roster={roster}
          api={api}
          onClose={() => setOpenId(null)}
          onOpenTask={(id) => {
            setOpenId(null);
            onOpenTask(id);
          }}
          onAddTask={() => onAddTask(open.m)}
        />
      )}
      {creating && (
        <MilestoneDialog
          roster={roster}
          onClose={() => setCreating(false)}
          onCreate={async (data) => {
            setCreating(false);
            await api.createMilestone(data);
          }}
        />
      )}
    </main>
  );
}
