// Profile and app styles (the Nitro-style extras). Ids are saved in profiles,
// so keep them stable.
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
  { id: 'custom', label: 'Custom…' },
];
export const decorationById = Object.fromEntries(DECORATIONS.map((d) => [d.id, d]));

// Particles that drift over the profile card.
export const EFFECTS = [
  { id: '', label: 'None', icon: '' },
  { id: 'confetti', label: 'Confetti', icon: '🎉' },
  { id: 'sparkles', label: 'Sparkles', icon: '✨' },
  { id: 'snow', label: 'Snow', icon: '❄️' },
  { id: 'hearts', label: 'Hearts', icon: '💖' },
  { id: 'fire', label: 'Fire', icon: '🔥' },
  { id: 'gears', label: 'Gears', icon: '⚙️' },
  { id: 'bubbles', label: 'Bubbles', icon: '🫧' },
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

// Inline style for a display name: chosen font, one color, or a 2–3 color gradient.
export function nameStyle(profile, fallbackColor) {
  const s = profile?.nameStyle || {};
  const style = {};
  const font = fontById[s.font]?.css;
  if (font) style.fontFamily = font;
  const colors = (s.colors || []).filter(Boolean);
  if (colors.length >= 2) {
    style.backgroundImage = `linear-gradient(90deg, ${gradientStops(colors)})`;
    style.WebkitBackgroundClip = 'text';
    style.backgroundClip = 'text';
    style.color = 'transparent';
  } else if (colors.length === 1) style.color = colors[0];
  else if (fallbackColor) style.color = fallbackColor;
  return style;
}
