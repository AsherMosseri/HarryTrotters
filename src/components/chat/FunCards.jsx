import { useEffect, useMemo, useRef, useState } from 'react';
import { BOT, isLive } from '../../../functions/shared/arcade.js';
import * as bs from '../../../functions/shared/battleship.js';
import * as fun from '../../../functions/shared/funGames.js';
import { LEVELS } from '../../../functions/shared/minesweeper.js';
import { Icon } from '../shell/icons.jsx';
import { openGame } from '../games/launch.js';
import { Invite, Result, TurnBar, Versus, Who } from './Arcade.jsx';

// Cards for the newer #arcade games: Tetris and Minesweeper races (each
// player plays on the game screen; the card keeps score), a posted Tetris or
// Minesweeper result, and Battleship (played right on the card).

const first = (n) => (n === BOT ? 'Trotbot' : n.split(' ')[0]);
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
const clock = (ms) => {
  const s = secs(ms);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};

// ---------- a posted result ----------

export function FunShare({ c, by, Name }) {
  const game = c.name;
  return (
    <div className="fun-share">
      <div className="fun-share-top">
        <span className="fun-share-icon" aria-hidden="true">
          <Icon name={game === 'tetris' ? 'blocks' : 'mine'} size={22} />
        </span>
        <div className="grow">
          <div className="small muted">
            <Name name={by} /> · {fun.MODES[game]?.[c.mode] || ''}
            {game === 'minesweep' && LEVELS[c.level] ? ` · ${LEVELS[c.level].label}` : ''}
          </div>
          <b className="fun-share-line">{c.line}</b>
        </div>
      </div>
      {c.bot && (
        <div className={`arc-result ${c.won ? 'win' : 'lose'}`}>
          {c.won ? 'Beat' : 'Lost to'} Trotbot ({c.speed || 'medium'}): <span className="mono">{c.bot.line}</span>
        </div>
      )}
      <div className="fun-row">
        {c.paid > 0 && <span className="chip mono">+{c.paid} 🪙</span>}
        <button className="btn small" onClick={() => openGame({ game, conv: 'arcade' })}>
          <Icon name="play" /> Play {fun.GAME_LABEL[game]}
        </button>
      </div>
    </div>
  );
}

// ---------- a 2-player race ----------

function raceLine(game, r) {
  if (!r) return null;
  if (r.gaveUp) return 'gave up';
  return fun.resultLine(game, 'race', r);
}

export function RaceCard({ name, g, me, act, Name, now, conv, msgId }) {
  const player = me === g.a || me === g.b;
  const mineDone = !!g.results?.[me];
  const tetris = name === 'tetris';
  const play = () => openGame({ game: name, mode: 'race', race: { conv, msgId, startAt: g.startAt }, conv });
  return (
    <div className="arc-race">
      <Versus g={g} Name={Name} />
      <div className="small muted">
        {tetris ? 'Same pieces. First to clear 40 lines wins.' : `Same ${LEVELS[g.level || 'beginner'].label.toLowerCase()} board. Fastest clear wins.`}
      </div>
      {g.status === 'open' && <Invite g={g} me={me} act={act} game={name} now={now} />}
      {g.status !== 'open' && (
        <div className="race-rows">
          {[g.a, g.b].map((n) => {
            const r = g.results?.[n];
            return (
              <div key={n} className={`race-row${g.winner === n ? ' won' : ''}`}>
                <Who name={n} Name={Name} />
                <span className="grow" />
                <span className="small mono">{r ? raceLine(name, r) : isLive(g.status) ? 'playing…' : 'didn’t finish'}</span>
              </div>
            );
          })}
        </div>
      )}
      {g.status === 'playing' && (
        <div className="arc-wait">
          {player && !mineDone ? (
            <button className="btn primary" onClick={play}>
              <Icon name="play" /> {now < g.startAt ? `Starts in ${secs(g.startAt - now)}` : 'Play'}
            </button>
          ) : (
            <span className="small muted">{mineDone ? 'You’re done. Waiting for the other player…' : 'Race on'}</span>
          )}
          <span className="muted small">
            {' '}
            · ends in <span className="mono">{clock(g.endsAt - now)}</span>
          </span>
          {player && !mineDone && (
            <button className="link-btn small" onClick={() => act('resign')}>
              Give up
            </button>
          )}
        </div>
      )}
      {g.status === 'done' && g.how === 'dnf' && g.winner && <div className="muted small">The other player didn’t finish in time.</div>}
      <Result g={g} Name={Name} />
      {g.status === 'done' && g.winner && <div className="muted tiny">The winner gets {fun.RACE_PRIZE} coins.</div>}
    </div>
  );
}

// ---------- Battleship ----------

