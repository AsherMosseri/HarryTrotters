import { useEffect, useRef, useState } from 'react';
import { CAPTION_MAX } from '../../functions/shared/petphotos.js';
import { useMarket } from '../market.js';
import { useEscape } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';
import { PetArt } from './PetArt.jsx';
import { Icon } from './shell/icons.jsx';
import sampleDog from '../assets/pet-sample-dog.png';
import { DOWNLOAD_MB, STORED_MB } from '../cutoutFiles.js';

// Adding a photo of your real pet: pick a picture, the app cuts the pet out
// on this device (src/bgRemove.js; the first time it downloads the tool, about
// 47 MB), you touch up the edge, see it as a sticker, and send it to team
// management. The original photo never leaves the device. If the tool can't
// run, you crop the picture yourself instead, so this never dead-ends.
// This file loads only when someone opens it (React.lazy in PetPhoto.jsx).

const kb = (n) => `${Math.round(n / 1024)} KB`;
const isDemo = () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-demo');

// What went wrong, in plain words, and what happens next.
const WHY = {
  offline: 'There’s no internet right now, and the cut-out tool isn’t saved on this device yet.',
  blocked: 'The cut-out tool couldn’t be downloaded (this network may block it).',
  integrity: 'The cut-out tool didn’t download properly.',
  memory: 'This device ran out of memory for the automatic cut-out.',
  unsupported: 'This browser can’t run the cut-out tool.',
  runtime: 'The cut-out tool stopped working.',
};

// Everything the dialog needs from the image code, loaded together (a separate
// download from the app, so the app itself stays small).
let toolsLoad = null;
const tools = () => (toolsLoad ||= Promise.all([import('../bgRemove.js'), import('../petPhotoImage.js')]).then(([bg, img]) => ({ bg, img })));

