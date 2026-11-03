// The casino's drawings: playing cards, the Jackson coin, the roulette wheel,
// mines tiles' gem and bomb, the flipping coin. Plain SVG, sized by CSS, so
// they look the same on every device and in both themes. Animations live in
// CSS (shell.css, "Casino cards"): transform and opacity only, with fixed
// keyframes, and only under Animations → Moving things.
import { rouletteColor } from '../../../functions/shared/casino.js';

// The Jackson coin as a small drawing (no letters inside, so a result reads
// "Got 9 back (+4)" to screen readers and in copied text).
export function CoinMark({ size = 15, className = '' }) {
  return (
    <svg className={`cz-coin-mark ${className}`} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9.2" fill="#c88a0c" />
      <circle cx="10" cy="10" r="7.6" fill="url(#cz-gold)" />
      <path
        d="M11.9 5.6v6.1c0 1.7-1.1 2.8-2.8 2.8-1.2 0-2.1-.6-2.5-1.6"
        fill="none"
        stroke="#7a4b00"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Shared gradients and patterns, put on the page once (outside React, so
// they stay while cards come and go).
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<radialGradient id="cz-gold" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6c4"/><stop offset="0.4" stop-color="#ffd34d"/><stop offset="0.8" stop-color="#e8a317"/><stop offset="1" stop-color="#b97a06"/></radialGradient>
<linearGradient id="cz-die" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e8f0"/></linearGradient>
<radialGradient id="cz-pip" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#3b4a63"/><stop offset="1" stop-color="#0e1a2e"/></radialGradient>
<linearGradient id="cz-gem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset="0.55" stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></linearGradient>
<radialGradient id="cz-bomb" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#64748b"/><stop offset="1" stop-color="#0f172a"/></radialGradient>
<linearGradient id="cz-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#fbfcfe"/><stop offset="1" stop-color="#e9edf4"/></linearGradient>
<radialGradient id="cz-ball" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3cad6"/></radialGradient>
<linearGradient id="cz-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="0.45" stop-color="#9aa5b8"/><stop offset="0.55" stop-color="#7b879c"/><stop offset="1" stop-color="#d8dde6"/></linearGradient>
<pattern id="cz-back" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#14284b"/><path d="M0 3.5h7M3.5 0v7" stroke="#2a4f8f" stroke-width="1.1"/><circle cx="3.5" cy="3.5" r="0.9" fill="#e8a317" opacity="0.7"/></pattern>
</defs></svg>`;
export function ensureCasinoDefs() {
  if (typeof document === 'undefined' || document.getElementById('cz-defs')) return;
  const box = document.createElement('div');
  box.id = 'cz-defs';
  box.innerHTML = DEFS;
  document.body.appendChild(box);
}

// ---------- playing cards ----------

const SUIT_PATH = {
  '♥': 'M10 17.6C4.3 13.3 1.6 10.3 1.6 7a4.2 4.2 0 0 1 8.4-1.4A4.2 4.2 0 0 1 18.4 7c0 3.3-2.7 6.3-8.4 10.6Z',
  '♦': 'M10 1.6 17 10l-7 8.4L3 10Z',
  '♠': 'M10 1.6S2 7.7 2 11.8a3.8 3.8 0 0 0 6.6 2.6L7.2 18.4h5.6l-1.4-4a3.8 3.8 0 0 0 6.6-2.6C18 7.7 10 1.6 10 1.6Z',
  '♣': 'M10 1.8a3.6 3.6 0 0 0-2.9 5.8A3.6 3.6 0 1 0 8.6 14l-1.4 4.4h5.6L11.4 14a3.6 3.6 0 1 0 1.5-6.4A3.6 3.6 0 0 0 10 1.8Z',
};
export const isRed = (suit) => suit === '♥' || suit === '♦';

// One card: "10♥", "A♠"… (blackjack), or a rank and a suit to show it in
// (high-low has no suits; it draws them for looks). hidden: face down.
export function PlayingCard({ card, rank, suit, hidden, size = 'md', deal = false, flip = false, delay = 0, className = '' }) {
  // Cards dealt together come in one after another.
  const style = deal && delay ? { animationDelay: `${delay * 0.09}s` } : undefined;
  if (hidden)
    return (
      <span className={`pcard back cz-card ${size}${deal ? ' deal' : ''} ${className}`} style={style} role="img" aria-label="Face-down card">
        <svg viewBox="0 0 60 84" aria-hidden="true">
          <rect x="0.5" y="0.5" width="59" height="83" rx="6" fill="#fff" stroke="#c9d1de" />
          <rect x="4" y="4" width="52" height="76" rx="4" fill="url(#cz-back)" />
          <rect x="7" y="7" width="46" height="70" rx="3" fill="none" stroke="#e8a317" strokeWidth="1.2" opacity="0.85" />
          <path d="M30 30l7 12-7 12-7-12z" fill="#e8a317" opacity="0.9" />
        </svg>
      </span>
    );
  const r = rank ?? card.slice(0, -1);
  const s = suit ?? card.slice(-1);
  const red = isRed(s);
  const face = ['J', 'Q', 'K'].includes(r);
  const ink = red ? '#d42a2a' : '#0e1a2e';
  return (
    <span
      className={`pcard cz-card ${size}${red ? ' red' : ''}${deal ? ' deal' : ''}${flip ? ' flip' : ''} ${className}`}
      style={style}
      role="img"
      aria-label={`${r}${s}`}
    >
      <svg viewBox="0 0 60 84" aria-hidden="true">
        <rect x="0.5" y="0.5" width="59" height="83" rx="6" fill="url(#cz-paper)" stroke="#c9d1de" />
        <text
          x="6"
          y="17"
          fill={ink}
          fontSize={r === '10' ? 13 : 15}
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5"
        >
          {r}
        </text>
        <path d={SUIT_PATH[s]} fill={ink} transform="translate(6.5 21) scale(0.5)" />
        <g transform="rotate(180 30 42)">
          <text
            x="6"
            y="17"
            fill={ink}
            fontSize={r === '10' ? 13 : 15}
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.5"
          >
            {r}
          </text>
          <path d={SUIT_PATH[s]} fill={ink} transform="translate(6.5 21) scale(0.5)" />
        </g>
        {face ? (
          <>
            <rect
              x="15"
              y="20"
              width="30"
              height="44"
              rx="3"
              fill={red ? '#fdeaea' : '#e9eef6'}
              stroke={ink}
              strokeWidth="1"
              opacity="0.95"
            />
            <text
              x="30"
              y="49"
              textAnchor="middle"
              fill={ink}
              fontSize="22"
              fontWeight="800"
              fontFamily="Georgia, 'Times New Roman', serif"
            >
              {r}
            </text>
            <path d={SUIT_PATH[s]} fill={ink} transform="translate(25 52) scale(0.5)" />
          </>
        ) : (
          <path d={SUIT_PATH[s]} fill={ink} transform={r === 'A' ? 'translate(16 28) scale(1.4)' : 'translate(19 31) scale(1.1)'} />
        )}
      </svg>
    </span>
  );
}

// ---------- dice ----------

// Which of the 3×3 spots have a pip, for 1–6.
const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function DieFace({ n }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <rect x="3.5" y="4.5" width="34" height="34" rx="8" fill="#b9c2d0" />
      <rect x="1.5" y="1.5" width="34" height="34" rx="8" fill="url(#cz-die)" stroke="#c9d1de" />
      {(PIPS[n] || []).map((k) => (
        <circle key={k} cx={8.5 + (k % 3) * 10} cy={8.5 + Math.floor(k / 3) * 10} r="3.2" fill="url(#cz-pip)" />
      ))}
    </svg>
  );
}

// ---------- mines ----------

export const Gem = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3.5h10l4.5 5.5L12 21 2.5 9z" fill="url(#cz-gem)" stroke="#065f46" strokeWidth="1" strokeLinejoin="round" />
    <path
      d="M2.5 9h19M7 3.5 9.5 9 12 21M17 3.5 14.5 9 12 21M9.5 9 12 3.5 14.5 9"
      fill="none"
      stroke="#ecfdf5"
      strokeWidth="0.9"
      strokeLinejoin="round"
      opacity="0.75"
    />
  </svg>
);
export const Bomb = ({ hit }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {hit && (
      <path
        d="M12 1.5l1.8 4 4.3-1.6-1.6 4.3 4 1.8-4 1.8 1.6 4.3-4.3-1.6-1.8 4-1.8-4-4.3 1.6 1.6-4.3-4-1.8 4-1.8-1.6-4.3 4.3 1.6z"
        fill="#fbbf24"
        opacity="0.9"
      />
    )}
    <circle cx="11" cy="13.5" r="6.5" fill="url(#cz-bomb)" />
    <path d="M14.8 8.6l2-2" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M17.3 6.2c.6-1.4 1.8-1.9 3-1.4" fill="none" stroke="#a16207" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="20.6" cy="4.6" r="1.3" fill="#f97316" />
    <circle cx="8.8" cy="11.2" r="1.6" fill="#fff" opacity="0.35" />
  </svg>
);

// ---------- crash ----------

// The rocket at the tip of the crash line, nose up and to the right.
export const Rocket = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g transform="rotate(45 12 12)">
      <path d="M12 2.5c3 2.4 4.3 5.6 4.3 9.2v4.1H7.7v-4.1c0-3.6 1.3-6.8 4.3-9.2z" fill="#f4f6fa" stroke="#9aa5b8" strokeWidth="0.8" />
      <circle cx="12" cy="9.6" r="1.9" fill="#3a63a8" stroke="#14284b" strokeWidth="0.7" />
      <path d="M7.7 12.6 5 16.2v2.2l2.7-1.3zM16.3 12.6l2.7 3.6v2.2l-2.7-1.3z" fill="#e0484f" />
      <path d="M9.6 15.8h4.8l-1 3.2c-.4 1.1-2.4 1.1-2.8 0z" fill="#ffd34d" />
      <path d="M10.6 18.8c.4 1.6.9 2.5 1.4 2.9.5-.4 1-1.3 1.4-2.9z" fill="#f97316" opacity="0.9" />
    </g>
  </svg>
);

// ---------- the coin flip ----------

// Heads: the Jackson coin's J. Tails: a horseshoe (the Trotters).
export function FlipCoin({ side, spin }) {
  return (
    <span className={`cz-flip ${side}${spin ? ' spin' : ''}`} role="img" aria-label={side === 'edge' ? 'Landed on its edge' : side}>
      <span className="cz-flip-turn">
        <span className="cz-flip-faces">
          <svg className="cz-face heads" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#b97a06" />
            <circle cx="20" cy="20" r="17.6" fill="none" stroke="#f5c542" strokeWidth="1.4" strokeDasharray="0.9 1.2" />
            <circle cx="20" cy="20" r="16" fill="url(#cz-gold)" />
            <circle cx="20" cy="20" r="13.5" fill="none" stroke="#c88a0c" strokeWidth="1" />
            <path d="M9 13a13 13 0 0 1 9-6" fill="none" stroke="#fffbe6" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
            <path
              d="M23.6 11.5v11.6c0 3.3-2.1 5.4-5.4 5.4-2.3 0-4-1.1-4.8-3"
              fill="none"
              stroke="#7a4b00"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
          <svg className="cz-face tails" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#b97a06" />
            <circle cx="20" cy="20" r="17.6" fill="none" stroke="#f5c542" strokeWidth="1.4" strokeDasharray="0.9 1.2" />
            <circle cx="20" cy="20" r="16" fill="url(#cz-gold)" />
            <circle cx="20" cy="20" r="13.5" fill="none" stroke="#c88a0c" strokeWidth="1" />
            <path d="M9 13a13 13 0 0 1 9-6" fill="none" stroke="#fffbe6" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
            <path d="M13.5 27.5V19a6.5 6.5 0 0 1 13 0v8.5" fill="none" stroke="#7a4b00" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M13.5 22.5h-1.6M13.5 18.5h-1.4M26.5 22.5h1.6M26.5 18.5h1.4" stroke="#7a4b00" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </span>
    </span>
  );
}

// ---------- roulette ----------

// The European wheel, clockwise from 0.
export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const STEP = 360 / WHEEL.length;
const POCKET = { red: '#c62828', black: '#1a2233', green: '#15803d' };
const polar = (r, deg) => [50 + r * Math.sin((deg * Math.PI) / 180), 50 - r * Math.cos((deg * Math.PI) / 180)];
// Drawn once: 37 pockets with their numbers, pocket 0 at the top.
const POCKETS = WHEEL.map((n, i) => {
  const a = i * STEP - STEP / 2;
  const b = a + STEP;
  const [x1, y1] = polar(47, a);
  const [x2, y2] = polar(47, b);
  const [x3, y3] = polar(33, b);
  const [x4, y4] = polar(33, a);
  const [tx, ty] = polar(41.5, i * STEP);
  return (
    <g key={n}>
      <path
        d={`M${x1} ${y1}A47 47 0 0 1 ${x2} ${y2}L${x3} ${y3}A33 33 0 0 0 ${x4} ${y4}Z`}
        fill={POCKET[rouletteColor(n)]}
        stroke="#e8c36a"
        strokeWidth="0.35"
      />
      <text
        x={tx}
        y={ty}
        fill="#fff"
        fontSize="4.6"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(${i * STEP} ${tx} ${ty})`}
        fontFamily="system-ui, sans-serif"
      >
        {n}
      </text>
    </g>
  );
});

