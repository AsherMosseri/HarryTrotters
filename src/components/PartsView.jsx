import { useMemo, useState } from 'react';
import { SUBTEAMS } from '../config.js';
import { PART_STATUSES } from '../data/diff.js';
import { relTime, useEscape } from '../util.js';
import { CloseIcon, Overlay, PlusIcon } from './common.jsx';

const VENDORS = ['goBILDA', 'REV Robotics', 'AndyMark', 'ServoCity', 'McMaster-Carr', 'Amazon', 'Home Depot'];
const statusById = Object.fromEntries(PART_STATUSES.map((s) => [s.id, s]));
const money = (n) => (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
export const partTotal = (p) => (Number(p.qty) || 0) * (Number(p.unitCost) || 0);

export function PartStatusSelect({ value, onChange }) {
  const s = statusById[value] || PART_STATUSES[0];
  return (
    <label className="status-select compact" style={{ '--c': s.color }} onClick={(e) => e.stopPropagation()}>
      <span className="dot" />
      <span>{s.label}</span>
      <select value={s.id} onChange={(e) => onChange(e.target.value)} aria-label="Part status">
        {PART_STATUSES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PartDialog({ part, tasks, onClose, onSave, onDelete }) {
  useEscape(onClose);
  const [form, setForm] = useState({
    name: part.name || '',
    vendor: part.vendor || '',
    partNumber: part.partNumber || '',
    qty: part.qty ?? 1,
    unitCost: part.unitCost ?? 0,
    url: part.url || '',
    status: part.status || 'needed',
    subteam: part.subteam || '',
    taskId: part.taskId || '',
    notes: part.notes || '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const openTasks = tasks.filter((t) => t.status !== 'done' || t.id === form.taskId);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    let url = form.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    onSave({
      ...form,
      name: form.name.trim(),
      vendor: form.vendor.trim(),
      partNumber: form.partNumber.trim(),
      qty: Math.max(0, parseInt(form.qty, 10) || 0),
      unitCost: Math.max(0, Math.round((parseFloat(form.unitCost) || 0) * 100) / 100),
      url,
      notes: form.notes.trim(),
    });
  };

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
          <div className="panel-head">
            <h2>{part.id ? 'Edit part' : 'Add a part'}</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <input
            className="input big"
            autoFocus={!part.id}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. 312 RPM motor"
          />
          <div className="fields">
            <label className="field-label" htmlFor="pt-status">
              Status
            </label>
            <div className="segmented">
              {PART_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  id={s.id === 'needed' ? 'pt-status' : undefined}
                  className={`part-seg${form.status === s.id ? ' on' : ''}`}
                  style={{ '--c': s.color }}
                  onClick={() => set({ status: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="pt-vendor">
              Vendor
            </label>
            <input
              id="pt-vendor"
              className="input"
              list="vendors"
              value={form.vendor}
              onChange={(e) => set({ vendor: e.target.value })}
              placeholder="goBILDA"
            />
            <datalist id="vendors">
              {VENDORS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <label className="field-label" htmlFor="pt-num">
              Part #
            </label>
            <input
              id="pt-num"
              className="input"
              value={form.partNumber}
              onChange={(e) => set({ partNumber: e.target.value })}
              placeholder="Optional"
            />
            <label className="field-label" htmlFor="pt-qty">
              Qty × cost
            </label>
            <div className="row gap">
              <input
                id="pt-qty"
                className="input qty"
                type="number"
                min="0"
                inputMode="numeric"
                value={form.qty}
                onChange={(e) => set({ qty: e.target.value })}
              />
              <span className="muted">×</span>
              <span className="money-input">
                $
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.unitCost}
                  onChange={(e) => set({ unitCost: e.target.value })}
                  aria-label="Cost each"
                />
              </span>
              <span className="muted small nowrap">= {money((parseInt(form.qty, 10) || 0) * (parseFloat(form.unitCost) || 0))}</span>
            </div>
            <label className="field-label" htmlFor="pt-url">
              Link
            </label>
            <input
              id="pt-url"
              className="input"
              value={form.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="Product page"
              inputMode="url"
            />
            <label className="field-label" htmlFor="pt-sub">
              Subteam
            </label>
            <select id="pt-sub" className="input" value={form.subteam} onChange={(e) => set({ subteam: e.target.value })}>
              <option value="">None</option>
              {SUBTEAMS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="field-label" htmlFor="pt-task">
              For task
            </label>
            <select id="pt-task" className="input" value={form.taskId} onChange={(e) => set({ taskId: e.target.value })}>
              <option value="">None</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || 'Untitled'}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input description"
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Notes (optional)"
          />
          <div className="row gap end">
            {onDelete && (
              <button type="button" className="link-btn danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!form.name.trim()}>
              {part.id ? 'Save' : 'Add part'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

export default function PartsView({ parts, tasks, api, onOpenTask }) {
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const taskTitle = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t.title])), [tasks]);

  const totals = useMemo(() => {
    const t = { needed: 0, ordered: 0, arrived: 0, counts: {} };
    for (const p of parts) {
      t[p.status] = (t[p.status] || 0) + partTotal(p);
      t.counts[p.status] = (t.counts[p.status] || 0) + 1;
    }
    return t;
  }, [parts]);

  const rows = useMemo(() => {
    const rank = Object.fromEntries(PART_STATUSES.map((s, i) => [s.id, i]));
    const needle = q.trim().toLowerCase();
    return parts
      .filter((p) => !filter || p.status === filter)
      .filter((p) => !needle || `${p.name} ${p.vendor} ${p.partNumber} ${p.notes}`.toLowerCase().includes(needle))
      .sort((a, b) => rank[a.status] - rank[b.status] || (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [parts, filter, q]);

  return (
    <main className="content parts">
      <div className="ms-header">
        <div>
          <h1>Parts &amp; orders</h1>
          <p className="muted">
            Spent <b className="money">{money(totals.ordered + totals.arrived)}</b> · Still to buy{' '}
            <b className="money">{money(totals.needed)}</b>
          </p>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({})}>
          <PlusIcon /> Add part
        </button>
      </div>

      <div className="parts-filters">
        <input className="search" type="search" placeholder="Search parts…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`chip${!filter ? ' on' : ''}`} onClick={() => setFilter('')}>
          All <strong>{parts.length}</strong>
        </button>
        {PART_STATUSES.map((s) => (
          <button key={s.id} className={`chip${filter === s.id ? ' on' : ''}`} onClick={() => setFilter(filter === s.id ? '' : s.id)}>
            <span className="dot" style={{ background: s.color }} /> {s.label} <strong>{totals.counts[s.id] || 0}</strong>
          </button>
        ))}
      </div>

      {parts.length ? (
        <div className="table-wrap">
          <table className="grid parts-grid">
            <thead>
              <tr>
                <th>Part</th>
                <th>Status</th>
                <th>Vendor</th>
                <th className="num">Qty</th>
                <th className="num">Total</th>
                <th>For task</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} onClick={() => setEditing(p)} className={p.status === 'arrived' ? 'is-arrived' : ''}>
                  <td>
                    <div className="part-name">{p.name}</div>
                    <div className="muted tiny">
                      {[p.partNumber, p.subteam].filter(Boolean).join(' · ')}
                      {p.url && (
                        <>
                          {(p.partNumber || p.subteam) && ' · '}
                          <a href={p.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            Link ↗
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <PartStatusSelect value={p.status} onChange={(status) => api.updatePart(p, { status })} />
                  </td>
                  <td>{p.vendor || <span className="muted">—</span>}</td>
                  <td className="num">{p.qty}</td>
                  <td className="num">
                    {money(partTotal(p))}
                    {p.qty > 1 && <div className="muted tiny">{money(p.unitCost)} each</div>}
                  </td>
                  <td>
                    {p.taskId && taskTitle[p.taskId] ? (
                      <button
                        className="link-btn task-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTask(p.taskId);
                        }}
                      >
                        {taskTitle[p.taskId]}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted small">
                    {relTime(p.updatedAt)}
                    <div className="tiny">{p.updatedBy?.split(' ')[0] || p.createdBy?.split(' ')[0]}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="empty">No parts match.</p>}
        </div>
      ) : (
        <div className="empty-card">
          <h2>No parts yet</h2>
          <p className="muted">
            Track what the team needs to buy, what's been ordered, and what has arrived, with a running total of what you've spent. Link a
            part to a task that's waiting on it.
          </p>
          <button className="btn primary" onClick={() => setEditing({})}>
            <PlusIcon /> Add the first part
          </button>
        </div>
      )}

      {editing && (
        <PartDialog
          part={editing}
          tasks={tasks}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            const p = editing;
            setEditing(null);
            await (p.id ? api.updatePart(p, data) : api.createPart(data));
          }}
          onDelete={
            editing.id
              ? async () => {
                  if (!confirm(`Delete “${editing.name}”?`)) return;
                  const p = editing;
                  setEditing(null);
                  await api.deletePart(p);
                }
              : null
          }
        />
      )}
    </main>
  );
}
