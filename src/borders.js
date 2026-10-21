// Custom borders for your profile card and your chat messages.
// cfg = { style, colors: [a, b, c?], width (px), radius (px), anim: '' | 'spin' | 'shimmer' | 'pulse' }
import { gradientStops } from './nitro.js';

export const BORDER_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'double', label: 'Double' },
  { id: 'glow', label: 'Glow' },
];
export const BORDER_ANIMS = [
  { id: '', label: 'Still' },
  { id: 'spin', label: '🌀 Spin' },
  { id: 'shimmer', label: '✨ Shimmer' },
  { id: 'pulse', label: '💓 Pulse' },
];
export const DEFAULT_BORDER = { style: 'gradient', colors: ['#8b5cf6', '#ec4899'], width: 3, radius: 16, anim: '' };
const RAINBOW = '#ef4444, #f97316, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444';

// className and style for the bordered element. `inner` is the color inside
// the border (gradient borders paint it as the padding-box layer).
export function borderProps(cfg, inner = 'var(--surface)') {
  if (!cfg || !cfg.style || cfg.style === 'none') return { className: '', style: undefined };
  const colors = (cfg.colors || []).filter(Boolean);
  const a = colors[0] || '#8b5cf6';
  const w = cfg.width ?? 3;
  const style = { '--cb-glow': a };
  if (cfg.radius != null) style.borderRadius = `${cfg.radius}px`;
  const anim = cfg.anim || '';
  if (cfg.style === 'gradient' || cfg.style === 'rainbow') {
    const spinning = anim === 'spin';
    const list = cfg.style === 'rainbow' ? RAINBOW : colors.length > 1 ? colors.concat(colors[0]).join(', ') : `${a}, ${a}`;
    const grad = spinning
      ? `conic-gradient(from var(--cb-angle), ${list})`
      : cfg.style === 'rainbow'
        ? `linear-gradient(135deg, ${RAINBOW})`
        : `linear-gradient(135deg, ${gradientStops(colors.length > 1 ? colors : [a, a])})`;
    style.border = `${w}px solid transparent`;
    style.background = `linear-gradient(${inner}, ${inner}) padding-box, ${grad} border-box`;
    if (anim === 'shimmer') style.backgroundSize = '100% 100%, 300% 300%';
  } else if (cfg.style === 'glow') {
    style.border = `${w}px solid ${a}`;
    style.boxShadow = `0 0 ${w * 2 + 8}px ${a}`;
  } else {
    style.border = `${cfg.style === 'double' ? Math.max(3, w) : w}px ${cfg.style} ${a}`;
  }
  return { className: `custom-border${anim ? ` cb-${anim}` : ''}`, style };
}
