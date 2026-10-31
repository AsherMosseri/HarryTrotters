// Demo mode's side of Learn: the same flow as functions/learn.js (one open
// question per game, no repeats until a game's questions run out, coins for
// first right answers under the daily cap), played from the demo-only sample
// questions in src/learnDemo.js. The real banks never ship in the app.
import { DEMO_ALL, DEMO_BANKS } from '../learnDemo.js';
import { AUTO_TIERS, simulate } from '../../functions/shared/autoPath.js';
import { shuffleBy, timelineItems, timelineQuestion, whoItems, whoQuestion } from '../../functions/shared/teamQuiz.js';
import { AWARD_CAPS, teamDay } from '../../functions/shared/coins.js';

const SECRET = ['answer', 'bugLine', 'fixed', 'explain', 'ports', 'source', 'fix', 'demo'];
const publicOf = (q) => Object.fromEntries(Object.entries(q).filter(([k]) => !SECRET.includes(k)));
const byId = new Map(DEMO_ALL.map((q) => [q.id, q]));
const NAMES = {
  parts: 'Name that part',
  rules: 'Rules check',
  strategy: 'Strategy',
  wiring: 'Wiring puzzle',
  spot: 'Spot the problem',
  code: 'Fix the bug',
  gear: 'Gear ratio challenge',
  who: 'Who did this?',
  timeline: 'Robot timeline',
};
const fail = (message) => {
  throw new Error(message);
};

