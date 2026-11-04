import { isLive } from '../../../functions/shared/arcade.js';
import * as fun from '../../../functions/shared/funGames.js';
import { LEVELS } from '../../../functions/shared/minesweeper.js';
import { Icon } from '../shell/icons.jsx';
import { openGame } from '../games/launch.js';
import { Invite, Result, Versus, Who } from './Arcade.jsx';

// Cards for the newer #arcade games: Tetris and Minesweeper races (each
// player plays on the game screen; the card keeps score), and a posted Tetris
// or Minesweeper result. (Battleship is in Battleship.jsx.)

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
          {c.won ? 'Beat' : 'Lost to'} Trotbot ({fun.botLabel(c)}): <span className="mono">{c.bot.line}</span>
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
        {tetris
          ? 'Same pieces. First to clear 40 lines wins.'
          : `Same ${LEVELS[g.level || 'beginner'].label.toLowerCase()} board. Fastest clear wins.`}
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
