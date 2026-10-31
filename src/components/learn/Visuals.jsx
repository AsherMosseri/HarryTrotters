// The pictures and boards for each learning game: the rule card, the part
// card, gears, the hub to wire, the inspection board, the code view, the
// "who did this?" entry and the timeline. Answers never come from here: a
// question arrives without its answer, and `result` (from the server, after
// answering) is what marks right and wrong.
import { useMemo, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { Avatar } from '../common.jsx';
import { PART_TYPES } from '../../electrical.js';

// Defined terms in the game manual are in capitals (ROBOT, HIVE TIP...):
// show them the way the manual does.
export function ManualText({ text }) {
  const parts = String(text).split(/(\b[A-Z][A-Z0-9'’-]{2,}(?:\s+[A-Z][A-Z0-9'’-]{1,})*\b)/g);
  return parts.map((p, i) =>
    i % 2 && !/^(TU07|AWG|USB|RS485|XT30|JST|LED|PWM|UVC|ATM|FTC|REV|IMU|RPM|ID|[GRETHI]\d{3}[A-Z.]*)$/.test(p) ? (
      <span key={i} className="lq-term">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

// "Section 9.2, p. 62" → ["Section 9.2", "p. 62"]
export function Citation({ source }) {
  if (!source) return null;
  const m = String(source).match(/^(.*?),\s*(pp?\.\s*[\d–-]+.*)$/);
  return (
    <span className="lq-cite">
      <Icon name="doc" size={14} />
      <span>{m ? m[1] : source}</span>
      {m && <span className="mono">{m[2]}</span>}
    </span>
  );
}

const tfStatement = (prompt) => {
  const m = String(prompt).match(/^True or false:\s*(.*)$/i);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : null;
};
export const isTrueFalse = (q) => q.kind === 'choice' && q.choices?.length === 2 && q.choices[0] === 'True' && q.choices[1] === 'False';

// G2 and strategy: a page from the manual, with the scenario on it.
export function RuleCard({ q }) {
  const statement = isTrueFalse(q) ? tfStatement(q.prompt) : null;
  return (
    <div className="lq-rule">
      <div className="lq-rule-top">
        <span>{q.bank === 'strategy' ? 'Strategy · BIOBUZZ' : 'BIOBUZZ Competition Manual'}</span>
        <span className="mono">2026-27</span>
      </div>
      {statement ? (
        <>
          <div className="lq-kicker">True or false</div>
          <p className="lq-rule-text">
            <ManualText text={statement} />
          </p>
        </>
      ) : (
        <p className="lq-rule-text">
          <ManualText text={q.prompt} />
        </p>
      )}
    </div>
  );
}

// G1: the product photo, or the description to name.
export function PartCard({ q }) {
  const desc = String(q.prompt).match(/^Which part is this\? "(.*)"$/);
  const pn = String(q.prompt).match(/^Which part is (\S+) part number (\S+)\?$/);
  const forPart = String(q.prompt).match(/^What is the (.*) for\?$/);
  if (q.image)
    return (
      <figure className="lq-photo">
        <img src={q.image} alt="The part to name" draggable="false" />
        <figcaption>{q.prompt}</figcaption>
      </figure>
    );
  return (
    <div className="lq-part">
      {desc ? (
        <>
          <div className="lq-kicker">Which part is this?</div>
          <p className="lq-part-desc">{desc[1]}</p>
        </>
      ) : pn ? (
        <>
          <div className="lq-kicker">{pn[1]} part number</div>
          <p className="lq-part-pn mono">{pn[2]}</p>
          <div className="muted small">Which part is it?</div>
        </>
      ) : forPart ? (
        <>
          <div className="lq-kicker">What is it for?</div>
          <p className="lq-part-name">{forPart[1]}</p>
        </>
      ) : (
        <p className="lq-part-desc">{q.prompt}</p>
      )}
    </div>
  );
}

// ---------- gears (G6) ----------
// A spur gear outline with `teeth` teeth (drawn with at most 40 so small
// pictures stay readable).
function gearPath(teeth, r) {
  const n = Math.max(8, Math.min(40, Math.round(teeth)));
  const depth = Math.min(r * 0.16, 7);
  const ro = r;
  const ri = r - depth;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const step = (Math.PI * 2) / n;
    const at = (f, rad) => [Math.cos(a + step * f) * rad, Math.sin(a + step * f) * rad];
    pts.push(at(0, ri), at(0.18, ro), at(0.5, ro), at(0.68, ri));
  }
  return `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z`;
}
function Gear({ x, y, teeth, r, label, spin, dir = 1, hub = true, ly, anchor }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={spin ? `lq-spin${dir < 0 ? ' rev' : ''}` : ''} style={spin ? { animationDuration: `${spin}s` } : undefined}>
        <path d={gearPath(teeth, r)} className="lq-gear" />
        {hub && <circle r={Math.max(4, r * 0.22)} className="lq-gear-hub" />}
        {hub && <path d={`M0 ${-r * 0.6}V${-r * 0.3}`} className="lq-gear-mark" />}
      </g>
      {label && (
        // Side by side gears: the left label ends at its gear's middle and
        // the right one starts at its own, so they never run together.
        <text y={ly ?? r + 16} x={anchor === 'end' ? 4 : anchor === 'start' ? -4 : 0} textAnchor={anchor || 'middle'} className="lq-svg-label">
          {label}
        </text>
      )}
    </g>
  );
}
function Wheel({ x, y, r, label, spin }) {
  const rollers = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={spin ? 'lq-spin' : ''} style={spin ? { animationDuration: `${spin}s` } : undefined}>
        <circle r={r} className="lq-wheel" />
        <circle r={r * 0.72} className="lq-wheel-in" />
        {rollers.map((a) => (
          <path key={a} d={`M${(Math.cos(a) * r * 0.76).toFixed(1)},${(Math.sin(a) * r * 0.76).toFixed(1)}L${(Math.cos(a) * r * 0.96).toFixed(1)},${(Math.sin(a) * r * 0.96).toFixed(1)}`} className="lq-wheel-roller" />
        ))}
        <circle r={r * 0.18} className="lq-gear-hub" />
      </g>
      {label && (
        <text y={r + 16} textAnchor="middle" className="lq-svg-label">
          {label}
        </text>
      )}
    </g>
  );
}
function Motor({ x, y, label }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-34} y={-20} width={46} height={40} rx={6} className="lq-motor" />
      <rect x={12} y={-12} width={10} height={24} rx={2} className="lq-motor" />
      <path d="M-28 -8h34M-28 0h34M-28 8h34" className="lq-motor-ribs" />
      {label && (
        <text y={38} x={-6} textAnchor="middle" className="lq-svg-label">
          {label}
        </text>
      )}
    </g>
  );
}
const gearKey = (id) => (String(id).match(/g-([a-z-]+?)-\d+$/) || [])[1] || '';

