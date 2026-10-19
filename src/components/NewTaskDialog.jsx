import { useState } from 'react';
import { STATUSES, SUBTEAMS, PRIORITIES } from '../config.js';
import { Avatar, CloseIcon } from './common.jsx';

export default function NewTaskDialog({ initial, roster, me, onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '',
    status: initial.status || 'todo',
    assignees: [],
    subteam: '',
    priority: 'medium',
    dueDate: '',
    description: '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (n) => set({ assignees: form.assignees.includes(n) ? form.assignees.filter((x) => x !== n) : [...form.assignees, n] });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onCreate({ ...form, title: form.title.trim() });
  };

  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="panel-head">
          <h2>New task</h2>
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
          placeholder="What needs to get done?"
        />
        <div className="fields">
          <span className="field-label">Who</span>
          <div className="assignee-picker">
            {roster.map((n) => (
              <button type="button" key={n} className={`person${form.assignees.includes(n) ? ' on' : ''}`} onClick={() => toggle(n)}>
                <Avatar name={n} size={20} /> {n === me ? 'Me' : n.split(' ')[0]}
              </button>
            ))}
          </div>

          <span className="field-label">Priority</span>
          <div className="segmented">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`prio-${p.id}${form.priority === p.id ? ' on' : ''}`}
                onClick={() => set({ priority: p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="n-status">
            Status
          </label>
          <select id="n-status" className="input" value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="n-subteam">
            Subteam
          </label>
          <select id="n-subteam" className="input" value={form.subteam} onChange={(e) => set({ subteam: e.target.value })}>
            <option value="">None</option>
            {SUBTEAMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <label className="field-label" htmlFor="n-due">
            Due
          </label>
          <input id="n-due" className="input" type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
        </div>
        <textarea
          className="input description"
          rows={3}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Details (optional)"
        />
        <div className="row gap end">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!form.title.trim()}>
            Create task
          </button>
        </div>
      </form>
    </div>
  );
}
