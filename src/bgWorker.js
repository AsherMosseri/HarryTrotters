// The cut-out tool's worker: downloads (once) and runs the background-removal
// network off the main thread, so the page keeps scrolling while it thinks.
// Asked from src/bgRemove.js; it never starts on its own. Messages:
//   { type: 'load' }                  -> { type: 'progress', done, total } ..., then { type: 'ready', stats }
//   { type: 'run', rgba, w, h }       -> { type: 'mask', mask, size, ms }   (rgba is the photo, w x h = MODEL_SIZE square)
// Failures come back as { type: 'error', code, message } with a code the page
// understands: offline, blocked, integrity, memory, runtime.
import { CACHE_NAME, CUTOUT_FILES, MODEL_SIZE } from './cutoutFiles.js';

let session = null;
let ort = null;
let aborter = null;

const fail = (code, message) => {
  const e = new Error(message);
  e.code = code;
  return e;
};
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// One file: from the saved copy if there is one, else downloaded (with
// progress), checked, and saved for next time.
async function bytesOf(file, cache, onBytes) {
  const hit = await cache.match(file.url).catch(() => null);
  if (hit) {
    const buf = await hit.arrayBuffer();
    if (buf.byteLength === file.size) {
      onBytes(buf.byteLength);
      return buf;
    }
    await cache.delete(file.url).catch(() => {});
  }
  let res;
  try {
    res = await fetch(file.url, { signal: aborter.signal, mode: 'cors', credentials: 'omit' });
  } catch (e) {
    if (e?.name === 'AbortError') throw fail('cancelled', 'Cancelled.');
    throw fail(navigator.onLine === false ? 'offline' : 'blocked', 'Couldn’t reach the download.');
  }
  if (!res.ok) throw fail('blocked', `The download answered ${res.status}.`);
  const out = new Uint8Array(file.size);
  let at = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (at + value.length > out.length) throw fail('integrity', 'The download was a different size than expected.');
      out.set(value, at);
      at += value.length;
      onBytes(value.length);
    }
  } catch (e) {
    if (e?.code) throw e;
    if (e?.name === 'AbortError') throw fail('cancelled', 'Cancelled.');
    throw fail(navigator.onLine === false ? 'offline' : 'blocked', 'The download was cut off.');
  }
  if (at !== file.size) throw fail('integrity', 'The download was a different size than expected.');
  if (hex(await crypto.subtle.digest('SHA-256', out)) !== file.sha) throw fail('integrity', 'The download didn’t match what it should be.');
  // Saved only once it is whole and checked, so a cut-off download never sticks.
  await cache.put(file.url, new Response(out, { headers: { 'content-type': file.type, 'content-length': String(file.size) } })).catch(() => {});
  return out.buffer;
}

async function load() {
  const t0 = performance.now();
  aborter = new AbortController();
  const cache = await caches.open(CACHE_NAME);
  const total = CUTOUT_FILES.reduce((n, f) => n + f.size, 0);
  let done = 0;
  const tell = (n) => {
    done += n;
    postMessage({ type: 'progress', done, total });
  };
  const got = {};
  // One after another: a phone doesn't need four downloads fighting.
  for (const f of CUTOUT_FILES) got[f.key] = await bytesOf(f, cache, tell);
  const t1 = performance.now();
  const blob = (key, type) => URL.createObjectURL(new Blob([got[key]], { type }));
  try {
    ort = await import(/* @vite-ignore */ blob('bundle', 'text/javascript'));
    ort.env.wasm.wasmPaths = { mjs: blob('mjs', 'text/javascript'), wasm: blob('wasm', 'application/wasm') };
    // Pages on GitHub aren't cross-origin isolated, so there are no threads
    // to share: one, in this worker.
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(new Uint8Array(got.model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  } catch (e) {
    throw fail(/memory|alloc|RangeError/i.test(`${e?.name} ${e?.message}`) ? 'memory' : 'runtime', e?.message || 'The tool couldn’t start.');
  }
  for (const k of Object.keys(got)) got[k] = null; // the runtime holds its own copy now
  return { download: Math.round(t1 - t0), start: Math.round(performance.now() - t1) };
}

async function run({ rgba, w, h }) {
  if (!session) throw fail('runtime', 'The tool isn’t ready.');
  const t0 = performance.now();
  const n = w * h;
  const f = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    f[i] = rgba[i * 4] / 255 - 0.5;
    f[n + i] = rgba[i * 4 + 1] / 255 - 0.5;
    f[2 * n + i] = rgba[i * 4 + 2] / 255 - 0.5;
  }
  let out;
  try {
    const res = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', f, [1, 3, h, w]) });
    out = res[session.outputNames[0]].data;
  } catch (e) {
    throw fail(/memory|alloc|RangeError/i.test(`${e?.name} ${e?.message}`) ? 'memory' : 'runtime', e?.message || 'The cut-out failed.');
  }
  // The network answers 0 to 1 (how much of each spot is the subject); stretch
  // it to fill 0 to 255 so a weak answer still makes a clear edge.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < out.length; i++) {
    if (out[i] < lo) lo = out[i];
    if (out[i] > hi) hi = out[i];
  }
  const span = hi - lo || 1;
  const mask = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) mask[i] = Math.round(((out[i] - lo) / span) * 255);
  return { mask, ms: Math.round(performance.now() - t0) };
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') postMessage({ type: 'ready', stats: await load() });
    else if (m.type === 'run') {
      const r = await run(m);
      postMessage({ type: 'mask', mask: r.mask, size: MODEL_SIZE, ms: r.ms }, [r.mask.buffer]);
    } else if (m.type === 'cancel') aborter?.abort();
  } catch (err) {
    postMessage({ type: 'error', code: err.code || 'runtime', message: err.message || String(err) });
  }
};
