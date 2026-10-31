import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { SUBTEAMS, SUBTEAM_COLORS } from '../../config.js';
import { activeStatus } from '../../people.js';
import { Avatar, CloseIcon, DisplayName, Nameplate, Overlay, usePeople } from '../common.jsx';
import { renderRich } from './format.jsx';
import { timeOf } from './Message.jsx';
import { useEscape } from '../../util.js';
import { confirmDialog } from '../Dialogs.jsx';

const dateOf = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function PanelShell({ title, onClose, children }) {
  return (
    <aside className="chat-side">
      <div className="chat-side-head">
        <h3>{title}</h3>
        <span className="spacer" />
        <button className="icon-btn small" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="chat-side-body">{children}</div>
    </aside>
  );
}

// Who's in the conversation, online first, with their status.
export function MembersPanel({ names, onPerson, onClose }) {
  const people = usePeople();
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const online = sorted.filter((n) => people?.isOnline(n));
  const offline = sorted.filter((n) => !people?.isOnline(n));
  const row = (n) => {
    const status = activeStatus(people?.profileOf(n));
    return (
      <button key={n} className={`member-row${people?.isOnline(n) ? '' : ' offline'}`} onClick={(e) => onPerson(n, e)}>
        <Nameplate plate={people?.profileOf(n)?.nameplate} />
        <Avatar name={n} size={32} showOnline />
        <span className="grow">
          <DisplayName name={n} className="member-name" />
          {status && (
            <span className="member-status">
              {status.emoji} {status.text}
            </span>
          )}
        </span>
      </button>
    );
  };
  return (
    <PanelShell title="Members" onClose={onClose}>
      <h4>Online · {online.length}</h4>
      {online.map(row)}
      <h4>Offline · {offline.length}</h4>
      {offline.map(row)}
    </PanelShell>
  );
}

export function PinsPanel({ conv, api, ctx, onJump, onClose, canUnpin }) {
  const [pins, setPins] = useState(null);
  useEffect(() => api.subscribePins(conv.key, (list) => setPins(list.filter((m) => !m.deleted))), [api, conv.key]);
  const sorted = [...(pins || [])].sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
  return (
    <PanelShell title={`Pinned in ${conv.label}`} onClose={onClose}>
      {pins === null && <p className="muted small">Loading…</p>}
      {pins?.length === 0 && <p className="muted small">Nothing pinned yet. Tap a message, then the pin button to pin it here.</p>}
      {sorted.map((m) => (
        <div key={m.id} className="side-msg">
          <div className="row gap-sm">
            <Avatar name={m.by} size={22} />
            <b className="small">{m.by}</b>
            <span className="muted tiny">{dateOf(m.at)}</span>
          </div>
          <div className="side-msg-text">
            {m.poll ? `Poll: ${m.poll.question}` : renderRich(m.text, ctx) || (m.photo ? 'Photo' : m.gif ? 'GIF' : '')}
          </div>
          <div className="row gap-sm">
            <button className="link-btn small" onClick={() => onJump(m.id)}>
              Jump to it
            </button>
            {canUnpin && (
              <button className="link-btn small muted" onClick={() => api.pin(conv.key, m.id, false)}>
                Unpin
              </button>
            )}
          </div>
        </div>
      ))}
    </PanelShell>
  );
}

