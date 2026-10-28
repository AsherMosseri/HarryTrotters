// A six-sided die drawn with pips (the ⚀–⚅ characters render tiny and boxed
// on iPad). Used by /roll and the casino's /dice.

// Which of the 3×3 spots have a pip, for 1–6.
const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function Die({ n, i = 0 }) {
  return (
    <span className="die" role="img" aria-label={String(n)} style={{ '--i': i }}>
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} className={PIPS[n]?.includes(k) ? 'pip' : undefined} />
      ))}
    </span>
  );
}
