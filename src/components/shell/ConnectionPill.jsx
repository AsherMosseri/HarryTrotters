import { isSimulatedOffline, simulateOffline, syncText, useNeedsConnection, useSync } from '../../connection.js';
import { Icon } from './icons.jsx';

// Shows only when the app can't reach the server ("Offline · 3 changes
// waiting to send"), and for a few seconds after it can again ("Back online ·
// sent"). Reading still works offline and changes wait on the device, so this
// just says so, calmly. compact: the folded sidebar's icon alone (with the
// number waiting).
export default function ConnectionPill({ compact = false, className = '' }) {
  const sync = useSync();
  if (sync.status === 'online') return null;
  const off = sync.status === 'offline';
  const text = syncText(sync);
  return (
    <div
      className={`conn-pill ${off ? 'off' : 'back'}${compact ? ' compact' : ''} ${className}`}
      role="status"
      aria-live="polite"
      title={compact ? text : undefined}
    >
      <Icon name={off ? 'cloudOff' : sync.pending ? 'rotateCw' : 'check'} size={compact ? 18 : 16} />
      {compact ? (
        <>
          {sync.pending > 0 && <span className="conn-count">{sync.pending > 99 ? '99+' : sync.pending}</span>}
          <span className="sr-only">{text}</span>
        </>
      ) : (
        <span className="conn-text">{text}</span>
      )}
    </div>
  );
}

// Demo mode: pretend there's no connection (the demo banner), to show and
// test how the app works offline. Also ?demo&offline.
export function DemoOfflineSwitch() {
  const off = useNeedsConnection();
  return (
    <button className="demo-offline" aria-pressed={off} onClick={() => simulateOffline(!isSimulatedOffline())}>
      {off ? 'Go back online' : 'Pretend to be offline'}
    </button>
  );
}
