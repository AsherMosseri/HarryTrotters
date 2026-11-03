// Cutting a pet out of its photo, on the device (3.0.9). Nothing here runs
// until someone taps "Add a photo of your real pet" and picks a picture: the
// tool (about 47 MB the first time, then kept in the browser) is fetched then,
// in a worker (src/bgWorker.js), never at app start and never in the app's
// own files. The photo itself never leaves the device.
//
//   cutoutSupport()      can this device even try? { ok, warn, reason }
//   cutoutCached()       is the tool already saved on this device?
//   clearCutoutTool()    forget the saved copy (frees about 47 MB)
//   createCutter()       { start(onProgress), cut(canvas), cancel(), dispose() }
//
// When the tool can't load or run (offline, blocked, out of memory, an old
// browser), cut() and start() throw an error with a `code`, and the page
// offers the manual crop instead, so adding a photo never dead-ends.
import { CACHE_NAME, CUTOUT_FILES, DOWNLOAD_MB, MODEL_SIZE } from './cutoutFiles.js';
import { applyMask } from './petPhotoImage.js';

export { DOWNLOAD_MB };
const MODEL_URL = CUTOUT_FILES.find((f) => f.key === 'model').url;

// A quick look at the device. Very small memory (2 GB or less, where the
// browser tells us) skips the tool; the rest is tried and falls back if it fails.
export function cutoutSupport() {
  if (typeof WebAssembly !== 'object') return { ok: false, reason: 'This browser can’t run the cut-out tool.' };
  if (typeof Worker === 'undefined' || typeof caches === 'undefined' || !globalThis.crypto?.subtle)
    return { ok: false, reason: 'This browser can’t run the cut-out tool.' };
  const gb = navigator.deviceMemory;
  if (gb && gb <= 2) return { ok: false, soft: true, reason: 'This device is short on memory for the automatic cut-out.' };
  return { ok: true };
}

export async function cutoutCached() {
  try {
    return !!(await (await caches.open(CACHE_NAME)).match(MODEL_URL));
  } catch {
    return false;
  }
}

export async function clearCutoutTool() {
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    /* nothing saved */
  }
}

const fail = (code, message) => Object.assign(new Error(message), { code });

// One worker for one sitting: start() gets it ready, cut() can be called more
// than once (a retake), dispose() lets the memory go.
export function createCutter() {
  let worker = null;
  let ready = null;
  let pending = null;
  let stop = null; // rejects what is being waited for (Cancel)
  let stats = {};

  const spawn = () => {
    try {
      worker = new Worker(new URL('./bgWorker.js', import.meta.url), { type: 'module' });
    } catch {
      throw fail('unsupported', 'This browser can’t run the cut-out tool.');
    }
    worker.onmessage = (e) => pending?.(e.data);
    worker.onerror = () => pending?.({ type: 'error', code: 'runtime', message: 'The cut-out tool stopped.' });
  };
  // Waits for the worker's next answer of one of these types.
  const wait = (types, onProgress) =>
    new Promise((resolve, reject) => {
      stop = () => reject(fail('cancelled', 'Cancelled.'));
      pending = (m) => {
        if (m.type === 'progress') return onProgress?.(m.done, m.total);
        if (m.type === 'error') {
          pending = null;
          return reject(fail(m.code, m.message));
        }
        if (types.includes(m.type)) {
          pending = null;
          resolve(m);
        }
      };
    });

  return {
    get stats() {
      return stats;
    },
    // Downloads the tool if this device doesn't have it yet, and starts it.
    start(onProgress) {
      if (ready) return ready;
      spawn();
      worker.postMessage({ type: 'load' });
      ready = wait(['ready'], onProgress).then((m) => {
        stats = { ...stats, ...m.stats };
      });
      ready.catch(() => {});
      return ready;
    },
    // The canvas (the photo, up to 1024 on its long side) with its background
    // gone: a canvas the same size, see-through where the background was.
    async cut(work) {
      await this.start();
      // The network looks at a square; the photo is stretched to it and the
      // answer is stretched back.
      const sq = document.createElement('canvas');
      sq.width = sq.height = MODEL_SIZE;
      const ctx = sq.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(work, 0, 0, MODEL_SIZE, MODEL_SIZE);
      const rgba = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
      const answer = wait(['mask']);
      worker.postMessage({ type: 'run', rgba, w: MODEL_SIZE, h: MODEL_SIZE }, [rgba.buffer]);
      const m = await answer;
      stats = { ...stats, infer: m.ms };
      return applyMask(work, m.mask, m.size, m.size);
    },
    cancel() {
      worker?.postMessage({ type: 'cancel' });
      const reject = stop;
      this.dispose();
      reject?.();
    },
    dispose() {
      worker?.terminate();
      worker = null;
      ready = null;
      pending = null;
    },
  };
}
