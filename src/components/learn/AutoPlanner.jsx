// G7: draw a 30-second AUTO on the BIOBUZZ field. The path is simulated here
// as you draw (functions/shared/autoPath.js) and scored on the server from
// the same path when you run it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { AUTO, simulate } from '../../../functions/shared/autoPath.js';
import { animOn, celebrate } from '../../motion.js';

const F = AUTO.field;
const rect = (r) => ({ x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 });

function Field({ children, svgRef, onDown, onMove, onUp }) {
  const tiles = [];
  for (let i = 1; i < 6; i++) tiles.push(<path key={`v${i}`} d={`M${i * 24} 0V${F}`} />, <path key={`h${i}`} d={`M0 ${i * 24}H${F}`} />);
  return (
    <svg
      ref={svgRef}
      className="lq-field"
      viewBox={`-6 -6 ${F + 12} ${F + 12}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label="BIOBUZZ field, red side on the left"
    >
      <rect x={-6} y={-6} width={F + 12} height={F + 12} rx={4} className="lq-f-wall" />
      <rect x={0} y={0} width={F} height={F} className="lq-f-tiles" />
      <g className="lq-f-seams">{tiles}</g>
      {/* ALLIANCE walls */}
      <rect x={-6} y={24} width={4} height={96} className="lq-f-red" />
      <rect x={F + 2} y={24} width={4} height={96} className="lq-f-blue" />
      {/* the other side during AUTO (G402) */}
      <rect x={72} y={0} width={72} height={F} className="lq-f-theirs" />
      <path d={`M72 0V${F}`} className="lq-f-mid" />
      {/* LOADING ZONES and GARDENS */}
      <rect {...rect(AUTO.loadingZone)} className="lq-f-lz red" />
      <rect x={F - 11} y={96} width={11} height={23} className="lq-f-lz blue" />
      <rect x={0} y={F - 2} width={23} height={2} className="lq-f-garden red" />
      <rect x={F - 23} y={0} width={23} height={2} className="lq-f-garden blue" />
      {/* where this game launches from */}
      <rect {...rect(AUTO.launch)} rx={3} className="lq-f-launch" />
      <text x={(AUTO.launch.x0 + AUTO.launch.x1) / 2} y={AUTO.launch.y0 + 7} textAnchor="middle" className="lq-f-label">
        LAUNCH
      </text>
      {/* the HIVE structure: frame, red and blue HIVES (two CELLS each) */}
      <rect {...rect(AUTO.frame)} rx={2} className="lq-f-frame" />
      <rect x={50} y={52} width={20} height={14} rx={2} className="lq-f-cell red" />
      <rect x={50} y={78} width={20} height={14} rx={2} className="lq-f-cell red up" />
      <rect x={74} y={52} width={20} height={14} rx={2} className="lq-f-cell blue up" />
      <rect x={74} y={78} width={20} height={14} rx={2} className="lq-f-cell blue" />
      <text x={72} y={74} textAnchor="middle" className="lq-f-label dark">
        HIVES
      </text>
      {/* FLOWERS (two are the other side's) */}
      {[...AUTO.stations.filter((s) => s.id.startsWith('flower')), { id: 'fb1', x: 141, y: 48 }, { id: 'fb2', x: 96, y: 141 }].map((s) => (
        <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
          <circle r={4.5} className="lq-f-flower" />
          <circle r={1.6} className="lq-f-flower-in" />
        </g>
      ))}
      {children}
    </svg>
  );
}

const fmt = (t) => `0:${String(Math.max(0, Math.ceil(30 - t))).padStart(2, '0')}`;

export default function AutoPlanner({ api, onResult }) {
  const [start, setStart] = useState(null);
  const [path, setPath] = useState([]); // [[x, y]...] in inches, first is the start
  const [strokes, setStrokes] = useState([]); // path lengths after each drag, for undo
  const [run, setRun] = useState(null); // the server's result
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replayAt, setReplayAt] = useState(null);
  const svgRef = useRef(null);
  const drawing = useRef(false);
  const sim = useMemo(() => (path.length ? simulate(path) : null), [path]);
  const pathLen = useRef(0);
  pathLen.current = path.length;

  const toField = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
  };
  const down = (e) => {
    if (!start || run) return;
    const [x, y] = toField(e);
    const last = path[path.length - 1];
    // Drags continue from the end of the path.
    if (Math.hypot(x - last[0], y - last[1]) > 16) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawing.current) return;
    const [x, y] = toField(e);
    setPath((p) => {
      const last = p[p.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) < 2.5 || p.length >= AUTO.maxPoints) return p;
      return [...p, [Math.min(F, Math.max(0, x)), Math.min(F, Math.max(0, y))]];
    });
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    // Read after the last move has rendered.
    requestAnimationFrame(() => setStrokes((s) => [...s, pathLen.current]));
  };
  const pickStart = (s) => {
    if (run) return;
    setStart(s.id);
    setPath([[s.x, s.y]]);
    setStrokes([]);
    setError('');
  };
  const undo = () => {
    const s = strokes.slice(0, -1);
    setStrokes(s);
    setPath((p) => p.slice(0, s.length ? s[s.length - 1] : 1));
  };
  const clear = () => {
    setPath((p) => p.slice(0, 1));
    setStrokes([]);
  };
  const reset = () => {
    setRun(null);
    setReplayAt(null);
    if (start) setPath([path[0]]);
    setStrokes([]);
  };
  const score = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.autoRun({ path });
      setRun(r);
      onResult?.(r);
      if (r.newBest && r.score > 0) celebrate({ el: svgRef.current, count: 22 });
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };
  // Replay the run: the robot drives the path (when animations are on).
  useEffect(() => {
    if (!run || !animOn('move')) return;
    let raf;
    const t0 = performance.now();
    const total = Math.max(1, run.time);
    const tick = (now) => {
      const t = Math.min(total, ((now - t0) / 1000) * 3);
      setReplayAt(t);
      if (t < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);

  const shown = run || sim;
  const trail = shown?.trail || [];
  const at = (t) => {
    if (!trail.length) return null;
    if (t == null) return trail[trail.length - 1];
    let i = 0;
    while (i < trail.length - 1 && trail[i + 1][2] <= t) i++;
    return trail[i];
  };
  const robot = run ? at(replayAt ?? run.time) : sim ? sim.end : null;
  const drawn = path.map((p) => p.join(',')).join(' ');
  const driven = trail.map((p) => `${p[0]},${p[1]}`).join(' ');
  const used = Math.min(30, shown?.time || 0);
  const stopped = { hive: 'Stopped at the HIVE frame: drive around it.', midline: 'Stopped at the middle: stay on your side in AUTO (G402).', wall: 'Stopped at the wall.', time: 'Out of time: 30 seconds is up.' }[shown?.stoppedBy];

  return (
    <div className="lq-auto">
      <div className="lq-auto-board">
        <Field svgRef={svgRef} onDown={down} onMove={move} onUp={up}>
          {path.length > 1 && <polyline points={drawn} className="lq-f-path drawn" />}
          {trail.length > 1 && <polyline points={driven} className={`lq-f-path${run ? ' ran' : ''}`} />}
          {(shown?.events || []).map((ev, i) => {
            if (ev.type === 'tip') return null;
            const p = at(ev.t);
            return p ? <circle key={i} cx={p[0]} cy={p[1]} r={2.6} className={`lq-f-ev ${ev.type}`} /> : null;
          })}
          {!run &&
            AUTO.starts.map((s) => (
              <g key={s.id} className={`lq-f-start${start === s.id ? ' on' : ''}`} onPointerDown={(e) => (e.stopPropagation(), pickStart(s))}>
                <rect x={s.x - 9} y={s.y - 9} width={18} height={18} rx={2.5} />
                {start !== s.id && (
                  <text x={s.x} y={s.y + 2.4} textAnchor="middle">
                    START
                  </text>
                )}
              </g>
            ))}
          {robot && (
            <g transform={`translate(${robot[0]} ${robot[1]})`} className="lq-f-robot">
              <rect x={-9} y={-9} width={18} height={18} rx={2.5} />
              <path d="M-4 0h8M0 -4v8" />
            </g>
          )}
        </Field>
        <div className="lq-auto-clock">
          <span className="mono">{fmt(used)}</span>
          <span className="lq-bar">
            <i style={{ transform: `scaleX(${used / 30})` }} />
          </span>
        </div>
      </div>

      <div className="lq-auto-side">
        {!start ? (
          <p className="lq-auto-help">
            <b>Pick a starting spot</b> on your wall (red, left). Then drag from the robot to draw where it drives in AUTO.
          </p>
        ) : !run ? (
          <p className="lq-auto-help">
            Drag from the end of the path to keep going. Drive into a <b>FLOWER</b> or the <b>GARDEN</b> to pick up POLLEN, into <b>LAUNCH</b> to
            launch it, and end partly in your <b>LOADING ZONE</b> to PARK.
          </p>
        ) : null}
        {shown && !shown.error && (
          <div className="lq-auto-score">
            <div className="lq-auto-total">
              <span className="lq-kicker">{run ? 'Scored' : 'If you run it'}</span>
              <b className="mono">{shown.score}</b>
              <span className="muted small">points</span>
            </div>
            <ul className="lq-auto-parts">
              <li className={shown.leave ? 'ok' : ''}>
                <span>LEAVE</span>
                <span className="mono">{shown.leave ? 3 : 0}</span>
              </li>
              <li className={shown.park ? 'ok' : ''}>
                <span>PARK</span>
                <span className="mono">{shown.park ? 5 : 0}</span>
              </li>
              <li className={shown.tips ? 'ok' : ''}>
                <span>HIVE TIPS × 20</span>
                <span className="mono">{shown.tips * 20}</span>
              </li>
            </ul>
            {stopped && <p className="lq-auto-warn">{stopped}</p>}
            <ol className="lq-auto-events">
              {shown.events.map((ev, i) => (
                <li key={i} className={ev.type}>
                  <span className="mono">{ev.t.toFixed(1)}s</span> {ev.label}
                </li>
              ))}
            </ol>
          </div>
        )}
        {run && (
          <p className="lq-auto-best">
            Your best: <b className="mono">{run.best}</b>
            {run.newBest && run.score > 0 && <span className="chip lq-chip-good">New best</span>}
            {run.coins > 0 && (
              <span className="chip lq-chip-coin">
                <Icon name="coin" size={13} /> +<span className="mono">{run.coins}</span>
              </span>
            )}
          </p>
        )}
        {error && <p className="lq-error">{error}</p>}
        <div className="lq-auto-tools">
          {run ? (
            <button className="btn primary" onClick={reset}>
              Draw another
            </button>
          ) : (
            <>
              <button className="btn" onClick={undo} disabled={!strokes.length}>
                Undo
              </button>
              <button className="btn" onClick={clear} disabled={path.length < 2}>
                Clear
              </button>
              <button className="btn primary" onClick={score} disabled={path.length < 2 || busy}>
                {busy ? 'Scoring…' : 'Run it'}
              </button>
            </>
          )}
        </div>
        <details className="lq-auto-rules">
          <summary>How it scores</summary>
          <ul>
            <li>
              LEAVE <span className="mono">3</span>: not touching the wall at the end. PARK <span className="mono">5</span>: partly in your LOADING ZONE. HIVE TIP{' '}
              <span className="mono">20</span>. (Table 10-2, p. 89)
            </li>
            <li>You start with 4 POLLEN and can hold 4 (G407). Picking up takes 3 s, launching 2.5 s; the robot averages 36 in/s.</li>
            <li>Stay on your side in AUTO (G402) and drive around the HIVE frame.</li>
            <li>The manual says a HIVE tips when “enough” is LAUNCHED, with no number; this game counts a TIP for every 4 POLLEN.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
