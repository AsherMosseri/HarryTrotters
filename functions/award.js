// Paying coins from the server: 'award' entries in the coins ledger. Only
// server code writes them (the rules never let the app create one), each
// source has a daily cap per person (AWARD_CAPS, team days), and a `key`
// makes an award one-time (the same question, the same bingo row, the same
// streak milestone), so nothing can be farmed by repeating it.
import { teamDay, AWARD_CAPS, scaledPay } from './shared/coins.js';

// Earnings that grow with the balance (3.2, shared/coins.js EARN_SCALE): set
// once by functions/index.js. balanceFor(person, now) → { low, balance }: the
// balance earnings go by (its lowest in the last day) and the balance now.
let balanceFor = null;
export const setEarnBalance = (fn) => {
  balanceFor = fn;
};

// Returns how many coins were actually paid (0 if capped, repeated or invalid).
export async function awardCoins(db, args, now = Date.now()) {
  if (!payable(args)) return 0;
  return db.runTransaction(async (tx) => {
    const a = await prepareAward(tx, db, args, now);
    a.write(tx);
    return a.pay;
  });
}

const payable = ({ person, amount, source }) => !!person && Math.floor(Number(amount) || 0) > 0 && !!AWARD_CAPS[source];

// The same award inside a transaction the caller runs (like /daily, which
// also updates the bank doc): reads first, as transactions need, and gives
// back how much it pays and write(tx), to call once the caller's own reads
// are done.
export async function prepareAward(tx, db, { person, amount, source, label = '', key = '' }, now = Date.now()) {
  const none = { pay: 0, write: () => {} };
  if (!payable({ person, amount, source })) return none;
  const want = Math.floor(Number(amount));
  const cap = AWARD_CAPS[source];
  const day = teamDay(now);
  const keyRef = key ? db.doc(`awardKeys/${String(key).replace(/\//g, '_').slice(0, 300)}`) : null;
  if (keyRef && (await tx.get(keyRef)).exists) return none;
  const today = await tx.get(
    db.collection('coins').where('type', '==', 'award').where('person', '==', person).where('source', '==', source).where('day', '==', day),
  );
  // The daily cap counts normal coins (base), so a big balance pays more for
  // the same earnings, not more earnings.
  const sofar = today.docs.reduce((t, d) => t + (d.data().base ?? d.data().amount ?? 0), 0);
  const base = Math.min(want, Math.max(0, cap - sofar));
  if (!base) return none;
  let pay = base;
  if (balanceFor) {
    const b = await balanceFor(person, now).catch(() => null);
    if (b) pay = scaledPay(source, base, b.low);
  }
  return {
    pay,
    base,
    write: (t) => {
      t.set(db.collection('coins').doc(), {
        type: 'award',
        person,
        amount: pay,
        ...(pay !== base && { base }),
        source,
        label: String(label).slice(0, 80),
        day,
        at: now,
      });
      if (keyRef) t.set(keyRef, { person, source, day, at: now });
    },
  };
}
