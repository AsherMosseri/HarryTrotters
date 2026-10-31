// Jackson coins (named after Jackson, with his OK). What you've earned is
// worked out from the team's data, so it follows the tasks and shifts: move a
// task out of Done and its coins go away again. Spending, gifts, and Asher's
// bonuses are entries in the coins ledger (Firestore "coins").
//
// Earning: perTask for each task you were assigned that's done, if someone
// else created it (no paying yourself for tasks you made up), for at most
// tasksPerDay of them a team day; perQuarter for every full 15 minutes at the
// lab (4 an hour), at most dayCap hours a day.
// Everything since `start`. Days before RATES_FROM (the 3.0 launch) keep
// 2.75's rules, so nobody's balance changes at the launch.
// Nobody earns coins from ads (views and taps are still counted for the ads
// dashboard; they just don't pay).

import { mergedMs } from './hours.js';

// The team day 3.0's earning rules start (4 an hour in 15-minute steps, cut
// at midnight, at most tasksPerDay paid tasks a day). Earlier days pay as
// 2.75 did: perHourBefore an hour, rounded down per day, each shift counted
// on the day it started, every finished task paid. The lead sets this to the
// launch day when 3.0 goes out.
export const RATES_FROM = '2026-11-02';

export const COIN_DEFAULTS = {
  perTask: 15,
  // Finished tasks that pay in one team day (Asher's call after the coin
  // audit: friends could make tasks for each other and farm them).
  tasksPerDay: 5,
  // Coins for each full 15 minutes at the lab. It replaced perHour (5 an
  // hour), which now only pays days before RATES_FROM (perHourBefore).
  perQuarter: 1,
  perHourBefore: 5,
  dayCap: 10,
  start: '2026-08-28',
  prices: { hour: 10, today: 25, week: 120, skip: 2 },
};

// Coins the server pays for games, quizzes, bingo, streaks and the like
// ('award' entries in the ledger, written only by functions/award.js): at most
// this many per person per team day from each source. A source missing here
// pays nothing, so every new way to earn has to be added on purpose.
export const AWARD_CAPS = {
  quiz: 30, // learning games (name that part, rules check, fix the bug…)
  daily: 10, // the daily question
  bingo: 25, // lab bingo rows
  predict: 20, // score predictions
  streak: 20, // streak milestones
  game: 20, // fun games (Tetris, Minesweeper, Battleship…), free #arcade prizes and /daily, together
};

export function coinSettings(raw) {
  // Old settings that no longer do anything (the hourly rate and ad money).
  // A perHour saved before 3.0 is the rate for days before RATES_FROM.
  const rest = { ...(raw || {}) };
  for (const k of ['perHour', 'viewsPerCoin', 'perTap']) delete rest[k];
  const before = Number(raw?.perHourBefore ?? raw?.perHour);
  return {
    ...COIN_DEFAULTS,
    ...rest,
    perHourBefore: Number.isFinite(before) && before >= 0 ? before : COIN_DEFAULTS.perHourBefore,
    prices: { ...COIN_DEFAULTS.prices, ...(raw?.prices || {}) },
  };
}
// Coins an hour at the lab (for the help text and the Coins page).
export const perHourOf = (cfg) => cfg.perQuarter * 4;

// Coins for one day's lab time. Paid per day, not per shift: the day's shifts
// are merged first (overlaps count once), capped at dayCap hours, then paid
// for each full 15 minutes. So two 10-minute shifts in a day earn 1 coin
// (20 minutes), where rounding each shift down would pay nothing.
export const QUARTER_MIN = 15;
export function coinsForMinutes(minutes, cfg) {
  const counted = Math.min(Math.max(0, minutes), cfg.dayCap * 60);
  return Math.floor(counted / QUARTER_MIN) * cfg.perQuarter;
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
// Midnight at the end of a team day (the next day's start). 26 hours on from
// the day's midnight is always inside the next day, even when the clocks
// change (days of 23 or 25 hours).
export const nextMidnight = (day) => teamMidnight(teamDay(teamMidnight(day) + 26 * 3600000));
const startMs = (cfg) => teamMidnight(cfg.start);
// A time as ms: the server reads Firestore Timestamps (task times are set by
// the server clock), the app reads numbers.
const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);

