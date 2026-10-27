import { useEffect, useMemo, useRef, useState } from 'react';
import { MinusIcon, PlusIcon } from './common.jsx';
import { answerText, fill, optionsOf } from '../adFlows.js';

// The pieces of an ad's own flow (src/adFlows.js): the fields you fill in,
// and the interactive scenes for when it arrives / when it's time.

// ---------- times for bookings ----------

// Fresh time slots every time the pop-up opens: mostly normal times, the odd
// weird minute, and now and then a 3 AM slot. Today only offers times still ahead.
export const fmtTime = (m) => {
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
function randomTimes(today) {
  const now = new Date();
  const from = today ? now.getHours() * 60 + now.getMinutes() + 10 : 7 * 60;
  const to = 23 * 60 + 59;
  if (from > to - 20) return [to];
  const want = 3 + Math.floor(Math.random() * 2);
  const picked = new Set();
  for (let tries = 0; picked.size < want && tries < 50; tries++) {
    let m;
    if (!today && picked.size === 0 && Math.random() < 0.2)
      m = 60 + Math.floor(Math.random() * 4 * 60); // 1–5 AM
    else m = from + Math.floor(Math.random() * (to - from));
    if (Math.random() < 0.65) m = Math.min(to, Math.ceil(m / 15) * 15); // usually on a quarter hour
    picked.add(Math.min(m, to));
  }
  return [...picked].sort((a, b) => a - b); // minutes after midnight
}
function nextDays(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(
      i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    );
  }
  return out;
}

