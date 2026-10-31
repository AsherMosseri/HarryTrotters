// The market (F1): what Jackson coins buy. Four shelves:
//   pet items  care for your pet (pets.js); never levels
//   perks      real-life perks team management adds (perks/{id}); buying
//              one asks them to approve it, and a decline refunds it
//   chat extras short-lived fun (a shout-out on Today, glowing messages,
//              bigger super reactions); nothing that's free today
//   game entries tournaments (tournaments/{id}): pay the entry, the pot goes
//              to the best score when it ends
// Only the server sells anything (functions/market.js): it reads the balance
// fresh and writes the spend itself. These checks are shared with demo mode.

import { teamMidnight, teamDay } from './coins.js';
import { weekStart } from './streaks.js';
import { PET_ITEMS, careAfter, petItem } from './pets.js';

export { PET_ITEMS };

// Ideas team management can add with one tap (name, short description, price).
export const PERK_IDEAS = [
  { name: 'Pick the lab music', desc: 'You choose what plays in the lab for one meeting.', price: 60 },
  { name: 'First pick of tasks', desc: 'Choose your task first at the next meeting.', price: 80 },
  { name: 'Skip cleanup once', desc: 'Someone else sweeps up after one meeting.', price: 120 },
  { name: 'Choose the team snack', desc: 'Pick the snack for the next meeting.', price: 100 },
  { name: 'Name the next robot part', desc: 'Your name for the next big part we build.', price: 150 },
  { name: 'Drive the robot first', desc: 'First turn on the controller at the next practice.', price: 90 },
  { name: 'Shout-out in announcements', desc: 'Team management gives you a shout-out in #announcements.', price: 50 },
  { name: 'Pick the next team lunch spot', desc: 'You choose where the team eats next time.', price: 200 },
  { name: 'Choose a practice drill', desc: 'Pick one drill or challenge for practice.', price: 70 },
  { name: 'Name a CAD file', desc: 'Your name on the next new assembly in CAD.', price: 40 },
  { name: 'Sticker on the robot', desc: 'Put one (approved) sticker on the robot.', price: 180 },
  { name: 'Lab DJ for a week', desc: 'Your playlist all week.', price: 220 },
  { name: 'Choose the next team photo pose', desc: 'Everyone strikes your pose.', price: 60 },
  { name: 'Coach for a drill', desc: 'Run one practice drill as coach.', price: 110 },
  { name: 'Front seat on the trip', desc: 'Front seat on the next team trip.', price: 120 },
  { name: 'Pick the scrimmage team name', desc: 'Name our alliance for a practice scrimmage.', price: 80 },
  { name: 'First pick of new parts', desc: 'First to try the next parts that arrive.', price: 90 },
  { name: 'Choose the whiteboard quote', desc: 'Your quote on the lab whiteboard for a week.', price: 50 },
  { name: 'Pick the meeting game', desc: 'Pick the warm-up game at the next meeting.', price: 60 },
  { name: 'Wear the team hat', desc: 'The silly team hat is yours for a meeting.', price: 40 },
  { name: 'Leave 10 minutes early', desc: 'Once, with team management’s OK.', price: 150 },
];

// Chat extras. Each lasts `hours` from when you buy it.
export const CHAT_EXTRAS = [
  {
    id: 'banner',
    name: 'Shout-out on Today',
    desc: 'Your message across the top of Today, for everyone, for a day.',
    price: 40,
    hours: 24,
    text: 80,
  },
  { id: 'glow', name: 'Glowing messages', desc: 'Your chat messages glow for a day.', price: 25, hours: 24 },
  { id: 'mega', name: 'Mega super reactions', desc: 'Your super reactions burst bigger for a day.', price: 20, hours: 24 },
];
export const chatExtra = (id) => CHAT_EXTRAS.find((x) => x.id === id) || null;
// Shout-outs on Today at once, so the page doesn't fill with them.
export const BANNERS_MAX = 3;

export const PERK_MAX_PRICE = 5000;
export const STATUSES = { pending: 'Waiting for OK', approved: 'Approved', redeemed: 'Done', declined: 'Declined, refunded' };

const text = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (v) => (v === '' || v == null ? null : Math.floor(Number(v)));

