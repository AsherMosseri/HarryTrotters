import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOT, BS_MODES, TIMES } from '../../../functions/shared/arcade.js';
import * as bs from '../../../functions/shared/battleship.js';
import { Icon } from '../shell/icons.jsx';
import { confirmDialog } from '../Dialogs.jsx';
import { Invite, Result, Versus } from './Arcade.jsx';
import { openGameView } from './liveGames.js';
import { CoinNum } from '../CoinNum.jsx';
import { coinStyled, withExact } from '../../coinFormat.js';

// Battleship. In the chat, a summary card (who's playing, the rules, what just
// happened, both boards' shots) with a big Play or Watch button; the game
// itself is played in the game view (GameView.jsx), big, over the chat.
//
// Taps: the square you tap shows at once (pending) and the board takes no
// other shot until the move is in (useMove: one move at a time; the card's
// new state arriving releases it). Nothing above the board changes height
// while you play (the status lines are fixed), so the board never moves under
// your finger. Spectators see only what's on the card: shots, hits and sunk
// ships; nobody's fleet until the game ends.

const N = bs.N;
const first = (n) => (n === BOT ? 'Trotbot' : String(n || '').split(' ')[0]);
const sq = (i) => `${String.fromCharCode(65 + Math.floor(i / N))}${(i % N) + 1}`;
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
const clock = (ms) => {
  const s = secs(ms);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};
export const modeOf = (g) => (g.mode === 'hitagain' ? 'hitagain' : 'classic');

// A handler that never changes identity but always runs the latest code (the
// boards are memoized, so they keep the first handler they were given).
function useStable(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...a) => ref.current?.(...a), []);
}

// ---------- your own fleet ----------

// Your ships come from the server, only to you ("mine"); kept per game for the
// session, so the card and the game view (and the next time either opens)
// don't ask again. When you place them, they're known right away.
const fleetCache = new Map();
export const rememberFleet = (msgId, me, text) => (text ? fleetCache.set(`${msgId}|${me}`, text) : fleetCache.delete(`${msgId}|${me}`));
function useMyFleet(msgId, g, me, peek) {
  const key = `${msgId}|${me}`;
  const [text, setText] = useState(() => fleetCache.get(key) || null);
  const player = me === g.a || me === g.b;
  const placed = (g.placed || []).includes(me);
  const cached = fleetCache.get(key) || null;
  useEffect(() => {
    if (cached || text || !player || !placed || g.fleets) return undefined;
    let on = true;
    peek('mine').then((r) => {
      if (!r?.mine) return;
      fleetCache.set(key, r.mine);
      if (on) setText(r.mine);
    });
    return () => {
      on = false;
    };
  }, [key, player, placed, !!g.fleets]); // eslint-disable-line react-hooks/exhaustive-deps
  return g.fleets?.[me] || cached || text;
}

// ---------- what happened, in words ----------