// A picture for a gear question, read from the numbers in its prompt.
export function GearVisual({ q }) {
  const p = String(q.prompt);
  const key = gearKey(q.id);
  const num = (re) => {
    const m = p.match(re);
    return m ? Number(m[1]) : null;
  };
  const rpm = num(/(\d+) RPM/);
  const teeth = p.match(/(\d+)-tooth gear that drives a (\d+)-tooth/);
  const ratios = [...p.matchAll(/(\d+(?:\.\d+)?):1/g)].map((m) => Number(m[1]));
  const up = num(/1:(\d+(?:\.\d+)?)/);
  const mm = num(/(\d+) mm/);
  const slow = (s) => Math.min(14, Math.max(2.2, s));
  let body;
  if (teeth) {
    const [a, b] = [Number(teeth[1]), Number(teeth[2])];
    const ra = Math.min(52, 10 + a * 1.3);
    const rb = Math.min(52, 10 + b * 1.3);
    const ly = Math.max(ra, rb) + 16;
    const x0 = 150 - (ra + rb - 4) / 2;
    body = (
      <>
        <Gear x={x0} y={70} teeth={a} r={ra} label={`${a}T driver`} spin={3} ly={ly} anchor="end" />
        <Gear x={x0 + ra + rb - 4} y={70} teeth={b} r={rb} label={`${b}T driven`} spin={slow((3 * b) / a)} dir={-1} ly={ly} anchor="start" />
      </>
    );
  } else if (key === 'two-stage' && ratios.length >= 2) {
    const [a, b] = ratios;
    body = (
      <>
        <Gear x={56} y={74} teeth={12} r={20} label="motor" spin={2.4} />
        <Gear x={56 + 20 + 20 * a - 4} y={74} teeth={12 * a} r={20 * Math.min(a, 2.6)} spin={slow(2.4 * a)} dir={-1} label={`${a}:1`} />
        <Gear x={56 + 20 + 20 * Math.min(a, 2.6) - 4} y={74} teeth={12} r={14} hub={false} spin={slow(2.4 * a)} dir={-1} />
        <Gear x={56 + 20 + 20 * Math.min(a, 2.6) - 4 + 14 + 14 * Math.min(b, 3) - 4} y={74} teeth={12 * b} r={14 * Math.min(b, 3)} spin={slow(2.4 * a * b)} label={`${b}:1`} />
      </>
    );
  } else if (mm || key === 'ticks-rev' || !(ratios[0] || up)) {
    const r = ratios[0];
    body = (
      <>
        <Motor x={70} y={76} label={rpm ? `${rpm} RPM` : 'motor'} />
        {r && r !== 1 ? (
          <>
            <Gear x={128} y={76} teeth={14} r={14} spin={2} />
            <text x={128} y={118} textAnchor="middle" className="lq-svg-label">
              {r}:1
            </text>
          </>
        ) : (
          <path d="M92 76h40" className="lq-shaft" />
        )}
        <Wheel x={200} y={76} r={mm ? Math.min(56, mm / 2.3) : 44} label={mm ? `${mm} mm wheel` : 'wheel'} spin={4} />
      </>
    );
  } else if (key === 'ultraplanetary') {
    const stack = p.match(/cartridges (.*?)\./)?.[1] || '';
    const parts = stack.match(/\d:1/g) || [];
    body = (
      <>
        <Motor x={60} y={76} label="HD Hex" />
        {parts.map((c, i) => (
          <g key={i} transform={`translate(${96 + i * 44} 52)`}>
            <rect width={40} height={48} rx={4} className="lq-cart" />
            <text x={20} y={30} textAnchor="middle" className="lq-svg-mono">
              {c}
            </text>
          </g>
        ))}
        <path d={`M${96 + parts.length * 44}  76h26`} className="lq-shaft" />
      </>
    );
  } else {
    const r = ratios[0] || up;
    const small = 20;
    const big = Math.min(54, small * r);
    const isUp = !!up;
    const ra = isUp ? big : small;
    const rb = isUp ? small : big;
    const x0 = 150 - (ra + rb - 4) / 2;
    const ly = big + 16;
    body = (
      <>
        <Gear x={x0} y={70} teeth={isUp ? 12 * r : 12} r={ra} label={rpm ? `${rpm} RPM in` : 'motor'} spin={2.6} ly={ly} anchor="end" />
        <Gear x={x0 + ra + rb - 4} y={70} teeth={isUp ? 12 : 12 * r} r={rb} label={`${isUp ? `1:${r}` : `${r}:1`} out`} spin={slow(isUp ? 2.6 / r : 2.6 * r)} dir={-1} ly={ly} anchor="start" />
      </>
    );
  }
  return (
    <div className="lq-gearbox">
      <svg viewBox="0 0 300 150" role="img" aria-label="Gear drawing">
        {body}
      </svg>
      <p className="lq-gear-q">{q.prompt}</p>
    </div>
  );
}

