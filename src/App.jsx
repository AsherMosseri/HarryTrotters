import { useEffect, useMemo, useState } from 'react';
import { loadStore } from './data/store.js';
import { TEAM_NAME, makeRenamer } from './config.js';
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
  const [member, setMember] = useState(undefined); // undefined = checking, null = hasn't joined
  const [error, setError] = useState('');
  const [renames, setRenames] = useState({});
  const rename = useMemo(() => makeRenamer(renames), [renames]);

  useEffect(() => {
    loadStore().then(setStore, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!store) return;
    return store.onAuth(
      (u) => {
        setUser(u);
        setMember(undefined);
      },
      (e) => setError(AUTH_ERRORS[e.code] || e.message || String(e)),
    );
  }, [store]);

  useEffect(() => {
    if (!store || !user) return;
    let alive = true;
    store.getMember(user.uid).then(
      (m) => alive && setMember(m),
      (e) => alive && setError(e.message || String(e)),
    );
    return () => {
      alive = false;
    };
  }, [store, user]);

  useEffect(() => {
    if (!store || !user) return;
    return store.subscribeNames(setRenames, (e) => console.warn('names', e));
  }, [store, user]);

  const actor = useMemo(
    () => (user && member ? { uid: user.uid, name: rename(member.name), admin: member.admin } : null),
    [user, member, rename],
  );

  useEffect(() => {
    document.title = `${TEAM_NAME} Task Board`;
  }, []);

  if (error) return <LoadingScreen error={error} />;
  if (!store || !user || member === undefined) return <LoadingScreen />;
  if (!actor)
    return (
      <JoinScreen
        rename={rename}
        onJoin={async (name, code, managerCode) => {
          await store.join(user.uid, name, code, managerCode);
          setMember({ name, admin: !!managerCode });
        }}
      />
    );
  return <Workspace store={store} actor={actor} rename={rename} renames={renames} />;
}
