import { useState } from 'react';
import robot from '../assets/robot-dance.webp';
import { SPECIES, moodLine, mascotState } from '../../functions/shared/pets.js';
import { useMarket } from '../market.js';
import { Icon } from './shell/icons.jsx';
import { confirmDialog, promptDialog } from './Dialogs.jsx';

// Pets (H3): drawn here as small flat SVGs in one style (a round body, a
// round head, the species' ears or tail, and a face that shows the mood).
// They breathe, hop when happy and droop when sad, only while "Moving
// things" plays (shell.css), with transform-only keyframes so iPads stay smooth.

const INK = '#2a2730';
const LOOK = {
  cat: { body: '#f4a65e', dark: '#c3743a', belly: '#fde4c8', nose: '#f08a9b' },
  dog: { body: '#d4a678', dark: '#94673f', belly: '#f5e5d0', nose: INK },
  bunny: { body: '#efe9f5', dark: '#a99cbf', belly: '#ffffff', nose: '#f19bb2' },
  fox: { body: '#ee7a3b', dark: '#b0501f', belly: '#fff3e6', nose: INK },
  owl: { body: '#ab8665', dark: '#6c4f37', belly: '#ecdac2', nose: '#f2b33d' },
  frog: { body: '#84c770', dark: '#4b8f3e', belly: '#e0f2cc', nose: INK },
};
const SCALE = { baby: 0.78, young: 0.9, grown: 1 };

