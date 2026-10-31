import { useMemo, useState } from 'react';
import {
  CHAT_EXTRAS,
  PERK_IDEAS,
  PET_ITEMS,
  STATUSES,
  TOURNAMENT_GAMES,
  cleanPerk,
  pendingReview,
  reviewHolds,
  standings,
  weekFrom,
} from '../../functions/shared/market.js';
import { FULL } from '../../functions/shared/pets.js';
import { commandByName } from '../commands.js';
import { useMarket } from '../market.js';
import { useLocalStorage } from '../util.js';
import { Avatar, CloseIcon, Overlay } from './common.jsx';
import { Coins } from './Coins.jsx';
import { confirmDialog, promptDialog } from './Dialogs.jsx';
import { AdoptPet, PetCard } from './Pet.jsx';
import { Icon } from './shell/icons.jsx';

// The market (F1): spend Jackson coins on pet care, real perks team
// management adds, short-lived chat extras, and game tournaments. Every buy
// is a call to the server (functions/market.js), which checks the balance
// and the limits and writes the spend; this page only shows and asks.

const SHELVES = [
  ['pets', 'Pets', 'paw'],
  ['perks', 'Perks', 'ticket'],
  ['extras', 'Chat extras', 'sparkle'],
  ['games', 'Game entries', 'game'],
];
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayClock = (ms) => new Date(ms).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
function timeLeft(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
const first = (n = '') => n.split(' ')[0];
const said = (r) => [r?.note?.title, r?.note?.body].filter(Boolean).join(' ');
// A tournament score: Tetris points, or Minesweeper seconds to clear.
function scoreText(t, n) {
  if (t.game !== 'minesweeper') return Number(n).toLocaleString('en-US');
  const m = Math.floor(n / 60);
  return m ? `${m}:${(n - m * 60).toFixed(1).padStart(4, '0')}` : `${n.toFixed(1)} s`;
}

export default function MarketView({ actor, balance, onToast, onPlay, onOpenCoins }) {
  const market = useMarket();
  const [shelf, setShelf] = useLocalStorage('market-shelf', 'pets');
  const isManager = !!actor.admin;
  const pending = isManager && market ? market.purchases.filter((p) => p.kind === 'perk' && p.status === 'pending').length : 0;
  // One buy at a time; the server answers with { ok } or a note to show.
  const [busy, setBusy] = useState('');
  const buy = async (item, extra = {}, done) => {
    setBusy(item);
    const r = await market.run('buy', { item, ...extra });
    setBusy('');
    if (r?.ok) done?.(r);
    else onToast(said(r) || 'That didn’t go through.');
    return r;
  };
  if (!market) return null;
  return (
    <main className="content market">
      <header className="mk-head">
        <div>
          <h1 className="mk-title">Market</h1>
          <p className="muted small">Spend your Jackson coins. Nothing here buys anything that’s free in the app.</p>
        </div>
        <button className="mk-balance" onClick={onOpenCoins} title="Your coins">
          <span className="muted tiny">You have</span>
          <Coins n={balance} size={20} />
        </button>
      </header>
      {!market.coinsOn && <p className="mk-off">Jackson coins are off right now, so the market is closed.</p>}
      <div className="segmented mk-shelves" role="tablist" aria-label="Shelves">
        {SHELVES.map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={shelf === id} className={`plain-seg${shelf === id ? ' on' : ''}`} onClick={() => setShelf(id)}>
            <Icon name={icon} size={16} />
            <span className="mk-shelf-label">{label}</span>
            {id === 'perks' && pending > 0 && <span className="mk-dot mono">{pending}</span>}
          </button>
        ))}
      </div>
      {shelf === 'pets' && <PetsShelf actor={actor} balance={balance} buy={buy} busy={busy} onToast={onToast} />}
      {shelf === 'perks' && <PerksShelf actor={actor} balance={balance} buy={buy} busy={busy} onToast={onToast} />}
      {shelf === 'extras' && <ExtrasShelf actor={actor} balance={balance} buy={buy} busy={busy} onToast={onToast} />}
      {shelf === 'games' && <GamesShelf actor={actor} balance={balance} onToast={onToast} onPlay={onPlay} />}
    </main>
  );
}

function Price({ n }) {
  return (
    <span className="mk-price">
      <Coins n={n} size={15} />
    </span>
  );
}

