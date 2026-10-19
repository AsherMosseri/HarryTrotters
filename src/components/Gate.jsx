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
  'auth/quota-exceeded': "Today's sign-in email limit was reached. Try again tomorrow, or sign in with a personal Gmail.",
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/invalid-action-code': 'That sign-in link expired or was already used. Send yourself a new one.',
  'auth/expired-action-code': 'That sign-in link expired. Send yourself a new one.',
  'auth/network-request-failed': 'No internet connection. Check your Wi-Fi and try again.',
};

export const authMessage = (e) => AUTH_ERRORS[e?.code] || e?.message || String(e);

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

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
      <p className="muted">Sign in with your school or personal email. We'll email you a one-tap sign-in link — no password needed.</p>
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
      <div className="or">or</div>
      <button className="btn google" onClick={() => store.signIn().catch((ex) => setErr(authMessage(ex)))}>
        <GoogleLogo />
        Sign in with Google
      </button>
      <p className="muted tiny">Google sign-in works with personal Gmail. School accounts may be blocked by your school.</p>
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