// Everything someone has earned, newest first: [{ at, amount, icon, label, kind }].
export function earnedItems(name, { tasks = [], shifts = [], cfg, now = Date.now() }) {
  const from = startMs(cfg);
  // Where 3.0's rules start. A ratesFrom in settings/team.coins overrides it
  // (the emulator tests use that); the constant is what ships.
  const switchDay = cfg.ratesFrom || RATES_FROM;
  const switchAt = teamMidnight(switchDay);
  const items = [];
  // From RATES_FROM, tasks pay for the first tasksPerDay finished each team day, in the order
  // they were finished (then by id), so the same ones always count, here and
  // on the server. Later ones still show, at 0. Moving a task out of Done and
  // back gives it a new finish time, so it lines up again behind the others.
  const done = [];
  for (const t of tasks) {
    if (t.status !== 'done' || t.deletedAt || !(t.assignees || []).includes(name) || t.createdBy === name) continue;
    const at = toMs(t.completedAt) || toMs(t.updatedAt) || toMs(t.createdAt);
    if (at < from) continue;
    done.push({ t, at });
  }
  done.sort((a, b) => a.at - b.at || String(a.t.id || '').localeCompare(String(b.t.id || '')));
  const perDay = new Map();
  for (const { t, at } of done) {
    // Before the switch every finished task paid (2.75).
    if (at < switchAt) {
      items.push({ kind: 'task', at, amount: cfg.perTask, icon: '✅', label: t.title || 'A task' });
      continue;
    }
    const day = teamDay(at);
    const n = (perDay.get(day) || 0) + 1;
    perDay.set(day, n);
    const cap = cfg.tasksPerDay ?? COIN_DEFAULTS.tasksPerDay;
    const over = n > cap;
    items.push({
      kind: 'task',
      at,
      amount: over ? 0 : cfg.perTask,
      icon: '✅',
      label: t.title || 'A task',
      ...(over && { note: `Daily task limit (${cap} a day)` }),
    });
  }
  // Lab time, added up per day (overlapping shifts count once), capped, and
  // paid per full 15 minutes of the day (coinsForMinutes). A shift that runs
  // past midnight is cut at midnight, so each day counts only its own time:
  // otherwise a shift from 11 PM to 11 AM and another from midnight to 11 AM
  // would land on different days and the same hours would pay twice.
  // Before RATES_FROM it's 2.75's way: each shift on the day it started,
  // merged and capped per day, perHourBefore an hour rounded down. Time past
  // the switch's midnight counts on the new days.
  const oldDays = new Map();
  const byDay = new Map();
  for (const s of shifts) {
    if (s.person !== name || !s.start || s.start < from) continue;
    let start = s.start;
    const end = Math.max(s.start, s.end ?? now);
    if (start < switchAt) {
      const key = teamDay(start);
      oldDays.set(key, [...(oldDays.get(key) || []), { start, end: Math.min(end, switchAt) }]);
      if (end <= switchAt) continue;
      start = switchAt;
    }
    for (let day = teamDay(start), i = 0; i < 400; i++) {
      const next = nextMidnight(day);
      const piece = { start: Math.max(start, teamMidnight(day)), end: Math.min(end, next) };
      byDay.set(day, [...(byDay.get(day) || []), piece]);
      if (end <= next) break;
      day = teamDay(next);
    }
  }
  const dayOf = ([key, list]) => [key, { minutes: mergedMs(list, now) / 60000, at: Math.max(...list.map((s) => s.end || now)) }];
  for (const [key, d] of [...oldDays].map(dayOf)) {
    const minutes = Math.min(d.minutes, cfg.dayCap * 60);
    const amount = Math.floor((minutes * cfg.perHourBefore) / 60);
    if (amount > 0) {
      const hours = Math.round((minutes / 60) * 10) / 10;
      items.push({
        kind: 'hours',
        at: d.at,
        amount,
        icon: '⏱',
        label: `${hours} h at the lab`,
        day: key,
        capped: d.minutes > minutes,
        note: `before 3.0: ${cfg.perHourBefore} an hour`,
      });
    }
  }
  const days = new Map([...byDay].map(dayOf));
  for (const [key, d] of days) {
    const minutes = Math.min(d.minutes, cfg.dayCap * 60);
    const amount = coinsForMinutes(d.minutes, cfg);
    if (amount > 0) {
      const hours = Math.round((minutes / 60) * 10) / 10;
      items.push({ kind: 'hours', at: d.at, amount, icon: '⏱', label: `${hours} h at the lab`, day: key, capped: d.minutes > minutes });
    }
  }
  return items.sort((a, b) => b.at - a.at);
}

