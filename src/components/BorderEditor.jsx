import { BORDER_ANIMS, BORDER_STYLES, DEFAULT_BORDER } from '../borders.js';
import GradientColors, { ColorChoice } from './GradientColors.jsx';

// Style, colors, thickness, roundness, and motion for a custom border.
export default function BorderEditor({ value, onChange, maxRadius = 40, sample }) {
  const b = { ...DEFAULT_BORDER, ...value };
  const set = (patch) => onChange({ ...b, ...patch });
  const off = b.style === 'none';
  const gradient = b.style === 'gradient';
  return (
    <div className="border-editor">
      <div className="segmented deco-chips" role="group" aria-label="Border style">
        {BORDER_STYLES.map((s) => (
          <button
            key={s.id}
            className={`plain-seg${b.style === s.id ? ' on' : ''}`}
            aria-pressed={b.style === s.id}
            onClick={() => set({ style: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>
      {!off && (
        <>
          {gradient && <GradientColors label="Border color" colors={b.colors} onChange={(colors) => set({ colors })} />}
          {!gradient && b.style !== 'rainbow' && (
            <ColorChoice label="Border color" value={b.colors[0]} onChange={(c) => set({ colors: [c, ...b.colors.slice(1)] })} />
          )}
          <label className="studio-range">
            <span>Thickness</span>
            <input type="range" min="1" max="12" value={b.width} onChange={(e) => set({ width: Number(e.target.value) })} />
            <b>{b.width}px</b>
          </label>
          <label className="studio-range">
            <span>Roundness</span>
            <input
              type="range"
              min="0"
              max={maxRadius}
              value={Math.min(b.radius, maxRadius)}
              onChange={(e) => set({ radius: Number(e.target.value) })}
            />
            <b>{b.radius}px</b>
          </label>
          <div className="segmented deco-chips" role="group" aria-label="Border motion">
            {BORDER_ANIMS.filter((a) => a.id !== 'spin' || gradient || b.style === 'rainbow')
              .filter((a) => a.id !== 'shimmer' || gradient || b.style === 'rainbow')
              .map((a) => (
                <button key={a.id} className={`plain-seg${(b.anim || '') === a.id ? ' on' : ''}`} onClick={() => set({ anim: a.id })}>
                  {a.label}
                </button>
              ))}
          </div>
        </>
      )}
      {sample}
    </div>
  );
}
