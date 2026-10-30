import { Icon } from './shell/icons.jsx';
import { useMemo, useState } from 'react';
import { STATUSES, SUBTEAMS, priorityById } from '../config.js';
import { relTime, fullTime, useLocalStorage } from '../util.js';
import { AvatarStack, DraftInput, DueChip, PrioritySelect, StatusSelect, CommentIcon } from './common.jsx';

const statusRank = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));

const COLUMNS = [
  { key: 'title', label: 'Task', get: (t) => (t.title || '').toLowerCase() },
  { key: 'status', label: 'Status', get: (t) => statusRank[t.status] ?? 99 },
  { key: 'assignees', label: 'Who', get: (t) => (t.assignees?.[0] || '~').toLowerCase() },
  { key: 'subteam', label: 'Subteam', get: (t) => t.subteam || '~' },
  { key: 'priority', label: 'Priority', get: (t) => priorityById[t.priority]?.rank ?? 9 },
  { key: 'dueDate', label: 'Due', get: (t) => t.dueDate || '9999' },
  { key: 'updatedAt', label: 'Updated', get: (t) => -(t.updatedAt || 0) },
];

export default function TableView({ tasks, api, onOpen, total }) {
  const [sort, setSort] = useLocalStorage('table-sort', { key: 'status', dir: 1 });
  const [quick, setQuick] = useState('');

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key) || COLUMNS[1];
    const prio = COLUMNS[4].get;
    return [...tasks].sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (va < vb) return -sort.dir;
      if (va > vb) return sort.dir;
      return prio(a) - prio(b) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
  }, [tasks, sort]);

  const addQuick = (e) => {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    api.create({ title });
    setQuick('');
  };

  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`col-${c.key}`}
                aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}
                onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? -sort.dir : 1 })}
              >
                {c.label}
                <span className="sort-arrow">{sort.key === c.key ? (sort.dir > 0 ? '▲' : '▼') : ''}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="quick-add">
            <td colSpan={COLUMNS.length}>
              <form onSubmit={addQuick}>
                <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="+ Add a task and press Enter" />
              </form>
            </td>
          </tr>
          {rows.map((t) => (
            <tr key={t.id} className={t.status === 'done' ? 'is-done' : ''} onClick={() => onOpen(t.id)}>
              <td className="col-title">
                <div className="title-cell">
                  <DraftInput value={t.title} onSave={(title) => title && api.update(t, { title })} placeholder="Untitled" />
                  {t.photos?.length > 0 && (
                    <span className="meta-count" title="Photos">
                      <Icon name="camera" size={14} /> {t.photos.length}
                    </span>
                  )}
                  {t.checklist?.length > 0 && (
                    <span className="meta-count" title="Checklist">
                      {t.checklist.filter((i) => i.done).length}/{t.checklist.length} done
                    </span>
                  )}
                  {t.commentCount > 0 && (
                    <span className="meta-count" title={`${t.commentCount} comments`}>
                      <CommentIcon /> {t.commentCount}
                    </span>
                  )}
                  <button className="open-btn" aria-label="Open task" onClick={(e) => (e.stopPropagation(), onOpen(t.id))}>
                    Open ›
                  </button>
                </div>
                {t.status === 'blocked' && t.blockedReason && <div className="blocked-note">Waiting: {t.blockedReason}</div>}
              </td>
              <td className="col-status">
                <StatusSelect value={t.status} compact onChange={(status) => api.update(t, { status })} />
              </td>
              <td className="col-assignees">
                <AvatarStack names={t.assignees} />
              </td>
              <td className="col-subteam">
                <select
                  className="cell-select"
                  value={t.subteam || ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => api.update(t, { subteam: e.target.value })}
                  aria-label="Subteam"
                >
                  <option value="">—</option>
                  {SUBTEAMS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td className="col-priority">
                <PrioritySelect value={t.priority} onChange={(priority) => api.update(t, { priority })} />
              </td>
              <td className="col-dueDate">
                <label className="due-cell" onClick={(e) => e.stopPropagation()}>
                  {t.dueDate ? <DueChip dueDate={t.dueDate} status={t.status} /> : <span className="muted">—</span>}
                  <input
                    type="date"
                    value={t.dueDate || ''}
                    onChange={(e) => api.update(t, { dueDate: e.target.value })}
                    aria-label="Due date"
                  />
                </label>
              </td>
              <td className="col-updatedAt muted small" title={`${fullTime(t.updatedAt)} by ${t.updatedBy || '?'}`}>
                {relTime(t.updatedAt)}
                <div className="tiny">{t.updatedBy?.split(' ')[0]}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty">{total ? 'No tasks match these filters.' : 'No tasks yet. Add the first one above!'}</p>}
    </div>
  );
}
