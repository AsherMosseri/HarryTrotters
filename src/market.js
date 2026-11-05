// The market and pets in the app: what the Market page, Today, profiles and
// chat read (perks, purchases, pets, tournaments, chat extras running now),
// and one way to call the server (functions/market.js; demo mode runs the
// same checks in demoStore.js). Nothing here decides what anything costs or
// pays: the server does.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { activeExtras } from '../functions/shared/market.js';
import { eventGearItem, giftOpen, petState, petsIn } from '../functions/shared/pets.js';
import { earnedIds, shownEvents, unseenIds } from '../functions/shared/events.js';
import { celebrate } from './motion.js';
import { noteFor } from './connection.js';
import { usePetPhotos } from './petPhotos.js';

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
export function useMarketData(store, { actor, rename, renames, shifts, balanceOf, coinsOn, photosOn = true, onToast, onBalance }) {
  const [perks, setPerks] = useState([]);
  const [rawPurchases, setPurchases] = useState([]);
  const [rawPets, setPets] = useState([]);
  const [rawTournaments, setTournaments] = useState([]);
  const [rawGifts, setGifts] = useState([]);
  const [rawEvents, setEvents] = useState([]);
  const [rawUnlocks, setUnlocks] = useState([]);
  useEffect(() => store.subscribePerks?.(setPerks), [store]);
  useEffect(() => store.subscribePurchases?.(setPurchases), [store]);
  useEffect(() => store.subscribePets?.(setPets), [store]);
  useEffect(() => store.subscribeTournaments?.(setTournaments), [store]);
  useEffect(() => store.subscribePetGifts?.(actor.name, setGifts), [store, actor.name]);
  useEffect(() => store.subscribePetEvents?.(setEvents), [store]);
  useEffect(() => store.subscribePetUnlocks?.(setUnlocks), [store]);
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

  // All of a person's pets (the first, then a baby or a gift), each with its
  // own level; `born` tells them apart (the server's `pet` and `buy` take it).
  const petsOf = useCallback(
    (name) => {
      const doc = pets.get(name);
      return doc ? petsIn(doc).map((pet) => ({ pet, st: petState(pet, { shifts, now }) })) : [];
    },
    [pets, shifts, now],
  );
  // Offers to give a pet away that are still open (they last a week).
  const gifts = useMemo(() => {
    const open = rawGifts.filter((g) => giftOpen(g, now)).map((g) => ({ ...g, from: rename(g.from), to: rename(g.to) }));
    return { incoming: open.filter((g) => g.to === actor.name), outgoing: open.filter((g) => g.from === actor.name) };
  }, [rawGifts, now, rename, actor.name]);

  const toast = useRef(onToast);
  toast.current = onToast;
  // Team events (shared/events.js): the ones to show now, and the event gear
  // you have earned (under your current name; a rename keeps it).
  const events = useMemo(() => shownEvents(rawEvents, now), [rawEvents, now]);
  const unlocks = useMemo(() => {
    const mine = rawUnlocks.filter((u) => rename(u.person || '') === actor.name);
    const doc = { gear: Object.assign({}, ...mine.map((u) => u.gear || {})), seen: Object.assign({}, ...mine.map((u) => u.seen || {})) };
    return { earned: earnedIds(doc), unseen: unseenIds(doc), doc };
  }, [rawUnlocks, rename, actor.name]);

  // The server does the sums (hours come from the shift records, never from
  // here): ask it to refresh on opening, now and then, when the app comes
  // back to the front and when one of your shifts ends.
  const lastAsk = useRef(0);
  const ask = useCallback(
    (force = false) => {
      if (actor.preview || !store.petEvent) return;
      const t = Date.now();
      if (!force && t - lastAsk.current < 30000) return;
      lastAsk.current = t;
      Promise.resolve(store.petEvent({ action: 'refresh' }, actor)).catch(() => {});
    },
    [store, actor],
  );
  useEffect(() => {
    ask(true);
    const every = setInterval(() => ask(), 5 * 60000);
    const back = () => document.visibilityState === 'visible' && ask();
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(every);
      document.removeEventListener('visibilitychange', back);
    };
  }, [ask]);
  const myShifts = shifts.filter((x) => x.person === actor.name && x.end).length;
  useEffect(() => {
    if (myShifts) ask();
  }, [myShifts, ask]);

  // You earned event gear since this device last told you: one celebration,
  // once per reward (the server remembers which ones you have seen).
  const told = useRef(new Set());
  const unseenKey = unlocks.unseen.join();
  useEffect(() => {
    const fresh = unlocks.unseen.filter((id) => !told.current.has(id));
    if (!fresh.length || actor.preview) return;
    fresh.forEach((id) => told.current.add(id));
    const names = fresh.map((id) => eventGearItem(id)?.name).filter(Boolean);
    celebrate();
    toast.current?.(`You earned the ${names.join(' and the ')} in ${eventGearItem(fresh[0])?.earn || 'a team event'}. Dress a pet in it: Market, Pets, Style.`);
    for (const id of fresh) Promise.resolve(store.petEvent?.({ action: 'seen', gear: id }, actor)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenKey]);

  // Your pet grew a level since this device last saw it: a celebration.
  const mine = petOf(actor.name);
  const level = mine?.st.level || 0;
  const petKey = mine ? `pet-level-${mine.pet.adoptedAt}` : '';
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
  // The server's balance after a buy, for the app to check its own against.
  const onBalanceRef = useRef(onBalance);
  onBalanceRef.current = onBalance;
  const run = useCallback(
    async (fn, data) => {
      try {
        const r = await store.market(fn, data, actor, { balanceOf: (n) => balanceRef.current(n), coinsOff: !coinsOn });
        onBalanceRef.current?.(r?.balance);
        return r;
      } catch (e) {
        return { note: noteFor(e, 'That didn’t go through') };
      }
    },
    [store, actor, coinsOn],
  );

  // Team events: ask the server (it answers { ok } or { note }).
  const petEvent = useCallback(
    async (req) => {
      try {
        return await store.petEvent(req, actor);
      } catch (e) {
        return { note: noteFor(e, 'That didn’t go through') };
      }
    },
    [store, actor],
  );

  // Photos of real pets beside their drawn ones (petPhotos.js).
  const photos = usePetPhotos(store, { actor, rename, renames, on: photosOn, run });

  // The pet games' team boards (functions/petgames.js): read only while the
  // games are open, so the listener isn't on all the time.
  const watchGames = useCallback((cb) => store.subscribePetGames?.(cb) || (() => {}), [store]);

  // Perks: team management writes them directly (the rules check who).
  const savePerk = useCallback((id, data) => store.savePerk(id, data, actor), [store, actor]);
  const deletePerk = useCallback((id) => store.deletePerk(id), [store]);

  return useMemo(
    () => ({ perks, purchases, pets, tournaments, extras, petOf, petsOf, gifts, run, now, coinsOn, savePerk, deletePerk, events, allEvents: rawEvents, unlocks, askEvents: ask, petEvent, photos, watchGames, me: actor.name, rename }),
    [perks, purchases, pets, tournaments, extras, petOf, petsOf, gifts, run, now, coinsOn, savePerk, deletePerk, events, rawEvents, unlocks, ask, petEvent, photos, watchGames, actor.name, rename],
  );
}
