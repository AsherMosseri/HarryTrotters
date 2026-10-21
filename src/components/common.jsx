import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { STATUSES, PRIORITIES, statusById, priorityById } from '../config.js';
import { colorFor, initials, dueInfo } from '../util.js';
import { decorationById, nameStyle } from '../nitro.js';
import { CustomDecoration } from './decoRender.jsx';

// Profiles, who's online, and each person's subteams, for any component that
// shows people (set up in Workspace; empty on the join screen).
export const PeopleContext = createContext(null);
export const usePeople = () => useContext(PeopleContext);

// A profile picture (GIFs stay animated), or colored initials, with the
// person's avatar decoration. showOnline adds a green dot when the person has
// the app open.
export function Avatar({ name, size = 26, photo, showOnline = false, decoration, decorationCustom }) {
  const people = usePeople();
  const src = photo || people?.photoOf(name);
  const deco = decoration ?? people?.profileOf(name)?.decoration ?? '';
  let pic = src ? (
    <img className="avatar" src={src} alt={name} title={name} style={{ width: size, height: size }} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" title={name} style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
  const custom = deco === 'custom' ? (decorationCustom ?? people?.profileOf(name)?.decorationCustom) : null;
  if (custom) {
    pic = (
      <CustomDecoration size={size} custom={custom}>
        {pic}
      </CustomDecoration>
    );
  } else if (deco && deco !== 'custom' && decorationById[deco]) {
    const badge = size >= 28 && decorationById[deco].badge;
    pic = (
      <span className={`deco deco-${deco}`} style={{ width: size, height: size, '--s': `${size}px` }}>
        {pic}
        {badge && <span className="deco-badge">{badge}</span>}
      </span>
    );
  }
  if (!showOnline) return pic;
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {pic}
      {people?.isOnline(name) && (
        <span className="online-dot" style={{ width: Math.max(8, size * 0.3), height: Math.max(8, size * 0.3) }} />
      )}
    </span>
  );
}

// A person's name in their chosen style (font, color, gradient), else their
// subteam color.
export function DisplayName({ name, className = '', as: Tag = 'span', ...rest }) {
  const people = usePeople();
  return (
    <Tag className={`display-name ${className}`} style={nameStyle(people?.profileOf(name), people?.infoOf(name)?.color)} {...rest}>
      {name}
    </Tag>
  );
}

export function AvatarStack({ names = [], max = 3, size = 24 }) {
  if (!names.length) return <span className="muted small">Unassigned</span>;
  const shown = names.slice(0, max);
  return (
    <span className="avatar-stack" title={names.join(', ')}>
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} />
      ))}
      {names.length > max && (
        <span className="avatar more" style={{ width: size, height: size }}>
          +{names.length - max}
        </span>
      )}
    </span>
  );
}

export function StatusDot({ status }) {
  return <span className="dot" style={{ background: statusById[status]?.color }} />;
}

export function StatusSelect({ value, onChange, compact }) {
  const s = statusById[value] || STATUSES[0];
  return (
    <label className={`status-select${compact ? ' compact' : ''}`} style={{ '--c': s.color }} onClick={(e) => e.stopPropagation()}>
      <StatusDot status={s.id} />
      <span>{compact ? s.short || s.label : s.label}</span>
      {!compact && (
        <span className="status-caret" aria-hidden="true">
          ▾
        </span>
      )}
      <select value={s.id} onChange={(e) => onChange(e.target.value)} aria-label="Status">
        {STATUSES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PriorityBadge({ value }) {
  const p = priorityById[value];
  if (!p) return null;
  return <span className={`prio prio-${p.id}`}>{p.label}</span>;
}

export function PrioritySelect({ value, onChange }) {
  const p = priorityById[value] || PRIORITIES[2];
  return (
    <label className={`prio prio-${p.id} prio-select`} onClick={(e) => e.stopPropagation()}>
      {p.label}
      <select value={p.id} onChange={(e) => onChange(e.target.value)} aria-label="Priority">
        {PRIORITIES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DueChip({ dueDate, status }) {
  const info = dueInfo(dueDate, status);
  if (!info) return null;
  return (
    <span className={`due due-${info.tone}`} title={info.title}>
      <CalendarIcon /> {info.label}
    </span>
  );
}

// Text input that edits locally and saves on blur / Enter, so live updates
// from teammates don't clobber what you're typing.
export function DraftInput({ value, onSave, multiline, className = '', placeholder, autoFocus, ...rest }) {
  const [draft, setDraft] = useState(value ?? '');
  const focused = useRef(false);
  const cancelled = useRef(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? '');
  }, [value]);

  useEffect(() => {
    if (multiline && ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [draft, multiline]);

  const commit = () => {
    const next = multiline ? draft : draft.trim();
    if (next !== (value ?? '')) onSave(next);
  };
  const props = {
    ref,
    className: `draft ${className}`,
    value: draft,
    placeholder,
    autoFocus,
    onChange: (e) => setDraft(e.target.value),
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      if (cancelled.current) cancelled.current = false;
      else commit();
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        cancelled.current = true;
        setDraft(value ?? '');
        e.currentTarget.blur();
      }
    },
    onClick: (e) => e.stopPropagation(),
    ...rest,
  };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}

export function CalendarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function CommentIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
