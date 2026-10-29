import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Asher's preview (Controls → View as): the app as someone else sees it,
// look only. The store keeps reading; anything that would change something
// does nothing and says so.
const READS = /^(subscribe|get|load|recent|on[A-Z]|ping|pushStatus)/;
export function lookOnly(store) {
  return new Proxy(store, {
    get(target, key) {
      const value = target[key];
      if (typeof value !== 'function') return value;
      if (READS.test(key)) return value.bind(target);
      return async () => {
        window.dispatchEvent(new Event('preview-look-only'));
        return undefined;
      };
    },
  });
}

export function PreviewBar({ as, onExit }) {
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    // Only say so for something you did (a tap or key just now), not for the
    // app's own background saves (presence, read markers).
    let t;
    let lastInput = 0;
    const input = () => (lastInput = Date.now());
    const on = () => {
      if (Date.now() - lastInput > 1500) return;
      setNudge(true);
      clearTimeout(t);
      t = setTimeout(() => setNudge(false), 2500);
    };
    window.addEventListener('pointerdown', input, true);
    window.addEventListener('keydown', input, true);
    window.addEventListener('preview-look-only', on);
    return () => {
      window.removeEventListener('pointerdown', input, true);
      window.removeEventListener('keydown', input, true);
      window.removeEventListener('preview-look-only', on);
      clearTimeout(t);
    };
  }, []);
  const strip = (shown) => (
    <div className={`preview-strip${shown ? ' on-top' : ''}`} role={shown ? 'status' : undefined} aria-hidden={shown ? undefined : true}>
      <span>{nudge ? 'Preview is look only: nothing was changed' : `👁 Viewing as ${as || 'a teammate'}`}</span>
      <button className="btn small-btn" onClick={onExit} tabIndex={shown ? undefined : -1}>
        Exit
      </button>
    </div>
  );
  // The strip floats above everything, pop-ups included, so Exit always
  // works; an invisible copy holds its place at the top of the page.
  return (
    <>
      <div className="preview-strip-space">{strip(false)}</div>
      {createPortal(strip(true), document.body)}
    </>
  );
}
