import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStore } from './data/store.js';
import { TEAM_NAME } from './config.js';
import { SignInScreen, NoAccessScreen, LoadingScreen, ConfirmEmailScreen, authMessage } from './components/Gate.jsx';
import Workspace from './components/Workspace.jsx';

export default function App() {
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  // Email-link sign-in: null | 'confirm' (need the email) | 'working'
  const [link, setLink] = useState(null);
  const [linkError, setLinkError] = useState('');
  const linkStarted = useRef(false);

  useEffect(() => {
    loadStore().then(setStore, (e) => setError(String(e)));
  }, []);

  const finishLink = (email) => {
    setLink('working');
    setLinkError('');
    store.completeEmailLink(email).then(
      () => setLink(null),
      (e) => {
        // Wrong email typed: let them retry. Anything else: back to sign-in with the reason.
        if (e.code === 'auth/invalid-email') {
          setLink('confirm');
          setLinkError("That email doesn't match the link. Use the address the link was sent to.");
        } else {
          setLink(null);
          setLinkError(authMessage(e));
          history.replaceState(null, '', location.pathname);
        }
      },
    );
  };

  useEffect(() => {
    if (!store || linkStarted.current || !store.isEmailLink()) return;
    linkStarted.current = true;
    const saved = store.savedEmail();
    if (saved) finishLink(saved);
    else setLink('confirm');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  useEffect(() => {
    if (!store) return;
    return store.onAuth((u) => {
      setUser(u);
      setAccess(null);
    });
  }, [store]);

  useEffect(() => {
    if (!store || !user) return;
    let alive = true;
    store.checkMembership(user).then(
      (a) => alive && setAccess(a),
      (e) => alive && setError(e.message || String(e)),
    );
    return () => {
      alive = false;
    };
  }, [store, user]);

  const actor = useMemo(() => {
    if (!user || !access) return null;
    return { email: user.email, name: access.name || user.displayName || user.email };
  }, [user, access]);

  useEffect(() => {
    document.title = `${TEAM_NAME} Task Board`;
  }, []);

  if (error) return <LoadingScreen error={error} />;
  if (!store || user === undefined) return <LoadingScreen />;
  if (!user && link) return <ConfirmEmailScreen busy={link === 'working'} error={linkError} onConfirm={finishLink} />;
  if (!user) return <SignInScreen store={store} notice={linkError} />;
  if (!access) return <LoadingScreen />;
  if (!access.allowed) return <NoAccessScreen user={user} onSignOut={() => store.signOut()} />;
  return <Workspace store={store} user={user} actor={actor} isAdmin={access.isAdmin} />;
}
