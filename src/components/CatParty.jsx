import { useEffect } from 'react';
import { Overlay } from './common.jsx';
import robot from '../assets/robot-dance.webp';

// Easter egg: tap the team logo. It started as a dancing cat; now it's our robot.
const NOTES = ['♪', '♫', '♬', '♩', '♪', '♫'];

export default function CatParty({ onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 9000);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <Overlay>
      <div className="cat-party" onClick={onClose} role="dialog" aria-label="Dancing robot">
        <div className="cat-lights" />
        {NOTES.map((n, i) => (
          <span key={i} className="cat-note" style={{ '--i': i }}>
            {n}
          </span>
        ))}
        {/* The team's robot (a cut-out photo): it strafes side to side like on
            mecanum wheels, bops to the beat, and turns in place now and then. */}
        <div className="bot-route" aria-hidden="true">
          <div className="bot-bob">
            <img className="bot" src={robot} alt="" draggable="false" />
          </div>
          <div className="bot-shadow" />
        </div>
        <p className="cat-caption">beep boop beep 🎶</p>
        <p className="cat-hint">tap anywhere to stop the party</p>
      </div>
    </Overlay>
  );
}
