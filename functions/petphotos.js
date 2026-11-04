// Photos of real pets on the server (the `pet` callable in market.js):
// submitPhoto, removePhoto (you) and photoDecide (team management). The
// checks are in shared/petphotos.js (demo mode runs the same ones); this file
// reads and writes the docs and the files:
//   petPhotoRequests/{personId}  your latest photo and where it stands
//   petPhotos/{personId}         the approved photo everyone sees
// The app uploads the small PNG sticker to petphotos/<uid>/<name>.png (the
// storage rules allow only that device, PNG, up to 400 KB), then asks here.
// The server checks the file, moves it to petphotos-checked/ (which the app
// can't write to, so it can't be swapped after approval), and makes the
// download link from the file itself, never taking one from the app.
// Nothing here costs or pays coins.

import { randomUUID } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getStorage } from 'firebase-admin/storage';
import { teamDay } from './shared/coins.js';
import { MAX_BYTES, decideCheck, pathOk, pngSize, removeCheck, submitCheck } from './shared/petphotos.js';

export function petPhotos({ db, notify, personId, managers, owner }) {
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const say = (n) => notify(n).catch((e) => logger.warn('pet photo notify', e.message));
  const bucket = () => getStorage().bucket();

  // The file the app says it uploaded: there, a PNG, small. Returns its size
  // (read from the file, not taken from the app), or null.
  async function inspect(path) {
    const file = bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [meta] = await file.getMetadata();
    // Really a PNG (its first bytes say so, and give its size), and small.
    const [head] = await file.download({ start: 0, end: 31 });
    const dim = pngSize(head);
    if (meta.contentType !== 'image/png' || Number(meta.size) > MAX_BYTES || !dim) {
      await file.delete().catch(() => {});
      return null;
    }
    return dim;
  }
  // Moves an accepted file out of the device's upload folder into one the app
  // can't write to, so the photo that was checked is the photo that shows (a
  // later upload to the same name can't swap it). Returns the new path and
  // the link to show it with, made from the file's own download token.
  async function adopt(path, id) {
    const to = `petphotos-checked/${id}-${randomUUID().slice(0, 12)}.png`;
    const [file] = await bucket().file(path).move(to);
    const [meta] = await file.getMetadata();
    let token = String(meta.metadata?.firebaseStorageDownloadTokens || '').split(',')[0];
    if (!token) {
      token = randomUUID();
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    }
    const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : 'https://firebasestorage.googleapis.com';
    return { path: to, url: `${host}/v0/b/${bucket().name}/o/${encodeURIComponent(to)}?alt=media&token=${token}` };
  }
  const drop = (paths) => Promise.all(paths.map((p) => bucket().file(p).delete().catch(() => {})));

  // A person's two docs, under any name they've gone by (the id follows the
  // name they first used).
  async function docsOf(aliases) {
    let id = personId(aliases[0]);
    let request = null;
    let live = null;
    for (const n of aliases) {
      const [r, l] = await Promise.all([db.doc(`petPhotoRequests/${personId(n)}`).get(), db.doc(`petPhotos/${personId(n)}`).get()]);
      if (r.exists || l.exists) {
        id = personId(n);
        request = r.exists ? r.data() : null;
        live = l.exists ? l.data() : null;
        break;
      }
    }
    return { id, request, live };
  }
  async function off() {
    const controls = (await db.doc('settings/controls').get()).data() || {};
    return (controls.off || []).includes('photos');
  }
  const petName = async (aliases) => {
    for (const n of aliases) {
      const s = await db.doc(`pets/${personId(n)}`).get();
      if (s.exists) return s.get('name') || 'their pet';
    }
    return 'their pet';
  };

  // ctx: the caller (uid, me, admin, data = coin data with rename, aliases).
  return async function run(ctx, input) {
    const { uid, me, admin, data, aliases } = ctx;
    const action = input?.action;
    const now = Date.now();

    if (action === 'submitPhoto') {
      const path = String(input.path || '');
      if (!pathOk(path, uid)) return note('That photo didn’t upload. Try again.');
      if ((await off()) && me !== owner) return note('Photos are off right now.');
      const mine = await docsOf(aliases);
      const info = await inspect(path);
      const r = submitCheck(input, {
        me,
        off: false,
        mine: mine.request,
        file: info ? { ...info, url: 'checked-below', path } : null,
        day: teamDay(now),
        now,
      });
      if (r.note) {
        // Not taken: the uploaded file is of no use.
        await drop([path]);
        return r;
      }
      const kept = await adopt(path, mine.id);
      // The limit is counted on the doc itself, so check it again inside a
      // transaction (two quick submits can't both slip under it).
      let refused = null;
      let saved = null;
      await db.runTransaction(async (tx) => {
        const ref = db.doc(`petPhotoRequests/${mine.id}`);
        const fresh = (await tx.get(ref)).data() || null;
        const again = submitCheck(input, { me, off: false, mine: fresh, file: { ...info, ...kept }, day: teamDay(now), now });
        if (again.note) refused = again;
        else {
          saved = again;
          tx.set(ref, again.request);
        }
      });
      if (refused) {
        await drop([kept.path]);
        return refused;
      }
      await drop(saved.drop);
      const label = saved.request.caption || (await petName(aliases));
      const to = (await managers(data.rename)).filter((n) => n !== me);
      await say(
        to.map((n) => ({
          to: n,
          type: 'market',
          icon: '🐾',
          title: `${first(me)} sent a photo of ${label}`,
          body: 'Approve or decline it in the Market, Pets.',
          open: 'view:market',
          by: me,
        })),
      );
      return { ok: true };
    }

    if (action === 'removePhoto') {
      const mine = await docsOf(aliases);
      const r = removeCheck({ request: mine.request, live: mine.live, me });
      if (r.note) return r;
      const batch = db.batch();
      batch.set(db.doc(`petPhotoRequests/${mine.id}`), r.request);
      batch.delete(db.doc(`petPhotos/${mine.id}`));
      await batch.commit();
      await drop(r.drop);
      return { ok: true };
    }

    if (action === 'photoDecide') {
      if (!admin) return note('Team management only.');
      const id = String(input.id || '');
      if (!/^[\w-]{1,80}$/.test(id)) return note('Which photo?');
      const [rs, ls] = await Promise.all([db.doc(`petPhotoRequests/${id}`).get(), db.doc(`petPhotos/${id}`).get()]);
      const r = decideCheck(input, { request: rs.exists ? rs.data() : null, live: ls.exists ? ls.data() : null, me, now });
      if (r.note) return r;
      const batch = db.batch();
      batch.set(db.doc(`petPhotoRequests/${id}`), r.request);
      if (r.live) batch.set(db.doc(`petPhotos/${id}`), r.live);
      else batch.delete(db.doc(`petPhotos/${id}`));
      await batch.commit();
      await drop(r.drop);
      const owned = rs.exists ? rs.get('by') : ls.get('by');
      const who = data.rename(owned || '');
      const line = {
        approved: ['Your pet photo is up', 'It shows on your profile now.'],
        declined: ['Your pet photo wasn’t approved', r.request.note],
        removed: ['Your pet photo was taken down', r.request.note || 'Ask team management if you’re not sure why.'],
      }[r.told];
      await say([{ to: who, type: 'market', icon: '🐾', title: line[0], body: line[1], open: 'view:market', by: me, quiet: r.told === 'approved' }]);
      return { ok: true, status: r.told };
    }

    throw new HttpsError('invalid-argument', 'Unknown action.');
  };
}
