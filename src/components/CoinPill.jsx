import { Coin } from './Coins.jsx';
import CountUp from './CountUp.jsx';

// 1,234 up to 9,999; then 12.3k and 1.2M, so it never gets wide.
const short = (v, unit) => `${(v / unit).toFixed(1).replace(/\.0$/, '')}`;
const compact = (n) => {
  const v = Math.round(n);
  if (v < 10000) return v.toLocaleString();
  if (v < 100000) return `${short(Math.floor(v / 100) * 100, 1000)}k`;
  if (v < 1000000) return `${Math.floor(v / 1000)}k`;
  return `${short(Math.floor(v / 100000) * 100000, 1000000)}M`;
};

// Your Jackson coins, always in the top right. Tap it for the coins screen.
// Shows nothing until the balance has loaded (so it never flashes 0), and
// counts to a new number when the balance changes (Moving things, in Appearance).
export default function CoinPill({ balance, ready, onOpen, className = '' }) {
  if (!ready) return null;
  const n = Math.max(0, Math.floor(Number(balance) || 0));
  return (
    <button type="button" className={`coin-pill ${className}`} onClick={onOpen} aria-label={`${n.toLocaleString()} Jackson coins, open coins`}>
      <Coin size={16} />
      <CountUp value={n} from={n} format={compact} className="mono" aria-hidden="true" />
    </button>
  );
}
