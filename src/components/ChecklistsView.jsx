import { useState } from 'react';
import { STARTER_CHECKLISTS, starterItems } from '../checklists.js';
import { itemId } from '../data/diff.js';
import { fullTime } from '../util.js';
import { DraftInput, PlusIcon } from './common.jsx';

function ChecklistCard({ list, api, isManager }) {
  const [text, setText] = useState('');
  const items = Object.values(list.items || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const done = items.filter((i) => i.done).length;

  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const order = items.length ? Math.max(...items.map((i) => i.order ?? 0)) + 1 : 0;
    api.setChecklistItem(list, { id: itemId(), text: t, done: false, order });
    setText('');
  };

  return (
    <section className="checklist-card">
      <header>
        <DraftInput
          value={list.title}
          className="checklist-title"
          placeholder="Checklist name"
          onSave={(t) => t && api.renameChecklist(list, t)}
        />
        <span className="checklist-count">
          {done}/{items.length}
        </span>
      </header>
      <div className="ms-progress-bar" style={{ '--c': done === items.length && items.length ? 'var(--st-done)' : 'var(--accent)' }}>
        <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
      </div>
      <ul className="check-items">
        {items.map((i) => (
          <li key={i.id} className={i.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={!!i.done} onChange={(e) => api.toggleChecklistItem(list, i, e.target.checked)} />
              <span className="check-text">{i.text}</span>
            </label>
            {i.done && i.doneBy && (
              <span className="check-by" title={fullTime(i.doneAt)}>
                {i.doneBy.split(' ')[0]}
              </span>
            )}
            <button className="check-remove" aria-label={`Remove ${i.text}`} onClick={() => api.removeChecklistItem(list, i)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <form className="check-add" onSubmit={add}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="+ Add an item" />
      </form>
      <footer className="row gap">
        {done > 0 && (
          <button className="link-btn" onClick={() => confirm(`Uncheck everything in “${list.title}”?`) && api.uncheckAll(list, items)}>
            Uncheck all
          </button>
        )}
        <span className="spacer" />
        {isManager && (
          <button className="link-btn danger" onClick={() => confirm(`Delete the “${list.title}” checklist?`) && api.deleteChecklist(list)}>
            Delete checklist
          </button>
        )}
      </footer>
    </section>
  );
}

export default function ChecklistsView({ checklists, api, isManager }) {
  const sorted = [...checklists].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const missingStarters = STARTER_CHECKLISTS.filter((s) => !checklists.some((c) => c.title === s.title));
  const addStarters = () => missingStarters.forEach((s) => api.createChecklist({ title: s.title, items: starterItems(s) }));

  return (
    <main className="content checklists">
      <div className="ms-header">
        <div>
          <h1>Competition checklists</h1>
          <p className="muted">Everyone sees the same boxes. Tick things off as you go.</p>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => api.createChecklist({ title: 'New checklist', items: {} })}>
          <PlusIcon /> New checklist
        </button>
      </div>

      {sorted.length ? (
        <>
          <div className="checklist-grid">
            {sorted.map((c) => (
              <ChecklistCard key={c.id} list={c} api={api} isManager={isManager} />
            ))}
          </div>
          {missingStarters.length > 0 && (
            <p className="muted small starter-hint">
              Want a ready-made list?{' '}
              <button className="link-btn" onClick={addStarters}>
                Add {missingStarters.map((s) => s.title).join(', ')}
              </button>
            </p>
          )}
        </>
      ) : (
        <div className="empty-card">
          <h2>No checklists yet</h2>
          <p className="muted">
            Start with ready-made lists for robot inspection, packing the pit, and competition day, then edit them to fit the team. Check
            the inspection list against this season's Competition Manual.
          </p>
          <div className="row gap center-row">
            <button className="btn primary" onClick={addStarters}>
              Add starter checklists
            </button>
            <button className="btn" onClick={() => api.createChecklist({ title: 'New checklist', items: {} })}>
              Start blank
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
