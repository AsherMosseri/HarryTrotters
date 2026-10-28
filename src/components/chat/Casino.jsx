import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Avatar } from '../common.jsx';
import { HL_NAMES, MINES_TILES, crashMultiplier, handValue, hlChance, hlStep, minesMultiplier } from '../../../functions/shared/casino.js';
import { serverNow } from '../../serverTime.js';
import { Die } from './Die.jsx';

// The Jackson coins economy and casino cards (the play function rolls; these
// show it). Live games (blackjack, crash, mines, high-low) have buttons for
// the person playing; onMove(move) sends it to the server.

const coins = (n) => `${n} 🪙`;
// The lottery doc (pot, tickets, draw time, and which card is open), live.
export const LotteryContext = createContext(null);
// Animate only when it just happened (not when scrolling back through chat).
const fresh = (m) => serverNow() - m.at < 8000;

function Outcome({ c }) {
  if (c.status === 'playing') return <div className="muted small">Bet {coins(c.bet)} · playing…</div>;
  const net = c.net ?? 0;
  return (
    <div className={`casino-outcome ${net > 0 ? 'win' : net < 0 ? 'lose' : 'push'}`}>
      {net > 0 ? `Won ${coins(net)}` : net < 0 ? `Lost ${coins(-net)}` : `Push: bet back`}
      <span className="muted small"> · bet {c.bet}</span>
    </div>
  );
}

