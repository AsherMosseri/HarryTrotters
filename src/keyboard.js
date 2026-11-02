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

// Anything shorter than this is the iPad suggestion bar, not a keyboard.
const BAR_MAX = 150;

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
    // With a keyboard attached, iPad shows only its short suggestion bar.
    // That's not worth squeezing the whole app (pop-ups jumped up): just lift
    // the message box above it (html.kb-bar, --kb-bar).
    const bar = vv.scale < 1.05 && covered > 20 && covered <= BAR_MAX && typingIn(document.activeElement);
    root.classList.toggle('kb-bar', bar);
    if (bar) root.style.setProperty('--kb-bar', `${Math.round(covered)}px`);
    else root.style.removeProperty('--kb-bar');
    const now = vv.scale < 1.05 && covered > BAR_MAX && typingIn(document.activeElement);
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

  // The page itself should never be scrolled (index.html and styles.css keep it
  // still). If iOS moves it anyway to show a box, put it back as soon as no box
  // is being typed in, and when the app comes back to the screen.
  const home = () => {
    if (typingIn(document.activeElement)) return;
    if (window.scrollY || root.scrollTop || document.body.scrollTop) window.scrollTo(0, 0);
  };
  window.addEventListener('scroll', home, { passive: true });
  document.addEventListener('visibilitychange', home);
  window.addEventListener('pageshow', home);
  window.addEventListener('orientationchange', () => setTimeout(home, 300));
  vv.addEventListener('resize', () => {
    update();
    if (!typingIn(document.activeElement)) setTimeout(home, 100);
  });
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
