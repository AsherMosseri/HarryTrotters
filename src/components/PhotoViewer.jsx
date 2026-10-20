import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fullTime } from '../util.js';

// Full-screen photo viewer for task and chat photos. onDelete is optional.
export default function PhotoViewer({ photos, index, onIndex, onClose, onDelete }) {
  const photo = photos[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
      else if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
      else return;
      e.stopPropagation(); // don't also close the panel underneath
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, photos.length, onIndex, onClose]);
  if (!photo) return null;
  // Portal to <body> so the panel's slide-in transform can't shrink the overlay.
  return createPortal(
    <div className="photo-viewer" onClick={onClose}>
      <img src={photo.url} alt="" onClick={(e) => e.stopPropagation()} />
      <div className="photo-bar" onClick={(e) => e.stopPropagation()}>
        <span className="grow">
          {photo.by?.split(' ')[0]} · {fullTime(photo.at)}
          {photos.length > 1 && ` · ${index + 1} of ${photos.length}`}
        </span>
        {photos.length > 1 && (
          <>
            <button className="btn ghost" onClick={() => onIndex((index - 1 + photos.length) % photos.length)} aria-label="Previous photo">
              ‹
            </button>
            <button className="btn ghost" onClick={() => onIndex((index + 1) % photos.length)} aria-label="Next photo">
              ›
            </button>
          </>
        )}
        <a className="btn ghost" href={photo.url} target="_blank" rel="noreferrer">
          Full size
        </a>
        {onDelete && (
          <button className="btn ghost danger-text" onClick={() => confirm('Delete this photo?') && onDelete(photo)}>
            Delete
          </button>
        )}
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
