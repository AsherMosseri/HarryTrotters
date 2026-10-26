import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ADS } from '../ads.js';
import { STATUSES } from '../config.js';
import { useEscape } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';

// Pretend ads (see ads.js). Asher controls everything on the 📺 Ads page; the
// settings live in settings.ads so they reach every device right away.

export const AD_DEFAULTS = {
  paused: false,
  everyone: false,
  people: [],
  except: [],
  banner: { on: true, position: 'bottom', size: 'normal' },
  board: { perColumn: 1, columns: ['todo', 'in_progress'] },
  chatEvery: 10,
  pages: { all: 1 },
  popups: 1,
  full: { everyTabs: 4, minGap: 2, onOpen: false, skip: 5 },
  weights: {},
  off: [],
  rotate: 25,
  level: 'normal',
  remove: { on: true, price: '$4.99', hours: 'today' },
  close: 'normal',
  schedule: { on: false, days: [0, 1, 2, 3, 4, 5, 6], from: '15:00', to: '21:00', notOnShift: false },
  custom: [],
};

// Settings with every field filled in (one level of nesting).
export function adSettings(raw) {
  const out = { ...AD_DEFAULTS, ...(raw || {}) };
  for (const k of ['banner', 'board', 'pages', 'full', 'remove', 'schedule', 'weights'])
    out[k] = { ...AD_DEFAULTS[k], ...(raw?.[k] || {}) };
  return out;
}

// Tabs that get Sponsored cards at the top and bottom (the board and chat have their own).
export const AD_PAGES = [
  ['table', 'Table'],
  ['shifts', 'Shifts'],
  ['milestones', 'Milestones'],
  ['parts', 'Parts'],
  ['checklists', 'Checklists'],
  ['runs', 'Match Log'],
  ['resources', 'Resources'],
  ['team', 'Team'],
];
export const ANIMS = ['bounce', 'wobble', 'flicker', 'spin', 'shake', 'pulse', 'float', 'swing', 'sway', 'drive', 'zoom'];
const WEIGHT = { rare: 1, normal: 3, often: 6 };
const REASONS = [
  'Because you looked at a robot once.',
  'Because it’s 2 AM and you’re still in CAD.',
  'Because you said “it worked in practice.”',
  'Because our algorithm thinks you need sleep.',
  'Because you’ve stripped 4 screws this week.',
  'Because you’re you. 💅',
];
const removedKey = 'ads-removed-until';
const previewKey = 'ads-preview-until';
const readNum = (k) => {
  try {
    return Number(localStorage.getItem(k)) || 0;
  } catch {
    return 0;
  }
};
const writeNum = (k, v) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* storage unavailable */
  }
};
const minutes = (hhmm) => {
  const [h, m] = String(hhmm || '0:0')
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
};
export function inSchedule(s, now = new Date()) {
  if (!s.on) return true;
  if (!s.days.includes(now.getDay())) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  const a = minutes(s.from);
  const b = minutes(s.to);
  return a <= b ? t >= a && t <= b : t >= a || t <= b;
}

// Every enabled ad, repeated by weight and spread out so the same one rarely
// shows twice in a row.
function buildPool(cfg) {
  const all = [...ADS, ...(cfg.custom || [])].filter((a) => a && !cfg.off.includes(a.id));
  const pool = [];
  const copies = all.map((a) => [a, WEIGHT[cfg.weights[a.id]] || WEIGHT.normal]);
  for (let round = 0; copies.some(([, n]) => n > round); round++) for (const [a, n] of copies) if (n > round) pool.push(a);
  return pool;
}

const AdsContext = createContext({ on: false });
export const useAds = () => useContext(AdsContext);

const SLOT = { banner: 0, board: 7, chat: 13, page: 3, popup: 11, full: 5 };

