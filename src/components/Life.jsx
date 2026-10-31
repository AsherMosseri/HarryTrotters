import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, CloseIcon, DisplayName, Overlay } from './common.jsx';
import { Icon } from './shell/icons.jsx';
import { alertDialog, confirmDialog } from './Dialogs.jsx';
import { useEscape, useLocalStorage } from '../util.js';
import { animOn, celebrate } from '../motion.js';
import { FULL_COINS, LINE_COINS, SIZE } from '../../functions/shared/bingo.js';
import { streakShout } from '../../functions/shared/recap.js';
import { MAX_SCORE, MIN_GUESSERS, WIN_COINS, isLive, matchRoundId, winnerLine } from '../../functions/shared/predict.js';

// Team life on screen (3.0): the weekly recap card (#general), lab bingo
// (Today), and score guesses (Match log and the pit screen). The server
// decides everything that pays (functions/life.js); these only show it.

const firstName = (n = '') => n.split(' ')[0];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---------- the weekly recap ----------

// Trotbot's recap card (a 'recap' command card in chat, and the preview).
export function RecapBody({ c, onPerson }) {
  const maxArea = Math.max(1, ...(c.areas || []).map((a) => a.hours));
  const name = (n) => (
    <DisplayName as="button" name={n} className="name-btn cmd-name" onClick={onPerson ? (e) => onPerson(n, e) : undefined} />
  );
  const more = (c.finishedCount || 0) - (c.finished || []).length;
  return (
    <div className="recap">
      <div className="recap-head">
        <span className="recap-kicker">The week at the lab</span>
        <span className="recap-week mono">{c.label}</span>
      </div>
      {c.intro && <p className="recap-intro">{c.intro}</p>}

      {c.top && (
        <div className="recap-top">
          <button className="avatar-btn" onClick={(e) => onPerson?.(c.top.name, e)} aria-label={c.top.name}>
            <Avatar name={c.top.name} size={44} />
          </button>
          <div className="recap-top-text">
            <span className="recap-label">Top contributor</span>
            {name(c.top.name)}
            <span className="muted small">{c.top.why}</span>
          </div>
        </div>
      )}

      {c.areas?.length > 0 && (
        <section className="recap-sec">
          <h3 className="recap-label">Where the hours went</h3>
          <ul className="recap-areas">
            {c.areas.map((a) => (
              <li key={a.id} className={a.id === 'unlogged' ? 'unlogged' : ''}>
                <span className="recap-area-name">{a.label}</span>
                <span className="recap-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, (a.hours / maxArea) * 100)}%` }} />
                </span>
                <span className="mono recap-area-h">{a.hours.toFixed(1)} h</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.finished?.length > 0 && (
        <section className="recap-sec">
          <h3 className="recap-label">Finished</h3>
          <ul className="recap-done">
            {c.finished.map((t) => (
              <li key={t.id || t.title}>
                <Icon name="check" size={15} />
                <span>
                  {t.title}
                  {t.who?.length > 0 && <span className="muted"> · {t.who.map(firstName).join(', ')}</span>}
                </span>
              </li>
            ))}
          </ul>
          {more > 0 && <p className="muted small recap-more">and {plural(more, 'more task')}</p>}
        </section>
      )}

      {c.runs?.count > 0 && (
        <section className="recap-sec">
          <h3 className="recap-label">Practice runs</h3>
          <p className="recap-line">
            <span className="mono">{c.runs.count}</span> {c.runs.count === 1 ? 'run' : 'runs'}, best{' '}
            <span className="mono">{c.runs.best}</span>, average <span className="mono">{c.runs.avg}</span>
            {c.runs.last > 0 && (
              <span className="muted">
                {' '}
                (last week <span className="mono">{c.runs.avgLast}</span>)
              </span>
            )}
          </p>
        </section>
      )}

      {c.highlights?.length > 0 && (
        <section className="recap-sec">
          <h3 className="recap-label">From the lab log</h3>
          {c.highlights.map((h) => (
            <figure key={h.person + h.day} className="recap-quote">
              <blockquote>{h.text}</blockquote>
              <figcaption>{name(h.person)}</figcaption>
            </figure>
          ))}
        </section>
      )}

      {c.streaks?.length > 0 && (
        <section className="recap-sec">
          <h3 className="recap-label">Streaks</h3>
          <ul className="recap-streaks">
            {c.streaks.map((s) => (
              <li key={s.name}>
                <Icon name="flame" size={15} /> {streakShout(s)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.vs?.length > 0 && (
        <section className="recap-sec">
          <h3 className="recap-label">This week vs last week</h3>
          <table className="recap-vs">
            <tbody>
              {c.vs.map((v) => {
                const d = Math.round((v.now - v.last) * 10) / 10;
                return (
                  <tr key={v.id}>
                    <th scope="row">{v.label}</th>
                    <td className="mono">{v.unit === 'h' ? v.now.toFixed(1) : v.now}</td>
                    <td className={`mono recap-diff ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>
                      {d === 0 ? 'same' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {c.outro && <p className="recap-outro">{c.outro}</p>}
      {c.top && <p className="muted tiny">Top contributor: hours, tasks finished and lab logs count the same.</p>}
    </div>
  );
}

// Team management on Today: what Sunday's recap will say, and posting it
// early or skipping the week.
export function RecapRow({ api }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="today-sec">
      <div className="sec-head">
        <h2>Weekly recap</h2>
        <button className="text-btn" onClick={() => setOpen(true)}>
          Preview
        </button>
      </div>
      <button className="ms-row" onClick={() => setOpen(true)}>
        <span className="ms-title">Trotbot posts it Sunday at 6 PM</span>
        <span className="ms-sub">In #general. Preview it, post it early or skip a week.</span>
      </button>
      {open && <RecapDialog api={api} onClose={() => setOpen(false)} />}
    </section>
  );
}

function RecapDialog({ api, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEscape(onClose);
  const load = () =>
    api
      .recap({ action: 'preview' })
      .then((r) => setData(r))
      .catch((e) => setErr(e.message || 'Couldn’t load the recap.'));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const act = async (action) => {
    if (action === 'post') {
      const ok = await confirmDialog({
        title: 'Post the recap now?',
        body: 'Trotbot posts it in #general for everyone, and there’s no post on Sunday this week.',
        okLabel: 'Post now',
      });
      if (!ok) return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.recap({ action });
      await load();
    } catch (e) {
      setErr(e.message || 'That didn’t work.');
    }
    setBusy(false);
  };
  const status = data?.state?.status;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div
          className="dialog recap-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="This week’s recap"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="panel-head">
            <h2>This week’s recap</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className={`recap-status ${status || 'waiting'}`}>
            {status === 'posted'
              ? 'Posted in #general this week.'
              : status === 'skipped'
                ? `Skipped this week${data.state.by ? ` by ${firstName(data.state.by)}` : ''}. Nothing posts on Sunday.`
                : 'Trotbot posts this in #general on Sunday at 6 PM. It updates until then.'}
          </p>
          <div className="recap-preview">
            {data ? <RecapBody c={data.recap} /> : err ? null : <p className="muted">Putting it together…</p>}
          </div>
          {err && <p className="form-error">{err}</p>}
          {data && status !== 'posted' && (
            <div className="ask-actions recap-actions">
              {status === 'skipped' ? (
                <button className="btn" disabled={busy} onClick={() => act('unskip')}>
                  Undo skip
                </button>
              ) : (
                <button className="btn" disabled={busy} onClick={() => act('skip')}>
                  Skip this week
                </button>
              )}
              {status !== 'skipped' && (
                <button className="btn primary" disabled={busy} onClick={() => act('post')}>
                  Post now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ---------- lab bingo ----------

const coinsOf = (card) =>
  card ? Object.entries(card.paid || {}).reduce((t, [line, ok]) => t + (ok ? (line === 'full' ? FULL_COINS : LINE_COINS) : 0), 0) : 0;
const lineCells = (card) => new Set((card?.lines || []).filter((l) => l.done).flatMap((l) => l.cells));

// Today's small bingo card; tapping it opens the full one. The server works
// out the squares and pays finished lines (claimBingo); `sig` changes when
// something that could fill a square happens, so it asks again.
export function BingoCard({ actor, api, sig }) {
  const [saved, setSaved] = useLocalStorage('bingo-card', null);
  const card = saved && saved.name === actor.name ? saved.card : null;
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(false);
  const ask = () =>
    api
      .claimBingo({})
      .then((c) => {
        if (c?.squares) setSaved({ name: actor.name, card: c });
        setErr(false);
      })
      .catch(() => setErr(true));
  useEffect(() => {
    ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, actor.name]);
  const lit = lineCells(card);
  const lines = (card?.lines || []).filter((l) => l.done).length;
  const coins = coinsOf(card);
  return (
    <section className="today-sec bingo-sec">
      <div className="sec-head">
        <h2>Lab bingo</h2>
        <button className="text-btn" onClick={() => setOpen(true)} disabled={!card}>
          Full card
        </button>
      </div>
      {card ? (
        <button
          className="bingo-mini"
          onClick={() => setOpen(true)}
          aria-label={`Lab bingo: ${card.filled} of ${SIZE * SIZE} squares. Open the full card`}
        >
          <span className="bingo-mini-grid" aria-hidden="true">
            {card.squares.map((s, i) => (
              <i key={s.id} className={`${s.done ? 'on' : ''}${lit.has(i) ? ' line' : ''}`} />
            ))}
          </span>
          <span className="bingo-mini-text">
            <span>
              <b className="mono">{card.filled}</b> of <span className="mono">{SIZE * SIZE}</span> squares
            </span>
            <span className="muted small">
              {card.full
                ? 'Full card!'
                : lines
                  ? `${plural(lines, 'line')} done`
                  : `A full row, column or diagonal pays ${LINE_COINS} coins`}
              {coins > 0 && (
                <>
                  {' · '}
                  <span className="mono">+{coins}</span> coins
                </>
              )}
            </span>
          </span>
        </button>
      ) : (
        <p className="today-empty">{err ? 'Couldn’t load this week’s card.' : 'Getting this week’s card…'}</p>
      )}
      {open && card && <BingoDialog card={card} onClose={() => setOpen(false)} onOpen={ask} />}
    </section>
  );
}

function BingoDialog({ card, onClose, onOpen }) {
  useEscape(onClose);
  const box = useRef(null);
  useEffect(() => {
    onOpen?.();
    // A full card gets a burst when you look at it.
    if (card.full && animOn('celebrate')) setTimeout(() => box.current && celebrate({ el: box.current, count: 24 }), 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lit = lineCells(card);
  const weekOf = new Date(`${card.week}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const lines = card.lines.filter((l) => l.done);
  const coins = coinsOf(card);
  const waiting = lines.some((l) => !card.paid?.[l.id]) || (card.full && !card.paid?.full);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog bingo-dialog" role="dialog" aria-modal="true" aria-label="Lab bingo" onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>Lab bingo</h2>
            <span className="muted small">
              week of <span className="mono">{weekOf}</span>
            </span>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="bingo-grid" ref={box} role="grid" aria-label="This week’s card">
            {card.squares.map((s, i) => (
              <div
                key={s.id}
                role="gridcell"
                className={`bingo-sq t${s.tier}${s.done ? ' on' : ''}${lit.has(i) ? ' line' : ''}`}
                aria-label={`${s.label}${s.done ? ', done' : ''}`}
              >
                {s.done && (
                  <span className="bingo-check" aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                )}
                <span className="bingo-sq-label">{s.label}</span>
                {s.sub && <span className="bingo-sq-sub">{s.sub}</span>}
              </div>
            ))}
          </div>
          <p className="bingo-sum">
            <b className="mono">{card.filled}</b> of <span className="mono">{SIZE * SIZE}</span> squares
            {lines.length > 0 && <> · {plural(lines.length, 'line')}</>}
            {coins > 0 && (
              <>
                {' · '}
                <span className="mono">+{coins}</span> coins this week
              </>
            )}
          </p>
          {waiting && <p className="muted small">Some lines will pay tomorrow: bingo pays up to 25 coins a day.</p>}
          <p className="muted small bingo-how">
            Squares fill in by themselves from your shifts, lab logs, tasks and the match log (lab logs count on days you had a
            shift). A full row, column or diagonal pays{' '}
            <span className="mono">{LINE_COINS}</span> coins, and the whole card <span className="mono">{FULL_COINS}</span> more. Same card
            for everyone; a new one every Monday.
          </p>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- score guesses ----------

// Your own guesses, remembered on this device (the server keeps them hidden
// until the round locks, even from you).
function useMyGuesses() {
  const [mine, setMine] = useLocalStorage('my-guesses', {});
  return [mine || {}, (id, score) => setMine((m) => Object.fromEntries([...Object.entries(m || {}), [id, score]].slice(-30)))];
}

function GuessForm({ onGuess }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const n = Number(v);
    if (v === '' || !Number.isInteger(n) || n < 0 || n > MAX_SCORE) return setErr('A whole number of points.');
    setBusy(true);
    const r = await onGuess(n);
    setBusy(false);
    if (r?.error) setErr(r.error);
    else setV('');
  };
  return (
    <form className="guess-form" onSubmit={submit}>
      <input
        className="input mono"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={3}
        placeholder="Points"
        aria-label="Your guess, in points"
        value={v}
        onChange={(e) => {
          setV(e.target.value.replace(/\D/g, ''));
          setErr('');
        }}
      />
      <button className="btn primary" disabled={busy || v === ''}>
        Guess
      </button>
      {err && <span className="form-error small">{err}</span>}
    </form>
  );
}

// Who guessed what (once it's locked or over), the winners first.
function Guesses({ round }) {
  const shown = round.guesses ? Object.entries(round.guesses) : (round.guessers || []).map((n) => [n, null]);
  if (!shown.length) return null;
  const off = (g) => (round.score == null || g == null ? 0 : Math.abs(g - round.score));
  shown.sort((a, b) => off(a[1]) - off(b[1]) || a[0].localeCompare(b[0]));
  return (
    <ul className="guess-list">
      {shown.map(([n, g]) => (
        <li key={n} className={(round.winners || []).includes(n) ? 'won' : ''}>
          <Avatar name={n} size={22} />
          <span className="guess-name">{firstName(n)}</span>
          {g != null && <b className="mono">{g}</b>}
          {(round.loggedBy || []).includes(n) && <span className="muted tiny">logged the run</span>}
          {round.paid?.[n] > 0 && <span className="guess-coins mono">+{round.paid[n]}</span>}
        </li>
      ))}
    </ul>
  );
}

// One round: open (guess, or see who has), locked, or over.
function RoundBox({ round, title, actor, api, mine, remember, onGuess, canLock, hint = true }) {
  const myGuess = round ? (round.guesses?.[actor.name] ?? mine[round.id]) : null;
  const guessed = round && (round.guessers || []).includes(actor.name);
  const status = round?.status || 'open';
  const n = round?.guessers?.length || 0;
  const act = async (action) => {
    const r = await api.predict({ action, id: round.id });
    if (r?.error) await alertDialog({ title: r.error });
  };
  return (
    <div className={`guess-round ${status}`}>
      <div className="guess-head">
        <Icon name="target" size={18} />
        <b>{title}</b>
        <span className="muted small">
          {status === 'open' ? (
            n ? (
              `${plural(n, 'guess', 'guesses')} so far`
            ) : (
              'No guesses yet'
            )
          ) : status === 'locked' ? (
            'Guesses locked'
          ) : status === 'done' ? (
            <>
              Scored <span className="mono">{round.score}</span>
            </>
          ) : (
            'Called off'
          )}
        </span>
      </div>
      {status === 'open' &&
        (guessed ? (
          <p className="small">
            Your guess: <b className="mono">{myGuess ?? 'saved'}</b>. Everyone’s guess shows when the run starts.
          </p>
        ) : (
          <>
            <GuessForm
              onGuess={async (score) => {
                const r = await onGuess(score);
                if (!r?.error) remember(round?.id || '', score);
                return r;
              }}
            />
            {hint && (
              <p className="muted small">
                Closest guess wins <span className="mono">{WIN_COINS}</span> coins (spot on, double). One guess each, hidden until it
                starts. Whoever logs the score can’t win it.
              </p>
            )}
          </>
        ))}
      {status === 'done' && <p className="small guess-result">{winnerLine(round) || 'Nobody was close.'}</p>}
      {round && <Guesses round={round} />}
      {status === 'open' && round && (canLock || round.openedBy === actor.name || actor.admin) && (
        <div className="guess-actions">
          {canLock && n > 0 && (
            <button className="btn small-btn" onClick={() => act('lock')}>
              Run’s starting: lock guesses
            </button>
          )}
          {(round.openedBy === actor.name || actor.admin) && round.kind === 'run' && (
            <button className="text-btn" onClick={() => act('cancel')}>
              Call it off
            </button>
          )}
        </div>
      )}
      {status === 'locked' && <p className="muted small">Log the run and the closest guess wins.</p>}
    </div>
  );
}

// The Match log's guessing card: the next practice run, the next match (if
// one is coming up), and how the last one went.
export function GuessCard({ predictions = [], matches = [], actor, api }) {
  const [mine, remember] = useMyGuesses();
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const live = predictions.filter((p) => p.kind === 'run' && isLive(p)).sort((a, b) => a.openedAt - b.openedAt)[0];
  const last = predictions.filter((p) => p.status === 'done').sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0))[0];
  const nextMatch = matches
    .filter((m) => m.time && m.time > now && !m.ours && m.time - now < 3 * 86400000)
    .sort((a, b) => a.time - b.time)[0];
  const matchRound = nextMatch ? predictions.find((p) => p.id === matchRoundId(nextMatch.id)) || null : null;
  const start = async () => {
    setBusy(true);
    await api.predict({ action: 'open' });
    setBusy(false);
  };
  return (
    <section className="chart-card guess-card">
      <h2>Guess the score</h2>
      {live ? (
        <RoundBox
          round={live}
          title="Next practice run"
          actor={actor}
          api={api}
          mine={mine}
          remember={remember}
          canLock
          onGuess={(score) => api.predict({ action: 'guess', id: live.id, score })}
        />
      ) : (
        <div className="guess-start">
          <p className="small">
            About to do a practice run? Start a round and everyone can guess the total. Closest wins{' '}
            <span className="mono">{WIN_COINS}</span> coins (at least <span className="mono">{MIN_GUESSERS}</span> guesses).
          </p>
          <button className="btn" disabled={busy} onClick={start}>
            <Icon name="target" size={16} /> Start guessing
          </button>
        </div>
      )}
      {nextMatch && (
        <RoundBox
          round={matchRound}
          title={`${nextMatch.label} at ${new Date(nextMatch.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          actor={actor}
          api={api}
          mine={mine}
          remember={(id, s) => remember(matchRoundId(nextMatch.id), s)}
          hint={!live || live.status !== 'open' || (live.guessers || []).includes(actor.name)}
          onGuess={(score) => api.predict({ action: 'guess', matchId: nextMatch.id, score })}
        />
      )}
      {last && last !== live && (
        <div className="guess-last">
          <span className="recap-label">Last one</span>
          <RoundBox
            round={last}
            title={last.kind === 'match' ? last.label : 'Practice run'}
            actor={actor}
            api={api}
            mine={mine}
            remember={remember}
          />
        </div>
      )}
    </section>
  );
}

// The pit screen: guess the next match's score (cheap and small).
export function PitGuess({ predictions = [], next, actor, api, now }) {
  const [mine, remember] = useMyGuesses();
  const round = next ? predictions.find((p) => p.id === matchRoundId(next.id)) || null : null;
  const last = useMemo(
    () => predictions.filter((p) => p.kind === 'match' && p.status === 'done').sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0))[0],
    [predictions],
  );
  if (!next && !last) return null;
  const started = next && next.time && now >= next.time;
  return (
    <section className="today-sec pit-sec">
      <div className="sec-head">
        <h2>Guess our score</h2>
      </div>
      {next && !(started && !round) && (
        <RoundBox
          round={round && started && round.status === 'open' ? { ...round, status: 'locked' } : round}
          title={next.label}
          actor={actor}
          api={api}
          mine={mine}
          remember={(id, s) => remember(matchRoundId(next.id), s)}
          onGuess={(score) => api.predict({ action: 'guess', matchId: next.id, score })}
        />
      )}
      {last && (!round || last.id !== round.id) && (
        <p className="small guess-result">
          {last.label}: scored <b className="mono">{last.score}</b>. {winnerLine(last)}
        </p>
      )}
    </section>
  );
}
