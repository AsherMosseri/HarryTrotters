// Learn (plan section G): the educational games. A card per game with your
// progress, then each game's screen. Questions come from the server one at
// a time without their answers (functions/learn.js); the server grades each
// answer, explains it and pays the coins.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import CountUp from '../CountUp.jsx';
import { celebrate } from '../../motion.js';
import { promptDialog } from '../Dialogs.jsx';
import AutoPlanner from './AutoPlanner.jsx';
import { openGame } from '../games/launch.js';
import { CodeFix, CodeView, GearVisual, HubPuzzle, PartCard, PersonChoice, RuleCard, SpotScene, Timeline, WhoCard, Citation, isTrueFalse } from './Visuals.jsx';

export const GAMES = [
  { key: 'parts', name: 'Name that part', icon: 'parts', blurb: 'goBILDA and REV parts, from a photo or what they do.' },
  { key: 'rules', name: 'Rules check', icon: 'doc', blurb: 'BIOBUZZ manual scenarios, with the rule and page.' },
  { key: 'strategy', name: 'Strategy', icon: 'trophy', blurb: 'Scoring math, ranking points and match calls.' },
  { key: 'wiring', name: 'Wiring puzzle', icon: 'chip', blurb: 'Tap the right port on the Control or Expansion Hub.' },
  { key: 'spot', name: 'Spot the problem', icon: 'eye', blurb: 'A build or wiring job with one thing wrong.' },
  { key: 'code', name: 'Fix the bug', icon: 'code', blurb: 'Java and Blocks robot code with one broken line.' },
  { key: 'gear', name: 'Gear ratios', icon: 'gear', blurb: 'Real motor speeds and wheels. Never runs out.' },
  { key: 'auto', name: 'Auto path planner', icon: 'route', blurb: 'Draw a 30-second AUTO and score as much as you can.' },
  { key: 'who', name: 'Who did this?', icon: 'person', blurb: 'A lab log or finished task: guess who.' },
  { key: 'timeline', name: 'Robot timeline', icon: 'robot', blurb: 'Put robot versions and milestones in order.' },
];
const byKey = Object.fromEntries(GAMES.map((g) => [g.key, g]));
const pct = (c, a) => (a ? Math.round((c / a) * 100) : 0);
const STREAK_MARKS = [3, 5, 10, 15, 20, 30, 50];

function Stat({ label, children, sub }) {
  return (
    <div className="lq-stat">
      <span className="lq-stat-label">{label}</span>
      <b className="lq-stat-num mono">{children}</b>
      {sub && <span className="lq-stat-sub">{sub}</span>}
    </div>
  );
}

export function CoinsToday({ today, compact }) {
  if (!today) return null;
  const full = today.paid >= today.cap;
  return (
    <span className={`lq-coins${full ? ' full' : ''}${compact ? ' compact' : ''}`} title="Coins from games today">
      <Icon name="coin" size={14} />
      <span className="mono">
        {today.paid}/{today.cap}
      </span>
      {!compact && <span className="lq-coins-bar"><i style={{ transform: `scaleX(${Math.min(1, today.paid / today.cap)})` }} /></span>}
    </span>
  );
}

