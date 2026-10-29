// Jackson coins (named after Jackson, with his OK). What you've earned is
// worked out from the team's data, so it follows the tasks and shifts: move a
// task out of Done and its coins go away again. Spending, gifts, and Asher's
// bonuses are entries in the coins ledger (Firestore "coins").
//
// Earning: perTask for each task you were assigned that's done, if someone
// else created it (no paying yourself for tasks you made up); perHour for
// time at the lab, at most dayCap hours a day. Everything since `start`.
// Asher also earns the ad money, as the app's owner.

export const COIN_DEFAULTS = {
  perTask: 15,
  perHour: 5,
  dayCap: 10,
  start: '2026-08-28',
  prices: { hour: 10, today: 25, week: 120, skip: 2 },
  viewsPerCoin: 25,
  perTap: 1,
};

export function coinSettings(raw) {
  return { ...COIN_DEFAULTS, ...(raw || {}), prices: { ...COIN_DEFAULTS.prices, ...(raw?.prices || {}) } };
}

// Days are the team's days (New York), on every phone and on the server, so
// the daily hour cap and the start date land the same everywhere.
export const TEAM_TZ = 'America/New_York';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TEAM_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const clockFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TEAM_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});
export const teamDay = (ms) => dayFmt.format(ms);
// Midnight at the start of a team day ('2026-08-28'), in ms.
export function teamMidnight(day) {
  const [y, m, d] = day.split('-').map(Number);
  const want = Date.UTC(y, m - 1, d);
  let t = want;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(clockFmt.formatToParts(t).map((x) => [x.type, x.value]));
    t -= Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - want;
  }
  return t;
}
const startMs = (cfg) => teamMidnight(cfg.start);
// A time as ms: the server reads Firestore Timestamps (task times are set by
// the server clock), the app reads numbers.
const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);

// Everything someone has earned, newest first: [{ at, amount, icon, label, kind }].
export function earnedItems(name, { tasks = [], shifts = [], adStats, owner = false, cfg, now = Date.now() }) {
  const from = startMs(cfg);
  const items = [];
  for (const t of tasks) {
    if (t.status !== 'done' || !(t.assignees || []).includes(name) || t.createdBy === name) continue;
    const at = toMs(t.completedAt) || toMs(t.updatedAt) || toMs(t.createdAt);
    if (at < from) continue;
    items.push({ kind: 'task', at, amount: cfg.perTask, icon: '✅', label: t.title || 'A task' });
  }
  // Lab time, added up per day and capped.
  const days = new Map();
  for (const s of shifts) {
    if (s.person !== name || !s.start || s.start < from) continue;
    const end = s.end || now;
    if (end <= s.start) continue;
    const key = teamDay(s.start);
    const d = days.get(key) || { minutes: 0, at: s.start };
    d.minutes += (end - s.start) / 60000;
    d.at = Math.max(d.at, end);
    days.set(key, d);
  }
  for (const [key, d] of days) {
    const minutes = Math.min(d.minutes, cfg.dayCap * 60);
    const amount = Math.floor((minutes * cfg.perHour) / 60);
    if (amount > 0) {
      const hours = Math.round((minutes / 60) * 10) / 10;
      items.push({ kind: 'hours', at: d.at, amount, icon: '⏱', label: `${hours} h at the lab`, day: key, capped: d.minutes > minutes });
    }
  }
  if (owner && adStats) {
    const views = Object.values(adStats).reduce((t, s) => t + (s.views || 0), 0);
    const taps = Object.values(adStats).reduce((t, s) => t + (s.taps || 0), 0);
    const amount = Math.floor(views / cfg.viewsPerCoin) + taps * cfg.perTap;
    if (amount > 0) items.push({ kind: 'ads', at: now, amount, icon: '📺', label: `Ad money (${views} views, ${taps} taps)` });
  }
  return items.sort((a, b) => b.at - a.at);
}

// Someone's entries in the ledger, as signed amounts.
export function ledgerItems(name, ledger = []) {
  const out = [];
  for (const x of ledger) {
    if (x.type === 'spend' && x.person === name)
      out.push({ kind: 'spend', at: x.at, amount: -x.amount, icon: x.what === 'skip' ? '⏭' : '🚫', label: x.label || 'Spent' });
    else if (x.type === 'gift' && x.from === name)
      out.push({ kind: 'gift-out', at: x.at, amount: -x.amount, icon: '🎁', label: `To ${x.to}${x.note ? `: “${x.note}”` : ''}` });
    else if (x.type === 'gift' && x.to === name)
      out.push({ kind: 'gift-in', at: x.at, amount: x.amount, icon: '🎁', label: `From ${x.from}${x.note ? `: “${x.note}”` : ''}` });
    else if (x.type === 'prize' && x.person === name)
      out.push({ kind: 'prize', at: x.at, amount: x.amount, icon: x.what === 'wheel' ? '🎡' : '🎮', label: x.label || 'Prize' });
    else if (x.type === 'grant' && x.to === name)
      out.push({
        kind: 'grant',
        at: x.at,
        amount: x.amount,
        icon: x.amount >= 0 ? '⭐' : '⚠️',
        label: x.note || (x.amount >= 0 ? 'Bonus' : 'Taken away'),
      });
  }
  return out;
}

// Casino and economy commands (daily, work, bets…), from the person's bank
// doc, which only the server writes: its latest entries, plus one line for
// everything older so the total matches.
export function bankItems(name, bank = {}) {
  const b = bank[name];
  if (!b || !b.net) return b?.recent?.length ? bankRecent(b) : [];
  const recent = bankRecent(b);
  const older = b.net - recent.reduce((t, x) => t + x.amount, 0);
  if (older)
    recent.push({
      kind: 'casino',
      at: Math.min(...recent.map((x) => x.at), b.since || 1) - 1,
      amount: older,
      icon: '🎰',
      label: 'Earlier casino and economy',
    });
  return recent;
}
const bankRecent = (b) =>
  (b.recent || []).map((x) => ({ kind: 'casino', at: x.at, amount: x.amount, icon: x.icon || '🎰', label: x.label || 'Casino' }));

