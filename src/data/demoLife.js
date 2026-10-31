// Team life in demo mode: the same rules the server runs (functions/life.js),
// on the demo's own data. Lab bingo, score predictions, streak coins and the
// weekly recap (with a sample recap already posted in #general).
import { AWARD_CAPS, teamDay } from '../../functions/shared/coins.js';
import { addDay } from '../../functions/shared/streaks.js';
import { bingoAwards, bingoCard, bingoWeek } from '../../functions/shared/bingo.js';
import { buildRecap, recapWeek } from '../../functions/shared/recap.js';
import { cleanScore, guessProblem, isLive, matchRoundId, predictKey, ROUND_TTL, runTotal, settle } from '../../functions/shared/predict.js';
import { streakAwards } from '../../functions/shared/streakRewards.js';
import { ROSTER, COMPETITION } from '../config.js';

export function demoLife({ get, commit, uid }) {
  const S = () => get();

  // awardCoins (functions/award.js), whole or not at all like the server's
  // bingo and streak payments.
  function award({ person, amount, source, label, key }, now = Date.now(), whole = false) {
    const s = S();
    const keys = (s.awardKeys = s.awardKeys || {});
    if (key && keys[key]) return 0;
    const day = teamDay(now);
    const sofar = (s.coins || [])
      .filter((x) => x.type === 'award' && x.person === person && x.source === source && x.day === day)
      .reduce((t, x) => t + x.amount, 0);
    const left = Math.max(0, (AWARD_CAPS[source] || 0) - sofar);
    if (whole && amount > left) return 0;
    const pay = Math.min(amount, left);
    if (!pay) return 0;
    s.coins = [...(s.coins || []), { id: `a${uid()}`, type: 'award', person, amount: pay, source, label, day, at: now }];
    if (key) keys[key] = { person, source, day, at: now };
    return pay;
  }

  // ---------- lab bingo ----------
  function claimBingo(req, actor) {
    const s = S();
    const now = Date.now();
    const { week } = bingoWeek(now);
    const { from, to } = bingoWeek(now);
    const card = bingoCard(
      actor.name,
      {
        shifts: s.shifts || [],
        logs: s.labLogs || [],
        tasks: s.tasks || [],
        runs: s.runs || [],
        plans: s.shiftPlans || [],
        guesses: (s.predictions || []).filter((p) => {
          const at = p.times?.[actor.name];
          return at >= from && at < to;
        }).length,
      },
      { week, now },
    );
    const paid = {};
    let coins = 0;
    for (const a of bingoAwards(actor.name, card)) {
      const got = award({ person: actor.name, amount: a.amount, source: 'bingo', label: a.label, key: a.key }, now, true);
      coins += got;
      paid[a.line] = !!(s.awardKeys || {})[a.key];
    }
    if (coins) commit();
    return { ...card, paid, coins };
  }

  // ---------- score predictions ----------
  const secrets = () => (S().predictionSecrets = S().predictionSecrets || {});
  const save = (round) => {
    const s = S();
    s.predictions = [...(s.predictions || []).filter((p) => p.id !== round.id), round];
  };
  const find = (id) => (S().predictions || []).find((p) => p.id === id) || null;

  function lockRound(round, by, now) {
    const g = secrets()[round.id] || {};
    save({
      ...round,
      status: 'locked',
      lockedAt: now,
      lockedBy: by,
      guesses: Object.fromEntries(Object.entries(g).map(([n, x]) => [n, x.score])),
    });
  }

  function predict(req, actor) {
    const now = Date.now();
    const me = actor.name;
    const { action, id, matchId } = req || {};
    tick(now);
    if (action === 'open') {
      const live = (S().predictions || []).find((p) => p.kind === 'run' && isLive(p));
      if (live) return { ok: true, id: live.id };
      const round = {
        id: `pr${uid()}`,
        kind: 'run',
        label: 'Next practice run',
        status: 'open',
        openedBy: me,
        openedAt: now,
        guessers: [],
        times: {},
      };
      save(round);
      commit();
      return { ok: true, id: round.id };
    }
    if (action === 'guess') {
      const score = cleanScore(req.score);
      if (score === null) return { error: 'Guess a whole number of points.' };
      const match = matchId ? (S().matches || []).find((m) => m.id === matchId) : null;
      if (matchId && !match) return { error: 'That match isn’t on the schedule.' };
      const rid = matchId ? matchRoundId(matchId) : id;
      const round = find(rid);
      if (!matchId && !round) return { error: 'That run isn’t open for guesses.' };
      const problem = guessProblem(round, me, now, match);
      if (problem) return { error: problem };
      save({
        ...(round || {
          id: rid,
          kind: 'match',
          matchId,
          label: match.label || 'Match',
          status: 'open',
          openedBy: me,
          openedAt: now,
          lockAt: match.time,
        }),
        guessers: [...(round?.guessers || []), me],
        times: { ...(round?.times || {}), [me]: now },
      });
      secrets()[rid] = { ...(secrets()[rid] || {}), [me]: { score, at: now } };
      commit();
      return { ok: true };
    }
    if (action === 'lock') {
      const round = find(id);
      if (!round || round.status !== 'open') return { ok: true };
      if (round.kind === 'match' && now < (round.lockAt || 0)) return { error: 'It locks when the match starts.' };
      lockRound(round, me, now);
      commit();
      return { ok: true };
    }
    if (action === 'cancel') {
      const round = find(id);
      if (!round || !isLive(round)) return { ok: true };
      if (round.openedBy !== me && !actor.admin) return { error: 'Only whoever started it (or team management) can call it off.' };
      save({ ...round, status: 'void', note: `Called off by ${me}` });
      commit();
      return { ok: true };
    }
    return { error: 'Unknown action.' };
  }

  // Matches that started lock, and stale practice rounds go away (the
  // server's lockPredictions, run whenever the demo looks).
  function tick(now = Date.now()) {
    for (const p of S().predictions || []) {
      if (p.status !== 'open') continue;
      if (p.kind === 'match' && p.lockAt && now >= p.lockAt) lockRound(p, 'Trotbot', now);
      else if (p.kind === 'run' && now - (p.openedAt || 0) > ROUND_TTL) save({ ...p, status: 'void', note: 'No run was logged.' });
    }
  }

  // A run was just logged (createRun / logMatchScore): settle its round.
  function runLogged(run) {
    const now = Date.now();
    const round = run.matchId
      ? find(matchRoundId(run.matchId))
      : (run.type || 'practice') === 'practice'
        ? (S().predictions || []).filter((p) => p.kind === 'run' && isLive(p)).sort((a, b) => a.openedAt - b.openedAt)[0]
        : null;
    if (!round || !isLive(round)) return;
    const score = runTotal(run);
    const r = settle(secrets()[round.id] || {}, score, now);
    const paid = {};
    for (const n of r.winners)
      paid[n] = award(
        {
          person: n,
          amount: r.pays[n],
          source: 'predict',
          label: `Closest guess on ${run.matchNumber || 'a practice run'}`,
          key: predictKey(round.id, n),
        },
        now,
      );
    save({
      ...round,
      status: 'done',
      runId: run.id,
      score,
      guesses: r.guesses,
      winners: r.winners,
      paid,
      lockedAt: round.lockedAt || now,
      settledAt: now,
    });
  }

  // ---------- streak milestones ----------
  function shiftEnded(person) {
    const now = Date.now();
    for (const a of streakAwards(person, S().shifts || [], now))
      award({ person, amount: a.amount, source: 'streak', label: a.label, key: a.key }, now, true);
  }

  // ---------- the weekly recap ----------
  const recapData = () => {
    const s = S();
    return {
      shifts: s.shifts || [],
      tasks: s.tasks || [],
      logs: s.labLogs || [],
      runs: s.runs || [],
      roster: ROSTER.map((p) => p.name || p),
      competition: { name: s.settings?.compEvent?.name || 'the competition', date: s.settings?.competitionDate || COMPETITION.date },
    };
  };
  function postRecap(now, by) {
    const s = S();
    const week = recapWeek(now);
    const state = (s.recaps || {})[week];
    if (state?.status === 'posted' || state?.status === 'skipped') return { status: state.status };
    const recap = buildRecap(recapData(), now, week);
    const id = `recap-${week}`;
    const general = ((s.chat || {}).general || []).filter((m) => m.id !== id);
    const post = {
      id,
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
    };
    s.chat = { ...(s.chat || {}), general: [...general, post] };
    s.recaps = { ...(s.recaps || {}), [week]: { week, status: 'posted', by, at: now } };
    commit();
    return { status: 'posted' };
  }
  function recap(req, actor) {
    if (!actor.admin) return Promise.reject(new Error('Only team management can do that.'));
    const now = Date.now();
    const week = recapWeek(now);
    const s = S();
    const state = (s.recaps || {})[week] || null;
    if (req.action === 'preview') return { recap: buildRecap(recapData(), now, week), state };
    if (req.action === 'post') return postRecap(now, actor.name);
    if (req.action === 'skip' || req.action === 'unskip') {
      if (state?.status === 'posted') return { status: 'posted' };
      const next = { ...(s.recaps || {}) };
      if (req.action === 'skip') next[week] = { week, status: 'skipped', by: actor.name, at: now };
      else delete next[week];
      s.recaps = next;
      commit();
      return { status: req.action === 'skip' ? 'skipped' : 'waiting' };
    }
    return { error: 'Unknown action.' };
  }

  // A sample to look at: last week's recap in #general (posted last Sunday
  // at 6 PM, as the server would), and a practice round with two guesses on
  // the Match log. Added once to a demo that doesn't have them yet.
  function seedSamples() {
    const s = S();
    if (s.lifeSeeded) return;
    s.lifeSeeded = true;
    const now = Date.now();
    const lastSunday = addDay(recapWeek(now), -1);
    const at = Date.parse(`${lastSunday}T23:00:00Z`);
    // Built as of now so the sample has the demo's recent days in it.
    const sample = buildRecap(recapData(), now, recapWeek(now));
    const id = `recap-sample`;
    const general = ((s.chat || {}).general || []).filter((m) => m.id !== id);
    s.chat = {
      ...(s.chat || {}),
      general: [
        ...general,
        {
          id,
          text: sample.text,
          by: 'Trotbot',
          byUid: 'trotbot',
          bot: true,
          at: Math.min(at, now - 3600000),
          cmd: { name: 'recap', ...sample },
          mentions: [],
          taskIds: [],
          replyTo: null,
          reactions: { '🔥': { 'Cooper Mlezcko': 'Cooper Mlezcko', 'Sophia Bermudez': 'Sophia Bermudez' } },
        },
      ],
    };
    const rid = `pr${uid()}`;
    save({
      id: rid,
      kind: 'run',
      label: 'Next practice run',
      status: 'open',
      openedBy: 'Jackson Lucks',
      openedAt: now - 20 * 60000,
      guessers: ['Jackson Lucks', 'Sophia Bermudez'],
      times: { 'Jackson Lucks': now - 19 * 60000, 'Sophia Bermudez': now - 12 * 60000 },
    });
    secrets()[rid] = { 'Jackson Lucks': { score: 105, at: now - 19 * 60000 }, 'Sophia Bermudez': { score: 88, at: now - 12 * 60000 } };
  }

  return { claimBingo, predict, recap, runLogged, shiftEnded, tick, seedSamples };
}
