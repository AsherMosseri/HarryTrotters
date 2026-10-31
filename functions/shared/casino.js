// The Jackson coins casino and economy: every game's rules, odds, and
// payouts, with no Firebase in here. The server (functions/index.js play)
// runs these with the real balances and keeps the hidden parts (decks, mine
// spots, crash points) where phones can't read them; demo mode runs the same
// code locally. A game returns { pub, secret, done, payout }: pub goes on the
// chat message, payout is everything paid back (0 = lost the bet, bet = push).

export const TICKET = 5; // lottery ticket price
export const MINUTE = 60000;
export const COOLDOWN = { work: 60 * MINUTE, beg: 15 * MINUTE, rob: 3 * 60 * MINUTE };
export const CASINO = ['slots', 'dice', 'coinflip', 'roulette', 'blackjack', 'crash', 'mines', 'highlow', 'lottery'];
export const ECONOMY = ['daily', 'work', 'beg', 'rob'];
// Commands only the server may post (the rules refuse them from phones).
export const SERVER_COMMANDS = [
  ...CASINO,
  ...ECONOMY,
  'rps',
  'tictactoe',
  'connect4',
  'duel',
  'trivia',
  'hangman',
  'typerace',
  'heist',
  'battleship',
  'tetris',
  'minesweep',
];

const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pickOf = (rng, list) => list[Math.floor(rng() * list.length)];

// "50", "all", "half", "25%" → a whole number of coins (null if it isn't one).
export function parseBet(word, balance) {
  const w = String(word || '')
    .trim()
    .toLowerCase();
  if (!w) return null;
  if (w === 'all' || w === 'max') return Math.floor(balance);
  if (w === 'half') return Math.floor(balance / 2);
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(w);
  if (pct) return Math.floor((balance * Math.min(100, +pct[1])) / 100);
  return /^\d+$/.test(w) ? +w : null;
}

// ---------- one-shot games ----------

export const SLOT_SYMBOLS = [
  ['🔩', 30, 4],
  ['⚙️', 25, 6],
  ['🔋', 20, 10],
  ['🔧', 12, 20],
  ['🤖', 8, 40],
  ['🏆', 4, 100],
  ['💎', 1, 500],
];
const SLOT_WEIGHT = SLOT_SYMBOLS.reduce((t, s) => t + s[1], 0);
const spinReel = (rng) => {
  let r = rng() * SLOT_WEIGHT;
  for (const [sym, w] of SLOT_SYMBOLS) if ((r -= w) < 0) return sym;
  return SLOT_SYMBOLS[0][0];
};
// Three of a kind pays the table; any pair pays 1.25×. About 95% back over time.
export function slotsPay(reels, bet) {
  const [a, b, c] = reels;
  if (a === b && b === c) return { payout: bet * SLOT_SYMBOLS.find((s) => s[0] === a)[2], line: `Three ${a}!` };
  if (a === b || b === c || a === c) return { payout: Math.floor(bet * 1.25), line: 'A pair.' };
  return { payout: 0, line: 'Nothing.' };
}

