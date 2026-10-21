// Profile card (tap someone's name or picture) and the profile editor
// (pictures, about me, Nitro-style looks, status).
import { useEffect, useRef, useState } from 'react';
import { SUBTEAM_COLORS, gradeLabel } from '../config.js';
import { DECORATIONS, EFFECTS, MOTIONS, NAME_FONTS, SWATCHES, effectById, gradientStops, nameStyle } from '../nitro.js';
import { DEFAULT_BORDER, borderProps } from '../borders.js';
import BorderEditor from './BorderEditor.jsx';
import { EmojiPicker, GifPicker } from './chat/Pickers.jsx';
import { activeStatus } from '../people.js';
import { Avatar, CloseIcon, usePeople } from './common.jsx';
import DecorationEditor from './DecorationEditor.jsx';
import { DEFAULT_DECO } from './decoRender.jsx';

const STATUS_IDEAS = [
  ['🔧', 'At the lab'],
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

// Drifting particles over the profile card.
// Drifting particles over the profile card: a preset, or your own emoji,
// GIF, or picture (custom: { kind: 'emoji' | 'image', value, motion }).
export function ProfileEffect({ id, custom }) {
  const e = effectById[id];
  const isCustom = id === 'custom' && custom?.value;
  if (!isCustom && (!e?.icon || id === 'custom')) return null;
  const cls = isCustom ? `fx-custom fx-move-${custom.motion || 'fall'}` : `fx-${id}`;
  return (
    <div className={`profile-effect ${cls}`} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${3 + ((i * 7) % 5)}s` }}>
          {isCustom ? custom.kind === 'image' ? <img src={custom.value} alt="" /> : custom.value : id === 'confetti' ? '' : e.icon}
        </span>
      ))}
    </div>
  );
}

// Picks a custom effect: an emoji, a GIPHY GIF, or your own picture.
export function CustomEffect({ value, onChange, upload }) {
  const [panel, setPanel] = useState(null); // 'emoji' | 'gif'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = useRef(null);
  const v = value || { kind: 'emoji', value: '', motion: 'fall' };
  const pickFile = async (f) => {
    setErr('');
    if (!f.type.startsWith('image/')) return setErr('Pick a picture or GIF.');
    if (f.type === 'image/gif' && f.size > 2e6) return setErr('That GIF is too big (2 MB max).');
    setBusy(true);
    try {
      const small = f.type === 'image/gif' ? f : await shrinkParticle(f);
      const stored = await upload(small, v.path);
      onChange({ ...v, kind: 'image', value: stored.url, path: stored.path });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="custom-effect">
      <div className="row gap custom-effect-pick">
        <span className="custom-effect-now" title="Your effect">
          {v.value ? v.kind === 'image' ? <img src={v.value} alt="" /> : v.value : '?'}
        </span>
        <button className="btn" onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}>
          😊 Emoji
        </button>
        <button className="btn" onClick={() => setPanel(panel === 'gif' ? null : 'gif')}>
          GIF
        </button>
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : '🖼 Picture'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => (e.target.files[0] && pickFile(e.target.files[0]), (e.target.value = ''))}
        />
      </div>
      {panel === 'emoji' && (
        <EmojiPicker
          className="effect-picker"
          onPick={(em) => {
            onChange({ ...v, kind: 'emoji', value: em });
            setPanel(null);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'gif' && (
        <div className="effect-gif">
          <GifPicker
            onPick={(gif) => {
              onChange({ ...v, kind: 'image', value: gif.url });
              setPanel(null);
            }}
            onUpload={(f) => {
              setPanel(null);
              pickFile(f);
            }}
            onClose={() => setPanel(null)}
          />
        </div>
      )}
      <div className="segmented">
        {MOTIONS.map((m) => (
          <button key={m.id} className={(v.motion || 'fall') === m.id ? 'active' : ''} onClick={() => onChange({ ...v, motion: m.id })}>
            {m.label}
          </button>
        ))}
      </div>
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

// Still pictures become 96px PNGs (transparency kept) so 14 of them stay light.
export async function shrinkParticle(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 96 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return new File([blob], 'effect.png', { type: 'image/png' });
}

// The card itself, also used as the live preview in the editor (with `look`
// overriding the saved profile).
function CardBody({ name, look, actor, tasks, children }) {
  const people = usePeople();
  const info = people?.infoOf(name) || {};
  const profile = { ...(people?.profileOf(name) || {}), ...look };
  const status = activeStatus(profile);
  const online = people?.isOnline(name);
  const open = tasks.filter((t) => t.status !== 'done' && (t.assignees || []).includes(name));
  const themed = profile.theme?.a && profile.theme?.b;
  const banner = profile.banner?.url;
  return (
    <div
      className={`profile-body${themed ? ' themed' : ''}`}
      style={
        themed ? { '--pgrad': `linear-gradient(180deg, ${gradientStops([profile.theme.a, profile.theme.m, profile.theme.b])})` } : undefined
      }
    >
      <ProfileEffect id={profile.effect} custom={profile.effectCustom} />
      <div
        className="profile-banner"
        style={banner ? { backgroundImage: `url("${banner}")` } : { background: profile.bannerColor || info.color || 'var(--accent)' }}
      />
      <div className="profile-avatar">
        <Avatar name={name} size={84} showOnline decoration={profile.decoration} decorationCustom={profile.decorationCustom} />
      </div>
      <div className="profile-inner">
        <h2 className="display-name" style={nameStyle(profile, info.color)}>
          {name}
        </h2>
        <p className="muted small">
          {profile.pronouns && <span className="pronouns">{profile.pronouns} · </span>}
          {online ? (
            <>
              <span className="online-inline" aria-hidden="true" />
              Online now
            </>
          ) : (
            'Offline'
          )}
        </p>
        {status && (
          <p className="profile-status">
            {status.emoji} {status.text}
          </p>
        )}
        {profile.about && (
          <div className="profile-section">
            <h3>About me</h3>
            <p className="about-text">{profile.about}</p>
          </div>
        )}
        {(info.title || info.grade) && (
          <p className="profile-title">{[info.title, info.grade && gradeLabel(info.grade)].filter(Boolean).join(' · ')}</p>
        )}
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
        {children}
      </div>
    </div>
  );
}

export function ProfileCard({ name, actor, tasks, onClose, onMessage, onEdit }) {
  useEscape(onClose);
  const people = usePeople();
  const me = name === actor.name;
  const border = borderProps(people?.profileOf(name)?.cardBorder);
  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div
        className={`dialog profile-card ${border.className}`}
        style={border.style}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={name}
      >
        <button className="icon-btn profile-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <CardBody name={name} actor={actor} tasks={tasks}>
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
                    Edit profile
                  </button>
                )}
              </>
            )}
          </div>
        </CardBody>
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

// Banners: 960×320 JPEG (center crop), or a GIF kept as it is.
async function prepareBanner(file) {
  if (file.type === 'image/gif') {
    if (file.size > 6e6) throw new Error('That GIF is too big for a banner (6 MB max).');
    return file;
  }
  const bmp = await createImageBitmap(file);
  const W = 960;
  const H = 320;
  const k = Math.max(W / bmp.width, H / bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d').drawImage(bmp, (W - bmp.width * k) / 2, (H - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
  return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
}

function ColorRow({ value, onChange, allowNone = true }) {
  return (
    <div className="swatches">
      {allowNone && (
        <button className={`swatch none${!value ? ' on' : ''}`} onClick={() => onChange('')} title="None" aria-label="None">
          ⌀
        </button>
      )}
      {SWATCHES.map((c) => (
        <button
          key={c}
          className={`swatch${value === c ? ' on' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <label className="swatch custom" title="Any color">
        <input type="color" value={value || '#6366f1'} onChange={(e) => onChange(e.target.value)} />
        🎨
      </label>
    </div>
  );
}

// Your profile (or, for team management, anyone's): pictures, about me,
// pronouns, name style, decoration, effect, profile colors, and status.
export function ProfileEditor({ name, actor, api, tasks = [], onClose }) {
  const people = usePeople();
  useEscape(onClose);
  const profile = people?.profileOf(name) || {};
  const me = name === actor.name;
  const current = activeStatus(profile);
  const [tab, setTab] = useState('profile');
  const [borderFor, setBorderFor] = useState('card');
  const [look, setLook] = useState({
    about: profile.about || '',
    pronouns: profile.pronouns || '',
    decoration: profile.decoration || '',
    decorationCustom: profile.decorationCustom || null,
    cardBorder: profile.cardBorder || null,
    msgBorder: profile.msgBorder || null,
    effect: profile.effect || '',
    effectCustom: profile.effectCustom || null,
    nameStyle: profile.nameStyle || { font: '', colors: [] },
    theme: profile.theme || null,
    bannerColor: profile.bannerColor || '',
  });
  const [emoji, setEmoji] = useState(current?.emoji || '');
  const [text, setText] = useState(current?.text || '');
  const [clearAfter, setClearAfter] = useState('never');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const avatarInput = useRef(null);
  const bannerInput = useRef(null);
  const set = (patch) => setLook((l) => ({ ...l, ...patch }));
  const colors = look.nameStyle.colors || [];

  const run = async (what, fn) => {
    setBusy(what);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy('');
    }
  };
  const pickAvatar = (f) => {
    // GIFs stay animated (no cropping); other pictures go through the cropper.
    if (f.type === 'image/gif') {
      if (f.size > 4e6) return setErr('That GIF is too big for a picture (4 MB max).');
      run('avatar', () => api.uploadAvatar(name, f, profile.photo?.path));
    } else setFile(f);
  };
  const save = () =>
    run('save', async () => {
      const patch = { ...look, about: look.about.trim().slice(0, 190), pronouns: look.pronouns.trim().slice(0, 40) };
      // Status: yours, or anyone's for team management. Only saved when changed, so its "clear after" time is kept.
      const statusChanged = emoji !== (current?.emoji || '') || text.trim() !== (current?.text || '') || clearAfter !== 'never';
      if (statusChanged)
        patch.status = text.trim() || emoji ? { emoji, text: text.trim().slice(0, 80), until: untilFor(clearAfter) } : null;
      await api.saveProfile(name, patch);
      onClose();
    });

  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog profile-editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit profile">
        <div className="panel-head">
          <h2>{me ? 'Your profile' : `${name.split(' ')[0]}'s profile`}</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {file ? (
          <Cropper
            file={file}
            onDone={(blob) => {
              setFile(null);
              run('avatar', () => api.uploadAvatar(name, blob, profile.photo?.path));
            }}
            onCancel={() => setFile(null)}
          />
        ) : (
          <div className="editor-grid">
            <div className="editor-form">
              <div className="segmented editor-tabs">
                {[
                  ['profile', 'Profile'],
                  ['style', 'Style'],
                  ['status', 'Status'],
                ].map(([id, label]) => (
                  <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'profile' && (
                <>
                  <h3 className="field-label">Picture</h3>
                  <div className="row gap">
                    <button className="btn" onClick={() => avatarInput.current?.click()} disabled={!!busy}>
                      {busy === 'avatar' ? 'Saving…' : profile.photo ? 'Change picture' : 'Add a picture'}
                    </button>
                    {profile.photo && (
                      <button
                        className="link-btn danger-text"
                        onClick={() => run('avatar', () => api.removeAvatar(name, profile.photo.path))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="muted tiny">GIFs stay animated.</p>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => (e.target.files[0] && pickAvatar(e.target.files[0]), (e.target.value = ''))}
                  />
                  <h3 className="field-label">Banner</h3>
                  <div className="row gap">
                    <button className="btn" onClick={() => bannerInput.current?.click()} disabled={!!busy}>
                      {busy === 'banner' ? 'Saving…' : profile.banner ? 'Change banner' : 'Add a banner image'}
                    </button>
                    {profile.banner && (
                      <button
                        className="link-btn danger-text"
                        onClick={() => run('banner', () => api.removeBanner(name, profile.banner.path))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={bannerInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files[0];
                      e.target.value = '';
                      if (f) run('banner', async () => api.uploadBanner(name, await prepareBanner(f), profile.banner?.path));
                    }}
                  />
                  {!profile.banner && (
                    <>
                      <p className="muted tiny">Or a banner color:</p>
                      <ColorRow value={look.bannerColor} onChange={(c) => set({ bannerColor: c })} />
                    </>
                  )}
                  <h3 className="field-label">Pronouns</h3>
                  <input
                    className="input"
                    value={look.pronouns}
                    maxLength={40}
                    onChange={(e) => set({ pronouns: e.target.value })}
                    placeholder="e.g. she/her, he/him, they/them"
                  />
                  <h3 className="field-label">About me</h3>
                  <textarea
                    className="input about-input"
                    value={look.about}
                    maxLength={190}
                    rows={3}
                    onChange={(e) => set({ about: e.target.value })}
                    placeholder="What you do on the team, what you're good at…"
                  />
                  <p className="muted tiny right">{190 - look.about.length} left</p>
                </>
              )}
              {tab === 'style' && (
                <>
                  <h3 className="field-label">Name font</h3>
                  <div className="choice-grid">
                    {NAME_FONTS.map((f) => (
                      <button
                        key={f.id}
                        className={`choice${(look.nameStyle.font || '') === f.id ? ' on' : ''}`}
                        style={f.css ? { fontFamily: f.css } : undefined}
                        onClick={() => set({ nameStyle: { ...look.nameStyle, font: f.id } })}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <h3 className="field-label">Name color</h3>
                  <ColorRow
                    value={colors[0] || ''}
                    onChange={(c) => set({ nameStyle: { ...look.nameStyle, colors: c ? [c, colors[1] || ''] : [] } })}
                  />
                  {colors[0] && (
                    <>
                      <p className="muted tiny">Second color for a gradient (optional):</p>
                      <ColorRow
                        value={colors[1] || ''}
                        onChange={(c) =>
                          set({ nameStyle: { ...look.nameStyle, colors: c ? [colors[0], c, colors[2] || ''] : [colors[0]] } })
                        }
                      />
                    </>
                  )}
                  {colors[0] && colors[1] && (
                    <>
                      <p className="muted tiny">Third color (optional):</p>
                      <ColorRow
                        value={colors[2] || ''}
                        onChange={(c) => set({ nameStyle: { ...look.nameStyle, colors: [colors[0], colors[1], c] } })}
                      />
                    </>
                  )}
                  <h3 className="field-label">Avatar decoration</h3>
                  <div className="choice-grid deco-grid">
                    {DECORATIONS.map((d) => (
                      <button
                        key={d.id}
                        className={`choice${look.decoration === d.id ? ' on' : ''}`}
                        onClick={() =>
                          set(
                            d.id === 'custom' && !look.decorationCustom
                              ? { decoration: d.id, decorationCustom: DEFAULT_DECO }
                              : { decoration: d.id },
                          )
                        }
                        title={d.label}
                      >
                        <Avatar
                          name={name}
                          size={36}
                          decoration={d.id}
                          decorationCustom={d.id === 'custom' ? look.decorationCustom || DEFAULT_DECO : undefined}
                        />
                        <span className="tiny">{d.label}</span>
                      </button>
                    ))}
                  </div>
                  {look.decoration === 'custom' && (
                    <DecorationEditor
                      name={name}
                      value={look.decorationCustom || DEFAULT_DECO}
                      onChange={(c) => set({ decorationCustom: c })}
                      upload={(file, oldPath) => api.uploadEffectImage(name, file, oldPath)}
                    />
                  )}
                  <h3 className="field-label">Profile effect</h3>
                  <div className="choice-grid">
                    {EFFECTS.map((f) => (
                      <button key={f.id} className={`choice${look.effect === f.id ? ' on' : ''}`} onClick={() => set({ effect: f.id })}>
                        {f.icon} {f.label}
                      </button>
                    ))}
                  </div>
                  {look.effect === 'custom' && (
                    <CustomEffect
                      value={look.effectCustom}
                      onChange={(c) => set({ effectCustom: c })}
                      upload={(file, oldPath) => api.uploadEffectImage(name, file, oldPath)}
                    />
                  )}
                  <h3 className="field-label">Profile colors</h3>
                  <div className="row gap">
                    <label className="row gap-sm small">
                      Top{' '}
                      <input
                        type="color"
                        value={look.theme?.a || '#6366f1'}
                        onChange={(e) => set({ theme: { ...look.theme, a: e.target.value, b: look.theme?.b || '#ec4899' } })}
                      />
                    </label>
                    {look.theme?.m ? (
                      <label className="row gap-sm small">
                        Middle{' '}
                        <input type="color" value={look.theme.m} onChange={(e) => set({ theme: { ...look.theme, m: e.target.value } })} />
                        <button
                          className="icon-btn small"
                          aria-label="Remove middle color"
                          onClick={() => set({ theme: { a: look.theme.a, b: look.theme.b } })}
                        >
                          <CloseIcon />
                        </button>
                      </label>
                    ) : (
                      <button
                        className="link-btn small"
                        onClick={() => set({ theme: { a: look.theme?.a || '#6366f1', b: look.theme?.b || '#ec4899', m: '#f59e0b' } })}
                      >
                        ＋ Middle color
                      </button>
                    )}
                    <label className="row gap-sm small">
                      Bottom{' '}
                      <input
                        type="color"
                        value={look.theme?.b || '#ec4899'}
                        onChange={(e) => set({ theme: { ...look.theme, a: look.theme?.a || '#6366f1', b: e.target.value } })}
                      />
                    </label>
                    {look.theme && (
                      <button className="link-btn small" onClick={() => set({ theme: null })}>
                        Reset
                      </button>
                    )}
                  </div>
                  <h3 className="field-label">Borders</h3>
                  <div className="segmented">
                    {[
                      ['card', 'Profile card'],
                      ['msg', 'My messages'],
                      ['avatar', 'Avatar'],
                    ].map(([id, label]) => (
                      <button key={id} className={`plain-seg${borderFor === id ? ' on' : ''}`} onClick={() => setBorderFor(id)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {borderFor === 'card' && (
                    <BorderEditor
                      value={look.cardBorder || { ...DEFAULT_BORDER, style: 'none' }}
                      onChange={(cardBorder) => set({ cardBorder })}
                    />
                  )}
                  {borderFor === 'msg' && (
                    <BorderEditor
                      value={look.msgBorder || { ...DEFAULT_BORDER, style: 'none', radius: 12 }}
                      maxRadius={24}
                      onChange={(msgBorder) => set({ msgBorder })}
                      sample={
                        <div className="border-sample">
                          <span className={`msg-text ${borderProps(look.msgBorder).className}`} style={borderProps(look.msgBorder).style}>
                            This is how your messages look.
                          </span>
                        </div>
                      }
                    />
                  )}
                  {borderFor === 'avatar' && (
                    <div className="border-editor">
                      <p className="muted small">
                        Your avatar’s border is its decoration ring: any style, up to 3 colors, thickness, and spin.
                      </p>
                      <button
                        className="btn"
                        onClick={() => {
                          set(look.decorationCustom ? { decoration: 'custom' } : { decoration: 'custom', decorationCustom: DEFAULT_DECO });
                          setTimeout(
                            () => document.querySelector('.deco-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                            50,
                          );
                        }}
                      >
                        Edit my avatar border
                      </button>
                    </div>
                  )}
                </>
              )}
              {tab === 'status' && (
                <>
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
                      placeholder={me ? 'What are you up to?' : `What's ${name.split(' ')[0]} up to?`}
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
                  {(emoji || text) && (
                    <button
                      className="link-btn"
                      onClick={() => {
                        setEmoji('');
                        setText('');
                      }}
                    >
                      Clear status
                    </button>
                  )}
                </>
              )}
              {err && <p className="form-error">{err}</p>}
              <div className="row gap editor-save">
                <span className="spacer" />
                <button className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn primary" onClick={save} disabled={!!busy}>
                  {busy === 'save' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            <div className="editor-preview">
              <h3 className="field-label">Preview</h3>
              <div
                className={`profile-card preview-card ${borderProps(look.cardBorder).className}`}
                style={borderProps(look.cardBorder).style}
              >
                <CardBody name={name} actor={actor} tasks={tasks} look={{ ...look, status: text || emoji ? { emoji, text } : null }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
