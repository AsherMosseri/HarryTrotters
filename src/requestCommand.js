// /request: ask for anything the app takes requests for, from one command.
//   /request                  a picker: Feature idea, Channel, Pet, Style, Coins
//   /request <idea>           a feature request (the 💡 list), plus a card in chat
//   /request channel [name]   the Request a channel form, name filled in
//   /request pet [animal]     the Request a pet form, animal filled in
//   /request style [what]     the style request form (Edit profile), filled in
//   /request @person 25 why   ask a teammate for Jackson coins (the server
//                             posts the card; functions/coinRequests.js)
//   /request @Programming 5 why   the same of each person in a group (or
//                             @everyone): one card, a request per person
// commands.js runs it; the forms are components/RequestForms.jsx.

import { parseAsk } from '../functions/shared/coinRequests.js';
import { GIFT_MAX } from '../functions/shared/coins.js';
import { coinsText } from '../functions/shared/coinText.js';
import { SUBTEAMS } from '../functions/shared/team.js';
import { groupTargets } from './groups.js';

export const ASK_KEYWORDS = [
  ['channel', 'Ask for a new channel'],
  ['pet', 'Ask for an animal you don’t see'],
  ['style', 'Ask for a font, effect, decoration…'],
];
// Words that pick a form (and what they open).
const FORMS = { channel: 'channel', channels: 'channel', pet: 'pet', pets: 'pet', style: 'style', styles: 'style', idea: 'idea', feature: 'idea', coins: 'coins', coin: 'coins', money: 'coins' };
export const IDEA_MAX = 2000;

// Coins, when it starts with @someone, or with a teammate's name and then a number.
function looksLikeCoins(text, roster) {
  if (/^@/.test(text)) return true;
  const p = parseAsk(text, roster);
  if (!p.known || p.amount === null) return false;
  const before = text.split(/\s+/).findIndex((w) => /^[-+]?\d/.test(w));
  return before > 0 && before <= 3;
}

// What a /request turns into (the same shapes as runCommand's answers, plus
// { ask: { form, text } } to open one of the forms).
export async function runRequest(args, ctx, { card }) {
  const isOn = ctx.isOn || (() => true);
  const text = args.trim();
  const note = (title, body = '') => ({ note: { title, body } });
  if (!text) return { ask: { form: 'picker' } };
  const [word, ...more] = text.split(/\s+/);
  const rest = more.join(' ');
  const form = FORMS[word.toLowerCase()];
  if (form === 'channel') return isOn('channelRequests') ? { ask: { form, text: rest } } : note('Channel requests are off right now.');
  if (form === 'pet' || form === 'style') return isOn('requests') ? { ask: { form, text: rest } } : note('Requests are off right now.');
  if (form === 'coins') return rest ? coins(rest, ctx) : isOn('coins') ? { ask: { form } } : note('🪙 Jackson coins are off right now.');
  if (form === 'idea' && !rest) return { ask: { form } };
  if (form !== 'idea' && looksLikeCoins(text, ctx.roster || [])) return coins(text, ctx);
  return idea(form === 'idea' ? rest : text, ctx, { card, isOn, note });
}

// A feature request: the same one the 💡 button sends, and a card that links to it.
async function idea(text, ctx, { card, isOn, note }) {
  if (!isOn('requests')) return note('Feature requests are off right now.');
  const t = text.slice(0, IDEA_MAX);
  const id = await ctx.addIdea(t);
  if (!id) return { done: true };
  return card({ kind: 'idea', id: typeof id === 'string' ? id : '', text: t.slice(0, 300) });
}

