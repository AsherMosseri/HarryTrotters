// Pets can die (functions/shared/petdeath.js, 3.3): the 7-day streak with
// the real decay math, warnings on days 3, 5 and 6 (once each), care that
// resets it, sleeping while the owner is inactive, people with pet death
// turned off, several pets, renamed owners, the decision function run again
// on its own result, and adopting again (3 respects or 3 days).
// Run: node scripts/test-petdeath.mjs
import {
  ADOPT_WAIT_DAYS,
  NEGLECT_DAYS,
  RESPECTS_NEEDED,
  adoptFree,
  adoptWait,
  adoptWaitText,
  answerCheck,
  answerNote,
  askCheck,
  deathNote,
  funeralPost,
  giftsFor,
  livedText,
  memorialId,
  memorialOf,
  neglectLine,
  neglectWithOff,
  offNames,
  petFate,
  respectsCheck,
  respectsOf,
  memorialLine,
  sleepLine,
  streakStart,
  warnNote,
  zeroAt,
} from '../functions/shared/petdeath.js';
import { careAfter, giftAccept, giftOpen, needNow, newPet, petItem, petsIn, docOf } from '../functions/shared/pets.js';
import { activityOf } from '../functions/shared/activity.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const H = 3600000;
const D = 24 * H;
const T0 = Date.parse('2026-11-02T17:00:00Z');

// A pet fed to 80/80 at T0: food (15 a day) shows 0 after 79.5/15 = 5.3 days,
// fun (12 a day) after 79.5/12 = 6.625 days. Both at 0 from 6.625 days on.
const fresh = (over = {}) => ({ ...newPet('dog', 'Bolt', T0), person: 'Asher Mosseri', ...over });
const pet0 = fresh();
const both0 = T0 + 6.625 * D;
eq(zeroAt(pet0, 'food'), Math.ceil(T0 + (79.5 / 15) * D), 'food reaches 0 after 5.3 days');
eq(zeroAt(pet0, 'fun'), Math.ceil(both0), 'fun reaches 0 after 6.625 days');
eq(needNow(pet0, 'food', zeroAt(pet0, 'food') + 1), 0, 'needNow agrees food shows 0 just after');
eq(needNow(pet0, 'fun', zeroAt(pet0, 'fun') - 60000) > 0, true, 'and fun still shows 1 a minute before');
eq(zeroAt({ adoptedAt: 5, food: { v: 0, at: 100 } }, 'food'), 100, 'already 0: from when it was stored');
eq(zeroAt({ adoptedAt: 5 }, 'food'), 5, 'no need stored: 0 since adoption');

// The server watches it from T0 (its first check sets `from`).
const first = petFate(pet0, { now: T0 });
eq(first.status, 'fine', 'a fed pet is fine');
eq(first.patch?.from, T0, 'the first check starts the clock from now');
const watched = { ...pet0, neglect: first.patch };
eq(petFate(watched, { now: T0 + H }).patch, null, 'running it again changes nothing');
eq(streakStart(watched, T0, T0 + 6 * D), 0, 'no streak while fun is still above 0');
eq(streakStart(watched, T0, T0 + 7 * D), Math.ceil(both0), 'the streak starts when the later need hits 0');

// Simulate a check every 4 hours: warnings by day, once each, then death.
function simulate(pet, { from, to, step = 4 * H, ctx = () => ({}) }) {
  let p = pet;
  const warns = [];
  let died = null;
  for (let t = from; t <= to && !died; t += step) {
    const f = petFate(p, { now: t, ...ctx(t) });
    if (f.warn) warns.push({ stage: f.warn, day: f.day, at: t });
    if (f.status === 'dies') died = { at: t, day: f.day };
    if (f.patch) p = { ...p, neglect: f.patch };
  }
  return { pet: p, warns, died };
}
const run = simulate(watched, { from: T0, to: T0 + 20 * D });
eq(
  run.warns.map((w) => w.stage),
  [3, 5, 6],
  'three warnings: day 3, day 5, day 6',
);
eq(
  run.warns.map((w) => w.day),
  [3, 5, 6],
  'each on its day of the streak',
);
eq(run.died && run.died.at >= both0 + NEGLECT_DAYS * D && run.died.at < both0 + NEGLECT_DAYS * D + 4 * H, true, 'dies at the first check after 7 full days');
eq(run.warns[0].at >= both0 + 3 * D, true, 'no warning before day 3');

