// Team life (3.0): the weekly recap (E1), lab bingo (E3), score predictions
// (G11) and coins for streak milestones. index.js makes these with its
// database and name list (lifeFunctions) and exports them.
//
// Every coin here is decided on the server from the team's data and paid
// through awardCoins (award.js): bingo lines, prediction wins and streak
// milestones each have a one-time key, so nothing pays twice.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { awardCoins } from './award.js';
import { AWARD_CAPS, teamDay } from './shared/coins.js';
import { addDay } from './shared/streaks.js';
import { nameKey } from './shared/team.js';
import { bingoAwards, bingoCard, bingoWeek, dailyAnswersIn } from './shared/bingo.js';
import { buildRecap, recapWeek } from './shared/recap.js';
import { cleanScore, guessProblem, isLive, matchRoundId, predictKey, ROUND_TTL, runTotal, settle } from './shared/predict.js';
import { streakAwards } from './shared/streakRewards.js';

const TIME_ZONE = 'America/New_York';
// The time everything here goes by. Tests set a fixed clock (lifeClock.now)
// to run the scheduled functions as if it were, say, Sunday at 6 PM.
export const lifeClock = { now: () => Date.now() };
const clock = lifeClock;
const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
// Same as COMPETITION in src/config.js (settings/team.competitionDate overrides it).
const COMPETITION_DATE = '2026-11-14';

