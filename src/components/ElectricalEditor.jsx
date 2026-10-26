import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ADDABLE,
  DEV_H,
  DEV_W,
  KINDS,
  PART_TYPES,
  bounds,
  connectionsOf,
  defaultDiagram,
  partSize,
  portName,
  portPos,
  wireKind,
  wirePath,
} from '../electrical.js';
import { itemId } from '../data/diff.js';
import { fullTime } from '../util.js';
import { CloseIcon } from './common.jsx';

const SNAP = 10;
const snap = (v) => Math.round(v / SNAP) * SNAP;
const WIRE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#ffffff'];
const touches = (w, [pid, port]) => (w.from[0] === pid && w.from[1] === port) || (w.to[0] === pid && w.to[1] === port);

// Two lines at most, split near the middle.
function labelLines(text, max = 11) {
  const t = String(text || '').trim();
  if (t.length <= max) return [t];
  const cut = t.lastIndexOf(' ', Math.ceil(t.length / 2) + 3);
  const a = cut > 0 ? t.slice(0, cut) : t.slice(0, max);
  const b = (cut > 0 ? t.slice(cut + 1) : t.slice(max)).slice(0, max + 3);
  return [a, b.length > max + 2 ? `${b.slice(0, max)}…` : b];
}

// A hub is its photo; each port is a small colored dot on the real connector.
function Hub({ part, selected, dim }) {
  const t = PART_TYPES[part.type];
  return (
    <g data-part={part.id} transform={`translate(${part.x},${part.y})`} opacity={dim ? 0.45 : 1} className="dg-part">
      <image href={t.photo} width={t.w} height={t.h} preserveAspectRatio="none" />
      {selected && <rect x="-4" y="-4" width={t.w + 8} height={t.h + 8} rx="18" fill="none" stroke="#6366f1" strokeWidth="4" />}
      {part.label && part.label !== t.name && (
        <g pointerEvents="none">
          <rect x={t.w / 2 - 80} y="8" width="160" height="22" rx="11" fill="#111827" opacity="0.85" />
          <text x={t.w / 2} y="23.5" textAnchor="middle" fill="#fff" fontSize="12.5" fontWeight="700">
            {part.label}
          </text>
        </g>
      )}
      {t.ports.map((p) => {
        const k = KINDS[p.kind];
        return (
          <g key={p.id} data-port={`${part.id}:${p.id}`} className="dg-port">
            {p.kind === 'usb' && (
              <text x={p.x} y={p.y + 16} textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="700" pointerEvents="none">
                USB
              </text>
            )}
            <circle cx={p.x} cy={p.y} r="4.2" fill={k.inner} stroke={k.outer} strokeWidth="1.8" />
            <circle cx={p.x} cy={p.y} r="7.5" fill="transparent" />
            <title>{`${t.name} · ${portName(part, p)}`}</title>
          </g>
        );
      })}
    </g>
  );
}

function Device({ part, selected, dim }) {
  const t = PART_TYPES[part.type];
  const lines = labelLines(part.label || t.name);
  return (
    <g data-part={part.id} transform={`translate(${part.x},${part.y})`} opacity={dim ? 0.45 : 1} className="dg-part">
      <rect
        width={DEV_W}
        height={DEV_H}
        rx="10"
        fill="#ffffff"
        stroke={selected ? '#6366f1' : '#94a3b8'}
        strokeWidth={selected ? 3 : 1.5}
      />
      {t.photo ? (
        <image href={t.photo} x="5" y="4" width="34" height={DEV_H - 8} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <text x="10" y={DEV_H / 2 + 8} fontSize="22">
          {t.icon}
        </text>
      )}
      {lines.map((l, i) => (
        <text key={i} x="40" y={DEV_H / 2 + 5 + (i - (lines.length - 1) / 2) * 15} fontSize="12.5" fontWeight="650" fill="#111827">
          {l}
        </text>
      ))}
      {t.ports.map((p) => {
        const pos = portPos({ ...part, x: 0, y: 0 }, p.id);
        const k = KINDS[p.kind];
        return (
          <g key={p.id} data-port={`${part.id}:${p.id}`} className="dg-port">
            <circle cx={pos.x} cy={pos.y} r="6" fill={k.inner} stroke={k.outer} strokeWidth="2.5" />
            <circle cx={pos.x} cy={pos.y} r="13" fill="transparent" />
            <title>{p.label || KINDS[p.kind].label}</title>
          </g>
        );
      })}
    </g>
  );
}

