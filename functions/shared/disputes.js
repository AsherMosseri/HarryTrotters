// Casino reports: someone says a result looks wrong, the team owner (Asher)
// looks at it and refunds by hand or says no. No Firebase in here: the server
// (functions/disputes.js) and demo mode use the same checks.
//
// A report never moves coins by itself. The owner's "Refund" pays back
// at most what the card (written by the server, so it can't be faked) shows
// the person lost, once, as a 'refund' entry in the coins ledger.

import { nameKey } from './team.js';
import { BOT, CHALLENGES, LABEL as ARCADE_LABEL } from './arcade.js';
import { historyKey } from './coins.js';

// Results that can be reported: the casino games (not the lottery, which is
// a pot for everyone) and the head-to-head challenge.
export const DISPUTABLE = ['slots', 'dice', 'coinflip', 'roulette', 'blackjack', 'crash', 'mines', 'highlow', 'challenge'];
export const GAME_LABEL = {
  slots: 'Slots',
  dice: 'Dice',
  coinflip: 'Coin flip',
  roulette: 'Roulette',
  blackjack: 'Blackjack',
  crash: 'Crash',
  mines: 'Mines',
  highlow: 'High-low',
  challenge: 'Challenge',
};
export const REASONS = {
  unfair: 'The result looks unfair',
  errored: 'I lost coins and the game errored',
  other: 'Something else',
};
// No daily cap on reports (Asher, 3.1): one per result per person is the limit.
export const LIMITS = { note: 300, resolution: 200, window: 2 * 3600000 };

// Everyone the card is about (the person who played, or both people in a challenge).
export function cardPlayers(cmd, by, rename = (n) => n) {
  if (cmd?.name === 'challenge') return [cmd.game?.a, cmd.game?.b].filter(Boolean).map(rename);
  return by ? [rename(by)] : [];
}

// What this card shows `who` lost, in coins (0 if they didn't lose, or the
// game isn't over). `final`: the card is finished, so the number is settled.
export function cardLoss(cmd, who, rename = (n) => n) {
  if (!cmd || !DISPUTABLE.includes(cmd.name)) return { final: false, loss: 0 };
  if (cmd.name === 'challenge') {
    const g = cmd.game || {};
    const final = cmd.status === 'done' && g.how === 'rolled';
    const lost = final && g.winner && rename(g.winner) !== who && [g.a, g.b].map(rename).includes(who);
    return { final, loss: lost ? Math.max(0, Math.floor(g.bet || 0)) : 0 };
  }
  // A casino card has `net` once the server has paid it out.
  const final = typeof cmd.net === 'number';
  return { final, loss: final && cmd.net < 0 ? -Math.floor(cmd.net) : 0 };
}

// Can `me` report this message? Returns '' or why not.
export function reportProblem(m, me, rename = (n) => n) {
  const cmd = m?.cmd;
  if (!m || m.deleted || !cmd || !DISPUTABLE.includes(cmd.name)) return 'That isn’t a casino result.';
  if (!cardPlayers(cmd, m.by, rename).includes(me)) return 'You can only report results you were part of.';
  return '';
}

// A few plain words about the card, for the owner.
export function describeCard(cmd) {
  const g = cmd?.game || {};
  const n = cmd?.name;
  if (n === 'slots') return `${(g.reels || []).join(' ')} · ${g.line || ''}`.trim();
  if (n === 'dice')
    return `You rolled ${(g.you || []).reduce((t, x) => t + x, 0)}, the house ${(g.house || []).reduce((t, x) => t + x, 0)}`;
  if (n === 'coinflip') return `Called ${g.call}, landed ${g.side}`;
  if (n === 'roulette') return `Bet on ${g.spot}, the ball landed on ${g.n} (${g.color})`;
  if (n === 'blackjack') return `Your cards ${(g.you || []).join(' ')} · dealer ${(g.dealer || []).join(' ')} · ${cmd.status}`;
  if (n === 'crash') return `Crash: ${cmd.status}${g.at ? ` at ${g.at}x` : ''}`;
  if (n === 'mines') return `Mines: ${g.bombs} bombs, ${(g.open || []).length} opened, ${cmd.status}`;
  if (n === 'highlow') return `High-low: ${(g.history || []).length} guesses, ${cmd.status}`;
  if (n === 'challenge') {
    const r =
      g.kind === 'dice'
        ? `rolled ${(g.rolls?.a || []).join('+')} vs ${(g.rolls?.b || []).join('+')}`
        : `called ${g.call}, flipped ${g.flip || '?'}`;
    return `${g.a} vs ${g.b}, ${g.kind}: ${g.how === 'rolled' ? `${r}, ${g.winner ? `${g.winner} won` : 'a tie'}` : g.how || g.status}`;
  }
  return '';
}