// Everything the ads need, worked out once in Workspace.
export function useAdsEngine({ settings, actor, view, shifts, api, toast }) {
  const cfg = useMemo(() => adSettings(settings.ads), [settings.ads]);
  const pool = useMemo(() => buildPool(cfg), [cfg]);
  const [tick, setTick] = useState(() => Math.floor(Date.now() / (cfg.rotate * 1000)));
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / (cfg.rotate * 1000))), 2000);
    return () => clearInterval(t);
  }, [cfg.rotate]);
  const [removedUntil, setRemovedUntil] = useState(() => readNum(removedKey));
  const [previewUntil, setPreviewUntil] = useState(() => readNum(previewKey));
  const now = Date.now();
  const onShift = (shifts || []).some((s) => s.person === actor.name && !s.end);
  const preview = previewUntil > now;
  const chosen = cfg.everyone ? !cfg.except.includes(actor.name) : cfg.people.includes(actor.name);
  const on =
    pool.length > 0 &&
    removedUntil <= now &&
    (preview || (!cfg.paused && chosen && inSchedule(cfg.schedule) && !(cfg.schedule.on && cfg.schedule.notOnShift && onShift)));

  // Views and taps are counted here and sent in batches (fake earnings).
  const pending = useRef({});
  const track = useCallback((ad, what) => {
    const c = (pending.current[ad.id] ||= { views: 0, taps: 0 });
    c[what === 'tap' ? 'taps' : 'views']++;
  }, []);
  useEffect(() => {
    const flush = () => {
      const counts = pending.current;
      if (!Object.keys(counts).length) return;
      pending.current = {};
      api.bumpAdStats(counts);
    };
    const t = setInterval(flush, 60000);
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', hide);
      flush();
    };
  }, [api]);

  const pick = useCallback((slot, k = 0) => (pool.length ? pool[(tick + (SLOT[slot] || 0) + k * 5) % pool.length] : null), [pool, tick]);

  // Full-screen ads: every N tab switches, at least M minutes apart, and
  // optionally once when the app opens.
  const [full, setFull] = useState(null);
  const switches = useRef(0);
  const lastFull = useRef(0);
  const firstView = useRef(true);
  const openedOnce = useRef(false);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    if (!on || !cfg.full.everyTabs) return;
    switches.current++;
    if (switches.current >= cfg.full.everyTabs && Date.now() - lastFull.current >= cfg.full.minGap * 60000) {
      switches.current = 0;
      lastFull.current = Date.now();
      setFull(pick('full', Math.floor(Math.random() * 7)));
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (on && cfg.full.onOpen && !openedOnce.current) {
      openedOnce.current = true;
      lastFull.current = Date.now();
      setFull(pick('full'));
    }
  }, [on, cfg.full.onOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const [removing, setRemoving] = useState(false);
  const value = useMemo(
    () => ({
      on,
      cfg,
      pool,
      tick,
      pick,
      track,
      level: cfg.level,
      cta: (ad) => {
        track(ad, 'tap');
        toast(`${ad.emoji} Sorry, ${ad.brand} isn’t real. It’s a pretend ad!`);
      },
      remove: () => setRemoving(true),
      showFull: (ad) => setFull(ad || pick('full', Math.floor(Math.random() * 7))),
    }),
    [on, cfg, pool, tick, pick, track, toast],
  );
  const removeAds = () => {
    const h = cfg.remove.hours;
    const until = h === 'today' ? new Date().setHours(23, 59, 59, 999) : Date.now() + Number(h) * 3600000;
    writeNum(removedKey, until);
    setRemovedUntil(until);
  };
  const setPreview = (mins) => {
    const until = mins ? Date.now() + mins * 60000 : 0;
    writeNum(previewKey, until);
    setPreviewUntil(until);
    if (mins) {
      writeNum(removedKey, 0);
      setRemovedUntil(0);
    }
  };
  return {
    value,
    full,
    closeFull: () => setFull(null),
    removing,
    closeRemoving: () => setRemoving(false),
    removeAds,
    preview,
    setPreview,
  };
}

