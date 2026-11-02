// The on-screen keyboard on iPhone and iPad doesn't make the page shorter:
// it slides over the bottom of it, so the message box, Send, and the newest
// messages end up underneath. This works out how much of the screen is still
// visible and tells the CSS: --vvh (how tall), --vvt (where it starts, because
// iOS can pan the view down so the field you tapped shows), --vvb (how far the
// visible bottom is above the page's bottom), and html.kb-open (html.kb-short on
// top of it when there is very little room). styles.css and shell.css then
// fits the app and every pop-up into that space and tucks away what's pinned to
// the bottom (tab bar, ＋, banners).
//
// The size comes from the screen itself (how much shorter the visible area is
// than the page): tapping a button next to the message box, Send, or a picker
// can leave the keyboard up for a moment with nothing focused, and it has to
// keep fitting then. But a keyboard is only believed while a text box has focus
// (or just did): a window that changes size (iPad windows, Split View, coming
// back to the app) also makes the visible area shorter than the page, and that
// must never squeeze the app or leave a pop-up's dimmed backdrop short. Nothing
// is waited for: the numbers are read on every event and again every fraction
// of a second while a box is focused or the keyboard is up, because iOS doesn't
// always send the event.
//
// Android resizes the page itself (interactive-widget in index.html), so there
// the keyboard never counts as "covering" anything.

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;
const NOT_TEXT = /^(button|checkbox|radio|range|color|file|submit|reset|image)$/;

// Anything shorter than this is the iPad suggestion bar, not a keyboard.
const BAR_MAX = 150;
// Smaller than this isn't worth reacting to (rounding, a bounce).
const BAR_MIN = 20;
// Once a full keyboard is counted, it counts until the covered height drops under this.
const FULL_OFF = 110;
// Under this much room the CSS folds away more (html.kb-short).
const SHORT = 360;
// The short suggestion bar only counts while a box is focused, and this long after.
const GRACE = 1500;
// A visible area that is only a little shorter than the page (less than a real keyboard, KB_MIN)
// is believed to be a keyboard only while a box is focused, or this long after one was (it takes
// a moment to slide away). With no box in sight it is the window changing (iPad windows, Split
// View, a resume), never a keyboard. A reading as tall as a real keyboard still counts with
// nothing focused (a button tapped next to the message box), so the app keeps fitting then.
const STICKY = 2000;
const KB_MIN = 200;
// A keyboard never covers more than this share of the page; more than that is a glitch.
const MAX_SHARE = 0.65;
// The keyboard never changes the page's own height (innerHeight); a window does. While it
// is changing, without a box focused, the visible area isn't trusted.
const SETTLE = 1500;

const typingIn = (el) => !!el && ((TYPING.test(el.tagName) && !NOT_TEXT.test(el.type || '')) || el.isContentEditable);

// The element with focus, looking inside any shadow root.
const focused = () => {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  return el;
};

