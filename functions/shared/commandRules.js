// Asher's controls for slash commands (settings/team → commands):
//   off:   ['rob', 'slots', …]       commands turned off for everyone
//   where: { casino: ['arcade'], … } the channels a group works in (null = anywhere)
// The app checks before running a command, and the play function checks
// again for the ones with coins on the line.

import { CASINO, ECONOMY } from './casino.js';
import { MULTI } from './arcade.js';

// Out of the box: the casino and arcade games live in #arcade; the rest work anywhere.
export const DEFAULT_WHERE = { casino: ['arcade'], arcade: ['arcade'] };

// 3.2: coins and games only in #arcade. Every casino and arcade game and every
// command about Jackson coins works there and nowhere else (not in other
// channels, not in DMs), whatever the Commands page's Where says. The app
// stops them before they send; the play function, coin requests and game
// shares check again, and the rules refuse a coin card anywhere else.
export const ARCADE = 'arcade';
export const COIN_GROUPS = ['economy', 'casino', 'arcade'];
// The app's own coin commands (no server roll): /balance, /give, /loan,
// /leaderboard. /request counts when it asks for coins (isCoinAsk).
export const COIN_COMMANDS = [...new Set([...CASINO, ...ECONOMY, ...MULTI, 'challenge', 'balance', 'give', 'loan', 'leaderboard'])];
export const ARCADE_NOTE = { title: 'Coins and games are in #arcade', body: 'Your command is waiting there, ready to send.', go: ARCADE, arcade: true };
// Is /name a coins-or-games command? coinAsk: a /request for coins.
export const isCoinCommand = (name, { coinAsk = false } = {}) => COIN_COMMANDS.includes(name) || (name === 'request' && coinAsk);
// The note for a coin command anywhere but #arcade, or null.
export const arcadeOnly = (name, conv, opts) => (isCoinCommand(name, opts) && conv !== ARCADE ? { ...ARCADE_NOTE } : null);
// Always on (so there's a way to see what's there).
export const ALWAYS_ON = ['help'];

// /challenge (a coin flip or dice for the same bet) is a casino command, so it
// works where the casino does.
export const serverGroup = (name) =>
  CASINO.includes(name) || name === 'challenge' ? 'casino' : MULTI.includes(name) ? 'arcade' : ECONOMY.includes(name) ? 'economy' : '';

export const whereFor = (group, cfg) => {
  // Coin groups: #arcade, always (3.2).
  if (COIN_GROUPS.includes(group)) return [ARCADE];
  const set = cfg?.where?.[group];
  return set === undefined ? DEFAULT_WHERE[group] || null : set;
};

export const isOff = (name, cfg) => !ALWAYS_ON.includes(name) && (cfg?.off || []).includes(name);

// Why /name can't run in conv (a note for the person), or null if it can.
export function blocked(name, group, conv, cfg) {
  if (isOff(name, cfg)) return { title: `/${name} is turned off`, body: 'It’s off for now. Type / to see what’s on.' };
  const coins = arcadeOnly(name, conv) || (COIN_GROUPS.includes(group) && conv !== ARCADE ? { ...ARCADE_NOTE } : null);
  if (coins) return coins;
  const where = whereFor(group, cfg);
  if (where && !where.includes(conv)) {
    const list = where.map((c) => `#${c}`).join(', ');
    const icon = group === 'casino' ? '🎰 ' : group === 'arcade' ? '🕹️ ' : '';
    return where.length
      ? { title: `${icon}Take it to #${where[0]}`, body: `/${name} works in ${list}.`, go: where[0] }
      : { title: `/${name} doesn’t work in any channel right now` };
  }
  return null;
}
