import { useState } from 'react';
import * as CL from '../../functions/shared/checklists.js';
import { Icon } from './shell/icons.jsx';
import { RunMode, progressOf, useChecklistRound } from './ChecklistsView.jsx';

// Checklists you pinned (Checklists tab, ⋯ → Pin to my Today): each one's
// progress, what's left to tick (tap to tick it), and Run for full screen.
// On the usual Today and on the pit screen.
const SHOW = 6;
export default function PinnedChecklists({ pinned = [], checklists = [], matches = [], settings = {}, api, skip = null, onPage }) {
  const round = useChecklistRound(matches, settings, checklists);
  const [run, setRun] = useState(null);
  const lists = pinned.map((id) => checklists.find((c) => c.id === id)).filter((c) => c && c.id !== skip);
  if (!lists.length || !api) return null;
  const runList = run && checklists.find((c) => c.id === run);
  return (
    <>
      {lists.map((list) => {
        const { items, done } = progressOf(list, round);
        const left = items.filter((i) => !CL.isDone(list, i, round));
        const all = items.length > 0 && !left.length;
        return (
          <section key={list.id} className="today-sec pin-list" data-pinned={list.id}>
            <div className="sec-head">
              <h2>{list.title || 'Checklist'}</h2>
              <span className="mono">
                {done}/{items.length}
              </span>
              <span className="spacer" />
              <button className="text-btn" onClick={() => setRun(list.id)}>
                <Icon name="play" size={14} /> Run
              </button>
            </div>
            <div className="ms-progress-bar" style={{ '--c': all ? 'var(--st-done)' : 'var(--accent)' }}>
              <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
            </div>
            {all ? (
              <p className="today-empty">All done.</p>
            ) : (
              <ul className="pin-items">
                {left.slice(0, SHOW).map((i) => (
                  <li key={i.id}>
                    <button className="pin-item" onClick={() => {
                        api.toggleChecklistItem(list, i, true, round);
                        api.checklistToast(`Checked “${i.text.length > 40 ? `${i.text.slice(0, 39)}…` : i.text}”.`, {
                          label: 'Undo',
                          run: () => api.toggleChecklistItem(list, i, false, round),
                        });
                      }} aria-label={`Check ${i.text}`}>
                      <span className="pin-box" aria-hidden="true" />
                      <span className="pin-text">{i.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {left.length > SHOW && (
              <button className="text-btn more" onClick={() => setRun(list.id)}>
                {left.length - SHOW} more
              </button>
            )}
            {!items.length && onPage && (
              <button className="text-btn" onClick={() => onPage('checklists')}>
                Add items on the Checklists tab
              </button>
            )}
          </section>
        );
      })}
      {runList && <RunMode list={runList} round={round} api={api} onClose={() => setRun(null)} />}
    </>
  );
}
