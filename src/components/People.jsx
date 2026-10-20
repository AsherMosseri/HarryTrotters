// Profile card (tap someone's name or picture) and the profile editor
// (picture, status).
import { useEffect, useRef, useState } from 'react';
import { SUBTEAM_COLORS } from '../config.js';
import { activeStatus } from '../people.js';
import { Avatar, CloseIcon, usePeople } from './common.jsx';

const STATUS_IDEAS = [
  ['🔧', 'At the shop'],
  ['💻', 'Coding'],
  ['📐', 'Doing CAD'],
  ['📚', 'Studying'],
  ['🚗', 'On my way'],
  ['🤒', 'Out sick'],
];
const CLEAR_AFTER = [
  ['never', "Don't clear"],
  ['1h', '1 hour'],
  ['4h', '4 hours'],
  ['today', 'Today'],
];

// The last character typed (whole emoji, even ones made of several code points).
function lastGrapheme(text) {
  if (!text) return '';
  const parts = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter().segment(text)].map((s) => s.segment) : [...text];
  return parts[parts.length - 1];
}

function untilFor(choice) {
  const now = Date.now();
  if (choice === '1h') return now + 3600000;
  if (choice === '4h') return now + 4 * 3600000;
  if (choice === 'today') {
    const d = new Date();
    d.setHours(23, 59, 59, 0);
    return d.getTime();
  }
  return 0;
}

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

