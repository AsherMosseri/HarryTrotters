import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { RobotScene } from '../robot/scene.js';
import { loadModel, diffModels } from '../robot/model.js';
import { relTime, useEscape } from '../util.js';
import { AutoTextarea, CloseIcon, Overlay, PlusIcon, StatusDot } from './common.jsx';
import { confirmDialog, promptDialog } from './Dialogs.jsx';

// Models are kept per version so switching back is instant. A model object can
// only be shown in one viewport at a time, so compare loads its own copy.
const cache = new Map();
function getModel(version, slot = 'main') {
  const id = `${version.id}:${slot}`;
  if (!cache.has(id)) {
    const p = loadModel(version.sample ? { sample: version.sample } : { url: version.url });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id);
}

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmtSize = (bytes) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
const TINT = { added: '#16a34a', removed: '#dc2626', moved: '#f59e0b' };

function CorsHelp() {
  return (
    <div className="empty-card robot-error">
      <h2>The 3D model couldn't download</h2>
      <p className="muted">
        Firebase Storage needs a one-time setting before the site can load 3D files. Team management: open console.cloud.google.com, pick
        the ftc-32313-tasks project, tap the Cloud Shell button (top right, the &gt;_ icon), then paste these two lines:
      </p>
      <pre className="code">
        {`echo '[{"origin":["https://ashermosseri.github.io"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
gcloud storage buckets update gs://ftc-32313-tasks.firebasestorage.app --cors-file=cors.json`}
      </pre>
      <p className="muted small">Then reload this page.</p>
    </div>
  );
}