// Day and time chips. value: { at (ms), label ("Tomorrow at 9:37 PM") }.
function WhenField({ field, onChange }) {
  const days = useMemo(() => nextDays(5), []);
  const times = useMemo(() => days.map((d, i) => randomTimes(i === 0)), [days]);
  const [day, setDay] = useState(1);
  const [time, setTime] = useState(times[1][0]);
  useEffect(() => {
    const at = new Date();
    at.setDate(at.getDate() + day);
    at.setHours(0, time, 0, 0);
    onChange({ at: at.getTime(), label: `${days[day]} at ${fmtTime(time)}` });
  }, [day, time]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <h4>{field.label === 'When' ? 'Day' : `${field.label}: day`}</h4>
      <div className="ads-days when-days">
        {days.map((d, i) => (
          <button
            key={d}
            className={`chip${day === i ? ' on' : ''}`}
            aria-pressed={day === i}
            onClick={() => {
              setDay(i);
              setTime(times[i][0]);
            }}
          >
            {d}
          </button>
        ))}
      </div>
      <h4>Time</h4>
      <div className="ads-days when-times">
        {times[day].map((t) => (
          <button key={t} className={`chip${time === t ? ' on' : ''}`} aria-pressed={time === t} onClick={() => setTime(t)}>
            {fmtTime(t)}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- the fields ----------

export function FlowFields({ flow, answers, setAnswer }) {
  return (
    <div className="flow-fields">
      {flow.fields.map((f) => {
        const value = answers[f.key];
        const set = (v) => setAnswer(f.key, v);
        if (f.type === 'when') return <WhenField key={f.key} field={f} onChange={set} />;
        if (f.type === 'choice' || f.type === 'multi') {
          const opts = optionsOf(f);
          const on = (label) => (f.type === 'multi' ? (value || []).includes(label) : value === label);
          const note = f.type === 'choice' ? opts.find((o) => o.label === value)?.note : null;
          return (
            <div key={f.key} className="flow-field">
              <h4>
                {f.label}
                {f.type === 'multi' && <span className="muted"> · pick {f.max ? `up to ${f.max}` : 'any'}</span>}
              </h4>
              <div className={`ads-days flow-choices${f.big ? ' big' : ''}`} role="group" aria-label={f.label}>
                {opts.map((o) => (
                  <button
                    key={o.label}
                    className={`chip${on(o.label) ? ' on' : ''}`}
                    aria-pressed={on(o.label)}
                    onClick={() => {
                      if (f.type === 'choice') return set(o.label);
                      const list = value || [];
                      if (list.includes(o.label)) set(list.filter((x) => x !== o.label));
                      else if (!f.max || list.length < f.max) set([...list, o.label]);
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {note && <p className="flow-note">{note}</p>}
            </div>
          );
        }
        if (f.type === 'slider')
          return (
            <div key={f.key} className="flow-field">
              <h4>
                {f.label} <b className="flow-value">{answerText(f, value)}</b>
              </h4>
              <input
                type="range"
                className="flow-slider"
                min={f.min}
                max={f.max}
                step={f.step || 1}
                value={value}
                aria-label={f.label}
                onChange={(e) => set(Number(e.target.value))}
              />
              {f.marks && (
                <div className="flow-marks muted tiny">
                  <span>{f.marks[f.min] || f.min}</span>
                  <span>{f.marks[f.max] || f.max}</span>
                </div>
              )}
            </div>
          );
        if (f.type === 'toggle')
          return (
            <label key={f.key} className="flow-field flow-toggle">
              <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
              <span className="grow">
                <b>{f.label}</b>
                <span className="muted small"> · {answerText(f, value)}</span>
              </span>
            </label>
          );
        if (f.type === 'text')
          return (
            <div key={f.key} className="flow-field">
              <h4>{f.label}</h4>
              {(f.max || 120) > 60 ? (
                <textarea
                  className="input"
                  rows={3}
                  maxLength={f.max || 120}
                  placeholder={f.placeholder || ''}
                  value={value}
                  aria-label={f.label}
                  onChange={(e) => set(e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  maxLength={f.max}
                  placeholder={f.placeholder || ''}
                  value={value}
                  aria-label={f.label}
                  onChange={(e) => set(e.target.value)}
                />
              )}
            </div>
          );
        if (f.type === 'qty')
          return (
            <div key={f.key} className="flow-field">
              <h4>{f.label}</h4>
              <div className="ad-qty">
                <button className="btn" onClick={() => set(Math.max(1, value - 1))} aria-label="One fewer">
                  <MinusIcon size={20} />
                </button>
                <b aria-live="polite">{value}</b>
                <button className="btn" onClick={() => set(Math.min(f.max || 99, value + 1))} aria-label="One more">
                  <PlusIcon size={20} />
                </button>
              </div>
            </div>
          );
        return null;
      })}
    </div>
  );
}

// ---------- the scenes ----------

const seeded = (id, n) => [...String(id)].reduce((t, c) => (t * 31 + c.charCodeAt(0)) % 9973, 7) % n;

// Tap the box until it opens.
function UnboxScene({ scene, order, vars, onDone }) {
  const [taps, setTaps] = useState(0);
  const need = scene.taps || 3;
  const got = Math.max(0, (order.qty || 1) - (order.extra?.lost || 0));
  const inside =
    order.extra?.inside || (scene.inside ? fill(scene.inside[seeded(order.id, scene.inside.length)], vars) : order.extra?.unbox || '');
  return (
    <div className="ad-unbox">
      <button
        className={`ad-box${taps ? ` shake-${Math.min(taps, 2)}` : ''}`}
        onClick={() => {
          if (taps + 1 >= need)
            onDone(
              [`You got ${order.kind === 'subscribe' ? `your ${order.brand} box` : `${got} × ${order.item}`}!`, inside]
                .filter(Boolean)
                .join(' '),
              got,
            );
          else setTaps(taps + 1);
        }}
        aria-label="Open your package"
      >
        📦
      </button>
      <p className="muted small">
        {scene.prompt || ['Tap to open it', 'Keep going…', 'Almost…', 'So close…', 'One more…'][Math.min(taps, 4)]}
      </p>
    </div>
  );
}

// Tap fast to fill the meter.
function TapScene({ scene, onDone }) {
  const goal = scene.goal || 15;
  const [n, setN] = useState(0);
  const stages = scene.stages || [];
  const stage = stages.length ? stages[Math.min(stages.length - 1, Math.floor((n / goal) * stages.length))] : '';
  return (
    <div className="scene scene-tap">
      <p className="scene-prompt">{scene.prompt}</p>
      <div className="scene-emoji" key={n} aria-hidden="true">
        {scene.emoji || '👆'}
      </div>
      <div className="scene-meter" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={n}>
        <span style={{ width: `${(n / goal) * 100}%` }} />
      </div>
      {n > 0 && <p className="scene-stage">{stage}</p>}
      <button
        className="btn primary big-btn scene-go"
        onClick={() => {
          if (n + 1 >= goal) onDone(scene.win);
          else setN(n + 1);
        }}
      >
        {scene.button || 'Tap'}
      </button>
    </div>
  );
}

// Press and hold until it's full.
function HoldScene({ scene, onDone }) {
  const ms = scene.ms || 2500;
  const [p, setP] = useState(0);
  const [early, setEarly] = useState(false);
  const start = useRef(0);
  const timer = useRef(null);
  const stages = scene.stages || [];
  const stop = () => {
    clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const down = () => {
    if (timer.current) return;
    setEarly(false);
    start.current = Date.now();
    timer.current = setInterval(() => {
      const v = Math.min(1, (Date.now() - start.current) / ms);
      setP(v);
      if (v >= 1) {
        stop();
        onDone(scene.win);
      }
    }, 50);
  };
  const up = () => {
    if (!timer.current) return;
    stop();
    setP(0);
    setEarly(true);
  };
  return (
    <div className="scene scene-hold">
      <p className="scene-prompt">{scene.prompt}</p>
      <div className="scene-emoji" style={{ transform: `scale(${1 + p * 0.5}) rotate(${p * 8 * Math.sin(p * 40)}deg)` }} aria-hidden="true">
        {scene.emoji || '✋'}
      </div>
      <div className="scene-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <span style={{ width: `${p * 100}%` }} />
      </div>
      <p className="scene-stage">
        {early
          ? scene.early || 'You let go too soon. Again.'
          : p > 0 && stages.length
            ? stages[Math.min(stages.length - 1, Math.floor(p * stages.length))]
            : ' '}
      </p>
      <button
        className="btn primary big-btn scene-go scene-hold-btn"
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), down())}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && up()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {scene.button || 'Hold'}
      </button>
    </div>
  );
}

// Tap the things floating past (not the decoys).
function CatchScene({ scene, onDone }) {
  const goal = scene.goal || 6;
  const fast = scene.speed === 'fast';
  const [items, setItems] = useState([]);
  const [caught, setCaught] = useState(0);
  const [oops, setOops] = useState('');
  const id = useRef(0);
  const done = useRef(false);
  useEffect(() => {
    const spawn = () => {
      const decoy = scene.decoys?.length && Math.random() < 0.3;
      const n = ++id.current;
      setItems((list) => [
        ...list.slice(-8),
        { id: n, emoji: decoy ? scene.decoys[n % scene.decoys.length] : scene.emoji || '⭐', decoy, top: 8 + Math.random() * 70 },
      ]);
    };
    spawn();
    const t = setInterval(spawn, fast ? 650 : 950);
    return () => clearInterval(t);
  }, [fast, scene.decoys, scene.emoji]);
  const tap = (it) => {
    setItems((list) => list.filter((x) => x.id !== it.id));
    if (it.decoy) {
      setCaught((c) => Math.max(0, c - 1));
      setOops(`Not the ${it.emoji}!`);
      return;
    }
    setOops('');
    const next = caught + 1;
    setCaught(next);
    if (next >= goal && !done.current) {
      done.current = true;
      onDone(scene.win);
    }
  };
  return (
    <div className="scene scene-catch">
      <p className="scene-prompt">{scene.prompt}</p>
      <div className={`scene-lane${fast ? ' fast' : ''}`}>
        {items.map((it) => (
          <button
            key={it.id}
            className={`scene-catch-item${it.decoy ? ' decoy' : ''}`}
            style={{ top: `${it.top}%` }}
            onPointerDown={() => tap(it)}
            onAnimationEnd={() => setItems((list) => list.filter((x) => x.id !== it.id))}
            aria-label={it.decoy ? `Decoy ${it.emoji}` : `Catch ${it.emoji}`}
          >
            {it.emoji}
          </button>
        ))}
      </div>
      <p className="scene-stage" aria-live="polite">
        {oops || `${caught} / ${goal}`}
      </p>
    </div>
  );
}

// Scratch the card (or spend a coin… on scratching).
function ScratchScene({ scene, order, vars, onDone }) {
  const canvas = useRef(null);
  const prize = useMemo(() => fill(scene.prizes[seeded(order.id, scene.prizes.length)], vars), [scene, order.id, vars]);
  const [shown, setShown] = useState(false);
  const moves = useRef(0);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, '#b8b8c8');
    g.addColorStop(0.5, '#e8e8f0');
    g.addColorStop(1, '#9a9aaa');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#666';
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH HERE', c.width / 2, c.height / 2 + 8);
  }, []);
  const reveal = () => {
    if (shown) return;
    setShown(true);
    setTimeout(() => onDone(scene.win ? `${prize} ${fill(scene.win, vars)}` : prize), 700);
  };
  const scratch = (e) => {
    if (shown || !(e.buttons || e.pointerType === 'touch')) return;
    const c = canvas.current;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height, 22, 0, Math.PI * 2);
    ctx.fill();
    if (++moves.current % 8) return;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    for (let i = 3; i < data.length; i += 64) if (data[i] === 0) clear++;
    if (clear / (data.length / 64) > 0.45) reveal();
  };
  return (
    <div className="scene scene-scratch">
      <p className="scene-prompt">{scene.prompt}</p>
      <div className="scratch-card">
        <p className="scratch-prize">{prize}</p>
        <canvas
          ref={canvas}
          width={300}
          height={120}
          className={shown ? 'gone' : ''}
          onPointerMove={scratch}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            scratch({ ...e, buttons: 1, clientX: e.clientX, clientY: e.clientY });
          }}
          aria-hidden="true"
        />
      </div>
      <button className="link-btn scene-reveal" onClick={reveal}>
        Use a coin to scratch it (free)
      </button>
    </div>
  );
}

// Find the sweet spot on the dial.
function DialScene({ scene, onDone }) {
  const target = useMemo(() => {
    const t = 8 + Math.floor(Math.random() * 84);
    return Math.abs(t - 50) < 15 ? (t + 30) % 92 : t;
  }, []);
  const [v, setV] = useState(50);
  const [locked, setLocked] = useState(false);
  const off = Math.abs(v - target);
  const hints = scene.hints || ['Cold.', 'Warmer…', 'HOT!'];
  useEffect(() => {
    if (off > 4 || locked) return;
    const t = setTimeout(() => {
      setLocked(true);
      onDone(scene.win);
    }, 600);
    return () => clearTimeout(t);
  }, [off, locked]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="scene scene-dial">
      <p className="scene-prompt">{scene.prompt}</p>
      <div className={`scene-emoji${off <= 12 ? ' hot' : ''}`} aria-hidden="true">
        {scene.emoji || '📻'}
      </div>
      <input
        type="range"
        className="flow-slider scene-dial-input"
        min={0}
        max={100}
        value={v}
        data-target={target}
        aria-label={scene.prompt || 'Dial'}
        onChange={(e) => setV(Number(e.target.value))}
      />
      <div className="flow-marks muted tiny">
        <span>{scene.left || ''}</span>
        <span>{scene.right || ''}</span>
      </div>
      <p className={`scene-stage dial-${off <= 4 ? 'lock' : off <= 12 ? 'hot' : off <= 30 ? 'warm' : 'cold'}`} aria-live="polite">
        {off <= 4 ? 'Locked in!' : off <= 12 ? hints[2] : off <= 30 ? hints[1] : hints[0]}
      </p>
    </div>
  );
}

// Pick a card. The others flip too, so you see what you missed.
function CardsScene({ scene, vars, onDone }) {
  const deck = useMemo(() => [...scene.results].sort(() => Math.random() - 0.5).map((r) => fill(r, vars)), [scene, vars]);
  const [picked, setPicked] = useState(null);
  const [all, setAll] = useState(false);
  return (
    <div className="scene scene-cards">
      <p className="scene-prompt">{scene.prompt}</p>
      <div className="scene-deck">
        {deck.map((r, i) => (
          <button
            key={i}
            className={`scene-card${picked === i || all ? ' flipped' : ''}${picked === i ? ' mine' : ''}`}
            disabled={picked != null}
            onClick={() => {
              setPicked(i);
              setTimeout(() => setAll(true), 700);
              setTimeout(() => onDone(scene.win ? `${r} ${fill(scene.win, vars)}` : r), 1600);
            }}
            aria-label={`Card ${i + 1}`}
          >
            <span className="scene-card-back" aria-hidden="true">
              {scene.emoji || '🃏'}
            </span>
            <span className="scene-card-front">{r}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// A little conversation: they say something, you pick an answer.
export function ChatScene({ lines, brand, vars, onDone, end }) {
  const [log, setLog] = useState([{ them: true, text: fill(lines[0].say, vars) }]);
  const [step, setStep] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView?.({ block: 'nearest' }), [log.length]);
  const pick = (o) => {
    setLog((l) => [...l, { them: false, text: o.label }]);
    setWaiting(true);
    setTimeout(() => {
      const next = lines[step + 1];
      setLog((l) => [...l, { them: true, text: fill(o.reply, vars) }, ...(next ? [{ them: true, text: fill(next.say, vars) }] : [])]);
      setWaiting(false);
      setStep(step + 1);
      if (!next) onDone(end ? fill(end, vars) : fill(o.reply, vars));
    }, 700);
  };
  const line = lines[step];
  return (
    <div className="scene scene-chat">
      <div className="ad-chat">
        {log.map((m, i) => (
          <div key={i} className={`ad-bubble ${m.them ? 'them' : 'me'}`}>
            {m.them && <b>{brand}</b>}
            {m.text}
          </div>
        ))}
        {waiting && (
          <div className="ad-bubble them typing" aria-label={`${brand} is typing`}>
            <span />
            <span />
            <span />
          </div>
        )}
        <span ref={bottom} />
      </div>
      {line && !waiting && (
        <div className="scene-options">
          {line.options.map((o) => (
            <button key={o.label} className="chip" onClick={() => pick(o)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// One scene, by type. onDone(text) when you finish it.
export function Scene({ scene, order, vars, onDone }) {
  const props = { scene, order, vars, onDone: (text, n) => onDone(fill(text || '', vars), n) };
  switch (scene.type) {
    case 'tap':
      return <TapScene {...props} />;
    case 'hold':
      return <HoldScene {...props} />;
    case 'catch':
      return <CatchScene {...props} />;
    case 'scratch':
      return <ScratchScene {...props} />;
    case 'dial':
      return <DialScene {...props} />;
    case 'cards':
      return <CardsScene {...props} />;
    case 'chat':
      return <ChatScene lines={scene.lines} brand={order.brand} vars={vars} end={scene.win} onDone={props.onDone} />;
    default:
      return <UnboxScene {...props} />;
  }
}