// The decision run twice on the same doc (two checks at once) warns once.
const day3 = Math.ceil(both0) + 3 * D + H;
const a = petFate(watched, { now: day3 });
eq([a.status, a.day, a.warn, a.left], ['neglected', 3, 3, 4], 'day 3: neglected, warn 3, 4 days left');
const b = petFate({ ...watched, neglect: a.patch }, { now: day3 + 60000 });
eq([b.warn, b.patch], [0, null], 'the same check again (on its result): no second warning, no write');
const late = petFate(watched, { now: Math.ceil(both0) + 5 * D + H });
eq(late.warn, 5, 'a late check jumps straight to the day 5 warning (only the latest)');
const after = petFate({ ...watched, neglect: late.patch }, { now: Math.ceil(both0) + 5 * D + 2 * H });
eq(after.warn, 0, '...and day 3 is not sent afterwards');
const dying = petFate(watched, { now: Math.ceil(both0) + 7 * D });
eq([dying.status, dying.day], ['dies', 7], 'day 7: dies');
eq(petFate(watched, { now: Math.ceil(both0) + 7 * D - 1 }).status, 'neglected', 'a moment before 7 days: still alive');

// Care resets it: a snack on day 5 lifts food above 0.
{
  const t = Math.ceil(both0) + 5 * D + H;
  const f5 = petFate(watched, { now: t });
  let p = { ...watched, neglect: f5.patch };
  const fed = careAfter(p, petItem('snack'), t);
  p = { ...p, ...fed };
  eq(needNow(p, 'food', t), 25, 'snack: food 25');
  eq(needNow(p, 'fun', t), 0, 'fun still 0');
  const f = petFate(p, { now: t + H });
  eq(f.status, 'fine', 'a snack ends the streak');
  // Food runs out again 24.5/15 days later: a new streak, warnings start over.
  const back0 = zeroAt(p, 'food');
  eq(Math.abs(back0 - (t + (24.5 / 15) * D)) <= 1, true, 'the snack lasts about a day and a half');
  const r = simulate({ ...p, neglect: f.patch || p.neglect }, { from: t + H, to: t + 15 * D });
  eq(
    r.warns.map((w) => w.stage),
    [3, 5, 6],
    'a new streak: all three warnings again',
  );
  eq(r.died && r.died.at >= back0 + 7 * D, true, 'and 7 full days from the new start');
  // A toy on day 6 (fun only) resets it too.
  const t6 = Math.ceil(both0) + 6 * D + H;
  const toy = { ...watched, ...careAfter(watched, petItem('toy'), t6) };
  eq(petFate(toy, { now: t6 + H }).status, 'fine', 'a toy on day 6 saves it');
}

// Sleeping while the owner is inactive.
{
  const t = Math.ceil(both0) + 5 * D;
  const s1 = petFate(watched, { now: t, asleep: true });
  eq([s1.status, s1.warn], ['asleep', 0], 'asleep: no warnings');
  eq(s1.patch.asleep, true, 'marked asleep');
  const p = { ...watched, neglect: s1.patch };
  eq(petFate(p, { now: t + 30 * D, asleep: true }).status, 'asleep', 'can’t die however long they’re away');
  eq(petFate(p, { now: t + 30 * D, asleep: true }).patch, null, 'nothing more to write while asleep');
  // Back: the clock starts fresh from the moment they're active again.
  const back = t + 30 * D;
  const w = petFate(p, { now: back });
  eq([w.status, w.patch.asleep, w.patch.from], ['neglected', false, back], 'awake: still starving, but the clock starts fresh');
  eq(w.day, 0, 'day 0 of a new streak');
  const r = simulate({ ...p, neglect: w.patch }, { from: back, to: back + 10 * D });
  eq(r.died && r.died.at >= back + 7 * D, true, 'dies only 7 days after waking, if still neglected');
  eq(
    r.warns.map((x) => x.stage),
    [3, 5, 6],
    'with all three warnings after waking',
  );
  // With the real inactivity rule: 3 weeks with no lab time.
  const shifts = [{ person: 'Asher Mosseri', start: T0 - 30 * D, end: T0 - 30 * D + 2 * H }];
  eq(activityOf('Matthew Kuehl', { shifts: [{ person: 'Matthew Kuehl', start: T0 - 30 * D, end: T0 - 30 * D + H }], now: T0 }).inactive, true, 'activity.js: 30 days away is inactive');
  eq(activityOf('Asher Mosseri', { shifts, now: T0 }).inactive, false, 'team management is never inactive (their pets never sleep)');
}