// ---------- one game ----------
function Choices({ q, result, busy, onPick }) {
  const tf = isTrueFalse(q);
  const people = q.bank === 'who';
  return (
    <div className={`lq-choices${tf ? ' tf' : ''}${q.choices.some((c) => c.length > 60) ? ' long' : ''}`}>
      {q.choices.map((c, i) => {
        const st = result ? (i === result.answer ? ' is-right' : i === result.given ? ' is-wrong' : ' dim') : '';
        return (
          <button key={i} className={`lq-choice${st}`} onClick={() => onPick(i)} disabled={!!result || busy}>
            {!tf && !people && <span className="lq-choice-n mono">{String.fromCharCode(65 + i)}</span>}
            {people ? <PersonChoice name={c} /> : <span className="lq-choice-text">{c}</span>}
            {result && i === result.answer && <Icon name="check" size={18} className="lq-choice-mark" />}
            {result && i === result.given && i !== result.answer && <Icon name="cross" size={18} className="lq-choice-mark" />}
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ result, q, onNext, onReport, reported, busy }) {
  const right = result.correct;
  const capped = right && !result.coins && result.today && result.today.paid >= result.today.cap;
  return (
    <div className={`lq-feedback ${right ? 'is-right' : 'is-wrong'}`} role="status">
      <div className="lq-fb-head">
        <span className="lq-fb-icon">
          <Icon name={right ? 'check' : 'cross'} size={20} />
        </span>
        <b>{right ? 'Right' : 'Not quite'}</b>
        {result.coins > 0 && (
          <span className="chip lq-chip-coin">
            <Icon name="coin" size={13} /> <span className="mono">+{result.coins}</span>
          </span>
        )}
        {right && !result.coins && (
          <span className="muted small">{capped ? 'Coins for today are maxed' : 'No coins: answered right before'}</span>
        )}
      </div>
      {q.bank === 'code' && <CodeFix result={result} lines={q.lines} lang={q.lang} />}
      {result.explain && <p className="lq-fb-explain">{result.explain}</p>}
      {result.fix && (
        <p className="lq-fb-fix">
          <b>Fix:</b> {result.fix}
        </p>
      )}
      <div className="lq-fb-meta">
        {result.source && <Citation source={result.source} />}
        {result.partNumber && <span className="lq-cite mono">{result.partNumber}</span>}
        {result.url && (
          <a className="lq-cite" href={result.url} target="_blank" rel="noreferrer">
            Product page <Icon name="external" size={13} />
          </a>
        )}
      </div>
      <div className="lq-fb-actions">
        <button className="link-btn small lq-report" onClick={onReport} disabled={reported}>
          <Icon name="flag" size={14} /> {reported ? 'Reported. Thanks!' : 'Report a problem with this question'}
        </button>
        <button className="btn primary" onClick={onNext} disabled={busy} autoFocus>
          Next <Icon name="chevron" size={16} />
        </button>
      </div>
    </div>
  );
}

function Game({ game, api, onBack, onProgress, today, setToday }) {
  const meta = byKey[game];
  const [q, setQ] = useState(null);
  const [empty, setEmpty] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streak, setStreak] = useState(0);
  const [pick, setPick] = useState(null);
  const [reported, setReported] = useState(false);
  const streakRef = useRef(null);
  const topRef = useRef(null);

  const load = useCallback(
    async (skip = false) => {
      setBusy(true);
      setError('');
      try {
        const r = await api.quizNext({ bank: game, ...(skip ? { skip: true } : {}) });
        setQ(r.question);
        setEmpty(r.empty || '');
        setResult(null);
        setPick(null);
        setReported(false);
        if (r.progress) {
          onProgress(r.progress);
          setStreak(r.progress.streak);
        }
        topRef.current?.scrollIntoView?.({ block: 'nearest' });
      } catch (e) {
        setError(e.message || String(e));
      }
      setBusy(false);
    },
    [api, game, onProgress],
  );
  useEffect(() => {
    if (game !== 'auto') load();
  }, [game, load]);

  const answer = async (given) => {
    if (!q || result || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.quizAnswer({ id: q.id, answer: given });
      setResult({ ...r, given });
      if (r.progress) {
        onProgress(r.progress);
        setStreak(r.progress.streak);
        if (r.correct && STREAK_MARKS.includes(r.progress.streak)) setTimeout(() => celebrate({ el: streakRef.current, count: 24 }), 60);
      }
      if (r.today) setToday(r.today);
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };
  const report = async () => {
    const note = await promptDialog({
      title: 'Report a problem',
      body: 'What’s wrong with this question? Team management will check it.',
      placeholder: 'The answer should be…, the rule says…',
      okLabel: 'Send',
      maxLength: 600,
    });
    if (note == null) return;
    try {
      await api.quizReport({ id: q.id, note });
      setReported(true);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  let board = null;
  if (q) {
    if (q.kind === 'bug')
      board = (
        <>
          <p className="lq-prompt">{q.prompt.replace(/\s*One line has a bug: which one\?$/, '')}</p>
          <CodeView lines={q.lines} lang={q.lang} pick={pick} onPick={setPick} result={result} />
          {!result && (
            <div className="lq-plug">
              <span className={pick == null ? 'muted' : ''}>{pick == null ? 'Tap the broken line.' : `Line ${pick + 1}`}</span>
              <button className="btn primary" disabled={pick == null || busy} onClick={() => answer(pick)}>
                That’s the bug
              </button>
            </div>
          )}
        </>
      );
    else if (q.bank === 'wiring') board = <HubPuzzle key={q.id} q={q} result={result} busy={busy} onPick={answer} />;
    else if (q.bank === 'spot') board = <SpotScene q={q} result={result} busy={busy} onPick={answer} />;
    else if (q.kind === 'order') board = <Timeline key={q.id} q={q} result={result} busy={busy} onSubmit={answer} />;
    else
      board = (
        <>
          {q.bank === 'parts' ? (
            <PartCard q={q} />
          ) : q.bank === 'gear' ? (
            <GearVisual q={q} />
          ) : q.bank === 'who' ? (
            <>
              <p className="lq-prompt">{q.prompt}</p>
              <WhoCard q={q} />
            </>
          ) : (
            <RuleCard q={q} />
          )}
          <Choices q={q} result={result} busy={busy} onPick={answer} />
        </>
      );
  }

  return (
    <main className="content learn lq-game" ref={topRef}>
      <div className="lq-game-head">
        <button className="lq-back" onClick={onBack}>
          <Icon name="chevron" size={16} className="flip" /> Learn
        </button>
        <span className="spacer" />
        {game !== 'auto' && (
          <span className={`lq-streak${streak ? ' on' : ''}`} ref={streakRef} title="Right answers in a row">
            <Icon name="flame" size={15} />
            <span className="mono">{streak}</span>
          </span>
        )}
        <CoinsToday today={today} compact />
      </div>
      <h1 className="lq-title">
        <Icon name={meta.icon} size={22} /> {meta.name}
      </h1>
      {game === 'auto' ? (
        <AutoPlanner
          api={api}
          onResult={(r) => {
            if (r.progress) onProgress(r.progress);
            if (r.today) setToday(r.today);
          }}
        />
      ) : (
        <div className="lq-stage" key={q?.id || empty}>
          {error && <p className="lq-error">{error}</p>}
          {!q && !empty && !error && <div className="lq-loading">Loading a question…</div>}
          {empty && (
            <div className="lq-empty">
              <Icon name={meta.icon} size={28} />
              <p>{empty}</p>
            </div>
          )}
          {board}
          {result && <Feedback result={result} q={q} onNext={() => load()} onReport={report} reported={reported} busy={busy} />}
          {q && !result && (
            <div className="lq-skip">
              {q.difficulty && (
                <span className="lq-level mono" title="Difficulty">
                  {'●'.repeat(q.difficulty)}
                  <span className="muted">{'●'.repeat(Math.max(0, 3 - q.difficulty))}</span>
                </span>
              )}
              <button className="link-btn small" onClick={() => load(true)} disabled={busy}>
                Skip (ends your streak)
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// ---------- reports, for team management ----------
function Reports({ api }) {
  const [list, setList] = useState([]);
  useEffect(() => api.subscribeQuizReports?.(setList), [api]);
  const open = list.filter((r) => r.status === 'open').sort((a, b) => b.at - a.at);
  if (!open.length) return null;
  return (
    <section className="lq-reports">
      <div className="sec-head">
        <h2>Question reports</h2>
        <span className="mono muted">{open.length}</span>
      </div>
      <ul>
        {open.map((r) => (
          <li key={r.id} className="lq-report-row">
            <div className="lq-kicker">
              {r.game} · <span className="mono">{r.qid}</span> · {r.by}
            </div>
            <p className="lq-report-q">{r.prompt}</p>
            {r.answer != null && (
              <p className="small">
                <b>Answer now:</b> {String(r.answer)}
              </p>
            )}
            {r.source && <Citation source={r.source} />}
            {r.note && <p className="lq-report-note">“{r.note}”</p>}
            <div className="lq-report-actions">
              <button className="btn small" onClick={() => api.handleQuizReport(r.id, 'fine')}>
                It’s right
              </button>
              <button className="btn small" onClick={() => api.handleQuizReport(r.id, 'fixed')}>
                Fixed it
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- the Learn page ----------
export default function LearnView({ api, isManager, onOpenDaily, dailyToday }) {
  const [game, setGame] = useState(null);
  const [progress, setProgress] = useState(null);
  const [totals, setTotals] = useState({});
  const [today, setToday] = useState(null);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    api
      .quizProgress()
      .then((r) => {
        setProgress(r.progress);
        setTotals(r.totals || {});
        setToday(r.today);
      })
      .catch((e) => setError(e.message || String(e)));
  }, [api]);
  useEffect(() => {
    if (!game) refresh();
  }, [game, refresh]);

  if (game) return <Game game={game} api={api} onBack={() => setGame(null)} onProgress={setProgress} today={today} setToday={setToday} />;

  const p = progress;
  return (
    <main className="content learn">
      <div className="ms-header">
        <div>
          <h1>Learn</h1>
        </div>
      </div>
      <section className="lq-band">
        <div className="lq-band-stats">
          <Stat label="Answered">{p ? <CountUp value={p.answered} /> : '–'}</Stat>
          <Stat label="Right" sub={p?.answered ? `${p.correct} of ${p.answered}` : null}>
            {p ? `${pct(p.correct, p.answered)}%` : '–'}
          </Stat>
          <Stat label="Streak" sub={p?.best ? `best ${p.best}` : null}>
            {p ? p.streak : '–'}
          </Stat>
          <Stat label="Daily streak" sub={p?.daily?.best ? `best ${p.daily.best}` : 'school days'}>
            {p ? p.daily.streak : '–'}
          </Stat>
        </div>
        <div className="lq-band-coins">
          <span className="lq-stat-label">Coins from games today</span>
          {today ? (
            <>
              <b className="mono lq-band-coin-num">
                {today.paid}
                <span>/{today.cap}</span>
              </b>
              <span className="lq-band-bar">
                <i style={{ transform: `scaleX(${Math.min(1, today.paid / today.cap)})` }} />
              </span>
              <span className="lq-stat-sub">First right answers pay 1 to 3 by difficulty.</span>
            </>
          ) : (
            <b className="mono lq-band-coin-num">–</b>
          )}
        </div>
      </section>
      {error && <p className="lq-error">{error}</p>}

      <button className="lq-daily-tile" onClick={onOpenDaily}>
        <span className="lq-daily-ic">
          <Icon name="learn" size={22} />
        </span>
        <span className="lq-daily-main">
          <span className="lq-kicker">Daily question</span>
          <b>{dailyToday ? (dailyToday.answered ? 'You answered today’s question' : 'Today’s question is up in #general') : 'A new question each school day at 7 AM'}</b>
          <span className="muted small">The first three right answers get the most coins. Keep your daily streak going.</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <div className="sec-head lq-sec">
        <h2>Games</h2>
      </div>
      <div className="lq-cards">
        {GAMES.map((g) => {
          const s = p?.games?.[g.key];
          const total = totals[g.key] ?? s?.total;
          return (
            <button key={g.key} className={`lq-card g-${g.key}`} onClick={() => setGame(g.key)}>
              <span className="lq-card-ic">
                <Icon name={g.icon} size={22} />
              </span>
              <span className="lq-card-name">{g.name}</span>
              <span className="lq-card-blurb">{g.blurb}</span>
              <span className="lq-card-stats">
                {g.key === 'auto' ? (
                  <span>
                    best <b className="mono">{p?.auto?.best ?? 0}</b> pts
                  </span>
                ) : (
                  <>
                    <span>
                      <b className="mono">{s?.answered || 0}</b> answered
                    </span>
                    {s?.answered > 0 && (
                      <span>
                        <b className="mono">{pct(s.correct, s.answered)}%</b> right
                      </span>
                    )}
                    {total ? (
                      <span className="muted">
                        <span className="mono">{Math.min(s?.seen || 0, total)}</span>/<span className="mono">{total}</span> seen
                      </span>
                    ) : null}
                  </>
                )}
              </span>
              {total ? (
                <span className="lq-card-bar">
                  <i style={{ transform: `scaleX(${Math.min(1, (s?.seen || 0) / total)})` }} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {/* Tetris and Minesweeper (games/GameHost.jsx); also /tetris and /minesweep in #arcade. */}
      <div className="sec-head lq-sec">
        <h2>Just for fun</h2>
      </div>
      <div className="lq-cards">
        {[
          ['tetris', 'blocks', 'Tetris', 'Play alone, race Trotbot or a teammate, or a tournament.'],
          ['minesweep', 'mine', 'Minesweeper', 'Three board sizes, Trotbot races and tournaments.'],
        ].map(([key, icon, name, blurb]) => (
          <button key={key} className={`lq-card g-${key}`} onClick={() => openGame({ game: key, conv: 'arcade' })}>
            <span className="lq-card-ic">
              <Icon name={icon} size={22} />
            </span>
            <span className="lq-card-name">{name}</span>
            <span className="lq-card-blurb">{blurb}</span>
          </button>
        ))}
      </div>
      {isManager && <Reports api={api} />}
    </main>
  );
}