// Runs of shots: one player's shots in a row (with Hit again, or Trotbot's
// reply), oldest first.
function runsOf(g) {
  const log = g.log || [g.mine, g.last].filter(Boolean);
  const out = [];
  for (const s of log) {
    const r = out[out.length - 1];
    if (r && r.by === s.by) r.shots.push(s);
    else out.push({ by: s.by, shots: [s] });
  }
  return out;
}
const word = (s) => (s.sunk ? `sank the ${s.sunk}` : s.hit ? 'hit' : 'miss');
function runLine(run, me) {
  const who = run.by === me ? 'You' : first(run.by);
  if (run.shots.length === 1) {
    const s = run.shots[0];
    return `${who} fired at ${sq(s.i)}: ${s.sunk ? `sank the ${s.sunk}!` : s.hit ? 'hit!' : 'miss.'}`;
  }
  return `${who} fired ${run.shots.length} times: ${run.shots.map(word).join(', ')}.`;
}
// { head, sub, tone } for a game being played: whose turn it is, and what
// just happened ("Hit! Your turn again", "Miss. Cooper’s turn").
export function bsNews(g, me) {
  const player = me === g.a || me === g.b;
  const turnName = g.turn === me ? 'Your turn' : `${first(g.turn)}’s turn`;
  const runs = runsOf(g);
  const last = runs[runs.length - 1];
  if (!last) {
    return {
      head: g.turn === me ? 'Your turn: pick a square' : player ? `${first(g.turn)} goes first` : `${first(g.turn)}’s turn`,
      sub: BS_MODES[modeOf(g)].rules + '.',
      tone: g.turn === me ? 'go' : '',
    };
  }
  const shot = last.shots[last.shots.length - 1];
  const mine = last.by === me;
  // Still shooting (Hit again).
  if (last.by === g.turn) {
    const at = last.by === g.a ? g.b : g.a;
    const what = shot.sunk ? (mine ? `You sank the ${shot.sunk}!` : `Sank ${at === me ? 'your' : `${first(at)}’s`} ${shot.sunk}!`) : 'Hit!';
    return {
      head: mine ? `${what} Your turn again` : `${what} ${first(g.turn)} goes again`,
      sub: runLine(last, me),
      tone: mine ? 'go hit' : 'hit',
    };
  }
  if (mine) {
    const what = shot.sunk ? `You sank the ${shot.sunk}!` : shot.hit ? 'Hit!' : 'Miss.';
    return { head: `${what} ${turnName}`, sub: runLine(last, me), tone: shot.hit ? 'hit' : '' };
  }
  // Someone else shot last; the turn passed. With Trotbot, your shot was just before.
  const prev = runs[runs.length - 2];
  const target = (n) => (n === me ? 'your' : `${first(n)}’s`);
  const at = last.by === g.a ? g.b : g.a;
  const verb = shot.sunk ? `sank ${target(at)} ${shot.sunk}` : shot.hit ? 'hit' : 'missed';
  return {
    head: `${first(last.by)} ${verb}. ${turnName}`,
    sub: [prev && prev.by === me && g.b === BOT ? runLine(prev, me) : '', runLine(last, me)].filter(Boolean).join(' '),
    tone: g.turn === me ? 'go' : '',
  };
}

// ---------- boards ----------

// One 10×10 board. info: [{ ship, hit, miss, sunk, last, pick, ghost, bad, pending }]
// per square. Squares are buttons only when the board takes taps (never
// `disabled`: some browsers drop pointer events on disabled buttons).
const Board = memo(function Board({ info, sig, onTap, label, board, className = '', gridRef, busy, aria, ...rest }) {
  const live = !!onTap;
  const Cell = live ? 'button' : 'span';
  return (
    <div className={`bs-board ${className}`}>
      {label && <div className="bs-label small">{label}</div>}
      <div
        className={`bs-grid${live ? ' live' : ''}${busy ? ' busy' : ''}`}
        ref={gridRef}
        data-board={board}
        role={live ? 'grid' : 'img'}
        aria-label={aria || label}
        onClick={(e) => e.stopPropagation()}
        {...rest}
      >
        {info.map((x, i) => {
          const cls = `bs-cell${x.ship ? ' ship' : ''}${x.hit ? ' hit' : ''}${x.miss ? ' miss' : ''}${x.sunk ? ' sunk' : ''}${x.last ? ' last' : ''}${
            x.pick ? ' pick' : ''
          }${x.ghost ? ' ghost' : ''}${x.bad ? ' bad' : ''}${x.pending ? ' pending' : ''}${x.off ? ' off' : ''}`;
          return live ? (
            <Cell
              key={i}
              type="button"
              data-i={i}
              className={cls}
              aria-disabled={x.off ? 'true' : undefined}
              aria-busy={x.pending ? 'true' : undefined}
              aria-label={`${sq(i)}${x.hit ? (x.sunk ? ' sunk' : ' hit') : x.miss ? ' miss' : x.ship ? ' ship' : ''}`}
              onClick={() => onTap(i)}
            >
              {x.hit ? <span className="bs-x" aria-hidden="true" /> : x.miss ? <span className="bs-o" aria-hidden="true" /> : null}
            </Cell>
          ) : (
            <Cell key={i} data-i={i} className={cls}>
              {x.hit ? <span className="bs-x" aria-hidden="true" /> : x.miss ? <span className="bs-o" aria-hidden="true" /> : null}
            </Cell>
          );
        })}
      </div>
    </div>
  );
}, (a, b) => a.sig === b.sig && a.label === b.label && a.busy === b.busy && !!a.onTap === !!b.onTap && a.className === b.className);

