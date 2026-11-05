// The Stats tab of the coins screen (3.2): everything is worked out from the
// person's own coin history (wallet().history, the very lines the History
// tab lists), so every number here adds up to what's there. No React here:
// scripts/test-coin-stats.mjs runs it in Node.
//
// Every history line falls in exactly one source (SOURCES), so the sources
// always add up to the balance. Gambling is the casino, the lottery and the
// bets in arcade games; /work, /beg and /rob are the economy. The bank keeps
// only a person's latest casino and economy lines one by one (RECENT_CAP);
// what's older is one "Earlier casino and economy" line, which can't be split
// by game, so it has its own source and is left out of the per-game numbers.

import { sumCoins, teamDay, teamMidnight } from '../functions/shared/coins.js';
import { CASINO } from '../functions/shared/casino.js';
import { LABEL as ARCADE_LABEL, ICON as ARCADE_ICON } from '../functions/shared/arcade.js';
import { GAME_LABEL } from '../functions/shared/disputes.js';

const CASINO_ICON = { slots: '🎰', dice: '🎲', coinflip: '🪙', roulette: '🎡', blackjack: '🃏', crash: '🚀', mines: '💣', highlow: '🔼', lottery: '🎟️' };
const NAMES = { ...ARCADE_LABEL, ...GAME_LABEL, lottery: 'Lottery' };
// "Coin flip" → 'coinflip', from the label a bank line starts with.
const BY_LABEL = new Map(Object.entries(NAMES).map(([id, label]) => [label.toLowerCase(), id]));
export const gameName = (id) => NAMES[id] || 'Other games';
export const gameIcon = (id) => CASINO_ICON[id] || ARCADE_ICON[id] || '🎲';
export const isCasinoGame = (id) => CASINO.includes(id);

// Where a history line's coins came from. Every line is exactly one of these.
export const SOURCES = [
  ['task', 'Finished tasks'],
  ['hours', 'Lab hours'],
  ['award', 'Games and quizzes'],
  ['prize', 'Prizes'],
  ['grant', 'Bonuses and adjustments'],
  ['economy', '/work, /beg and /rob'],
  ['gambling', 'Gambling'],
  ['earlier', 'Older casino and economy'],
  ['gift-in', 'Gifts received'],
  ['gift-out', 'Gifts sent'],
  ['loan', 'Loans'],
  ['market', 'Market'],
  ['spend', 'Ad breaks and skips'],
  ['refund', 'Refunds'],
];
export const EARNED = ['task', 'hours', 'award', 'prize', 'grant', 'economy'];
export const EARLIER_LABEL = 'Earlier casino and economy';

// What one history line is: { source, game?, kind?: 'result' | 'held' |
// 'adjust' | 'ticket' | 'jackpot' }.
export function classify(x) {
  if (x.kind === 'casino') return bankLine(x);
  if (x.kind === 'refund' && x.game) return { source: 'gambling', game: String(x.game), kind: 'adjust' };
  // The owner's Reverse on a casino line (a grant that undoes it).
  if (x.kind === 'grant' && String(x.reverses || '').startsWith('casino|')) return { source: 'gambling', game: gameOfLabel(x.reverses.split('|').slice(3).join('|')), kind: 'adjust' };
  if (x.kind === 'spend') return { source: x.what === 'market' || x.what === 'tournament' ? 'market' : 'spend' };
  if (['task', 'hours', 'award', 'prize', 'grant', 'gift-in', 'gift-out', 'loan', 'refund'].includes(x.kind)) return { source: x.kind };
  return { source: 'grant' };
}
function gameOfLabel(label) {
  const held = /^Bet held: (.+) \S+ \(playing\)$/.exec(label);
  const head = (held ? held[1] : String(label).split(':')[0]).trim().toLowerCase();
  return BY_LABEL.get(head) || 'other';
}
function bankLine(x) {
  const label = String(x.label || '');
  if (label === EARLIER_LABEL) return { source: 'earlier' };
  if (/^Won the lottery/.test(label)) return { source: 'gambling', game: 'lottery', kind: 'jackpot' };
  if (/^Lottery: \d+ tickets?$/.test(label)) return { source: 'gambling', game: 'lottery', kind: 'ticket' };
  if (/^(Work: |Begging$|Robbed |Caught robbing |.+ paid you a fine$)/.test(label)) return { source: 'economy' };
  if (x.held || /^Bet held: /.test(label)) return { source: 'gambling', game: gameOfLabel(label), kind: 'held' };
  const game = gameOfLabel(label);
  if (game !== 'other' || /: (won|lost|bet back)/.test(label)) return { source: 'gambling', game, kind: 'result' };
  return { source: 'economy' };
}

