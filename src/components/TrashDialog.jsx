import { relTime, useEscape } from '../util.js';
import { CloseIcon, Overlay, StatusDot } from './common.jsx';

export default function TrashDialog({ trash, days, isManager, api, onClose }) {
  useEscape(onClose);
  const daysLeft = (t) => Math.max(0, Math.ceil(days - (Date.now() - t.deletedAt) / 86400000));
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>Recently deleted</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small">Deleted tasks stay here for {days} days, then they're removed for good, along with their photos.</p>
          <ul className="trash-list">
            {trash.map((t) => (
              <li key={t.id}>
                <StatusDot status={t.status} />
                <div className="grow">
                  <div className="trash-title">{t.title || 'Untitled'}</div>
                  <div className="muted tiny">
                    Deleted by {t.deletedBy?.split(' ')[0] || '?'} {relTime(t.deletedAt)} · {daysLeft(t)} day{daysLeft(t) === 1 ? '' : 's'}{' '}
                    left
                  </div>
                </div>
                <button className="btn" onClick={() => api.restore(t)}>
                  Restore
                </button>
                {isManager && (
                  <button
                    className="link-btn danger"
                    onClick={() => confirm(`Delete “${t.title || 'Untitled'}” forever? This can't be undone.`) && api.deleteForever(t)}
                  >
                    Delete forever
                  </button>
                )}
              </li>
            ))}
            {!trash.length && <li className="muted">Nothing here.</li>}
          </ul>
        </div>
      </div>
    </Overlay>
  );
}
