// Groups in slash commands (/give @Programming 10, /hug @everyone,
// /hours @CAD): reading what was typed, who it reaches, and who gets a
// notification. The rules themselves are in functions/shared/groups.js, which
// the server uses too. No React or Firebase in here.
//
// Who can use which group:
// - @Subteam (@Programming, @CAD, @Team Management…): anyone.
// - @everyone: anyone, in commands. In a plain message only team management
//   can @everyone (Composer.jsx), and that doesn't change: a command's card
//   only notifies @everyone when team management sends it (see groupNotify).
// - Not in DMs (chat has no @Subteam there either).
//
// /request (coin requests) uses it like this (src/requestCommand.js
// groupCoins; the server side is functions/coinRequests.js createGroup):
//   const t = groupTargets('request', words, ctx);   // ctx as in runCommand
//   if (t?.note) return { note: t.note };
//   if (t) → ask the server with { group: t.ask, amount, key }, where the
//            server resolves the people itself (functions/groups.js) and makes
//            one request per person, each paid or declined on its own. Count a
//            group request as ONE open request toward the 3-open cap. When a
//            non-manager uses @everyone, its per-person notifications are quiet
//            (inbox only, no push: notify({ quiet: true })); the request still
//            shows in their coin requests and the card in chat.
//   if (!t) → the one-person request, as before.
// Its card's notifications: groupNotify(t, 'request', ctx) (no mentions; the
// requests notify on their own).

import { groupKind, groupLabel, groupsIn, namesShort, resolveTargets } from '../functions/shared/groups.js';

export { EVERYONE, GROUP_COMMANDS, GROUP_MAX, groupKind, groupLabel, groupsIn, namesShort } from '../functions/shared/groups.js';

// The people named with @ in the text (groups already taken out): "@Cooper
// Mlezcko", or "@cooper" when one person's first name (or the start of one
// name) fits. { people } or { unknown: '@word' } or { which: [names] }.
export function peopleNamed(text, roster) {
  let rest = ` ${text} `;
  const people = [];
  for (const n of [...roster].sort((a, b) => b.length - a.length)) {
    const at = rest.toLowerCase().indexOf(`@${n.toLowerCase()}`);
    if (at < 0) continue;
    const after = rest[at + n.length + 1];
    if (after && /\w/.test(after)) continue;
    if (!people.includes(n)) people.push(n);
    rest = `${rest.slice(0, at)} ${rest.slice(at + n.length + 1)}`;
  }
  for (const m of rest.matchAll(/@([^\s@]+)/g)) {
    const w = m[1].toLowerCase().replace(/[.,!?]+$/, '');
    if (!w) continue;
    const firsts = roster.filter((r) => r.toLowerCase().split(' ')[0] === w);
    const starts = firsts.length ? firsts : roster.filter((r) => r.toLowerCase().startsWith(w));
    if (starts.length === 1) {
      if (!people.includes(starts[0])) people.push(starts[0]);
    } else if (starts.length > 1) return { which: starts, word: `@${m[1]}` };
    else return { unknown: `@${m[1]}` };
  }
  return { people };
}

// What a command's words name, when they name a group. ctx: { actor, roster,
// subteamsOf, isDm } (what runCommand gets). Returns:
//   null      no group here: the command works as it always did
//   { note }  a group can't be used here (this command, a DM, nobody in it)
//   { kind, people, named, groups, everyone, label, short, rest, subPeople, ask }
//     people: who it reaches (named people first, then the groups', once
//     each, never you, never Trotbot); rest: the words left over; ask: what
//     to send the server for anything with coins (it works out the people).
export function groupTargets(cmdName, text, ctx) {
  const g = groupsIn(text);
  if (!g.any) return null;
  const kind = groupKind(cmdName);
  const label = groupLabel(g);
  if (!kind)
    return {
      note: {
        title: `/${cmdName} is one person at a time.`,
        body: `Groups like ${label} don’t work with it. Name one person.`,
      },
    };
  if (ctx.isDm) return { note: { title: 'Groups work in channels.', body: `In a DM, name people one by one instead of ${label}.` } };
  const me = ctx.actor.name;
  const roster = ctx.roster || [];
  const subteamsOf = ctx.subteamsOf || (() => []);
  const n = peopleNamed(g.rest, roster);
  if (n.unknown) return { note: { title: `Who’s “${n.unknown}”?`, body: `Pick people with @, like /${cmdName} ${label} @Cooper` } };
  if (n.which) return { note: { title: `Which one is ${n.which.length > 1 ? n.word : ''}?`, body: `${n.which.join(', ')}. Use their full name.` } };
  const people = resolveTargets({ groups: g.groups, everyone: g.everyone, people: n.people }, { roster, subteamsOf, me });
  if (!people.length)
    return {
      empty: true,
      note: { title: `Nobody in ${label}.`, body: `${label} has nobody in it besides you${n.people.length ? ' and the people you named' : ''}.` },
    };
  // Just the subteams' people (not @everyone, nobody named), for notifications.
  const subPeople = resolveTargets({ groups: g.groups }, { roster, subteamsOf, me });
  const rest = g.rest
    .replace(/@\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    kind,
    people,
    named: n.people.filter((p) => p !== me),
    groups: g.groups,
    everyone: g.everyone,
    label,
    short: namesShort(people),
    rest,
    subPeople,
    ask: { groups: g.groups, everyone: g.everyone, people: n.people.filter((p) => p !== me) },
  };
}

// Who gets a notification from a group command's card, as the card's
// { mentions, roles, everyone } (onChatMessage in functions/index.js sends
// them). The same as chat for the same @s, never more:
// - @Subteam: that subteam's people (anyone can, as in a message).
// - @everyone: everyone, only when team management sends it (and Controls
//   has @everyone on). From anyone else the card shows but pings nobody.
// - people named by hand: them.
// - /give: everyone who got coins, which is the gift notification one /give
//   sends ("sent you 10 Jackson coins"), whoever sends it.
// - lookups (/hours…) and picks: nobody, the same as with one person.
// ctx: { isManager, mentionsOn, everyoneOn } (Controls switches).
export function groupNotify(t, kind, { isManager = false, mentionsOn = true, everyoneOn = true } = {}) {
  const none = { mentions: [], roles: [], everyone: false };
  if (!t || !mentionsOn || kind === 'lookup' || kind === 'pool' || kind === 'request') return none;
  const everyone = t.everyone && isManager && everyoneOn;
  const roles = t.groups.slice();
  if (kind === 'gift') return { mentions: t.people, roles: everyone ? [] : roles, everyone };
  // Not @everyone: the subteams' people and anyone named, as a message would.
  const mentions = everyone ? t.people : [...new Set([...t.named, ...t.subPeople])];
  return { mentions, roles: everyone ? [] : roles, everyone };
}

