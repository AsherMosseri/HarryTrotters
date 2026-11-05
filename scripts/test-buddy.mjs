// Gambling buddy rules (functions/shared/buddy.js), which the buddy function
// and demo mode both run: who may do what, the lock's states, which play
// requests it stops, and the wrong-password limit (5 an hour).
// Run: node scripts/test-buddy.mjs
import { BUDDY, buddyAction, buddyBlocks, lockNote, passwordProblem, roleOf, triesState } from '../functions/shared/buddy.js';
import { CASINO } from '../functions/shared/casino.js';
import { MULTI } from '../functions/shared/arcade.js';

let failures = 0;
let passes = 0;
const ok = (cond, msg) => {
  if (cond) passes++;
  else {
    failures++;
    console.log('FAIL', msg);
  }
};

const roster = ['Asher Mosseri', 'Cooper Mlezcko', 'Sophia Bermudez', 'Ira Kumar'];
const now = 1_800_000_000_000;
const ctx = (me, extra = {}) => ({ me, roster, now, owner: 'Asher Mosseri', isOwner: me === 'Asher Mosseri', ...extra });
const C = 'Cooper Mlezcko';
const S = 'Sophia Bermudez';

// What it stops.
for (const g of CASINO) ok(buddyBlocks({ action: 'run', game: g, args: ['10'] }), `blocks /${g} 10`);
ok(!buddyBlocks({ action: 'run', game: 'lottery', args: [] }), 'a bare /lottery only shows the card');
ok(buddyBlocks({ action: 'run', game: 'slots', args: [] }), 'a bare /slots is still refused');
for (const g of [...MULTI.filter((x) => x !== 'challenge'), 'daily', 'work', 'beg', 'rob']) ok(!buddyBlocks({ action: 'run', game: g }), `lets /${g} through`);
ok(buddyBlocks({ action: 'run', game: 'challenge' }), 'stops starting a /challenge (3.2: Asher counts it as gambling)');
ok(buddyBlocks({ action: 'move', move: 'double' }), 'blocks doubling down');
for (const mv of ['hit', 'stand', 'cash', 'peek', '3', 'higher', 'accept', 'join']) ok(!buddyBlocks({ action: 'move', move: mv }), `lets the move ${mv} through`);
ok(!buddyBlocks({ action: 'gift', game: 'slots' }) && !buddyBlocks({ action: 'prize' }), 'gifts and prizes go through');
ok(/locked by your buddy/.test(lockNote({ buddy: S }).title) && /Sophia/.test(lockNote({ buddy: S }).body), 'the note names the buddy');

// Asking.
let r = buddyAction(null, { action: 'ask', buddy: S }, ctx(C));
ok(r.lock?.state === 'asked' && r.lock.person === C && r.lock.buddy === S && r.tell[0].to === S, 'ask');
ok(buddyAction(null, { action: 'ask', buddy: C }, ctx(C)).error, 'not yourself');
ok(buddyAction(null, { action: 'ask', buddy: 'Nobody Here' }, ctx(C)).error, 'only teammates');
ok(buddyAction(null, { action: 'ask', buddy: 'Trotbot' }, ctx(C)).error, 'not Trotbot');
const asked = r.lock;
ok(roleOf(asked, C) === 'person' && roleOf(asked, S) === 'buddy' && roleOf(asked, 'Ira Kumar') === '', 'roles');

// Accepting.
ok(buddyAction(asked, { action: 'accept', password: 'abcd' }, ctx(C)).error, 'the person can’t accept');
ok(buddyAction(asked, { action: 'accept', password: 'abc' }, ctx(S)).error, 'too short');
ok(buddyAction(asked, { action: 'accept', password: 'x'.repeat(BUDDY.max + 1) }, ctx(S)).error, 'too long');
r = buddyAction(asked, { action: 'accept', password: 'abcd' }, ctx(S));
ok(r.lock.state === 'on' && r.secret === 'set' && r.tell[0].to === C, 'accept locks it and sets the password');
const on = r.lock;

// While it's on.
for (const a of ['cancel', 'remove', 'leave', 'decline', 'clear', 'accept']) ok(buddyAction(on, { action: a, password: 'abcd' }, ctx(C)).error, `the person can’t ${a}`);
ok(buddyAction(on, { action: 'ask', buddy: 'Ira Kumar' }, ctx(C)).error, 'no switching buddies while locked');
ok(buddyAction(on, { action: 'unlock' }, ctx(C)).error, 'no password, no unlock (person)');
ok(buddyAction(on, { action: 'unlock' }, ctx(C, { check: 'wrong' })).secret === 'wrong', 'a wrong try is counted');
ok(buddyAction(on, { action: 'unlock' }, ctx('Ira Kumar', { check: 'right' })).error, 'someone else can’t unlock');
r = buddyAction(on, { action: 'unlock' }, ctx(C, { check: 'right' }));
ok(r.lock.state === 'off' && r.secret === 'reset' && r.tell[0].to === S, 'the person unlocks with the password');
r = buddyAction(on, { action: 'unlock' }, ctx(S));
ok(r.lock.state === 'off' && r.tell[0].to === C, 'the buddy unlocks without it');
const off = r.lock;
ok(buddyAction(off, { action: 'lock' }, ctx(C)).lock.state === 'on', 'the person locks it again');
ok(buddyAction(off, { action: 'lock' }, ctx(S)).error, 'the buddy doesn’t lock it for them');
ok(buddyAction(off, { action: 'remove' }, ctx(C)).lock === null, 'remove once unlocked');
ok(buddyAction(on, { action: 'leave' }, ctx(S)).lock === null, 'the buddy can step down');
ok(buddyAction(on, { action: 'clear' }, ctx('Asher Mosseri')).lock === null, 'the owner clears');
ok(buddyAction(on, { action: 'clear' }, ctx(S)).error, 'only the owner clears');
ok(buddyAction(asked, { action: 'decline' }, ctx(S)).lock === null, 'the buddy says no');
ok(buddyAction(asked, { action: 'cancel' }, ctx(C)).lock === null, 'the person takes it back while asked');
ok(buddyAction(on, { action: 'unlock' }, { ...ctx(C), rename: (n) => (n === C ? 'Cooper M' : n), me: 'Cooper M', check: 'right' }).lock.state === 'off', 'after a rename');

// The limit: 5 wrong tries in a rolling hour.
const tries = [1, 2, 3, 4, 5].map((k) => now - k * 60000);
let t = triesState(tries, now);
ok(t.blocked && t.left === 0 && t.retryAt === now - 5 * 60000 + BUDDY.window, 'five in the last hour: blocked');
ok(buddyAction(on, { action: 'unlock' }, ctx(C, { check: 'right', tries })).error, 'blocked even with the right password');
ok(/Too many/.test(buddyAction(on, { action: 'unlock' }, ctx(S, { check: 'limited', tries })).error), 'the buddy typing it is limited too');
ok(buddyAction(on, { action: 'unlock' }, ctx(S, { tries })).lock.state === 'off', 'the buddy without a password is never limited');
t = triesState([...tries.slice(0, 4), now - BUDDY.window - 1], now);
ok(!t.blocked && t.left === 1, 'an old try drops off');
ok(/1 try left/.test(buddyAction(on, { action: 'unlock' }, ctx(C, { check: 'wrong', tries: tries.slice(0, 3) })).body), 'tries left');
ok(passwordProblem('abcd') === '' && passwordProblem('') !== '', 'password length');

console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
