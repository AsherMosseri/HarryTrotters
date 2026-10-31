import { Suspense, lazy, useEffect, useState } from 'react';
import { Overlay } from '../common.jsx';
import { onOpenGame } from './launch.js';

// Shows the Tetris / Minesweeper screen when something calls openGame(). The
// screen itself (and the games) load only the first time it opens.
const FunGame = lazy(() => import('./FunGame.jsx'));

export default function GameHost({ api, actor, roster, isOn = () => true }) {
  const [open, setOpen] = useState(null);
  useEffect(() => onOpenGame((o) => setOpen({ ...o, key: Date.now() })), []);
  if (!open) return null;
  return (
    <Overlay>
      <Suspense fallback={<div className="panel-backdrop center" />}>
        <FunGame key={open.key} start={open} api={api} actor={actor} roster={roster} isOn={isOn} onClose={() => setOpen(null)} />
      </Suspense>
    </Overlay>
  );
}
