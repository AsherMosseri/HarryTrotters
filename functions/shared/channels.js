// Channel requests: anyone on the team can ask for a channel, team management
// approves or declines. The app (dialog, demo mode) and the server
// (functions/channels.js) read these same checks.
//
//   channelRequests/{id}: { name, purpose, kind: 'public'|'private', invitees: [names],
//     by, byUid, at, status: 'pending'|'approved'|'declined', decidedBy, decidedAt, note, channelId }
//   A public channel is channels/{id}, as team management makes them. A private one
//   is privateChannels/{id} (same fields plus members: [names]); its messages are
//   still channels/{id}/messages, and the rules check the member list.

import { cleanName, knownName, nameKey, sameName } from './team.js';

export const NAME_MIN = 2;
export const NAME_MAX = 24;
export const PURPOSE_MAX = 120;
export const NOTE_MAX = 120;
export const MAX_INVITEES = 30;
// Per person: requests waiting at once, and requests in one team day.
export const MAX_OPEN = 3;
export const MAX_PER_DAY = 5;

// The channels every copy of the app has (CHANNELS in src/config.js). A request
// can't take one of these names, even before anyone saved a doc for it.
export const DEFAULT_CHANNEL_IDS = [
  'announcements',
  'general',
  'parts',
  'team-management',
  'cad',
  'mechanical',
  'assembly',
  'electrical',
  'programming',
  'arcade',
  'lab-log',
];

// What a typed name turns into, as you type: lowercase letters, numbers and
// single dashes. A trailing dash is kept so "build-" can become "build-log".
export const cleanChannelName = (raw) =>
  String(raw || '')
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, NAME_MAX);
// The name to save: no trailing dash.
export const finalChannelName = (raw) => cleanChannelName(raw).replace(/-+$/, '');
export const channelNameOk = (name) => name.length >= NAME_MIN && name.length <= NAME_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);

export const cleanPurpose = (text) => String(text || '').replace(/\s+/g, ' ').trim();

// Names and ids that can't be asked for: Map of name → 'exists' | 'pending'.
// channels / privates: the channel docs (deleted ones don't hold their name);
// requests: every request (only pending ones hold a name).
export function takenNames({ channels = [], privates = [], requests = [], exceptRequest = '' }) {
  const taken = new Map(DEFAULT_CHANNEL_IDS.map((id) => [id, 'exists']));
  // A default channel team management deleted is free again.
  for (const c of [...channels, ...privates]) {
    if (c.deleted) {
      if (DEFAULT_CHANNEL_IDS.includes(c.id) && c.id !== 'announcements' && c.id !== 'general') taken.delete(c.id);
      continue;
    }
    taken.set(c.id, 'exists');
    if (c.name) taken.set(c.name, 'exists');
  }
  for (const r of requests) if (r.status === 'pending' && r.id !== exceptRequest && r.name && !taken.has(r.name)) taken.set(r.name, 'pending');
  return taken;
}
// Every id already used by a channel doc (deleted ones too: a new channel must not
// pick up an old one's messages), or a default.
export const usedIds = ({ channels = [], privates = [] }) => new Set([...DEFAULT_CHANNEL_IDS, ...channels.map((c) => c.id), ...privates.map((c) => c.id)]);
export function freeId(name, used) {
  let id = name;
  for (let n = 2; used.has(id); n++) id = `${name.slice(0, NAME_MAX - 3)}-${n}`;
  return id;
}

// Who's asked for people: current spellings from `known`, no duplicates, not you.
export function cleanInvitees(list, me, known) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'string') continue;
    const name = knownName(raw, known);
    if (!nameKey(name) || sameName(name, me) || out.some((n) => sameName(n, name))) continue;
    out.push(name);
  }
  return out;
}

// One request, checked. input: { name, purpose, kind, invitees }.
// ctx: { me, known (names on the team), taken (takenNames) }.
// → { value: { name, purpose, kind, invitees } } or { error }.
export function checkRequest(input, { me, known, taken }) {
  const name = finalChannelName(input?.name);
  if (!channelNameOk(name)) return { error: `Names are ${NAME_MIN} to ${NAME_MAX} letters, numbers, or dashes, like build-log.` };
  const why = taken.get(name);
  if (why === 'exists') return { error: `There’s already a #${name}.` };
  if (why === 'pending') return { error: `Someone already asked for #${name}.` };
  const purpose = cleanPurpose(input?.purpose);
  if (!purpose) return { error: 'Say what the channel is for.' };
  if (purpose.length > PURPOSE_MAX) return { error: `Keep it to ${PURPOSE_MAX} characters.` };
  const kind = input?.kind === 'private' ? 'private' : 'public';
  let invitees = [];
  if (kind === 'private') {
    const given = Array.isArray(input?.invitees) ? input.invitees : [];
    if (given.length > MAX_INVITEES + 1) return { error: `A private channel can start with up to ${MAX_INVITEES} people.` };
    invitees = cleanInvitees(given, me, known);
    const stray = invitees.find((n) => !known.some((k) => sameName(k, n)));
    if (stray) return { error: `${stray} isn’t on the team.` };
    if (invitees.length > MAX_INVITEES) return { error: `A private channel can start with up to ${MAX_INVITEES} people.` };
    if (!invitees.length) return { error: 'Pick at least one person to invite, or make it open to everyone.' };
  }
  return { value: { name, purpose, kind, invitees } };
}

// Whether this person may ask for another: mine = their requests (any status).
// → an error message, or ''.
export function limitError(mine, now, dayOf) {
  const open = mine.filter((r) => r.status === 'pending').length;
  if (open >= MAX_OPEN) return `You already have ${MAX_OPEN} requests waiting. Cancel one or wait for an answer.`;
  const today = dayOf(now);
  if (mine.filter((r) => dayOf(r.at || 0) === today).length >= MAX_PER_DAY) return `That’s ${MAX_PER_DAY} requests today. Try again tomorrow.`;
  return '';
}

// The text posted in a channel when it's made.
export function createdText(requester, purpose, kind, memberCount) {
  const text = `Created for ${requester}: ${purpose}`;
  return (kind === 'private' ? `${text.replace(/\.$/, '')}. Private: only the ${memberCount} people in it can see it.` : text).slice(0, 400);
}

export const cleanNote = (text) => cleanName(String(text || '').slice(0, NOTE_MAX * 2)).slice(0, NOTE_MAX);
