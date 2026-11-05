import { Suspense, lazy, useState } from 'react';
import { RALLY_COUNT } from '../../../functions/shared/petRally.js';
import { rallyCleared } from '../../../functions/shared/petgames.js';
import { readLocal } from '../../petgames/bests.js';
import { Overlay } from '../common.jsx';
import { Icon } from '../shell/icons.jsx';
import './petgames.css';

// The way into the pet games (3.2), on the Pets shelf under the park: Pet Hop
// and Pet Rally, with your bests on this device. The games themselves
// (PetGames.jsx) load only when one opens.
const PetGames = lazy(() => import('./PetGames.jsx'));

// open: { game, born } or null; setOpen to change it (the shelf's "Play"
// buttons on each pet share it).
export function PetGamesHost({ actor, open, onClose }) {
  if (!open) return null;
  return (
    <Overlay>
      <Suspense fallback={<div className="panel-backdrop center" />}>
        <PetGames actor={actor} start={open} onClose={onClose} />
      </Suspense>
    </Overlay>
  );
}

export function PetGamesSection({ actor, petName, onOpen }) {
  // Read again each time the shelf shows (a game just ended, say).
  const b = readLocal(actor.name);
  const cleared = rallyCleared(b.rally);
  return (
    <section className="mk-sec" id="pet-games">
      <div className="sec-head">
        <h2>Pet games</h2>
        <button className="text-btn" onClick={() => onOpen({})}>
          Team boards
        </button>
      </div>
      <div className="pg-tiles">
        <button className="pg-tile hop" onClick={() => onOpen({ game: 'hop' })}>
          <span className="pg-tile-art" aria-hidden="true">
            <HopArt />
          </span>
          <span className="pg-tile-text">
            <b>Pet Hop</b>
            <span className="muted small">Tap to hop {petName} through the field towers.</span>
            <span className="pg-tile-best mono">{b.hop ? `Best ${b.hop}` : 'New'}</span>
          </span>
          <Icon name="play" size={18} />
        </button>
        <button className="pg-tile rally" onClick={() => onOpen({ game: 'rally' })}>
          <span className="pg-tile-art" aria-hidden="true">
            <RallyArt />
          </span>
          <span className="pg-tile-text">
            <b>Pet Rally</b>
            <span className="muted small">Drive {petName} over hills and jumps to the flag.</span>
            <span className="pg-tile-best mono">{cleared ? `${cleared}/${RALLY_COUNT} levels` : `${RALLY_COUNT} levels`}</span>
          </span>
          <Icon name="play" size={18} />
        </button>
      </div>
      <p className="muted small">Just for fun: no coins, and your pet still grows with your lab time.</p>
    </section>
  );
}

// Small pictures for the two tiles.
function HopArt() {
  return (
    <svg viewBox="0 0 64 48" width="64" height="48">
      <rect width="64" height="48" rx="8" fill="#bfe6ff" />
      <rect x="34" y="0" width="10" height="14" fill="#b9c2ce" />
      <rect x="33.6" y="12" width="10.8" height="3" fill="#ff8a1f" />
      <rect x="34" y="31" width="10" height="11" fill="#b9c2ce" />
      <rect x="33.6" y="31" width="10.8" height="3" fill="#ff8a1f" />
      <rect y="42" width="64" height="6" fill="#9aa4b1" />
      <circle cx="18" cy="22" r="7" fill="#f6a85c" stroke="#a85a26" strokeWidth="1.2" />
      <circle cx="20.5" cy="20.5" r="1.3" fill="#2a2730" />
      <path d="M10 27 q-4 3 -2 6" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}
function RallyArt() {
  return (
    <svg viewBox="0 0 64 48" width="64" height="48">
      <rect width="64" height="48" rx="8" fill="#bfe6ff" />
      <path d="M0 36 Q16 26 32 34 T64 30 V48 H0 Z" fill="#c7905c" />
      <path d="M0 36 Q16 26 32 34 T64 30" stroke="#57b65a" strokeWidth="2.4" fill="none" />
      <g transform="rotate(-8 30 26)">
        <circle cx="26" cy="22" r="5" fill="#f6a85c" stroke="#a85a26" strokeWidth="1" />
        <path d="M17 26 H42 Q45 27 44 31 H16 Q15 27 17 26 Z" fill="#e0475b" stroke="#9b2335" strokeWidth="1" />
        <circle cx="21" cy="32" r="3.6" fill="#2b2b33" />
        <circle cx="38" cy="32" r="3.6" fill="#2b2b33" />
      </g>
      <path d="M54 12 V30" stroke="#4a5363" strokeWidth="1.4" />
      <path d="M54 12 h7 v5 h-7 z" fill="#fff" stroke="#222" strokeWidth="0.8" />
      <path d="M54 12 h3.5 v2.5 h-3.5 z M57.5 14.5 h3.5 v2.5 h-3.5 z" fill="#222" />
    </svg>
  );
}
