// Pet battles (3.3): challenge a teammate's pet, both pick a move each round,
// the server works out the round. No Firebase in here (like challenge.js and
// arcade.js): the play function runs it with the real pets and balances, and
// demo mode runs the same code. Our own moves and rules, nothing borrowed.
//
// - Every kind of pet has four moves of its own: two from the start, a third
//   at level 10 and the fourth at 25 (MOVES, UNLOCK). A move is one of a few
//   kinds (KINDS): an attack, a heavy attack, a dazing attack (the other pet
//   may skip its next turn), a shield (bounces a little back), a dodge (hits
//   back after it) or a heal. Shields, dodges and heals need a breather: not
//   two rounds in a row.
// - Health and hit strength grow slowly with the pet's level (mult): a level
//   10 pet is a bit stronger than a level 1, never out of reach. Gear is just
//   for looks, it changes nothing. Species have no stats of their own, only
//   their moves, so no kind of pet is better than another.
// - Each round both pick, hidden from each other (the picks wait in the
//   game's secret). When both picked, or the 45 s are up (a missing pick is
//   made for them, at random), the round is worked out with the app's secure
//   randomness. The battle ends when a pet's health hits 0, or after 12
//   rounds: the most health left (as a share of its full health) wins, the
//   same share is a draw.
// - A battle never touches the pets themselves: food, fun, level and the
//   neglect clock (petdeath.js) stay as they are. A pet that isn't with its
//   owner anymore (it died, was given away or released) can't battle: an
//   open or running battle with it ends and every bet goes back.
// - Bets are optional (0 is no bet), the same for both, run like /challenge:
//   the challenger's is held when the card goes up, the other's when they
//   accept; the winner gets both, a draw gives each their own back, and a
//   decline, cancel, timeout or a pet that's gone gives back what was held.
//
// The card (pub) keeps everything anyone may see: the two pets as they were
// when the battle started (pa, pb), the round, who has picked, and a log of
// every round. The picks themselves stay in the secret until the round ends.

import { MINUTE, parseBet } from './casino.js';
import { teamDay } from './coins.js';
import { secureRandom } from './rng.js';
import { coinsText } from './coinText.js';
import { speciesOf } from './pets.js';

export const GAME = 'battle';
export const LABEL = 'Pet battle';
export const ICON = '⚔️';
export const ROUNDS = 12;
export const ROUND_MS = 45000;
// A pick that comes in just after the round ran out still counts for it.
export const GRACE_MS = 3000;
export const EXPIRES = 10 * MINUTE; // to accept
export const DAY_LIMIT = 10; // battles a person can start in a team day
export const UNLOCK = [1, 1, 10, 25];
export const MAX_LEVEL = 100;
// Controls, Pet battles off (feature id petBattles): what the server and demo say.
export const FEATURE = 'petBattles';
export const OFF_NOTE = ['⚔️ Pet battles are off right now.', 'They’re switched off for the team for now.'];

// What each kind of move does. power: the hit's strength at level 1; acc:
// the chance it lands; daze: the chance a landed hit makes the other pet skip
// its next turn; block: the share of a hit a shield stops, and back: what the
// shield bounces back at whoever hit it; evade: the chance a dodge gets out
// of the way, and back: the quick hit back after a dodge; heal: the share of
// full health it gives back. rest: not two rounds in a row. The numbers are
// tuned so every kind is worth about the same (scripts/test-battles.mjs plays
// thousands of battles to check).
export const KINDS = {
  hit: { short: 'Attack', power: 14, acc: 0.95, tip: 'An attack' },
  strong: { short: 'Strong attack', power: 16, acc: 0.83, tip: 'A strong attack that misses more' },
  sure: { short: 'Sure hit', power: 13.5, acc: 1, tip: 'A light attack that never misses' },
  big: { short: 'Heavy attack', power: 19, acc: 0.68, tip: 'A heavy attack that often misses' },
  daze: { short: 'Daze', power: 11, acc: 0.9, daze: 0.45, tip: 'A light attack that can make them skip a turn' },
  guard: { short: 'Shield', block: 0.7, back: 7, rest: true, tip: 'A shield: blocks most of a hit and bounces some back' },
  dodge: { short: 'Dodge', evade: 0.7, back: 9, rest: true, tip: 'Likely dodges a hit, then hits back' },
  heal: { short: 'Heal', heal: 0.11, rest: true, tip: 'Gets back some health' },
};
export const CRIT = 1 / 16;
const CRIT_X = 1.5;