function TextPart({ part, selected }) {
  const size = part.size || 18;
  const lines = String(part.text || 'Text').split('\n');
  const { w, h } = partSize(part);
  return (
    <g data-part={part.id} transform={`translate(${part.x},${part.y})`} className="dg-part">
      <rect
        x="-6"
        y="-4"
        width={w + 12}
        height={h + 8}
        rx="6"
        fill="transparent"
        stroke={selected ? '#6366f1' : 'none'}
        strokeDasharray="5 4"
      />
      {lines.map((l, i) => (
        <text key={i} x="0" y={size * (i + 1)} fontSize={size} fontWeight="600" fill={part.color || '#b91c1c'}>
          {l || ' '}
        </text>
      ))}
    </g>
  );
}

function Wire({ parts, wire, selected, dim }) {
  const a = portPos(parts.find((p) => p.id === wire.from[0]) || {}, wire.from[1]);
  const b = portPos(parts.find((p) => p.id === wire.to[0]) || {}, wire.to[1]);
  if (!a || !b) return null;
  const d = wirePath(a, b);
  const { kind, mismatch } = wireKind(parts, wire);
  const k = KINDS[kind] || KINDS.usb;
  const outer = wire.color ? (wire.color === '#111827' ? '#475569' : '#111827') : k.outer;
  const inner = wire.color || k.inner;
  return (
    <g data-wire={wire.id} opacity={dim ? 0.25 : 1} className="dg-wire">
      {selected && <path d={d} stroke="#6366f1" strokeOpacity="0.35" strokeWidth="14" fill="none" strokeLinecap="round" />}
      <path d={d} stroke={outer} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d={d} stroke={inner} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray={mismatch ? '7 5' : undefined} />
      <path d={d} stroke="transparent" strokeWidth="18" fill="none" />
    </g>
  );
}

