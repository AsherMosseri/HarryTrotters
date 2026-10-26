import { useState } from 'react';
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
            Put your tabs in the order you like. It’s just for you, on all your devices. On a phone, your first four are the tab bar.
            {canHide && ' The switches turn a tab off for the whole team.'}
          </p>
          <ol className="tabs-list">
            {list.map((id, i) => (
              <li key={id} className={off.has(id) ? 'off' : ''}>
                <span className="tabs-icon" aria-hidden="true">
                  {TAB_ICONS[id]}
                </span>
                <span className="grow">
                  {label[id]}
                  {!off.has(id) && shown.indexOf(id) < 4 && <span className="tabs-phone">phone tab bar</span>}
                </span>
                <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${label[id]} up`}>
                  ▲
                </button>
                <button
                  className="icon-btn"
                  onClick={() => move(i, 1)}
                  disabled={i === list.length - 1}
                  aria-label={`Move ${label[id]} down`}
                >
                  ▼
                </button>
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
