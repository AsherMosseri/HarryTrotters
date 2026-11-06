// The market's 3.2.7 changes (functions/shared/market.js): turning your own
// chat extra off and back on (extraSwitchCheck, and every reader of chat
// extras treating one that's off as off).
// Run: node scripts/test-market327.mjs
import { BANNERS_MAX, activeExtras, buyCheck, extraOn, extraSwitchCheck, glows } from '../functions/shared/market.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const H = 3600000;
const now = 1_800_000_000_000;

// ---------- chat extras: off and back on ----------
const glow = { id: 'g1', item: 'extra:glow', kind: 'extra', person: 'Cooper Mlezcko', status: 'active', at: now - 2 * H, until: now + 22 * H, price: 25 };
const me = { aliases: ['Cooper Mlezcko', 'Cooper M'], now };
eq(extraOn(glow, now), true, 'bought: on');
eq(extraOn({ ...glow, paused: true }, now), false, 'paused: off');
eq(extraOn({ ...glow, until: now - 1 }, now), false, 'run out: off');
eq(extraOn({ ...glow, status: 'removed' }, now), false, 'taken down: off');

// Who can.
eq(extraSwitchCheck(glow, false, { aliases: ['Ira Kumar'], now }).error, 'That isn’t yours.', 'someone else can’t turn it off');
eq(extraSwitchCheck(null, false, me).error, 'That chat extra is gone.', 'missing purchase');
eq(extraSwitchCheck({ ...glow, kind: 'perk', item: 'perk:p1' }, false, me).error, 'That chat extra is gone.', 'not a chat extra');
eq(extraSwitchCheck({ ...glow, until: now }, false, me).error, 'It already ran out.', 'ran out');
eq(extraSwitchCheck({ ...glow, status: 'removed' }, false, me).error, 'Team management took that one down.', 'taken down');
eq(extraSwitchCheck({ ...glow, person: 'Cooper M' }, false, me).patch, { paused: true, pausedAt: now }, 'bought under an old name: still the buyer');

// Off, then back on, both idempotent.
const off = extraSwitchCheck(glow, false, me);
eq(off.patch, { paused: true, pausedAt: now }, 'turn off');
const paused = { ...glow, ...off.patch };
eq(extraSwitchCheck(paused, false, { ...me, now: now + 1000 }), { same: true }, 'turning off twice changes nothing');
eq(extraSwitchCheck(glow, true, me), { same: true }, 'turning on something on changes nothing');
const back = extraSwitchCheck(paused, true, { ...me, now: now + H });
eq(back.patch, { paused: false, pausedAt: null, offs: [{ from: now, to: now + H }] }, 'back on: the time it was off is kept');
eq(back.patch.until, undefined, 'the clock keeps running: until is unchanged');
const again = { ...paused, ...back.patch };
eq(extraOn(again, now + H), true, 'on again');

// Glow: messages sent while it was off don't glow; while it's off, none do.
const ex = (list, t) => activeExtras(list, t);
const msg = (at) => ({ by: 'Cooper Mlezcko', at });
eq(glows(ex([glow], now), msg(now - H)), true, 'on: a message glows');
eq(glows(ex([paused], now + 1), msg(now - H)), false, 'off: earlier messages stop glowing');
eq(glows(ex([again], now + H), msg(now - H)), true, 'back on: earlier messages glow again');
eq(glows(ex([again], now + H), msg(now + H / 2)), false, 'back on: a message sent while it was off doesn’t');
eq(glows(ex([again], now + 2 * H), msg(now + 1.5 * H)), true, 'back on: a new message glows');

// Mega and the shout-out banner.
const mega = { ...glow, id: 'm1', item: 'extra:mega' };
eq(ex([mega], now).mega.has('Cooper Mlezcko'), true, 'mega on');
eq(ex([{ ...mega, paused: true }], now).mega.has('Cooper Mlezcko'), false, 'mega off while paused');
const banner = (id, person, extra = {}) => ({ id, item: 'extra:banner', kind: 'extra', person, status: 'active', at: now - H, until: now + 23 * H, text: 'Hi', ...extra });
eq(ex([banner('b1', 'Cooper Mlezcko')], now).banners.length, 1, 'banner on Today');
eq(ex([banner('b1', 'Cooper Mlezcko', { paused: true })], now).banners.length, 0, 'paused banner not on Today');

// Buying again while yours is off: still yours (turn it back on instead).
const bc = buyCheck('extra:glow', { me: 'Cooper Mlezcko', balance: 1000, now, purchases: [paused] });
eq(bc.error, 'You already have this.', 'can’t buy a second while yours is off');
eq(/turn it back on/.test(bc.body), true, 'says to turn it back on');

// Shout-out limit: off ones don't take a place; coming back on needs one.
const three = [banner('b1', 'A'), banner('b2', 'B'), banner('b3', 'C')];
eq(three.length, BANNERS_MAX, 'three shout-outs is the limit');
const mine = banner('b4', 'Cooper Mlezcko', { paused: true, pausedAt: now - 10 });
eq(buyCheck('extra:banner', { me: 'Ira Kumar', balance: 1000, now, text: 'Yo', purchases: [...three.slice(0, 2), { ...three[2], paused: true }] }).error, undefined, 'a paused shout-out leaves room to buy one');
eq(extraSwitchCheck(mine, true, { ...me, purchases: three }).error, 'Today is full of shout-outs.', 'back on refused when Today is full');
eq(extraSwitchCheck(mine, true, { ...me, purchases: three.slice(0, 2) }).patch?.paused, false, 'back on when there’s room');
eq(extraSwitchCheck(mine, false, { ...me, purchases: three }), { same: true }, 'off when already off, even when full');

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
