// The market and pets in the app: what the Market page, Today, profiles and
// chat read (perks, purchases, pets, tournaments, chat extras running now),
// and one way to call the server (functions/market.js; demo mode runs the
// same checks in demoStore.js). Nothing here decides what anything costs or
// pays: the server does.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { activeExtras } from '../functions/shared/market.js';
import { petState } from '../functions/shared/pets.js';
import { celebrate } from './motion.js';
import { noteFor } from './connection.js';

export const MarketContext = createContext(null);
export const useMarket = () => useContext(MarketContext);

const readNum = (key) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const saveNum = (key, n) => {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* storage unavailable */
  }
};

// shifts: under current names. balanceOf(name): coins from the app's wallet
// (only demo mode uses it; the server reads balances itself).
export function useMarketData(store, { actor, rename, shifts, balanceOf, coinsOn, onToast }) {
  const [perks, setPerks] = useState([]);
  const [rawPurchases, setPurchases] = useState([]);
  const [rawPets, setPets] = useState([]);
  const [rawTournaments, setTournaments] = useState([]);
  useEffect(() => store.subscribePerks?.(setPerks), [store]);
  useEffect(() => store.subscribePurchases?.(setPurchases), [store]);
  useEffect(() => store.subscribePets?.(setPets), [store]);
  useEffect(() => store.subscribeTournaments?.(setTournaments), [store]);
  // A minute clock: needs run down and chat extras run out while you watch.
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    const t = setInterval(() => setMinute(Math.floor(Date.now() / 60000)), 60000);
    return () => clearInterval(t);
  }, []);
  const now = minute * 60000;

  // Everything under people's current names (docs keep the name they were made with).
  const purchases = useMemo(() => rawPurchases.map((p) => ({ ...p, person: rename(p.person || '') })), [rawPurchases, rename]);
  const pets = useMemo(() => new Map(rawPets.map((p) => [rename(p.person || ''), { ...p, person: rename(p.person || '') }])), [rawPets, rename]);
  const tournaments = useMemo(
    () =>
      rawTournaments
        .map((t) => ({
          ...t,
          players: Object.fromEntries(Object.entries(t.players || {}).map(([n, p]) => [rename(n), p])),
          winners: (t.winners || []).map(rename),
        }))
        .sort((a, b) => (a.status === b.status ? a.endsAt - b.endsAt : a.status === 'open' ? -1 : 1)),
    [rawTournaments, rename],
  );
  const extras = useMemo(() => activeExtras(purchases, now, (n) => n), [purchases, now]);
  const petOf = useCallback(
    (name) => {
      const pet = pets.get(name);
      return pet ? { pet, st: petState(pet, { shifts, now }) } : null;
    },
    [pets, shifts, now],
  );

  // Your pet grew a level since this device last saw it: a celebration.
  const mine = petOf(actor.name);
  const level = mine?.st.level || 0;
  const petKey = mine ? `pet-level-${mine.pet.adoptedAt}` : '';
  const toast = useRef(onToast);
  toast.current = onToast;
  useEffect(() => {
    if (!petKey || !level || actor.preview) return;
    const seen = readNum(petKey);
    if (seen && level > seen) {
      celebrate();
      toast.current?.(`${mine.pet.name} grew to level ${level}!`);
    }
    if (level !== seen) saveNum(petKey, level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petKey, level]);

  const balanceRef = useRef(balanceOf);
  balanceRef.current = balanceOf;
  const run = useCallback(
    async (fn, data) => {
      try {
        return await store.market(fn, data, actor, { balanceOf: (n) => balanceRef.current(n), coinsOff: !coinsOn });
      } catch (e) {
        return { note: noteFor(e, 'That didn’t go through') };
      }
    },
    [store, actor, coinsOn],
  );

  // Perks: team management writes them directly (the rules check who).
  const savePerk = useCallback((id, data) => store.savePerk(id, data, actor), [store, actor]);
  const deletePerk = useCallback((id) => store.deletePerk(id), [store]);

  return useMemo(
    () => ({ perks, purchases, pets, tournaments, extras, petOf, run, now, coinsOn, savePerk, deletePerk }),
    [perks, purchases, pets, tournaments, extras, petOf, run, now, coinsOn, savePerk, deletePerk],
  );
}
