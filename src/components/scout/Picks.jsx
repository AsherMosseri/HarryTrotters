import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { Overlay } from '../common.jsx';
import { confirmDialog } from '../Dialogs.jsx';
import { animOn } from '../../motion.js';
import { useEscape } from '../../util.js';
import { TEAM_NUMBER } from '../../../functions/shared/matches.js';
import { SCORE_FORMULA, rankText, suggestOrder, tagKind, tagLabel } from '../../../functions/shared/scout.js';
import { ScoreBadge } from './parts.jsx';

// The pick list for alliance selection: an ordered list of teams, dragged or
// nudged into place, with "don't pick" and "picked by others" marks. Team
// management edits it; everyone reads it. "At the table" is the same list in
// big type for the moment captains pick.

const move = (list, from, to) => {
  const out = [...list];
  out.splice(to, 0, out.splice(from, 1)[0]);
  return out;
};
const toggled = (list, n) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]);

// The nearest ancestor that scrolls (the page scrolls inside the shell).
function scroller(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}

export function PickList({ rows, picks, isManager, entries, api, onOpenTeam }) {
  const byNum = useMemo(() => new Map(rows.map((r) => [r.number, r])), [rows]);
  // What you just dropped shows at once, until the saved list catches up.
  const [mine, setMine] = useState(null);
  useEffect(() => setMine(null), [picks.order]);
  useEffect(() => {
    if (!mine) return;
    const t = setTimeout(() => setMine(null), 4000);
    return () => clearTimeout(t);
  }, [mine]);
  const order = useMemo(() => (mine || picks.order || []).filter((n) => byNum.has(n)), [mine, picks.order, byNum]);
  const dont = picks.dont || [];
  const taken = picks.taken || [];
  const [table, setTable] = useState(false);
  const [adding, setAdding] = useState('');
  const list = useRef(null);
  const items = useRef(new Map());
  const [dragging, setDragging] = useState(0);
  const orderRef = useRef(order);
  orderRef.current = order;
  const left = rows.filter((r) => !order.includes(r.number) && r.number !== TEAM_NUMBER);

  const commit = (next) => {
    setMine(next);
    api.saveScoutPicks({ order: next });
  };
  const nudge = (i, by) => i + by >= 0 && i + by < order.length && commit(move(order, i, i + by));
  const suggest = async () => {
    if (order.length && !(await confirmDialog({ title: 'Replace the order?', body: 'It is sorted again by our scores. Don’t pick and picked by others marks stay.', okLabel: 'Suggest order' }))) return;
    commit(suggestOrder(rows.map((r) => r.number), entries));
  };

  // Dragging by the grip. Every row stays where it is in the page while you
  // drag; the others slide aside with a transform, and the order is saved
  // when you let go (so nothing is moved in the DOM under your finger).
  const startDrag = (e, from) => {
    if (e.button != null && e.button > 0) return;
    const ul = list.current;
    const els = orderRef.current.map((n) => items.current.get(n));
    if (!ul || els.some((el) => !el)) return;
    e.preventDefault();
    const scr = scroller(ul);
    const rowsAt = els.map((el) => ({ el, top: el.offsetTop, h: el.offsetHeight }));
    const me = rowsAt[from];
    const gap = rowsAt[from + 1] ? rowsAt[from + 1].top - me.top - me.h : 0;
    const startY = e.clientY;
    const startScroll = scr.scrollTop;
    const total = ul.offsetHeight;
    let y = startY;
    let to = from;
    let raf = 0;
    const animate = animOn('move');
    ul.classList.toggle('moving', animate);
    setDragging(orderRef.current[from]);
    const apply = () => {
      const dy = Math.max(-me.top, Math.min(total - me.top - me.h, y - startY + (scr.scrollTop - startScroll)));
      const center = me.top + me.h / 2 + dy;
      to = rowsAt.filter((r, i) => i !== from && r.top + r.h / 2 < center).length;
      rowsAt.forEach((r, i) => {
        if (i === from) r.el.style.transform = `translateY(${dy}px)`;
        else if (from < to && i > from && i <= to) r.el.style.transform = `translateY(${-(me.h + gap)}px)`;
        else if (from > to && i >= to && i < from) r.el.style.transform = `translateY(${me.h + gap}px)`;
        else r.el.style.transform = '';
      });
    };
    // Near the top or bottom edge, the page scrolls on its own.
    const edge = () => {
      const box = scr === document.scrollingElement ? { top: 0, bottom: innerHeight } : scr.getBoundingClientRect();
      if (y < box.top + 70) scr.scrollTop -= 12;
      else if (y > box.bottom - 70) scr.scrollTop += 12;
      apply();
      raf = requestAnimationFrame(edge);
    };
    const onMove = (ev) => {
      y = ev.clientY;
      apply();
    };
    const finish = (save) => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      rowsAt.forEach((r) => (r.el.style.transform = ''));
      ul.classList.remove('moving');
      setDragging(0);
      if (save && to !== from) commit(move(orderRef.current, from, to));
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    raf = requestAnimationFrame(edge);
  };
  useEffect(() => () => items.current.clear(), []);

  return (
    <section className="sc-sec">
      <div className="sc-bar sc-pick-bar">
        <button className="btn primary" onClick={() => setTable(true)} disabled={!order.length}>
          <Icon name="eye" size={16} /> At the table
        </button>
        {isManager && (
          <button className="btn" onClick={suggest} disabled={!rows.length}>
            <Icon name="sparkle" size={16} /> Suggest order
          </button>
        )}
        {isManager && left.length > 0 && (
          <label className="sc-add-pick">
            <span className="visually-hidden">Add a team to the list</span>
            <select
              className="input"
              value={adding}
              onChange={(e) => {
                const n = Number(e.target.value);
                setAdding('');
                if (n) commit([...order, n]);
              }}
            >
              <option value="">Add a team…</option>
              {left.map((r) => (
                <option key={r.number} value={r.number}>
                  {r.number} {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="muted small sc-formula">{SCORE_FORMULA}</p>
      {!isManager && <p className="muted small">Team management keeps this list. You can read it and open it at the table.</p>}
      {order.length === 0 ? (
        <p className="sc-empty">
          {isManager ? 'The list is empty. Tap Suggest order to start from our scores, or add teams one at a time.' : 'Team management hasn’t made the list yet.'}
        </p>
      ) : (
        <ul className="sc-picks" ref={list}>
          {order.map((n, i) => {
            const t = byNum.get(n);
            const isDont = dont.includes(n);
            const isTaken = taken.includes(n);
            return (
              <li
                key={n}
                ref={(el) => (el ? items.current.set(n, el) : items.current.delete(n))}
                className={`sc-pick${isDont ? ' dont' : ''}${isTaken ? ' taken' : ''}${dragging === n ? ' drag' : ''}`}
              >
                <div className="sc-pick-main">
                  {isManager && (
                    <button className="sc-grip" onPointerDown={(e) => startDrag(e, i)} aria-label={`Drag team ${n} to move it`} title="Drag to move">
                      <Icon name="grip" size={20} />
                    </button>
                  )}
                  <span className="sc-pos mono">{i + 1}</span>
                  <button className="sc-pick-team" onClick={() => onOpenTeam(n)}>
                    <b className="mono sc-pick-num">{n}</b>
                    <span className="sc-pick-name">{t?.name || ''}</span>
                  </button>
                  <span className="sc-pick-side">
                    {(isDont || isTaken) && <span className={`sc-mark${isDont ? ' bad' : ''}`}>{isDont ? 'Don’t pick' : 'Picked'}</span>}
                    <ScoreBadge value={t?.score} />
                  </span>
                </div>
                {isManager && (
                  <div className="sc-pick-acts">
                    <button className="sc-act" onClick={() => nudge(i, -1)} disabled={i === 0} aria-label={`Move ${n} up`}>
                      <Icon name="chevronUp" size={18} />
                    </button>
                    <button className="sc-act" onClick={() => nudge(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${n} down`}>
                      <Icon name="chevronDown" size={18} />
                    </button>
                    <button className={`sc-act wide${isDont ? ' on' : ''}`} aria-pressed={isDont} onClick={() => api.saveScoutPicks({ dont: toggled(dont, n) })}>
                      <Icon name="ban" size={16} /> Don’t pick
                    </button>
                    <button className={`sc-act wide${isTaken ? ' on' : ''}`} aria-label="Picked by others" aria-pressed={isTaken} onClick={() => api.saveScoutPicks({ taken: toggled(taken, n) })}>
                      <Icon name="team" size={16} /> Picked<span className="sc-long"> by others</span>
                    </button>
                    <button className="sc-act" onClick={() => commit(order.filter((x) => x !== n))} aria-label={`Take ${n} off the list`}>
                      <Icon name="cross" size={16} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {table && <AtTheTable order={order} byNum={byNum} dont={dont} taken={taken} isManager={isManager} api={api} onClose={() => setTable(false)} />}
    </section>
  );
}

// Big type for alliance selection: who to pick next, and who's still there.
function AtTheTable({ order, byNum, dont, taken, isManager, api, onClose }) {
  useEscape(onClose);
  const [all, setAll] = useState(false);
  const open = order.filter((n) => !taken.includes(n) && !dont.includes(n));
  const shown = all ? order : open;
  const next = open[0];
  const topTags = (t) =>
    Object.entries(t?.sum?.tags || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  return (
    <Overlay>
      <div className="sc-table" role="dialog" aria-modal="true" aria-label="Pick list at the table">
        <div className="sc-table-top">
          <h2>Pick list</h2>
          <span className="muted small">
            <span className="mono">{open.length}</span> left
          </span>
          <span className="spacer" />
          <label className="sc-table-all">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show picked and don’t pick
          </label>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
        {next ? (
          <div className="sc-next">
            <span className="sc-next-l">Pick next</span>
            <span className="sc-next-num mono">{next}</span>
            <span className="sc-next-name">{byNum.get(next)?.name}</span>
            <span className="sc-next-meta">
              {byNum.get(next)?.rank?.rank ? <span className="mono">{rankText(byNum.get(next).rank)}</span> : null}
            </span>
          </div>
        ) : (
          <p className="sc-empty">Nobody left on the list.</p>
        )}
        <ol className="sc-table-list">
          {shown.map((n) => {
            const t = byNum.get(n);
            const isTaken = taken.includes(n);
            const isDont = dont.includes(n);
            const pos = order.indexOf(n) + 1;
            return (
              <li key={n} className={`sc-trow${isTaken ? ' taken' : ''}${isDont ? ' dont' : ''}${n === next ? ' next' : ''}`}>
                <span className="sc-trow-pos mono">{pos}</span>
                <span className="sc-trow-num mono">{n}</span>
                <span className="sc-trow-main">
                  <b>{t?.name || ''}</b>
                  <span className="sc-trow-sub">
                    {t?.rank?.rank ? <span className="mono">#{t.rank.rank}</span> : null}
                    {topTags(t).map(([id]) => (
                      <span key={id} className={`sc-tag ${tagKind(id)}`}>
                        {tagLabel(id)}
                      </span>
                    ))}
                  </span>
                </span>
                {isDont ? (
                  <span className="sc-mark bad">Don’t pick</span>
                ) : isManager ? (
                  <button className={`sc-take${isTaken ? ' on' : ''}`} aria-pressed={isTaken} onClick={() => api.saveScoutPicks({ taken: toggled(taken, n) })}>
                    {isTaken ? 'Picked' : 'Mark picked'}
                  </button>
                ) : isTaken ? (
                  <span className="sc-mark">Picked</span>
                ) : null}
                <ScoreBadge value={t?.score} />
              </li>
            );
          })}
        </ol>
      </div>
    </Overlay>
  );
}
