import { useEffect, useRef, useState } from 'react';
import { ROUNDS, canPick, endLine, movesOf, moveTip, roundLines, unlockedMoves } from '../../../functions/shared/battles.js';
import { BattlePet, KIND_ICON } from '../PetBattle.jsx';
import { Icon } from '../shell/icons.jsx';
import { Amt } from './Casino.jsx';
import { BetPill, Invite } from './Arcade.jsx';
import '../petBattle.css';

// A pet battle's card in #arcade (3.3). Two pets on a little practice field
// (red alliance on the left, blue on the right), their health bars, and the
// last round: each pet's move in a short line, with the hit, the shield or
// the dodge played out when it happens while the card is on screen. The two
// players pick a move each round (hidden until both picked or the time is
// up); anyone else watches. The server works out every round
// (functions/shared/battles.js); the card only shows it and sends picks.

const first = (n = '') => n.split(' ')[0];
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};

function Health({ side, k }) {
  const share = side.max ? side.hp / side.max : 0;
  const tone = share > 0.5 ? 'ok' : share > 0.2 ? 'mid' : 'low';
  return (
    <div className={`bt-hp ${tone}`} role="meter" aria-label={`${side.name}’s health`} aria-valuenow={side.hp} aria-valuemin={0} aria-valuemax={side.max}>
      <span className="bt-hp-bar">
        <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, share))})`, transformOrigin: k ? 'right' : 'left' }} />
      </span>
      <span className="bt-hp-num mono">
        {side.hp}/{side.max}
      </span>
    </div>
  );
}

// What floats over a pet after a round: the damage it took (from the other
// pet's attack, or bounced back at it by a shield or a dodge), health it got
// back, and the shield, dodge or miss that kept it safe.
function pops(entry, k) {
  if (!entry) return [];
  const mine = k ? entry.b : entry.a;
  const theirs = k ? entry.a : entry.b;
  const out = [];
  if (theirs.dmg) out.push({ t: `−${theirs.dmg}`, c: theirs.crit ? 'crit' : 'dmg' });
  if (theirs.back) out.push({ t: `−${theirs.back}`, c: 'dmg' });
  if (mine.healed) out.push({ t: `+${mine.healed}`, c: 'heal' });
  if (theirs.out === 'dodged') out.push({ t: 'Dodged', c: 'note' });
  if (theirs.out === 'blocked') out.push({ t: 'Shield', c: 'note' });
  if (theirs.out === 'miss') out.push({ t: 'Missed', c: 'note' });
  if (theirs.dazes) out.push({ t: 'Dazed', c: 'note' });
  return out;
}

export function PetBattleCard({ g, me, act, Name, now, mv }) {
  const player = me === g.a || me === g.b;
  const myKey = me === g.a ? 'pa' : 'pb';
  const log = g.log || [];
  const last = log[log.length - 1] || null;
  // Rounds that come in while the card is on screen play out; ones from
  // before just show.
  const [seen] = useState(() => log.length);
  const animate = log.length > seen;
  // The move I picked this round (the server keeps picks hidden, even mine).
  const [picked, setPicked] = useState(null);
  const mine = picked && picked.round === g.round ? picked.i : null;
  const [showAll, setShowAll] = useState(false);
  const liveRef = useRef(null);
  useEffect(() => {
    if (animate && liveRef.current) liveRef.current.scrollIntoView?.({ block: 'nearest' });
  }, [log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const playing = g.status === 'playing';
  const done = g.status === 'done';
  const sideBox = (k) => {
    const side = k ? g.pb : g.pa;
    const owner = k ? g.b : g.a;
    const part = last ? (k ? last.b : last.a) : null;
    const hitBy = last ? (k ? last.a : last.b) : null;
    const won = done && g.winner === owner;
    const cls = [
      'bt-side',
      k ? 'blue' : 'red',
      won ? 'won' : '',
      done && g.winner && !won ? 'lost' : '',
      animate && part && ['hit', 'blocked'].includes(part.out) ? 'lunge' : '',
      animate && hitBy && ['hit', 'blocked'].includes(hitBy.out) ? 'shake' : '',
      animate && part?.out === 'guard' ? 'shield' : '',
      animate && part?.out === 'dodge' ? 'dodge' : '',
      animate && part?.out === 'heal' ? 'heal' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const low = side.hp / side.max <= 0.25;
    return (
      <div className={cls} key={`${k}-${log.length}`}>
        <span className="bt-owner">
          <Name name={owner} />
        </span>
        <span className="bt-stage">
          <BattlePet owner={owner} side={side} size={68} mood={side.hp <= 0 || low ? 'sad' : 'happy'} />
          {animate && (
            <span className="bt-pops" aria-hidden="true">
              {pops(last, k).map((p, i) => (
                <span key={i} className={`bt-pop ${p.c}`} style={{ '--i': i }}>
                  {p.t}
                </span>
              ))}
            </span>
          )}
          {playing && side.skip === g.round && <span className="bt-dazed">Dazed</span>}
        </span>
        <b className="bt-name">{side.name}</b>
        <span className="muted tiny">
          Level <span className="mono">{side.level}</span>
        </span>
        <Health side={side} k={k} />
      </div>
    );
  };

  // My move buttons this round.
  const moves = () => {
    const side = g[myKey];
    const can = canPick(side, g.round);
    if (side.skip === g.round) return <p className="bt-wait small">{side.name} is dazed and sits this round out.</p>;
    if (mine !== null || (g.picked || []).includes(me)) {
      const name = mine !== null ? movesOf(side.species)[mine]?.name : '';
      const other = me === g.a ? g.b : g.a;
      return (
        <p className="bt-wait small">
          {name ? (
            <>
              You picked <b>{name}</b>.{' '}
            </>
          ) : null}
          {(g.picked || []).includes(other) ? 'Working it out…' : `Waiting for ${first(other)}…`}
        </p>
      );
    }
    return (
      <div className="bt-moves" role="group" aria-label="Pick a move">
        {unlockedMoves(side.species, side.level).map((m) => {
          const resting = !can.includes(m.i);
          const pending = mv.pending === `m${m.i}`;
          return (
            <button
              key={m.i}
              type="button"
              className={`bt-move k-${m.kind}${pending ? ' is-pending' : ''}`}
              disabled={resting || (mv.pending != null && !pending)}
              onClick={() => {
                setPicked({ round: g.round, i: m.i });
                act(`m${m.i}`);
              }}
              title={moveTip(m, side.level)}
            >
              <span className="bt-move-name">
                <Icon name={KIND_ICON[m.kind]} size={14} /> {m.name}
              </span>
              <span className="bt-move-tip">{resting ? 'Needs a breather' : m.short}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const lines = last ? roundLines(last, g.pa, g.pb) : [];
  const left = (g.roundEnds || 0) - now;
  return (
    <div className="arc-battle">
      <div className="bt-top">
        <span className="cz-label">
          <Icon name="bolt" size={13} /> Pet battle
        </span>
        {playing && (
          <span className="bt-round mono">
            Round {g.round} of {ROUNDS}
          </span>
        )}
        <BetPill each={g.bet} pot={2 * g.bet} />
      </div>
      <div className={`bt-field${animate ? ' fresh' : ''}`}>
        {sideBox(0)}
        <span className="bt-vs" aria-hidden="true">
          vs
        </span>
        {sideBox(1)}
      </div>
      {lines.length > 0 && (
        <div className="bt-lines" ref={liveRef} aria-live="polite" key={log.length}>
          <span className="bt-lines-cap tiny">Round {last.r}</span>
          {lines.map((l, i) => (
            <p key={i} className={`bt-line ${i ? 'blue' : 'red'}${animate ? ' in' : ''}`} style={{ '--i': i }}>
              {l}
            </p>
          ))}
        </div>
      )}
      {g.status === 'open' && (
        <>
          <p className="muted small">
            {first(g.a)}’s {g.pa.name} wants to battle {first(g.b)}’s {g.pb.name}. A battle never changes the pets.
          </p>
          <Invite g={g} me={me} act={act} game="battle" now={now} mv={mv} />
        </>
      )}
      {playing && (
        <div className="bt-controls">
          {player ? moves() : <p className="bt-wait small">Both are picking…</p>}
          <span className="muted tiny bt-clock">
            {clock(left)} left{player ? ' · no pick, one is picked for you' : ''}
            {player && (
              <>
                {' · '}
                <button type="button" className="link-btn tiny" disabled={mv.pending != null} onClick={() => act('resign')}>
                  Give up
                </button>
              </>
            )}
          </span>
        </div>
      )}
      {done && (
        <div className={`arc-result bt-end${g.winner ? ' win' : ''}`}>
          {g.winner ? '🏆 ' : ''}
          {endLine(g)}
          {g.winner && g.bet > 0 && (
            <span className="muted small">
              {' '}
              · {first(g.winner)} takes <Amt n={2 * g.bet} />
            </span>
          )}
        </div>
      )}
      {log.length > 1 && (
        <div className="bt-log">
          <button type="button" className="link-btn tiny" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
            {showAll ? 'Hide the rounds' : `Every round (${log.length})`}
          </button>
          {showAll && (
            <ol className="bt-log-list">
              {log.map((e) => (
                <li key={e.r}>
                  <span className="mono tiny bt-log-r">{e.r}</span>
                  <span className="small">{roundLines(e, g.pa, g.pb).join(' ')}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {playing && !player && g.picked?.length ? <span className="muted tiny">{g.picked.map(first).join(' and ')} picked.</span> : null}
    </div>
  );
}

