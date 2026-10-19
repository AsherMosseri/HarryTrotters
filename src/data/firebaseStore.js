import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { firebaseConfig, ADMIN_EMAILS } from '../config.js';
import { describeChanges, derivedFields, newTaskDefaults } from './diff.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Offline cache keeps the board usable on spotty shop Wi-Fi.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const tasksCol = collection(db, 'tasks');
const membersCol = collection(db, 'members');

const millis = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : (v ?? null));

function readDoc(snap) {
  const data = snap.data({ serverTimestamps: 'estimate' });
  const out = { id: snap.id, ...data };
  for (const k of ['createdAt', 'updatedAt', 'completedAt', 'at', 'addedAt']) {
    if (k in out) out[k] = millis(out[k]);
  }
  return out;
}

const EMAIL_KEY = 'signin-email';
// Page URL without the sign-in link's query params.
const homeUrl = () => location.origin + location.pathname;

const actorFields = (actor) => ({ by: actor.name, byEmail: actor.email });

export const firebaseStore = {
  mode: 'firebase',

  onAuth(cb) {
    return onAuthStateChanged(auth, (user) =>
      cb(user ? { email: user.email.toLowerCase(), displayName: user.displayName, photoURL: user.photoURL } : null),
    );
  },

  async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
      else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') throw err;
    }
  },

  // Passwordless email-link sign-in: works with school accounts whose Google
  // Workspace admin blocks third-party "Sign in with Google".
  async sendEmailLink(email) {
    const clean = email.trim().toLowerCase();
    await sendSignInLinkToEmail(auth, clean, { url: homeUrl(), handleCodeInApp: true });
    localStorage.setItem(EMAIL_KEY, clean);
  },

  isEmailLink() {
    return isSignInWithEmailLink(auth, location.href);
  },

  savedEmail() {
    return localStorage.getItem(EMAIL_KEY) || '';
  },

  async completeEmailLink(email) {
    await signInWithEmailLink(auth, email.trim().toLowerCase(), location.href);
    localStorage.removeItem(EMAIL_KEY);
    history.replaceState(null, '', homeUrl());
  },

  signOut() {
    return fbSignOut(auth);
  },

  async checkMembership(user) {
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    let member = null;
    try {
      const snap = await getDoc(doc(membersCol, user.email));
      if (snap.exists()) member = snap.data();
    } catch (err) {
      if (err.code !== 'permission-denied') throw err;
    }
    return { allowed: isAdmin || !!member, isAdmin, name: member?.name || null };
  },

  subscribeTasks(cb, onError) {
    return onSnapshot(tasksCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  async createTask(data, actor) {
    const ref = doc(tasksCol);
    const batch = writeBatch(db);
    batch.set(ref, {
      ...newTaskDefaults(data),
      createdAt: serverTimestamp(),
      createdBy: actor.name,
      updatedAt: serverTimestamp(),
      updatedBy: actor.name,
      completedAt: data.status === 'done' ? serverTimestamp() : null,
    });
    batch.set(doc(collection(ref, 'activity')), { type: 'created', ...actorFields(actor), at: serverTimestamp() });
    await batch.commit();
    return ref.id;
  },

  async updateTask(id, patch, actor, prev) {
    const changes = describeChanges(prev, patch);
    if (!changes.length) return;
    const ref = doc(tasksCol, id);
    const batch = writeBatch(db);
    batch.update(ref, {
      ...patch,
      ...derivedFields(prev, patch, serverTimestamp()),
      updatedAt: serverTimestamp(),
      updatedBy: actor.name,
    });
    for (const c of changes) {
      batch.set(doc(collection(ref, 'activity')), { ...c, ...actorFields(actor), at: serverTimestamp() });
    }
    await batch.commit();
  },

  deleteTask(id) {
    return deleteDoc(doc(tasksCol, id));
  },

  subscribeActivity(taskId, cb, onError) {
    // Sorted client-side so pending server timestamps (local estimates) order correctly.
    return onSnapshot(
      collection(tasksCol, taskId, 'activity'),
      (snap) => cb(snap.docs.map(readDoc).sort((a, b) => (a.at ?? 0) - (b.at ?? 0))),
      onError,
    );
  },

  async addComment(taskId, text, actor) {
    const ref = doc(tasksCol, taskId);
    const batch = writeBatch(db);
    batch.set(doc(collection(ref, 'activity')), { type: 'comment', text, ...actorFields(actor), at: serverTimestamp() });
    batch.update(ref, { commentCount: increment(1) });
    await batch.commit();
  },

  subscribeMembers(cb, onError) {
    return onSnapshot(membersCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  addMember(email, name) {
    const id = email.trim().toLowerCase();
    return setDoc(doc(membersCol, id), { email: id, name: name.trim(), addedAt: serverTimestamp() });
  },

  removeMember(email) {
    return deleteDoc(doc(membersCol, email));
  },
};
