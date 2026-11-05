import { Coin } from './Coins.jsx';
import CountUp from './CountUp.jsx';
import { useCoinFormat } from './CoinNum.jsx';
import { coinTitle, formatCoins } from '../coinFormat.js';

// The most characters the pill shows ("9,999,999,999" is 13). With commas or
// no commas a bigger balance (coins go up to a googol: 11 quadrillion is
// "11,000,000,000,000,000", 22) would push past the header's room, so the
// pill writes it short instead ("11Qa"); the exact number is on hover.
const PILL_CHARS = 13;

// Your Jackson coins, always in the top right. Tap it for the coins screen.
// Shows nothing until the balance has loaded (so it never flashes 0), and
// counts to a new number when the balance changes (Moving things, in Appearance).
// The number follows Appearance → Coin numbers (1,234 · 1234 · 1.2k); each
// frame of the count is formatted, and Short shows the exact number on hover.
export default function CoinPill({ balance, ready, onOpen, className = '' }) {
  const f = useCoinFormat();
  if (!ready) return null;
  const n = Math.max(0, Math.floor(Number(balance) || 0));
  const text = (v) => {
    const s = f.n(v);
    return s.length > PILL_CHARS ? formatCoins(v, 'short') : s;
  };
  // data-chars: how wide it is, in characters, so headers under it on iPad
  // leave room (shell.css, Coin numbers).
  return (
    <button
      type="button"
      className={`coin-pill ${className}`}
      onClick={onOpen}
      title={f.title(n) || (text(n) !== f.n(n) ? coinTitle(n, 'short') : undefined)}
      data-chars={text(n).length}
      aria-label={`${f.exact(n)} Jackson coins, open coins`}
    >
      <Coin size={16} />
      <CountUp value={n} from={n} format={text} className="mono" aria-hidden="true" />
    </button>
  );
}