// What a board shows: shots at `n`'s fleet, plus `ships` (their fleet, when
// it's yours or the game is over). The newest run of shots at it is outlined.
function boardInfo(g, n, ships, extra = () => ({})) {
  const shots = g.shots?.[n] || bs.emptyShots();
  const sunk = new Set((g.sunk?.[n] || []).flatMap((s) => s.cells));
  const shipSet = new Set((ships || []).flat());
  const runs = runsOf(g);
  const lastRun = runs[runs.length - 1];
  const recent = new Set();
  // The newest shots at this board: the last run, and Trotbot's reply before yours.
  for (const r of runs.slice(-2)) if (r.by !== n && (r === lastRun || g.b === BOT)) r.shots.forEach((s) => recent.add(s.i));
  const info = [];
  for (let i = 0; i < N * N; i++)
    info.push({
      ship: shipSet.has(i) || sunk.has(i),
      hit: shots[i] === 'x',
      miss: shots[i] === 'o',
      sunk: sunk.has(i),
      last: recent.has(i),
      ...extra(i, shots[i]),
    });
  const sig = info.map((x) => `${+x.ship}${+x.hit}${+x.miss}${+x.sunk}${+x.last}${+!!x.pending}${+!!x.off}`).join('');
  return { info, sig };
}

// Ships left. short: pips only (the names are in the tooltip and for screen readers).
function Fleet({ sunk = [], short = false }) {
  const gone = new Set(sunk.map((s) => s.k));
  const left = bs.FLEET.length - gone.size;
  return (
    <div className={`bs-fleet small${short ? ' short' : ''}`} aria-label={`${left} of ${bs.FLEET.length} ships left`}>
      {short && <span className="muted">{left === bs.FLEET.length ? 'All ships afloat' : `${left} left`}</span>}
      {bs.FLEET.map(([label, len], k) => (
        <span key={label} className={gone.has(k) ? 'gone' : ''} title={`${label}${gone.has(k) ? ' (sunk)' : ''}`}>
          <span className="bs-pips" aria-hidden="true">
            {Array.from({ length: len }, (_, j) => (
              <i key={j} />
            ))}
          </span>
          {!short && label}
        </span>
      ))}
    </div>
  );
}

export function ModeChip({ g }) {
  const mode = modeOf(g);
  return (
    <span className={`bs-mode ${mode}`} title={BS_MODES[mode].rules}>
      {BS_MODES[mode].label} rules
    </span>
  );
}

// ---------- the card in the chat ----------

