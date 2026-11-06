import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadStore } from './data/store.js';
import { REQUESTS_TO, TEAM_NAME, isManagerName, makeRenamer } from './config.js';
import { GetNewApp, InstallScreen, LoadingScreen, SignInScreen, WaitingScreen } from './components/Gate.jsx';
import { installNeeded, oldHomeApp } from './data/push.js';
import { isDemo } from './data/store.js';
import { NEXT } from './next.js';
import { isNetworkError, isOnline } from './connection.js';

// Checked once: the Home Screen app is a separate launch, so this never changes mid-visit.
const install = isDemo ? null : installNeeded();
// An iPhone/iPad Home Screen app added before 3.0 (the test copy is exempt);
// ?demo=newapp previews the screen.
const demoMode = new URLSearchParams(location.search).get('demo');
const oldApp = demoMode?.startsWith('newapp') || (!isDemo && !NEXT && oldHomeApp());
import Workspace from './components/Workspace.jsx';
import { ShutdownScreen, useShutdown } from './components/Shutdown.jsx';
import { PreviewBar, lookOnly } from './components/Preview.jsx';

// A device that has never signed in (or hasn't picked its name yet) has
// nothing saved to open with: it needs the internet once.
const SIGN_IN_OFFLINE = 'Signing in the first time needs a connection. Connect to Wi‑Fi and this opens on its own.';
const AUTH_ERRORS = {
  'auth/operation-not-allowed': 'Anonymous sign-in is turned off in Firebase (Authentication → Sign-in method → Anonymous).',
  'auth/admin-restricted-operation': 'Anonymous sign-in is turned off in Firebase (Authentication → Sign-in method → Anonymous).',
  'auth/network-request-failed': SIGN_IN_OFFLINE,
};

// Who this device is signed in as, remembered so the app opens right away next
// time (the check with the server still runs; signed out or reset goes back to
// Sign in). Only password sign-ins count.
const memberKey = (uid) => `member-${uid}`;
function savedMember(uid) {
  try {
    const m = JSON.parse(localStorage.getItem(memberKey(uid)));
    return m && typeof m.name === 'string' && m.via === 'password' ? m : undefined;
  } catch {
    return undefined;
  }
}
function saveMember(uid, m) {
  try {
    if (m) localStorage.setItem(memberKey(uid), JSON.stringify(m));
    else localStorage.removeItem(memberKey(uid));
  } catch {
    /* private mode */
  }
}

