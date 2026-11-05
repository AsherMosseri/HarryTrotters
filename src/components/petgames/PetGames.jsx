import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RALLY_COUNT, RALLY_LEVELS } from '../../../functions/shared/petRally.js';
import { boardOf, mergeBests, rallyCleared, rallyTime } from '../../../functions/shared/petgames.js';
import { readLocal, recordLocal } from '../../petgames/bests.js';
import { useMarket } from '../../market.js';
import { useEscape } from '../../util.js';
import { CloseIcon } from '../common.jsx';
import { PetWithGear } from '../PetGear.jsx';
import { Icon } from '../shell/icons.jsx';
import HopGame from './HopGame.jsx';
import RallyGame from './RallyGame.jsx';

// The pet games screen (3.2): pick Pet Hop or Pet Rally, play with your own
// pet, and see your bests and the team's. Loaded only when it opens.
//
// Bests are kept on this device and sent to the server (the pet callable's
// gameScore, functions/petgames.js) for the team boards. The boards are just
// for fun: no coins, and a pet still grows only with lab time.

export const GAME_INFO = {
  hop: { name: 'Pet Hop', line: 'Tap to hop through the gaps in the field towers.' },
  rally: { name: 'Pet Rally', line: `Drive over hills, bridges and jumps. ${RALLY_COUNT} levels.` },
};

