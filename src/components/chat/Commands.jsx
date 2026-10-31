import { Icon } from '../shell/icons.jsx';
import { Avatar, DisplayName } from '../common.jsx';
import { COMMANDS, GROUPS } from '../../commands.js';
import { CASINO_CARDS, CasinoBody, ECONOMY_CARDS } from './Casino.jsx';
import { ARCADE_CARDS, ArcadeBody } from './Arcade.jsx';
import { Die } from './Die.jsx';
import { LabDay } from '../LabLog.jsx';
import { RecapBody } from '../Life.jsx';
import { DailyCard } from '../learn/DailyCard.jsx';
import { priorityById } from '../../config.js';
import { daysBetween, todayISO } from '../../teamCommands.js';

// What slash commands look like in chat (commands.js does the work): the
// Trotbot card on a command's message, and the notes only you can see.

export function Trotbot({ name }) {
  return (
    <div className="cmd-head">
      <span className="cmd-bot" aria-hidden="true">
        <Icon name="robot" size={14} />
      </span>
      <b>Trotbot</b>
      <span className="cmd-tag">BOT</span>
      {name && <span className="muted tiny">/{name}</span>}
    </div>
  );
}

const Name = ({ name, onPerson }) => (
  <DisplayName as="button" name={name} className="name-btn cmd-name" onClick={onPerson ? (e) => onPerson(name, e) : undefined} />
);

