// Casino reports on the server. A teammate reports a result that looks wrong;
// the team owner (Asher, `owner`: the same person feature requests go to)
// reviews it and refunds by hand, or dismisses it. Other team managers don't
// get or decide reports. Nothing is ever refunded automatically.
//
// Callables:
//   dispute({ conv, msgId, reason, note })        report a casino result you were part of
//   disputeDecide({ id, decision, note })         the owner only: 'refund' or 'dismiss'
//   ownerRefund({ conv, msgId, person, mode })     the owner only, from the card in chat (3.1.1):
//                                                 'refund' a loss or 'takeback' a win, report or not
//
// Everything is checked here, against the card on the message (which only the
// server writes) and never against numbers the app sends. A report is one per
// message per person (its id), with no daily cap (a counter doc, changed in the
// same transaction, still counts them per day), and a refund pays at most what the card
// shows the person lost, once (a key doc and the report's status, in one
// transaction, so deciding twice at the same moment, on two devices, can't pay twice).
// The rules never let the app write disputes, refund keys, or refunds, or
// change a game card's cmd (where the "Refunded by Asher" tag goes).
//
// Refund / Take back on a card (ownerRefund) and a report's refund share one
// key doc per card and person (refundKeys/dispute-{msgId}-{person}), so a
// result is put right once, whichever way. Both also find the person's
// history line for the result (shared/disputes.js cardLine): if the owner
// already reversed that line from coin history (a grant that names it), they
// refuse; if not, the refund names the line, so it shows as Reversed there
// and can't be reversed again.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldPath } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import * as d from './shared/disputes.js';
import { memberOk, nameKey } from './shared/team.js';
import { teamDay } from './shared/coins.js';

const OPEN = { maxInstances: 5, invoker: 'public' };

