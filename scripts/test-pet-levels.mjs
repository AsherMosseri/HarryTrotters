// Pets in 3.2 (functions/shared/pets.js):
// - levels go to 100 on the old curve: every xp keeps the level it had when
//   the top was 30 (nobody drops), and each level past 30 takes longer;
// - titles, rings, gear and nextUnlock past 30 (Royal crown at 50, the jersey
//   at 100 in the Outfit slot), and gear checks for the new slot;
// - more pets: another one (adopt, a baby or a gift) once every pet is
//   level 5, up to the safety limit of 20;
// - pets after the second live in the doc's `more` list, round trip intact,
//   and older docs (no `more`) read as before;
// - every species has art data (a name, a food) and the four new ones exist.
// Run: node scripts/test-pet-levels.mjs
import * as P from '../functions/shared/pets.js';

let failures = 0;
let passes = 0;
const check = (ok, label) => {
  if (ok) passes++;
  else {
    failures++;
    console.log('FAIL', label);
  }
};

// ---- levels ----
// The 3.1 code, pinned: level from xp with the top at 30.
const oldLevel = (xp) => Math.min(30, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 6)));
check(P.MAX_LEVEL === 100, 'MAX_LEVEL is 100');
for (let xp = 0; xp <= 60000; xp++) {
  const now = P.levelOf(xp).level;
  if (now < oldLevel(xp)) check(false, `xp ${xp} dropped from ${oldLevel(xp)} to ${now}`);
  if (oldLevel(xp) < 10 && now !== oldLevel(xp)) check(false, `xp ${xp} changed level under 10: ${oldLevel(xp)} → ${now}`);
  const L = P.levelOf(xp);
  if (!(L.from <= xp && (L.level === 100 || xp < L.to))) check(false, `xp ${xp} outside its level ${L.level} (${L.from}-${L.to})`);
}
for (let l = 1; l <= 100; l++) if (P.levelOf(P.xpFor(l)).level !== l || (l > 1 && P.levelOf(P.xpFor(l) - 1).level !== l - 1)) check(false, `level ${l} starts at its xp`);
check(P.xpFor(30) === 1686 && P.xpFor(50) === 2886 && P.xpFor(100) === 5886, `3.2 curve: 30 at ${P.xpFor(30)}, 50 at ${P.xpFor(50)}, 100 at ${P.xpFor(100)}`);
check(P.levelOf(P.xpFor(100)).level === 100 && P.levelOf(1e12).level === 100, 'level 100 is the top');
check(P.levelOf(1e12).progress === 1, 'top level: full bar');
for (let l = 12; l <= 100; l++) if (P.xpFor(l) - P.xpFor(l - 1) !== 60) check(false, `level ${l} costs 60`);
check(P.xpFor(11) - P.xpFor(10) === 60 && P.xpFor(10) - P.xpFor(9) === 102, 'the bend at 10');
const mid = P.levelOf(P.xpFor(60) + 10);
check(mid.from === P.xpFor(60) && mid.to === P.xpFor(61) && mid.progress > 0 && mid.progress < 1, 'progress inside level 60');
check(true, 'every xp from 0 to 60,000 has a level at least as high as before');

// ---- titles, rings, gear, unlocks ----
check(P.titleOf(30) === 'Hall of Famer' && P.titleOf(49) === 'Icon' && P.titleOf(50) === 'Royalty' && P.titleOf(100) === 'All-Star', 'titles past 30');
check(P.ringOf(30) === 'gold' && P.ringOf(50) === 'platinum' && P.ringOf(75) === 'diamond' && P.ringOf(100) === 'allstar', 'rings past 30');
const crown = P.gearItem('royalcrown');
const jersey = P.gearItem('jersey');
check(crown && crown.level === 50 && crown.slot === 'head', 'Royal crown: head, level 50');
check(jersey && jersey.level === 100 && jersey.slot === 'body', 'jersey: outfit, level 100');
check(P.GEAR_SLOTS.some((s) => s.id === 'body'), 'Outfit slot');
check(P.nextUnlock(30)?.id === 'royalcrown' && P.nextUnlock(31)?.level === 50, 'after 30, the Royal crown is next');
check(P.nextUnlock(50)?.level === 75 && P.nextUnlock(99)?.id === 'jersey' && P.nextUnlock(100) === null, 'next unlocks to 100, none at the top');
check(P.gearCheck({ body: 'jersey' }, 99).error === 'Number 12 jersey unlocks at level 100.', 'jersey locked at 99');
check(P.gearCheck({ body: 'jersey', head: 'royalcrown' }, 100).gear?.body === 'jersey', 'jersey and crown at 100');
check(!!P.gearCheck({ head: 'jersey' }, 100).error && !!P.gearCheck({ body: 'royalcrown' }, 100).error, 'wrong slots refused');
check(P.cleanGear({ head: 'cap' }).body === '' && P.cleanGear({ body: 'jersey' }).body === 'jersey', 'cleanGear knows the body slot');
const path = P.levelPath();
check(path.at(-1).level === 100 && path.some((r) => r.level === 5 && r.unlocks.some((u) => u.kind === 'room')), 'level path to 100, room at 5');

