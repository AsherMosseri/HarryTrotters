import { useEffect, useRef, useState } from 'react';
import { useEscape } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';

// The fun ad formats: playable mini-games, the prize wheel, video-style
// ads, and the "ad blocker detected" wall. Prizes are Jackson coins (small,
// with a daily limit), written by the caller.

const pic = (ad) => (ad.image ? <img className="ad-img" src={ad.image} alt="" /> : ad.emoji);
const style = (ad) => ({ '--ad-a': ad.colors?.[0] || '#6c5ce7', '--ad-b': ad.colors?.[1] || '#00cec9' });

// Ads you play. The button opens the game instead of an order or booking.
export const GAME_ADS = [
  {
    id: 'game-whack',
    game: 'whack',
    brand: 'Screw Gremlin Repellent',
    emoji: '👺',
    headline: 'Whack the gremlins, win Jackson coins',
    body: 'They’re stealing your screws. Bonk as many as you can in 15 seconds.',
    cta: 'Play now',
    colors: ['#2ecc71', '#16a085'],
    anim: 'shake',
    sticker: 'PLAY & WIN',
    fine: 'No gremlins were harmed. Several were bonked.',
  },
  {
    id: 'game-catch',
    game: 'catch',
    brand: 'Pit Bar',
    emoji: '🍫',
    headline: 'Catch the falling Pit Bars',
    body: 'Tap them before they hit the floor. The 5-second rule does not apply.',
    cta: 'Play now',
    colors: ['#6d4c41', '#ffb74d'],
    anim: 'bounce',
    sticker: 'PLAY & WIN',
    fine: 'Please eat only one of the bars you catch.',
  },
  {
    id: 'game-find',
    game: 'find',
    brand: 'Hex Key Finder',
    emoji: '🔧',
    headline: 'Find the 2.5 mm hex key',
    body: 'It’s under one of these. You get three tries. (It’s never in the first place you look.)',
    cta: 'Play now',
    colors: ['#fdcb6e', '#e17055'],
    anim: 'wobble',
    sticker: 'PLAY & WIN',
    fine: 'In real life it’s in the couch.',
  },
];

const tier = (score) => (score >= 12 ? 3 : score >= 8 ? 2 : score >= 4 ? 1 : 0);

