// The educational games (plan section G): the server picks each person's
// next question, grades answers and pays coins. The question banks
// (functions/banks) never leave the server; the app only gets publicView().
//
// Firestore:
//   quizState/{personId}   progress, the open question per game, what's been
//                          seen (no answers), the daily streak. The person reads it.
//   quizSecrets/{personId} answers to open team-data questions (server only).
//   quizReports/{id}       "something's wrong with this question" (team management).
//   dailyAnswers/{day}_{personId}  your daily answer and its reveal (you read it).
//   quizMeta/daily         which question went out each day (server only).
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { BANKS, BANK_NAMES, asChoice, checkAnswer, dailyQuestion, getQuestion, nextQuestion, publicView } from './banks/index.js';
import { awardCoins } from './award.js';
import { AWARD_CAPS, teamDay } from './shared/coins.js';
import { isSchoolDay } from './shared/school.js';
import { timelineItems, timelineQuestion, whoItems, whoQuestion } from './shared/teamQuiz.js';
import { AUTO_TIERS, simulate } from './shared/autoPath.js';

export const QUIZ_BANKS = ['parts', 'rules', 'strategy', 'wiring', 'spot', 'code', 'gear'];
export const TEAM_GAMES = ['who', 'timeline'];
const GAMES = [...QUIZ_BANKS, ...TEAM_GAMES];
const NAMES = { ...BANK_NAMES, who: 'Who did this?', timeline: 'Robot timeline', auto: 'Auto path planner' };

// Coins for a first-time right answer, by difficulty (1-3).
export const COINS_BY_DIFFICULTY = { 1: 1, 2: 2, 3: 3 };
// The daily question: the first three right answers get more.
export const DAILY_COINS = [5, 4, 3];
export const DAILY_COINS_LATER = 2;
const AUTO_TIER_COINS = 2;

// Limits so nobody scripts the games: answers and new questions per minute,
// and an answer can't come back faster than a person could read it.
const PER_MINUTE = { next: 40, answer: 20, auto: 10 };
const MIN_ANSWER_MS = 900;
const REPORTS_PER_DAY = 20;

const bad = (msg) => new HttpsError('invalid-argument', msg);

