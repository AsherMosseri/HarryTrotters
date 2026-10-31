import { useEffect, useState } from 'react';
import { Avatar, DisplayName } from '../common.jsx';
import { daysBetween, todayISO } from '../../teamCommands.js';

// Cards for the 3.0 slash commands (moreCommands.js). Most are an "info"
// card: a title, a big line, rows, paragraphs, code and where it comes from.

const Name = ({ name, onPerson }) => (
  <DisplayName as="button" name={name} className="name-btn cmd-name" onClick={onPerson ? (e) => onPerson(name, e) : undefined} />
);
const first = (n) => n.split(' ')[0];
const dueText = (iso) => {
  if (!iso) return '';
  const d = daysBetween(todayISO(), iso);
  if (d < 0) return `${-d}d late`;
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  return `due ${new Date(`${iso}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
};
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s % 60).padStart(2, '0')}`;
};

function Rows({ rows }) {
  return (
    <table className="mc-rows">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {(row.c || row).map((cell, k) => (
              <td key={k} className={k === 0 ? 'mc-key' : /^[\d.,:+×÷−-]+( ?[a-zA-Z%Ω/]+)?$/.test(cell) ? 'mono' : ''}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Info({ c }) {
  return (
    <div className="mc-info">
      <div className="mc-title">
        {c.person && <Avatar name={c.person} size={24} />}
        <b>{c.title}</b>
      </div>
      {c.from && <div className="muted small mc-from">“{c.from}”</div>}
      {c.big && <div className="mc-big mono">{c.big}</div>}
      {c.flips && (
        <div className="mc-flips" aria-label={c.flips.join(' ')}>
          {c.flips.map((f, i) => (
            <span key={i} className={`mc-flip ${f === 'H' ? 'h' : 't'}`}>
              {f}
            </span>
          ))}
        </div>
      )}
      {c.rows && <Rows rows={c.rows} />}
      {c.label2 && <div className="mc-cap">{c.label2}</div>}
      {c.rows2 && <Rows rows={c.rows2} />}
      {c.lines?.map((l, i) => (
        <p key={i} className="mc-line">
          {l}
        </p>
      ))}
      {c.code && (
        <pre className={`mc-code${c.lang ? ` lang-${c.lang}` : ''}`}>
          <code>{c.code}</code>
        </pre>
      )}
      {c.lines2?.map((l, i) => (
        <p key={i} className="muted small mc-line">
          {l}
        </p>
      ))}
      {c.cite && <div className="muted tiny mc-cite">{c.cite}</div>}
    </div>
  );
}

function Reveal({ c }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mc-reveal">
      <div className="mc-top">{c.top}</div>
      {open ? (
        <div className="mc-hidden shown">{c.hidden}</div>
      ) : (
        <button className="mc-hidden" onClick={(e) => (e.stopPropagation(), setOpen(true))}>
          {c.hint}
        </button>
      )}
    </div>
  );
}

function Timer({ c }) {
  const [now, setNow] = useState(Date.now());
  const done = now >= c.endsAt;
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [done]);
  const left = c.endsAt - now;
  return (
    <div className={`mc-timer${done ? ' done' : ''}`}>
      {c.label && <div className="small muted">{c.label}</div>}
      <div className="mc-timer-n mono">{done ? 'Time!' : clock(left)}</div>
      <div className="mc-timer-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, left / c.ms))})` }} />
      </div>
    </div>
  );
}

function People({ c, onPerson }) {
  return (
    <div className="mc-people">
      <div className="mc-title">
        <b>{c.title}</b>
        {c.sub && <span className="muted small"> · {c.sub}</span>}
      </div>
      {c.groups.map((group, gi) => {
        const g = group.names || group;
        return (
        <div key={gi} className="mc-group">
          {(c.labels || c.groups.length > 1) && (
            <div className="mc-cap">
              {c.labels ? c.labels[gi] : `Team ${gi + 1}`} <span className="mono">{c.labels ? g.length : ''}</span>
            </div>
          )}
          {g.length ? (
            <ol className={`mc-list${c.numbered ? ' numbered' : ''}`}>
              {g.map((n) => (
                <li key={n}>
                  <Avatar name={n} size={22} /> <Name name={n} onPerson={onPerson} />
                  {c.side?.[n] && <span className="mono small muted mc-side">{c.side[n]}</span>}
                  {c.since?.[n] && (
                    <span className="small muted mc-side">
                      since {new Date(c.since[n]).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="muted small">Nobody yet</div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function Tasks({ c }) {
  return (
    <div className="mc-tasks">
      <b>{c.title}</b>
      {c.list.length > 0 && (
        <ul className="cmd-late">
          {c.list.map((t) => (
            <li key={t.id}>
              <b>{t.title}</b>
              {t.due && <span className={`small ${dueText(t.due).includes('late') ? 'late' : 'muted'}`}>{dueText(t.due)}</span>}
              <span className="muted small">{t.who.length ? t.who.map(first).join(', ') : 'nobody'}</span>
              {c.reasons && t.reason && <span className="small blocked">{t.reason}</span>}
            </li>
          ))}
        </ul>
      )}
      {c.more > 0 && <div className="muted tiny">…and {c.more} more on the Board.</div>}
    </div>
  );
}

function Rule({ c }) {
  const [all, setAll] = useState(false);
  const shown = all ? c.text : c.text.slice(0, 3);
  return (
    <div className="mc-rule">
      <div className="mc-title">
        <span className="mc-rule-id mono">{c.id}</span>
        <b>{c.title}</b>
      </div>
      {shown.map((p, i) => (
        <p key={i} className={`mc-line${/^Violation:/.test(p) ? ' mc-violation' : /^[A-H]\.\s/.test(p) ? ' mc-item' : ''}`}>
          {p}
        </p>
      ))}
      {c.text.length > 3 && (
        <button className="link-btn small" onClick={(e) => (e.stopPropagation(), setAll((a) => !a))}>
          {all ? 'Show less' : `Show the whole rule (${c.text.length - 3} more)`}
        </button>
      )}
      <div className="muted tiny mc-cite">
        2026-27 Competition Manual (TU07){c.section ? `, ${c.section}` : ''}, p. {c.page}
      </div>
    </div>
  );
}

export function MoreBody({ c, by, onPerson }) {
  switch (c.view) {
    case 'info':
      return <Info c={c} />;
    case 'reveal':
      return <Reveal c={c} />;
    case 'timer':
      return <Timer c={c} />;
    case 'people':
      return <People c={c} onPerson={onPerson} />;
    case 'tasks':
      return <Tasks c={c} />;
    case 'rule':
      return <Rule c={c} />;
    case 'cheer':
      return <div className="mc-cheer">{c.line}</div>;
    case 'shout':
      return (
        <div className="mc-shout">
          <Avatar name={c.to} size={40} />
          <div>
            {c.name === 'hype' ? (
              <>
                <Name name={c.to} onPerson={onPerson} /> {c.line}
              </>
            ) : (
              <>
                <Name name={c.to} onPerson={onPerson} />, {c.line}
                <div className="muted tiny">from {first(by)}</div>
              </>
            )}
          </div>
        </div>
      );
    default:
      return <div className="muted small">/{c.name}</div>;
  }
}
