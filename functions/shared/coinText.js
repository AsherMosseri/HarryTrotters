// A Jackson coin amount in text the server writes (notifications, notes,
// loan lines): with commas, like the app's default (1,234,567). The app's
// own Coin numbers setting (src/coinFormat.js) only changes what it draws.
// Anything that isn't a number is written as it was.
export const coinsText = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : String(n));
