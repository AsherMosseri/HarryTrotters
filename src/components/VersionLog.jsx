import { useEffect, useRef, useState } from 'react';
import { CHANGELOG } from '../changelog.js';
import { CloseIcon, Overlay } from './common.jsx';
import { RequestBox } from './Requests.jsx';

// Every change in a version: its sections' lists when it has them (3.0 does), else its items.
export const allItems = (v) => (v.sections ? v.sections.flatMap((x) => x.items) : v.items);

function Items({ v }) {
  if (!v.sections) {
    return (
      <ul className="version-items">
        {v.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    );
  }
  return v.sections.map((sec) => (
    <div key={sec.title} className="version-section">
      <h4>{sec.title}</h4>
      <ul className="version-items">
        {sec.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  ));
}

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
            {fmtDate(v.date)} · {allItems(v).length} change{allItems(v).length === 1 ? '' : 's'}
          </span>
        </span>
        {current && <span className="version-current">{currentLabel}</span>}
        <span className="version-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <Items v={v} />}
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
    <Overlay>
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
            {log.length} versions, {log.reduce((n, v) => n + allItems(v).length, 0)} changes since the first board.
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
    </Overlay>
  );
}

// Shown once after updating: what changed since the version this device last saw.
export function WhatsNew({ versions, onClose, onFullLog, onRequest }) {
  useEscape(onClose);
  const latest = versions[0];
  // Focus Got it (Enter closes) without scrolling the list to the bottom.
  const gotIt = useRef(null);
  useEffect(() => gotIt.current?.focus({ preventScroll: true }), []);
  return (
    <Overlay>
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
              <Items v={v} />
            </div>
          ))}
          {onRequest && (
            <div className="whats-new-idea">
              <h3>What should we add next?</h3>
              <RequestBox onSend={onRequest} />
            </div>
          )}
          <div className="row gap">
            <button className="btn" onClick={onFullLog}>
              Full version log
            </button>
            <span className="spacer" />
            <button className="btn primary" onClick={onClose} ref={gotIt}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
