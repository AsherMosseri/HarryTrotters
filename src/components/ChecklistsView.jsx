import { useEffect, useRef, useState } from 'react';
import { STARTER_CHECKLISTS, starterItems } from '../checklists.js';
import { itemId } from '../data/diff.js';
import { fullTime } from '../util.js';
import { CloseIcon, DraftInput, PlusIcon } from './common.jsx';
import { confirmDialog } from './Dialogs.jsx';
import { useFlip } from '../motion.js';

function ChecklistCard({ list, api, isManager, fresh }) {
  const [text, setText] = useState('');
  // Just made: bring it into view with the cursor in its first item.
  const box = useRef(null);
  useEffect(() => {
    if (!fresh || !box.current) return;
    box.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.current.querySelector('.check-add input')?.focus({ preventScroll: true });
  }, [fresh]);
  const items = Object.values(list.items || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const done = items.filter((i) => i.done).length;
  // Items ease in, and the rest slide to make room (Moving things).
  const listRef = useRef(null);
  useFlip(listRef, list.items);

  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const order = items.length ? Math.max(...items.map((i) => i.order ?? 0)) + 1 : 0;
    api.setChecklistItem(list, { id: itemId(), text: t, done: false, order });
    setText('');
  };

  return (
    <section className={`checklist-card${fresh ? ' fresh' : ''}`} ref={box}>
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
      <ul className="check-items" ref={listRef}>
        {items.map((i) => (
          <li key={i.id} data-flip={i.id} className={i.done ? 'done' : ''}>
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
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
      <form className="check-add" onSubmit={add}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="+ Add an item" />
      </form>
      <footer className="row gap">
        {done > 0 && (
          <button
            className="link-btn"
            onClick={async () =>
              (await confirmDialog({ title: `Uncheck everything in “${list.title}”?`, okLabel: 'Uncheck all' })) &&
              api.uncheckAll(list, items)
            }
          >
            Uncheck all
          </button>
        )}
        <span className="spacer" />
        {isManager && (
          <button
            className="link-btn danger"
            onClick={async () =>
              (await confirmDialog({
                title: `Delete the “${list.title}” checklist?`,
                body: 'This can’t be undone.',
                okLabel: 'Delete',
                danger: true,
              })) && api.deleteChecklist(list)
            }
          >
            Delete checklist
          </button>
        )}
      </footer>
    </section>
  );
}

// New checklist asks for the name first: one made blank and left without a
// name stayed behind, and only team management can delete it.
function NewChecklistCard({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const box = useRef(null);
  useEffect(() => {
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.current?.querySelector('input')?.focus({ preventScroll: true });
  }, []);
  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim());
  };
  return (
    <form className="checklist-card new-checklist" ref={box} onSubmit={submit}>
      <header>
        <input
          className="input checklist-name"
          value={name}
          maxLength={80}
          placeholder="Checklist name"
          aria-label="Checklist name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        />
      </header>
      <footer className="row gap">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={!name.trim()}>
          Create
        </button>
      </footer>
    </form>
  );
}

export default function ChecklistsView({ checklists, api, isManager }) {
  // The one just made with New checklist (it opens at the end of the list).
  const [fresh, setFresh] = useState(null);
  const [naming, setNaming] = useState(false);
  const newList = () => setNaming(true);
  const create = async (title) => {
    setNaming(false);
    const id = await api.createChecklist({ title, items: {} });
    if (id) setFresh(id);
  };
  const namingCard = naming && <NewChecklistCard onCreate={create} onCancel={() => setNaming(false)} />;
  const sorted = [...checklists].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const missingStarters = STARTER_CHECKLISTS.filter((s) => !checklists.some((c) => c.title === s.title));
  const addStarters = () => missingStarters.forEach((s) => api.createChecklist({ title: s.title, items: starterItems(s) }));

  return (
    <main className="content checklists">
      <div className="ms-header">
        <div>
          <h1>Competition checklists</h1>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={newList}>
          <PlusIcon /> New checklist
        </button>
      </div>

      {sorted.length || naming ? (
        <>
          <div className="checklist-grid">
            {sorted.map((c) => (
              <ChecklistCard key={c.id} list={c} api={api} isManager={isManager} fresh={fresh === c.id} />
            ))}
            {namingCard}
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
            <button className="btn" onClick={newList}>
              Start blank
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