export function BattleshipCard({ g, me, act, Name, now, mv, msgId, conv, m, onRematch }) {
  const player = me === g.a || me === g.b;
  const placed = (g.placed || []).includes(me);
  const open = () => openGameView({ conv, m });
  const news = g.status === 'playing' ? bsNews(g, me) : null;
  const late = g.status === 'playing' && now - g.lastAt > TIMES.turn;
  const label =
    g.status === 'placing'
      ? player && !placed
        ? 'Place your ships'
        : player
          ? 'Open'
          : 'Watch'
      : g.status === 'playing'
        ? player
          ? g.turn === me
            ? 'Play: your turn'
            : 'Open'
          : 'Watch'
        : 'See both fleets';
  const boards = (g.status === 'playing' || g.status === 'done') && g.shots;
  return (
    <div className="arc-bs bs-card">
      <Versus g={g} Name={Name} />
      <div className="bs-card-meta">
        <ModeChip g={g} />
        {g.status === 'placing' && <span className="muted small mono">{clock(g.placeBy - now)}</span>}
        {g.status === 'playing' && !late && (
          <span className="muted small">
            {g.turn === me ? 'you' : first(g.turn)} · <span className="mono">{clock(g.lastAt + TIMES.turn - now)}</span>
          </span>
        )}
      </div>
      {g.status === 'open' && <Invite g={g} me={me} act={act} game="battleship" now={now} mv={mv} />}
      {g.status === 'placing' && (
        <div className="bs-news">
          <b>{player ? (placed ? `Ships placed. Waiting for ${first(me === g.a ? g.b : g.a)}…` : 'Place your ships to start') : 'Placing ships…'}</b>
        </div>
      )}
      {news && (
        <div className={`bs-news ${news.tone}`}>
          <b>{news.head}</b>
          <span className="small muted">{news.sub}</span>
        </div>
      )}
      {boards && (
        <div className="bs-minis" aria-hidden={g.status === 'playing' ? 'true' : undefined}>
          {[g.a, g.b].map((n) => {
            const b = boardInfo(g, n, g.fleets ? bs.parseFleet(g.fleets[n]) : null);
            return <Board key={n} info={b.info} sig={b.sig} label={n === me ? 'Your waters' : `${first(n)}’s waters`} className="mini" />;
          })}
        </div>
      )}
      {g.status !== 'open' && (
        <div className="bs-card-actions">
          <button type="button" className={`btn big-btn game-open${player && g.status !== 'done' ? ' primary' : ''}`} onClick={open}>
            <Icon name={player || g.status === 'done' ? 'expand' : 'eye'} /> {label}
          </button>
          {late && player && g.turn !== me && (
            <button type="button" className="btn" onClick={() => act('claim')}>
              Claim the win
            </button>
          )}
        </div>
      )}
      <Result g={g} Name={Name} />
      {g.status === 'done' && g.how === 'noplace' && <div className="muted small">Nobody placed their ships in time.</div>}
      {g.status === 'done' && g.winner && g.winner !== BOT && g.how === 'sunk' && (
        <div className="muted tiny">Sank the whole fleet: {g.b === BOT ? 2 : 3} coins.</div>
      )}
      {g.status === 'done' && player && onRematch && <Rematch g={g} me={me} onRematch={onRematch} />}
    </div>
  );
}

// Play again, with the rules picked here (the challenger picks).
function Rematch({ g, me, onRematch }) {
  const [mode, setMode] = useState(modeOf(g));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const other = me === g.a ? g.b : g.a;
  const go = async () => {
    setBusy(true);
    setNote('');
    const r = await onRematch([other === BOT ? 'Trotbot' : `@${other}`, ...(g.bet ? [String(g.bet)] : []), mode]);
    setBusy(false);
    if (r?.note) setNote(r.note.title || 'That didn’t go through.');
  };
  return (
    <div className="bs-rematch">
      <ModePicker value={mode} onChange={setMode} />
      <button type="button" className="btn" disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={go}>
        <Icon name="repeat" /> {busy ? 'Sending…' : `Rematch ${first(other)}`}
        {g.bet ? <span className="muted small"> · <CoinNum n={g.bet} /> each</span> : null}
      </button>
      {note && <div className="casino-error small">{note}</div>}
    </div>
  );
}
export function ModePicker({ value, onChange }) {
  return (
    <div className="segmented bs-modes" role="radiogroup" aria-label="Rules">
      {Object.entries(BS_MODES).map(([k, x]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={`plain-seg${value === k ? ' on' : ''}`} onClick={() => onChange(k)} title={x.rules}>
          {x.label}
        </button>
      ))}
    </div>
  );
}

// ---------- the game view ----------

