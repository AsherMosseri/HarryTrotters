import { useEffect, useRef, useState } from 'react';
import { SWATCHES } from '../nitro.js';
import { preparePhoto } from '../util.js';
import { EmojiPicker, GifPicker } from './chat/Pickers.jsx';
import { CloseIcon } from './common.jsx';
import { CustomEffect, ProfileEffect } from './People.jsx';

// A custom app theme (per device, in localStorage 'custom-theme'):
//   accent, colors [a, b], tint (how strongly the colors show, %), motion
//   ('shift' moves the colors), bg { kind: 'image' | 'emoji', value, path },
//   show (how much of the background shows through, %), and fx (floating
//   things: { preset } or { kind, value, motion }, like profile effects).
export const CUSTOM_DEFAULT = { accent: '#8b5cf6', colors: ['#8b5cf6', '#06b6d4'], tint: 22, motion: '', bg: null, show: 30, fx: null };

const FX_PRESETS = [
  ['sparkles', '✨'],
  ['snow', '❄️'],
  ['hearts', '💖'],
  ['bubbles', '🫧'],
  ['confetti', '🎉'],
  ['gears', '⚙️'],
  ['fire', '🔥'],
];

// "Match my profile": the profile's colors, banner picture, and effect.
export function themeFromProfile(profile = {}, fallback = '') {
  const a = profile.theme?.a || profile.bannerColor || fallback || CUSTOM_DEFAULT.colors[0];
  const b = profile.theme?.b || a;
  const fx =
    profile.effect === 'custom' && profile.effectCustom?.value
      ? profile.effectCustom
      : profile.effect && profile.effect !== 'custom'
        ? { preset: profile.effect }
        : null;
  return {
    ...CUSTOM_DEFAULT,
    accent: a,
    colors: [a, b],
    tint: 24,
    bg: profile.banner?.url ? { kind: 'image', value: profile.banner.url } : null,
    show: 35,
    fx,
  };
}

const emojiTile = (emoji) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='76' height='76'><text x='38' y='44' font-size='30' text-anchor='middle' dominant-baseline='middle' transform='rotate(-12 38 38)'>${emoji}</text></svg>`,
  )}")`;

// The theme's colors, as CSS variables on <html> (read by styles.css).
export function applyThemeVars(t) {
  const root = document.documentElement.style;
  if (!t) {
    for (const k of ['--accent', '--p1', '--p2', '--tint']) root.removeProperty(k);
    return;
  }
  root.setProperty('--accent', t.accent);
  root.setProperty('--p1', t.colors[0]);
  root.setProperty('--p2', t.colors[1]);
  root.setProperty('--tint', `${t.tint}%`);
}

// Behind the whole app: moving colors, a picture/GIF or emoji pattern, and
// floating things. The page color veils it so text stays readable.
export function AppBackdrop({ theme: t }) {
  if (!t || (!t.bg?.value && !t.fx && t.motion !== 'shift')) return null;
  return (
    <div className={`app-backdrop${t.motion === 'shift' ? ' shift' : ''}`} aria-hidden="true">
      {t.bg?.kind === 'image' && t.bg.value && <div className="app-bg-pic" style={{ backgroundImage: `url("${t.bg.value}")` }} />}
      {t.bg?.kind === 'emoji' && t.bg.value && <div className="app-bg-pattern" style={{ backgroundImage: emojiTile(t.bg.value) }} />}
      {t.bg?.value && <div className="app-bg-veil" style={{ opacity: 1 - (t.show ?? 30) / 100 }} />}
      {t.fx && (
        <div className="app-fx">{t.fx.preset ? <ProfileEffect id={t.fx.preset} /> : <ProfileEffect id="custom" custom={t.fx} />}</div>
      )}
    </div>
  );
}

