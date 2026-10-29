import { useEffect, useState } from 'react';
import { TEAM_NAME, TEAM_NICKNAME, ROSTER, isManagerName } from '../config.js';
import { Avatar } from './common.jsx';

function Shell({ children }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <p className="gate-eyebrow">
          {TEAM_NICKNAME} · {TEAM_NAME}
        </p>
        {children}
      </div>
    </div>
  );
}

// The splash while the app starts (index.html shows the same one before the
// code loads), or what went wrong. step: 1 loading the app, 2 signing in,
// 3 checking the team; the bar fills as each one finishes, and if one takes
// a while it says which, with a way to reload.
const STEPS = ['Opening', 'Loading the app', 'Signing in', 'Checking the team'];
export function LoadingScreen({ error, step = 1 }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div className="gate splash" role={error ? 'alert' : 'status'} aria-label={error ? undefined : 'Loading'}>
      <div className="splash-mark">
        <span className="splash-ht" aria-hidden="true">
          HT
        </span>
        <h1>{TEAM_NICKNAME}</h1>
        <p>{TEAM_NAME}</p>
        {error ? (
          <div className="splash-error">
            <b>Something went wrong</b>
            <span>{error}</span>
            <button className="btn primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        ) : (
          <>
            <div className="splash-bar" aria-hidden="true">
              <span style={{ width: `${[12, 35, 65, 88][step] ?? 88}%` }} />
            </div>
            <p className="splash-step">{STEPS[step]}…</p>
            {slow && (
              <div className="splash-slow">
                <span>This is taking longer than usual. Check your Wi&#8209;Fi.</span>
                <button className="btn" onClick={() => location.reload()}>
                  Reload
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      className="share-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Share"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

// On iPhone and iPad the board only runs as the Home Screen app, so everyone
// can get notifications. Shown in Safari (or another browser) until then.
export function InstallScreen({ device, browser }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}`;
  const steps =
    browser === 'safari'
      ? [
          <>
            Tap the <b>Share</b> button <ShareIcon />{' '}
            {device === 'iPad' ? (
              'at the top right, next to the address bar.'
            ) : (
              <>
                in the bar at the bottom. If you don’t see it, tap <b>•••</b> first.
              </>
            )}
          </>,
          <>
            Scroll down and tap <b>Add to Home Screen</b>. (Don’t see it? Tap <b>View More</b>.)
          </>,
          <>
            If you see <b>Open as Web App</b>, leave it on. Then tap <b>Add</b>.
          </>,
          <>
            Go to your Home Screen and open <b>32313 Tasks</b>. You’ll pick your name and enter the team code there.
          </>,
        ]
      : browser === 'chrome'
        ? [
            <>
              Tap the <b>Share</b> button <ShareIcon /> in the address bar.
            </>,
            <>
              Tap <b>Add to Home Screen</b> (scroll down or tap <b>View More</b> if needed), then <b>Add</b>.
            </>,
            <>
              Go to your Home Screen and open <b>32313 Tasks</b>. You’ll pick your name and enter the team code there.
            </>,
          ]
        : [
            <>
              Copy the link below and open it in <b>Safari</b>.
            </>,
            <>Follow the steps there to add it to your Home Screen.</>,
          ];
  return (
    <Shell>
      <h1>Add the app to your Home Screen</h1>
      <p className="muted">
        On {device === 'iPad' ? 'an iPad' : 'an iPhone'}, the {TEAM_NAME} board runs as an app from your Home Screen. That’s how you get
        notifications for announcements, @mentions, and your tasks.
      </p>
      <ol className="install-steps">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {browser !== 'safari' && (
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              prompt('Copy this link:', link);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      )}
      <p className="muted small">Needs iOS 16.4 or later for notifications (Settings → General → About → iOS Version).</p>
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
    </Shell>
  );
}
