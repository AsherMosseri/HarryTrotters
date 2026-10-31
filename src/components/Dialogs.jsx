import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Overlay } from './common.jsx';
import { isTouch } from '../util.js';

// The app's own yes/no, OK, and type-a-word pop-ups, in place of the
// browser's alert(), confirm() and prompt() (which look like iOS system
// alerts and block the page). Each returns a promise:
//   if (!(await confirmDialog({ title: 'Delete this run?', okLabel: 'Delete', danger: true }))) return;
//   const name = await promptDialog({ title: 'Name this layout', initial: 'Idea: ' }); // null when cancelled
// One <DialogHost/> (main.jsx) shows them, one at a time, oldest first.

let queue = [];
let nextId = 1;
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const subscribe = (f) => (subs.add(f), () => subs.delete(f));
const snapshot = () => queue;

function open(kind, opts) {
  const o = typeof opts === 'string' ? { title: opts } : opts || {};
  return new Promise((resolve) => {
    queue = [...queue, { ...o, kind, id: nextId++, resolve }];
    emit();
  });
}
function settle(item, value) {
  queue = queue.filter((q) => q !== item);
  emit();
  item.resolve(value);
}

// { title, body, okLabel = 'OK', cancelLabel = 'Cancel', danger } → true / false
export const confirmDialog = (opts) => open('confirm', opts);
// { title, body, okLabel = 'OK' } → resolves when closed
export const alertDialog = (opts) => open('alert', opts);
// { title, body, label, initial, placeholder, okLabel = 'OK', readOnly, maxLength } → the text, or null
export const promptDialog = (opts) => open('prompt', opts);

export function DialogHost() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  return list[0] ? <AskDialog key={list[0].id} item={list[0]} /> : null;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function AskDialog({ item }) {
  const { kind, title, body, label, placeholder, danger, readOnly, maxLength } = item;
  const okLabel = item.okLabel || 'OK';
  const cancelLabel = item.cancelLabel || 'Cancel';
  const [text, setText] = useState(item.initial ?? '');
  const box = useRef(null);
  const input = useRef(null);
  const ok = useRef(null);
  const ids = useId();
  const cancel = () => settle(item, kind === 'confirm' ? false : kind === 'prompt' ? null : undefined);
  const accept = () => settle(item, kind === 'confirm' ? true : kind === 'prompt' ? text : undefined);

  // Focus moves in (the text box, or OK) and back to where it was after.
  // Touch screens: the keyboard only comes up when you tap the box.
  useEffect(() => {
    const before = document.activeElement;
    if (kind === 'prompt' && !isTouch) {
      input.current?.focus();
      input.current?.select();
    } else if (kind === 'prompt' || isTouch) box.current?.focus({ preventScroll: true });
    else ok.current?.focus({ preventScroll: true });
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [kind]);

  // Escape cancels and Enter is OK; Tab stays inside. Handled here (and not
  // passed on) so the panel underneath doesn't close too.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === 'Enter' && !e.isComposing && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      e.stopPropagation();
      accept();
    } else if (e.key === 'Tab') {
      const els = [...box.current.querySelectorAll(FOCUSABLE)];
      if (!els.length) return;
      const i = els.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : i === -1 || i === els.length - 1 ? 0 : i + 1;
      e.preventDefault();
      els[next].focus();
    }
  };

  return (
    <Overlay>
      <div className="panel-backdrop center ask-backdrop" onClick={cancel} onKeyDown={onKeyDown}>
        <div
          ref={box}
          tabIndex={-1}
          className={`dialog ask${danger ? ' danger' : ''}`}
          onClick={(e) => e.stopPropagation()}
          role={kind === 'prompt' ? 'dialog' : 'alertdialog'}
          aria-modal="true"
          aria-labelledby={`${ids}t`}
          aria-describedby={body ? `${ids}b` : undefined}
        >
          <h2 id={`${ids}t`}>{title}</h2>
          {body && (
            <p id={`${ids}b`} className="muted">
              {body}
            </p>
          )}
          {kind === 'prompt' && (
            <label className="ask-field">
              {label && <span className="small muted">{label}</span>}
              <input
                ref={input}
                className="input"
                value={text}
                readOnly={readOnly}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={(e) => setText(e.target.value)}
                onFocus={(e) => readOnly && e.target.select()}
                aria-label={label ? undefined : title}
              />
            </label>
          )}
          <div className="ask-actions">
            {kind !== 'alert' && (
              <button className="btn" onClick={cancel}>
                {cancelLabel}
              </button>
            )}
            <button ref={ok} className={`btn ${danger ? 'danger solid' : 'primary'}`} onClick={accept}>
              {okLabel}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