export default function App() {
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(undefined); // undefined = checking, null = hasn't joined
  const [error, setError] = useState('');
  const [renames, setRenames] = useState({});
  const rename = useMemo(() => makeRenamer(renames), [renames]);

  useEffect(() => {
    // The old Home Screen app loads too: it makes the person's password
    // (GetNewApp) while it's still signed in as them.
    if (install) return;
    loadStore().then(setStore, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!store) return;
    return store.onAuth(
      (u) => {
        setUser(u);
        setMember(u ? savedMember(u.uid) : undefined);
      },
      (e) => setError(AUTH_ERRORS[e.code] || e.message || String(e)),
    );
  }, [store]);

  // Every signed-in device watches its own members doc. A waiting device (a
  // new name) opens the moment team management lets it in, and goes back to
  // Sign in if they turn it away. A device that was let in goes back to Sign
  // in when its doc is deleted (the person was removed from the team).
  const pending = !!(user && member?.via === 'password' && member.pending);
  const watching = !!(user && member?.via === 'password');
  const [notice, setNotice] = useState('');
  const leaving = useRef(false);
  const kicking = useRef(false);
  const current = useRef(member);
  current.current = member;
  // This device's sign-in is gone on the server. Clear what it remembers and
  // go to Sign in, with a note if it was because the person was removed.
  const kickOut = useCallback(
    async (uid) => {
      if (leaving.current || kicking.current) return;
      kicking.current = true;
      // Nothing half-working in the meantime.
      setMember(undefined);
      let removed = false;
      try {
        const asked = await Promise.race([store.account({ action: 'status' }), new Promise((_, no) => setTimeout(no, 5000))]);
        removed = asked?.removed === true;
      } catch {
        /* no answer: Sign in without a reason */
      }
      saveMember(uid, null);
      store.forgetDevice?.();
      setNotice(removed ? 'You were removed from the team. If that’s a mistake, ask team management.' : '');
      setMember(null);
    },
    [store],
  );
  useEffect(() => {
    if (!store || !user) return;
    let alive = true;
    const saved = savedMember(user.uid);
    store.getMember(user.uid).then(
      (m) => {
        if (!alive) return;
        // The app opened from the remembered sign-in, and the server no longer
        // has this device: it was signed out (say, the person was removed).
        if (!m && saved) return kickOut(user.uid);
        saveMember(user.uid, m);
        setMember((prev) => (prev && m && prev.name === m.name && prev.admin === m.admin && prev.via === m.via && !!prev.pending === !!m.pending ? prev : m));
      },
      // Offline or a slow connection: keep going as who this device joined as.
      (e) => alive && !saved && setError(isNetworkError(e) || !isOnline() ? SIGN_IN_OFFLINE : e.message || String(e)),
    );
    return () => {
      alive = false;
    };
  }, [store, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!store || !user || !watching || !store.subscribeMember) return;
    const was = current.current?.name;
    return store.subscribeMember(
      user.uid,
      (m, meta) => {
        if (!m) {
          // From the saved copy, not the server (offline, or the server hasn't answered): can't tell yet.
          if (meta?.cached || leaving.current) return;
          if (current.current?.pending) {
            saveMember(user.uid, null);
            setNotice(`Team management didn’t let ${was} in. Pick your name, or ask them.`);
            return setMember(null);
          }
          return kickOut(user.uid);
        }
        const now = current.current;
        if (now && m.name === now.name && m.admin === now.admin && m.via === now.via && !!m.pending === !!now.pending) return;
        saveMember(user.uid, m);
        setMember(m);
      },
      (e) => console.warn('member', e),
    );
  }, [store, user, watching, kickOut]);
  // Reads refused (Workspace tells us): the server may have signed this device
  // out. Ask once in a while; if so, go to Sign in instead of a half-working app.
  const checking = useRef(0);
  const onDenied = useCallback(() => {
    if (!store || !user || Date.now() - checking.current < 5000) return;
    checking.current = Date.now();
    store.getMember(user.uid).then(
      (m) => (!m ? kickOut(user.uid) : undefined),
      () => {},
    );
  }, [store, user, kickOut]);

  useEffect(() => {
    if (!store || !user) return;
    // Only take a new object when the renames actually change, so everything
    // keyed on the signed-in person stays put.
    return store.subscribeNames(
      (next) => setRenames((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)),
      (e) => console.warn('names', e),
    );
  }, [store, user]);

  // Before 3.0 is live, the test copy (/next/) has no account function to
  // sign in with yet: it keeps the old team-code sign-in until then.
  // Nothing waits on that check (on an iPad it sometimes never answered, and
  // the app sat on the loading screen): until it says otherwise, assume the
  // last answer, or not live yet. The answer is remembered for next time.
  const probe = !!(NEXT && !isDemo && store?.account && member && member.via !== 'password');
  const [probed, setProbed] = useState(() => localStorage.getItem('passwords-live') === 'yes');
  useEffect(() => {
    if (!probe) return;
    const got = (live) => {
      setProbed(live);
      try {
        localStorage.setItem('passwords-live', live ? 'yes' : 'no');
      } catch {
        /* private browsing */
      }
    };
    // Only an answer from the account function means it's live.
    store.account({ action: 'status' }).then(
      () => got(true),
      () => got(false),
    );
  }, [probe, store]);
  const passwordsLive = probe ? probed : true;
  const signedIn = member && (member.via === 'password' || passwordsLive === false);
  const actor = useMemo(
    () => (user && signedIn && !member.pending ? { uid: user.uid, name: rename(member.name), admin: member.admin } : null),
    [user, member, signedIn, rename],
  );

  useEffect(() => {
    document.title = `${TEAM_NAME} Task Board${NEXT ? ' (Next)' : ''}`;
  }, []);
  // Asher can shut the app down for everyone else.
  const shutdown = useShutdown(store, !!actor);
  // Asher's preview (Controls): the app as a regular teammate, or as one
  // person, look only. { as: null } = a teammate; { as: name } = that person.
  const [preview, setPreview] = useState(null);
  const owner = actor?.admin && actor.name === REQUESTS_TO;
  const viewer = useMemo(() => {
    if (!actor || !owner || !preview) return actor;
    const name = preview.as || actor.name;
    return { uid: actor.uid, name, admin: preview.as ? isManagerName(name) : false, preview: true };
  }, [actor, owner, preview]);
  const oldAppAccount = useCallback((data) => store.account(data), [store]);
  const viewStore = useMemo(() => (store && owner && preview ? lookOnly(store) : store), [store, owner, preview]);

  if (oldApp)
    return <GetNewApp member={error ? null : member} account={store?.account ? oldAppAccount : null} rename={rename} />;
  if (install) return <InstallScreen {...install} />;
  if (error) return <LoadingScreen error={error} offline={error === SIGN_IN_OFFLINE} />;
  if (!store || !user || member === undefined) return <LoadingScreen step={!store ? 1 : !user ? 2 : 3} />;
  if (pending)
    return (
      <WaitingScreen
        name={rename(member.name)}
        onLeave={async () => {
          leaving.current = true;
          // Give up the name (the server drops the request), then start over.
          await store.account({ action: 'withdraw' }).catch(() => {});
          saveMember(user.uid, null);
          if (isDemo) location.search = '?demo=signin';
          else await store.leave();
        }}
      />
    );
  if (!actor)
    return (
      <SignInScreen
        rename={rename}
        notice={notice}
        current={member?.name ? rename(member.name) : ''}
        account={(data) => store.account(data)}
        saveTicket={(name, code) => store.saveSetupTicket(user.uid, name, code)}
        onSignedIn={(m) => {
          saveMember(user.uid, m);
          leaving.current = false;
          kicking.current = false;
          setNotice('');
          setMember(m);
        }}
      />
    );
  // The redesign's test copy (next.js) is Asher's only.
  if (NEXT && !isDemo && !owner) {
    location.replace('../');
    return <LoadingScreen />;
  }
  const exitPreview = () => setPreview(null);
  // Shut down for everyone but Asher, or only for the people he picked.
  const shutFor = (name) => shutdown?.on && (!shutdown.people?.length || shutdown.people.includes(name));
  if (actor && shutFor(viewer.name) && !(owner && !preview))
    return (
      <>
        {preview && owner && <PreviewBar as={preview.as} onExit={exitPreview} />}
        <ShutdownScreen shutdown={shutdown} store={viewStore} actor={viewer} />
      </>
    );
  return (
    <Workspace
      key={preview ? `preview:${preview.as || ''}` : 'me'}
      store={viewStore}
      actor={viewer}
      rename={rename}
      renames={renames}
      shutdown={shutdown}
      onDenied={onDenied}
      onPreview={owner ? setPreview : undefined}
      preview={owner ? preview : null}
      onExitPreview={exitPreview}
    />
  );
}