// ---------- pets ----------
function PetsShelf({ actor, balance, buy, busy, onToast }) {
  const market = useMarket();
  const mine = market.petOf(actor.name);
  if (!mine)
    return (
      <section className="mk-sec">
        <div className="sec-head">
          <h2>Adopt a pet</h2>
        </div>
        <AdoptPet />
      </section>
    );
  const { pet, st } = mine;
  return (
    <>
      <section className="mk-sec">
        <div className="sec-head">
          <h2>Your pet</h2>
        </div>
        <PetCard name={actor.name} big owner />
      </section>
      <section className="mk-sec">
        <div className="sec-head">
          <h2>Pet items</h2>
        </div>
        <p className="muted small">Food and fun only. {pet.name} grows with your lab time, never with coins.</p>
        <ul className="mk-grid">
          {PET_ITEMS.map((it) => {
            const full = !((it.food && st.food < FULL) || (it.fun && st.fun < FULL));
            const item = `pet:${it.id}`;
            return (
              <li key={it.id} className="mk-card">
                <div className="mk-card-top">
                  <b>{it.name}</b>
                  <Price n={it.price} />
                </div>
                <p className="muted small">
                  {it.desc}{' '}
                  {[it.food && `+${it.food} food`, it.fun && `+${it.fun} fun`].filter(Boolean).join(', ')}
                </p>
                <button
                  className="btn small mk-buy"
                  disabled={!market.coinsOn || full || it.price > balance || !!busy}
                  onClick={() => buy(item, {}, () => onToast(`${pet.name} loved the ${it.name.toLowerCase()}.`))}
                >
                  {full ? `${pet.name} is full` : it.price > balance ? 'Not enough coins' : busy === item ? 'Buying…' : 'Buy'}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

// ---------- perks ----------
const statusChip = (s) => <span className={`mk-status s-${s}`}>{STATUSES[s] || s}</span>;

function PerksShelf({ actor, balance, buy, busy, onToast }) {
  const market = useMarket();
  const isManager = !!actor.admin;
  const [editing, setEditing] = useState(null); // a perk, or {} for a new one
  const [ideasOpen, setIdeasOpen] = useState(false);
  const perks = market.perks.filter((p) => isManager || p.active !== false).sort((a, b) => a.price - b.price);
  const mineAll = market.purchases.filter((p) => p.kind === 'perk' && p.person === actor.name).sort((a, b) => b.at - a.at);
  const requests = market.purchases
    .filter((p) => p.kind === 'perk' && (p.status === 'pending' || p.status === 'approved'))
    .sort((a, b) => (a.status === b.status ? a.at - b.at : a.status === 'pending' ? -1 : 1));
  const have = new Set(market.perks.map((p) => p.name.toLowerCase()));
  const ideas = PERK_IDEAS.filter((i) => !have.has(i.name.toLowerCase()));
  const decide = async (p, status) => {
    if (status === 'declined' && !(await confirmDialog({ title: `Decline “${p.name}”?`, body: `${first(p.person)} gets ${p.price} coins back.`, okLabel: 'Decline', danger: true })))
      return;
    const r = await market.run('marketManage', { action: 'decide', id: p.id, status });
    if (!r?.ok) onToast(said(r) || 'That didn’t go through.');
  };
  // Left in stock, and this person's count against their limit.
  const left = (p) => {
    const sold = market.purchases.filter((x) => x.item === `perk:${p.id}` && x.status !== 'declined');
    const since = p.per === 'week' ? weekFrom(Date.now()) : 0;
    return {
      stock: p.stock == null ? null : Math.max(0, p.stock - sold.length),
      mine: sold.filter((x) => x.person === actor.name && x.at >= since).length,
    };
  };
  return (
    <>
      {isManager && requests.length > 0 && (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Requests</h2>
          </div>
          <ul className="mk-list">
            {requests.map((p) => (
              <li key={p.id} className="mk-row">
                <Avatar name={p.person} size={30} />
                <span className="grow">
                  <b>{p.name}</b>
                  <span className="muted tiny">
                    {p.person} · <span className="mono">{p.price}</span> coins · {dayClock(p.at)}
                  </span>
                </span>
                {statusChip(p.status)}
                <span className="mk-row-btns">
                  {p.status === 'pending' ? (
                    <button className="btn small primary" onClick={() => decide(p, 'approved')}>
                      Approve
                    </button>
                  ) : (
                    <button className="btn small primary" onClick={() => decide(p, 'redeemed')}>
                      Mark done
                    </button>
                  )}
                  <button className="btn small" onClick={() => decide(p, 'declined')}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mk-sec">
        <div className="sec-head">
          <h2>Perks</h2>
          {isManager && (
            <button className="text-btn" onClick={() => setEditing({})}>
              <Icon name="plus" size={16} /> Add a perk
            </button>
          )}
        </div>
        <p className="muted small">Real things at the lab, added by team management. Most need their OK; if they say no, you get your coins back.</p>
        {perks.length ? (
          <ul className="mk-grid">
            {perks.map((p) => {
              const l = left(p);
              const soldOut = l.stock === 0;
              const atLimit = p.limit != null && l.mine >= p.limit;
              const item = `perk:${p.id}`;
              return (
                <li key={p.id} className={`mk-card${p.active === false ? ' off' : ''}`}>
                  <div className="mk-card-top">
                    <b>{p.name}</b>
                    <Price n={p.price} />
                  </div>
                  {p.desc && <p className="muted small">{p.desc}</p>}
                  <p className="mk-meta tiny">
                    {[
                      p.active === false && 'Not for sale',
                      l.stock != null && `${l.stock} left`,
                      p.limit != null && `${p.limit} per person${p.per === 'week' ? ' a week' : ''}`,
                      p.approval !== false ? 'Needs an OK' : 'No OK needed',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mk-card-btns">
                    <button
                      className="btn small mk-buy"
                      disabled={!market.coinsOn || p.active === false || soldOut || atLimit || p.price > balance || !!busy}
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: `Buy “${p.name}”?`,
                          body: `${p.price} coins.${p.approval !== false ? ' Team management will approve it, or give the coins back.' : ''}`,
                          okLabel: 'Buy',
                        });
                        if (ok) buy(item, {}, (r) => onToast(r.purchase?.status === 'pending' ? 'Bought. Waiting for team management’s OK.' : 'Bought.'));
                      }}
                    >
                      {soldOut ? 'Sold out' : atLimit ? 'Limit reached' : p.price > balance ? 'Not enough coins' : busy === item ? 'Buying…' : 'Buy'}
                    </button>
                    {isManager && (
                      <span className="mk-manage">
                        <button className="link-btn small" onClick={() => setEditing(p)}>
                          Edit
                        </button>
                        <button
                          className="link-btn small danger"
                          onClick={async () => {
                            if (await confirmDialog({ title: `Remove “${p.name}”?`, body: 'Purchases already made stay in the list.', okLabel: 'Remove', danger: true }))
                              market.deletePerk(p.id).catch((e) => onToast(e.message));
                          }}
                        >
                          Remove
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{isManager ? 'No perks yet. Add one, or pick from the ideas below.' : 'No perks yet. Team management adds them.'}</p>
        )}
        {isManager && ideas.length > 0 && (
          <div className="mk-ideas">
            <button className="text-btn" aria-expanded={ideasOpen} onClick={() => setIdeasOpen(!ideasOpen)}>
              <Icon name={ideasOpen ? 'chevronUp' : 'chevronDown'} size={16} /> Ideas ({ideas.length})
            </button>
            {ideasOpen && (
              <ul className="mk-list">
                {ideas.map((i) => (
                  <li key={i.name} className="mk-row">
                    <span className="grow">
                      <b>{i.name}</b>
                      <span className="muted tiny">{i.desc}</span>
                    </span>
                    <Price n={i.price} />
                    <button className="btn small" onClick={() => setEditing({ ...i, idea: true })}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      {mineAll.length > 0 && (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Your perks</h2>
          </div>
          <ul className="mk-list">
            {mineAll.map((p) => (
              <li key={p.id} className="mk-row">
                <span className="grow">
                  <b>{p.name}</b>
                  <span className="muted tiny">
                    <span className="mono">{p.price}</span> coins · {dayClock(p.at)}
                  </span>
                </span>
                {statusChip(p.status)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {editing && <PerkEditor perk={editing} onClose={() => setEditing(null)} onToast={onToast} />}
    </>
  );
}

function PerkEditor({ perk, onClose, onToast }) {
  const market = useMarket();
  const isNew = !perk.id;
  const [f, setF] = useState({
    name: perk.name || '',
    desc: perk.desc || '',
    price: perk.price ?? '',
    stock: perk.stock ?? '',
    limit: perk.limit ?? '',
    per: perk.per || 'season',
    approval: perk.approval !== false,
    active: perk.active !== false,
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async () => {
    const clean = cleanPerk(f);
    if (clean.error) return setError(clean.error);
    try {
      await market.savePerk(isNew ? null : perk.id, clean);
      onToast(isNew ? 'Perk added.' : 'Perk saved.');
      onClose();
    } catch (e) {
      setError(e?.message || 'That didn’t save.');
    }
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog mk-editor" role="dialog" aria-label={isNew ? 'Add a perk' : 'Edit perk'} onClick={(e) => e.stopPropagation()}>
          <div className="panel-head">
            <h2>{isNew ? 'Add a perk' : 'Edit perk'}</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="fields">
            <label className="field-label">Name</label>
            <input className="input" maxLength={60} value={f.name} onChange={set('name')} placeholder="Pick the lab music" />
            <label className="field-label">About</label>
            <input className="input" maxLength={200} value={f.desc} onChange={set('desc')} placeholder="What they get" />
            <label className="field-label">Price</label>
            <input className="input mk-num" type="number" inputMode="numeric" min={1} value={f.price} onChange={set('price')} aria-label="Price in coins" />
            <label className="field-label">How many</label>
            <input className="input mk-num" type="number" inputMode="numeric" min={0} value={f.stock} onChange={set('stock')} placeholder="No limit" />
            <label className="field-label">Each person</label>
            <div className="row gap">
              <input className="input mk-num" type="number" inputMode="numeric" min={1} value={f.limit} onChange={set('limit')} placeholder="No limit" />
              <div className="segmented">
                {[
                  ['season', 'in all'],
                  ['week', 'a week'],
                ].map(([id, label]) => (
                  <button key={id} className={`plain-seg${f.per === id ? ' on' : ''}`} aria-pressed={f.per === id} onClick={() => setF({ ...f, per: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <span />
            <label className="pet-toggle">
              <input type="checkbox" checked={f.approval} onChange={set('approval')} /> Needs team management’s OK
            </label>
            <span />
            <label className="pet-toggle">
              <input type="checkbox" checked={f.active} onChange={set('active')} /> For sale
            </label>
          </div>
          {error && <p className="danger small">{error}</p>}
          <div className="row gap mk-editor-btns">
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" onClick={save}>
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- chat extras ----------
function ExtrasShelf({ actor, balance, buy, busy, onToast }) {
  const market = useMarket();
  const live = market.purchases.filter((p) => p.kind === 'extra' && p.status === 'active' && p.until > market.now);
  const banners = live.filter((p) => p.item === 'extra:banner').sort((a, b) => a.at - b.at);
  return (
    <>
      <section className="mk-sec">
        <div className="sec-head">
          <h2>Chat extras</h2>
        </div>
        <p className="muted small">Just for fun, and just for a day.</p>
        <ul className="mk-grid">
          {CHAT_EXTRAS.map((x) => {
            const item = `extra:${x.id}`;
            const mine = live.find((p) => p.item === item && p.person === actor.name);
            return (
              <li key={x.id} className="mk-card">
                <div className="mk-card-top">
                  <b>{x.name}</b>
                  <Price n={x.price} />
                </div>
                <p className="muted small">{x.desc}</p>
                {mine ? (
                  <p className="mk-on small">
                    <Icon name="check" size={15} /> On until <span className="mono">{clock(mine.until)}</span>
                  </p>
                ) : (
                  <button
                    className="btn small mk-buy"
                    disabled={!market.coinsOn || x.price > balance || !!busy}
                    onClick={async () => {
                      let text = '';
                      if (x.text) {
                        text = await promptDialog({
                          title: 'Your shout-out',
                          body: 'Everyone sees it at the top of Today for a day. Team management can take it down.',
                          maxLength: x.text,
                          placeholder: 'Great job on the intake, CAD crew!',
                          okLabel: `Post for ${x.price}`,
                        });
                        if (!text || !text.trim()) return;
                      } else if (!(await confirmDialog({ title: `${x.name}?`, body: `${x.price} coins, for ${x.hours} hours.`, okLabel: 'Buy' }))) return;
                      buy(item, { text }, () => onToast(x.text ? 'Your shout-out is on Today.' : `${x.name}: on for a day.`));
                    }}
                  >
                    {x.price > balance ? 'Not enough coins' : busy === item ? 'Buying…' : 'Buy'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {banners.length > 0 && (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Shout-outs on Today</h2>
          </div>
          <ul className="mk-list">
            {banners.map((b) => (
              <li key={b.id} className="mk-row">
                <Avatar name={b.person} size={30} />
                <span className="grow">
                  <b>{b.text}</b>
                  <span className="muted tiny">
                    {b.person} · until {clock(b.until)}
                  </span>
                </span>
                {actor.admin && <RemoveBanner banner={b} onToast={onToast} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function RemoveBanner({ banner, onToast, icon = false }) {
  const market = useMarket();
  const remove = async () => {
    if (!(await confirmDialog({ title: 'Take down this shout-out?', body: `“${banner.text}” by ${banner.person}. Their coins aren’t refunded.`, okLabel: 'Take down', danger: true })))
      return;
    const r = await market.run('marketManage', { action: 'removeBanner', id: banner.id });
    if (!r?.ok) onToast?.(said(r) || 'That didn’t go through.');
  };
  return icon ? (
    <button className="icon-btn small shout-x" onClick={remove} aria-label="Take down this shout-out" title="Take down">
      <CloseIcon />
    </button>
  ) : (
    <button className="btn small" onClick={remove}>
      Take down
    </button>
  );
}

// ---------- game entries ----------
const LENGTHS = [
  ['2 hours', 2],
  ['A day', 24],
  ['3 days', 72],
  ['A week', 168],
];

function GamesShelf({ actor, balance, onToast, onPlay }) {
  const market = useMarket();
  const isManager = !!actor.admin;
  const open = market.tournaments.filter((t) => t.status === 'open');
  const done = market.tournaments
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.paidAt || b.endsAt) - (a.paidAt || a.endsAt))
    .slice(0, 4);
  const [form, setForm] = useState(null);
  return (
    <>
      <section className="mk-sec">
        <div className="sec-head">
          <h2>Tournaments</h2>
          {isManager && !form && (
            <button className="text-btn" onClick={() => setForm({ game: 'tetris', title: '', entry: 10, hours: 24 })}>
              <Icon name="plus" size={16} /> New tournament
            </button>
          )}
        </div>
        <p className="muted small">Pay the entry, then play as often as you like until it ends. The best score takes the whole pot (a tie splits it).</p>
        {form && <TournamentForm form={form} setForm={setForm} onToast={onToast} />}
        {open.length ? (
          <ul className="mk-tours">
            {open.map((t) => (
              <Tournament key={t.id} t={t} actor={actor} balance={balance} onToast={onToast} onPlay={onPlay} />
            ))}
          </ul>
        ) : (
          !form && <p className="muted">No tournaments right now.{isManager ? ' Start one.' : ' Team management starts them.'}</p>
        )}
      </section>
      {done.length > 0 && (
        <section className="mk-sec">
          <div className="sec-head">
            <h2>Finished</h2>
          </div>
          <ul className="mk-list">
            {done.map((t) => (
              <Finished key={t.id} t={t} actor={actor} onToast={onToast} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// A finished tournament: who won, who was voided, and (team management) the
// results, which can still be voided. Coins already paid stay paid.
function Finished({ t, actor, onToast }) {
  const [open, setOpen] = useState(false);
  const { voided } = standings(t);
  return (
    <li className="mk-row mk-done">
      <Icon name="trophy" size={20} />
      <span className="grow">
        <b>{t.title}</b>
        <span className="muted tiny">
          {t.cancelled
            ? 'Cancelled, entries refunded'
            : t.winners.length
              ? `${t.winners.join(' and ')} won ${t.pot} coins`
              : 'Nobody played; entries refunded'}
        </span>
        {voided.length > 0 && (
          <span className="mk-voided tiny">
            Voided: {voided.map((p) => p.name).join(', ')}
            {voided.some((p) => p.voided.afterPayout) && ' (after the payout, so no coins were taken back)'}
          </span>
        )}
      </span>
      {actor.admin && !t.cancelled && Object.keys(t.players || {}).length > 0 && (
        <button className="link-btn small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide results' : 'Results'}
        </button>
      )}
      {open && <Results t={t} actor={actor} onToast={onToast} all />}
    </li>
  );
}

// The ranked results. Team management can void any of them.
function Results({ t, actor, onToast, all = false }) {
  const market = useMarket();
  const { ranked } = standings(t);
  const voidOne = async (name) => {
    const paid = t.status === 'done';
    const ok = await confirmDialog({
      title: `Void ${first(name)}’s result?`,
      body: paid
        ? 'It stops counting. The coins were already paid, so nothing is taken back; the tournament just shows it was voided.'
        : 'It stops counting, and any new games they play won’t count either. The pot goes to the next best.',
      okLabel: 'Void it',
      danger: true,
    });
    if (!ok) return;
    const r = await market.run('marketManage', { action: 'voidResult', id: t.id, name });
    onToast(r?.ok ? `${first(name)}’s result is voided.` : said(r) || 'That didn’t go through.');
  };
  if (!ranked.length) return null;
  return (
    <ol className="mk-scores">
      {(all || actor.admin ? ranked : ranked.slice(0, 5)).map((p, i) => (
        <li key={p.name} className={p.name === actor.name ? 'me' : ''}>
          <span className="mono mk-rank">{i + 1}</span>
          <Avatar name={p.name} size={22} />
          <span className="grow">{p.name}</span>
          <span className="mono">{scoreText(t, p.best)}</span>
          {actor.admin && (
            <button className="link-btn small danger mk-void" onClick={() => voidOne(p.name)} aria-label={`Void ${p.name}’s result`}>
              Void
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

// Runs held because they were faster than a person can play: team management
// clears them (they count) or voids them.
function Review({ t, onToast }) {
  const market = useMarket();
  const runs = pendingReview(t);
  if (!runs.length) return null;
  const decide = async (run, clear) => {
    if (
      !clear &&
      !(await confirmDialog({ title: `Void ${first(run.name)}’s run?`, body: 'It won’t count. Their other games still do.', okLabel: 'Void it', danger: true }))
    )
      return;
    const r = await market.run('marketManage', { action: 'review', id: t.id, run: run.id, clear });
    if (!r?.ok) return onToast(said(r) || 'That didn’t go through.');
    onToast(clear ? (r.counted ? 'Cleared. It counts now.' : 'Cleared. They already had a better score.') : 'Voided.');
  };
  return (
    <div className="mk-review">
      <div className="mk-review-head tiny">
        <Icon name="flag" size={14} /> Needs a check
      </div>
      <ul>
        {runs.map((run) => (
          <li key={run.id}>
            <Avatar name={run.name} size={22} />
            <span className="grow">
              <span>
                {run.name} <span className="mono">{scoreText(t, run.score)}</span>
              </span>
              <span className="muted tiny">{run.why}</span>
            </span>
            <button className="btn small" onClick={() => decide(run, true)}>
              Clear
            </button>
            <button className="link-btn small danger" onClick={() => decide(run, false)}>
              Void
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tournament({ t, actor, balance, onToast, onPlay }) {
  const market = useMarket();
  const [busy, setBusy] = useState(false);
  const g = TOURNAMENT_GAMES[t.game] || { name: t.game, unit: '' };
  const players = Object.entries(t.players || {}).map(([name, p]) => ({ name, ...p }));
  const low = (t.better || g.better) === 'low';
  const { voided } = standings(t);
  const joined = !!t.players?.[actor.name];
  const voidedMe = !!t.players?.[actor.name]?.voided;
  const canPlay = !!commandByName[g.cmd];
  const ended = t.endsAt <= market.now;
  const join = async () => {
    if (!(await confirmDialog({ title: `Join ${t.title}?`, body: `The entry is ${t.entry} coins. It goes into the pot.`, okLabel: `Join for ${t.entry}` }))) return;
    setBusy(true);
    const r = await market.run('joinTournament', { id: t.id });
    setBusy(false);
    onToast(r?.ok ? 'You’re in. Good luck.' : said(r) || 'That didn’t go through.');
  };
  return (
    <li className="mk-tour">
      <div className="mk-tour-head">
        <Icon name="game" size={22} />
        <span className="grow">
          <b>{t.title}</b>
          <span className="muted tiny">
            {g.name} ·{' '}
            {ended ? (reviewHolds(t, market.now) ? 'ended, waiting on a check' : 'ended, paying out') : `ends in ${timeLeft(t.endsAt - market.now)}`}
          </span>
        </span>
        <span className="mk-pot">
          <span className="muted tiny">Pot</span>
          <Coins n={t.pot || 0} size={16} />
        </span>
      </div>
      <p className="mk-meta tiny">
        Entry <span className="mono">{t.entry}</span> · <span className="mono">{players.length}</span> {players.length === 1 ? 'player' : 'players'} ·{' '}
        {low ? `lowest ${g.unit} wins` : `most ${g.unit} wins`}
      </p>
      <Results t={t} actor={actor} onToast={onToast} />
      {voided.length > 0 && <p className="mk-voided tiny">Voided: {voided.map((p) => p.name).join(', ')}</p>}
      {actor.admin && <Review t={t} onToast={onToast} />}
      <div className="mk-card-btns">
        {voidedMe ? (
          <span className="muted small">Your result was voided.</span>
        ) : joined ? (
          canPlay ? (
            <button className="btn small primary" onClick={() => onPlay(t)}>
              <Icon name="play" size={15} /> Play
            </button>
          ) : (
            <span className="mk-on small">
              <Icon name="check" size={15} /> You’re in. Playing opens with the game.
            </span>
          )
        ) : (
          <button className="btn small primary" disabled={!market.coinsOn || busy || ended || t.entry > balance} onClick={join}>
            {t.entry > balance ? 'Not enough coins' : `Join for ${t.entry}`}
          </button>
        )}
        {actor.admin && !ended && (
          <button
            className="link-btn small danger"
            onClick={async () => {
              if (!(await confirmDialog({ title: `Cancel ${t.title}?`, body: 'Everyone who joined gets their entry back.', okLabel: 'Cancel it', cancelLabel: 'Keep it', danger: true })))
                return;
              const r = await market.run('marketManage', { action: 'cancelTournament', id: t.id });
              if (!r?.ok) onToast(said(r) || 'That didn’t go through.');
            }}
          >
            Cancel tournament
          </button>
        )}
      </div>
    </li>
  );
}

function TournamentForm({ form, setForm, onToast }) {
  const market = useMarket();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const g = TOURNAMENT_GAMES[form.game];
  const start = async () => {
    setBusy(true);
    setError('');
    const r = await market.run('marketManage', {
      action: 'createTournament',
      game: form.game,
      title: form.title.trim() || `${g.name} tournament`,
      entry: Number(form.entry),
      endsAt: Date.now() + form.hours * 3600000,
    });
    setBusy(false);
    if (!r?.ok) return setError(said(r) || 'That didn’t go through.');
    onToast('Tournament started.');
    setForm(null);
  };
  const games = useMemo(() => Object.entries(TOURNAMENT_GAMES), []);
  return (
    <div className="mk-tour-form">
      <div className="fields">
        <label className="field-label">Game</label>
        <div className="segmented">
          {games.map(([id, x]) => (
            <button key={id} className={`plain-seg${form.game === id ? ' on' : ''}`} aria-pressed={form.game === id} onClick={() => setForm({ ...form, game: id })}>
              {x.name}
            </button>
          ))}
        </div>
        <label className="field-label">Name</label>
        <input className="input" maxLength={60} value={form.title} placeholder={`${g.name} tournament`} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <label className="field-label">Entry</label>
        <input
          className="input mk-num"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          value={form.entry}
          onChange={(e) => setForm({ ...form, entry: e.target.value })}
          aria-label="Entry in coins"
        />
        <label className="field-label">Runs for</label>
        <div className="segmented">
          {LENGTHS.map(([label, h]) => (
            <button key={h} className={`plain-seg${form.hours === h ? ' on' : ''}`} aria-pressed={form.hours === h} onClick={() => setForm({ ...form, hours: h })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="danger small">{error}</p>}
      <div className="row gap">
        <span className="spacer" />
        <button className="btn" onClick={() => setForm(null)}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy} onClick={start}>
          Start
        </button>
      </div>
    </div>
  );
}

// Today's shout-outs (chat extras), across the top of Today.
export function ShoutOuts({ actor, onToast }) {
  const market = useMarket();
  const banners = market?.extras.banners || [];
  if (!banners.length) return null;
  return (
    <div className="shout-outs">
      {banners.map((b) => (
        <div key={b.id} className="shout-out">
          <Avatar name={b.person} size={28} />
          <span className="grow">
            <b>{b.text}</b>
            <span className="shout-by">{b.person}</span>
          </span>
          {actor.admin && <RemoveBanner banner={b} onToast={onToast} icon />}
        </div>
      ))}
    </div>
  );
}
