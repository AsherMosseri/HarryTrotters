import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ADS } from '../ads.js';
import { STATUSES } from '../config.js';
import { todayISO } from '../milestones.js';
import { adFreeUntil, prizesToday } from '../coins.js';
import { GAME_ADS } from './AdGames.jsx';
import { PACKS, packOn } from '../adPacks.js';
import { TARGETS, targetedAds } from '../adTargets.js';
import { planOrder } from '../adOrders.js';
import { answerText, defaults, fill, flowFor, summaryOf, templateVars } from '../adFlows.js';
import { FlowFields } from './AdFlow.jsx';
import { SUBTEAMS } from '../config.js';
import { Coin, Coins, CoinsAdmin } from './Coins.jsx';
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
  full: { everyTabs: 4, minGap: 2, onOpen: false, skip: 5, style: 'mix', double: false },
  games: { on: true, cap: 10 },
  wheel: { on: true },
  adblock: 'rare',
  // One sponsor takes over the app for the day (colors, a strip, loading screens).
  takeover: { on: false, ad: 'random', splash: true },
  bots: true,
  // A pretend notification every N hours (0 = never); some are coupons.
  notes: { every: 3, coupons: true },
  weights: {},
  off: [],
  rotate: 25,
  level: 'normal',
  remove: { on: true, price: '$4.99', hours: 'today' },
  close: 'normal',
  dodges: 1,
  flySpeed: 'medium',
  schedule: { on: false, days: [0, 1, 2, 3, 4, 5, 6], from: '15:00', to: '21:00', notOnShift: false },
  custom: [],
  spots: true,
  packs: { classic: 'on', halloween: 'auto', competition: 'auto', winter: 'auto' },
  targeted: 'some',
  // Per ad: { people: [], subteams: [], slots: [] } (empty means everyone / everywhere).
  targets: {},
};

// Settings with every field filled in (one level of nesting).
export function adSettings(raw) {
  const out = { ...AD_DEFAULTS, ...(raw || {}) };
  for (const k of [
    'banner',
    'board',
    'pages',
    'full',
    'remove',
    'schedule',
    'weights',
    'packs',
    'targets',
    'games',
    'wheel',
    'takeover',
    'notes',
  ])
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

// Every ad that can run (built-in, packs in season, Asher's own, approved
// spots, and targeted ones for this viewer), repeated by weight and spread
// out so the same one rarely shows twice in a row.
export function allBuiltIn(cfg, today, competitionDate) {
  return [...ADS, ...PACKS.filter((p) => packOn(p, cfg.packs[p.id], today, competitionDate)).flatMap((p) => p.ads)];
}
const sees = (t, viewer) =>
  !t ||
  (!(t.people || []).length && !(t.subteams || []).length) ||
  (t.people || []).includes(viewer?.name) ||
  (t.subteams || []).some((x) => viewer?.subteams?.includes(x));
function buildPool(cfg, extra, viewer) {
  const all = extra.filter((a) => a && !cfg.off.includes(a.id) && sees(cfg.targets[a.id], viewer));
  const pool = [];
  const weightOf = (a) => (a.targeted ? ({ off: 0, some: 2, lots: 6 }[cfg.targeted] ?? 2) : WEIGHT[cfg.weights[a.id]] || WEIGHT.normal);
  const copies = all.map((a) => [a, weightOf(a)]);
  for (let round = 0; copies.some(([, n]) => n > round); round++) for (const [a, n] of copies) if (n > round) pool.push(a);
  return pool;
}
const SLOT_OF = { banner: 'banner', board: 'board', chat: 'chat', page: 'page', popup: 'popup', full: 'full' };

// A teammate's submitted ad as an ad. Approved ones run between from and to.
export const submissionAd = (s) => ({
  ...s,
  id: `s-${s.id.toLowerCase()}`,
  subId: s.id,
  colors: s.colors?.length === 2 ? s.colors : ['#6c5ce7', '#ff79c6'],
});
const liveAds = (subs, today) => subs.filter((s) => s.status === 'approved' && s.from <= today && today <= s.to).map(submissionAd);

const readJson = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const writeJson = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};
const handle = (brand) => brand.toLowerCase().replace(/[^a-z0-9]/g, '');
const BOT_LINES = [
  (ad) => `You rang? ${ad.emoji} ${ad.headline}.`,
  (ad) => `Did someone say ${ad.brand}? ${ad.body}`,
  (ad) => `Hi! ${ad.brand} here. ${ad.headline}. Want in?`,
  (ad) => `${ad.emoji}${ad.emoji}${ad.emoji} ${ad.brand.toUpperCase()} ${ad.emoji}${ad.emoji}${ad.emoji} ${ad.headline}!`,
];
// What a pretend notification says, depending on what the ad's button does.
const NOTE_KINDS = [
  (ad) => ({ title: `${ad.brand}: ${ad.headline}`, body: ad.body }),
  (ad) => ({ title: `${ad.brand} is trending on your team 🔥`, body: 'Everyone’s talking about it. Probably.' }),
  (ad) => ({ title: `Last chance: ${ad.brand}`, body: `${ad.headline}. Offer ends soon.` }),
  (ad) =>
    ({
      order: { title: `Your ${ad.action.item || 'order'} is on its way 🚚`, body: `${ad.brand} shipped it. Tap to track it.` },
      book: { title: `Reminder: your ${ad.action.item || 'booking'} is coming up 📅`, body: `${ad.brand} is looking forward to it.` },
      submit: { title: `${ad.brand} replied to your submission 💬`, body: 'They said it was “very interesting.” Tap to see.' },
      subscribe: { title: `Your ${ad.brand} subscription renewed 🔁`, body: 'Thanks for being a loyal customer. Forever.' },
    })[ad.action?.kind] || { title: `${ad.brand} has a message for you`, body: ad.headline },
];

const AdsContext = createContext({ on: false });
export const useAds = () => useContext(AdsContext);

const SLOT = { banner: 0, board: 7, chat: 13, page: 3, popup: 11, full: 5 };