// What a report keeps about the card (written by the server from the message,
// never taken from the app).
export function snapshotOf(m, who, rename = (n) => n) {
  const cmd = m.cmd;
  const { final, loss } = cardLoss(cmd, who, rename);
  const g = cmd.game || {};
  return {
    game: cmd.name,
    bet: Math.floor(cmd.name === 'challenge' ? g.bet || 0 : cmd.bet || 0),
    net: typeof cmd.net === 'number' ? Math.floor(cmd.net) : null,
    status: String(cmd.name === 'challenge' ? g.how || cmd.status || '' : cmd.status || '').slice(0, 20),
    final,
    loss,
    text: describeCard(cmd).slice(0, 200),
    cardAt: m.at || 0,
  };
}

// The one-per-message-per-person id of a report.
export const reportId = (msgId, who) => `${msgId}_${nameKey(who)}`;
// The refund key (refundKeys/{id}): one per game card per person, shared by a
// report's refund and the owner's Refund / Take back on the card itself, so a
// result is put right at most once, whichever way.
export const refundKeyId = (msgId, who) => `dispute-${msgId}-${nameKey(who)}`;

// Is the loss in the person's own history (bank.recent: the latest 15
// entries)? 'found', 'missing' (the history reaches back past the card and
// the loss isn't there) or 'unknown' (the history doesn't go back that far:
// the card, which only the server writes, is what we have).
export function historyCheck(recent = [], game, loss, cardAt) {
  const label = `${GAME_LABEL[game]}:`;
  const near = recent.filter((x) => x.at >= cardAt - 60000 && x.at <= cardAt + LIMITS.window);
  if (near.some((x) => x.amount === -loss && String(x.label || '').startsWith(label))) return 'found';
  // The card's own entry is at or after the card, so if the list starts before
  // the card, it would be there.
  const oldest = recent.length ? Math.min(...recent.map((x) => x.at)) : Infinity;
  return oldest <= cardAt ? 'missing' : 'unknown';
}

// The coins ledger entry for a refund (the market's refund entries look the
// same). game: shows it under Casino in history; reverses: the history line
// it puts right (cardLine), so that line reads "Reversed".
export const refundEntry = (person, amount, game, disputeId, now, reverses = '') => ({
  type: 'refund',
  person,
  amount,
  item: `dispute:${disputeId}`,
  label: `Refund: ${GAME_LABEL[game] || 'Casino'} result reviewed`.slice(0, 80),
  game,
  ...(reverses && { reverses }),
  at: now,
});

// ---------- the owner's Refund / Take back on a game card (3.1.1) ----------
// Asher (the owner) can put any finished game right from its card in chat:
// refund a loss, or take back a win, for each person in it. The amount is
// always what the card (written by the server) shows that person's result
// was, never a number from the app, and it happens once per card and person
// (refundKeyId, shared with reports).

// Cards with coins on them: the casino games, /challenge, the arcade's
// head-to-head games (their bets) and heists. Prizes from the free games are
// awards and aren't refunded here.
export const FIXABLE = [...DISPUTABLE, ...CHALLENGES, 'heist'];
export const gameLabel = (game) => GAME_LABEL[game] || ARCADE_LABEL[game] || 'Game';

// What each person in the game ended up with, as the card shows it:
// { final, nets: [{ name, net }] }. final: the game is over and paid out
// (a live game's bets are held until it ends). Matches the history line each
// person got (the `shown` of their bank entry).
export function cardNets(cmd, by, rename = (n) => n) {
  if (!cmd || !FIXABLE.includes(cmd.name)) return { final: false, nets: [] };
  const g = cmd.game || {};
  const people = (list) => [...new Set(list.filter((n) => n && n !== BOT).map(rename))].filter((n) => n && n !== BOT);
  const bet = Math.max(0, Math.floor(g.bet || 0));
  if (cmd.name === 'challenge' || CHALLENGES.includes(cmd.name)) {
    // The winner takes the other's bet (Trotbot's house pays too); no winner
    // (a tie, or it was declined, cancelled or ran out) gives the bets back.
    const final = cmd.status === 'done';
    const played = cmd.name !== 'challenge' || g.how === 'rolled';
    const winner = final && played && g.winner ? rename(g.winner) : '';
    return { final, nets: people([g.a, g.b]).map((name) => ({ name, net: !winner || !bet ? 0 : name === winner ? bet : -bet })) };
  }
  if (cmd.name === 'heist') {
    const final = cmd.status === 'done';
    const each = Math.max(0, Math.floor(g.each || 0));
    return { final, nets: people(g.crew || []).map((name) => ({ name, net: !final ? 0 : g.ok ? each - bet : -bet })) };
  }
  // A casino card has `net` once the server has paid it out.
  const final = typeof cmd.net === 'number';
  return { final, nets: people([by]).map((name) => ({ name, net: final ? Math.floor(cmd.net) : 0 })) };
}

