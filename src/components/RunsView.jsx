import { useEffect, useMemo, useRef, useState } from 'react';
import { shortDate, todayISO } from '../milestones.js';
import { Avatar, CloseIcon, Overlay, PlusIcon } from './common.jsx';
import { useEscape } from '../util.js';
import { confirmDialog } from './Dialogs.jsx';

const PERIODS = [
  { key: 'auto', label: 'Auto' },
  { key: 'teleop', label: 'TeleOp' },
  { key: 'endgame', label: 'Endgame' },
];
const RESULTS = { win: 'Win', loss: 'Loss', tie: 'Tie' };
const total = (r) => (Number(r.auto) || 0) + (Number(r.teleop) || 0) + (Number(r.endgame) || 0);
const runLabel = (r) => (r.type === 'match' ? `Match${r.matchNumber ? ` ${r.matchNumber}` : ''}` : 'Practice');
const byTime = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0);

// Round axis: a step of 5/10/25/50/100… and a max that's a whole number of steps.
function niceScale(v) {
  const step = [5, 10, 25, 50, 100, 250, 500].find((s) => v / s <= 5) || 1000;
  return { step, max: Math.max(step, Math.ceil(v / step) * step) };
}

// Stacked columns: one per run, Auto / TeleOp / Endgame, oldest on the left.
function ScoreChart({ runs }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 230;
  const m = { top: 12, right: 64, bottom: 28, left: 36 };
  const plotW = width - m.left - m.right;
  const plotH = H - m.top - m.bottom;
  const { step, max } = niceScale(Math.max(...runs.map(total), 1));
  const y = (v) => m.top + plotH - (v / max) * plotH;
  const band = plotW / runs.length;
  const barW = Math.max(6, Math.min(36, band * 0.62));
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(runs.length / Math.max(2, Math.floor(plotW / 70))));
  const last = runs.length - 1;

  const segments = (r, i) => {
    const x = m.left + band * i + (band - barW) / 2;
    let base = 0;
    return PERIODS.map((p, k) => {
      const v = Number(r[p.key]) || 0;
      const y0 = y(base);
      base += v;
      const y1 = y(base);
      // 2px surface gap between stacked segments
      const h = Math.max(0, y0 - y1 - (k > 0 && v ? 2 : 0));
      return { key: p.key, x, y: y1, h, v, top: k === 2 || PERIODS.slice(k + 1).every((q) => !(Number(r[q.key]) > 0)) };
    });
  };

  const a = active !== null ? runs[active] : null;
  const aX = a ? m.left + band * active + band / 2 : 0;

  return (
    <div className="score-chart" ref={wrap}>
      <div className="chart-legend">
        {PERIODS.map((p) => (
          <span key={p.key}>
            <i className={`sw sw-${p.key}`} /> {p.label}
          </span>
        ))}
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Points per run, split into Auto, TeleOp, and Endgame"
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
            <text x={m.left - 6} y={y(t) + 4} textAnchor="end" className="tick">
              {t}
            </text>
          </g>
        ))}
        {runs.map((r, i) => {
          const segs = segments(r, i);
          const topSeg = [...segs].reverse().find((s) => s.v > 0);
          const barTop = topSeg ? topSeg.y : y(0);
          return (
            <g key={r.id} opacity={active === null || active === i ? 1 : 0.45}>
              <clipPath id={`bar-${r.id}`}>
                <rect x={segs[0].x} y={barTop} width={barW} height={y(0) - barTop + 4} rx={4} />
              </clipPath>
              <g clipPath={`url(#bar-${r.id})`}>
                {segs.map((s) =>
                  s.h > 0 ? <rect key={s.key} className={`seg-${s.key}`} x={s.x} y={s.y} width={barW} height={s.h} /> : null,
                )}
              </g>
              {i % labelEvery === 0 || i === last ? (
                <text x={m.left + band * i + band / 2} y={H - 8} textAnchor="middle" className="tick">
                  {shortDate(r.date)}
                </text>
              ) : null}
              {/* Hit target: the whole column, bigger than the bar */}
              <rect
                x={m.left + band * i}
                y={m.top}
                width={band}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
            </g>
          );
        })}
        {/* Direct labels beside the newest bar */}
        {segments(runs[last], last)
          .filter((s) => s.h >= 12)
          .map((s) => (
            <text key={s.key} x={s.x + barW + 6} y={s.y + s.h / 2 + 4} className="direct-label">
              {PERIODS.find((p) => p.key === s.key).label}
            </text>
          ))}
      </svg>
      {a && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(aX, 90), width - 90), top: Math.max(0, y(total(a)) - 8) }}>
          <div className="tip-head">
            {shortDate(a.date)} · {runLabel(a)}
            {a.result ? ` · ${RESULTS[a.result]}` : ''}
          </div>
          {[...PERIODS].reverse().map((p) => (
            <div key={p.key} className="tip-row">
              <i className={`sw sw-${p.key}`} /> {p.label} <b>{Number(a[p.key]) || 0}</b>
            </div>
          ))}
          <div className="tip-row tip-total">
            Total <b>{total(a)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

function RunDialog({ run, roster, onClose, onSave, onDelete }) {
  useEscape(onClose);
  const isNew = !run.id;
  const [form, setForm] = useState({
    date: run.date || todayISO(),
    type: run.type || 'practice',
    matchNumber: run.matchNumber || '',
    result: run.result || '',
    drivers: run.drivers || [],
    auto: run.auto ?? '',
    teleop: run.teleop ?? '',
    endgame: run.endgame ?? '',
    penalties: run.penalties || '',
    issues: run.issues || '',
    notes: run.notes || '',
  });
  const [makeTask, setMakeTask] = useState(true);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const sum = num(form.auto) + num(form.teleop) + num(form.endgame);

  const submit = (e) => {
    e.preventDefault();
    onSave(
      {
        ...form,
        matchNumber: form.type === 'match' ? form.matchNumber.trim() : '',
        result: form.type === 'match' ? form.result : '',
        auto: num(form.auto),
        teleop: num(form.teleop),
        endgame: num(form.endgame),
        penalties: num(form.penalties),
        issues: form.issues.trim(),
        notes: form.notes.trim(),
      },
      isNew && makeTask && form.issues.trim(),
    );
  };

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form className="dialog run-dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
          <div className="panel-head">
            <h2>{isNew ? 'Log a run' : 'Edit run'}</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="fields">
            <span className="field-label">Type</span>
            <div className="segmented">
              {[
                ['practice', 'Practice'],
                ['match', 'Competition match'],
              ].map(([id, label]) => (
                <button type="button" key={id} className={`plain-seg${form.type === id ? ' on' : ''}`} onClick={() => set({ type: id })}>
                  {label}
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="r-date">
              Date
            </label>
            <input id="r-date" className="input" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
            {form.type === 'match' && (
              <>
                <label className="field-label" htmlFor="r-match">
                  Match
                </label>
                <div className="row gap wrap">
                  <input
                    id="r-match"
                    className="input match-no"
                    value={form.matchNumber}
                    onChange={(e) => set({ matchNumber: e.target.value })}
                    placeholder="e.g. Q12"
                  />
                  <div className="segmented">
                    {Object.entries(RESULTS).map(([id, label]) => (
                      <button
                        type="button"
                        key={id}
                        className={`plain-seg${form.result === id ? ' on' : ''}`}
                        onClick={() => set({ result: form.result === id ? '' : id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <span className="field-label">Drivers</span>
            <div className="assignee-picker">
              {roster.map((n) => {
                const on = form.drivers.includes(n);
                return (
                  <button
                    type="button"
                    key={n}
                    className={`person${on ? ' on' : ''}`}
                    onClick={() => set({ drivers: on ? form.drivers.filter((x) => x !== n) : [...form.drivers, n] })}
                  >
                    <Avatar name={n} size={20} /> {n.split(' ')[0]}
                  </button>
                );
              })}
            </div>
            <span className="field-label">Points</span>
            <div className="points-grid">
              {PERIODS.map((p) => (
                <label key={p.key}>
                  <span>
                    <i className={`sw sw-${p.key}`} /> {p.label}
                  </span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form[p.key]}
                    onChange={(e) => set({ [p.key]: e.target.value })}
                    placeholder="0"
                  />
                </label>
              ))}
              <label>
                <span>Penalties</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.penalties}
                  onChange={(e) => set({ penalties: e.target.value })}
                  placeholder="0"
                />
              </label>
              <div className="points-total">
                Total <b>{sum}</b>
              </div>
            </div>
          </div>
          <label className="field-label" htmlFor="r-issues">
            Anything break or go wrong?
          </label>
          <textarea
            id="r-issues"
            className="input description"
            rows={2}
            value={form.issues}
            onChange={(e) => set({ issues: e.target.value })}
            placeholder="e.g. Intake jammed on the second cycle"
          />
          {isNew && form.issues.trim() && (
            <label className="done-toggle small">
              <input type="checkbox" checked={makeTask} onChange={(e) => setMakeTask(e.target.checked)} />
              Also add a task to fix it
            </label>
          )}
          <textarea
            className="input description"
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Notes: strategy, what worked, cycle times… (optional)"
          />
          <div className="row gap end dialog-actions">
            {onDelete && (
              <button type="button" className="link-btn danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary">{isNew ? 'Save run' : 'Save'}</button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

export default function RunsView({ runs, roster, api }) {
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);

  const shown = useMemo(() => runs.filter((r) => !filter || r.type === filter).sort(byTime), [runs, filter]);
  const stats = useMemo(() => {
    if (!shown.length) return null;
    const totals = shown.map(total);
    const recent = totals.slice(-5);
    const avg = (xs) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
    return {
      recent: avg(recent),
      recentN: recent.length,
      best: Math.max(...totals),
      auto: avg(shown.map((r) => Number(r.auto) || 0)),
      issues: shown.filter((r) => r.issues).length,
    };
  }, [shown]);
  const count = (type) => runs.filter((r) => r.type === type).length;

  return (
    <main className="content runs">
      <div className="ms-header">
        <div>
          <h1>Practice &amp; match log</h1>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({})}>
          <PlusIcon /> Log a run
        </button>
      </div>

      {runs.length ? (
        <>
          <div className="parts-filters">
            {[
              ['', 'All', runs.length],
              ['practice', 'Practice', count('practice')],
              ['match', 'Matches', count('match')],
            ].map(([id, label, n]) => (
              <button key={label} className={`chip${filter === id ? ' on' : ''}`} onClick={() => setFilter(id)}>
                {label} <strong>{n}</strong>
              </button>
            ))}
          </div>

          {stats ? (
            <>
              <div className="stat-tiles">
                <div className="stat">
                  <span>Average, last {stats.recentN}</span>
                  <b>{stats.recent}</b>
                </div>
                <div className="stat">
                  <span>Best total</span>
                  <b>{stats.best}</b>
                </div>
                <div className="stat">
                  <span>Average auto</span>
                  <b>{stats.auto}</b>
                </div>
                <div className="stat">
                  <span>Runs with problems</span>
                  <b>
                    {stats.issues}
                    <small> of {shown.length}</small>
                  </b>
                </div>
              </div>
              <section className="chart-card">
                <h2>Points per run</h2>
                <ScoreChart runs={shown.slice(-20)} />
                {shown.length > 20 && <p className="muted tiny">Showing the latest 20 runs.</p>}
              </section>
            </>
          ) : (
            <p className="empty">No runs of this type yet.</p>
          )}

          <div className="table-wrap">
            <table className="grid runs-grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Run</th>
                  <th>Drivers</th>
                  <th className="num">Auto</th>
                  <th className="num">TeleOp</th>
                  <th className="num">Endgame</th>
                  <th className="num">Total</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {[...shown].reverse().map((r) => (
                  <tr key={r.id} onClick={() => setEditing(r)}>
                    <td className="nowrap">{shortDate(r.date)}</td>
                    <td className="nowrap">
                      {runLabel(r)}
                      {r.result && <span className={`result result-${r.result}`}>{RESULTS[r.result]}</span>}
                    </td>
                    <td className="muted small">{(r.drivers || []).map((d) => d.split(' ')[0]).join(', ') || '—'}</td>
                    <td className="num">{r.auto}</td>
                    <td className="num">{r.teleop}</td>
                    <td className="num">{r.endgame}</td>
                    <td className="num">
                      <b>{total(r)}</b>
                      {r.penalties > 0 && <div className="muted tiny">{r.penalties} pen.</div>}
                    </td>
                    <td className={r.issues ? 'issue-cell' : 'muted'}>{r.issues || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-card">
          <h2>No runs logged yet</h2>
          <p className="muted">
            After each practice run or match, log the Auto, TeleOp, and Endgame points and anything that went wrong. The chart shows whether
            the robot's scores are climbing toward November 14.
          </p>
          <button className="btn primary" onClick={() => setEditing({})}>
            <PlusIcon /> Log the first run
          </button>
        </div>
      )}

      {editing && (
        <RunDialog
          run={editing}
          roster={roster}
          onClose={() => setEditing(null)}
          onSave={async (data, issueTask) => {
            const r = editing;
            setEditing(null);
            if (r.id) await api.updateRun(r, data);
            else await api.createRun(data);
            if (issueTask) {
              await api.create({
                title: `Fix: ${data.issues.length > 70 ? data.issues.slice(0, 67) + '…' : data.issues}`,
                description: `Found during ${runLabel(data).toLowerCase()} on ${shortDate(data.date)}:\n${data.issues}`,
                priority: 'high',
                status: 'todo',
              });
            }
          }}
          onDelete={
            editing.id
              ? async () => {
                  if (!(await confirmDialog({ title: 'Delete this run?', body: 'This can’t be undone.', okLabel: 'Delete', danger: true })))
                    return;
                  const r = editing;
                  setEditing(null);
                  await api.deleteRun(r);
                }
              : null
          }
        />
      )}
    </main>
  );
}
