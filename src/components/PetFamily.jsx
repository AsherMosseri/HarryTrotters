import { useRef, useState } from 'react';
import { PET_ITEMS } from '../../functions/shared/market.js';
import {
  EVENT_GEAR,
  FULL,
  GEAR,
  gearFits,
  GEAR_SLOTS,
  GROW_LEVEL,
  RINGS,
  SPECIES,
  cleanGear,
  hatchBlock,
  levelPath,
  moodLine,
  nextUnlock,
  ringOf,
  roomBlock,
  stageOf,
  titleOf,
  unlockedGear,
} from '../../functions/shared/pets.js';
import { celebrate } from '../motion.js';
import { useMarket } from '../market.js';
import { useEscape } from '../util.js';
import { Avatar, CloseIcon, Overlay } from './common.jsx';
import { Coins } from './Coins.jsx';
import { alertDialog, confirmDialog, promptDialog } from './Dialogs.jsx';
import { AdoptPet, FavoriteFood, Meter, nextLevelLine } from './Pet.jsx';
import { RequestPetLink } from './PetRequest.jsx';
import { PetWithGear } from './PetGear.jsx';
import { EventsAdmin, ParkSection } from './PetPark.jsx';
import { OwnSticker, PetPhotoReview, PetPhotoRow } from './PetPhoto.jsx';
import { PetGamesHost, PetGamesSection } from './petgames/PetGamesCard.jsx';
import { Icon } from './shell/icons.jsx';

// Pets in the market, and their family (3.0): your pets with what they wear,
// their title and level, a style sheet for the gear levels unlock, the one
// baby a pet can have, and giving a pet to a teammate. The rules (what
// unlocks when, who can give to whom) are in functions/shared/pets.js and are
// checked again on the server (functions/petfamily.js); this only asks.

const first = (n = '') => n.split(' ')[0];
const said = (r) => [r?.note?.title, r?.note?.body].filter(Boolean).join(' ');
const speciesName = (id) => SPECIES.find((s) => s.id === id)?.name || id;
const RING_NAME = Object.fromEntries(RINGS.map((r) => [r.id, r.name]));
const SLOT_NAME = { ...Object.fromEntries(GEAR_SLOTS.map((s) => [s.id, s.name])), ring: 'Chat ring', baby: 'Baby', room: 'Pets' };
// Soft swatches for the fur tints (the pet itself is tinted with CSS).
const SWATCH = { sunset: 'linear-gradient(135deg, #ffb36b, #f0627f)', midnight: 'linear-gradient(135deg, #5a6bd8, #1c2552)', crimson: 'linear-gradient(135deg, #f0707a, #8c1530)', golden: 'linear-gradient(135deg, #ffe27a, #d9a21b)' };