// The card's tag for a person (cmd.adjust[nameKey]): written by the server
// only; the rules stop the app changing a game card's cmd.
export const adjustOf = (cmd, who) => cmd?.adjust?.[nameKey(who)] || null;

// Can the owner refund (mode 'refund') or take back ('takeback') `who`'s
// result on this message? { problem, body } or { amount, net, game }.
export function fixCheck(m, who, mode, rename = (n) => n) {
  if (mode !== 'refund' && mode !== 'takeback') return { problem: 'Refund or take back?' };
  const cmd = m?.cmd;
  if (!m || !cmd || !FIXABLE.includes(cmd.name)) return { problem: 'That isn’t a game with coins on it.' };
  const { final, nets } = cardNets(cmd, m.by, rename);
  const mine = nets.find((x) => x.name === who);
  if (!mine) return { problem: `${who} wasn’t in that game.` };
  if (!final) return { problem: 'That game isn’t over yet.', body: 'Finish or cancel it first: bets in a game that’s still going are held until it ends.' };
  const done = adjustOf(cmd, who);
  if (done) return { problem: done.mode === 'takeback' ? 'That win was already taken back.' : 'That result was already refunded.' };
  if (mode === 'refund' && !(mine.net < 0)) return { problem: 'There’s no loss to refund.', body: 'The card doesn’t show them losing coins.' };
  if (mode === 'takeback' && !(mine.net > 0)) return { problem: 'There’s no win to take back.', body: 'The card doesn’t show them winning coins.' };
  return { amount: Math.abs(mine.net), net: mine.net, game: cmd.name };
}

// A bank history line as the history shows it (coins.js bankItems), for its key.
export const lineKey = (x) => historyKey({ kind: 'casino', at: x.at, amount: x.amount, label: x.label || 'Casino' });
// How a game's history lines start ("Mines: lost 50", "Heist: caught (lost 20)").
const linePrefix = (game) => `${game === 'heist' ? 'Heist' : gameLabel(game)}:`;
// How long after the card was posted its result can land (a long game).
const LINE_WINDOW = 2 * 86400000;

// The person's history line for this card's result, from their bank docs'
// recent lines (under any name they've had): the one tagged with the card
// (3.1.1 on), or, for older lines, the closest one with the game's name, the
// same amount and a time from the card on. { line, candidates }: candidates
// are every untagged line it could be (to check none was reversed already).
export function cardLine(recent = [], { conv, msgId, game, net, cardAt }) {
  const card = `${conv}/${msgId}`;
  const tagged = recent.find((x) => x.card === card);
  if (tagged) return { line: tagged, candidates: [tagged] };
  const prefix = linePrefix(game);
  const candidates = recent
    .filter((x) => !x.hold && !x.card && x.amount === net && String(x.label || '').startsWith(prefix))
    .filter((x) => x.at >= cardAt - 60000 && x.at <= cardAt + LINE_WINDOW)
    .sort((a, b) => Math.abs(a.at - cardAt) - Math.abs(b.at - cardAt));
  return { line: candidates[0] || null, candidates };
}

// The ledger entry: a 'refund' (the type the coins math has always counted,
// on every version of the app), positive for a refund and negative for a win
// taken back.
export function fixEntry({ person, mode, amount, game, msgId, by, now, reverses = '' }) {
  const who = (by || 'Asher').split(' ')[0];
  return {
    type: 'refund',
    person,
    amount: mode === 'takeback' ? -amount : amount,
    item: `card:${msgId}`,
    label: (mode === 'takeback' ? `Taken back: ${gameLabel(game)} win (${who})` : `Refund: ${gameLabel(game)} (${who} refunded)`).slice(0, 80),
    game,
    by,
    ...(reverses && { reverses }),
    at: now,
  };
}

// The tag on the card, and the person's notification.
export const adjustTag = ({ person, mode, amount, by, now, via = 'card' }) => ({ name: person, mode, amount, by, at: now, via });
export function fixNote({ mode, amount, game, by }) {
  const who = (by || 'Asher').split(' ')[0];
  const n = amount.toLocaleString('en-US');
  return mode === 'takeback'
    ? { icon: '↩️', title: `${who} took back your ${gameLabel(game)} win: −${n}`, body: 'It’s in your coin history.' }
    : { icon: '↩️', title: `${who} refunded your ${gameLabel(game)} bet: +${n}`, body: 'It’s in your coin history.' };
}
