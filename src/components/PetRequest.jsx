import { createContext, useContext, useState } from 'react';
import { SPECIES } from '../../functions/shared/pets.js';
import { firstName } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';

// "Don't see yours? Request a pet": files a normal feature request titled
// "Pet request: <animal>" so the team can 👍 it in Feature requests, and
// checks first for the same animal (already a pet here, or already asked).
// Workspace provides { requests, me, add(text) -> Promise<boolean>, vote(id), on }.
export const PetRequestContext = createContext(null);

export const PET_PREFIX = 'Pet request: ';
const OPEN = ['new', 'planned', 'working'];

// "a Red Panda", "axolotls" -> "red panda", "axolotl": lowercase, letters only, no a/an/the, no plural s.
export const animalKey = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['a', 'an', 'the'].includes(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');

// The animal in a filed request: the first line, after the prefix.
const animalOf = (r) => (String(r.text || '').startsWith(PET_PREFIX) ? String(r.text).slice(PET_PREFIX.length).split('\n')[0] : null);

// Is this animal already a species here? "monkey" is the Proboscis monkey.
export function speciesFor(animal) {
  const k = animalKey(animal);
  if (!k) return null;
  const words = k.split(' ');
  return (
    SPECIES.find((s) => animalKey(s.id) === k || animalKey(s.name) === k || (s.also || []).some((w) => animalKey(w) === k)) ||
    SPECIES.find((s) => {
      const sw = animalKey(s.name).split(' ');
      return words.every((w) => sw.includes(w));
    }) ||
    null
  );
}
// An open pet request for the same animal, if someone already filed one.
export const askedFor = (requests, animal) => {
  const k = animalKey(animal);
  return (k && requests.find((r) => OPEN.includes(r.status) && animalKey(animalOf(r)) === k)) || null;
};

export function RequestPetLink() {
  const ctx = useContext(PetRequestContext);
  const [open, setOpen] = useState(false);
  if (!ctx?.on) return null;
  return (
    <>
      <p className="pet-request-line">
        <button type="button" className="link-btn small" onClick={() => setOpen(true)}>
          Don’t see yours? Request a pet
        </button>
      </p>
      {open && <RequestPetDialog ctx={ctx} onClose={() => setOpen(false)} />}
    </>
  );
}

function RequestPetDialog({ ctx, onClose }) {
  const [animal, setAnimal] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const name = animal.trim();
  const species = speciesFor(name);
  const dup = askedFor(ctx.requests, name);
  const voted = !!dup && !!dup.votes?.[ctx.me];
  const send = async () => {
    if (!name || species || dup || busy) return;
    setBusy(true);
    setError('');
    const n = note.trim();
    const ok = await ctx.add(`${PET_PREFIX}${name}${n ? `\n${n}` : ''}`);
    setBusy(false);
    if (ok === false) return setError('That didn’t send. Try again.');
    setDone(`Sent: ${name}.`);
  };
  const addVote = async () => {
    setBusy(true);
    await ctx.vote(dup.id);
    setBusy(false);
    setDone(`You added your 👍 to ${animalOf(dup)}.`);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };
  return (
    <Overlay>
      <div className="panel-backdrop center ask-backdrop" onClick={onClose} onKeyDown={onKey}>
        <div className="dialog ask pet-request" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pet-request-title">
          <div className="pet-request-head">
            <h2 id="pet-request-title">Request a pet</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {done ? (
            <>
              <p role="status">
                {done} Everyone can 👍 it in Feature requests, and it goes to {firstName(ctx.owner)}.
              </p>
              <div className="ask-actions">
                <button className="btn primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="ask-field">
                <span className="small muted">Which animal?</span>
                <input className="input" value={animal} maxLength={40} autoFocus placeholder="An axolotl, a capybara…" onChange={(e) => setAnimal(e.target.value)} />
              </label>
              <label className="ask-field">
                <span className="small muted">Anything we should know? (optional)</span>
                <textarea className="input" rows={3} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Colors, what it does…" />
                <span className="tiny muted mono pet-request-count">{note.length}/200</span>
              </label>
              {species && (
                <p className="pet-request-note" role="status">
                  {species.name} is already here. Look for it under Adopt a pet.
                </p>
              )}
              {dup && !species && (
                <p className="pet-request-note" role="status">
                  Someone already asked: <b>{animalOf(dup)}</b> ({firstName(dup.by)}
                  {Object.keys(dup.votes || {}).length ? `, 👍 ${Object.keys(dup.votes).length}` : ''}). {voted ? 'You already 👍’d it.' : 'Add your 👍 instead.'}
                </p>
              )}
              {error && <p className="danger small">{error}</p>}
              <div className="ask-actions">
                <button className="btn" onClick={onClose}>
                  Cancel
                </button>
                {dup && !species ? (
                  <button className="btn primary" disabled={busy || voted} onClick={addVote}>
                    Add my 👍
                  </button>
                ) : (
                  <button className="btn primary" disabled={!name || !!species || busy} onClick={send}>
                    {busy ? 'Sending…' : 'Send request'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
