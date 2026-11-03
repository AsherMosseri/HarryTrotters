import { DieFace, ensureCasinoDefs } from './casinoArt.jsx';

// A six-sided die, drawn (the ⚀–⚅ characters render tiny and boxed on
// iPad). Used by /roll, the casino's /dice and dice challenges. roll: tumble
// in (only when it was just rolled, so scrolling back doesn't replay it);
// i staggers dice rolled together.
export function Die({ n, i = 0, roll = false }) {
  ensureCasinoDefs();
  return (
    <span
      className={`die${roll ? ' roll' : ''}${i % 2 ? ' odd' : ''}`}
      role="img"
      aria-label={String(n)}
      style={{ animationDelay: `${i * 0.07}s` }}
    >
      <DieFace n={n} />
    </span>
  );
}
