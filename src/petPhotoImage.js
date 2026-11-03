// The image steps behind a pet photo sticker: shrink, tidy the cut-out's
// edge, add the white sticker outline, and save a small PNG. The pixel
// functions work on plain arrays (so they run the same in tests); the canvas
// ones at the bottom do the browser parts. Only the finished sticker leaves the
// device; the original photo never does.

export const WORK_MAX = 1024; // the longest side the cut-out tool looks at
export const STICKER_MAX = 512; // the longest side of the finished sticker, outline included
export const OUTLINE = 6; // white sticker outline, in pixels
export const TARGET_BYTES = 250 * 1024; // aim for this
export const HARD_BYTES = 400 * 1024; // the storage rules refuse more

// The size to draw an image at so its longest side is at most `max` (never bigger).
export function fitSize(w, h, max) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), k };
}

// The box around everything at least `threshold` opaque, or null when there is none.
export function alphaBounds(rgba, w, h, threshold = 24) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (rgba[(y * w + x) * 4 + 3] >= threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Grows an alpha channel outward by `r` pixels, in a circle.
export function dilateAlpha(alpha, w, h, r) {
  const out = Uint8Array.from(alpha);
  const disk = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.5) disk.push([dx, dy]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = alpha[y * w + x];
      if (!a) continue;
      for (const [dx, dy] of disk) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const i = ny * w + nx;
        if (out[i] < a) out[i] = a;
      }
    }
  return out;
}

// Shrinks an alpha channel by one pixel (a plus-shaped neighbourhood), so the
// thin halo of the old background around a cut-out goes away.
export function erodeAlpha(alpha, w, h) {
  const out = Uint8Array.from(alpha);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let m = alpha[i];
      if (x > 0 && alpha[i - 1] < m) m = alpha[i - 1];
      if (x < w - 1 && alpha[i + 1] < m) m = alpha[i + 1];
      if (y > 0 && alpha[i - w] < m) m = alpha[i - w];
      if (y < h - 1 && alpha[i + w] < m) m = alpha[i + w];
      out[i] = m;
    }
  return out;
}

// Pushes a soft mask toward clean edges: below `lo` is gone, above `hi` is solid.
export function sharpenMask(mask, lo = 0.2, hi = 0.8) {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const t = Math.min(1, Math.max(0, (mask[i] / 255 - lo) / (hi - lo)));
    out[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return out;
}

// Adds `pad` transparent pixels around an RGBA image.
export function padRgba(rgba, w, h, pad) {
  const W = w + pad * 2;
  const H = h + pad * 2;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < h; y++) out.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), ((y + pad) * W + pad) * 4);
  return { data: out, w: W, h: H };
}

// The white sticker outline: the shape grown by `r` pixels, in white, behind
// the picture. The image needs at least `r` transparent pixels all around.
export function addOutline(rgba, w, h, r = OUTLINE) {
  const n = w * h;
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) alpha[i] = rgba[i * 4 + 3];
  const grown = dilateAlpha(alpha, w, h, r);
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const a = alpha[i] / 255;
    const d = grown[i] / 255;
    const A = a + (1 - a) * d; // the picture over the white outline
    if (A <= 0) continue;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = (rgba[i * 4 + c] * a + 255 * (1 - a) * d) / A;
    out[i * 4 + 3] = A * 255;
  }
  return out;
}

// Rounds the colors (not the see-through part) to fewer levels, which makes
// the PNG smaller. bits: how many low bits to drop.
export function quantize(rgba, bits) {
  if (!bits) return rgba;
  const out = new Uint8ClampedArray(rgba);
  const mask = 255 ^ ((1 << bits) - 1);
  const half = (1 << bits) >> 1;
  for (let i = 0; i < out.length; i += 4)
    if (out[i + 3]) {
      out[i] = Math.min(255, (out[i] & mask) + half);
      out[i + 1] = Math.min(255, (out[i + 1] & mask) + half);
      out[i + 2] = Math.min(255, (out[i + 2] & mask) + half);
    }
  return out;
}

// ---------- in the browser ----------

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const toPng = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t make the picture.'))), 'image/png'));