// Turned off for the owner: hungry, never dies; back on starts fresh.
{
  const t = Math.ceil(both0) + 6 * D;
  const o = petFate(watched, { now: t, off: true });
  eq([o.status, o.warn, o.patch.off], ['off', 0, true], 'off: no warnings, marked off');
  const p = { ...watched, neglect: o.patch };
  eq(petFate(p, { now: t + 40 * D, off: true }).status, 'off', 'can’t die with pet death off');
  eq(needNow(p, 'food', t + 40 * D), 0, 'but it still gets hungry');
  const on = petFate(p, { now: t + 40 * D });
  eq([on.status, on.day, on.patch.off, on.patch.from], ['neglected', 0, false, t + 40 * D], 'back on: a fresh week');
  // The answer itself flips it right away (neglectWithOff), same result.
  eq(neglectWithOff(watched.neglect, true, t).off, true, 'approving marks the pets off at once');
  eq(neglectWithOff(o.patch, false, t + 1).from, t + 1, 'turning it back on starts the clock at once');
  eq(petFate({ ...p, neglect: neglectWithOff(o.patch, false, t + 1) }, { now: t + 2 }).patch, null, '...so the next check has nothing to change');
}

// Several pets: each on its own clock.
{
  const fed = fresh({ adoptedAt: T0 + 1, food: { v: 100, at: T0 + 9 * D }, fun: { v: 100, at: T0 + 9 * D } });
  const doc = docOf('Asher Mosseri', [watched, { ...fed, neglect: { from: T0 } }]);
  const list = petsIn(doc);
  const t = Math.ceil(both0) + 7 * D + H;
  const fates = list.map((p) => petFate(p, { now: t }));
  eq(
    fates.map((f) => f.status),
    ['dies', 'fine'],
    'two pets: the neglected one dies, the fed one is fine',
  );
  const left = docOf(
    'Asher Mosseri',
    list.filter((_, i) => fates[i].status !== 'dies'),
  );
  eq([petsIn(left).length, petsIn(left)[0].name, petsIn(left)[0].adoptedAt], [1, 'Bolt', T0 + 1], 'the other pet moves up and stays');
}

// A new pet can't die of its old needs: the clock never counts from before
// it came (a gift of a starving pet starts at the gift).
{
  const starving = { ...watched, food: { v: 0, at: T0 }, fun: { v: 0, at: T0 } };
  const gift = { status: 'pending', at: T0 + 20 * D, from: 'Jackson Lucks', to: 'Asher Mosseri', pet: { adoptedAt: starving.adoptedAt, name: 'Bolt' } };
  const r = giftAccept(gift, { me: 'Asher Mosseri', doc: null, giverDoc: docOf('Jackson Lucks', [starving]), giver: 'Jackson Lucks', now: T0 + 21 * D });
  eq(r.ok && r.pet.neglect, undefined, 'a gift leaves the old owner’s clock behind');
  const f = petFate({ ...r.pet, person: 'Asher Mosseri' }, { now: T0 + 22 * D });
  eq([f.status, f.day, f.warn], ['neglected', 0, 0], 'not watched yet: starving, but day 0 from now');
  const g = petFate({ ...r.pet, neglect: f.patch }, { now: T0 + 22 * D + 7 * D + H });
  eq(g.status, 'dies', '...but if nobody feeds it, 7 days after the new owner got it');
  eq(petFate({ ...r.pet, neglect: f.patch }, { now: T0 + 22 * D + 6 * D }).status, 'neglected', 'not before');
  // Not watched yet (before 3.3): a long-starving pet gets its full week.
  const old = petFate({ ...starving, neglect: undefined }, { now: T0 + 60 * D });
  eq([old.status, old.day, old.patch.from], ['neglected', 0, T0 + 60 * D], 'first check after the update: the week starts now, no sudden death');
}

