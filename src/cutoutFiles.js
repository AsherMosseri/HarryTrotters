// What the cut-out tool downloads, the first time someone uses it (never at
// app start). The tool is ONNX Runtime Web (MIT) running a small
// background-removal network (RMBG-1.4, quantized, from BRIA AI: free for
// non-commercial use) fully inside the browser; nothing about the photo is
// sent anywhere. Every file is pinned to an exact version and checked against
// its SHA-256 after download, then kept in the browser's Cache Storage so the
// next use is instant and works offline. The app itself is not served from
// these hosts; only these files are fetched from them, on demand.
export const CACHE_NAME = 'pet-cutout-v1';
export const ORT_VERSION = '1.30.0';
const ORT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_REV = '2ceba5a5efaec153162aedea169f76caf9b46cf8';

// size: bytes once downloaded (progress counts these).
export const CUTOUT_FILES = [
  {
    key: 'bundle',
    url: `${ORT}ort.wasm.bundle.min.mjs`,
    size: 73054,
    sha: '11e64bd8ffe11bd1a2a2f0d6275fdfbbba7262f0b76b99b53d228a8a22ef3d90',
    type: 'text/javascript',
  },
  {
    key: 'mjs',
    url: `${ORT}ort-wasm-simd-threaded.mjs`,
    size: 24381,
    sha: 'e13f7f94fc51b4ca72b12faeb1ee95f4ace6dfbc8939bc718aabdc0a27c4299b',
    type: 'text/javascript',
  },
  {
    key: 'wasm',
    url: `${ORT}ort-wasm-simd-threaded.wasm`,
    size: 14239897,
    sha: '3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2',
    type: 'application/wasm',
  },
  {
    key: 'model',
    url: `https://huggingface.co/briaai/RMBG-1.4/resolve/${MODEL_REV}/onnx/model_quantized.onnx`,
    size: 44403226,
    sha: 'a6648479275dfd0ede0f3a8abc20aa5c437b394681b05e5af6d268250aaf40f3',
    type: 'application/octet-stream',
  },
];
export const MODEL_SIZE = 1024; // the network looks at a fixed 1024 x 1024 picture
// What people are told: what actually crosses the wire (the runtime's wasm
// travels compressed, about 3 MB).
export const DOWNLOAD_MB = 47;
export const STORED_MB = 59; // what the saved copy takes on the device
