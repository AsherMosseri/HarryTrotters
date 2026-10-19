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

export function SignInScreen({ onSignIn }) {
  return (
    <Shell>
      <h1>{TEAM_NAME} Task Board</h1>
      <p className="muted">Sign in with your Google account to see the team's tasks.</p>
      <button className="btn google" onClick={onSignIn}>
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
        Sign in with Google
      </button>
      <a className="small muted demo-link" href="?demo">
        Just looking? Try the demo with sample tasks
      </a>
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
