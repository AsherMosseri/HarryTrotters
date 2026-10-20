import { useEffect, useRef, useState } from 'react';
import { relTime } from '../util.js';
import { isIOS } from '../data/push.js';

const ICONS = { announcement: '📣', mention: '@', assigned: '📋', due: '⏰' };

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// What this device's phone-notification setting looks like in the bell menu.
function PushRow({ status, busy, onEnable, onDisable }) {
  const device = isIOS() ? (navigator.userAgent.includes('iPhone') ? 'iPhone' : 'iPad') : 'device';
  switch (status) {
    case 'on':
      return (
        <div className="push-row on">
          <span>Phone notifications are on for this {device}.</span>
          <button className="link-btn" onClick={onDisable} disabled={busy}>
            Turn off
          </button>
        </div>
      );
    case 'off':
      return (
        <div className="push-row">
          <span>Get these on this {device} even when the site is closed.</span>
          <button className="btn primary" onClick={onEnable} disabled={busy}>
            {busy ? 'Turning on…' : 'Turn on'}
          </button>
        </div>
      );
    case 'blocked':
      return (
        <div className="push-row">
          <span>
            Notifications are blocked for this site.{' '}
            {isIOS() ? 'Turn them on in Settings → Notifications → FTC 32313.' : 'Allow them in your browser’s site settings.'}
          </span>
        </div>
      );
    case 'home-screen':
      return (
        <div className="push-row">
          <span>
            To get notifications on your {device}: tap Share → <b>Add to Home Screen</b>, open the app from your Home Screen, then turn them
            on here.
          </span>
        </div>
      );
    case 'demo':
      return (
        <div className="push-row">
          <span>Phone notifications work on the real board.</span>
        </div>
      );
    default:
      return (
        <div className="push-row">
          <span>This browser can’t show notifications. You’ll still see them here.</span>
        </div>
      );
  }
}

export default function Inbox({ items, pushStatus, onEnablePush, onDisablePush, onOpen, onMarkRead, onClear }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const unread = items.filter((n) => !n.read);

  useEffect(() => {
    if (!open) return;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const run = (fn) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inbox" ref={box}>
      <button
        className={`icon-btn bell${open ? ' active' : ''}`}
        title="Notifications"
        aria-label={unread.length ? `Notifications, ${unread.length} new` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <BellIcon />
        {unread.length > 0 && <span className="bell-badge">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="inbox-pop" role="dialog" aria-label="Notifications">
          <div className="inbox-head">
            <h2>Notifications</h2>
            <span className="spacer" />
            {unread.length > 0 && (
              <button className="link-btn" onClick={() => onMarkRead(unread.map((n) => n.id))}>
                Mark all read
              </button>
            )}
            {unread.length === 0 && items.length > 0 && (
              <button className="link-btn" onClick={() => onClear(items.map((n) => n.id))}>
                Clear all
              </button>
            )}
          </div>
          <PushRow status={pushStatus} busy={busy} onEnable={run(onEnablePush)} onDisable={run(onDisablePush)} />
          <ul className="inbox-list">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  className={`inbox-item${n.read ? '' : ' unread'}`}
                  onClick={() => {
                    if (!n.read) onMarkRead([n.id]);
                    setOpen(false);
                    onOpen(n.open);
                  }}
                >
                  <span className={`inbox-icon ${n.type}`} aria-hidden="true">
                    {ICONS[n.type] || '🔔'}
                  </span>
                  <span className="inbox-text">
                    <b>{n.title}</b>
                    {n.body && <span className="inbox-body">{n.body}</span>}
                    <span className="inbox-time">{relTime(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
            {!items.length && (
              <li className="inbox-empty">
                Nothing yet. Announcements, @mentions, tasks given to you, and due-tomorrow reminders show up here.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
