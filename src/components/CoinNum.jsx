import { useSyncExternalStore } from 'react';
import { COIN_STYLES, coinTitle, exactCoins, formatCoins, getCoinStyle, setCoinStyle, signedCoins, subscribeCoinStyle } from '../coinFormat.js';

// This device's coin number style (Appearance → Coin numbers). Every
// component that shows coins reads it here, so a change shows everywhere at
// once (a shared store, like a context that needs no provider).
export function useCoinStyle() {
  return useSyncExternalStore(subscribeCoinStyle, getCoinStyle, getCoinStyle);
}

// Formatters in this device's style: c.n(1234) "1,234", c.signed(-5) "−5",
// c.title(n) the exact number for a hover when the style hides it, and
// c.exact(n) (always with commas, for confirm dialogs).
export function useCoinFormat() {
  const style = useCoinStyle();
  return {
    style,
    n: (n) => formatCoins(n, style),
    signed: (n) => signedCoins(n, style),
    title: (n) => coinTitle(n, style),
    exact: exactCoins,
  };
}

// A coin amount as text (a <span>, or `as="b"`): in Short, a long-press or
// hover shows the exact number.
export function CoinNum({ n, signed = false, as: Tag = 'span', className, ...rest }) {
  const style = useCoinStyle();
  return (
    <Tag className={className} title={coinTitle(n, style)} {...rest}>
      {signed ? signedCoins(n, style) : formatCoins(n, style)}
    </Tag>
  );
}

// Appearance → Coin numbers: 1,234 (the default) · 1234 · 1.2k, for this device.
export function CoinFormatSetting() {
  const style = useCoinStyle();
  return (
    <div className="appearance-row coin-format-row">
      <div>
        <b>Coin numbers</b>
        <span className="muted small">
          {style === 'short' ? 'Short. Hold or hover a number for the exact amount.' : style === 'plain' ? 'No commas.' : 'With commas.'}
        </span>
      </div>
      <div className="seg" role="radiogroup" aria-label="Coin numbers">
        {COIN_STYLES.map(([id, label, name]) => (
          <button
            key={id}
            role="radio"
            aria-checked={style === id}
            aria-label={`${name}: ${label}`}
            className={style === id ? 'on' : ''}
            onClick={() => setCoinStyle(id)}
          >
            <span className="mono">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
