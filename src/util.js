import { useEffect, useState } from 'react';

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || name;
}

export function colorFor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 62% 46%)`;
}

export function relTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fullTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// dueDate is a local 'YYYY-MM-DD' string.
export function dueInfo(dueDate, status) {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const days = Math.round((due - startOfToday()) / 86400000);
  const short = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (status === 'done') return { label: short, tone: 'muted' };
  if (days < 0) return { label: days === -1 ? 'Yesterday' : `${-days}d overdue`, tone: 'overdue', title: short };
  if (days === 0) return { label: 'Today', tone: 'soon' };
  if (days === 1) return { label: 'Tomorrow', tone: 'soon' };
  if (days < 7) return { label: due.toLocaleDateString(undefined, { weekday: 'short' }), tone: 'normal', title: short };
  return { label: short, tone: 'normal' };
}

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

async function decodeImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older Safari: fall back to an <img>, which also applies EXIF rotation.
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img;
  }
}

function toJpeg(source, srcW, srcH, maxSize, quality) {
  const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo."))), 'image/jpeg', quality),
  );
}

// iPad photos are several MB: make a 1600px copy to view and a 480px thumbnail.
export async function preparePhoto(file) {
  const img = await decodeImage(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const [full, thumb] = await Promise.all([toJpeg(img, width, height, 1600, 0.82), toJpeg(img, width, height, 480, 0.75)]);
  if (img.close) img.close();
  else URL.revokeObjectURL(img.src);
  return { full, thumb, width, height };
}

// True while a media query matches (e.g. phone width), updating live.
export function useMedia(query) {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(query);
    const update = () => setOn(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);
  return on;
}
