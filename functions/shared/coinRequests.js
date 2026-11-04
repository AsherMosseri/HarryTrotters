// /request @person amount [reason]: ask a teammate for Jackson coins.
// No Firebase in here (like challenge.js): the coinRequest function
// (functions/coinRequests.js) and demo mode both run these.
//
// A request only asks. Nothing moves until the person asked taps Pay, and
// then it moves exactly the way /give does: giftEntry (the same cap, the same
// balance check), written as a gift from them to you with your reason as the
// note, so both coin histories show it like a /give. The amount is the one
// saved when the request was made; Pay sends nothing but "pay". Declined,
// cancelled and expired requests move nothing.

import { GIFT_MAX, giftEntry } from './coins.js';
import { looksLikeAmount, parseAmount } from './amount.js';
import { GROUP_MAX, namesShort } from './groups.js';
import { coinsText } from './coinText.js';

export const EXPIRES = 24 * 3600000; // a request is open for a day
export const MAX_OPEN = 3; // requests one person can have waiting at once
export const DAY_LIMIT = 20; // requests one person can make in a team day (cancelled ones count)
export const REASON_MAX = 140; // the same as a gift's note
export const MOVES = ['pay', 'decline', 'cancel', 'peek'];
export const BOT = 'Trotbot';
const first = (n) => String(n || '').split(' ')[0];
// With commas (1,234 🪙): requests always show the exact amount.
export const coinText = (n) => `${coinsText(n)} 🪙`;

// What the card and notifications say: "asks Cooper for 25 🪙: for pizza".
export const askLine = (p) => `asks ${first(p.to)} for ${coinText(p.amount)}${p.reason ? `: ${p.reason}` : ''}`;

// A reason as it's saved: one line, trimmed, at most REASON_MAX characters.
export const cleanReason = (s) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, REASON_MAX);

// "@Cooper Mlezcko 25 for pizza" -> { them, known, amount, reason }. The
// first whole word that looks like a number is the amount; the words before it
// name the person and the words after it are the reason. amount is a number
// when the word is a whole amount ("25", "2k", "1,000"; amount.js), NaN when
// it looks like one but isn't ("2.5", "-3", "1.2345k"), null when there's
// none. ambiguous: names that fit a first
// name or the start of one ("@Ira" when there are two Iras).
export function parseAsk(text, roster = []) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const at = words.findIndex((w) => looksLikeAmount(w.replace(/🪙$/u, '')));
  const nameWords = at < 0 ? words : words.slice(0, at);
  const amountWord = at < 0 ? '' : words[at].replace('🪙', '');
  const amount = at < 0 ? null : (parseAmount(amountWord) ?? NaN);
  const reason = at < 0 ? '' : cleanReason(words.slice(at + 1).join(' '));
  const who = nameWords.join(' ').replace(/@/g, '').trim();
  const lower = who.toLowerCase();
  if (!lower) return { them: null, known: false, amount, reason };
  if (lower === 'trotbot' || lower === 'bot') return { them: BOT, known: true, amount, reason };
  const full = [...roster].sort((a, b) => b.length - a.length).find((n) => lower === n.toLowerCase() || lower.startsWith(`${n.toLowerCase()} `));
  if (full) return { them: full, known: true, amount, reason };
  const fits = roster.filter((n) => n.toLowerCase().split(' ')[0] === lower.split(' ')[0] || n.toLowerCase().startsWith(lower));
  if (fits.length > 1) return { them: who, known: false, ambiguous: fits, amount, reason };
  if (fits.length === 1) return { them: fits[0], known: true, amount, reason };
  return { them: who, known: false, amount, reason };
}

// A new request. ctx:
//   me, to: names (current spellings); amount: must be a number (not a string)
//   roster: the team's current names; active: `to` is a signed-in member, not
//   waiting to be let in or removed (the server looks it up, not the app)
//   open: my requests still waiting ({ to, expiresAt })
//   sentToday: how many I've made this team day
// Returns { error, body? } or { pub }: what the card and the request doc hold.
export function startAsk({ me, to, amount, reason = '', roster = [], active = false, open = [], sentToday = 0, now = Date.now() }) {
  const usage = 'Try: /request @Cooper 25 for pizza';
  if (!to) return { error: 'Ask who?', body: usage };
  if (String(to).toLowerCase() === BOT.toLowerCase()) return { error: 'Trotbot doesn’t carry coins.', body: 'Ask a teammate.' };
  if (to === me) return { error: 'That’s you.', body: 'Your coins are already yours.' };
  if (!roster.includes(to)) return { error: 'Who’s that?', body: usage };
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1)
    return { error: 'Ask for a whole number of coins, at least 1.', body: usage };
  if (amount > GIFT_MAX) return { error: 'That’s a lot.', body: `Up to ${coinsText(GIFT_MAX)} at a time, the same as /give.` };
  if (!active) return { error: `${first(to)} isn’t on the team.` };
  // open: one-person requests ({ to }) and group requests ({ people: the
  // ones still waiting on }), each counting as one toward MAX_OPEN.
  const waiting = open.filter((r) => (r.expiresAt || 0) > now);
  if (waiting.some((r) => r.to === to || (r.people || []).includes(to)))
    return { error: `You already asked ${first(to)}.`, body: 'Cancel that one first, or wait for an answer.' };
  if (waiting.length >= MAX_OPEN)
    return { error: `You have ${MAX_OPEN} requests waiting.`, body: 'Cancel one, or wait for answers.' };
  if (sentToday >= DAY_LIMIT) return { error: `That’s ${DAY_LIMIT} requests today.`, body: 'Try again tomorrow.' };
  return {
    pub: { from: me, to, amount, reason: cleanReason(reason), at: now, expiresAt: now + EXPIRES, status: 'open' },
  };
}

