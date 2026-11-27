import { useState } from 'react';
import { battleBoard, movesOf, moveTip, recordLine, unlockedMoves, UNLOCK } from '../../functions/shared/battles.js';
import { readAmount } from '../../functions/shared/amount.js';
import { speciesOf, stageOf } from '../../functions/shared/pets.js';
import { useControls } from '../controls.js';
import { useMarket } from '../market.js';
import { askBattle, battleArgs } from '../battles.js';
import { useEscape } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';
import { PetWithGear } from './PetGear.jsx';
import { PhotoPet, photoPetOf } from './PetPhoto.jsx';
import { Icon } from './shell/icons.jsx';
import './petBattle.css';

// Pet battles in the app (3.3): the Battle button on a teammate's pet, the
// sheet that sends the challenge, the record line on a pet's card, your pet's
// moves, and the Battles board. The battle itself is a card in #arcade
// (chat/PetBattleCard.jsx); the server runs it (functions/shared/battles.js).

const first = (n = '') => n.split(' ')[0];
const said = (r) => [r?.note?.title, r?.note?.body].filter(Boolean).join(' ');
export const KIND_ICON = { hit: 'bolt', strong: 'bolt', sure: 'target', big: 'flame', daze: 'sparkle', guard: 'shield', dodge: 'move', heal: 'heart' };

// A pet as it shows in a battle: its photo when its owner shows the real pet
// (their first pet only), else the drawing with its gear.
export function BattlePet({ owner, side, size = 72, mood = 'happy', className = '' }) {
  const market = useMarket();
  const list = market?.petsOf(owner) || [];
  const k = list.findIndex((e) => Number(e.pet.adoptedAt) === Number(side.born));
  const pet = k >= 0 ? list[k].pet : null;
  const drawn = <PetWithGear species={side.species} gear={side.gear} stage={stageOf(side.level)} mood={mood} size={size} title={side.name} />;
  const photo = pet ? photoPetOf(market, owner, pet, k === 0) : null;
  return <span className={`bt-pet${className ? ` ${className}` : ''}`}>{photo ? <PhotoPet photo={photo} size={size} fit title={side.name} fallback={drawn} /> : drawn}</span>;
}

// "Battles: 3 wins · 1 loss" on a pet's card, once it has battled.
export function BattleRecord({ owner, born, className = '' }) {
  const market = useMarket();
  const { isOn } = useControls();
  if (!market || !isOn('petBattles')) return null;
  const line = recordLine(market.battleRecord(owner, born));
  return line ? (
    <p className={`bt-record tiny${className ? ` ${className}` : ''}`}>
      <Icon name="trophy" size={13} /> Battles: {line}
    </p>
  ) : null;
}

// The Battle button on a teammate's pet (park card, profile). Hidden for your
// own pet, with battles off, or before you have a pet of your own.
export function BattleButton({ owner, born, small = false, onOpen }) {
  const market = useMarket();
  const { isOn } = useControls();
  if (!market || !isOn('petBattles') || owner === market.me || !market.petsOf(market.me).length) return null;
  return (
    <button
      type="button"
      className={`btn${small ? ' small' : ''} bt-btn`}
      onClick={() => {
        onOpen?.();
        askBattle({ owner, born });
      }}
    >
      <Icon name="bolt" size={16} /> Battle
    </button>
  );
}

