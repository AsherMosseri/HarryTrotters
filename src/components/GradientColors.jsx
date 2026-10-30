import { SWATCHES } from '../nitro.js';
import { PlusIcon } from './common.jsx';

// One color: the swatches, or the rainbow one for any color.
export function ColorChoice({ value, onChange, label }) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {SWATCHES.filter(Boolean).map((c) => (
        <button
          key={c}
          className={`swatch${value === c ? ' on' : ''}`}
          style={{ background: c }}
          aria-label={c}
          onClick={() => onChange(c)}
        />
      ))}
      <label className={`swatch custom${SWATCHES.includes(value) ? '' : ' on'}`} title="Any color" style={{ background: value }}>
        <PlusIcon size={14} />
        <input type="color" value={value || '#8b5cf6'} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: any color`} />
      </label>
    </div>
  );
}

// Two colors for a gradient, plus an optional third.
export default function GradientColors({ colors, onChange, label = 'Color' }) {
  const [a = '#8b5cf6', b = '#06b6d4', c] = colors || [];
  const setAt = (i, v) => onChange([a, b, c].map((x, j) => (j === i ? v : x)).filter((x, j) => j < 2 || x));
  return (
    <div className="gradient-colors">
      <ColorChoice label={`${label} 1`} value={a} onChange={(v) => setAt(0, v)} />
      <ColorChoice label={`${label} 2`} value={b} onChange={(v) => setAt(1, v)} />
      {c ? (
        <>
          <ColorChoice label={`${label} 3`} value={c} onChange={(v) => setAt(2, v)} />
          <button className="link-btn small" onClick={() => onChange([a, b])}>
            Remove 3rd color
          </button>
        </>
      ) : (
        <button className="link-btn small" onClick={() => onChange([a, b, '#f59e0b'])}>
          ＋ Add a 3rd color (optional)
        </button>
      )}
    </div>
  );
}
