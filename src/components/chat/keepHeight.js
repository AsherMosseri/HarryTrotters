// keepHeight(el, ms, height?): el is at least this tall (its height now, or
// `height`, its border box in px) for ms from now; another call starts the
// time again. A game card that ends or shrinks under a finger (a duel's shot,
// Trotbot shooting first, a request paid) doesn't pull what's below it up
// into the spot the next tap lands on (ChatView, Commands.jsx).
const timers = new WeakMap();

export function keepHeight(el, ms, height) {
  if (!el) return;
  clearTimeout(timers.get(el));
  const cs = getComputedStyle(el);
  const extra =
    cs.boxSizing === 'border-box' ? 0 : ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((s, p) => s + (parseFloat(cs[p]) || 0), 0);
  const h = (height ?? el.getBoundingClientRect().height) - extra;
  el.style.minHeight = `${Math.max(h, parseFloat(el.style.minHeight) || 0)}px`;
  timers.set(
    el,
    setTimeout(() => {
      el.style.minHeight = '';
      timers.delete(el);
    }, ms),
  );
}