export function demoLearn(get, commit, listen) {
  const st = (name) => {
    const s = get();
    s.quiz = s.quiz || {};
    s.quiz[name] = s.quiz[name] || { banks: {}, pending: {}, stats: {}, auto: {}, daily: {}, secrets: {} };
    return s.quiz[name];
  };
  const progressOf = (q) => {
    const stats = q.stats || {};
    const games = {};
    for (const g of [...Object.keys(NAMES), 'auto']) {
      const b = (stats.byBank || {})[g] || {};
      games[g] = { answered: b.answered || 0, correct: b.correct || 0, seen: (q.banks[g]?.seen || []).length, total: DEMO_BANKS[g]?.length ?? null };
    }
    return {
      answered: stats.answered || 0,
      correct: stats.correct || 0,
      streak: stats.streak || 0,
      best: stats.best || 0,
      games,
      auto: { best: q.auto?.best || 0 },
      daily: { streak: q.daily?.streak || 0, best: q.daily?.best || 0 },
    };
  };
  const paidToday = (name, source) =>
    (get().coins || []).filter((c) => c.type === 'award' && c.person === name && c.source === source && c.day === teamDay(Date.now())).reduce((t, c) => t + c.amount, 0);
  const today = (name) => ({ paid: paidToday(name, 'quiz'), cap: AWARD_CAPS.quiz });
  // Same rules as functions/award.js.
  const award = (name, amount, source, label, key) => {
    const s = get();
    s.awardKeys = s.awardKeys || {};
    if (s.awardKeys[key]) return 0;
    const pay = Math.min(amount, Math.max(0, AWARD_CAPS[source] - paidToday(name, source)));
    if (!pay) return 0;
    const now = Date.now();
    s.coins = [...(s.coins || []), { id: `a${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`, type: 'award', person: name, amount: pay, source, label, day: teamDay(now), at: now }];
    s.awardKeys[key] = true;
    return pay;
  };
  const teamItems = (bank, name) => {
    const s = get();
    if (bank === 'who') {
      const items = whoItems({ logs: s.labLogs || [], tasks: s.tasks || [], now: Date.now(), days: 365 });
      return { items, roster: [...new Set((s.tasks || []).flatMap((t) => t.assignees || []))].filter((n) => n !== name) };
    }
    return { items: timelineItems({ versions: (s.robot?.versions || []).map((v) => ({ ...v, sample: 0 })), milestones: s.milestones || [] }) };
  };

  // Today's demo daily question in #general (a sample, never a real one).
  function ensureDaily() {
    const s = get();
    const day = teamDay(Date.now());
    const general = s.chat?.general;
    if (!general || general.some((m) => m.id === `daily-${day}`)) return;
    const pool = DEMO_ALL.filter((q) => q.kind === 'choice' && q.bank !== 'wiring');
    const q = shuffleBy(pool, 'daily')[Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000) % pool.length];
    s.dailyDays = { ...(s.dailyDays || {}), [day]: q.id };
    s.chat = {
      ...s.chat,
      general: [
        ...general,
        {
          id: `daily-${day}`,
          text: `❓ Daily question: ${q.prompt}`,
          by: 'Trotbot',
          byUid: 'trotbot',
          bot: true,
          at: Date.now() - 3 * 3600000,
          cmd: { name: 'dailyq', day, prev: '', game: NAMES[q.bank], q: publicOf(q), answered: 1, firstCorrect: ['Sophia Bermudez'] },
          mentions: [],
          taskIds: [],
          replyTo: null,
          reactions: {},
          photo: null,
        },
      ],
    };
  }

  return {
    ensureDaily,
    async quizNext({ bank, skip }, actor) {
      if (!NAMES[bank]) fail('Which game?');
      const me = actor.name;
      const q = st(me);
      const open = q.pending[bank];
      if (open && !skip) {
        const found = q.secrets[bank]?.question || (byId.get(open.id) && publicOf(byId.get(open.id)));
        if (found?.id === open.id) return { question: found, progress: progressOf(q) };
      }
      if (open && skip) q.stats.streak = 0;
      let question;
      if (bank === 'who' || bank === 'timeline') {
        const team = teamItems(bank, me);
        const seen = q.banks[bank]?.seen || [];
        const made = bank === 'who' ? whoQuestion(team.items, { me, seen, roster: team.roster, seed: me }) : timelineQuestion(team.items, { seen, seed: me });
        if (!made) {
          delete q.pending[bank];
          commit();
          return {
            question: null,
            empty: bank === 'who' ? 'You’ve seen every recent lab log and finished task. New ones show up as the team logs.' : 'Not enough robot versions and milestones with dates yet.',
            progress: progressOf(q),
          };
        }
        q.banks[bank] = { seen: [...seen, bank === 'who' ? made.id : made.key] };
        q.secrets[bank] = made;
        question = made.question;
      } else {
        const list = DEMO_BANKS[bank];
        let b = q.banks[bank] || { round: 1, seen: [] };
        if (b.seen.length >= list.length) b = { round: b.round + 1, seen: [], last: b.last };
        const order = shuffleBy(
          list.map((x) => x.id),
          `${me}|${bank}|${b.round}`,
        );
        let pick = order.find((id) => !b.seen.includes(id));
        if (!b.seen.length && pick === b.last && order.length > 1) pick = order[1];
        q.banks[bank] = { round: b.round, seen: [...b.seen, pick], last: pick };
        question = publicOf(byId.get(pick));
      }
      q.pending[bank] = { id: question.id, at: Date.now() };
      commit();
      return { question, progress: progressOf(q) };
    },
    async quizAnswer({ id, answer }, actor) {
      const me = actor.name;
      const q = st(me);
      const bank = Object.keys(q.pending).find((b) => q.pending[b]?.id === id);
      if (!bank) fail('That question isn’t open any more. Load the next one.');
      let result;
      let difficulty = 1;
      if (bank === 'who' || bank === 'timeline') {
        const secret = q.secrets[bank];
        difficulty = secret.question.difficulty;
        if (bank === 'who') result = { correct: answer === secret.answer, answer: secret.answer, explain: secret.explain };
        else
          result = {
            correct: Array.isArray(answer) && answer.every((x, i) => x === secret.order[i]),
            order: secret.order,
            dates: secret.dates,
            explain: secret.order.map((i) => secret.dates[i]).join(' → '),
          };
      } else {
        const full = byId.get(id);
        difficulty = full.difficulty;
        const correct = full.kind === 'bug' ? answer === full.bugLine : typeof answer === 'string' && full.ports ? full.ports.includes(answer) : answer === full.answer;
        result = { correct };
        for (const k of ['answer', 'bugLine', 'fixed', 'explain', 'ports', 'source', 'fix']) if (full[k] !== undefined) result[k] = full[k];
      }
      const stats = q.stats;
      stats.byBank = stats.byBank || {};
      const b = (stats.byBank[bank] = stats.byBank[bank] || { answered: 0, correct: 0 });
      b.answered += 1;
      stats.answered = (stats.answered || 0) + 1;
      if (result.correct) {
        b.correct += 1;
        stats.correct = (stats.correct || 0) + 1;
      }
      stats.streak = result.correct ? (stats.streak || 0) + 1 : 0;
      stats.best = Math.max(stats.best || 0, stats.streak);
      delete q.pending[bank];
      const coins = result.correct ? award(me, { 1: 1, 2: 2, 3: 3 }[difficulty] || 1, 'quiz', NAMES[bank], `quiz-${id}-${me}`) : 0;
      commit();
      return { ...result, bank, coins, progress: progressOf(q), today: today(me) };
    },
    async quizProgress(actor) {
      ensureDaily();
      const q = st(actor.name);
      return { progress: progressOf(q), totals: Object.fromEntries(Object.entries(DEMO_BANKS).filter(([k]) => k !== 'gear').map(([k, v]) => [k, v.length])), today: today(actor.name) };
    },
    async quizReport({ id, note }, actor) {
      const s = get();
      const full = byId.get(id);
      const secret = Object.values(st(actor.name).secrets).find((x) => x?.id === id);
      const src = full || secret?.question;
      if (!src) fail('Which question?');
      s.quizReports = [
        ...(s.quizReports || []),
        {
          id: `r${Date.now().toString(36)}`,
          qid: id,
          bank: src.bank,
          game: NAMES[src.bank],
          prompt: src.prompt,
          answer: full ? (full.kind === 'bug' ? `Line ${full.bugLine + 1}: ${full.fixed}` : full.choices[full.answer]) : secret.explain,
          source: full?.source || '',
          note: note || '',
          by: actor.name,
          at: Date.now(),
          status: 'open',
        },
      ];
      commit();
      return { ok: true };
    },
    subscribeQuizReports(cb) {
      return listen(() => cb((get().quizReports || []).filter((r) => r.status === 'open')));
    },
    async handleQuizReport(id, status, actor) {
      const s = get();
      s.quizReports = (s.quizReports || []).map((r) => (r.id === id ? { ...r, status, handledBy: actor.name, handledAt: Date.now() } : r));
      commit();
    },
    async autoRun({ path }, actor) {
      const me = actor.name;
      const run = simulate(path);
      if (run.error) fail(run.error);
      const q = st(me);
      const prev = q.auto.best || 0;
      q.auto = { best: Math.max(prev, run.score), runs: (q.auto.runs || 0) + 1 };
      q.stats.byBank = q.stats.byBank || {};
      q.stats.byBank.auto = { answered: (q.stats.byBank.auto?.answered || 0) + 1, correct: 0 };
      let coins = 0;
      for (const tier of AUTO_TIERS.filter((t) => run.score >= t)) coins += award(me, 2, 'quiz', `Auto planner: ${tier}+ points`, `quiz-auto-${tier}-${me}`);
      commit();
      return { ...run, best: q.auto.best, newBest: run.score > prev, coins, progress: progressOf(q), today: today(me) };
    },
    async dailyAnswer({ day, answer }, actor) {
      const s = get();
      const me = actor.name;
      if (day !== teamDay(Date.now())) fail('That question is closed. A new one comes out each school day.');
      const key = `${day}_${me}`;
      s.dailyAnswers = s.dailyAnswers || {};
      if (s.dailyAnswers[key]) fail('You already answered today’s question.');
      const full = byId.get(s.dailyDays?.[day]);
      if (!full) fail('No question today.');
      const correct = answer === full.answer;
      const msgs = s.chat.general;
      const msg = msgs.find((m) => m.id === `daily-${day}`);
      const firstCorrect = [...(msg.cmd.firstCorrect || [])];
      if (correct) firstCorrect.push(me);
      const rank = correct ? firstCorrect.length : 0;
      const q = st(me);
      q.daily = { streak: (q.daily.streak || 0) + 1, best: Math.max(q.daily.best || 0, (q.daily.streak || 0) + 1), lastDay: day };
      const coins = correct ? award(me, [5, 4, 3][rank - 1] || 2, 'daily', 'Daily question', `daily-${day}-${me}`) : 0;
      const doc = { name: me, day, qid: full.id, given: answer, correct, answer: full.answer, explain: full.explain, ...(full.source ? { source: full.source } : {}), ...(full.fix ? { fix: full.fix } : {}), rank, streak: q.daily.streak, coins, at: Date.now() };
      s.dailyAnswers[key] = doc;
      s.chat = { ...s.chat, general: msgs.map((m) => (m === msg ? { ...m, cmd: { ...m.cmd, answered: (m.cmd.answered || 0) + 1, firstCorrect: firstCorrect.slice(0, 3) } } : m)) };
      commit();
      return doc;
    },
    subscribeDailyAnswer(day, name, cb) {
      return listen(() => cb((get().dailyAnswers || {})[`${day}_${name}`] || null));
    },
  };
}
