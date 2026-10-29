import { useState } from 'react';
import { Icon } from './icons.jsx';
import { Avatar } from '../common.jsx';
import { TEAM_NAME, TEAM_NICKNAME } from '../../config.js';

// The app's left side on iPads and computers (phones keep the bottom tab bar):
// the team, then every page in a few groups, with chat channels listed right
// in it. Pages switched off in Controls aren't passed in, so they don't show.
const GROUPS = [
  [null, ['today', 'tasks', 'milestones', 'shifts']],
  ['Build', ['parts', 'robot', 'checklists', 'runs']],
  ['Team', ['team', 'resources']],
];
const LABELS = {
  today: 'Today',
  tasks: 'Tasks',
  milestones: 'Milestones',
  shifts: 'Shifts',
  parts: 'Parts',
  robot: 'Robot',
  checklists: 'Checklists',
  runs: 'Match log',
  team: 'Roster',
  resources: 'Resources',
};

function Row({ icon, label, active, count, strong, onClick, extra }) {
  return (
    <div className={`sb-row-wrap${active ? ' active' : ''}`}>
      <button
        className={`sb-row${active ? ' active' : ''}${strong ? ' strong' : ''}`}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        <span className="sb-label">{label}</span>
        {count > 0 && <span className={`sb-count${strong ? ' strong' : ''}`}>{count > 99 ? '99+' : count}</span>}
      </button>
      {extra}
    </div>
  );
}