const add = (a, b) => sumCoins([{ amount: a }, { amount: b }]);

// Everything the Stats tab shows. history: wallet().history (newest first).
// now: for the last days of the daily chart. days: how many of them.
export function coinStats(history = [], { now = Date.now(), days = 30 } = {}) {
  const lines = history.map((x) => ({ x, c: classify(x) }));
  const total = sumCoins(history);

  // Sources, in SOURCES order; they add up to the balance.
  const bySource = new Map(SOURCES.map(([id]) => [id, []]));
  for (const { x, c } of lines) bySource.get(c.source).push(x);
  const sources = SOURCES.map(([id, label]) => {
    const list = bySource.get(id);
    return { id, label, n: list.length, coins: sumCoins(list), gained: sumCoins(list.filter((x) => x.amount > 0)), spent: -sumCoins(list.filter((x) => x.amount < 0)) };
  });
  const src = Object.fromEntries(sources.map((s) => [s.id, s]));

  // Gambling, overall and game by game.
  const gamb = lines.filter((l) => l.c.source === 'gambling');
  const results = gamb.filter((l) => l.c.kind === 'result' || l.c.kind === 'ticket' || l.c.kind === 'jackpot');
  const games = new Map();
  for (const { x, c } of gamb) {
    const g = games.get(c.game) || { id: c.game, name: gameName(c.game), icon: gameIcon(c.game), casino: isCasinoGame(c.game), plays: 0, wins: 0, losses: 0, best: 0, worst: 0, list: [] };
    g.list.push(x);
    // A lottery win isn't a play of its own (the tickets were).
    if (c.kind === 'result' || c.kind === 'ticket') g.plays += 1;
    if (c.kind === 'result' || c.kind === 'jackpot') {
      if (x.amount > 0) g.wins += 1;
      if (x.amount < 0) g.losses += 1;
    }
    if (c.kind !== 'held' && c.kind !== 'adjust') {
      g.best = Math.max(g.best, x.amount);
      g.worst = Math.min(g.worst, x.amount);
    }
    games.set(c.game, g);
  }
  const gameList = [...games.values()]
    .map(({ list, ...g }) => ({ ...g, net: sumCoins(list) }))
    .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
  const gambling = {
    won: sumCoins(results.filter((l) => l.x.amount > 0).map((l) => l.x)),
    lost: -sumCoins(results.filter((l) => l.x.amount < 0).map((l) => l.x)),
    held: -sumCoins(gamb.filter((l) => l.c.kind === 'held').map((l) => l.x)),
    adjusted: sumCoins(gamb.filter((l) => l.c.kind === 'adjust').map((l) => l.x)),
    net: src.gambling.coins,
    plays: gameList.reduce((t, g) => t + g.plays, 0),
    wins: gameList.reduce((t, g) => t + g.wins, 0),
    games: gameList,
    earlier: src.earlier.coins,
  };

  // Days (the team's days, New York): each day's change, overall and from
  // gambling. The "earlier" line has no real time, so it's left out here.
  const dayNet = new Map();
  const dayGamb = new Map();
  for (const { x, c } of lines) {
    if (c.source === 'earlier' || !x.at) continue;
    const d = teamDay(x.at);
    if (!dayNet.has(d)) dayNet.set(d, []);
    dayNet.get(d).push(x);
    if (c.source !== 'gambling') continue;
    if (!dayGamb.has(d)) dayGamb.set(d, []);
    dayGamb.get(d).push(x);
  }
  const dayList = [...dayNet].map(([day, list]) => ({ day, net: sumCoins(list), n: list.length }));
  const best = dayList.filter((d) => d.net > 0).sort((a, b) => b.net - a.net || b.day.localeCompare(a.day))[0] || null;
  const worst = dayList.filter((d) => d.net < 0).sort((a, b) => a.net - b.net || b.day.localeCompare(a.day))[0] || null;
  const gambDays = [...dayGamb].map(([day, list]) => ({ day, net: sumCoins(list) }));
  const bestGamb = gambDays.filter((d) => d.net > 0).sort((a, b) => b.net - a.net)[0] || null;
  const worstGamb = gambDays.filter((d) => d.net < 0).sort((a, b) => a.net - b.net)[0] || null;

  // The daily gambling chart: the last `days` team days up to today, each
  // day's gambling net (0 on days with none).
  const today = teamDay(now);
  const daily = [];
  for (let i = days - 1, t = teamMidnight(today) + 12 * 3600000; i >= 0; i--) {
    const d = teamDay(t - i * 86400000);
    if (daily.length && daily[daily.length - 1].day === d) continue;
    daily.push({ day: d, net: sumCoins(dayGamb.get(d) || []), n: (dayGamb.get(d) || []).length });
  }

  // Loans, by which way the coins went (shared/coins.js loanItem).
  const loanLines = bySource.get('loan');
  const part = (f) => Math.abs(sumCoins(loanLines.filter(f)));
  const loans = {
    borrowed: part((x) => x.what === 'lend' && x.amount > 0),
    paidBack: part((x) => (x.what === 'repay' || x.what === 'collect') && x.amount < 0),
    lent: part((x) => x.what === 'lend' && x.amount < 0),
    gotBack: part((x) => (x.what === 'repay' || x.what === 'collect') && x.amount > 0),
    net: src.loan.coins,
    n: loanLines.length,
  };

  return {
    total,
    lines: history.length,
    loans,
    sources,
    src,
    earned: { total: sumCoins(EARNED.map((id) => ({ amount: src[id].coins }))), parts: EARNED.map((id) => src[id]) },
    gambling,
    days: { best, worst, bestGamb, worstGamb, count: dayList.length },
    balance: balanceSeries(history, total),
    daily,
  };
}

