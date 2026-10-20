import { useEffect, useState } from 'react';

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
        const { version } = await res.json();
        if (!stopped && version && version !== __BUILD_ID__) setNewVersion(version);
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
            <h1 id="update-title">New version available</h1>
            <p className="muted">The task board was updated. Reload to get the latest version. Everything you've saved is kept.</p>
            <button className="btn primary" onClick={() => loadNewVersion(newVersion)}>
              Update now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
