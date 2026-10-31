import { Avatar, usePeople } from '../common.jsx';
import robot from '../../assets/robot-dance.webp';
import { Icon } from './icons.jsx';
import { STATUSES } from '../../config.js';
import { dueInfo } from '../../util.js';
import { daysBetween, milestoneProgress, parseDay, todayISO } from '../../milestones.js';
import { useLocalStorage } from '../../util.js';
import { teamDay } from '../../../functions/shared/coins.js';
import { competitionOn } from '../../../functions/shared/matches.js';
import PitScreen from './PitScreen.jsx';
import { hoursOf } from '../../../functions/shared/hours.js';
import { seasonStats } from '../../../functions/shared/stats.js';

// The first page, like a pit board: the countdown and the robot up top with a
// few plain lines on what needs you, then your tasks, what's due, who's at the
// lab, unread chat and the next milestone.
const statusOf = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
const RANK = { blocked: 0, in_progress: 1, testing: 2, todo: 3, backlog: 4 };

const first = (name = '') => name.split(' ')[0];
// "Cooper", "Cooper and Sophia", "Cooper and 2 others"
function namesLine(names) {
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]} and ${names.length - 1} others`;
}
const sinceLabel = (ms) => {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
};
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
        {due && <span className={`t-due mono ${due.tone}`}>{due.label}</span>}
      </button>
    </li>
  );
}

export default function Today({
  actor,
  tasks,
  milestones,
  competition,
  settings = {},
  matches = [],
  checklists = [],
  roster = [],
  api,
  shifts,
  runs = [],
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
  onEditProfile,
}) {
  const people = usePeople();
  const today = todayISO();
  // Competition mode (on the competition day, team time, or switched on by
  // team management) turns this page into the pit screen. Anyone can step
  // back to the usual page on their own device for the rest of the day.
  const compOn = competitionOn(settings.compMode, teamDay(Date.now()), competition.date);
  const [usualOn, setUsualOn] = useLocalStorage('pit-usual-day', '');
  const usual = usualOn === teamDay(Date.now());
  if (compOn && !usual)
    return (
      <PitScreen
        actor={actor}
        settings={settings}
        matches={matches}
        checklists={checklists}
        roster={roster}
        competition={competition}
        api={api}
        onPerson={onPerson}
        onUsual={() => setUsualOn(teamDay(Date.now()))}
      />
    );
  return (
    <UsualToday
      {...{ actor, tasks, milestones, competition, shifts, runs, myShift, convs, unread, chat, on, onOpenTask, onOpenConv, onPage, onNewTask }}
      {...{ onStartShift, onOpenShift, onPerson, onEditProfile, people, today }}
      pitButton={
        compOn ? (
          <button className="pit-btn on" onClick={() => setUsualOn('')}>
            <Icon name="trophy" size={16} /> Pit screen
          </button>
        ) : actor.admin && api ? (
          <button className="pit-btn on" onClick={() => api.saveSettings({ compMode: 'on' })}>
            <Icon name="trophy" size={16} /> Competition mode
          </button>
        ) : null
      }
    />
  );
}

function UsualToday({
  actor,
  tasks,
  milestones,
  competition,
  shifts,
  runs = [],
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
  onEditProfile,
  people,
  today,
  pitButton,
}) {
  const all = tasks || [];
  const mine = all
    .filter((t) => t.status !== 'done' && (t.assignees || []).includes(actor.name))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9));
  const overdue = mine.filter((t) => t.dueDate && t.dueDate < today).length;
  const soon = all
    .filter((t) => t.status !== 'done' && t.dueDate && daysBetween(today, t.dueDate) >= 0 && daysBetween(today, t.dueDate) <= 7 && !(t.assignees || []).includes(actor.name))
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

  // The board's lines: short notes in plain words, each one tappable.
  const firstOverdue = mine.find((t) => t.dueDate && t.dueDate < today);
  const others = atLab.filter((s) => s.person !== actor.name).map((s) => first(s.person));
  const unreadCount = waiting.reduce((n, w) => n + (w.u.count || 0), 0);
  const lines = [
    on.includes('tasks') &&
      (overdue === 1
        ? { tone: 'bad', text: `${firstOverdue.title || 'A task'} is overdue`, go: () => onOpenTask(firstOverdue.id) }
        : overdue > 1
          ? { tone: 'bad', text: `${overdue} of your tasks are overdue`, go: () => onOpenTask(firstOverdue.id) }
          : mine.length
            ? { tone: 'warn', text: `Next up: ${mine[0].title || 'Untitled'}`, go: () => onOpenTask(mine[0].id) }
            : { tone: 'calm', text: 'Nothing on your plate', go: () => onPage('tasks') }),
    on.includes('shifts') && {
      tone: atLab.length ? 'good' : 'calm',
      text: others.length
        ? `${namesLine(others)} ${others.length === 1 ? 'is' : 'are'} at the lab${myShift ? ' with you' : ''}`
        : myShift
          ? 'Just you at the lab'
          : 'Nobody’s at the lab',
      go: () => onPage('shifts'),
    },
    on.includes('chat') &&
      unreadCount > 0 && {
        tone: waiting.some((w) => w.u.mentions) ? 'warn' : 'calm',
        text: `${unreadCount} unread in ${waiting.length === 1 ? (waiting[0].c.kind === 'dm' ? first(waiting[0].c.short) + '’s DM' : `#${waiting[0].c.name}`) : `${waiting.length} chats`}`,
        go: () => onOpenConv(waiting[0].c.key),
      },
  ].filter(Boolean);
  const noPhoto = people && !people.photoOf(actor.name);
  // The team's week, small, under the board (the full strip is on Shifts).
  const stats = seasonStats({ shifts, tasks: all, runs });
  const weekHours = hoursOf(stats.hours.week);
  const hourDiff = Math.round((weekHours - hoursOf(stats.hours.last)) * 10) / 10;

  return (
    <main className="content today">
      <header className="pit">
        <div className="pit-main">
          <p className="pit-date">
            {parseDay(today).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            <span> · {first(actor.name)}</span>
          </p>
          {left >= 0 ? (
            <div className="pit-count">
              <span className="pit-num">{left === 0 ? '0' : left}</span>
              <span className="pit-num-label">
                {left === 0 ? `${competition.name} is today` : `${left === 1 ? 'day' : 'days'} to ${competition.name}`}
                <small>{parseDay(competition.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</small>
              </span>
            </div>
          ) : (
            <h1 className="pit-title">Harry Trotters</h1>
          )}
          <ul className="pit-lines">
            {lines.map((l) => (
              <li key={l.text}>
                <button className={`pit-line ${l.tone}`} onClick={l.go}>
                  <span className="pit-dot" aria-hidden="true" />
                  {l.text}
                </button>
              </li>
            ))}
          </ul>
          {(on.includes('shifts') || pitButton) && (
            <div className="pit-actions">
              {!on.includes('shifts') ? null : myShift ? (
                <button className="pit-btn on" onClick={onOpenShift}>
                  <Icon name="shifts" size={16} /> On shift <span className="mono">{sinceLabel(myShift.start)}</span>
                </button>
              ) : (
                <button className="pit-btn" onClick={() => onStartShift()}>
                  <Icon name="shifts" size={16} /> Start a shift
                </button>
              )}
              {pitButton}
            </div>
          )}
          {on.includes('shifts') && (
            <button className="pit-stats" onClick={() => onPage('shifts')} title="Team this week, against last week">
              <span>
                Team this week <b className="mono">{weekHours.toFixed(1)} h</b>
                {hourDiff !== 0 && (
                  <span className={hourDiff > 0 ? 'ss-up' : 'ss-down'}>
                    {' '}
                    {hourDiff > 0 ? 'up' : 'down'} <span className="mono">{Math.abs(hourDiff)}</span>
                  </span>
                )}
              </span>
              <span>
                <b className="mono">{stats.tasks.week}</b> {stats.tasks.week === 1 ? 'task' : 'tasks'} done
              </span>
              <span>
                <b className="mono">{stats.runs.week}</b> practice {stats.runs.week === 1 ? 'run' : 'runs'}
              </span>
            </button>
          )}
        </div>
        <img className="pit-robot" src={robot} alt="" aria-hidden="true" />
      </header>

      {noPhoto && (
        <button className="photo-nudge" onClick={onEditProfile}>
          <Avatar name={actor.name} size={32} />
          <span className="grow">
            <b>Add your photo.</b> Right now your initials stand in for your face everywhere.
          </span>
          <span className="photo-nudge-go">Add photo</span>
        </button>
      )}

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
          {on.includes('shifts') && (
            <section className="today-sec">
              <div className="sec-head">
                <h2>At the lab</h2>
                <button className="text-btn" onClick={() => onPage('shifts')}>
                  Shifts
                </button>
              </div>
              {atLab.length ? (
                <ul className="p-list">
                  {atLab.map((s) => (
                    <li key={s.id}>
                      <button className="p-row" onClick={() => onPerson(s.person)}>
                        <Avatar name={s.person} size={26} showOnline />
                        <span className="grow">{s.person}</span>
                        <span className="p-since mono">{timeOf(s.start)}</span>
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
