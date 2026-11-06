// Inactive members (3.2.8): someone with no time at the lab for 3 weeks is
// inactive. The app (Roster, leaderboards, check-in counts, the check-in and
// required-poll screens), the demo and the server (who's notified about a
// lab check-in or a required poll) all ask this file, so they always agree.
//
// Automatic: inactive when the last team day (New York) they were at the lab
// is 21 or more days before today. A running shift counts as today, so
// clocking in makes anyone active at once. Someone with no shifts at all is
// inactive only once they've been on the team 3 weeks (joinedAt); with no
// join date known, they are.
// Manual (team management, on the Roster): settings/team.inactive =
//   { [personId]: { name, mode: 'inactive' | 'active', at, by } }
// 'active' ("keep active") beats the automatic rule until it's cleared.
// 'inactive' holds until they clock in: a shift that starts at or after `at`
// clears it (no write needed, so the server and every phone see it the same
// moment). Team management themselves are never inactive.
//
// Nothing here touches coins, sign-in, or history: being inactive only takes
// someone off the leaderboards and team-wide "who" lists, and stops the
// check-in and required-poll screens (and their notifications) for them.

import { teamDay } from './coins.js';
import { addDay } from './streaks.js';
import { isManagerName, nameKey, sameName } from './team.js';

export const INACTIVE_DAYS = 21;
export const MODES = ['inactive', 'active'];

// The newest time this person was at the lab (ms): the end of their latest
// shift, or now for a running one. 0: never. shifts under current names.
export function lastLabAt(name, shifts = [], now = Date.now()) {
  let last = 0;
  for (const s of shifts) if (s?.person === name && Number.isFinite(s.start)) last = Math.max(last, Math.min(now, Math.max(s.start, s.end ?? now)));
  return last;
}

// Team management's override for this person, or null. Looked up by name
// (through renames), so a rename keeps it.
export function overrideOf(name, overrides, rename = (n) => n) {
  if (!overrides || typeof overrides !== 'object') return null;
  const key = nameKey(name);
  const direct = overrides[key];
  const hit =
    direct && MODES.includes(direct.mode)
      ? direct
      : Object.values(overrides).find((o) => o && MODES.includes(o.mode) && o.name && sameName(rename(o.name), name));
  return hit && MODES.includes(hit.mode) ? hit : null;
}

// Whether the days between two team days are 3 weeks or more.
const longAgo = (day, today) => addDay(day, INACTIVE_DAYS) <= today;

// One person: { inactive, why: 'auto' | 'manual' | '', kept, lastAt, override }
//   why     'manual': team management marked them inactive (and they haven't
//           clocked in since); 'auto': 3 weeks with no lab time.
//   kept    team management keeps them active whatever the rule says.
//   lastAt  their last time at the lab (ms), 0 for never.
// shifts: everyone's (or theirs) under current names; joinedAt: when they
// joined (ms, 0 unknown); override: overrideOf()'s answer.
export function activityOf(name, { shifts = [], joinedAt = 0, override = null, now = Date.now() } = {}) {
  const lastAt = lastLabAt(name, shifts, now);
  const base = { inactive: false, why: '', kept: false, lastAt, override: override?.mode || '' };
  if (isManagerName(name)) return base;
  if (override?.mode === 'active') return { ...base, kept: true };
  if (override?.mode === 'inactive') {
    const at = Number(override.at) || 0;
    const back = shifts.some((s) => s?.person === name && Number.isFinite(s.start) && s.start >= at);
    if (!back) return { ...base, inactive: true, why: 'manual' };
  }
  const today = teamDay(now);
  if (lastAt) return longAgo(teamDay(lastAt), today) ? { ...base, inactive: true, why: 'auto' } : base;
  // Never at the lab: new people get 3 weeks to come.
  if (joinedAt > 0 && !longAgo(teamDay(Math.min(joinedAt, now)), today)) return base;
  return { ...base, inactive: true, why: 'auto' };
}

// When each person joined (ms): the earliest of their people docs (one per
// device, { name, joinedAt }) and a Roster add (roles' addedAt). Map name → ms.
export function joinedByName(people = [], roles = [], rename = (n) => n) {
  const out = new Map();
  const add = (name, at) => {
    const n = rename(name || '');
    const ms = Number(at) || 0;
    if (!n || !(ms > 0)) return;
    out.set(n, Math.min(out.get(n) || Infinity, ms));
  };
  for (const p of people) add(p?.name, p?.joinedAt);
  for (const r of roles) if (r && !r.removed) add(r.name, r.addedAt);
  return out;
}

// Everyone at once: Map name → activityOf(). shifts' people can be under old
// names; they're renamed here.
export function teamActivity(names, { shifts = [], people = [], roles = [], overrides = null, rename = (n) => n, now = Date.now() } = {}) {
  const named = shifts.map((s) => (s?.person && rename(s.person) !== s.person ? { ...s, person: rename(s.person) } : s));
  const byPerson = new Map();
  for (const s of named) if (s?.person) byPerson.set(s.person, [...(byPerson.get(s.person) || []), s]);
  const joined = joinedByName(people, roles, rename);
  return new Map(
    names.map((name) => [
      name,
      activityOf(name, { shifts: byPerson.get(name) || [], joinedAt: joined.get(name) || 0, override: overrideOf(name, overrides, rename), now }),
    ]),
  );
}

// Just the inactive names: Set.
export const inactiveSet = (activity) => new Set([...activity].filter(([, a]) => a.inactive).map(([n]) => n));

// The override to save for a person (Roster): { name, mode, at, by }, or null
// to clear it (back to automatic).
export function overrideEntry(name, mode, by, now = Date.now()) {
  if (!MODES.includes(mode)) return null;
  return { name, mode, at: now, by: by || '' };
}

// "Last at the lab 23 days ago", "Never at the lab". days from team days.
export function lastLabText(lastAt, now = Date.now()) {
  if (!lastAt) return 'Never clocked in';
  const days = Math.round((new Date(`${teamDay(now)}T12:00:00Z`) - new Date(`${teamDay(lastAt)}T12:00:00Z`)) / 86400000);
  if (days <= 0) return 'At the lab today';
  if (days === 1) return 'Last at the lab yesterday';
  if (days < 60) return `Last at the lab ${days} days ago`;
  const months = Math.round(days / 30);
  return `Last at the lab ${months} months ago`;
}
