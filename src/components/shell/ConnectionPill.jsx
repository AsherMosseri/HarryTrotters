import { useConnection } from '../../connection.js';
import { Icon } from './icons.jsx';

// Shows only when the app can't reach the server ("Offline"), and for a few
// seconds after it can again ("Back online"). Reading still works offline and
// writes wait in the offline copy, so this just says so, calmly.
// compact: the folded sidebar's icon alone.
export default function ConnectionPill({ compact = false, className = '' }) {
  const status = useConnection();
  if (status === 'online') return null;
  const off = status === 'offline';
  const text = off ? 'Offline — changes will sync' : 'Back online';
  return (
    <div
      className={`conn-pill ${off ? 'off' : 'back'}${compact ? ' compact' : ''} ${className}`}
      role="status"
      aria-live="polite"
      title={compact ? text : undefined}
    >
      <Icon name={off ? 'cloudOff' : 'check'} size={compact ? 18 : 16} />
      {compact ? <span className="sr-only">{text}</span> : <span>{text}</span>}
    </div>
  );
}
