// Photos of real pets in the app (functions/petphotos.js, checks in
// functions/shared/petphotos.js). Everyone reads the approved photos; you read
// your own waiting and answered one; team management reads all of them. The
// device uploads the small PNG sticker itself and the pet callable checks it,
// so nothing here decides what shows.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { noteFor } from './connection.js';

// on: Controls' Photos switch (off hides the whole feature).
// renames: old name -> new name, to find a photo made under an old name.
export function usePetPhotos(store, { actor, rename, renames, on, run }) {
  const [rawLive, setLive] = useState([]);
  const [rawReq, setReq] = useState([]);
  const names = useMemo(() => [actor.name, ...Object.keys(renames || {}).filter((k) => k !== actor.name && rename(k) === actor.name)].slice(0, 10), [actor.name, renames, rename]);
  const nameKey = names.join('|');
  useEffect(() => {
    if (!on) return setLive([]);
    return store.subscribePetPhotos?.(setLive);
  }, [store, on]);
  useEffect(() => {
    if (!on || actor.preview) return setReq([]);
    return store.subscribePetPhotoRequests?.(actor, names, setReq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, on, actor.name, actor.admin, actor.preview, nameKey]);

  // Under people's current names (docs keep the name they were made with).
  const live = useMemo(() => new Map(rawLive.map((p) => [rename(p.by || ''), { ...p, by: rename(p.by || '') }])), [rawLive, rename]);
  const requests = useMemo(() => rawReq.filter((r) => r.status && r.status !== 'removed').map((r) => ({ ...r, by: rename(r.by || '') })), [rawReq, rename]);
  const mine = requests.find((r) => r.by === actor.name) || null;
  // Team management's list: photos waiting for an answer, oldest first.
  const waiting = useMemo(() => requests.filter((r) => r.status === 'pending').sort((a, b) => a.at - b.at), [requests]);
  // Photos showing now, each with a newer one that is waiting, for the review list.
  const showing = useMemo(() => [...live.values()].sort((a, b) => a.by.localeCompare(b.by)), [live]);

  // Cut-out PNG in, the server's answer out ({ ok } or { note }).
  const submit = useCallback(
    async (blob, caption) => {
      try {
        const up = await store.uploadPetPhoto(blob, actor);
        return await run('pet', { action: 'submitPhoto', ...up, caption });
      } catch (e) {
        return { note: noteFor(e, 'That photo didn’t go through') };
      }
    },
    [store, actor, run],
  );
  const remove = useCallback(() => run('pet', { action: 'removePhoto' }), [run]);
  const decide = useCallback((id, decision, note = '') => run('pet', { action: 'photoDecide', id, decision, note }), [run]);

  return useMemo(
    () => ({
      on,
      live,
      of: (name) => (on ? live.get(name) || null : null),
      mine,
      waiting,
      showing,
      submit,
      remove,
      decide,
    }),
    [on, live, mine, waiting, showing, submit, remove, decide],
  );
}