// [name, kind] for each kind of pet, in unlock order (UNLOCK). Our own
// names, themed on the animal and the robotics team. Every set has the same
// shape, so no pet is ahead at any level: an attack first, then a shield,
// dodge or heal, then a dazing or heavy attack, then another shield, dodge
// or heal.
export const MOVES = {
  cat: [
    ['Pounce', 'hit'],
    ['Land on Your Feet', 'dodge'],
    ['Laser Dot', 'daze'],
    ['Cat Nap', 'heal'],
  ],
  dog: [
    ['Fetch Dash', 'hit'],
    ['Plant Your Paws', 'guard'],
    ['Happy Bark', 'daze'],
    ['Belly Rub Break', 'heal'],
  ],
  bunny: [
    ['Hop Kick', 'sure'],
    ['Burrow Down', 'dodge'],
    ['Thump Alarm', 'daze'],
    ['Carrot Snack', 'heal'],
  ],
  fox: [
    ['Sly Swipe', 'strong'],
    ['Fade Into the Brush', 'dodge'],
    ['Ember Dash', 'big'],
    ['Bushy Tail Wrap', 'guard'],
  ],
  owl: [
    ['Talon Swoop', 'hit'],
    ['Night Watch', 'guard'],
    ['Silent Dive', 'big'],
    ['Fly Up High', 'dodge'],
  ],
  frog: [
    ['Tongue Flick', 'sure'],
    ['Lily Pad Leap', 'dodge'],
    ['Croak Chorus', 'daze'],
    ['Rain Soak', 'heal'],
  ],
  panda: [
    ['Bamboo Bonk', 'strong'],
    ['Fluffy Block', 'guard'],
    ['Panda Tumble', 'big'],
    ['Pit Crew Patch-Up', 'heal'],
  ],
  monkey: [
    ['Branch Swing', 'hit'],
    ['Mangrove Hide', 'dodge'],
    ['Big Nose Honk', 'daze'],
    ['Leaf Lunch', 'heal'],
  ],
  cassowary: [
    ['Raptor Kick', 'strong'],
    ['Jungle Sprint', 'dodge'],
    ['Thunder Stomp', 'big'],
    ['Casque Block', 'guard'],
  ],
  redpanda: [
    ['Fluff Swat', 'hit'],
    ['Treetop Nap', 'heal'],
    ['Stand Up Tall', 'daze'],
    ['Ringtail Wrap', 'guard'],
  ],
  hedgehog: [
    ['Quill Poke', 'sure'],
    ['Zip-Tie Spikes', 'guard'],
    ['Rolling Charge', 'big'],
    ['Snuffle Snack', 'heal'],
  ],
  chicken: [
    ['Beak Jab', 'hit'],
    ['Coop Dash', 'dodge'],
    ['Wing Flap Frenzy', 'daze'],
    ['Dust Bath', 'heal'],
  ],
  gem: [
    ['Prism Beam', 'hit'],
    ['Hard Facets', 'guard'],
    ['Sparkle', 'daze'],
    ['Sunlight Charge', 'heal'],
  ],
  goat: [
    ['Ram Bumper', 'strong'],
    ['Sure Footing', 'dodge'],
    ['Number 12 Charge', 'big'],
    ['Clover Munch', 'heal'],
  ],
  molerat: [
    ['Buck-Tooth Nibble', 'sure'],
    ['Dig Down', 'dodge'],
    ['Queen’s Orders', 'daze'],
    ['Colony Huddle', 'heal'],
  ],
  starmole: [
    ['Star Nose Boop', 'hit'],
    ['Deep Tunnel', 'guard'],
    ['Lightning Snout', 'daze'],
    ['Worm Feast', 'heal'],
  ],
  goldendoodle: [
    ['Doodle Dash', 'hit'],
    ['Fluffy Cloud', 'guard'],
    ['Puppy Eyes', 'daze'],
    ['Pupcake Break', 'heal'],
  ],
};
// A kind of pet added later, before it has moves of its own.
export const DEFAULT_MOVES = [
  ['Bonk', 'hit'],
  ['Duck and Cover', 'guard'],
  ['Silly Face', 'daze'],
  ['Snack Break', 'heal'],
];

