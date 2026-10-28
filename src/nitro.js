// Profile and app styles (the Nitro-style extras). Ids are saved in profiles,
// so keep them stable.
import { FX } from './fx/effects.js';

export const DECORATIONS = [
  { id: '', label: 'None' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'gold', label: 'Gold' },
  { id: 'neon', label: 'Neon' },
  { id: 'flame', label: 'Flames', badge: '🔥' },
  { id: 'crown', label: 'Crown', badge: '👑' },
  { id: 'gear', label: 'Gear', badge: '⚙️' },
  { id: 'robot', label: 'Robot', badge: '🤖' },
  { id: 'stars', label: 'Stars', badge: '⭐' },
  { id: 'cat', label: 'Cat', badge: '🐱' },
  { id: 'comets', label: 'Comets', anim: true },
  { id: 'flamering', label: 'Flame ring', anim: true },
  { id: 'electric', label: 'Electric', anim: true },
  { id: 'halo', label: 'Halo', anim: true },
  { id: 'ripple', label: 'Ripple', anim: true },
  { id: 'petals', label: 'Petals', anim: true },
  { id: 'circuit', label: 'Circuit', anim: true },
  { id: 'catears', label: 'Cat ears', anim: true },
  { id: 'bunny', label: 'Bunny ears', anim: true },
  { id: 'wizard', label: 'Wizard hat', anim: true },
  { id: 'horns', label: 'Horns', anim: true },
  { id: 'headphones', label: 'Headphones', anim: true },
  { id: 'antenna', label: 'Antenna', anim: true },
  { id: 'wings', label: 'Wings', anim: true },
  { id: 'custom', label: 'Custom…' },
];
export const decorationById = Object.fromEntries(DECORATIONS.map((d) => [d.id, d]));

// Profile effects: animated (fx/effects.js), or your own emoji/GIF/picture.
export const EFFECTS = [
  { id: '', label: 'None', icon: '' },
  ...Object.entries(FX).map(([id, f]) => ({ id, label: f.label, icon: f.icon })),
  { id: 'custom', label: 'Custom…', icon: '🎨' },
];

// How a custom effect moves.
export const MOTIONS = [
  { id: 'fall', label: '⬇ Fall' },
  { id: 'rise', label: '⬆ Rise' },
  { id: 'twinkle', label: '✨ Float' },
];
export const effectById = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

export const NAME_FONTS = [
  { id: '', label: 'Default', css: '' },
  { id: 'rounded', label: 'Rounded', css: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', css: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { id: 'script', label: 'Script', css: '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive' },
  { id: 'chunky', label: 'Chunky', css: '"Arial Black", "Helvetica Neue", Impact, sans-serif' },
  { id: 'pixel', label: 'Pixel', css: '"Press Start 2P", monospace', small: true },
  { id: 'arcade', label: 'Arcade', css: '"Silkscreen", monospace' },
  { id: 'comic', label: 'Comic', css: '"Bangers", cursive' },
  { id: 'marker', label: 'Marker', css: '"Permanent Marker", cursive' },
  { id: 'hand', label: 'Handwritten', css: '"Caveat", cursive' },
  { id: 'retro', label: 'Retro script', css: '"Pacifico", cursive' },
  { id: 'scifi', label: 'Sci-fi', css: '"Orbitron", sans-serif' },
  { id: 'bubble', label: 'Bubbly', css: '"Fredoka", sans-serif' },
  { id: 'poster', label: 'Poster', css: '"Bebas Neue", sans-serif' },
  { id: 'fancy', label: 'Fancy', css: '"Playfair Display", serif', italic: true },
  { id: 'typewriter', label: 'Typewriter', css: '"Special Elite", monospace' },
  { id: 'neonsign', label: 'Neon sign', css: '"Monoton", cursive' },
  { id: 'gothic', label: 'Gothic', css: '"UnifrakturMaguntia", serif' },
];
export const fontById = Object.fromEntries(NAME_FONTS.map((f) => [f.id, f]));

// Quick picks for name and profile colors.
export const SWATCHES = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f8fafc',
  '#64748b',
  '#111827',
];