// The drawing itself. Plain colors (no CSS variables) so it exports as a PNG.
function DiagramSvg({ diagram, view, sel, pending, ptr, focusPart, svgRef, handlers = {}, className = '' }) {
  const { parts, wires } = diagram;
  const focusWires = focusPart ? new Set(wires.filter((w) => w.from[0] === focusPart || w.to[0] === focusPart).map((w) => w.id)) : null;
  const focusParts = focusWires
    ? new Set([focusPart, ...wires.filter((w) => focusWires.has(w.id)).flatMap((w) => [w.from[0], w.to[0]])])
    : null;
  const pendFrom = pending && portPos(parts.find((p) => p.id === pending.from[0]) || {}, pending.from[1]);
  const dots = `dg-dots${useId().replace(/:/g, '')}`;
  return (
    <svg
      ref={svgRef}
      className={`dg-svg ${className}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif"
      {...handlers}
    >
      <defs>
        <pattern id={dots} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1.1" fill="#cbd5e1" />
        </pattern>
      </defs>
      <rect data-bg="1" x={view.x - view.w} y={view.y - view.h} width={view.w * 3} height={view.h * 3} fill="#fbfbfd" />
      <rect data-bg="1" x={view.x - view.w} y={view.y - view.h} width={view.w * 3} height={view.h * 3} fill={`url(#${dots})`} />
      <g data-content="1">
        {wires.map((w) => (
          <Wire
            key={w.id}
            parts={parts}
            wire={w}
            selected={sel?.kind === 'wire' && sel.id === w.id}
            dim={focusWires && !focusWires.has(w.id)}
          />
        ))}
        {parts.map((p) => {
          const selected = sel?.kind === 'part' && sel.id === p.id;
          const dim = focusParts && !focusParts.has(p.id);
          if (PART_TYPES[p.type]?.hub) return <Hub key={p.id} part={p} selected={selected} dim={dim} />;
          if (p.type === 'text') return <TextPart key={p.id} part={p} selected={selected} />;
          if (!PART_TYPES[p.type]) return null;
          return <Device key={p.id} part={p} selected={selected} dim={dim} />;
        })}
      </g>
      {pendFrom && ptr && (
        <path
          d={`M${pendFrom.x},${pendFrom.y} L${ptr.x},${ptr.y}`}
          stroke="#6366f1"
          strokeWidth="3"
          strokeDasharray="6 5"
          fill="none"
          pointerEvents="none"
        />
      )}
      {pendFrom && <circle cx={pendFrom.x} cy={pendFrom.y} r="11" fill="none" stroke="#6366f1" strokeWidth="3" pointerEvents="none" />}
    </svg>
  );
}

const asDiagram = (d) => (d?.parts ? { parts: d.parts, wires: d.wires || [] } : defaultDiagram());

// A small, read-only picture of the diagram (Resources tab card).
export function DiagramPreview({ diagram }) {
  const d = asDiagram(diagram);
  const b = bounds(d.parts, 30);
  return <DiagramSvg diagram={d} view={b} className="dg-preview" />;
}

// Everything drawn (parts and the cables between them, which can curve
// outside the parts), from the live drawing when there is one.
function drawnBounds(el, parts, pad) {
  try {
    const g = el?.querySelector('[data-content]')?.getBBox();
    if (g && g.width && g.height) return { x: g.x - pad, y: g.y - pad, w: g.width + pad * 2, h: g.height + pad * 2 };
  } catch {
    /* not rendered yet */
  }
  return bounds(parts, pad);
}

function fitView(parts, el) {
  const b = drawnBounds(el, parts, 40);
  const r = el?.getBoundingClientRect();
  const aspect = r && r.height ? r.width / r.height : 1.4;
  // Grow one side so the whole diagram fits the box's shape.
  if (b.w / b.h > aspect) {
    const h = b.w / aspect;
    return { x: b.x, y: b.y - (h - b.h) / 2, w: b.w, h };
  }
  const w = b.h * aspect;
  return { x: b.x - (w - b.w) / 2, y: b.y, w, h: b.h };
}

// The full-screen editor. Electrical and team management edit; everyone
// else can look, zoom, and tap parts to see what's plugged in where.
export default function ElectricalEditor({ remote, canEdit, actor, onSave, onClose }) {
  const [diagram, setDiagram] = useState(() => asDiagram(remote));
  const docRef = useRef(diagram);
  docRef.current = diagram;
  const base = useRef(remote);
  const dirty = useRef(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const lastKey = useRef({ key: null, at: 0 });
  const [sel, setSel] = useState(null); // { kind: 'part' | 'wire', id }
  const [pending, setPending] = useState(null); // { from: [partId, portId] }
  const [ptr, setPtr] = useState(null);
  const [view, setView] = useState(() => fitView(diagram.parts));
  const viewRef = useRef(view);
  viewRef.current = view;
  const [saving, setSaving] = useState('');
  const [panel, setPanel] = useState(null); // 'history' | 'ports'
  const [adding, setAdding] = useState(false);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const saveTimer = useRef(null);

  // Someone else's save: take it unless we have unsaved edits or are dragging.
  useEffect(() => {
    if (!remote || dirty.current || drag.current) return;
    if (remote.updatedAt === base.current?.updatedAt && base.current?.parts) return;
    base.current = remote;
    setDiagram(asDiagram(remote));
  }, [remote]);

  // Fit to the screen once the canvas has a size.
  useEffect(() => {
    setView(fitView(docRef.current.parts, svgRef.current));
  }, []);

  const flush = async () => {
    clearTimeout(saveTimer.current);
    if (!dirty.current) return;
    const d = docRef.current;
    const b = base.current;
    // Keep the version before each editing session (someone else's, or 10+ minutes old).
    const newSession = b?.parts && (b.updatedBy !== actor.name || Date.now() - (b.updatedAt || 0) > 600000);
    const history = newSession
      ? [{ parts: b.parts, wires: b.wires || [], by: b.updatedBy || '', at: b.updatedAt || 0 }, ...(b.history || [])].slice(0, 15)
      : b?.history || [];
    dirty.current = false;
    setSaving('Saving…');
    try {
      await onSave({ parts: d.parts, wires: d.wires, history });
      base.current = { ...d, history, updatedBy: actor.name, updatedAt: Date.now() };
      setSaving('Saved');
    } catch (e) {
      dirty.current = true;
      setSaving(`Couldn’t save: ${e?.message || e}`);
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  // Every edit: remember the old version for undo, then save shortly after.
  const change = (next, key) => {
    const prev = docRef.current;
    const merge = key && lastKey.current.key === key && Date.now() - lastKey.current.at < 1500;
    if (!merge) {
      setPast((p) => [...p.slice(-60), prev]);
      setFuture([]);
    }
    lastKey.current = { key, at: Date.now() };
    docRef.current = next;
    setDiagram(next);
    dirty.current = true;
    setSaving('');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), 800);
  };
  const undo = () => {
    if (!past.length) return;
    const cur = docRef.current;
    setFuture((f) => [cur, ...f]);
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    lastKey.current = { key: null, at: 0 };
    docRef.current = prev;
    setDiagram(prev);
    dirty.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), 800);
  };
  const redo = () => {
    if (!future.length) return;
    const cur = docRef.current;
    setPast((p) => [...p, cur]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    docRef.current = next;
    setDiagram(next);
    dirty.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), 800);
  };

  // Picking a part or wire shows its settings (closes Port list / Versions).
  useEffect(() => {
    if (sel) setPanel(null);
  }, [sel]);

  const { parts, wires } = diagram;
  const selPart = sel?.kind === 'part' ? parts.find((p) => p.id === sel.id) : null;
  const selWire = sel?.kind === 'wire' ? wires.find((w) => w.id === sel.id) : null;

  const patchPart = (id, patch, key) =>
    change({ ...docRef.current, parts: docRef.current.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }, key);
  const removeSelected = () => {
    const d = docRef.current;
    if (selPart)
      change({
        parts: d.parts.filter((p) => p.id !== selPart.id),
        wires: d.wires.filter((w) => w.from[0] !== selPart.id && w.to[0] !== selPart.id),
      });
    if (selWire) change({ ...d, wires: d.wires.filter((w) => w.id !== selWire.id) });
    setSel(null);
  };
  const connect = (from, to) => {
    if (from[0] === to[0]) return;
    const d = docRef.current;
    // One cable per port: plugging in replaces what was there.
    const id = itemId();
    change({ ...d, wires: [...d.wires.filter((w) => !touches(w, from) && !touches(w, to)), { id, from, to }] });
    setPending(null);
    setSel({ kind: 'wire', id });
  };
  const add = (type) => {
    const v = viewRef.current;
    const size = partSize({ type, text: 'Text' });
    const n = docRef.current.parts.length;
    const p = {
      id: itemId(),
      type,
      x: snap(v.x + v.w / 2 - size.w / 2 + (n % 5) * 20),
      y: snap(v.y + v.h / 2 - size.h / 2 + (n % 5) * 20),
      label: type === 'text' ? '' : PART_TYPES[type].name,
      ...(type === 'text' ? { text: 'Text', size: 18 } : {}),
      ...(PART_TYPES[type].hub || type === 'switch' || type === 'text' ? {} : { side: 'right' }),
    };
    change({ ...docRef.current, parts: [...docRef.current.parts, p] });
    setSel({ kind: 'part', id: p.id });
    setAdding(false);
  };
  const duplicate = () => {
    if (!selPart) return;
    const p = { ...selPart, id: itemId(), x: selPart.x + 30, y: selPart.y + 30 };
    change({ ...docRef.current, parts: [...docRef.current.parts, p] });
    setSel({ kind: 'part', id: p.id });
  };

  // Pointer: drag parts, tap a port then another port to wire, drag the
  // background to pan, pinch or scroll to zoom.
  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const zoomAt = (factor, cx, cy) => {
    setView((v) => {
      const w = Math.min(6000, Math.max(200, v.w * factor));
      const f = w / v.w;
      return { x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f, w, h: v.h * f };
    });
  };
  useEffect(() => {
    const svg = svgRef.current;
    const wheel = (e) => {
      e.preventDefault();
      const p = toSvg(e);
      zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, []);

  const onPointerDown = (e) => {
    const svg = svgRef.current;
    svg.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), view0: viewRef.current };
      return;
    }
    const port = e.target.closest?.('[data-port]')?.dataset.port?.split(':');
    const partId = e.target.closest?.('[data-part]')?.dataset.part;
    const wireId = e.target.closest?.('[data-wire]')?.dataset.wire;
    if (port && canEdit) {
      if (pending && pending.from[0] !== port[0]) connect(pending.from, port);
      else {
        setPending({ from: port });
        setPtr(toSvg(e));
        drag.current = { mode: 'wire', from: port };
      }
      return;
    }
    if (partId) {
      setSel({ kind: 'part', id: partId });
      if (pending) setPending(null);
      const p = docRef.current.parts.find((x) => x.id === partId);
      if (canEdit && p)
        drag.current = { mode: 'part', id: partId, start: toSvg(e), orig: { x: p.x, y: p.y }, before: docRef.current, moved: false };
      return;
    }
    if (wireId) {
      setSel({ kind: 'wire', id: wireId });
      setPending(null);
      return;
    }
    setSel(null);
    setPending(null);
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, view0: viewRef.current };
  };
  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = drag.current;
    if (pending) setPtr(toSvg(e));
    if (!g) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (g.mode === 'pinch' && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = Math.min(6000, Math.max(200, g.view0.w * (g.d0 / d))) / g.view0.w;
      const cx = g.view0.x + (((a.x + b.x) / 2 - rect.left) / rect.width) * g.view0.w;
      const cy = g.view0.y + (((a.y + b.y) / 2 - rect.top) / rect.height) * g.view0.h;
      setView({ x: cx - (cx - g.view0.x) * f, y: cy - (cy - g.view0.y) * f, w: g.view0.w * f, h: g.view0.h * f });
    } else if (g.mode === 'part') {
      const p = toSvg(e);
      const x = snap(g.orig.x + p.x - g.start.x);
      const y = snap(g.orig.y + p.y - g.start.y);
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 4) return;
      g.moved = true;
      const next = { ...docRef.current, parts: docRef.current.parts.map((q) => (q.id === g.id ? { ...q, x, y } : q)) };
      docRef.current = next;
      setDiagram(next);
    } else if (g.mode === 'pan') {
      const v = g.view0;
      setView({ ...v, x: v.x - ((e.clientX - g.sx) / rect.width) * v.w, y: v.y - ((e.clientY - g.sy) / rect.height) * v.h });
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const g = drag.current;
    drag.current = pointers.current.size ? drag.current : null;
    if (!g) return;
    if (g.mode === 'wire') {
      // Dragged from one port onto another: connect. A tap leaves it waiting for the second port.
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const to = el?.closest?.('[data-port]')?.dataset.port?.split(':');
      if (to && to[0] !== g.from[0]) connect(g.from, to);
    } else if (g.mode === 'part' && g.moved) {
      const moved = docRef.current;
      docRef.current = g.before;
      change(moved);
    }
    if (g.mode === 'pinch') drag.current = null;
  };

  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (pending) setPending(null);
        else if (adding || panel) (setAdding(false), setPanel(null));
        else if (sel) setSel(null);
        else onClose();
      } else if (canEdit && mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (canEdit && (e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const hubs = parts.filter((p) => PART_TYPES[p.type]?.hub);
  const portList = useMemo(
    () =>
      hubs.map((h) => ({
        hub: h,
        rows: PART_TYPES[h.type].ports
          .map((port) => {
            const w = wires.find((x) => touches(x, [h.id, port.id]));
            if (!w) return null;
            const other = w.from[0] === h.id ? w.to : w.from;
            const op = parts.find((p) => p.id === other[0]);
            return op && { port: portName(h, port), to: op.label || PART_TYPES[op.type]?.name, kind: port.kind };
          })
          .filter(Boolean),
      })),
    [parts, wires], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const exportPng = async () => {
    const b = drawnBounds(svgRef.current, parts, 30);
    const svg = svgRef.current.cloneNode(true);
    svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
    svg.setAttribute('width', String(b.w * 2));
    svg.setAttribute('height', String(b.h * 2));
    // A drawing saved as a picture can't load other files: put the photos inside it.
    const inline = new Map();
    for (const el of svg.querySelectorAll('image')) {
      const href = el.getAttribute('href');
      if (!href || href.startsWith('data:')) continue;
      if (!inline.has(href)) {
        const blob = await (await fetch(href)).blob();
        inline.set(
          href,
          await new Promise((res) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(blob);
          }),
        );
      }
      el.setAttribute('href', inline.get(href));
    }
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = b.w * 2;
    c.height = b.h * 2;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'electrical-diagram.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  };

  const conns = selPart ? connectionsOf(parts, wires, selPart.id) : [];
  const wireInfo = selWire && wireKind(parts, selWire);
  const endText = (end) => {
    const p = parts.find((x) => x.id === end[0]);
    const def = PART_TYPES[p?.type]?.ports.find((x) => x.id === end[1]);
    return p ? `${p.label || PART_TYPES[p.type].name} · ${portName(p, def)}` : '?';
  };

  return (
    <div className="dg-screen" role="dialog" aria-label="Electrical diagram">
      <div className="dg-bar">
        <h2>⚡ Electrical diagram</h2>
        {canEdit ? (
          <div className="dg-tools">
            <button className="btn primary" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
              ＋ Add
            </button>
            <button className="btn" onClick={undo} disabled={!past.length} title="Undo (⌘Z)">
              ↶ Undo
            </button>
            <button className="btn" onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)">
              ↷ Redo
            </button>
            {sel && (
              <button className="btn danger-btn" onClick={removeSelected}>
                🗑 Delete
              </button>
            )}
            <button
              className={`btn${panel === 'history' ? ' on-btn' : ''}`}
              onClick={() => setPanel(panel === 'history' ? null : 'history')}
            >
              🕘 Versions
            </button>
          </div>
        ) : (
          <span className="muted small">View only · Electrical and team management can edit</span>
        )}
        <span className="spacer" />
        <span className="muted small dg-saving">{saving}</span>
        <button className={`btn${panel === 'ports' ? ' on-btn' : ''}`} onClick={() => setPanel(panel === 'ports' ? null : 'ports')}>
          🔌 Port list
        </button>
        <button className="btn" onClick={exportPng}>
          ⬇ PNG
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      {adding && (
        <div className="dg-add">
          {ADDABLE.map((type) => (
            <button key={type} className="dg-add-btn" onClick={() => add(type)} title={PART_TYPES[type].hint || ''}>
              <span aria-hidden="true">{PART_TYPES[type].icon || (PART_TYPES[type].hub ? '🟧' : '🅣')}</span>
              {PART_TYPES[type].name}
            </button>
          ))}
        </div>
      )}
      <div className="dg-body">
        <div className="dg-canvas">
          <DiagramSvg
            diagram={diagram}
            view={view}
            sel={sel}
            pending={pending}
            ptr={ptr}
            focusPart={selPart && !PART_TYPES[selPart.type]?.hub && selPart.type !== 'text' ? selPart.id : null}
            svgRef={svgRef}
            handlers={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }}
          />
          <div className="dg-zoom">
            <button className="icon-btn" onClick={() => zoomAt(0.8, view.x + view.w / 2, view.y + view.h / 2)} aria-label="Zoom in">
              ＋
            </button>
            <button className="icon-btn" onClick={() => zoomAt(1.25, view.x + view.w / 2, view.y + view.h / 2)} aria-label="Zoom out">
              −
            </button>
            <button className="icon-btn" onClick={() => setView(fitView(parts, svgRef.current))} aria-label="Fit" title="Fit">
              ⤢
            </button>
          </div>
          {pending && <div className="dg-hint">Now tap the port to plug it into · Esc to cancel</div>}
        </div>
        <aside className="dg-side">
          {panel === 'ports' ? (
            <>
              <h3>Port list</h3>
              <p className="muted small">What’s plugged in where. Handy for setting up the robot configuration.</p>
              {portList.map(({ hub, rows }) => (
                <div key={hub.id} className="dg-portlist">
                  <h4>{hub.label || PART_TYPES[hub.type].name}</h4>
                  {rows.length ? (
                    <table>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td>
                              <span className="dg-swatch" style={{ background: KINDS[r.kind].inner, borderColor: KINDS[r.kind].outer }} />
                              {r.port}
                            </td>
                            <td>{r.to}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted small">Nothing plugged in.</p>
                  )}
                </div>
              ))}
            </>
          ) : panel === 'history' ? (
            <>
              <h3>Versions</h3>
              <p className="muted small">The diagram before each editing session. Restoring is undoable.</p>
              {(base.current?.history || []).length ? (
                <ul className="dg-history">
                  {base.current.history.map((h, i) => (
                    <li key={i}>
                      <span>
                        {h.by || 'Someone'} · {h.at ? fullTime(h.at) : 'earlier'}
                        <br />
                        <span className="muted small">
                          {h.parts.length} parts, {h.wires.length} wires
                        </span>
                      </span>
                      <button className="btn" onClick={() => change({ parts: h.parts, wires: h.wires })}>
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">No earlier versions yet.</p>
              )}
              {canEdit && (
                <button className="btn" onClick={() => change(defaultDiagram())}>
                  ↺ Start over from our drawing
                </button>
              )}
            </>
          ) : selPart ? (
            <>
              <h3>{PART_TYPES[selPart.type]?.name}</h3>
              {canEdit && selPart.type === 'text' ? (
                <>
                  <textarea
                    className="input"
                    rows={3}
                    value={selPart.text || ''}
                    onChange={(e) => patchPart(selPart.id, { text: e.target.value }, `text-${selPart.id}`)}
                    aria-label="Text"
                  />
                  <label className="studio-range">
                    <span>Size</span>
                    <input
                      type="range"
                      min="10"
                      max="48"
                      value={selPart.size || 18}
                      onChange={(e) => patchPart(selPart.id, { size: Number(e.target.value) }, `size-${selPart.id}`)}
                    />
                  </label>
                  <div className="row gap wrap">
                    {['#b91c1c', '#111827', '#1d4ed8', '#15803d', '#7c3aed'].map((c) => (
                      <button
                        key={c}
                        className={`swatch${(selPart.color || '#b91c1c') === c ? ' on' : ''}`}
                        style={{ background: c }}
                        aria-label={c}
                        onClick={() => patchPart(selPart.id, { color: c })}
                      />
                    ))}
                  </div>
                </>
              ) : canEdit ? (
                <input
                  className="input"
                  value={selPart.label || ''}
                  maxLength={40}
                  onChange={(e) => patchPart(selPart.id, { label: e.target.value }, `label-${selPart.id}`)}
                  placeholder="Name"
                  aria-label="Name"
                />
              ) : (
                <p className="dg-name">{selPart.label || selPart.text}</p>
              )}
              {canEdit && !PART_TYPES[selPart.type]?.hub && !['text', 'switch'].includes(selPart.type) && (
                <div className="dg-field">
                  <span className="field-label">Wires come out of</span>
                  <div className="segmented">
                    {['left', 'right', 'top', 'bottom'].map((s) => (
                      <button
                        key={s}
                        className={`plain-seg${(selPart.side || 'right') === s ? ' on' : ''}`}
                        onClick={() => patchPart(selPart.id, { side: s })}
                      >
                        {s[0].toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selPart.type !== 'text' && (
                <div className="dg-field">
                  <span className="field-label">Plugged into</span>
                  {conns.length ? (
                    <ul className="dg-conns">
                      {conns.map((c) => (
                        <li key={c.wire}>
                          <button className="link-btn" onClick={() => setSel({ kind: 'wire', id: c.wire })}>
                            {c.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">{canEdit ? 'Nothing yet. Tap one of its ports, then a port on a hub.' : 'Nothing.'}</p>
                  )}
                </div>
              )}
              {canEdit && (
                <div className="row gap">
                  <button className="btn" onClick={duplicate}>
                    ⧉ Duplicate
                  </button>
                  <button className="btn danger-btn" onClick={removeSelected}>
                    🗑 Delete
                  </button>
                </div>
              )}
            </>
          ) : selWire ? (
            <>
              <h3>Wire</h3>
              <p className="small">
                {endText(selWire.from)}
                <br />↔ {endText(selWire.to)}
              </p>
              <p className="muted small">{KINDS[wireInfo.kind]?.label}</p>
              {wireInfo.mismatch && <p className="form-error">⚠ The two ends are different kinds of ports. Check this one.</p>}
              {canEdit && (
                <>
                  <span className="field-label">Color</span>
                  <div className="row gap wrap">
                    <button
                      className={`btn${!selWire.color ? ' on-btn' : ''}`}
                      onClick={() => change({ ...diagram, wires: wires.map((w) => (w.id === selWire.id ? { ...w, color: null } : w)) })}
                    >
                      Auto
                    </button>
                    {WIRE_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`swatch${selWire.color === c ? ' on' : ''}`}
                        style={{ background: c }}
                        aria-label={c}
                        onClick={() => change({ ...diagram, wires: wires.map((w) => (w.id === selWire.id ? { ...w, color: c } : w)) })}
                      />
                    ))}
                  </div>
                  <button className="btn danger-btn" onClick={removeSelected}>
                    🗑 Unplug
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <h3>{canEdit ? 'How to edit' : 'How to read it'}</h3>
              <ul className="dg-tips small">
                {canEdit ? (
                  <>
                    <li>＋ Add puts a part in the middle. Drag parts to move them.</li>
                    <li>To wire: tap a port, then the port to plug it into (or drag from one to the other).</li>
                    <li>Tap a part to rename it or pick which side its wires come out of.</li>
                    <li>Drag the background to move around; pinch or scroll to zoom.</li>
                    <li>Changes save on their own. 🕘 Versions brings back older ones.</li>
                  </>
                ) : (
                  <>
                    <li>Tap a part to see what it’s plugged into.</li>
                    <li>🔌 Port list shows every port in one table.</li>
                    <li>Drag to move around; pinch or scroll to zoom.</li>
                  </>
                )}
              </ul>
              <h4 className="field-label">Wire colors</h4>
              <ul className="dg-legend small">
                {Object.entries(KINDS).map(([k, v]) => (
                  <li key={k}>
                    <span className="dg-swatch" style={{ background: v.inner, borderColor: v.outer }} />
                    {v.label}
                  </li>
                ))}
              </ul>
              {remote?.updatedBy && (
                <p className="muted tiny">
                  Last changed by {remote.updatedBy}
                  {remote.updatedAt ? ` · ${fullTime(remote.updatedAt)}` : ''}
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