const clampLevel = (level) => Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
// How much stronger a pet is than at level 1, in health and in its hits:
// about 1.14x at level 10, 1.24x at 50, 1.28x at 100. Slow on purpose, so
// a lower level can still win (its moves matter more than its level).
export const mult = (level) => 1 + 0.06 * Math.log(clampLevel(level));
export const maxHp = (level) => Math.round(100 * mult(level));

// A pet's four moves: [{ i, name, kind, level, ...KINDS[kind] }].
export function movesOf(species) {
  const list = MOVES[species] || DEFAULT_MOVES;
  return list.map(([name, kind], i) => ({ i, name, kind, level: UNLOCK[i], ...KINDS[kind] }));
}
// The moves this pet can use at this level.
export const unlockedMoves = (species, level) => movesOf(species).filter((m) => m.level <= clampLevel(level));
export const nextMove = (species, level) => movesOf(species).find((m) => m.level > clampLevel(level)) || null;

// What a move does, in a few words, at this level ("Attack · 18 power").
export function moveTip(m, level = 1) {
  if (m.power) {
    const p = Math.round(m.power * mult(level));
    const acc = m.acc < 1 ? ` · ${Math.round(m.acc * 100)}% to land` : ' · never misses';
    return `${KINDS[m.kind].tip} · ${p} power${acc}`;
  }
  return `${KINDS[m.kind].tip} · not twice in a row`;
}

const first = (n) => String(n || 'Someone').split(' ')[0];

// ---------- a battle's pets ----------

// The side of a pet in a battle, from its owner's pets: the parts everyone
// may see, fixed for the battle (its level is the level it had when it
// started), and its health.
export function sideOf(pet, level) {
  const lv = clampLevel(level);
  const max = maxHp(lv);
  return {
    born: Number(pet.adoptedAt) || 0,
    name: String(pet.name || 'Pet').slice(0, 24),
    species: String(pet.species || ''),
    level: lv,
    gear: pet.gear && typeof pet.gear === 'object' ? { ...pet.gear } : {},
    hp: max,
    max,
    last: -1, // the move it used last round (for "not twice in a row")
    skip: 0, // the round it sits out, dazed
    dazed: 0, // the last round it was dazed in (it can't be dazed again right away)
  };
}

// The moves a side can pick this round (indexes).
export function canPick(side, round) {
  if (side.skip === round) return [];
  return unlockedMoves(side.species, side.level)
    .filter((m) => !(m.rest && side.last === m.i))
    .map((m) => m.i);
}

// A move picked for someone who didn't pick in time: any move they can use.
export function autoPick(side, round, rng = secureRandom) {
  const list = canPick(side, round);
  return list.length ? list[Math.floor(rng() * list.length)] : -1;
}

// ---------- one round ----------