export default function PetPhotoDialog({ pet, onClose, onToast }) {
  const market = useMarket();
  const [step, setStep] = useState('pick'); // pick, busy, adjust, crop, making, preview
  const [work, setWork] = useState(null); // the photo, shrunk to 1024 on its long side
  const [cut, setCut] = useState(null); // the cut-out, same size
  const [sticker, setSticker] = useState(null); // { blob, url, w, h }
  const [from, setFrom] = useState('adjust'); // where Back goes from the preview
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [err, setErr] = useState('');
  const [why, setWhy] = useState(''); // why the automatic cut-out wasn't used
  const [cached, setCached] = useState(null);
  const [sending, setSending] = useState(false);
  const cutter = useRef(null);
  const input = useRef(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    tools().then(({ bg }) => bg.cutoutCached().then(setCached));
    return () => {
      live.current = false;
      cutter.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!sticker) return;
    return () => URL.revokeObjectURL(sticker.url);
  }, [sticker]);

  const close = () => {
    cutter.current?.dispose();
    onClose();
  };
  useEscape(() => (step === 'busy' ? cancel() : sending || close()));

  const cancel = () => {
    cutter.current?.cancel();
    cutter.current = null;
    setStep('pick');
  };

  const choose = async (file) => {
    setErr('');
    setWhy('');
    if (!file) return;
    if (file.size > 30e6) return setErr('That file is very large (over 30 MB). Pick a smaller picture.');
    setStep('busy');
    setPhase('open');
    try {
      const { bg, img } = await tools();
      let w;
      try {
        w = await img.loadWork(file);
      } catch {
        setStep('pick');
        return setErr('Couldn’t open that picture. If it came from a camera as HEIC, take a new photo or pick a JPEG.');
      }
      setWork(w);
      const can = bg.cutoutSupport();
      if (!can.ok) {
        setWhy(`${can.reason} You can crop the picture yourself instead.`);
        return setStep('crop');
      }
      await autoCut(w, bg);
    } catch (e) {
      if (live.current) {
        setStep('pick');
        setErr(e?.message || 'That didn’t work. Try another picture.');
      }
    }
  };

  const autoCut = async (w, bg) => {
    setStep('busy');
    setProgress(0);
    setPhase(cached ? 'open' : 'download');
    const c = (cutter.current ||= bg.createCutter());
    try {
      await c.start((done, total) => live.current && setProgress(done / total));
      if (!live.current) return;
      setPhase('cut');
      const result = await c.cut(w);
      // Let the tool's memory go right away (about a gigabyte while it runs);
      // a retake loads it again from this device in a couple of seconds.
      window.__cutoutStats = { ...c.stats };
      c.dispose();
      cutter.current = null;
      if (!live.current) return;
      setCut(result);
      setCached(true);
      setStep('adjust');
    } catch (e) {
      cutter.current?.dispose();
      cutter.current = null;
      if (!live.current || e?.code === 'cancelled') return;
      setWhy(`${WHY[e?.code] || WHY.runtime} You can crop the picture yourself instead.`);
      setStep('crop');
    }
  };

  // The finished PNG sticker from a cut-out canvas.
  const finish = async (canvas, back) => {
    setStep('making');
    setErr('');
    try {
      const { img } = await tools();
      const s = await img.makeSticker(canvas);
      if (!live.current) return;
      setSticker({ ...s, url: URL.createObjectURL(s.blob) });
      setFrom(back);
      setStep('preview');
    } catch (e) {
      if (!live.current) return;
      setErr(e?.message || 'Couldn’t make the sticker.');
      setStep(back);
    }
  };

  const useSample = async () => {
    setErr('');
    setStep('making');
    try {
      const { img } = await tools();
      const im = new Image();
      im.src = sampleDog;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      const s = await img.makeSticker(c);
      setSticker({ ...s, url: URL.createObjectURL(s.blob) });
      setWork(null);
      setFrom('pick');
      setStep('preview');
    } catch {
      setErr('Couldn’t load the sample.');
      setStep('pick');
    }
  };

  const send = async () => {
    setSending(true);
    setErr('');
    const r = await market.photos.submit(sticker.blob, caption);
    if (!live.current) return;
    setSending(false);
    if (r?.ok) {
      onToast('Sent. Team management will look at it.');
      close();
    } else setErr([r?.note?.title, r?.note?.body].filter(Boolean).join(' ') || 'That didn’t go through.');
  };

  const first = (pet?.name || 'your pet').split(' ')[0];
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={() => step !== 'busy' && !sending && close()}>
        <div className="dialog pp-dialog" role="dialog" aria-label="Photo of your real pet" onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>Photo of your real pet</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={step === 'busy' ? cancel : close} aria-label={step === 'busy' ? 'Cancel' : 'Close'} disabled={sending}>
              <CloseIcon />
            </button>
          </div>

          {step === 'pick' && (
            <div className="pp-body">
              <p className="small">
                Pick a photo of your real pet. The app cuts the pet out of the background right on this device; the original photo never leaves it. Only the
                cut-out is sent, and team management looks at it before anyone else sees it.
              </p>
              <p className="muted small">
                {cached
                  ? 'The cut-out tool is already on this device.'
                  : `The first time, the app gets the cut-out tool: about ${DOWNLOAD_MB} MB, one time. Wi-Fi is best. It stays on this device after that.`}
              </p>
              <input
                ref={input}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  choose(f);
                }}
              />
              <div className="row gap wrap">
                <button className="btn primary" onClick={() => input.current?.click()}>
                  <Icon name="camera" size={16} /> Choose a photo
                </button>
                {isDemo() && (
                  <button className="btn" onClick={useSample}>
                    Use the sample dog
                  </button>
                )}
              </div>
              {err && (
                <p className="danger small" role="alert">
                  {err}
                </p>
              )}
              {cached && (
                <button
                  className="link-btn small pp-forget"
                  onClick={async () => {
                    const { bg } = await tools();
                    await bg.clearCutoutTool();
                    setCached(false);
                  }}
                >
                  Remove the cut-out tool from this device (frees about {STORED_MB} MB)
                </button>
              )}
            </div>
          )}

          {step === 'busy' && (
            <div className="pp-body" aria-live="polite">
              {phase === 'download' ? (
                <>
                  <p>
                    <b>Getting the cut-out tool</b>, one time, about {DOWNLOAD_MB} MB.
                  </p>
                  <div className="pp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Download">
                    <span style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
                  </div>
                  <p className="muted small mono">
                    {Math.round(progress * 100)}%
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <b>{phase === 'cut' ? `Cutting ${first}’s photo out…` : 'Getting ready…'}</b>
                  </p>
                  <div className="pp-bar indeterminate" role="progressbar" aria-label="Working">
                    <span />
                  </div>
                  <p className="muted small">{phase === 'cut' ? 'This can take 10 to 30 seconds on a tablet. You can keep this open.' : 'Opening the cut-out tool.'}</p>
                </>
              )}
              <div className="row gap">
                <button className="btn" onClick={cancel}>
                  Cancel
                </button>
                {phase !== 'open' && (
                  <button
                    className="link-btn small"
                    onClick={() => {
                      cutter.current?.cancel();
                      cutter.current = null;
                      setWhy('Okay, crop it yourself.');
                      setStep('crop');
                    }}
                  >
                    Crop it myself instead
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'adjust' && work && cut && <Touchup work={work} cut={cut} onBack={() => setStep('pick')} onDone={(c) => finish(c, 'adjust')} err={err} />}

          {step === 'crop' && work && (
            <div className="pp-body">
              {why && <p className="small pp-why">{why}</p>}
              <ManualCrop
                work={work}
                onBack={() => setStep('pick')}
                onDone={async (canvas) => {
                  await finish(canvas, 'crop');
                }}
              />
              {err && (
                <p className="danger small" role="alert">
                  {err}
                </p>
              )}
            </div>
          )}

          {step === 'making' && (
            <div className="pp-body" aria-live="polite">
              <p>
                <b>Making the sticker…</b>
              </p>
              <div className="pp-bar indeterminate" role="progressbar" aria-label="Working">
                <span />
              </div>
            </div>
          )}

          {step === 'preview' && sticker && (
            <div className="pp-body">
              <p className="small">This is how it will look. Team management sees it first; everyone else sees it once it’s approved.</p>
              <div className="pp-previews">
                <div className="pp-tile light" title="On a light background">
                  <img src={sticker.url} alt="The sticker on a light background" width={sticker.w} height={sticker.h} />
                </div>
                <div className="pp-tile dark" title="On a dark background">
                  <img src={sticker.url} alt="The sticker on a dark background" width={sticker.w} height={sticker.h} />
                </div>
                <div className="pp-tile pp-checker" title="See-through parts">
                  <img src={sticker.url} alt="The sticker on a checkerboard, to show what is see-through" width={sticker.w} height={sticker.h} />
                </div>
              </div>
              <div className="pp-beside">
                {pet && (
                  <span className="pet-stage">
                    <PetArt species={pet.species} mood="happy" stage="young" size={84} still />
                  </span>
                )}
                <span className="pp-sticker" style={{ '--pp': '84px', '--ar': Math.min(1.5, Math.max(0.55, sticker.w / sticker.h)) }}>
                  <img src={sticker.url} alt="" width={84} height={84} />
                </span>
              </div>
              <label className="field-label" htmlFor="pp-caption">
                Its name (optional)
              </label>
              <input
                id="pp-caption"
                className="input"
                maxLength={CAPTION_MAX}
                value={caption}
                placeholder="Ruby"
                onChange={(e) => setCaption(e.target.value)}
              />
              <p className="muted tiny">
                <span className="mono">{kb(sticker.blob.size)}</span> sticker. Not happy with it? Go back and touch it up, or start over with another photo.
              </p>
              {err && (
                <p className="danger small" role="alert">
                  {err}
                </p>
              )}
              <div className="row gap wrap">
                <button className="btn primary" onClick={send} disabled={sending}>
                  {sending ? 'Sending…' : 'Send to team management'}
                </button>
                {from !== 'pick' && (
                  <button className="btn" onClick={() => setStep(from)} disabled={sending}>
                    Back
                  </button>
                )}
                <button
                  className="link-btn small"
                  disabled={sending}
                  onClick={() => {
                    setSticker(null);
                    setStep('pick');
                  }}
                >
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// The touch-up step: the cut-out on a checkerboard with an eraser and a
// brush to put parts back (round, soft to the touch of a finger). The mask is
// its own canvas; the picture shown is the photo seen through it.
function Touchup({ work, cut, onBack, onDone, err }) {
  const view = useRef(null);
  const mask = useRef(null);
  const undo = useRef([]);
  const last = useRef(null);
  const [tool, setTool] = useState('erase');
  const [size, setSize] = useState(4); // percent of the picture's width
  const [steps, setSteps] = useState(0);
  const W = work.width;
  const H = work.height;

  const paint = () => {
    const v = view.current?.getContext('2d');
    if (!v || !mask.current) return;
    v.globalCompositeOperation = 'source-over';
    v.clearRect(0, 0, W, H);
    v.drawImage(work, 0, 0);
    v.globalCompositeOperation = 'destination-in';
    v.drawImage(mask.current, 0, 0);
    v.globalCompositeOperation = 'source-over';
  };
  useEffect(() => {
    const m = document.createElement('canvas');
    m.width = W;
    m.height = H;
    m.getContext('2d').drawImage(cut, 0, 0);
    mask.current = m;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut]);

  const snapshot = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d').drawImage(mask.current, 0, 0);
    undo.current = [...undo.current.slice(-5), c];
    setSteps(undo.current.length);
  };
  const at = (e) => {
    const r = view.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const stroke = (a, b) => {
    const ctx = mask.current.getContext('2d');
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = (W * size) / 100;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    paint();
  };
  const back = () => {
    const c = undo.current.pop();
    if (!c) return;
    const ctx = mask.current.getContext('2d');
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(c, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    setSteps(undo.current.length);
    paint();
  };
  const reset = () => {
    snapshot();
    const ctx = mask.current.getContext('2d');
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(cut, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    paint();
  };
  const done = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(work, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask.current, 0, 0);
    onDone(c);
  };

  return (
    <div className="pp-body">
      <p className="small">Here is the cut-out. Erase anything left over, or paint back a part that got cut off.</p>
      <div className="pp-checker pp-canvas-wrap" style={{ aspectRatio: `${W} / ${H}` }}>
        <canvas
          ref={view}
          width={W}
          height={H}
          className="pp-canvas"
          aria-label="The cut-out. Drag to erase or paint back."
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            snapshot();
            last.current = at(e);
            stroke(last.current, last.current);
          }}
          onPointerMove={(e) => {
            if (!last.current) return;
            const p = at(e);
            stroke(last.current, p);
            last.current = p;
          }}
          onPointerUp={() => (last.current = null)}
          onPointerCancel={() => (last.current = null)}
        />
      </div>
      <div className="pp-tools">
        <div className="segmented" role="radiogroup" aria-label="Brush">
          <button role="radio" aria-checked={tool === 'erase'} className={tool === 'erase' ? 'active' : ''} onClick={() => setTool('erase')}>
            Erase
          </button>
          <button role="radio" aria-checked={tool === 'restore'} className={tool === 'restore' ? 'active' : ''} onClick={() => setTool('restore')}>
            Paint back
          </button>
        </div>
        <label className="row gap small pp-size">
          <span>Brush</span>
          <input type="range" min="1" max="12" step="0.5" value={size} onChange={(e) => setSize(Number(e.target.value))} className="grow" aria-label="Brush size" />
        </label>
        <div className="row gap">
          <button className="link-btn small" onClick={back} disabled={!steps}>
            Undo
          </button>
          <button className="link-btn small" onClick={reset}>
            Back to the automatic cut-out
          </button>
        </div>
      </div>
      {err && (
        <p className="danger small" role="alert">
          {err}
        </p>
      )}
      <div className="row gap wrap">
        <button className="btn primary" onClick={done}>
          Looks good
        </button>
        <button className="btn" onClick={onBack}>
          Retake
        </button>
      </div>
    </div>
  );
}

// The manual way (the cut-out tool isn't available): drag and zoom the
// picture inside a rounded square, like the profile picture cropper. The
// result is a rounded picture instead of a pet-shaped cut-out.
function ManualCrop({ work, onDone, onBack }) {
  const SIZE = 260;
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  useEffect(() => {
    let gone = false;
    let u = '';
    work.toBlob((b) => {
      if (gone || !b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    }, 'image/jpeg', 0.9);
    return () => {
      gone = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [work]);
  const base = SIZE / Math.min(work.width, work.height);
  const scale = base * zoom;
  const w = work.width * scale;
  const h = work.height * scale;
  const clamp = (p) => ({ x: Math.min(0, Math.max(SIZE - w, p.x)), y: Math.min(0, Math.max(SIZE - h, p.y)) });
  useEffect(() => setPos({ x: (SIZE - work.width * base) / 2, y: (SIZE - work.height * base) / 2 }), [work, base]);
  useEffect(() => setPos((p) => clamp(p)), [zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  const use = async () => {
    const { img } = await tools();
    onDone(img.roundedCrop(work, { x: -pos.x / scale, y: -pos.y / scale, size: SIZE / scale }));
  };
  return (
    <div className="cropper">
      <div
        className="crop-area pp-crop"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, start: pos };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const d = drag.current;
          setPos(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {url && <img src={url} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${pos.x}px, ${pos.y}px)` }} />}
      </div>
      <label className="row gap small">
        <span>Zoom</span>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="grow" aria-label="Zoom" />
      </label>
      <p className="muted small">Drag to move the picture inside the frame. It shows as a rounded picture.</p>
      <div className="row gap">
        <button className="btn" onClick={onBack}>
          Choose another
        </button>
        <button className="btn primary grow" onClick={use} disabled={!url}>
          Use this
        </button>
      </div>
    </div>
  );
}
