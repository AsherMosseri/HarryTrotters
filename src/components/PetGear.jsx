import { PetArt } from './PetArt.jsx';
import { cleanGear } from '../../functions/shared/pets.js';
import { PET_ANCHORS, petStage, stageAnchors } from './petAnchors.js';

// Gear for pets (unlocked by level, see functions/shared/pets.js): small flat
// SVGs drawn over the pet art in the same 64x64 box, so any pet can wear any
// of it. The pet art itself is drawn in Pet.jsx; everything that says WHERE
// on a pet a thing goes is in ANCHORS below, so redrawn art only needs new
// numbers here.
//
// Where things sit on each pet comes from petAnchors.js (the numbers for the
// redrawn art, already moved for baby/young/grown by stageAnchors): hats are
// drawn for a radius-14 head at the origin and scaled/moved onto the head;
// glasses are sized from the eye line; neck gear sits at the scarf point.
const anchorsOf = (species, stage) => {
  const a = stageAnchors(species, stage);
  return {
    head: a.head,
    eyes: { y: a.eyes.y, xs: [a.eyes.x - a.eyes.gap / 2, a.eyes.x + a.eyes.gap / 2] },
    neck: { x: a.neck.x, y: a.neck.y - 3, w: Math.min(12, a.neck.w * 0.45) },
  };
};

const GOLD = '#f2b82e';
const GOLD_DARK = '#a8741a';

