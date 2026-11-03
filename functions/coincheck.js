// coinCheck: what the server counts for someone, broken down, so the app can
// show it next to its own numbers (Coins screen, "Compare with the server").
// Anyone may check their own balance; team management may check anyone's.
// Read only: nothing here changes a coin.
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { breakdown } from './shared/coins.js';
import { cleanName, memberOk } from './shared/team.js';

export function coinCheckFunctions({ db, coinData, freshCoins, bankRef, cacheAge }) {
  const coinCheck = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    const me = data.rename(member.get('name'));
    const asked = cleanName(req.data?.name || '');
    const name = asked ? data.rename(asked) : me;
    // Other people's numbers are for team management only.
    if (name !== me && member.get('admin') !== true) throw new HttpsError('permission-denied', 'You can only check your own balance.');
    const bank = (await bankRef(name).get()).data() || {};
    const w = await freshCoins(name, bank, data);
    const items = w.history.slice(0, 400).map((x) => ({
      at: x.at,
      kind: x.kind,
      amount: x.amount,
      label: String(x.label || '').slice(0, 80),
      ...(x.day && { day: x.day }),
    }));
    return {
      ok: true,
      name,
      serverNow: Date.now(),
      // How old the cached tasks, shifts and settings (everyone else's) are.
      cacheAgeMs: cacheAge(),
      aliases: data.rename.aliases(name).slice(0, 30),
      balance: w.balance,
      earned: w.earned,
      breakdown: breakdown(w.history),
      items,
      bank: {
        net: w.bank?.net || 0,
        since: w.bank?.since || null,
        docs: w.bankDocs,
        recent: (w.bank?.recent || []).map((x) => ({ at: x.at, amount: x.amount, label: String(x.label || '').slice(0, 80) })),
      },
    };
  });
  return { coinCheck };
}