// Gifts: an open offer of the pet that died is cancelled; others stay.
{
  const now = T0 + 2 * D;
  const gifts = [
    { id: 'g1', status: 'pending', at: T0, pet: { adoptedAt: T0 } },
    { id: 'g2', status: 'pending', at: T0, pet: { adoptedAt: T0 + 1 } },
    { id: 'g3', status: 'declined', at: T0, pet: { adoptedAt: T0 } },
  ];
  eq(
    giftsFor(gifts, watched, (g) => giftOpen(g, now)).map((g) => g.id),
    ['g1'],
    'only the open offer for that pet is cancelled',
  );
}

// The memorial, the card, the notes.
{
  const t = Math.ceil(both0) + 7 * D + H;
  const shifts = [{ person: 'Asher Mosseri', start: T0 + H, end: T0 + 3 * H }];
  const id = memorialId('asher-mosseri', watched);
  eq(id, `asher-mosseri-${T0}`, 'memorial id: the doc and when the pet came (one per pet)');
  const m = memorialOf(watched, { id, person: 'Asher Mosseri', shifts, now: t });
  eq([m.name, m.species, m.level, m.lived, m.respects.length, m.msgId], ['Bolt', 'dog', 2, '13 days', 0, `funeral-${id}`], 'memorial: name, kind, level, how long it lived');
  const post = funeralPost(m);
  eq([post.by, post.bot, post.cmd.name, post.cmd.id, post.at], ['Trotbot', true, 'funeral', id, t], 'funeral card: Trotbot, in #general, points at the memorial');
  eq(/🌈 Bolt crossed the rainbow bridge/.test(post.text), true, 'card text is gentle');
  eq(/coin/i.test(JSON.stringify(post) + JSON.stringify(m)), false, 'no coins anywhere');
  eq(deathNote(m).title, 'Bolt crossed the rainbow bridge', 'owner note title');
  eq(warnNote('Bolt', 3).title, 'Bolt is starving and bored', 'warning title');
  eq(warnNote('Bolt', 3).body.startsWith('Feed or play with it, or it won’t make it.'), true, 'warning body (Asher’s words)');
  eq(/Less than a day/.test(warnNote('Bolt', 6).body), true, 'day 6: less than a day left');
  eq(neglectLine('Bolt', { status: 'neglected', day: 6, left: 1 }), 'Bolt has had no food or fun for 6 days. Less than a day left. A snack or a toy saves it.', 'card line on day 6');
  eq(livedText(T0, T0 + 3 * H), 'less than a day', 'lived: hours');
  eq(livedText(T0, T0 + 40 * D), '5 weeks', 'lived: weeks');
  eq(livedText(T0, T0 + 200 * D), '6 months', 'lived: months');
}

// Paying respects: once per person, never the owner, renamed people count once.
{
  const rename = (n) => (n === 'Matthew Kuhle' ? 'Matthew Kuehl' : n);
  let m = { id: 'x', person: 'Asher Mosseri', name: 'Bolt', diedAt: T0, respects: [] };
  eq(respectsCheck(m, { me: 'Asher Mosseri' }).note?.title, 'Your teammates pay respects here.', 'the owner can’t pay respects to their own pet');
  const r1 = respectsCheck(m, { me: 'Jackson Lucks', now: T0 + 1 });
  eq(r1.respects, [{ name: 'Jackson Lucks', at: T0 + 1 }], 'a teammate pays respects');
  m = { ...m, respects: r1.respects };
  eq(respectsCheck(m, { me: 'Jackson Lucks' }), { ok: true, already: true }, 'twice: nothing more');
  m = { ...m, respects: [...m.respects, { name: 'Matthew Kuhle', at: T0 + 2 }] };
  eq(respectsCheck(m, { me: 'Matthew Kuehl', rename }), { ok: true, already: true }, 'under a new name: still once');
  eq(respectsOf(m, rename), ['Jackson Lucks', 'Matthew Kuehl'], 'the list, under current names');
  eq(respectsCheck(null, { me: 'X' }).note?.title, 'That memorial is gone.', 'no memorial');
  // A renamed owner still can't.
  const mo = { id: 'y', person: 'Matthew Kuhle', name: 'Pip', diedAt: T0, respects: [] };
  eq(!!respectsCheck(mo, { me: 'Matthew Kuehl', rename }).note, true, 'renamed owner: still their own pet');
}