// Works out a round from the two picks (move indexes; -1 for a pet that
// sits it out). autos: { 0: true, 1: true } for picks made for them.
// Returns { a, b, log }: the two sides after it, and what happened (the
// round's log entry: one part per pet, and both health numbers after it).
// A part: { m, out, dmg?, crit?, dazes?, back?, healed?, auto? } where out
// is hit, blocked (hit through a shield), miss, dodged (the other pet got
// away), guard, dodge, heal or dazed (sat it out).
export function resolveRound(pa, pb, picks, round, rng = secureRandom, autos = {}) {
  const sides = [{ ...pa }, { ...pb }];
  const moves = sides.map((s, k) => (s.skip === round ? null : movesOf(s.species)[picks[k]] || null));
  const out = sides.map((s, k) => ({
    m: moves[k] ? moves[k].i : -1,
    ...(s.skip === round && { out: 'dazed' }),
    ...(autos[k] && moves[k] && { auto: true }),
  }));
  const vary = () => 0.85 + 0.3 * rng();
  // Shields, dodges and heals happen first; a heal never goes past full.
  moves.forEach((mv, k) => {
    if (!mv) return;
    if (mv.kind === 'guard') out[k].out = 'guard';
    if (mv.kind === 'dodge') out[k].out = 'dodge';
    if (mv.kind === 'heal') {
      const got = Math.min(sides[k].max - sides[k].hp, Math.round(sides[k].max * mv.heal));
      sides[k].hp += got;
      out[k].out = 'heal';
      out[k].healed = got;
    }
  });
  // Then the attacks, both at once: what each does is worked out from where
  // things stood before either landed.
  const damage = [0, 0];
  const dazes = [false, false];
  moves.forEach((mv, k) => {
    if (!mv?.power) return;
    const t = 1 - k;
    const def = moves[t];
    if (rng() >= mv.acc) {
      out[k].out = 'miss';
      return;
    }
    if (def?.kind === 'dodge' && rng() < def.evade) {
      out[k].out = 'dodged';
      const back = Math.max(1, Math.round(def.back * mult(sides[t].level) * vary()));
      damage[k] += back;
      out[t].back = back;
      return;
    }
    const crit = rng() < CRIT;
    let dmg = mv.power * mult(sides[k].level) * vary() * (crit ? CRIT_X : 1);
    if (def?.kind === 'guard') {
      dmg *= 1 - def.block;
      const back = Math.max(1, Math.round(def.back * mult(sides[t].level) * vary()));
      damage[k] += back;
      out[t].back = back;
    }
    dmg = Math.max(1, Math.round(dmg));
    damage[t] += dmg;
    out[k].out = def?.kind === 'guard' ? 'blocked' : 'hit';
    out[k].dmg = dmg;
    if (crit) out[k].crit = true;
    // A daze lands on a pet that wasn't dazed this round or the one before.
    if (mv.daze && round > (sides[t].dazed || -9) + 1 && rng() < mv.daze) {
      dazes[t] = true;
      out[k].dazes = true;
    }
  });
  sides.forEach((s, k) => {
    s.hp = Math.max(0, s.hp - damage[k]);
    s.last = moves[k] ? moves[k].i : -1;
    if (dazes[k]) {
      s.skip = round + 1;
      s.dazed = round + 1;
    }
  });
  return { a: sides[0], b: sides[1], log: { r: round, a: out[0], b: out[1], hp: [sides[0].hp, sides[1].hp] } };
}

// Who's ahead after the last round: 1 (a), -1 (b) or 0, by the share of full
// health left (whole-number math: hpA/maxA against hpB/maxB).
export function ahead(pa, pb) {
  const x = pa.hp * pb.max;
  const y = pb.hp * pa.max;
  return x > y ? 1 : x < y ? -1 : 0;
}

// ---------- the words ----------

// "@Ira Harrison 50" → { them, betWord, born, theirBorn, known }. The app's
// Battle button adds "mine:<born>" and "theirs:<born>" to pick the two pets
// (typed, it's each person's first pet).
export function parseWords(words, roster) {
  let born = null;
  let theirBorn = null;
  const rest = [];
  for (const w of words.map(String)) {
    const m = /^(mine|theirs):(\d{1,16})$/i.exec(w);
    if (m && m[1].toLowerCase() === 'mine' && born === null) born = Number(m[2]);
    else if (m && m[1].toLowerCase() === 'theirs' && theirBorn === null) theirBorn = Number(m[2]);
    else rest.push(w);
  }
  const betWord = rest.length > 1 && parseBet(rest[rest.length - 1], 1) != null ? rest.pop() : '';
  const text = rest.join(' ').replace(/@/g, '').trim().toLowerCase();
  if (!text) return { them: null, betWord, born, theirBorn };
  if (text === 'trotbot' || text === 'bot') return { them: 'Trotbot', betWord, born, theirBorn, known: true };
  const them =
    [...roster].sort((a, b) => b.length - a.length).find((n) => text.includes(n.toLowerCase())) ||
    roster.find((n) => n.toLowerCase().split(' ')[0] === text.split(' ')[0]) ||
    roster.find((n) => n.toLowerCase().startsWith(text)) ||
    null;
  return { them: them || text, betWord, born, theirBorn, known: !!them };
}
// The bet in the words, without the rest (0 when there's none): for the
// checks that come before a battle starts (Jackson coins off, a gambling
// buddy's lock, an overdue loan). null: a bet word that isn't one.
export function betIn(words, roster = [], balance = 0) {
  const { betWord } = parseWords(words, roster);
  if (!betWord) return 0;
  return parseBet(betWord, balance);
}
// Same, from the words alone (no roster): the last word, when it reads as an
// amount after a name. Used where the roster isn't at hand (buddy.js).
export const hasBet = (words = []) => {
  const list = (Array.isArray(words) ? words : []).map(String).filter((w) => !/^(mine|theirs):/i.test(w));
  if (list.length < 2) return false;
  const v = parseBet(list[list.length - 1], 1e100);
  return v != null && v > 0;
};