export default function Sidebar({
  on, // page ids that are switched on
  page, // the page on screen: a page id, or 'chat'
  setPage,
  convs,
  currentConv,
  unread,
  onOpenConv,
  onNewDm,
  onChatAsk, // managers: new channel, channel settings
  isManager,
  myOpen,
  actor,
  dmsOn,
  topRight,
  shiftRow, // while you're on a shift: the timer, on its own row under the team name
  me,
  onLogo,
  rail, // folded to a narrow strip of icons (more room for the page)
  onToggleRail,
}) {
  const show = (id) => on.includes(id);
  const chatOn = show('chat');
  const dms = convs.dms.slice(0, 8);
  const [teamDmsOpen, setTeamDmsOpen] = useState(false);
  if (rail) {
    const chatCount = Object.values(unread).reduce((n, u) => n + (u.muted ? u.mentions : u.count), 0);
    const pages = GROUPS.flatMap(([, ids]) => ids).filter(show);
    return (
      <aside className="sidebar rail">
        <div className="sb-top">
          <button className="sb-fold" onClick={onToggleRail} aria-label="Show the sidebar" title="Show the sidebar">
            <Icon name="sidebar" size={20} />
          </button>
        </div>
        <div className="sb-rail-tools">
          {shiftRow}
          {topRight}
        </div>
        <nav className="sb-scroll" aria-label="Pages">
          {pages.map((id) => (
            <button
              key={id}
              className={`sb-rail-btn${page === id ? ' active' : ''}`}
              onClick={() => setPage(id)}
              aria-label={LABELS[id]}
              title={LABELS[id]}
            >
              <Icon name={id} size={20} />
            </button>
          ))}
          {chatOn && currentConv && (
            <button
              className={`sb-rail-btn${page === 'chat' ? ' active' : ''}`}
              onClick={() => onOpenConv(currentConv.key)}
              aria-label="Chat"
              title="Chat"
            >
              <Icon name="chat" size={20} />
              {chatCount > 0 && <span className="sb-rail-badge">{chatCount > 99 ? '99+' : chatCount}</span>}
            </button>
          )}
        </nav>
        <div className="sb-foot">{me}</div>
      </aside>
    );
  }
  return (
    <aside className="sidebar">
      <div className="sb-top">
        <button className="sb-team" onClick={onLogo}>
          <span className="sb-mark" aria-hidden="true">
            HT
          </span>
          <span className="sb-team-name">
            <b>{TEAM_NICKNAME}</b>
            <small>{TEAM_NAME}</small>
          </span>
        </button>
        <span className="sb-top-tools">{topRight}</span>
        {shiftRow && <div className="sb-shift-row">{shiftRow}</div>}
      </div>
      <nav className="sb-scroll" aria-label="Pages">
        {GROUPS.map(([title, ids]) => {
          const shown = ids.filter(show);
          if (!shown.length) return null;
          return (
            <div key={ids[0]} className="sb-group">
              {title && <h3 className="sb-head">{title}</h3>}
              {shown.map((id) => (
                <Row
                  key={id}
                  icon={<Icon name={id} />}
                  label={LABELS[id]}
                  active={page === id}
                  count={id === 'tasks' ? myOpen : 0}
                  onClick={() => setPage(id)}
                />
              ))}
            </div>
          );
        })}
        {chatOn && (
          <div className="sb-group">
            <div className="sb-head-row">
              <h3 className="sb-head">Channels</h3>
              {isManager && (
                <button className="sb-add" onClick={() => onChatAsk({ type: 'channel' })} aria-label="New channel" title="New channel">
                  <Icon name="plus" size={16} />
                </button>
              )}
            </div>
            {convs.channels.map((c) => {
              const u = unread[c.key];
              return (
                <Row
                  key={c.key}
                  icon={<Icon name={c.announce ? 'announce' : 'hash'} />}
                  label={c.name}
                  active={page === 'chat' && currentConv?.key === c.key}
                  count={u && !u.muted ? u.count : u?.mentions || 0}
                  strong={!!u?.mentions}
                  onClick={() => onOpenConv(c.key)}
                  extra={
                    isManager && (
                      <button
                        className="sb-gear"
                        onClick={() => onChatAsk({ type: 'channel', channel: c })}
                        aria-label={`#${c.name} settings`}
                        title={`#${c.name} settings`}
                      >
                        <Icon name="more" size={16} />
                      </button>
                    )
                  }
                />
              );
            })}
            {dmsOn && (
              <>
                <div className="sb-head-row">
                  <h3 className="sb-head">Messages</h3>
                  <button className="sb-add" onClick={onNewDm} aria-label="New message" title="New message">
                    <Icon name="plus" size={16} />
                  </button>
                </div>
                {dms.map((c) => {
                  const others = c.people.filter((n) => n !== actor.name);
                  const u = unread[c.key];
                  return (
                    <Row
                      key={c.key}
                      icon={others.length === 1 ? <Avatar name={others[0]} size={20} showOnline /> : <Icon name="team" />}
                      label={c.short}
                      active={page === 'chat' && currentConv?.key === c.key}
                      count={u?.count || 0}
                      strong={u?.count > 0}
                      onClick={() => onOpenConv(c.key)}
                    />
                  );
                })}
                {!dms.length && <p className="sb-hint">No messages yet.</p>}
              </>
            )}
            {isManager && convs.teamDms.length > 0 && (
              <>
                <button className="sb-head-row sb-toggle" onClick={() => setTeamDmsOpen(!teamDmsOpen)} aria-expanded={teamDmsOpen}>
                  <h3 className="sb-head">Team messages</h3>
                  <Icon name="chevron" size={14} className={teamDmsOpen ? 'turned' : ''} />
                </button>
                {teamDmsOpen &&
                  convs.teamDms.map((c) => (
                    <Row
                      key={c.key}
                      icon={<Icon name="lock" />}
                      label={c.short}
                      active={page === 'chat' && currentConv?.key === c.key}
                      onClick={() => onOpenConv(c.key)}
                    />
                  ))}
              </>
            )}
          </div>
        )}
      </nav>
      <div className="sb-foot">
        {me}
        <button className="sb-fold" onClick={onToggleRail} aria-label="Fold the sidebar" title="Fold the sidebar">
          <Icon name="sidebar" size={18} />
        </button>
      </div>
    </aside>
  );
}