const N = bs.N;

// One 10×10 grid. cells(i) → { ship, hit, miss, sunk, last, cls }.
function Grid({ label, cell, info, onTap, disabled, small, children, gridRef, ...rest }) {
  return (
    <div className={`bs-board${small ? ' small' : ''}`}>
      {label && <div className="bs-label small">{label}</div>}
      <div className="bs-grid" ref={gridRef} {...rest}>
        {Array.from({ length: N * N }, (_, i) => {
          const x = info(i);
          return (
            <button
              key={i}
              data-i={i}
              className={`bs-cell${x.ship ? ' ship' : ''}${x.hit ? ' hit' : ''}${x.miss ? ' miss' : ''}${x.sunk ? ' sunk' : ''}${x.last ? ' last' : ''}${x.bad ? ' bad' : ''}${x.pick ? ' pick' : ''}`}
              disabled={disabled || !onTap || x.hit || x.miss}
              onClick={onTap ? () => onTap(i) : undefined}
              aria-label={`${String.fromCharCode(65 + Math.floor(i / N))}${(i % N) + 1}${x.hit ? ' hit' : x.miss ? ' miss' : ''}`}
            >
              {x.hit ? <span className="bs-x" aria-hidden="true" /> : x.miss ? <span className="bs-o" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

// Placing your fleet: starts random; drag a ship to move it, tap it to turn it.
function Placer({ onReady }) {
  const [ships, setShips] = useState(() => bs.randomFleet().map((cells) => toSpec(cells)));
  const [sel, setSel] = useState(-1);
  const [busy, setBusy] = useState(false);
  const gridRef = useRef(null);
  const drag = useRef(null);
  const cellsOf = (s, k) => bs.shipCells(s.x, s.y, s.down, bs.FLEET[k][1]);
  const all = ships.map(cellsOf);
  const counts = new Map();
  all.forEach((cs) => (cs || []).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1)));
  const ok = all.every(Boolean) && [...counts.values()].every((n) => n === 1);
  const owner = (i) => all.findIndex((cs) => cs?.includes(i));
  const at = (e) => {
    const r = gridRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * N);
    return { x: Math.max(0, Math.min(N - 1, x)), y: Math.max(0, Math.min(N - 1, y)) };
  };
  const onDown = (e) => {
    const p = at(e);
    const k = owner(p.y * N + p.x);
    if (k < 0) return;
    e.preventDefault();
    gridRef.current.setPointerCapture?.(e.pointerId);
    drag.current = { k, from: p, start: ships[k], moved: false };
    setSel(k);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = at(e);
    const dx = p.x - d.from.x;
    const dy = p.y - d.from.y;
    if (!dx && !dy && !d.moved) return;
    d.moved = true;
    const len = bs.FLEET[d.k][1];
    const x = Math.max(0, Math.min(N - (d.start.down ? 1 : len), d.start.x + dx));
    const y = Math.max(0, Math.min(N - (d.start.down ? len : 1), d.start.y + dy));
    setShips((list) => list.map((s, k) => (k === d.k ? { ...s, x, y } : s)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // A tap turns it (pulled back onto the board if it would hang off).
    const len = bs.FLEET[d.k][1];
    setShips((list) =>
      list.map((s, k) => {
        if (k !== d.k) return s;
        const down = !s.down;
        return { down, x: Math.min(s.x, N - (down ? 1 : len)), y: Math.min(s.y, N - (down ? len : 1)) };
      }),
    );
  };
  const ready = async () => {
    setBusy(true);
    await onReady(ships.map((s) => `${s.x},${s.y},${s.down ? 1 : 0}`).join(';'));
    setBusy(false);
  };
  return (
    <div className="bs-place">
      <Grid
        gridRef={gridRef}
        info={(i) => {
          const k = owner(i);
          return { ship: k >= 0, bad: (counts.get(i) || 0) > 1, pick: k >= 0 && k === sel };
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
      />
      <div className="small muted">Drag a ship to move it. Tap it to turn it.</div>
      <div className="casino-buttons">
        <button className="btn" onClick={() => setShips(bs.randomFleet().map(toSpec))}>
          <Icon name="shuffle" /> Shuffle
        </button>
        <button className="btn primary" disabled={!ok || busy} onClick={ready}>
          {ok ? 'Ready' : 'Ships overlap'}
        </button>
      </div>
    </div>
  );
}
function toSpec(cells) {
  const down = cells.length > 1 && cells[1] - cells[0] === N;
  return { x: cells[0] % N, y: Math.floor(cells[0] / N), down };
}

function Fleet({ sunk = [] }) {
  const gone = new Set(sunk.map((s) => s.k));
  return (
    <div className="bs-fleet small">
      {bs.FLEET.map(([label, len], k) => (
        <span key={label} className={gone.has(k) ? 'gone' : ''} title={label}>
          {label} <span className="mono muted">{len}</span>
        </span>
      ))}
    </div>
  );
}

export function Battleship({ g, me, act, Name, now }) {
  const player = me === g.a || me === g.b;
  const other = me === g.a ? g.b : g.a;
  const [mine, setMine] = useState(null);
  const placed = (g.placed || []).includes(me);
  // Your own ships come from the server, only to you.
  useEffect(() => {
    if (!player || mine || !(placed || g.status === 'playing')) return;
    act('mine', true).then((r) => r?.mine && setMine(r.mine));
  }, [player, placed, g.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const fleets = useMemo(() => {
    const out = {};
    for (const [n, text] of Object.entries(g.fleets || {})) out[n] = bs.parseFleet(text);
    return out;
  }, [g.fleets]);
  const myShips = useMemo(() => fleets[me] || (mine ? bs.parseFleet(mine) : null), [fleets, me, mine]);
  const sunkSet = (n) => new Set((g.sunk?.[n] || []).flatMap((s) => s.cells));
  const board = (n, ships) => {
    const shots = g.shots?.[n] || bs.emptyShots();
    const sunk = sunkSet(n);
    const shipSet = new Set((ships || []).flat());
    const lastHere = [g.last, g.mine].filter((x) => x && x.by !== n);
    return (i) => ({
      ship: shipSet.has(i) || sunk.has(i),
      hit: shots[i] === 'x',
      miss: shots[i] === 'o',
      sunk: sunk.has(i),
      last: lastHere.some((x) => x.i === i),
    });
  };
  const myTurn = g.status === 'playing' && g.turn === me;
  const shotText = (x) => x && `${first(x.by)}: ${String.fromCharCode(65 + Math.floor(x.i / N))}${(x.i % N) + 1} ${x.hit ? (x.sunk ? `sank the ${x.sunk}!` : 'hit!') : 'miss'}`;
  return (
    <div className="arc-bs">
      <Versus g={g} Name={Name} />
      {g.status === 'open' && <Invite g={g} me={me} act={act} game="battleship" now={now} />}
      {g.status === 'placing' &&
        (player && !placed ? (
          <Placer onReady={(text) => act(`place:${text}`)} />
        ) : (
          <div className="arc-wait">
            <span className="small">
              {player ? `Ships placed. Waiting for ${first(other)}…` : 'Placing ships…'} <span className="muted mono">{clock(g.placeBy - now)}</span>
            </span>
            {player && (
              <button className="link-btn small" onClick={() => act('resign')}>
                Resign
              </button>
            )}
          </div>
        ))}
      {g.status === 'placing' && player && placed && myShips && <Grid small label="Your fleet" info={board(me, myShips)} />}
      {(g.status === 'playing' || g.status === 'done') && g.shots && (
        <>
          <div className="bs-status small">
            {g.status === 'playing' ? (
              myTurn ? (
                <b>Your turn: pick a square</b>
              ) : (
                <span>{player ? `${first(g.turn)} is aiming…` : `${first(g.turn)}’s turn`}</span>
              )
            ) : null}
            {[g.mine, g.last].filter(Boolean).map((x, k) => (
              <span key={k} className={`bs-shot${x.hit ? ' hit' : ''}`}>
                {shotText(x)}
              </span>
            ))}
          </div>
          <div className="bs-boards">
            {player ? (
              <>
                <Grid
                  label={`${first(other)}’s waters`}
                  info={board(other, fleets[other])}
                  onTap={myTurn ? (i) => act(`fire:${i}`) : null}
                  disabled={!myTurn}
                >
                  <Fleet sunk={g.sunk?.[other]} />
                </Grid>
                <Grid small label="Your fleet" info={board(me, myShips)}>
                  <Fleet sunk={g.sunk?.[me]} />
                </Grid>
              </>
            ) : (
              [g.a, g.b].map((n) => (
                <Grid key={n} small label={`${first(n)}’s waters`} info={board(n, fleets[n])}>
                  <Fleet sunk={g.sunk?.[n]} />
                </Grid>
              ))
            )}
          </div>
        </>
      )}
      <TurnBar g={g} me={me} act={act} now={now} />
      <Result g={g} Name={Name} />
      {g.status === 'done' && g.how === 'noplace' && <div className="muted small">Nobody placed their ships in time.</div>}
      {g.status === 'done' && g.winner && g.winner !== BOT && g.how === 'sunk' && (
        <div className="muted tiny">Sank the whole fleet: {g.b === BOT ? 2 : 3} coins.</div>
      )}
    </div>
  );
}