// Everything the ads need, worked out once in Workspace.
export function useAdsEngine({ settings, actor, view, shifts, submissions, ledger, coins, viewer, competitionDate, api }) {
  const cfg = useMemo(() => adSettings(settings.ads), [settings.ads]);
  const today = todayISO();
  const live = useMemo(() => liveAds(submissions || [], today), [submissions, today]);
  const targeted = useMemo(() => (cfg.targeted === 'off' ? [] : targetedAds(viewer)), [cfg.targeted, viewer]);
  const pool = useMemo(
    () =>
      buildPool(
        cfg,
        [...allBuiltIn(cfg, today, competitionDate), ...(cfg.games.on ? GAME_ADS : []), ...(cfg.custom || []), ...live, ...targeted],
        viewer,
      ),
    [cfg, today, competitionDate, live, targeted, viewer],
  );
  // Each slot only gets the ads allowed there.
  const slotPools = useMemo(() => {
    const out = {};
    for (const slot of Object.keys(SLOT_OF))
      out[slot] = pool.filter((a) => !(cfg.targets[a.id]?.slots || []).length || cfg.targets[a.id].slots.includes(slot));
    return out;
  }, [pool, cfg.targets]);
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
    Math.max(removedUntil, adFreeUntil(actor.name, ledger)) <= now &&
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

  const pick = useCallback(
    (slot, k = 0) => {
      const list = slotPools[slot] || pool;
      return list.length ? list[(tick + (SLOT[slot] || 0) + k * 5) % list.length] : null;
    },
    [slotPools, pool, tick],
  );

  // Full-screen ads: every N tab switches, at least M minutes apart, and
  // optionally once when the app opens.
  // full = { list: [ad, maybe a second], i, video }.
  const [full, setFull] = useState(null);
  const launchFull = (ad) => {
    if (!ad) return;
    const video = cfg.full.style === 'video' || (cfg.full.style === 'mix' && Math.random() < 0.5);
    const second = cfg.full.double ? pick('full', 3 + Math.floor(Math.random() * 5)) : null;
    setFull({ list: second && second.id !== ad.id ? [ad, second] : [ad], i: 0, video });
  };
  const [blockWall, setBlockWall] = useState(false);
  const lastBlock = useRef(0);
  const switches = useRef(0);
  const lastFull = useRef(0);
  const firstView = useRef(true);
  const openedOnce = useRef(false);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    if (!on) return;
    switches.current++;
    if (cfg.full.everyTabs && switches.current >= cfg.full.everyTabs && Date.now() - lastFull.current >= cfg.full.minGap * 60000) {
      switches.current = 0;
      lastFull.current = Date.now();
      launchFull(pick('full', Math.floor(Math.random() * 7)));
      return;
    }
    // Now and then: "Ad blocker detected" (at least 10 minutes apart).
    const chance = { rare: 1 / 25, often: 1 / 8 }[cfg.adblock] || 0;
    if (chance && Date.now() - lastBlock.current > 600000 && Math.random() < chance) {
      lastBlock.current = Date.now();
      setBlockWall(true);
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (on && cfg.full.onOpen && !openedOnce.current) {
      openedOnce.current = true;
      lastFull.current = Date.now();
      launchFull(pick('full'));
    }
  }, [on, cfg.full.onOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // The prize wheel: once a day, a few seconds after ads show up.
  const [wheel, setWheel] = useState(false);
  const wheelShown = useRef(false);
  const spunToday = prizesToday(actor.name, ledger, 'wheel').length > 0;
  useEffect(() => {
    if (!on || !cfg.wheel.on || spunToday || wheelShown.current) return;
    // Wait until nothing else is open, so it never interrupts.
    let t;
    const tryShow = () => {
      if (document.querySelector('.panel-backdrop, .ad-full, .ad-video, .sheet-backdrop')) t = setTimeout(tryShow, 5000);
      else {
        wheelShown.current = true;
        setWheel(true);
      }
    };
    t = setTimeout(tryShow, 3000);
    return () => clearTimeout(t);
  }, [on, cfg.wheel.on, spunToday]);
  const winWheel = (seg) => {
    if (prizesToday(actor.name, ledger, 'wheel').length) return Promise.resolve();
    if (seg.hour) return coins.prize({ what: 'wheel', amount: 0, label: 'Prize wheel: 1 hour with no ads', until: Date.now() + 3600000 });
    return coins.prize({ what: 'wheel', amount: seg.coins, label: seg.coins ? `Prize wheel: +${seg.coins}` : 'Prize wheel: nothing' });
  };

  // Playable ads: small prizes, up to cfg.games.cap a day.
  const [game, setGame] = useState(null);
  const gameCapLeft = Math.max(0, cfg.games.cap - prizesToday(actor.name, ledger, 'game').reduce((t, x) => t + x.amount, 0));

  // Takeover day: one sponsor for the whole day ("random" picks a new one each day).
  const everyAd = useMemo(
    () => [...allBuiltIn(cfg, today, competitionDate), ...(cfg.custom || []), ...live],
    [cfg, today, competitionDate, live],
  );
  const takeover = useMemo(() => {
    if (!on || !cfg.takeover.on) return null;
    if (cfg.takeover.ad !== 'random') return everyAd.find((a) => a.id === cfg.takeover.ad) || null;
    const day = Math.floor(new Date(`${today}T12:00:00`).getTime() / 86400000);
    return everyAd.length ? everyAd[day % everyAd.length] : null;
  }, [on, cfg.takeover, everyAd, today]);
  const [splash, setSplash] = useState(false);
  const splashFirst = useRef(true);
  useEffect(() => {
    if (splashFirst.current) {
      splashFirst.current = false;
      return;
    }
    if (!takeover || !cfg.takeover.splash) return;
    setSplash(true);
    const t = setTimeout(() => setSplash(false), 900);
    return () => clearTimeout(t);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brand bots: mention @TorqueJuice in chat and it answers (only you see it).
  const [bots, setBots] = useState([]);
  const onChatSent = useCallback(
    (conv, text) => {
      if (!on || !cfg.bots || !text) return;
      const words = [...String(text).matchAll(/@([a-z0-9]{4,})/gi)].map((m) => m[1].toLowerCase());
      const ad = words.length ? everyAd.find((a) => words.some((w) => handle(a.brand).startsWith(w))) : null;
      if (!ad) return;
      setTimeout(() => {
        setBots((list) => [
          ...list,
          { id: `bot-${Date.now()}`, conv, ad, text: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)](ad), at: Date.now() },
        ]);
      }, 900);
    },
    [on, cfg.bots, everyAd],
  );

  // Pretend notifications (some are coupons for Remove ads), kept on this device.
  const [notes, setNotes] = useState(() => readJson('ad-notes', []));
  const [coupons, setCoupons] = useState(() => readJson('ad-coupons', []));
  const saveNotes = (list) => {
    const next = list.slice(0, 20);
    writeJson('ad-notes', next);
    setNotes(next);
  };
  const saveCoupons = (list) => {
    writeJson('ad-coupons', list);
    setCoupons(list);
  };
  const makeNote = () => {
    if (!everyAd.length) return;
    {
      writeJson('ad-note-last', Date.now());
      const ad = everyAd[Math.floor(Math.random() * everyAd.length)];
      const coupon = cfg.notes.coupons && Math.random() < 0.4 ? [10, 15, 20, 25, 50][Math.floor(Math.random() * 5)] : 0;
      const text = coupon
        ? { title: `${ad.brand} sent you a coupon 🎟️`, body: `${coupon}% off Remove ads. Tap to save it.` }
        : NOTE_KINDS[Math.floor(Math.random() * NOTE_KINDS.length)](ad);
      saveNotes([
        { id: `adn-${Date.now()}`, at: Date.now(), adId: ad.id, emoji: ad.emoji, coupon, read: false, ...text },
        ...readJson('ad-notes', []),
      ]);
    }
  };
  useEffect(() => {
    if (!on || !cfg.notes.every) return;
    const check = () => Date.now() - readJson('ad-note-last', 0) >= cfg.notes.every * 3600000 && makeNote();
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [on, cfg.notes.every, cfg.notes.coupons, everyAd]); // eslint-disable-line react-hooks/exhaustive-deps
  const [couponShown, setCouponShown] = useState(null);
  const liveCoupons = coupons.filter((c) => c.expires > Date.now());
  const bestCoupon = liveCoupons.reduce((b, c) => (!b || c.pct > b.pct ? c : b), null);

  const [removing, setRemoving] = useState(false);
  const [action, setAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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
        if (ad.game) setGame(ad);
        else setAction(ad);
      },
      openSubmit: () => setSubmitting(true),
      coins,
      takeover,
      bots,
      dismissBot: (id) => setBots((list) => list.filter((b) => b.id !== id)),
      remove: () => setRemoving(true),
      showFull: (ad) => launchFull(ad || pick('full', Math.floor(Math.random() * 7))),
      // Asher's "try it" buttons.
      tryIt: (what, ad) => {
        if (what === 'wheel') setWheel(true);
        else if (what === 'block') setBlockWall(true);
        else if (what === 'game') setGame(ad || GAME_ADS[0]);
        else if (what === 'video') setFull({ list: [ad || pick('full') || ADS[0]], i: 0, video: true });
        else if (what === 'note') makeNote();
        else if (what === 'flow') setAction(ad);
      },
    }),
    [on, cfg, pool, tick, pick, track, coins, takeover, bots],
  );
  // Remove ads, paid for in Jackson coins. The purchase is in the ledger, so
  // it works on every device the person uses.
  const buyRemoval = (choice) => {
    const until = choice === 'today' ? new Date().setHours(23, 59, 59, 999) : Date.now() + (choice === 'week' ? 7 * 24 : 1) * 3600000;
    const price = couponPrice(coins.cfg.prices[choice], bestCoupon);
    if (bestCoupon) saveCoupons(coupons.filter((c) => c.id !== bestCoupon.id));
    return coins.spend({
      what: `remove-${choice}`,
      amount: price,
      label: `Removed ads ${HOW_LONG[choice]}${bestCoupon ? ` (${bestCoupon.pct}% coupon)` : ''}`,
      until,
    });
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
    full: full ? { ad: full.list[full.i], n: full.i + 1, total: full.list.length, video: full.video } : null,
    closeFull: () => setFull((f) => (f && f.i < f.list.length - 1 ? { ...f, i: f.i + 1 } : null)),
    game,
    closeGame: () => setGame(null),
    gameCapLeft,
    winGame: (amount, label) => coins.prize({ what: 'game', amount, label }),
    wheel,
    closeWheel: () => setWheel(false),
    winWheel,
    blockWall,
    closeBlock: () => setBlockWall(false),
    payBlock: async () => {
      await coins.spend({ what: 'adblock', amount: 1, label: 'Got past the ad blocker wall' });
      setBlockWall(false);
    },
    watchBlock: () => {
      setBlockWall(false);
      launchFull(pick('full', 2));
    },
    removing,
    closeRemoving: () => setRemoving(false),
    action,
    closeAction: () => setAction(null),
    openAction: setAction,
    findAd: (id) => everyAd.find((a) => a.id === id) || targeted.find((a) => a.id === id) || null,
    submitting,
    closeSubmit: () => setSubmitting(false),
    buyRemoval,
    coupon: bestCoupon,
    splash: splash && takeover,
    onChatSent,
    notes,
    markNotesRead: (ids) => saveNotes(notes.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))),
    clearNotes: (ids) => saveNotes(notes.filter((n) => !ids.includes(n.id))),
    openNote: (id) => {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      saveNotes(notes.map((x) => (x.id === id ? { ...x, read: true } : x)));
      if (n.coupon) {
        const c = { id: n.id, pct: n.coupon, brand: n.title.split(' sent you')[0], expires: Date.now() + 3 * 86400000 };
        if (!coupons.some((x) => x.id === n.id)) saveCoupons([...coupons, c]);
        setCouponShown(c);
      } else {
        const ad = everyAd.find((a) => a.id === n.adId);
        if (ad) setAction(ad);
      }
    },
    couponShown,
    closeCoupon: () => setCouponShown(null),
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