// ---------- starting ----------

const USAGE = 'Try: /battle @name, or /battle @name 20 for a bet.';
const entry = (label, shown) => ({ game: GAME, icon: ICON, label: `${LABEL} ${label}`, shown });

// ctx: { me, words, roster, balance, bank, now, peer, hasOpen, coinsOff }.
//   peer: the person asked, as the server found them: { name, balance, active,
//     pets: [{ pet, level }] } (each pet alive and with them, with its level now)
//   myPets: your pets the same way
//   coinsOff: Jackson coins are off (Controls): battles are just for fun then
// Returns { error } or { pub, secret, money, mentions, open }.
export function start({ me, words = [], roster = [], balance = 0, bank = {}, now = Date.now(), peer = null, myPets = [], hasOpen = false, coinsOff = false }) {
  const { them, betWord, born, theirBorn, known } = parseWords(words, roster);
  if (!them) return { error: `Battle who? ${USAGE}` };
  if (!known) return { error: `Who’s “${them}”? ${USAGE}` };
  if (them === me) return { error: 'Your pet can’t battle itself.' };
  if (them === 'Trotbot') return { error: 'Trotbot doesn’t have a pet. Battle a teammate’s pet.' };
  const bet = betWord ? parseBet(betWord, balance) : 0;
  if (bet == null || bet < 0) return { error: 'That’s not a bet.' };
  if (bet > 0 && coinsOff) return { error: 'Jackson coins are off right now, so battles are just for fun. Leave out the bet.' };
  if (bet > balance) return { error: `You only have ${coinsText(balance)} coins.` };
  if (!myPets.length) return { error: 'Adopt a pet first. Then it can battle.' };
  const mine = born === null ? myPets[0] : myPets.find((x) => Number(x.pet.adoptedAt) === born);
  if (!mine) return { error: 'That pet isn’t with you anymore.' };
  if (!peer || peer.name !== them || !peer.active) return { error: `${first(them)} isn’t on the team.` };
  const theirs = peer.pets || [];
  if (!theirs.length) return { error: `${first(them)} doesn’t have a pet right now.` };
  const other = theirBorn === null ? theirs[0] : theirs.find((x) => Number(x.pet.adoptedAt) === theirBorn);
  if (!other) return { error: `That pet isn’t with ${first(them)} anymore.` };
  if (bet > 0 && peer.balance < bet) return { error: `${first(them)} only has ${coinsText(peer.balance)} coins.` };
  if (hasOpen) return { error: 'You already have a battle waiting. Cancel it, or wait for an answer.' };
  const day = teamDay(now);
  const sent = bank.btDay?.day === day ? bank.btDay.n || 0 : 0;
  if (sent >= DAY_LIMIT) return { error: `That’s ${DAY_LIMIT} battles today. Try again tomorrow.` };
  const pub = {
    a: me,
    b: them,
    bet,
    at: now,
    lastAt: now,
    expiresAt: now + EXPIRES,
    status: 'open',
    n: 0,
    pa: sideOf(mine.pet, mine.level),
    pb: sideOf(other.pet, other.level),
    round: 0,
    roundEnds: 0,
    picked: [],
    log: [],
  };
  return {
    pub,
    secret: { picks: {} },
    money: [{ name: me, delta: bet ? -bet : 0, entry: null, extra: { btDay: { day, n: sent + 1 } } }],
    mentions: [them],
    open: true,
  };
}

// ---------- moves ----------

