import { useState } from 'react';
import { TEAM_NAME, ROSTER, isManagerName } from '../config.js';
import { Avatar } from './common.jsx';

function Shell({ children }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="logo-mark big">✓</div>
        {children}
      </div>
    </div>
  );
}

export function LoadingScreen({ error }) {
  return (
    <Shell>
      {error ? (
        <>
          <h1>Something went wrong</h1>
          <p className="muted">{error}</p>
          <button className="btn" onClick={() => location.reload()}>
            Reload
          </button>
        </>
      ) : (
        <p className="muted">Loading…</p>
      )}
    </Shell>
  );
}

const OTHER = '__other';

export function JoinScreen({ onJoin, rename }) {
  const names = [...new Set(ROSTER.map(rename))];
  const [picked, setPicked] = useState('');
  const [other, setOther] = useState('');
  const [code, setCode] = useState('');
  const [managerCode, setManagerCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const name = (picked === OTHER ? other : picked).trim();
  const isManager = isManagerName(name);
  const ready = name && code.trim() && (!isManager || managerCode.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr('');
    try {
      await onJoin(name, code, isManager ? managerCode : '');
    } catch (ex) {
      // The security rules reject the write when the code is wrong.
      const wrong = isManager ? "The team code or manager code isn't right." : "That team code isn't right. Check with a teammate.";
      setErr(ex?.code === 'permission-denied' ? wrong : ex?.message || String(ex));
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1>{TEAM_NAME} Task Board</h1>
      <p className="muted">Pick your name and enter the team code. You only have to do this once on each device.</p>
      <form className="join-form" onSubmit={submit}>
        <div className="join-names">
          {names.map((n) => (
            <button type="button" key={n} className={`person${picked === n ? ' on' : ''}`} onClick={() => setPicked(n)}>
              <Avatar name={n} size={22} /> {n}
            </button>
          ))}
          <button type="button" className={`person${picked === OTHER ? ' on' : ''}`} onClick={() => setPicked(OTHER)}>
            Someone else
          </button>
        </div>
        {picked === OTHER && (
          <input
            className="input"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Your full name"
            maxLength={60}
            autoFocus
          />
        )}
        <input
          className="input"
          type="password"
          autoCapitalize="none"
          autoComplete="current-password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Team code"
        />
        {isManager && (
          <input
            className="input"
            type="password"
            autoCapitalize="none"
            autoComplete="off"
            value={managerCode}
            onChange={(e) => setManagerCode(e.target.value)}
            placeholder="Manager code"
          />
        )}
        <button className="btn primary" disabled={busy || !ready}>
          {busy ? 'Checking…' : name ? `Join as ${name.split(' ')[0]}` : 'Pick your name'}
        </button>
      </form>
      {err && <p className="form-error">{err}</p>}
      <a className="small muted demo-link" href="?demo">
        Just looking? Try the demo with sample tasks
      </a>
    </Shell>
  );
}