export default function PetGames({ actor, start = {}, onClose }) {
  const market = useMarket();
  const me = actor.name;
  const list = market.petsOf(me);
  const [born, setBorn] = useState(start.born ?? list[0]?.pet.adoptedAt);
  const entry = list.find((e) => e.pet.adoptedAt === born) || list[0];
  const [tab, setTab] = useState(start.game === 'rally' ? 'rally' : 'hop');
  const [playing, setPlaying] = useState(start.game === 'hop' ? { game: 'hop' } : null);
  useEscape(() => (playing ? setPlaying(null) : onClose()));

  // Everyone's bests (only while this is open).
  const [docs, setDocs] = useState(null);
  useEffect(() => market.watchGames(setDocs), [market.watchGames]);
  const [local, setLocal] = useState(() => readLocal(me));
  const mineOnServer = useMemo(() => (docs || []).find((d) => market.rename(d.person || '') === me) || null, [docs, market, me]);
  const bests = useMemo(() => mergeBests(local, mineOnServer), [local, mineOnServer]);
  const cleared = rallyCleared(bests.rally);

  // Send a best the server doesn't have yet (also catches up after playing
  // offline). Quietly: the board is for fun, and the game itself never waits.
  const sending = useRef(new Set());
  const send = useCallback(
    async (game, level, value) => {
      if (actor.preview) return;
      const id = `${game}:${level}:${value}`;
      if (sending.current.has(id)) return;
      sending.current.add(id);
      await market.run('pet', { action: 'gameScore', game, level, value });
    },
    [actor.preview, market],
  );
  useEffect(() => {
    if (!docs) return;
    const theirs = mergeBests(mineOnServer);
    const mine = mergeBests(local);
    (async () => {
      if (mine.hop > theirs.hop) await send('hop', 0, mine.hop);
      for (let lv = 1; lv <= RALLY_COUNT; lv++) {
        const k = String(lv);
        if (mine.rally[k] && (!theirs.rally[k] || mine.rally[k] < theirs.rally[k])) await send('rally', lv, mine.rally[k]);
      }
    })();
  }, [docs, local, mineOnServer, send]);

  const record = (game, level, value) => setLocal(recordLocal(me, game, level, value));

  if (!entry) {
    return (
      <div className="panel-backdrop center">
        <div className="dialog pg-dialog" role="dialog" aria-label="Pet games">
          <div className="panel-head">
            <h2>Pet games</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted">Adopt a pet first, then come play.</p>
        </div>
      </div>
    );
  }
  const { pet, st } = entry;

  if (playing) {
    const quit = () => setPlaying(null);
    return (
      <div className="panel-backdrop center pg-backdrop playing">
        <div className="dialog pg-dialog playing" role="dialog" aria-label={GAME_INFO[playing.game].name}>
          {playing.game === 'hop' ? (
            <HopGame pet={pet} stage={st.stage} best={bests.hop} onQuit={quit} onEnd={(score) => score > 0 && record('hop', 0, score)} />
          ) : (
            <RallyGame
              key={playing.level}
              pet={pet}
              stage={st.stage}
              level={playing.level}
              best={bests.rally[String(playing.level)]}
              onQuit={quit}
              onLevel={(lv) => setPlaying({ game: 'rally', level: lv })}
              onEnd={(r) => r.status === 'won' && record('rally', r.level, r.ms)}
            />
          )}
        </div>
      </div>
    );
  }

  const board = docs ? boardOf(docs, tab, { rename: market.rename }) : null;
  return (
    <div className="panel-backdrop center pg-backdrop" onClick={onClose}>
      <div className="dialog pg-dialog" role="dialog" aria-label="Pet games" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Pet games</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="pg-who">
          <PetWithGear species={pet.species} gear={pet.gear} stage={st.stage} mood="happy" size={64} />
          <div className="pg-who-text">
            <b>Playing with {pet.name}</b>
            <span className="muted small">Just for fun: no coins, and {pet.name} still grows with your lab time.</span>
          </div>
          {list.length > 1 && (
            <div className="segmented pg-pets" role="radiogroup" aria-label="Play with">
              {list.map((e) => (
                <button key={e.pet.adoptedAt} role="radio" aria-checked={e === entry} className={`plain-seg${e === entry ? ' on' : ''}`} onClick={() => setBorn(e.pet.adoptedAt)}>
                  {e.pet.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="segmented pg-tabs" role="tablist">
          {['hop', 'rally'].map((g) => (
            <button key={g} role="tab" aria-selected={tab === g} className={`plain-seg${tab === g ? ' on' : ''}`} onClick={() => setTab(g)}>
              <Icon name={g === 'hop' ? 'sparkle' : 'car'} size={16} /> {GAME_INFO[g].name}
            </button>
          ))}
        </div>
        {tab === 'hop' ? (
          <section className="pg-sec">
            <p className="muted small">{GAME_INFO.hop.line} Each gap is a point.</p>
            <div className="pg-best-row">
              <span className="pg-best">
                <span className="fun-cap">Your best</span>
                <b className="mono">{bests.hop || '–'}</b>
              </span>
              <button className="btn primary pg-go" onClick={() => setPlaying({ game: 'hop' })}>
                <Icon name="play" size={18} /> Play
              </button>
            </div>
          </section>
        ) : (
          <section className="pg-sec">
            <p className="muted small">{GAME_INFO.rally.line} Reach the flag without flipping over.</p>
            <ol className="pr-levels">
              {RALLY_LEVELS.map((lv) => {
                const open = lv.id <= cleared + 1;
                const t = bests.rally[String(lv.id)];
                return (
                  <li key={lv.id}>
                    <button className={`pr-level-tile${t ? ' done' : ''}`} disabled={!open} onClick={() => setPlaying({ game: 'rally', level: lv.id })}>
                      <span className="pr-level-n mono">{lv.id}</span>
                      <span className="pr-level-name">{lv.name}</span>
                      <span className="pr-level-t mono">{open ? (t ? rallyTime(t) : 'Play') : <Icon name="lock" size={13} />}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        <section className="pg-sec">
          <div className="pg-board-head">
            <h3 className="fun-cap">Team board, for fun</h3>
            {tab === 'rally' && <span className="muted tiny">Levels cleared, then total time</span>}
          </div>
          {!board ? (
            <p className="muted small">Loading…</p>
          ) : !board.length ? (
            <p className="muted small">Nobody on the board yet. Be the first!</p>
          ) : (
            <ol className="pg-board">
              {board.map((r, i) => {
                const theirs = market.petOf(r.name);
                return (
                  <li key={r.name} className={r.name === me ? 'me' : ''}>
                    <span className="pg-rank mono">{i + 1}</span>
                    <span className="pg-board-pet">{theirs && <PetWithGear species={theirs.pet.species} gear={theirs.pet.gear} stage={theirs.st.stage} mood="happy" size={26} still />}</span>
                    <span className="pg-board-name">{r.name}</span>
                    <span className="pg-board-val mono">{tab === 'hop' ? r.best : `${r.cleared}/${RALLY_COUNT} · ${rallyTime(r.total)}`}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