const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const rouletteColor = (n) => (n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black');
// What you bet on: red, black, green, even, odd, low (1–18), high (19–36), or a number.
export function parseRouletteBet(word) {
  const w = String(word || '').toLowerCase();
  if (['red', 'black', 'green', 'even', 'odd', 'low', 'high'].includes(w)) return w;
  if (/^\d+$/.test(w) && +w >= 0 && +w <= 36) return String(+w);
  return null;
}
export function roulettePay(spot, n, bet) {
  const color = rouletteColor(n);
  const win =
    (spot === 'red' && color === 'red') ||
    (spot === 'black' && color === 'black') ||
    (spot === 'even' && n && n % 2 === 0) ||
    (spot === 'odd' && n % 2 === 1) ||
    (spot === 'low' && n >= 1 && n <= 18) ||
    (spot === 'high' && n >= 19);
  if (win) return bet * 2;
  if (spot === 'green' && n === 0) return bet * 36;
  if (/^\d+$/.test(spot) && +spot === n) return bet * 36;
  return 0;
}

// ---------- cards ----------

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export function newDeck(rng) {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(`${r}${s}`);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
const rankOf = (card) => card.slice(0, -1);
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = rankOf(c);
    if (r === 'A') {
      aces++;
      total += 11;
    } else total += ['J', 'Q', 'K'].includes(r) ? 10 : +r;
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return total;
}
const blackjack = (cards) => cards.length === 2 && handValue(cards) === 21;

// ---------- crash ----------
// The multiplier grows e^(0.07 t): 2× at about 10 s, 10× at 33 s. The crash
// point is secret; P(it reaches x) = 0.97 / x, so about 3% back to the house.
export const CRASH_RATE = 0.07;
export const crashMultiplier = (ms) => Math.floor(Math.exp((CRASH_RATE * ms) / 1000) * 100) / 100;
export const crashTimeFor = (point) => (Math.log(point) / CRASH_RATE) * 1000;
export function crashPoint(rng) {
  const u = rng();
  return Math.max(1, Math.min(100, Math.floor((0.97 / (1 - u)) * 100) / 100));
}

// ---------- mines ----------
export const MINES_TILES = 25;
export function minesMultiplier(bombs, safe) {
  let m = 0.97;
  for (let i = 0; i < safe; i++) m *= (MINES_TILES - i) / (MINES_TILES - bombs - i);
  return Math.floor(m * 100) / 100;
}

// ---------- high-low ----------
// Cards 1–13 (A–K). Equal counts as a loss, so each right guess pays
// 0.97 / (chance you'd be right).
export const HL_NAMES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const hlChance = (card, guess) => (guess === 'higher' ? 13 - card : card - 1) / 13;
export const hlStep = (card, guess) => Math.floor((0.97 / hlChance(card, guess)) * 100) / 100;

// ---------- starting a game ----------
// args: the words after the bet. Returns { error } or { pub, secret, done, payout }.
export function startGame(game, bet, args, rng = Math.random, now = Date.now()) {
  switch (game) {
    case 'slots': {
      const reels = [spinReel(rng), spinReel(rng), spinReel(rng)];
      const { payout, line } = slotsPay(reels, bet);
      return { pub: { reels, line }, done: true, payout };
    }
    case 'dice': {
      const you = [rint(rng, 1, 6), rint(rng, 1, 6)];
      const house = [rint(rng, 1, 6), rint(rng, 1, 6)];
      const a = you[0] + you[1];
      const b = house[0] + house[1];
      return { pub: { you, house }, done: true, payout: a > b ? bet * 2 : a === b ? bet : 0 };
    }
    case 'coinflip': {
      const call = /^t/i.test(args[0] || '') ? 'tails' : 'heads';
      const r = rng();
      const side = r < 0.005 ? 'edge' : r < 0.5025 ? 'heads' : 'tails';
      return { pub: { call, side }, done: true, payout: side === call ? bet * 2 : 0 };
    }
    case 'roulette': {
      const spot = parseRouletteBet(args[0]);
      if (!spot) return { error: 'Bet on red, black, green, even, odd, low, high, or a number 0–36. Try: /roulette 20 red' };
      const n = rint(rng, 0, 36);
      return { pub: { spot, n, color: rouletteColor(n) }, done: true, payout: roulettePay(spot, n, bet) };
    }
    case 'blackjack': {
      const deck = newDeck(rng);
      const you = [deck.pop(), deck.pop()];
      const dealer = [deck.pop(), deck.pop()];
      const pub = { you, dealer: [dealer[0]], bet, doubled: false };
      const secret = { deck, dealer };
      if (blackjack(you) || blackjack(dealer)) return finishBlackjack(pub, secret, bet);
      return { pub: { ...pub, status: 'playing' }, secret, done: false, payout: 0 };
    }
    case 'crash': {
      const point = crashPoint(rng);
      return { pub: { status: 'playing', startedAt: now }, secret: { point, crashAt: now + crashTimeFor(point) }, done: false, payout: 0 };
    }
    case 'mines': {
      const bombs = Math.min(20, Math.max(1, Math.round(+(args[0] || 3)) || 3));
      const spots = [];
      while (spots.length < bombs) {
        const s = rint(rng, 0, MINES_TILES - 1);
        if (!spots.includes(s)) spots.push(s);
      }
      return { pub: { status: 'playing', bombs, open: [], multiplier: 1 }, secret: { spots }, done: false, payout: 0 };
    }
    case 'highlow': {
      return { pub: { status: 'playing', card: rint(rng, 1, 13), history: [], multiplier: 1 }, secret: {}, done: false, payout: 0 };
    }
    default:
      return { error: 'Unknown game.' };
  }
}

function finishBlackjack(pub, secret, bet) {
  const deck = [...secret.deck];
  const dealer = [...secret.dealer];
  const you = pub.you;
  const yours = handValue(you);
  let status;
  let payout;
  if (yours > 21) {
    status = 'bust';
    payout = 0;
  } else if (blackjack(you) && !blackjack(dealer)) {
    status = 'blackjack';
    payout = Math.floor(bet * 2.5);
  } else {
    // The dealer draws to 17 (stands on every 17).
    if (!blackjack(you)) while (handValue(dealer) < 17) dealer.push(deck.pop());
    const theirs = handValue(dealer);
    if (blackjack(dealer) && !blackjack(you)) [status, payout] = ['lost', 0];
    else if (theirs > 21 || yours > theirs) [status, payout] = ['won', bet * 2];
    else if (yours === theirs) [status, payout] = ['push', bet];
    else [status, payout] = ['lost', 0];
  }
  return { pub: { ...pub, dealer, status }, secret: { deck, dealer }, done: true, payout };
}

// A game left alone this long is finished for the player (the server's
// settleGames): blackjack stands, mines and high-low cash out what they've
// won (or give the bet back if nothing was played), crash has crashed.
export const ABANDONED = 30 * MINUTE;
export function abandonMove(game, pub) {
  if (game === 'blackjack') return 'stand';
  if (game === 'crash') return 'peek';
  if (game === 'mines') return pub.open?.length ? 'cashout' : 'refund';
  if (game === 'highlow') return pub.history?.length ? 'cashout' : 'refund';
  return null;
}

// ---------- moves ----------
// Returns { error } or { pub, secret, done, payout, extraBet }.
export function moveGame(game, pub, secret, move, bet, now = Date.now(), rng = Math.random) {
  if (pub.status !== 'playing') return { error: 'That game is over.' };
  switch (game) {
    case 'blackjack': {
      if (move === 'hit' || move === 'double') {
        if (move === 'double' && (pub.you.length !== 2 || pub.doubled)) return { error: 'You can only double on your first two cards.' };
        const deck = [...secret.deck];
        const you = [...pub.you, deck.pop()];
        const total = move === 'double' ? bet * 2 : bet;
        const next = { ...pub, you, doubled: move === 'double' || pub.doubled, bet: total };
        if (move === 'double' || handValue(you) >= 21)
          return { ...finishBlackjack(next, { ...secret, deck }, total), extraBet: move === 'double' ? bet : 0 };
        return { pub: next, secret: { ...secret, deck }, done: false, payout: 0 };
      }
      if (move === 'stand') return finishBlackjack(pub, secret, pub.bet || bet);
      return { error: 'Hit, stand, or double.' };
    }
    case 'crash': {
      const elapsed = now - pub.startedAt;
      if (now >= secret.crashAt) return { pub: { ...pub, status: 'crashed', at: secret.point }, secret, done: true, payout: 0 };
      if (move === 'peek') return { pub, secret, done: false, payout: 0 };
      if (move !== 'cashout') return { error: 'Cash out, or wait.' };
      const m = Math.max(1, crashMultiplier(elapsed));
      return { pub: { ...pub, status: 'cashed', at: m, point: secret.point }, secret, done: true, payout: Math.floor(bet * m) };
    }
    case 'mines': {
      if (move === 'refund' && !pub.open.length) return { pub: { ...pub, status: 'refunded', spots: secret.spots }, secret, done: true, payout: bet };
      if (move === 'cashout') {
        if (!pub.open.length) return { error: 'Open at least one tile first.' };
        return {
          pub: { ...pub, status: 'cashed', spots: secret.spots },
          secret,
          done: true,
          payout: Math.floor(bet * pub.multiplier),
        };
      }
      const tile = +move;
      if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TILES || pub.open.includes(tile)) return { error: 'Pick a closed tile.' };
      if (secret.spots.includes(tile))
        return { pub: { ...pub, status: 'boom', hit: tile, spots: secret.spots }, secret, done: true, payout: 0 };
      const open = [...pub.open, tile];
      const multiplier = minesMultiplier(pub.bombs, open.length);
      if (open.length === MINES_TILES - pub.bombs)
        return {
          pub: { ...pub, open, multiplier, status: 'cashed', spots: secret.spots },
          secret,
          done: true,
          payout: Math.floor(bet * multiplier),
        };
      return { pub: { ...pub, open, multiplier }, secret, done: false, payout: 0 };
    }
    case 'highlow': {
      if (move === 'refund' && !pub.history.length) return { pub: { ...pub, status: 'refunded' }, secret, done: true, payout: bet };
      if (move === 'cashout') {
        if (!pub.history.length) return { error: 'Make at least one guess first.' };
        return { pub: { ...pub, status: 'cashed' }, secret, done: true, payout: Math.floor(bet * pub.multiplier) };
      }
      if (move !== 'higher' && move !== 'lower') return { error: 'Higher, lower, or cash out.' };
      if (!hlChance(pub.card, move)) return { error: `Nothing is ${move} than ${HL_NAMES[pub.card]}.` };
      const next = rint(rng, 1, 13);
      const right = move === 'higher' ? next > pub.card : next < pub.card;
      const history = [...pub.history, { from: pub.card, guess: move, to: next, right }];
      if (!right) return { pub: { ...pub, card: next, history, status: 'lost' }, secret, done: true, payout: 0 };
      const multiplier = Math.floor(pub.multiplier * hlStep(pub.card, move) * 100) / 100;
      return { pub: { ...pub, card: next, history, multiplier }, secret, done: false, payout: 0 };
    }
    default:
      return { error: 'That game doesn’t take moves.' };
  }
}

