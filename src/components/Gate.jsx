import { useEffect, useState } from 'react';
import { TEAM_NAME, TEAM_NICKNAME, ROSTER, MANAGER_NAMES, PASSWORD_MIN, cleanName, sameName } from '../config.js';
import { Avatar } from './common.jsx';
import { homeAppUrl } from '../data/push.js';
import { promptDialog } from './Dialogs.jsx';
import { Icon } from './shell/icons.jsx';

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
        <img className="splash-logo" src="horse.webp" alt="" aria-hidden="true" />
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
              <span ref={syncSheen} style={{ width: `${[12, 35, 65, 88][step] ?? 88}%` }} />
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

// Every copy of the loading screen (the page's own, then the app's) runs the
// sheen on the page's clock, so swapping one for the next doesn't restart it.
function syncSheen(el) {
  try {
    el?.getAnimations({ subtree: true }).forEach((a) => (a.startTime = 0));
  } catch {
    /* older browsers: it just restarts */
  }
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

// 3.0: an old Home Screen app (added before 3.0) sends you to add the new
// one from Safari, then to delete itself (iOS never updates an added app's
// icon). The new app has its own storage, so to the server it's a new
// device. This old one is still signed in as you from before passwords, so
// it makes your password first, and the new app only asks for it (no team
// code). member: this device's members doc (undefined while checking);
// account: the account function; rename: current names.
export function GetNewApp({ member, account, rename = (n) => n }) {
  // checking | need | has | made | none (nothing to do here) | skip | error
  const [step, setStep] = useState('checking');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [tries, setTries] = useState(0);
  const first = (member?.name ? rename(member.name) : '').split(' ')[0];

  useEffect(() => {
    if (member === undefined) return;
    // Never signed in here, or a new name still waiting: the new app does it all.
    if (!member || member.pending || !account) {
      setStep('none');
      return;
    }
    let alive = true;
    setStep('checking');
    setError('');
    account({ action: 'status', name: member.name }).then(
      (r) => alive && setStep(r?.hasPassword ? 'has' : r?.thisDevice ? 'need' : 'none'),
      (e) => {
        if (!alive) return;
        setError(e?.message || String(e));
        setStep('error');
      },
    );
    return () => {
      alive = false;
    };
  }, [member, account, tries]);

  const ready = password.length >= PASSWORD_MIN && password === again;
  const create = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await account({ action: 'create', name: member.name, password });
      if (r?.error) throw new Error(r.error);
      // Someone removed from the Roster still waits for team management.
      setWaiting(!!r?.member?.pending);
      setStep('made');
    } catch (ex) {
      setError(ex?.message || String(ex));
    }
    setBusy(false);
  };

  return (
    <Shell>
      <h1>Get the new app</h1>
      <p className="muted">
        3.0 is here, with a new look and a new icon. Your {TEAM_NAME} app has to be added to your Home Screen again to get it. It takes a
        minute.
      </p>
      {step === 'checking' && <p className="muted small">Checking who this app is signed in as…</p>}
      {step === 'error' && (
        <div className="new-app-pw">
          <p className="form-error">{error}</p>
          <div className="new-app-pw-row">
            <button className="btn primary" onClick={() => setTries((n) => n + 1)}>
              Try again
            </button>
            <button className="link-btn small" onClick={() => setStep('skip')}>
              Skip for now
            </button>
          </div>
        </div>
      )}
      {step === 'need' && (
        <form className="join-form new-app-pw" onSubmit={create}>
          <h2 className="new-app-pw-title">First, make your password</h2>
          <p className="muted small">
            {TEAM_NICKNAME} uses passwords now. Make one for {first} here, while this app still knows it’s you. In the new app you’ll pick your name
            and type it.
          </p>
          <input
            className="input"
            type="password"
            autoCapitalize="none"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`New password (at least ${PASSWORD_MIN} characters)`}
          />
          <input
            className="input"
            type="password"
            autoCapitalize="none"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            placeholder="Same password again"
          />
          {again && password !== again && <p className="form-error">The two passwords don’t match.</p>}
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary" disabled={busy || !ready}>
            {busy ? 'Saving…' : 'Make my password'}
          </button>
          <button type="button" className="link-btn small" onClick={() => setStep('skip')}>
            Skip: make it in the new app with the team code
          </button>
        </form>
      )}
      {(step === 'has' || step === 'made') && (
        <p className="gate-notice new-app-done" role="status">
          <Icon name="check" size={18} />
          <span>
            {step === 'has' ? `You already have a password, ${first}.` : 'Your password is made.'}{' '}
            {waiting ? 'Team management has to let you back in before you can use the app.' : `In the new app, pick ${first} and type it.`}
          </span>
        </p>
      )}
      {!['checking', 'need', 'error'].includes(step) && <NewAppSteps />}
      {(step === 'none' || step === 'skip') && (
        <p className="muted small">
          Then open the new app. You’ll pick your name and set up your password there. Without a password yet, it asks for the team code once.
        </p>
      )}
    </Shell>
  );
}

