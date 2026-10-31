// Small pieces the Scout pages share.

export const fmt = (v) => (v == null ? '–' : v.toFixed(1));

// The 1 to 5 score as a small bar and a number.
export function ScoreBadge({ value, label }) {
  const pct = value == null ? 0 : Math.round((value / 5) * 100);
  return (
    <span className={`sc-score${value == null ? ' none' : value >= 3.8 ? ' high' : value < 2.6 ? ' low' : ''}`} title={label || 'Our balanced score, 1 to 5'}>
      <span className="sc-score-n mono">{fmt(value)}</span>
      <span className="sc-score-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
