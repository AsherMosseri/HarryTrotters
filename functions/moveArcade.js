// 3.2, run once by the owner: move every past casino, arcade-game and Jackson
// coin card from the other channels into #arcade, now that coins and games
// live only there. DMs are left as they are.
//
//   moveToArcade({ dry: true })   counts per channel and per kind, and what it will skip
//   moveToArcade({})              moves up to LIMIT cards; { more: true } means call again
//
// Each card keeps its doc id (refund keys, reports, refundKeys and Undo gift
// all go by the message id) and its time (`at`), and is marked moved: { from,
// at }, which keeps it out of unread counts and notifications. Everything that
// says where a card is follows it, in the same transaction: reports
// (disputes.conv), refund keys (refundKeys.conv), coin requests (conv), race
// sessions (funGames.race.conv), challenge and lottery pointers (bank.chOpen,
// lottery.open). Coin history lines (bank recent[].card 'conv/msgId') are
// fixed after, for every card already in #arcade, so a second run finishes
// whatever a first one left. Safe to run twice: a moved card is no longer in
// its old channel, and nothing moves while a game on it is still going.
//
// Skipped (and listed): games still going (a gameSecrets doc), open
// challenges, coin requests with anything still open, the lottery card that's
// open, and pinned cards (a pin stays with its channel; unpin it to move it).

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ARCADE } from './shared/commandRules.js';
import { MOVE_KINDS, skipReason } from './shared/moveArcade.js';

const LIMIT = 150;
import { memberOk } from './shared/team.js';

