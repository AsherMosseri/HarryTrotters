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

export const EXPIRES = 24 * 3600000; // a request is open for a day
export const MAX_OPEN = 3; // requests one person can have waiting at once
export const DAY_LIMIT = 20; // requests one person can make in a team day (cancelled ones count)
export const REASON_MAX = 140; // the same as a gift's note
export const MOVES = ['pay', 'decline', 'cancel', 'peek'];
export const BOT = 'Trotbot';
const first = (n) => String(n || '').split(' ')[0];
export const coinText = (n) => `${n} 🪙`;

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
// when the word is a whole number, NaN when it looks like one but isn't
// ("2.5", "-3"), null when there's none. ambiguous: names that fit a first
// name or the start of one ("@Ira" when there are two Iras).
export function parseAsk(text, roster = []) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const at = words.findIndex((w) => /^[-+]?\d+(\.\d*)?(?:🪙)?$/u.test(w) || /^[-+]?\.\d+$/.test(w));
  const nameWords = at < 0 ? words : words.slice(0, at);
  const amountWord = at < 0 ? '' : words[at].replace('🪙', '');
  const amount = at < 0 ? null : /^\d+$/.test(amountWord) ? Number(amountWord) : NaN;
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
  if (amount > GIFT_MAX) return { error: 'That’s a lot.', body: `Up to ${GIFT_MAX} at a time, the same as /give.` };
  if (!active) return { error: `${first(to)} isn’t on the team.` };
  const waiting = open.filter((r) => (r.expiresAt || 0) > now);
  if (waiting.some((r) => r.to === to))
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