export function wallet(name, data) {
  const earned = earnedItems(name, data);
  const ledger = [...ledgerItems(name, data.ledger), ...bankItems(name, data.bank)];
  const history = [...earned, ...ledger].sort((a, b) => b.at - a.at);
  const sum = (list) => list.reduce((t, x) => t + x.amount, 0);
  return { balance: sum(history), earned: sum(earned), history };
}

// Who earned the most (tasks, hours, and bonuses; gifts don't count).
export function leaderboard(roster, data, since = 0) {
  return roster
    .map((name) => {
      const items = [...earnedItems(name, { ...data, owner: false }), ...ledgerItems(name, data.ledger).filter((x) => x.kind === 'grant')];
      return { name, coins: items.filter((x) => x.at >= since).reduce((t, x) => t + x.amount, 0) };
    })
    .sort((a, b) => b.coins - a.coins);
}

// When this person's paid ad break ends (0 if none), from their purchases.
export function adFreeUntil(name, ledger = []) {
  return ledger.reduce(
    (m, x) => ((x.type === 'spend' || x.type === 'prize') && x.person === name && x.until ? Math.max(m, x.until) : m),
    0,
  );
}

// Prizes this person has won today (games and the wheel have daily limits).
export function prizesToday(name, ledger = [], what, now = Date.now()) {
  const midnight = teamMidnight(teamDay(now));
  return ledger.filter((x) => x.type === 'prize' && x.person === name && x.at >= midnight && (!what || x.what === what));
}

// Everything under people's current names, so coins follow a rename: shifts
// and ledger entries keep the name they were saved with, and the server keeps
// writing to the bank doc of the current name (an old one stays as it was and
// is added in). bank: the bank docs, as a list.
export function coinsByName({ shifts = [], ledger = [], bank = [] }, rename = (n) => n) {
  const same = (n) => (n ? rename(n) : n);
  const banks = {};
  for (const b of bank) {
    if (!b?.name) continue;
    const name = same(b.name);
    const prev = banks[name];
    banks[name] = !prev
      ? { ...b, name }
      : {
          ...(b.name === name ? b : prev),
          name,
          net: (prev.net || 0) + (b.net || 0),
          recent: [...(prev.recent || []), ...(b.recent || [])].sort((x, y) => y.at - x.at).slice(0, 15),
          since: Math.min(prev.since || b.since || 0, b.since || prev.since || 0) || undefined,
        };
  }
  return {
    shifts: shifts.map((s) => (s.person && same(s.person) !== s.person ? { ...s, person: same(s.person) } : s)),
    ledger: ledger.map((x) =>
      ['person', 'from', 'to'].some((k) => x[k] && same(x[k]) !== x[k])
        ? { ...x, ...(x.person && { person: same(x.person) }), ...(x.from && { from: same(x.from) }), ...(x.to && { to: same(x.to) }) }
        : x,
    ),
    bank: banks,
  };
}

// Gifts and ad prizes are paid by the server (the play function), which
// checks them against the real balance and today's limits; demo mode runs the
// same checks. Each returns the ledger entry to add, or { error }.
export const GIFT_MAX = 5000;
// The prize wheel's coin slices (AdGames.jsx draws the wheel).
export const WHEEL_COINS = [0, 1, 2, 3, 5, 10];
export const GAME_PRIZE_MAX = 20;
const text = (v, n) => String(v || '').slice(0, n);

export function giftEntry(from, { to, amount, note }, { roster, balance, now = Date.now() }) {
  const n = Number(amount);
  if (!roster.includes(to)) return { error: 'Who’s that?' };
  if (to === from) return { error: 'That’s you.', body: 'Your coins are already yours.' };
  if (!Number.isInteger(n) || n < 1) return { error: 'Send at least 1 coin.' };
  if (n > GIFT_MAX) return { error: 'That’s a lot.', body: `Up to ${GIFT_MAX} at a time.` };
  if (n > balance) return { error: `You only have ${balance} coins.` };
  return { type: 'gift', from, to, amount: n, note: text(note, 140).trim(), at: now };
}

export function prizeEntry(name, { what, amount, hour, label }, { ledger, gameCap, now = Date.now() }) {
  if (what === 'wheel') {
    if (prizesToday(name, ledger, 'wheel', now).length) return { error: 'You already spun the wheel today.' };
    if (hour) return { type: 'prize', person: name, what, amount: 0, label: 'Prize wheel: 1 hour with no ads', until: now + 3600000, at: now };
    const n = Number(amount);
    if (!WHEEL_COINS.includes(n)) return { error: 'That isn’t on the wheel.' };
    return { type: 'prize', person: name, what, amount: n, label: n ? `Prize wheel: +${n}` : 'Prize wheel: nothing', at: now };
  }
  if (what === 'game') {
    const left = Math.max(0, gameCap - prizesToday(name, ledger, 'game', now).reduce((t, x) => t + x.amount, 0));
    const n = Math.min(left, GAME_PRIZE_MAX, Math.max(0, Math.floor(Number(amount)) || 0));
    if (!n) return { error: left ? 'No prize this time.' : 'That’s all the game prizes for today.' };
    return { type: 'prize', person: name, what, amount: n, label: text(label, 80) || 'Ad game prize', at: now };
  }
  return { error: 'Unknown prize.' };
}
