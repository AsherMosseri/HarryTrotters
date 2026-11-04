import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../common.jsx';
import { BOT, C4_COLS, C4_ROWS, RACES, RPS, TIMES, isLive } from '../../../functions/shared/arcade.js';
import { AWARD_CAPS } from '../../../functions/shared/coins.js';
import { serverNow } from '../../serverTime.js';
import { FunShare, RaceCard } from './FunCards.jsx';
import { BattleshipCard, BattleshipView } from './Battleship.jsx';
import { VIEW_GAMES, noteCard, openGameView, useFreshCmd } from './liveGames.js';
import { Icon } from '../shell/icons.jsx';
import { Die } from './Die.jsx';
import { ActBtn, Amt } from './Casino.jsx';
import { useCoinFormat } from '../CoinNum.jsx';
import { exactCoins } from '../../coinFormat.js';
import { FlipCoin, ensureCasinoDefs } from './casinoArt.jsx';
import { useMove } from './useMove.js';
import { KINDS } from '../../../functions/shared/challenge.js';

// Multiplayer game cards in #arcade (the play function runs the games; see
// functions/shared/arcade.js). Buttons send moves; timers ask the server to
// move things along ("peek") when a countdown runs out.

export const ARCADE_CARDS = ['rps', 'tictactoe', 'connect4', 'duel', 'trivia', 'hangman', 'typerace', 'heist', 'battleship', 'tetris', 'minesweep', 'challenge'];
const coins = (n) => <Amt n={n} />;

// Prizes the daily game limit cut short (the server puts what it paid in g.paid).
function LimitLine({ g, me }) {
  const f = useCoinFormat();
  const cut = Object.entries(g.paid || {});
  if (!cut.length) return null;
  const who = cut.map(([n, k]) => `${n === me ? 'you' : n.split(' ')[0]} got ${f.n(k)}`).join(' · ');
  return (
    <div className="muted tiny">
      Daily limit reached ({who}): game prizes and /daily pay up to {f.n(AWARD_CAPS.game)} coins a day.
    </div>
  );
}
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
const clock = (ms) => {
  const s = secs(ms);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};

// The server's clock, ticking every `every` ms while on.
function useNow(on, every = 250) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    if (!on) return;
    setNow(serverNow());
    const t = setInterval(() => setNow(serverNow()), every);
    return () => clearInterval(t);
  }, [on, every]);
  return now;
}