export function ProfileCard({ name, actor, tasks, onClose, onMessage, onEdit }) {
  const people = usePeople();
  useEscape(onClose);
  const info = people?.infoOf(name) || {};
  const status = activeStatus(people?.profileOf(name));
  const online = people?.isOnline(name);
  const open = tasks.filter((t) => t.status !== 'done' && (t.assignees || []).includes(name));
  const me = name === actor.name;
  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog profile-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={name}>
        <div className="profile-banner" style={{ background: info.color || 'var(--accent)' }} />
        <button className="icon-btn profile-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="profile-avatar">
          <Avatar name={name} size={84} showOnline />
        </div>
        <h2 style={{ color: info.color || undefined }}>{name}</h2>
        <p className="muted small">{online ? '🟢 Online now' : 'Offline'}</p>
        {status && (
          <p className="profile-status">
            {status.emoji} {status.text}
          </p>
        )}
        {info.title && <p className="profile-title">{info.title}</p>}
        {info.subteams?.length > 0 && (
          <div className="profile-pills">
            {info.subteams.map((s) => (
              <span key={s} className="pill" style={{ '--pill': SUBTEAM_COLORS[s] || 'var(--muted)' }}>
                {s}
              </span>
            ))}
          </div>
        )}
        {info.responsibilities?.length > 0 && (
          <div className="profile-section">
            <h3>Responsibilities</h3>
            <p>{info.responsibilities.join(' · ')}</p>
          </div>
        )}
        <div className="profile-section">
          <h3>Open tasks</h3>
          <p>
            {open.length
              ? `${open.length} open: ${open
                  .slice(0, 3)
                  .map((t) => t.title)
                  .join(' · ')}${open.length > 3 ? '…' : ''}`
              : 'None'}
          </p>
        </div>
        <div className="row gap profile-actions">
          {me ? (
            <button className="btn primary grow" onClick={onEdit}>
              Edit profile
            </button>
          ) : (
            <>
              <button className="btn primary grow" onClick={onMessage}>
                ✉️ Message
              </button>
              {actor.admin && (
                <button className="btn" onClick={onEdit}>
                  Change picture
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Square crop of a photo: drag to move, slider to zoom. Saves a 256px JPEG.
function Cropper({ file, onDone, onCancel }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const SIZE = 240;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Scale so the shorter side fills the circle, then zoom.
  const base = img ? SIZE / Math.min(img.width, img.height) : 1;
  const scale = base * zoom;
  const w = img ? img.width * scale : 0;
  const h = img ? img.height * scale : 0;
  const clamp = (p) => ({
    x: Math.min(0, Math.max(SIZE - w, p.x)),
    y: Math.min(0, Math.max(SIZE - h, p.y)),
  });
  // Center on load and keep the image covering the circle when zooming.
  useEffect(() => {
    if (img) setPos(clamp({ x: (SIZE - img.width * base) / 2, y: (SIZE - img.height * base) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);
  useEffect(() => setPos((p) => clamp(p)), [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const out = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext('2d');
    const k = out / SIZE;
    ctx.drawImage(img, pos.x * k, pos.y * k, w * k, h * k);
    canvas.toBlob((blob) => onDone(blob), 'image/jpeg', 0.88);
  };

  return (
    <div className="cropper">
      <div
        className="crop-area"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, start: pos };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const d = drag.current;
          setPos(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {img && (
          <img src={img.src} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
        )}
      </div>
      <label className="row gap small">
        <span>Zoom</span>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="grow" />
      </label>
      <p className="muted small">Drag to move the picture inside the circle.</p>
      <div className="row gap">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary grow" onClick={save} disabled={!img}>
          Use this picture
        </button>
      </div>
    </div>
  );
}

// Your own picture and status, or (team management) someone else's picture.
export function ProfileEditor({ name, actor, api, onClose }) {
  const people = usePeople();
  useEscape(onClose);
  const profile = people?.profileOf(name);
  const me = name === actor.name;
  const current = activeStatus(profile);
  const [emoji, setEmoji] = useState(current?.emoji || '');
  const [text, setText] = useState(current?.text || '');
  const [clearAfter, setClearAfter] = useState('never');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const upload = async (blob) => {
    setFile(null);
    setBusy(true);
    try {
      await api.uploadAvatar(name, blob, profile?.photo?.path);
    } finally {
      setBusy(false);
    }
  };
  const saveStatus = async () => {
    setBusy(true);
    try {
      await api.saveProfile(name, {
        status: text.trim() || emoji ? { emoji, text: text.trim().slice(0, 80), until: untilFor(clearAfter) } : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog profile-editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit profile">
        <div className="panel-head">
          <h2>{me ? 'Your profile' : `${name.split(' ')[0]}'s picture`}</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {file ? (
          <Cropper file={file} onDone={upload} onCancel={() => setFile(null)} />
        ) : (
          <div className="row gap avatar-edit">
            <Avatar name={name} size={72} />
            <div className="col gap-sm">
              <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
                {busy ? 'Saving…' : profile?.photo ? 'Change picture' : 'Add a picture'}
              </button>
              {profile?.photo && (
                <button className="link-btn danger-text" onClick={() => api.removeAvatar(name, profile.photo.path)} disabled={busy}>
                  Remove picture
                </button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files[0];
                e.target.value = '';
                if (f) setFile(f);
              }}
            />
          </div>
        )}
        {me && !file && (
          <>
            <h3 className="field-label">Status</h3>
            <div className="row gap">
              <input
                className="input status-emoji"
                value={emoji}
                onChange={(e) => setEmoji(lastGrapheme(e.target.value.trim()))}
                placeholder="🙂"
                aria-label="Status emoji"
              />
              <input
                className="input grow"
                value={text}
                maxLength={80}
                onChange={(e) => setText(e.target.value)}
                placeholder="What are you up to?"
                aria-label="Status"
              />
            </div>
            <div className="status-ideas">
              {STATUS_IDEAS.map(([e, t]) => (
                <button
                  key={t}
                  className="chip"
                  onClick={() => {
                    setEmoji(e);
                    setText(t);
                  }}
                >
                  {e} {t}
                </button>
              ))}
            </div>
            <label className="row gap small">
              <span>Clear after</span>
              <select className="input" value={clearAfter} onChange={(e) => setClearAfter(e.target.value)}>
                {CLEAR_AFTER.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <div className="row gap">
              {current && (
                <button
                  className="btn"
                  onClick={() => {
                    setEmoji('');
                    setText('');
                    api.saveProfile(name, { status: null });
                  }}
                >
                  Clear status
                </button>
              )}
              <span className="spacer" />
              <button className="btn primary" onClick={saveStatus} disabled={busy}>
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
