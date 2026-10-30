// School days, from American Heritage School's 2026-27 calendar (as of
// 12-10-25). The daily streak counts only school days, and the "every school
// day" lab check-in is asked only on them. The app and the server read this
// same file. Days are the team's days (America/New_York), as 'YYYY-MM-DD'.
//
// Days off for only some grades (PSAT/SAT days) count as days off here, so
// nobody's streak breaks on a day they had no school. Early-dismissal and
// exam days are school days.

export const SCHOOL_YEAR = { first: '2026-08-26', last: '2027-06-04' };

const range = (from, to) => {
  const out = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

export const NO_SCHOOL = new Set([
  '2026-09-07', // Labor Day
  '2026-09-21', // Yom Kippur
  '2026-10-22', // PSAT (grades 9-11 test; no school for the rest)
  '2026-10-23', // PD day
  '2026-10-30', // Conference day #1
  ...range('2026-11-25', '2026-11-27'), // Thanksgiving
  ...range('2026-12-21', '2027-01-01'), // Winter break
  '2027-01-15', // Conference day #2
  '2027-01-18', // MLK Day
  '2027-02-12', // PD day
  '2027-02-15', // Presidents' Day
  '2027-03-03', // PSAT/SAT (some grades only)
  ...range('2027-03-22', '2027-03-29'), // Spring break
  '2027-05-31', // Memorial Day
]);

// A weekday in the school year that isn't a day off.
export function isSchoolDay(day) {
  if (!day || day < SCHOOL_YEAR.first || day > SCHOOL_YEAR.last || NO_SCHOOL.has(day)) return false;
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  return wd !== 0 && wd !== 6;
}