function NewAppSteps() {
  const [copied, setCopied] = useState(false);
  const link = homeAppUrl({ add: '3' });
  return (
    <ol className="install-steps new-app-steps">
      <li>
        <b>Open the website in Safari.</b>
        <a className="btn primary new-app-open" href={`x-safari-${link}`}>
          Open in Safari
        </a>
        <span className="muted small">
          Didn’t open? Open Safari and go to <b className="new-app-link">{link.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}</b>{' '}
          <button
            className="link-btn small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                /* the address is shown above */
              }
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </span>
      </li>
      <li>
        <b>Add it to your Home Screen.</b> Safari shows you how. This is the new icon:
        <span className="new-app-icon">
          <img src="icon-192.png" alt="" />
          <span>32313 Tasks</span>
        </span>
      </li>
      <li>
        <b>Delete this old app.</b> On your Home Screen, press and hold this icon, tap <b>Remove App</b>, then <b>Delete App</b>:
        <span className="new-app-icon old">
          <img src="old-icon.png" alt="" />
          <span>32313 Tasks</span>
        </span>
      </li>
    </ol>
  );
}

// On iPhone and iPad the board only runs as the Home Screen app, so everyone
// can get notifications. Shown in Safari (or another browser) until then.

export function InstallScreen({ device, browser }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}`;
  // Here from an old Home Screen app (3.0): remind them to delete it after.
  const [fromOld] = useState(() => new URLSearchParams(location.search).has('add'));
  // Whatever gets added from this page opens as the new 3.0 app.
  useEffect(() => {
    if (browser === 'safari' || browser === 'chrome') history.replaceState(null, '', homeAppUrl());
  }, [browser]);
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
            Go to your Home Screen and open <b>32313 Tasks</b>. You’ll pick your name and set up your password there.
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
              Go to your Home Screen and open <b>32313 Tasks</b>. You’ll pick your name and set up your password there.
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
      {fromOld && (
        <p className="new-app-delete">
          <span className="new-app-icon old">
            <img src="old-icon.png" alt="" />
          </span>
          <span>
            Then delete the old app: press and hold this icon on your Home Screen, tap <b>Remove App</b>, then <b>Delete App</b>.
          </span>
        </p>
      )}
      {browser !== 'safari' && (
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              promptDialog({
                title: 'Copy this link',
                body: 'Select it and copy it, then open it in Safari.',
                initial: link,
                readOnly: true,
                okLabel: 'Done',
              });
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

// A name new to the team, waiting for team management to let it in. Nothing
// else loads (the server refuses it anyway); App watches this device's
// members doc, so the app opens by itself the moment they do.
export function WaitingScreen({ name, onLeave }) {
  const [busy, setBusy] = useState(false);
  const managers = MANAGER_NAMES.map((n) => n.split(' ')[0]).join(' or ');
  return (
    <Shell>
      <div className="wait-who">
        <Avatar name={name} size={48} />
        <span>
          Signed in as <b>{name}</b>
        </span>
      </div>
      <h1>Waiting for team management to let you in</h1>
      <p className="muted">
        {name.split(' ')[0]} isn’t on the team yet, so {managers} has to let you in first. This opens by itself as soon as they do.
      </p>
      <p className="wait-status" role="status">
        <span className="wait-dot" aria-hidden="true" />
        Waiting
      </p>
      <button
        className="link-btn"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          Promise.resolve(onLeave()).catch(() => setBusy(false));
        }}
      >
        {busy ? 'Signing out…' : 'Not you? Pick a different name'}
      </button>
    </Shell>
  );
}

// Signing in: pick your name, then your password. A name with no password
// yet gets one now: right away on a device that was already signed in as that
// person (before passwords), or with the team code on a new device.
// account(data) calls the account function; it returns { ok, member } or { error }.
export function SignInScreen({ rename, account, saveTicket, current, notice, onSignedIn }) {
  const names = [...new Set(ROSTER.map(rename))];
  const [picked, setPicked] = useState(current && names.includes(current) ? current : current ? OTHER : '');
  const [other, setOther] = useState(current && !names.includes(current) ? current : '');
  // "Someone else" can't be a second copy of someone on the team: a name that
  // matches one (any capitals, spaces, or dots) is that person.
  const sameAs = picked === OTHER ? names.find((n) => sameName(n, other)) : null;
  const name = sameAs || (picked === OTHER ? cleanName(other) : picked);
  const [step, setStep] = useState(null); // null | { hasPassword, thisDevice }
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Which step: sign in, or make a first password (once a name is picked).
  // A new name starts with empty boxes: the password typed for someone else
  // isn't theirs.
  useEffect(() => {
    setStep(null);
    setErr('');
    setPassword('');
    setAgain('');
    setCode('');
    if (!name || (picked === OTHER && name.length < 3)) return;
    let alive = true;
    const t = setTimeout(
      () =>
        account({ action: 'status', name })
          .then((r) => alive && setStep(r))
          .catch((e) => alive && setErr(e?.message || String(e))),
      picked === OTHER ? 500 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const creating = step && !step.hasPassword;
  const needCode = creating && !step.thisDevice;
  const ready = name && step && password && (!creating || (password.length >= PASSWORD_MIN && password === again && (!needCode || code.trim())));

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      if (needCode) {
        try {
          await saveTicket(name, code);
        } catch (ex) {
          throw new Error(ex?.code === 'permission-denied' ? 'That team code isn’t right. Check with a teammate.' : ex?.message || String(ex));
        }
      }
      const r = await account({ action: creating ? 'create' : 'signIn', name, password });
      if (r?.error) throw new Error(r.error);
      onSignedIn(r.member);
    } catch (ex) {
      setErr(ex?.message || String(ex));
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1>{current && creating && step?.thisDevice ? 'Create your password' : 'Sign in'}</h1>
      <p className="muted">
        {current && creating && step?.thisDevice
          ? `${TEAM_NICKNAME} uses passwords now, so nobody else can sign in as you. Make one for ${current.split(' ')[0]}. You’ll use it on any new device.`
          : 'Pick your name and enter your password.'}
      </p>
      {notice && (
        <p className="gate-notice" role="status">
          {notice}
        </p>
      )}
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
        {sameAs && <p className="small muted">{sameAs} is already on the team, so that’s who you’d sign in as.</p>}
        {name && step && (
          <>
            {creating && <p className="small muted">{name.split(' ')[0]} doesn’t have a password yet. Make one (at least {PASSWORD_MIN} characters).</p>}
            <input
              className="input"
              type="password"
              autoCapitalize="none"
              autoComplete={creating ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={creating ? 'New password' : 'Password'}
              autoFocus
            />
            {creating && (
              <input
                className="input"
                type="password"
                autoCapitalize="none"
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
                placeholder="Same password again"
              />
            )}
            {creating && again && password !== again && <p className="form-error">The two passwords don’t match.</p>}
            {needCode && (
              <input
                className="input"
                type="password"
                autoCapitalize="none"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Team code (first time only)"
              />
            )}
          </>
        )}
        <button className="btn primary" disabled={busy || !ready}>
          {busy ? 'Checking…' : !name ? 'Pick your name' : creating ? 'Create password' : `Sign in as ${name.split(' ')[0]}`}
        </button>
      </form>
      {err && <p className="form-error">{err}</p>}
      {step?.hasPassword && <p className="muted small">Forgot your password? Ask Asher to reset it.</p>}
    </Shell>
  );
}
