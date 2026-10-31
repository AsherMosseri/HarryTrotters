import { promptDialog } from '../Dialogs.jsx';
import { parseDay } from '../../milestones.js';

// "Before the event" on Today (D4): plain lines with counts, each one a link
// to the page that fixes it. Hidden when everything is done (Today says
// "Ready." in the top band instead) and from the event day on.
function Row({ tone, label, sub, n, of, onClick, children }) {
  return (
    <li>
      <button className={`rd-row ${tone}`} onClick={onClick}>
        <span className="rd-dot" aria-hidden="true" />
        <span className="rd-main">
          <span className="rd-label">{label}</span>
          {sub && <span className="rd-sub">{sub}</span>}
        </span>
        <span className="rd-n mono">
          {n}
          {of != null && <small> / {of}</small>}
        </span>
      </button>
      {children}
    </li>
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function Readiness({ r, on, eventDate, isManager, api, onShowTasks, onShowParts, onPage, onOpenTask }) {
  const dateLabel = parseDay(eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const setGoal = async () => {
    const v = await promptDialog({
      title: 'Practice score goal',
      body: 'The total you want the robot to hit in practice before the event.',
      label: 'Goal (points)',
      initial: r.goal ? String(r.goal) : '',
      okLabel: 'Save',
      maxLength: 4,
    });
    if (v == null) return;
    api.saveSettings({ runGoal: Math.max(0, parseInt(v, 10) || 0) });
  };
  const rows = [];
  if (on.includes('tasks')) {
    rows.push(
      <Row
        key="due"
        tone={r.due.overdue ? 'bad' : r.due.n ? 'warn' : 'good'}
        label="Tasks due before the event"
        sub={r.due.overdue ? `${r.due.overdue} overdue` : r.due.n ? `Due before ${dateLabel}` : ''}
        n={r.due.n}
        onClick={() => onShowTasks({ hideDone: true, dueBefore: eventDate })}
      />,
      <Row
        key="blocked"
        tone={r.blocked.length ? 'bad' : 'good'}
        label="Blocked tasks"
        n={r.blocked.length}
        onClick={() => onShowTasks({ hideDone: true, statuses: ['blocked'] }, 'table')}
      >
        {r.blocked.length > 0 && (
          <ul className="rd-blocked" aria-label="Blocked tasks">
            {r.blocked.slice(0, 3).map((t) => (
              <li key={t.id}>
                <button className="rd-task" onClick={() => onOpenTask(t.id)}>
                  <span className="rd-task-title">{t.title || 'Untitled'}</span>
                  <span className="rd-task-why">{t.blockedReason || 'No reason written'}</span>
                </button>
              </li>
            ))}
            {r.blocked.length > 3 && (
              <li>
                <button className="text-btn more" onClick={() => onShowTasks({ hideDone: true, statuses: ['blocked'] }, 'table')}>
                  {r.blocked.length - 3} more
                </button>
              </li>
            )}
          </ul>
        )}
      </Row>,
    );
  }
  if (on.includes('parts'))
    rows.push(
      <Row
        key="parts"
        tone={r.parts.n ? 'warn' : 'good'}
        label="Parts not here yet"
        sub={r.parts.n ? [r.parts.needed && `${r.parts.needed} to order`, r.parts.ordered && `${r.parts.ordered} ordered`].filter(Boolean).join(' · ') : ''}
        n={r.parts.n}
        onClick={() => onShowParts('pending')}
      />,
    );
  if (on.includes('checklists')) {
    if (r.listsLeft.length)
      for (const l of r.listsLeft)
        rows.push(<Row key={l.id} tone="warn" label={l.title} sub={`${plural(l.left, 'item', 'items')} left`} n={l.total - l.left} of={l.total} onClick={() => onPage('checklists')} />);
    else if (r.lists.length) rows.push(<Row key="lists" tone="good" label="Inspection and packing lists" sub="All ticked" n={r.lists.length} of={r.lists.length} onClick={() => onPage('checklists')} />);
  }
  if (on.includes('runs') && r.practice)
    rows.push(
      <Row
        key="practice"
        tone={!r.goal ? 'calm' : r.practice.met ? 'good' : 'warn'}
        label="Last practice run"
        sub={r.goal ? `Goal ${r.goal}${r.practice.met ? ', reached' : `, ${r.goal - r.practice.total} to go`}` : 'No goal set'}
        n={r.practice.total}
        of={r.goal || null}
        onClick={() => onPage('runs')}
      />,
    );

  return (
    <section className="today-sec rd-card" aria-label="Before the event">
      <div className="sec-head">
        <h2>Before the event</h2>
        {isManager && api && on.includes('runs') && (
          <button className="text-btn" onClick={setGoal}>
            {r.goal ? 'Change goal' : 'Set a score goal'}
          </button>
        )}
      </div>
      <ul className="rd-list">{rows}</ul>
    </section>
  );
}
