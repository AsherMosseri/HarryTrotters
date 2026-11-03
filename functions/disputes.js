// Casino reports on the server. A teammate reports a result that looks wrong;
// team management reviews it and refunds by hand, or dismisses it. Nothing is
// ever refunded automatically.
//
// Callables:
//   dispute({ conv, msgId, reason, note })        report a casino result you were part of
//   disputeDecide({ id, decision, note })         team management: 'refund' or 'dismiss'
//
// Everything is checked here, against the card on the message (which only the
// server writes) and never against numbers the app sends. A report is one per
// message per person (its id), at most LIMITS.perDay a team day (a counter doc
// changed in the same transaction), and a refund pays at most what the card
// shows the person lost, once (a key doc and the report's status, in one
// transaction, so two team managers deciding at the same moment can't pay twice).
// The rules never let the app write disputes, refund keys, or refunds.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as d from './shared/disputes.js';
import { memberOk, nameKey } from './shared/team.js';
import { teamDay } from './shared/coins.js';

const OPEN = { maxInstances: 5, invoker: 'public' };

export function disputeFunctions({ db, coinData, notify, bankRef }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const validId = (id) => typeof id === 'string' && /^[\w-]{1,60}$/.test(id);

  async function caller(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const data = await coinData();
    return { uid, me: data.rename(member.get('name')), admin: member.get('admin') === true, data };
  }
  async function managers(rename) {
    const snap = await db.collection('members').where('admin', '==', true).get();
    return [...new Set(snap.docs.filter((m) => memberOk(m.data())).map((m) => rename(m.get('name') || '')).filter(Boolean))];
  }

  const dispute = onCall(OPEN, async (req) => {
    const { me, data } = await caller(req);
    const { conv, msgId, reason, note: text } = req.data || {};
    if (!validId(conv) || !validId(msgId)) return note('Which result?');
    if (!d.REASONS[reason]) return note('What looks wrong?', 'Pick one of the reasons.');
    const now = Date.now();
    const day = teamDay(now);
    const mref = db.doc(`channels/${conv}/messages/${msgId}`);
    const id = d.reportId(msgId, me);
    const dref = db.doc(`disputes/${id}`);
    const limitRef = db.doc(`disputeDays/${nameKey(me)}_${day}`);
    const res = await db.runTransaction(async (tx) => {
      const [m, old, lim] = await Promise.all([tx.get(mref), tx.get(dref), tx.get(limitRef)]);
      const msg = m.exists ? { id: m.id, ...m.data() } : null;
      const problem = d.reportProblem(msg, me, data.rename);
      if (problem) return note('Can’t report that.', problem);
      if (old.exists) return note('You already reported this one.', 'Team management will get to it.');
      const n = lim.exists ? lim.get('n') || 0 : 0;
      if (n >= d.LIMITS.perDay) return note(`That’s ${d.LIMITS.perDay} reports today.`, 'Try again tomorrow.');
      const snapshot = d.snapshotOf(msg, me, data.rename);
      tx.set(limitRef, { person: me, day, n: n + 1 });
      tx.set(dref, {
        conv,
        msgId,
        cmd: msg.cmd.name,
        by: me,
        at: now,
        day,
        reason,
        note: String(text || '').trim().slice(0, d.LIMITS.note),
        status: 'open',
        snapshot,
      });
      return { ok: true, id, snapshot };
    });
    if (!res.ok) return res;
    const boss = await managers(data.rename);
    await notify(
      boss
        .filter((n) => n !== me)
        .map((to) => ({
          to,
          type: 'dispute',
          title: `${first(me)} reported a ${d.GAME_LABEL[res.snapshot.game]} result`,
          body: d.REASONS[reason],
          open: 'disputes:',
          by: me,
        })),
    ).catch((e) => logger.warn('dispute notify', e.message));
    return { ok: true, id };
  });

  const disputeDecide = onCall(OPEN, async (req) => {
    const { me, admin, data } = await caller(req);
    if (!admin) throw new HttpsError('permission-denied', 'Team management only.');
    const { id, decision, note: text } = req.data || {};
    if (!validId(id)) return note('Which report?');
    if (decision !== 'refund' && decision !== 'dismiss') return note('Refund or dismiss?');
    const dref = db.doc(`disputes/${id}`);
    const resolution = String(text || '').trim().slice(0, d.LIMITS.resolution);
    // The person's recent casino history (their bank doc, under any name they've had).
    const peek = await dref.get();
    if (!peek.exists) return note('That report is gone.');
    const aliases = data.rename.aliases(peek.get('by')).slice(0, 30);
    const banks = await db.getAll(...aliases.map((n) => bankRef(n)));
    const recent = banks.flatMap((b) => (b.exists ? b.get('recent') || [] : []));
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(dref);
      const x = snap.data();
      if (!x) return note('That report is gone.');
      if (x.status !== 'open') return note('Already handled.', x.status === 'refunded' ? `Refunded ${x.refund} coins.` : 'It was dismissed.');
      const now = Date.now();
      const who = data.rename(x.by);
      if (decision === 'dismiss') {
        tx.update(dref, { status: 'dismissed', handledBy: me, handledAt: now, refund: 0, resolutionNote: resolution });
        return { ok: true, status: 'dismissed', x, refund: 0 };
      }
      // The card as it is now (the server's own record); if it's gone, what the
      // report kept when it was made.
      const mref = db.doc(`channels/${x.conv}/messages/${x.msgId}`);
      const keyRef = db.doc(`refundKeys/dispute-${x.msgId}-${nameKey(who)}`);
      const [m, key] = await Promise.all([tx.get(mref), tx.get(keyRef)]);
      if (key.exists) return note('That result was already refunded.');
      const live = m.exists && m.get('cmd') ? d.cardLoss(m.get('cmd'), who, data.rename) : null;
      const kept = x.snapshot || {};
      const loss = live ? (kept.final ? Math.min(live.loss, kept.loss || 0) : live.loss) : kept.loss || 0;
      if (!(loss > 0))
        return note(
          'There’s no loss to refund.',
          live && !live.final ? 'The game isn’t finished yet. Wait for it to settle, or dismiss.' : 'That card doesn’t show them losing coins.',
        );
      const seen = d.historyCheck(recent, x.cmd, loss, kept.cardAt || x.at);
      if (seen === 'missing') return note('I can’t find that loss in their coin history.', 'Dismiss it, or add the coins yourself as a bonus.');
      tx.set(keyRef, { dispute: id, person: who, amount: loss, at: now });
      tx.set(db.collection('coins').doc(`dispute-${id}`), d.refundEntry(who, loss, x.cmd, id, now));
      tx.update(dref, { status: 'refunded', handledBy: me, handledAt: now, refund: loss, resolutionNote: resolution, history: seen });
      return { ok: true, status: 'refunded', x, refund: loss };
    });
    if (!out.ok) return out;
    await notify([
      {
        to: out.x.by,
        type: 'dispute',
        ...(out.status === 'refunded' && { icon: '↩️' }),
        title: out.status === 'refunded' ? `${out.refund} coins refunded` : 'Your report was looked at',
        body:
          out.status === 'refunded'
            ? `Team management refunded your ${d.GAME_LABEL[out.x.cmd] || 'casino'} result.${resolution ? ` ${resolution}` : ''}`
            : `Team management kept the result as it was.${resolution ? ` ${resolution}` : ''}`,
        open: 'disputes:',
        by: me,
      },
    ]).catch((e) => logger.warn('dispute notify', e.message));
    return { ok: true, status: out.status, refund: out.refund };
  });

  return { dispute, disputeDecide };
}