// A photo file as a canvas no longer than `max` on its long side (turned the
// right way up, as phones save them).
export async function loadWork(file, max = WORK_MAX) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older browsers: an <img> does the turning itself.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      bmp = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const w0 = bmp.width || bmp.naturalWidth;
  const h0 = bmp.height || bmp.naturalHeight;
  if (!w0 || !h0) throw new Error('That picture is empty.');
  const { w, h } = fitSize(w0, h0, max);
  const canvas = canvasOf(w, h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas;
}

// The photo with a mask (0 to 255, any square size) laid over it as its
// see-through part: the cut-out, at the photo's size.
export function applyMask(work, mask, mw, mh, { tidy = true } = {}) {
  const w = work.width;
  const h = work.height;
  const small = canvasOf(mw, mh);
  const sctx = small.getContext('2d');
  const id = sctx.createImageData(mw, mh);
  for (let i = 0; i < mask.length; i++) id.data[i * 4 + 3] = mask[i];
  sctx.putImageData(id, 0, 0);
  // Grow the mask to the photo's size (smoothly), then clean its edge there.
  const big = canvasOf(w, h);
  const bctx = big.getContext('2d');
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, w, h);
  const alpha = new Uint8Array(w * h);
  const bd = bctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < alpha.length; i++) alpha[i] = bd[i * 4 + 3];
  const clean = tidy ? erodeAlpha(sharpenMask(alpha), w, h) : alpha;
  const out = canvasOf(w, h);
  const octx = out.getContext('2d');
  octx.drawImage(work, 0, 0);
  const od = octx.getImageData(0, 0, w, h);
  for (let i = 0; i < clean.length; i++) od.data[i * 4 + 3] = clean[i];
  octx.putImageData(od, 0, 0);
  return out;
}

// A cut-out canvas (see-through background) as the finished sticker: trimmed
// to the pet, shrunk to fit STICKER_MAX with the outline, saved as a small
// PNG. Tries smaller and plainer versions until it is under TARGET_BYTES.
export async function makeSticker(cut, { max = STICKER_MAX, outline = OUTLINE } = {}) {
  const w = cut.width;
  const h = cut.height;
  const data = cut.getContext('2d').getImageData(0, 0, w, h).data;
  const box = alphaBounds(data, w, h);
  if (!box) throw new Error('Nothing is left of the picture.');
  const inner = Math.max(32, max - outline * 2);
  const size = fitSize(box.w, box.h, inner);
  // Full size first; then plainer colors; then a bit smaller each time.
  const steps = [];
  for (let s = 1; s > 0.45; s *= 0.88) steps.push([s, 0], [s, 2]);
  let last = null;
  for (const [s, bits] of steps) {
    const cw = Math.max(8, Math.round(size.w * s));
    const ch = Math.max(8, Math.round(size.h * s));
    // The trimmed pet at its final size, with room all round for the outline.
    const small = canvasOf(cw, ch);
    const sctx = small.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(cut, box.x, box.y, box.w, box.h, 0, 0, cw, ch);
    const padded = padRgba(sctx.getImageData(0, 0, cw, ch).data, cw, ch, outline);
    const done = addOutline(padded.data, padded.w, padded.h, outline);
    const out = canvasOf(padded.w, padded.h);
    out.getContext('2d').putImageData(new ImageData(quantize(done, bits), padded.w, padded.h), 0, 0);
    const blob = await toPng(out);
    last = { blob, canvas: out, w: padded.w, h: padded.h };
    if (blob.size <= TARGET_BYTES) return last;
  }
  if (last && last.blob.size <= HARD_BYTES) return last;
  throw new Error('That sticker came out too big. Try a simpler picture.');
}

// The manual way: a picture cropped to a rounded square with no cut-out
// (the profile picture cropper's way), for when the cut-out tool can't run.
export function roundedCrop(work, { x, y, size, radius = 0.18 }, out = 480) {
  const canvas = canvasOf(out, out);
  const ctx = canvas.getContext('2d');
  const r = out * radius;
  // (roundRect needs a newer Safari than arcTo does.)
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(out, 0, out, out, r);
  ctx.arcTo(out, out, 0, out, r);
  ctx.arcTo(0, out, 0, 0, r);
  ctx.arcTo(0, 0, out, 0, r);
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(work, x, y, size, size, 0, 0, out, out);
  return canvas;
}