function UploadDialog({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [check, setCheck] = useState(null); // { parts, triangles } | { error }
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(null);
  useEscape(onClose, progress === null);

  const pick = async (f) => {
    setFile(f);
    setCheck(null);
    setName(f.name.replace(/\.(glb|gltf)$/i, ''));
    try {
      const m = await loadModel({ buffer: await f.arrayBuffer() });
      setCheck({ parts: m.nodes.size, triangles: m.triangles });
    } catch {
      setCheck({ error: true });
    }
  };
  const heavy = file && check && !check.error && (file.size > 40e6 || check.triangles > 1.5e6);

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={() => progress === null && onClose()}>
        <form
          className="dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file || !check || check.error || !name.trim()) return;
            setProgress(0);
            const ok = await onUpload(
              file,
              { name: name.trim(), notes: notes.trim(), triangles: check.triangles, parts: check.parts },
              setProgress,
            );
            if (ok === false) setProgress(null);
            else onClose();
          }}
        >
          <div className="panel-head">
            <h2>Upload a robot version</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={progress !== null}>
              <CloseIcon />
            </button>
          </div>
          <ol className="muted small upload-steps">
            <li>In Onshape, open the robot assembly.</li>
            <li>Right-click the assembly's tab at the bottom → Export.</li>
            <li>Format: GLTF. Detail: Coarse or Medium.</li>
            <li>Choose the downloaded file below.</li>
          </ol>
          <input
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            onChange={(e) => e.target.files[0] && pick(e.target.files[0])}
          />
          {file && !check && <p className="muted small">Checking the file…</p>}
          {check?.error && (
            <p className="form-error">
              This file couldn't be opened as a 3D model. Export the assembly from Onshape as GLTF (a single .glb or .gltf file) and try
              again.
            </p>
          )}
          {check && !check.error && (
            <p className="muted small">
              ✓ {check.parts} parts · {Math.round(check.triangles / 1000)}k triangles · {fmtSize(file.size)}
            </p>
          )}
          {heavy && (
            <p className="warn-note">
              This model is heavy and may be slow on iPads. If it is, export again from Onshape with Coarse detail.
            </p>
          )}
          <div className="fields">
            <label className="field-label" htmlFor="rv-name">
              Name
            </label>
            <input
              id="rv-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. v2 – revised intake"
            />
            <label className="field-label" htmlFor="rv-notes">
              Notes
            </label>
            <AutoTextarea
              id="rv-notes"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What changed? (optional)"
            />
          </div>
          {progress !== null && (
            <div className="ms-progress-bar" style={{ '--c': 'var(--accent)' }}>
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <div className="row gap end">
            <button type="button" className="btn ghost" onClick={onClose} disabled={progress !== null}>
              Cancel
            </button>
            <button className="btn primary" disabled={!file || !check || check.error || !name.trim() || progress !== null}>
              {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function PinDialog({ draft, partName, tasks, parts, onClose, onSave }) {
  useEscape(onClose);
  const [text, setText] = useState('');
  const [taskId, setTaskId] = useState('');
  const [partId, setPartId] = useState('');
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form
          className="dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onSave({ ...draft, text: text.trim(), taskId, partId });
          }}
        >
          <div className="panel-head">
            <h2>Pin on {partName}</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <textarea
            className="input description"
            rows={3}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's the note? e.g. this bracket cracked, check clearance here…"
          />
          <div className="fields">
            <label className="field-label" htmlFor="pin-task">
              Task
            </label>
            <select id="pin-task" className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">None</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="pin-part">
              Part
            </label>
            <select id="pin-part" className="input" value={partId} onChange={(e) => setPartId(e.target.value)}>
              <option value="">None</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row gap end">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!text.trim()}>
              Add pin
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function PartsTree({ model, hidden, selected, onToggle, onSelect, expanded, setExpanded }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!model) return [];
    if (needle) return model.order.filter((n) => n.name.toLowerCase().includes(needle));
    return model.order.filter((n) => {
      for (let p = n.parent; p; p = model.nodes.get(p).parent) if (!expanded.has(p)) return false;
      return true;
    });
  }, [model, needle, expanded]);

  useEffect(() => {
    document.querySelector('.parts-tree .row-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="parts-tree">
      <input
        className="input"
        type="search"
        placeholder={`Search ${model?.nodes.size || 0} parts…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul>
        {rows.map((n) => (
          <li
            key={n.key}
            className={n.key === selected ? 'row-selected' : ''}
            style={{ paddingLeft: needle ? 6 : 6 + n.depth * 14 }}
            onClick={() => onSelect(n.key === selected ? null : n.key)}
          >
            {!needle && n.children.length ? (
              <button
                className="caret"
                aria-label={expanded.has(n.key) ? 'Collapse' : 'Expand'}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = new Set(expanded);
                  next.has(n.key) ? next.delete(n.key) : next.add(n.key);
                  setExpanded(next);
                }}
              >
                {expanded.has(n.key) ? '▾' : '▸'}
              </button>
            ) : (
              <span className="caret" />
            )}
            <span className={`grow part-label${hidden.has(n.key) ? ' is-hidden' : ''}`}>{n.name}</span>
            <button
              className="eye"
              aria-label={hidden.has(n.key) ? `Show ${n.name}` : `Hide ${n.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(n.key);
              }}
            >
              <Icon name={hidden.has(n.key) ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </li>
        ))}
        {!rows.length && <li className="muted small">No parts match.</li>}
      </ul>
    </div>
  );
}