// App color themes (per device), on top of light/dark.
export const PALETTES = [
  { id: '', label: 'Classic', colors: ['#4f46e5', '#4f46e5'] },
  { id: 'midnight', label: 'Midnight', colors: ['#6366f1', '#0ea5e9'] },
  { id: 'sunset', label: 'Sunset', colors: ['#f97316', '#db2777'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0891b2', '#2563eb'] },
  { id: 'forest', label: 'Forest', colors: ['#16a34a', '#0d9488'] },
  { id: 'candy', label: 'Cotton candy', colors: ['#ec4899', '#8b5cf6'] },
  { id: 'crimson', label: 'Crimson', colors: ['#dc2626', '#9f1239'] },
  { id: 'chroma', label: 'Chroma', colors: ['#f43f5e', '#22d3ee'] },
];

// Gradient color stops for 2–3 colors. Each color holds for part of its
// stretch before blending (sharp: 0 blends the whole way, 1 is hard bands),
// so gradients look crisp instead of smeared.
export const DEFAULT_SHARP = 0.35;
export function gradientStops(colors, sharp = DEFAULT_SHARP) {
  const cs = colors.filter(Boolean).slice(0, 3);
  if (cs.length < 2) return `${cs[0] || 'transparent'}, ${cs[0] || 'transparent'}`;
  const seg = 100 / cs.length;
  const hold = seg * sharp;
  return cs
    .map((c, i) => {
      const from = i === 0 ? 0 : (i + 0.5) * seg - hold / 2;
      const to = i === cs.length - 1 ? 100 : (i + 0.5) * seg + hold / 2;
      return `${c} ${from.toFixed(1)}% ${to.toFixed(1)}%`;
    })
    .join(', ');
}

// Nameplates: animated art behind your name in the members list and DMs.
export const NAMEPLATES = [
  { id: '', label: 'None' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'cyber', label: 'Cyber' },
  { id: 'fire', label: 'Fire' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'space', label: 'Space' },
  { id: 'sakura', label: 'Sakura' },
  { id: 'gold', label: 'Gold' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'rgb', label: 'RGB' },
  { id: 'gear', label: 'Gear' },
  { id: 'custom', label: 'Custom' },
];

// Display name effects, like Discord's display name styles.
export const NAME_EFFECTS = [
  { id: '', label: 'None' },
  { id: 'shimmer', label: '✨ Shimmer' },
  { id: 'neon', label: '💡 Neon' },
  { id: 'outline', label: '✏️ Outline' },
  { id: 'pop', label: '🧱 3D pop' },
  { id: 'glitch', label: '📺 Glitch' },
  { id: 'rainbow', label: '🌈 Rainbow' },
  { id: 'fire', label: '🔥 Fire' },
  { id: 'ice', label: '🧊 Ice' },
  { id: 'gold', label: '🏆 Gold' },
  { id: 'toon', label: '💥 Toon' },
  { id: 'sparkle', label: '✨ Glitter' },
  { id: 'pulse', label: '💓 Pulse' },
  { id: 'gear', label: '⚙️ Gear' },
];
const RAINBOW = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#d946ef', '#ef4444'];

// Inline style for a display name: chosen font, one color, or a 2–3 color
// gradient, plus what its effect needs (glow color, a moving gradient).
export function nameStyle(profile, fallbackColor) {
  const s = profile?.nameStyle || {};
  const style = {};
  const font = fontById[s.font]?.css;
  if (font) style.fontFamily = font;
  if (fontById[s.font]?.small) style.fontSize = '0.72em';
  if (fontById[s.font]?.italic) style.fontStyle = 'italic';
  const colors = (s.colors || []).filter(Boolean);
  const main = colors[0] || fallbackColor;
  if (main) style['--nglow'] = main;
  const clip = (image) => {
    style.backgroundImage = image;
    style.WebkitBackgroundClip = 'text';
    style.backgroundClip = 'text';
    style.color = 'transparent';
  };
  if (s.effect === 'fire') {
    clip('linear-gradient(0deg, #dc2626, #f97316 40%, #facc15 70%, #fef9c3)');
    style.backgroundSize = '100% 200%';
  } else if (s.effect === 'ice') {
    clip('linear-gradient(100deg, #0ea5e9, #bae6fd 40%, #ffffff 50%, #bae6fd 60%, #0ea5e9)');
    style.backgroundSize = '200% auto';
  } else if (s.effect === 'gold') {
    clip('linear-gradient(100deg, #92400e, #f59e0b 30%, #fef3c7 48%, #f59e0b 66%, #92400e)');
    style.backgroundSize = '220% auto';
  } else if (s.effect === 'sparkle') {
    const base =
      colors.length >= 2
        ? `linear-gradient(90deg, ${gradientStops(colors)})`
        : `linear-gradient(${main || '#a855f7'}, ${main || '#a855f7'})`;
    clip(
      `radial-gradient(circle at 20% 30%, #fff 0 1.2px, transparent 1.6px), radial-gradient(circle at 70% 60%, #fff 0 1px, transparent 1.4px), radial-gradient(circle at 45% 80%, #fff 0 1.3px, transparent 1.7px), ${base}`,
    );
    style.backgroundSize = '14px 14px, 18px 18px, 22px 22px, 100% 100%';
  } else if (s.effect === 'gear') {
    // Brushed steel (or your colors, polished), with a light sweeping across.
    const metal = colors.length
      ? colors.length >= 2
        ? colors
        : [main, `color-mix(in srgb, ${main} 55%, #0f172a)`]
      : ['#64748b', '#94a3b8'];
    clip(`linear-gradient(100deg, ${metal[1]}, ${metal[0]} 30%, #f8fafc 48%, ${metal[0]} 66%, ${metal[1]})`);
    style.backgroundSize = '220% auto';
    if (!colors.length) style['--nglow'] = '#94a3b8';
  } else if (s.effect === 'rainbow') {
    clip(`linear-gradient(90deg, ${RAINBOW.join(', ')})`);
    style.backgroundSize = '200% auto';
  } else if (s.effect === 'shimmer' && (colors.length || fallbackColor)) {
    // A light band sweeping across the name's colors.
    const cs = colors.length >= 2 ? [...colors, colors[0]] : [main, `color-mix(in srgb, ${main} 35%, white)`, main];
    clip(`linear-gradient(90deg, ${cs.join(', ')})`);
    style.backgroundSize = '200% auto';
  } else if (colors.length >= 2) clip(`linear-gradient(90deg, ${gradientStops(colors)})`);
  else if (main) style.color = main;
  return style;
}

// Props for a display name element: style, the effect's class, and the
// text (the glitch effect redraws it in its pseudo-elements).
export function nameProps(profile, fallbackColor, name, className = '') {
  const effect = profile?.nameStyle?.effect;
  return {
    className: `display-name ${className}${effect ? ` ne ne-${effect}` : ''}`,
    style: nameStyle(profile, fallbackColor),
    'data-text': name,
  };
}
