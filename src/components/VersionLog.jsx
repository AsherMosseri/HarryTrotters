import { useEffect, useState } from 'react';
import { CHANGELOG } from '../changelog.js';
import { CloseIcon } from './common.jsx';

const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

function VersionBlock({ v, open, onToggle, current, currentLabel }) {
  return (
    <section className={`version${open ? ' open' : ''}`}>
      <button className="version-head" onClick={onToggle} aria-expanded={open}>
        <span className="version-num">v{v.version}</span>
        <span className="grow">
          <b>{v.title}</b>
          <span className="muted tiny block">
            {fmtDate(v.date)} · {v.items.length} change{v.items.length === 1 ? '' : 's'}
          </span>
        </span>
        {current && <span className="version-current">{currentLabel}</span>}
        <span className="version-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="version-items">
          {v.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Every version, newest first. `log` can be a newer one (from version.json).
export function VersionLogDialog({ log = CHANGELOG, current, currentLabel = 'Current', onClose }) {
  useEscape(onClose);
  const [open, setOpen] = useState(() => new Set([log[0]?.version]));
  const toggle = (ver) => setOpen((s) => (s.has(ver) ? new Set([...s].filter((x) => x !== ver)) : new Set([...s, ver])));
  const all = open.size === log.length;
  return (
    <div className="panel-backdrop center version-backdrop" onClick={onClose}>
      <div className="dialog version-log" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="vlog-title">
        <div className="panel-head">
          <h2 id="vlog-title">Version log</h2>
          <span className="spacer" />
          <button className="link-btn small" onClick={() => setOpen(new Set(all ? [] : log.map((v) => v.version)))}>
            {all ? 'Collapse all' : 'Expand all'}
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="muted small">
          {log.length} versions, {log.reduce((n, v) => n + v.items.length, 0)} changes since the first board.
        </p>
        {log.map((v) => (
          <VersionBlock
            key={v.version}
            v={v}
            open={open.has(v.version)}
            onToggle={() => toggle(v.version)}
            current={v.version === current}
            currentLabel={currentLabel}
          />
        ))}
      </div>
    </div>
  );
}

// Shown once after updating: what changed since the version this device last saw.
export function WhatsNew({ versions, onClose, onFullLog }) {
  useEscape(onClose);
  const latest = versions[0];
  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog whats-new" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="new-title">
        <div className="whats-new-badge">v{latest.version}</div>
        <h2 id="new-title">What’s new in version {latest.version}</h2>
        {versions.map((v) => (
          <div key={v.version} className="whats-new-version">
            {versions.length > 1 && (
              <h3>
                v{v.version} · {v.title}
              </h3>
            )}
            {versions.length === 1 && <p className="muted">{v.title}</p>}
            <ul className="version-items">
              {v.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="row gap">
          <button className="btn" onClick={onFullLog}>
            Full version log
          </button>
          <span className="spacer" />
          <button className="btn primary" onClick={onClose} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
