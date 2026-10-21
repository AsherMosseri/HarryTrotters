// iPad (Home Screen app, hardware keyboard): the first emoji picked with
// Globe + E arrives only as a key press (keydown with key "😭") and is never
// typed into the box. When an emoji key press isn't followed by the emoji
// being typed by the time the key is released, type it ourselves, the normal
// way (so undo works and React's onChange sees it). If the iPad does type it
// a moment later anyway, that late copy is dropped so it never doubles.
const isEmoji = (key) => {
  if (!key || key.length < 2 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(key)) return false;
  // Exactly one character (an emoji can be several code points).
  return typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter().segment(key)].length === 1 : true;
};

const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', '']);
const isTextField = (el) =>
  el &&
  !el.readOnly &&
  !el.disabled &&
  (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase())));

function typeInto(el, text) {
  el.focus();
  // execCommand fires the same beforeinput/input events as real typing.
  if (document.execCommand?.('insertText', false, text)) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  setter.call(el, el.value.slice(0, start) + text + el.value.slice(end));
  el.setSelectionRange(start + text.length, start + text.length);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function installEmojiKeyFix() {
  let pending = null; // { key, el, typed, timer }
  let ours = null; // { key, el, until } — our own insert, to drop a late duplicate

  const decide = () => {
    const p = pending;
    pending = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.typed || document.activeElement !== p.el) return;
    ours = { key: p.key, el: p.el, until: Date.now() + 600, inserting: true };
    typeInto(p.el, p.key);
    ours.inserting = false;
  };

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || !isEmoji(e.key) || !isTextField(e.target)) return;
      if (pending) decide();
      pending = { key: e.key, el: e.target, typed: false, timer: setTimeout(decide, 250) };
    },
    true,
  );
  document.addEventListener(
    'keyup',
    (e) => {
      if (pending && e.key === pending.key) setTimeout(decide, 0);
    },
    true,
  );
  document.addEventListener(
    'beforeinput',
    (e) => {
      // The platform typed it after all: nothing for us to do.
      if (pending && e.target === pending.el && (e.data || '').includes(pending.key)) pending.typed = true;
      // A late copy of an emoji we already typed: drop it.
      if (ours && !ours.inserting && e.target === ours.el && e.data === ours.key && Date.now() < ours.until) {
        e.preventDefault();
        ours = null;
      }
    },
    true,
  );
}