// The bets at the end. winner: a name, or '' for a draw.
export function settle(p, winner) {
  const bet = p.bet || 0;
  if (!bet) return [];
  if (!winner)
    return [
      { name: p.a, delta: bet, entry: entry(`with ${p.b}: draw, bet back`, 0) },
      { name: p.b, delta: bet, entry: entry(`with ${p.a}: draw, bet back`, 0) },
    ];
  const loser = winner === p.a ? p.b : p.a;
  return [
    { name: winner, delta: 2 * bet, entry: entry(`with ${loser}: won ${bet}`, bet) },
    { name: loser, delta: 0, entry: entry(`with ${winner}: lost ${bet}`, -bet) },
  ];
}

// What a finished battle means for each pet's record: { a, b } each 'w', 'l'
// or 'd'; null when it never got going (declined, cancelled, a pet gone).
export function recordOf(p) {
  if (p.status !== 'done' || !['ko', 'rounds', 'resigned'].includes(p.how)) return null;
  if (!p.winner) return { a: 'd', b: 'd' };
  return p.winner === p.a ? { a: 'w', b: 'l' } : { a: 'l', b: 'w' };
}

// A move on a battle card: accept, decline, cancel, a pick ('m0'…'m3'),
// resign, or peek (a timer ran out). ctx: { pub, secret, me, move, balance,
// now, rng, alive }. alive: { a, b }, whether each pet is still with its
// owner (the server checks; false ends the battle, bets back). Returns
// { error }, or { write, pub, secret, money, awards } like arcade.move.
export function move({ pub, secret = {}, me, move: mv, balance = 0, now = Date.now(), rng = secureRandom, alive = { a: true, b: true } }) {
  const p = { ...pub, pa: { ...pub.pa }, pb: { ...pub.pb }, picked: [...(pub.picked || [])], log: [...(pub.log || [])] };
  const s = { ...secret, picks: { ...(secret.picks || {}) } };
  const m = String(mv || '').slice(0, 40);
  const nothing = { write: false, pub, secret, money: [] };
  if (p.status !== 'open' && p.status !== 'playing') return nothing;
  const out = (money = []) => {
    p.n = (p.n || 0) + 1;
    p.lastAt = now;
    return { write: true, pub: p, secret: s, money, awards: [] };
  };
  const end = (winner, how, money) => {
    Object.assign(p, { status: 'done', winner: winner || '', how, roundEnds: 0 });
    s.picks = {};
    return out(money ?? settle(p, winner));
  };
  const held = p.status === 'playing' ? [p.a, p.b] : [p.a];
  const back = () => (p.bet ? held.map((n) => ({ name: n, delta: p.bet, entry: null })) : []);

  // A pet that died, or went to someone else, can't battle: bets back.
  if (alive.a === false || alive.b === false) return end('', 'gone', back());

  if (p.status === 'open') {
    if (m === 'peek') return now >= p.expiresAt ? end('', 'expired', back()) : nothing;
    if (m === 'cancel') return me === p.a ? end('', 'cancelled', back()) : { error: 'Only the person who sent it can cancel.' };
    if (me !== p.b) return { error: me === p.a ? `Waiting for ${first(p.b)} to accept.` : `This battle is for ${first(p.b)}.` };
    if (m === 'decline') return end('', 'declined', back());
    if (m !== 'accept') return { error: 'Accept the battle first.' };
    if (now >= p.expiresAt) return { error: 'That battle ran out of time.' };
    if (p.bet > balance) return { error: `It’s a ${coinsText(p.bet)} coin bet. You have ${coinsText(balance)}.` };
    Object.assign(p, { status: 'playing', round: 1, roundEnds: now + ROUND_MS, picked: [], startedAt: now });
    return out(p.bet ? [{ name: me, delta: -p.bet, entry: null }] : []);
  }

  // Playing.
  const sideKey = (n) => (n === p.a ? 'pa' : n === p.b ? 'pb' : '');
  // Rounds whose time ran out: whoever didn't pick gets a move picked for
  // them. Each later round has its own 45 s from where the last one ended,
  // so a battle left alone plays out (the house's peek finishes it).
  const finishRound = (timedOut) => {
    const autos = {};
    const picks = [p.a, p.b].map((n, k) => {
      const side = p[k ? 'pb' : 'pa'];
      if (side.skip === p.round) return -1;
      if (s.picks[n] !== undefined) return s.picks[n];
      autos[k] = true;
      return autoPick(side, p.round, rng);
    });
    const r = resolveRound(p.pa, p.pb, picks, p.round, rng, autos);
    p.pa = r.a;
    p.pb = r.b;
    p.log = [...p.log, r.log];
    s.picks = {};
    p.picked = [];
    if (p.pa.hp <= 0 || p.pb.hp <= 0) {
      const w = p.pa.hp > 0 ? p.a : p.pb.hp > 0 ? p.b : '';
      return { done: true, winner: w, how: 'ko' };
    }
    if (p.round >= ROUNDS) {
      const k = ahead(p.pa, p.pb);
      return { done: true, winner: k > 0 ? p.a : k < 0 ? p.b : '', how: 'rounds' };
    }
    p.round += 1;
    p.roundEnds = (timedOut ? p.roundEnds : now) + ROUND_MS;
    // A pet that sits this round out has its "pick" in already.
    p.picked = [p.a, p.b].filter((n, k) => p[k ? 'pb' : 'pa'].skip === p.round);
    return null;
  };
  // Every round that's out of time, in order. Returns an end or null.
  const catchUp = (until) => {
    let wrote = false;
    while (p.status === 'playing' && until >= p.roundEnds) {
      wrote = true;
      const r = finishRound(true);
      if (r) return { ended: end(r.winner, r.how) };
    }
    return { wrote };
  };
  // Both in (one may be sitting out): the round goes now.
  const bothIn = () => [p.a, p.b].every((n) => p.picked.includes(n));

  if (m === 'peek') {
    const c = catchUp(now - GRACE_MS);
    if (c.ended) return c.ended;
    return c.wrote ? out() : nothing;
  }
  const key = sideKey(me);
  if (!key) return { error: 'You’re not in this battle.' };
  if (m === 'resign') return end(me === p.a ? p.b : p.a, 'resigned');
  const pick = /^m([0-3])$/.exec(m);
  if (!pick) return { error: 'Pick a move.' };
  // A pick a moment late still counts for the round it was meant for.
  const c = catchUp(now - GRACE_MS);
  if (c.ended) return c.ended;
  if (p.picked.includes(me)) {
    if (c.wrote) return out();
    return { error: p[key].skip === p.round ? `${p[key].name} is dazed and sits this round out.` : 'You already picked. Waiting for the other move.' };
  }
  const i = Number(pick[1]);
  const side = p[key];
  if (!canPick(side, p.round).includes(i)) {
    const mv2 = movesOf(side.species)[i];
    if (!mv2 || mv2.level > side.level) return { error: 'Your pet hasn’t learned that move yet.' };
    return { error: `${side.name} needs a breather: not ${mv2.name} twice in a row.` };
  }
  s.picks[me] = i;
  p.picked = [...p.picked, me];
  if (bothIn()) {
    const r = finishRound(false);
    if (r) return end(r.winner, r.how);
  }
  return out();
}

