import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './common.jsx';

// A diagnostic for the iPad emoji picker (Globe + E): a plain text box, a
// React-controlled one (like the rest of the site), and every input event
// they get. Screenshot the log to see where the first emoji goes.
const EVENTS = [
  'keydown',
  'keyup',
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'focus',
  'blur',
  'select',
];

export default function TypingTest({ onClose }) {
  const [log, setLog] = useState([]);
  const [controlled, setControlled] = useState('');
  const plain = useRef(null);
  const ctrl = useRef(null);
  const start = useRef(Date.now());

  useEffect(() => {
    // Collect events and show them a moment later: updating the screen in the
    // middle of an input event would itself reset the site-style box.
    const pending = [];
    let timer = null;
    const flush = () => {
      timer = null;
      const rows = pending.splice(0);
      setLog((l) => [...rows.reverse(), ...l].slice(0, 80));
    };
    const add = (box) => (e) => {
      pending.push({
        t: ((Date.now() - start.current) / 1000).toFixed(2),
        box,
        type: e.type,
        detail: [
          e.inputType,
          e.data != null ? JSON.stringify(e.data) : '',
          e.key ? `key=${JSON.stringify(e.key)}` : '',
          e.isComposing ? 'composing' : '',
        ]
          .filter(Boolean)
          .join(' '),
        value: JSON.stringify(e.target.value ?? ''),
      });
      timer ||= setTimeout(flush, 0);
    };
    const stops = [];
    for (const [el, box] of [
      [plain.current, 'plain'],
      [ctrl.current, 'site'],
    ])
      for (const type of EVENTS) {
        const fn = add(box);
        el.addEventListener(type, fn);
        stops.push(() => el.removeEventListener(type, fn));
      }
    const win = add('page');
    window.addEventListener('blur', win);
    window.addEventListener('focus', win);
    return () => {
      clearTimeout(timer);
      stops.forEach((s) => s());
      window.removeEventListener('blur', win);
      window.removeEventListener('focus', win);
    };
  }, []);

  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog typing-test" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Typing test">
        <div className="panel-head">
          <h2>Typing test</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="muted small">Tap a box, press Globe + E, and pick one emoji. Do it once in each box, then screenshot this screen.</p>
        <label className="field-label" htmlFor="tt-plain">
          1. Plain box
        </label>
        <input id="tt-plain" ref={plain} className="input" placeholder="Try Globe + E here" />
        <label className="field-label" htmlFor="tt-site">
          2. Box like the rest of the site
        </label>
        <input
          id="tt-site"
          ref={ctrl}
          className="input"
          value={controlled}
          onChange={(e) => setControlled(e.target.value)}
          placeholder="Then here"
        />
        <div className="row gap">
          <span className="muted small grow">{log.length} events</span>
          <button className="link-btn small" onClick={() => setLog([])}>
            Clear log
          </button>
        </div>
        <div className="typing-log">
          {log.map((r, i) => (
            <div key={i} className={`tl-row tl-${r.box}`}>
              <span>{r.t}</span>
              <b>{r.box}</b>
              <span>{r.type}</span>
              <span>{r.detail}</span>
              <span className="muted">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