// The balance after each line, oldest first: [{ at, v }]. The last point is
// the balance itself (sumCoins, the History tab's total). Long histories are
// thinned to `max` points (the newest is always kept).
export function balanceSeries(history = [], total = sumCoins(history), max = 400) {
  const asc = [...history].sort((a, b) => a.at - b.at);
  const out = [];
  let run = 0;
  for (const x of asc) {
    run = add(run, x.amount);
    if (out.length && out[out.length - 1].at === x.at) out[out.length - 1].v = run;
    else out.push({ at: x.at, v: run });
  }
  if (out.length) out[out.length - 1].v = total;
  if (out.length <= max) return out;
  const step = out.length / max;
  const thin = [];
  for (let i = 0; i < max - 1; i++) thin.push(out[Math.floor(i * step)]);
  thin.push(out[out.length - 1]);
  return thin;
}

// ---------- a scale for coins (up to a googol) ----------
// Linear while the numbers are of a similar size; when they span more than
// three powers of ten and reach 100,000 (a few hundred coins, then a
// trillion), a symmetric log scale, so the small part of the line still
// shows. pos(v) is 0 (bottom) to 1 (top). ticks: the values to label.
const slog = (v) => Math.sign(v) * Math.log10(1 + Math.abs(v));
export function coinScale(values = [], { ticks: want = 4 } = {}) {
  const vals = values.filter((v) => Number.isFinite(v));
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  if (lo === hi) hi = lo + 1;
  const absNz = vals.map(Math.abs).filter((v) => v >= 1).sort((a, b) => a - b);
  const maxAbs = Math.max(Math.abs(lo), Math.abs(hi));
  const small = absNz.length ? absNz[Math.floor(absNz.length * 0.25)] : 1;
  const log = maxAbs >= 1e5 && Math.log10(maxAbs) - Math.log10(Math.max(1, small)) > 3;
  if (log) {
    const a = slog(lo);
    const b = slog(hi);
    const pos = (v) => (slog(v) - a) / (b - a);
    // Powers of ten, every `step` of them, so there are about `want` labels.
    const top = Math.ceil(Math.log10(Math.max(1, Math.abs(hi))));
    const bottom = Math.ceil(Math.log10(Math.max(1, Math.abs(lo))));
    const step = Math.max(1, Math.ceil((top + bottom) / want));
    const ticks = [0];
    for (let e = step; e <= top; e += step) if (10 ** e <= hi * 1.0000001) ticks.push(10 ** e);
    for (let e = step; e <= bottom; e += step) if (-(10 ** e) >= lo * 1.0000001) ticks.push(-(10 ** e));
    return { kind: 'log', lo, hi, pos, ticks: ticks.sort((x, y) => x - y) };
  }
  // Linear: round steps (1, 2 or 5 times a power of ten), and the range
  // stretched to whole steps.
  const raw = (hi - lo) / want;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) || 10 * p;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const pos = (v) => (v - lo) / (hi - lo);
  const ticks = [];
  for (let i = 0, v = lo; v <= hi + step / 2 && i < 50; i++, v = lo + i * step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return { kind: 'linear', lo, hi, pos, ticks };
}
