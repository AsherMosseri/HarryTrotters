import { useEffect, useState } from 'react';
import { VersionLogDialog } from './VersionLog.jsx';

const CHECK_EVERY = 60 * 1000;

// Loads the newest page, skipping Safari's cached copy of index.html.
export function loadNewVersion(version) {
  const url = new URL(location.href);
  url.searchParams.set('v', version || Date.now().toString(36));
  location.replace(url.toString());
}

// Checks version.json every minute (and whenever the app comes back to the
// foreground). If a newer version is live, blocks the page until it's reloaded.
export default function UpdateGate({ children }) {
  const [newVersion, setNewVersion] = useState(null);
  const [info, setInfo] = useState(null); // { release, changelog } of the new version
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    // Tidy the ?v= cache-buster out of the address bar after an update.
    const url = new URL(location.href);
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v');
      history.replaceState(null, '', url.toString());
    }

    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return; // e.g. local dev server
        const data = await res.json();
        if (!stopped && data.version && data.version !== __BUILD_ID__) {
          setNewVersion(data.version);
          if (Array.isArray(data.changelog)) setInfo({ release: data.release, changelog: data.changelog });
        }
      } catch {
        /* offline: try again later */
      }
    };
    check();
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, []);

  return (
    <>
      {children}
      {newVersion && (
        <div className="update-gate" role="alertdialog" aria-labelledby="update-title">
          <div className="gate-card">
            <div className="logo-mark big">↻</div>
            <h1 id="update-title">{info?.release ? `Version ${info.release} is ready` : 'New version available'}</h1>
            {info?.changelog?.[0] && (
              <div className="update-whats-new">
                <b>{info.changelog[0].title}</b>
                <ul className="version-items">
                  {info.changelog[0].items.slice(0, 4).map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                  {info.changelog[0].items.length > 4 && <li className="muted">and {info.changelog[0].items.length - 4} more…</li>}
                </ul>
              </div>
            )}
            <p className="muted">Reload to get it. Everything you've saved is kept.</p>
            <button className="btn primary big-btn" onClick={() => loadNewVersion(newVersion)}>
              Update now
            </button>
            {info?.changelog && (
              <button className="link-btn" onClick={() => setShowLog(true)}>
                Full version log
              </button>
            )}
          </div>
        </div>
      )}
      {showLog && info?.changelog && (
        <VersionLogDialog log={info.changelog} current={info.release} currentLabel="New" onClose={() => setShowLog(false)} />
      )}
    </>
  );
}
