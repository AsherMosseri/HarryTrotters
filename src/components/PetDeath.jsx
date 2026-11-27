import { useState } from 'react';
import { RESPECTS_NEEDED, adoptWaitText, memorialLine, neglectLine, sleepLine } from '../../functions/shared/petdeath.js';
import { SPECIES } from '../../functions/shared/pets.js';
import { useMarket } from '../market.js';
import { Avatar } from './common.jsx';
import { promptDialog } from './Dialogs.jsx';
import { PetWithGear } from './PetGear.jsx';
import { PhotoPet } from './PetPhoto.jsx';
import { Icon } from './shell/icons.jsx';

// Pets can die (3.3): the warning on a pet's card, the funeral card in
// #general with Pay respects, "In memory" on the Pets shelf, the wait before
// adopting again, asking Asher to turn pet death off and his answers. The
// rule is functions/shared/petdeath.js; the server (functions/petdeath.js)
// decides and writes, so this only shows and asks. Nothing here costs coins.

const first = (n = '') => n.split(' ')[0];
const said = (r) => [r?.note?.title, r?.note?.body].filter(Boolean).join(' ');
const speciesName = (id) => SPECIES.find((s) => s.id === id)?.name || id;
const ago = (at) => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
const dateText = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ---------- on a pet's card ----------
// owner: whose pet; mine: it's the viewer's. The countdown only shows to its
// owner; the sleeping line shows to everyone.
export function PetNeglect({ owner, pet, mine = false }) {
  const death = useMarket()?.death;
  if (!death || !pet) return null;
  const fate = death.fateOf(owner, pet);
  if (fate.status === 'asleep')
    return (
      <p className="pd-line pd-sleep">
        <span aria-hidden="true">💤</span>
        <span>{sleepLine(pet.name, { owner, mine, why: fate.why })}</span>
      </p>
    );
  if (fate.status === 'neglected' && mine)
    return (
      <p className={`pd-line pd-warn${fate.left <= 2 ? ' urgent' : ''}`} role="status">
        <Icon name="food" size={15} />
        <span>{neglectLine(pet.name, fate)}</span>
      </p>
    );
  return null;
}

// ---------- asking Asher to turn pet death off (under your pets) ----------
export function DeathOffRow({ onToast }) {
  const market = useMarket();
  const death = market?.death;
  const [busy, setBusy] = useState(false);
  if (!death) return null;
  const mine = death.mine;
  const status = mine?.status || '';
  const ask = async () => {
    const reason = await promptDialog({
      title: death.owner ? 'Turn off pet death for you?' : 'Ask Asher to turn off pet death?',
      body: death.owner
        ? 'Your pets still get hungry and bored, but they can’t die.'
        : 'If Asher says yes, your pets still get hungry and bored, but they can’t die. A reason helps (optional).',
      placeholder: death.owner ? '' : 'For example: a trip with no phone',
      maxLength: 140,
      okLabel: death.owner ? 'Turn off' : 'Ask',
    });
    if (reason == null) return;
    setBusy(true);
    const r = await death.ask(reason);
    setBusy(false);
    if (r?.note) onToast(said(r));
    else if (r?.ok) onToast(r.status === 'off' ? 'Pet death is off for you.' : 'Asked. Asher will answer soon.');
  };
  const turnBackOn = async () => {
    setBusy(true);
    const r = await death.answer(mine.id, 'restore', 'You turned it back on.');
    setBusy(false);
    onToast(r?.ok ? 'Pet death is back on for you.' : said(r) || 'That didn’t go through.');
  };
  return (
    <div className="pd-off-row">
      {status === 'off' ? (
        <p className="pd-line pd-safe">
          <Icon name="shield" size={15} />
          <span>
            Pet death is off for you. Your pets still get hungry and bored.
            {mine.note && !death.owner && <span className="muted"> Asher: “{mine.note}”</span>}
          </span>
        </p>
      ) : status === 'pending' ? (
        <p className="pd-line muted small">
          <Icon name="clock" size={15} />
          <span>You asked Asher to turn off pet death {ago(mine.at)}. Waiting for his answer.</span>
        </p>
      ) : (
        <>
          {status === 'declined' && (
            <p className="pd-line muted small">
              <span>
                Asher said no{mine.note ? `: “${mine.note}”` : '.'} You can ask again.
              </span>
            </p>
          )}
          {status === 'on' && (
            <p className="pd-line muted small">
              <span>
                Pet death is back on for you{mine.note ? `: “${mine.note}”` : '.'}
              </span>
            </p>
          )}
          <p className="muted tiny pd-rule">A pet with no food and no fun for a week dies. You get a warning on days 3, 5 and 6.</p>
          <button className="link-btn small pd-ask" disabled={busy} onClick={ask}>
            {death.owner ? 'Turn off pet death for me' : 'Ask to turn off pet death'}
          </button>
        </>
      )}
      {status === 'off' && death.owner && (
        <button className="link-btn small pd-ask" disabled={busy} onClick={turnBackOn}>
          Turn pet death back on for me
        </button>
      )}
    </div>
  );
}