export function AdsProvider({ value, children }) {
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

// ---------- pieces every ad uses ----------

function useTrack(ad) {
  const { track } = useAds();
  useEffect(() => {
    if (ad) track(ad, 'view');
  }, [ad?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

const adStyle = (ad) => ({ '--ad-a': ad.colors?.[0] || '#6c5ce7', '--ad-b': ad.colors?.[1] || '#00cec9' });

export function AdArt({ ad, size = 'md' }) {
  const { level } = useAds();
  return (
    <span className={`ad-art ad-art-${size}`} aria-hidden="true">
      <span className={`ad-emoji ad-anim-${ad.anim || 'bounce'}`}>{ad.emoji || '✨'}</span>
      <i className="ad-spark s1">✦</i>
      <i className="ad-spark s2">✦</i>
      <i className="ad-spark s3">✧</i>
      {level === 'chaos' && (
        <>
          <i className="ad-spark s4">✦</i>
          <i className="ad-spark s5">★</i>
          <i className="ad-spark s6">✧</i>
        </>
      )}
    </span>
  );
}

const Sticker = ({ ad }) => (ad.sticker ? <span className="ad-sticker">{ad.sticker}</span> : null);

function Countdown() {
  const [s, setS] = useState(299);
  useEffect(() => {
    const t = setInterval(() => setS((v) => (v <= 0 ? 299 : v - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="ad-timer">
      Offer ends in {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

// The ✕. "Sneaky" mode: it dodges the first tap.
function AdClose({ onClose, label = 'Close ad' }) {
  const { cfg } = useAds();
  const [moved, setMoved] = useState(0);
  return (
    <button
      className={`ad-close${moved ? ` dodge-${moved}` : ''}`}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (cfg.close === 'sneaky' && !moved) setMoved(1 + Math.floor(Math.random() * 3));
        else onClose();
      }}
    >
      ✕
    </button>
  );
}

function RemoveLink() {
  const { cfg, remove } = useAds();
  if (!cfg.remove.on) return null;
  return (
    <button
      className="ad-remove"
      onClick={(e) => {
        e.stopPropagation();
        remove();
      }}
    >
      Remove ads
    </button>
  );
}

const frameClass = (level, extra) => `ad ad-${level}${extra ? ` ${extra}` : ''}`;

// ---------- the banner ----------

export function AdBanner({ position }) {
  const { on, cfg, pick, cta, level } = useAds();
  const [closedUntil, setClosedUntil] = useState(0);
  const ad = on && cfg.banner.on && cfg.banner.position === position && Date.now() > closedUntil ? pick('banner') : null;
  useTrack(ad);
  if (!ad) return null;
  return (
    <div
      className={frameClass(level, `ad-banner ad-banner-${cfg.banner.size} ad-banner-${position}`)}
      style={adStyle(ad)}
      role="complementary"
      aria-label={`Ad: ${ad.brand}`}
    >
      <span className="ad-label">Ad</span>
      <AdArt ad={ad} size={cfg.banner.size === 'big' ? 'lg' : 'sm'} />
      <div className="ad-text">
        <b className="ad-brand">{ad.brand}</b>
        <span className="ad-head">{ad.headline}</span>
        {cfg.banner.size === 'big' && <span className="ad-body">{ad.body}</span>}
      </div>
      {cfg.banner.size !== 'small' && <Countdown />}
      <button className="ad-cta" onClick={() => cta(ad)}>
        {ad.cta}
      </button>
      <div className="ad-side">
        <RemoveLink />
        <AdClose onClose={() => setClosedUntil(Date.now() + 120000)} />
      </div>
      <Sticker ad={ad} />
    </div>
  );
}

// ---------- Sponsored cards (board, other tabs, pop-ups) ----------

export function SponsoredCard({ slot, k = 0, size = 'card' }) {
  const { pick, cta, level, tick } = useAds();
  const [closed, setClosed] = useState(-1);
  const [why, setWhy] = useState(false);
  const ad = closed === tick ? null : pick(slot, k);
  useTrack(ad);
  if (!ad) return null;
  return (
    <div className={frameClass(level, `ad-card ad-card-${size}`)} style={adStyle(ad)} aria-label={`Sponsored: ${ad.brand}`}>
      <div className="ad-card-top">
        <span className="ad-label">Sponsored</span>
        <button className="ad-why" onClick={() => setWhy(!why)}>
          Why this ad?
        </button>
        <span className="spacer" />
        <AdClose onClose={() => setClosed(tick)} label="Hide this ad" />
      </div>
      {why && <p className="ad-reason">{REASONS[(tick + k) % REASONS.length]}</p>}
      <div className="ad-card-main">
        <AdArt ad={ad} size={size === 'mini' ? 'sm' : 'md'} />
        <div className="ad-text">
          <b className="ad-brand">{ad.brand}</b>
          <span className="ad-head">{ad.headline}</span>
          {size !== 'mini' && <span className="ad-body">{ad.body}</span>}
        </div>
      </div>
      <div className="ad-card-foot">
        <button className="ad-cta" onClick={() => cta(ad)}>
          {ad.cta}
        </button>
        <RemoveLink />
      </div>
      {size === 'wide' && <p className="ad-fine">{ad.fine}</p>}
      <Sticker ad={ad} />
    </div>
  );
}

// How many Sponsored cards a board column gets.
export function boardAdCount(ads, statusId) {
  return ads.on && ads.cfg.board.columns.includes(statusId) ? ads.cfg.board.perColumn : 0;
}

// Cards for a tab: one at the top, the rest at the bottom.
export function PageAds({ view, spot }) {
  const ads = useAds();
  if (!ads.on || !AD_PAGES.some(([id]) => id === view)) return null;
  const n = ads.cfg.pages[view] ?? ads.cfg.pages.all;
  const count = spot === 'top' ? Math.min(n, 1) : Math.max(0, n - 1);
  if (!count) return null;
  return (
    <div className={`page-ads page-ads-${spot}`}>
      {Array.from({ length: count }, (_, i) => (
        <SponsoredCard key={i} slot="page" k={i + (spot === 'top' ? 0 : 1)} size="wide" />
      ))}
    </div>
  );
}

// Small spots inside task details, profiles, and notifications.
export function PopupAds({ where }) {
  const ads = useAds();
  if (!ads.on || !ads.cfg.popups) return null;
  const k0 = { task: 0, profile: 2, inbox: 4 }[where] || 0;
  return (
    <div className="popup-ads">
      {Array.from({ length: ads.cfg.popups }, (_, i) => (
        <SponsoredCard key={i} slot="popup" k={k0 + i} size="mini" />
      ))}
    </div>
  );
}

// ---------- chat ----------

// After which messages an ad goes: every N messages, or after the first if
// the conversation is shorter than that.
export function chatAdSpots(ads, count) {
  const n = ads.on ? ads.cfg.chatEvery : 0;
  if (!n || !count) return new Set();
  const out = new Set();
  for (let i = n - 1; i < count; i += n) out.add(i);
  if (!out.size) out.add(0);
  return out;
}

export function ChatAd({ k = 0 }) {
  const { pick, cta, level } = useAds();
  const [hidden, setHidden] = useState(false);
  const ad = hidden ? null : pick('chat', k);
  useTrack(ad);
  if (!ad) return null;
  return (
    <div className={frameClass(level, 'ad-chat')} style={adStyle(ad)} aria-label={`Sponsored message from ${ad.brand}`}>
      <span className="ad-chat-avatar">
        <AdArt ad={ad} size="sm" />
      </span>
      <div className="ad-chat-main">
        <div className="ad-chat-head">
          <b>{ad.brand}</b>
          <span className="ad-label">Sponsored</span>
          <span className="spacer" />
          <AdClose onClose={() => setHidden(true)} label="Hide this ad" />
        </div>
        <p className="ad-chat-text">
          <b>{ad.headline}</b> {ad.body}
        </p>
        <div className="ad-chat-card">
          <button className="ad-cta" onClick={() => cta(ad)}>
            {ad.cta}
          </button>
          <Countdown />
          <RemoveLink />
        </div>
      </div>
    </div>
  );
}

// ---------- full-screen ----------

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 13) % 20) / 10,
  dur: 2.4 + ((i * 7) % 10) / 5,
  hue: (i * 47) % 360,
  size: 6 + ((i * 5) % 7),
}));

export function FullScreenAd({ ad, onClose }) {
  const { cfg, cta, level, track } = useAds();
  const skip = cfg.full.skip;
  const [left, setLeft] = useState(skip);
  useEffect(() => {
    track(ad, 'view');
  }, [ad.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  useEscape(onClose, left <= 0);
  return (
    <Overlay>
      <div className={frameClass(level, 'ad-full')} style={adStyle(ad)} role="dialog" aria-label={`Ad: ${ad.brand}`}>
        {level !== 'calm' && (
          <div className="ad-confetti" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <i
                key={i}
                style={{
                  left: `${c.left}%`,
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.dur}s`,
                  background: `hsl(${c.hue} 90% 60%)`,
                  width: c.size,
                  height: c.size * 1.6,
                }}
              />
            ))}
          </div>
        )}
        <div className="ad-full-top">
          <span className="ad-label">Ad</span>
          <span className="spacer" />
          {left > 0 ? (
            <span className="ad-skip">{skip >= 30 ? `This ad can’t be skipped… for ${left} s` : `Skip in ${left}…`}</span>
          ) : (
            <AdClose onClose={onClose} label="Close ad" />
          )}
        </div>
        <div className="ad-full-main">
          <AdArt ad={ad} size="xl" />
          <h2 className="ad-brand">{ad.brand}</h2>
          <p className="ad-head">{ad.headline}</p>
          <p className="ad-body">{ad.body}</p>
          <Countdown />
          <button className="ad-cta big" onClick={() => cta(ad)}>
            {ad.cta}
          </button>
          <RemoveLink />
        </div>
        <div className="ad-marquee" aria-hidden="true">
          <span>
            {ad.fine} · {ad.fine} · {ad.fine} ·
          </span>
        </div>
        <Sticker ad={ad} />
      </div>
    </Overlay>
  );
}

// ---------- Remove ads (pretend checkout, nothing is paid) ----------

export function RemoveAdsDialog({ price, hours, onRemove, onClose }) {
  const [step, setStep] = useState('offer');
  useEscape(onClose);
  const howLong =
    hours === 'today'
      ? 'for the rest of today'
      : Number(hours) >= 168
        ? 'for a week'
        : `for ${hours} hour${Number(hours) === 1 ? '' : 's'}`;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog remove-ads" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Remove ads">
          {step === 'offer' ? (
            <>
              <div className="remove-ads-hero" aria-hidden="true">
                🚫📺
              </div>
              <h2>Remove ads</h2>
              <p className="muted">Enjoy the Harry Trotters app with zero ads {howLong}. No zip ties. No Torque Juice. Just tasks.</p>
              <button className="btn primary big-btn" onClick={() => setStep('done')}>
                Pay {price}
              </button>
              <button className="link-btn" onClick={onClose}>
                No thanks, I love ads
              </button>
            </>
          ) : (
            <>
              <div className="remove-ads-hero" aria-hidden="true">
                🎉
              </div>
              <h2>Just kidding, it’s free</h2>
              <p className="muted">Nobody paid anything. Ads are off on this device {howLong}.</p>
              <button
                className="btn primary big-btn"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
              >
                Sweet
              </button>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ---------- Asher's Ads page ----------

const Switch = ({ checked, onChange, label }) => (
  <label className="switch" title={label}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
    <span />
  </label>
);

function Choice({ value, options, onChange, label }) {
  return (
    <div className="segmented ads-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`plain-seg${value === v ? ' on' : ''}`}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const Row = ({ title, hint, children }) => (
  <div className="ads-row">
    <div className="ads-row-text">
      <b>{title}</b>
      {hint && <span className="muted small">{hint}</span>}
    </div>
    <div className="ads-row-control">{children}</div>
  </div>
);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CPM = 0.0004;
const PER_TAP = 0.05;
const money = (n) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

export function AdsSettings({ initial, roster, stats, onSave, onPreview, preview, onShowFull, onResetStats, onClose }) {
  useEscape(onClose);
  const [cfg, setCfg] = useState(() => adSettings(initial));
  const [tab, setTab] = useState('who');
  const [editing, setEditing] = useState(null);
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const setIn = (key, patch) => setCfg((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const allAds = [...ADS, ...cfg.custom];
  const totals = Object.values(stats || {}).reduce((t, s) => ({ views: t.views + (s.views || 0), taps: t.taps + (s.taps || 0) }), {
    views: 0,
    taps: 0,
  });
  const earned = totals.views * CPM + totals.taps * PER_TAP;
  const ranked = allAds
    .map((a) => ({ a, v: stats?.[a.id]?.views || 0, t: stats?.[a.id]?.taps || 0 }))
    .filter((r) => r.v || r.t)
    .sort((x, y) => y.v + y.t * 20 - (x.v + x.t * 20));
  const count = cfg.everyone ? roster.length - cfg.except.length : cfg.people.length;

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog ads-settings" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ads">
          <div className="panel-head">
            <h2>📺 Ads</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="ads-pause">
            <div className="grow">
              <b>
                {cfg.paused
                  ? 'Ads are paused'
                  : `Ads are on for ${cfg.everyone ? 'everyone' : `${count} ${count === 1 ? 'person' : 'people'}`}`}
              </b>
              <span className="muted small">Pretend ads only: made-up brands, nothing is tracked or sold.</span>
            </div>
            <Switch checked={!cfg.paused} onChange={(v) => set({ paused: !v })} label="Ads on" />
          </div>
          <div className="segmented ads-tabs" role="tablist">
            {[
              ['who', 'Who & when'],
              ['amount', 'How many'],
              ['ads', 'Ads'],
              ['yours', 'Your ads'],
              ['money', 'Earnings'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`plain-seg${tab === id ? ' on' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ads-body">
            {tab === 'who' && (
              <>
                <Row title="Everyone" hint="Everyone on the team sees ads (except anyone you leave out below).">
                  <Switch checked={cfg.everyone} onChange={(v) => set({ everyone: v })} label="Everyone sees ads" />
                </Row>
                <h4>{cfg.everyone ? 'Everyone except…' : 'Only these people'}</h4>
                <div className="ads-people">
                  {roster.map((n) => {
                    const listKey = cfg.everyone ? 'except' : 'people';
                    const picked = cfg[listKey].includes(n);
                    return (
                      <button
                        key={n}
                        className={`chip${picked ? ' on' : ''}`}
                        aria-pressed={picked}
                        onClick={() => set({ [listKey]: toggleIn(cfg[listKey], n) })}
                      >
                        {picked ? (cfg.everyone ? '🚫 ' : '✓ ') : ''}
                        {n}
                      </button>
                    );
                  })}
                </div>
                <h4>Schedule</h4>
                <Row title="Only at certain times" hint="Off means any time.">
                  <Switch checked={cfg.schedule.on} onChange={(v) => setIn('schedule', { on: v })} label="Use a schedule" />
                </Row>
                {cfg.schedule.on && (
                  <>
                    <div className="ads-days">
                      {DAYS.map((d, i) => (
                        <button
                          key={d}
                          className={`chip${cfg.schedule.days.includes(i) ? ' on' : ''}`}
                          aria-pressed={cfg.schedule.days.includes(i)}
                          onClick={() => setIn('schedule', { days: toggleIn(cfg.schedule.days, i).sort() })}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <div className="row gap ads-times">
                      <label>
                        From{' '}
                        <input
                          className="input"
                          type="time"
                          value={cfg.schedule.from}
                          onChange={(e) => setIn('schedule', { from: e.target.value })}
                        />
                      </label>
                      <label>
                        to{' '}
                        <input
                          className="input"
                          type="time"
                          value={cfg.schedule.to}
                          onChange={(e) => setIn('schedule', { to: e.target.value })}
                        />
                      </label>
                    </div>
                    <Row title="Not while they’re at the lab" hint="No ads for someone who’s on a shift.">
                      <Switch
                        checked={cfg.schedule.notOnShift}
                        onChange={(v) => setIn('schedule', { notOnShift: v })}
                        label="No ads on shift"
                      />
                    </Row>
                  </>
                )}
                <h4>Try it</h4>
                <div className="row gap wrap">
                  <button className="btn" onClick={() => onPreview(preview ? 0 : 10)}>
                    {preview ? '⏹ Stop previewing' : '👀 Preview ads as me for 10 min'}
                  </button>
                  <button className="btn" onClick={() => onShowFull()}>
                    📺 Show a full-screen ad now
                  </button>
                </div>
                <p className="muted small">Preview uses the saved settings, so save first to see changes.</p>
              </>
            )}

            {tab === 'amount' && (
              <>
                <h4>Banner</h4>
                <Row title="Banner" hint="A strip that stays on screen.">
                  <Switch checked={cfg.banner.on} onChange={(v) => setIn('banner', { on: v })} label="Show the banner" />
                </Row>
                {cfg.banner.on && (
                  <>
                    <Row title="Where">
                      <Choice
                        value={cfg.banner.position}
                        onChange={(v) => setIn('banner', { position: v })}
                        label="Banner position"
                        options={[
                          ['top', 'Top'],
                          ['bottom', 'Bottom'],
                        ]}
                      />
                    </Row>
                    <Row title="Size">
                      <Choice
                        value={cfg.banner.size}
                        onChange={(v) => setIn('banner', { size: v })}
                        label="Banner size"
                        options={[
                          ['small', 'Small'],
                          ['normal', 'Normal'],
                          ['big', 'BIG'],
                        ]}
                      />
                    </Row>
                  </>
                )}
                <h4>Board</h4>
                <Row title="Sponsored cards per column">
                  <Choice
                    value={cfg.board.perColumn}
                    onChange={(v) => setIn('board', { perColumn: v })}
                    label="Ads per column"
                    options={[0, 1, 2, 3].map((n) => [n, String(n)])}
                  />
                </Row>
                <div className="ads-days">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      className={`chip${cfg.board.columns.includes(s.id) ? ' on' : ''}`}
                      aria-pressed={cfg.board.columns.includes(s.id)}
                      onClick={() => setIn('board', { columns: toggleIn(cfg.board.columns, s.id) })}
                    >
                      {s.short || s.label}
                    </button>
                  ))}
                </div>
                <h4>Chat</h4>
                <Row title="An ad every…">
                  <Choice
                    value={cfg.chatEvery}
                    onChange={(v) => set({ chatEvery: v })}
                    label="Chat ads"
                    options={[
                      [0, 'Never'],
                      [5, '5'],
                      [10, '10'],
                      [20, '20'],
                      [50, '50 msgs'],
                    ]}
                  />
                </Row>
                <h4>Other tabs</h4>
                <Row title="Sponsored cards per tab" hint="One at the top, the rest at the bottom.">
                  <Choice
                    value={cfg.pages.all}
                    onChange={(v) => setIn('pages', { all: v })}
                    label="Ads per tab"
                    options={[0, 1, 2, 3].map((n) => [n, String(n)])}
                  />
                </Row>
                <details className="ads-more">
                  <summary>Different amount for one tab</summary>
                  {AD_PAGES.map(([id, label]) => (
                    <Row key={id} title={label}>
                      <Choice
                        value={cfg.pages[id] ?? 'same'}
                        onChange={(v) => setIn('pages', { [id]: v === 'same' ? undefined : v })}
                        label={`Ads on ${label}`}
                        options={[
                          ['same', 'Same'],
                          [0, '0'],
                          [1, '1'],
                          [2, '2'],
                          [3, '3'],
                        ]}
                      />
                    </Row>
                  ))}
                </details>
                <h4>Pop-ups</h4>
                <Row title="Small ads in pop-ups" hint="Task details, profiles, and notifications.">
                  <Choice
                    value={cfg.popups}
                    onChange={(v) => set({ popups: v })}
                    label="Ads in pop-ups"
                    options={[
                      [0, '0'],
                      [1, '1'],
                      [2, '2'],
                    ]}
                  />
                </Row>
                <h4>Full-screen ads</h4>
                <Row title="How often" hint="After this many tab switches.">
                  <Choice
                    value={cfg.full.everyTabs}
                    onChange={(v) => setIn('full', { everyTabs: v })}
                    label="Full-screen frequency"
                    options={[
                      [0, 'Never'],
                      [2, '2'],
                      [3, '3'],
                      [5, '5'],
                      [10, '10'],
                    ]}
                  />
                </Row>
                <Row title="At least this far apart">
                  <Choice
                    value={cfg.full.minGap}
                    onChange={(v) => setIn('full', { minGap: v })}
                    label="Minimum gap"
                    options={[
                      [1, '1 min'],
                      [2, '2'],
                      [5, '5'],
                      [15, '15'],
                    ]}
                  />
                </Row>
                <Row title="Skip button after">
                  <Choice
                    value={cfg.full.skip}
                    onChange={(v) => setIn('full', { skip: v })}
                    label="Skip countdown"
                    options={[
                      [0, 'Now'],
                      [3, '3 s'],
                      [5, '5'],
                      [10, '10'],
                      [15, '15'],
                      [30, '30 😈'],
                    ]}
                  />
                </Row>
                <Row title="One when the app opens">
                  <Switch checked={cfg.full.onOpen} onChange={(v) => setIn('full', { onOpen: v })} label="Full-screen ad on open" />
                </Row>
                <h4>Buttons on ads</h4>
                <Row title="Remove ads button" hint="Pretend checkout. Nobody pays.">
                  <Switch checked={cfg.remove.on} onChange={(v) => setIn('remove', { on: v })} label="Remove ads button" />
                </Row>
                {cfg.remove.on && (
                  <>
                    <Row title="Price shown">
                      <input
                        className="input ads-price"
                        value={cfg.remove.price}
                        maxLength={12}
                        onChange={(e) => setIn('remove', { price: e.target.value })}
                        aria-label="Price"
                      />
                    </Row>
                    <Row title="Removes ads for">
                      <Choice
                        value={cfg.remove.hours}
                        onChange={(v) => setIn('remove', { hours: v })}
                        label="How long"
                        options={[
                          [1, '1 hour'],
                          ['today', 'Today'],
                          [168, 'A week'],
                        ]}
                      />
                    </Row>
                  </>
                )}
                <Row title="The ✕ button">
                  <Choice
                    value={cfg.close}
                    onChange={(v) => set({ close: v })}
                    label="Close button"
                    options={[
                      ['normal', 'Normal'],
                      ['sneaky', 'Sneaky (dodges)'],
                    ]}
                  />
                </Row>
              </>
            )}

            {tab === 'ads' && (
              <>
                <Row title="Change ads every">
                  <Choice
                    value={cfg.rotate}
                    onChange={(v) => set({ rotate: v })}
                    label="Rotation"
                    options={[
                      [10, '10 s'],
                      [25, '25 s'],
                      [60, '1 min'],
                    ]}
                  />
                </Row>
                <Row title="Animation">
                  <Choice
                    value={cfg.level}
                    onChange={(v) => set({ level: v })}
                    label="Animation level"
                    options={[
                      ['calm', 'Calm'],
                      ['normal', 'Normal'],
                      ['chaos', 'CHAOS'],
                    ]}
                  />
                </Row>
                <div className="row gap">
                  <button className="link-btn small" onClick={() => set({ off: [] })}>
                    All on
                  </button>
                  <button className="link-btn small" onClick={() => set({ off: allAds.map((a) => a.id) })}>
                    All off
                  </button>
                </div>
                <ul className="ads-list">
                  {allAds.map((a) => (
                    <AdRow key={a.id} ad={a} cfg={cfg} set={set} onShow={() => onShowFull(a)} />
                  ))}
                </ul>
              </>
            )}

            {tab === 'yours' && (
              <>
                {editing ? (
                  <AdEditor
                    ad={editing}
                    onCancel={() => setEditing(null)}
                    onSave={(ad) => {
                      const exists = cfg.custom.some((c) => c.id === ad.id);
                      set({ custom: exists ? cfg.custom.map((c) => (c.id === ad.id ? ad : c)) : [...cfg.custom, ad] });
                      setEditing(null);
                    }}
                    onDelete={() => {
                      set({ custom: cfg.custom.filter((c) => c.id !== editing.id), off: cfg.off.filter((x) => x !== editing.id) });
                      setEditing(null);
                    }}
                  />
                ) : (
                  <>
                    <p className="muted small">Write your own. They join the rotation with the built-in ones.</p>
                    <button
                      className="btn primary"
                      onClick={() =>
                        setEditing({
                          id: `c-${Date.now().toString(36)}`,
                          brand: '',
                          emoji: '🤖',
                          headline: '',
                          body: '',
                          cta: 'Buy now',
                          colors: ['#6c5ce7', '#ff79c6'],
                          anim: 'bounce',
                          sticker: 'NEW!',
                          fine: '',
                          isNew: true,
                        })
                      }
                    >
                      ＋ New ad
                    </button>
                    <ul className="ads-list">
                      {cfg.custom.map((a) => (
                        <AdRow key={a.id} ad={a} cfg={cfg} set={set} onShow={() => onShowFull(a)} onEdit={() => setEditing(a)} />
                      ))}
                    </ul>
                    {!cfg.custom.length && <p className="muted">No ads of your own yet.</p>}
                  </>
                )}
              </>
            )}

            {tab === 'money' && (
              <>
                <div className="ads-earned">
                  <span className="muted small">Ad revenue (all time)</span>
                  <b>{money(earned)}</b>
                  <span className="muted small">
                    {totals.views.toLocaleString()} view{totals.views === 1 ? '' : 's'} · {totals.taps.toLocaleString()} tap
                    {totals.taps === 1 ? '' : 's'} · paid at a very real {money(CPM)} a view and {money(PER_TAP)} a tap
                  </span>
                </div>
                <h4>Top ads</h4>
                {ranked.length ? (
                  <ol className="ads-top">
                    {ranked.slice(0, 10).map(({ a, v, t }) => (
                      <li key={a.id}>
                        <span>{a.emoji}</span>
                        <b className="grow">{a.brand}</b>
                        <span className="muted small">
                          {v} view{v === 1 ? '' : 's'} · {t} tap{t === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">Nothing yet. Turn ads on for someone and check back.</p>
                )}
                <p className="muted small">Views count from every device and are sent about once a minute.</p>
                <button className="link-btn danger small" onClick={() => confirm('Reset the earnings and counts?') && onResetStats()}>
                  Reset earnings
                </button>
              </>
            )}
          </div>

          <div className="row gap ads-actions">
            <button
              className="link-btn small"
              onClick={() =>
                setCfg(adSettings({ ...AD_DEFAULTS, custom: cfg.custom, everyone: cfg.everyone, people: cfg.people, except: cfg.except }))
              }
            >
              Reset to defaults
            </button>
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                onSave(cfg);
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

function AdRow({ ad, cfg, set, onShow, onEdit }) {
  const off = cfg.off.includes(ad.id);
  const weight = cfg.weights[ad.id] || 'normal';
  return (
    <li className={`ads-item${off ? ' off' : ''}`} style={adStyle(ad)}>
      <span className="ads-item-art">{ad.emoji}</span>
      <div className="grow ads-item-text">
        <b>{ad.brand || 'Untitled ad'}</b>
        <span className="muted small">{ad.headline}</span>
        <div className="row gap ads-item-tools">
          <Choice
            value={weight}
            onChange={(v) => set({ weights: { ...cfg.weights, [ad.id]: v } })}
            label={`How often ${ad.brand} shows`}
            options={[
              ['rare', 'Rare'],
              ['normal', 'Normal'],
              ['often', 'Often'],
            ]}
          />
          <button className="link-btn small" onClick={onShow}>
            Preview
          </button>
          {onEdit && (
            <button className="link-btn small" onClick={onEdit}>
              Edit
            </button>
          )}
        </div>
      </div>
      <Switch
        checked={!off}
        onChange={(v) => set({ off: v ? cfg.off.filter((x) => x !== ad.id) : [...cfg.off, ad.id] })}
        label={`Show ${ad.brand}`}
      />
    </li>
  );
}

function AdEditor({ ad, onSave, onCancel, onDelete }) {
  const [a, setA] = useState(ad);
  const f = (key) => ({ value: a[key] || '', onChange: (e) => setA({ ...a, [key]: e.target.value }) });
  const ok = a.brand.trim() && a.headline.trim();
  return (
    <div className="ad-editor">
      <div className="ad-editor-preview">
        <SponsoredPreview ad={a} />
      </div>
      <div className="fields ad-editor-fields">
        <label className="field-label">Brand</label>
        <input className="input" maxLength={40} placeholder="Torque Juice" {...f('brand')} />
        <label className="field-label">Emoji</label>
        <input className="input ad-emoji-input" maxLength={8} {...f('emoji')} />
        <label className="field-label">Headline</label>
        <input className="input" maxLength={70} placeholder="Now with 400% more amps" {...f('headline')} />
        <label className="field-label">Text</label>
        <textarea className="input" rows={2} maxLength={160} {...f('body')} />
        <label className="field-label">Button</label>
        <input className="input" maxLength={28} {...f('cta')} />
        <label className="field-label">Sticker</label>
        <input className="input" maxLength={14} placeholder="NEW!" {...f('sticker')} />
        <label className="field-label">Fine print</label>
        <input className="input" maxLength={140} {...f('fine')} />
        <label className="field-label">Colors</label>
        <div className="row gap">
          {[0, 1].map((i) => (
            <input
              key={i}
              type="color"
              className="ad-color"
              value={a.colors[i]}
              onChange={(e) => setA({ ...a, colors: i ? [a.colors[0], e.target.value] : [e.target.value, a.colors[1]] })}
              aria-label={i ? 'Second color' : 'First color'}
            />
          ))}
        </div>
        <label className="field-label">Animation</label>
        <select className="input" value={a.anim} onChange={(e) => setA({ ...a, anim: e.target.value })}>
          {ANIMS.map((x) => (
            <option key={x} value={x}>
              {x[0].toUpperCase() + x.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="row gap">
        {!ad.isNew && (
          <button className="link-btn danger small" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!ok}
          onClick={() => {
            const { isNew, ...clean } = a; // eslint-disable-line no-unused-vars
            onSave({ ...clean, brand: clean.brand.trim(), headline: clean.headline.trim() });
          }}
        >
          {ad.isNew ? 'Add ad' : 'Save ad'}
        </button>
      </div>
    </div>
  );
}

// A still preview of an ad (used in the editor).
function SponsoredPreview({ ad }) {
  return (
    <div className="ad ad-normal ad-card ad-card-card" style={adStyle(ad)}>
      <div className="ad-card-top">
        <span className="ad-label">Sponsored</span>
      </div>
      <div className="ad-card-main">
        <span className="ad-art ad-art-md" aria-hidden="true">
          <span className={`ad-emoji ad-anim-${ad.anim}`}>{ad.emoji || '✨'}</span>
        </span>
        <div className="ad-text">
          <b className="ad-brand">{ad.brand || 'Your brand'}</b>
          <span className="ad-head">{ad.headline || 'Your headline'}</span>
          <span className="ad-body">{ad.body}</span>
        </div>
      </div>
      <div className="ad-card-foot">
        <span className="ad-cta">{ad.cta || 'Buy now'}</span>
      </div>
      {ad.sticker && <span className="ad-sticker">{ad.sticker}</span>}
    </div>
  );
}