export default function RobotView({ robot, tasks, parts, actor, isManager, api, onOpenTask, onMakeTask, theme }) {
  const versions = useMemo(() => [...robot.versions].sort((a, b) => (b.at || 0) - (a.at || 0)), [robot.versions]);
  const [versionId, setVersionId] = useState(() => {
    try {
      return localStorage.getItem('robot-version') || '';
    } catch {
      return '';
    }
  });
  const version = versions.find((v) => v.id === versionId) || versions[0];
  const [mode, setMode] = useState('view'); // view | pin | sandbox | compare
  const [load, setLoad] = useState({ state: 'idle' });
  const [compareId, setCompareId] = useState('');
  const other = versions.find((v) => v.id === compareId) || versions.find((v) => v.id !== version?.id);
  const [loadB, setLoadB] = useState({ state: 'idle' });
  const [hidden, setHidden] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [selectedB, setSelectedB] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [explode, setExplode] = useState(0);
  const [side, setSide] = useState('parts'); // parts | pins | layouts | changes
  const [pinDraft, setPinDraft] = useState(null);
  const [openPin, setOpenPin] = useState(null);
  const [gizmoMode, setGizmoMode] = useState('translate');
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const boxA = useRef(null);
  const boxB = useRef(null);
  const sceneA = useRef(null);
  const sceneB = useRef(null);
  const pinEls = useRef({});
  const model = load.state === 'ready' ? load.model : null;
  const modelB = loadB.state === 'ready' ? loadB.model : null;

  useEffect(() => {
    try {
      if (version) localStorage.setItem('robot-version', version.id);
    } catch {
      /* ignore */
    }
  }, [version]);

  // Main viewport lives for the whole tab.
  useEffect(() => {
    sceneA.current = new RobotScene(boxA.current, {
      background: cssVar('--surface-2'),
      onSelect: (key) => onSceneSelect.current(key),
      onPinPlace: (draft) => setPinDraft(draft),
      onTransform: () => setDirty(true),
    });
    return () => sceneA.current.dispose();
  }, []);

  useEffect(() => {
    const bg = cssVar('--surface-2');
    sceneA.current?.setBackground(bg);
    sceneB.current?.setBackground(bg);
  }, [theme]);

  // Load the chosen version.
  useEffect(() => {
    if (!version) return;
    let alive = true;
    setLoad({ state: 'loading' });
    setSelected(null);
    setHidden(new Set());
    setExplode(0);
    setDirty(false);
    setOpenPin(null);
    getModel(version).then(
      (m) => {
        if (!alive) return;
        const s = sceneA.current;
        s.explode = 0;
        s.setModel(m);
        s.applyTransforms({});
        s.setHidden([]);
        setExpanded(new Set());
        setLoad({ state: 'ready', model: m });
      },
      (e) => alive && setLoad({ state: 'error', error: e }),
    );
    return () => {
      alive = false;
    };
  }, [version?.id, version?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Second viewport only while comparing.
  useEffect(() => {
    if (mode !== 'compare' || !other || !boxB.current) return;
    const s = new RobotScene(boxB.current, { background: cssVar('--surface-2'), onSelect: (key) => setSelectedB(key) });
    sceneB.current = s;
    s.peer = sceneA.current;
    sceneA.current.peer = s;
    let alive = true;
    setLoadB({ state: 'loading' });
    getModel(other, 'compare').then(
      (m) => {
        if (!alive) return;
        s.explode = 0;
        s.setModel(m);
        s.applyTransforms({});
        s.setHidden([]);
        // Both viewports are narrower now: re-fit, then start them in step.
        requestAnimationFrame(() => {
          if (!alive) return;
          sceneA.current.resize();
          s.resize();
          sceneA.current.view('iso');
          s.camera.position.copy(sceneA.current.camera.position);
          s.orbit.target.copy(sceneA.current.orbit.target);
        });
        setLoadB({ state: 'ready', model: m });
      },
      (e) => alive && setLoadB({ state: 'error', error: e }),
    );
    return () => {
      alive = false;
      sceneA.current.peer = null;
      s.dispose();
      requestAnimationFrame(() => {
        sceneA.current?.resize();
        sceneA.current?.view('iso');
      });
      sceneB.current = null;
      setLoadB({ state: 'idle' });
      setSelectedB(null);
    };
  }, [mode, other?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Older version on the left, current on the right; changes are old → current.
  const changes = useMemo(() => (mode === 'compare' && model && modelB ? diffModels(modelB, model) : null), [mode, model, modelB]);
  useEffect(() => {
    const a = {};
    const b = {};
    if (changes) {
      changes.added.forEach((k) => (a[k] = TINT.added));
      changes.moved.forEach((k) => (a[k] = b[k] = TINT.moved));
      changes.removed.forEach((k) => (b[k] = TINT.removed));
    }
    sceneA.current?.setTints(a);
    sceneB.current?.setTints(b);
  }, [changes, modelB]);

  useEffect(() => sceneA.current?.setSelected(selected), [selected, model]);
  useEffect(() => sceneB.current?.setSelected(selectedB), [selectedB, modelB]);
  useEffect(() => sceneA.current?.setHidden([...hidden]), [hidden, model]);
  useEffect(() => sceneA.current?.setExplode(explode), [explode, model]);
  useEffect(() => sceneA.current?.setGizmoMode(gizmoMode), [gizmoMode]);
  useEffect(() => {
    sceneA.current?.setMode(mode === 'compare' ? 'view' : mode);
    if (mode === 'sandbox' || mode === 'compare') setExplode(0);
    if (mode === 'pin') setSide('pins');
    if (mode === 'sandbox') setSide('layouts');
    if (mode === 'compare') setSide('changes');
    if (mode === 'view') setSide((s) => (s === 'changes' || s === 'layouts' ? 'parts' : s));
  }, [mode]);

  const versionPins = useMemo(
    () => robot.pins.filter((p) => p.versionId === version?.id && (showResolved || !p.resolved)).sort((a, b) => a.at - b.at),
    [robot.pins, version?.id, showResolved],
  );
  const allVersionPins = robot.pins.filter((p) => p.versionId === version?.id);
  const versionLayouts = robot.layouts.filter((l) => l.versionId === version?.id).sort((a, b) => b.at - a.at);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const partById = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])), [parts]);
  const nameOf = (key, m = model) => m?.nodes.get(key)?.name || key?.split('/').pop() || 'part';

  // Hand pin markers to the scene so it can position them every frame.
  useEffect(() => {
    sceneA.current?.setPins(
      model && mode !== 'compare' ? versionPins.map((p) => ({ key: p.key, point: p.point, el: pinEls.current[p.id] })) : [],
    );
  }, [versionPins, model, mode]);

  const toggleHidden = (key) => {
    const next = new Set(hidden);
    next.has(key) ? next.delete(key) : next.add(key);
    setHidden(next);
  };
  const isolate = (key) => {
    // Hide everything that isn't on the path to this part.
    const path = new Set();
    for (let k = key; k; k = model.nodes.get(k).parent) path.add(k);
    const next = new Set();
    for (const n of model.nodes.values()) if (!path.has(n.key) && (!n.parent || path.has(n.parent))) next.add(n.key);
    setHidden(next);
  };
  const selectFromList = (key) => {
    setSelected(key);
    if (key) {
      // Open the tree down to it.
      const next = new Set(expanded);
      for (let p = model.nodes.get(key).parent; p; p = model.nodes.get(p).parent) next.add(p);
      setExpanded(next);
    }
  };

  // The scene was created once, so it calls the latest handler through a ref.
  const onSceneSelect = useRef(null);
  onSceneSelect.current = selectFromList;

  const selNode = selected && model?.nodes.get(selected);
  const s = sceneA.current;

  return (
    <main className="content robot">
      <div className="robot-toolbar">
        <select
          className="input version-select"
          value={version?.id || ''}
          onChange={(e) => {
            setVersionId(e.target.value);
            if (mode === 'compare') setCompareId('');
          }}
          aria-label="Robot version"
          disabled={!versions.length}
        >
          {!versions.length && <option value="">No versions yet</option>}
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => setUploading(true)}>
          <PlusIcon /> Upload version
        </button>
        <div className="segmented mode-switch">
          {[
            ['view', 'View'],
            ['pin', 'Pins'],
            ['sandbox', 'Sandbox'],
            ['compare', 'Compare'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`plain-seg${mode === id ? ' on' : ''}`}
              onClick={() => setMode(id)}
              disabled={!model || (id === 'compare' && versions.length < 2)}
              title={id === 'compare' && versions.length < 2 ? 'Upload a second version to compare' : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        {isManager && version && (
          <button
            className="link-btn danger"
            onClick={async () =>
              (await confirmDialog({
                title: `Delete “${version.name}”?`,
                body: 'Its pins and layouts go with it. This can’t be undone.',
                okLabel: 'Delete',
                danger: true,
              })) &&
              api.deleteRobotVersion(
                version,
                robot.pins.filter((p) => p.versionId === version.id),
                robot.layouts.filter((l) => l.versionId === version.id),
              )
            }
          >
            Delete version
          </button>
        )}
      </div>

      {!versions.length ? (
        <div className="empty-card">
          <h2>No robot model yet</h2>
          <p className="muted">
            Export the robot assembly from Onshape as GLTF and upload it here. Everyone can then spin it around, hide parts, leave pinned
            notes, try ideas in the sandbox, and compare versions.
          </p>
          <button className="btn primary" onClick={() => setUploading(true)}>
            <PlusIcon /> Upload the first version
          </button>
        </div>
      ) : null}

      <div className={`robot-body${versions.length ? '' : ' hidden-body'}${mode === 'compare' ? ' comparing' : ''}`}>
        <aside className="robot-side">
          <div className="side-tabs">
            {(mode === 'compare' ? [['changes', 'Changes']] : [])
              .concat([
                ['parts', 'Parts'],
                ['pins', `Pins${allVersionPins.length ? ` (${allVersionPins.filter((p) => !p.resolved).length})` : ''}`],
              ])
              .concat(
                mode === 'sandbox' || versionLayouts.length
                  ? [['layouts', `Layouts${versionLayouts.length ? ` (${versionLayouts.length})` : ''}`]]
                  : [],
              )
              .map(([id, label]) => (
                <button key={id} className={side === id ? 'on' : ''} onClick={() => setSide(id)}>
                  {label}
                </button>
              ))}
          </div>

          {side === 'parts' && (
            <>
              <div className="row gap wrap side-actions">
                <button className="btn small-btn" onClick={() => setHidden(new Set())} disabled={!hidden.size}>
                  Show all
                </button>
                <button className="btn small-btn" onClick={() => selected && isolate(selected)} disabled={!selected}>
                  Isolate selected
                </button>
              </div>
              <PartsTree
                model={model}
                hidden={hidden}
                selected={selected}
                onToggle={toggleHidden}
                onSelect={selectFromList}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            </>
          )}

          {side === 'pins' && (
            <div className="pin-list">
              <p className="muted small">
                {mode === 'pin' ? 'Tap anywhere on the robot to drop a pin.' : 'Switch to Pins to add a pin.'}{' '}
                <label className="inline-check">
                  <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
                </label>
              </p>
              {versionPins.map((p, i) => (
                <div
                  key={p.id}
                  className={`pin-card${openPin === p.id ? ' open' : ''}${p.resolved ? ' resolved' : ''}`}
                  onClick={() => {
                    setOpenPin(openPin === p.id ? null : p.id);
                    setSelected(p.key);
                  }}
                >
                  <div className="row gap">
                    <span className="pin-num">{i + 1}</span>
                    <b className="grow">{nameOf(p.key)}</b>
                    <span className="muted tiny">
                      {p.by?.split(' ')[0]} · {relTime(p.at)}
                    </span>
                  </div>
                  <p>{p.text}</p>
                  {(taskById[p.taskId] || partById[p.partId]) && (
                    <div className="row gap wrap">
                      {taskById[p.taskId] && (
                        <button
                          className="task-chip"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTask(p.taskId);
                          }}
                        >
                          <StatusDot status={taskById[p.taskId].status} /> {taskById[p.taskId].title}
                        </button>
                      )}
                      {partById[p.partId] && <span className="tag">{partById[p.partId].name}</span>}
                    </div>
                  )}
                  {openPin === p.id && (
                    <div className="row gap wrap pin-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn small-btn" onClick={() => api.updateRobotPin(p.id, { resolved: !p.resolved })}>
                        {p.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                      {!p.taskId && (
                        <button
                          className="btn small-btn"
                          onClick={() =>
                            onMakeTask({
                              title: `${nameOf(p.key)}: ${p.text}`.slice(0, 90),
                              description: `From a pin on the 3D robot (${version.name}), by ${p.by}:\n${p.text}`,
                            })
                          }
                        >
                          <PlusIcon /> Make task
                        </button>
                      )}
                      {(p.byUid === actor.uid || isManager) && (
                        <button
                          className="link-btn danger"
                          onClick={async () =>
                            (await confirmDialog({ title: 'Delete this pin?', okLabel: 'Delete', danger: true })) &&
                            api.deleteRobotPin(p.id)
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!versionPins.length && <p className="muted small">No pins on this version yet.</p>}
            </div>
          )}

          {side === 'layouts' && (
            <div className="layout-list">
              {mode === 'sandbox' && (
                <div className="sandbox-panel">
                  {selNode ? (
                    <>
                      <div className="row gap">
                        <b className="grow">{selNode.name}</b>
                        <button className="link-btn" onClick={() => s.resetPart(selected)}>
                          Reset part
                        </button>
                      </div>
                      <div className="segmented">
                        <button className={`plain-seg${gizmoMode === 'translate' ? ' on' : ''}`} onClick={() => setGizmoMode('translate')}>
                          Move
                        </button>
                        <button className={`plain-seg${gizmoMode === 'rotate' ? ' on' : ''}`} onClick={() => setGizmoMode('rotate')}>
                          Rotate
                        </button>
                      </div>
                      <div className="nudge-grid">
                        {gizmoMode === 'translate'
                          ? [
                              ['x', -1, '← Left'],
                              ['x', 1, 'Right →'],
                              ['y', 1, '↑ Up'],
                              ['y', -1, '↓ Down'],
                              ['z', -1, '⤒ Forward'],
                              ['z', 1, '⤓ Back'],
                            ].map(([a, sign, label]) => (
                              <button key={label} className="btn" onClick={() => s.nudge(a, sign)}>
                                {label}
                              </button>
                            ))
                          : [
                              ['y', 1, '⟲ Turn left'],
                              ['y', -1, '⟳ Turn right'],
                              ['x', 1, '⤴ Tilt up'],
                              ['x', -1, '⤵ Tilt down'],
                              ['z', 1, '↺ Roll left'],
                              ['z', -1, '↻ Roll right'],
                            ].map(([a, sign, label]) => (
                              <button key={label} className="btn" onClick={() => s.turn(a, sign)}>
                                {label}
                              </button>
                            ))}
                      </div>
                      <p className="muted tiny">Each tap moves ½ inch or turns 15°. You can also drag the arrows and rings on the robot.</p>
                    </>
                  ) : (
                    <p className="muted small">
                      Tap a part on the robot (or in Parts) to move or rotate it. This never changes the real CAD.
                    </p>
                  )}
                  <div className="row gap wrap">
                    <button
                      className="btn primary"
                      onClick={async () => {
                        const name = await promptDialog({ title: 'Name this layout', initial: 'Idea: ', okLabel: 'Save', maxLength: 80 });
                        if (!name?.trim()) return;
                        api.saveRobotLayout({
                          versionId: version.id,
                          name: name.trim(),
                          transforms: s.getTransforms(),
                          hidden: [...hidden],
                        });
                        setDirty(false);
                      }}
                    >
                      Save layout
                    </button>
                    <button
                      className="btn"
                      onClick={() => {
                        s.applyTransforms({});
                        setDirty(false);
                      }}
                    >
                      Reset all
                    </button>
                    {dirty && <span className="muted tiny">Unsaved changes</span>}
                  </div>
                </div>
              )}
              <h3 className="section-title">Saved layouts</h3>
              {versionLayouts.map((l) => (
                <div key={l.id} className="layout-card">
                  <div className="grow">
                    <b>{l.name}</b>
                    <div className="muted tiny">
                      {l.by?.split(' ')[0]} · {relTime(l.at)} · {Object.keys(l.transforms || {}).length} moved
                    </div>
                  </div>
                  <button
                    className="btn small-btn"
                    onClick={() => {
                      setMode('sandbox');
                      s.applyTransforms(l.transforms || {});
                      setHidden(new Set(l.hidden || []));
                      setDirty(false);
                    }}
                  >
                    Open
                  </button>
                  {(l.byUid === actor.uid || isManager) && (
                    <button
                      className="link-btn danger"
                      onClick={async () =>
                        (await confirmDialog({ title: `Delete the layout “${l.name}”?`, okLabel: 'Delete', danger: true })) &&
                        api.deleteRobotLayout(l.id)
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
              {!versionLayouts.length && <p className="muted small">No saved layouts for this version.</p>}
            </div>
          )}

          {side === 'changes' && (
            <div className="changes">
              <label className="field-label" htmlFor="cmp-with">
                Compare with
              </label>
              <select id="cmp-with" className="input" value={other?.id || ''} onChange={(e) => setCompareId(e.target.value)}>
                {versions
                  .filter((v) => v.id !== version?.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
              {!changes ? (
                <p className="muted small">{loadB.state === 'error' ? "Couldn't load that version." : 'Loading…'}</p>
              ) : (
                [
                  ['added', 'Added', changes.added, model, setSelected],
                  ['removed', 'Removed', changes.removed, modelB, setSelectedB],
                  ['moved', 'Moved', changes.moved, model, setSelected],
                ].map(([id, label, keys, m, pick]) => (
                  <div key={id} className="change-group">
                    <h4>
                      <span className="dot" style={{ background: TINT[id] }} /> {label} <span className="muted">({keys.length})</span>
                    </h4>
                    <ul>
                      {keys.map((k) => (
                        <li key={k}>
                          <button className="link-btn" onClick={() => pick(k)}>
                            {nameOf(k, m)}
                          </button>
                        </li>
                      ))}
                      {!keys.length && <li className="muted small">None</li>}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>

        <section className="viewports">
          {mode === 'compare' && (
            <div className="viewport">
              <div className="canvas-host" ref={boxB} />
              <span className="viewport-label">{other?.name}</span>
              {loadB.state === 'loading' && <div className="viewport-msg">Loading…</div>}
            </div>
          )}
          <div className={`viewport${mode === 'pin' ? ' pin-mode' : ''}`}>
            {/* three.js owns this element; React never renders into it */}
            <div className="canvas-host" ref={boxA} />
            {mode === 'compare' && <span className="viewport-label">{version?.name}</span>}
            {load.state === 'loading' && <div className="viewport-msg">Loading the robot…</div>}
            {load.state === 'error' &&
              (load.error?.code === 'download-blocked' ? (
                <CorsHelp />
              ) : (
                <div className="viewport-msg">Couldn't load this model: {load.error?.message}</div>
              ))}
            {mode !== 'compare' &&
              versionPins.map((p, i) => (
                <button
                  key={p.id}
                  ref={(el) => (pinEls.current[p.id] = el)}
                  className={`pin-marker${openPin === p.id ? ' open' : ''}${p.resolved ? ' resolved' : ''}`}
                  style={{ display: 'none' }}
                  onClick={() => {
                    setSide('pins');
                    setOpenPin(p.id);
                    setSelected(p.key);
                  }}
                  title={p.text}
                >
                  {i + 1}
                </button>
              ))}
            {model && (
              <div className="viewport-tools">
                {['iso', 'front', 'side', 'top'].map((v) => (
                  <button key={v} className="btn small-btn" onClick={() => s.view(v)}>
                    {v === 'iso' ? 'Reset view' : v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
            {model && mode === 'view' && (
              <label className="explode">
                Exploded
                <input type="range" min="0" max="1" step="0.01" value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
              </label>
            )}
            {mode === 'pin' && <div className="mode-hint">Tap the robot to drop a pin</div>}
            {mode === 'sandbox' && <div className="mode-hint">Sandbox: changes here don't touch the real CAD</div>}
          </div>
        </section>
      </div>

      {version && model && (
        <p className="muted tiny robot-meta">
          {version.name} · uploaded by {version.by?.split(' ')[0] || '?'} {relTime(version.at)}
          {version.notes ? ` · ${version.notes}` : ''} · {model.nodes.size} parts
        </p>
      )}

      {uploading && (
        <UploadDialog
          onClose={() => setUploading(false)}
          onUpload={async (file, meta, onProgress) => {
            const ok = await api.uploadRobotVersion(file, meta, onProgress);
            if (ok !== false) setVersionId('');
            return ok;
          }}
        />
      )}
      {pinDraft && (
        <PinDialog
          draft={pinDraft}
          partName={nameOf(pinDraft.key)}
          tasks={tasks}
          parts={parts}
          onClose={() => setPinDraft(null)}
          onSave={(data) => {
            setPinDraft(null);
            api.createRobotPin({ ...data, versionId: version.id });
          }}
        />
      )}
    </main>
  );
}