// Coins: who, how much and why. The server checks it all again and posts the card.
export async function coins(text, ctx) {
  const usage = 'Try: /request @Cooper 25 for pizza';
  const note = (title, body = '') => ({ note: { title, body } });
  if (ctx.isOn && !ctx.isOn('coins')) return note('🪙 Jackson coins are off right now.');
  // A group (@Programming, @everyone): src/groups.js reads it, or says why not.
  const t = groupTargets('request', text, ctx);
  if (t?.note) return { note: t.note };
  if (t) return groupCoins(t, ctx);
  const p = parseAsk(text, ctx.roster || []);
  if (!p.them) return note('Ask who?', usage);
  if (p.ambiguous) return note('Which one?', `${p.ambiguous.join(', ')}. Use their full name, like /request @${p.ambiguous[0]} ${p.amount || 10}`);
  if (!p.known) return note(`Who’s “${p.them}”?`, usage);
  if (p.amount === null) return note(`How many coins?`, `Try: /request @${p.them} 25 for pizza`);
  if (Number.isNaN(p.amount) || p.amount < 1) return note('Ask for a whole number of coins, at least 1.', usage);
  const r = await ctx.coinRequest({ action: 'create', to: p.them, amount: p.amount, reason: p.reason });
  return r?.note ? { note: r.note } : { done: true };
}

// The same of each person in a group: the amount comes first after the
// group, then the reason ("/request @Programming 5 for pizza"). Only the
// groups and the people named go to the server (t.ask), never the list of
// people: it works out who's in them, skips anyone already waiting on one
// from you, and posts the card. The key makes a double send one request.
async function groupCoins(t, ctx) {
  const note = (title, body = '') => ({ note: { title, body } });
  const usage = `Try: /request ${t.label} 5 for pizza`;
  // The first word that looks like a number (a full name's last word, like
  // "Mlezcko" in "@Cooper Mlezcko", can come before it).
  const words = t.rest.split(/\s+/).filter(Boolean);
  const at = words.findIndex((x) => /^[-+]?\.?\d/.test(x));
  if (at < 0) return note('How many coins each?', usage);
  const w = words[at].replace('🪙', '');
  if (!/^\d+$/.test(w) || Number(w) < 1) return note('Ask for a whole number of coins each, at least 1.', usage);
  const amount = Number(w);
  if (amount > GIFT_MAX) return note('That’s a lot.', `Up to ${coinsText(GIFT_MAX)} each, the same as /give.`);
  const reason = words.slice(at + 1).join(' ');
  const r = await ctx.coinRequest({ action: 'create', group: t.ask, amount, reason, key: ctx.key });
  if (r?.note) return { note: r.note };
  if (!r?.ok) return note('That didn’t go through.');
  // Who was left out (already waiting on one from you, or can't see the channel).
  return r.reply?.body ? { note: r.reply } : { done: true };
}

// What the message box suggests after "/request ": the words that open a
// form, then groups and people (to ask for coins). q: what's typed so far
// ("pe", "@co"). groupCount(subteam): how many people a subteam asks (not
// you); leave it out where groups don't work (a DM).
export function askOptions(q, { roster = [], me, isOn = () => true, groupCount = null }) {
  const lower = q.toLowerCase().replace(/^@/, '');
  const at = q.startsWith('@');
  const words = at
    ? []
    : ASK_KEYWORDS.filter(([w]) => (w === 'channel' ? isOn('channelRequests') : isOn('requests')) && w.startsWith(lower)).map(([word, desc]) => ({
        type: 'askword',
        key: `w-${word}`,
        insert: word,
        word,
        desc,
      }));
  const people = isOn('coins')
    ? roster
        .filter((n) => n !== me && (n.toLowerCase().startsWith(lower) || n.toLowerCase().split(' ').some((w) => w.startsWith(lower))))
        .map((n) => ({ type: 'person', key: `p-${n}`, insert: `@${n}`, name: n }))
    : [];
  // Groups once there's an @ or a letter to go on (/request @prog → @Programming).
  const groups =
    groupCount && isOn('coins') && (at || lower)
      ? [
          ...('everyone'.startsWith(lower) ? [{ type: 'everyone', key: 'everyone', insert: '@everyone', cmd: true }] : []),
          ...(lower
            ? SUBTEAMS.filter((s) => s.toLowerCase().startsWith(lower) || s.toLowerCase().split(' ').some((x) => x.startsWith(lower))).map((s) => ({
                type: 'role',
                key: `r-${s}`,
                insert: `@${s}`,
                name: s,
                count: groupCount(s),
                cmd: true,
              }))
            : []),
        ]
      : [];
  return [...words, ...groups, ...people].slice(0, 8);
}