// ---------- the words on the card ----------

// One line for one pet's part in a round: "Mochi used Pounce: 15 damage."
export function partLine(part, side, otherSide) {
  const name = side.name;
  if (part.out === 'dazed') return `${name} was dazed and sat this round out.`;
  const mv = movesOf(side.species)[part.m];
  if (!mv) return `${name} waited.`;
  const used = `${name} used ${mv.name}${part.auto ? ' (picked for them)' : ''}`;
  if (part.out === 'heal') return part.healed ? `${used} and got ${part.healed} health back.` : `${used}, already at full health.`;
  if (part.out === 'guard') return part.back ? `${used}: the shield bounced ${part.back} damage back.` : `${used} and put up a shield.`;
  if (part.out === 'dodge') return part.back ? `${used}, dodged and hit back for ${part.back}.` : `${used}, ready to dodge.`;
  if (part.out === 'miss') return `${used} and missed.`;
  if (part.out === 'dodged') return `${used}, but ${otherSide.name} dodged it.`;
  const crit = part.crit ? ' A great hit!' : '';
  const daze = part.dazes ? ` ${otherSide.name} is dazed.` : '';
  if (part.out === 'blocked') return `${used}: ${part.dmg} damage through the shield.${crit}${daze}`;
  return `${used}: ${part.dmg} damage.${crit}${daze}`;
}
export function roundLines(entryLog, pa, pb) {
  return [partLine(entryLog.a, pa, pb), partLine(entryLog.b, pb, pa)];
}