function Eyes({ mood, at = [26.5, 37.5], y = 28 }) {
  if (mood === 'happy')
    return at.map((x) => <path key={x} d={`M${x - 2.6} ${y + 0.6} Q${x} ${y - 2.6} ${x + 2.6} ${y + 0.6}`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />);
  return at.map((x, i) => (
    <g key={x}>
      <circle cx={x} cy={y} r={mood === 'sad' ? 2.1 : 2.4} fill={INK} />
      <circle cx={x + 0.8} cy={y - 0.8} r="0.7" fill="#fff" />
      {mood === 'sad' && (
        <path
          d={i ? `M${x + 3} ${y - 3.4} L${x - 2.4} ${y - 5}` : `M${x - 3} ${y - 3.4} L${x + 2.4} ${y - 5}`}
          stroke={INK}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      )}
    </g>
  ));
}
function Mouth({ mood, y = 33.5 }) {
  if (mood === 'happy') return <path d={`M28.6 ${y - 1} Q32 ${y + 4} 35.4 ${y - 1} Z`} fill="#7a2f3a" />;
  if (mood === 'sad') return <path d={`M29.5 ${y + 1.4} Q32 ${y - 1.2} 34.5 ${y + 1.4}`} stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  return <path d={`M29.5 ${y - 0.4} Q32 ${y + 1.8} 34.5 ${y - 0.4}`} stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
}
const Cheeks = ({ y = 32 }) => (
  <>
    <ellipse cx="22.8" cy={y} rx="2.6" ry="1.6" fill="#f28b9b" opacity="0.5" />
    <ellipse cx="41.2" cy={y} rx="2.6" ry="1.6" fill="#f28b9b" opacity="0.5" />
  </>
);

// Behind the body: tails and long ears.
function Back({ species, c }) {
  const line = { stroke: c.dark, strokeWidth: 1.5 };
  if (species === 'cat')
    return (
      <g className="pet-tail">
        <path d="M44 51 C54 52 57 41 51.5 35.5" stroke={c.dark} strokeWidth="6.5" fill="none" strokeLinecap="round" />
        <path d="M44 51 C54 52 57 41 51.5 35.5" stroke={c.body} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      </g>
    );
  if (species === 'dog')
    return (
      <g className="pet-tail">
        <path d="M45 47 C51 46 53 41 51.5 37" stroke={c.dark} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M45 47 C51 46 53 41 51.5 37" stroke={c.body} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      </g>
    );
  if (species === 'fox')
    return (
      <g className="pet-tail">
        <ellipse cx="49.5" cy="45" rx="6.5" ry="12" transform="rotate(38 49.5 45)" fill={c.body} {...line} />
        <ellipse cx="54.6" cy="38.2" rx="3.2" ry="4.2" transform="rotate(38 54.6 38.2)" fill={c.belly} />
      </g>
    );
  if (species === 'bunny')
    return (
      <>
        <circle cx="47" cy="51" r="4" fill={c.belly} {...line} />
        <ellipse cx="25.5" cy="11" rx="4.3" ry="10.5" transform="rotate(-10 25.5 11)" fill={c.body} {...line} />
        <ellipse cx="38.5" cy="11" rx="4.3" ry="10.5" transform="rotate(10 38.5 11)" fill={c.body} {...line} />
        <ellipse cx="25.6" cy="12" rx="2" ry="7" transform="rotate(-10 25.6 12)" fill={c.nose} opacity="0.55" />
        <ellipse cx="38.4" cy="12" rx="2" ry="7" transform="rotate(10 38.4 12)" fill={c.nose} opacity="0.55" />
      </>
    );
  return null;
}

function Ears({ species, c }) {
  const line = { stroke: c.dark, strokeWidth: 1.5, strokeLinejoin: 'round' };
  if (species === 'cat')
    return (
      <>
        <path d="M20.5 21 L21 9 L29.5 15.5 Z" fill={c.body} {...line} />
        <path d="M43.5 21 L43 9 L34.5 15.5 Z" fill={c.body} {...line} />
        <path d="M22.4 17.5 L22.6 12.6 L26.3 15.4 Z" fill={c.nose} opacity="0.6" />
        <path d="M41.6 17.5 L41.4 12.6 L37.7 15.4 Z" fill={c.nose} opacity="0.6" />
      </>
    );
  if (species === 'fox')
    return (
      <>
        <path d="M19 22 L18 6.5 L30 14.5 Z" fill={c.body} {...line} />
        <path d="M45 22 L46 6.5 L34 14.5 Z" fill={c.body} {...line} />
        <path d="M21 17.5 L20.5 11 L26 14.8 Z" fill={c.dark} opacity="0.7" />
        <path d="M43 17.5 L43.5 11 L38 14.8 Z" fill={c.dark} opacity="0.7" />
      </>
    );
  if (species === 'owl')
    return (
      <>
        <path d="M18.5 19 L19.5 7 L27 14 Z" fill={c.body} {...line} />
        <path d="M45.5 19 L44.5 7 L37 14 Z" fill={c.body} {...line} />
      </>
    );
  return null;
}

// In front of the head: dog ears, muzzles, noses.
function Front({ species, c }) {
  if (species === 'dog')
    return (
      <>
        <ellipse cx="18.8" cy="27" rx="4.6" ry="8.5" transform="rotate(18 18.8 27)" fill={c.dark} />
        <ellipse cx="45.2" cy="27" rx="4.6" ry="8.5" transform="rotate(-18 45.2 27)" fill={c.dark} />
        <ellipse cx="32" cy="32.5" rx="6.5" ry="4.6" fill={c.belly} />
        <ellipse cx="32" cy="30.6" rx="2.3" ry="1.6" fill={c.nose} />
      </>
    );
  if (species === 'fox')
    return (
      <>
        <path d="M18.5 28 Q24 38 32 38.5 Q40 38 45.5 28 Q40 33 32 33.5 Q24 33 18.5 28 Z" fill={c.belly} />
        <ellipse cx="32" cy="31" rx="2" ry="1.4" fill={c.nose} />
      </>
    );
  if (species === 'cat')
    return (
      <>
        <path d="M30.4 30.4 L33.6 30.4 L32 32.2 Z" fill={c.nose} />
        <path d="M20 31 L14.5 30M20 33 L14.8 34M44 31 L49.5 30M44 33 L49.2 34" stroke={c.dark} strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
      </>
    );
  if (species === 'bunny') return <ellipse cx="32" cy="31" rx="1.7" ry="1.2" fill={c.nose} />;
  return null;
}

export function PetArt({ species = 'cat', mood = 'ok', stage = 'young', size = 64, still = false, className = '', title }) {
  const c = LOOK[species] || LOOK.cat;
  const line = { stroke: c.dark, strokeWidth: 1.5 };
  const s = SCALE[stage] || 1;
  const feet = (
    <>
      <ellipse cx="25" cy="56.5" rx="4.6" ry="2.6" fill={c.dark} />
      <ellipse cx="39" cy="56.5" rx="4.6" ry="2.6" fill={c.dark} />
    </>
  );
  const scarf = stage === 'grown' && (
    <path d="M21.5 40 Q32 45.5 42.5 40 L42.8 43.6 Q32 49 21.2 43.6 Z" fill="#e0475b" stroke="#a52f40" strokeWidth="1" strokeLinejoin="round" />
  );
  let figure;
  if (species === 'owl') {
    figure = (
      <>
        {feet}
        <Ears species="owl" c={c} />
        <ellipse cx="32" cy="38" rx="17" ry="19.5" fill={c.body} {...line} />
        <ellipse cx="32" cy="45" rx="10" ry="10" fill={c.belly} />
        <ellipse cx="15.6" cy="42" rx="4" ry="9" transform="rotate(12 15.6 42)" fill={c.dark} />
        <ellipse cx="48.4" cy="42" rx="4" ry="9" transform="rotate(-12 48.4 42)" fill={c.dark} />
        <circle cx="25.5" cy="29" r="6.6" fill="#fff" stroke={c.dark} strokeWidth="1.2" />
        <circle cx="38.5" cy="29" r="6.6" fill="#fff" stroke={c.dark} strokeWidth="1.2" />
        <g className="pet-eyes">
          <Eyes mood={mood} at={[25.5, 38.5]} y={29} />
        </g>
        <path d="M30 34 L34 34 L32 37.4 Z" fill={c.nose} stroke={c.dark} strokeWidth="0.8" strokeLinejoin="round" />
        {scarf}
      </>
    );
  } else if (species === 'frog') {
    figure = (
      <>
        {feet}
        <ellipse cx="32" cy="45" rx="15.5" ry="12.5" fill={c.body} {...line} />
        <ellipse cx="32" cy="47.5" rx="9.5" ry="7.5" fill={c.belly} />
        {scarf}
        <ellipse cx="32" cy="29" rx="17" ry="12" fill={c.body} {...line} />
        <circle cx="23" cy="19.5" r="6.2" fill={c.body} {...line} />
        <circle cx="41" cy="19.5" r="6.2" fill={c.body} {...line} />
        <circle cx="23" cy="19.5" r="4" fill="#fff" />
        <circle cx="41" cy="19.5" r="4" fill="#fff" />
        <g className="pet-eyes">
          <Eyes mood={mood} at={[23, 41]} y={19.8} />
        </g>
        <Cheeks y={31} />
        <Mouth mood={mood} y={32} />
      </>
    );
  } else {
    figure = (
      <>
        <Back species={species} c={c} />
        {feet}
        <ellipse cx="32" cy="45" rx="15" ry="12.5" fill={c.body} {...line} />
        <ellipse cx="32" cy="47.5" rx="9" ry="7.6" fill={c.belly} />
        {scarf}
        <Ears species={species} c={c} />
        <circle cx="32" cy="27.5" r="14" fill={c.body} {...line} />
        <Front species={species} c={c} />
        <g className="pet-eyes">
          <Eyes mood={mood} />
        </g>
        <Cheeks />
        <Mouth mood={mood} y={species === 'dog' ? 35 : 34.5} />
      </>
    );
  }
  return (
    <svg
      className={`pet-art pet-${mood}${still ? '' : ' anim'} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <ellipse cx="32" cy="60" rx={14 * s} ry="2.4" fill="currentColor" opacity="0.12" />
      <g className="pet-bob">
        <g transform={`translate(${32 - 32 * s} ${60 - 60 * s}) scale(${s})`}>{figure}</g>
      </g>
    </svg>
  );
}

// A small still pet next to a name in chat (when its owner shows it there).
export function PetBadge({ name }) {
  const market = useMarket();
  const mine = market?.petOf(name);
  if (!mine || mine.pet.inChat === false) return null;
  return (
    <span className="pet-badge" title={`${mine.pet.name}, level ${mine.st.level}`}>
      <PetArt species={mine.pet.species} mood={mine.st.mood} stage={mine.st.stage} size={18} still />
    </span>
  );
}

function Meter({ label, value, tone }) {
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
function nextLevelLine(st) {
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
        <PetArt species={pet.species} mood={st.mood} stage={st.stage} size={big ? 148 : 92} title={`${pet.name} the ${pet.species}`} />
      </div>
      <div className="pet-info">
        <div className="pet-name-row">
          <b className="pet-name">{pet.name}</b>
          <span className="pet-level">
            Level <span className="mono">{st.level}</span>
          </span>
        </div>
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
