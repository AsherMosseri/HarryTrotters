import { Suspense, lazy, useEffect, useState } from 'react';
import { useMarket } from '../market.js';
import { confirmDialog, promptDialog } from './Dialogs.jsx';
import { Icon } from './shell/icons.jsx';

// Photos of real pets beside their drawn ones (3.0.9). A person adds one
// cut-out photo of their real pet; it shows as a framed sticker beside their
// pet once team management approves it. It never replaces the drawn pet.
// The cut-out happens on the device (PetPhotoDialog.jsx, loaded only when
// someone opens it); the checks are on the server (functions/petphotos.js).

const PetPhotoDialog = lazy(() => import('./PetPhotoDialog.jsx'));
const first = (n = '') => n.split(' ')[0];
const said = (r) => [r?.note?.title, r?.note?.body].filter(Boolean).join(' ');
const ago = (at) => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

// The sticker itself: a small framed picture, tilted a little, fixed size, loaded
// when it scrolls into view. Nothing shows if there is no photo or it fails.
export function PetSticker({ photo, size = 96, mini = false, pending = false, className = '' }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [photo?.url]);
  if (!photo?.url || bad) return null;
  // The frame is as tall as `size` and as wide as the picture is (the server
  // reads the real size from the file), so it never jumps when it loads.
  const ar = photo.w > 0 && photo.h > 0 ? Math.min(1.5, Math.max(0.55, photo.w / photo.h)) : 1;
  return (
    <span className={`pp-sticker${mini ? ' mini' : ''}${pending ? ' pending' : ''}${className ? ` ${className}` : ''}`} style={{ '--pp': `${size}px`, '--ar': ar }}>
      <img
        src={photo.url}
        alt={photo.caption ? `${photo.caption}, the real pet` : 'The real pet'}
        width={Math.round(size * ar)}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setBad(true)}
      />
    </span>
  );
}

// Someone's approved sticker (null without one, or with Photos switched off).
export function usePetPhoto(name) {
  const market = useMarket();
  return market?.photos?.of(name) || null;
}

// Beside the pet on its own card: the approved photo; or, when there is none
// yet, your waiting one (so you can see what you sent).
export function OwnSticker({ size = 96 }) {
  const market = useMarket();
  const photos = market?.photos;
  if (!photos?.on) return null;
  const live = photos.of(market.me);
  if (live) return <PetSticker photo={live} size={size} />;
  if (photos.mine?.status === 'pending') return <PetSticker photo={photos.mine} size={size} pending />;
  return null;
}

// Your buttons for it, under your pet's card: add, change, remove, and where
// the latest one stands.
export function PetPhotoRow({ pet, onToast }) {
  const market = useMarket();
  const photos = market?.photos;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!photos?.on) return null;
  const live = photos.of(market.me);
  const mine = photos.mine;
  const waiting = mine?.status === 'pending';
  const declined = mine?.status === 'declined' && !waiting;
  const has = !!live || waiting;
  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Remove the photo?',
      body: live ? 'It stops showing. You can add another one.' : 'It won’t be sent to team management.',
      okLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const r = await photos.remove();
    setBusy(false);
    onToast(r?.ok ? 'Photo removed.' : said(r) || 'That didn’t go through.');
  };
  return (
    <div className="pp-row">
      <div className="pp-row-top">
        <button className="btn small" onClick={() => setOpen(true)} disabled={busy}>
          <Icon name="camera" size={16} /> {has ? 'Change photo' : 'Add a photo of your real pet'}
        </button>
        {has && (
          <button className="link-btn small danger" onClick={remove} disabled={busy}>
            Remove photo
          </button>
        )}
      </div>
      {live?.caption && !waiting && (
        <p className="muted tiny">
          {pet ? `Shown beside ${pet.name}` : 'Shown on your profile'}: {live.caption}
        </p>
      )}
      {waiting && (
        <p className="pp-badge" role="status">
          <Icon name="clock" size={13} /> Waiting for team management
        </p>
      )}
      {waiting && live && <p className="muted tiny">Your earlier photo keeps showing until the new one is approved.</p>}
      {declined && (
        <p className="pp-declined small" role="status">
          <Icon name="cross" size={13} /> Not approved: {mine.note || 'team management didn’t approve it.'} You can try another photo.
        </p>
      )}
      {open && (
        <Suspense fallback={null}>
          <PetPhotoDialog pet={pet} onClose={() => setOpen(false)} onToast={onToast} />
        </Suspense>
      )}
    </div>
  );
}