export function installKeyboardFit() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const standalone = (() => {
    try {
      return !!navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    } catch {
      return false;
    }
  })();

  // How tall the page is: the part the keyboard doesn't shrink. Some iOS
  // versions shrink window.innerHeight with the keyboard but not the page; a
  // Home Screen app has no browser bars, so the page's own height is the truth there.
  const pageHeight = () => Math.max(window.innerHeight, standalone ? root.clientHeight : 0);

  let open = false; // a full keyboard is up
  let bar = false; // only the iPad suggestion bar
  let typedAt = 0; // when a box last had focus
  let lastInner = window.innerHeight;
  let resizedAt = 0; // when the page's own height last changed
  let fastUntil = 0;
  let timer = null;
  let settle = null;
  const shown = { h: '', t: '', b: '', bar: '' };

  const setVar = (name, key, value) => {
    if (shown[key] === value) return;
    shown[key] = value;
    if (value === '') root.style.removeProperty(name);
    else root.style.setProperty(name, value);
  };

  // The page itself never scrolls (styles.css), but iOS also scrolls boxes that
  // hide their overflow to show a field, and leaves them that way. Put them back.
  const home = () => {
    if (window.scrollY || root.scrollTop || document.body.scrollTop) window.scrollTo(0, 0);
    const app = document.getElementById('root');
    if (app && app.scrollTop && getComputedStyle(app).overflowY === 'hidden') app.scrollTop = 0;
  };

  // A search box has a list under it that you came to look at. Pop-ups that
  // lay themselves out (pickers, the chat side panel, the message box) take
  // care of that in CSS; on a page or in a dialog, scroll so the box sits at
  // the top and the results get the room below it.
  const SEARCHY = /search|find|filter|look up|number or name/i;
  const listBox = (el) =>
    el.tagName === 'INPUT' &&
    (el.type === 'search' || el.inputMode === 'search' || SEARCHY.test(`${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`)) &&
    !el.closest('.composer, .floating-picker, .msg-actions, .chat-side');
  const scroller = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a.matches('.emoji-picker, .gif-picker')) continue; // a picker inside a pop-up scrolls with the pop-up
      const oy = getComputedStyle(a).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight + 1) return a;
    }
    return null;
  };
  const toTop = (el) => {
    const sc = scroller(el);
    if (!sc) return false;
    // What stays pinned at the top of that box (a pop-up's title) isn't room.
    const pinned = [...sc.children].find((c) => /sticky|fixed/.test(getComputedStyle(c).position) && c.getBoundingClientRect().top <= sc.getBoundingClientRect().top + 2);
    const edge = sc.getBoundingClientRect().top + (pinned ? pinned.getBoundingClientRect().height : 0) + 8;
    const d = el.getBoundingClientRect().top - Math.max(edge, vv.offsetTop + 8);
    if (Math.abs(d) > 2) sc.scrollTop += d;
    return true;
  };

  // Keep the box you're typing in on screen.
  const reveal = () => {
    const el = focused();
    if (!(open || bar) || !typingIn(el)) return;
    if (open && listBox(el) && toTop(el)) return home();
    // Always ask: the scrolling box knows what it pins at its edges (scroll-padding in shell.css), the page can't see that.
    el.scrollIntoView({ block: 'nearest' });
    home();
  };

  // Check on the next beats too: the keyboard takes ~250ms to move, and iOS
  // pans the view after the layout changes.
  const wake = (ms = 1500) => {
    fastUntil = Math.max(fastUntil, Date.now() + ms);
    schedule(60);
  };
  const later = () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      update();
      reveal();
      if (!open && !typingIn(focused())) home();
    }, 120);
  };

  function update() {
    const now = Date.now();
    const typing = typingIn(focused());
    if (typing) typedAt = now;
    const recent = typing || now - typedAt < GRACE;

    const full = pageHeight();
    const scale = vv.scale || 1;
    // How much the keyboard (or the iPad shortcut bar) covers. Pinch-zoom also
    // shrinks the visual viewport (in page pixels), so measure what you see.
    const covered = Math.max(0, full - vv.height * scale);
    const wasOpen = open;
    const wasBar = bar;
    if (window.innerHeight !== lastInner) {
      lastInner = window.innerHeight;
      resizedAt = now;
    }
    const settling = !typing && now - resizedAt < SETTLE;
    const sane = covered < full * MAX_SHARE;
    const held = typing || covered >= KB_MIN || now - typedAt < (wasOpen ? STICKY : GRACE);
    open = sane && held && !settling && covered > (wasOpen ? FULL_OFF : BAR_MAX);
    // With a keyboard attached, iPad shows only its short suggestion bar.
    // That's not worth squeezing the whole app (pop-ups jumped up): just lift
    // the message box above it (html.kb-bar, --kb-bar).
    bar = !open && sane && covered > BAR_MIN && covered <= BAR_MAX && recent;

    const top = Math.max(0, Math.round(vv.offsetTop));
    if (open) {
      setVar('--vvh', 'h', `${Math.round(vv.height)}px`);
      setVar('--vvt', 't', `${top}px`);
      setVar('--vvb', 'b', `${Math.max(0, Math.round(full - top - vv.height))}px`);
    } else if (bar) {
      setVar('--vvh', 'h', '');
      setVar('--vvt', 't', '');
      setVar('--vvb', 'b', `${Math.max(0, Math.round(covered - top))}px`);
    } else {
      setVar('--vvh', 'h', '');
      setVar('--vvt', 't', '');
      setVar('--vvb', 'b', '');
    }
    setVar('--kb-bar', 'bar', bar ? `${Math.round(covered)}px` : '');
    // Very little room left (a phone on its side, or a tall keyboard with the form bar): the CSS folds away more.
    const short = open && vv.height * scale < SHORT;
    if (short !== root.classList.contains('kb-short')) root.classList.toggle('kb-short', short);
    if (open !== wasOpen) root.classList.toggle('kb-open', open);
    if (bar !== wasBar) root.classList.toggle('kb-bar', bar);
    if (open !== wasOpen || bar !== wasBar) {
      // Once the layout has settled, keep the box you're typing in in view, and
      // when it goes away put back anything iOS scrolled to show the box.
      later();
      wake(1200);
    }
    if (!open && !typing) home();
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }
  function tick() {
    update();
    const busy = open || bar || typingIn(focused()) || Date.now() - typedAt < GRACE || Date.now() - resizedAt < SETTLE;
    schedule(Date.now() < fastUntil ? 100 : busy ? 300 : 1200);
  }

  const poke = (ms) => () => {
    update();
    wake(ms);
  };
  vv.addEventListener('resize', () => {
    update();
    wake(1200);
    later();
  });
  vv.addEventListener('scroll', update);
  window.addEventListener('resize', poke(1200));
  window.addEventListener('scroll', () => !typingIn(focused()) && home(), { passive: true });
  window.addEventListener('focusin', () => {
    update();
    wake(2000);
    later();
  });
  window.addEventListener('focusout', poke(2000));
  window.addEventListener('focus', poke(1500));
  window.addEventListener('pageshow', poke(1500));
  window.addEventListener('orientationchange', () => {
    poke(2000)();
    setTimeout(update, 300);
    setTimeout(home, 600);
  });
  document.addEventListener('visibilitychange', poke(1500));
  // A tap is when the keyboard goes up or down; look right after it.
  document.addEventListener('pointerup', poke(800), { passive: true, capture: true });
  tick();
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
