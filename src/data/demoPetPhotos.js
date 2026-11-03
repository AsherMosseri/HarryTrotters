// Photos of real pets in demo mode: the same checks the server runs
// (functions/petphotos.js, rules in functions/shared/petphotos.js), on the
// demo's own data. The sticker is kept as a data URL in the demo state, so
// it is capped at the same 400 KB the storage rules allow. Open the demo as
// Cooper (?demo=member) to add a photo and as Asher (?demo) to answer it.
import { personId } from './diff.js';
import { teamDay } from '../../functions/shared/coins.js';
import { MAX_BYTES, decideCheck, pngSize, removeCheck, submitCheck } from '../../functions/shared/petphotos.js';

export function demoPetPhotos({ get, commit, uid }) {
  const S = () => get();
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const lists = () => {
    const s = S();
    s.petPhotos ||= [];
    s.petPhotoRequests ||= [];
    return s;
  };
  const tell = (to, title, body) => {
    const s = S();
    s.inbox = [{ id: uid(), type: 'market', icon: '🐾', title, body, open: 'view:market', at: Date.now(), read: false, to }, ...(s.inbox || [])];
  };

  return {
    // Keeps the processed PNG (as a data URL) for submitPhoto.
    async upload(blob) {
      if (blob.size > MAX_BYTES) throw new Error('That sticker is too big (400 KB max).');
      const url = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      // The sticker's size, read from the PNG the way the server does.
      const dim = pngSize(new Uint8Array(await blob.slice(0, 32).arrayBuffer()));
      if (!dim) throw new Error('That isn’t a sticker.');
      return { path: `demo/${uid()}.png`, url, ...dim };
    },

    run(data, actor) {
      const s = lists();
      const me = actor.name;
      const id = personId(me);
      const now = Date.now();
      const request = s.petPhotoRequests.find((r) => r.id === id) || null;
      const live = s.petPhotos.find((p) => p.id === id) || null;
      const put = (key, doc, at) => {
        s[key] = s[key].filter((x) => x.id !== at);
        if (doc) s[key].push({ ...doc, id: at });
      };

      if (data.action === 'submitPhoto') {
        const off = (s.controls?.off || []).includes('photos') && me !== 'Asher Mosseri';
        const r = submitCheck(data, {
          me,
          hasPet: (s.pets || []).some((p) => p.person === me),
          off,
          mine: request,
          file: data.url && String(data.url).startsWith('data:image/png') ? { url: data.url, path: data.path || 'demo', w: data.w, h: data.h } : null,
          day: teamDay(now),
          now,
        });
        if (r.note) return r;
        put('petPhotoRequests', r.request, id);
        const pet = (s.pets || []).find((p) => p.person === me);
        tell('Asher Mosseri', `${first(me)} sent a photo of ${r.request.caption || pet?.name || 'their pet'}`, 'Approve or decline it in the Market, Pets.');
        commit();
        return { ok: true };
      }

      if (data.action === 'removePhoto') {
        const r = removeCheck({ request, live, me });
        if (r.note) return r;
        put('petPhotoRequests', r.request, id);
        put('petPhotos', null, id);
        commit();
        return { ok: true };
      }

      if (data.action === 'photoDecide') {
        if (!actor.admin) return note('Team management only.');
        const who = String(data.id || '');
        const req = s.petPhotoRequests.find((r) => r.id === who) || null;
        const showing = s.petPhotos.find((p) => p.id === who) || null;
        const r = decideCheck(data, { request: req, live: showing, me, now });
        if (r.note) return r;
        put('petPhotoRequests', r.request, who);
        put('petPhotos', r.live, who);
        const owner = (req || showing)?.by;
        const line = {
          approved: ['Your pet photo is up', 'It shows beside your pet now.'],
          declined: ['Your pet photo wasn’t approved', r.request.note],
          removed: ['Your pet photo was taken down', r.request.note || 'Ask team management if you’re not sure why.'],
        }[r.told];
        if (owner) tell(owner, line[0], line[1]);
        commit();
        return { ok: true, status: r.told };
      }
      return note('Unknown action.');
    },

    subscribeLive(listen, cb) {
      return listen(() => cb((lists().petPhotos || []).map((p) => ({ ...p }))));
    },
    subscribeRequests(listen, actor, cb) {
      return listen(() => cb(lists().petPhotoRequests.filter((r) => actor.admin || r.by === actor.name).map((r) => ({ ...r }))));
    },
  };
}
