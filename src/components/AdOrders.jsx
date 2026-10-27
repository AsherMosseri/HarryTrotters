import { useEffect, useRef, useState } from 'react';
import { CloseIcon, Overlay } from './common.jsx';
import { useNow } from './Shifts.jsx';
import { useEscape } from '../util.js';
import { KIND_NOUN, clip, progress } from '../adOrders.js';
import { adStyle } from './Ads.jsx';

// What happens after an ad's booking / order / submission / subscription
// (planned in adOrders.js): a tracker for each one, and a list of them all.

const MIN = 60000;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clock = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dayClock = (ms) => {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const day =
    d.toDateString() === today.toDateString()
      ? 'Today'
      : d.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${clock(ms)}`;
};
export function untilText(ms) {
  const m = Math.max(1, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}`;
}
const readLocal = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
};

const has = (order, step, now) => order.events.some((e) => e.step === step && e.at <= now);
const stepAt = (order, step) => order.events.find((e) => e.step === step)?.at;

// One short line for the list.
export function orderStatus(order, now) {
  const { last } = progress(order, now);
  if (order.kind === 'book') {
    const start = stepAt(order, 'start');
    return now < start ? `In ${untilText(start - now)}` : now - start < 2 * 60 * MIN ? 'It’s time' : 'Done';
  }
  if (order.kind === 'submit') return has(order, 'reply', now) ? 'They replied' : 'In review';
  if (has(order, 'delivered', now)) return order.kind === 'subscribe' ? 'Subscribed · box delivered' : 'Delivered';
  return last?.title || 'Placed';
}
export const orderActive = (order, now) => !progress(order, now).finished && !(order.kind === 'subscribe' && has(order, 'delivered', now));

function Stars({ id, thanks }) {
  const key = `ad-rated-${id}`;
  const [rated, setRated] = useState(() => readLocal(key, 0));
  if (rated)
    return (
      <p className="ad-track-rated">
        {'⭐'.repeat(rated)} <span className="muted">{thanks}</span>
      </p>
    );
  return (
    <div className="ad-track-stars" role="group" aria-label="Rate it">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className="link-btn"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => {
            writeLocal(key, n);
            setRated(n);
          }}
        >
          ☆
        </button>
      ))}
    </div>
  );
}
const THANKS = [
  'Thanks! Your rating has been lost in the mail.',
  'Thanks! We’ve framed it.',
  'Thanks! Kevin cried a little.',
  'Thanks! It’s been forwarded to the moon.',
];
const pickFor = (id, list) => list[[...id].reduce((t, c) => t + c.charCodeAt(0), 0) % list.length];

