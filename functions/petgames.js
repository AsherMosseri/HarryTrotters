// Pet games' best scores on the server (3.2): the `pet` callable's
// gameScore action (market.js) keeps each person's best Pet Hop score and
// best Pet Rally time per level in petGames/{personId}, for the team boards.
// The games run on the phone, so this only keeps scores sane
// (shared/petgames.js: whole numbers in range, possible times, levels in
// order) and writes a new best. Nothing here pays coins or changes a pet.

import { cleanScore, scoreAfter } from './shared/petgames.js';

export function petGames({ db, personId }) {
  // A person's doc, under any name they've gone by.
  async function docOf(tx, aliases) {
    for (const n of aliases) {
      const ref = db.doc(`petGames/${personId(n)}`);
      const snap = await tx.get(ref);
      if (snap.exists) return { ref, data: snap.data() };
    }
    return { ref: db.doc(`petGames/${personId(aliases[0])}`), data: null };
  }

  // ctx: the caller (me, aliases). Returns { ok, better } or { note }.
  return async function run({ me, aliases }, input) {
    const score = cleanScore(input);
    if (score.note) return score;
    const now = Date.now();
    return db.runTransaction(async (tx) => {
      const mine = await docOf(tx, aliases);
      const r = scoreAfter(mine.data, score, { me, now });
      if (r.note) return r;
      if (r.better) tx.set(mine.ref, r.doc);
      return { ok: true, better: r.better };
    });
  };
}
