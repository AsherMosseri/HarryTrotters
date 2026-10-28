// Asher's controls for slash commands (settings/team → commands):
//   off:   ['rob', 'slots', …]       commands turned off for everyone
//   where: { casino: ['arcade'], … } the channels a group works in (null = anywhere)
// The app checks before running a command, and the play function checks
// again for the ones with coins on the line.

import { CASINO, ECONOMY } from './casino.js';
import { MULTI } from './arcade.js';

// Out of the box: the casino and arcade games live in #arcade; the rest work anywhere.
export const DEFAULT_WHERE = { casino: ['arcade'], arcade: ['arcade'] };
// Always on (so there's a way to see what's there).
export const ALWAYS_ON = ['help'];

export const serverGroup = (name) =>
  CASINO.includes(name) ? 'casino' : MULTI.includes(name) ? 'arcade' : ECONOMY.includes(name) ? 'economy' : '';

export const whereFor = (group, cfg) => {
  const set = cfg?.where?.[group];
  return set === undefined ? DEFAULT_WHERE[group] || null : set;
};

export const isOff = (name, cfg) => !ALWAYS_ON.includes(name) && (cfg?.off || []).includes(name);

// Why /name can't run in conv (a note for the person), or null if it can.
export function blocked(name, group, conv, cfg) {
  if (isOff(name, cfg)) return { title: `/${name} is turned off`, body: 'It’s off for now. Type / to see what’s on.' };
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
