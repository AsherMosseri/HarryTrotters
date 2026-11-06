// Polls: who counts, and what each person's picks may be. The app, the
// "required poll" gate and the tests all read results through pollTally, so
// there is one answer. Votes are written by phones and Firestore rules can't
// count a person's picks across options, so the rule is enforced here, when
// results are added up (and honest phones check it before they write).
//
// A poll: { question, kind: 'choices'|'people'|'text', options: [{ id, text, person? }],
//   multi, pick?: { mode: 'one'|'upto'|'exact'|'any', n }, selfVote?: false,
//   write, writePick?, anonymous?, required, closed }
// Old polls have no `pick`: multi means any number, otherwise one.
// A "several" choice poll that also takes written answers (write) counts
// your own written answer as one of your picks (writeCounts).
// Votes: { [optionId]: { [personKey]: name }, text: { [personKey]: { name, text, at } } }

import { nameKey } from './team.js';

export const MAX_CHOICES = 10;
export const MAX_PEOPLE = 40;
export const MAX_PICK = 10;

// A people option's id comes from the person, so it stays theirs after a rename.
export const personOptionId = (name) => `p-${nameKey(name)}`;
export const optionLimit = (kind) => (kind === 'people' ? MAX_PEOPLE : MAX_CHOICES);
// What an option shows now: the person's current name, else its text.
export const optionLabel = (o, rename = (n) => n) => (o.person ? rename(o.person) : o.text);

// How many picks a poll takes: { mode: 'one'|'upto'|'exact'|'any', n, legacy }.
// n is capped at the number of options (an "exactly 5" of 4 choices could never
// be met). legacy: an old poll with no rule, which keeps counting as before.
export function pickRule(poll) {
  const p = poll?.pick;
  const count = (poll?.options || []).length + (writeCounts(poll) ? 1 : 0);
  if (p && ['one', 'upto', 'exact', 'any'].includes(p.mode)) {
    if (p.mode === 'any') return { mode: 'any', n: count, legacy: false };
    if (p.mode === 'one') return { mode: 'one', n: 1, legacy: false };
    const n = Math.max(1, Math.min(Math.floor(Number(p.n)) || 1, MAX_PICK, count || 1));
    return { mode: p.mode, n, legacy: false };
  }
  return poll?.multi ? { mode: 'any', n: count, legacy: true } : { mode: 'one', n: 1, legacy: true };
}

// Whether your own written answer is one of your picks: a choice poll with a
// pick rule for several (up to / exactly N, any number) that takes written
// answers. Polls made before this (no writePick), and "just one", keep
// writing apart from voting, so no vote already in stops counting.
export function writeCounts(poll) {
  return !!poll?.write && !!poll.writePick && (poll.kind || 'choices') === 'choices' && ['upto', 'exact', 'any'].includes(poll.pick?.mode);
}

// Anonymous polls: nobody sees who picked or wrote what until the poll ends
// (anonymous: true). The counts show; your own picks show to you. Ending the
// poll shows everyone's names.
export const hidesVoters = (poll) => !!poll?.anonymous && !poll.closed;

// Whether voting here is "choose, then press Vote" (a rule was set) rather than
// tapping a choice to toggle it (single choice, and old any-number polls).
export const usesVoteButton = (poll) => {
  const r = pickRule(poll);
  return !r.legacy && r.mode !== 'one';
};

const personKeyOf = (o, rename) => (o.person ? nameKey(rename(o.person)) : '');

// The options a voter may pick (not themselves, when the poll says so).
export function eligibleOptions(poll, voterKey, rename = (n) => n) {
  return (poll?.options || []).filter((o) => !(poll.selfVote === false && o.person && personKeyOf(o, rename) === voterKey));
}

// What a voter's picks have to be: { min, max } picks for their vote to count.
export function pickBounds(poll, voterKey = '', rename = (n) => n) {
  const r = pickRule(poll);
  const have = eligibleOptions(poll, voterKey, rename).length + (writeCounts(poll) ? 1 : 0);
  if (r.mode === 'one') return { min: 1, max: 1 };
  if (r.mode === 'any') return { min: 1, max: Math.max(1, have) };
  const n = Math.max(1, Math.min(r.n, have));
  return r.mode === 'exact' ? { min: n, max: n } : { min: 1, max: n };
}

