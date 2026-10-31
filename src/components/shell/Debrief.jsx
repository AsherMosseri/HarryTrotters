import { useEffect, useId, useRef, useState } from 'react';
import { Overlay } from '../common.jsx';
import { Icon } from './icons.jsx';
import { DEBRIEF_CHIPS, fixTasks } from '../../debrief.js';
import { isTouch } from '../../util.js';
import { teamDay } from '../../../functions/shared/coins.js';

// After a score goes in (the pit's score pad, or Log a run in the Match log):
// one optional step. Tap what went wrong, add a line, and fix tasks are made.
// Skip is one tap and the score is already saved either way.
export default function Debrief({ match, next, api, onClose }) {
  const [chips, setChips] = useState([]);
  const [note, setNote] = useState('');
  const [made, setMade] = useState(null);
  const box = useRef(null);
  const ids = useId();
  const tasks = fixTasks({ match, chips, note, next });

  // Focus the card (not the note box: on a phone that would raise the keyboard).
  useEffect(() => {
    const before = document.activeElement;
    box.current?.focus({ preventScroll: true });
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true });
    };
  }, []);

  const make = () => {
    if (!tasks.length) return;
    for (const t of tasks) api.create(t);
    setMade(tasks);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <Overlay>
      <div className="panel-backdrop center db-backdrop" onClick={onClose} onKeyDown={onKeyDown}>
        <div
          ref={box}
          tabIndex={-1}
          className="dialog debrief"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${ids}t`}
          onClick={(e) => e.stopPropagation()}
        >
          {made ? (
            <>
              <h2 id={`${ids}t`}>
                <Icon name="check" size={18} /> {made.length === 1 ? 'Fix task made' : `${made.length} fix tasks made`}
              </h2>
              <ul className="db-made">
                {made.map((t) => (
                  <li key={t.title}>
                    {t.title}
                    <small>{[t.subteam, t.dueDate === teamDay(Date.now()) ? 'due today' : 'due tomorrow'].filter(Boolean).join(' · ')}</small>
                  </li>
                ))}
              </ul>
              <div className="db-actions">
                <button className="btn primary" onClick={onClose} autoFocus={!isTouch}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id={`${ids}t`}>{match.label} is in the log</h2>
              <p className="db-ask muted">What went wrong? What do we fix before the next match?</p>
              <div className="db-chips" role="group" aria-label="What went wrong">
                {DEBRIEF_CHIPS.map((c) => {
                  const on = chips.includes(c.id);
                  return (
                    <button key={c.id} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setChips(on ? chips.filter((x) => x !== c.id) : [...chips, c.id])}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <input
                className="input db-note"
                value={note}
                maxLength={140}
                placeholder="One line, e.g. intake jammed in auto"
                aria-label="One line about it"
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    make();
                  }
                }}
              />
              <div className="db-actions">
                <button className="btn" onClick={onClose}>
                  Skip
                </button>
                <button className="btn primary" onClick={make} disabled={!tasks.length}>
                  {tasks.length > 1 ? `Make ${tasks.length} fix tasks` : 'Make fix tasks'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
