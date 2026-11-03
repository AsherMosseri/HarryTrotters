// /challenge: dare someone to the same coin flip or dice roll, head to head.
// No Firebase in here (like casino.js and arcade.js, which run it): the server's
// play function and demo mode both call start() and move().
//
// The challenger's bet is taken when the card is posted (escrow). The other
// person's is taken when they accept; then both results are rolled right here,
// in one step, and the winner gets both bets (2x, no house cut: the same as
// the duel, rock paper scissors and the other head-to-head games). A tie gives
// both bets back. Declined, cancelled and expired challenges give the
// challenger's bet back. Nothing is ever paid that wasn't bet.

import { MINUTE, parseBet } from './casino.js';
import { teamDay } from './coins.js';

export const KINDS = {
  coinflip: { label: 'Coin flip', icon: '🪙' },
  dice: { label: 'Dice', icon: '🎲' },
};
export const LABEL = 'Challenge';
export const MAX_BET = 500; // coins, each side
export const DAY_LIMIT = 10; // challenges a person can send in a team day
export const EXPIRES = 10 * MINUTE; // to accept
const MAX_REROLLS = 10; // dice ties are rolled again

const KIND_WORDS = { coinflip: 'coinflip', coin: 'coinflip', flip: 'coinflip', dice: 'dice', die: 'dice' };
const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

// "@Cooper Mlezcko coinflip 20 tails" -> { them, kind, call, betWord }. The
// words can come in any order after the name: game, bet, and heads/tails.
export function parseWords(words, roster) {
  let kind = '';
  let call = '';
  const rest = [];
  for (const w of words) {
    const k = KIND_WORDS[String(w).toLowerCase()];
    const c = /^(heads|tails)$/i.test(w) ? String(w).toLowerCase() : '';
    if (k && !kind) kind = k;
    else if (c && !call) call = c;
    else rest.push(w);
  }
  const betWord = rest.length && parseBet(rest[rest.length - 1], 1) != null ? rest.pop() : '';
  const text = rest.join(' ').replace(/@/g, '').trim().toLowerCase();
  if (!text) return { them: null, kind, call, betWord };
  if (text === 'trotbot' || text === 'bot') return { them: 'Trotbot', kind, call, betWord, known: true };
  const them =
    [...roster].sort((a, b) => b.length - a.length).find((n) => text.includes(n.toLowerCase())) ||
    roster.find((n) => n.toLowerCase().split(' ')[0] === text.split(' ')[0]) ||
    roster.find((n) => n.toLowerCase().startsWith(text)) ||
    null;
  return { them: them || text, kind, call, betWord, known: !!them };
}

const entry = (kind, label, shown) => ({ game: 'challenge', icon: KINDS[kind].icon, label: `${LABEL}: ${label}`, shown });

// ctx: { me, words, roster, balance, bank, now, peer, hasOpen }.
//   peer: the person asked, as the server found them: { name, balance, active }
//   hasOpen: this person already has a challenge waiting for an answer
// Returns { error } or { pub, secret, money, mentions, open }. `open`: the
// caller records where the card is (bank.chOpen) so hasOpen can be worked out.
export function start({ me, words = [], roster = [], balance = 0, bank = {}, now = Date.now(), peer = null, hasOpen = false }) {
  const { them, kind, call, betWord, known } = parseWords(words, roster);
  const usage = 'Try: /challenge @name coinflip 20 (or dice)';
  if (!them) return { error: `Challenge who? ${usage}` };
  if (!known) return { error: `Who’s “${them}”? ${usage}` };
  if (them === me) return { error: 'You can’t challenge yourself.' };
  if (them === 'Trotbot') return { error: 'Trotbot doesn’t take challenges. Play the house with /coinflip or /dice.' };
  if (!kind) return { error: `Coin flip or dice? ${usage}` };
  if (!betWord) return { error: `How much? ${usage}` };
  const bet = parseBet(betWord, balance);
  if (bet == null || bet < 1) return { error: 'That’s not a bet.' };
  if (bet > MAX_BET) return { error: `Challenges go up to ${MAX_BET} coins.` };
  if (bet > balance) return { error: `You only have ${balance} coins.` };
  if (!peer || peer.name !== them || !peer.active) return { error: `${them.split(' ')[0]} isn’t on the team.` };
  if (peer.balance < bet) return { error: `${them.split(' ')[0]} only has ${peer.balance} coins.` };
  if (hasOpen) return { error: 'You already have a challenge waiting. Cancel it, or wait for an answer.' };
  const day = teamDay(now);
  const sent = bank.chDay?.day === day ? bank.chDay.n || 0 : 0;
  if (sent >= DAY_LIMIT) return { error: `That’s ${DAY_LIMIT} challenges today. Try again tomorrow.` };
  const pub = {
    a: me,
    b: them,
    kind,
    ...(kind === 'coinflip' && { call: call || 'heads' }),
    bet,
    at: now,
    lastAt: now,
    expiresAt: now + EXPIRES,
    status: 'open',
  };
  return {
    pub,
    secret: {},
    money: [{ name: me, delta: -bet, entry: null, extra: { chDay: { day, n: sent + 1 } } }],
    mentions: [them],
    open: true,
  };
}

