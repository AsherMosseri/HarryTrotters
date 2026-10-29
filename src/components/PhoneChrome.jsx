import { useEffect, useRef } from 'react';
import { CloseIcon, Overlay } from './common.jsx';
import { Icon } from './shell/icons.jsx';

// Phone layout pieces: the bottom tab bar, and sheets that slide up from the bottom.
export const PHONE_MAIN_COUNT = 4;
export const TAB_ICONS = {
  today: 'today',
  board: 'tasks',
  table: 'table',
  chat: 'chat',
  shifts: 'shifts',
  milestones: 'milestones',
  parts: 'parts',
  checklists: 'checklists',
  runs: 'runs',
  robot: 'robot',
  resources: 'resources',
  team: 'team',
};
// The tab bar's names where the page has a plainer one.
const TAB_LABELS = { board: 'Tasks', team: 'Roster', runs: 'Match log' };
const tabLabel = (id, label) => TAB_LABELS[id] || label;

export function Sheet({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const dragged = useRef(false);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  // Swipe down to close, like an iPhone sheet: drag the grip or the title
  // row, or pull down anywhere while the sheet is scrolled to the top.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start = null; // { x, y, grip }
    let dy = 0;
    let dragging = false;
    let last = null; // { y, at }: for the speed at release
    let speed = 0; // px/ms, downward
    const down = (e) => {
      start = null;
      if (e.touches.length !== 1) return;
      const grip = !!e.target.closest('.sheet-top');
      if (!grip && (el.scrollTop > 0 || e.target.closest('input, textarea, select, [contenteditable]'))) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, grip };
      dy = 0;
      dragging = false;
      last = { y: start.y, at: Date.now() };
      speed = 0;
    };
    const move = (e) => {
      if (!start) return;
      const d = e.touches[0].clientY - start.y;
      if (!dragging) {
        const dx = Math.abs(e.touches[0].clientX - start.x);
        // Sideways or upward (scrolling the sheet): not a close.
        if (dx > Math.abs(d) || (d < -6 && !start.grip)) return void (start = null);
        if (d < 8) return;
        dragging = true;
        dragged.current = true;
        el.style.transition = 'none';
      }
      e.preventDefault();
      const now = Date.now();
      speed = 0.6 * ((e.touches[0].clientY - last.y) / Math.max(1, now - last.at)) + 0.4 * speed;
      last = { y: e.touches[0].clientY, at: now };
      dy = Math.max(0, d);
      el.style.transform = `translateY(${dy}px)`;
    };
    const up = () => {
      if (!start) return;
      // A flick: still moving down quickly when let go.
      const fast = speed > 0.4 && Date.now() - last.at < 120;
      start = null;
      if (!dragging) return;
      dragging = false;
      setTimeout(() => (dragged.current = false), 50);
      if (dy > Math.min(140, el.offsetHeight * 0.25) || (fast && dy > 30)) {
        el.style.transition = 'transform 0.18s ease-in';
        el.style.transform = `translateY(${el.offsetHeight + 20}px)`;
        setTimeout(() => close.current(), 170);
      } else {
        el.style.transition = 'transform 0.2s ease';
        el.style.transform = '';
      }
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, []);
  return (
    <Overlay>
      <div className="panel-backdrop sheet-backdrop" onClick={onClose}>
        <div ref={ref} className={`sheet ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
          <div className="sheet-top">
            <button className="sheet-grip-btn" aria-label="Close" onClick={() => !dragged.current && onClose()}>
              <span className="sheet-grip" />
            </button>
            <div className="sheet-head">
              <h2>{title}</h2>
              <span className="spacer" />
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
          </div>
          <div className="sheet-body">{children}</div>
        </div>
      </div>
    </Overlay>
  );
}

export function BottomNav({ views, view, setView, badges = {}, onMore, moreOn }) {
  // Your first four tabs (Edit tabs sets the order); the rest are under More.
  // Five or fewer all fit, so there's no More then.
  const main = views.length <= PHONE_MAIN_COUNT + 1 ? views : views.slice(0, PHONE_MAIN_COUNT);
  const inMore = !main.some(([id]) => id === view);
  return (
    <nav className="bottom-nav" aria-label="Tabs">
      {main.map(([id, label]) => (
        <button key={id} className={view === id ? 'on' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
          <span className="bn-icon" aria-hidden="true">
            <Icon name={TAB_ICONS[id]} size={24} />
            {badges[id] ? <span className="bn-badge">{badges[id] > 99 ? '99+' : badges[id]}</span> : null}
          </span>
          <span className="bn-label">{tabLabel(id, label)}</span>
        </button>
      ))}
      {main.length < views.length && (
        <button className={inMore || moreOn ? 'on' : ''} onClick={onMore}>
          <span className="bn-icon" aria-hidden="true">
            <Icon name="more" size={24} />
          </span>
          <span className="bn-label">More</span>
        </button>
      )}
    </nav>
  );
}

export function MoreSheet({ views, view, setView, onClose }) {
  return (
    <Sheet title="More" onClose={onClose}>
      <div className="more-list">
        {views.slice(PHONE_MAIN_COUNT).map(([id, label]) => (
          <button
            key={id}
            className={`more-row${view === id ? ' on' : ''}`}
            onClick={() => {
              setView(id);
              onClose();
            }}
          >
            <Icon name={TAB_ICONS[id]} size={22} />
            <span className="grow">{tabLabel(id, label)}</span>
            <Icon name="chevron" size={16} className="more-chev" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
