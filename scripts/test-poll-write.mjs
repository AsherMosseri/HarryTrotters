// Polls: on a "several" choice poll that takes written answers, your own
// written answer is one of your picks (functions/shared/polls.js writeCounts).
//   node scripts/test-poll-write.mjs
import { checkPicks, hidesResults, hidesVoters, privacyOf, pickBounds, pickRule, pollTally, writeCounts, votesFit, hasAnswered } from '../functions/shared/polls.js';

let pass = 0;
let fail = 0;
const eq = (got, want, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const opts = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }];
const poll = (pick, extra = {}) => ({ question: 'Q', kind: 'choices', options: opts, multi: true, write: true, writePick: true, pick, ...extra });
const text = (name, t) => ({ [name.toLowerCase()]: { name, text: t, at: 1 } });
const votes = (picks, writes = {}) => {
  const v = { text: {} };
  for (const [name, ids] of Object.entries(picks)) for (const id of ids) (v[id] ||= {})[name.toLowerCase()] = name;
  for (const [name, t] of Object.entries(writes)) Object.assign(v.text, text(name, t));
  return v;
};

// Which polls count it
eq(writeCounts(poll({ mode: 'upto', n: 2 })), true, 'up to N with write: counts');
eq(writeCounts(poll({ mode: 'exact', n: 2 })), true, 'exactly N with write: counts');
eq(writeCounts(poll({ mode: 'any', n: 3 })), true, 'any number with write: counts');
eq(writeCounts(poll({ mode: 'one', n: 1 })), false, 'just one: kept apart');
eq(writeCounts(poll({ mode: 'upto', n: 2 }, { write: false })), false, 'no write: no');
eq(writeCounts(poll({ mode: 'upto', n: 2 }, { writePick: undefined })), false, 'old poll (no writePick): kept apart');
eq(writeCounts({ ...poll({ mode: 'upto', n: 2 }), pick: undefined }), false, 'old poll with no rule: kept apart');

// N can reach options + 1
eq(pickRule(poll({ mode: 'exact', n: 4 })).n, 4, 'exactly 4 of 3 choices + your own: allowed');
eq(pickRule(poll({ mode: 'exact', n: 5 })).n, 4, 'exactly 5 capped at 3 choices + your own');
eq(pickBounds(poll({ mode: 'any', n: 4 })), { min: 1, max: 4 }, 'any number: up to every choice and your own');

// checkPicks with a written answer
const ex2 = poll({ mode: 'exact', n: 2 });
eq(checkPicks(ex2, ['a'], 'Sam', undefined, { written: true }).ok, true, 'exactly 2: one choice + your own');
eq(checkPicks(ex2, ['a', 'b'], 'Sam', undefined, { written: true }).ok, false, 'exactly 2: two choices + your own is 3');
eq(checkPicks(ex2, ['a', 'b'], 'Sam').ok, true, 'exactly 2: two choices, no writing');
eq(checkPicks(ex2, [], 'Sam', undefined, { written: true }).ok, false, 'exactly 2: only your own is 1');
const up2 = poll({ mode: 'upto', n: 2 });
eq(checkPicks(up2, [], 'Sam', undefined, { written: true }).ok, true, 'up to 2: only your own answer is a vote');
eq(checkPicks(up2, ['a', 'b'], 'Sam', undefined, { written: true }).ok, false, 'up to 2: two choices + your own is too many');
eq(checkPicks(up2, ['a', 'b'], 'Sam', undefined, { written: true }).why, 'You can pick up to 2 (your own answer counts as one).', 'says why');
const old = poll({ mode: 'exact', n: 2 }, { writePick: undefined });
eq(checkPicks(old, ['a', 'b'], 'Sam', undefined, { written: true }).ok, true, 'old poll: writing is extra, as before');

// Tally
let t = pollTally({ poll: ex2, votes: votes({ Sam: ['a'], Kai: ['a', 'b'], Lee: ['b'] }, { Sam: 'Mine', Kai: 'Too many' }) });
eq([...t.voters].sort(), ['sam'], 'exactly 2: Sam (1 + own) counts; Kai (2 + own) and Lee (1) don’t');
eq(t.counts, { a: 1, b: 0, c: 0 }, 'only counted picks add up');
eq([...t.skipped].sort(), ['kai', 'lee'], 'the others are listed as not counting');
t = pollTally({ poll: up2, votes: votes({ Kai: ['a', 'b'] }, { Kai: 'Mine', Jo: 'Only mine' }) });
eq([...t.voters].sort(), ['jo', 'kai'], 'up to 2: Jo wrote only, Kai picked 2 + own');
eq(t.counts, { a: 1, b: 0, c: 0 }, 'up to 2: Kai’s own answer takes a slot, so only their first choice counts');
eq(Object.keys(t.votes.text).sort(), ['jo', 'kai'], 'written answers are all kept');
t = pollTally({ poll: old, votes: votes({ Kai: ['a', 'b'] }, { Kai: 'Mine' }) });
eq([...t.voters], ['kai'], 'old poll: 2 choices + writing still counts as before');
eq(t.counts, { a: 1, b: 1, c: 0 }, 'old poll: both choices count');

// Answered (the required-poll screen)
eq(hasAnswered({ poll: ex2, votes: votes({}, { Jo: 'x' }) }, 'Jo'), true, 'anyone who wrote has answered');

// Editing the rule keeps counted votes counting
const m = { poll: up2, votes: votes({ Sam: ['a'] }, { Sam: 'Mine' }) };
eq(votesFit(m, poll({ mode: 'exact', n: 2 })).ok, true, 'up to 2 → exactly 2: Sam’s 1 + own still fits');
eq(votesFit(m, poll({ mode: 'upto', n: 1 }, { options: opts })).ok, false, 'up to 1 would drop Sam (1 + own = 2)');

// Anonymous until it ends
eq(hidesVoters({ anonymous: true }), true, 'anonymous and open: names hidden');
eq(hidesVoters({ anonymous: true, closed: true }), false, 'anonymous and ended: names show');
eq(hidesVoters({}), false, 'a normal poll shows names');
eq(hidesResults({ anonymous: true }), false, 'anonymous: counts still show');
eq(hidesResults({ anonymous: true, hideResults: true }), true, 'hidden: no counts while open');
eq(hidesVoters({ hideResults: true }), true, 'hidden also hides names');
eq(hidesResults({ hideResults: true, closed: true }), false, 'hidden and ended: everything shows');
eq([privacyOf({}), privacyOf({ anonymous: true }), privacyOf({ anonymous: true, hideResults: true })], ['open', 'anonymous', 'hidden'], 'privacy levels');

console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASSED (${pass})`);
process.exit(fail ? 1 : 0);