export const adStyle = (ad) => ({ '--ad-a': ad.colors?.[0] || '#6c5ce7', '--ad-b': ad.colors?.[1] || '#00cec9' });

export function AdArt({ ad, size = 'md' }) {
  const { level } = useAds();
  return (
    <span className={`ad-art ad-art-${size}`} aria-hidden="true">
      <span className={`ad-emoji ad-anim-${ad.anim || 'bounce'}`}>
        {ad.image ? <img className="ad-img" src={ad.image} alt="" /> : ad.emoji || '✨'}
      </span>
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

// How fast the flying ✕ goes, in pixels a second.
export const FLY_SPEEDS = { slow: 70, medium: 150, fast: 300, insane: 550, ludicrous: 900 };
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The ✕. Normal; sneaky (it jumps somewhere else in the ad for the first few
// taps); or flying (it bounces around the ad nonstop and has to be caught).
// With Reduce Motion on, a flying ✕ stays put.
function AdClose({ onClose, label = 'Close ad' }) {
  const { cfg } = useAds();
  const mode = cfg.close === 'flying' && reducedMotion() ? 'normal' : cfg.close;
  const btn = useRef(null);
  const [dodged, setDodged] = useState(0);
  const [offset, setOffset] = useState(null);

  useEffect(() => {
    const el = btn.current;
    const box = el?.offsetParent;
    if (mode !== 'flying' || !el || !box) return;
    const speed = FLY_SPEEDS[cfg.flySpeed] || FLY_SPEEDS.medium;
    const room = () => [Math.max(0, box.clientWidth - el.offsetWidth), Math.max(0, box.clientHeight - el.offsetHeight)];
    let [x, y] = room().map((m) => Math.random() * m);
    const angle = (0.15 + Math.random() * 0.2) * Math.PI * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : Math.PI);
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    let last = performance.now();
    let raf;
    const step = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const [maxX, maxY] = room();
      x += vx * dt;
      y += vy * dt;
      if (x < 0 || x > maxX) {
        x = Math.min(Math.max(x, 0), maxX);
        vx = -vx;
      }
      if (y < 0 || y > maxY) {
        y = Math.min(Math.max(y, 0), maxY);
        vy = -vy;
      }
      el.style.transform = `translate(${x}px, ${y}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, cfg.flySpeed]);

  // Sneaky: jump to a random spot in the ad, well away from where it is.
  const dodge = () => {
    const el = btn.current;
    const box = el.closest('.ad').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cur = offset || { x: 0, y: 0 };
    let tx;
    let ty;
    for (let tries = 0; tries < 10; tries++) {
      tx = box.left + 6 + Math.random() * Math.max(0, box.width - r.width - 12);
      ty = box.top + 6 + Math.random() * Math.max(0, box.height - r.height - 12);
      if (Math.hypot(tx - r.left, ty - r.top) > 60) break;
    }
    setOffset({ x: cur.x + tx - r.left, y: cur.y + ty - r.top, turn: Math.round(Math.random() * 300 - 150) });
  };
  const sneakyLeft = mode === 'sneaky' && dodged < (cfg.dodges || 1);
  return (
    <button
      ref={btn}
      className={`ad-close${mode === 'flying' ? ' flying' : ''}${offset ? ' dodged' : ''}`}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.turn}deg)` } : undefined}
      aria-label={label}
      // A flying ✕ counts as caught the moment it's touched.
      onPointerDown={
        mode === 'flying'
          ? (e) => {
              e.stopPropagation();
              onClose();
            }
          : undefined
      }
      onClick={(e) => {
        e.stopPropagation();
        if (sneakyLeft) {
          setDodged(dodged + 1);
          dodge();
        } else onClose();
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

// "Get your spot here": teammates submit and book their own.
function SpotLink() {
  const { cfg, openSubmit } = useAds();
  if (!cfg.spots) return null;
  return (
    <button
      className="ad-spot"
      onClick={(e) => {
        e.stopPropagation();
        openSubmit();
      }}
    >
      Get your spot here
    </button>
  );
}

const By = ({ ad }) => (ad.by ? <span className="ad-by">Booked by {ad.by.split(' ')[0]}</span> : null);

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
        <SpotLink />
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
        <By ad={ad} />
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
        <SpotLink />
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
          <By ad={ad} />
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
          <SpotLink />
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
  const { cfg, cta, level, track, coins } = useAds();
  const skip = cfg.full.skip;
  const skipPrice = coins?.cfg.prices.skip ?? 0;
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
          {left > 0 && coins && coins.balance >= skipPrice && (
            <button
              className="ad-skip ad-skip-pay"
              onClick={async () => {
                await coins.spend({ what: 'skip', amount: skipPrice, label: `Skipped a ${ad.brand} ad` });
                onClose();
              }}
            >
              ⏭ Skip now for <Coin size={13} /> {skipPrice}
            </button>
          )}
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
          <By ad={ad} />
          <div className="row gap">
            <SpotLink />
            <RemoveLink />
          </div>
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

// ---------- takeover day ----------

// A strip under the header: "Today’s app is brought to you by…".
export function TakeoverStrip() {
  const { takeover, cta } = useAds();
  useTrack(takeover);
  if (!takeover) return null;
  return (
    <div className="ad ad-normal takeover-strip" style={adStyle(takeover)} role="complementary" aria-label={`Sponsor: ${takeover.brand}`}>
      <span className="takeover-label">Today’s app is brought to you by</span>
      <AdArt ad={takeover} size="sm" />
      <b className="ad-brand">{takeover.brand}</b>
      <span className="ad-head takeover-head">{takeover.headline}</span>
      <span className="spacer" />
      <button className="ad-cta" onClick={() => cta(takeover)}>
        {takeover.cta}
      </button>
    </div>
  );
}

// A quick "loading" screen between tabs on takeover days.
export function TakeoverSplash({ ad }) {
  return (
    <Overlay>
      <div className="ad ad-normal takeover-splash" style={adStyle(ad)} aria-hidden="true">
        <AdArt ad={ad} size="xl" />
        <div className="takeover-spinner" />
        <span>Loading… brought to you by</span>
        <b className="ad-brand">{ad.brand}</b>
      </div>
    </Overlay>
  );
}

// The colors a takeover gives the app.
export const takeoverStyle = (ad) =>
  ad ? { '--accent': ad.colors[0], '--accent-soft': `color-mix(in srgb, ${ad.colors[0]} 16%, var(--surface))` } : undefined;

// ---------- brand bots in chat ----------

export function BotReplies({ conv }) {
  const { bots, dismissBot, cta } = useAds();
  const mine = (bots || []).filter((b) => b.conv === conv);
  const last = useRef(null);
  useEffect(() => {
    last.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [mine.length]);
  if (!mine.length) return null;
  return mine.map((b) => (
    <div key={b.id} className="bot-reply" style={adStyle(b.ad)} ref={last}>
      <span className="bot-avatar">
        <AdArt ad={b.ad} size="sm" />
      </span>
      <div className="bot-main">
        <div className="bot-head">
          <b>{b.ad.brand}</b>
          <span className="bot-tag">BOT</span>
        </div>
        <p className="bot-text">{b.text}</p>
        <button className="ad-cta" onClick={() => cta(b.ad)}>
          {b.ad.cta}
        </button>
        <p className="bot-only muted tiny">
          👁 Only you can see this ·{' '}
          <button className="link-btn tiny" onClick={() => dismissBot(b.id)}>
            Dismiss
          </button>
        </p>
      </div>
    </div>
  ));
}

// ---------- coupons ----------

export function CouponDialog({ coupon, onClose }) {
  useEscape(onClose);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog coupon-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Coupon">
          <div className="coupon">
            <span className="coupon-pct">{coupon.pct}% OFF</span>
            <span>Remove ads</span>
            <span className="muted tiny">from {coupon.brand}</span>
          </div>
          <h2>Coupon saved 🎟️</h2>
          <p className="muted">
            It comes off automatically next time you remove ads. Use it by{' '}
            {new Date(coupon.expires).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.
          </p>
          <button className="btn primary big-btn" onClick={onClose}>
            Nice
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- Remove ads (nothing is ever charged) ----------

const HOW_LONG = { hour: 'for 1 hour', today: 'for the rest of today', week: 'for a week' };
export const couponPrice = (price, coupon) => (coupon ? Math.max(1, Math.ceil((price * (100 - coupon.pct)) / 100)) : price);

export function RemoveAdsDialog({ prices, balance, coupon, onBuy, onClose }) {
  const [done, setDone] = useState(null);
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState(false);
  const [receipt] = useState(() => `RA-${1000 + Math.floor(Math.random() * 9000)}`);
  useEscape(onClose);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog remove-ads" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Remove ads">
          {!done ? (
            <>
              <div className="remove-ads-hero" aria-hidden="true">
                🚫📺
              </div>
              <h2>Remove ads</h2>
              <p className="muted">
                You have <Coins n={balance} />. Earn more by finishing tasks and putting in hours at the lab.
              </p>
              {coupon && (
                <p className="coupon-applied">
                  🎟️ {coupon.pct}% off coupon from {coupon.brand} applied
                </p>
              )}
              <div className="remove-ads-options">
                {['hour', 'today', 'week'].map((k) => (
                  <button
                    key={k}
                    className="remove-ads-option"
                    disabled={busy || balance < couponPrice(prices[k], coupon)}
                    onClick={async () => {
                      setBusy(true);
                      setPaid(couponPrice(prices[k], coupon));
                      await onBuy(k);
                      setDone(k);
                    }}
                  >
                    <span>{HOW_LONG[k][4].toUpperCase() + HOW_LONG[k].slice(5)}</span>
                    <span className="remove-ads-price">
                      {coupon && <s className="muted">{prices[k]}</s>}
                      <Coins n={couponPrice(prices[k], coupon)} />
                    </span>
                  </button>
                ))}
              </div>
              <button className="link-btn" onClick={onClose}>
                No thanks, I love ads
              </button>
            </>
          ) : (
            <>
              <div className="remove-ads-hero ad-pop" aria-hidden="true">
                ✅
              </div>
              <h2>Payment complete</h2>
              <p className="muted">
                Paid <Coins n={paid} />. Ads are off {HOW_LONG[done]}, on all your devices.
              </p>
              <p className="muted tiny">Receipt #{receipt}</p>
              <button className="btn primary big-btn" onClick={onClose}>
                Done
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

export function AdsSettings({
  initial,
  roster,
  stats,
  submissions = [],
  onReview,
  onDeleteSubmission,
  onSave,
  onPreview,
  preview,
  onShowFull,
  onResetStats,
  coinsInitial,
  onSaveCoins,
  coinBalances = {},
  ledger = [],
  onGrant,
  onUndoGrant,
  competitionDate,
  peopleStats = {},
  onTry,
  onUploadImage,
  onClose,
}) {
  useEscape(onClose);
  const [cfg, setCfg] = useState(() => adSettings(initial));
  const [coinCfg, setCoinCfg] = useState(coinsInitial);
  const [tab, setTab] = useState('who');
  const [editing, setEditing] = useState(null);
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const setIn = (key, patch) => setCfg((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const packAds = PACKS.flatMap((p) => p.ads);
  const sampleTargeted = TARGETS.map((t) => ({ id: t.id, targeted: true, ...t.make(SAMPLE_VIEWER) }));
  const allAds = [...ADS, ...packAds, ...GAME_ADS, ...cfg.custom];
  const today = todayISO();
  const pendingSubs = submissions.filter((x) => x.status === 'pending').length;
  const totals = Object.values(stats || {}).reduce((t, s) => ({ views: t.views + (s.views || 0), taps: t.taps + (s.taps || 0) }), {
    views: 0,
    taps: 0,
  });
  const earned = totals.views * CPM + totals.taps * PER_TAP;
  const ranked = [...allAds, ...sampleTargeted, ...submissions.map(submissionAd)]
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
              <span className="muted small">The team’s partners, placements, and bookings.</span>
            </div>
            <Switch checked={!cfg.paused} onChange={(v) => set({ paused: !v })} label="Ads on" />
          </div>
          <div className="segmented ads-tabs" role="tablist">
            {[
              ['who', 'Who & when'],
              ['amount', 'How many'],
              ['ads', 'Ads'],
              ['yours', 'Your ads'],
              ['fun', 'Fun'],
              ['subs', pendingSubs ? `Submissions (${pendingSubs})` : 'Submissions'],
              ['money', 'Earnings'],
              ['coins', 'Coins'],
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
                <Row title="Remove ads button" hint="People pay in Jackson coins.">
                  <Switch checked={cfg.remove.on} onChange={(v) => setIn('remove', { on: v })} label="Remove ads button" />
                </Row>
                {cfg.remove.on && <p className="muted small">Its prices, in Jackson coins, are on the Coins tab.</p>}
                <Row title="The ✕ button">
                  <Choice
                    value={cfg.close}
                    onChange={(v) => set({ close: v })}
                    label="Close button"
                    options={[
                      ['normal', 'Normal'],
                      ['sneaky', 'Sneaky (dodges)'],
                      ['flying', 'Flying'],
                    ]}
                  />
                </Row>
                {cfg.close === 'sneaky' && (
                  <Row title="Dodges" hint="How many taps it runs away from before it gives up.">
                    <Choice
                      value={cfg.dodges}
                      onChange={(v) => set({ dodges: v })}
                      label="Dodges"
                      options={[1, 2, 3, 5, 10].map((n) => [n, `${n}×`])}
                    />
                  </Row>
                )}
                {cfg.close === 'flying' && (
                  <Row title="Speed" hint="It bounces around the ad nonstop. Tap it to catch it.">
                    <Choice
                      value={cfg.flySpeed}
                      onChange={(v) => set({ flySpeed: v })}
                      label="Flying speed"
                      options={[
                        ['slow', 'Slow'],
                        ['medium', 'Medium'],
                        ['fast', 'Fast'],
                        ['insane', 'Insane'],
                        ['ludicrous', 'Ludicrous'],
                      ]}
                    />
                  </Row>
                )}
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
                <h4>Packs</h4>
                {PACKS.map((p) => (
                  <Row
                    key={p.id}
                    title={p.label}
                    hint={`${p.note}${p.id !== 'classic' && packOn(p, 'auto', today, competitionDate) ? ' · in season now' : ''}`}
                  >
                    <Choice
                      value={cfg.packs[p.id] || 'off'}
                      onChange={(v) => setIn('packs', { [p.id]: v })}
                      label={`${p.label} pack`}
                      options={[['on', 'On'], ...(p.id === 'classic' ? [] : [['auto', 'In season']]), ['off', 'Off']]}
                    />
                  </Row>
                ))}
                <Row title="🎯 Targeted ads" hint="Ads that use each person’s own numbers: hours, overdue tasks, coins, subteam…">
                  <Choice
                    value={cfg.targeted}
                    onChange={(v) => set({ targeted: v })}
                    label="Targeted ads"
                    options={[
                      ['off', 'Off'],
                      ['some', 'Some'],
                      ['lots', 'Lots'],
                    ]}
                  />
                </Row>
                <div className="row gap">
                  <button className="link-btn small" onClick={() => set({ off: [] })}>
                    All on
                  </button>
                  <button className="link-btn small" onClick={() => set({ off: [...allAds, ...sampleTargeted].map((a) => a.id) })}>
                    All off
                  </button>
                </div>
                <AdGroups
                  groups={[
                    ['Classic', [...ADS, ...PACKS[0].ads]],
                    ...PACKS.slice(1).map((p) => [p.label, p.ads]),
                    ['🎮 Games (also on the Fun tab)', GAME_ADS],
                    ['🎯 Targeted (shown with Cooper’s numbers as an example)', sampleTargeted],
                  ]}
                  cfg={cfg}
                  set={set}
                  row={(a) => (
                    <AdRow
                      key={a.id}
                      ad={a}
                      cfg={cfg}
                      set={set}
                      roster={roster}
                      onShow={() => onShowFull(a)}
                      onAct={a.game ? null : () => onTry('flow', a)}
                    />
                  )}
                />
              </>
            )}

            {tab === 'yours' && (
              <>
                {editing ? (
                  <AdEditor
                    ad={editing}
                    onUpload={onUploadImage}
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
                      onClick={() => setEditing({ ...blankAd(), id: `c-${Date.now().toString(36)}`, isNew: true })}
                    >
                      ＋ New ad
                    </button>
                    <ul className="ads-list">
                      {cfg.custom.map((a) => (
                        <AdRow
                          key={a.id}
                          ad={a}
                          cfg={cfg}
                          set={set}
                          roster={roster}
                          onShow={() => onShowFull(a)}
                          onAct={() => onTry('flow', a)}
                          onEdit={() => setEditing(a)}
                        />
                      ))}
                    </ul>
                    {!cfg.custom.length && <p className="muted">No ads of your own yet.</p>}
                  </>
                )}
              </>
            )}

            {tab === 'fun' && (
              <>
                <h4>Playable ads</h4>
                <Row title="Mini-game ads" hint="Whack the gremlins, catch the Pit Bars, find the hex key. Up to 3 coins a game.">
                  <Switch checked={cfg.games.on} onChange={(v) => setIn('games', { on: v })} label="Mini-game ads" />
                </Row>
                <Row title="Most coins from games a day">
                  <Choice
                    value={cfg.games.cap}
                    onChange={(v) => setIn('games', { cap: v })}
                    label="Daily game prize limit"
                    options={[0, 5, 10, 20].map((n) => [n, String(n)])}
                  />
                </Row>
                <div className="row gap wrap">
                  {GAME_ADS.map((g) => (
                    <button key={g.id} className="btn" onClick={() => onTry('game', g)}>
                      {g.emoji} Try {g.game === 'whack' ? 'Whack' : g.game === 'catch' ? 'Catch' : 'Find'}
                    </button>
                  ))}
                </div>
                <h4>Prize wheel</h4>
                <Row title="Daily prize wheel" hint="Pops up once a day: coins, an hour with no ads, or nothing.">
                  <Switch checked={cfg.wheel.on} onChange={(v) => setIn('wheel', { on: v })} label="Prize wheel" />
                </Row>
                <button className="btn" onClick={() => onTry('wheel')}>
                  🎡 Show the wheel
                </button>
                <h4>Full-screen style</h4>
                <Row title="Style" hint="Video ads play like a commercial, with a progress bar and a skip button.">
                  <Choice
                    value={cfg.full.style}
                    onChange={(v) => setIn('full', { style: v })}
                    label="Full-screen style"
                    options={[
                      ['classic', 'Classic'],
                      ['video', 'Video'],
                      ['mix', 'Mix'],
                    ]}
                  />
                </Row>
                <Row title="Double feature" hint="Two in a row: “Ad 1 of 2”.">
                  <Switch checked={cfg.full.double} onChange={(v) => setIn('full', { double: v })} label="Double feature" />
                </Row>
                <button className="btn" onClick={() => onTry('video')}>
                  🎬 Show a video ad
                </button>
                <h4>Takeover day</h4>
                <Row title="Sponsor takes over the app" hint="Their colors, a “brought to you by” strip, and loading screens between tabs.">
                  <Switch checked={cfg.takeover.on} onChange={(v) => setIn('takeover', { on: v })} label="Takeover day" />
                </Row>
                {cfg.takeover.on && (
                  <>
                    <Row title="Sponsor">
                      <select
                        className="input ads-select"
                        value={cfg.takeover.ad}
                        onChange={(e) => setIn('takeover', { ad: e.target.value })}
                        aria-label="Sponsor"
                      >
                        <option value="random">A different one every day</option>
                        {[...ADS, ...packAds, ...cfg.custom].map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.emoji} {a.brand}
                          </option>
                        ))}
                      </select>
                    </Row>
                    <Row title="Loading screens between tabs">
                      <Switch checked={cfg.takeover.splash} onChange={(v) => setIn('takeover', { splash: v })} label="Loading screens" />
                    </Row>
                  </>
                )}
                <h4>Chat</h4>
                <Row
                  title="Brand bots"
                  hint="Mention a brand in chat (like @TorqueJuice) and it answers. Only the person who mentioned it sees the answer."
                >
                  <Switch checked={cfg.bots} onChange={(v) => set({ bots: v })} label="Brand bots" />
                </Row>
                <h4>Notifications</h4>
                <Row title="Notifications from our friends" hint="Shows up in the 🔔 like a real notification.">
                  <Choice
                    value={cfg.notes.every}
                    onChange={(v) => setIn('notes', { every: v })}
                    label="How often"
                    options={[
                      [0, 'Never'],
                      [1, 'Every hour'],
                      [3, 'Every 3 h'],
                      [6, 'Every 6 h'],
                    ]}
                  />
                </Row>
                <Row title="Some are coupons" hint="10–50% off Remove ads. Saved when tapped, good for 3 days.">
                  <Switch checked={cfg.notes.coupons} onChange={(v) => setIn('notes', { coupons: v })} label="Coupons" />
                </Row>
                <button className="btn" onClick={() => onTry('note')}>
                  🔔 Send me one now
                </button>
                <h4>Ad blocker detected</h4>
                <Row
                  title="Fake ad blocker wall"
                  hint="Now and then when switching tabs. Pay 1 coin, watch an ad, or say you turned it off (twice)."
                >
                  <Choice
                    value={cfg.adblock}
                    onChange={(v) => set({ adblock: v })}
                    label="Ad blocker wall"
                    options={[
                      ['off', 'Off'],
                      ['rare', 'Rare'],
                      ['often', 'Often'],
                    ]}
                  />
                </Row>
                <button className="btn" onClick={() => onTry('block')}>
                  🛑 Show the wall
                </button>
              </>
            )}

            {tab === 'subs' && (
              <SubmissionsTab cfg={cfg} set={set} submissions={submissions} onReview={onReview} onDelete={onDeleteSubmission} />
            )}

            {tab === 'coins' && (
              <CoinsAdmin
                cfg={coinCfg}
                setCfg={setCoinCfg}
                roster={roster}
                balances={coinBalances}
                ledger={ledger}
                onGrant={onGrant}
                onUndo={onUndoGrant}
              />
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
                          {v} view{v === 1 ? '' : 's'} · {t} tap{t === 1 ? '' : 's'} · {v ? Math.round((t / v) * 100) : 0}% tap rate
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">Nothing yet. Turn ads on for someone and check back.</p>
                )}
                <h4>People</h4>
                <PeopleStats roster={roster} stats={peopleStats} ledger={ledger} />
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
                onSaveCoins(coinCfg);
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

const SLOT_LABELS = [
  ['banner', 'Banner'],
  ['board', 'Board'],
  ['chat', 'Chat'],
  ['page', 'Other tabs'],
  ['popup', 'Pop-ups'],
  ['full', 'Full-screen'],
];
const SAMPLE_VIEWER = {
  name: 'Cooper Mlezcko',
  first: 'Cooper',
  hoursWeek: 9.5,
  daysSinceLab: 6,
  overdue: 2,
  doneWeek: 4,
  balance: 140,
  lastEndHour: 22,
  lastEndText: '10:14 PM',
  onShift: true,
  daysToComp: 18,
  open: 5,
  subteams: ['Programming', 'CAD', 'Electrical'],
};

// Who sees an ad and where it can show up.
function AdTargeting({ id, cfg, set, roster }) {
  const t = cfg.targets[id] || {};
  const toggle = (key, v) => {
    const list = t[key] || [];
    set({ targets: { ...cfg.targets, [id]: { ...t, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] } } });
  };
  const chips = (key, items) => (
    <div className="ads-days">
      {items.map(([v, label]) => {
        const on = (t[key] || []).includes(v);
        return (
          <button key={v} className={`chip small-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(key, v)}>
            {label}
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="ads-target">
      <span className="muted tiny">Who sees it (pick none for everyone)</span>
      {chips(
        'subteams',
        SUBTEAMS.map((x) => [x, x]),
      )}
      {chips(
        'people',
        roster.map((n) => [n, n.split(' ')[0]]),
      )}
      <span className="muted tiny">Where (pick none for everywhere)</span>
      {chips('slots', SLOT_LABELS)}
    </div>
  );
}

// Who sees the most ads, taps the most, and pays to make them stop.
function PeopleStats({ roster, stats, ledger }) {
  const rows = roster
    .map((name) => {
      const st = stats[name] || {};
      const mine = ledger.filter((x) => x.type === 'spend' && x.person === name);
      const breaks = mine.filter((x) => String(x.what).startsWith('remove'));
      return {
        name,
        views: st.views || 0,
        taps: st.taps || 0,
        breaks: breaks.length,
        spent: mine
          .filter((x) => String(x.what).startsWith('remove') || x.what === 'skip' || x.what === 'adblock')
          .reduce((t, x) => t + x.amount, 0),
      };
    })
    .filter((r) => r.views || r.taps || r.breaks)
    .sort((a, b) => b.views - a.views);
  if (!rows.length) return <p className="muted small">No one has seen an ad yet.</p>;
  return (
    <div className="ads-people-stats">
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Views</th>
            <th>Taps</th>
            <th>Tap rate</th>
            <th>Breaks</th>
            <th>Coins on ads</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td>{r.views}</td>
              <td>{r.taps}</td>
              <td>{r.views ? Math.round((r.taps / r.views) * 100) : 0}%</td>
              <td>{r.breaks}</td>
              <td>{r.spent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The ad list, one collapsible group per pack (closed to start), with a
// search that looks through all of them.
function AdGroups({ groups, cfg, set, row }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set());
  const query = q.trim().toLowerCase();
  const match = (a) => !query || `${a.brand} ${a.headline} ${a.body || ''}`.toLowerCase().includes(query);
  const toggle = (title) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  const shown = groups.map(([title, list]) => [title, list.filter(match)]).filter(([, list]) => list.length);
  return (
    <div className="ads-groups">
      <input
        className="input ads-search"
        type="search"
        placeholder="Find an ad…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Find an ad"
      />
      {query && !shown.length && <p className="muted small">No ads match “{q.trim()}”.</p>}
      {shown.map(([title, list]) => {
        const isOpen = !!query || open.has(title);
        const all = groups.find(([t]) => t === title)[1];
        const on = all.filter((a) => !cfg.off.includes(a.id)).length;
        const ids = all.map((a) => a.id);
        return (
          <section key={title} className={`ads-group${isOpen ? ' open' : ''}`}>
            <button className="ads-group-head" onClick={() => toggle(title)} aria-expanded={isOpen} disabled={!!query}>
              <span className="ads-group-arrow" aria-hidden="true">
                ▸
              </span>
              <b className="grow">{title}</b>
              <span className="muted small">{query ? `${list.length} found` : `${on} of ${all.length} on`}</span>
            </button>
            {isOpen && (
              <>
                {!query && (
                  <div className="row gap ads-group-tools">
                    <button className="link-btn small" onClick={() => set({ off: cfg.off.filter((x) => !ids.includes(x)) })}>
                      Turn all on
                    </button>
                    <button className="link-btn small" onClick={() => set({ off: [...new Set([...cfg.off, ...ids])] })}>
                      Turn all off
                    </button>
                  </div>
                )}
                <ul className="ads-list">{list.map(row)}</ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AdRow({ ad, cfg, set, roster = [], onShow, onEdit, onAct }) {
  const [open, setOpen] = useState(false);
  const off = cfg.off.includes(ad.id);
  const weight = cfg.weights[ad.id] || 'normal';
  const t = cfg.targets[ad.id] || {};
  const aimed = [
    ...(t.subteams || []),
    ...(t.people || []).map((n) => n.split(' ')[0]),
    ...(t.slots || []).map((x) => SLOT_LABELS.find(([v]) => v === x)?.[1]),
  ];
  return (
    <li className={`ads-item${off ? ' off' : ''}${open ? ' open' : ''}`} style={adStyle(ad)}>
      <div className="ads-item-row">
        <span className="ads-item-art">{ad.image ? <img className="ad-img" src={ad.image} alt="" /> : ad.emoji}</span>
        <div className="grow ads-item-text">
          <b>{ad.brand || 'Untitled ad'}</b>
          <span className="muted small">{ad.headline}</span>
          {aimed.length > 0 && <span className="ads-aimed">🎯 {aimed.join(' · ')}</span>}
          <div className="row gap ads-item-tools">
            {!ad.targeted && (
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
            )}
            <button className="link-btn small" onClick={onShow}>
              Preview
            </button>
            {onAct && (
              <button className="link-btn small" onClick={onAct}>
                Try its {{ book: 'booking', submit: 'form', subscribe: 'sign-up' }[ad.action?.kind] || 'order'}
              </button>
            )}
            <button className="link-btn small" onClick={() => setOpen(!open)} aria-expanded={open}>
              Who & where
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
      </div>
      {open && <AdTargeting id={ad.id} cfg={cfg} set={set} roster={roster} />}
    </li>
  );
}

// The fields of an ad, shared by Asher's editor and the teammate submission form.
function AdFields({ a, setA, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const f = (key) => ({ value: a[key] || '', onChange: (e) => setA({ ...a, [key]: e.target.value }) });
  const act = a.action || { kind: 'order' };
  const setAct = (patch) => setA({ ...a, action: { ...act, ...patch } });
  return (
    <div className="fields ad-editor-fields">
      <label className="field-label">Brand</label>
      <input className="input" maxLength={40} placeholder="Torque Juice" {...f('brand')} />
      <label className="field-label">Emoji</label>
      <input className="input ad-emoji-input" maxLength={8} {...f('emoji')} />
      {onUpload && (
        <>
          <label className="field-label">Picture</label>
          <div className="ad-pic-row">
            {a.image && <img className="ad-pic-preview" src={a.image} alt="" />}
            <label className={`btn${uploading ? ' disabled' : ''}`}>
              {uploading ? 'Uploading…' : a.image ? 'Change picture' : '📷 Add a picture or GIF'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setUploading(true);
                  const url = await onUpload(file);
                  setUploading(false);
                  if (url) setA({ ...a, image: url });
                }}
              />
            </label>
            {a.image && (
              <button type="button" className="link-btn small" onClick={() => setA({ ...a, image: '' })}>
                Remove
              </button>
            )}
            <span className="muted tiny">Shows instead of the emoji. GIFs stay animated.</span>
          </div>
        </>
      )}
      <label className="field-label">Headline</label>
      <input className="input" maxLength={70} placeholder="Now with 400% more amps" {...f('headline')} />
      <label className="field-label">Text</label>
      <textarea className="input" rows={2} maxLength={160} {...f('body')} />
      <label className="field-label">Button</label>
      <input className="input" maxLength={28} {...f('cta')} />
      <label className="field-label">Button does</label>
      <select className="input" value={act.kind} onChange={(e) => setAct({ kind: e.target.value })}>
        <option value="order">Takes an order</option>
        <option value="book">Takes a booking (day and time)</option>
        <option value="submit">Takes a submission (they type something)</option>
        <option value="subscribe">Signs them up</option>
      </select>
      {(act.kind === 'order' || act.kind === 'book') && (
        <>
          <label className="field-label">{act.kind === 'book' ? 'What they book' : 'What they order'}</label>
          <input
            className="input"
            maxLength={40}
            placeholder={act.kind === 'book' ? 'session' : 'hoodie'}
            value={act.item || ''}
            onChange={(e) => setAct({ item: e.target.value })}
          />
        </>
      )}
      {act.kind === 'submit' && (
        <>
          <label className="field-label">What to ask</label>
          <input
            className="input"
            maxLength={80}
            placeholder="Describe your robot"
            value={act.ask || ''}
            onChange={(e) => setAct({ ask: e.target.value })}
          />
        </>
      )}
      <label className="field-label">After they tap</label>
      <input
        className="input"
        maxLength={140}
        placeholder="We’ll be in touch."
        value={act.done || ''}
        onChange={(e) => setAct({ done: e.target.value })}
      />
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
  );
}

export const blankAd = () => ({
  brand: '',
  emoji: '🤖',
  headline: '',
  body: '',
  cta: 'Buy now',
  colors: ['#6c5ce7', '#ff79c6'],
  anim: 'bounce',
  sticker: 'NEW!',
  fine: '',
  action: { kind: 'order', item: '', done: '' },
});
const cleanAd = (a) => ({ ...a, brand: a.brand.trim(), headline: a.headline.trim() });

function AdEditor({ ad, onSave, onCancel, onDelete, onUpload }) {
  const [a, setA] = useState(ad);
  const ok = a.brand.trim() && a.headline.trim();
  return (
    <div className="ad-editor">
      <div className="ad-editor-preview">
        <SponsoredPreview ad={a} />
      </div>
      <AdFields a={a} setA={setA} onUpload={onUpload} />
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
            onSave(cleanAd(clean));
          }}
        >
          {ad.isNew ? 'Add ad' : 'Save ad'}
        </button>
      </div>
    </div>
  );
}

// ---------- tapping an ad's button: a booking, an order, a submission, or a sign-up ----------

const ACT_DONE = { book: 'Booking confirmed', order: 'Order placed', submit: 'Submission received', subscribe: 'You’re subscribed' };
const initials = (name) =>
  (name || 'AD')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'AD';
const ordinal = (n) => {
  const v = n % 100;
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th');
};
// How many times this device has gone through with each ad.
function bumpHistory(id) {
  try {
    const h = JSON.parse(localStorage.getItem('ad-history') || '{}');
    h[id] = (h[id] || 0) + 1;
    localStorage.setItem('ad-history', JSON.stringify(h));
    return h[id];
  } catch {
    return 1;
  }
}

const TRACK = { order: 'Track your order', book: 'See your booking', submit: 'See their reply', subscribe: 'Track your first box' };

// onPlace(plan) saves what happens next (adOrders.js) and resolves to its id;
// onTrack(id) opens the tracker.
export function AdActionDialog({ ad, first = '', onClose, onPlace, onTrack }) {
  useEscape(onClose);
  const flow = useMemo(() => flowFor(ad), [ad]);
  const kind = flow.kind;
  const [answers, setAnswers] = useState(() => defaults(flow));
  const setAnswer = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));
  const [done, setDone] = useState(null);
  const qtyField = flow.fields.find((f) => f.type === 'qty');
  const whenField = flow.fields.find((f) => f.type === 'when');
  const textField = flow.fields.find((f) => f.type === 'text' && f.required);
  const qty = qtyField ? answers[qtyField.key] : 1;
  const when = whenField ? answers[whenField.key] : null;
  const missing = flow.fields.some((f) => f.type === 'text' && f.required && !String(answers[f.key] || '').trim()) || (whenField && !when);
  const vars = templateVars(flow, answers, {
    qty: qtyField ? answerText(qtyField, qty) : '1',
    item: flow.item,
    brand: ad.brand,
    first,
    when: when?.label || '',
  });
  const finish = async () => {
    const ref = `${initials(ad.brand)}-${1000 + Math.floor(Math.random() * 9000)}`;
    setDone({ ref, n: bumpHistory(ad.id), confirm: fill(flow.confirm, vars), summary: summaryOf(flow, answers) });
    if (!onPlace) return;
    const text = textField ? String(answers[textField.key]).trim() : '';
    const keep = Object.fromEntries(
      Object.entries(vars)
        .filter(([, v]) => v !== '' && v != null)
        .slice(0, 12)
        .map(([k, v]) => [k, String(v).slice(0, 120)]),
    );
    const plan = planOrder({ ad, kind, qty, when: when?.at || 0, text, ref, flow, vars: keep, summary: summaryOf(flow, answers) });
    try {
      const id = await onPlace(plan);
      setDone((d) => d && { ...d, id });
    } catch (e) {
      console.warn('order', e);
    }
  };
  const item = flow.item;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog ad-action" style={adStyle(ad)} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={ad.brand}>
          <div className="ad-action-head">
            <span className="ad-action-emoji" aria-hidden="true">
              {ad.image ? <img className="ad-img" src={ad.image} alt="" /> : ad.emoji}
            </span>
            <b>{ad.brand}</b>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {!done ? (
            <div className="ad-action-body">
              <h2>{fill(flow.title, vars)}</h2>
              <FlowFields flow={flow} answers={answers} setAnswer={setAnswer} />
              <button className="btn primary big-btn" disabled={missing} onClick={finish}>
                {flow.cta}
              </button>
            </div>
          ) : (
            <div className="ad-action-body ad-action-done">
              <div className="ad-pop" aria-hidden="true">
                ✅
              </div>
              <h2>{ACT_DONE[kind]}</h2>
              <p className="ad-action-detail">
                {kind === 'book' && `${item[0].toUpperCase() + item.slice(1)} · ${when?.label || ''}`}
                {kind === 'order' && `${qty} × ${item}`}
                {kind === 'submit' && `“${String(answers[textField?.key] || '').trim()}”`}
                {kind === 'subscribe' && item[0].toUpperCase() + item.slice(1)}
              </p>
              {done.summary.length > 0 && (
                <div className="flow-summary">
                  {done.summary.map((x) => (
                    <span key={x} className="flow-chip">
                      {x}
                    </span>
                  ))}
                </div>
              )}
              <p className="muted small">Ref #{done.ref}</p>
              {(done.confirm || ad.action?.done) && <p>{done.confirm || ad.action.done}</p>}
              {done.n > 1 && (
                <p className="muted small">
                  This is your {ordinal(done.n)} {ACT_DONE[kind].split(' ')[0].toLowerCase()} with {ad.brand}.
                </p>
              )}
              {done.id && onTrack && (
                <button className="btn big-btn ad-track-btn" onClick={() => onTrack(done.id)}>
                  {TRACK[kind]}
                </button>
              )}
              <button className="btn primary big-btn" onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ---------- teammates submit and book their own ----------

const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function submissionStatus(s, today = todayISO()) {
  if (s.status === 'approved') {
    if (today < s.from) return ['approved', `Approved · starts ${fmtDay(s.from)}`];
    if (today > s.to) return ['ended', 'Ended'];
    return ['live', 'Live now'];
  }
  return (
    {
      pending: ['pending', 'Waiting for review'],
      rejected: ['rejected', 'Not approved'],
      ended: ['ended', 'Ended'],
      withdrawn: ['ended', 'Withdrawn'],
    }[s.status] || ['pending', s.status]
  );
}

export function SubmitAdDialog({ mine, onSubmit, onWithdraw, onUpload, onClose }) {
  useEscape(onClose);
  const today = todayISO();
  const [view, setView] = useState(mine.length ? 'list' : 'form');
  const [a, setA] = useState(blankAd);
  const [from, setFrom] = useState(addDays(today, 1));
  const [to, setTo] = useState(addDays(today, 7));
  const [busy, setBusy] = useState(false);
  const ok = a.brand.trim() && a.headline.trim() && from >= today && to >= from;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog submit-ad" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Get your spot">
          <div className="panel-head">
            <h2>{view === 'form' ? '📣 Get your spot' : view === 'sent' ? '📨 Submitted' : '📣 Your spots'}</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {view === 'form' && (
            <div className="submit-ad-body">
              <p className="muted small">Make it, pick your dates, and send it in. It goes live once it’s approved.</p>
              <div className="ad-editor-preview">
                <SponsoredPreview ad={a} />
              </div>
              <div className="row gap submit-ad-dates">
                <label>
                  From <input className="input" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label>
                  to <input className="input" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
              </div>
              <AdFields a={a} setA={setA} onUpload={onUpload} />
              <div className="row gap">
                {mine.length > 0 && (
                  <button className="link-btn small" onClick={() => setView('list')}>
                    Your spots ({mine.length})
                  </button>
                )}
                <span className="spacer" />
                <button className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={!ok || busy}
                  onClick={async () => {
                    setBusy(true);
                    await onSubmit({ ...cleanAd(a), from, to });
                    setBusy(false);
                    setView('sent');
                  }}
                >
                  Submit for review
                </button>
              </div>
            </div>
          )}
          {view === 'sent' && (
            <div className="submit-ad-body ad-action-done">
              <div className="ad-pop" aria-hidden="true">
                📨
              </div>
              <h2>Submission received</h2>
              <p className="muted">
                {a.brand.trim()} · {fmtDay(from)} to {fmtDay(to)}. It goes live once it’s approved.
              </p>
              <button className="btn primary big-btn" onClick={() => setView('list')}>
                See your spots
              </button>
            </div>
          )}
          {view === 'list' && (
            <div className="submit-ad-body">
              <ul className="ads-list">
                {mine.map((sub) => {
                  const [cls, label] = submissionStatus(sub, today);
                  return (
                    <li key={sub.id} className="ads-item" style={adStyle(submissionAd(sub))}>
                      <span className="ads-item-art">{sub.emoji}</span>
                      <div className="grow ads-item-text">
                        <b>{sub.brand}</b>
                        <span className="muted small">
                          {fmtDay(sub.from)} to {fmtDay(sub.to)}
                        </span>
                        {sub.note && <span className="small">“{sub.note}”</span>}
                      </div>
                      <span className={`sub-status ${cls}`}>{label}</span>
                      {sub.status === 'pending' && (
                        <button className="link-btn small" onClick={() => onWithdraw(sub)}>
                          Withdraw
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button
                className="btn primary"
                onClick={() => {
                  setA(blankAd());
                  setView('form');
                }}
              >
                ＋ Book a new spot
              </button>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// Asher's review list (on the Ads page). Approving and rejecting happen right away.
function SubmissionsTab({ cfg, set, submissions, onReview, onDelete }) {
  const today = todayISO();
  const groups = [
    ['Waiting for review', submissions.filter((s) => s.status === 'pending')],
    ['Approved', submissions.filter((s) => s.status === 'approved' && today <= s.to)],
    ['Past', submissions.filter((s) => !(s.status === 'pending' || (s.status === 'approved' && today <= s.to)))],
  ];
  return (
    <>
      <Row title="Let people get their own spot" hint="A “Get your spot here” link on every ad.">
        <Switch checked={cfg.spots} onChange={(v) => set({ spots: v })} label="Let people submit" />
      </Row>
      <p className="muted small">Approve and reject take effect right away. The switch above saves with Save.</p>
      {groups.map(([title, list]) =>
        list.length ? (
          <section key={title}>
            <h4>
              {title} ({list.length})
            </h4>
            <ul className="ads-subs">
              {list
                .sort((x, y) => (y.at || 0) - (x.at || 0))
                .map((sub) => {
                  const [cls, label] = submissionStatus(sub, today);
                  return (
                    <li key={sub.id} className="ads-sub">
                      <SponsoredPreview ad={submissionAd(sub)} />
                      <div className="ads-sub-info">
                        <span className={`sub-status ${cls}`}>{label}</span>
                        <span className="small">
                          <b>{sub.by}</b> · {fmtDay(sub.from)} to {fmtDay(sub.to)}
                        </span>
                        {sub.note && <span className="muted small">Note: {sub.note}</span>}
                        <div className="row gap wrap">
                          {sub.status === 'pending' && (
                            <>
                              <button className="btn primary" onClick={() => onReview(sub, { status: 'approved', note: '' })}>
                                Approve
                              </button>
                              <button
                                className="btn"
                                onClick={() => {
                                  const note = prompt('Why not? (optional, they’ll see this)', '');
                                  if (note !== null) onReview(sub, { status: 'rejected', note: note.slice(0, 140) });
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {sub.status === 'approved' && today <= sub.to && (
                            <button className="btn" onClick={() => onReview(sub, { status: 'ended' })}>
                              End early
                            </button>
                          )}
                          <button className="link-btn danger small" onClick={() => confirm(`Delete ${sub.brand}?`) && onDelete(sub)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ) : null,
      )}
      {!submissions.length && <p className="muted">Nothing submitted yet.</p>}
    </>
  );
}

// A still preview of an ad (used in the editor).
function SponsoredPreview({ ad }) {
  return (
    <div className="ad ad-normal ad-card ad-card-card" style={adStyle(ad)}>
      <div className="ad-card-top">
        <span className="ad-label">Sponsored</span>
        <By ad={ad} />
      </div>
      <div className="ad-card-main">
        <span className="ad-art ad-art-md" aria-hidden="true">
          <span className={`ad-emoji ad-anim-${ad.anim}`}>
            {ad.image ? <img className="ad-img" src={ad.image} alt="" /> : ad.emoji || '✨'}
          </span>
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