// Can this voter submit these picks (option ids)? { ok, ids, why }. Used by the
// phone before it writes, so an honest phone never saves an invalid vote.
// written: they're also sending their own answer (a pick when writeCounts).
export function checkPicks(poll, ids, voterName, rename = (n) => n, { written = false } = {}) {
  if (!poll || poll.kind === 'text') return { ok: false, ids: [], why: 'This poll takes written answers.' };
  if (poll.closed) return { ok: false, ids: [], why: 'This poll has ended.' };
  const key = nameKey(rename(voterName));
  const byId = new Map((poll.options || []).map((o) => [o.id, o]));
  const unique = [...new Set(ids)];
  if (unique.some((id) => !byId.has(id))) return { ok: false, ids: unique, why: 'One of those choices is gone. Check the poll again.' };
  const ok = new Set(eligibleOptions(poll, key, rename).map((o) => o.id));
  if (unique.some((id) => !ok.has(id))) return { ok: false, ids: unique, why: 'You can’t vote for yourself here.' };
  const { min, max } = pickBounds(poll, key, rename);
  const total = unique.length + (written && writeCounts(poll) ? 1 : 0);
  const own = writeCounts(poll) ? ' (your own answer counts as one)' : '';
  if (total > max) return { ok: false, ids: unique, why: max === 1 ? 'Pick one.' : `You can pick up to ${max}${own}.` };
  if (total < min) return { ok: false, ids: unique, why: min === max ? `Pick ${min}${own}.` : 'Pick at least one.' };
  return { ok: true, ids: unique, why: '' };
}

// The picks of one voter, in the poll's option order: [optionId].
function picksOf(votes, options, voterKey) {
  return options.filter((o) => votes[o.id]?.[voterKey] !== undefined && votes[o.id]?.[voterKey] !== null).map((o) => o.id);
}

// Add up a poll. Returns
//   votes     the votes that count ({ [optionId]: { [voterKey]: name } }, plus
//             text answers when the poll takes them)
//   counts    { [optionId]: number }
//   voters    Set of voter keys whose choices count
//   skipped   Set of voter keys who voted but not in a way the rule allows
//   leaders   Set of option ids at the top (the top N for "up to N"/"exactly N")
//   cut       how many places the leaders cover; line: the count of the last place;
//             tied: more leaders than places (those at the line are tied for it)
// Rules (only for polls with a pick rule): at most N picks count for "up to N"
// (extras in the poll's option order are ignored); "exactly N" counts only a
// voter with exactly N; one pick for "just one". Self-votes never count when
// the poll says selfVote === false. Old polls count every stored vote.
export function pollTally(m, { rename = (n) => n } = {}) {
  const poll = m?.poll || {};
  const options = poll.options || [];
  const all = m?.votes || {};
  const rule = pickRule(poll);
  const keepText = poll.kind === 'text' || poll.write;
  const votes = {};
  if (keepText && all.text) votes.text = all.text;
  const counts = Object.fromEntries(options.map((o) => [o.id, 0]));
  const voters = new Set();
  const skipped = new Set();
  const who = new Set();
  for (const o of options) for (const k of Object.keys(all[o.id] || {})) who.add(k);
  // Written answers that count as a pick (writeCounts), by person.
  const wrote = new Set();
  if (writeCounts(poll))
    for (const [k, a] of Object.entries(all.text || {})) {
      if (!a?.text) continue;
      const key = nameKey(rename(a.name || '')) || k;
      wrote.add(key);
      who.add(k);
    }
  // People who are in two keys (an old id and a renamed one) count once.
  const seen = new Map();
  for (const k of who) {
    const name = options.map((o) => all[o.id]?.[k]).find((v) => typeof v === 'string') ?? all.text?.[k]?.name;
    const key = name ? nameKey(rename(name)) || k : k;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(k);
  }
  for (const [key, keys] of seen) {
    const theirs = new Map(); // option id -> name
    for (const k of keys) for (const o of options) if (all[o.id]?.[k] !== undefined && all[o.id]?.[k] !== null && !theirs.has(o.id)) theirs.set(o.id, all[o.id][k]);
    let picks = options.filter((o) => theirs.has(o.id));
    if (poll.selfVote === false) picks = picks.filter((o) => !(o.person && personKeyOf(o, rename) === key));
    const own = wrote.has(key) ? 1 : 0; // their written answer, as a pick
    let valid = picks.length + own > 0;
    if (!rule.legacy) {
      const { min, max } = pickBounds(poll, key, rename);
      if (rule.mode === 'exact') valid = picks.length + own === min;
      else {
        picks = picks.slice(0, Math.max(0, max - own));
        valid = picks.length + own >= 1;
      }
      if (picks.length + own < min) valid = false;
    }
    if (!valid) {
      if (theirs.size || own) skipped.add(key);
      continue;
    }
    voters.add(key);
    for (const o of picks) {
      counts[o.id]++;
      (votes[o.id] ||= {})[key] = theirs.get(o.id);
    }
  }
  // Leaders: the top choice, or the top N places for a pick-N poll.
  const cut = rule.mode === 'upto' || rule.mode === 'exact' ? rule.n : 1;
  const ranked = Object.values(counts).filter((c) => c > 0).sort((a, b) => b - a);
  const line = ranked.length ? ranked[Math.min(cut, ranked.length) - 1] : 0;
  const leaders = new Set(line ? options.filter((o) => counts[o.id] >= line).map((o) => o.id) : []);
  return { rule, votes, counts, voters, skipped, leaders, cut, line, tied: leaders.size > cut };
}