export function moveArcadeFunctions({ db, owner, renamer }) {
  const note = (title, body = '') => ({ note: { title, body } });
  async function ownerOnly(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const rename = await renamer();
    const me = rename(member.get('name') || '');
    if (member.get('admin') !== true || me !== rename(owner)) throw new HttpsError('permission-denied', `Only ${owner.split(' ')[0]} can do that.`);
    return me;
  }

  // Every channel's coin cards outside #arcade: [{ conv, id, ref, data }].
  // listDocuments also finds channels that only exist through their messages.
  async function scan() {
    const chans = (await db.collection('channels').listDocuments()).map((r) => r.id).filter((id) => id !== ARCADE);
    const out = [];
    for (const conv of chans) {
      for (let i = 0; i < MOVE_KINDS.length; i += 30) {
        const q = await db.collection(`channels/${conv}/messages`).where('cmd.name', 'in', MOVE_KINDS.slice(i, i + 30)).get();
        for (const d of q.docs) out.push({ conv, id: d.id, ref: d.ref, data: d.data() });
      }
    }
    return out;
  }
  async function context(cards) {
    const lot = (await db.doc('lottery/current').get()).data() || {};
    const secrets = new Set();
    const ids = cards.map((c) => db.doc(`gameSecrets/${c.id}`));
    for (let i = 0; i < ids.length; i += 300) for (const s of await db.getAll(...ids.slice(i, i + 300))) if (s.exists) secrets.add(s.id);
    return { lotteryOpenId: lot.open?.id || '', secrets };
  }

  // Coin history lines that still point at a card's old channel: 'conv/msgId'
  // to 'arcade/msgId', for every card now in #arcade that was moved.
  async function fixBanks() {
    const banks = await db.collection('bank').get();
    let fixed = 0;
    for (const b of banks.docs) {
      const stale = (b.get('recent') || []).filter((x) => typeof x.card === 'string' && !x.card.startsWith(`${ARCADE}/`));
      const chOpen = b.get('chOpen');
      if (!stale.length && !(chOpen?.conv && chOpen.conv !== ARCADE)) continue;
      const ids = [...new Set([...stale.map((x) => x.card.split('/')[1]), ...(chOpen?.id ? [chOpen.id] : [])].filter(Boolean))];
      const moved = new Set();
      const snaps = await db.getAll(...ids.map((id) => db.doc(`channels/${ARCADE}/messages/${id}`)));
      for (const s of snaps) if (s.exists && s.get('moved')?.from) moved.add(s.id);
      if (!moved.size) continue;
      await db.runTransaction(async (tx) => {
        const cur = (await tx.get(b.ref)).data() || {};
        let n = 0;
        const recent = (cur.recent || []).map((x) => {
          const [conv, id] = typeof x.card === 'string' ? x.card.split('/') : [];
          if (conv && conv !== ARCADE && moved.has(id)) {
            n++;
            return { ...x, card: `${ARCADE}/${id}` };
          }
          return x;
        });
        const patch = { recent };
        if (cur.chOpen?.id && moved.has(cur.chOpen.id) && cur.chOpen.conv !== ARCADE) {
          patch.chOpen = { ...cur.chOpen, conv: ARCADE };
          n++;
        }
        if (n) tx.update(b.ref, patch);
        fixed += n;
      });
    }
    return fixed;
  }

  // One card, in one transaction: copy it to #arcade (same id, same time),
  // point everything that names its channel at #arcade, delete the old one.
  async function moveOne(card, now) {
    const { conv, id, ref } = card;
    const target = db.doc(`channels/${ARCADE}/messages/${id}`);
    // Subcollections (none today; copied if a card ever has one), before the move.
    const subs = await ref.listCollections();
    for (const sub of subs) for (const d of (await sub.get()).docs) await target.collection(sub.id).doc(d.id).set(d.data());
    const res = await db.runTransaction(async (tx) => {
      const [old, there, secret, lot] = await tx.getAll(ref, target, db.doc(`gameSecrets/${id}`), db.doc('lottery/current'));
      if (!old.exists) return 'gone';
      const data = old.data();
      const why = skipReason(data, { secretExists: secret.exists, lotteryOpenId: lot.get('open')?.id || '' }, id);
      if (why) return `skip:${why}`;
      if (there.exists && !there.get('moved')) return 'skip:an #arcade message has the same id';
      const [disputes, keys, rows, races] = await Promise.all([
        tx.get(db.collection('disputes').where('msgId', '==', id)),
        tx.get(db.collection('refundKeys').where('msgId', '==', id)),
        tx.get(db.collection('coinRequests').where('group', '==', id)),
        tx.get(db.collection('funGames').where('race.msgId', '==', id)),
      ]);
      const [reqDoc, groupDoc] = await tx.getAll(db.doc(`coinRequests/${id}`), db.doc(`coinRequestGroups/${id}`));
      const reqs = { docs: reqDoc.exists ? [reqDoc] : [] };
      tx.set(target, { ...data, moved: { from: conv, at: now } });
      for (const d of disputes.docs) if (d.get('conv') === conv) tx.update(d.ref, { conv: ARCADE });
      for (const d of keys.docs) if (d.get('conv') === conv) tx.update(d.ref, { conv: ARCADE });
      for (const d of [...reqs.docs, ...rows.docs]) if (d.get('conv') === conv) tx.update(d.ref, { conv: ARCADE });
      if (groupDoc.exists && groupDoc.get('conv') === conv) tx.update(groupDoc.ref, { conv: ARCADE });
      for (const d of races.docs) if (d.get('race')?.conv === conv) tx.update(d.ref, { 'race.conv': ARCADE });
      const open = lot.get('open');
      if (open?.id === id && open.conv === conv) tx.update(lot.ref, { open: { ...open, conv: ARCADE } });
      tx.delete(ref);
      return 'moved';
    });
    if (res === 'moved') for (const sub of subs) for (const d of (await sub.get()).docs) await d.ref.delete();
    return res;
  }

  const moveToArcade = onCall({ maxInstances: 1, invoker: 'public', timeoutSeconds: 540 }, async (req) => {
    const me = await ownerOnly(req);
    const dry = req.data?.dry === true;
    const now = Date.now();
    const cards = await scan();
    const ctx = await context(cards);
    const byChannel = {};
    const byKind = {};
    const skipped = [];
    const todo = [];
    for (const c of cards) {
      const why = skipReason(c.data, { secretExists: ctx.secrets.has(c.id), lotteryOpenId: ctx.lotteryOpenId }, c.id);
      if (why === 'not coins') continue;
      if (why) {
        skipped.push({ conv: c.conv, id: c.id, kind: c.data.cmd.name, why, at: c.data.at || 0 });
        continue;
      }
      byChannel[c.conv] = (byChannel[c.conv] || 0) + 1;
      byKind[c.data.cmd.name] = (byKind[c.data.cmd.name] || 0) + 1;
      todo.push(c);
    }
    // Waiting cards by kind, so the owner sees the whole split (moving + waiting).
    const waitByKind = {};
    for (const x of skipped) waitByKind[x.kind] = (waitByKind[x.kind] || 0) + 1;
    const report = { byChannel, byKind, waitByKind, total: todo.length, skipped: skipped.slice(0, 100), skippedCount: skipped.length };
    if (dry) return { ok: true, dry: true, ...report };
    let moved = 0;
    const late = [];
    for (const c of todo.slice(0, LIMIT)) {
      const r = await moveOne(c, now);
      if (r === 'moved') moved++;
      else if (r.startsWith('skip:')) late.push({ conv: c.conv, id: c.id, kind: c.data.cmd.name, why: r.slice(5) });
    }
    const more = todo.length > LIMIT;
    const history = more ? 0 : await fixBanks();
    if (!more)
      await db.doc('settings/moveToArcade').set({ doneAt: now, by: me, moved, skipped: skipped.length + late.length }, { merge: true });
    return { ok: true, moved, more, history, ...report, skipped: [...skipped, ...late].slice(0, 100), skippedCount: skipped.length + late.length };
  });

  return { moveToArcade, scan, fixBanks, moveOne, note };
}
