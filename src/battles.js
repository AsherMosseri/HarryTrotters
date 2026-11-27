// Pet battles in the app (3.3). The rules are in functions/shared/battles.js
// (the server and demo mode run them); this is the one way into a battle
// from anywhere a pet shows (the pet park card, a profile): askBattle({
// owner, born }) opens the Battle sheet, which Workspace draws (it has the
// play function and takes you to #arcade, where the battle's card goes).
const listeners = new Set();
export const askBattle = (target) => listeners.forEach((fn) => fn(target));
export function onAskBattle(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The words for the play function: "/battle @Ira Harrison 50" plus which two
// pets (born: when each came to its owner), so the server battles exactly them.
export function battleArgs({ owner, born, mine, bet }) {
  const amount = String(bet ?? '').trim();
  return [`@${owner}`, ...(amount && amount !== '0' ? [amount] : []), `mine:${Number(mine)}`, `theirs:${Number(born)}`];
}
