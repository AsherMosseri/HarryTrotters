// Paying coins from the server: 'award' entries in the coins ledger. Only
// server code writes them (the rules never let the app create one), each
// source has a daily cap per person (AWARD_CAPS, team days), and a `key`
// makes an award one-time (the same question, the same bingo row, the same
// streak milestone), so nothing can be farmed by repeating it.
import { teamDay, AWARD_CAPS } from './shared/coins.js';

// Returns how many coins were actually paid (0 if capped, repeated or invalid).
export async function awardCoins(db, { person, amount, source, label = '', key = '' }, now = Date.now()) {
  const want = Math.floor(Number(amount) || 0);
  const cap = AWARD_CAPS[source] || 0;
  if (!person || want <= 0 || !cap) return 0;
  const day = teamDay(now);
  const keyRef = key ? db.doc(`awardKeys/${String(key).replace(/\//g, '_').slice(0, 300)}`) : null;
  return db.runTransaction(async (tx) => {
    if (keyRef && (await tx.get(keyRef)).exists) return 0;
    const today = await tx.get(
      db.collection('coins').where('type', '==', 'award').where('person', '==', person).where('source', '==', source).where('day', '==', day),
    );
    const sofar = today.docs.reduce((t, d) => t + (d.data().amount || 0), 0);
    const pay = Math.min(want, Math.max(0, cap - sofar));
    if (!pay) return 0;
    tx.set(db.collection('coins').doc(), { type: 'award', person, amount: pay, source, label: String(label).slice(0, 80), day, at: now });
    if (keyRef) tx.set(keyRef, { person, source, day, at: now });
    return pay;
  });
}
