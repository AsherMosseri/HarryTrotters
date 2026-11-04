// Groups in slash commands, on the server (shared/groups.js has the rules).
// Who's in @Programming or @everyone comes from the server's own data, read
// fresh: people docs (everyone let in), roles docs (the Roster's removed
// people and the org chart's saved subteams) and the starting org chart.
// The app's list of people is never used for anything with coins.
//
// For /request (coin requests to a group), the server side is:
//   const team = await groupTeam(db, rename);
//   const g = groupsIn(text);                 // or { groups, everyone } the app sent
//   const people = resolveTargets({ ...g, people: named }, { ...team, me });
// then one request per person; refuse if people is empty or longer than GROUP_MAX.

import { teamFrom } from './shared/groups.js';

export async function groupTeam(db, rename) {
  const [people, roles] = await Promise.all([db.collection('people').get(), db.collection('roles').get()]);
  return teamFrom({
    people: people.docs.map((d) => ({ name: d.get('name') || '' })),
    roles: roles.docs.map((d) => ({ id: d.id, ...d.data() })),
    rename,
  });
}