// Both results, rolled together. Returns { winner, rolls?, flip?, rerolls }.
export function roll(kind, p, rng = Math.random) {
  if (kind === 'coinflip') {
    const flip = rng() < 0.5 ? 'heads' : 'tails';
    return { winner: flip === p.call ? p.a : p.b, flip };
  }
  let rerolls = 0;
  for (;;) {
    const a = [rint(rng, 1, 6), rint(rng, 1, 6)];
    const b = [rint(rng, 1, 6), rint(rng, 1, 6)];
    const x = a[0] + a[1];
    const y = b[0] + b[1];
    if (x !== y) return { winner: x > y ? p.a : p.b, rolls: { a, b }, rerolls };
    // Rolled again until someone is ahead (after MAX_REROLLS it's a tie).
    if (++rerolls > MAX_REROLLS) return { winner: '', rolls: { a, b }, rerolls };
  }
}

// A move on a challenge card: accept, decline, cancel, or peek (the timer ran
// out). Returns { error }, or { write, pub, secret, money, awards } like arcade.move.
export function move({ pub, me, move: mv, balance = 0, now = Date.now(), rng = Math.random }) {
  const p = { ...pub };
  const m = String(mv || '').slice(0, 40);
  const nothing = { write: false, pub, secret: {}, money: [] };
  if (p.status !== 'open') return nothing;
  const back = [{ name: p.a, delta: p.bet, entry: null }];
  const end = (how, money, extra = {}) => {
    Object.assign(p, { status: 'done', winner: '', how, lastAt: now, ...extra });
    return { write: true, pub: p, secret: {}, money, awards: [] };
  };
  if (m === 'peek') return now >= p.expiresAt ? end('expired', back) : nothing;
  if (m === 'cancel') return me === p.a ? end('cancelled', back) : { error: 'Only the person who challenged can cancel.' };
  if (me !== p.b) return { error: me === p.a ? `Waiting for ${p.b.split(' ')[0]} to accept.` : `This challenge is for ${p.b}.` };
  if (m === 'decline') return end('declined', back);
  if (m !== 'accept') return { error: 'Accept the challenge first.' };
  if (now >= p.expiresAt) return { error: 'That challenge ran out of time.' };
  if (p.bet > balance) return { error: `It’s a ${p.bet} coin bet. You have ${balance}.` };
  const r = roll(p.kind, p, rng);
  const { winner, ...shown } = r;
  const bet = p.bet;
  // The challenger's bet is already in; the accepter's goes in now. The winner
  // ends up with both (2x); a tie gives each their own back.
  const money = !winner
    ? [
        { name: p.a, delta: bet, entry: null },
        { name: p.b, delta: 0, entry: null },
      ]
    : [
        winner === p.a
          ? { name: p.a, delta: 2 * bet, entry: entry(p.kind, `beat ${p.b} (won ${bet})`, bet) }
          : { name: p.a, delta: 0, entry: entry(p.kind, `lost to ${p.b} (lost ${bet})`, -bet) },
        winner === p.b
          ? { name: p.b, delta: bet, entry: entry(p.kind, `beat ${p.a} (won ${bet})`, bet) }
          : { name: p.b, delta: -bet, entry: entry(p.kind, `lost to ${p.a} (lost ${bet})`, -bet) },
      ];
  return end('rolled', money, { winner, ...shown });
}