const TEAM_CARDS = ['task', 'overdue', 'shift', 'match', 'standup', 'labday', 'recap', 'dailyq'];
const dayText = (iso) => {
  const d = daysBetween(todayISO(), iso);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return new Date(`${iso}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const time = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const Record = ({ r }) => (
  <div className="cmd-stats">
    <span>
      Season{' '}
      <b>
        {r.wins}–{r.losses}–{r.ties}
      </b>
    </span>
    <span>
      best <b>{r.best}</b>
    </span>
    <span>
      avg <b>{r.avg}</b>
    </span>
    <span>
      <b>{r.played}</b> match{r.played === 1 ? '' : 'es'}
    </span>
  </div>
);

function TeamBody({ c, by, onPerson }) {
  switch (c.name) {
    case 'labday':
      return <LabDay c={c} onPerson={onPerson} />;
    case 'recap':
      return <RecapBody c={c} onPerson={onPerson} />;
    case 'dailyq':
      return <DailyCard c={c} onPerson={onPerson} />;
    case 'task':
      return (
        <div>
          <div className="muted tiny">New task</div>
          <div className="cmd-task-title">{c.title}</div>
          <div className="cmd-task-meta">
            {c.assignees.length ? (
              c.assignees.map((n) => (
                <span key={n} className="arc-who">
                  <Avatar name={n} size={20} /> <Name name={n} onPerson={onPerson} />
                </span>
              ))
            ) : (
              <span className="muted">Nobody yet</span>
            )}
            {c.dueDate && <span>Due {dayText(c.dueDate)}</span>}
            {c.priority && c.priority !== 'medium' && <span>{priorityById[c.priority]?.label}</span>}
            {c.subteam && <span className="muted">{c.subteam}</span>}
          </div>
        </div>
      );
    case 'overdue':
      return c.total ? (
        <div>
          <div className="cmd-big">
            😬 {c.total} late task{c.total > 1 ? 's' : ''}
          </div>
          <ul className="cmd-late">
            {c.list.map((t) => (
              <li key={t.id}>
                <span className="late">{t.late}d late</span>
                <b>{t.title}</b>
                <span className="muted small">{t.who.length ? t.who.map((n) => n.split(' ')[0]).join(', ') : 'nobody'}</span>
              </li>
            ))}
          </ul>
          {c.total > c.list.length && <div className="muted tiny">…and {c.total - c.list.length} more on the Board.</div>}
        </div>
      ) : (
        <div className="cmd-big">Nothing is overdue. Who are you people?</div>
      );
    case 'shift':
      if (c.who)
        return c.people.length ? (
          <div>
            <div className="cmd-big">{c.people.length} at the lab</div>
            <ul className="cmd-late">
              {c.people.map((p) => (
                <li key={p.name}>
                  <Avatar name={p.name} size={22} /> <Name name={p.name} onPerson={onPerson} />
                  <span className="muted small">since {time(p.since)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="cmd-big">Nobody’s at the lab right now.</div>
        );
      return (
        <div>
          <div className="cmd-big">⏱ Clocked in</div>
          <div>
            <Name name={by} onPerson={onPerson} /> started a shift at {time(c.at)}.
          </div>
          {c.others?.length > 0 && <div className="muted small">Also here: {c.others.map((p) => p.name.split(' ')[0]).join(', ')}</div>}
        </div>
      );
    case 'match': {
      if (!c.total && c.total !== 0) return <Record r={c.record} />;
      const parts = [
        ['auto', 'Auto', c.auto],
        ['teleop', 'TeleOp', c.teleop],
        ['endgame', 'Endgame', c.endgame],
      ];
      return (
        <div>
          <div className="cmd-match-score">
            <span className="cmd-big">
              🏁 {c.matchNumber ? `Match ${c.matchNumber}` : 'Match'}: {c.total} pts
            </span>
            {c.result && <span className={`cmd-result ${c.result}`}>{{ win: 'W', loss: 'L', tie: 'T' }[c.result]}</span>}
          </div>
          <div className="cmd-match-bars" aria-hidden="true">
            {parts.map(([k, , v]) => (
              <span key={k} className={`sw-${k}`} style={{ width: `${c.total ? (v / c.total) * 100 : 0}%` }} />
            ))}
          </div>
          <div className="cmd-stats">
            {parts.map(([k, label, v]) => (
              <span key={k}>
                {label} <b>{v}</b>
              </span>
            ))}
          </div>
          <Record r={c.record} />
          <div className="muted tiny">Saved to the Match Log.</div>
        </div>
      );
    }
    case 'standup':
      return (
        <div className="cmd-standup">
          <div className="muted tiny">{c.day} standup</div>
          {c.yesterday && (
            <div>
              <span className="muted">Done</span>
              {c.yesterday}
            </div>
          )}
          {c.today && (
            <div>
              <span className="muted">Today</span>
              {c.today}
            </div>
          )}
          <div>
            <span className="muted">Blockers</span>
            {c.blockers && !/^(none|nothing|no|n\/a|-)\.?$/i.test(c.blockers) ? <span className="blocked">{c.blockers}</span> : 'None 🎉'}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function Body({ c, by, onPerson }) {
  switch (c.name) {
    case 'ping':
      return (
        <div className="cmd-ping">
          <div className="cmd-big">🏓 Pong!</div>
          <div>
            <b>{c.ms} ms</b> <span className="muted">· {c.status}</span>
          </div>
        </div>
      );
    case 'whois':
      return (
        <div className="cmd-whois">
          <button className="avatar-btn" onClick={(e) => onPerson?.(c.to, e)} aria-label={c.to}>
            <Avatar name={c.to} size={56} showOnline />
          </button>
          <div className="grow">
            <Name name={c.to} onPerson={onPerson} />
            {c.subteams?.length > 0 && <div className="muted small">{c.subteams.join(' · ')}</div>}
            {c.status && <div className="small">{c.status}</div>}
            <div className="cmd-stats">
              <span>
                <b>{c.week ?? 0} h</b> this week
              </span>
              <span>
                <b>{c.hours ?? 0} h</b> this season
              </span>
              <span>
                <b>{c.done ?? 0}</b> tasks done
              </span>
              <span>
                <b>{c.open ?? 0}</b> open
              </span>
              <span>
                <b>{c.coins ?? 0}</b> 🪙
              </span>
            </div>
            {c.onShift && <div className="small cmd-onshift">At the lab right now</div>}
          </div>
        </div>
      );
    case 'avatar':
      return (
        <div className="cmd-avatar">
          {/* Room around it for the decoration, so it doesn't run over the name. */}
          <span className="cmd-avatar-pic">
            <Avatar name={c.to} size={140} />
          </span>
          <Name name={c.to} onPerson={onPerson} />
        </div>
      );
    case 'countdown':
      return (
        <div className="cmd-countdown">
          <div className="cmd-big">🏁 {c.days === 0 ? 'Competition is TODAY' : `${c.days} day${c.days === 1 ? '' : 's'}`}</div>
          <div className="muted small">
            {c.days > 0 ? `until ${c.label || 'competition'} · ` : ''}
            {c.date}
          </div>
          <div>{c.hype}</div>
        </div>
      );
    case 'afk':
      return (
        <div>
          💤 <Name name={by} onPerson={onPerson} /> is AFK: <i>{c.reason}</i>
          <div className="muted tiny">Trotbot will tell anyone who @s them. Sending a message brings them back.</div>
        </div>
      );
    case '8ball':
      return (
        <div className="cmd-8ball">
          <div className="muted small">“{c.q}”</div>
          <div className={`cmd-8ball-answer ${c.mood}`}>
            <span className="cmd-ball" aria-hidden="true">
              🎱
            </span>
            {c.answer}
          </div>
        </div>
      );
    case 'flip':
      return (
        <div className="cmd-flip">
          <span className={`cmd-coin ${c.side}`} aria-hidden="true">
            🪙
          </span>
          <b>{c.side === 'edge' ? 'It landed on its EDGE. 1 in 1,000.' : c.side === 'heads' ? 'Heads' : 'Tails'}</b>
        </div>
      );
    case 'roll':
      return (
        <div className="cmd-roll">
          <div className="cmd-dice">
            {c.rolls.map((r, i) =>
              c.sides === 6 ? (
                <Die key={i} n={r} i={i} />
              ) : (
                <span key={i} className="cmd-die" style={{ '--i': i }}>
                  {r}
                </span>
              ),
            )}
            {c.plus ? <span className="cmd-plus">{c.plus > 0 ? `+${c.plus}` : c.plus}</span> : null}
          </div>
          <div className="cmd-roll-total">
            {c.spec} = <b className="cmd-total">{c.total}</b>
          </div>
        </div>
      );
    case 'choose':
      return (
        <div className="cmd-choose">
          {c.options.map((o) => (
            <span key={o} className={`chip${o === c.pick ? ' on' : ''}`}>
              {o === c.pick ? '👉 ' : ''}
              {o}
            </span>
          ))}
          <div>
            I choose <b>{c.pick}</b>.
          </div>
        </div>
      );
    case 'rate':
      return (
        <div className="cmd-rate">
          <div>
            <b>{c.thing}</b>: <b className="cmd-big">{c.score}/10</b>
          </div>
          <div className="cmd-meter">
            <span style={{ width: `${c.score * 10}%` }} />
          </div>
          <div className="muted small">{c.quip}</div>
        </div>
      );
    case 'ship':
      return (
        <div className="cmd-ship">
          <div className="cmd-ship-pair">
            <Avatar name={c.a} size={44} />
            <span className="cmd-heart" aria-hidden="true">
              {c.pct >= 60 ? '💖' : c.pct >= 30 ? '💛' : '💔'}
            </span>
            <Avatar name={c.b} size={44} />
          </div>
          <div>
            <Name name={c.a} onPerson={onPerson} /> + <Name name={c.b} onPerson={onPerson} /> = <b>{c.couple}</b>
          </div>
          <div className="cmd-meter">
            <span style={{ width: `${c.pct}%` }} />
          </div>
          <div>
            <b>{c.pct}%</b> <span className="muted small">· {c.quip}</span>
          </div>
        </div>
      );
    case 'fortune':
      return (
        <div className="cmd-fortune">
          <span className="cmd-cookie" aria-hidden="true">
            🥠
          </span>
          <div className="cmd-slip">
            {c.text}
            <div className="muted tiny">
              Lucky numbers {c.lucky.join(' · ')} · Lucky gear ratio {c.ratio}
            </div>
          </div>
        </div>
      );
    case 'pet':
    case 'hug':
    case 'highfive':
    case 'bonk':
    case 'wave':
      return (
        <div className={`cmd-action act-${c.name}`}>
          <div className="cmd-stage" aria-hidden="true">
            {(c.name === 'hug' || c.name === 'highfive') && <Avatar name={by} size={52} />}
            {c.to && (
              <span className="cmd-target">
                <Avatar name={c.to} size={52} />
              </span>
            )}
            <span className="cmd-prop">{{ pet: '🫳', hug: '🫂', highfive: '✋', bonk: '🔨', wave: '👋' }[c.name]}</span>
            {c.name === 'bonk' && <span className="cmd-pow">BONK!</span>}
          </div>
          <div>
            <Name name={by} onPerson={onPerson} />{' '}
            {c.to && c.to !== by && c.line.includes(c.to)
              ? c.line.split(c.to).flatMap((part, i) => (i ? [<Name key={i} name={c.to} onPerson={onPerson} />, part] : [part]))
              : c.line}
          </div>
        </div>
      );
    default:
      return <div className="muted small">/{c.name}</div>;
  }
}

export function CommandCard({ m, onPerson, me, onMove, onBuy, conv }) {
  const n = m.cmd.name;
  const kind = ARCADE_CARDS.includes(n)
    ? 'arcade'
    : CASINO_CARDS.includes(n) || ECONOMY_CARDS.includes(n)
      ? 'money'
      : TEAM_CARDS.includes(n)
        ? 'team'
        : '';
  const PersonName = ({ name }) => <Name name={name} onPerson={onPerson} />;
  return (
    <div className={`cmd-card cmd-card-${n}${kind ? ` cmd-${kind}` : ''}`}>
      <Trotbot name={n === 'dailyq' ? '' : n} />
      {kind === 'arcade' ? (
        <ArcadeBody m={m} me={me} onMove={onMove} Name={PersonName} conv={conv} />
      ) : kind === 'money' ? (
        <CasinoBody m={m} me={me} onMove={onMove} onBuy={onBuy} Name={PersonName} />
      ) : kind === 'team' ? (
        <TeamBody c={m.cmd} by={m.by} onPerson={onPerson} />
      ) : (
        <Body c={m.cmd} by={m.by} onPerson={onPerson} />
      )}
    </div>
  );
}

// /mytasks: your open tasks with a ✓ to finish each one.
function MyTasks({ ids, tasks, onOpenTask, onTaskDone }) {
  const today = todayISO();
  const list = ids.map((id) => tasks.find((t) => t.id === id)).filter(Boolean);
  return (
    <div className="cmd-mytasks">
      {list.map((t) => {
        const done = t.status === 'done';
        const late = !done && t.dueDate && t.dueDate < today;
        return (
          <div key={t.id} className={`cmd-mytask${done ? ' done' : ''}`}>
            <button className="btn small" disabled={done} onClick={() => onTaskDone(t)} aria-label={`Mark “${t.title}” done`}>
              {done ? '✅' : '✓ Done'}
            </button>
            <button className="task-chip" onClick={() => onOpenTask(t.id)}>
              {t.title || 'Untitled'}
            </button>
            {late ? (
              <span className="late">{daysBetween(t.dueDate, today)}d late</span>
            ) : (
              t.dueDate && !done && <span className="muted tiny">due {dayText(t.dueDate)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// A note only you can see (/help, confirmations, "who's that?").
export function CommandNote({ note, onDismiss, onUse, onGo, tasks = [], onOpenTask, onTaskDone }) {
  return (
    <div className="cmd-note" role="status">
      <div className="cmd-head">
        <span className="cmd-bot" aria-hidden="true">
          <Icon name="robot" size={14} />
        </span>
        <b>Trotbot</b>
        <span className="cmd-tag">BOT</span>
        <span className="muted tiny">Only you can see this ·</span>
        <button className="link-btn tiny" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <b className="cmd-note-title">{note.title}</b>
      {note.taskIds && <MyTasks ids={note.taskIds} tasks={tasks} onOpenTask={onOpenTask} onTaskDone={onTaskDone} />}
      {note.body && <div className="small">{note.body}</div>}
      {note.go && onGo && (
        <button className="btn primary cmd-go" onClick={() => onGo(note.go)}>
          Go to #{note.go}
        </button>
      )}
      {note.help && (
        <div className="cmd-help">
          {GROUPS.filter(([g]) => COMMANDS.some((c) => c.group === g && !(note.off || []).includes(c.name))).map(([g, label]) => (
            <section key={g}>
              <h4>{label}</h4>
              {COMMANDS.filter((c) => c.group === g && !(note.off || []).includes(c.name)).map((c) => (
                <button key={c.name} className="cmd-help-row" onClick={() => onUse(c)}>
                  <code>/{c.name}</code>
                  {c.args && <span className="muted small">{c.args}</span>}
                  <span className="small grow">{c.desc}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// One row in the / menu.
export function CommandOption({ c }) {
  return (
    <>
      <code className="cmd-opt-name">/{c.name}</code>
      {c.args && <span className="cmd-opt-args">{c.args}</span>}
      <span className="muted small cmd-opt-desc">{c.desc}</span>
    </>
  );
}
