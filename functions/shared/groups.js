// Groups in slash commands: "@Programming" (any subteam) and "@everyone" in
// place of a person, as in /give @Programming 10 or /hug @everyone.
//
// The same rules everywhere: a group is everyone in it on the team right now,
// once each (someone named too, or in two of the groups, still counts once),
// never the person sending it, never Trotbot, and never anyone waiting to be
// let in or removed from the team. The app (src/groups.js) uses this to read
// what was typed and to draw the card; the server (functions/groups.js) uses
// it with the team it reads from its own data, so for coins the app's list of
// people is never trusted.
//
// No React or Firebase in here.

import { ORG_DEFAULTS, SUBTEAMS, nameKey } from './team.js';

export const EVERYONE = 'everyone';
export const BOT = 'Trotbot';

// The commands that take a group, and what kind of thing each does with it:
//   gift    one gift per person, all or nothing, on the server (/give)
//   action  one card naming the whole group (/hug @Programming)
//   lookup  one card with a row per person (/hours @Programming)
//   pool    picks from the group's people (/pick, /teams, /order)
//   request one coin request per person, under one card (/request)
// Every other command that takes a person refuses a group.
export const GROUP_COMMANDS = {
  give: 'gift',
  pet: 'action',
  hug: 'action',
  highfive: 'action',
  bonk: 'action',
  wave: 'action',
  compliment: 'action',
  hype: 'action',
  hours: 'lookup',
  tasks: 'lookup',
  streak: 'lookup',
  whois: 'lookup',
  pick: 'pool',
  teams: 'pool',
  order: 'pool',
  request: 'request',
};
export const groupKind = (cmd) => GROUP_COMMANDS[String(cmd || '').toLowerCase()] || '';

// How many people one command can reach (a big team's @everyone fits).
export const GROUP_MAX = 100;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "@Programming", "@programming", "@Team Management", "@team-management", "@teammanagement".
const SUB_RE = SUBTEAMS.map((s) => [s, new RegExp(`(^|[^\\w@])@${s.split(/\s+/).map(esc).join('[\\s_-]?')}(?![\\w])`, 'gi')]);
const EVERYONE_RE = /(^|[^\w@])@everyone(?![\w])/gi;

// The groups in what someone typed, and the text without them.
// "/give @programming @Cooper 10" → { groups: ['Programming'], everyone: false, rest: '@Cooper 10' }
export function groupsIn(text) {
  let rest = ` ${String(text || '')} `;
  const groups = [];
  let everyone = false;
  rest = rest.replace(EVERYONE_RE, (all, pre) => {
    everyone = true;
    return `${pre} `;
  });
  for (const [s, re] of SUB_RE)
    rest = rest.replace(re, (all, pre) => {
      if (!groups.includes(s)) groups.push(s);
      return `${pre} `;
    });
  return { groups, everyone, any: everyone || groups.length > 0, rest: rest.replace(/\s+/g, ' ').trim() };
}

// A group's people. roster: the team now; subteamsOf(name) → their subteams.
export function groupMembers(group, { roster = [], subteamsOf = () => [] }) {
  if (group === EVERYONE) return [...roster];
  return roster.filter((n) => (subteamsOf(n) || []).includes(group));
}

// Who a command with groups goes to: the people named, then each group's
// people, once each, in that order. Never the sender (me), never Trotbot,
// never anyone who isn't on the roster.
export function resolveTargets({ groups = [], everyone = false, people = [] }, { roster = [], subteamsOf = () => [], me = '' }) {
  const on = new Set(roster);
  const out = [];
  const add = (n) => {
    if (n && n !== me && n !== BOT && on.has(n) && !out.includes(n)) out.push(n);
  };
  people.forEach(add);
  if (everyone) roster.forEach(add);
  for (const g of groups) groupMembers(g, { roster, subteamsOf }).forEach(add);
  return out;
}

// "@Programming", "@Programming and @CAD", "@everyone".
export function groupLabel({ groups = [], everyone = false }) {
  const list = everyone ? ['@everyone'] : groups.map((g) => `@${g}`);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

// "Cooper, Mia, Sam and 3 more" (first names; a full name when two share one).
export function namesShort(names = [], max = 4) {
  const firsts = names.map((n) => n.split(' ')[0]);
  const shown = names.slice(0, max).map((n, i) => (firsts.filter((f) => f === firsts[i]).length > 1 ? n : firsts[i]));
  const more = names.length - shown.length;
  if (!more) return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] || '';
  return `${shown.join(', ')} and ${more} more`;
}

// The team from the database: people docs (everyone let in), roles docs
// (the Roster and the org chart: removed people, saved subteams) and the
// starting org chart. Pending people have no people doc; removed people are
// left out even if their people doc hasn't been cleaned up yet.
// people: [{ name }], roles: [{ id, name, removed, subteams }].
export function teamFrom({ people = [], roles = [], rename = (n) => n, defaults = ORG_DEFAULTS }) {
  const removed = new Set(roles.filter((r) => r?.removed).map((r) => rename(r.name || '')));
  const roster = [...new Set(people.map((p) => rename(p?.name || '')).filter(Boolean))].filter((n) => !removed.has(n) && n !== BOT);
  const saved = new Map(roles.filter((r) => r?.id).map((r) => [r.id, r]));
  const start = new Map(Object.entries(defaults).map(([k, v]) => [rename(k), v]));
  // Same as buildPeopleInfo (src/people.js): what the Team tab saved, else the starting chart.
  const subteamsOf = (n) => (saved.get(nameKey(n)) || start.get(n) || {}).subteams || [];
  return { roster, subteamsOf };
}
