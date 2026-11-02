import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_GEAR, SPECIES, cleanGear, eventGearItem, gearItem, moodLine, titleOf } from '../../functions/shared/pets.js';
import { anyReached, eventView, leftLabel, statusOf, MIN_HOURS } from '../../functions/shared/events.js';
import { teamDay } from '../../functions/shared/coins.js';
import { celebrate } from '../motion.js';
import { useMarket } from '../market.js';
import { useEscape } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';
import { confirmDialog } from './Dialogs.jsx';
import CountUp from './CountUp.jsx';
import { PetWithGear } from './PetGear.jsx';
import { Icon } from './shell/icons.jsx';

// The pet park and team events (3.0.4). The park is a calm scene with every
// teammate's pets in it; an event is a meter the whole team's lab time fills,
// with tiers that give pet gear to the people who helped. The numbers come
// from the server (functions/petevents.js, math in functions/shared/events.js);
// this only shows them and asks. The park shows what profiles already show
// (name, level, title, gear, mood), nothing private.

const speciesName = (id) => SPECIES.find((x) => x.id === id)?.name || id;
const hours1 = (n) => n.toFixed(1);
const said = (r) => [r?.note?.title, r?.note?.body].filter(Boolean).join(' ');
const dayLabel = (day) => new Date(`${day}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
// A small number from a name, so each pet keeps its own spot and rhythm.
const spin = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// ---------- the party ----------
// When a tier was reached since this device last showed it: confetti over the
// scene, and every moving pet hops (CSS, only while "Moving things" plays).
export function useParty(ev, ref) {
  const reached = ev ? Object.keys(ev.reached || {}).length : 0;
  const [party, setParty] = useState(false);
  const id = ev?.id;
  useEffect(() => {
    if (!id || !reached) return;
    const key = `park-party-${id}`;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(key)) || 0;
    } catch {
      /* storage unavailable */
    }
    if (reached <= seen) return;
    setParty(true);
    const bursts = [300, 750, 1200].map((ms) => setTimeout(() => ref.current && celebrate({ el: ref.current, count: 26 }), ms));
    const end = setTimeout(() => {
      setParty(false);
      try {
        localStorage.setItem(key, String(reached));
      } catch {
        /* storage unavailable */
      }
    }, 5200);
    return () => {
      bursts.forEach(clearTimeout);
      clearTimeout(end);
    };
  }, [id, reached, ref]);
  return party;
}

// ---------- the scene ----------
// Everyone's pets, the best-known first. Up to `moving` of them move, the
// rest stand still (an iPad keeps up that way), and a big team starts with
// the first `initial` and a button for the rest.
export function ParkScene({ ev = null, compact = false, moving = 12, initial = 24, onPick }) {
  const market = useMarket();
  const root = useRef(null);
  const [more, setMore] = useState(false);
  const party = useParty(ev, root);
  const all = useMemo(() => {
    const out = [];
    for (const owner of market.pets.keys()) for (const { pet, st } of market.petsOf(owner)) out.push({ key: `${owner}:${pet.adoptedAt}`, owner, pet, st });
    return out.sort((a, b) => b.st.level - a.st.level || a.owner.localeCompare(b.owner) || a.pet.adoptedAt - b.pet.adoptedAt);
  }, [market.pets, market.petsOf]);
  const cap = compact ? 7 : more ? all.length : initial;
  const shown = all.slice(0, cap);
  const top = ev ? Math.max(-1, ...Object.keys(ev.reached || {}).map(Number)) : -1;
  const last = ev?.tiers?.[top] || null;
  const size = compact ? 56 : 76;
  return (
    <div ref={root} className={`park${compact ? ' compact' : ''}${party ? ' party' : ''}`} role="group" aria-label="Pet park">
      <span className="park-sun" aria-hidden="true" />
      <span className="park-cloud c1" aria-hidden="true" />
      <span className="park-cloud c2" aria-hidden="true" />
      <span className="park-hill h1" aria-hidden="true" />
      <span className="park-hill h2" aria-hidden="true" />
      {party && last && (
        <p className="park-banner" role="status">
          <Icon name="sparkle" size={16} /> {ev.title}: {last.label} reached
        </p>
      )}
      <div className="park-field">
        {shown.map((e, i) => {
          const h = spin(e.key);
          return (
            <button
              key={e.key}
              type="button"
              className="park-pet"
              style={{ '--pd': `${-(h % 40) / 10}s`, '--dy': `${(h % 5) * 4}px` }}
              onClick={() => onPick?.(e)}
              aria-label={`${e.pet.name}, ${e.owner}’s ${e.pet.species}, level ${e.st.level}`}
            >
              <PetWithGear species={e.pet.species} mood={party ? 'happy' : e.st.mood} stage={e.st.stage} size={size} gear={e.pet.gear} still={i >= moving} />
              {!compact && <span className="park-name">{e.pet.name}</span>}
            </button>
          );
        })}
        {!all.length && <p className="park-empty">No pets in the park yet. Adopt one in Market, Pets.</p>}
      </div>
      {!compact && all.length > initial && (
        <button className="park-more text-btn" onClick={() => setMore(!more)}>
          {more ? 'Show fewer' : `Show everyone (${all.length - initial} more)`}
        </button>
      )}
    </div>
  );
}

// ---------- a pet's card ----------
export function ParkCard({ entry, onClose }) {
  useEscape(onClose);
  const { pet, st, owner } = entry;
  const worn = Object.values(cleanGear(pet.gear))
    .filter(Boolean)
    .map((id) => (gearItem(id) || eventGearItem(id))?.name)
    .filter(Boolean);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog park-card" role="dialog" aria-label={pet.name} onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>{pet.name}</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="park-card-body">
            <div className="pet-stage">
              <PetWithGear species={pet.species} mood={st.mood} stage={st.stage} size={120} gear={pet.gear} title={`${pet.name} the ${pet.species}`} />
            </div>
            <dl className="park-facts">
              <dt>Owner</dt>
              <dd>{owner}</dd>
              <dt>Level</dt>
              <dd className="mono">{st.level}</dd>
              <dt>Title</dt>
              <dd>{titleOf(st.level)}</dd>
              <dt>Kind</dt>
              <dd>{speciesName(pet.species)}</dd>
              <dt>Wearing</dt>
              <dd>{worn.length ? worn.join(', ') : 'Nothing yet'}</dd>
            </dl>
          </div>
          <p className="muted small park-mood">{moodLine(pet.name, st)}</p>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- the meter ----------
// One event: hours so far against the goal, the tiers on the bar, time left,
// and what you've put in. `compact` is the small one on Today.
export function EventMeter({ ev, compact = false }) {
  const market = useMarket();
  const me = market.me;
  const v = eventView(ev, { me, now: market.now, rename: market.rename });
  const mine = v.shares(me);
  const live = v.status === 'live';
  const upcoming = v.status === 'upcoming';
  let youLine;
  if (upcoming) youLine = `Starts ${dayLabel(teamDay(ev.startsAt))}`;
  else if (v.mine > 0) youLine = `You’ve put in ${hours1(v.mine)} h`;
  else youLine = live ? `You haven’t put in time yet` : 'You didn’t log time';
  const need = v.mine < MIN_HOURS && live && v.tiers.some((t) => t.gearName) ? `${MIN_HOURS} hour or more of your own time earns the rewards.` : '';
  return (
    <div className={`ev-meter${compact ? ' compact' : ''} st-${v.status}`}>
      <div className="ev-top">
        <h3 className="ev-title">
          <Icon name="trophy" size={16} /> {ev.title}
        </h3>
        <span className="ev-time mono">{leftLabel(v)}</span>
      </div>
      <div className="ev-nums">
        <span className="ev-big mono">
          <CountUp value={v.hours} format={hours1} /> <small>/ {v.goal} h</small>
        </span>
        <span className="ev-mine">{youLine}</span>
      </div>
      <div className="ev-track" role="meter" aria-valuenow={v.hours} aria-valuemin={0} aria-valuemax={v.goal} aria-label={`${ev.title}: team hours`}>
        <span className="ev-fill" style={{ transform: `scaleX(${Math.max(v.pct, v.hours > 0 ? 1.5 : 0) / 100})` }} />
        {v.tiers.map((t) => (
          <span key={t.i} className={`ev-tick${t.done ? ' done' : ''}${t.at >= 86 ? ' end' : ''}`} style={{ left: `${t.at}%` }} title={`${t.label}: ${t.hours} h`}>
            <i />
            <b className="mono">{t.hours}</b>
          </span>
        ))}
      </div>
      {v.next && live ? (
        <p className="ev-next">
          <span className="mono">{hours1(v.toNext)} h</span> to {v.next.label}
          {v.next.gearName ? ` · ${v.next.gearName}` : ''}
        </p>
      ) : v.done ? (
        <p className="ev-next">Every tier reached. Nice work, team.</p>
      ) : null}
      {!compact && (
        <ol className="ev-tiers">
          {v.tiers.map((t) => {
            const got = mine.some((m) => m.i === t.i);
            return (
              <li key={t.i} className={t.done ? 'done' : ''}>
                <span className="ev-tier-mark" aria-hidden="true">
                  <Icon name={t.done ? 'check' : 'lock'} size={14} />
                </span>
                <span className="mono ev-tier-h">{t.hours} h</span>
                <span className="ev-tier-label">
                  {t.label}
                  {t.gearName && <span className="muted"> · {t.gearName}</span>}
                </span>
                {t.done && t.gearName && <span className={`ev-tier-got${got ? ' yes' : ''}`}>{got ? 'Yours' : 'Needed 1 h'}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {!compact && need && <p className="muted small">{need}</p>}
    </div>
  );
}

// ---------- on the Pets shelf ----------
export function ParkSection() {
  const market = useMarket();
  const [pick, setPick] = useState(null);
  const lead = market.events[0];
  return (
    <section className="mk-sec" id="pet-park">
      <div className="sec-head">
        <h2>Pet park</h2>
        <span className="muted tiny mono">
          {market.pets.size} {market.pets.size === 1 ? 'owner' : 'owners'}
        </span>
      </div>
      {market.events.map((ev) => (
        <EventMeter key={ev.id} ev={ev} />
      ))}
      <ParkScene ev={lead} onPick={setPick} />
      {pick && <ParkCard entry={pick} onClose={() => setPick(null)} />}
    </section>
  );
}

// ---------- Today ----------
export function ParkCardToday({ onOpen }) {
  const market = useMarket();
  const [pick, setPick] = useState(null);
  if (!market) return null;
  const ev = market.events.find((e) => ['live', 'upcoming'].includes(statusOf(e, market.now))) || market.events[0];
  if (!ev && !market.pets.size) return null;
  return (
    <section className="today-sec park-today">
      <div className="sec-head">
        <h2>Pet park</h2>
        {onOpen && (
          <button className="text-btn" onClick={onOpen}>
            Open
          </button>
        )}
      </div>
      {ev && <EventMeter ev={ev} compact />}
      <ParkScene ev={ev} compact onPick={setPick} />
      {pick && <ParkCard entry={pick} onClose={() => setPick(null)} />}
    </section>
  );
}

// ---------- team management: make, change and end events ----------
export function EventsAdmin({ onToast }) {
  const market = useMarket();
  const [form, setForm] = useState(null);
  const list = [...market.allEvents].sort((a, b) => b.startsAt - a.startsAt);
  const end = async (ev) => {
    const ok = await confirmDialog({
      title: `End ${ev.title}?`,
      body: 'Lab time stops counting now. Tiers already reached stay reached, and what people earned stays theirs.',
      okLabel: 'End event',
      danger: true,
    });
    if (!ok) return;
    const r = await market.petEvent({ action: 'end', id: ev.id });
    onToast(r?.ok ? `${ev.title} ended.` : said(r) || 'That didn’t go through.');
  };
  return (
    <section className="mk-sec">
      <div className="sec-head">
        <h2>Team events</h2>
        <button className="text-btn" onClick={() => setForm({})}>
          <Icon name="plus" size={16} /> New event
        </button>
      </div>
      <p className="muted small">The team’s lab time fills the meter. Tiers give pet gear to everyone with an hour or more in the days. Nothing here touches coins.</p>
      <ul className="mk-list ev-admin">
        {list.map((ev) => {
          const v = eventView(ev, { now: market.now });
          const open = v.status === 'live' || v.status === 'upcoming';
          return (
            <li key={ev.id} className="ev-admin-row">
              <div className="ev-admin-main">
                <b>{ev.title}</b>
                <span className="muted small mono">
                  {dayLabel(teamDay(ev.startsAt))} to {dayLabel(teamDay(ev.endsAt - 1))} · {hours1(v.hours)} / {v.goal} h
                </span>
              </div>
              <span className={`ev-chip ${v.status}`}>{{ live: 'Live', upcoming: 'Coming up', over: 'Over', ended: 'Ended' }[v.status]}</span>
              <div className="mk-row-btns">
                {open && (
                  <>
                    <button className="btn small" onClick={() => setForm(ev)}>
                      Edit
                    </button>
                    <button className="btn small" onClick={() => end(ev)}>
                      End
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {!list.length && <li className="muted small">No events yet.</li>}
      </ul>
      {form && <EventForm ev={form.id ? form : null} onClose={() => setForm(null)} onToast={onToast} />}
    </section>
  );
}

function EventForm({ ev, onClose, onToast }) {
  const market = useMarket();
  useEscape(onClose);
  const today = teamDay(Date.now());
  const [f, setF] = useState(() =>
    ev
      ? {
          title: ev.title,
          startDay: teamDay(ev.startsAt),
          endDay: teamDay(ev.endsAt - 1),
          goal: String(ev.goalHours),
          tiers: ev.tiers.map((t) => ({ hours: String(t.hours), label: t.label, gear: t.gear || '' })),
        }
      : {
          title: '',
          startDay: today,
          endDay: teamDay(Date.now() + 6 * 86400000),
          goal: '40',
          tiers: [
            { hours: '10', label: 'Warm-up', gear: '' },
            { hours: '20', label: 'Halfway', gear: '' },
            { hours: '40', label: 'Goal', gear: '' },
          ],
        },
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = !!ev && anyReached(ev);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setTier = (i, k) => (e) => setF({ ...f, tiers: f.tiers.map((t, j) => (j === i ? { ...t, [k]: e.target.value } : t)) });
  const save = async () => {
    setBusy(true);
    setError('');
    const r = await market.petEvent({
      action: ev ? 'edit' : 'create',
      id: ev?.id,
      title: f.title,
      startDay: f.startDay,
      endDay: f.endDay,
      goalHours: f.goal,
      tiers: f.tiers.map((t) => ({ hours: t.hours, label: t.label, gear: t.gear })),
    });
    setBusy(false);
    if (r?.ok) {
      onToast(ev ? 'Event saved.' : 'Event started.');
      onClose();
    } else setError(said(r) || 'That didn’t go through.');
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog mk-editor ev-form" role="dialog" aria-label={ev ? 'Edit event' : 'New event'} onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>{ev ? 'Edit event' : 'New event'}</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {locked && <p className="muted small">A tier was reached, so the first day, the tiers and the rewards are locked. You can change the title, the last day and the goal.</p>}
          <div className="fields">
            <label className="field-label" htmlFor="ev-title">
              Title
            </label>
            <input id="ev-title" className="input" maxLength={60} value={f.title} onChange={set('title')} placeholder="Competition week" />
            <label className="field-label" htmlFor="ev-start">
              First day
            </label>
            <input id="ev-start" className="input" type="date" value={f.startDay} onChange={set('startDay')} disabled={locked} />
            <label className="field-label" htmlFor="ev-end">
              Last day
            </label>
            <input id="ev-end" className="input" type="date" value={f.endDay} onChange={set('endDay')} />
            <label className="field-label" htmlFor="ev-goal">
              Goal (hours)
            </label>
            <input id="ev-goal" className="input mk-num" type="number" inputMode="decimal" min={1} value={f.goal} onChange={set('goal')} />
          </div>
          <fieldset className="ev-tier-fields" disabled={locked}>
            <legend>Tiers</legend>
            {f.tiers.map((t, i) => (
              <div key={i} className="ev-tier-row">
                <input className="input mk-num mono" type="number" inputMode="decimal" min={0} value={t.hours} onChange={setTier(i, 'hours')} aria-label={`Tier ${i + 1} hours`} />
                <span className="muted small">h</span>
                <input className="input" maxLength={24} value={t.label} onChange={setTier(i, 'label')} placeholder="Name" aria-label={`Tier ${i + 1} name`} />
                <select className="input" value={t.gear} onChange={setTier(i, 'gear')} aria-label={`Tier ${i + 1} reward`}>
                  <option value="">No gear</option>
                  {EVENT_GEAR.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {f.tiers.length > 1 && (
                  <button className="icon-btn" onClick={() => setF({ ...f, tiers: f.tiers.filter((_, j) => j !== i) })} aria-label={`Remove tier ${i + 1}`}>
                    <CloseIcon />
                  </button>
                )}
              </div>
            ))}
            {f.tiers.length < 6 && (
              <button className="text-btn" onClick={() => setF({ ...f, tiers: [...f.tiers, { hours: '', label: '', gear: '' }] })}>
                <Icon name="plus" size={16} /> Add a tier
              </button>
            )}
          </fieldset>
          {error && <p className="danger small">{error}</p>}
          <div className="row gap mk-editor-btns">
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {ev ? 'Save' : 'Start event'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