// ---------- Asher's answers (bottom of the Pets shelf) ----------
export function PetDeathReview({ onToast }) {
  const market = useMarket();
  const death = market?.death;
  const [busy, setBusy] = useState('');
  if (!death?.owner) return null;
  const others = death.offFor.filter((a) => a.by !== market.me);
  const petOf = (who) => market.petsOf(who)[0]?.pet;
  const answer = async (a, decision) => {
    const words = {
      approve: { title: `Turn off pet death for ${first(a.by)}?`, body: 'Their pets still get hungry, but can’t die. Add a note they’ll see (optional).', ok: 'Approve', done: `Pet death is off for ${first(a.by)}.` },
      decline: { title: `Decline ${first(a.by)}’s ask?`, body: 'Say why. They see this, and can ask again later.', ok: 'Decline', done: 'Declined. They’ve been told.' },
      restore: { title: `Turn pet death back on for ${first(a.by)}?`, body: 'Their week starts fresh from now. Say why (they see it).', ok: 'Turn back on', done: `Pet death is back on for ${first(a.by)}.` },
    }[decision];
    const note = await promptDialog({ title: words.title, body: words.body, maxLength: 140, okLabel: words.ok });
    if (note == null) return;
    setBusy(`${a.id}:${decision}`);
    const r = await death.answer(a.id, decision, note);
    setBusy('');
    onToast(r?.ok ? words.done : said(r) || 'That didn’t go through.');
  };
  return (
    <section className="mk-sec" id="pet-death-asks">
      <div className="sec-head">
        <h2>Pet death asks</h2>
        <span className="muted tiny mono">{death.waiting.length} waiting</span>
      </div>
      <p className="muted small">Teammates who want their pets kept safe. Approve or decline; they see your note.</p>
      <ul className="mk-list pd-asks">
        {death.waiting.map((a) => {
          const pet = petOf(a.by);
          return (
            <li key={a.id} className="pd-ask-card">
              <Avatar name={a.by} size={40} />
              <div className="pd-ask-main">
                <b>{a.by}</b>
                <span className="muted small">{pet ? `${pet.name} the ${speciesName(pet.species).toLowerCase()}` : 'No pet right now'}</span>
                {a.reason ? <span className="pd-reason">“{a.reason}”</span> : <span className="muted small">No reason given.</span>}
                <span className="muted tiny mono">{ago(a.at)}</span>
                <div className="mk-row-btns">
                  <button className="btn small primary" disabled={!!busy} onClick={() => answer(a, 'approve')}>
                    <Icon name="check" size={16} /> Approve
                  </button>
                  <button className="btn small" disabled={!!busy} onClick={() => answer(a, 'decline')}>
                    Decline
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {!death.waiting.length && <li className="muted small">Nothing waiting.</li>}
      </ul>
      {others.length > 0 && (
        <details className="pp-showing">
          <summary>Off for ({others.length})</summary>
          <ul className="mk-list pd-asks">
            {others.map((a) => (
              <li key={a.id} className="pd-ask-card">
                <Avatar name={a.by} size={40} />
                <div className="pd-ask-main">
                  <b>{a.by}</b>
                  {a.reason && <span className="pd-reason">“{a.reason}”</span>}
                  <span className="muted tiny">Since {dateText(a.decidedAt || a.at)}</span>
                  <div className="mk-row-btns">
                    <button className="btn small" disabled={!!busy} onClick={() => answer(a, 'restore')}>
                      Turn back on
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// ---------- a pet that died: its picture ----------
function MemorialArt({ m, size }) {
  const drawn = (
    <PetWithGear species={m.species} mood="ok" stage={m.stage || 'baby'} size={size} title={`${m.name} the ${speciesName(m.species).toLowerCase()}`} gear={m.gear} still />
  );
  return (
    <span className="pd-art" style={{ '--pd': `${size}px` }}>
      <span className="pd-halo" aria-hidden="true" />
      {m.photo?.url ? <PhotoPet photo={m.photo} size={size} title={m.name} fallback={drawn} /> : drawn}
    </span>
  );
}

// Who paid respects, and the button.
function Respects({ m, compact = false }) {
  const market = useMarket();
  const death = market?.death;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const me = market?.me;
  const mine = m.person === me;
  const paid = m.respects.some((r) => r.name === me);
  const who = m.respects.map((r) => r.name).filter((n) => n !== m.person);
  const pay = async () => {
    setBusy(true);
    setErr('');
    const r = await death.respects(m.id);
    setBusy(false);
    if (r?.note) setErr(said(r));
  };
  return (
    <div className={`pd-respects${compact ? ' compact' : ''}`}>
      {!mine && (
        <button className={`btn small${paid ? '' : ' primary'} pd-pay`} disabled={busy || paid} onClick={pay} aria-pressed={paid}>
          <span aria-hidden="true">{paid ? '💐' : '🕯️'}</span> {paid ? 'You paid respects' : 'Pay respects'}
        </button>
      )}
      {who.length > 0 ? (
        <div className="pd-who">
          <span className="pd-faces" aria-hidden="true">
            {who.slice(0, 6).map((n) => (
              <Avatar key={n} name={n} size={22} />
            ))}
          </span>
          <span className="small">
            {who.length <= 3 ? who.map(first).join(', ') : `${who.slice(0, 2).map(first).join(', ')} and ${who.length - 2} more`} paid respects
          </span>
        </div>
      ) : (
        <span className="muted small">{mine ? 'Your teammates can pay respects here.' : 'Be the first to pay respects.'}</span>
      )}
      {err && <p className="danger small">{err}</p>}
    </div>
  );
}

// ---------- the funeral card in #general (a Trotbot card) ----------
export function FuneralBody({ c }) {
  const market = useMarket();
  const death = market?.death;
  // Live respects from the memorial; the card itself keeps what it was posted with.
  const m = death?.memorial(c.id) || { id: c.id, person: c.person, ...c.pet, respects: [], diedAt: 0 };
  const line = death && m.diedAt ? memorialLine(m, { me: market.me, now: market.now }) : '';
  return (
    <div className="pd-funeral">
      <div className="pd-rainbow" aria-hidden="true" />
      <div className="pd-funeral-top">
        <MemorialArt m={m} size={84} />
        <div className="pd-funeral-text">
          <div className="pd-funeral-title">{m.name} crossed the rainbow bridge</div>
          <div className="muted small">
            {first(m.person)}’s {speciesName(m.species).toLowerCase()} · Level <span className="mono">{m.level}</span>
          </div>
          <div className="muted small">With us for {m.lived}. Thanks for every snack and toy, {m.name}.</div>
        </div>
      </div>
      {death && <Respects m={m} />}
      {line && <p className="muted tiny pd-adopt-line">{line}</p>}
    </div>
  );
}

// ---------- "In memory" on the Pets shelf ----------
export function InMemory() {
  const market = useMarket();
  const death = market?.death;
  const [all, setAll] = useState(false);
  if (!death?.memorials.length) return null;
  const list = all ? death.memorials : death.memorials.slice(0, 4);
  return (
    <section className="mk-sec" id="in-memory">
      <div className="sec-head">
        <h2>In memory</h2>
        <span className="muted tiny">
          <span className="mono">{death.memorials.length}</span> {death.memorials.length === 1 ? 'pet' : 'pets'}
        </span>
      </div>
      <ul className="pd-memorials">
        {list.map((m) => {
          const line = memorialLine(m, { me: market.me, now: market.now });
          return (
            <li key={m.id} className="pd-memorial">
              <MemorialArt m={m} size={64} />
              <div className="pd-memorial-main">
                <div className="pet-name-row">
                  <b className="pet-name">{m.name}</b>
                  <span className="pet-level">
                    Level <span className="mono">{m.level}</span>
                  </span>
                </div>
                <span className="muted small">
                  {first(m.person)}’s {speciesName(m.species).toLowerCase()} · {dateText(m.diedAt)} · with us for {m.lived}
                </span>
                <Respects m={m} compact />
                {line && <span className="muted tiny">{line}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {death.memorials.length > 4 && (
        <button className="link-btn small" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${death.memorials.length}`}
        </button>
      )}
    </section>
  );
}

// ---------- the wait before adopting again ----------
// null when you can adopt.
export function AdoptWaitNote() {
  const market = useMarket();
  const w = market?.death?.wait;
  if (!w) return null;
  return (
    <div className="pd-wait" role="status">
      <MemorialArt m={w.memorial} size={48} />
      <div>
        <b>{w.memorial.name} is still being remembered.</b>
        <p className="small">{adoptWaitText(w, market.now)}</p>
        <p className="muted tiny">
          {RESPECTS_NEEDED} teammates’ respects or 3 days, whichever comes first. They pay respects on the card in #general or under In memory.
        </p>
      </div>
    </div>
  );
}