// The votes that count, for places that only need those.
export const countedVotes = (m, opts) => pollTally(m, opts).votes;

// Whether this person has answered: a vote that counts, or a written answer.
export function hasAnswered(m, name, rename = (n) => n) {
  const key = nameKey(rename(name));
  const t = pollTally(m, { rename });
  if (t.voters.has(key)) return true;
  const text = t.votes.text || {};
  return Object.entries(text).some(([k, a]) => k === key || nameKey(rename(a?.name || '')) === key);
}

// Which option ids a person has stored (counted or not), in option order.
export function myPicks(m, name, rename = (n) => n) {
  const key = nameKey(rename(name));
  const options = m?.poll?.options || [];
  const all = m?.votes || {};
  return options
    .filter((o) =>
      Object.entries(all[o.id] || {}).some(([k, v]) => k === key || (typeof v === 'string' && nameKey(rename(v)) === key)),
    )
    .map((o) => o.id);
}

// Would changing a poll's rule (or who can be picked) make a stored vote that
// counts now fall outside the new rule? Used to keep an edit from quietly
// throwing votes away or trimming them. A choice taken out in the edit is the
// old behavior (its votes stop counting), so it isn't checked here.
export function votesFit(m, nextPoll, { rename = (n) => n } = {}) {
  const before = pollTally(m, { rename });
  const kept = new Set((nextPoll.options || []).map((o) => o.id));
  const lost = [];
  for (const key of before.voters) {
    const ids = (nextPoll.options || []).filter((o) => before.votes[o.id]?.[key] !== undefined).map((o) => o.id);
    const gone = (m.poll.options || []).some((o) => !kept.has(o.id) && before.votes[o.id]?.[key] !== undefined);
    const own = writeCounts(nextPoll) && Object.entries(before.votes.text || {}).some(([k, a]) => a?.text && (k === key || nameKey(rename(a.name || '')) === key)) ? 1 : 0;
    if (!(ids.length + own) || gone) continue;
    const { min, max } = pickBounds(nextPoll, key, rename);
    const okIds = new Set(eligibleOptions(nextPoll, key, rename).map((o) => o.id));
    if (ids.length + own < min || ids.length + own > max || ids.some((id) => !okIds.has(id))) lost.push(key);
  }
  return { ok: lost.length === 0, lost };
}

// Who is leading, in words: "Cooper", "Tied: A and B", "Top 3: A, B, and C",
// or "Top 3: A and B, then a tie for third: C, D, and E" (ties shown as they are).
const PLACES = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
export function pollHeadline(m, { rename = (n) => n } = {}) {
  const t = pollTally(m, { rename });
  const opts = (m.poll?.options || []).filter((o) => t.leaders.has(o.id));
  if (!opts.length) return '';
  const name = (list) => list.map((o) => optionLabel(o, rename));
  const join = (a) => (a.length <= 2 ? a.join(' and ') : `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`);
  if (t.cut === 1) return opts.length > 1 ? `Tied: ${join(name(opts))}` : name(opts)[0];
  if (!t.tied) return `Top ${opts.length}: ${join(name(opts))}`;
  const above = opts.filter((o) => t.counts[o.id] > t.line);
  const level = opts.filter((o) => t.counts[o.id] === t.line);
  const tie = `a tie for ${PLACES[above.length] || 'the last place'}: ${join(name(level))}`;
  return above.length ? `Top ${t.cut}: ${join(name(above))}, then ${tie}` : `Top ${t.cut}: ${tie}`;
}