// ---------- the hub (G3) ----------
// The Control Hub or Expansion Hub photo with every port where it really is
// (the electrical diagram's port positions). Tap a port, then plug in.
export function HubPuzzle({ q, result, busy, onPick }) {
  const hub = PART_TYPES[q.hub] || PART_TYPES.controlHub;
  const device = PART_TYPES[q.device];
  const [sel, setSel] = useState(null);
  const right = new Set(result?.ports || []);
  const port = hub.ports.find((p) => p.id === sel);
  const label = (p) => {
    if (!p) return '';
    const n = p.id.match(/\d+$/)?.[0];
    return { power: 'XT30 power', motor: `Motor ${n}`, encoder: `Encoder ${n}`, servo: `Servo ${n}`, rs485: 'RS485', i2c: `I²C bus ${n}`, digital: `Digital ${p.label.slice(2)}`, analog: `Analog ${p.label.slice(2)}`, usb: 'USB' }[p.kind];
  };
  return (
    <div className="lq-wiring">
      <div className="lq-device">
        <span className="lq-device-ic">
          <Icon name={device?.icon || 'chip'} size={20} />
        </span>
        <span>
          <span className="lq-kicker">{hub.name}</span>
          <span className="lq-device-q">{q.prompt}</span>
        </span>
      </div>
      <div className="lq-hub" style={{ aspectRatio: `${hub.w} / ${hub.h}` }}>
        <img src={hub.photo} alt={hub.name} draggable="false" />
        {hub.ports.map((p) => {
          const state = result ? (right.has(p.id) ? ' is-right' : result.given === p.id ? ' is-wrong' : '') : sel === p.id ? ' on' : '';
          return (
            <button
              key={p.id}
              className={`lq-port${state}`}
              style={{ left: `${(p.x / hub.w) * 100}%`, top: `${(p.y / hub.h) * 100}%` }}
              onClick={() => !result && setSel(p.id)}
              aria-label={label(p)}
              aria-pressed={sel === p.id}
              disabled={!!result}
            />
          );
        })}
      </div>
      {!result && (
        <div className="lq-plug">
          <span className={port ? '' : 'muted'}>{port ? label(port) : 'Tap a port on the hub.'}</span>
          <button className="btn primary" disabled={!port || busy} onClick={() => onPick(sel)}>
            Plug in here
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- spot the problem (G4) ----------
// An inspection board: a line drawing of what the scene is about and four
// numbered tags to tap. The scene itself is written out under it.
// Which drawing fits the subject (checked in this order); anything left is
// about the robot as a whole (size, signs, lights, mechanisms).
const SCENES = [
  ['battery', /battery|power wire|main switch|no switch|fuse|charging|usb power/i],
  ['wheel', /drive wheel|arm hub|shaft|wheel hub|mecanum|odometry/i],
  ['chain', /chain|sprocket|belt/i],
  ['gears', /gear\b|gear |pinion|motor mount|gear mesh|gear spacing/i],
  ['wires', /wiring|splice|cable|zip ties/i],
  ['slide', /slide/i],
  ['gripper', /claw|intake|wrist|grease|long screw/i],
  ['hub', /encoder|hub|sensor|servo plug|potentiometer|metal box|diagnostic|webcam|port/i],
  ['robot', /./],
];
function sceneKind(q) {
  const subject = String(q.prompt).replace(/:\s*tap the problem\.?$/i, '');
  return SCENES.find(([, re]) => re.test(subject))[0];
}
function SceneArt({ kind }) {
  switch (kind) {
    case 'battery':
      return (
        <g>
          <rect x="70" y="58" width="70" height="44" rx="5" />
          <path d="M84 58v-8h12v8M114 58v-8h12v8" />
          <text x="105" y="86" textAnchor="middle" className="lq-art-text">
            12V
          </text>
          <path d="M140 72c22 0 22-22 44-22h10" />
          <rect x="194" y="40" width="34" height="22" rx="4" />
          <circle cx="211" cy="51" r="5" />
          <path d="M228 51c18 0 18 30 36 30" />
          <rect x="264" y="66" width="50" height="34" rx="4" />
          <path d="M140 88c30 0 40 16 70 16h54" strokeDasharray="5 4" />
        </g>
      );
    case 'hub':
      return (
        <g>
          <rect x="110" y="34" width="120" height="96" rx="8" />
          <circle cx="216" cy="46" r="3.5" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="116" y={52 + i * 18} width="12" height="10" rx="1.5" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={136 + i * 14} y="116" width="9" height="8" rx="1.5" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="214" y={60 + i * 14} width="10" height="8" rx="1.5" />
          ))}
          <path d="M116 57c-30 0-30-18-60-18M116 75c-34 0-38 30-70 30M140 124c0 18-20 18-20 30" />
          <path d="M224 64c26 0 26-22 52-22M224 92h40" strokeDasharray="5 4" />
        </g>
      );
    case 'wires':
      return (
        <g>
          <path d="M40 120h260M60 120V60h220v60" />
          <path d="M70 70c40 0 50 30 90 30s50-30 90-30" />
          <path d="M70 80c40 0 50 30 90 30s50-30 90-30" strokeDasharray="6 4" />
          {[110, 210].map((x) => (
            <path key={x} d={`M${x} 88v24m-5-20h10`} />
          ))}
          <circle cx="270" cy="72" r="16" />
          <path d="M270 56v32M254 72h32" />
        </g>
      );
    case 'chain':
      return (
        <g>
          <circle cx="100" cy="84" r="26" />
          <circle cx="100" cy="84" r="6" />
          <circle cx="240" cy="84" r="40" />
          <circle cx="240" cy="84" r="8" />
          <path d="M100 58L240 44M100 110c50 18 90 22 140 30" strokeDasharray="4 3" />
        </g>
      );
    case 'robot':
      return (
        <g>
          <rect x="96" y="44" width="150" height="80" rx="6" />
          <rect x="80" y="56" width="16" height="24" rx="3" />
          <rect x="80" y="92" width="16" height="24" rx="3" />
          <rect x="246" y="56" width="16" height="24" rx="3" />
          <rect x="246" y="92" width="16" height="24" rx="3" />
          <rect x="130" y="100" width="82" height="18" rx="2" />
          <text x="171" y="113" textAnchor="middle" className="lq-art-text">
            32313
          </text>
          <path d="M171 44V22h40M211 22l14 10" />
          <circle cx="120" cy="64" r="6" />
          <path d="M222 58h14v28h-14z" strokeDasharray="4 3" />
        </g>
      );
    case 'slide':
      return (
        <g>
          <rect x="140" y="30" width="22" height="120" rx="3" />
          <rect x="166" y="14" width="18" height="112" rx="3" />
          <rect x="188" y="40" width="40" height="22" rx="3" />
          <circle cx="175" cy="20" r="6" />
          <path d="M175 26v112M151 150h70" strokeDasharray="5 4" />
          <rect x="226" y="132" width="32" height="22" rx="4" />
        </g>
      );
    case 'gripper':
      return (
        <g>
          <rect x="98" y="62" width="48" height="40" rx="5" />
          <circle cx="146" cy="82" r="7" />
          <path d="M146 82h30M176 82l44-30h24M176 82l44 30h24M244 52v10M244 112v-10" />
          <circle cx="254" cy="82" r="10" strokeDasharray="4 3" />
          <path d="M70 82h28" />
        </g>
      );
    case 'gears':
      return (
        <g>
          <path d={gearPath(14, 30)} transform="translate(116 84)" />
          <circle cx="116" cy="84" r="7" />
          <path d={gearPath(30, 54)} transform="translate(196 84)" />
          <circle cx="196" cy="84" r="9" />
          <rect x="70" y="66" width="22" height="36" rx="4" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M60 50v70h220V50" />
          <path d="M60 64h220" strokeDasharray="5 4" />
          <rect x="150" y="26" width="18" height="118" rx="3" />
          <circle cx="159" cy="85" r="44" />
          <circle cx="159" cy="85" r="30" />
          <path d="M159 85h120" />
          <rect x="230" y="76" width="12" height="18" rx="2" />
          <rect x="100" y="76" width="14" height="18" rx="2" />
        </g>
      );
  }
}
// Leader lines run from each tag (two above the drawing, two below) to the drawing.
const LEADS = [
  [80, 0],
  [260, 0],
  [80, 168],
  [260, 168],
];
const AIMS = [
  [130, 70],
  [210, 66],
  [134, 104],
  [214, 102],
];
export function SpotScene({ q, result, busy, onPick }) {
  const kind = useMemo(() => sceneKind(q), [q]);
  const subject = String(q.prompt).replace(/:\s*tap the problem\.?$/i, '');
  return (
    <div className="lq-spot">
      <div className="lq-board">
        <div className="lq-board-top">
          <span>Inspection</span>
          <b>{subject}</b>
        </div>
        <svg viewBox="0 0 340 168" className="lq-board-art" aria-hidden="true">
          <SceneArt kind={kind} />
          {q.choices.map((_, i) => (
            <g key={i} className="lq-lead">
              <path d={`M${LEADS[i][0]},${LEADS[i][1]}L${AIMS[i][0]},${AIMS[i][1]}`} />
              <circle cx={AIMS[i][0]} cy={AIMS[i][1]} r="4" />
            </g>
          ))}
        </svg>
        {q.choices.map((c, i) => {
          const st = result ? (i === result.answer ? ' is-right' : i === result.given ? ' is-wrong' : ' dim') : '';
          return (
            <button key={i} className={`lq-tag t${i}${st}`} onClick={() => onPick(i)} disabled={!!result || busy}>
              <span className="lq-tag-n mono">{i + 1}</span>
              <span>{c}</span>
            </button>
          );
        })}
      </div>
      <div className="lq-scene">
        <div className="lq-kicker">What you see</div>
        <p>{q.scene}</p>
      </div>
    </div>
  );
}

// ---------- code (G5) ----------
const JAVA_KW =
  /^(double|int|boolean|long|float|if|else|while|for|return|new|true|false|null|public|private|void|class|final|static|this|break|continue|do|switch|case|default|try|catch|import|package|extends|implements|var)$/;
const BLOCK_KW = /^(to|set|call|repeat|while|until|if|else|do|then|not|and|or|change|by|wait|for|each|in|count|with|from|return|true|false)$/;
function tokens(line, lang) {
  const out = [];
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(line))) {
    const [t] = m;
    let cls = '';
    if (m[1]) cls = 'c';
    else if (m[2]) cls = 's';
    else if (m[3]) cls = 'n';
    else if (m[4]) {
      if ((lang === 'blocks' ? BLOCK_KW : JAVA_KW).test(t)) cls = 'k';
      else if (/^[A-Z][A-Z0-9_]{2,}$/.test(t)) cls = 'n';
      else if (line[re.lastIndex] === '(' || (lang === 'blocks' && /^[A-Z]/.test(t))) cls = 'f';
      else if (/^[A-Z]/.test(t)) cls = 't';
    }
    out.push(cls ? (
      <span key={out.length} className={`tk-${cls}`}>
        {t}
      </span>
    ) : (
      t
    ));
  }
  return out;
}
export function CodeView({ lines, lang, pick, onPick, result, readOnly }) {
  return (
    <div className={`lq-code${readOnly ? ' ro' : ''}`}>
      <div className="lq-code-top">
        <span>{lang === 'blocks' ? 'Blocks (written out)' : 'Java'}</span>
        <span className="mono">{lines.length} lines</span>
      </div>
      <ol className="lq-code-lines">
        {lines.map((l, i) => {
          const st = result ? (i === result.bugLine ? ' bug' : i === result.given ? ' is-wrong' : '') : pick === i ? ' on' : '';
          return (
            <li key={i}>
              <button className={`lq-line${st}`} onClick={() => onPick?.(i)} disabled={!!result || readOnly}>
                <span className="lq-ln mono">{i + 1}</span>
                <code>{tokens(l, lang)}</code>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
export function CodeFix({ result, lines, lang }) {
  if (result?.bugLine == null) return null;
  return (
    <div className="lq-diff">
      <div className="lq-kicker">The fix, line {result.bugLine + 1}</div>
      <div className="lq-diff-row del">
        <span className="mono">−</span>
        <code>{tokens(lines[result.bugLine].trim(), lang)}</code>
      </div>
      <div className="lq-diff-row add">
        <span className="mono">+</span>
        <code>{tokens(String(result.fixed).trim(), lang)}</code>
      </div>
    </div>
  );
}

// ---------- who did this? (G8) ----------
export function WhoCard({ q }) {
  const e = q.entry || {};
  return (
    <div className="lq-who">
      <div className="lq-who-top">
        <span className="lq-kicker">
          <Icon name={e.kind === 'log' ? 'doc' : 'check'} size={14} /> {e.kind === 'log' ? 'Lab log' : 'Finished task'}
        </span>
        <span className="mono muted">{e.when}</span>
      </div>
      <p className="lq-who-text">“{e.text}”</p>
      {(e.areas?.length > 0 || e.subteam) && (
        <div className="lq-who-tags">
          {e.subteam && <span className="ll-area-tag">{e.subteam}</span>}
          {(e.areas || []).map((a) => (
            <span key={a} className="ll-area-tag">
              {a}
            </span>
          ))}
        </div>
      )}
      {e.tasks?.length > 0 && (
        <ul className="lq-who-tasks">
          {e.tasks.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
export const PersonChoice = ({ name }) => (
  <>
    <Avatar name={name} size={26} />
    <span>{name}</span>
  </>
);

// ---------- robot timeline (G9) ----------
export function Timeline({ q, result, busy, onSubmit }) {
  const [order, setOrder] = useState(() => q.items.map((i) => i.id));
  const byId = Object.fromEntries(q.items.map((i) => [i.id, i]));
  const shown = result ? result.order : order;
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  return (
    <div className="lq-timeline">
      <ol className="lq-tl">
        {shown.map((id, i) => {
          const it = byId[id];
          const ok = result && result.given?.[i] === id;
          return (
            <li key={id} className={`lq-tl-item${result ? (ok ? ' is-right' : ' is-wrong') : ''}`}>
              <span className="lq-tl-dot" />
              <span className="lq-tl-main">
                <span className="lq-kicker">
                  <Icon name={it.kind === 'version' ? 'robot' : 'milestones'} size={13} /> {it.sub}
                </span>
                <b>{it.label}</b>
                {result && <span className="mono small muted">{result.dates?.[id]}</span>}
              </span>
              {!result && (
                <span className="lq-tl-moves">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Earlier">
                    <Icon name="chevronUp" size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Later">
                    <Icon name="chevronDown" size={18} />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!result && (
        <button className="btn primary lq-wide" disabled={busy} onClick={() => onSubmit(order)}>
          Check the order
        </button>
      )}
    </div>
  );
}
