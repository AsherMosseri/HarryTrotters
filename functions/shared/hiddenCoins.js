// Hidden coins (3.2): small coins that now and then show up around the app.
// The server hands out a token for each one (functions/earn.js hiddenCoin)
// and pays it once; demo mode runs the same numbers. The amount grows with
// the balance like every earning (shared/coins.js EARN_SCALE.find).
export const FIND = {
  perDay: 5, // coins a person can find in a team day
  gap: 20 * 60000, // at least this long between two chances
  demoGap: 45000, // demo mode: a shorter wait, so a coin shows while someone looks around
  chance: 0.4, // when one could show, how often it does
  ttl: 10 * 60000, // a token is good for this long
  min: 3, // coins a find pays before the balance share (3 to 6)
  max: 6,
};
// The app: how often it asks (while the app is open and in front), and how
// long a coin stays on screen before it slips away.
export const FIND_ASK_MS = 5 * 60000;
export const FIND_SHOW_MS = 75000;