// Spending: ad breaks and skips (the app), market buys and tournament
// entries (the server).
const SPEND_ICON = { skip: '⏭', market: '🛍️', tournament: '🏆' };
// Someone's entries in the ledger, as signed amounts.
export function ledgerItems(name, ledger = []) {
  const out = [];
  for (const x of ledger) {
    if (x.type === 'spend' && x.person === name)
      out.push({ kind: 'spend', at: x.at, amount: -x.amount, icon: SPEND_ICON[x.what] || '🚫', label: x.label || 'Spent' });
    // Coins back from the market (functions/market.js): a declined perk, a
    // cancelled tournament. Only the server writes these.
    else if (x.type === 'refund' && x.person === name)
      out.push({ kind: 'refund', at: x.at, amount: x.amount, icon: '↩️', label: x.label || 'Refund' });
    else if (x.type === 'gift' && x.from === name)
      out.push({ kind: 'gift-out', at: x.at, amount: -x.amount, icon: '🎁', label: `To ${x.to}${x.note ? `: “${x.note}”` : ''}` });
    else if (x.type === 'gift' && x.to === name)
      out.push({ kind: 'gift-in', at: x.at, amount: x.amount, icon: '🎁', label: `From ${x.from}${x.note ? `: “${x.note}”` : ''}` });
    else if (x.type === 'award' && x.person === name)
      out.push({ kind: 'award', at: x.at, amount: x.amount, icon: '★', label: x.label || 'Earned' });
    else if (x.type === 'prize' && x.person === name)
      out.push({
        kind: 'prize',
        at: x.at,
        amount: x.amount,
        icon: x.what === 'wheel' ? '🎡' : x.what === 'tournament' ? '🏆' : '🎮',
        label: x.label || 'Prize',
      });
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
      const items = [...earnedItems(name, data), ...ledgerItems(name, data.ledger).filter((x) => x.kind === 'grant')];
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
// The prize wheel's slices, in the order AdGames.jsx draws them, and how
// likely each one is. The server spins it (prizeEntry); the app only shows
// where it landed, so it can't pick the +10.
export const WHEEL = [
  { coins: 1, weight: 25 },
  { coins: 2, weight: 20 },
  { coins: 0, weight: 13 },
  { coins: 5, weight: 8 },
  { coins: 0, hour: true, weight: 8 },
  { coins: 3, weight: 12 },
  { coins: 0, weight: 12 },
  { coins: 10, weight: 2 },
];
export function spinWheel(rng = Math.random) {
  let r = rng() * WHEEL.reduce((t, s) => t + s.weight, 0);
  const i = WHEEL.findIndex((s) => (r -= s.weight) < 0);
  return i < 0 ? WHEEL.length - 1 : i;
}
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

export function prizeEntry(name, { what, amount, label }, { ledger, gameCap, now = Date.now(), rng = Math.random }) {
  if (what === 'wheel') {
    if (prizesToday(name, ledger, 'wheel', now).length) return { error: 'You already spun the wheel today.' };
    // seg: the slice it landed on, for the app to turn the wheel to.
    const seg = spinWheel(rng);
    const { coins: n, hour } = WHEEL[seg];
    if (hour) return { type: 'prize', person: name, what, amount: 0, label: 'Prize wheel: 1 hour with no ads', until: now + 3600000, seg, at: now };
    return { type: 'prize', person: name, what, amount: n, label: n ? `Prize wheel: +${n}` : 'Prize wheel: nothing', seg, at: now };
  }
  if (what === 'game') {
    const left = Math.max(0, gameCap - prizesToday(name, ledger, 'game', now).reduce((t, x) => t + x.amount, 0));
    const n = Math.min(left, GAME_PRIZE_MAX, Math.max(0, Math.floor(Number(amount)) || 0));
    if (!n) return { error: left ? 'No prize this time.' : 'That’s all the game prizes for today.' };
    return { type: 'prize', person: name, what, amount: n, label: text(label, 80) || 'Ad game prize', at: now };
  }
  return { error: 'Unknown prize.' };
}