export function BattleshipView({ g, me, act, Name, now, mv, msgId }) {
  const player = me === g.a || me === g.b;
  const other = me === g.a ? g.b : g.a;
  const placed = (g.placed || []).includes(me);
  const mineText = useMyFleet(msgId, g, me, (move) => act(move, true));
  const myShips = useMemo(() => (mineText ? bs.parseFleet(mineText) : null), [mineText]);
  const myTurn = g.status === 'playing' && g.turn === me;
  const late = g.status === 'playing' && now - g.lastAt > TIMES.turn;
  const pendingShot = /^fire:\d+$/.test(mv.pending || '') ? +mv.pending.slice(5) : null;
  const tap = useStable((i) => {
    if (!myTurn || g.shots?.[other]?.[i] !== '.') return;
    mv.send(`fire:${i}`);
  });
  const resign = async () => {
    const ok = await confirmDialog({ title: 'Resign this game?', body: withExact(`${first(other)} wins${g.bet ? ` both bets (${coinStyled(g.bet * 2)} coins)` : ''}.`, g.bet ? g.bet * 2 : 0), okLabel: 'Resign', danger: true });
    if (ok) act('resign');
  };

  if (g.status === 'open')
    return (
      <div className="bs-view">
        <div className="bs-view-top">
          <Versus g={g} Name={Name} />
        </div>
        <Invite g={g} me={me} act={act} game="battleship" now={now} mv={mv} />
      </div>
    );

  if (g.status === 'placing' && player && !placed)
    return (
      <div className="bs-view placing">
        <div className="bs-view-top">
          <Versus g={g} Name={Name} />
        </div>
        <Placer mv={mv} msgId={msgId} me={me} placeBy={g.placeBy} now={now} onResign={resign} />
      </div>
    );

  const done = g.status === 'done';
  const news = g.status === 'playing' ? bsNews(g, me) : null;
  const fleets = g.fleets ? Object.fromEntries(Object.entries(g.fleets).map(([n, t]) => [n, bs.parseFleet(t)])) : {};
  // The board you fire at: shots at them, their ships only once it's over.
  const target = player && g.shots && boardInfo(g, other, fleets[other], (i, c) => ({ pending: pendingShot === i, off: !myTurn || c !== '.' }));
  const yours = player && boardInfo(g, me, fleets[me] || myShips);
  return (
    <div className={`bs-view${player ? ' player' : ' watching'}${done ? ' done' : ''}`}>
      <div className="bs-view-top">
        <Versus g={g} Name={Name} />
      </div>
      {g.status === 'placing' ? (
        <div className="bs-news">
          <b>{player ? `Ships placed. Waiting for ${first(other)}…` : 'Placing ships…'}</b>
          <span className="small muted">
            {BS_MODES[modeOf(g)].rules}. Starts when both fleets are in · <span className="mono">{clock(g.placeBy - now)}</span>
          </span>
        </div>
      ) : news ? (
        <div className={`bs-news fixed ${news.tone}${pendingShot != null ? ' firing' : ''}`} aria-live="polite">
          <b>{pendingShot != null ? `Firing at ${sq(pendingShot)}…` : news.head}</b>
          <span className="small muted">{mv.error ? <span className="casino-error">{mv.error}</span> : news.sub}</span>
        </div>
      ) : (
        <div className="bs-news fixed">
          <Result g={g} Name={Name} />
          {g.how === 'noplace' && <span className="muted small">Nobody placed their ships in time.</span>}
        </div>
      )}
      {g.status === 'placing' ? (
        player && myShips && (
          <div className="bs-view-boards one">
            <Board {...boardInfo(g, me, myShips)} label="Your fleet" className="yours" />
          </div>
        )
      ) : player && g.shots ? (
        <div className="bs-view-boards">
          <div className="bs-target-wrap">
            <Board
              {...target}
              board="target"
              label={done ? `${first(other)}’s fleet` : `${first(other)}’s waters`}
              aria={myTurn ? `${first(other)}’s waters: tap a square to fire` : `${first(other)}’s waters`}
              className={`target${!myTurn && !done ? ' waiting' : ''}`}
              busy={pendingShot != null}
              onTap={done ? null : tap}
            />
            <Fleet sunk={g.sunk?.[other]} short />
          </div>
          <div className="bs-yours-wrap">
            <Board {...yours} label="Your fleet" className="yours" />
            <Fleet sunk={g.sunk?.[me]} short={done} />
          </div>
        </div>
      ) : g.shots ? (
        <div className="bs-view-boards two">
          {[g.a, g.b].map((n) => (
            <div key={n} className="bs-watch-wrap">
              <Board {...boardInfo(g, n, fleets[n])} label={`${first(n)}’s fleet`} className="watch" />
              <Fleet sunk={g.sunk?.[n]} short />
            </div>
          ))}
        </div>
      ) : null}
      {g.status === 'playing' || (g.status === 'placing' && player) ? (
        <div className="bs-view-actions">
          {g.status === 'playing' && (
            <span className="small muted">
              {g.turn === me ? 'Your turn' : `${first(g.turn)}’s turn`}
              {!late && (
                <>
                  {' '}
                  · <span className="mono">{clock(g.lastAt + TIMES.turn - now)}</span>
                </>
              )}
            </span>
          )}
          <span className="grow" />
          {late && player && g.turn !== me && (
            <button type="button" className="btn primary" onClick={() => act('claim')}>
              Claim the win
            </button>
          )}
          {player && (
            <button type="button" className="link-btn small" onClick={resign}>
              Resign
            </button>
          )}
        </div>
      ) : null}
      {done && (
        <>
          {g.winner && g.winner !== BOT && g.how === 'sunk' && <div className="muted tiny">Sank the whole fleet: {g.b === BOT ? 2 : 3} coins.</div>}
        </>
      )}
    </div>
  );
}