export function disputeFunctions({ db, coinData, notify, bankRef, owner }) {
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
  const ownerFirst = first(owner);

  // Everyone's bank docs under any name they've had, each once.
  const bankRefsOf = (who, rename) => {
    const seen = new Map();
    for (const n of rename.aliases(who).slice(0, 30)) {
      const ref = bankRef(n);
      seen.set(ref.path, ref);
    }
    return [...seen.values()];
  };
  // Inside a transaction: the person's history line for this card's result,
  // and whether it was already reversed from coin history. { line, reverses }
  // or { problem }.
  async function lineFor(tx, banks, { who, aliases, conv, msgId, game, net, cardAt }) {
    const recent = banks.flatMap((b) => (b.exists ? b.get('recent') || [] : []));
    if (recent.some((x) => x.hold === msgId)) return { problem: note('Their bet in that game is still held.', 'Finish or cancel the game first.') };
    const { line, candidates } = d.cardLine(recent, { conv, msgId, game, net, cardAt });
    if (line?.card && line.amount !== net) return { problem: note('The card and their coin history don’t match.', 'Nothing was changed. Check it by hand.') };
    if (!line) return { line: null, reverses: '' };
    const keys = [...new Set(candidates.map(d.lineKey))].slice(0, 30);
    const used = (await tx.get(db.collection('coins').where('reverses', 'in', keys))).docs
      .filter((x) => aliases.includes(x.get('to') || x.get('person') || ''))
      .map((x) => x.get('reverses'));
    const key = d.lineKey(line);
    if (used.includes(key)) return { problem: note('Already reversed in their coin history.', `That line was put right from Coins. Nothing more to do.`) };
    return { line, reverses: key };
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
      if (old.exists) return note('You already reported this one.', `${ownerFirst} will get to it.`);
      // Counted per day for the record; there's no daily cap.
      const n = lim.exists ? lim.get('n') || 0 : 0;
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
        note: String(text || '')
          .trim()
          .slice(0, d.LIMITS.note),
        status: 'open',
        snapshot,
      });
      return { ok: true, id, snapshot };
    });
    if (!res.ok) return res;
    // Only the owner hears about it (not about their own).
    const boss = data.rename(owner);
    await notify(
      boss === me
        ? []
        : [
            {
              to: boss,
              type: 'dispute',
              title: `${first(me)} reported a ${d.GAME_LABEL[res.snapshot.game]} result`,
              body: d.REASONS[reason],
              open: 'disputes:',
              by: me,
            },
          ],
    ).catch((e) => logger.warn('dispute notify', e.message));
    return { ok: true, id };
  });

  const disputeDecide = onCall(OPEN, async (req) => {
    const { me, admin, data } = await caller(req);
    if (!admin || me !== data.rename(owner)) throw new HttpsError('permission-denied', `Only ${ownerFirst} can do that.`);
    const { id, decision, note: text } = req.data || {};
    if (!validId(id)) return note('Which report?');
    if (decision !== 'refund' && decision !== 'dismiss') return note('Refund or dismiss?');
    const dref = db.doc(`disputes/${id}`);
    const resolution = String(text || '')
      .trim()
      .slice(0, d.LIMITS.resolution);
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
      if (x.status !== 'open')
        return note('Already handled.', x.status === 'refunded' ? `Refunded ${x.refund} coins.` : 'It was dismissed.');
      const now = Date.now();
      const who = data.rename(x.by);
      if (decision === 'dismiss') {
        tx.update(dref, { status: 'dismissed', handledBy: me, handledAt: now, refund: 0, resolutionNote: resolution });
        return { ok: true, status: 'dismissed', x, refund: 0 };
      }
      // The card as it is now (the server's own record); if it's gone, what the
      // report kept when it was made.
      const mref = db.doc(`channels/${x.conv}/messages/${x.msgId}`);
      const keyRef = db.doc(`refundKeys/${d.refundKeyId(x.msgId, who)}`);
      const [m, key, ...whoBanks] = await Promise.all([tx.get(mref), tx.get(keyRef), ...bankRefsOf(who, data.rename).map((r) => tx.get(r))]);
      if (key.exists) return note(key.get('mode') === 'takeback' ? 'That win was already taken back.' : 'That result was already refunded.');
      const live = m.exists && m.get('cmd') ? d.cardLoss(m.get('cmd'), who, data.rename) : null;
      const kept = x.snapshot || {};
      const loss = live ? (kept.final ? Math.min(live.loss, kept.loss || 0) : live.loss) : kept.loss || 0;
      if (!(loss > 0))
        return note(
          'There’s no loss to refund.',
          live && !live.final
            ? 'The game isn’t finished yet. Wait for it to settle, or dismiss.'
            : 'That card doesn’t show them losing coins.',
        );
      const seen = d.historyCheck(recent, x.cmd, loss, kept.cardAt || x.at);
      if (seen === 'missing')
        return note('I can’t find that loss in their coin history.', 'Dismiss it, or add the coins yourself as a bonus.');
      const link = await lineFor(tx, whoBanks, {
        who,
        aliases: data.rename.aliases(who).slice(0, 30),
        conv: x.conv,
        msgId: x.msgId,
        game: x.cmd,
        net: -loss,
        cardAt: kept.cardAt || x.at,
      });
      if (link.problem) return link.problem;
      tx.set(keyRef, { dispute: id, via: 'report', mode: 'refund', person: who, amount: loss, by: me, at: now });
      tx.set(db.collection('coins').doc(`dispute-${id}`), d.refundEntry(who, loss, x.cmd, id, now, link.reverses));
      tx.update(dref, { status: 'refunded', handledBy: me, handledAt: now, refund: loss, resolutionNote: resolution, history: seen });
      // The card says so too (everyone sees "Refunded by Asher").
      if (m.exists && m.get('cmd'))
        tx.update(mref, new FieldPath('cmd', 'adjust', nameKey(who)), d.adjustTag({ person: who, mode: 'refund', amount: loss, by: me, now, via: 'report' }));
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
            ? `${ownerFirst} refunded your ${d.GAME_LABEL[out.x.cmd] || 'casino'} result.${resolution ? ` ${resolution}` : ''}`
            : `${ownerFirst} kept the result as it was.${resolution ? ` ${resolution}` : ''}`,
        open: 'disputes:',
        by: me,
      },
    ]).catch((e) => logger.warn('dispute notify', e.message));
    return { ok: true, status: out.status, refund: out.refund };
  });

  // The owner's Refund / Take back on a finished game card, for one person in
  // it, with or without a report. The amount is what the card shows.
  const ownerRefund = onCall(OPEN, async (req) => {
    const { me, admin, data } = await caller(req);
    if (!admin || me !== data.rename(owner)) throw new HttpsError('permission-denied', `Only ${ownerFirst} can do that.`);
    const { conv, msgId, person, mode } = req.data || {};
    if (!validId(conv) || !validId(msgId)) return note('Which game?');
    if (mode !== 'refund' && mode !== 'takeback') return note('Refund or take back?');
    if (typeof person !== 'string' || !person.trim() || person.length > 80) return note('Whose result?');
    const who = data.rename(person.trim());
    const aliases = data.rename.aliases(who).slice(0, 30);
    const mref = db.doc(`channels/${conv}/messages/${msgId}`);
    const keyRef = db.doc(`refundKeys/${d.refundKeyId(msgId, who)}`);
    const dref = db.doc(`disputes/${d.reportId(msgId, who)}`);
    const bankRefs = bankRefsOf(who, data.rename);
    const out = await db.runTransaction(async (tx) => {
      const [m, key, rep, ...banks] = await Promise.all([tx.get(mref), tx.get(keyRef), tx.get(dref), ...bankRefs.map((r) => tx.get(r))]);
      const msg = m.exists ? { id: m.id, ...m.data() } : null;
      if (!msg?.cmd) return note('That game is gone.');
      const check = d.fixCheck(msg, who, mode, data.rename);
      if (check.problem) return note(check.problem, check.body);
      if (key.exists)
        return note(key.get('mode') === 'takeback' ? 'That win was already taken back.' : 'That result was already refunded.', 'Each result is put right once.');
      const link = await lineFor(tx, banks, { who, aliases, conv, msgId, game: check.game, net: check.net, cardAt: msg.at || 0 });
      if (link.problem) return link.problem;
      const now = Date.now();
      const amount = check.amount;
      tx.set(keyRef, { via: 'card', mode, person: who, amount, by: me, conv, msgId, at: now });
      tx.set(
        db.collection('coins').doc(`card-${msgId}-${nameKey(who)}`),
        d.fixEntry({ person: who, mode, amount, game: check.game, msgId, by: me, now, reverses: link.reverses }),
      );
      tx.update(mref, new FieldPath('cmd', 'adjust', nameKey(who)), d.adjustTag({ person: who, mode, amount, by: me, now }));
      // A report waiting on this result is answered by this.
      if (rep.exists && rep.get('status') === 'open')
        tx.update(
          dref,
          mode === 'refund'
            ? { status: 'refunded', handledBy: me, handledAt: now, refund: amount, resolutionNote: 'Refunded from the card in chat.', via: 'card' }
            : { status: 'dismissed', handledBy: me, handledAt: now, refund: 0, resolutionNote: 'The win was taken back.', via: 'card' },
        );
      return { ok: true, mode, amount, person: who, game: check.game };
    });
    if (!out.ok) return out;
    if (out.person !== me)
      await notify([{ to: out.person, type: 'dispute', ...d.fixNote({ ...out, by: me }), open: `chat:${conv}`, by: me }]).catch((e) =>
        logger.warn('ownerRefund notify', e.message),
      );
    return out;
  });

  return { dispute, disputeDecide, ownerRefund };
}