// The delivery: tap the box a few times to open it.
function Unbox({ order }) {
  const key = `ad-unboxed-${order.id}`;
  const [open, setOpen] = useState(() => readLocal(key, false));
  const [taps, setTaps] = useState(0);
  const got = Math.max(0, order.qty - (order.extra?.lost || 0));
  const what = order.kind === 'subscribe' ? `${order.brand} box` : order.item;
  if (!open)
    return (
      <div className="ad-unbox">
        <button
          className={`ad-box${taps ? ` shake-${taps}` : ''}`}
          onClick={() => {
            if (taps >= 2) {
              writeLocal(key, true);
              setOpen(true);
            } else setTaps(taps + 1);
          }}
          aria-label="Open your package"
        >
          📦
        </button>
        <p className="muted small">{['Tap to open it', 'Keep going…', 'Almost…'][taps]}</p>
      </div>
    );
  return (
    <div className="ad-unbox opened">
      <div className="ad-rain" aria-hidden="true">
        {Array.from({ length: Math.min(12, Math.max(got, 1)) }, (_, i) => (
          <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%` }}>
            {order.emoji}
          </span>
        ))}
      </div>
      <h3>You got {order.kind === 'subscribe' ? `your ${what}` : `${got} × ${what}`}!</h3>
      <p>{order.extra?.unbox}</p>
      {order.extra?.lost > 0 && <p className="muted small">One is missing. Customs says hi.</p>}
      <Stars id={order.id} thanks={pickFor(order.id, THANKS)} />
    </div>
  );
}

// The appointment: the waiting room, then how it went.
function Appointment({ order }) {
  const key = `ad-visited-${order.id}`;
  const [stage, setStage] = useState(() => (readLocal(key, false) ? 'done' : 'ready'));
  const [line, setLine] = useState(order.extra?.line || 3);
  useEffect(() => {
    if (stage !== 'waiting') return;
    const t = setTimeout(() => {
      if (line > 1) setLine(line - 1);
      else {
        writeLocal(key, true);
        setStage('turn');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [stage, line, key]);
  useEffect(() => {
    if (stage !== 'turn') return;
    const t = setTimeout(() => setStage('done'), 1500);
    return () => clearTimeout(t);
  }, [stage]);
  if (stage === 'ready')
    return (
      <div className="ad-visit">
        <div className="ad-visit-big" aria-hidden="true">
          🛎️
        </div>
        <p>
          <b>{order.brand}</b> is ready for you.
        </p>
        <button className="btn primary big-btn" onClick={() => setStage('waiting')}>
          Go in
        </button>
      </div>
    );
  if (stage === 'waiting')
    return (
      <div className="ad-visit">
        <div className="ad-visit-big" aria-hidden="true">
          🪑
        </div>
        <p className="ad-visit-line" aria-live="polite">
          You’re <b>#{line}</b> in line
        </p>
        <p className="muted small">Please enjoy this elevator music. 🎵</p>
      </div>
    );
  if (stage === 'turn')
    return (
      <div className="ad-visit">
        <div className="ad-visit-big ad-pop" aria-hidden="true">
          🚪
        </div>
        <p className="ad-visit-line">It’s your turn!</p>
      </div>
    );
  return (
    <div className="ad-visit">
      <div className="ad-visit-big" aria-hidden="true">
        {order.emoji}
      </div>
      <h3>How it went</h3>
      <p>{order.extra?.session}</p>
      <p className="muted">{order.extra?.signoff}</p>
      <Stars id={order.id} thanks={pickFor(order.id, THANKS)} />
    </div>
  );
}

const AUTO = ['This inbox is not monitored. 🤖', 'We’ve added your reply to the fridge.', 'Our intern is reading this one out loud too.'];

// The conversation about what you submitted.
function Replies({ order, now }) {
  const [mine, setMine] = useState([]);
  const [text, setText] = useState('');
  const end = useRef(null);
  const replied = has(order, 'reply', now);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [mine.length, replied]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    const n = mine.filter((m) => m.me).length;
    setMine((m) => [...m, { me: true, text: t }]);
    setText('');
    setTimeout(() => setMine((m) => [...m, { me: false, text: AUTO[n % AUTO.length] }]), 1100);
  };
  return (
    <>
      <div className="ad-chat">
        <div className="ad-bubble me">{order.text}</div>
        {has(order, 'review', now) && <p className="ad-chat-note">👀 {order.events.find((e) => e.step === 'review')?.body}</p>}
        {replied ? (
          <div className="ad-bubble them">
            <b>{order.brand}</b>
            {order.extra?.reply}
          </div>
        ) : (
          <div className="ad-bubble them typing" aria-label={`${order.brand} is typing`}>
            <span />
            <span />
            <span />
          </div>
        )}
        {mine.map((m, i) => (
          <div key={i} className={`ad-bubble ${m.me ? 'me' : 'them'}`}>
            {!m.me && <b>{order.brand}</b>}
            {m.text}
          </div>
        ))}
        <span ref={end} />
      </div>
      {replied && (
        <div className="row gap">
          <input
            className="input"
            value={text}
            maxLength={200}
            placeholder={`Reply to ${order.brand}`}
            aria-label={`Reply to ${order.brand}`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="btn primary" disabled={!text.trim()} onClick={send}>
            Send
          </button>
        </div>
      )}
    </>
  );
}

const STEPS = [
  ['placed', 'Placed'],
  ['packed', 'Packed'],
  ['shipped', 'Shipped'],
  ['out', 'Out for delivery'],
  ['delivered', 'Delivered'],
];
// The bar with the truck on it, moving smoothly between steps.
function TrackBar({ order, now }) {
  const at = STEPS.map(([s]) => stepAt(order, s));
  let pos = 0;
  for (let i = 0; i < at.length; i++) if (at[i] <= now) pos = i;
  if (pos < at.length - 1) pos += Math.min(0.9, Math.max(0, (now - at[pos]) / (at[pos + 1] - at[pos])));
  const pct = (pos / (STEPS.length - 1)) * 100;
  return (
    <div className="ad-trackbar">
      <div className="ad-trackbar-line">
        <div className="ad-trackbar-fill" style={{ width: `${pct}%` }} />
        <span className={`ad-trackbar-truck${pos >= STEPS.length - 1 ? ' here' : ''}`} style={{ left: `${pct}%` }} aria-hidden="true">
          {pos >= STEPS.length - 1 ? '📬' : '🚚'}
        </span>
      </div>
      <ol className="ad-trackbar-steps">
        {STEPS.map(([s, label], i) => (
          <li key={s} className={at[i] <= now ? 'on' : ''}>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Timeline({ order, now }) {
  const done = progress(order, now).done.slice().reverse();
  return (
    <ol className="ad-timeline">
      {done.map((e, i) => (
        <li key={`${e.step}-${i}`}>
          <span className="ad-timeline-icon" aria-hidden="true">
            {e.icon}
          </span>
          <div className="grow">
            <b>{e.title}</b>
            <p>{e.body}</p>
          </div>
          <span className="muted tiny">{clock(e.at)}</span>
        </li>
      ))}
    </ol>
  );
}

const GUILT = (brand) => ['Unsubscribe', 'Are you sure?', `Really? ${brand} made you a box.`, `${brand} is crying. Last chance.`];

export function OrderTracker({ order, ad, onClose, onCancel, onAgain }) {
  useEscape(onClose);
  const now = useNow(1000);
  const [guilt, setGuilt] = useState(0);
  const [note, setNote] = useState('');
  const { kind } = order;
  const delivered = has(order, 'delivered', now);
  const started = has(order, 'start', now);
  const finished = progress(order, now).finished;
  const heading =
    kind === 'order'
      ? `${order.qty} × ${order.item}`
      : kind === 'book'
        ? cap(order.item)
        : kind === 'submit'
          ? `Your submission to ${order.brand}`
          : `${order.brand} subscription`;
  const cancel = () => {
    const ask = {
      order: `Cancel your ${order.item}? ${order.brand} will be sad.`,
      book: `Cancel your ${order.item}? ${order.brand} cleared their whole schedule for you.`,
    }[kind];
    if (!ask || confirm(ask)) onCancel();
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div
          className="dialog ad-action ad-track"
          style={adStyle(ad || {})}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={`${order.brand} ${KIND_NOUN[kind].toLowerCase()}`}
        >
          <div className="ad-action-head">
            <span className="ad-action-emoji" aria-hidden="true">
              {order.emoji}
            </span>
            <b>{order.brand}</b>
            <span className="ad-track-kind">{KIND_NOUN[kind]}</span>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="ad-action-body">
            <h2>{heading}</h2>
            {order.ref && <p className="muted small ad-track-ref">Ref #{order.ref}</p>}

            {(kind === 'order' || kind === 'subscribe') && (
              <>
                <TrackBar order={order} now={now} />
                {!delivered && (
                  <p className="ad-track-eta">
                    Arriving around <b>{clock(stepAt(order, 'delivered'))}</b>
                  </p>
                )}
                {delivered && <Unbox order={order} />}
              </>
            )}
            {kind === 'book' && (
              <>
                <p className="ad-action-detail">{dayClock(order.when || stepAt(order, 'start'))}</p>
                {started ? (
                  <Appointment order={order} />
                ) : (
                  <div className="ad-countdown">
                    Starts in <b>{untilText(stepAt(order, 'start') - now)}</b>
                  </div>
                )}
              </>
            )}
            {kind === 'submit' && <Replies order={order} now={now} />}

            {kind !== 'submit' &&
              !(kind === 'book' && started) &&
              (delivered ? (
                <details className="ad-track-history">
                  <summary>Tracking history</summary>
                  <Timeline order={order} now={now} />
                </details>
              ) : (
                <Timeline order={order} now={now} />
              ))}
            {note && <p className="ad-track-note">{note}</p>}

            <div className="row gap ad-track-actions">
              {kind === 'order' && !delivered && (
                <button className="link-btn danger" onClick={cancel}>
                  Cancel order
                </button>
              )}
              {kind === 'book' && !started && (
                <>
                  <button className="link-btn" onClick={() => setNote('Rescheduling isn’t available. It’s never available.')}>
                    Reschedule
                  </button>
                  <button className="link-btn danger" onClick={cancel}>
                    Cancel booking
                  </button>
                </>
              )}
              {kind === 'subscribe' && (
                <button className="link-btn danger" onClick={() => (guilt >= 3 ? onCancel() : setGuilt(guilt + 1))}>
                  {GUILT(order.brand)[guilt]}
                </button>
              )}
              <span className="spacer" />
              {((kind === 'order' && delivered) || (kind === 'book' && started) || (kind === 'submit' && finished)) && (
                <>
                  <button className="link-btn" onClick={onCancel}>
                    Remove
                  </button>
                  {ad && (
                    <button className="btn" onClick={onAgain}>
                      {{ order: 'Order again', book: 'Book again', submit: 'Send another' }[kind]}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

export function OrdersDialog({ orders, onOpen, onClose }) {
  useEscape(onClose);
  const now = useNow(15000);
  const sorted = [...orders].sort((a, b) => b.at - a.at);
  const active = sorted.filter((o) => orderActive(o, now));
  const past = sorted.filter((o) => !orderActive(o, now));
  const row = (o) => (
    <button key={o.id} className="ad-orders-row" onClick={() => onOpen(o.id)}>
      <span className="ad-orders-emoji" aria-hidden="true">
        {o.emoji}
      </span>
      <span className="grow">
        <b>{o.brand}</b> <span className="muted small">· {KIND_NOUN[o.kind]}</span>
        <br />
        <span className="small">
          {o.kind === 'order' ? `${o.qty} × ${o.item}` : o.kind === 'submit' ? `“${clip(o.text, 40)}”` : cap(o.item)}
        </span>
      </span>
      <span className={`ad-orders-status${orderActive(o, now) ? ' on' : ''}`}>{orderStatus(o, now)}</span>
    </button>
  );
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog ad-orders" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Orders and bookings">
          <div className="row">
            <h2 className="grow">📦 Orders & bookings</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {!sorted.length && <p className="muted">Nothing yet.</p>}
          {active.length > 0 && <h4>On the way</h4>}
          {active.map(row)}
          {past.length > 0 && <h4>Done</h4>}
          {past.map(row)}
        </div>
      </div>
    </Overlay>
  );
}