export function learnFunctions({ db, renamer, personId, timeZone = 'America/New_York' }) {
  // Who's calling: their current name and the doc id for it.
  async function who(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!member.exists || member.get('via') !== 'password') throw new HttpsError('permission-denied', 'Sign in first.');
    const rename = await renamer();
    const me = rename(member.get('name') || '');
    if (!me) throw new HttpsError('permission-denied', 'Sign in first.');
    return { uid, me, pid: personId(me), rename, aliases: rename.aliases(me).slice(0, 10), admin: !!member.get('admin') };
  }

  const stateRef = (pid) => db.doc(`quizState/${pid}`);
  const secretRef = (pid) => db.doc(`quizSecrets/${pid}`);

  // A person's state; after a rename, picked up from the old name's doc.
  async function loadState(tx, w) {
    const snap = await tx.get(stateRef(w.pid));
    if (snap.exists) return snap.data();
    for (const alias of w.aliases.slice(1)) {
      const old = await tx.get(stateRef(personId(alias)));
      if (old.exists) return { ...old.data(), name: w.me };
    }
    return { name: w.me };
  }

  // Keeps the last minute of times for one kind of call; throws past the limit.
  function limit(state, kind, now) {
    const times = ((state.recent || {})[kind] || []).filter((t) => now - t < 60000);
    if (times.length >= PER_MINUTE[kind]) throw new HttpsError('resource-exhausted', 'Slow down a little and try again in a minute.');
    state.recent = { ...(state.recent || {}), [kind]: [...times, now] };
  }

  async function coinsOff() {
    const controls = (await db.doc('settings/controls').get()).data() || {};
    return (controls.off || []).includes('coins');
  }

  // Paid before for this key under any name this person has had.
  async function paidBefore(prefix, w) {
    const refs = w.aliases.map((a) => db.doc(`awardKeys/${`${prefix}-${personId(a)}`.replace(/\//g, '_').slice(0, 300)}`));
    const snaps = await db.getAll(...refs);
    return snaps.some((s) => s.exists);
  }

  // Coins paid today for a source, under every name.
  async function paidToday(source, w, now) {
    const snap = await db
      .collection('coins')
      .where('type', '==', 'award')
      .where('source', '==', source)
      .where('day', '==', teamDay(now))
      .get();
    const names = new Set(w.aliases);
    return snap.docs.filter((d) => names.has(d.get('person'))).reduce((t, d) => t + (d.get('amount') || 0), 0);
  }

  function progressOf(state) {
    const stats = state.stats || {};
    const games = {};
    for (const g of [...GAMES, 'auto']) {
      const b = (stats.byBank || {})[g] || {};
      const total = BANKS[g]?.length ?? null;
      const seen = (state.banks?.[g]?.seen || []).length;
      games[g] = { answered: b.answered || 0, correct: b.correct || 0, seen: g === 'gear' ? state.banks?.gear?.n || 0 : seen, total, round: state.banks?.[g]?.round || 1 };
    }
    return {
      answered: stats.answered || 0,
      correct: stats.correct || 0,
      streak: stats.streak || 0,
      best: stats.best || 0,
      games,
      auto: { best: state.auto?.best || 0 },
      daily: { streak: state.daily?.streak || 0, best: state.daily?.best || 0, lastDay: state.daily?.lastDay || '' },
    };
  }

  // Team data for who/timeline, read when needed.
  async function teamData(kind, w, now) {
    if (kind === 'who') {
      const since = new Date(now - 120 * 86400000).toISOString().slice(0, 10);
      const [logs, tasks, people] = await Promise.all([
        db.collection('labLogs').where('day', '>=', since).get(),
        db.collection('tasks').where('status', '==', 'done').get(),
        db.collection('people').get(),
      ]);
      const items = whoItems({
        logs: logs.docs.map((d) => ({ id: d.id, ...d.data() })),
        tasks: tasks.docs.map((d) => ({ id: d.id, ...d.data() })),
        rename: w.rename,
        now,
      });
      return { items, roster: [...new Set(people.docs.map((d) => w.rename(d.get('name') || '')).filter(Boolean))] };
    }
    const [versions, milestones] = await Promise.all([db.collection('robotVersions').get(), db.collection('milestones').get()]);
    return {
      items: timelineItems({
        versions: versions.docs.map((d) => ({ id: d.id, ...d.data() })),
        milestones: milestones.docs.map((d) => ({ id: d.id, ...d.data() })),
      }),
    };
  }

  // ---------- quizNext({ bank, skip }) ----------
  const quizNext = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const w = await who(req);
    const bank = String(req.data?.bank || '');
    if (!GAMES.includes(bank)) throw bad('Which game?');
    const skip = req.data?.skip === true;
    const now = Date.now();
    const team = TEAM_GAMES.includes(bank) ? await teamData(bank, w, now) : null;
    return db.runTransaction(async (tx) => {
      const state = await loadState(tx, w);
      const secrets = team ? (await tx.get(secretRef(w.pid))).data() || {} : null;
      limit(state, 'next', now);
      state.name = w.me;
      const pending = { ...(state.pending || {}) };
      const open = pending[bank];
      // An open question comes back until it's answered (or skipped), so
      // reloading or switching games doesn't hand out a fresh one.
      if (open && !skip) {
        const q = team ? secrets?.[bank]?.question : publicView(getQuestion(open.id));
        if (q && q.id === open.id) {
          tx.set(stateRef(w.pid), state);
          return { question: q, progress: progressOf(state) };
        }
      }
      if (open && skip) {
        // Skipping ends the streak, so it can't be used to dodge hard ones.
        state.stats = { ...(state.stats || {}), streak: 0 };
      }
      const banks = { ...(state.banks || {}) };
      let question;
      if (team) {
        const seen = banks[bank]?.seen || [];
        const made =
          bank === 'who'
            ? whoQuestion(team.items, { me: w.me, seen, roster: team.roster, seed: w.pid })
            : timelineQuestion(team.items, { seen, seed: w.pid });
        if (!made) {
          delete pending[bank];
          state.pending = pending;
          tx.set(stateRef(w.pid), state);
          return {
            question: null,
            empty:
              bank === 'who'
                ? 'You’ve seen every recent lab log and finished task. New ones show up as the team logs.'
                : 'Not enough robot versions and milestones with dates yet (it needs at least 3, a day apart).',
            progress: progressOf(state),
          };
        }
        banks[bank] = { ...(banks[bank] || {}), seen: [...seen, bank === 'who' ? made.id : made.key].slice(-400) };
        tx.set(secretRef(w.pid), { ...secrets, [bank]: { ...made, at: now } });
        question = made.question;
      } else {
        const next = nextQuestion(bank, banks[bank] || {}, w.pid);
        banks[bank] = next.state;
        question = publicView(next.question);
      }
      pending[bank] = { id: question.id, at: now };
      Object.assign(state, { banks, pending, updatedAt: now });
      tx.set(stateRef(w.pid), state);
      return { question, progress: progressOf(state) };
    });
  });

  // Grades a choice question that came out of asChoice (the daily question).
  function gradeDaily(q, answer) {
    const base = getQuestion(q.id);
    const shown = asChoice(base);
    const reveal = checkAnswer(q.id, -1) || {};
    delete reveal.correct;
    return { correct: Number.isInteger(answer) && answer === shown.answer, ...reveal, answer: shown.answer, choices: shown.choices };
  }

  // ---------- quizAnswer({ id, answer }) ----------
  const quizAnswer = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const w = await who(req);
    const id = String(req.data?.id || '').slice(0, 300);
    const answer = req.data?.answer;
    if (!id) throw bad('Which question?');
    const now = Date.now();
    const graded = await db.runTransaction(async (tx) => {
      const state = await loadState(tx, w);
      const pending = { ...(state.pending || {}) };
      const bank = Object.keys(pending).find((b) => pending[b]?.id === id);
      if (!bank) throw new HttpsError('failed-precondition', 'That question isn’t open any more. Load the next one.');
      if (now - pending[bank].at < MIN_ANSWER_MS) throw new HttpsError('resource-exhausted', 'Too fast. Read the question first.');
      limit(state, 'answer', now);
      let result;
      let difficulty = 1;
      if (TEAM_GAMES.includes(bank)) {
        const secret = ((await tx.get(secretRef(w.pid))).data() || {})[bank];
        if (!secret || secret.id !== id) throw new HttpsError('failed-precondition', 'That question isn’t open any more. Load the next one.');
        difficulty = secret.question.difficulty || 1;
        if (bank === 'who') {
          if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw bad('Pick one of the names.');
          result = { correct: answer === secret.answer, answer: secret.answer, explain: secret.explain };
        } else {
          const given = Array.isArray(answer) ? answer.map(String) : [];
          if (given.length !== secret.order.length || new Set(given).size !== given.length || !given.every((g) => secret.order.includes(g)))
            throw bad('Put every item in order.');
          const correct = given.every((g, i) => g === secret.order[i]);
          result = {
            correct,
            order: secret.order,
            dates: secret.dates,
            explain: secret.order.map((i) => `${secret.dates[i]}`).join(' → '),
          };
        }
      } else {
        const q = getQuestion(id);
        if (!q) throw bad('That question is gone.');
        difficulty = q.difficulty || 1;
        const okType =
          q.kind === 'bug'
            ? Number.isInteger(answer) && answer >= 0 && answer < q.lines.length
            : (Number.isInteger(answer) && answer >= 0 && answer < (q.choices || []).length) || (q.ports && typeof answer === 'string' && answer.length < 12);
        if (!okType) throw bad('That answer doesn’t fit this question.');
        result = checkAnswer(id, answer);
      }
      const stats = { ...(state.stats || {}) };
      const byBank = { ...(stats.byBank || {}) };
      const b = { ...(byBank[bank] || {}) };
      b.answered = (b.answered || 0) + 1;
      if (result.correct) b.correct = (b.correct || 0) + 1;
      byBank[bank] = b;
      stats.byBank = byBank;
      stats.answered = (stats.answered || 0) + 1;
      if (result.correct) stats.correct = (stats.correct || 0) + 1;
      stats.streak = result.correct ? (stats.streak || 0) + 1 : 0;
      stats.best = Math.max(stats.best || 0, stats.streak);
      delete pending[bank];
      Object.assign(state, { stats, pending, name: w.me, updatedAt: now, lastAnswerAt: now });
      tx.set(stateRef(w.pid), state);
      return { bank, difficulty, result, progress: progressOf(state) };
    });
    // Coins: the first right answer to a question, by difficulty, under the
    // daily cap. awardCoins makes the key one-time; paidBefore also checks
    // keys saved under an old name.
    let coins = 0;
    const { bank, difficulty, result } = graded;
    if (result.correct && !(await coinsOff()) && !(await paidBefore(`quiz-${id}`, w))) {
      coins = await awardCoins(
        db,
        { person: w.me, amount: COINS_BY_DIFFICULTY[difficulty] || 1, source: 'quiz', label: NAMES[bank] || 'Learn', key: `quiz-${id}-${w.pid}` },
        now,
      );
    }
    return { ...result, bank, coins, progress: graded.progress, today: { paid: await paidToday('quiz', w, now), cap: AWARD_CAPS.quiz } };
  });

  // ---------- quizProgress() ----------
  const quizProgress = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const w = await who(req);
    const now = Date.now();
    const state = await db.runTransaction((tx) => loadState(tx, w));
    const totals = Object.fromEntries(QUIZ_BANKS.map((b) => [b, BANKS[b]?.length || null]));
    return { progress: progressOf(state), totals, today: { paid: await paidToday('quiz', w, now), cap: AWARD_CAPS.quiz } };
  });

  // ---------- autoRun({ path }) ----------
  // Scores a drawn AUTO path here, from the path itself; pays once for each
  // score tier the first time it's reached.
  const autoRun = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const w = await who(req);
    const now = Date.now();
    const run = simulate(req.data?.path);
    if (run.error) throw bad(run.error);
    const before = await db.runTransaction(async (tx) => {
      const state = await loadState(tx, w);
      limit(state, 'auto', now);
      const prev = state.auto?.best || 0;
      const stats = { ...(state.stats || {}) };
      const byBank = { ...(stats.byBank || {}) };
      const a = { ...(byBank.auto || {}) };
      a.answered = (a.answered || 0) + 1;
      byBank.auto = a;
      stats.byBank = byBank;
      Object.assign(state, { stats, name: w.me, auto: { best: Math.max(prev, run.score), runs: (state.auto?.runs || 0) + 1, at: now }, updatedAt: now });
      tx.set(stateRef(w.pid), state);
      return { prev, progress: progressOf(state) };
    });
    let coins = 0;
    if (!(await coinsOff())) {
      for (const tier of AUTO_TIERS.filter((t) => run.score >= t)) {
        if (await paidBefore(`quiz-auto-${tier}`, w)) continue;
        coins += await awardCoins(
          db,
          { person: w.me, amount: AUTO_TIER_COINS, source: 'quiz', label: `Auto planner: ${tier}+ points`, key: `quiz-auto-${tier}-${w.pid}` },
          now,
        );
      }
    }
    return { ...run, best: Math.max(before.prev, run.score), newBest: run.score > before.prev, coins, progress: before.progress, today: { paid: await paidToday('quiz', w, now), cap: AWARD_CAPS.quiz } };
  });

  // ---------- quizReport({ id, note }) ----------
  // Accuracy matters: anyone can flag a question; team management sees the
  // question with its answer and the note.
  const quizReport = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const w = await who(req);
    const id = String(req.data?.id || '').slice(0, 300);
    const note = String(req.data?.note || '')
      .trim()
      .slice(0, 600);
    const now = Date.now();
    const day = teamDay(now);
    const mine = await db.collection('quizReports').where('by', '==', w.me).where('day', '==', day).get();
    if (mine.size >= REPORTS_PER_DAY) throw new HttpsError('resource-exhausted', 'That’s a lot of reports for one day. Thanks! Try again tomorrow.');
    let doc;
    const q = getQuestion(id);
    if (q) {
      const view = q;
      doc = {
        qid: id,
        bank: q.bank,
        game: NAMES[q.bank] || q.bank,
        prompt: String(view.prompt || '').slice(0, 600),
        choices: (view.choices || []).slice(0, 6),
        lines: view.lines ? view.lines.slice(0, 40) : null,
        answer: view.kind === 'bug' ? `Line ${view.bugLine + 1}: ${view.fixed}` : (view.choices || [])[view.answer] ?? null,
        explain: view.explain || '',
        source: view.source || '',
      };
    } else {
      const secrets = (await secretRef(w.pid).get()).data() || {};
      const s = Object.values(secrets).find((x) => x?.id === id);
      if (!s) throw bad('Which question?');
      doc = { qid: id, bank: s.question.bank, game: NAMES[s.question.bank], prompt: s.question.prompt, choices: s.question.choices || (s.question.items || []).map((i) => i.label), answer: s.explain || null, explain: s.explain || '', source: '' };
    }
    const ref = db.collection('quizReports').doc();
    await ref.set({ ...doc, note, by: w.me, at: now, day, status: 'open' });
    return { ok: true, id: ref.id };
  });

  // ---------- the daily question (G10) ----------
  const metaRef = db.doc('quizMeta/daily');
  const dailyMsgRef = (day) => db.doc(`channels/general/messages/daily-${day}`);

  // Posts the day's question in #general as Trotbot (once a day, school days).
  async function postDaily(now = Date.now(), force = false) {
    const day = teamDay(now);
    if (!isSchoolDay(day) && !force) return { skipped: 'no school' };
    return db.runTransaction(async (tx) => {
      const meta = (await tx.get(metaRef)).data() || {};
      const days = meta.days || {};
      if (days[day]) return { skipped: 'already posted', day };
      const q = dailyQuestion(day, meta.history || []);
      const prev =
        Object.keys(days)
          .filter((d) => d < day)
          .sort()
          .pop() || '';
      const view = publicView(q);
      tx.set(metaRef, { history: [...(meta.history || []), q.id].slice(-800), days: { ...days, [day]: q.id }, last: day });
      tx.set(dailyMsgRef(day), {
        text: `❓ Daily question: ${String(q.prompt).slice(0, 300)}`,
        by: 'Trotbot',
        byUid: 'trotbot',
        bot: true,
        at: now,
        cmd: { name: 'dailyq', day, prev, game: NAMES[q.bank] || q.bank, q: view, answered: 0, firstCorrect: [] },
        mentions: [],
        taskIds: [],
        replyTo: null,
        reactions: {},
        photo: null,
      });
      return { posted: q.id, day };
    });
  }

  // About 7 AM team time. (Tests call postDailyQuestion.run({ force: true })
  // to post on any day; the scheduler never sends that.)
  const postDailyQuestion = onSchedule({ schedule: '7 7 * * *', timeZone }, async (event) => {
    const r = await postDaily(Date.now(), event?.force === true);
    logger.info('daily question', r);
    return r;
  });

  // ---------- dailyAnswer({ day, answer }) ----------
  const dailyAnswer = onCall({ maxInstances: 5, invoker: 'public' }, async (req) => {
    const w = await who(req);
    const now = Date.now();
    const day = String(req.data?.day || '');
    const answer = req.data?.answer;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw bad('Which day?');
    if (day !== teamDay(now)) throw new HttpsError('failed-precondition', 'That question is closed. A new one comes out each school day.');
    if (!Number.isInteger(answer) || answer < 0 || answer > 5) throw bad('Pick an answer.');
    const result = await db.runTransaction(async (tx) => {
      const meta = (await tx.get(metaRef)).data() || {};
      const qid = meta.days?.[day];
      if (!qid) throw new HttpsError('failed-precondition', 'No question today.');
      const mineRefs = w.aliases.map((a) => db.doc(`dailyAnswers/${day}_${personId(a)}`));
      const mine = await Promise.all(mineRefs.map((r) => tx.get(r)));
      if (mine.some((s) => s.exists)) throw new HttpsError('already-exists', 'You already answered today’s question.');
      const msg = await tx.get(dailyMsgRef(day));
      const state = await loadState(tx, w);
      const q = getQuestion(qid);
      const graded = gradeDaily(q, answer);
      const cmd = msg.get('cmd') || {};
      const firstCorrect = [...(cmd.firstCorrect || [])];
      let rank = 0;
      if (graded.correct) {
        firstCorrect.push(w.me);
        rank = firstCorrect.length;
      }
      // The streak: answering on each school day the question went out.
      const d = { ...(state.daily || {}) };
      d.streak = d.lastDay === cmd.prev && cmd.prev ? (d.streak || 0) + 1 : 1;
      d.best = Math.max(d.best || 0, d.streak);
      d.lastDay = day;
      d.answered = (d.answered || 0) + 1;
      if (graded.correct) d.correct = (d.correct || 0) + 1;
      Object.assign(state, { daily: d, name: w.me, updatedAt: now });
      tx.set(stateRef(w.pid), state);
      if (msg.exists) tx.update(dailyMsgRef(day), { 'cmd.answered': (cmd.answered || 0) + 1, 'cmd.firstCorrect': firstCorrect.slice(0, 3) });
      const doc = { name: w.me, day, qid, given: answer, ...graded, rank, streak: d.streak, at: now, coins: 0 };
      tx.set(mineRefs[0], doc);
      return doc;
    });
    let coins = 0;
    if (result.correct && !(await coinsOff())) {
      const amount = result.rank >= 1 && result.rank <= DAILY_COINS.length ? DAILY_COINS[result.rank - 1] : DAILY_COINS_LATER;
      coins = await awardCoins(db, { person: w.me, amount, source: 'daily', label: 'Daily question', key: `daily-${day}-${w.pid}` }, now);
      if (coins) await db.doc(`dailyAnswers/${day}_${w.pid}`).update({ coins });
    }
    return { ...result, coins };
  });

  return { quizNext, quizAnswer, quizProgress, quizReport, autoRun, dailyAnswer, postDailyQuestion };
}