// Adopting again: 3 respects or 3 days, whichever comes first.
{
  const rename = (n) => (n === 'Matthew Kuhle' ? 'Matthew Kuehl' : n);
  const m = { id: 'm1', person: 'Matthew Kuhle', name: 'Pip', diedAt: T0, respects: [] };
  const w = adoptWait([m], { me: 'Matthew Kuehl', now: T0 + H, rename });
  eq([w?.need, w?.respects, w?.until], [RESPECTS_NEEDED, 0, T0 + ADOPT_WAIT_DAYS * D], 'right after: waiting (renamed owner found)');
  eq(adoptWaitText(w, T0 + H), 'You can adopt again once 3 more teammates pay respects to Pip, or in 3 days.', 'the words');
  eq(adoptWait([m], { me: 'Jackson Lucks', now: T0 + H, rename }), null, 'someone else isn’t held back');
  const two = { ...m, respects: [{ name: 'A B' }, { name: 'C D' }] };
  eq(adoptWait([two], { me: 'Matthew Kuehl', now: T0 + H, rename })?.need, 1, 'two respects: one more to go');
  eq(adoptWaitText(adoptWait([two], { me: 'Matthew Kuehl', now: T0 + 2 * D + 20 * H, rename }), T0 + 2 * D + 20 * H), 'You can adopt again once 1 more teammate pays respects to Pip, or in 4 hours.', 'singular, hours');
  const three = { ...m, respects: [{ name: 'A B' }, { name: 'C D' }, { name: 'E F' }] };
  eq(adoptFree(three, T0 + H, rename), true, 'three respects: free at once');
  const ownerToo = { ...m, respects: [{ name: 'A B' }, { name: 'C D' }, { name: 'Matthew Kuehl' }] };
  eq(adoptFree(ownerToo, T0 + H, rename), false, 'the owner’s own name doesn’t count');
  const dup = { ...m, respects: [{ name: 'A B' }, { name: 'A B' }, { name: 'C D' }] };
  eq(adoptFree(dup, T0 + H, rename), false, 'the same person twice counts once');
  eq(adoptFree(m, T0 + ADOPT_WAIT_DAYS * D - 1, rename), false, 'a moment before 3 days: still waiting');
  eq(adoptFree(m, T0 + ADOPT_WAIT_DAYS * D, rename), true, '3 days: free with no respects');
  const later = { ...m, id: 'm2', diedAt: T0 + D };
  eq(adoptWait([m, later], { me: 'Matthew Kuehl', now: T0 + H, rename })?.memorial.id, 'm2', 'two pets died: waits for the later one');
}

