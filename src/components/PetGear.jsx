import { useId } from 'react';
import { PetArt, gemOutline } from './PetArt.jsx';
import { cleanGear } from '../../functions/shared/pets.js';
import { PET_ANCHORS, bodyAnchor, petStage, stageAnchors } from './petAnchors.js';

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
  // Level 50: a grander crown than the level 25 one: red velvet under gold
  // arches set with pearls, a jeweled band, and an orb and cross on top.
  royalcrown: (
    <>
      <path d="M-10.4 -9.4 C-11 -15.4 -6.6 -18.8 0 -18.8 C6.6 -18.8 11 -15.4 10.4 -9.4 Z" fill="#b3173a" stroke="#6f0d24" strokeWidth="1" strokeLinejoin="round" />
      <path d="M-7.6 -11 C-8 -14.4 -5.6 -16.8 -2.4 -17.4" stroke="#e2577a" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M-9.4 -10 C-9.6 -15 -5.4 -18.2 0 -18.6 C5.4 -18.2 9.6 -15 9.4 -10 M0 -9.8 V-18.6" stroke={GOLD_DARK} strokeWidth="2.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-9.4 -10 C-9.6 -15 -5.4 -18.2 0 -18.6 C5.4 -18.2 9.6 -15 9.4 -10 M0 -9.8 V-18.6" stroke={GOLD} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {[[-8.9, -14], [-5.6, -17.2], [5.6, -17.2], [8.9, -14], [0, -14.4]].map(([x, y]) => (
        <circle key={`${x} ${y}`} cx={x} cy={y} r="0.8" fill="#fffaf0" stroke="#c9b48a" strokeWidth="0.3" />
      ))}
      <circle cx="0" cy="-19.9" r="1.8" fill={GOLD} stroke={GOLD_DARK} strokeWidth="0.9" />
      <path d="M0 -21.4 V-24.4 M-1.4 -23 H1.4" stroke={GOLD_DARK} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M0 -21.4 V-24.4 M-1.4 -23 H1.4" stroke="#ffd85c" strokeWidth="1" strokeLinecap="round" />
      <rect x="-11.8" y="-11.6" width="23.6" height="4.8" rx="1.3" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.1" />
      <path d="M-10.6 -10.6 H10.6" stroke="#ffe9a8" strokeWidth="0.7" strokeLinecap="round" opacity="0.9" />
      <ellipse cx="0" cy="-9.2" rx="1.8" ry="1.5" fill="#e0224a" stroke="#8f0f2a" strokeWidth="0.6" />
      <ellipse cx="-5.6" cy="-9.2" rx="1.35" ry="1.15" fill="#2f6fe0" stroke="#173c8a" strokeWidth="0.55" />
      <ellipse cx="5.6" cy="-9.2" rx="1.35" ry="1.15" fill="#2f6fe0" stroke="#173c8a" strokeWidth="0.55" />
      <circle cx="-9.7" cy="-9.2" r="0.95" fill="#1fb072" stroke="#0e6a43" strokeWidth="0.5" />
      <circle cx="9.7" cy="-9.2" r="0.95" fill="#1fb072" stroke="#0e6a43" strokeWidth="0.5" />
      <circle cx="-0.6" cy="-9.8" r="0.45" fill="#fff" opacity="0.85" />
      <circle cx="-6" cy="-9.7" r="0.35" fill="#fff" opacity="0.85" />
      <circle cx="5.2" cy="-9.7" r="0.35" fill="#fff" opacity="0.85" />
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

// ---- Outfits (the body slot), drawn between the pet's body and its head. ----
const RED = '#d62839';
const RED_DARK = '#9b1b2b';
const BLUE = '#1f3f99';
const BLUE_DARK = '#142a6b';
// "12" in block athletic numbers (a 6-tall box), white with a blue outline.
const ONE = 'M0.7 1.4 L2 0.3 V6';
const TWO = 'M0.3 1.7 C0.3 0.2 3.3 0.1 3.3 1.8 C3.3 3.1 0.5 4.1 0.3 6 H3.4';
function Twelve({ x, y, h }) {
  const k = h / 6;
  const at = (dx) => `translate(${x + dx * k} ${y - h / 2}) scale(${k})`;
  const digits = (stroke, w) => (
    <g stroke={stroke} strokeWidth={w} fill="none" strokeLinecap="square" strokeLinejoin="round">
      <path d={ONE} transform={at(-3.3)} />
      <path d={TWO} transform={at(-0.7)} />
    </g>
  );
  return (
    <>
      {digits(BLUE_DARK, 2.3)}
      {digits('#ffffff', 1.15)}
    </>
  );
}