// ---- Head gear, drawn for a head of radius 14 centered at (0, 0). ----
const HEAD = {
  cap: (
    <>
      <path d="M-12.6 -5 C-12.6 -22 12.6 -22 12.6 -5 Z" fill="#d6404f" stroke="#8f2733" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M0 -17.5 L0 -5.4" stroke="#8f2733" strokeWidth="0.8" opacity="0.55" />
      <path d="M-12.2 -5.6 Q0 1.8 12.2 -5.6 Q0 -9 -12.2 -5.6 Z" fill="#ad2d3b" stroke="#8f2733" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="0" cy="-17.2" r="1.3" fill="#8f2733" />
      <rect x="-3" y="-13.2" width="6" height="2" rx="1" fill="#fff" opacity="0.85" />
    </>
  ),
  hardhat: (
    <>
      <ellipse cx="0" cy="-4.6" rx="15.6" ry="2.4" fill="#d9a21b" stroke="#8a6410" strokeWidth="1" />
      <path d="M-13.4 -4.8 C-13.4 -23 13.4 -23 13.4 -4.8 Z" fill="#f6c231" stroke="#8a6410" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M-2.4 -18.4 L2.4 -18.4 L2.4 -5 L-2.4 -5 Z" fill="#d9a21b" opacity="0.9" />
      <path d="M-9.5 -13 Q-8 -17 -4.5 -18" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.55" />
    </>
  ),
  headset: (
    <>
      <path d="M-14.6 1 C-14.6 -21 14.6 -21 14.6 1" stroke="#3a4152" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="-14.8" cy="2" rx="3.2" ry="4.8" fill="#3a4152" stroke="#232834" strokeWidth="1" />
      <ellipse cx="14.8" cy="2" rx="3.2" ry="4.8" fill="#3a4152" stroke="#232834" strokeWidth="1" />
      <ellipse cx="-15.2" cy="2" rx="1.3" ry="2.6" fill="#e0475b" />
      <ellipse cx="15.2" cy="2" rx="1.3" ry="2.6" fill="#e0475b" />
      <path d="M15 6.2 Q14.5 13 6.4 12.6" stroke="#3a4152" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle cx="5.4" cy="12.5" r="1.8" fill="#232834" />
    </>
  ),
  // Event gear (shared/pets.js EVENT_GEAR): a hi-vis cap with a reflective stripe.
  'pitcrew-cap': (
    <>
      <path d="M-12.8 -5 C-12.8 -22.4 12.8 -22.4 12.8 -5 Z" fill="#ff7a1a" stroke="#a94700" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M-11.6 -11 Q0 -17.4 11.6 -11" stroke="#e8edf2" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M-11.6 -11 Q0 -17.4 11.6 -11" stroke="#9aa6b2" strokeWidth="0.5" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M-14.6 -4.4 Q0 3.2 14.6 -4.4 Q0 -8.6 -14.6 -4.4 Z" fill="#d9600a" stroke="#a94700" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="0" cy="-20" r="1.4" fill="#a94700" />
      <circle cx="0" cy="-8.6" r="2.3" fill="#fff" opacity="0.92" />
      <path d="M0 -10.6 V-6.6 M-2 -8.6 H2" stroke="#a94700" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  crown: (
    <>
      <path d="M-9.5 -8 L-11 -19 L-5.4 -13.4 L0 -20.6 L5.4 -13.4 L11 -19 L9.5 -8 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.1" strokeLinejoin="round" />
      <rect x="-9.6" y="-10.4" width="19.2" height="2.8" rx="0.8" fill="#e09a14" stroke={GOLD_DARK} strokeWidth="0.8" />
      <circle cx="-11" cy="-19.2" r="1.3" fill="#e0475b" />
      <circle cx="0" cy="-20.8" r="1.4" fill="#3b82f6" />
      <circle cx="11" cy="-19.2" r="1.3" fill="#e0475b" />
    </>
  ),
};

// ---- Face gear, sized from the eye line. ----
function Face({ id, eyes }) {
  const [lx, rx] = eyes.xs;
  // Lenses follow the eye spacing, but a frog's wide-set eyes don't get giant ones.
  const w = Math.min(6.2, Math.max(4.2, (rx - lx) * 0.43));
  const h = w * 0.82;
  const y = eyes.y;
  if (id === 'safety')
    return (
      <>
        {[lx, rx].map((x) => (
          <rect key={x} x={x - w} y={y - h} width={w * 2} height={h * 2} rx={w * 0.5} fill="#bfe6ff" fillOpacity="0.38" stroke="#4f6a86" strokeWidth="1.1" />
        ))}
        <path d={`M${lx + w} ${y - h * 0.3} L${rx - w} ${y - h * 0.3}`} stroke="#4f6a86" strokeWidth="1.2" />
        <path d={`M${lx - w} ${y - h * 0.3} L${lx - w - 3} ${y - h * 0.6}M${rx + w} ${y - h * 0.3} L${rx + w + 3} ${y - h * 0.6}`} stroke="#4f6a86" strokeWidth="1.1" strokeLinecap="round" />
        <path d={`M${lx - w * 0.55} ${y - h * 0.55} L${lx - w * 0.1} ${y - h * 0.8}`} stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
      </>
    );
  if (id === 'sunglasses')
    return (
      <>
        {[lx, rx].map((x) => (
          <rect key={x} x={x - w} y={y - h * 0.85} width={w * 2} height={h * 1.8} rx={w * 0.55} fill="#1e2330" stroke="#0e1118" strokeWidth="1" />
        ))}
        <path d={`M${lx + w} ${y - h * 0.3} L${rx - w} ${y - h * 0.3}`} stroke="#0e1118" strokeWidth="1.6" />
        <path d={`M${lx - w} ${y - h * 0.2} L${lx - w - 3} ${y - h * 0.5}M${rx + w} ${y - h * 0.2} L${rx + w + 3} ${y - h * 0.5}`} stroke="#0e1118" strokeWidth="1.3" strokeLinecap="round" />
        <path d={`M${lx - w * 0.5} ${y - h * 0.5} L${lx} ${y - h * 0.7}M${rx - w * 0.5} ${y - h * 0.5} L${rx} ${y - h * 0.7}`} stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      </>
    );
  if (id === 'monocle') {
    const r = w * 1.05;
    return (
      <>
        <circle cx={rx} cy={y} r={r} fill="#fff" fillOpacity="0.28" stroke={GOLD} strokeWidth="1.5" />
        <path d={`M${rx - r * 0.55} ${y - r * 0.5} L${rx - r * 0.1} ${y - r * 0.78}`} stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
        <path d={`M${rx + r * 0.7} ${y + r * 0.75} Q${rx + r * 1.6} ${y + r * 2.6} ${rx + r * 0.2} ${y + r * 3.4}`} stroke={GOLD} strokeWidth="0.8" fill="none" strokeLinecap="round" />
      </>
    );
  }
  return null;
}

// ---- Neck gear. ----
function Neck({ id, neck }) {
  const { x, y, w } = neck;
  if (id === 'bandana')
    return (
      <>
        <path d={`M${x - w} ${y - 1} Q${x} ${y + 2.4} ${x + w} ${y - 1} L${x} ${y + 9} Z`} fill="#e0475b" stroke="#a52f40" strokeWidth="1" strokeLinejoin="round" />
        {[[-4, 1.6], [3.6, 1.2], [0, 4.6], [-1.6, 5.6]].map(([dx, dy], i) => (
          <circle key={i} cx={x + dx} cy={y + dy} r="0.8" fill="#fff" opacity="0.85" />
        ))}
        <circle cx={x - w + 0.6} cy={y - 0.8} r="1.7" fill="#c63a4d" stroke="#a52f40" strokeWidth="0.8" />
        <circle cx={x + w - 0.6} cy={y - 0.8} r="1.7" fill="#c63a4d" stroke="#a52f40" strokeWidth="0.8" />
      </>
    );
  if (id === 'bowtie')
    return (
      <>
        <path d={`M${x - 1} ${y + 1.6} L${x - 7.2} ${y - 2} L${x - 7.2} ${y + 5.2} Z`} fill="#3b5bdb" stroke="#27389a" strokeWidth="1" strokeLinejoin="round" />
        <path d={`M${x + 1} ${y + 1.6} L${x + 7.2} ${y - 2} L${x + 7.2} ${y + 5.2} Z`} fill="#3b5bdb" stroke="#27389a" strokeWidth="1" strokeLinejoin="round" />
        <circle cx={x} cy={y + 1.6} r="1.9" fill="#2d46b0" stroke="#27389a" strokeWidth="0.8" />
      </>
    );
  // Event gear: a gold medal on a blue and white ribbon, with the date on it.
  if (id === 'medal-nov14')
    return (
      <>
        <path d={`M${x - 4.6} ${y - 1.2} L${x - 0.6} ${y + 7} M${x + 4.6} ${y - 1.2} L${x + 0.6} ${y + 7}`} stroke="#2f5fe0" strokeWidth="2.8" strokeLinecap="butt" />
        <path d={`M${x - 4.6} ${y - 1.2} L${x - 0.6} ${y + 7} M${x + 4.6} ${y - 1.2} L${x + 0.6} ${y + 7}`} stroke="#fff" strokeWidth="0.7" strokeLinecap="butt" opacity="0.85" />
        <circle cx={x} cy={y + 10.2} r="4.2" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1" />
        <circle cx={x} cy={y + 10.2} r="2.9" fill="none" stroke="#fff3b0" strokeWidth="0.6" />
        <text x={x} y={y + 11.7} textAnchor="middle" fontSize="4.2" fontWeight="800" fill="#7a4f0c" fontFamily="system-ui, sans-serif">
          14
        </text>
      </>
    );
  if (id === 'medal' || id === 'goldmedal') {
    const gold = id === 'goldmedal';
    return (
      <>
        <path d={`M${x - 4.6} ${y - 1.2} L${x - 0.6} ${y + 7} M${x + 4.6} ${y - 1.2} L${x + 0.6} ${y + 7}`} stroke={gold ? '#d6404f' : '#2f6fdb'} strokeWidth="2.6" strokeLinecap="butt" />
        <circle cx={x} cy={y + 9.6} r="3.6" fill={gold ? GOLD : '#cd8a4a'} stroke={gold ? GOLD_DARK : '#8a5a1f'} strokeWidth="1" />
        <circle cx={x} cy={y + 9.6} r="2.1" fill="none" stroke={gold ? '#fff3b0' : '#eab887'} strokeWidth="0.8" />
        {gold && <path d={`M${x} ${y + 7.9} L${x + 0.7} ${y + 9.3} L${x + 2.2} ${y + 9.4} L${x + 1} ${y + 10.4} L${x + 1.4} ${y + 11.9} L${x} ${y + 11} L${x - 1.4} ${y + 11.9} L${x - 1} ${y + 10.4} L${x - 2.2} ${y + 9.4} L${x - 0.7} ${y + 9.3} Z`} fill="#fff3b0" />}
      </>
    );
  }
  return null;
}

// Over a hat it floats higher.
function Halo({ head, high }) {
  const y = head.y - head.r - head.up - (high ? 9 : 3.4);
  return (
    <g className="gear-halo">
      <ellipse cx={head.x} cy={y} rx="8.4" ry="2.8" fill="none" stroke={GOLD} strokeWidth="2.2" />
      <ellipse cx={head.x} cy={y - 0.5} rx="8.4" ry="2.8" fill="none" stroke="#fff6c8" strokeWidth="0.8" opacity="0.75" />
    </g>
  );
}

// The gear itself, over a pet drawn in the same 64x64 box (`size` px).
export function GearOverlay({ species, gear, stage = 'young', mood = 'ok', size = 64, still = false }) {
  const g = cleanGear(gear);
  const a = anchorsOf(species, stage);
  const k = a.head.r / 14;
  const hat = HEAD[g.head];
  return (
    <svg className={`pet-art pet-gear pet-${mood}${still ? '' : ' anim'}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g className="pet-bob">
        <g>
          {/* Keeps the bobbing in step with the pet underneath. */}
          <rect x="15" y="5" width="34" height="54" fill="none" />
          {g.neck && !(PET_ANCHORS[species] || PET_ANCHORS.cat).under && <Neck id={g.neck} neck={a.neck} />}
          {/* The chicken pecks: its head gear moves with the head (same translate-only keyframe). */}
          <g className={species === 'chicken' ? 'pet-peck' : undefined}>
            {g.face && <Face id={g.face} eyes={a.eyes} />}
            {/* A headset wraps the head's sides, so it stays put; the rest ride up over a comb or spines. */}
            {hat && <g transform={`translate(${a.head.x} ${a.head.y - (g.head === 'headset' ? 0 : a.head.up)}) scale(${k})`}>{hat}</g>}
            {g.extra === 'halo' && <Halo head={a.head} high={!!hat} />}
          </g>
        </g>
      </g>
    </svg>
  );
}

// A pet with what it wears. Takes PetArt's props plus `gear`.
export function PetWithGear({ gear, size = 64, ...art }) {
  const g = cleanGear(gear);
  const anchor = PET_ANCHORS[art.species] || PET_ANCHORS.cat;
  // A pet with something hanging over its neck (anchor.under: the monkey's
  // nose, the chicken's wattle): neck gear goes inside its own drawing, under
  // the head, at the same spot and size the overlay would put it (the
  // overlay's numbers divided back by the stage scale the art is drawn at).
  const under = !!(g.neck && anchor.under);
  const worn = g.head || g.face || g.extra || (g.neck && !under);
  let neck = null;
  if (under) {
    const n = anchor.neck;
    const { s } = petStage(art.species, art.stage);
    neck = <Neck id={g.neck} neck={{ x: n.x, y: n.y - 3 / s, w: Math.min(12, n.w * s * 0.45) / s }} />;
  }
  return (
    <span className="pet-geared" style={{ width: size, height: size }}>
      <PetArt {...art} neck={neck} size={size} className={`${art.className || ''}${g.palette ? ` pet-tint-${g.palette}` : ''}`} />
      {worn && <GearOverlay species={art.species} stage={art.stage} mood={art.mood} size={size} still={art.still} gear={g} />}
    </span>
  );
}
