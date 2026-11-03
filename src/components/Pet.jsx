import { useState } from 'react';
import robot from '../assets/robot-dance.webp';
import { PetArt } from './PetArt.jsx';
import { SPECIES, cleanGear, moodLine, mascotState, ringOf, titleOf } from '../../functions/shared/pets.js';
import { useMarket } from '../market.js';
import { Icon } from './shell/icons.jsx';
import { confirmDialog, promptDialog } from './Dialogs.jsx';
import { PetWithGear } from './PetGear.jsx';
import { RequestPetLink } from './PetRequest.jsx';

// Pets (H3): the art lives in PetArt.jsx. They breathe, hop when happy and
// droop when sad, only while "Moving things" plays (shell.css), with
// transform-only keyframes so iPads stay smooth.
export { PetArt };

// A small still pet next to a name in chat (when its owner shows it there).
export function PetBadge({ name }) {
  const market = useMarket();
  const mine = market?.petOf(name);
  if (!mine || mine.pet.inChat === false) return null;
  // A ring around it for levels 10, 20 and 30; its fur tint too.
  const ring = ringOf(mine.st.level);
  const tint = cleanGear(mine.pet.gear).palette;
  return (
    <span className={`pet-badge${ring ? ` ring-${ring}` : ''}`} title={`${mine.pet.name}, level ${mine.st.level}, ${titleOf(mine.st.level)}`}>
      <PetArt species={mine.pet.species} mood={mine.st.mood} stage={mine.st.stage} size={18} still className={tint ? `pet-tint-${tint}` : ''} />
    </span>
  );
}

export function Meter({ label, value, tone }) {
  return (
    <div className={`pet-meter ${tone || (value < 30 ? 'low' : value < 60 ? 'mid' : 'high')}`}>
      <span className="pet-meter-label">{label}</span>
      <span className="pet-meter-bar" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ transform: `scaleX(${Math.max(0.02, value / 100)})` }} />
      </span>
      <span className="pet-meter-num mono">{value}</span>
    </div>
  );
}

// About how much lab time the next level needs (15 minutes an xp point).
export function nextLevelLine(st) {
  if (st.to <= st.from) return 'Top level';
  const min = (st.to - st.xp) * 15;
  const t = min < 60 ? `${min} min` : `${Math.round((min / 60) * 2) / 2} h`;
  return `About ${t} more lab time to level ${st.level + 1}`;
}

// A pet with its level and needs: on profiles, and big on the market's Pets
// shelf (with `onCare`, the owner's buttons).
export function PetCard({ name, big = false, owner = false, onCare }) {
  const market = useMarket();
  const mine = market?.petOf(name);
  const [busy, setBusy] = useState(false);
  if (!mine) return null;
  const { pet, st } = mine;
  const act = async (data) => {
    setBusy(true);
    await market.run('pet', data);
    setBusy(false);
  };
  return (
    <div className={`pet-card${big ? ' big' : ''} mood-${st.mood}`}>
      <div className="pet-stage">
        <PetWithGear species={pet.species} mood={st.mood} stage={st.stage} size={big ? 148 : 92} title={`${pet.name} the ${pet.species}`} gear={pet.gear} />
      </div>
      <div className="pet-info">
        <div className="pet-name-row">
          <b className="pet-name">{pet.name}</b>
          <span className="pet-level">
            Level <span className="mono">{st.level}</span>
          </span>
        </div>
        <p className="pet-title">{titleOf(st.level)}</p>
        <p className="pet-mood">{moodLine(pet.name, st)}</p>
        <div className="pet-xp" title={nextLevelLine(st)}>
          <span style={{ transform: `scaleX(${Math.max(0.02, st.progress)})` }} />
        </div>
        <p className="muted tiny">{nextLevelLine(st)}</p>
        <Meter label="Food" value={st.food} />
        <Meter label="Fun" value={st.fun} />
        {owner && (
          <div className="pet-actions">
            {onCare && (
              <button className="btn small" onClick={onCare}>
                <Icon name="market" size={16} /> Care for {pet.name}
              </button>
            )}
            <label className="pet-toggle">
              <input type="checkbox" checked={pet.inChat !== false} disabled={busy} onChange={(e) => act({ action: 'inChat', on: e.target.checked })} />
              Show next to my name in chat
            </label>
            <button
              className="link-btn small"
              disabled={busy}
              onClick={async () => {
                const n = await promptDialog({ title: 'Rename your pet', initial: pet.name, maxLength: 24, okLabel: 'Rename' });
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
                  body: `${pet.name} goes to a good home and you start over with no pet. Its level doesn’t come back.`,
                  okLabel: 'Rehome',
                  danger: true,
                });
                if (ok) act({ action: 'release' });
              }}
            >
              Rehome
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Adopting: pick a species and a name. Optional; nothing happens until you tap Adopt.
export function AdoptPet() {
  const market = useMarket();
  const [species, setSpecies] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="adopt">
      <p className="muted small">
        A pet is optional. It grows with your time at the lab, shows on your profile, and gets hungry and bored if nobody looks after it. It
        never dies, but it misses you when you stay away.
      </p>
      <div className="adopt-grid" role="radiogroup" aria-label="Pick a pet">
        {SPECIES.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={species === s.id}
            className={`adopt-tile${species === s.id ? ' on' : ''}`}
            onClick={() => setSpecies(s.id)}
          >
            <PetArt species={s.id} mood={species === s.id ? 'happy' : 'ok'} stage="baby" size={72} still={species !== s.id} />
            <span>{s.name}</span>
          </button>
        ))}
      </div>
      <div className="adopt-row">
        <input className="input grow" maxLength={24} value={name} placeholder="Its name" onChange={(e) => setName(e.target.value)} aria-label="Pet name" />
        <button
          className="btn primary"
          disabled={!species || !name.trim() || busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            const r = await market.run('pet', { action: 'adopt', species, name });
            setBusy(false);
            if (r?.note) setError([r.note.title, r.note.body].filter(Boolean).join(' '));
          }}
        >
          Adopt
        </button>
      </div>
      {error && <p className="danger small">{error}</p>}
      <RequestPetLink />
    </div>
  );
}

// The team mascot on Today: the robot, cheered up by the whole team's week.
export function MascotCard({ shifts, tasks, logs, roster }) {
  const m = mascotState({ shifts, tasks, logs, roster });
  const LABEL = { hours: 'Lab hours', tasks: 'Tasks done', logs: 'Lab logs', streaks: 'On a streak' };
  const line =
    m.mood === 'happy' ? 'Fully charged. The team’s been busy.' : m.mood === 'ok' ? 'Running fine. A little more would help.' : 'Low battery. It misses the team.';
  return (
    <section className={`today-sec mascot m-${m.mood}`}>
      <div className="sec-head">
        <h2>Team robot</h2>
        <span className="mascot-energy mono" title="Energy from the last 7 days">
          {m.energy}%
        </span>
      </div>
      <div className="mascot-body">
        <img className="mascot-robot" src={robot} alt="" aria-hidden="true" />
        <div className="mascot-text">
          <p className="mascot-line">{line}</p>
          <span className="mascot-battery" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.max(0.03, m.energy / 100)})` }} />
          </span>
          <ul className="mascot-parts">
            {m.parts.map((p) => (
              <li key={p.key} className={p.pct >= 1 ? 'done' : ''}>
                <span>{LABEL[p.key]}</span>
                <span className="mono">
                  {p.key === 'hours' ? p.have.toFixed(1) : p.have}/{p.goal}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {m.tips.length > 0 && (
        <div className="mascot-tips">
          <h3>What would cheer it up</h3>
          <ul>
            {m.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