// Team management: photos waiting for an answer, and the ones showing now.
export function PetPhotoReview({ onToast }) {
  const market = useMarket();
  const photos = market?.photos;
  const [busy, setBusy] = useState('');
  if (!photos?.on) return null;
  const petOf = (who) => market.petsOf(who)[0]?.pet;
  const run = async (id, decision, note, done) => {
    setBusy(`${id}:${decision}`);
    const r = await photos.decide(id, decision, note);
    setBusy('');
    onToast(r?.ok ? done : said(r) || 'That didn’t go through.');
  };
  const decline = async (p) => {
    const note = await promptDialog({
      title: `Decline ${first(p.by)}’s photo?`,
      body: 'Say why, so they can fix it. They see this.',
      placeholder: 'For example: the pet is too small in the picture',
      maxLength: 140,
      okLabel: 'Decline',
    });
    if (note == null) return;
    run(p.id, 'decline', note, 'Declined. They’ve been told.');
  };
  const takeDown = async (p) => {
    const note = await promptDialog({
      title: `Take down ${first(p.by)}’s photo?`,
      body: 'It stops showing for everyone. Say why (they see it).',
      maxLength: 140,
      okLabel: 'Take down',
    });
    if (note == null) return;
    run(p.id, 'remove', note, 'Taken down.');
  };
  const card = (p, waiting) => {
    const pet = petOf(p.by);
    return (
      <li key={`${p.id}-${waiting ? 'w' : 's'}`} className="pp-review">
        <span className="pp-checker pp-review-img">
          <img src={p.url} alt={`Photo of ${p.caption || 'the pet'} from ${p.by}`} width={120} height={120} loading="lazy" decoding="async" />
        </span>
        <div className="pp-review-main">
          <b>{p.by}</b>
          <span className="muted small">
            {pet ? `${pet.name} the ${pet.species}` : 'No pet'}
            {p.caption ? ` · “${p.caption}”` : ''}
          </span>
          <span className="muted tiny mono">{ago(p.at)}</span>
          <div className="mk-row-btns">
            {waiting ? (
              <>
                <button className="btn small primary" disabled={!!busy} onClick={() => run(p.id, 'approve', '', `${first(p.by)}’s photo is up.`)}>
                  <Icon name="check" size={16} /> Approve
                </button>
                <button className="btn small" disabled={!!busy} onClick={() => decline(p)}>
                  Decline
                </button>
              </>
            ) : (
              <button className="btn small" disabled={!!busy} onClick={() => takeDown(p)}>
                Remove
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };
  return (
    <section className="mk-sec" id="pet-photos">
      <div className="sec-head">
        <h2>Pet photos</h2>
        <span className="muted tiny mono">{photos.waiting.length} waiting</span>
      </div>
      <p className="muted small">Cut-outs of teammates’ real pets. Nobody sees one until you approve it.</p>
      <ul className="mk-list pp-review-list">
        {photos.waiting.map((p) => card(p, true))}
        {!photos.waiting.length && <li className="muted small">Nothing waiting.</li>}
      </ul>
      {photos.showing.length > 0 && (
        <details className="pp-showing">
          <summary>Showing now ({photos.showing.length})</summary>
          <ul className="mk-list pp-review-list">{photos.showing.map((p) => card(p, false))}</ul>
        </details>
      )}
    </section>
  );
}