function Whack({ onDone }) {
  const [up, setUp] = useState(-1);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(15);
  const scoreRef = useRef(0);
  useEffect(() => {
    if (left <= 0) {
      onDone(scoreRef.current, `${scoreRef.current} gremlins bonked`);
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    let timer;
    const pop = () => {
      if (!alive) return;
      setUp(Math.floor(Math.random() * 9));
      timer = setTimeout(pop, Math.max(420, 900 - scoreRef.current * 30));
    };
    timer = setTimeout(pop, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="game">
      <div className="game-bar">
        <b>Score {score}</b>
        <span>{left}s</span>
      </div>
      <div className="whack-grid">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            className={`whack-hole${up === i ? ' up' : ''}`}
            aria-label={up === i ? 'Gremlin! Bonk it' : 'Empty hole'}
            onPointerDown={() => {
              if (up !== i) return;
              scoreRef.current += 1;
              setScore(scoreRef.current);
              setUp(-1);
            }}
          >
            <span aria-hidden="true">{up === i ? '👺' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Catch({ emoji, onDone }) {
  const [items, setItems] = useState([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(15);
  const scoreRef = useRef(0);
  const area = useRef(null);
  useEffect(() => {
    if (left <= 0) {
      onDone(scoreRef.current, `${scoreRef.current} caught`);
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let id = 0;
    let raf;
    let last = performance.now();
    let spawnIn = 0;
    const step = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const h = area.current?.clientHeight || 260;
      spawnIn -= dt;
      setItems((list) => {
        let next = list.map((x) => ({ ...x, y: x.y + x.v * dt })).filter((x) => x.y < h);
        if (spawnIn <= 0) {
          spawnIn = Math.max(0.35, 0.7 - scoreRef.current * 0.02);
          next = [...next, { id: id++, x: 6 + Math.random() * 82, y: -40, v: 110 + Math.random() * 60 + scoreRef.current * 6 }];
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="game">
      <div className="game-bar">
        <b>Caught {score}</b>
        <span>{left}s</span>
      </div>
      <div className="catch-area" ref={area}>
        {items.map((x) => (
          <button
            key={x.id}
            className="catch-item"
            style={{ left: `${x.x}%`, transform: `translateY(${x.y}px)` }}
            aria-label="Catch it"
            onPointerDown={() => {
              scoreRef.current += 1;
              setScore(scoreRef.current);
              setItems((list) => list.filter((y) => y.id !== x.id));
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

const DECOYS = ['🧦', '🥔', '🍕', '🔩', '🧤', '🦆', '📎', '🪫', '🧃', '🍌', '🪀'];
function Find({ onDone }) {
  const [key] = useState(() => Math.floor(Math.random() * 12));
  const [open, setOpen] = useState([]);
  const [over, setOver] = useState(false);
  const tries = open.length;
  const flip = (i) => {
    if (over || open.includes(i)) return;
    const next = [...open, i];
    setOpen(next);
    if (i === key || next.length >= 3) {
      setOver(true);
      const found = i === key;
      setTimeout(
        () =>
          onDone(
            found ? [12, 8, 4][next.length - 1] : 0,
            found ? `Found it in ${next.length} ${next.length === 1 ? 'try' : 'tries'}` : 'Not found',
          ),
        700,
      );
    }
  };
  return (
    <div className="game">
      <div className="game-bar">
        <b>Tries left {3 - tries}</b>
        <span>Find 🔧</span>
      </div>
      <div className="find-grid">
        {Array.from({ length: 12 }, (_, i) => {
          const shown = open.includes(i) || (over && i === key);
          return (
            <button
              key={i}
              className={`find-tile${shown ? ' shown' : ''}`}
              onClick={() => flip(i)}
              aria-label={shown ? 'Revealed' : 'Look under this one'}
            >
              {shown ? (i === key ? '🔧' : DECOYS[i % DECOYS.length]) : '❔'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GameDialog({ ad, capLeft, onPrize, onClose }) {
  useEscape(onClose);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const finish = async (score, label) => {
    const won = Math.min(tier(score), Math.max(0, capLeft));
    if (won > 0) await onPrize(won, `${label} in ${ad.brand}`);
    setResult({ score, label, won, capped: tier(score) > won });
  };
  const again = () => {
    setResult(null);
    setRound(round + 1);
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog ad-game" style={style(ad)} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={ad.headline}>
          <div className="ad-action-head">
            <span className="ad-action-emoji" aria-hidden="true">
              {ad.emoji}
            </span>
            <b>{ad.brand}</b>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="ad-action-body">
            {!result ? (
              <>
                <h2>{ad.headline}</h2>
                {ad.game === 'whack' && <Whack key={round} onDone={finish} />}
                {ad.game === 'catch' && <Catch key={round} emoji={ad.emoji} onDone={finish} />}
                {ad.game === 'find' && <Find key={round} onDone={finish} />}
                <p className="muted small">
                  {capLeft > 0
                    ? `Win up to 3 Jackson coins a game (${capLeft} left today).`
                    : 'You’ve won all you can today. Play for fun!'}
                </p>
              </>
            ) : (
              <div className="ad-action-done">
                <div className="ad-pop" aria-hidden="true">
                  {result.won ? '🏆' : '🎮'}
                </div>
                <h2>{result.label}!</h2>
                <p className="ad-action-detail">
                  {result.won ? `+${result.won} Jackson coin${result.won === 1 ? '' : 's'}` : 'No coins this time'}
                </p>
                {result.capped && <p className="muted small">That’s today’s limit for game prizes.</p>}
                <div className="row gap">
                  <button className="btn" onClick={again}>
                    Play again
                  </button>
                  <button className="btn primary" onClick={onClose}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- the prize wheel ----------

export const WHEEL = [
  { label: '+1', coins: 1, color: '#ff6b6b', weight: 25 },
  { label: '+2', coins: 2, color: '#feca57', weight: 20 },
  { label: 'Nothing', coins: 0, color: '#576574', weight: 13 },
  { label: '+5', coins: 5, color: '#1dd1a1', weight: 8 },
  { label: '1 h no ads', coins: 0, hour: true, color: '#54a0ff', weight: 8 },
  { label: '+3', coins: 3, color: '#ff9ff3', weight: 12 },
  { label: 'Nothing', coins: 0, color: '#8395a7', weight: 12 },
  { label: '+10', coins: 10, color: '#5f27cd', weight: 2 },
];
const SEG = 360 / WHEEL.length;

export function PrizeWheel({ onWin, onClose }) {
  const [turn, setTurn] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState(null);
  useEscape(onClose, !spinning);
  const spin = () => {
    let r = Math.random() * WHEEL.reduce((t, s) => t + s.weight, 0);
    const i = WHEEL.findIndex((s) => (r -= s.weight) < 0);
    setSpinning(true);
    setTurn(360 * 6 + (360 - (i * SEG + SEG / 2)));
    setTimeout(async () => {
      await onWin(WHEEL[i]);
      setWon(WHEEL[i]);
      setSpinning(false);
    }, 4700);
  };
  const gradient = `conic-gradient(${WHEEL.map((s, i) => `${s.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(', ')})`;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={() => !spinning && onClose()}>
        <div className="dialog prize-wheel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Prize wheel">
          <button className="icon-btn profile-close" onClick={onClose} disabled={spinning} aria-label="Close">
            <CloseIcon />
          </button>
          <h2>🎉 Congratulations!</h2>
          <p className="muted">You’ve been selected for today’s prize spin.</p>
          <div className="wheel-wrap">
            <span className="wheel-pointer" aria-hidden="true">
              ▼
            </span>
            <div className="wheel" style={{ background: gradient, transform: `rotate(${turn}deg)` }}>
              {WHEEL.map((s, i) => (
                <span
                  key={i}
                  className="wheel-label"
                  style={{ transform: `rotate(${i * SEG + SEG / 2}deg) translateY(calc(var(--r) * -0.64))` }}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          {won ? (
            <>
              <p className="ad-action-detail">
                {won.coins
                  ? `You won ${won.coins} Jackson coin${won.coins === 1 ? '' : 's'}!`
                  : won.hour
                    ? 'You won an hour with no ads!'
                    : 'Nothing this time. Come back tomorrow!'}
              </p>
              <button className="btn primary big-btn" onClick={onClose}>
                Done
              </button>
            </>
          ) : (
            <button className="btn primary big-btn" onClick={spin} disabled={spinning}>
              {spinning ? 'Spinning…' : 'Spin!'}
            </button>
          )}
          <p className="muted tiny">One spin a day.</p>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- video-style ads ----------

const LENGTH = 10;
export function VideoAd({ ad, n, total, skip, onCta, onNext }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (t >= LENGTH) return;
    const timer = setTimeout(() => setT(Math.round((t + 0.1) * 10) / 10), 100);
    return () => clearTimeout(timer);
  }, [t]);
  useEscape(onNext, t >= skip);
  const scene = t < 2.5 ? 0 : t < 5 ? 1 : t < 7.5 ? 2 : t < LENGTH ? 3 : 4;
  return (
    <Overlay>
      <div className="ad-video" role="dialog" aria-label={`Video ad: ${ad.brand}`}>
        <div className="ad-video-stage" style={style(ad)}>
          {scene === 0 && (
            <div className="vscene vs-zoom" key="0">
              <span className="vs-emoji">{pic(ad)}</span>
              <h2>{ad.brand}</h2>
            </div>
          )}
          {scene === 1 && (
            <div className="vscene vs-slide" key="1">
              <h2>{ad.headline}</h2>
            </div>
          )}
          {scene === 2 && (
            <div className="vscene vs-slide" key="2">
              <span className="vs-emoji small">{pic(ad)}</span>
              <p>{ad.body}</p>
            </div>
          )}
          {scene >= 3 && (
            <div className="vscene vs-zoom" key="3">
              <span className="vs-emoji">{pic(ad)}</span>
              <h2>{ad.brand}</h2>
              <button className="ad-cta big" onClick={() => onCta(ad)}>
                {ad.cta}
              </button>
              {scene === 4 && (
                <button className="link-btn vs-replay" onClick={() => setT(0)}>
                  ↻ Replay
                </button>
              )}
            </div>
          )}
          {ad.sticker && <span className="ad-sticker">{ad.sticker}</span>}
          <div className="ad-video-ui">
            <span className="vs-badge">
              Ad {n} of {total} · 0:{String(Math.max(0, Math.ceil(LENGTH - t))).padStart(2, '0')}
            </span>
            <span className="spacer" />
            <button className="vs-learn" onClick={() => onCta(ad)}>
              Learn more
            </button>
            {t >= skip || scene === 4 ? (
              <button className="vs-skip" onClick={onNext}>
                {scene === 4 ? 'Close' : 'Skip ad'} ⏭
              </button>
            ) : (
              <span className="vs-skip waiting">Skip in {Math.ceil(skip - t)}</span>
            )}
          </div>
          <div className="vs-progress">
            <span style={{ width: `${Math.min(100, (t / LENGTH) * 100)}%` }} />
          </div>
        </div>
        <p className="vs-fine">{ad.fine}</p>
      </div>
    </Overlay>
  );
}

// ---------- "ad blocker detected" ----------

export function AdBlockWall({ balance, onPay, onWatch, onClose }) {
  const [tries, setTries] = useState(0);
  return (
    <Overlay>
      <div className="panel-backdrop center ad-block-back">
        <div className={`dialog ad-block${tries === 1 ? ' shake' : ''}`} role="dialog" aria-label="Ad blocker detected">
          <div className="ad-block-icon" aria-hidden="true">
            🛑
          </div>
          <h2>Ad blocker detected</h2>
          <p className="muted">
            It looks like you’re using an ad blocker. Our friends keep this app running, so please turn it off to continue.
          </p>
          {tries === 1 && <p className="danger small">Still detected… 🤨 Try turning it off again.</p>}
          <button className="btn primary big-btn" onClick={() => (tries ? onClose() : setTries(1))}>
            I turned it off
          </button>
          <div className="row gap">
            <button className="btn grow" disabled={balance < 1} onClick={onPay}>
              Pay 1 Jackson coin
            </button>
            <button className="btn grow" onClick={onWatch}>
              Watch an ad
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