// A perk as team management saves it (perks/{id}), or { error }.
export function cleanPerk(p) {
  const name = text(p.name, 60);
  const price = int(p.price);
  const stock = int(p.stock);
  const limit = int(p.limit);
  if (!name) return { error: 'Give it a name.' };
  if (!Number.isInteger(price) || price < 1 || price > PERK_MAX_PRICE) return { error: `Price: 1 to ${PERK_MAX_PRICE} coins.` };
  if (stock != null && !(stock >= 0 && stock <= 1000)) return { error: 'How many: up to 1000, or leave it empty.' };
  if (limit != null && !(limit >= 1 && limit <= 100)) return { error: 'Each person: 1 to 100, or leave it empty.' };
  return {
    name,
    desc: text(p.desc, 200),
    price,
    stock,
    limit,
    per: p.per === 'week' ? 'week' : 'season',
    approval: p.approval !== false,
    active: p.active !== false,
  };
}

// The purchases that still count against stock and limits (not declined).
const counts = (x) => x.status !== 'declined';
// The Monday this week started, team time.
export const weekFrom = (now) => teamMidnight(weekStart(teamDay(now)));

// What buying `item` costs and writes, or { error }. item: 'pet:<id>',
// 'perk:<id>' or 'extra:<id>'.
// ctx: { me, aliases (every name me has gone by), balance, pet (doc or null),
//        perk (doc or null, for a perk), purchases (every purchase of this
//        item), now, text (a shout-out's message) }
// Returns { price, label, purchase?, pet? } (pet: the pet's new needs).
export function buyCheck(item, ctx) {
  const { me, balance, now = Date.now() } = ctx;
  const aliases = ctx.aliases || [me];
  const mine = (ctx.purchases || []).filter((x) => aliases.includes(x.person));
  const [kind, id] = String(item || '').split(/:(.*)/s);
  const afford = (price) => (price > balance ? { error: `That’s ${price} coins. You have ${balance}.` } : null);

  if (kind === 'pet') {
    const it = petItem(id);
    if (!it) return { error: 'That isn’t for sale.' };
    const after = careAfter(ctx.pet, it, now);
    if (after.error) return after;
    return afford(it.price) || { price: it.price, label: `${it.name} for ${ctx.pet.name}`, pet: after };
  }

  if (kind === 'perk') {
    const p = ctx.perk;
    if (!p || p.active === false || p.deleted) return { error: 'That perk isn’t for sale right now.' };
    const sold = (ctx.purchases || []).filter(counts).length;
    if (p.stock != null && sold >= p.stock) return { error: 'Sold out.', body: 'Team management can add more.' };
    if (p.limit != null) {
      const from = p.per === 'week' ? weekFrom(now) : 0;
      const had = mine.filter((x) => counts(x) && x.at >= from).length;
      if (had >= p.limit)
        return {
          error: p.per === 'week' ? 'That’s your limit this week.' : 'That’s your limit.',
          body: `${p.limit} per person${p.per === 'week' ? ' a week' : ''}.`,
        };
    }
    return (
      afford(p.price) || {
        price: p.price,
        label: p.name,
        purchase: {
          item,
          kind: 'perk',
          name: p.name,
          price: p.price,
          person: me,
          status: p.approval === false ? 'approved' : 'pending',
          at: now,
        },
      }
    );
  }

  if (kind === 'extra') {
    const x = chatExtra(id);
    if (!x) return { error: 'That isn’t for sale.' };
    const live = (ctx.purchases || []).filter((p) => p.status === 'active' && p.until > now);
    const myLive = live.find((p) => aliases.includes(p.person));
    if (myLive) return { error: 'You already have this.', body: `It lasts until ${new Date(myLive.until).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}.` };
    const msg = x.text ? text(ctx.text, x.text) : '';
    if (x.text && !msg) return { error: 'Write your shout-out first.' };
    if (id === 'banner' && live.length >= BANNERS_MAX) return { error: 'Today is full of shout-outs.', body: 'Try again in a few hours.' };
    return (
      afford(x.price) || {
        price: x.price,
        label: x.name,
        purchase: {
          item,
          kind: 'extra',
          name: x.name,
          price: x.price,
          person: me,
          status: 'active',
          at: now,
          until: now + x.hours * 3600000,
          ...(msg && { text: msg }),
        },
      }
    );
  }
  return { error: 'That isn’t for sale.' };
}