// ---------- placing your fleet ----------

function toSpec(cells) {
  const down = cells.length > 1 && cells[1] - cells[0] === N;
  return { x: cells[0] % N, y: Math.floor(cells[0] / N), down };
}
const lenOf = (k) => bs.FLEET[k][1];
const cellsOf = (s, k) => bs.shipCells(s.x, s.y, s.down, lenOf(k));
// Ship k with its first square at i (pulled back onto the board if it would hang off).
function specAt(k, i, down) {
  const len = lenOf(k);
  return { x: Math.min(i % N, N - (down ? 1 : len)), y: Math.min(Math.floor(i / N), N - (down ? len : 1)), down };
}

// Tap a ship, then tap where it goes; tap it again to turn it. Dragging works
// too. Every change is checked first: a spot that doesn't fit flashes red and
// nothing moves.
function Placer({ mv, msgId, me, placeBy, now, onResign }) {
  const [ships, setShips] = useState(() => bs.randomFleet().map(toSpec));
  const [sel, setSel] = useState(-1);
  const [flash, setFlash] = useState(null); // { cells, at } a spot that didn't fit
  const [hover, setHover] = useState(null); // the square under the mouse (a preview)
  const [drag, setDrag] = useState(null); // { k, spec } while dragging
  const [hint, setHint] = useState('');
  const gridRef = useRef(null);
  const press = useRef(null);
  const suppress = useRef(false);
  const all = ships.map(cellsOf);
  const owner = (i) => all.findIndex((cs) => cs?.includes(i));
  const fits = (k, spec) => {
    const cs = cellsOf(spec, k);
    return !!cs && !cs.some((c) => all.some((o, j) => j !== k && o?.includes(c)));
  };
  const flashBad = (k, spec, text) => {
    const cs = bs.shipCells(spec.x, spec.y, spec.down, lenOf(k)) || [];
    setFlash({ cells: cs, at: Date.now() });
    setHint(text);
  };
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [flash]);
  const move = (k, spec) => {
    setShips((list) => list.map((s, j) => (j === k ? spec : s)));
    setHint('');
  };
  const name = (k) => bs.FLEET[k][0];
  const tap = useStable((i) => {
    if (suppress.current) return;
    const k = owner(i);
    if (sel < 0 || (k >= 0 && k !== sel)) {
      if (k >= 0) {
        setSel(k);
        setHint(`${name(k)} picked. Tap a square to move it, or tap it again to turn it.`);
      } else setHint('Tap a ship first, then tap where it goes.');
      return;
    }
    if (k === sel) {
      // Turn it around the square you tapped (or around its end if that doesn't fit).
      const s = ships[k];
      const down = !s.down;
      const off = s.down ? Math.floor(i / N) - s.y : (i % N) - s.x;
      const pivot = down ? specAt(k, Math.max(0, Math.floor(i / N) - off) * N + (i % N), down) : specAt(k, Math.floor(i / N) * N + Math.max(0, (i % N) - off), down);
      const base = specAt(k, s.y * N + s.x, down);
      const spec = fits(k, pivot) ? pivot : fits(k, base) ? base : null;
      if (spec) move(k, spec);
      else flashBad(k, pivot, `No room to turn the ${name(k)} there.`);
      return;
    }
    // Its first square where you tapped; if that doesn't fit, slid back so it
    // still covers the square you tapped.
    const down = ships[sel].down;
    const spec = specAt(sel, i, down);
    const tries = Array.from({ length: lenOf(sel) }, (_, off) => {
      const x = (i % N) - (down ? 0 : off);
      const y = Math.floor(i / N) - (down ? off : 0);
      return x < 0 || y < 0 ? null : specAt(sel, y * N + x, down);
    }).filter((t) => t && cellsOf(t, sel)?.includes(i));
    const ok = [spec, ...tries].find((t) => fits(sel, t));
    if (ok) move(sel, ok);
    else flashBad(sel, spec, `The ${name(sel)} doesn’t fit there.`);
  });
  // Dragging (an extra): press a ship and move; it follows the finger, red where it won't fit.
  const cellAt = (e) => {
    const r = gridRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * N);
    return x < 0 || y < 0 || x >= N || y >= N ? null : { x, y };
  };
  const onPointerDown = useStable((e) => {
    const p = cellAt(e);
    const k = p ? owner(p.y * N + p.x) : -1;
    press.current = k >= 0 ? { k, p, x: e.clientX, y: e.clientY, id: e.pointerId, start: ships[k] } : null;
  });
  const onPointerMove = useStable((e) => {
    const d = press.current;
    if (!d) {
      if (e.pointerType === 'mouse') {
        const p = cellAt(e);
        setHover(p ? p.y * N + p.x : null);
      }
      return;
    }
    if (!drag && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
    gridRef.current.setPointerCapture?.(e.pointerId);
    const p = cellAt(e) || d.p;
    const len = lenOf(d.k);
    const x = Math.max(0, Math.min(N - (d.start.down ? 1 : len), d.start.x + p.x - d.p.x));
    const y = Math.max(0, Math.min(N - (d.start.down ? len : 1), d.start.y + p.y - d.p.y));
    setSel(d.k);
    setDrag({ k: d.k, spec: { x, y, down: d.start.down } });
  });
  const onPointerUp = useStable(() => {
    press.current = null;
    if (!drag) return;
    suppress.current = true;
    setTimeout(() => (suppress.current = false), 0);
    if (fits(drag.k, drag.spec)) move(drag.k, drag.spec);
    else flashBad(drag.k, drag.spec, `The ${name(drag.k)} doesn’t fit there.`);
    setDrag(null);
  });
  const onPointerCancel = useStable(() => {
    press.current = null;
    setDrag(null);
  });
  const onPointerLeave = useStable(() => setHover(null));
  // What the board shows: ships, the picked one, and a preview (drag, or the mouse).
  const preview = drag
    ? { k: drag.k, spec: drag.spec }
    : hover != null && sel >= 0 && owner(hover) < 0
      ? { k: sel, spec: specAt(sel, hover, ships[sel].down) }
      : null;
  const previewCells = preview ? cellsOf(preview.spec, preview.k) || [] : [];
  const previewOk = preview ? fits(preview.k, preview.spec) : true;
  const flashSet = new Set(flash?.cells || []);
  const info = [];
  for (let i = 0; i < N * N; i++) {
    const k = owner(i);
    const inPreview = previewCells.includes(i);
    info.push({
      ship: k >= 0 && !(drag && k === drag.k),
      pick: k >= 0 && k === sel && !drag,
      ghost: inPreview && previewOk,
      bad: (inPreview && !previewOk) || flashSet.has(i),
    });
  }
  const sig = `${info.map((x) => `${+x.ship}${+x.pick}${+x.ghost}${+x.bad}`).join('')}`;
  const text = ships.map((s) => `${s.x},${s.y},${s.down ? 1 : 0}`).join(';');
  const pending = mv.pending != null && mv.pending.startsWith('place:');
  const ready = async () => {
    // Your fleet is known at once (the server keeps the same one).
    rememberFleet(msgId, me, text);
    const r = await mv.send(`place:${text}`);
    if (r && !r.ok) rememberFleet(msgId, me, null);
  };
  return (
    <div className="bs-place">
      <div className="bs-news fixed" aria-live="polite">
        <b>Place your fleet</b>
        <span className={`small${flash ? ' bs-bad-text' : ' muted'}`}>{mv.error ? <span className="casino-error">{mv.error}</span> : hint || 'Tap a ship, then tap where it goes. Tap it again to turn it.'}</span>
      </div>
      <Board
        info={info}
        sig={sig}
        board="place"
        className="placing"
        gridRef={gridRef}
        aria="Your fleet: tap a ship, then a square"
        onTap={tap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
      />
      <div className="bs-dock" role="group" aria-label="Ships">
        {bs.FLEET.map(([label, len], k) => (
          <button
            key={label}
            type="button"
            className={`bs-dock-ship${sel === k ? ' on' : ''}`}
            aria-pressed={sel === k}
            onClick={() => {
              setSel(sel === k ? -1 : k);
              setHint(sel === k ? '' : `${label} picked. Tap a square to move it.`);
            }}
          >
            <span className="bs-pips" aria-hidden="true">
              {Array.from({ length: len }, (_, j) => (
                <i key={j} />
              ))}
            </span>
            {label}
          </button>
        ))}
      </div>
      <div className="bs-place-actions">
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => {
            if (sel >= 0) {
              const k = sel;
              const s = ships[k];
              const spec = specAt(k, s.y * N + s.x, !s.down);
              if (fits(k, spec)) move(k, spec);
              else flashBad(k, spec, `No room to turn the ${name(k)} there.`);
            }
          }}
          style={{ visibility: sel >= 0 ? 'visible' : 'hidden' }}
          aria-hidden={sel < 0 ? 'true' : undefined}
          tabIndex={sel < 0 ? -1 : undefined}
        >
          <Icon name="rotateCw" /> Turn
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => {
            setShips(bs.randomFleet().map(toSpec));
            setSel(-1);
            setHint('');
          }}
        >
          <Icon name="shuffle" /> Shuffle
        </button>
        <span className="grow" />
        <button type="button" className={`btn primary cz-act${pending ? ' is-pending' : ''}`} disabled={pending} aria-busy={pending ? 'true' : undefined} onClick={ready}>
          {pending ? 'Sending…' : 'Ready'}
          {pending && <span className="cz-spin" aria-hidden="true" />}
        </button>
      </div>
      <div className="bs-view-actions">
        <span className="small muted">
          Both fleets in within <span className="mono">{clock(placeBy - now)}</span>
        </span>
        <span className="grow" />
        <button type="button" className="link-btn small" onClick={onResign}>
          Resign
        </button>
      </div>
    </div>
  );
}
