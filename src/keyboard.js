// The on-screen keyboard on iPhone and iPad doesn't make the page shorter:
// it slides over the bottom of it, so the message box, Send, and the newest
// messages ended up underneath. While it's open, this tells the CSS how much
// of the screen is still visible (--vvh, and --vvt for where that starts) and
// adds html.kb-open; styles.css then fits the app and every pop-up into that
// space and tucks away what's pinned to the bottom (tab bar, ＋, banners).
// Android resizes the page itself (interactive-widget in index.html), so
// there the keyboard never counts as "covering" anything.

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;
const NOT_TEXT = /^(button|checkbox|radio|range|color|file|submit|reset|image)$/;

const typingIn = (el) => !!el && ((TYPING.test(el.tagName) && !NOT_TEXT.test(el.type || '')) || el.isContentEditable);

export function installKeyboardFit() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let open = false;
  let settle = null;

  const update = () => {
    // How much the keyboard (or the iPad shortcut bar) covers. Pinch-zoom
    // also shrinks the visual viewport, so only count it at normal zoom.
    const covered = window.innerHeight - vv.height;
    const now = vv.scale < 1.05 && covered > 40;
    if (now) {
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
    }
    if (now !== open) {
      open = now;
      root.classList.toggle('kb-open', now);
      if (!now) {
        root.style.removeProperty('--vvh');
        root.style.removeProperty('--vvt');
      }
      // Once the layout has settled, keep the box you're typing in in view.
      clearTimeout(settle);
      settle = setTimeout(() => {
        const el = document.activeElement;
        if (open && typingIn(el)) el.scrollIntoView({ block: 'nearest' });
        // iPhone scrolls the whole page to show the text box and never
        // scrolls it back, which leaves the header off screen.
        if (!open && (window.scrollY || root.scrollTop)) window.scrollTo(0, 0);
      }, 120);
    }
  };

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  window.addEventListener('focusin', () => setTimeout(update, 50));
  window.addEventListener('focusout', () =>
    setTimeout(() => {
      update();
      if (!open && (window.scrollY || root.scrollTop)) window.scrollTo(0, 0);
    }, 150),
  );
  update();
}

// The app never zooms as a whole page: an accidental pinch or double tap blew
// it up on iPad and left it stuck that way. (maximum-scale=1 in index.html
// also stops Safari zooming in on small text boxes.) The robot viewer and the
// electrical diagram do their own pinch-zoom with pointer events, so they
// still work.
export function installNoPageZoom() {
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
}