// The pocket under the pointer, outlined once the ball is in.
const WIN_ARC = (() => {
  const [x1, y1] = polar(47.6, -STEP / 2);
  const [x2, y2] = polar(47.6, STEP / 2);
  const [x3, y3] = polar(32.4, STEP / 2);
  const [x4, y4] = polar(32.4, -STEP / 2);
  return `M${x1} ${y1}A47.6 47.6 0 0 1 ${x2} ${y2}L${x3} ${y3}A32.4 32.4 0 0 0 ${x4} ${y4}Z`;
})();

// The wheel stops with the server's number under the pointer at the top. The
// spin is a fixed three turns (CSS) on top of the resting angle.
export function RouletteWheel({ n, spin }) {
  const k = WHEEL.indexOf(n);
  return (
    <span className={`cz-wheel${spin ? ' spin' : ''}`} role="img" aria-label={`The ball landed on ${n}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="49.5" fill="#5b3a1a" />
        <circle cx="50" cy="50" r="48" fill="#7a4e24" />
        <g className="cz-wheel-turn">
          <g transform={`rotate(${-k * STEP} 50 50)`}>{POCKETS}</g>
          <circle cx="50" cy="50" r="33" fill="#0f5132" />
          <circle cx="50" cy="50" r="24" fill="#7a4e24" stroke="#e8c36a" strokeWidth="0.8" />
          <path d="M50 30v40M30 50h40" stroke="#e8c36a" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="5" fill="#e8c36a" />
        </g>
        <path className="cz-pocket-glow" d={WIN_ARC} />
        <g className="cz-ball-turn">
          <g className="cz-ball-drop">
            <circle cx="50" cy="11.4" r="2.7" fill="url(#cz-ball)" stroke="#9aa4b2" strokeWidth="0.4" />
          </g>
        </g>
        <path d="M50 1.5l-3.2 5.5h6.4z" fill="#e8c36a" stroke="#5b3a1a" strokeWidth="0.6" />
      </svg>
    </span>
  );
}