export function lifeFunctions({ db, renamer }) {
  // The signed-in teammate (a device with a password), under their current name.
  async function memberOf(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const m = await db.doc(`members/${uid}`).get();
    if (!m.exists || m.get('via') !== 'password') throw new HttpsError('permission-denied', 'Sign in first.');
    const rename = await renamer();
    return { uid, name: rename(m.get('name')), admin: m.get('admin') === true, rename };
  }

  const coinsOff = async () => ((await db.doc('settings/controls').get()).get('off') || []).includes('coins');

  // The same award under each name this person has gone by: a rename doesn't
  // make a line, a win or a milestone payable again.
  const aliasKeys = (key, name, rename) => {
    const id = nameKey(name);
    return [...new Set(rename.aliases(name).map((n) => key.replace(id, nameKey(n))))];
  };
  async function paidKeys(keys) {
    if (!keys.length) return new Set();
    const refs = keys.map((k) => db.doc(`awardKeys/${k.replace(/\//g, '_').slice(0, 300)}`));
    const docs = await db.getAll(...refs);
    return new Set(docs.filter((d) => d.exists).map((d) => d.id));
  }
  // Pays an award whole or not at all: if today's cap for the source can't
  // fit all of it, it waits (no key is written, so the next check pays it).
  async function awardWhole(person, award, source, rename, now) {
    const keys = aliasKeys(award.key, person, rename);
    const have = await paidKeys(keys);
    if (have.size) return { paid: 0, already: true };
    const today = await db
      .collection('coins')
      .where('type', '==', 'award')
      .where('person', '==', person)
      .where('source', '==', source)
      .where('day', '==', teamDay(now))
      .get();
    const left = AWARD_CAPS[source] - today.docs.reduce((t, d) => t + (d.get('amount') || 0), 0);
    if (award.amount > left) return { paid: 0, waiting: true };
    const paid = await awardCoins(db, { person, amount: award.amount, source, label: award.label, key: award.key }, now);
    return { paid, already: !paid };
  }

  // ---------- lab bingo ----------

  // One person's card for a week, from the database.
  async function bingoFor(name, rename, week, now) {
    const from = Date.parse(`${addDay(week, -1)}T00:00:00Z`); // a day early: covers New York's offset
    const to = Date.parse(`${addDay(week, 8)}T00:00:00Z`);
    const aliases = rename.aliases(name).slice(0, 30);
    const [shifts, logs, tasks, runs, plans, rounds, daily] = await Promise.all([
      db.collection('shifts').where('start', '>=', from).where('start', '<', to).get(),
      db.collection('labLogs').where('person', 'in', aliases).get(),
      db.collection('tasks').where('status', '==', 'done').get(),
      db.collection('runs').where('date', '>=', week).get(),
      db.collection('shiftPlans').where('date', '>=', week).get(),
      db
        .collection('predictions')
        .where('openedAt', '>=', from - 7 * 86400000)
        .get(),
      // The daily question (learn.js): one dailyAnswers doc per person and day.
      db.collection('dailyAnswers').where('day', '>=', week).where('day', '<', addDay(week, 7)).get(),
    ]);
    const mine = (n) => rename(n || '') === name;
    const { from: wFrom, to: wTo } = bingoWeek(Date.parse(`${week}T16:00:00Z`));
    const data = {
      shifts: shifts.docs
        .map((d) => d.data())
        .filter((s) => mine(s.person))
        .map((s) => ({ ...s, person: name })),
      logs: logs.docs.map((d) => {
        const l = d.data();
        return { ...l, person: name, workedWith: (l.workedWith || []).map((n) => rename(n)) };
      }),
      tasks: tasks.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .map((t) => ({ ...t, assignees: (t.assignees || []).map((n) => rename(n)) })),
      runs: runs.docs
        .map((d) => d.data())
        .map((r) => ({ ...r, createdBy: rename(r.createdBy || ''), drivers: (r.drivers || []).map((n) => rename(n)) })),
      plans: plans.docs
        .map((d) => d.data())
        .map((p) => ({ ...p, people: Object.fromEntries(Object.entries(p.people || {}).map(([n, v]) => [rename(n), v])) })),
      guesses: rounds.docs.filter((d) => Object.entries(d.get('times') || {}).some(([n, at]) => mine(n) && at >= wFrom && at < wTo)).length,
      dailyAnswers: dailyAnswersIn(
        daily.docs.map((d) => ({ ...d.data(), name: rename(d.get('name') || '') })),
        name,
        week,
      ),
    };
    return bingoCard(name, data, { week, now });
  }

  // Works out the card, pays any lines (and the full card) not paid yet, and
  // answers with the card and what's been paid.
  async function claim(name, rename, week, now) {
    const card = await bingoFor(name, rename, week, now);
    const owed = bingoAwards(name, card);
    const off = await coinsOff();
    const paid = {};
    let coins = 0;
    for (const a of owed) {
      if (off) {
        paid[a.line] = (await paidKeys(aliasKeys(a.key, name, rename))).size > 0;
        continue;
      }
      const r = await awardWhole(name, a, 'bingo', rename, now);
      paid[a.line] = r.already || r.paid > 0;
      coins += r.paid;
    }
    return { ...card, paid, coins };
  }

  // The app asks for its card (Today); lines it completed pay here.
  const claimBingo = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const me = await memberOf(req);
    const now = clock.now();
    const { week } = bingoWeek(now);
    // Last week's card can still pay through Tuesday (for lines that waited
    // on Sunday's daily cap).
    const last = addDay(week, -7);
    const wantLast = req.data?.week === last && teamDay(now) <= addDay(week, 1);
    return claim(me.name, me.rename, wantLast ? last : week, now);
  });

  // Every night: pay everyone's finished lines, opened Today or not.
  const bingoSweep = onSchedule({ schedule: '50 23 * * *', timeZone: TIME_ZONE }, async () => {
    const now = clock.now();
    const rename = await renamer();
    const roster = [...new Set((await db.collection('people').get()).docs.map((d) => rename(d.get('name') || '')).filter(Boolean))];
    const { week } = bingoWeek(now);
    const weeks = teamDay(now) <= addDay(week, 1) ? [addDay(week, -7), week] : [week];
    for (const name of roster)
      for (const w of weeks) await claim(name, rename, w, now).catch((e) => logger.warn('bingo', name, w, e.message));
  });

  // ---------- score predictions ----------

  const roundRef = (id) => db.doc(`predictions/${id}`);
  const secretRef = (id) => db.doc(`predictions/${id}/secret/guesses`);

  async function liveRunRounds() {
    const snap = await db.collection('predictions').where('status', 'in', ['open', 'locked']).get();
    return snap.docs.filter((d) => d.get('kind') === 'run').sort((a, b) => (a.get('openedAt') || 0) - (b.get('openedAt') || 0));
  }

  // Locks a round and shows everyone's guesses.
  async function lockRound(tx, ref, round, by, now) {
    const secret = (await tx.get(secretRef(ref.id))).get('guesses') || {};
    tx.update(ref, {
      status: 'locked',
      lockedAt: now,
      lockedBy: by,
      guesses: Object.fromEntries(Object.entries(secret).map(([n, g]) => [n, g.score])),
    });
  }

  const predict = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const me = await memberOf(req);
    const now = clock.now();
    const { action, id, matchId } = req.data || {};
    const safeId = (v) => (/^[\w-]{1,80}$/.test(String(v || '')) ? String(v) : null);

    // Start guessing for the next practice run (one open at a time).
    if (action === 'open') {
      const live = await liveRunRounds();
      const fresh = live.filter((d) => now - (d.get('openedAt') || 0) < ROUND_TTL);
      for (const d of live) if (!fresh.includes(d)) await d.ref.update({ status: 'void', note: 'No run was logged.' });
      if (fresh.length) return { ok: true, id: fresh[0].id };
      const ref = db.collection('predictions').doc();
      await ref.set({ kind: 'run', label: 'Next practice run', status: 'open', openedBy: me.name, openedAt: now, guessers: [], times: {} });
      return { ok: true, id: ref.id };
    }

    if (action === 'guess') {
      const score = cleanScore(req.data?.score);
      if (score === null) return { error: 'Guess a whole number of points.' };
      const mId = matchId ? safeId(matchId) : null;
      const rId = mId ? matchRoundId(mId) : safeId(id);
      if (!rId) throw new HttpsError('invalid-argument', 'Which run?');
      return db.runTransaction(async (tx) => {
        const ref = roundRef(rId);
        const snap = await tx.get(ref);
        const round = snap.exists ? snap.data() : null;
        const match = mId ? await tx.get(db.doc(`matches/${mId}`)) : null;
        if (mId && !match.exists) return { error: 'That match isn’t on the schedule.' };
        if (!mId && !round) return { error: 'That run isn’t open for guesses.' };
        const problem = guessProblem(round, me.name, now, match?.data() || null);
        if (problem) return { error: problem };
        const guessers = [...(round?.guessers || []), me.name];
        const times = { ...(round?.times || {}), [me.name]: now };
        if (round) tx.update(ref, { guessers, times });
        else
          tx.set(ref, {
            kind: 'match',
            matchId: mId,
            label: String(match.get('label') || 'Match'),
            status: 'open',
            openedBy: me.name,
            openedAt: now,
            lockAt: match.get('time'),
            guessers,
            times,
          });
        tx.set(secretRef(rId), { guesses: { [me.name]: { score, at: now } } }, { merge: true });
        return { ok: true };
      });
    }

    // The run is starting: no more guesses, and everyone's guess shows.
    if (action === 'lock') {
      const rId = safeId(id);
      if (!rId) throw new HttpsError('invalid-argument', 'Which run?');
      return db.runTransaction(async (tx) => {
        const ref = roundRef(rId);
        const snap = await tx.get(ref);
        if (!snap.exists || snap.get('status') !== 'open') return { ok: true };
        if (snap.get('kind') === 'match' && now < (snap.get('lockAt') || 0)) return { error: 'It locks when the match starts.' };
        await lockRound(tx, ref, snap.data(), me.name, now);
        return { ok: true };
      });
    }

    // Called off (no run after all): whoever opened it, or team management.
    if (action === 'cancel') {
      const rId = safeId(id);
      if (!rId) throw new HttpsError('invalid-argument', 'Which run?');
      const snap = await roundRef(rId).get();
      if (!snap.exists || !isLive(snap.data())) return { ok: true };
      if (snap.get('openedBy') !== me.name && !me.admin) return { error: 'Only whoever started it (or team management) can call it off.' };
      await snap.ref.update({ status: 'void', note: `Called off by ${me.name}` });
      return { ok: true };
    }
    throw new HttpsError('invalid-argument', 'Unknown action.');
  });

  // Who logged a run (or changed it), under current names. The rules stamp
  // createdByUid / updatedByUid with the writing device, so nobody can put
  // it on someone else, and a rename doesn't matter. Runs written without
  // them (from before, or by the server) fall back to the names saved on them.
  async function loggersOf(run, rename) {
    const names = new Set();
    for (const uid of new Set([run.createdByUid, run.updatedByUid].filter((u) => typeof u === 'string' && u))) {
      const name = (await db.doc(`members/${uid}`).get()).get('name');
      if (name) names.add(rename(name));
    }
    if (!run.createdByUid && run.createdBy) names.add(rename(run.createdBy));
    if (!run.updatedByUid && run.updatedBy) names.add(rename(run.updatedBy));
    return names;
  }

  // A run was logged: the round it belongs to (its match's, or the oldest
  // open practice round) gets its score, and the closest guess is paid.
  // Whoever logged it can't win it (they could type in a score to match
  // their guess): the closest of everyone else's guesses wins.
  async function settleRound(ref, run, runId, loggedAt, now) {
    const rename = await renamer();
    const loggers = await loggersOf(run, rename);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !isLive(snap.data())) return null;
      // A match's score counts only once the match has started (anyone can
      // log a run, so a made-up score before the match can't settle it).
      if (snap.get('kind') === 'match' && loggedAt < (snap.get('lockAt') || 0)) return null;
      const secret = (await tx.get(secretRef(ref.id))).get('guesses') || {};
      const score = runTotal(run);
      const out = Object.keys(secret).filter((n) => loggers.has(rename(n)));
      const r = settle(secret, score, loggedAt, out);
      tx.update(ref, {
        status: 'done',
        runId,
        score,
        guesses: r.guesses,
        winners: r.winners,
        loggedBy: [...new Set([...loggers, ...out])],
        lockedAt: snap.get('lockedAt') || loggedAt,
        settledAt: now,
      });
      return r;
    });
    if (!result || !result.winners.length) return result;
    const paid = {};
    if (!(await coinsOff()))
      for (const name of result.winners) {
        const amount = result.pays[name];
        const key = predictKey(ref.id, name);
        if ((await paidKeys(aliasKeys(key, name, rename))).size) continue;
        paid[name] = await awardCoins(
          db,
          { person: name, amount, source: 'predict', label: `Closest guess on ${run.matchNumber || 'a practice run'}`, key },
          now,
        );
      }
    await ref.update({ paid });
    return result;
  }

  // New runs, and a match's run whose score changed (the pit screen fixes a
  // score by updating the run it logged, so a match still waiting on its
  // score settles then).
  const onRunLogged = onDocumentWritten('runs/{runId}', async (event) => {
    if (!event.data?.after?.exists) return;
    const run = event.data.after.data();
    const before = event.data.before?.exists ? event.data.before.data() : null;
    if (before && !(run.matchId && runTotal(before) !== runTotal(run))) return;
    const now = clock.now();
    const loggedAt = (!before && toMs(run.createdAt)) || Date.parse(event.time || '') || now;
    let ref = null;
    if (run.matchId) ref = roundRef(matchRoundId(String(run.matchId)));
    else if ((run.type || 'practice') === 'practice') {
      const live = (await liveRunRounds()).filter((d) => (d.get('openedAt') || 0) <= loggedAt);
      ref = live[0]?.ref || null;
    }
    if (ref) await settleRound(ref, run, event.params.runId, loggedAt, now);
  });

  // Every 10 minutes: show the guesses on matches that have started, and
  // call off practice rounds nobody logged a run for.
  const lockPredictions = onSchedule({ schedule: 'every 10 minutes', timeZone: TIME_ZONE }, async () => {
    const now = clock.now();
    const open = await db.collection('predictions').where('status', '==', 'open').get();
    for (const d of open.docs) {
      if (d.get('kind') === 'match' && d.get('lockAt') && now >= d.get('lockAt'))
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(d.ref);
          if (snap.get('status') === 'open') await lockRound(tx, d.ref, snap.data(), 'Trotbot', now);
        });
      else if (d.get('kind') === 'run' && now - (d.get('openedAt') || 0) > ROUND_TTL)
        await d.ref.update({ status: 'void', note: 'No run was logged.' });
    }
  });

  // ---------- streak milestones ----------

  // A shift ended: pay the streak milestone it reached (if any, once).
  const onShiftEnded = onDocumentWritten('shifts/{id}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after || after.end == null || !after.person || (before && before.end != null)) return;
    if (await coinsOff()) return;
    const now = clock.now();
    const rename = await renamer();
    const name = rename(after.person);
    const aliases = rename.aliases(name).slice(0, 30);
    const [snap, edits] = await Promise.all([
      db.collection('shifts').where('person', 'in', aliases).get(),
      db.collection('shiftEdits').where('person', 'in', aliases).get(),
    ]);
    // Shifts they deleted themselves still count here: a milestone is paid
    // once per streak (keyed by the day it started), and deleting the first
    // day's shift would otherwise start the "same" streak a day later and
    // pay its milestone again, every day.
    const deleted = edits.docs
      .map((d) => d.data())
      .filter((e) => e.kind === 'delete' && rename(e.by || '') === name && Number.isFinite(e.before?.start))
      .map((e) => ({ start: e.before.start, end: e.before.end ?? e.before.start, person: name }));
    const shifts = [...snap.docs.map((d) => ({ ...d.data(), person: name })), ...deleted];
    for (const a of streakAwards(name, shifts, now)) await awardWhole(name, a, 'streak', rename, now);
  });

  // ---------- the weekly recap ----------

  async function recapData(now) {
    const rename = await renamer();
    const lastWeek = addDay(recapWeek(now), -7);
    const [shifts, tasks, logs, runs, people, team] = await Promise.all([
      db.collection('shifts').get(),
      db.collection('tasks').get(),
      db.collection('labLogs').where('day', '>=', lastWeek).get(),
      db.collection('runs').where('date', '>=', lastWeek).get(),
      db.collection('people').get(),
      db.doc('settings/team').get(),
    ]);
    const list = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
    return {
      shifts: list(shifts).map((s) => ({ ...s, person: rename(s.person || '') })),
      tasks: list(tasks).map((t) => ({ ...t, assignees: [...new Set((t.assignees || []).map((n) => rename(n)))] })),
      logs: list(logs).map((l) => ({ ...l, person: rename(l.person || '') })),
      runs: list(runs),
      roster: [...new Set(people.docs.map((d) => rename(d.get('name') || '')).filter(Boolean))],
      competition: { name: team.get('compEvent')?.name || 'the competition', date: team.get('competitionDate') || COMPETITION_DATE },
    };
  }

  // Posts the week's recap in #general, unless it's already posted or
  // skipped. by: who asked (Trotbot on Sunday evening).
  async function postRecap(now, by) {
    const week = recapWeek(now);
    const stateRef = db.doc(`recaps/${week}`);
    const state = (await stateRef.get()).data();
    if (state?.status === 'posted' || state?.status === 'skipped') return { status: state.status };
    const recap = buildRecap(await recapData(now), now, week);
    const msgRef = db.doc(`channels/general/messages/recap-${week}`);
    return db.runTransaction(async (tx) => {
      const again = (await tx.get(stateRef)).data();
      if (again?.status === 'posted' || again?.status === 'skipped') return { status: again.status };
      tx.set(msgRef, {
        text: recap.text,
        by: 'Trotbot',
        byUid: 'trotbot',
        bot: true,
        at: now,
        cmd: { name: 'recap', ...recap },
        mentions: [],
        taskIds: [],
        replyTo: null,
        reactions: {},
        photo: null,
      });
      tx.set(stateRef, { week, status: 'posted', by, at: now, msgId: msgRef.id });
      return { status: 'posted' };
    });
  }

  // Sundays at 6 PM (New York).
  const weeklyRecap = onSchedule({ schedule: '0 18 * * 0', timeZone: TIME_ZONE }, async () => {
    const r = await postRecap(clock.now(), 'Trotbot');
    logger.info('weekly recap', r.status);
  });

  // Team management: see this week's recap any time, post it early, or skip a week.
  const recap = onCall({ maxInstances: 2, invoker: 'public', timeoutSeconds: 60 }, async (req) => {
    const me = await memberOf(req);
    if (!me.admin) throw new HttpsError('permission-denied', 'Only team management can do that.');
    const now = clock.now();
    const week = recapWeek(now);
    const stateRef = db.doc(`recaps/${week}`);
    const { action } = req.data || {};
    if (action === 'preview') {
      const state = (await stateRef.get()).data() || null;
      return { recap: buildRecap(await recapData(now), now, week), state };
    }
    if (action === 'post') return postRecap(now, me.name);
    if (action === 'skip' || action === 'unskip')
      return db.runTransaction(async (tx) => {
        const state = (await tx.get(stateRef)).data();
        if (state?.status === 'posted') return { status: 'posted' };
        if (action === 'skip') tx.set(stateRef, { week, status: 'skipped', by: me.name, at: now });
        else if (state) tx.delete(stateRef);
        return { status: action === 'skip' ? 'skipped' : 'waiting' };
      });
    throw new HttpsError('invalid-argument', 'Unknown action.');
  });

  return { claimBingo, bingoSweep, predict, onRunLogged, lockPredictions, onShiftEnded, weeklyRecap, recap };
}