function Slots({ m, c }) {
  const spin = fresh(m);
  return (
    <div className="casino-slots">
      <div className="slot-reels">
        {c.game.reels.map((r, i) => (
          <div key={i} className="slot-reel">
            <div className={`slot-strip${spin ? ' spin' : ''}`} style={{ '--i': i }}>
              {spin && ['🔩', '⚙️', '🔋', '🔧', '🤖', '🏆', '💎', '⚙️'].map((x, j) => <span key={j}>{x}</span>)}
              <span>{r}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={spin ? 'casino-reveal' : ''}>
        <b>{c.game.line}</b> <Outcome c={c} />
      </div>
    </div>
  );
}

function Dice({ c }) {
  const a = c.game.you[0] + c.game.you[1];
  const b = c.game.house[0] + c.game.house[1];
  return (
    <div className="casino-dice">
      <div className="casino-vs">
        <div>
          <div className="muted tiny">You</div>
          <div className="dice-row">
            <Die n={c.game.you[0]} i={0} />
            <Die n={c.game.you[1]} i={1} />
            <b className="cmd-total">{a}</b>
          </div>
        </div>
        <div>
          <div className="muted tiny">House 🤖</div>
          <div className="dice-row">
            <Die n={c.game.house[0]} i={0} />
            <Die n={c.game.house[1]} i={1} />
            <b className="cmd-total">{b}</b>
          </div>
        </div>
      </div>
      <Outcome c={c} />
    </div>
  );
}

function Coinflip({ m, c }) {
  return (
    <div className="cmd-flip">
      <span className={`cmd-coin ${c.game.side}${fresh(m) ? '' : ' still'}`} aria-hidden="true">
        🪙
      </span>
      <div>
        You called <b>{c.game.call}</b>. {c.game.side === 'edge' ? 'It landed on its EDGE. The house wins.' : `It’s ${c.game.side}.`}
        <Outcome c={c} />
      </div>
    </div>
  );
}

function Roulette({ m, c }) {
  return (
    <div className="casino-roulette">
      <span className={`roulette-wheel${fresh(m) ? ' spin' : ''}`} aria-hidden="true">
        🎡
      </span>
      <span className={`roulette-ball ${c.game.color}`}>{c.game.n}</span>
      <div>
        You bet on <b>{c.game.spot}</b>. <Outcome c={c} />
      </div>
    </div>
  );
}

const Card = ({ card, hidden }) =>
  hidden ? (
    <span className="pcard back" aria-label="Face-down card">
      🂠
    </span>
  ) : (
    <span className={`pcard${/[♥♦]/.test(card) ? ' red' : ''}`}>{card}</span>
  );

function Blackjack({ c, mine, act }) {
  const g = c.game;
  const playing = c.status === 'playing';
  const label = { blackjack: 'Blackjack! Pays 3:2', bust: 'Bust.', won: 'You win.', lost: 'Dealer wins.', push: 'Push.' }[c.status];
  return (
    <div className="casino-bj">
      <div className="bj-hand">
        <span className="muted tiny">Dealer {playing ? '' : `· ${handValue(g.dealer)}`}</span>
        <div>
          {g.dealer.map((x, i) => (
            <Card key={i} card={x} />
          ))}
          {playing && <Card hidden />}
        </div>
      </div>
      <div className="bj-hand">
        <span className="muted tiny">
          {mine ? 'You' : 'Player'} · {handValue(g.you)}
          {g.doubled ? ' · doubled' : ''}
        </span>
        <div>
          {g.you.map((x, i) => (
            <Card key={i} card={x} />
          ))}
        </div>
      </div>
      {playing && mine ? (
        <div className="casino-buttons">
          <button className="btn primary" onClick={() => act('hit')}>
            Hit
          </button>
          <button className="btn" onClick={() => act('stand')}>
            Stand
          </button>
          {g.you.length === 2 && (
            <button className="btn" onClick={() => act('double')}>
              Double ({coins(c.bet)})
            </button>
          )}
        </div>
      ) : (
        <>
          {label && <b>{label}</b>}
          <Outcome c={c} />
        </>
      )}
    </div>
  );
}

function Crash({ c, mine, act }) {
  const [now, setNow] = useState(serverNow());
  const playing = c.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => {
      setNow(serverNow());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // The server decides when it crashed: ask now and then (the player more often).
    const t = setInterval(() => act('peek', true), mine ? 1000 : 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, [playing, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = playing ? Math.max(1, crashMultiplier(now - c.game.startedAt)) : c.game.at;
  const height = Math.min(100, Math.log(m) * 40);
  return (
    <div className={`casino-crash ${c.status}`}>
      <div className="crash-sky">
        <span className="crash-rocket" style={{ bottom: `${height}%`, left: `${Math.min(85, height * 0.85)}%` }} aria-hidden="true">
          {c.status === 'crashed' ? '💥' : '🚀'}
        </span>
        <b className="crash-mult">{m.toFixed(2)}×</b>
      </div>
      {playing && mine && (
        <button className="btn primary big-btn" onClick={() => act('cashout')}>
          Cash out {coins(Math.floor(c.bet * m))}
        </button>
      )}
      {playing && !mine && <div className="muted small">Bet {coins(c.bet)} · flying…</div>}
      {c.status === 'crashed' && <b>💥 Crashed at {c.game.at}×</b>}
      {c.status === 'cashed' && (
        <b>
          Cashed out at {c.game.at}× <span className="muted small">(it would have crashed at {c.game.point}×)</span>
        </b>
      )}
      {!playing && <Outcome c={c} />}
    </div>
  );
}

function Mines({ c, mine, act }) {
  const g = c.game;
  const playing = c.status === 'playing';
  const next = minesMultiplier(g.bombs, g.open.length + 1);
  return (
    <div className="casino-mines">
      <div className="muted small">
        {g.bombs} bomb{g.bombs > 1 ? 's' : ''} · {g.open.length} open · {g.multiplier}×{playing ? ` · next ${next}×` : ''}
      </div>
      <div className="mines-grid">
        {Array.from({ length: MINES_TILES }, (_, i) => {
          const open = g.open.includes(i);
          const bomb = g.spots?.includes(i);
          return (
            <button
              key={i}
              className={`mine-tile${open ? ' open' : ''}${bomb ? ' bomb' : ''}${g.hit === i ? ' hit' : ''}`}
              disabled={!playing || !mine || open}
              onClick={() => act(String(i))}
              aria-label={open ? 'Safe' : bomb ? 'Bomb' : `Tile ${i + 1}`}
            >
              {open ? '💎' : bomb ? (g.hit === i ? '💥' : '💣') : ''}
            </button>
          );
        })}
      </div>
      {playing && mine && g.open.length > 0 && (
        <button className="btn primary big-btn" onClick={() => act('cashout')}>
          Cash out {coins(Math.floor(c.bet * g.multiplier))}
        </button>
      )}
      {playing && mine && !g.open.length && <div className="muted small">Tap a tile. Avoid the bombs.</div>}
      {!playing && (
        <>
          <b>{c.status === 'boom' ? '💥 Boom.' : `Cashed out at ${g.multiplier}×`}</b>
          <Outcome c={c} />
        </>
      )}
    </div>
  );
}

function HighLow({ c, mine, act }) {
  const g = c.game;
  const playing = c.status === 'playing';
  return (
    <div className="casino-hl">
      <div className="hl-row">
        {g.history.map((h, i) => (
          <span key={i} className={`pcard small${h.right ? '' : ' wrong'}`}>
            {HL_NAMES[h.from]}
          </span>
        ))}
        <span className="pcard big">{HL_NAMES[g.card]}</span>
      </div>
      <div className="muted small">
        Streak {g.history.filter((h) => h.right).length} · {g.multiplier}×
      </div>
      {playing && mine ? (
        <div className="casino-buttons">
          {['higher', 'lower'].map((guess) => (
            <button key={guess} className="btn primary" disabled={!hlChance(g.card, guess)} onClick={() => act(guess)}>
              {guess === 'higher' ? '⬆ Higher' : '⬇ Lower'}
              {hlChance(g.card, guess) ? ` (${hlStep(g.card, guess)}×)` : ''}
            </button>
          ))}
          {g.history.length > 0 && (
            <button className="btn" onClick={() => act('cashout')}>
              Cash out {coins(Math.floor(c.bet * g.multiplier))}
            </button>
          )}
        </div>
      ) : (
        <>
          {!playing && <b>{c.status === 'lost' ? `Wrong: it was ${HL_NAMES[g.card]}.` : `Cashed out at ${g.multiplier}×`}</b>}
          <Outcome c={c} />
        </>
      )}
    </div>
  );
}

function Lottery({ m, c, me, onBuy }) {
  const lot = useContext(LotteryContext);
  const [error, setError] = useState('');
  if (c.draw)
    return (
      <div className="casino-lottery">
        <div className="cmd-big">🎟️ {c.draw.winner} won the lottery!</div>
        <div>
          <b>{coins(c.draw.pot)}</b> pot · {c.draw.tickets} of {c.draw.of} tickets · {c.draw.people} players
        </div>
      </div>
    );
  // Only one lottery card is open at a time; the rest are closed. A card
  // posted a moment ago counts as open until the lottery doc catches up.
  const isOpen = lot?.open?.id === m.id;
  const fresh = !lot?.open && !c.closed && Date.now() - m.at < 60000;
  if (!isOpen && !fresh)
    return (
      <div className="casino-lottery closed">
        <div>🎟️ Lottery · closed</div>
        <div className="cmd-big">Pot: {coins(c.pot || 0)}</div>
        {lot && (
          <div className="small muted">
            {c.closed
              ? c.winner
                ? `${c.winner} won it.`
                : 'Nobody bought a ticket.'
              : 'There’s a newer lottery card. Type /lottery to find it.'}
          </div>
        )}
      </div>
    );
  const tickets = isOpen ? lot.tickets || {} : null;
  const mine = tickets ? tickets[me] || 0 : c.mine || 0;
  const people = tickets ? Object.keys(tickets).length : c.people || 0;
  const pot = isOpen ? lot.pot || 0 : c.pot || 0;
  const last = isOpen ? lot.last : c.last;
  const when = new Date(isOpen ? lot.drawAt : c.drawAt).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  const buy = async (n) => {
    const r = await onBuy(n);
    setError(r?.ok ? '' : r?.note?.title || '');
  };
  return (
    <div className="casino-lottery">
      <div>🎟️ The lottery</div>
      <div className="cmd-big">Pot: {coins(pot)}</div>
      <div className="small">
        {mine ? `${mine} ticket${mine > 1 ? 's' : ''} in` : 'No tickets yet'} · {people} player{people === 1 ? '' : 's'} · draw {when}
      </div>
      {last && (
        <div className="muted tiny">
          Last winner: {last.winner} ({coins(last.pot)})
        </div>
      )}
      {onBuy && (
        <div className="casino-buttons">
          <button className="btn" onClick={() => buy(1)}>
            Buy 1 (5 🪙)
          </button>
          <button className="btn" onClick={() => buy(5)}>
            Buy 5 (25 🪙)
          </button>
        </div>
      )}
      {error && <div className="casino-error">{error}</div>}
    </div>
  );
}

// ---------- economy ----------

function Economy({ c, by, Name }) {
  switch (c.name) {
    case 'daily':
      return (
        <div>
          <div className="cmd-big">📅 +{coins(c.amount)}</div>
          <div>
            Daily coins · streak <b>{c.streak}</b> {'🔥'.repeat(Math.min(c.streak, 7))}
          </div>
          <div className="muted tiny">Come back tomorrow for {Math.min(15 + 3 * c.streak, 45)}.</div>
        </div>
      );
    case 'work':
      return (
        <div>
          <div className="cmd-big">
            {c.icon} +{coins(c.amount)}
          </div>
          <div>
            You {c.job}. <span className="muted">{c.joke}</span>
          </div>
        </div>
      );
    case 'beg':
      return c.amount ? (
        <div>
          <div className="cmd-big">🥺 +{coins(c.amount)}</div>
          <div>
            {c.who[0].toUpperCase() + c.who.slice(1)} {c.verb} {c.amount} coin{c.amount > 1 ? 's' : ''}.{' '}
            <span className="muted">{c.joke}</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="cmd-big">🥺 Nothing.</div>
          <div className="muted">{c.rude}</div>
        </div>
      );
    case 'rob':
      return c.ok ? (
        <div>
          <div className="cmd-big">🦹 Got away with {coins(c.amount)}</div>
          <div>
            <Name name={by} /> robbed <Name name={c.to} />!
          </div>
        </div>
      ) : (
        <div>
          <div className="cmd-big">🚓 Caught!</div>
          <div>
            <Name name={by} /> tried to rob <Name name={c.to} /> and paid them a {coins(c.amount)} fine.
          </div>
        </div>
      );
    case 'give':
      return (
        <div>
          🎁 <Name name={by} /> sent <Name name={c.to} /> <b>{coins(c.amount)}</b>
        </div>
      );
    case 'balance':
      return (
        <div className="cmd-whois">
          <Avatar name={c.to} size={44} />
          <div>
            <Name name={c.to} />
            <div className="cmd-big">{coins(c.balance)}</div>
            <div className="cmd-stats">
              <span>
                <b>{c.earned}</b> earned
              </span>
              <span>
                <b>
                  {c.casino >= 0 ? '+' : ''}
                  {c.casino}
                </b>{' '}
                casino &amp; economy
              </span>
              {c.played > 0 && (
                <span>
                  <b>{c.played}</b> games · best win <b>{c.best}</b>
                </span>
              )}
            </div>
          </div>
        </div>
      );
    case 'leaderboard':
      return (
        <ol className="cmd-leaders">
          {c.top.map((r, i) => (
            <li key={r.name}>
              <span className="cmd-medal">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
              <Avatar name={r.name} size={22} />
              <Name name={r.name} />
              <span className="grow" />
              <b>{coins(r.coins)}</b>
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

export const CASINO_CARDS = ['slots', 'dice', 'coinflip', 'roulette', 'blackjack', 'crash', 'mines', 'highlow', 'lottery'];
export const ECONOMY_CARDS = ['daily', 'work', 'beg', 'rob', 'give', 'balance', 'leaderboard'];

export function CasinoBody({ m, me, Name, onMove, onBuy }) {
  const c = m.cmd;
  const mine = m.by === me;
  const [error, setError] = useState('');
  const busy = useRef(false);
  const act = async (move, quiet) => {
    if (busy.current && !quiet) return;
    busy.current = !quiet;
    try {
      const r = await onMove(move);
      if (r?.note && !quiet) setError(r.note.title);
      else if (!quiet) setError('');
    } finally {
      if (!quiet) busy.current = false;
    }
  };
  if (ECONOMY_CARDS.includes(c.name)) return <Economy c={c} by={m.by} Name={Name} />;
  const body = {
    slots: <Slots m={m} c={c} />,
    dice: <Dice c={c} />,
    coinflip: <Coinflip m={m} c={c} />,
    roulette: <Roulette m={m} c={c} />,
    blackjack: <Blackjack c={c} mine={mine} act={act} />,
    crash: <Crash c={c} mine={mine} act={act} />,
    mines: <Mines c={c} mine={mine} act={act} />,
    highlow: <HighLow c={c} mine={mine} act={act} />,
    lottery: <Lottery m={m} c={c} me={me} onBuy={onBuy} />,
  }[c.name];
  return (
    <>
      {body}
      {error && <div className="casino-error">{error}</div>}
    </>
  );
}
