import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, CloseIcon, Overlay } from '../common.jsx';
import { Icon } from '../shell/icons.jsx';
import CountUp from '../CountUp.jsx';
import { celebrate } from '../../motion.js';
import { useEscape } from '../../util.js';
import * as fun from '../../../functions/shared/funGames.js';
import * as T from '../../../functions/shared/tetris.js';
import * as M from '../../../functions/shared/minesweeper.js';
import { onOpenGame } from './launch.js';
import TetrisPlay, { boardText } from './TetrisPlay.jsx';
import MinesPlay, { minesText } from './MinesPlay.jsx';

// The Tetris and Minesweeper screen (one at a time, over everything). It
// starts each game on the server (funGame: the seed), plays it here, and
// sends the moves back; what it shows at the end is what the server
// checked, including any coins.

const SPEED_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const LEVEL_KEYS = Object.keys(M.LEVELS);

export default function GameHost({ api, actor, roster, isOn = () => true }) {
  const [open, setOpen] = useState(null);
  useEffect(() => onOpenGame((o) => setOpen({ ...o, key: Date.now() })), []);
  if (!open) return null;
  return (
    <Overlay>
      <FunGame key={open.key} start={open} api={api} actor={actor} roster={roster} isOn={isOn} onClose={() => setOpen(null)} />
    </Overlay>
  );
}

function FunGame({ start, api, actor, roster, isOn, onClose }) {
  const [game, setGame] = useState(start.game || 'tetris');
  // What's being played: { mode, level, speed, race, tournament } (null: the picker).
  const [pick, setPick] = useState(start.mode ? { mode: start.mode, level: start.level, speed: start.speed, race: start.race, tournament: start.tournament } : null);
  const [phase, setPhase] = useState(start.mode ? 'count' : 'pick');
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);
  const playing = phase === 'play';
  useEscape(() => !playing && onClose());

  const begin = (p) => {
    setPick(p);
    setError('');
    setResult(null);
    setSession(null);
    setPhase('count');
    setRound((n) => n + 1);
  };
  const toPicker = () => {
    setPhase('pick');
    setPick(null);
    setSession(null);
    setResult(null);
  };

  // After the countdown: ask the server for the game (its seed).
  const launch = async () => {
    const r = await api.funGame({ action: 'start', game, mode: pick.mode, level: pick.level, speed: pick.speed, race: pick.race, tournament: pick.tournament });
    if (!r?.ok) {
      setError(r?.note ? `${r.note.title}${r.note.body ? ` ${r.note.body}` : ''}` : 'That didn’t start. Try again.');
      setPhase(start.mode && round <= 1 && !pick.tournament ? 'error' : 'pick');
      return;
    }
    setSession({ ...r, game, mode: pick.mode });
    setPhase('play');
  };

  const finish = async ({ moves, summary }) => {
    setPhase('sending');
    const req = { id: session.id, moves };
    const r =
      session.mode === 'tournament'
        ? await api.submitTournamentScore({ id: pick.tournament, moves, session: session.id })
        : await api.funGame({ action: 'finish', ...req });
    setResult({ ...r, local: summary });
    setPhase('done');
    if (r?.won || (r?.ok && summary.won) || (r?.ok && summary.finished && session.mode === 'sprint')) celebrate();
  };

  const title = fun.GAME_LABEL[game];
  return (
    <div className={`panel-backdrop center fun-backdrop${playing ? ' playing' : ''}`}>
      <div className={`dialog fun-dialog fun-${game}${playing ? ' playing' : ''}`} role="dialog" aria-label={title}>
        <div className="panel-head fun-head">
          <span className="fun-title">
            <Icon name={game === 'tetris' ? 'blocks' : 'mine'} /> <b>{title}</b>
            {pick && <span className="muted small"> · {modeLabel(game, pick)}</span>}
          </span>
          <span className="spacer" />
          {!playing && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          )}
        </div>
        {phase === 'pick' && (
          <Picker game={game} setGame={setGame} api={api} actor={actor} roster={roster} isOn={isOn} onPlay={begin} error={error} onClose={onClose} conv={start.conv} />
        )}
        {phase === 'error' && (
          <div className="fun-msg">
            <b>{error}</b>
            <button className="btn" onClick={toPicker}>
              Back to games
            </button>
          </div>
        )}
        {phase === 'count' && <Countdown key={round} until={pick.race?.startAt} onDone={launch} />}
        {phase === 'play' && session && <Play game={game} session={session} pick={pick} api={api} actor={actor} onEnd={finish} />}
        {phase === 'sending' && (
          <div className="fun-msg">
            <b>Checking your game…</b>
            <span className="muted small">The server replays every move.</span>
          </div>
        )}
        {phase === 'done' && (
          <Result
            game={game}
            session={session}
            pick={pick}
            result={result}
            conv={start.conv}
            api={api}
            onAgain={() => begin({ ...pick, race: null })}
            onPicker={toPicker}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

const modeLabel = (game, p) =>
  [
    fun.MODES[game][p.mode],
    game === 'minesweep' && p.level ? M.LEVELS[p.level]?.label : '',
    p.mode === 'bot' ? SPEED_LABEL[p.speed || 'medium'] : '',
  ]
    .filter(Boolean)
    .join(' · ');

function Countdown({ until, onDone }) {
  const end = useRef(Math.max(Date.now() + 2400, until || 0));
  const [left, setLeft] = useState(3);
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      const ms = end.current - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 800)));
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(t);
        onDone();
      }
    }, 100);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fun-count" aria-live="polite">
      <span key={left} className="fun-count-n mono">
        {left || 'Go'}
      </span>
    </div>
  );
}

