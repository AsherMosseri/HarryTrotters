import { Avatar } from '../common.jsx';
import { Icon } from './icons.jsx';
import { STATUSES } from '../../config.js';
import { dueInfo } from '../../util.js';
import { daysBetween, milestoneProgress, parseDay, todayISO } from '../../milestones.js';

// The first page: what matters to you right now, in plain sections (your
// tasks, what's due, who's at the lab, unread chat, the next milestone).
const statusOf = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
const RANK = { blocked: 0, in_progress: 1, testing: 2, todo: 3, backlog: 4 };

function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0]}`;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const timeOf = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function TaskRow({ task, onOpen, showWho }) {
  const due = dueInfo(task.dueDate, task.status);
  const st = statusOf[task.status];
  return (
    <li>
      <button className="t-row" onClick={() => onOpen(task.id)}>
        <span className={`t-mark s-${task.status}`} style={{ '--c': st?.color }} title={st?.label} aria-label={st?.label} />
        <span className="t-main">
          <span className="t-title">{task.title || 'Untitled'}</span>
          <span className="t-sub">
            {[st?.short || st?.label, task.subteam, task.status === 'blocked' && task.blockedReason].filter(Boolean).join(' · ')}
          </span>
        </span>
        {showWho && task.assignees?.length > 0 && (
          <span className="t-who">
            {task.assignees.slice(0, 2).map((n) => (
              <Avatar key={n} name={n} size={22} />
            ))}
          </span>
        )}
        {due && <span className={`t-due ${due.tone}`}>{due.label}</span>}
      </button>
    </li>
  );
}

export default function Today({
  actor,
  tasks,
  milestones,
  competition,
  shifts,
  myShift,
  convs,
  unread,
  chat,
  on,
  onOpenTask,
  onOpenConv,
  onPage,
  onNewTask,
  onStartShift,
  onOpenShift,
  onPerson,
}) {
  const today = todayISO();
  const all = tasks || [];
  const mine = all
    .filter((t) => t.status !== 'done' && (t.assignees || []).includes(actor.name))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9));
  const overdue = mine.filter((t) => t.dueDate && t.dueDate < today).length;
  const soon = all
    .filter((t) => t.status !== 'done' && t.dueDate && daysBetween(today, t.dueDate) <= 7 && !(t.assignees || []).includes(actor.name))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  const atLab = shifts.filter((s) => !s.end && s.person).sort((a, b) => a.start - b.start);
  const waiting = [...convs.channels, ...convs.dms]
    .filter((c) => unread[c.key]?.count > 0 && !unread[c.key].muted)
    .map((c) => ({ c, last: (chat[c.key] || []).filter((m) => !m.deleted).at(-1), u: unread[c.key] }))
    .slice(0, 5);
  const nextMs = milestones.filter((m) => !m.done && m.end && m.end >= today).sort((a, b) => a.end.localeCompare(b.end))[0];
  const msProgress = nextMs ? milestoneProgress(nextMs, all) : null;
  const left = competition.date ? daysBetween(today, competition.date) : -1;

  // One plain sentence instead of a row of stat tiles.
  const summary = [
    mine.length ? `You have ${plural(mine.length, 'open task')}${overdue ? `, ${overdue} overdue` : ''}.` : 'Nothing assigned to you.',
    on.includes('shifts') && (atLab.length ? `${plural(atLab.length, 'person', 'people')} at the lab.` : 'Nobody at the lab right now.'),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className="content today">
      <header className="today-head">
        <p className="today-date">{parseDay(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1>{greeting(actor.name)}</h1>
        <p className="today-sum">{summary}</p>
      </header>

      <div className="today-grid">
        <div className="today-col">
          {on.includes('tasks') && (
            <section className="today-sec">
              <div className="sec-head">
                <h2>Your tasks</h2>
                <button className="text-btn" onClick={onNewTask}>
                  <Icon name="plus" size={16} /> New task
                </button>
              </div>
              {mine.length ? (
                <ul className="t-list">
                  {mine.slice(0, 8).map((t) => (
                    <TaskRow key={t.id} task={t} onOpen={onOpenTask} />
                  ))}
                </ul>
              ) : (
                <p className="today-empty">
                  Nothing on your plate.{' '}
                  <button className="text-btn inline" onClick={() => onPage('tasks')}>
                    Find something on the board
                  </button>
                </p>
              )}
              {mine.length > 8 && (
                <button className="text-btn more" onClick={() => onPage('tasks')}>
                  {mine.length - 8} more
                </button>
              )}
            </section>
          )}
          {on.includes('tasks') && soon.length > 0 && (
            <section className="today-sec">
              <div className="sec-head">
                <h2>Due this week</h2>
              </div>
              <ul className="t-list">
                {soon.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={onOpenTask} showWho />
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="today-col side">
          {left >= 0 && (
            <section className="today-sec countdown-sec">
              <div className="big-num">{left === 0 ? 'Today' : left}</div>
              <div className="big-num-label">
                {left === 0 ? `${competition.name} day` : `${left === 1 ? 'day' : 'days'} until ${competition.name.toLowerCase()}`}
                <span>
                  {parseDay(competition.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </section>
          )}

          {on.includes('shifts') && (
            <section className="today-sec">
              <div className="sec-head">
                <h2>At the lab</h2>
                {myShift ? (
                  <button className="text-btn" onClick={onOpenShift}>
                    You’re in since {timeOf(myShift.start)}
                  </button>
                ) : (
                  <button className="text-btn" onClick={() => onStartShift()}>
                    Start a shift
                  </button>
                )}
              </div>
              {atLab.length ? (
                <ul className="p-list">
                  {atLab.map((s) => (
                    <li key={s.id}>
                      <button className="p-row" onClick={() => onPerson(s.person)}>
                        <Avatar name={s.person} size={26} showOnline />
                        <span className="grow">{s.person}</span>
                        <span className="p-since">since {timeOf(s.start)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="today-empty">Nobody’s checked in.</p>
              )}
            </section>
          )}

          {on.includes('chat') && waiting.length > 0 && (
            <section className="today-sec">
              <div className="sec-head">
                <h2>Unread</h2>
              </div>
              <ul className="c-list">
                {waiting.map(({ c, last, u }) => (
                  <li key={c.key}>
                    <button className="c-row" onClick={() => onOpenConv(c.key)}>
                      <span className="c-name">
                        {c.kind === 'dm' ? c.short : `#${c.name}`}
                        <span className={`c-count${u.mentions ? ' strong' : ''}`}>{u.count}</span>
                      </span>
                      {last && (
                        <span className="c-last">
                          {/* A one-on-one message doesn't need the sender's name again. */}
                          {!(c.kind === 'dm' && c.people.length === 2) && <b>{last.by?.split(' ')[0]} </b>}
                          {last.text || (last.gif ? 'sent a GIF' : last.photo ? 'sent a photo' : '')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {on.includes('milestones') && nextMs && (
            <section className="today-sec">
              <div className="sec-head">
                <h2>Next milestone</h2>
                <button className="text-btn" onClick={() => onPage('milestones')}>
                  All
                </button>
              </div>
              <button className="ms-row" onClick={() => onPage('milestones')}>
                <span className="ms-title">{nextMs.title}</span>
                <span className="ms-sub">
                  {[
                    nextMs.subteam,
                    `ends ${parseDay(nextMs.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
                    msProgress.total > 0 && `${msProgress.done} of ${msProgress.total} tasks done`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {msProgress.total > 0 && (
                  <span className="ms-bar">
                    <span style={{ width: `${Math.round(msProgress.pct * 100)}%` }} />
                  </span>
                )}
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
