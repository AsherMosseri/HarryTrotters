// The status-bar strip's color (.status-bar-band, index.html). iPadOS takes a
// solid color from that strip to fill the status bar of a Home Screen app,
// and the first time the strip's color changes it blurs the top of the app
// (header, sidebar, coin pill) until the app is reopened. The strip's color
// comes from the theme (palette, tint, light or dark), and the color theme is
// only known once the app has loaded, so a themed strip used to change color a
// moment after launch.
//
// So the strip's color is fixed for the whole visit: index.html paints it,
// before the first frame, with the color saved last time for this kind of
// launch (app or demo, light or dark) and pins it with an inline style. This
// file keeps that saved color up to date: whenever the theme settles or
// changes, it reads the color the strip should have (from a hidden probe that
// the same CSS rules color) and saves it for next time. The live strip is never
// touched here. A theme change shows on the strip from the next launch.

const keyFor = () => {
  const root = document.documentElement;
  const theme = root.getAttribute('data-theme');
  const dark = theme ? theme === 'dark' : !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return `status-band:${root.hasAttribute('data-demo') ? 'demo' : 'app'}:${dark ? 'dark' : 'light'}`;
};

export function installStatusBand() {
  if (typeof document === 'undefined') return;
  const probe = document.createElement('div');
  probe.className = 'status-band-probe';
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  let timer = 0;
  const save = () => {
    clearTimeout(timer);
    // After the theme has settled (attributes and custom colors land in a burst).
    timer = setTimeout(() => {
      try {
        const color = getComputedStyle(probe).backgroundColor;
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') localStorage.setItem(keyFor(), color);
      } catch {
        // Private mode or storage full: the strip just keeps its CSS color.
      }
    }, 800);
  };
  new MutationObserver(save).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-demo', 'style'] });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', save);
  save();
}