function Picker({ game, setGame, api, actor, roster, isOn, onPlay, error, onClose, conv }) {
  const [level, setLevel] = useState('beginner');
  const [speed, setSpeed] = useState('medium');
  const [startLevel, setStartLevel] = useState(1);
  const [rival, setRival] = useState('');
  const [sent, setSent] = useState('');
  const [tournaments, setTournaments] = useState([]);
  useEffect(() => api.subscribeTournaments?.(setTournaments), [api]);
  const mine = tournaments.filter((t) => t.game === game && t.status === 'open' && t.endsAt > Date.now());
  const others = roster.filter((n) => n !== actor.name);
  const challenge = async () => {
    const args = [`@${rival}`, ...(game === 'minesweep' ? [level] : [])];
    const r = await api.play({ action: 'run', game, args, conv: 'arcade' });
    setSent(r?.note ? r.note.title : `Challenge sent to ${rival.split(' ')[0]} in #arcade.`);
  };
  const coinsOn = isOn('coins');
  const modes =
    game === 'tetris'
      ? [
          ['marathon', 'Marathon', 'Play until you top out. Faster every 10 lines.', coinsOn && 'Up to 4 coins'],
          ['sprint', 'Sprint', 'Clear 40 lines as fast as you can.', coinsOn && '2 coins'],
          ['ultra', 'Ultra', 'Most points in 2 minutes.', coinsOn && 'Up to 3 coins'],
        ]
      : [['solo', 'Solo', 'Your first tap is always safe.', coinsOn && (level === 'beginner' ? 'Practice' : `${level === 'expert' ? 5 : 2} coins for a win`)]];
  return (
    <div className="fun-pick">
      <div className="segmented fun-games" role="tablist">
        {fun.GAMES.map((g) => (
          <button key={g} role="tab" aria-selected={game === g} className={`plain-seg${game === g ? ' on' : ''}`} onClick={() => setGame(g)}>
            <Icon name={g === 'tetris' ? 'blocks' : 'mine'} /> {fun.GAME_LABEL[g]}
          </button>
        ))}
      </div>
      {error && <div className="casino-error">{error}</div>}
      {game === 'minesweep' && (
        <div className="fun-row">
          <span className="fun-cap">Board</span>
          <div className="chips">
            {LEVEL_KEYS.map((k) => (
              <button key={k} className={`chip${level === k ? ' on' : ''}`} onClick={() => setLevel(k)}>
                {M.LEVELS[k].label} <span className="muted mono">
                  {M.LEVELS[k].w}×{M.LEVELS[k].h}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <section className="fun-sec">
        <h3 className="fun-cap">Play alone</h3>
        <div className="fun-modes">
          {modes.map(([mode, label, desc, pay]) => (
            <button key={mode} className="fun-mode" onClick={() => onPlay({ mode, level: game === 'tetris' ? startLevel : level })}>
              <b>{label}</b>
              <span className="muted small">{desc}</span>
              {pay && <span className="fun-pay small">{pay}</span>}
            </button>
          ))}
        </div>
        {game === 'tetris' && (
          <div className="fun-row">
            <span className="fun-cap">Marathon starts at level</span>
            <div className="chips">
              {[1, 5, 10].map((n) => (
                <button key={n} className={`chip mono${startLevel === n ? ' on' : ''}`} onClick={() => setStartLevel(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="fun-sec">
        <h3 className="fun-cap">Race Trotbot</h3>
        <p className="muted small">
          {game === 'tetris' ? 'Same pieces, first to 40 lines.' : 'Same board, first to clear it.'} Trotbot’s board shows next to yours.
        </p>
        <div className="fun-row">
          <div className="chips">
            {fun.SPEEDS.map((s) => (
              <button key={s} className={`chip${speed === s ? ' on' : ''}`} onClick={() => setSpeed(s)}>
                {SPEED_LABEL[s]}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={() => onPlay({ mode: 'bot', speed, level })}>
            <Icon name="play" /> Race Trotbot
          </button>
        </div>
      </section>
      <section className="fun-sec">
        <h3 className="fun-cap">Race a teammate</h3>
        <p className="muted small">You both get the same {game === 'tetris' ? 'pieces' : 'board'} and see each other’s progress live. The winner gets 3 coins.</p>
        <div className="fun-people">
          {others.map((n) => (
            <button key={n} className={`fun-person${rival === n ? ' on' : ''}`} onClick={() => setRival(n)} aria-pressed={rival === n}>
              <Avatar name={n} size={28} />
              <span className="small">{n.split(' ')[0]}</span>
            </button>
          ))}
        </div>
        <div className="fun-row">
          <button className="btn" disabled={!rival} onClick={challenge}>
            Challenge {rival ? rival.split(' ')[0] : ''}
          </button>
          {sent && <span className="small muted">{sent}</span>}
        </div>
      </section>
      <section className="fun-sec">
        <h3 className="fun-cap">Tournaments</h3>
        {mine.length ? (
          mine.map((t) => <TournamentRow key={t.id} t={t} me={actor.name} onPlay={() => onPlay({ mode: 'tournament', tournament: t.id, level: t.level })} />)
        ) : (
          <p className="muted small">No {fun.GAME_LABEL[game]} tournament right now. Team management starts them in the market.</p>
        )}
      </section>
      {conv && conv !== 'arcade' && <p className="muted tiny">Results you post go to #{conv}.</p>}
      <div className="fun-row end">
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function TournamentRow({ t, me, onPlay }) {
  const ranked = Object.entries(t.players || {})
    .filter(([, p]) => p.best != null)
    .sort((a, b) => b[1].best - a[1].best);
  const joined = !!t.players?.[me];
  const myBest = t.players?.[me]?.best;
  const hours = Math.max(0, Math.round((t.endsAt - Date.now()) / 3600000));
  return (
    <div className="fun-tourney">
      <div className="grow">
        <b>{t.title}</b>
        <div className="muted small">
          Pot <span className="mono">{t.pot || 0}</span> coins · ends in <span className="mono">{hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours} h`}</span>
          {joined && (
            <>
              {' '}
              · your best <span className="mono">{fun.tournamentText(t.game, myBest)}</span>
            </>
          )}
        </div>
        {ranked.length > 0 && (
          <ol className="fun-ranks small">
            {ranked.slice(0, 3).map(([name, p]) => (
              <li key={name}>
                <Avatar name={name} size={18} /> {name.split(' ')[0]} <span className="mono muted">{fun.tournamentText(t.game, p.best)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {joined ? (
        <button className="btn primary" onClick={onPlay}>
          <Icon name="play" /> Play
        </button>
      ) : (
        <span className="muted small">Join in the market</span>
      )}
    </div>
  );
}

// One game on the board, with the other player's (or Trotbot's) picture.
function Play({ game, session, pick, api, actor, onEnd }) {
  const opts = useMemo(() => fun.gameOpts({ ...session, game }), [session, game]);
  const bot = useMemo(() => {
    if (session.mode !== 'bot') return null;
    return game === 'tetris'
      ? T.newBot({ seed: session.seed, pace: T.BOT_PACE[session.speed] })
      : M.newBot({ seed: session.seed, level: opts.level, pace: M.BOT_PACE[session.speed] });
  }, [session, game, opts]);
  const race = pick.race?.msgId;
  const [other, setOther] = useState(null);
  useEffect(() => {
    if (!race) return;
    return api.subscribeRaceLive(race, (list) => setOther(list.find((x) => x.name !== actor.name) || null));
  }, [race, api, actor.name]);
  // Your picture for the other player: at most twice a second.
  const sentAt = useRef(0);
  const pending = useRef(null);
  const send = (data, force) => {
    if (!race) return;
    pending.current = data;
    const go = () => {
      sentAt.current = Date.now();
      api.setRaceLive(race, pending.current);
      pending.current = null;
    };
    if (force || Date.now() - sentAt.current > 500) go();
    else setTimeout(() => pending.current && go(), 520);
  };
  const end = (r) => {
    if (race) {
      const s = r.summary;
      send(game === 'tetris' ? { game, board: '', score: s.score, lines: s.lines, cells: 0, over: s.over, done: true } : { game, board: '', score: 0, lines: 0, cells: s.cells, over: s.lost, done: true }, true);
    }
    onEnd(r);
  };
  const competitive = fun.COMPETITIVE.includes(session.mode);
  if (game === 'tetris')
    return (
      <TetrisPlay
        opts={opts}
        bot={bot}
        other={other}
        canPause={!competitive}
        onLock={(g) => send({ game, board: boardText(g.board), score: g.score, lines: g.lines, cells: 0, over: g.over, done: false })}
        onEnd={end}
      />
    );
  return (
    <MinesPlay
      opts={opts}
      bot={bot}
      other={other}
      onChange={(g) => send({ game, board: minesText(g), score: 0, lines: 0, cells: g.opened, over: g.lost, done: false })}
      onEnd={end}
    />
  );
}

function Result({ game, session, pick, result, conv, api, onAgain, onPicker, onClose }) {
  const [posted, setPosted] = useState('');
  const r = result || {};
  const s = r.result || r.local || {};
  const mode = session?.mode;
  if (r.note)
    return (
      <div className="fun-msg">
        <b>{r.note.title}</b>
        {r.note.body && <span className="muted small">{r.note.body}</span>}
        <div className="fun-row">
          <button className="btn primary" onClick={onAgain}>
            Play again
          </button>
          <button className="btn" onClick={onPicker}>
            All games
          </button>
        </div>
      </div>
    );
  const won = mode === 'bot' ? r.won : game === 'minesweep' ? s.won : mode === 'sprint' || mode === 'race' ? s.finished : null;
  const headline =
    mode === 'bot'
      ? r.won
        ? 'You beat Trotbot!'
        : 'Trotbot wins this one'
      : mode === 'race'
        ? 'Sent in'
        : mode === 'tournament'
          ? r.improved
            ? 'New best!'
            : 'Counted'
          : game === 'minesweep'
            ? s.won
              ? 'Cleared!'
              : 'Boom.'
            : s.reason === 'topout'
              ? 'Topped out'
              : 'Game over';
  const share = conv && (mode === 'solo' || mode === 'marathon' || mode === 'sprint' || mode === 'ultra' || mode === 'bot');
  const post = async () => {
    const out = await api.funGame({ action: 'share', id: session.id, conv });
    setPosted(out?.note ? out.note.title : `Posted to #${conv}`);
  };
  return (
    <div className="fun-result">
      <div className={`fun-headline${won ? ' won' : ''}`}>{headline}</div>
      <div className="fun-line">{fun.resultLine(game, mode === 'tournament' ? (game === 'tetris' ? 'ultra' : 'solo') : mode, s)}</div>
      {game === 'tetris' && (mode === 'marathon' || mode === 'ultra' || mode === 'tournament') && (
        <div className="fun-big mono">
          <CountUp value={s.score || 0} format={(n) => Math.round(n).toLocaleString('en-US')} />
        </div>
      )}
      {r.bot && (
        <div className="fun-vs small">
          <span>
            You: <b className="mono">{fun.resultLine(game, 'bot', s)}</b>
          </span>
          <span>
            Trotbot: <b className="mono">{fun.resultLine(game, 'bot', r.bot)}</b>
          </span>
        </div>
      )}
      {mode === 'tournament' && r.ok && (
        <div className="small">
          Your best: <b className="mono">{r.bestText}</b>
        </div>
      )}
      {mode === 'race' && <div className="small muted">The race card in #arcade shows who won once you’re both done.</div>}
      {r.paid > 0 && (
        <div className="fun-coins">
          +<CountUp value={r.paid} /> coins
        </div>
      )}
      {r.coins > 0 && !r.paid && <div className="muted small">That’s all the game coins for today.</div>}
      <div className="fun-row">
        {mode !== 'race' && (
          <button className="btn primary" onClick={onAgain}>
            <Icon name="repeat" /> Play again
          </button>
        )}
        {share && !posted && (
          <button className="btn" onClick={post}>
            Post to #{conv}
          </button>
        )}
        {posted && <span className="small muted">{posted}</span>}
        <button className="btn" onClick={onPicker}>
          All games
        </button>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
