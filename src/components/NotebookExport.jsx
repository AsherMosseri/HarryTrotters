import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { CloseIcon, Overlay } from './common.jsx';
import { useEscape } from '../util.js';
import { AREAS } from '../labLog.js';
import { buildNotebook, fileStem, notebookCsv, notebookMarkdown, presetRange } from '../notebook.js';

// "Export for the notebook" (D6): the lab log for a date range as plain text
// for the engineering notebook, grouped by week and day. Everyone can use it
// (the lab log is open to the whole team); it all happens on this device from
// data the app already reads. Voice notes and photos are only counted.

const PRESETS = [
  ['4w', 'Last 4 weeks'],
  ['season', 'This season'],
];

function download(name, text, type) {
  // A byte-order mark makes Excel read the CSV as UTF-8.
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' : '', text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText(text, box) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some home-screen apps: select the text and copy.
    try {
      box?.focus();
      box?.select();
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

export default function NotebookExport({ api, actor, roster, shifts, tasks, milestones, rename, onClose }) {
  useEscape(onClose);
  const [preset, setPreset] = useState('4w');
  const [range, setRange] = useState(() => presetRange('4w'));
  const [area, setArea] = useState('');
  // Team management starts with everyone; everyone else starts with their own.
  const [person, setPerson] = useState(actor.admin ? '' : actor.name);
  const [rawLogs, setRawLogs] = useState(null);
  const [note, setNote] = useState('');
  const box = useRef(null);

  // Lab logs from the start of the range (the page itself only holds the last month).
  useEffect(() => {
    setRawLogs(null);
    return api.subscribeLabLogs(range.from, setRawLogs);
  }, [api, range.from]);
  const logs = useMemo(
    () =>
      rawLogs &&
      rawLogs.map((l) => ({
        ...l,
        person: rename(l.person || ''),
        workedWith: Array.isArray(l.workedWith) ? l.workedWith.map(rename) : l.workedWith,
      })),
    [rawLogs, rename],
  );

  const nb = useMemo(
    () => (logs ? buildNotebook({ logs, shifts, tasks, milestones, from: range.from, to: range.to, area, person }) : null),
    [logs, shifts, tasks, milestones, range, area, person],
  );
  const md = useMemo(() => (nb ? notebookMarkdown(nb) : ''), [nb]);
  const valid = range.from && range.to && range.from <= range.to;

  const pick = (id) => {
    setPreset(id);
    setRange(presetRange(id));
    setNote('');
  };
  const setDate = (patch) => {
    setPreset('');
    setRange((r) => ({ ...r, ...patch }));
    setNote('');
  };

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog nb-dialog" role="dialog" aria-modal="true" aria-label="Export for the notebook" onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>Export for the notebook</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small nb-intro">The lab log as text for the engineering notebook, by week and day. Copy it, or save it as a file.</p>

          <div className="nb-form">
            <div className="nb-field wide">
              <span className="mf-label">Dates</span>
              <div className="segmented" role="radiogroup" aria-label="Dates">
                {PRESETS.map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={preset === id} className={`plain-seg${preset === id ? ' on' : ''}`} onClick={() => pick(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="nb-field">
              <span className="mf-label">From</span>
              <input className="input mono" type="date" value={range.from} max={range.to || undefined} onChange={(e) => setDate({ from: e.target.value })} />
            </label>
            <label className="nb-field">
              <span className="mf-label">To</span>
              <input className="input mono" type="date" value={range.to} min={range.from || undefined} onChange={(e) => setDate({ to: e.target.value })} />
            </label>
            <label className="nb-field full-sm">
              <span className="mf-label">Area</span>
              <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">All areas</option>
                {AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="nb-field full-sm">
              <span className="mf-label">Whose</span>
              <select className="input" value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">Everyone</option>
                {actor.name && <option value={actor.name}>Just me</option>}
                {roster
                  .filter((n) => n !== actor.name)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="nb-sum" role="status">
            {!valid ? (
              <span>Pick a start date that comes before the end date.</span>
            ) : !nb ? (
              <span>Loading the lab log…</span>
            ) : nb.days ? (
              <span>
                <b className="mono">{nb.days}</b> lab {nb.days === 1 ? 'day' : 'days'} · <b className="mono">{nb.people.length}</b> {nb.people.length === 1 ? 'person' : 'people'} ·{' '}
                <b className="mono">{nb.hours.toFixed(1)} h</b> · <b className="mono">{nb.finished}</b> {nb.finished === 1 ? 'task' : 'tasks'} finished
              </span>
            ) : (
              <span>Nothing was logged in this range.</span>
            )}
          </div>

          <div className="nb-actions">
            <button
              className="btn primary"
              disabled={!valid || !nb?.days}
              onClick={async () => setNote((await copyText(md, box.current)) ? 'Copied. Paste it into the notebook.' : 'Couldn’t copy. Select the text and copy it by hand.')}
            >
              <Icon name="copy" size={16} /> Copy
            </button>
            <button className="btn" disabled={!valid || !nb?.days} onClick={() => download(`${fileStem(nb)}.md`, md, 'text/markdown')}>
              <Icon name="drop" size={16} /> Download .md
            </button>
            <button className="btn" disabled={!valid || !nb?.days} onClick={() => download(`${fileStem(nb)}.csv`, notebookCsv(nb), 'text/csv')}>
              <Icon name="drop" size={16} /> Download .csv
            </button>
            <span className="nb-note muted small" role="status">
              {note}
            </span>
          </div>

          <textarea ref={box} className="input nb-out mono" readOnly value={valid ? md : ''} aria-label="Notebook text" spellCheck={false} onFocus={(e) => e.target.select()} />
        </div>
      </div>
    </Overlay>
  );
}
