import { useLayoutEffect, useRef, useState } from 'react';
import { useEscape } from '../util.js';
import { CloseIcon, Overlay } from './common.jsx';
import { TAB_ICONS } from './PhoneChrome.jsx';

// Edit tabs: everyone puts the tabs in their own order (saved to their
// profile, so it follows them to every device). The owner (Asher) can also
// turn tabs off for the whole team.
export default function TabsEditor({ all, order, hidden, canHide, onSave, onClose }) {
  useEscape(onClose);
  const [list, setList] = useState(order);
  const [off, setOff] = useState(new Set(hidden));
  const label = Object.fromEntries(all);
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  // Drag a row (finger or mouse) to move it. The row follows the pointer and
  // trades places with a neighbor once it passes that neighbor's middle.
  const [dragging, setDragging] = useState(null);
  const rows = useRef({});
  const listRef = useRef(null);
  const grab = useRef({ offset: 0, top: 0 });
  const follow = (id) => {
    const el = rows.current[id];
    if (el) el.style.transform = `translateY(${grab.current.top - el.offsetTop}px)`;
  };
  const tops = useRef({});
  useLayoutEffect(() => {
    if (dragging) follow(dragging);
    // The rows that traded places slide over instead of jumping.
    for (const [id, el] of Object.entries(rows.current)) {
      if (!el) continue;
      const was = tops.current[id];
      tops.current[id] = el.offsetTop;
      if (id !== dragging && was !== undefined && was !== el.offsetTop && el.animate) {
        el.animate([{ transform: `translateY(${was - el.offsetTop}px)` }, { transform: 'none' }], { duration: 150, easing: 'ease-out' });
      }
    }
  }, [list, dragging]);
  const startDrag = (e, id) => {
    if (e.button > 0 || e.target.closest('.switch, button')) return;
    const el = rows.current[id];
    grab.current = { offset: e.clientY - el.getBoundingClientRect().top, top: el.offsetTop };
    el.setPointerCapture(e.pointerId);
    setDragging(id);
  };
  const moveDrag = (e) => {
    if (!dragging) return;
    const el = rows.current[dragging];
    const top = e.clientY - listRef.current.getBoundingClientRect().top - grab.current.offset;
    grab.current.top = top;
    const i = list.indexOf(dragging);
    const prev = rows.current[list[i - 1]];
    const next = rows.current[list[i + 1]];
    if (prev && top < prev.offsetTop + prev.offsetHeight / 2) move(i, -1);
    else if (next && top + el.offsetHeight > next.offsetTop + next.offsetHeight / 2) move(i, 1);
    else follow(dragging);
  };
  const endDrag = () => {
    if (!dragging) return;
    rows.current[dragging].style.transform = '';
    setDragging(null);
  };
  const shown = list.filter((id) => !off.has(id));
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog tabs-editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit tabs">
          <div className="panel-head">
            <h2>Edit tabs</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small">
            Drag your tabs into the order you like. It’s just for you, on all your devices. On a phone, your first four are the tab bar.
            {canHide && ' The switches turn a tab off for the whole team.'}
          </p>
          <ol className="tabs-list" ref={listRef}>
            {list.map((id, i) => (
              <li
                key={id}
                ref={(el) => (rows.current[id] = el)}
                className={`${off.has(id) ? 'off' : ''}${dragging === id ? ' dragging' : ''}`}
                onPointerDown={(e) => startDrag(e, id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <span
                  className="tabs-grip"
                  role="button"
                  tabIndex={0}
                  aria-label={`Move ${label[id]} (use the up and down arrow keys)`}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    move(i, e.key === 'ArrowUp' ? -1 : 1);
                    requestAnimationFrame(() => rows.current[id]?.querySelector('.tabs-grip')?.focus());
                  }}
                >
                  ⠿
                </span>
                <span className="tabs-icon" aria-hidden="true">
                  {TAB_ICONS[id]}
                </span>
                <span className="grow">
                  {label[id]}
                  {!off.has(id) && (shown.length <= 5 || shown.indexOf(id) < 4) && <span className="tabs-phone">phone tab bar</span>}
                </span>
                {canHide && (
                  <label className="switch" title={off.has(id) ? 'Off for everyone' : 'On for everyone'}>
                    <input
                      type="checkbox"
                      checked={!off.has(id)}
                      disabled={!off.has(id) && shown.length <= 1}
                      onChange={(e) => {
                        const next = new Set(off);
                        if (e.target.checked) next.delete(id);
                        else next.add(id);
                        setOff(next);
                      }}
                      aria-label={`Show ${label[id]} for the team`}
                    />
                    <span />
                  </label>
                )}
              </li>
            ))}
          </ol>
          <div className="row gap">
            <button className="link-btn small" onClick={() => setList(all.map(([id]) => id))}>
              Reset order
            </button>
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                onSave(list, [...off]);
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
