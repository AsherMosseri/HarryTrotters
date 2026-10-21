import { useRef, useState } from 'react';
import { SWATCHES } from '../nitro.js';
import { EmojiPicker, GifPicker } from './chat/Pickers.jsx';
import { Avatar } from './common.jsx';
import { BADGE_ANIMS, DEFAULT_DECO, RING_STYLES } from './decoRender.jsx';
import { shrinkParticle } from './People.jsx';

const MAX_BADGES = 3;
const NEW_BADGE = { kind: 'emoji', value: '', angle: 135, dist: 0.5, size: 0.38, rotate: 0, anim: 'none', dir: 'cw', speed: 3 };
const SURPRISE_EMOJI = ['⭐', '🔥', '👑', '🤖', '⚙️', '💎', '🌈', '🍕', '🚀', '🦖', '🐸', '⚡', '🌸', '🎧', '🛠️', '🏆'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.random() * (b - a);
const hex = (css) => {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = css;
  return c.fillStyle;
};

function Colors({ value, onChange, label }) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {SWATCHES.filter(Boolean).map((c) => (
        <button
          key={c}
          className={`swatch${value === c ? ' on' : ''}`}
          style={{ background: c }}
          aria-label={c}
          onClick={() => onChange(c)}
        />
      ))}
      <label className={`swatch custom${SWATCHES.includes(value) ? '' : ' on'}`} title="Any color" style={{ background: value }}>
        🎨
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: any color`} />
      </label>
    </div>
  );
}

function Slider({ label, min, max, step = 1, value, onChange, show }) {
  return (
    <label className="studio-range">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b>{show ? show(value) : value}</b>
    </label>
  );
}

function Chips({ options, value, onChange, label }) {
  return (
    <div className="segmented deco-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          className={`plain-seg${value === o.id ? ' on' : ''}`}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Build your own avatar decoration. Tap or drag on the big preview to place
// the selected sticker.
export default function DecorationEditor({ name, value, onChange, upload }) {
  const d = { ...DEFAULT_DECO, ...value, ring: { ...DEFAULT_DECO.ring, ...value?.ring } };
  const badges = d.badges || [];
  const [sel, setSel] = useState(badges.length ? 0 : -1);
  const [panel, setPanel] = useState(null); // 'emoji' | 'gif'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const stage = useRef(null);
  const file = useRef(null);
  const dragging = useRef(false);

  const setRing = (patch) => onChange({ ...d, ring: { ...d.ring, ...patch } });
  const setBadges = (list) => onChange({ ...d, badges: list });
  const b = badges[sel];
  const setBadge = (patch) => setBadges(badges.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
  // A new emoji or GIPHY GIF: drop the old uploaded picture's path (Firestore rejects undefined).
  const replaceSource = (kind, value) =>
    setBadges(
      badges.map((x, i) => {
        if (i !== sel) return x;
        const { path: _old, ...rest } = x;
        return { ...rest, kind, value };
      }),
    );

  const placeAt = (e) => {
    if (!b || !stage.current) return;
    const r = stage.current.querySelector('.deco, .avatar')?.getBoundingClientRect();
    if (!r) return;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const angle = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
    const dist = Math.min(0.75, Math.round((Math.hypot(dx, dy) / r.width) * 100) / 100);
    setBadge({ angle, dist });
  };
  const pickFile = async (f) => {
    setErr('');
    if (!f.type.startsWith('image/')) return setErr('Pick a picture or GIF.');
    if (f.type === 'image/gif' && f.size > 2e6) return setErr('That GIF is too big (2 MB max).');
    setBusy(true);
    try {
      const small = f.type === 'image/gif' ? f : await shrinkParticle(f);
      const stored = await upload(small, b?.path);
      setBadge({ kind: 'image', value: stored.url, path: stored.path });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const addBadge = () => {
    if (badges.length >= MAX_BADGES) return;
    setBadges([...badges, { ...NEW_BADGE, angle: [45, 135, 225, 315][badges.length] ?? 0 }]);
    setSel(badges.length);
    setPanel('emoji');
  };
  const surprise = () => {
    const a = hex(`hsl(${Math.floor(Math.random() * 360)} 85% 55%)`);
    const c = hex(`hsl(${Math.floor(Math.random() * 360)} 85% 55%)`);
    const n = 1 + Math.floor(Math.random() * 3);
    onChange({
      ring: {
        style: pick(RING_STYLES.slice(1)).id,
        colors: [a, c],
        width: Math.round(between(6, 16)),
        spin: pick(['', 'cw', 'ccw']),
        speed: Math.round(between(2, 8)),
      },
      badges: Array.from({ length: n }, () => ({
        ...NEW_BADGE,
        value: pick(SURPRISE_EMOJI),
        angle: Math.round(between(0, 360)),
        dist: Math.round(between(0.4, 0.62) * 100) / 100,
        size: Math.round(between(0.25, 0.5) * 100) / 100,
        rotate: Math.round(between(-40, 40)),
        anim: pick(BADGE_ANIMS).id,
        dir: pick(['cw', 'ccw']),
        speed: Math.round(between(2, 7)),
      })),
    });
    setSel(0);
  };

  return (
    <div className="deco-editor">
      <div className="deco-top">
        <div
          className="deco-stage"
          ref={stage}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            placeAt(e);
          }}
          onPointerMove={(e) => dragging.current && placeAt(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          title={b ? 'Tap or drag to place the selected sticker' : ''}
        >
          <Avatar name={name} size={120} decoration="custom" decorationCustom={d} />
        </div>
        <div className="deco-top-side">
          <p className="muted small">
            {b ? 'Tap or drag on the picture to place the selected sticker.' : 'Add a sticker, or just style the ring.'}
          </p>
          <button className="btn" onClick={surprise}>
            🎲 Surprise me
          </button>
        </div>
      </div>

      <h4 className="studio-h">Ring</h4>
      <Chips label="Ring style" options={RING_STYLES} value={d.ring.style} onChange={(style) => setRing({ style })} />
      {d.ring.style !== 'none' && (
        <>
          {d.ring.style !== 'rainbow' && (
            <Colors label="Ring color" value={d.ring.colors[0]} onChange={(c) => setRing({ colors: [c, d.ring.colors[1]] })} />
          )}
          {['gradient', 'duo', 'dashed'].includes(d.ring.style) && (
            <Colors label="Second ring color" value={d.ring.colors[1]} onChange={(c) => setRing({ colors: [d.ring.colors[0], c] })} />
          )}
          <Slider label="Thickness" min={3} max={22} value={d.ring.width} onChange={(width) => setRing({ width })} />
          <Chips
            label="Ring motion"
            options={[
              { id: '', label: 'Still' },
              { id: 'cw', label: '↻ Spin' },
              { id: 'ccw', label: '↺ Spin' },
            ]}
            value={d.ring.spin || ''}
            onChange={(spin) => setRing({ spin })}
          />
          {d.ring.spin && <Slider label="Speed" min={1} max={12} value={13 - d.ring.speed} onChange={(v) => setRing({ speed: 13 - v })} />}
        </>
      )}

      <h4 className="studio-h">Stickers</h4>
      <div className="row gap wrap">
        {badges.map((x, i) => (
          <button key={i} className={`deco-sticker-tab${i === sel ? ' on' : ''}`} onClick={() => setSel(i)} aria-label={`Sticker ${i + 1}`}>
            {x.value ? x.kind === 'image' ? <img src={x.value} alt="" /> : x.value : '?'}
          </button>
        ))}
        {badges.length < MAX_BADGES && (
          <button className="btn" onClick={addBadge}>
            ＋ Add sticker
          </button>
        )}
      </div>
      {b && (
        <div className="deco-sticker">
          <div className="row gap wrap">
            <button className="btn" onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}>
              😊 Emoji
            </button>
            <button className="btn" onClick={() => setPanel(panel === 'gif' ? null : 'gif')}>
              GIF
            </button>
            <button className="btn" onClick={() => file.current?.click()} disabled={busy}>
              {busy ? 'Uploading…' : '🖼 Picture'}
            </button>
            <span className="spacer" />
            <button
              className="link-btn small danger"
              onClick={() => {
                setBadges(badges.filter((_, i) => i !== sel));
                setSel(badges.length > 1 ? 0 : -1);
              }}
            >
              Remove
            </button>
            <input
              ref={file}
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
                replaceSource('emoji', em);
                setPanel(null);
              }}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'gif' && (
            <div className="effect-gif">
              <GifPicker
                onPick={(gif) => {
                  replaceSource('image', gif.url);
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
          {err && <p className="form-error">{err}</p>}
          <Slider label="Around" min={0} max={359} value={b.angle} onChange={(angle) => setBadge({ angle })} show={(v) => `${v}°`} />
          <Slider
            label="In / out"
            min={0}
            max={75}
            value={Math.round(b.dist * 100)}
            onChange={(v) => setBadge({ dist: v / 100 })}
            show={(v) => (v < 35 ? 'inside' : v > 58 ? 'outside' : 'on edge')}
          />
          <Slider
            label="Size"
            min={15}
            max={80}
            value={Math.round(b.size * 100)}
            onChange={(v) => setBadge({ size: v / 100 })}
            show={(v) => `${v}%`}
          />
          <Slider
            label="Rotation"
            min={-180}
            max={180}
            value={b.rotate}
            onChange={(rotate) => setBadge({ rotate })}
            show={(v) => `${v}°`}
          />
          <Chips label="Animation" options={BADGE_ANIMS} value={b.anim || 'none'} onChange={(anim) => setBadge({ anim })} />
          {b.anim && b.anim !== 'none' && (
            <>
              {['orbit', 'spin'].includes(b.anim) && (
                <Chips
                  label="Direction"
                  options={[
                    { id: 'cw', label: '↻ Clockwise' },
                    { id: 'ccw', label: '↺ Counterclockwise' },
                  ]}
                  value={b.dir || 'cw'}
                  onChange={(dir) => setBadge({ dir })}
                />
              )}
              <Slider label="Speed" min={1} max={12} value={13 - (b.speed || 3)} onChange={(v) => setBadge({ speed: 13 - v })} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