// ---------- economy ----------
// bank: the person's bank doc. day / yesterday: day keys (YYYY-MM-DD) in the
// team's time zone. Each returns { error } or { amount, card, bank } (the
// fields to change on the bank doc).

export const JOBS = [
  ['🔩', 'sorted the screw bin by size', 'Mostly by vibes.'],
  ['🧹', 'swept up metal shavings', 'Found three hex keys and a sandwich.'],
  ['🔋', 'charged every battery', 'They all said 13.2 V. Two were lying.'],
  ['📓', 'wrote a page of the engineering notebook', 'The judges will love the doodles.'],
  ['🧵', 'zip-tied the wiring', 'It looks like art now. Abstract art.'],
  ['🪛', 'tightened every set screw', 'Twice. You’re welcome, future you.'],
  ['💻', 'fixed a bug in the autonomous', 'And added two new ones.'],
  ['🧮', 'did the gear ratio math', 'It’s 3:1. It’s always 3:1.'],
  ['🎨', 'repainted the team logo', 'The cat is now slightly more cat.'],
  ['🏟️', 'reset the practice field', 'Nobody thanked you. Trotbot does. Thanks.'],
  ['📦', 'unpacked the parts order', 'It was mostly bubble wrap. You popped it.'],
  ['🤝', 'scouted another team', 'Their robot has wheels. Noted.'],
  ['🖨️', 'babysat the 3D printer for 4 hours', 'It made a spaghetti. A plastic one.'],
  ['📸', 'took robot photos for social media', 'The robot has a good side.'],
  ['🧽', 'cleaned the drive wheels', 'They were 40% carpet fuzz.'],
];
const DONORS = [
  ['Coach', 'tossed you', 'Don’t tell anyone.'],
  ['a mentor', 'gave you', 'Now go do something.'],
  ['the robot', 'beeped and dropped', 'It doesn’t know what money is.'],
  ['a parent volunteer', 'handed you', 'Along with a granola bar.'],
  ['a judge', 'slipped you', 'This is not how judging works.'],
  ['someone from another team', 'shared', 'Gracious professionalism!'],
];
const RUDE = [
  'Coach said “earn it.”',
  'The robot ignored you. Rude.',
  'A mentor gave you a hex key instead. Not coins.',
  'You begged so hard the Control Hub disconnected.',
  'Nobody had cash. Everyone had excuses.',
  'Someone said “maybe later” and walked into the pit.',
];

