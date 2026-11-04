import { useEffect, useRef, useState } from 'react';
import { ICON, LABEL, isLive } from '../../../functions/shared/arcade.js';
import { renameMessage } from '../../people.js';
import { CloseIcon, DisplayName, Overlay, usePeople } from '../common.jsx';
import { Icon } from '../shell/icons.jsx';
import { ArcadeBody } from './Arcade.jsx';
import { ModeChip } from './Battleship.jsx';

// The game view: a live two-player game, big, over the chat (gameView.js has
// the opener). The players play here; anyone else watches, live and read-only,
// seeing only what's on the card (in Battleship: shots, hits and sunk ships,
// never a fleet before the end). The chat keeps going underneath and stays
// where it was (ChatView doesn't scroll it while this is open).
const Named = ({ name }) => <DisplayName name={name} className="cmd-name" />;

export default function GameView({ conv, m: first, api, actor, onClose }) {
  const [m, setM] = useState(first);
  // The game's own live copy, so it keeps up even when its card has scrolled
  // out of the chat's newest page.
  useEffect(() => api.subscribeMessage(conv, first.id, (x) => x?.cmd && setM(x)), [api, conv, first.id]);
  const rename = usePeople()?.rename;
  const shown = rename ? renameMessage(m, rename) : m;
  const c = shown.cmd;
  const g = c.game || {};
  const me = actor.name;
  const player = me === g.a || me === g.b;
  const ref = useRef(null);
  // Escape closes it; focus goes in, and back where it was after.
  useEffect(() => {
    const back = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('.ask-backdrop') && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      back?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  const title = LABEL[c.name] || 'Game';
  return (
    <Overlay>
      <div className="panel-backdrop center gv-backdrop">
        <div
          ref={ref}
          tabIndex={-1}
          className={`dialog game-sheet gv-${c.name}${player ? ' as-player' : ' as-watcher'}`}
          data-msg={m.id}
          role="dialog"
          aria-modal="true"
          aria-label={`${title}${player ? '' : ' (watching)'}`}
        >
          <div className="panel-head gv-head">
            <span className="gv-title">
              <span aria-hidden="true">{ICON[c.name]}</span> <b>{title}</b>
              {!player && isLive(c.status) && (
                <span className="gv-watching">
                  <Icon name="eye" size={14} /> Watching
                </span>
              )}
              {c.name === 'battleship' && <ModeChip g={g} />}
            </span>
            <span className="spacer" />
            <button type="button" className="icon-btn game-sheet-close" onClick={onClose} aria-label="Close the game">
              <CloseIcon />
            </button>
          </div>
          <div className="gv-body">
            <ArcadeBody m={shown} me={me} Name={Named} conv={conv} view onMove={(move) => api.play({ action: 'move', conv, msgId: m.id, move })} />
          </div>
        </div>
      </div>
    </Overlay>
  );
}