// A tap on a request card: pay, decline, cancel, or peek (its time ran out).
// pub: the request as the server saved it (names under current spellings);
// balance: the payer's coins (pay only); roster: the team's current names.
// Returns { error, body? } (nothing changes), { write: false } (nothing to do,
// also for a request that's already answered, so a second Pay is a no-op), or
// { write: true, pub, entry?, error? }: the new state, and for pay the gift to
// add to the ledger. A pay on a request that just ran out writes 'expired' and
// says so.
export function askMove({ pub, me, move, balance = 0, roster = [], now = Date.now() }) {
  const m = String(move || '');
  if (!MOVES.includes(m)) return { error: 'Unknown move.' };
  if (pub.status !== 'open') return { write: false, already: pub.status };
  const end = (status, extra = {}) => ({ write: true, pub: { ...pub, status, decidedAt: now, ...extra } });
  if (now >= pub.expiresAt) {
    const out = end('expired');
    return m === 'pay' ? { ...out, error: 'That request ran out of time.' } : out;
  }
  if (m === 'peek') return { write: false };
  if (m === 'cancel') return me === pub.from ? end('cancelled') : { error: `Only ${first(pub.from)} can cancel this.` };
  if (me !== pub.to)
    return { error: me === pub.from ? `Waiting for ${first(pub.to)}.` : `This request is for ${first(pub.to)}.` };
  if (m === 'decline') return end('declined');
  // Pay: a gift from the person asked to the person asking, checked like /give.
  const entry = giftEntry(me, { to: pub.from, amount: pub.amount, note: pub.reason }, { roster, balance, now });
  if (entry.error) return { error: entry.error, ...(entry.body && { body: entry.body }) };
  return { ...end('paid', { paidAt: now }), entry };
}

// ---------- group requests (/request @Programming 5 for pizza) ----------
// One request per person, each paid or declined on its own (the same askMove
// as above, for that person's own row), under one card. The group as a whole
// counts as ONE request toward MAX_OPEN and DAY_LIMIT. The server works out
// who's in the group (functions/groups.js); the app only says which groups
// and people were typed.

// "asks @Programming for 5 🪙 each: for pizza".
export const groupAskLine = (p) => `asks ${p.label} for ${coinText(p.amount)} each${p.reason ? `: ${p.reason}` : ''}`;

// Who to ask: the group's people, minus the ones I already have a request
// waiting with (open: as in startAsk). Returns { ask, skipped }.
export function skipAsked(people, open = [], now = Date.now()) {
  const waiting = open.filter((r) => (r.expiresAt || 0) > now);
  const asked = new Set(waiting.flatMap((r) => (r.people ? r.people : [r.to])));
  return { ask: people.filter((n) => !asked.has(n)), skipped: people.filter((n) => asked.has(n)) };
}

// A new group request. people: who it asks (the server's list, already
// without me, Trotbot, anyone off the team, and anyone skipped); label:
// "@Programming"; open, sentToday: as in startAsk.
// Returns { error, body? } or { pub }.
export function startGroupAsk({ me, people = [], label = '', amount, reason = '', open = [], sentToday = 0, now = Date.now() }) {
  const usage = `Try: /request ${label || '@Programming'} 5 for pizza`;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1)
    return { error: 'Ask for a whole number of coins each, at least 1.', body: usage };
  if (amount > GIFT_MAX) return { error: 'That’s a lot.', body: `Up to ${coinsText(GIFT_MAX)} each, the same as /give.` };
  if (people.some((n) => n === me || !n)) return { error: 'That’s you.', body: 'Your coins are already yours.' };
  if (!people.length) return { error: `Nobody in ${label || 'that group'} to ask.` };
  if (people.length > GROUP_MAX) return { error: `That’s ${people.length} people.`, body: `Up to ${GROUP_MAX} at a time.` };
  const waiting = open.filter((r) => (r.expiresAt || 0) > now);
  if (waiting.length >= MAX_OPEN) return { error: `You have ${MAX_OPEN} requests waiting.`, body: 'A group counts as one. Cancel one, or wait for answers.' };
  if (sentToday >= DAY_LIMIT) return { error: `That’s ${DAY_LIMIT} requests today.`, body: 'Try again tomorrow.' };
  return {
    pub: { from: me, amount, reason: cleanReason(reason), label, people: [...people], at: now, expiresAt: now + EXPIRES, status: 'open' },
  };
}

// What the asker is told after a group request: "Asked 4 people for 5 🪙
// each." and who was left out ("Mia already has one from you").
export function groupReply({ asked = [], skipped = [], unseen = [], amount = 0 }) {
  const n = asked.length;
  const title = `Asked ${n} ${n === 1 ? 'person' : 'people'} for ${coinText(amount)}${n === 1 ? '' : ' each'}.`;
  const has = (list) => (list.length === 1 ? 'has' : 'have');
  const body = [
    skipped.length ? `${namesShort(skipped)} already ${has(skipped)} one from you.` : '',
    unseen.length ? `${namesShort(unseen)} can’t see this channel, so ${unseen.length === 1 ? 'wasn’t' : 'weren’t'} asked.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { title, body };
}

// A group card's rows ({ r0: { to, status, paidAt? }, … }) counted up.
export function groupTally(rows = {}) {
  const list = Object.values(rows || {});
  const n = (s) => list.filter((r) => r.status === s).length;
  return { total: list.length, paid: n('paid'), declined: n('declined'), open: n('open'), cancelled: n('cancelled'), expired: n('expired') };
}
