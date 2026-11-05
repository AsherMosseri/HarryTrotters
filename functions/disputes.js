// Casino reports on the server. A teammate reports a result that looks wrong;
// the team owner (Asher, `owner`: the same person feature requests go to)
// reviews it and refunds by hand, or dismisses it. Other team managers don't
// get or decide reports. Nothing is ever refunded automatically.
//
// Callables:
//   dispute({ conv, msgId, reason, note })        report a casino result you were part of
//   disputeDecide({ id, decision, note })         the owner only: 'refund' or 'dismiss'
//   disputeRefundAll({ person?, note })           the owner only (3.1.5): refund every waiting report,
//                                                 or every one from one person, each checked like disputeDecide
//   ownerRefund({ conv, msgId, person, mode })     the owner only, from the card in chat (3.1.1):
//                                                 'refund' a loss or 'takeback' a win, report or not
// A refund that would put the person over a googol (MAX_BALANCE, 3.1.5)
// is refused and nothing changes; Refund all skips it and it stays waiting.
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
import { ceilingNote, overCeiling, sumCoins, teamDay } from './shared/coins.js';
import { coinsText } from './shared/coinText.js';

const OPEN = { maxInstances: 5, invoker: 'public' };

export function disputeFunctions({ db, coinData, freshCoins, notify, bankRef, owner, personId }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const validId = (id) => typeof id === 'string' && /^[\w-]{1,60}$/.test(id);
  // A chat is a channel id, or 'dm:' and a DM id (two people's ids, so longer).
  const validConv = (c) => typeof c === 'string' && (validId(c) || /^dm:[\w-]{1,150}$/.test(c));
  // DM messages live under dms/, channel messages under channels/.
  const msgDoc = (conv, msgId) =>
    db.doc(conv.startsWith('dm:') ? `dms/${conv.slice(3)}/messages/${msgId}` : `channels/${conv}/messages/${msgId}`);

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
    if (!validConv(conv) || !validId(msgId)) return note('Which result?');
    if (!d.REASONS[reason]) return note('What looks wrong?', 'Pick one of the reasons.');
    const now = Date.now();
    const day = teamDay(now);
    const mref = msgDoc(conv, msgId);
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
              report: res.id,
              by: me,
            },
          ],
    ).catch((e) => logger.warn('dispute notify', e.message));
    return { ok: true, id };
  });

  // A refund restores a past loss, but still never puts anyone over a
  // googol (MAX_BALANCE): { problem } when it would, inside the
  // transaction (their bank doc read in it), before anything is written.
  async function ceilingCheck(tx, who, amount, data) {
    const bank = (await tx.get(bankRef(who))).data() || {};
    if (!overCeiling((await freshCoins(who, bank, data)).balance, amount)) return null;
    const c = ceilingNote(who, 'Nobody can hold more than that. Nothing was refunded.');
    return { problem: note(c.error, c.body) };
  }

  const isOwner = ({ me, admin, data }) => admin && me === data.rename(owner);

  // Handled reports: the owner's "X reported a … result" notifications go
  // away. Matched by report id (from 3.1.6 on), or for older ones by who sent
  // it and when (within two minutes of the report). Never fails the caller.
  async function clearReportNotes(reports, data) {
    try {
      const col = db.collection(`inbox/${personId(data.rename(owner))}/items`);
      const byWho = new Map();
      for (const r of reports) if (r?.by) byWho.set(r.by, [...(byWho.get(r.by) || []), r]);
      for (const [by, list] of byWho) {
        const names = data.rename.aliases(by).slice(0, 30);
        const snap = await col.where('by', 'in', names.length ? names : [by]).limit(500).get();
        const gone = snap.docs.filter((n) => {
          if (n.get('type') !== 'dispute') return false;
          const rid = n.get('report');
          if (rid) return list.some((r) => r.id === rid);
          return /reported a/.test(n.get('title') || '') && list.some((r) => Math.abs((n.get('at') || 0) - (r.at || 0)) < 120000);
        });
        for (let i = 0; i < gone.length; i += 400) {
          const b = db.batch();
          for (const n of gone.slice(i, i + 400)) b.delete(n.ref);
          await b.commit();
        }
      }
    } catch (e) {
      logger.warn('clearReportNotes', e.message);
    }
  }
  const resolutionOf = (text) =>
    String(text || '')
      .trim()
      .slice(0, d.LIMITS.resolution);

  // One report, refunded or dismissed, in one transaction: { ok, status, x, refund } or a note.
  async function decideOne(id, decision, resolution, me, data) {
    const dref = db.doc(`disputes/${id}`);
    // The person's recent casino history (their bank doc, under any name they've had).
    const peek = await dref.get();
    if (!peek.exists) return note('That report is gone.');
    const aliases = data.rename.aliases(peek.get('by')).slice(0, 30);
    const banks = await db.getAll(...aliases.map((n) => bankRef(n)));
    const recent = banks.flatMap((b) => (b.exists ? b.get('recent') || [] : []));
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(dref);
      const x = snap.data();
      if (!x) return note('That report is gone.');
      if (x.status !== 'open')
        return note('Already handled.', x.status === 'refunded' ? `Refunded ${coinsText(x.refund)} coins.` : 'It was dismissed.');
      const now = Date.now();
      const who = data.rename(x.by);
      if (decision === 'dismiss') {
        tx.update(dref, { status: 'dismissed', handledBy: me, handledAt: now, refund: 0, resolutionNote: resolution });
        return { ok: true, status: 'dismissed', x, refund: 0 };
      }
      // The card as it is now (the server's own record); if it's gone, what the
      // report kept when it was made.
      const mref = (validConv(x.conv) && validId(x.msgId) ? msgDoc(x.conv, x.msgId) : db.doc('channels/none/messages/none'));
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
      const over = await ceilingCheck(tx, who, loss, data);
      if (over) return over.problem;
      tx.set(keyRef, { dispute: id, via: 'report', mode: 'refund', person: who, amount: loss, by: me, at: now });
      tx.set(db.collection('coins').doc(`dispute-${id}`), d.refundEntry(who, loss, x.cmd, id, now, link.reverses));
      tx.update(dref, { status: 'refunded', handledBy: me, handledAt: now, refund: loss, resolutionNote: resolution, history: seen });
      // The card says so too (everyone sees "Refunded by Asher").
      if (m.exists && m.get('cmd'))
        tx.update(mref, new FieldPath('cmd', 'adjust', nameKey(who)), d.adjustTag({ person: who, mode: 'refund', amount: loss, by: me, now, via: 'report' }));
      return { ok: true, status: 'refunded', x, refund: loss };
    });
  }

  const disputeDecide = onCall(OPEN, async (req) => {
    const who = await caller(req);
    const { me, data } = who;
    if (!isOwner(who)) throw new HttpsError('permission-denied', `Only ${ownerFirst} can do that.`);
    const { id, decision, note: text } = req.data || {};
    if (!validId(id)) return note('Which report?');
    if (decision !== 'refund' && decision !== 'dismiss') return note('Refund or dismiss?');
    const resolution = resolutionOf(text);
    const out = await decideOne(id, decision, resolution, me, data);
    if (!out.ok) return out;
    await clearReportNotes([{ id, by: out.x.by, at: out.x.at }], data);
    await notify([
      {
        to: out.x.by,
        type: 'dispute',
        ...(out.status === 'refunded' && { icon: '↩️' }),
        title: out.status === 'refunded' ? `${coinsText(out.refund)} coins refunded` : 'Your report was looked at',
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

  // The owner's Refund all: every waiting report, or every one from `person`.
  // Each report goes through decideOne exactly like its own Refund button (the
  // card's loss, the history check, the shared once-only key), one at a time,
  // so a report that can't be refunded is skipped and stays waiting. Each
  // person gets one notification for all of theirs.
  const disputeRefundAll = onCall({ ...OPEN, timeoutSeconds: 300 }, async (req) => {
    const who = await caller(req);
    const { me, data } = who;
    if (!isOwner(who)) throw new HttpsError('permission-denied', `Only ${ownerFirst} can do that.`);
    const { person, note: text } = req.data || {};
    const resolution = resolutionOf(text);
    const only = typeof person === 'string' && person.trim() ? data.rename(person.trim()) : '';
    const open = (await db.collection('disputes').where('status', '==', 'open').limit(500).get()).docs
      .filter((x) => !only || data.rename(x.get('by')) === only)
      .sort((a, b) => (a.get('at') || 0) - (b.get('at') || 0))
      .slice(0, 200);
    if (!open.length) return note(only ? `Nothing waiting from ${first(only)}.` : 'Nothing waiting.');
    const paid = new Map(); // person -> { to, count, coins, game }
    const skipped = [];
    let coins = 0;
    let closed = 0;
    const handled = [];
    for (const x of open) {
      let out;
      try {
        out = await decideOne(x.id, 'refund', resolution, me, data);
      } catch (e) {
        logger.warn('disputeRefundAll', x.id, e.message);
        out = note('That didn’t go through.');
      }
      if (out?.ok) handled.push({ id: x.id, by: x.get('by'), at: x.get('at') });
      if (out?.ok && out.status === 'refunded') {
        const p = data.rename(out.x.by);
        const row = paid.get(p) || { to: out.x.by, count: 0, coins: 0, game: out.x.cmd };
        row.count += 1;
        row.coins += out.refund;
        paid.set(p, row);
        coins += out.refund;
      } else if (/already (refunded|taken back)/.test(out?.note?.title || '')) {
        // Already put right from its card: close the report, nothing more is paid.
        const done = await decideOne(x.id, 'dismiss', 'Already put right from the card.', me, data).catch(() => null);
        if (done?.ok) {
          closed += 1;
          handled.push({ id: x.id, by: x.get('by'), at: x.get('at') });
        }
        else skipped.push({ id: x.id, by: x.get('by'), game: x.get('cmd') || '', why: out.note.title });
      } else skipped.push({ id: x.id, by: x.get('by'), game: x.get('cmd') || '', why: out?.note?.title || 'Skipped.' });
    }
    await notify(
      [...paid.values()].map((r) => ({
        to: r.to,
        type: 'dispute',
        icon: '↩️',
        title: `${coinsText(r.coins)} coins refunded`,
        body:
          r.count === 1
            ? `${ownerFirst} refunded your ${d.GAME_LABEL[r.game] || 'casino'} result.${resolution ? ` ${resolution}` : ''}`
            : `${ownerFirst} refunded ${r.count} of your casino reports.${resolution ? ` ${resolution}` : ''}`,
        open: 'disputes:',
        by: me,
      })),
    ).catch((e) => logger.warn('disputeRefundAll notify', e.message));
    await clearReportNotes(handled, data);
    const refunded = [...paid.values()].reduce((n, r) => n + r.count, 0);
    return { ok: true, refunded, coins, people: paid.size, skipped, closed };
  });

  // The owner's Refund / Take back on a finished game card, for one person in
  // it, with or without a report. The amount is what the card shows.
  // The owner's Undo on a /give card (3.1.4, mode 'undogift'): every gift
  // the card sent goes back to the giver, once. The card keeps the gift's
  // batch (functions/index.js giveMany); the gifts are found by it and must be
  // from the card's poster. One key doc per batch (refundKeys/gift-{batch})
  // and the card's cmd.undone, in one transaction, so it can't happen twice.
  // A person who spent the coins can go below zero, like Take back.
  async function undoGift({ conv, msgId, me, data }) {
    const mref = msgDoc(conv, msgId);
    const m0 = await mref.get();
    const c = m0.exists ? m0.get('cmd') : null;
    if (!c || c.name !== 'give') return note('That gift is gone.');
    const batch = String(c.batch || '');
    if (!/^[\w-]{8,90}$/.test(batch))
      return note('This gift can’t be undone from its card.', 'It was sent before Undo existed. Reverse it from their coin history instead.');
    const giver = data.rename(m0.get('by') || '');
    const found = (await db.collection('coins').where('batch', '==', batch).limit(500).get()).docs.map((x) => x.ref);
    const refs = found.length ? found : c.to ? [db.doc(`coins/gift-${batch}-${nameKey(data.rename(String(c.to)))}`)] : [];
    if (!refs.length) return note('I can’t find that gift in the coin history.', 'Nothing was changed.');
    const keyRef = db.doc(`refundKeys/gift-${batch}`);
    const now = Date.now();
    const out = await db.runTransaction(async (tx) => {
      const [key, msg, ...gifts] = await Promise.all([tx.get(keyRef), tx.get(mref), ...refs.map((r) => tx.get(r))]);
      if (key.exists || msg.get('cmd.undone')) return note('That gift was already undone.');
      const list = gifts.filter((g) => g.exists && g.get('type') === 'gift' && data.rename(g.get('from') || '') === giver).map((g) => g.data());
      if (!list.length) return note('I can’t find that gift in the coin history.', 'Nothing was changed.');
      const total = sumCoins(list);
      // The giver gets it all back, but never past a googol (MAX_BALANCE).
      const over = await ceilingCheck(tx, giver, total, data);
      if (over) return note(ceilingNote(giver).error, 'Nobody can hold more than that. Nothing was undone.');
      const toWhat = c.group || list[0].to;
      tx.set(keyRef, { via: 'gift', mode: 'undogift', batch, giver, total, n: list.length, by: me, at: now });
      for (const x of list)
        tx.set(db.collection('coins').doc(`undo-${batch}-${nameKey(x.to)}`), {
          type: 'refund',
          person: x.to,
          amount: -x.amount,
          label: `Gift undone by ${ownerFirst}: from ${x.from}`,
          at: now,
        });
      tx.set(db.collection('coins').doc(`undo-${batch}-from`), {
        type: 'refund',
        person: giver,
        amount: total,
        label: `Gift undone by ${ownerFirst}: to ${toWhat}`,
        at: now,
      });
      tx.update(mref, new FieldPath('cmd', 'undone'), { by: me, at: now, total, n: list.length });
      return { ok: true, giver, list, total };
    });
    if (!out.ok) return out;
    await notify([
      ...out.list
        .filter((x) => data.rename(x.to) !== me)
        .map((x) => ({
          to: x.to,
          type: 'dispute',
          icon: '↩️',
          title: `${ownerFirst} undid ${first(x.from)}’s gift: −${coinsText(x.amount)}`,
          body: 'It’s in your coin history.',
          open: `chat:${conv}`,
          by: me,
        })),
      ...(out.giver !== me
        ? [{ to: out.giver, type: 'dispute', icon: '↩️', title: `${ownerFirst} undid your gift: +${coinsText(out.total)} back`, body: 'It’s in your coin history.', open: `chat:${conv}`, by: me }]
        : []),
    ]).catch((e) => logger.warn('undoGift notify', e.message));
    return { ok: true, mode: 'undogift', total: out.total, n: out.list.length };
  }

  const ownerRefund = onCall(OPEN, async (req) => {
    const { me, admin, data } = await caller(req);
    if (!admin || me !== data.rename(owner)) throw new HttpsError('permission-denied', `Only ${ownerFirst} can do that.`);
    const { conv, msgId, person, mode } = req.data || {};
    if (!validConv(conv) || !validId(msgId)) return note('Which game?');
    if (mode === 'undogift') return undoGift({ conv, msgId, me, data });
    if (mode !== 'refund' && mode !== 'takeback') return note('Refund or take back?');
    if (typeof person !== 'string' || !person.trim() || person.length > 80) return note('Whose result?');
    const who = data.rename(person.trim());
    const aliases = data.rename.aliases(who).slice(0, 30);
    const mref = msgDoc(conv, msgId);
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
      if (mode === 'refund') {
        const over = await ceilingCheck(tx, who, amount, data);
        if (over) return over.problem;
      }
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
      const report = rep.exists && rep.get('status') === 'open' ? { id: rep.id, by: rep.get('by'), at: rep.get('at') } : null;
      return { ok: true, mode, amount, person: who, game: check.game, report };
    });
    if (!out.ok) return out;
    if (out.report) await clearReportNotes([out.report], data);
    if (out.person !== me)
      await notify([{ to: out.person, type: 'dispute', ...d.fixNote({ ...out, by: me }), open: `chat:${conv}`, by: me }]).catch((e) =>
        logger.warn('ownerRefund notify', e.message),
      );
    return out;
  });

  return { dispute, disputeDecide, disputeRefundAll, ownerRefund };
}