function ColorPick({ value, onChange, label }) {
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

const rand = (list) => list[Math.floor(Math.random() * list.length)];
const randomColor = () => `hsl(${Math.floor(Math.random() * 360)} 85% 55%)`;
const toHex = (css) => {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = css;
  return c.fillStyle;
};

// The editor. Every change shows in the app right away.
export default function ThemeStudio({ value, onChange, profile, profileColor, upload, onClose }) {
  const t = { ...CUSTOM_DEFAULT, ...value };
  const set = (patch) => onChange({ ...t, ...patch });
  const [panel, setPanel] = useState(null); // 'emoji' | 'gif'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const file = useRef(null);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const pickPicture = async (f) => {
    setErr('');
    if (!f.type.startsWith('image/')) return setErr('Pick a picture or GIF.');
    if (f.type === 'image/gif' && f.size > 2e6) return setErr('That GIF is too big (2 MB max).');
    setBusy(true);
    try {
      const small = f.type === 'image/gif' ? f : new File([(await preparePhoto(f)).full], 'background.jpg', { type: 'image/jpeg' });
      const stored = await upload(small, t.bg?.path);
      set({ bg: { kind: 'image', value: stored.url, path: stored.path } });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const surprise = () => {
    const a = toHex(randomColor());
    const b = toHex(randomColor());
    const emoji = rand(['🤖', '⚙️', '🚀', '🍕', '🦖', '🌈', '🔩', '🎮', '🐸', '🌊', '⚡', '🍩']);
    onChange({
      ...CUSTOM_DEFAULT,
      accent: a,
      colors: [a, b],
      tint: 20 + Math.floor(Math.random() * 25),
      motion: Math.random() < 0.5 ? 'shift' : '',
      bg: Math.random() < 0.5 ? { kind: 'emoji', value: emoji } : null,
      show: 25,
      fx: Math.random() < 0.6 ? { kind: 'emoji', value: emoji, motion: rand(['fall', 'rise', 'twinkle']) } : null,
    });
  };

  return (
    <div className="panel-backdrop center studio-backdrop" onClick={onClose}>
      <div className="dialog theme-studio" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Custom theme">
        <div className="panel-head">
          <h2>🎨 Custom theme</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="muted small">Changes show in the app as you make them. Only on this device.</p>
        <div className="row gap wrap">
          <button className="btn" onClick={() => onChange(themeFromProfile(profile, profileColor))}>
            🪞 Start from my profile
          </button>
          <button className="btn" onClick={surprise}>
            🎲 Surprise me
          </button>
          <button className="link-btn small" onClick={() => onChange(CUSTOM_DEFAULT)}>
            Reset
          </button>
        </div>

        <h3 className="studio-h">Accent</h3>
        <p className="muted tiny">Buttons, links, and the selected tab.</p>
        <ColorPick label="Accent" value={t.accent} onChange={(accent) => set({ accent })} />

        <h3 className="studio-h">Background colors</h3>
        <div className="studio-two">
          <ColorPick label="First color" value={t.colors[0]} onChange={(c) => set({ colors: [c, t.colors[1]] })} />
          <ColorPick label="Second color" value={t.colors[1]} onChange={(c) => set({ colors: [t.colors[0], c] })} />
        </div>
        <label className="studio-range">
          <span>Strength</span>
          <input type="range" min="0" max="70" value={t.tint} onChange={(e) => set({ tint: Number(e.target.value) })} />
          <b>{t.tint}%</b>
        </label>
        <label className="studio-check">
          <input type="checkbox" checked={t.motion === 'shift'} onChange={(e) => set({ motion: e.target.checked ? 'shift' : '' })} /> 🌊
          Make the colors move
        </label>

        <h3 className="studio-h">Background picture</h3>
        <div className="row gap wrap">
          <button className={`btn${!t.bg ? ' on-btn' : ''}`} onClick={() => set({ bg: null })}>
            None
          </button>
          <button className="btn" onClick={() => file.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : '🖼 Picture'}
          </button>
          <button className="btn" onClick={() => setPanel(panel === 'gif' ? null : 'gif')}>
            GIF
          </button>
          <button className="btn" onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}>
            😊 Emoji pattern
          </button>
          {t.bg?.value && (
            <span className="studio-bg-now" title="Current background">
              {t.bg.kind === 'image' ? <img src={t.bg.value} alt="" /> : t.bg.value}
            </span>
          )}
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => (e.target.files[0] && pickPicture(e.target.files[0]), (e.target.value = ''))}
          />
        </div>
        {panel === 'emoji' && (
          <EmojiPicker
            className="effect-picker"
            onPick={(em) => {
              set({ bg: { kind: 'emoji', value: em } });
              setPanel(null);
            }}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'gif' && (
          <div className="effect-gif">
            <GifPicker
              onPick={(gif) => {
                set({ bg: { kind: 'image', value: gif.url } });
                setPanel(null);
              }}
              onUpload={(f) => {
                setPanel(null);
                pickPicture(f);
              }}
              onClose={() => setPanel(null)}
            />
          </div>
        )}
        {t.bg?.value && (
          <label className="studio-range">
            <span>Show through</span>
            <input type="range" min="5" max="80" value={t.show} onChange={(e) => set({ show: Number(e.target.value) })} />
            <b>{t.show}%</b>
          </label>
        )}
        {err && <p className="form-error">{err}</p>}

        <h3 className="studio-h">Floating</h3>
        <div className="row gap wrap">
          <button className={`btn${!t.fx ? ' on-btn' : ''}`} onClick={() => set({ fx: null })}>
            None
          </button>
          {FX_PRESETS.map(([id, icon]) => (
            <button
              key={id}
              className={`btn${t.fx?.preset === id ? ' on-btn' : ''}`}
              onClick={() => set({ fx: { preset: id } })}
              aria-label={id}
            >
              {icon}
            </button>
          ))}
          <button
            className={`btn${t.fx && !t.fx.preset ? ' on-btn' : ''}`}
            onClick={() => set({ fx: t.fx && !t.fx.preset ? t.fx : { kind: 'emoji', value: '🤖', motion: 'fall' } })}
          >
            Anything…
          </button>
        </div>
        {t.fx && !t.fx.preset && <CustomEffect value={t.fx} onChange={(fx) => set({ fx })} upload={upload} />}

        <div className="row gap">
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
