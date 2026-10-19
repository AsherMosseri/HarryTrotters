import { useState } from 'react';
import { TEAM_NAME, ADMIN_EMAILS } from '../config.js';

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

const AUTH_ERRORS = {
  'auth/invalid-email': "That doesn't look like a valid email address.",
  'auth/missing-email': 'Type your email first.',
  'auth/operation-not-allowed':
    "Email sign-in isn't turned on in Firebase yet (Authentication → Sign-in method → Email/Password → Email link).",
  'auth/unauthorized-continue-uri': "This website isn't on Firebase's authorized domains list yet.",
  'auth/quota-exceeded': "Today's sign-in email limit was reached. Try again tomorrow,.",
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/invalid-action-code': 'That sign-in link expired or was already used. Send yourself a new one.',
  'auth/expired-action-code': 'That sign-in link expired. Send yourself a new one.',
  'auth/network-request-failed': 'No internet connection. Check your Wi-Fi and try again.',
};

export const authMessage = (e) => AUTH_ERRORS[e?.code] || e?.message || String(e);

export function SignInScreen({ store, notice }) {
  const [email, setEmail] = useState(() => store.savedEmail());
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(notice || '');

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await store.sendEmailLink(email);
      setSent(true);
    } catch (ex) {
      setErr(authMessage(ex));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Shell>
        <h1>Check your email</h1>
        <p className="muted">
          We sent a sign-in link to <strong>{email.trim().toLowerCase()}</strong>. Open it <strong>on this device</strong> to sign in.
        </p>
        <p className="muted small">Not there after a minute? Check your spam or junk folder.</p>
        <button className="link-btn" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1>{TEAM_NAME} Task Board</h1>
      <p className="muted">Sign in with your school email. We'll email you a one-tap sign-in link — no password needed.</p>
      <form className="signin-form" onSubmit={send}>
        <input
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="you@ahschool.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn primary" disabled={busy || !email.trim()}>
          {busy ? 'Sending…' : 'Email me a sign-in link'}
        </button>
      </form>
      {err && <p className="form-error">{err}</p>}
      <a className="small muted demo-link" href="?demo">
        Just looking? Try the demo with sample tasks
      </a>
    </Shell>
  );
}

// Shown when a sign-in link is opened in a browser that didn't request it,
// so we can't know the email it was sent to.
export function ConfirmEmailScreen({ onConfirm, busy, error }) {
  const [email, setEmail] = useState('');
  return (
    <Shell>
      <h1>Finish signing in</h1>
      <p className="muted">Type the email address the sign-in link was sent to.</p>
      <form
        className="signin-form"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(email);
        }}
      >
        <input
          className="input"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="you@ahschool.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <button className="btn primary" disabled={busy || !email.trim()}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </Shell>
  );
}

export function NoAccessScreen({ user, onSignOut }) {
  return (
    <Shell>
      <h1>You're not on the team list yet</h1>
      <p className="muted">
        You're signed in as <strong>{user.email}</strong>. Ask {ADMIN_EMAILS[0]} to add this email on the Team screen, then reload.
      </p>
      <div className="row gap">
        <button className="btn" onClick={() => location.reload()}>
          Reload
        </button>
        <button className="btn ghost" onClick={onSignOut}>
          Use a different account
        </button>
      </div>
    </Shell>
  );
}
