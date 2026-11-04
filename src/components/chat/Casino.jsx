import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../common.jsx';
import {
  HL_NAMES,
  MINES_TILES,
  crashMultiplier,
  crashTimeFor,
  dailyAmount,
  handValue,
  hlChance,
  hlStep,
  minesMultiplier,
} from '../../../functions/shared/casino.js';
import { AWARD_CAPS } from '../../../functions/shared/coins.js';
import { serverNow } from '../../serverTime.js';
import { celebrate } from '../../motion.js';
import { Icon } from '../shell/icons.jsx';
import { Die } from './Die.jsx';
import { Bomb, CoinMark, FlipCoin, Gem, PlayingCard, Rocket, RouletteWheel, ensureCasinoDefs } from './casinoArt.jsx';
import { useMove } from './useMove.js';

// The Jackson coins economy and casino cards (the play function rolls; these
// show it). Live games (blackjack, crash, mines, high-low) have buttons for
// the person playing; onMove(move) sends it to the server (useMove: instant
// feedback, one move at a time). Every live card keeps its size while it's
// played: the chat stays scrolled to the bottom, so a card that grew would
// slide its buttons out from under the next tap.

// The lottery doc (pot, tickets, draw time, and which card is open), live.
export const LotteryContext = createContext(null);
// Animate only when it just happened (not when scrolling back through chat),
// decided once when the card first shows.
const fresh = (m) => serverNow() - m.at < 8000;
const useFresh = (m) => useState(() => fresh(m))[0];
// Things that showed up while the card was on screen (a dealt card, an
// opened tile) animate in; what was there when it mounted doesn't. A key stays
// "new" for a moment, so a re-render mid-animation doesn't cut it short.
function useAppeared(keys) {
  const seen = useRef(null);
  const now = performance.now();
  if (!seen.current) seen.current = new Map(keys.map((k) => [k, -1e9]));
  for (const k of keys) if (!seen.current.has(k)) seen.current.set(k, now);
  return (k) => now - (seen.current.get(k) ?? -1e9) < 1500;
}
// Wins: a big one pays 5× the bet or more (a banner), and the person playing
// gets a burst of confetti sized to the win (Celebrations), once.
const times = (c) => (c.bet ? (c.bet + (c.net ?? 0)) / c.bet : 0);
const isBig = (c) => (c.net ?? 0) > 0 && times(c) >= 5;
function useCelebrate(ref, c, on, delay = 0) {
  useEffect(() => {
    if (!on || !((c.net ?? 0) > 0)) return;
    const count = Math.round(Math.min(64, 10 + times(c) * 5));
    const t = setTimeout(() => ref.current && celebrate({ el: ref.current, count }), delay);
    return () => clearTimeout(t);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
}
// A big win's banner across the table. pop: it just happened.
function BigWin({ c, pop, delay = '', jackpot }) {
  if (!isBig(c)) return null;
  return (
    <span className={`cz-bigwin${pop ? ` pop ${delay}` : ''}${jackpot ? ' jackpot' : ''}`} aria-hidden="true">
      <b>{jackpot ? 'Jackpot' : 'Big win'}</b>
      <span className="mono">×{Math.floor(times(c) * 10) / 10}</span>
    </span>
  );
}

// An amount of Jackson coins: the number, then the coin.
export const Amt = ({ n }) => (
  <span className="cz-amt">
    <span className="mono">{n}</span>
    <CoinMark />
  </span>
);

function Outcome({ c, reveal = '' }) {
  if (c.status === 'playing')
    return (
      <div className="muted small">
        Bet <Amt n={c.bet} /> · playing…
      </div>
    );
  const net = c.net ?? 0;
  return (
    <div className={`casino-outcome ${net > 0 ? 'win' : net < 0 ? 'lose' : 'push'}${reveal ? ` cz-reveal ${reveal}` : ''}`}>
      {/* Lead with what came back, so it matches the multiplier next to it:
          5 at 1.95x reads "Got 9 back (+4)" (payouts round down). */}
      {net > 0 ? (
        <>
          Got <Amt n={c.bet + net} /> back <span className="casino-net">(+{net})</span>
        </>
      ) : net < 0 ? (
        <>
          Lost <Amt n={-net} />
        </>
      ) : (
        'Push: bet back'
      )}
      <span className="muted small">
        {' '}
        · bet <span className="mono">{c.bet}</span>
      </span>
    </div>
  );
}

// ---------- controls ----------

// A game button: pressed shows at once; while its move is out it says so
// (aria-busy) and the card's other buttons wait.
export function ActBtn({ mv, move, primary, disabled, children, className = '', onTap }) {
  const mine = mv.pending === move;
  return (
    <button
      type="button"
      className={`btn cz-act${primary ? ' primary' : ''}${mine ? ' is-pending' : ''} ${className}`}
      disabled={disabled || (mv.pending != null && !mine)}
      aria-busy={mine ? 'true' : undefined}
      onClick={() => {
        if (mv.pending == null) onTap?.();
        mv.send(move);
      }}
    >
      {children}
      {mine && <span className="cz-spin" aria-hidden="true" />}
    </button>
  );
}
// The line under the buttons: a problem, what's happening, or a hint. Always
// there (one line high), so nothing moves when it changes.
function StatusLine({ mv, busy, hint }) {
  if (mv.error)
    return (
      <div className="cz-status casino-error" role="alert">
        <Icon name="cross" size={14} /> {mv.error}
      </div>
    );
  return (
    <div className="cz-status muted small" aria-live="polite">
      {mv.pending != null ? busy : hint}
    </div>
  );
}

// ---------- one-shot games ----------

// The symbols that blur past before each reel stops on the server's.
const REEL_FILL = ['🔩', '⚙️', '🔋', '🔧', '🤖', '🏆', '💎', '⚙️', '🔩', '🔋'];
function Slots({ m, c, mine }) {
  const spin = useFresh(m);
  const ref = useRef(null);
  const net = c.net ?? 0;
  const [a, b, d] = c.game.reels;
  const three = a === b && b === d;
  useCelebrate(ref, c, spin && mine, 1100);
  return (
    <div ref={ref} className={`casino-slots cz-slots${net > 0 ? ' win' : ''}${three ? ' three' : ''}${spin ? ' fresh' : ''}`}>
      <div className="cz-table cz-slot-felt">
        <div className="cz-machine">
          <span className="cz-marquee" aria-hidden="true">
            <b>Slots</b>
          </span>
          <span className="cz-bulbs top" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <div className="cz-glass">
            <div className="slot-reels">
              {c.game.reels.map((r, i) => (
                <div key={i} className={`slot-reel${(three || (net > 0 && c.game.reels.filter((x) => x === r).length > 1)) ? ' hit' : ''}`}>
                  <div className={`slot-strip r${i}${spin ? ' spin' : ''}`}>
                    {spin &&
                      REEL_FILL.map((x, j) => (
                        <span key={j} className="blur">
                          {x}
                        </span>
                      ))}
                    <span>{r}</span>
                  </div>
                </div>
              ))}
            </div>
            <span className="cz-payline" aria-hidden="true" />
            <span className="cz-shine" aria-hidden="true" />
          </div>
          <span className="cz-bulbs bottom" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <span className={`cz-lever${spin ? ' pull' : ''}`} aria-hidden="true">
            <i className="cz-lever-stick" />
            <i className="cz-lever-knob" />
          </span>
        </div>
        <BigWin c={c} pop={spin} delay="late" jackpot={three} />
      </div>
      <div className="cz-line">
        <b className={spin ? 'cz-reveal late' : ''}>{c.game.line}</b>
        <Outcome c={c} reveal={spin ? 'late' : ''} />
      </div>
    </div>
  );
}

function DiceSide({ label, dice, win, roll, first }) {
  return (
    <div className={`cz-dice-side${win ? ' won' : ''}${roll ? ' fresh' : ''}`}>
      <div className="cz-label">{label}</div>
      <div className="dice-row">
        <Die n={dice[0]} i={first} roll={roll} />
        <Die n={dice[1]} i={first + 1} roll={roll} />
      </div>
      <b className={`cz-total mono${roll ? ' cz-reveal mid' : ''}`}>{dice[0] + dice[1]}</b>
    </div>
  );
}
function Dice({ m, c, mine }) {
  const roll = useFresh(m);
  const ref = useRef(null);
  const a = c.game.you[0] + c.game.you[1];
  const b = c.game.house[0] + c.game.house[1];
  useCelebrate(ref, c, roll && mine, 700);
  return (
    <div ref={ref} className="casino-dice">
      <div className="casino-vs cz-table">
        <DiceSide label="You" dice={c.game.you} win={a > b} roll={roll} first={0} />
        <span className={`cz-vs-badge${roll ? ' pop' : ''}`}>vs</span>
        <DiceSide
          label={
            <>
              <Icon name="robot" size={13} /> House
            </>
          }
          dice={c.game.house}
          win={b > a}
          roll={roll}
          first={2}
        />
        <BigWin c={c} pop={roll} delay="mid" />
      </div>
      <Outcome c={c} reveal={roll ? 'mid' : ''} />
    </div>
  );
}

function Coinflip({ m, c, mine }) {
  const spin = useFresh(m);
  const ref = useRef(null);
  useCelebrate(ref, c, spin && mine, 1000);
  const won = (c.net ?? 0) > 0;
  return (
    <div ref={ref} className="cz-flipcard">
      <div className="cz-table cz-flip-table">
        <div className={`cz-plate${won ? ' won' : ''}`}>
          <span className="cz-label">Your call</span>
          <b>{c.game.call}</b>
        </div>
        <div className="cz-flip-stage">
          <FlipCoin side={c.game.side} spin={spin} />
          <span className={`cz-flip-shadow${spin ? ' spin' : ''}`} aria-hidden="true" />
        </div>
        <div className={`cz-plate${won ? ' won' : ''}${spin ? ' cz-reveal late' : ''}`}>
          <span className="cz-label">Landed</span>
          <b>{c.game.side}</b>
        </div>
      </div>
      <div className="cz-flip-text">
        {c.game.side === 'edge' && <div className={spin ? 'cz-reveal late' : ''}>It landed on its EDGE. The house wins.</div>}
        <Outcome c={c} reveal={spin ? 'late' : ''} />
      </div>
    </div>
  );
}

function Roulette({ m, c, mine }) {
  const spin = useFresh(m);
  const ref = useRef(null);
  useCelebrate(ref, c, spin && mine, 1150);
  return (
    <div ref={ref} className="casino-roulette">
      <div className="cz-table cz-wheel-felt">
        <RouletteWheel n={c.game.n} spin={spin} />
        <div className="cz-wheel-info">
          <span className="cz-label">The ball</span>
          <span className={`roulette-ball ${c.game.color}${spin ? ' cz-reveal late pop' : ''}`}>
            <span className="mono">{c.game.n}</span>
          </span>
          <span className="cz-label">Your bet</span>
          <span className="cz-bet-chip">{c.game.spot}</span>
        </div>
        <BigWin c={c} pop={spin} delay="late" />
      </div>
      <div className="cz-roulette-side">
        <div>
          You bet on <b>{c.game.spot}</b>.
        </div>
        <Outcome c={c} reveal={spin ? 'late' : ''} />
      </div>
    </div>
  );
}

// ---------- live games ----------

function Hand({ label, value, cards, hidden, ghost, appeared, prefix, dealAll }) {
  const n = cards.length + (hidden ? 1 : 0) + (ghost ? 1 : 0);
  return (
    <div className="bj-hand">
      <span className="cz-label">
        {label}
        {value != null && <span className={`cz-chip mono${value > 21 ? ' bust' : ''}`}>{value}</span>}
      </span>
      <div className={`bj-cards${n > 4 ? ' many' : ''}`}>
        {cards.map((x, i) => (
          <PlayingCard key={`${i}${x}`} card={x} deal={dealAll || appeared(`${prefix}${i}${x}`)} delay={dealAll ? i * 2 + (prefix === 'd' ? 1 : 0) : 0} />
        ))}
        {hidden && <PlayingCard hidden deal={dealAll} delay={3} />}
        {ghost && <PlayingCard hidden className="ghost" />}
      </div>
    </div>
  );
}

function Blackjack({ m, c, mine, mv }) {
  const g = c.game;
  const playing = c.status === 'playing';
  const dealAll = useFresh(m) && g.you.length === 2 && g.dealer.length <= 2;
  const appeared = useAppeared([...g.dealer.map((x, i) => `d${i}${x}`), ...g.you.map((x, i) => `y${i}${x}`)]);
  const ended = useAppeared([c.status]);
  const ref = useRef(null);
  const justEnded = !playing && ended(c.status);
  useCelebrate(ref, c, mine && justEnded, 450);
  const label = { blackjack: 'Blackjack! Pays 3:2', bust: 'Bust.', won: 'You win.', lost: 'Dealer wins.', push: 'Push.' }[c.status];
  const dealing = mv.pending === 'hit' || mv.pending === 'double';
  return (
    <div ref={ref} className={`casino-bj cz-live ${c.status}`}>
      <div className="cz-table">
        <Hand label="Dealer" value={playing ? null : handValue(g.dealer)} cards={g.dealer} hidden={playing} appeared={appeared} prefix="d" dealAll={dealAll} />
        <Hand
          label={
            <>
              {mine ? 'You' : 'Player'}
              {g.doubled ? ' · doubled' : ''}
            </>
          }
          value={handValue(g.you)}
          cards={g.you}
          ghost={dealing}
          appeared={appeared}
          prefix="y"
          dealAll={dealAll}
        />
        <BigWin c={c} pop={justEnded} />
      </div>
      {playing && mine ? (
        <div className="cz-controls">
          <div className="cz-actions three">
            <ActBtn mv={mv} move="hit" primary>
              Hit
            </ActBtn>
            <ActBtn mv={mv} move="stand">
              Stand
            </ActBtn>
            <ActBtn mv={mv} move="double" disabled={g.you.length !== 2 || g.doubled}>
              Double{' '}
              <span className="cz-sub">
                +<Amt n={c.bet} />
              </span>
            </ActBtn>
          </div>
          <StatusLine mv={mv} busy={mv.pending === 'stand' ? 'Dealer’s turn…' : 'Dealing…'} hint="Hit for a card, Stand to keep your hand." />
        </div>
      ) : (
        <div className="cz-controls cz-done">
          {playing ? (
            <span className="muted small">
              Bet <Amt n={c.bet} /> · playing…
            </span>
          ) : (
            label && <b className={justEnded ? 'cz-reveal soon' : ''}>{label}</b>
          )}
          {!playing && <Outcome c={c} reveal={justEnded ? 'soon' : ''} />}
        </div>
      )}
    </div>
  );
}

// The crash chart: a glowing line that climbs with the multiplier, drawn
// straight to the page each frame (no re-render), its axes stretching as it
// goes. The server's clock decides when it crashed and when you cashed out.
const GW = 300;
const GH = 140;
function graph(ms, last) {
  const T = Math.max(9000, ms * 1.12);
  const top = Math.max(2, last * 1.18);
  const x = (t) => 12 + (t / T) * (GW - 34);
  const y = (mult) => GH - 14 - ((mult - 1) / (top - 1)) * (GH - 50);
  const pts = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const t = (ms * i) / n;
    pts.push(`${x(t).toFixed(1)} ${y(Math.max(1, Math.exp((0.07 * t) / 1000))).toFixed(1)}`);
  }
  const line = `M${pts.join('L')}`;
  return { line, area: `${line}L${x(ms).toFixed(1)} ${GH - 14}L12 ${GH - 14}Z`, end: [x(ms), y(last)] };
}
const at = (end) => `translate(${((end[0] / GW) * 100).toFixed(2)}%, ${end[1].toFixed(1)}px)`;
function Crash({ c, mine, mv }) {
  const playing = c.status === 'playing';
  const refs = { mult: useRef(null), line: useRef(null), glow: useRef(null), area: useRef(null), rocket: useRef(null), cash: useRef(null) };
  const ended = useAppeared([c.status]);
  const justEnded = !playing && ended(c.status);
  const box = useRef(null);
  useCelebrate(box, c, mine && justEnded, 250);
  // Cash out tapped: the screen holds the multiplier you saw until the
  // server's answer (its clock decides the exact one).
  const live = useRef(1);
  const [frozen, setFrozen] = useState(null);
  const frozenRef = useRef(null);
  frozenRef.current = frozen;
  useEffect(() => {
    if (mv.pending !== 'cashout' && frozen != null && playing) setFrozen(null);
  }, [mv.pending]); // eslint-disable-line react-hooks/exhaustive-deps
  const draw = (ms, mult) => {
    const g = graph(ms, mult);
    refs.line.current?.setAttribute('d', g.line);
    refs.glow.current?.setAttribute('d', g.line);
    refs.area.current?.setAttribute('d', g.area);
    if (refs.rocket.current) refs.rocket.current.style.transform = at(g.end);
    if (refs.mult.current) refs.mult.current.textContent = `${mult.toFixed(2)}×`;
    if (refs.cash.current) refs.cash.current.textContent = String(Math.floor(c.bet * mult));
  };
  // Finished: the curve up to where it ended.
  const endAt = playing ? 1 : c.game.at || 1;
  const done = useMemo(() => (playing ? null : graph(crashTimeFor(Math.max(1.0001, endAt)), endAt)), [playing, endAt]);
  useLayoutEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => {
      if (frozenRef.current == null) {
        const ms = Math.max(0, serverNow() - c.game.startedAt);
        live.current = Math.max(1, crashMultiplier(ms));
        draw(ms, live.current);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    // The server decides when it crashed: ask now and then (the player more often).
    const t = setInterval(() => mv.peek(), mine ? 1000 : 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, [playing, mine, c.game.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const end = done?.end || [12, GH - 14];
  return (
    <div ref={box} className={`casino-crash ${c.status}${frozen != null ? ' holding' : ''}`}>
      <div className="crash-sky">
        <svg className="crash-graph" viewBox={`0 0 ${GW} ${GH}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="crash-grid" d={`M12 ${GH - 14}H${GW - 6}M12 ${GH - 14}V8M12 ${GH - 44}H${GW - 6}M12 ${GH - 74}H${GW - 6}M12 ${GH - 104}H${GW - 6}`} />
          <path ref={refs.area} className="crash-area" d={done?.area || ''} />
          <path ref={refs.glow} className="crash-glow" d={done?.line || ''} />
          <path ref={refs.line} className="crash-line" d={done?.line || ''} />
        </svg>
        <span ref={refs.rocket} className="crash-rocket" style={{ transform: at(end) }} aria-hidden="true">
          <span className="crash-dot">{c.status === 'crashed' ? <span className={`crash-burst${justEnded ? ' pop' : ''}`} /> : <Rocket />}</span>
        </span>
        <b className="crash-mult mono" ref={refs.mult} data-tick>
          {playing ? '1.00×' : `${c.game.at}×`}
        </b>
        {c.status === 'crashed' && <span className={`crash-tag${justEnded ? ' pop' : ''}`}>Crashed</span>}
        {c.status === 'cashed' && <span className={`crash-stamp${justEnded ? ' pop' : ''}`}>Banked</span>}
        <BigWin c={c} pop={justEnded} />
      </div>
      {playing && mine ? (
        <div className="cz-controls">
          <div className="cz-actions">
            <ActBtn
              mv={mv}
              move="cashout"
              primary
              className="big-btn"
              onTap={() => {
                frozenRef.current = live.current;
                setFrozen(live.current);
              }}
            >
              Cash out{' '}
              <span className="cz-amt">
                {/* updated each frame */}
                <span className="mono" ref={refs.cash} data-tick />
                <CoinMark />
              </span>
            </ActBtn>
          </div>
          <StatusLine
            mv={mv}
            busy={`Cashing out at ~${(frozen ?? live.current).toFixed(2)}×…`}
            hint="Cash out before it crashes. The server’s clock decides the moment."
          />
        </div>
      ) : playing ? (
        <div className="cz-controls cz-done">
          <span className="muted small">
            Bet <Amt n={c.bet} /> · flying…
          </span>
        </div>
      ) : (
        <div className="cz-controls cz-done">
          {c.status === 'crashed' && (
            <b>
              Crashed at <span className="mono">{c.game.at}×</span>
            </b>
          )}
          {c.status === 'cashed' && (
            <b>
              Cashed out at <span className="mono">{c.game.at}×</span>{' '}
              <span className="muted small">(it would have crashed at {c.game.point}×)</span>
            </b>
          )}
          <Outcome c={c} />
        </div>
      )}
    </div>
  );
}

function Mines({ c, mine, mv }) {
  const g = c.game;
  const playing = c.status === 'playing';
  const next = minesMultiplier(g.bombs, g.open.length + 1);
  const appeared = useAppeared([...g.open.map((i) => `o${i}`), ...(g.spots || []).map((i) => `b${i}`)]);
  const ended = useAppeared([c.status]);
  const justEnded = !playing && ended(c.status);
  const ref = useRef(null);
  useCelebrate(ref, c, mine && justEnded, 300);
  const tilePending = mv.pending != null && /^\d+$/.test(mv.pending);
  return (
    <div ref={ref} className={`casino-mines cz-live ${c.status}`}>
      <div className="cz-table">
        <div className="cz-stats small">
          <span title="Bombs">
            <Icon name="mine" size={16} /> <span className="mono">{g.bombs}</span>
          </span>
          <span title="Gems found">
            <Gem /> <span className="mono">{g.open.length}</span>
          </span>
          <span className="cz-chip mono">{g.multiplier}×</span>
          {playing && (
            <span className="muted">
              next <span className="mono">{next}×</span>
            </span>
          )}
        </div>
        <div className="mines-grid">
          {Array.from({ length: MINES_TILES }, (_, i) => {
            const open = g.open.includes(i);
            const bomb = g.spots?.includes(i);
            const pend = mv.pending === String(i);
            const kept = mv.queued.includes(String(i));
            const pop = open ? appeared(`o${i}`) : bomb && appeared(`b${i}`);
            return (
              <button
                type="button"
                key={i}
                className={`mine-tile${open ? ' open' : ''}${bomb ? ' bomb' : ''}${g.hit === i ? ' hit' : ''}${pend ? ' pending' : ''}${kept ? ' kept' : ''}${pop ? ' pop' : ''}`}
                disabled={!playing || !mine || open}
                aria-busy={pend ? 'true' : undefined}
                onClick={() => mv.send(String(i))}
                aria-label={open ? 'Safe' : bomb ? 'Bomb' : `Tile ${i + 1}`}
              >
                {open ? <Gem /> : bomb ? <Bomb hit={g.hit === i} /> : null}
                {open && pop && <span className="cz-sparkle" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <BigWin c={c} pop={justEnded} />
      </div>
      {playing && mine ? (
        <div className="cz-controls">
          <div className="cz-actions">
            {g.open.length > 0 ? (
              <ActBtn mv={mv} move="cashout" primary className="big-btn" disabled={tilePending}>
                Cash out <Amt n={Math.floor(c.bet * g.multiplier)} />
              </ActBtn>
            ) : (
              <span className="cz-hint">Tap a tile. Avoid the bombs.</span>
            )}
          </div>
          <StatusLine mv={mv} busy={tilePending ? 'Opening…' : 'Cashing out…'} hint={g.open.length ? 'Open another tile, or cash out.' : ''} />
        </div>
      ) : playing ? (
        <div className="cz-controls cz-done">
          <span className="muted small">
            Bet <Amt n={c.bet} /> · playing…
          </span>
        </div>
      ) : (
        <div className="cz-controls cz-done">
          <b>{c.status === 'boom' ? 'Boom.' : c.status === 'refunded' ? 'Left alone: bet back.' : `Cashed out at ${g.multiplier}×`}</b>
          <Outcome c={c} />
        </div>
      )}
    </div>
  );
}

// High-low has no suits; the cards get one each for looks.
const SUITS = ['♠', '♥', '♣', '♦'];
const suitAt = (k) => SUITS[k % 4];
function HighLow({ c, mine, mv }) {
  const g = c.game;
  const playing = c.status === 'playing';
  const appeared = useAppeared([`c${g.history.length}`]);
  const ended = useAppeared([c.status]);
  const justEnded = !playing && ended(c.status);
  const ref = useRef(null);
  useCelebrate(ref, c, mine && justEnded, 300);
  const right = g.history.filter((h) => h.right).length;
  const shown = g.history.slice(-6);
  const skip = g.history.length - shown.length;
  return (
    <div ref={ref} className={`casino-hl cz-live ${c.status}`}>
      <div className="cz-table">
        <div className="hl-row">
          <div className="hl-history">
            {shown.map((h, i) => (
              <span key={skip + i} className="hl-past" style={{ zIndex: i }}>
                <PlayingCard rank={HL_NAMES[h.from]} suit={suitAt(skip + i)} size="sm" />
                <span className={`hl-guess ${h.right ? 'right' : 'wrong'}`}>
                  <Icon name={h.guess === 'lower' ? 'chevronDown' : 'chevronUp'} size={12} />
                </span>
              </span>
            ))}
          </div>
          <PlayingCard
            key={g.history.length}
            rank={HL_NAMES[g.card]}
            suit={suitAt(g.history.length)}
            size="lg"
            deal={appeared(`c${g.history.length}`)}
            flip
            className={c.status === 'lost' ? 'wrong' : ''}
          />
        </div>
        <div className="cz-stats small">
          <span>
            Streak <span className="mono">{right}</span>
          </span>
          <span className="cz-chip mono">{g.multiplier}×</span>
        </div>
        <BigWin c={c} pop={justEnded} />
      </div>
      {playing && mine ? (
        <div className="cz-controls">
          <div className="cz-actions three">
            {['higher', 'lower'].map((guess) => (
              <ActBtn key={guess} mv={mv} move={guess} primary disabled={!hlChance(g.card, guess)}>
                <span className="cz-main">
                  <Icon name={guess === 'higher' ? 'chevronUp' : 'chevronDown'} size={16} />
                  {guess === 'higher' ? 'Higher' : 'Lower'}
                </span>
                <span className="cz-sub mono">{hlChance(g.card, guess) ? `${hlStep(g.card, guess)}×` : 'none'}</span>
              </ActBtn>
            ))}
            <ActBtn mv={mv} move="cashout" disabled={!g.history.length}>
              Cash out{' '}
              <span className="cz-sub">{g.history.length > 0 ? <Amt n={Math.floor(c.bet * g.multiplier)} /> : 'after a guess'}</span>
            </ActBtn>
          </div>
          <StatusLine mv={mv} busy={mv.pending === 'cashout' ? 'Cashing out…' : 'Drawing…'} hint="Will the next card be higher or lower?" />
        </div>
      ) : playing ? (
        <div className="cz-controls cz-done">
          <span className="muted small">
            Bet <Amt n={c.bet} /> · playing…
          </span>
        </div>
      ) : (
        <div className="cz-controls cz-done">
          <b>
            {c.status === 'lost'
              ? `Wrong: it was ${HL_NAMES[g.card]}.`
              : c.status === 'refunded'
                ? 'Left alone: bet back.'
                : `Cashed out at ${g.multiplier}×`}
          </b>
          <Outcome c={c} />
        </div>
      )}
    </div>
  );
}

function Ticket({ children, className = '' }) {
  return (
    <div className={`cz-ticket ${className}`}>
      <span className="cz-ticket-stub" aria-hidden="true">
        <Icon name="ticket" size={22} />
        <span className="mono">No. {String(new Date().getFullYear()).slice(2)}</span>
      </span>
      <div className="cz-ticket-body">{children}</div>
    </div>
  );
}
function Lottery({ m, c, me, onBuy }) {
  const lot = useContext(LotteryContext);
  const reveal = useFresh(m);
  // Only one lottery card is open at a time; the rest are closed. A card
  // posted a moment ago counts as open until the lottery doc catches up.
  const isOpen = lot?.open?.id === m.id;
  const tickets = isOpen ? lot.tickets || {} : null;
  const mine = tickets ? tickets[me] || 0 : c.mine || 0;
  const mv = useMove((k) => onBuy?.(k === 'buy5' ? 5 : 1), `${mine}/${isOpen ? lot.pot : c.pot}`);
  if (c.draw)
    return (
      <div className="casino-lottery cz-lottery">
        <Ticket className="draw">
          <div className="cz-label">Lottery draw</div>
          <div className="cz-scratch">
            <span className="cmd-big">{c.draw.winner} won the lottery!</span>
            <span className={`cz-scratch-foil${reveal ? ' go' : ' gone'}`} aria-hidden="true" />
          </div>
          <div className="small">
            <Amt n={c.draw.pot} /> pot · <span className="mono">{c.draw.tickets}</span> of <span className="mono">{c.draw.of}</span> tickets ·{' '}
            <span className="mono">{c.draw.people}</span> players
          </div>
        </Ticket>
      </div>
    );
  const young = !lot?.open && !c.closed && Date.now() - m.at < 60000;
  if (!isOpen && !young)
    return (
      <div className="casino-lottery cz-lottery closed">
        <Ticket className="closed">
          <div className="cz-label">Lottery · closed</div>
          <div className="cmd-big cz-big">
            Pot: <Amt n={c.pot || 0} />
          </div>
          {lot && (
            <div className="small muted">
              {c.closed
                ? c.winner
                  ? `${c.winner} won it.`
                  : 'Nobody bought a ticket.'
                : 'There’s a newer lottery card. Type /lottery to find it.'}
            </div>
          )}
        </Ticket>
      </div>
    );
  const people = tickets ? Object.keys(tickets).length : c.people || 0;
  const pot = isOpen ? lot.pot || 0 : c.pot || 0;
  const last = isOpen ? lot.last : c.last;
  const when = new Date(isOpen ? lot.drawAt : c.drawAt).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="casino-lottery cz-lottery cz-live">
      <Ticket>
        <div className="cz-label">The lottery · draw {when}</div>
        <div className="cmd-big cz-big">
          Pot: <Amt n={pot} />
        </div>
        <div className="small">
          {mine ? (
            <>
              <span className="mono">{mine}</span> ticket{mine > 1 ? 's' : ''} in
            </>
          ) : (
            'No tickets yet'
          )}{' '}
          · <span className="mono">{people}</span> player{people === 1 ? '' : 's'}
        </div>
        {last && (
          <div className="muted tiny">
            Last winner: {last.winner} · <Amt n={last.pot} />
          </div>
        )}
      </Ticket>
      {onBuy && (
        <div className="cz-controls">
          <div className="cz-actions">
            <ActBtn mv={mv} move="buy1">
              Buy 1{' '}
              <span className="cz-sub">
                <Amt n={5} />
              </span>
            </ActBtn>
            <ActBtn mv={mv} move="buy5" primary>
              Buy 5{' '}
              <span className="cz-sub">
                <Amt n={25} />
              </span>
            </ActBtn>
          </div>
          <StatusLine mv={mv} busy="Buying…" hint="Drawn Friday evening. One ticket wins the pot." />
        </div>
      )}
    </div>
  );
}

// ---------- economy ----------

function Econ({ icon, tone = '', title, art, children }) {
  return (
    <div className={`cz-econ ${tone}`}>
      {icon && (
        <span className="cz-econ-mark" aria-hidden="true">
          <Icon name={icon} size={92} />
        </span>
      )}
      {art || (
        <span className="cz-econ-icon" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
      )}
      <div className="cz-econ-body">
        <div className="cz-label">{title}</div>
        {children}
      </div>
    </div>
  );
}
const Plus = ({ n }) => (
  <div className="cmd-big cz-big">
    +<Amt n={n} />
  </div>
);
// /rob: the robber's picture, as a mugshot when caught.
function Mugshot({ name, caught }) {
  return (
    <span className={`cz-mug${caught ? ' caught' : ' away'}`} aria-hidden="true">
      <Avatar name={name} size={46} decoration="" />
      <span className="cz-mug-stamp">{caught ? 'Caught' : 'Got away'}</span>
    </span>
  );
}
function Podium({ top, Name }) {
  // 2nd, 1st, 3rd, like a real podium.
  const order = [top[1], top[0], top[2]].map((r, k) => r && { ...r, place: [2, 1, 3][k] });
  return (
    <div className="cz-podium">
      {order.map(
        (r) =>
          r && (
            <div key={r.name} className={`cz-step p${r.place}`}>
              <Avatar name={r.name} size={r.place === 1 ? 40 : 32} decoration="" />
              <span className="cz-step-name">
                <Name name={r.name} />
              </span>
              <b className="cz-step-coins">
                <Amt n={r.coins} />
              </b>
              <span className="cz-step-block mono">{r.place}</span>
            </div>
          ),
      )}
    </div>
  );
}

function Economy({ c, by, Name }) {
  switch (c.name) {
    case 'daily':
      return (
        <Econ icon="flame" tone="gold" title="Daily coins">
          <Plus n={c.amount} />
          <div className="cz-streak">
            Daily coins · streak <b className="mono">{c.streak}</b>
            <span className="cz-week" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <i key={i} className={i < Math.min(c.streak, 7) ? 'on' : ''} />
              ))}
            </span>
          </div>
          <div className="muted tiny">
            {c.limit
              ? `Daily limit reached: /daily and game prizes pay up to ${c.limit} coins a day together. Your streak still counts.`
              : `Come back tomorrow for up to ${Math.min(dailyAmount(c.streak + 1), AWARD_CAPS.game)}. It shares the ${AWARD_CAPS.game}-a-day limit with game prizes.`}
          </div>
        </Econ>
      );
    case 'work':
      return (
        <Econ icon="wrench" tone="blue" title="Work">
          <Plus n={c.amount} />
          <div>
            You {c.job}. <span className="muted">{c.joke}</span>
          </div>
        </Econ>
      );
    case 'beg':
      return c.amount ? (
        <Econ icon="hand" tone="green" title="Begging">
          <Plus n={c.amount} />
          <div>
            {c.who[0].toUpperCase() + c.who.slice(1)} {c.verb} {c.amount} coin{c.amount > 1 ? 's' : ''}. <span className="muted">{c.joke}</span>
          </div>
        </Econ>
      ) : (
        <Econ icon="hand" tone="muted" title="Begging">
          <div className="cmd-big cz-big">Nothing.</div>
          <div className="muted">{c.rude}</div>
        </Econ>
      );
    case 'rob':
      return c.ok ? (
        <Econ tone="gold" title="Robbery" art={<Mugshot name={by} />}>
          <div className="cmd-big cz-big">
            Got away with <Amt n={c.amount} />
          </div>
          <div>
            <Name name={by} /> robbed <Name name={c.to} />!
          </div>
        </Econ>
      ) : (
        <Econ tone="red" title="Robbery" art={<Mugshot name={by} caught />}>
          <div className="cmd-big cz-big">Caught!</div>
          <div>
            <Name name={by} /> tried to rob <Name name={c.to} /> and paid them a <Amt n={c.amount} /> fine.
          </div>
        </Econ>
      );
    case 'give':
      return (
        <Econ icon="gift" tone="green" title="Gift">
          <div className="cmd-big cz-big">
            <Amt n={c.amount} />
          </div>
          <div>
            <Name name={by} /> sent <Name name={c.to} /> <b>{c.amount}</b> coin{c.amount === 1 ? '' : 's'}
          </div>
        </Econ>
      );
    case 'balance':
      return (
        <div className="cmd-whois cz-balance cz-econ blue">
          <Avatar name={c.to} size={48} />
          <div className="cz-econ-body">
            <Name name={c.to} />
            <div className="cmd-big cz-big">
              <Amt n={c.balance} />
            </div>
            <div className="cmd-stats">
              <span className="cz-pill">
                <b className="mono">{c.earned}</b> earned
              </span>
              <span className="cz-pill">
                <b className={`mono ${c.casino > 0 ? 'cz-up' : c.casino < 0 ? 'cz-down' : ''}`}>
                  {c.casino >= 0 ? '+' : ''}
                  {c.casino}
                </b>{' '}
                casino &amp; economy
              </span>
              {c.played > 0 && (
                <span className="cz-pill">
                  <b className="mono">{c.played}</b> games · best win <b className="mono">{c.best}</b>
                </span>
              )}
            </div>
          </div>
        </div>
      );
    case 'leaderboard':
      return (
        <div className="cz-leaderboard">
          <Podium top={c.top.slice(0, 3)} Name={Name} />
          {c.top.length > 3 && (
            <ol className="cmd-leaders" start={4}>
              {c.top.slice(3).map((r, i) => (
                <li key={r.name}>
                  <span className="cmd-medal mono">{i + 4}</span>
                  <Avatar name={r.name} size={22} />
                  <Name name={r.name} />
                  <span className="grow" />
                  <b>
                    <Amt n={r.coins} />
                  </b>
                </li>
              ))}
            </ol>
          )}
        </div>
      );
    default:
      return null;
  }
}

export const CASINO_CARDS = ['slots', 'dice', 'coinflip', 'roulette', 'blackjack', 'crash', 'mines', 'highlow', 'lottery'];
export const ECONOMY_CARDS = ['daily', 'work', 'beg', 'rob', 'give', 'balance', 'leaderboard'];
const LIVE = ['blackjack', 'crash', 'mines', 'highlow'];

export function CasinoBody({ m, me, Name, onMove, onBuy }) {
  const c = m.cmd;
  const mine = m.by === me;
  useEffect(ensureCasinoDefs, []);
  // What changes when the server moves the game: a new one means the move is in.
  const version = LIVE.includes(c.name) ? `${c.status}|${c.bet}|${JSON.stringify(c.game)}` : '';
  const mv = useMove(onMove, version, {
    // Mines: another tile tapped while one is opening is kept and opened next.
    canQueue: (move) => c.name === 'mines' && /^\d+$/.test(move),
    stillOk: (move) => c.status === 'playing' && !c.game.open?.includes(+move),
  });
  // A crash just started: wake the play function now, so Cash out doesn't
  // wait for it to start up.
  useEffect(() => {
    if (c.name === 'crash' && c.status === 'playing' && mine && fresh(m)) mv.peek('warm');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (ECONOMY_CARDS.includes(c.name)) return <Economy c={c} by={m.by} Name={Name} />;
  const props = { m, c, mine, mv };
  const body = {
    slots: <Slots {...props} />,
    dice: <Dice {...props} />,
    coinflip: <Coinflip {...props} />,
    roulette: <Roulette {...props} />,
    blackjack: <Blackjack {...props} />,
    crash: <Crash {...props} />,
    mines: <Mines {...props} />,
    highlow: <HighLow {...props} />,
    lottery: <Lottery m={m} c={c} me={me} onBuy={onBuy} />,
  }[c.name];
  // casino-live: the card takes the next tap as soon as its new state shows.
  return <div className={`cz-body cz-${c.name}${LIVE.includes(c.name) ? ' casino-live' : ''}`}>{body}</div>;
}