// ---- species ----
for (const id of ['goat', 'molerat', 'starmole', 'goldendoodle']) check(P.isSpecies(id), `species ${id}`);
check(P.SPECIES.every((s) => s.name && s.food), 'every species has a name and a food');
check(new Set(P.SPECIES.map((s) => s.id)).size === P.SPECIES.length, 'species ids unique');

// ---- docs with more pets ----
const me = 'Sebastian Tolbert';
const day = 86400000;
const now = Date.UTC(2026, 10, 5, 20);
// Lab shifts that give pets adopted 40 days ago plenty of levels (8 h a day).
const shifts = Array.from({ length: 30 }, (_, i) => {
  const start = now - (i + 1) * day;
  return { person: me, start, end: start + 8 * 3600000 };
});
const pet = (name, ago, extra = {}) => ({ ...P.newPet('cat', name, now - ago * day), ...extra });
const list = [pet('A', 40), pet('B', 39), pet('C', 38), pet('D', 37)];
const doc = P.docOf(me, list);
check(doc.extra?.name === 'B' && doc.more?.length === 2 && doc.more[1].name === 'D', 'docOf: first, extra, more');
check(!('person' in doc.extra) && doc.more.every((p) => !('person' in p) && !('more' in p)), 'docOf: no person or nesting below the top');
const back = P.petsIn(doc);
check(back.map((p) => p.name).join() === 'A,B,C,D' && back.every((p) => p.person === me), 'petsIn: round trip');
check(P.petsIn({ ...P.docOf(me, list.slice(0, 2)) }).length === 2 && !('more' in P.docOf(me, list.slice(0, 2))), 'two pets: no more list');
const older = { ...list[0], person: me, extra: { ...list[1] } };
check(P.petsIn(older).map((p) => p.name).join() === 'A,B', 'an older doc reads as before');
const fed = P.withPet(doc, 3, { cared: 9 });
check(P.petsIn(fed)[3].cared === 9 && P.petsIn(fed)[0].cared === 0 && P.petsIn(fed).length === 4, 'withPet changes one pet');

// ---- room for another pet ----
const lv = (...ls) => ls.map((level, i) => ({ name: `P${i}`, level }));
check(P.roomBlock([]) === null, 'no pets: room');
check(P.roomBlock(lv(5)) === null && P.roomBlock(lv(5, 12, 99)) === null, 'all at 5 or more: room');
check(!!P.roomBlock(lv(5, 4))?.note && P.roomBlock(lv(5, 4)).note.body.includes('P1 is level 4'), 'one under 5: blocked, named');
check(!!P.roomBlock(lv(...Array(20).fill(50)))?.note.title.includes('20'), 'safety limit 20');
check(P.roomBlock(lv(...Array(19).fill(50))) === null, '19 pets at 50: room for a 20th');

