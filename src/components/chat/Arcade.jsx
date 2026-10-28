import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../common.jsx';
import { BOT, C4_COLS, C4_ROWS, RPS, TIMES, isLive } from '../../../functions/shared/arcade.js';
import { serverNow } from '../../serverTime.js';

// Multiplayer game cards in #arcade (the play function runs the games; see
// functions/shared/arcade.js). Buttons send moves; timers ask the server to
// move things along ("peek") when a countdown runs out.

export const ARCADE_CARDS = ['rps', 'tictactoe', 'connect4', 'duel', 'trivia', 'hangman', 'typerace', 'heist'];
const coins = (n) => `${n} 🪙`;
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

const Who = ({ name, Name }) =>
  name === BOT ? (
    <b className="arc-bot">🤖 Trotbot</b>
  ) : (
    <span className="arc-who">
      <Avatar name={name} size={20} />
      <Name name={name} />
    </span>
  );

// ---------- challenges ----------

function Versus({ g, Name, marks }) {
  return (
    <div className="arc-vs">
      <span className={g.turn === g.a && isLive(g.status) ? 'turn' : ''}>
        {marks?.[0]} <Who name={g.a} Name={Name} />
      </span>
      <span className="muted">vs</span>
      <span className={g.turn === g.b && isLive(g.status) ? 'turn' : ''}>
        {marks?.[1]} <Who name={g.b} Name={Name} />
      </span>
      {g.bet > 0 && <span className="chip">{coins(g.bet)} each</span>}
    </div>
  );
}

// Waiting for the other person: accept / decline / cancel.
function Invite({ g, me, act, game, now }) {
  const left = g.expiresAt - now;
  if (me === g.b && game !== 'rps')
    return (
      <div className="casino-buttons">
        <button className="btn primary" onClick={() => act('accept')}>
          Accept{g.bet ? ` (${coins(g.bet)})` : ''}
        </button>
        <button className="btn" onClick={() => act('decline')}>
          Decline
        </button>
      </div>
    );
  return (
    <div className="arc-wait">
      <span className="muted small">
        {me === g.b ? 'Pick to accept' : `Waiting for ${g.b.split(' ')[0]} to accept`} · {clock(left)} left
      </span>
      {me === g.a && (
        <button className="link-btn small" onClick={() => act('cancel')}>
          Cancel
        </button>
      )}
      {me === g.b && (
        <button className="link-btn small" onClick={() => act('decline')}>
          Decline
        </button>
      )}
    </div>
  );
}

function Result({ g, Name }) {
  if (isLive(g.status)) return null;
  const pot = g.bet ? ` · ${coins(g.bet * 2)}` : '';
  const text = {
    declined: `${g.b.split(' ')[0]} declined.`,
    cancelled: 'Cancelled.',
    expired: 'Nobody accepted in time.',
    nobody: 'Nobody shot. Bets back.',
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

function Rps({ g, me, act, Name, now }) {
  const player = me === g.a || me === g.b;
  const picked = (g.picked || []).includes(me);
  const canPick = isLive(g.status) && player && !picked;
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
      {picked && isLive(g.status) && <div className="muted small">You picked. Waiting…</div>}
      {g.status === 'open' && <Invite g={g} me={me} act={act} game="rps" now={now} />}
      <Result g={g} Name={Name} />
    </div>
  );
}

function TurnBar({ g, me, act, now }) {
  if (g.status !== 'playing') return null;
  const player = me === g.a || me === g.b;
  const late = now - g.lastAt > TIMES.turn;
  return (
    <div className="arc-wait">
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

function TicTacToe({ g, me, act, Name, now }) {
  const myTurn = g.status === 'playing' && g.turn === me;
  return (
    <div className="arc-ttt">
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
      <TurnBar g={g} me={me} act={act} now={now} />
      <Result g={g} Name={Name} />
    </div>
  );
}

function ConnectFour({ g, me, act, Name, now }) {
  const myTurn = g.status === 'playing' && g.turn === me;
  return (
    <div className="arc-c4">
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
      <TurnBar g={g} me={me} act={act} now={now} />
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
            🧠 <Who name={g.winner} Name={Name} /> got it! +{coins(g.prize)}
          </div>
        ) : (
          <div className="arc-result">⏰ Time’s up. It was {'ABCD'[g.answer]}.</div>
        ))}
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
            🏁 <Who name={g.winner} Name={Name} /> wins {coins(g.prize)}
          </div>
        ) : (
          <div className="muted small">
            {g.results.length ? 'Only one racer, so no prize. Race someone next time!' : 'Nobody finished.'}
          </div>
        ))}
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
            {g.ok ? `💰 Got away! Everyone gets ${coins(g.each)}` : `🚓 Caught. Everyone lost ${coins(g.bet)}`}
            <span className="muted small"> · {g.odds}% odds</span>
          </div>
        </>
      )}
    </div>
  );
}

export function ArcadeBody({ m, me, Name, onMove }) {
  const c = m.cmd;
  const g = { ...c.game, status: c.status };
  const live = isLive(c.status);
  const now = useNow(live);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const act = async (mv, quiet) => {
    if (busy.current && !quiet) return;
    busy.current = !quiet;
    try {
      const r = await onMove(mv);
      if (!quiet) setError(r?.note ? r.note.title : '');
      return r;
    } finally {
      if (!quiet) busy.current = false;
    }
  };
  // Timers that need the server to move things along.
  const at = {
    open: c.name === 'typerace' ? g.startAt : c.name === 'heist' ? g.endsAt : g.expiresAt,
    playing:
      c.name === 'typerace' || c.name === 'trivia' ? g.endsAt : c.name === 'duel' && g.b !== BOT ? (g.drawAt || 0) + TIMES.duelIdle : 0,
  }[c.status];
  usePeekAt(at, live, act);
  const props = { g, me, act, Name, now };
  const body = {
    rps: <Rps {...props} />,
    tictactoe: <TicTacToe {...props} />,
    connect4: <ConnectFour {...props} />,
    duel: <Duel {...props} />,
    trivia: <Trivia {...props} />,
    hangman: <Hangman {...props} />,
    typerace: <TypeRace {...props} />,
    heist: <Heist {...props} />,
  }[c.name];
  return (
    <>
      {body}
      {error && <div className="casino-error">{error}</div>}
    </>
  );
}