// ---------- the Pets shelf ----------
export function PetsShelf({ actor, balance, buy, busy, onToast, roster = [] }) {
  const market = useMarket();
  const list = market.petsOf(actor.name);
  const { incoming, outgoing } = market.gifts;
  const [careFor, setCareFor] = useState(null);
  const [pathOpen, setPathOpen] = useState(false);
  // The pet games (3.2): { game, born } while open.
  const [games, setGames] = useState(null);
  const level = Math.max(1, ...list.map((e) => e.st.level));
  const target = list.find((e) => e.pet.adoptedAt === careFor) || list[0];
  // Another pet (adopted, a baby or a gift) once every pet you have is level 5.
  const levels = list.map((e) => ({ name: e.pet.name, level: e.st.level }));
  const room = roomBlock(levels);
  const [adopting, setAdopting] = useState(false);

  return (
    <>
      {incoming.length > 0 && (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Offers for you</h2>
          </div>
          <ul className="mk-list pf-offers">
            {incoming.map((g) => (
              <Offer key={g.id} gift={g} mine={false} onToast={onToast} />
            ))}
          </ul>
        </section>
      )}

      <ParkSection />

      {list.length > 0 && <PetGamesSection actor={actor} petName={list[0].pet.name} onOpen={setGames} />}
      <PetGamesHost actor={actor} open={games} onClose={() => setGames(null)} />

      {!list.length ? (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Adopt a pet</h2>
          </div>
          <AdoptPet />
        </section>
      ) : null}
      {!list.length && <RealPetSection onToast={onToast} />}
      {!list.length ? null : (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Your pets</h2>
            <span className="muted tiny">
              <span className="mono">{list.length}</span> {list.length === 1 ? 'pet' : 'pets'}
            </span>
          </div>
          <div className="pf-pets">
            {list.map((e, i) => (
              <OwnedPet
                key={e.pet.adoptedAt}
                entry={e}
                lead={i === 0}
                levels={levels}
                roster={roster}
                actor={actor}
                offered={outgoing.find((g) => g.pet?.adoptedAt === e.pet.adoptedAt)}
                onToast={onToast}
                onPlay={() => setGames({ born: e.pet.adoptedAt })}
              />
            ))}
          </div>
          <MorePets levels={levels} room={room} adopting={adopting} setAdopting={setAdopting} />
          {!adopting && <RequestPetLink />}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Waiting for an answer</h2>
          </div>
          <ul className="mk-list pf-offers">
            {outgoing.map((g) => (
              <Offer key={g.id} gift={g} mine onToast={onToast} />
            ))}
          </ul>
        </section>
      )}

      <section className="mk-sec">
        <div className="sec-head">
          <h2>Level path</h2>
          <button className="link-btn small pf-toggle" aria-expanded={pathOpen} onClick={() => setPathOpen(!pathOpen)}>
            {pathOpen ? 'Hide' : 'Show'}
            <Icon name={pathOpen ? 'chevronUp' : 'chevronDown'} size={14} />
          </button>
        </div>
        {pathOpen ? <LevelPath level={level} /> : <p className="muted small">What each level brings: titles, gear, chat rings and the baby. It’s all for show; none of it costs or earns coins.</p>}
      </section>

      {actor.admin && <EventsAdmin onToast={onToast} />}
      {actor.admin && <PetPhotoReview onToast={onToast} />}

      {target && (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Pet items</h2>
          </div>
          <p className="muted small">Food and fun only. Your pets grow with your lab time, never with coins.</p>
          {list.length > 1 && (
            <div className="segmented pf-for" role="radiogroup" aria-label="Buy for">
              {list.map((e) => (
                <button
                  key={e.pet.adoptedAt}
                  role="radio"
                  aria-checked={target.pet.adoptedAt === e.pet.adoptedAt}
                  className={`plain-seg${target.pet.adoptedAt === e.pet.adoptedAt ? ' on' : ''}`}
                  onClick={() => setCareFor(e.pet.adoptedAt)}
                >
                  For {e.pet.name}
                </button>
              ))}
            </div>
          )}
          <ul className="mk-grid">
            {PET_ITEMS.map((it) => {
              const { pet, st } = target;
              const full = !((it.food && st.food < FULL) || (it.fun && st.fun < FULL));
              const item = `pet:${it.id}`;
              return (
                <li key={it.id} className="mk-card">
                  <div className="mk-card-top">
                    <b>{it.name}</b>
                    <span className="mk-price">
                      <Coins n={it.price} size={15} />
                    </span>
                  </div>
                  <p className="muted small">
                    {it.desc} {[it.food && `+${it.food} food`, it.fun && `+${it.fun} fun`].filter(Boolean).join(', ')}
                  </p>
                  <button
                    className="btn small mk-buy"
                    disabled={!market.coinsOn || full || it.price > balance || !!busy}
                    onClick={() => buy(item, { born: pet.adoptedAt }, () => onToast(`${pet.name} loved the ${it.name.toLowerCase()}.`))}
                  >
                    {full ? `${pet.name} is full` : it.price > balance ? 'Not enough coins' : busy === item ? 'Buying…' : 'Buy'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

// ---------- one of your pets ----------
function OwnedPet({ entry, lead, levels, roster, actor, offered, onToast, onPlay }) {
  const market = useMarket();
  const { pet, st } = entry;
  const card = useRef(null);
  const [busy, setBusy] = useState(false);
  const [styling, setStyling] = useState(false);
  const [giving, setGiving] = useState(false);
  const act = async (data) => {
    setBusy(true);
    const r = await market.run('pet', { born: pet.adoptedAt, ...data });
    setBusy(false);
    if (r?.note) onToast(said(r));
    return r;
  };
  const next = nextUnlock(st.level, pet.species);
  const ring = ringOf(st.level);
  const gear = cleanGear(pet.gear, pet.species);

  const meetBaby = async () => {
    const block = hatchBlock(pet, st.level, levels);
    if (block) return alertDialog({ title: block.note.title, body: block.note.body });
    const n = await promptDialog({
      title: `Meet ${pet.name}’s baby`,
      body: `It’s a baby ${speciesName(pet.species).toLowerCase()}. What will you call it?`,
      maxLength: 24,
      okLabel: 'Welcome it',
    });
    if (!n || !n.trim()) return;
    const r = await act({ action: 'hatch', name: n });
    if (r?.ok) {
      celebrate({ el: card.current });
      onToast(`${n.trim()} was born!`);
    }
  };

  return (
    <div className={`pet-card big pf-pet mood-${st.mood}`} ref={card}>
      <div className="pp-pair">
        <div className="pet-stage">
          <PetWithGear species={pet.species} mood={st.mood} stage={st.stage} size={148} title={`${pet.name} the ${pet.species}`} gear={gear} />
        </div>
        {lead && <OwnSticker />}
      </div>
      <div className="pet-info">
        <div className="pet-name-row">
          <b className="pet-name">{pet.name}</b>
          <span className="pet-level">
            Level <span className="mono">{st.level}</span>
          </span>
        </div>
        <p className="pet-title">
          {titleOf(st.level)}
          {ring && <span className={`pf-ring-chip ring-${ring}`}>{RING_NAME[ring]}</span>}
        </p>
        <p className="pet-mood">{moodLine(pet.name, st)}</p>
        <FavoriteFood species={pet.species} />
        <div className="pet-xp" title={nextLevelLine(st)}>
          <span style={{ transform: `scaleX(${Math.max(0.02, st.progress)})` }} />
        </div>
        <p className="muted tiny">{nextLevelLine(st)}</p>
        {next && (
          <p className="pf-next tiny">
            <Icon name="lock" size={13} />
            <span>
              Next: {next.name} at level <span className="mono">{next.level}</span>
            </span>
          </p>
        )}
        <Meter label="Food" value={st.food} />
        <Meter label="Fun" value={st.fun} />
        <div className="pet-actions">
          <button className="btn small" onClick={onPlay}>
            <Icon name="play" size={16} /> Play
          </button>
          <button className="btn small" onClick={() => setStyling(true)}>
            <Icon name="sparkle" size={16} /> Style
          </button>
          {pet.babyBorn ? (
            <span className="muted tiny pf-note">
              <Icon name="heart" size={13} /> {pet.name} has had a baby
            </span>
          ) : st.level >= 10 ? (
            <button className="btn small" disabled={busy} onClick={meetBaby}>
              <Icon name="heart" size={16} /> Meet the baby
            </button>
          ) : (
            <span className="muted tiny pf-note">
              <Icon name="heart" size={13} /> A baby at level <span className="mono">10</span>
            </span>
          )}
          {offered ? (
            <span className="muted tiny pf-note">
              <Icon name="gift" size={13} /> Offered to {first(offered.to)}
            </span>
          ) : (
            <button className="btn small" disabled={busy} onClick={() => setGiving(true)}>
              <Icon name="gift" size={16} /> Give to a teammate
            </button>
          )}
        </div>
        {lead && <PetPhotoRow pet={pet} onToast={onToast} />}
        <div className="pet-actions">
          {lead && (
            <label className="pet-toggle">
              <input type="checkbox" checked={pet.inChat !== false} disabled={busy} onChange={(e) => act({ action: 'inChat', on: e.target.checked })} />
              Show next to my name in chat
            </label>
          )}
          <button
            className="link-btn small"
            disabled={busy}
            onClick={async () => {
              const n = await promptDialog({ title: `Rename ${pet.name}`, initial: pet.name, maxLength: 24, okLabel: 'Rename' });
              if (n && n.trim() && n.trim() !== pet.name) act({ action: 'rename', name: n });
            }}
          >
            Rename
          </button>
          <button
            className="link-btn small danger"
            disabled={busy}
            onClick={async () => {
              const ok = await confirmDialog({
                title: `Rehome ${pet.name}?`,
                body: `${pet.name} goes to a good home. Its level doesn’t come back. To keep it going, give it to a teammate instead.${
                  levels.length > 1 ? ' Your other pets stay with you.' : ''
                }`,
                okLabel: 'Rehome',
                danger: true,
              });
              if (ok) act({ action: 'release' });
            }}
          >
            Rehome
          </button>
        </div>
      </div>
      {styling && <StyleSheet entry={entry} onClose={() => setStyling(false)} onSave={(g) => act({ action: 'style', gear: g })} />}
      {giving && (
        <GivePicker
          pet={pet}
          roster={roster.filter((n) => n !== actor.name)}
          onClose={() => setGiving(false)}
          onPick={async (to) => {
            const ok = await confirmDialog({
              title: `Give ${pet.name} to ${first(to)}?`,
              body: `${first(to)} gets to say yes or no thanks, and you can cancel until then. If they say yes, ${pet.name} moves to ${first(to)} and starts over at level 1 with their lab time.`,
              okLabel: 'Offer it',
            });
            if (!ok) return;
            const r = await act({ action: 'offer', to });
            if (r?.ok) {
              setGiving(false);
              onToast(`Offered ${pet.name} to ${first(to)}.`);
            }
          }}
        />
      )}
    </div>
  );
}

// ---------- the style sheet ----------
function StyleSheet({ entry, onClose, onSave }) {
  const { pet, st } = entry;
  useEscape(onClose);
  const [draft, setDraft] = useState(() => cleanGear(pet.gear, pet.species));
  const [saving, setSaving] = useState(false);
  const market = useMarket();
  const open = new Set(unlockedGear(st.level, pet.species).map((g) => g.id));
  // Event gear: any level, but only if you earned it (the server checks too).
  const earned = new Set(market.unlocks.earned);
  const next = nextUnlock(st.level, pet.species);
  const changed = GEAR_SLOTS.some((s) => draft[s.id] !== cleanGear(pet.gear, pet.species)[s.id]);
  const pick = (slot, id) => setDraft((d) => ({ ...d, [slot]: id }));
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog pf-style" role="dialog" aria-label={`Style ${pet.name}`} onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>Style {pet.name}</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="pf-style-body">
            <div className="pf-preview">
              <div className="pet-stage">
                <PetWithGear species={pet.species} mood={st.mood} stage={st.stage} size={132} title={`${pet.name} in the new look`} gear={draft} />
              </div>
              <div className="pf-preview-text">
                <b>{pet.name}</b>
                <span className="muted small">
                  Level <span className="mono">{st.level}</span> · {titleOf(st.level)}
                </span>
                <span className="pf-next tiny">
                  <Icon name={next ? 'lock' : 'check'} size={13} />
                  <span>{next ? <>Next: {next.name} at level <span className="mono">{next.level}</span></> : 'Everything is unlocked.'}</span>
                </span>
              </div>
            </div>
            {GEAR_SLOTS.map((slot) => {
              // Species-only gear (the goat's jersey) shows only for that kind of pet.
              const items = [...GEAR.filter((g) => g.slot === slot.id && gearFits(g, pet.species)), ...EVENT_GEAR.filter((g) => g.slot === slot.id)];
              return (
                <fieldset key={slot.id} className="pf-slot">
                  <legend>{slot.name}</legend>
                  <div className="pf-tiles" role="radiogroup" aria-label={slot.name}>
                    <button role="radio" aria-checked={!draft[slot.id]} className={`pf-tile${!draft[slot.id] ? ' on' : ''}`} onClick={() => pick(slot.id, '')}>
                      <span className="pf-tile-art none">
                        <Icon name="ban" size={22} />
                      </span>
                      <span className="pf-tile-name">None</span>
                    </button>
                    {items.map((g) => {
                      const event = !!g.earn;
                      const locked = event ? !earned.has(g.id) : !open.has(g.id);
                      return (
                        <button
                          key={g.id}
                          role="radio"
                          aria-checked={draft[slot.id] === g.id}
                          aria-disabled={locked}
                          className={`pf-tile${draft[slot.id] === g.id ? ' on' : ''}${locked ? ' locked' : ''}`}
                          onClick={() => !locked && pick(slot.id, g.id)}
                          title={locked ? (event ? `${g.name}: earn it in ${g.earn}` : `${g.name}: unlocks at level ${g.level}`) : g.name}
                        >
                          <span className="pf-tile-art">
                            {slot.id === 'palette' ? (
                              <span className="pf-swatch" style={{ background: SWATCH[g.id] }} />
                            ) : (
                              <PetWithGear species={pet.species} mood="ok" stage={stageOf(Math.max(st.level, 6))} size={50} still gear={{ [slot.id]: g.id }} />
                            )}
                          </span>
                          <span className="pf-tile-name">{g.name}</span>
                          {event ? (
                            <span className="pf-tile-sub pf-tile-event">{locked ? `Earn it in ${g.earn}` : g.earn}</span>
                          ) : (
                            <span className="pf-tile-sub mono">{locked ? `Level ${g.level}` : ' '}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
          <div className="pf-style-foot">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!changed || saving}
              onClick={async () => {
                setSaving(true);
                await onSave(draft);
                setSaving(false);
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- the level path ----------
function LevelPath({ level }) {
  const rows = levelPath();
  const upNext = rows.find((r) => r.level > level)?.level;
  return (
    <ol className="pf-path">
      {rows.map((r) => (
        <li key={r.level} className={`${r.level <= level ? 'done' : ''}${r.level === upNext ? ' next' : ''}`}>
          <span className="pf-path-level mono">{r.level}</span>
          <div className="pf-path-what">
            {r.title && <b>{r.title}</b>}
            {r.unlocks.length > 0 && (
              <ul>
                {r.unlocks.map((u) => (
                  <li key={u.name}>
                    <span>{u.name}</span>
                    <span className="muted tiny">
                      {SLOT_NAME[u.slot] || u.slot}
                      {u.only ? ` · ${u.only}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {r.level <= level ? <Icon name="check" size={15} /> : r.level === upNext ? <span className="tiny pf-path-up">Next</span> : null}
        </li>
      ))}
    </ol>
  );
}

// ---------- offers ----------
function Offer({ gift, mine, onToast }) {
  const market = useMarket();
  const [busy, setBusy] = useState(false);
  const p = gift.pet;
  const run = async (action, done) => {
    setBusy(true);
    const r = await market.run('pet', { action, id: gift.id });
    setBusy(false);
    if (r?.ok) done?.(r);
    else onToast(said(r) || 'That didn’t go through.');
  };
  return (
    <li className="pf-offer">
      <PetWithGear species={p.species} stage={stageOf(p.level || 1)} size={52} still />
      <div className="pf-offer-text">
        <b>
          {mine ? `${p.name} offered to ${first(gift.to)}` : `${first(gift.from)} wants to give you ${p.name}`}
        </b>
        <span className="muted small">
          {speciesName(p.species)}, level <span className="mono">{p.level || 1}</span>
          {mine ? '' : ` · starts over at level 1 with your lab time`}
        </span>
      </div>
      <div className="mk-row-btns">
        {mine ? (
          <button className="btn small" disabled={busy} onClick={() => run('cancelOffer', () => onToast('Offer cancelled.'))}>
            Cancel
          </button>
        ) : (
          <>
            <button className="btn small primary" disabled={busy} onClick={() => run('accept', (r) => onToast(`${r.name || p.name} is yours now.`))}>
              Accept
            </button>
            <button className="btn small" disabled={busy} onClick={() => run('decline', () => onToast('Passed on it.'))}>
              No thanks
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// ---------- pick a teammate ----------
function GivePicker({ pet, roster, onPick, onClose }) {
  useEscape(onClose);
  const [q, setQ] = useState('');
  const shown = roster.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog pf-give" role="dialog" aria-label={`Give ${pet.name} to a teammate`} onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>Give {pet.name} to…</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the team" aria-label="Search the team" />
          <ul className="pf-roster">
            {shown.map((n) => (
              <li key={n}>
                <button className="pf-person" onClick={() => onPick(n)}>
                  <Avatar name={n} size={30} decoration="" />
                  <b className="pf-person-name">{n}</b>
                  <Icon name="right" size={16} />
                </button>
              </li>
            ))}
            {!shown.length && <li className="muted small">Nobody by that name.</li>}
          </ul>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- room for another pet ----------
// Under your pets: adopt another once every pet is level 5 (a baby or a
// gift needs the same room), or what's still to grow.
function MorePets({ levels, room, adopting, setAdopting }) {
  if (room) {
    const young = levels.filter((p) => p.level < GROW_LEVEL);
    return (
      <p className="pf-next tiny pf-room">
        <Icon name="lock" size={13} />
        {young.length ? (
          <span>
            Another pet when every pet you have is level <span className="mono">{GROW_LEVEL}</span>:{' '}
            {young.map((p, i) => (
              <span key={i}>
                {i ? ', ' : ''}
                {p.name} is <span className="mono">{p.level}</span>
              </span>
            ))}
            .
          </span>
        ) : (
          <span>{room.note.title} {room.note.body}</span>
        )}
      </p>
    );
  }
  if (!adopting)
    return (
      <div className="pf-room">
        <button className="btn small" onClick={() => setAdopting(true)}>
          <Icon name="plus" size={16} /> Adopt another pet
        </button>
      </div>
    );
  return (
    <div className="pf-room pf-adopt-more">
      <div className="sec-head">
        <h3>Adopt another pet</h3>
        <button className="link-btn small" onClick={() => setAdopting(false)}>
          Not now
        </button>
      </div>
      <AdoptPet more onDone={() => setAdopting(false)} />
    </div>
  );
}

// ---------- on a profile: the pets after the first, small ----------
export function PetExtras({ name }) {
  const market = useMarket();
  const rest = (market?.petsOf(name) || []).slice(1);
  if (!rest.length) return null;
  return (
    <div className="pf-minis">
      {rest.map(({ pet, st }) => (
        <div key={pet.adoptedAt} className="pet-card pf-mini">
          <PetWithGear species={pet.species} mood={st.mood} stage={st.stage} size={56} title={`${pet.name} the ${pet.species}`} gear={pet.gear} />
          <div className="pet-info">
            <div className="pet-name-row">
              <b className="pet-name">{pet.name}</b>
              <span className="pet-level">
                Level <span className="mono">{st.level}</span>
              </span>
            </div>
            <p className="pet-title">{titleOf(st.level)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// No pet in the app yet: a photo of your real pet still works. It shows here
// and on your profile (and beside your pet once you adopt one).
function RealPetSection({ onToast }) {
  return (
    <section className="mk-sec">
      <div className="sec-head">
        <h2>Your real pet</h2>
      </div>
      <div className="pp-solo">
        <OwnSticker size={96} />
        <PetPhotoRow pet={null} onToast={onToast} />
      </div>
    </section>
  );
}
