import { Coin } from './Coins.jsx';
import CountUp from './CountUp.jsx';
import { useCoinFormat } from './CoinNum.jsx';

// Your Jackson coins, always in the top right. Tap it for the coins screen.
// Shows nothing until the balance has loaded (so it never flashes 0), and
// counts to a new number when the balance changes (Moving things, in Appearance).
// The number follows Appearance → Coin numbers (1,234 · 1234 · 1.2k); each
// frame of the count is formatted, and Short shows the exact number on hover.
export default function CoinPill({ balance, ready, onOpen, className = '' }) {
  const f = useCoinFormat();
  if (!ready) return null;
  const n = Math.max(0, Math.floor(Number(balance) || 0));
  return (
    <button
      type="button"
      className={`coin-pill ${className}`}
      onClick={onOpen}
      title={f.title(n)}
      aria-label={`${f.exact(n)} Jackson coins, open coins`}
    >
      <Coin size={16} />
      <CountUp value={n} from={n} format={f.n} className="mono" aria-hidden="true" />
    </button>
  );
}
