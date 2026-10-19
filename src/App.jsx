import { useEffect, useMemo, useState } from 'react';
import { loadStore } from './data/store.js';
import { TEAM_NAME } from './config.js';
import { JoinScreen, LoadingScreen } from './components/Gate.jsx';
import Workspace from './components/Workspace.jsx';

const AUTH_ERRORS = {
  'auth/operation-not-allowed': 'Anonymous sign-in is turned off in Firebase (Authentication → Sign-in method → Anonymous).',
  'auth/admin-restricted-operation': 'Anonymous sign-in is turned off in Firebase (Authentication → Sign-in method → Anonymous).',
  'auth/network-request-failed': 'No internet connection. Check your Wi-Fi and reload.',
};

export default function App() {
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(null);
  const [name, setName] = useState(undefined); // undefined = checking, null = hasn't joined
  const [error, setError] = useState('');

  useEffect(() => {
    loadStore().then(setStore, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!store) return;
    return store.onAuth(
      (u) => {
        setUser(u);
        setName(undefined);
      },
      (e) => setError(AUTH_ERRORS[e.code] || e.message || String(e)),
    );
  }, [store]);

  useEffect(() => {
    if (!store || !user) return;
    let alive = true;
    store.getMember(user.uid).then(
      (n) => alive && setName(n),
      (e) => alive && setError(e.message || String(e)),
    );
    return () => {
      alive = false;
    };
  }, [store, user]);

  const actor = useMemo(() => (user && name ? { uid: user.uid, name } : null), [user, name]);

  useEffect(() => {
    document.title = `${TEAM_NAME} Task Board`;
  }, []);

  if (error) return <LoadingScreen error={error} />;
  if (!store || !user || name === undefined) return <LoadingScreen />;
  if (!actor)
    return (
      <JoinScreen
        onJoin={async (n, code) => {
          await store.join(user.uid, n, code);
          setName(n);
        }}
      />
    );
  return <Workspace store={store} actor={actor} />;
}
