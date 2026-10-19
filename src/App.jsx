import { useEffect, useMemo, useState } from 'react';
import { loadStore } from './data/store.js';
import { ROSTER, TEAM_NAME } from './config.js';
import { SignInScreen, NoAccessScreen, LoadingScreen } from './components/Gate.jsx';
import Workspace from './components/Workspace.jsx';

// Matches a Google display name to the roster ("Asher M." -> "Asher Mosseri").
function rosterName(displayName = '') {
  const dn = displayName.toLowerCase().trim();
  if (!dn) return null;
  return ROSTER.find((n) => n.toLowerCase() === dn) || ROSTER.find((n) => n.split(' ')[0].toLowerCase() === dn.split(' ')[0]) || null;
}

export default function App() {
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStore().then(setStore, (e) => setError(String(e)));
  }, []);

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
    return { email: user.email, name: access.name || rosterName(user.displayName) || user.displayName || user.email };
  }, [user, access]);

  useEffect(() => {
    document.title = `${TEAM_NAME} Task Board`;
  }, []);

  if (error) return <LoadingScreen error={error} />;
  if (!store || user === undefined) return <LoadingScreen />;
  if (!user) return <SignInScreen onSignIn={() => store.signIn().catch((e) => setError(e.message))} />;
  if (!access) return <LoadingScreen />;
  if (!access.allowed) return <NoAccessScreen user={user} onSignOut={() => store.signOut()} />;
  return <Workspace store={store} user={user} actor={actor} isAdmin={access.isAdmin} />;
}
