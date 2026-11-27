// Pets can die (3.3) in the app: the memorials everyone sees, your own ask
// to turn pet death off (all of them, for Asher), and each pet's fate for its
// card. The rule is functions/shared/petdeath.js; the server
// (functions/petdeath.js) decides and writes, so nothing here does more than
// show and ask.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adoptWait, deathOff, petFate } from '../functions/shared/petdeath.js';
import { REQUESTS_TO } from './config.js';

// inactive: the Set of inactive names (shared/activity.js, from Workspace).
export function usePetDeath(store, { actor, rename, renames, run, inactive, now }) {
  const [rawMemorials, setMemorials] = useState([]);
  const [rawAsks, setAsks] = useState([]);
  const owner = !!actor.admin && actor.name === REQUESTS_TO;
  const names = useMemo(() => [actor.name, ...Object.keys(renames || {}).filter((k) => k !== actor.name && rename(k) === actor.name)].slice(0, 10), [actor.name, renames, rename]);
  const nameKey = names.join('|');
  useEffect(() => store.subscribePetMemorials?.(setMemorials), [store]);
  useEffect(() => {
    if (actor.preview) return setAsks([]);
    return store.subscribePetDeathOff?.(actor, names, setAsks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, actor.name, actor.admin, actor.preview, nameKey]);

  // Newest first, under current names.
  const memorials = useMemo(
    () =>
      rawMemorials
        .map((m) => ({ ...m, person: rename(m.person || ''), respects: (m.respects || []).map((r) => ({ ...r, name: rename(r?.name || '') })) }))
        .sort((a, b) => (b.diedAt || 0) - (a.diedAt || 0)),
    [rawMemorials, rename],
  );
  const asks = useMemo(() => rawAsks.map((a) => ({ ...a, by: rename(a.by || '') })), [rawAsks, rename]);
  const mine = asks.find((a) => a.by === actor.name) || null;
  const myOff = deathOff(mine);
  // Asher's lists: waiting asks (oldest first) and the people it's off for.
  const waiting = useMemo(() => (owner ? asks.filter((a) => a.status === 'pending').sort((a, b) => a.at - b.at) : []), [owner, asks]);
  const offFor = useMemo(() => (owner ? asks.filter(deathOff).sort((a, b) => a.by.localeCompare(b.by)) : []), [owner, asks]);

  // A pet's fate right now. Your own "off" comes from your ask; anyone
  // else's from what the server last marked on their pet.
  const fateOf = useCallback(
    (name, pet) => petFate(pet, { now, asleep: !!inactive?.has(name), off: name === actor.name ? myOff : pet?.neglect?.off === true }),
    [now, inactive, actor.name, myOff],
  );
  const wait = useMemo(() => adoptWait(memorials, { me: actor.name, now }), [memorials, actor.name, now]);

  const respects = useCallback((id) => run('pet', { action: 'respects', id }), [run]);
  const ask = useCallback((reason) => run('pet', { action: 'deathAsk', reason }), [run]);
  const answer = useCallback((id, decision, note = '') => run('pet', { action: 'deathAnswer', id, decision, note }), [run]);

  return useMemo(
    () => ({ memorials, memorial: (id) => memorials.find((m) => m.id === id) || null, mine, myOff, owner, waiting, offFor, fateOf, wait, respects, ask, answer }),
    [memorials, mine, myOff, owner, waiting, offFor, fateOf, wait, respects, ask, answer],
  );
}