// The ledger entry for a purchase (the server writes it, never the app).
export const spendEntry = (me, item, price, label, now) => ({
  type: 'spend',
  person: me,
  amount: price,
  what: 'market',
  item,
  label: `Market: ${label}`.slice(0, 80),
  at: now,
});
// Coins back: a declined perk, a cancelled tournament, or one nobody scored in.
export const refundEntry = (person, amount, label, item, now) => ({
  type: 'refund',
  person,
  amount,
  item,
  label: `Refund: ${label}`.slice(0, 80),
  at: now,
});

// Team management moving a perk purchase along: the new status, or { error }.
export function decideCheck(purchase, status) {
  if (!purchase || purchase.kind !== 'perk') return { error: 'That purchase is gone.' };
  const from = purchase.status;
  const ok = { approved: ['pending'], declined: ['pending', 'approved'], redeemed: ['pending', 'approved'] }[status];
  if (!ok) return { error: 'Unknown choice.' };
  if (!ok.includes(from)) return { error: `It’s already ${STATUSES[from]?.toLowerCase() || from}.` };
  return { status, refund: status === 'declined' };
}

// Chat extras running now: glow (name → { at, until }: their messages sent
// in that time glow), mega (names whose super reactions burst bigger) and
// banners (Today's shout-outs). rename: purchases keep the name they were
// bought under.
export function activeExtras(purchases = [], now = Date.now(), rename = (n) => n) {
  const out = { glow: new Map(), mega: new Set(), banners: [] };
  for (const p of purchases) {
    if (p.kind !== 'extra' || p.status !== 'active' || !(p.until > now)) continue;
    const id = p.item.slice('extra:'.length);
    const who = rename(p.person);
    if (id === 'banner') out.banners.push({ ...p, person: who });
    else if (id === 'glow') out.glow.set(who, { at: p.at, until: p.until });
    else if (id === 'mega') out.mega.add(who);
  }
  out.banners.sort((a, b) => a.at - b.at);
  return out;
}
// Does this chat message glow (its author bought glowing messages, and sent
// it while they were on)?
export const glows = (extras, m) => {
  const g = extras?.glow.get(m.by);
  return !!g && m.at >= g.at && m.at <= g.until;
};
// What the market's Play button types in #arcade for a tournament (the game
// command reads it to play that tournament's seed).
export const playLine = (t) => `/${TOURNAMENT_GAMES[t.game]?.cmd || t.game} tournament ${t.id}`;

// ---------- tournaments ----------
// tournaments/{id}: { game, title, entry, pot, status: 'open'|'done',
//   opensAt, endsAt, players: { [name]: { joinedAt, best, at, voided? } },
//   review: { [game id]: { name, score, at, why } }, winners, by }
// The fun-games side plays them and saves each player's best; `better` says
// whether a high or a low score wins. The seed the games come from is in
// tournamentSecrets/{id} (server only), never on the doc the team reads.
// review: runs held for team management (too fast for a person, see
// funGames.reviewReason); they count only once cleared. voided: team
// management threw out that player's result ({ by, at }).
export const TOURNAMENT_GAMES = {
  tetris: { name: 'Tetris', better: 'high', unit: 'points', cmd: 'tetris' },
  minesweeper: { name: 'Minesweeper', better: 'low', unit: 'seconds', cmd: 'minesweep' },
};
export const ENTRY_MAX = 500;
const HOUR = 3600000;

// A new tournament from team management's form, or { error }.
export function newTournament(form, { by, now = Date.now(), seed }) {
  const g = TOURNAMENT_GAMES[form.game];
  if (!g) return { error: 'Pick a game.' };
  const entry = int(form.entry);
  if (!Number.isInteger(entry) || entry < 1 || entry > ENTRY_MAX) return { error: `Entry: 1 to ${ENTRY_MAX} coins.` };
  const opensAt = Math.max(now, Number(form.opensAt) || now);
  const endsAt = Number(form.endsAt);
  if (!Number.isFinite(endsAt) || endsAt < opensAt + HOUR) return { error: 'It has to run at least an hour.' };
  if (endsAt > now + 14 * 24 * HOUR) return { error: 'Two weeks at most.' };
  return {
    game: form.game,
    title: text(form.title, 60) || `${g.name} tournament`,
    entry,
    pot: 0,
    // Not on the doc the team reads: the server moves it to tournamentSecrets.
    seed: String(seed),
    better: g.better,
    status: 'open',
    opensAt,
    endsAt,
    players: {},
    winners: [],
    by,
    at: now,
  };
}