// A pet's moves (on your own pet's card): what it knows and what's next.
export function BattleMoves({ species, level }) {
  const { isOn } = useControls();
  if (!isOn('petBattles')) return null;
  const all = movesOf(species);
  return (
    <div className="bt-moves-own">
      <p className="tiny bt-moves-cap">Battle moves</p>
      <ul className="bt-move-chips">
        {all.map((m) => {
          const open = m.level <= level;
          return (
            <li key={m.i} className={open ? '' : 'locked'} title={open ? moveTip(m, level) : `Learns it at level ${m.level}`}>
              <Icon name={open ? KIND_ICON[m.kind] : 'lock'} size={12} /> {m.name}
              {!open && <span className="mono"> · {m.level}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The sheet that sends a battle: your pet (if you have more than one), theirs,
// both move lists, and an optional bet (only with Jackson coins on).
export function BattleAsk({ target, actor, play, coinsOn, onClose, onSent }) {
  useEscape(onClose);
  const market = useMarket();
  const mine = market.petsOf(actor.name);
  const theirs = market.petsOf(target.owner);
  const other = theirs.find((e) => Number(e.pet.adoptedAt) === Number(target.born)) || theirs[0];
  const [born, setBorn] = useState(mine[0]?.pet.adoptedAt);
  const me = mine.find((e) => e.pet.adoptedAt === born) || mine[0];
  const [bet, setBet] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = readAmount(bet.trim() || '0');
  const betProblem = bet.trim() && (!amount || amount.amount === undefined) ? 'Coins are whole numbers, like 20 or 1k.' : '';

  const send = async () => {
    if (betProblem || busy) return;
    setBusy(true);
    setError('');
    const r = await play({ action: 'run', game: 'battle', conv: 'arcade', args: battleArgs({ owner: target.owner, born: other.pet.adoptedAt, mine: me.pet.adoptedAt, bet: coinsOn ? bet : '' }) });
    setBusy(false);
    if (r?.note && !r.ok) return setError(said(r) || 'That didn’t go through.');
    onSent(`Battle sent to ${first(target.owner)}. It’s in #arcade.`);
  };

  const side = (e, owner) => {
    const s = { born: e.pet.adoptedAt, name: e.pet.name, species: e.pet.species, level: e.st.level, gear: e.pet.gear };
    return (
      <div className="bt-ask-side">
        <BattlePet owner={owner} side={s} size={84} />
        <b className="bt-ask-name">{e.pet.name}</b>
        <span className="muted tiny">
          {owner === actor.name ? 'Yours' : first(owner)} · {speciesOf(e.pet.species)?.name || e.pet.species} · level <span className="mono">{e.st.level}</span>
        </span>
        <ul className="bt-ask-moves">
          {unlockedMoves(e.pet.species, e.st.level).map((m) => (
            <li key={m.i} title={moveTip(m, e.st.level)}>
              <Icon name={KIND_ICON[m.kind]} size={12} /> {m.name}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog bt-ask" role="dialog" aria-label="Pet battle" onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>Pet battle</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {!me || !other ? (
            <p className="muted">{!me ? 'Adopt a pet first. Then it can battle.' : `${first(target.owner)} doesn’t have a pet right now.`}</p>
          ) : (
            <>
              {mine.length > 1 && (
                <div className="segmented bt-ask-pick" role="radiogroup" aria-label="Your pet">
                  {mine.map((e) => (
                    <button key={e.pet.adoptedAt} role="radio" aria-checked={e === me} className={`plain-seg${e === me ? ' on' : ''}`} onClick={() => setBorn(e.pet.adoptedAt)}>
                      {e.pet.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="bt-ask-pair">
                {side(me, actor.name)}
                <span className="bt-ask-vs" aria-hidden="true">
                  vs
                </span>
                {side(other, target.owner)}
              </div>
              <p className="muted small">
                Each round you both pick a move. 12 rounds at most. New moves come at levels {UNLOCK[2]} and {UNLOCK[3]}. A battle never changes your pets: food, fun and level stay the same.
              </p>
              {coinsOn ? (
                <label className="bt-ask-bet">
                  <span className="field-label">Bet (optional)</span>
                  <input className="input mono" inputMode="decimal" placeholder="0, no bet" value={bet} onChange={(e) => setBet(e.target.value)} aria-label="Bet" />
                  <span className="muted tiny">You both put in the same. The winner takes both; a draw gives them back.</span>
                </label>
              ) : (
                <p className="muted small">Jackson coins are off, so this one’s just for fun.</p>
              )}
              {(betProblem || error) && <p className="danger small">{betProblem || error}</p>}
              <div className="row gap bt-ask-btns">
                <span className="spacer" />
                <button className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn primary" onClick={send} disabled={busy || !!betProblem}>
                  {busy ? 'Sending…' : `Battle ${first(target.owner)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// The Battles board on the pet games screen: every pet that has battled and
// is still with its owner, most wins first.
export function BattleBoard({ me }) {
  const market = useMarket();
  const alive = (owner, born) => market.petsOf(owner).some((e) => Number(e.pet.adoptedAt) === born);
  const rows = battleBoard(market.battleDocs, { rename: market.rename, alive });
  if (!rows.length) return <p className="muted small">No battles yet. Find a teammate’s pet in the park and tap Battle.</p>;
  return (
    <ol className="pg-board bt-board">
      {rows.map((r, i) => {
        const e = market.petsOf(r.owner).find((x) => Number(x.pet.adoptedAt) === r.born);
        return (
          <li key={`${r.owner}:${r.born}`} className={r.owner === me ? 'me' : ''}>
            <span className="pg-rank mono">{i + 1}</span>
            <span className="pg-board-pet">
              {e && <BattlePet owner={r.owner} side={{ born: r.born, name: e.pet.name, species: e.pet.species, level: e.st.level, gear: e.pet.gear }} size={26} />}
            </span>
            <span className="pg-board-name">
              {e?.pet.name || r.name} <span className="muted tiny">{first(r.owner)}</span>
            </span>
            <span className="pg-board-val mono" title={`${r.w} wins, ${r.l} losses, ${r.d} draws`}>
              {r.w}–{r.l}
              {r.d ? `–${r.d}` : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
