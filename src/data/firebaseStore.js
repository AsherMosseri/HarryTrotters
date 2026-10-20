import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signOut as fbSignOut } from 'firebase/auth';
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
  deleteDoc,
  setDoc,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { firebaseConfig } from '../config.js';
import { describeChanges, derivedFields, newTaskDefaults, newMilestoneDefaults, newPartDefaults } from './diff.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Offline cache keeps the board usable on spotty shop Wi-Fi.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const tasksCol = collection(db, 'tasks');
// members/{uid} holds the team code a device joined with (only readable by that
// device); people/{uid} is the public name list everyone on the team can read.
const membersCol = collection(db, 'members');
const peopleCol = collection(db, 'people');
const milestonesCol = collection(db, 'milestones');
const rolesCol = collection(db, 'roles');
const settingsDoc = doc(db, 'settings', 'team');
const partsCol = collection(db, 'parts');
const checklistsCol = collection(db, 'checklists');

const millis = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : (v ?? null));

function readDoc(snap) {
  const data = snap.data({ serverTimestamps: 'estimate' });
  const out = { id: snap.id, ...data };
  for (const k of ['createdAt', 'updatedAt', 'completedAt', 'at', 'joinedAt']) {
    if (k in out) out[k] = millis(out[k]);
  }
  return out;
}

const actorFields = (actor) => ({ by: actor.name, byUid: actor.uid });

export const firebaseStore = {
  mode: 'firebase',

  // Every device gets a silent anonymous account; the team code (checked by
  // the security rules) is what actually grants access.
  onAuth(cb, onError) {
    return onAuthStateChanged(auth, (user) => {
      if (user) cb({ uid: user.uid });
      else signInAnonymously(auth).catch(onError);
    });
  },

  async getMember(uid) {
    try {
      const snap = await getDoc(doc(membersCol, uid));
      return snap.exists() ? { name: snap.data().name, admin: snap.data().admin === true } : null;
    } catch (err) {
      if (err.code === 'permission-denied') return null;
      throw err;
    }
  },

  // adminCode is only sent when joining as the manager; the rules check it.
  async join(uid, name, code, adminCode) {
    const member = { name, code: code.trim().toLowerCase(), joinedAt: serverTimestamp() };
    if (adminCode) Object.assign(member, { admin: true, adminCode: adminCode.trim().toLowerCase() });
    const batch = writeBatch(db);
    batch.set(doc(membersCol, uid), member);
    batch.set(doc(peopleCol, uid), { name, joinedAt: serverTimestamp() });
    await batch.commit();
  },

  // Forget this device; it gets a fresh anonymous account and must re-enter the code.
  leave() {
    return fbSignOut(auth);
  },

  subscribePeople(cb, onError) {
    return onSnapshot(peopleCol, (snap) => cb(snap.docs.map(readDoc)), onError);
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

  subscribeMilestones(cb, onError) {
    return onSnapshot(milestonesCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  async createMilestone(data, actor) {
    const ref = doc(milestonesCol);
    await setDoc(ref, {
      ...newMilestoneDefaults(data),
      createdAt: serverTimestamp(),
      createdBy: actor.name,
      updatedAt: serverTimestamp(),
      updatedBy: actor.name,
    });
    return ref.id;
  },

  updateMilestone(id, patch, actor) {
    return setDoc(doc(milestonesCol, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: actor.name }, { merge: true });
  },

  // Also unlinks the milestone's tasks so they don't point at nothing.
  async deleteMilestone(id, taskIds) {
    const batch = writeBatch(db);
    batch.delete(doc(milestonesCol, id));
    for (const t of taskIds) batch.update(doc(tasksCol, t), { milestoneId: '' });
    await batch.commit();
  },

  subscribeRoles(cb, onError) {
    return onSnapshot(rolesCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  saveRole(id, data, actor) {
    return setDoc(doc(rolesCol, id), { ...data, updatedAt: serverTimestamp(), updatedBy: actor.name });
  },

  subscribeSettings(cb, onError) {
    return onSnapshot(settingsDoc, (snap) => cb(snap.exists() ? snap.data() : {}), onError);
  },

  saveSettings(patch, actor) {
    return setDoc(settingsDoc, { ...patch, updatedAt: serverTimestamp(), updatedBy: actor.name }, { merge: true });
  },

  subscribeParts(cb, onError) {
    return onSnapshot(partsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  createPart(data, actor) {
    return setDoc(doc(partsCol), {
      ...newPartDefaults(data),
      createdAt: serverTimestamp(),
      createdBy: actor.name,
      updatedAt: serverTimestamp(),
      updatedBy: actor.name,
    });
  },

  updatePart(id, patch, actor) {
    return updateDoc(doc(partsCol, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: actor.name });
  },

  deletePart(id) {
    return deleteDoc(doc(partsCol, id));
  },

  // Checklist items live in an `items` map keyed by item id, so two people
  // ticking different boxes at once don't overwrite each other.
  subscribeChecklists(cb, onError) {
    return onSnapshot(checklistsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  createChecklist(data, actor) {
    return setDoc(doc(checklistsCol), { title: '', items: {}, ...data, createdAt: serverTimestamp(), createdBy: actor.name });
  },

  renameChecklist(id, title) {
    return updateDoc(doc(checklistsCol, id), { title });
  },

  setChecklistItem(id, item) {
    return updateDoc(doc(checklistsCol, id), { [`items.${item.id}`]: item });
  },

  patchChecklistItems(id, patches) {
    const update = {};
    for (const [itemId, patch] of Object.entries(patches)) {
      for (const [k, v] of Object.entries(patch)) update[`items.${itemId}.${k}`] = v;
    }
    return updateDoc(doc(checklistsCol, id), update);
  },

  removeChecklistItem(id, itemId) {
    return updateDoc(doc(checklistsCol, id), { [`items.${itemId}`]: deleteField() });
  },

  deleteChecklist(id) {
    return deleteDoc(doc(checklistsCol, id));
  },
};