// Joining: the player's name and the new pot, or { error }.
export function joinCheck(t, { me, aliases = [me], balance, now = Date.now() }) {
  if (!t || t.status !== 'open') return { error: 'That tournament is over.' };
  if (now >= t.endsAt) return { error: 'That tournament just ended.' };
  if (aliases.some((n) => t.players?.[n])) return { error: 'You’re already in.' };
  if (t.entry > balance) return { error: `The entry is ${t.entry} coins. You have ${balance}.` };
  return { pot: (t.pot || 0) + t.entry, player: { joinedAt: now, best: null, at: null } };
}

// Who wins: the pot to the best score (ties split; a leftover coin goes to
// whoever got there first). Nobody scored: everyone gets the entry back.
// rename: players keep the name they joined with.
// A voided result doesn't count (the pot goes to the next best), and a voided
// player gets no refund.
export function payoutOf(t, rename = (n) => n) {
  const better = t.better || TOURNAMENT_GAMES[t.game]?.better || 'high';
  const players = Object.entries(t.players || {})
    .filter(([, p]) => !p.voided)
    .map(([name, p]) => ({ name: rename(name), ...p }));
  const scored = players.filter((p) => Number.isFinite(p.best));
  if (!scored.length) return { winners: [], pays: [], refunds: players.map((p) => ({ name: p.name, amount: t.entry })) };
  const best = better === 'low' ? Math.min(...scored.map((p) => p.best)) : Math.max(...scored.map((p) => p.best));
  const top = scored.filter((p) => p.best === best).sort((a, b) => (a.at || 0) - (b.at || 0));
  const pot = t.pot || 0;
  const each = Math.floor(pot / top.length);
  const extra = pot - each * top.length;
  return {
    winners: top.map((p) => p.name),
    best,
    pays: top.map((p, i) => ({ name: p.name, amount: each + (i < extra ? 1 : 0) })).filter((p) => p.amount > 0),
    refunds: [],
  };
}
export const prizeLabel = (t) => `Tournament: ${t.title}`.slice(0, 80);

// Results in order, best first (voided ones left out), and the voided names.
export function standings(t) {
  const low = (t.better || TOURNAMENT_GAMES[t.game]?.better) === 'low';
  const players = Object.entries(t.players || {}).map(([name, p]) => ({ name, ...p }));
  return {
    ranked: players
      .filter((p) => !p.voided && Number.isFinite(p.best))
      .sort((a, b) => (low ? a.best - b.best : b.best - a.best) || (a.at || 0) - (b.at || 0)),
    voided: players.filter((p) => p.voided),
  };
}
// Runs waiting for team management, oldest first.
export const pendingReview = (t) =>
  Object.entries(t.review || {})
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
// The payout waits (up to REVIEW_WAIT after the end) while a run held for
// review would win or tie if it were cleared, so clearing it still matters.
export const REVIEW_WAIT = 48 * HOUR;
export function reviewHolds(t, now = Date.now()) {
  if (now > t.endsAt + REVIEW_WAIT) return false;
  const low = (t.better || TOURNAMENT_GAMES[t.game]?.better) === 'low';
  const top = standings(t).ranked[0]?.best;
  return pendingReview(t).some(
    (r) => !t.players?.[r.name]?.voided && Number.isFinite(r.score) && (top == null || (low ? r.score <= top : r.score >= top)),
  );
}
// Clearing a held run: the player's new best and when it was set (or null if
// it isn't better than what they have).
export function clearedBest(t, run) {
  const p = t.players?.[run.name];
  if (!p || p.voided || !Number.isFinite(run.score)) return null;
  const low = (t.better || TOURNAMENT_GAMES[t.game]?.better) === 'low';
  if (p.best != null && !(low ? run.score < p.best : run.score > p.best)) return null;
  return { best: run.score, at: run.at };
}
