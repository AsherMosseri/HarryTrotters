import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { Avatar } from '../common.jsx';
import { TEAM_NAME, TEAM_NICKNAME } from '../../config.js';
import horse from '../../assets/horse.webp';

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

// How many recent DMs the sidebar lists before "Show all" (unread ones and
// the one on screen always show).
const DMS_SHOWN = 8;

// The folded sidebar's chat button: every channel and DM in a small list
// beside it, so you can switch conversations without unfolding.
function ConvPop({ anchor, convs, currentConv, page, unread, actor, dmsOn, onOpenConv, onNewDm, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && !anchor.el.contains(e.target) && onClose();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [anchor, onClose]);
  // Opens down from the button in the top half of the screen, up from it lower down.
  const r = anchor.el.getBoundingClientRect();
  const h = window.innerHeight;
  const place = r.top < h / 2 ? { top: r.top - 4, maxHeight: h - r.top - 8 } : { bottom: h - r.bottom - 4, maxHeight: r.bottom - 8 };
  const row = (c, icon, label, n, strong) => (
    <button
      key={c.key}
      className={`cp-row${page === 'chat' && currentConv?.key === c.key ? ' on' : ''}${strong ? ' strong' : ''}`}
      onClick={() => {
        onOpenConv(c.key);
        onClose();
      }}
    >
      {icon}
      <span className="sb-label">{label}</span>
      {n > 0 && <span className={`cp-count${strong ? ' strong' : ''}`}>{n > 99 ? '99+' : n}</span>}
    </button>
  );
  return (
    <div ref={ref} className="sb-conv-pop" role="dialog" aria-label="Conversations" style={{ left: r.right + 8, ...place }}>
      <h3 className="cp-head">Channels</h3>
      {convs.channels.map((c) => {
        const u = unread[c.key];
        return row(c, <Icon name={c.announce ? 'announce' : 'hash'} />, c.name, u && !u.muted ? u.count : u?.mentions || 0, !!u?.mentions);
      })}
      {dmsOn && (
        <>
          <div className="cp-head-row">
            <h3 className="cp-head">Messages</h3>
            <button
              className="sb-add"
              onClick={() => {
                onNewDm();
                onClose();
              }}
              aria-label="New message"
              title="New message"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
          {convs.dms.map((c) => {
            const others = c.people.filter((n) => n !== actor.name);
            const n = unread[c.key]?.count || 0;
            return row(c, others.length === 1 ? <Avatar name={others[0]} size={24} /> : <Icon name="team" />, c.short, n, n > 0);
          })}
          {!convs.dms.length && <p className="sb-hint">No messages yet.</p>}
        </>
      )}
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
  const [allDms, setAllDms] = useState(false);
  const dmOn = (c) => page === 'chat' && currentConv?.key === c.key;
  const dms = allDms ? convs.dms : convs.dms.filter((c, i) => i < DMS_SHOWN || unread[c.key]?.count > 0 || dmOn(c));
  const [teamDmsOpen, setTeamDmsOpen] = useState(false);
  const [convPop, setConvPop] = useState(null); // { el }: the rail's chat button
  // Keep the page or conversation on screen visible in the list (say, after
  // opening a channel from a notification).
  const navRef = useRef(null);
  useEffect(() => {
    navRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [page, currentConv?.key, rail]);
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
        <nav className="sb-scroll" aria-label="Pages" ref={navRef}>
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
              className={`sb-rail-btn${page === 'chat' ? ' active' : ''}${convPop ? ' open' : ''}`}
              onClick={(e) => setConvPop(convPop ? null : { el: e.currentTarget })}
              aria-label="Chat"
              aria-expanded={!!convPop}
              title="Chat"
            >
              <Icon name="chat" size={20} />
              {chatCount > 0 && <span className="sb-rail-badge">{chatCount > 99 ? '99+' : chatCount}</span>}
            </button>
          )}
        </nav>
        {convPop && (
          <ConvPop
            anchor={convPop}
            convs={convs}
            currentConv={currentConv}
            page={page}
            unread={unread}
            actor={actor}
            dmsOn={dmsOn}
            onOpenConv={onOpenConv}
            onNewDm={onNewDm}
            onClose={() => setConvPop(null)}
          />
        )}
        <div className="sb-foot">{me}</div>
      </aside>
    );
  }
  return (
    <aside className="sidebar">
      <div className="sb-top">
        <button className="sb-team" onClick={onLogo}>
          {/* The Stallion Robotics horse, until the Harry Trotters logo is ready. */}
          <img className="sb-logo" src={horse} alt="" aria-hidden="true" />
          <span className="sb-team-name">
            <b>{TEAM_NICKNAME}</b>
            <small>{TEAM_NAME}</small>
          </span>
        </button>
        <span className="sb-top-tools">{topRight}</span>
      </div>
      {/* Under the top band, so the band stays the chat header's height and
          their dividing lines meet. */}
      {shiftRow && <div className="sb-shift-row">{shiftRow}</div>}
      <nav className="sb-scroll" aria-label="Pages" ref={navRef}>
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
                      icon={others.length === 1 ? <Avatar name={others[0]} size={24} showOnline /> : <Icon name="team" />}
                      label={c.short}
                      active={dmOn(c)}
                      count={u?.count || 0}
                      strong={u?.count > 0}
                      onClick={() => onOpenConv(c.key)}
                    />
                  );
                })}
                {!dms.length && <p className="sb-hint">No messages yet.</p>}
                {(allDms ? convs.dms.length > DMS_SHOWN : dms.length < convs.dms.length) && (
                  <button className="sb-more" onClick={() => setAllDms(!allDms)} aria-expanded={allDms}>
                    {allDms ? 'Show fewer' : `Show all ${convs.dms.length}`}
                  </button>
                )}
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