// adopt: needs room
const one = P.docOf(me, [pet('A', 40)]);
let r = P.petEdit('adopt', { species: 'goat', name: 'Clover' }, { me, doc: one, shifts, now });
check(r.ok && P.petsIn(r.doc).length === 2 && P.petsIn(r.doc)[1].species === 'goat', 'adopt a second pet when the first is level 5+');
const two = r.doc;
r = P.petEdit('adopt', { species: 'dog', name: 'Rex' }, { me, doc: two, shifts, now: now + 1000 });
check(!!r.note && r.note.body.includes('Clover is level 1'), 'adopt blocked by a new pet under 5');
r = P.petEdit('adopt', { species: 'dog', name: 'Rex' }, { me, doc: null, shifts, now });
check(r.ok && P.petsIn(r.doc).length === 1, 'first adopt as before');
r = P.petEdit('adopt', { species: 'nope', name: 'Rex' }, { me, doc: one, shifts, now });
check(r.note?.title === 'Pick a pet.', 'unknown species refused');

// a later shift grows Clover: then a third pet and a baby
const later = now + 10 * day;
const more = [...shifts, ...Array.from({ length: 5 }, (_, i) => ({ person: me, start: now + (i + 1) * day, end: now + (i + 1) * day + 8 * 3600000 }))];
r = P.petEdit('adopt', { species: 'starmole', name: 'Twinkle' }, { me, doc: two, shifts: more, now: later });
check(r.ok && P.petsIn(r.doc).length === 3 && r.doc.more?.[0].name === 'Twinkle', 'third pet once both are level 5+ (in `more`)');
const three = r.doc;
r = P.petEdit('hatch', { born: P.petsIn(three)[0].adoptedAt, name: 'Kit' }, { me, doc: three, shifts: more, now: later + 1000 });
check(!!r.note && r.note.body.includes('Twinkle is level 1'), 'baby blocked by a pet under 5');
r = P.petEdit('hatch', { born: P.petsIn(two)[0].adoptedAt, name: 'Kit' }, { me, doc: two, shifts: more, now: later });
check(r.ok && P.petsIn(r.doc).length === 3 && P.petsIn(r.doc)[0].babyBorn && P.petsIn(r.doc)[2].name === 'Kit', 'baby once every pet is 5+');
check(!!P.hatchBlock({ name: 'A', babyBorn: false }, 9, [])?.note && P.hatchBlock({ name: 'A', babyBorn: false }, 10, lv(10)) === null, 'hatchBlock: level 10 and room');
// release from the middle keeps the rest in order
r = P.petEdit('release', { born: P.petsIn(three)[1].adoptedAt }, { me, doc: three, shifts: more, now: later });
check(r.ok && P.petsIn(r.doc).map((p) => p.name).join() === 'A,Twinkle' && !r.doc.more, 'release the second of three');
// style the third pet
r = P.petEdit('style', { born: P.petsIn(three)[2].adoptedAt, gear: { head: 'cap' } }, { me, doc: three, shifts: more, now: later });
check(!!r.note, 'a level 1 third pet can’t wear a level 4 cap');

// gifts: accept needs room
const giverDoc = P.docOf('Cooper Mlezcko', [{ ...pet('Gifty', 50), person: 'Cooper Mlezcko' }]);
const gift = { from: 'Cooper Mlezcko', to: me, pet: { ...P.petsIn(giverDoc)[0] }, at: now, status: 'pending' };
r = P.giftAccept(gift, { me, doc: two, giverDoc, giver: 'Cooper Mlezcko', shifts, now: now + 1000 });
check(!!r.note && !r.status && r.note.body.includes('Clover'), 'gift waits while a pet is under 5');
r = P.giftAccept(gift, { me, doc: one, giverDoc, giver: 'Cooper Mlezcko', shifts, now: now + 1000 });
check(r.ok && P.petsIn(r.doc).length === 2 && r.giverDoc === null, 'gift accepted with room');
r = P.giftAccept(gift, { me, doc: three, giverDoc, giver: 'Cooper Mlezcko', shifts: more, now: later });
check(!!r.note, 'gift blocked for a three-pet owner with a level 1 pet');
const full = P.docOf(me, Array.from({ length: 20 }, (_, i) => pet(`N${i}`, 40 - i * 0.01)));
r = P.giftAccept(gift, { me, doc: full, giverDoc, giver: 'Cooper Mlezcko', shifts, now: now + 1000 });
check(!!r.note && r.note.title.includes('20'), 'gift blocked at 20 pets');

console.log(`${failures ? 'FAILED' : 'OK'}: ${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