// Asking Asher to turn it off: one at a time, declined can ask again.
{
  const owner = 'Asher Mosseri';
  const a1 = askCheck({ reason: ' Away for <b>winter</b> break ' }, { me: 'Cooper Mlezcko', doc: null, owner, now: T0 });
  eq([a1.doc.status, a1.doc.reason, a1.doc.by], ['pending', 'Away for b winter /b break', 'Cooper Mlezcko'], 'asking: pending, reason cleaned');
  eq(askCheck({}, { me: 'Cooper Mlezcko', doc: a1.doc, owner }).note?.title, 'You already asked.', 'one ask at a time');
  eq(askCheck({ reason: 'x'.repeat(500) }, { me: 'C', doc: null, owner }).doc.reason.length, 140, 'reason capped at 140');
  const dec = answerCheck({ decision: 'decline', note: 'Not during build season' }, { doc: a1.doc, me: owner, now: T0 + H });
  eq([dec.doc.status, dec.doc.note, dec.told], ['declined', 'Not during build season', 'declined'], 'declined with a reason');
  eq(answerNote('declined', dec.doc).body, 'Not during build season You can ask again later.', 'they see why, and that they can ask again');
  eq(answerCheck({ decision: 'approve' }, { doc: dec.doc, me: owner }).note?.title, 'That ask was already answered.', 'can’t approve an answered ask');
  const again = askCheck({ reason: 'Please' }, { me: 'Cooper Mlezcko', doc: dec.doc, owner, now: T0 + D });
  eq(again.doc.status, 'pending', 'declined: can ask again');
  const ok = answerCheck({ decision: 'approve', note: '' }, { doc: again.doc, me: owner, now: T0 + D + H });
  eq([ok.doc.status, ok.doc.note], ['off', 'Asher said yes.'], 'approved (no reason given: a kind default)');
  eq(askCheck({}, { me: 'Cooper Mlezcko', doc: ok.doc, owner }).note?.title, 'Pet death is already off for you.', 'off: nothing to ask');
  eq([...offNames([ok.doc, { by: 'Matthew Kuhle', status: 'off' }], (n) => (n === 'Matthew Kuhle' ? 'Matthew Kuehl' : n))], ['Cooper Mlezcko', 'Matthew Kuehl'], 'who has it off (renamed too)');
  const back = answerCheck({ decision: 'restore', note: 'Season’s over' }, { doc: ok.doc, me: owner, now: T0 + 9 * D });
  eq([back.doc.status, back.told], ['on', 'on'], 'Asher turns it back on');
  eq(answerCheck({ decision: 'restore' }, { doc: back.doc, me: owner }).note?.title, 'Pet death isn’t off for them.', 'can’t turn on what isn’t off');
  eq(askCheck({}, { me: 'Cooper Mlezcko', doc: back.doc, owner, now: T0 + 10 * D }).doc.status, 'pending', 'back on: can ask again');
  eq(askCheck({}, { me: owner, doc: null, owner, now: T0 }).doc.status, 'off', 'Asher’s own ask is just done');
  eq(answerCheck({ decision: 'nope' }, { doc: a1.doc, me: owner }).note?.title, 'Approve, decline or turn back on?', 'unknown decision');
}

// The words on cards: sleeping, and when the owner can adopt again.
{
  eq(sleepLine('Pepper', { owner: 'Matthew Kuehl', mine: false, why: 'away' }), 'Pepper is asleep until Matthew is back at the lab.', 'asleep: teammates see why');
  eq(sleepLine('Pepper', { mine: true, why: 'away' }).startsWith('Pepper is asleep while you’re away'), true, 'asleep: the owner is told it’s safe');
  eq(sleepLine('Pepper', { why: 'coins' }).includes('Jackson coins are off'), true, 'asleep while coins are off');
  const m = { id: 'x', person: 'Shrey Kumar', name: 'Noodle', diedAt: T0, respects: [{ name: 'Jackson Lucks', at: T0 }] };
  eq(memorialLine(m, { me: 'Shrey Kumar', now: T0 + H }), 'You can adopt again once 2 more teammates pay respects, or in 3 days.', 'owner: how long');
  eq(memorialLine(m, { me: 'Cooper Mlezcko', now: T0 + H }), 'Shrey can adopt again once 2 more teammates pay respects, or in 3 days.', 'teammate: how long');
  const m3 = { ...m, respects: [...m.respects, { name: 'Sophia Bermudez' }, { name: 'Cooper Mlezcko' }] };
  eq(memorialLine(m3, { me: 'Shrey Kumar', now: T0 + H }), 'You can adopt a new pet whenever you’re ready.', 'owner: 3 respects frees it');
  eq(memorialLine(m3, { me: 'Cooper Mlezcko', now: T0 + H }), '', 'teammate: nothing to say once free');
  eq(memorialLine({ ...m, respects: [] }, { me: 'Shrey Kumar', now: T0 + 3 * D }), 'You can adopt a new pet whenever you’re ready.', 'owner: 3 days frees it');
  eq(memorialLine({ ...m, respects: [{ name: 'A' }, { name: 'B' }] }, { me: 'Cooper Mlezcko', now: T0 + 2 * D + 20 * H }), 'Shrey can adopt again once 1 more teammate pays respects, or in 4 hours.', 'one more, hours left');
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
