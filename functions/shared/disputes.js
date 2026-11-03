// Casino reports: someone says a result looks wrong, the team owner (Asher)
// looks at it and refunds by hand or says no. No Firebase in here: the server
// (functions/disputes.js) and demo mode use the same checks.
//
// A report never moves coins by itself. The owner's "Refund" pays back
// at most what the card (written by the server, so it can't be faked) shows
// the person lost, once, as a 'refund' entry in the coins ledger.

import { nameKey } from './team.js';

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
export const LIMITS = { perDay: 10, note: 300, resolution: 200, window: 2 * 3600000 };

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

// The one-per-message-per-person id of a report (and of its refund key).
export const reportId = (msgId, who) => `${msgId}_${nameKey(who)}`;

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

// The coins ledger entry for a refund (the market's refund entries look the same).
export const refundEntry = (person, amount, game, disputeId, now) => ({
  type: 'refund',
  person,
  amount,
  item: `dispute:${disputeId}`,
  label: `Refund: ${GAME_LABEL[game] || 'Casino'} result reviewed`.slice(0, 80),
  at: now,
});
