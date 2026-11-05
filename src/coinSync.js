// Keeping the app's coin number honest. The server answers every bet, buy and
// gift with the balance it counts (the one that decides what you can spend).
// If the app's own number is still different a few seconds later, something is
// out of date (a listener that stopped, an old copy of the app): log it once
// with the breakdown, and let the Coins screen say so and offer a refresh.
import { useCallback, useEffect, useRef, useState } from 'react';
import { breakdown, coinsAgree } from './coins.js';

// A coin of slack: the app counts lab time to its own minute.
export const COIN_SLACK = 1;

export function useCoinSync(wallet) {
  const now = useRef(wallet);
  now.current = wallet;
  const [stale, setStale] = useState(null); // { server, app } while they disagree
  const latest = useRef(0);
  const timers = useRef([]);
  const logged = useRef('');
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const noteServer = useCallback((server) => {
    if (typeof server !== 'number' || !Number.isFinite(server)) return;
    const id = ++latest.current;
    timers.current.forEach(clearTimeout);
    // The app's copy of the data arrives a moment after the server's answer:
    // look after 4 seconds, and again after 10 before saying anything.
    const look = (final) => {
      if (id !== latest.current) return;
      const app = now.current.balance;
      // Past 2^53 both are approximate: within a billionth agrees (coinsAgree).
      if (Math.abs(app - server) <= COIN_SLACK || coinsAgree(app, server)) return setStale(null);
      if (!final) {
        timers.current = [setTimeout(() => look(true), 6000)];
        return;
      }
      const key = `${server}/${app}`;
      if (logged.current !== key) {
        logged.current = key;
        console.warn('coins: the app and the server disagree', { server, app, breakdown: breakdown(now.current.history) });
      }
      setStale({ server, app });
    };
    timers.current = [setTimeout(() => look(false), 4000)];
  }, []);

  const clear = useCallback(() => setStale(null), []);
  return { noteServer, stale, clear };
}