// The level 100 jersey: a red American football jersey with blue sides and
// sleeves piped in white, a blue V collar, a blue and white hem, and a big 12.
// b: bodyAnchor (the torso, in the body's own coordinates). It fills the torso
// ellipse (or the gem's outline) between the head and the hem.
function Jersey({ b, uid, outline }) {
  const { x, y, rx, ry, top, hem } = b;
  const side = rx * 0.64;
  const cut = outline ? top : 0;
  const ny = (top + hem) / 2 + 0.3;
  const nh = Math.min(6.4, (hem - top) * 0.6);
  const half = Math.abs(hem - y) < ry ? rx * Math.sqrt(1 - ((hem - y) / ry) ** 2) : 0;
  const shape = outline ? <path d={outline} /> : <ellipse cx={x} cy={y} rx={rx} ry={ry} />;
  return (
    <>
      <defs>
        <clipPath id={`${uid}s`} clipPath={outline ? `url(#${uid}e)` : undefined}>
          {shape}
        </clipPath>
        {/* On the gem: the stone's outline, and only its middle (a bib, not the point). */}
        {outline && (
          <>
            <clipPath id={`${uid}e`}>
              <ellipse cx={x} cy={y} rx={rx} ry={ry} />
            </clipPath>
            <clipPath id={`${uid}o`}>
              <path d={outline} />
            </clipPath>
          </>
        )}
        <clipPath id={`${uid}h`}>
          <rect x="0" y={cut} width="64" height={hem - cut} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}h)`}>
        <g clipPath={`url(#${uid}s)`}>
          <rect x="0" y="0" width="64" height="64" fill={RED} />
          <ellipse cx={x - rx * 0.3} cy={top + 3} rx={rx * 0.5} ry={ry * 0.45} fill="#fff" opacity="0.14" />
          <path d={`M0 0 H${x - side} V64 H0Z M64 0 H${x + side} V64 H64Z`} fill={BLUE} />
          <path d={`M${x - side} 0 V64 M${x + side} 0 V64`} stroke="#fff" strokeWidth="1.1" />
          <path d={`M0 ${top + 2.6} H${x - side - 1.6} M0 ${top + 4.6} H${x - side - 1.6} M64 ${top + 2.6} H${x + side + 1.6} M64 ${top + 4.6} H${x + side + 1.6}`} stroke="#fff" strokeWidth="0.9" />
          <path d={`M${x - 5.6} ${top - 5} L${x} ${top + 2.2} L${x + 5.6} ${top - 5}`} fill={BLUE} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
          <rect x="0" y={hem - 1.7} width="64" height="1.7" fill={BLUE} />
          <rect x="0" y={hem - 2.5} width="64" height="0.8" fill="#fff" />
          {/* soft shade toward the edges, so it wraps round the body */}
          {outline && <path d={outline} fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="3" />}
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="3" />
        </g>
        {outline ? (
          <>
            <path d={outline} fill="none" stroke={RED_DARK} strokeWidth="1.1" clipPath={`url(#${uid}e)`} />
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke={RED_DARK} strokeWidth="1.1" clipPath={`url(#${uid}o)`} />
          </>
        ) : (
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke={RED_DARK} strokeWidth="1.1" />
        )}
      </g>
      {half > 0 && !outline && <path d={`M${x - half} ${hem} H${x + half}`} stroke={BLUE_DARK} strokeWidth="1" strokeLinecap="round" />}
      {outline && (
        <g clipPath={`url(#${uid}s)`}>
          <path d={`M0 ${top} H64`} stroke="#fff" strokeWidth="1.6" />
          <path d={`M0 ${top} H64`} stroke={BLUE_DARK} strokeWidth="0.6" transform="translate(0 -1)" />
        </g>
      )}
      <Twelve x={x} y={ny} h={nh} />
    </>
  );
}

// The outfit layer: its own svg between PetArt's two layers, with the same
// stage transforms PetArt gives the body (so it fits any species at any stage),
// and never tinted by a fur tint.
function OutfitLayer({ id, species, stage, mood, size, still }) {
  const uid = 'o' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const b = bodyAnchor(species, stage);
  const { s, body: kb } = petStage(species, stage);
  const bodyT = kb !== 1 ? `translate(32 58) scale(${kb}) translate(-32 -58)` : undefined;
  return (
    <svg className={`pet-art pet-layer pet-${mood}${still ? '' : ' anim'}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g className="pet-bob">
        <rect x="0" y="0" width="64" height="64" fill="none" />
        <g transform={`translate(${32 - 32 * s} ${60 - 60 * s}) scale(${s})`}>
          <g transform={bodyT}>{id === 'jersey' && <Jersey b={b} uid={uid} outline={b.gem ? gemOutline(stage) : null} />}</g>
        </g>
      </g>
    </svg>
  );
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
  const tint = `${art.className || ''}${g.palette ? ` pet-tint-${g.palette}` : ''}`;
  // An outfit goes on the body and under the head: the pet in two layers with
  // the outfit between them (it takes the place of a grown pet's scarf).
  const outfit = g.body && (
    <>
      <PetArt {...art} size={size} className={tint} layer="base" scarf={false} title={undefined} />
      <OutfitLayer id={g.body} species={art.species} stage={art.stage} mood={art.mood} size={size} still={art.still} />
      <PetArt {...art} neck={neck} size={size} className={tint} layer="top" scarf={false} title={undefined} />
    </>
  );
  return (
    <span className="pet-geared" style={{ width: size, height: size }} role={outfit && art.title ? 'img' : undefined} aria-label={outfit ? art.title : undefined}>
      {outfit || <PetArt {...art} neck={neck} size={size} className={tint} />}
      {worn && <GearOverlay species={art.species} stage={art.stage} mood={art.mood} size={size} still={art.still} gear={g} />}
    </span>
  );
}