// Searches recent messages (the newest 300 in each conversation).
export function SearchPanel({ convs, current, api, roster, onOpen, onClose }) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [scope, setScope] = useState('all');
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.all(convs.map((c) => api.recentMessages(c.key, 300).then((ms) => ms.map((m) => ({ ...m, conv: c }))))).then((lists) => {
      if (alive) setData(lists.flat().filter((m) => !m.deleted));
    });
    return () => {
      alive = false;
    };
  }, [convs, api]);

  const results = useMemo(() => {
    if (!data || (!q.trim() && !from)) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return data
      .filter((m) => (scope === 'all' || m.conv.key === current.key) && (!from || m.by === from))
      .filter((m) => {
        const hay = `${m.text || ''} ${m.poll?.question || ''} ${m.poll?.options?.map((o) => o.text).join(' ') || ''}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => b.at - a.at)
      .slice(0, 60);
  }, [data, q, from, scope, current.key]);

  const snippet = (text) => {
    const t = (text || '').replace(/\s+/g, ' ');
    const w = q.toLowerCase().split(/\s+/).filter(Boolean)[0];
    const i = w ? t.toLowerCase().indexOf(w) : -1;
    const start = Math.max(0, i - 40);
    const part = (start ? '…' : '') + t.slice(start, start + 140) + (t.length > start + 140 ? '…' : '');
    if (!w || i < 0) return part;
    const j = part.toLowerCase().indexOf(w);
    return (
      <>
        {part.slice(0, j)}
        <mark>{part.slice(j, j + w.length)}</mark>
        {part.slice(j + w.length)}
      </>
    );
  };

  return (
    <PanelShell title="Search messages" onClose={onClose}>
      <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for words" />
      <div className="row gap-sm search-filters">
        <select className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From">
          <option value="">From anyone</option>
          {roster.map((n) => (
            <option key={n} value={n}>
              From {n}
            </option>
          ))}
        </select>
        <select className="input" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Where">
          <option value="all">Everywhere</option>
          <option value="here">In {current.label}</option>
        </select>
      </div>
      {!data && <p className="muted small">Loading messages…</p>}
      {data && (q.trim() || from) && !results.length && <p className="muted small">No messages found.</p>}
      {results.map((m) => (
        <button key={`${m.conv.key}-${m.id}`} className="side-msg search-hit" onClick={() => onOpen(m.conv.key, m.id)}>
          <div className="row gap-sm">
            <Avatar name={m.by} size={20} />
            <b className="small">{m.by}</b>
            <span className="muted tiny">
              {m.conv.label} · {dateOf(m.at)} {timeOf(m.at)}
            </span>
          </div>
          <div className="small">{m.poll ? `Poll: ${m.poll.question}` : snippet(m.text)}</div>
        </button>
      ))}
      {data && <p className="muted tiny">Searches the newest 300 messages in each channel and DM.</p>}
    </PanelShell>
  );
}

// Notification setting for one conversation.
export function NotifyMenu({ level, isDefault, onChange, onClose }) {
  const items = [
    ['all', 'All messages', 'A notification for every message'],
    ['mentions', 'Only @mentions', 'When someone @mentions you or your subteam'],
    ['none', 'Nothing', 'No notifications from here (muted)'],
  ];
  useEffect(() => {
    const away = (e) => !e.target.closest('.notify-menu, .notify-btn') && onClose();
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);
  return (
    <div className="notify-menu" role="menu">
      {items.map(([v, label, hint]) => (
        <button key={v} role="menuitemradio" aria-checked={level === v} className={level === v ? 'on' : ''} onClick={() => onChange(v)}>
          <span className="notify-check">{level === v ? '●' : '○'}</span>
          <span className="grow">
            <b>{label}</b>
            {isDefault && level === v && <span className="muted tiny"> (default)</span>}
            <span className="muted tiny block">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export const slugChannel = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

// Team management: add or edit a channel.
export function ChannelDialog({ channel, channels, onSave, onDelete, onMove, onClose }) {
  useEscape(onClose);
  const [name, setName] = useState(channel?.name || '');
  const [topic, setTopic] = useState(channel?.topic || '');
  const [subteam, setSubteam] = useState(channel?.subteam || '');
  const slug = slugChannel(name);
  const taken = channels.some((c) => c.name === slug && c.id !== channel?.id);
  const fixed = channel && ['announcements', 'general'].includes(channel.id);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form
          className="dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (slug && !taken) onSave({ name: slug, topic: topic.trim().slice(0, 120), subteam });
          }}
        >
          <div className="panel-head">
            <h2>{channel ? `#${channel.name} settings` : 'New channel'}</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <label className="field-label" htmlFor="ch-name">
            Name
          </label>
          <input
            id="ch-name"
            className="input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="like build-log or outreach"
          />
          {slug && <p className="muted small">Shows as #{slug}</p>}
          {taken && <p className="form-error">There's already a #{slug}.</p>}
          <label className="field-label" htmlFor="ch-topic">
            Topic (optional)
          </label>
          <input
            id="ch-topic"
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What this channel is for"
          />
          {!channel?.announce && (
            <>
              <label className="field-label" htmlFor="ch-sub">
                Subteam (sets its color)
              </label>
              <select id="ch-sub" className="input" value={subteam} onChange={(e) => setSubteam(e.target.value)}>
                <option value="">None (whole team)</option>
                {SUBTEAMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          )}
          {channel && (
            <div className="row gap">
              <span className="small">Position</span>
              <button type="button" className="btn" onClick={() => onMove(-1)}>
                ↑ Up
              </button>
              <button type="button" className="btn" onClick={() => onMove(1)}>
                ↓ Down
              </button>
            </div>
          )}
          <div className="row gap">
            {channel && !fixed && (
              <button
                type="button"
                className="btn danger"
                onClick={async () =>
                  (await confirmDialog({
                    title: `Delete #${channel.name}?`,
                    body: 'Its messages will be hidden.',
                    okLabel: 'Delete channel',
                    danger: true,
                  })) && onDelete()
                }
              >
                Delete channel
              </button>
            )}
            <span className="spacer" />
            <button className="btn primary" disabled={!slug || taken}>
              {channel ? 'Save' : 'Create channel'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

// Start a DM with one person, or a group DM.
export function NewDmDialog({ roster, actor, onStart, onClose }) {
  useEscape(onClose);
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState('');
  const others = roster.filter((n) => n !== actor.name);
  const toggle = (n) => setPicked(picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n]);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New message">
          <div className="panel-head">
            <h2>New message</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small">Pick one person, or several for a group.</p>
          <div className="dm-pick">
            {others.map((n) => (
              <label key={n} className={`dm-person${picked.includes(n) ? ' on' : ''}`}>
                <input type="checkbox" checked={picked.includes(n)} onChange={() => toggle(n)} />
                <Avatar name={n} size={26} showOnline /> {n}
              </label>
            ))}
          </div>
          {picked.length > 1 && (
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name (optional)" />
          )}
          <button
            className="btn primary big-btn"
            disabled={!picked.length}
            onClick={() => onStart([actor.name, ...picked], picked.length > 1 ? name.trim() : '')}
          >
            {picked.length > 1 ? `Start group (${picked.length + 1} people)` : 'Message'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// The colored channel icon.
export function ChannelIcon({ conv }) {
  if (conv.kind === 'dm') return null;
  return (
    <span className="hash" style={{ color: SUBTEAM_COLORS[conv.subteam] || 'var(--muted)' }}>
      {conv.announce ? <Icon name="announce" size={20} /> : '#'}
    </span>
  );
}
