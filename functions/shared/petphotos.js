// Photos of real pets (3.0.9). A person adds one cut-out photo of their real
// pet; it shows beside their drawn pet once team management approves it. The
// photo is cut out on the device (src/bgRemove.js), so the original never
// leaves it; only the small PNG sticker is uploaded. The plain checks live
// here so the server (functions/petphotos.js) and the demo (demoStore.js) run
// the same ones. Nothing here costs or pays coins.
//
// Two docs per person, both under the id of the name they joined with:
//   petPhotoRequests/{id}  their latest photo and where it stands (pending,
//                          approved, declined, with the reason); read by them
//                          and team management
//   petPhotos/{id}         the approved photo everyone sees; written only when
//                          team management approves (replacing a photo keeps
//                          the old approved one showing until the new one is
//                          approved)

export const CAPTION_MAX = 30;
export const NOTE_MAX = 140;
export const DAILY_LIMIT = 3;
// The PNG sticker the app makes is under 250 KB; the storage rules cap it here.
export const MAX_BYTES = 400 * 1024;
export const MAX_DIM = 600; // the app makes them at most 512 pixels on the long side
export const PHOTO_ACTIONS = ['submitPhoto', 'removePhoto', 'photoDecide'];

// A PNG's width and height from its first bytes (the server reads them from
// the uploaded file, so the app can't claim a size), or null if it isn't a PNG.
export function pngSize(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!bytes || bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null;
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return null;
  const u32 = (i) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
  return { w: u32(16), h: u32(20) };
}

export const cleanCaption = (s) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CAPTION_MAX);
export const cleanNote = (s) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NOTE_MAX);

const note = (title, body = '') => ({ note: { title, body } });

// Where the app uploads to: petphotos/<the device's uid>/<name>.png. The
// server also checks the file is really there, is a PNG and is small enough.
export const pathFor = (uid, name) => `petphotos/${uid}/${name}.png`;
export const pathOk = (path, uid) => typeof path === 'string' && path.startsWith(`petphotos/${uid}/`) && /^petphotos\/[A-Za-z0-9]{1,64}\/[\w-]{1,60}\.png$/.test(path);

// Adding or replacing your photo.
//   input: { caption }  (the file itself is checked by the server: path, type, size)
//   mine: your latest request doc (or null); day: today's team day
// Returns { note } to refuse, or { request, drop: [paths to delete] }.
export function submitCheck(input, { me, hasPet, off, mine, file, day, now }) {
  if (off) return note('Photos are off right now.');
  if (!hasPet) return note('Adopt a pet first.', 'The photo goes beside your pet.');
  if (!file || !file.url || !file.path) return note('That photo didn’t upload. Try again.');
  if (!(file.w >= 8 && file.w <= MAX_DIM && file.h >= 8 && file.h <= MAX_DIM)) return note('That picture is the wrong size.', 'Try cutting it out again.');
  const tries = mine?.tries?.day === day ? mine.tries.n || 0 : 0;
  if (tries >= DAILY_LIMIT) return note(`That’s ${DAILY_LIMIT} photos today.`, 'Try again tomorrow.');
  // A photo still waiting for an answer is replaced; the approved one (which
  // the live doc holds) is only removed once its replacement is approved.
  const drop = mine?.status === 'pending' && mine.path && mine.path !== file.path ? [mine.path] : [];
  return {
    request: {
      by: me,
      url: file.url,
      path: file.path,
      w: file.w,
      h: file.h,
      caption: cleanCaption(input?.caption),
      status: 'pending',
      at: now,
      decidedBy: '',
      decidedAt: 0,
      note: '',
      tries: { day, n: tries + 1 },
    },
    drop,
  };
}

// Team management's answer to a waiting photo, or taking an approved one down.
//   decision: 'approve' | 'decline' | 'remove'
// Returns { note } to refuse, or { request, live, drop } where live is the doc
// to show to everyone (null: no photo shows).
export function decideCheck(input, { request, live, me, now }) {
  const decision = input?.decision;
  if (!['approve', 'decline', 'remove'].includes(decision)) return note('Approve, decline or remove?');
  const why = cleanNote(input?.note);
  if (decision === 'remove') {
    if (!live) return note('There’s no photo showing.');
    // A newer photo may be waiting; it stays waiting.
    const waiting = request?.status === 'pending';
    return {
      live: null,
      request: waiting
        ? request
        : { ...(request || {}), by: live.by, status: 'declined', url: '', path: '', decidedBy: me, decidedAt: now, note: why || 'Taken down by team management.' },
      drop: live.path ? [live.path] : [],
      told: 'removed',
    };
  }
  if (!request || request.status !== 'pending') return note('That photo was already answered.');
  if (decision === 'decline')
    return {
      live,
      request: { ...request, status: 'declined', url: '', path: '', decidedBy: me, decidedAt: now, note: why || 'Team management didn’t approve this one.' },
      drop: request.path ? [request.path] : [],
      told: 'declined',
    };
  return {
    live: { by: request.by, url: request.url, path: request.path, w: request.w || 0, h: request.h || 0, caption: request.caption, at: now, decidedBy: me },
    request: { ...request, status: 'approved', decidedBy: me, decidedAt: now, note: '' },
    drop: live?.path && live.path !== request.path ? [live.path] : [],
    told: 'approved',
  };
}

// The owner takes their photo back (both the waiting one and the showing
// one). Their request doc stays as an empty record so the daily limit holds.
export function removeCheck({ request, live, me }) {
  const has = (request && request.status !== 'removed') || live;
  if (!has) return note('There’s no photo to remove.');
  return {
    drop: [...new Set([request?.path, live?.path].filter(Boolean))],
    request: { by: request?.by || me, status: 'removed', url: '', path: '', caption: '', at: request?.at || 0, tries: request?.tries || null },
  };
}

// What a person sees of their own photo: the one showing, and where the
// latest one stands.
export function viewPhoto({ request, live }) {
  const waiting = request?.status === 'pending' ? request : null;
  const declined = request?.status === 'declined' ? request : null;
  return { showing: live || null, waiting, declined };
}
