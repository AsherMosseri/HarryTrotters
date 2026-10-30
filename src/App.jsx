import { useEffect, useMemo, useState } from 'react';
import { loadStore } from './data/store.js';
import { REQUESTS_TO, TEAM_NAME, isManagerName, makeRenamer } from './config.js';
import { InstallScreen, LoadingScreen, SignInScreen } from './components/Gate.jsx';
import { installNeeded } from './data/push.js';
import { isDemo } from './data/store.js';
import { NEXT } from './next.js';

// Checked once: the Home Screen app is a separate launch, so this never changes mid-visit.
const install = isDemo ? null : installNeeded();
import Workspace from './components/Workspace.jsx';
import { ShutdownScreen, useShutdown } from './components/Shutdown.jsx';
import { PreviewBar, lookOnly } from './components/Preview.jsx';

const AUTH_ERRORS = {
  'auth/operation-not-allowed': 'Anonymous sign-in is turned off in Firebase (Authentication → Sign-in method → Anonymous).',
  'auth/admin-restricted-operation': 'Anonymous sign-in is turned off in Firebase (Authentication → Sign-in method → Anonymous).',
  'auth/network-request-failed': 'No internet connection. Check your Wi-Fi and reload.',
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

  useEffect(() => {
    if (!store || !user) return;
    let alive = true;
    const saved = savedMember(user.uid);
    store.getMember(user.uid).then(
      (m) => {
        if (!alive) return;
        saveMember(user.uid, m);
        setMember((prev) => (prev && m && prev.name === m.name && prev.admin === m.admin && prev.via === m.via ? prev : m));
      },
      // Offline or a slow connection: keep going as who this device joined as.
      (e) => alive && !saved && setError(e.message || String(e)),
    );
    return () => {
      alive = false;
    };
  }, [store, user]);

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
    () => (user && signedIn ? { uid: user.uid, name: rename(member.name), admin: member.admin } : null),
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
  const viewStore = useMemo(() => (store && owner && preview ? lookOnly(store) : store), [store, owner, preview]);

  if (install) return <InstallScreen {...install} />;
  if (error) return <LoadingScreen error={error} />;
  if (!store || !user || member === undefined) return <LoadingScreen step={!store ? 1 : !user ? 2 : 3} />;
  if (!actor)
    return (
      <SignInScreen
        rename={rename}
        current={member?.name ? rename(member.name) : ''}
        account={(data) => store.account(data)}
        saveTicket={(name, code) => store.saveSetupTicket(user.uid, name, code)}
        onSignedIn={(m) => {
          saveMember(user.uid, m);
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
      onPreview={owner ? setPreview : undefined}
      preview={owner ? preview : null}
      onExitPreview={exitPreview}
    />
  );
}
