// G10: Trotbot's daily question card in #general. Answer right on the card;
// the server grades it, and after you answer the card shows the right
// answer, why, and your daily streak (your answer doc, dailyAnswers/).
import { createContext, useContext, useEffect, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { celebrate } from '../../motion.js';
import { CodeView, Citation, ManualText, isTrueFalse } from './Visuals.jsx';
import { teamDay } from '../../../functions/shared/coins.js';

// { me, answer({ day, answer }), subscribe(day, cb) } from Workspace.
export const DailyContext = createContext(null);

const dayLabel = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function DailyCard({ c, onPerson }) {
  const ctx = useContext(DailyContext);
  const [mine, setMine] = useState(undefined); // undefined: loading, null: not answered
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => (ctx ? ctx.subscribe(c.day, setMine) : undefined), [ctx, c.day]);
  const q = c.q || {};
  const open = c.day === teamDay(Date.now());
  const choose = async (i) => {
    if (!ctx || busy || mine) return;
    setBusy(true);
    setError('');
    try {
      const r = await ctx.answer({ day: c.day, answer: i });
      setMine({ ...r, given: i });
      if (r.correct && (r.rank === 1 || [5, 10, 20, 30, 50].includes(r.streak))) celebrate({ count: 22 });
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };
  const done = !!mine;
  const tf = isTrueFalse(q);
  return (
    <div className="lq-daily">
      <div className="lq-daily-head">
        <span className="lq-kicker">
          <Icon name="learn" size={14} /> Daily question · {c.game}
        </span>
        <span className="mono muted small">{dayLabel(c.day)}</span>
      </div>
      {q.image && <img className="lq-daily-img" src={q.image} alt="The part" />}
      <p className="lq-daily-q">
        <ManualText text={q.prompt || ''} />
      </p>
      {q.scene && <p className="lq-daily-scene">{q.scene}</p>}
      {q.lines && <CodeView lines={q.lines} lang={q.lang} readOnly result={done && mine.bugLine != null ? { bugLine: mine.bugLine } : null} />}
      <div className={`lq-choices small${tf ? ' tf' : ''}`}>
        {(q.choices || []).map((ch, i) => {
          const st = done ? (i === mine.answer ? ' is-right' : i === mine.given ? ' is-wrong' : ' dim') : '';
          return (
            <button key={i} className={`lq-choice${st}`} disabled={done || !open || busy || mine === undefined} onClick={() => choose(i)}>
              {!tf && <span className="lq-choice-n mono">{String.fromCharCode(65 + i)}</span>}
              <span className="lq-choice-text">{ch}</span>
              {done && i === mine.answer && <Icon name="check" size={16} className="lq-choice-mark" />}
            </button>
          );
        })}
      </div>
      {error && <p className="lq-error">{error}</p>}
      {done && (
        <div className={`lq-daily-reveal ${mine.correct ? 'is-right' : 'is-wrong'}`}>
          <div className="lq-fb-head">
            <span className="lq-fb-icon">
              <Icon name={mine.correct ? 'check' : 'cross'} size={16} />
            </span>
            <b>{mine.correct ? (mine.rank && mine.rank <= 3 ? `Right, #${mine.rank} today` : 'Right') : 'Not quite'}</b>
            {mine.coins > 0 && (
              <span className="chip lq-chip-coin">
                <Icon name="coin" size={13} /> <span className="mono">+{mine.coins}</span>
              </span>
            )}
            <span className="lq-streak on small" title="Daily streak (school days)">
              <Icon name="flame" size={14} /> <span className="mono">{mine.streak}</span>
            </span>
          </div>
          {mine.fixed && (
            <p className="small">
              <b>Fix:</b> <code>{String(mine.fixed).trim()}</code>
            </p>
          )}
          {mine.explain && <p className="lq-fb-explain">{mine.explain}</p>}
          {mine.fix && (
            <p className="small">
              <b>Fix:</b> {mine.fix}
            </p>
          )}
          {mine.source && <Citation source={mine.source} />}
        </div>
      )}
      <div className="lq-daily-foot muted small">
        <span>
          <span className="mono">{c.answered || 0}</span> answered
        </span>
        {(c.firstCorrect || []).length > 0 && (
          <span>
            First right:{' '}
            {c.firstCorrect.map((n, i) => (
              <span key={n}>
                {i ? ', ' : ''}
                <button className="name-btn" onClick={(e) => onPerson?.(n, e)}>
                  {n.split(' ')[0]}
                </button>
              </span>
            ))}
          </span>
        )}
        {!open && !done && <span>Closed</span>}
      </div>
    </div>
  );
}
