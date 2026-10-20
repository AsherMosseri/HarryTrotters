import { useEffect } from 'react';

// Easter egg: tap the "FTC 32313 Tasks" title.
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
    <div className="cat-party" onClick={onClose} role="dialog" aria-label="Dancing cat">
      <div className="cat-lights" />
      {NOTES.map((n, i) => (
        <span key={i} className="cat-note" style={{ '--i': i }}>
          {n}
        </span>
      ))}
      <svg className="cat" viewBox="0 0 200 250" width="260" height="325" aria-hidden="true">
        <g className="cat-dancer">
          <path
            className="cat-tail"
            d="M132 190 C 175 190, 185 150, 170 120"
            fill="none"
            stroke="#f08c2e"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <g className="cat-leg-l">
            <ellipse cx="80" cy="222" rx="18" ry="11" fill="#f6a54c" />
          </g>
          <g className="cat-leg-r">
            <ellipse cx="120" cy="222" rx="18" ry="11" fill="#f6a54c" />
          </g>
          <ellipse cx="100" cy="175" rx="44" ry="48" fill="#f6a54c" />
          <ellipse cx="100" cy="185" rx="26" ry="32" fill="#fde6c8" />
          <path d="M70 150 q10 6 0 12 M130 150 q-10 6 0 12" stroke="#d9772a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <g className="cat-arm-l">
            <rect x="44" y="140" width="16" height="44" rx="8" fill="#f6a54c" />
          </g>
          <g className="cat-arm-r">
            <rect x="140" y="140" width="16" height="44" rx="8" fill="#f6a54c" />
          </g>
          <g className="cat-head">
            <path d="M58 70 L64 18 L96 48 Z" fill="#f6a54c" />
            <path d="M142 70 L136 18 L104 48 Z" fill="#f6a54c" />
            <path d="M66 58 L69 30 L88 48 Z" fill="#f9a8b8" />
            <path d="M134 58 L131 30 L112 48 Z" fill="#f9a8b8" />
            <circle cx="100" cy="85" r="48" fill="#f6a54c" />
            <path
              d="M88 42 q4 10 0 18 M100 40 v18 M112 42 q-4 10 0 18"
              stroke="#d9772a"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <path d="M74 84 q8 -10 16 0 M110 84 q8 -10 16 0" stroke="#3b2a1a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <ellipse cx="72" cy="100" rx="9" ry="6" fill="#f9a8b8" opacity=".7" />
            <ellipse cx="128" cy="100" rx="9" ry="6" fill="#f9a8b8" opacity=".7" />
            <path d="M95 96 h10 l-5 6 z" fill="#e8798f" />
            <path d="M100 102 q-6 8 -12 2 M100 102 q6 8 12 2" stroke="#3b2a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M60 96 h-22 M60 103 l-20 5 M140 96 h22 M140 103 l20 5" stroke="#3b2a1a" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </svg>
      <p className="cat-caption">meow meow meow 🎶</p>
      <p className="cat-hint">tap anywhere to stop the party</p>
    </div>
  );
}
