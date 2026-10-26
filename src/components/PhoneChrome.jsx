import { useEffect } from 'react';
import { CloseIcon } from './common.jsx';

// Phone layout pieces: the bottom tab bar, and sheets that slide up from the bottom.
export const PHONE_MAIN = ['board', 'chat', 'shifts', 'parts'];
const ICONS = {
  board: '📋',
  table: '📑',
  chat: '💬',
  shifts: '⏱',
  milestones: '🏁',
  parts: '🔩',
  checklists: '✅',
  runs: '🏎',
  robot: '🤖',
  resources: '📚',
  team: '👥',
};

export function Sheet({ title, onClose, children, className = '' }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="panel-backdrop sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function BottomNav({ views, view, setView, badges = {}, onMore, moreOn }) {
  const main = views.filter(([id]) => PHONE_MAIN.includes(id));
  const inMore = !PHONE_MAIN.includes(view);
  return (
    <nav className="bottom-nav" aria-label="Tabs">
      {main.map(([id, label]) => (
        <button key={id} className={view === id ? 'on' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
          <span className="bn-icon" aria-hidden="true">
            {ICONS[id]}
            {badges[id] ? <span className="bn-badge">{badges[id] > 99 ? '99+' : badges[id]}</span> : null}
          </span>
          <span className="bn-label">{label}</span>
        </button>
      ))}
      <button className={inMore || moreOn ? 'on' : ''} onClick={onMore}>
        <span className="bn-icon" aria-hidden="true">
          ☰
        </span>
        <span className="bn-label">{inMore ? views.find(([id]) => id === view)?.[1] || 'More' : 'More'}</span>
      </button>
    </nav>
  );
}

export function MoreSheet({ views, view, setView, onClose }) {
  return (
    <Sheet title="More" onClose={onClose}>
      <div className="more-grid">
        {views
          .filter(([id]) => !PHONE_MAIN.includes(id))
          .map(([id, label]) => (
            <button
              key={id}
              className={`more-tile${view === id ? ' on' : ''}`}
              onClick={() => {
                setView(id);
                onClose();
              }}
            >
              <span aria-hidden="true">{ICONS[id]}</span>
              {label}
            </button>
          ))}
      </div>
    </Sheet>
  );
}