// How it ended, for the card ("Mochi wins!", "A draw: bets back.").
export function endLine(p) {
  if (p.status !== 'done') return '';
  const pet = (n) => (n === p.a ? p.pa : p.pb).name;
  // Bets that went back: the challenger's alone, or both once it had started.
  const back = p.bet ? (p.startedAt ? ' Bets back.' : ' Bet back.') : '';
  const text = {
    declined: `${first(p.b)} said no.`,
    cancelled: 'Cancelled.',
    expired: 'Nobody accepted in time.',
    gone: 'One of the pets isn’t here anymore, so the battle is off.',
  }[p.how];
  if (text) return `${text}${back}`;
  if (!p.winner) return `A draw${p.bet ? ': bets back' : ''}.`;
  const how = p.how === 'ko' ? '' : p.how === 'resigned' ? ' (the other side gave up)' : ' (more health left after 12 rounds)';
  return `${pet(p.winner)} wins${how}!`;
}

// ---------- records and the board ----------

// petBattles/{personId}: { person, pets: { [born]: { name, species, w, l, d } }, updatedAt }
// One pet's record after a battle (result 'w', 'l' or 'd').
export function recordAfter(doc, { person, side, result, now = Date.now() }) {
  const pets = { ...(doc?.pets || {}) };
  const k = String(side.born);
  const was = pets[k] || { w: 0, l: 0, d: 0 };
  pets[k] = { name: side.name, species: side.species, w: was.w || 0, l: was.l || 0, d: was.d || 0 };
  pets[k][result] += 1;
  return { person, pets, updatedAt: now };
}
// A pet's record from everyone's docs (owner under any old name), or null.
export function recordFor(docs, owner, born, rename = (n) => n) {
  let rec = null;
  for (const d of docs || []) {
    if (rename(d.person || '') !== owner) continue;
    const r = d.pets?.[String(born)];
    if (r) rec = rec ? { w: rec.w + (r.w || 0), l: rec.l + (r.l || 0), d: rec.d + (r.d || 0) } : { w: r.w || 0, l: r.l || 0, d: r.d || 0 };
  }
  return rec;
}
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// "3 wins · 1 loss", "1 win · 2 draws", or '' before the first battle.
export function recordLine(rec) {
  if (!rec || !(rec.w + rec.l + rec.d)) return '';
  return [count(rec.w, 'win', 'wins'), count(rec.l, 'loss', 'losses'), rec.d ? count(rec.d, 'draw', 'draws') : ''].filter(Boolean).join(' · ');
}
// The Battles board: one row per pet that has battled (and is still with its
// owner, when `alive(owner, born)` says so), most wins first, then the best
// share of wins, then fewer losses.
export function battleBoard(docs, { rename = (n) => n, alive = () => true } = {}) {
  const rows = new Map();
  for (const d of docs || []) {
    const owner = rename(d.person || '');
    if (!owner) continue;
    for (const [born, r] of Object.entries(d.pets || {})) {
      if (!alive(owner, Number(born))) continue;
      const k = `${owner}:${born}`;
      const was = rows.get(k) || { owner, born: Number(born), name: r.name, species: r.species, w: 0, l: 0, d: 0 };
      rows.set(k, { ...was, name: r.name || was.name, w: was.w + (r.w || 0), l: was.l + (r.l || 0), d: was.d + (r.d || 0) });
    }
  }
  const share = (r) => r.w / Math.max(1, r.w + r.l + r.d);
  return [...rows.values()]
    .filter((r) => r.w + r.l + r.d > 0)
    .sort((x, y) => y.w - x.w || share(y) - share(x) || x.l - y.l || x.owner.localeCompare(y.owner) || x.born - y.born);
}

// ---------- the species line on the pet's card ----------
export const speciesLabel = (id) => speciesOf(id)?.name || id;