const cooldownLeft = (bank, what, now) => Math.max(0, (bank.cooldowns?.[what] || 0) + COOLDOWN[what] - now);
export const minutesText = (ms) => {
  const m = Math.ceil(ms / MINUTE);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

export function daily(bank, day, yesterday) {
  if (bank.daily?.day === day) return { error: `You already got today’s coins. Come back tomorrow (streak: ${bank.daily.streak} 🔥).` };
  const streak = bank.daily?.day === yesterday ? (bank.daily.streak || 0) + 1 : 1;
  const amount = 15 + 3 * Math.min(streak - 1, 10);
  return { amount, card: { amount, streak }, bank: { daily: { day, streak } } };
}

// /work pays only while you're clocked in at the lab, for one of your real
// open tasks (or a lab chore if you don't have any).
export function work(bank, now, rng = Math.random, { onShift = false, tasks = [] } = {}) {
  if (!onShift) return { error: 'Clock in at the lab first. /work only pays while you’re on a shift (try /shift).' };
  const left = cooldownLeft(bank, 'work', now);
  if (left) return { error: `You’re tired. Work again in ${minutesText(left)}.` };
  const task = tasks.length ? pickOf(rng, tasks) : '';
  const [icon, job, joke] = task ? ['🛠️', `worked on “${task}”`, 'Real work, real coins.'] : pickOf(rng, JOBS);
  const amount = rint(rng, 10, 30);
  return { amount, card: { amount, icon, job, joke }, bank: { cooldowns: { ...bank.cooldowns, work: now } } };
}

export function beg(bank, now, rng = Math.random) {
  const left = cooldownLeft(bank, 'beg', now);
  if (left) return { error: `Have some dignity. Beg again in ${minutesText(left)}.` };
  const set = { cooldowns: { ...bank.cooldowns, beg: now } };
  if (rng() < 0.45) return { amount: 0, card: { amount: 0, rude: pickOf(rng, RUDE) }, bank: set };
  const [who, verb, joke] = pickOf(rng, DONORS);
  const amount = rint(rng, 1, 8);
  return { amount, card: { amount, who, verb, joke }, bank: set };
}

// Robbing: 35% chance. Success takes 10–25% of their coins (up to 100);
// failure fines you 10–20% of yours (5 to 60), paid to them.
export function rob(bank, myBalance, theirBalance, now, rng = Math.random) {
  const left = cooldownLeft(bank, 'rob', now);
  if (left) return { error: `The lab is watching you. Try again in ${minutesText(left)}.` };
  if (myBalance < 20) return { error: 'You need at least 20 coins to try (in case you get caught).' };
  if (theirBalance < 30) return { error: 'They have less than 30 coins. Not worth it.' };
  const set = { cooldowns: { ...bank.cooldowns, rob: now } };
  if (rng() < 0.35) {
    const amount = Math.min(100, Math.max(1, Math.floor(theirBalance * (0.1 + rng() * 0.15))));
    return { amount, theirs: -amount, card: { ok: true, amount }, bank: set };
  }
  const fine = Math.min(60, Math.max(5, Math.floor(myBalance * (0.1 + rng() * 0.1))));
  return { amount: -fine, theirs: fine, card: { ok: false, amount: fine }, bank: set };
}

// A bank doc after a change: net moves by delta; entry (optional) goes in the
// history and stats, showing entry.shown if given (a game that took its bet
// at the start shows its overall result at the end). 15 latest kept.
export function bankAfter(bank, name, delta, entry, extra = {}, now = Date.now()) {
  const shown = entry?.shown ?? delta;
  const stats = { ...(bank.stats || {}) };
  if (entry?.game) {
    stats.played = (stats.played || 0) + 1;
    if (shown > 0) stats.won = (stats.won || 0) + shown;
    if (shown < 0) stats.lost = (stats.lost || 0) - shown;
    stats.best = Math.max(stats.best || 0, shown);
    // Per game, for the house's numbers on Asher's Commands page.
    const g = { ...(stats.games?.[entry.game] || {}) };
    g.played = (g.played || 0) + 1;
    if (shown > 0) g.won = (g.won || 0) + shown;
    if (shown < 0) g.lost = (g.lost || 0) - shown;
    stats.games = { ...(stats.games || {}), [entry.game]: g };
  }
  const recent =
    entry && shown
      ? [{ at: now, amount: shown, icon: entry.icon, label: entry.label }, ...(bank.recent || [])].slice(0, 15)
      : bank.recent || [];
  return { ...bank, ...extra, name, net: (bank.net || 0) + delta, stats, recent, since: bank.since || now };
}

// What /lottery tells you when the round's card is already open: the
// tickets went on that card. `go` offers a jump when it's in another channel.
export function lotteryNote(bought, mine, pot, openConv, conv) {
  const tickets = `${mine} ticket${mine === 1 ? '' : 's'}`;
  return {
    title: bought ? `🎟️ Bought ${bought} ticket${bought > 1 ? 's' : ''}` : '🎟️ The lottery is already open',
    body: `You have ${tickets} in. Pot: ${pot} coins.${openConv === conv ? ' The lottery card is higher up in this channel.' : ` The lottery card is in #${openConv}.`}`,
    ...(openConv !== conv && { go: openConv }),
  };
}