// Ask the server to settle things once `at` has passed (a little jitter so
// everyone watching doesn't ask at the same instant).
function usePeekAt(at, live, act) {
  useEffect(() => {
    if (!live || !at) return;
    const t = setTimeout(() => act('peek', true), Math.max(0, at - serverNow()) + 150 + Math.random() * 350);
    return () => clearTimeout(t);
  }, [at, live]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const Who = ({ name, Name }) =>
  name === BOT ? (
    <b className="arc-bot">🤖 Trotbot</b>
  ) : (
    <span className="arc-who">
      <Avatar name={name} size={20} />
      <Name name={name} />
    </span>
  );

// ---------- challenges ----------

// The bet, for everyone to see (players and anyone watching): what each one
// put in, and what the winner takes. A game with no bet says so.
export function BetPill({ each, pot, people = 'each' }) {
  if (!(each > 0))
    return (
      <span className="cz-betpill arc-betpill none">
        <span className="cz-betpill-k">No bet</span>
      </span>
    );
  return (
    <span className="cz-betpill arc-betpill" title={`${exactCoins(each)} Jackson coins ${people}, ${exactCoins(pot)} in the pot`}>
      <span className="cz-betpill-k">Bet</span> <Amt n={each} /> {people} <span className="cz-betpill-k">· pot</span> <Amt n={pot} />
    </span>
  );
}

export function Versus({ g, Name, marks }) {
  return (
    <div className="arc-vs">
      <span className={g.turn === g.a && isLive(g.status) ? 'turn' : ''}>
        {marks?.[0]} <Who name={g.a} Name={Name} />
      </span>
      <span className="muted">vs</span>
      <span className={g.turn === g.b && isLive(g.status) ? 'turn' : ''}>
        {marks?.[1]} <Who name={g.b} Name={Name} />
      </span>
      <BetPill each={g.bet} pot={2 * g.bet} />
    </div>
  );
}

// Waiting for the other person: accept / decline / cancel.
export function Invite({ g, me, act, game, now, mv: given }) {
  const left = g.expiresAt - now;
  const mv = given || { pending: null, send: act };
  if (me === g.b && game !== 'rps')
    return (
      <div className="cz-actions">
        <ActBtn mv={mv} move="accept" primary>
          Accept
          {g.bet ? (
            <span className="cz-sub">
              <Amt n={g.bet} />
            </span>
          ) : null}
        </ActBtn>
        <ActBtn mv={mv} move="decline">
          Decline
        </ActBtn>
      </div>
    );
  return (
    <div className="arc-wait">
      <span className="muted small">
        {me === g.b ? 'Pick to accept' : `Waiting for ${g.b.split(' ')[0]} to accept`} · {clock(left)} left
      </span>
      {me === g.a && <LinkAct mv={mv} move="cancel" label="Cancel" busy="Cancelling…" />}
      {me === g.b && <LinkAct mv={mv} move="decline" label="Decline" busy="Declining…" />}
    </div>
  );
}

// A small text button that shows its move is on the way.
function LinkAct({ mv, move, label, busy }) {
  const on = mv.pending === move;
  return (
    <button
      type="button"
      className={`link-btn small${on ? ' is-pending' : ''}`}
      aria-busy={on ? 'true' : undefined}
      disabled={mv.pending != null && !on}
      onClick={() => mv.send(move)}
    >
      {on ? busy : label}
    </button>
  );
}

export function Result({ g, Name }) {
  if (isLive(g.status)) return null;
  const pot = g.bet ? (
    <>
      {' '}
      · <Amt n={g.bet * 2} />
    </>
  ) : null;
  const text = {
    declined: `${g.b.split(' ')[0]} declined.`,
    cancelled: 'Cancelled.',
    expired: 'Nobody accepted in time.',
    nobody: 'Nobody shot. Bets back.',
    nopick: 'Nobody picked in time. Bets back.',
  }[g.how];
  if (text) return <div className="muted small arc-result">{text}</div>;
  if (!g.winner) return <div className="arc-result push">🤝 Tie{g.bet ? ': bets back' : ''}</div>;
  return (
    <div className="arc-result win">
      🏆 <Who name={g.winner} Name={Name} /> wins{pot}
      {g.how === 'resigned' && <span className="muted small"> (the other player resigned)</span>}
      {g.how === 'timeout' && <span className="muted small"> (the other player ran out of time)</span>}
    </div>
  );
}

// /challenge: the same coin flip or dice roll for the same bet, head to head.
// The server rolls both when the other person accepts.
function Challenge({ g, me, act, Name, now, mv }) {
  const kind = KINDS[g.kind] || KINDS.coinflip;
  // The roll animates only if it happened while the card was on screen.
  const [wasLive] = useState(() => isLive(g.status));
  const total = (d) => (d || []).reduce((t, x) => t + x, 0);
  const rolled = g.status === 'done' && g.how === 'rolled';
  const clash = rolled && wasLive;
  const side = (n, k) => {
    const d = rolled && g.kind === 'dice' ? g.rolls[k ? 'b' : 'a'] : null;
    const calls = g.kind === 'coinflip' ? (k ? (g.call === 'heads' ? 'tails' : 'heads') : g.call) : null;
    return (
      <div key={n} className={`ch-side ${k ? 'b' : 'a'}${rolled && g.winner === n ? ' ch-won' : ''}${rolled && g.winner && g.winner !== n ? ' ch-lost' : ''}`}>
        <Avatar name={n} size={40} decoration="" />
        <span className="ch-name">{n === BOT ? 'Trotbot' : n.split(' ')[0]}</span>
        {calls && <span className="cz-label">{calls}</span>}
        {d && (
          <span className="dice-row">
            <Die n={d[0]} i={k * 2} roll={wasLive} />
            <Die n={d[1]} i={k * 2 + 1} roll={wasLive} />
            <b className="cz-total mono">{total(d)}</b>
          </span>
        )}
      </div>
    );
  };
  return (
    <div className="arc-challenge">
      <div className={`cz-table ch-table${clash ? ' clash' : ''}`}>
        {side(g.a, 0)}
        <span className="ch-vs">
          <span className="cz-vs-badge">vs</span>
          {g.bet > 0 && (
            <span className="cz-chip">
              <Amt n={g.bet} /> each · pot <Amt n={2 * g.bet} />
            </span>
          )}
          {rolled && g.kind === 'coinflip' && <FlipCoin side={g.flip} spin={wasLive} />}
        </span>
        {side(g.b, 1)}
      </div>
      <div className="muted small">
        {kind.label} ·{' '}
        {g.kind === 'coinflip'
          ? `${g.a.split(' ')[0]} calls ${g.call}, ${g.b.split(' ')[0]} gets ${g.call === 'heads' ? 'tails' : 'heads'}`
          : 'higher roll wins, ties roll again'}
        {rolled && g.kind === 'coinflip' && (
          <>
            {' '}
            · It’s <b>{g.flip}</b>.
          </>
        )}
      </div>
      {isLive(g.status) && <Invite g={g} me={me} act={act} game="challenge" now={now} mv={mv} />}
      {rolled && g.rerolls > 0 && <div className="muted tiny">Tied {g.rerolls === 1 ? 'once' : `${g.rerolls} times`}, so they rolled again.</div>}
      <Result g={g} Name={Name} />
    </div>
  );
}

function Rps({ g, me, act, Name, now }) {
  const player = me === g.a || me === g.b;
  const picked = (g.picked || []).includes(me);
  const canPick = isLive(g.status) && player && !picked;
  // Picks close TIMES.turn after the last one (the server settles it then).
  const closesAt = g.status === 'playing' ? (g.lastAt || 0) + TIMES.turn : 0;
  return (
    <div className="arc-rps">
      <Versus g={g} Name={Name} />
      {g.status === 'done' && g.picks ? (
        <div className="rps-reveal">
          <span className={g.winner === g.a ? 'won' : ''}>{RPS[g.picks[g.a]]}</span>
          <span className="muted">vs</span>
          <span className={g.winner === g.b ? 'won' : ''}>{RPS[g.picks[g.b]]}</span>
        </div>
      ) : (
        isLive(g.status) && (
          <div className="arc-status small">
            {[g.a, g.b].map((n) => (
              <span key={n}>
                {(g.picked || []).includes(n) ? '✅' : '🤔'} {n === me ? 'You' : n.split(' ')[0]}
              </span>
            ))}
          </div>
        )
      )}
      {canPick && (
        <div className="casino-buttons rps-picks">
          {Object.entries(RPS).map(([k, e]) => (
            <button key={k} className="btn" onClick={() => act(k)} aria-label={k}>
              <span className="rps-emoji">{e}</span> {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      )}
      {picked && isLive(g.status) && <div className="muted small">You picked. Waiting… (picks close in {clock(closesAt - now)})</div>}
      {g.status === 'open' && <Invite g={g} me={me} act={act} game="rps" now={now} />}
      <Result g={g} Name={Name} />
    </div>
  );
}

export function TurnBar({ g, me, act, now, onOpen }) {
  if (g.status !== 'playing') return null;
  const player = me === g.a || me === g.b;
  const late = now - g.lastAt > TIMES.turn;
  return (
    <div className="arc-wait">
      {onOpen && (
        <button type="button" className="btn small game-open" onClick={onOpen}>
          <Icon name={player ? 'expand' : 'eye'} size={16} /> {player ? 'Open' : 'Watch'}
        </button>
      )}
      <span className="small">
        {g.turn === me ? <b>Your turn</b> : `${g.turn === BOT ? 'Trotbot' : g.turn.split(' ')[0]}’s turn`}
        {!late && <span className="muted"> · {clock(g.lastAt + TIMES.turn - now)}</span>}
      </span>
      {player && g.turn !== me && late && (
        <button className="btn small" onClick={() => act('claim')}>
          Claim the win
        </button>
      )}
      {player && (
        <button className="link-btn small" onClick={() => act('resign')}>
          Resign
        </button>
      )}
    </div>
  );
}

function TicTacToe({ g, me, act, Name, now, view, onOpen }) {
  const myTurn = g.status === 'playing' && g.turn === me;
  return (
    <div className={`arc-ttt${view ? ' in-view' : ''}`}>
      <Versus g={g} Name={Name} marks={['❌', '⭕']} />
      <div className="ttt-grid">
        {[...g.board].map((c, i) => (
          <button
            key={i}
            className={`ttt-cell${g.line?.includes(i) ? ' line' : ''}${g.last === i ? ' last' : ''}`}
            disabled={!myTurn || c !== '.'}
            onClick={() => act(String(i))}
            aria-label={c === '.' ? `Square ${i + 1}` : c}
          >
            {c === 'X' ? '❌' : c === 'O' ? '⭕' : ''}
          </button>
        ))}
      </div>
      {g.status === 'open' && <Invite g={g} me={me} act={act} game="tictactoe" now={now} />}
      <TurnBar g={g} me={me} act={act} now={now} onOpen={view ? null : onOpen} />
      <Result g={g} Name={Name} />
    </div>
  );
}

function ConnectFour({ g, me, act, Name, now, view, onOpen }) {
  const myTurn = g.status === 'playing' && g.turn === me;
  return (
    <div className={`arc-c4${view ? ' in-view' : ''}`}>
      <Versus g={g} Name={Name} marks={['🔴', '🟡']} />
      <div className="c4-grid" style={{ '--cols': C4_COLS }}>
        {Array.from({ length: C4_COLS }, (_, col) => (
          <button
            key={col}
            className="c4-col"
            disabled={!myTurn || g.board[col] !== '.'}
            onClick={() => act(String(col))}
            aria-label={`Column ${col + 1}`}
          >
            {Array.from({ length: C4_ROWS }, (_, row) => {
              const i = row * C4_COLS + col;
              const c = g.board[i];
              return (
                <span
                  key={row}
                  className={`c4-cell${c === 'R' ? ' red' : c === 'Y' ? ' yellow' : ''}${g.line?.includes(i) ? ' line' : ''}${g.last === i ? ' last' : ''}`}
                  style={{ '--row': row }}
                />
              );
            })}
          </button>
        ))}
      </div>
      {g.status === 'open' && <Invite g={g} me={me} act={act} game="connect4" now={now} />}
      <TurnBar g={g} me={me} act={act} now={now} onOpen={view ? null : onOpen} />
      <Result g={g} Name={Name} />
    </div>
  );
}

function Duel({ g, me, act, Name, now }) {
  const player = me === g.a || me === g.b;
  // DRAW! shows the instant it happens (not on the card's next tick).
  const [, redraw] = useState(0);
  useEffect(() => {
    if (g.status !== 'playing' || serverNow() >= g.drawAt) return;
    const t = setTimeout(() => redraw((n) => n + 1), g.drawAt - serverNow());
    return () => clearTimeout(t);
  }, [g.status, g.drawAt]);
  const drawn = g.status === 'playing' && Math.max(now, serverNow()) >= g.drawAt;
  // Against Trotbot, keep asking once it's DRAW (it shoots on its own time).
  useEffect(() => {
    if (g.status !== 'playing' || g.b !== BOT || !player) return;
    const t = setInterval(() => serverNow() >= g.drawAt && act('peek', true), 400);
    return () => clearInterval(t);
  }, [g.status, g.drawAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="arc-duel">
      <Versus g={g} Name={Name} />
      {g.status === 'playing' && (
        <div className={`duel-sky${drawn ? ' draw' : ''}`}>
          <span aria-hidden="true">🤠</span>
          <b>{drawn ? 'DRAW!' : 'Steady…'}</b>
          <span aria-hidden="true" className="flip">
            🤠
          </span>
        </div>
      )}
      {g.status === 'playing' && player && (
        <button className={`btn big-btn duel-shoot${drawn ? ' primary' : ''}`} onClick={() => act('shoot')}>
          {drawn ? '🔫 SHOOT!' : 'Wait for it… (shooting early loses)'}
        </button>
      )}
      {g.status === 'open' && <Invite g={g} me={me} act={act} game="duel" now={now} />}
      {g.status === 'done' && g.how === 'early' && (
        <div className="small">💥 {(g.winner === g.a ? g.b : g.a).split(' ')[0]} shot too early!</div>
      )}
      {g.status === 'done' && g.how === 'shot' && (
        <div className="small">
          💨 {g.winner === me ? 'You' : g.winner === BOT ? 'Trotbot' : g.winner.split(' ')[0]} shot first, <b>{g.ms} ms</b> after DRAW!
        </div>
      )}
      <Result g={g} Name={Name} />
    </div>
  );
}

// ---------- games for everyone ----------

function Trivia({ g, me, act, Name, now }) {
  const live = g.status === 'playing';
  const mine = g.tried?.[me];
  const wrongBy = (i) =>
    Object.entries(g.tried || {})
      .filter(([n, k]) => k === i && n !== g.winner)
      .map(([n]) => n.split(' ')[0]);
  return (
    <div className="arc-trivia">
      <div className="trivia-q">{g.q}</div>
      {live && (
        <div className="arc-timer">
          <span style={{ width: `${Math.min(100, ((g.endsAt - now) / TIMES.trivia) * 100)}%` }} />
        </div>
      )}
      <div className="trivia-choices">
        {g.choices.map((c, i) => {
          const right = !live && g.answer === i;
          return (
            <button
              key={i}
              className={`btn trivia-choice${right ? ' right' : ''}${mine === i && !right ? ' wrong' : ''}`}
              disabled={!live || mine != null}
              onClick={() => act(String(i))}
            >
              <b>{'ABCD'[i]}</b> {c}
              {wrongBy(i).length > 0 && <span className="muted tiny"> ❌ {wrongBy(i).join(', ')}</span>}
            </button>
          );
        })}
      </div>
      {live && (
        <div className="muted small">
          First right answer wins {coins(g.prize)} · one guess each · {secs(g.endsAt - now)}s
        </div>
      )}
      {!live &&
        (g.winner ? (
          <div className="arc-result win">
            🧠 <Who name={g.winner} Name={Name} /> got it! +{coins(g.paid?.[g.winner] ?? g.prize)}
          </div>
        ) : (
          <div className="arc-result">⏰ Time’s up. It was {'ABCD'[g.answer]}.</div>
        ))}
      {!live && <LimitLine g={g} me={me} />}
    </div>
  );
}

function Gallows({ misses }) {
  const parts = [
    <circle key="h" cx="70" cy="34" r="9" />,
    <line key="b" x1="70" y1="43" x2="70" y2="70" />,
    <line key="la" x1="70" y1="50" x2="58" y2="62" />,
    <line key="ra" x1="70" y1="50" x2="82" y2="62" />,
    <line key="ll" x1="70" y1="70" x2="60" y2="86" />,
    <line key="rl" x1="70" y1="70" x2="80" y2="86" />,
  ];
  return (
    <svg className="hang-svg" viewBox="0 0 100 100" aria-label={`${misses} of 6 misses`}>
      <path d="M10 95 H60 M25 95 V8 H70 V25" />
      {parts.slice(0, misses)}
    </svg>
  );
}

function Hangman({ g, me, act, Name }) {
  const live = g.status === 'playing';
  const [solve, setSolve] = useState('');
  const letters = g.mask.split('|');
  const word = g.word || '';
  return (
    <div className="arc-hang">
      <div className="hang-top">
        <Gallows misses={g.misses} />
        <div className="grow">
          <div className="muted tiny">
            Hint: {g.hint} · {6 - g.misses} misses left
          </div>
          <div className="hang-word">
            {letters.map((ch, i) =>
              ch === ' ' ? (
                <span key={i} className="hang-gap" />
              ) : (
                <span key={i} className={`hang-letter${!ch && word ? ' missed' : ''}`}>
                  {ch || (word ? word[i] : '')}
                </span>
              ),
            )}
          </div>
          {g.lastGuess && live && (
            <div className="muted tiny">
              {g.lastGuess.name.split(' ')[0]} guessed {g.lastGuess.letter} {g.lastGuess.hit ? '✅' : '❌'}
            </div>
          )}
        </div>
      </div>
      {live && (
        <>
          <div className="hang-keys">
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((L) => {
              const used = g.guessed.includes(L);
              const hit = used && letters.includes(L);
              return (
                <button key={L} className={`hang-key${used ? (hit ? ' hit' : ' miss') : ''}`} disabled={used} onClick={() => act(L)}>
                  {L}
                </button>
              );
            })}
          </div>
          <form
            className="hang-solve"
            onSubmit={(e) => {
              e.preventDefault();
              if (solve.trim()) act(`solve:${solve}`).then(() => setSolve(''));
            }}
          >
            <input className="input" value={solve} onChange={(e) => setSolve(e.target.value)} placeholder="Solve it (wrong = a miss)" />
            <button className="btn" disabled={!solve.trim()}>
              Solve
            </button>
          </form>
        </>
      )}
      {!live &&
        (g.won ? (
          <div className="arc-result win">
            🎉 Solved
            {g.solver ? (
              <>
                {' '}
                by <Who name={g.solver} Name={Name} />
              </>
            ) : null}
            ! 2 🪙 per letter found, +5 for the last one.
          </div>
        ) : (
          <div className="arc-result">💀 Out of guesses. It was {word}.</div>
        ))}
      {!live && <LimitLine g={g} me={me} />}
      {Object.keys(g.found || {}).length > 0 && (
        <div className="muted tiny">
          Found:{' '}
          {Object.entries(g.found)
            .map(([n, k]) => `${n === me ? 'you' : n.split(' ')[0]} ${k}`)
            .join(' · ')}
        </div>
      )}
    </div>
  );
}

function TypeRace({ g, me, act, Name, now }) {
  const [typed, setTyped] = useState('');
  const [sent, setSent] = useState(false);
  const input = useRef(null);
  const going = g.status === 'playing';
  const done = (g.results || []).some((r) => r.name === me);
  const text = g.text || '';
  const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  let good = 0;
  while (good < typed.length && norm(typed[good]) === norm(text[good] || '')) good++;
  const submit = async (value) => {
    if (sent) return;
    setSent(true);
    const r = await act(`type:${value}`);
    if (r?.note) setSent(false);
  };
  useEffect(() => {
    if (going && !done) input.current?.focus({ preventScroll: true });
  }, [going, done]);
  return (
    <div className="arc-race">
      {g.status === 'open' && <div className="race-count">Starting in {secs(g.startAt - now)}…</div>}
      {going && (
        <>
          <div className="race-text" aria-label={text}>
            <span className="ok">{text.slice(0, good)}</span>
            <span className={typed.length > good ? 'bad' : ''}>{text.slice(good, Math.max(good, typed.length))}</span>
            <span>{text.slice(Math.max(good, typed.length))}</span>
          </div>
          {!done ? (
            <textarea
              ref={input}
              className="input race-input"
              rows={2}
              value={typed}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Type it here. No pasting!"
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onChange={(e) => {
                const v = e.target.value.replace(/\n/g, '');
                setTyped(v);
                if (norm(v.trim()) === norm(text)) submit(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit(typed);
                }
              }}
            />
          ) : (
            <div className="small">✅ Done! Waiting for the others…</div>
          )}
          <div className="muted small">Ends in {secs(g.endsAt - now)}s</div>
        </>
      )}
      {(g.results || []).length > 0 && (
        <ol className="cmd-leaders">
          {g.results.map((r, i) => (
            <li key={r.name}>
              <span className="cmd-medal">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
              <Who name={r.name} Name={Name} />
              <span className="grow" />
              <b>{r.wpm} WPM</b>
              <span className="muted small">{(r.ms / 1000).toFixed(1)}s</span>
            </li>
          ))}
        </ol>
      )}
      {g.status === 'done' &&
        (g.prize ? (
          <div className="arc-result win">
            🏁 <Who name={g.winner} Name={Name} /> wins {coins(g.paid?.[g.winner] ?? g.prize)}
          </div>
        ) : (
          <div className="muted small">
            {g.results.length ? 'Only one racer, so no prize. Race someone next time!' : 'Nobody finished.'}
          </div>
        ))}
      {g.status === 'done' && <LimitLine g={g} me={me} />}
    </div>
  );
}

function Heist({ g, me, act, Name, now }) {
  const live = g.status === 'open';
  const n = g.crew.length;
  const odds = Math.min(0.85, 0.35 + 0.1 * (n - 1));
  const each = Math.floor((g.bet * 0.95) / odds);
  return (
    <div className="arc-heist">
      <div className="arc-betrow">
        <BetPill each={g.bet} pot={g.bet * n} people="each" />
      </div>
      <div className="heist-crew">
        {g.crew.map((c) => (
          <span key={c} className="arc-who">
            <Avatar name={c} size={28} />
            <Name name={c} />
          </span>
        ))}
      </div>
      {live ? (
        <>
          <div className="small">
            Crew of <b>{n}</b> · <b>{Math.round(odds * 100)}%</b> chance · each gets <b>{coins(each)}</b> if it works
          </div>
          <div className="muted tiny">More crew = better odds (up to 85%). Everyone puts in {coins(g.bet)}.</div>
          <div className="casino-buttons">
            {!g.crew.includes(me) && (
              <button className="btn primary" onClick={() => act('join')}>
                Join the crew ({coins(g.bet)})
              </button>
            )}
            {g.crew[0] === me && n > 1 && (
              <button className="btn" onClick={() => act('go')}>
                Go now
              </button>
            )}
            <span className="muted small">Leaving in {secs(g.endsAt - now)}s</span>
          </div>
        </>
      ) : (
        <>
          <div className="small">{g.story}</div>
          <div className={`arc-result ${g.ok ? 'win' : 'lose'}`}>
            {g.ok ? <>💰 Got away! Everyone gets {coins(g.each)}</> : <>🚓 Caught. Everyone lost {coins(g.bet)}</>}
            <span className="muted small"> · {g.odds}% odds</span>
          </div>
        </>
      )}
    </div>
  );
}

// view: shown in the game view (GameView.jsx), big; otherwise it's the card in the chat.
export function ArcadeBody({ m, me, Name, onMove, conv, view = false, onRun }) {
  // The newest copy of the game: the chat's, or a move's answer if that's ahead (liveGames.js).
  const c = useFreshCmd(m.id, m.cmd);
  const g = { ...c.game, status: c.status };
  const live = isLive(c.status);
  // Board games tick once a second (their clocks show seconds); the fast games need more.
  const now = useNow(live, VIEW_GAMES.includes(c.name) ? 1000 : 250);
  useEffect(ensureCasinoDefs, []);
  // Every answer that brings the card back keeps it (a stale chat still shows the move).
  const send = (move) =>
    Promise.resolve(onMove(move)).then((r) => {
      if (r?.card) noteCard(m.id, r.card);
      return r;
    });
  // One move at a time, shown at once; the card takes the next tap as soon as
  // its new state arrives (useMove). Timers' quiet asks never block a tap.
  const mv = useMove(send, `${c.status}|${JSON.stringify(c.game)}`);
  const act = (move, quiet) => (quiet ? mv.peek(move) : mv.send(move));
  // Back from the background (or the connection), the chat's copy of a live
  // board game can be behind: ask for the card as it is now.
  const board = VIEW_GAMES.includes(c.name) && live && (view || me === g.a || me === g.b);
  useEffect(() => {
    if (!board) return undefined;
    const sync = () => document.visibilityState === 'visible' && mv.peek('sync');
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('online', sync);
    if (view) sync();
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('online', sync);
    };
  }, [board, view]); // eslint-disable-line react-hooks/exhaustive-deps
  const error = mv.error;
  // Timers that need the server to move things along.
  const at = {
    open: c.name === 'typerace' ? g.startAt : c.name === 'heist' ? g.endsAt : g.expiresAt,
    playing:
      c.name === 'typerace' || c.name === 'trivia' || RACES.includes(c.name)
        ? g.endsAt
        : c.name === 'duel' && g.b !== BOT
          ? (g.drawAt || 0) + TIMES.duelIdle
          : c.name === 'rps'
            ? (g.lastAt || 0) + TIMES.turn
            : 0,
    placing: g.placeBy,
  }[c.status];
  usePeekAt(at, live, act);
  const onOpen = () => openGameView({ conv, m });
  const props = { g, me, act, Name, now, mv, view, onOpen, msgId: m.id, conv, m };
  // A Tetris or Minesweeper result someone posted (not a race).
  if (c.share) return <FunShare c={c} by={m.by} Name={Name} />;
  const body = {
    rps: <Rps {...props} />,
    tictactoe: <TicTacToe {...props} />,
    connect4: <ConnectFour {...props} />,
    duel: <Duel {...props} />,
    trivia: <Trivia {...props} />,
    hangman: <Hangman {...props} />,
    typerace: <TypeRace {...props} />,
    heist: <Heist {...props} />,
    battleship: view ? (
      <BattleshipView {...props} />
    ) : (
      <BattleshipCard {...props} onRematch={onRun ? (args) => onRun('battleship', args) : null} />
    ),
    tetris: <RaceCard {...props} name="tetris" conv={conv} msgId={m.id} />,
    minesweep: <RaceCard {...props} name="minesweep" conv={conv} msgId={m.id} />,
    challenge: <Challenge {...props} />,
  }[c.name];
  return (
    <>
      {body}
      {/* The Battleship game view says it in its status line (no line appearing under the board). */}
      {error && !(view && c.name === 'battleship') && <div className="casino-error">{error}</div>}
    </>
  );
}
