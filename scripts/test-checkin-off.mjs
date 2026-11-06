// Lab check-in times not available (functions/shared/checkin.js, 3.2.7):
// which times a check-in asks, when someone has answered, the schedule's
// times off per day, what the scheduled check-in starts with, and the tidy-up
// before saving.
// Run: node scripts/test-checkin-off.mjs
import {
  answeredAll,
  asksOn,
  cleanOff,
  offChanges,
  offOf,
  offText,
  openSlots,
  scheduleOffOn,
  scheduledCheckinFields,
  withOff,
  OFF_REASON_MAX,
} from '../functions/shared/checkin.js';

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// ---------- one check-in ----------
const both = { slots: ['lunch', 'after'] };
eq(openSlots(both), ['lunch', 'after'], 'no times off: both asked');
eq(offOf(both), {}, 'no times off');
const lunchOff = { ...both, off: { lunch: 'Lab closed for a teacher meeting' } };
eq(openSlots(lunchOff), ['after'], 'lunch off: only after school asked');
eq(offOf(lunchOff), { lunch: 'Lab closed for a teacher meeting' }, 'the reason comes along');
eq(offOf({ ...both, off: { after: '' } }), { after: '' }, 'no reason is still off');
eq(openSlots({ ...both, off: { after: '' } }), ['lunch'], 'no reason: after school not asked');
eq(offOf({ slots: ['after'], off: { lunch: 'x' } }), {}, 'a time the check-in never asked is ignored');
eq(offOf({ ...both, off: { lunch: null, after: 3 } }), {}, 'only strings count as off');
eq(openSlots({ ...both, off: { lunch: '', after: '' } }), [], 'both off: nothing asked');
eq(openSlots({}), [], 'an old check-in with no slots asks nothing');

// Answered?
eq(answeredAll(both, null), false, 'no answer');
eq(answeredAll(both, { lunch: true }), false, 'half an answer');
eq(answeredAll(both, { lunch: true, after: false }), true, 'both answered');
eq(answeredAll(lunchOff, { after: false }), true, 'lunch off: after school alone is enough');
eq(answeredAll(lunchOff, { lunch: true }), false, 'lunch off: a lunch answer alone is not');
// Turning lunch back on asks people who only answered after school.
eq(answeredAll(both, { after: true, at: 1 }), false, 'lunch back on: asked again for lunch');
eq(answeredAll({ ...both, off: { lunch: '', after: '' } }, null), true, 'nothing open: nothing to answer');

eq(offText('Lab closed for a teacher meeting'), 'Not available: Lab closed for a teacher meeting', 'off text with a reason');
eq(offText(''), 'Not available', 'off text without');

// ---------- the schedule ----------
// Every weekday; Nov 9 2026 is a Monday.
const s = { on: true, mode: 'days', days: [1, 2, 3, 4, 5], time: '07:00', slots: ['lunch', 'after'], skip: [], off: {} };
eq(asksOn(s, '2026-11-09'), true, 'asked on Monday');
eq(asksOn({ ...s, off: { '2026-11-09': { lunch: 'Teacher meeting' } } }, '2026-11-09'), true, 'one time off: still asked');
eq(asksOn({ ...s, off: { '2026-11-09': { lunch: '', after: 'Snow' } } }, '2026-11-09'), false, 'every time off: not asked');
eq(asksOn({ ...s, slots: ['after'], off: { '2026-11-09': { after: '' } } }, '2026-11-09'), false, 'its only time off: not asked');
eq(asksOn({ ...s, slots: ['after'], off: { '2026-11-09': { lunch: '' } } }, '2026-11-09'), true, 'a time it does not ask, off: still asked');
eq(asksOn({ ...s, skip: ['2026-11-09'] }, '2026-11-09'), false, 'skipped still skipped');
eq(asksOn({ ...s, off: { '2026-11-10': { lunch: '', after: '' } } }, '2026-11-09'), true, 'another day off does not matter');
eq(scheduleOffOn({ ...s, off: { '2026-11-09': { lunch: 'x' } } }, '2026-11-09'), { lunch: 'x' }, 'that day’s times off');
eq(scheduleOffOn(s, '2026-11-09'), {}, 'none that day');
eq(scheduleOffOn({ ...s, off: undefined }, '2026-11-09'), {}, 'a schedule saved before times off');

// What the scheduled check-in starts with.
eq(scheduledCheckinFields(s, '2026-11-09'), { slots: ['lunch', 'after'] }, 'no off field when nothing is off');
eq(
  scheduledCheckinFields({ ...s, off: { '2026-11-09': { after: 'Robotics assembly' } } }, '2026-11-09'),
  { slots: ['lunch', 'after'], off: { after: 'Robotics assembly' } },
  'the day’s time off is copied to the check-in',
);

// Saving: past days dropped, unknown times dropped, reasons tidied and cut.
const long = 'x'.repeat(300);
eq(
  cleanOff(
    {
      '2026-11-05': { lunch: 'old' },
      '2026-11-09': { lunch: '  Lab   closed ', bogus: 'y' },
      '2026-11-10': {},
      'not-a-day': { lunch: '' },
      '2026-11-11': { after: long },
      '2026-11-12': 'nope',
    },
    '2026-11-06',
  ),
  { '2026-11-09': { lunch: 'Lab closed' }, '2026-11-11': { after: 'x'.repeat(OFF_REASON_MAX) } },
  'cleanOff',
);
eq(cleanOff(null, '2026-11-06'), {}, 'cleanOff of nothing');

// One time off and back on.
let off = withOff({}, '2026-11-09', 'lunch', 'Teacher meeting');
eq(off, { '2026-11-09': { lunch: 'Teacher meeting' } }, 'withOff adds');
off = withOff(off, '2026-11-09', 'after', '');
eq(off, { '2026-11-09': { lunch: 'Teacher meeting', after: '' } }, 'withOff adds a second time, no reason');
off = withOff(off, '2026-11-09', 'lunch', 'Changed');
eq(off['2026-11-09'].lunch, 'Changed', 'withOff changes the reason');
off = withOff(off, '2026-11-09', 'lunch', null);
eq(off, { '2026-11-09': { after: '' } }, 'withOff turns one back on');
off = withOff(off, '2026-11-09', 'after', null);
eq(off, {}, 'withOff: the day goes when nothing is off');

// Changes, for a check-in already asked that day.
eq(offChanges({}, { '2026-11-09': { lunch: 'a' } }), [{ day: '2026-11-09', slot: 'lunch', reason: 'a' }], 'offChanges: added');
eq(offChanges({ '2026-11-09': { lunch: 'a' } }, {}), [{ day: '2026-11-09', slot: 'lunch', reason: null }], 'offChanges: back on');
eq(offChanges({ '2026-11-09': { lunch: 'a' } }, { '2026-11-09': { lunch: '' } }), [{ day: '2026-11-09', slot: 'lunch', reason: '' }], 'offChanges: reason taken out');
eq(offChanges({ '2026-11-09': { lunch: 'a' } }, { '2026-11-09': { lunch: 'a' } }), [], 'offChanges: nothing');
eq(offChanges(undefined, undefined), [], 'offChanges: no schedules');

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL PASSED (${passes})`);
process.exit(failures ? 1 : 0);
