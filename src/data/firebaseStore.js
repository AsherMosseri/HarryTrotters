import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signOut as fbSignOut } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  deleteDoc,
  setDoc,
  updateDoc,
  deleteField,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  FieldPath,
  where,
} from 'firebase/firestore';
import { getStorage, ref as fileRef, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FUNCTIONS_REGION, firebaseConfig, VAPID_KEY } from '../config.js';
import { pushSupport } from './push.js';
import {
  describeChanges,
  derivedFields,
  newTaskDefaults,
  newMilestoneDefaults,
  newPartDefaults,
  newRunDefaults,
  itemId,
  personId,
} from './diff.js';
import { NEXT } from '../next.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
// Offline cache keeps the board usable on spotty lab Wi-Fi.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const tasksCol = collection(db, 'tasks');
// members/{uid}: who a device is signed in as (written by the account function
// after a password check; only readable by that device); people/{uid} is the
// public name list everyone on the team can read.
const membersCol = collection(db, 'members');
const peopleCol = collection(db, 'people');
const milestonesCol = collection(db, 'milestones');
const rolesCol = collection(db, 'roles');
const settingsDoc = doc(db, 'settings', 'team');
// Name changes made by managers; readable before joining so the join screen is current.
const namesDoc = doc(db, 'settings', 'names');
const partsCol = collection(db, 'parts');
const checklistsCol = collection(db, 'checklists');
const resourcesCol = collection(db, 'resources');
const diagramsCol = collection(db, 'diagrams');
const notesCol = collection(db, 'notes');
const runsCol = collection(db, 'runs');
const matchesCol = collection(db, 'matches');
const channelsCol = collection(db, 'channels');
const dmsCol = collection(db, 'dms');
const profilesCol = collection(db, 'profiles');
const presenceCol = collection(db, 'presence');
const emojiCol = collection(db, 'emoji');
const stickersCol = collection(db, 'stickers');
const requestsCol = collection(db, 'requests');
const shiftsCol = collection(db, 'shifts');
const labLogsCol = collection(db, 'labLogs');
const shiftPlansCol = collection(db, 'shiftPlans');
const checkinsCol = collection(db, 'checkins');
const shiftEditsCol = collection(db, 'shiftEdits');
const shiftRequestsCol = collection(db, 'shiftRequests');
const isDm = (conv) => conv.startsWith('dm:');
const convCol = (conv) => (isDm(conv) ? collection(dmsCol, conv.slice(3), 'messages') : collection(channelsCol, conv, 'messages'));
const convFolder = (conv) => `chat/${conv.replace(':', '-')}`;
const robotVersionsCol = collection(db, 'robotVersions');
const robotPinsCol = collection(db, 'robotPins');
const robotLayoutsCol = collection(db, 'robotLayouts');
const inboxCol = (name) => collection(db, 'inbox', personId(name), 'items');
const pushTokensCol = collection(db, 'pushTokens');
const PUSH_TOKEN_KEY = 'ftc32313-push-token';

// Registers the service worker and gets this device's push address (token).
async function pushToken() {
  const { getMessaging, getToken } = await import('firebase/messaging');
  const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  await navigator.serviceWorker.ready;
  const opts = { serviceWorkerRegistration: reg, ...(VAPID_KEY ? { vapidKey: VAPID_KEY } : {}) };
  try {
    return await getToken(getMessaging(app), opts);
  } catch (e) {
    // Safari sometimes fails the very first registration; once more usually works.
    console.warn('getToken, retrying', e);
    await new Promise((r) => setTimeout(r, 1500));
    return getToken(getMessaging(app), opts);
  }
}
const savedToken = () => {
  try {
    return localStorage.getItem(PUSH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};
const saveToken = (t) => {
  try {
    if (t) localStorage.setItem(PUSH_TOKEN_KEY, t);
    else localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    /* private mode: the token is still saved in the database */
  }
};

const millis = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : (v ?? null));

function readDoc(snap) {
  const data = snap.data({ serverTimestamps: 'estimate' });
  const out = { id: snap.id, ...data };
  for (const k of ['createdAt', 'updatedAt', 'completedAt', 'at', 'joinedAt', 'deletedAt']) {
    if (k in out) out[k] = millis(out[k]);
  }
  return out;
}

// A deleted message's pictures and files.
async function deleteMessageFiles(msg) {
  if (msg.photo) await deletePhotoFiles(msg.photo);
  for (const f of msg.files || []) await deleteObject(fileRef(storage, f.path)).catch(() => {});
  if (msg.gif?.path) await deleteObject(fileRef(storage, msg.gif.path)).catch(() => {});
}

// Uploads a full-size and thumbnail JPEG under folder/; returns where they live.
async function uploadPhoto(folder, { full, thumb }) {
  const id = itemId();
  const base = `${folder}/${id}`;
  const [url, thumbUrl] = await Promise.all(
    [
      [`${base}.jpg`, full],
      [`${base}-thumb.jpg`, thumb],
    ].map(async ([path, blob]) => {
      const r = fileRef(storage, path);
      await uploadBytes(r, blob, { contentType: 'image/jpeg' });
      return getDownloadURL(r);
    }),
  );
  return { id, path: base, url, thumbUrl };
}

async function deletePhotoFiles(photo) {
  await Promise.all(
    [`${photo.path}.jpg`, `${photo.path}-thumb.jpg`].map((p) =>
      deleteObject(fileRef(storage, p)).catch((e) => {
        if (e.code !== 'storage/object-not-found') throw e;
      }),
    ),
  );
}

const actorFields = (actor) => ({ by: actor.name, byUid: actor.uid });
// A shiftEdits record: the shift's times before (null for a new one) and after (null when deleted).
const editRecord = (shift, kind, after, actor, at, requestId) => ({
  shiftId: shift.id,
  person: shift.person,
  kind,
  ...actorFields(actor),
  at,
  before: shift.start != null ? { start: shift.start, end: shift.end ?? null } : null,
  after,
  ...(requestId ? { requestId } : {}),
});

export const firebaseStore = {
  mode: 'firebase',

  // Every device gets a silent anonymous account; signing in with a name and
  // password (the account function) is what actually grants access.
  onAuth(cb, onError) {
    return onAuthStateChanged(auth, (user) => {
      if (user) cb({ uid: user.uid });
      else signInAnonymously(auth).catch(onError);
    });
  },

  async getMember(uid) {
    try {
      const snap = await getDoc(doc(membersCol, uid));
      return snap.exists() ? { name: snap.data().name, admin: snap.data().admin === true, via: snap.data().via || '' } : null;
    } catch (err) {
      if (err.code === 'permission-denied') return null;
      throw err;
    }
  },

  // Accounts (functions/index.js account): status, create, signIn, change,
  // list, reset. Returns { ok, member } or { error } (or what was asked for).
  async account(data) {
    const call = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'account');
    return (await call(data)).data;
  },
  // Asher asked to reset this person's password (they answer with account()).
  subscribeResetRequest(name, cb) {
    return onSnapshot(
      doc(db, 'resetRequests', personId(name)),
      (snap) => cb(snap.exists() ? snap.data() : null),
      () => cb(null),
    );
  },
  // Setting up a name on a new device: the rules accept this only with the
  // right team code, and the account function then lets the name get a password.
  saveSetupTicket(uid, name, code) {
    return setDoc(doc(db, 'setupTickets', uid), { name, code: code.trim().toLowerCase(), at: Date.now() });
  },

  // Forget this device; it gets a fresh anonymous account and must re-enter the code.
  async leave() {
    // Stop sending this person's notifications to a device they've left.
    const token = savedToken();
    if (token) await deleteDoc(doc(pushTokensCol, token)).catch(() => {});
    saveToken('');
    if (auth.currentUser) {
      await deleteDoc(doc(presenceCol, auth.currentUser.uid)).catch(() => {});
      try {
        localStorage.removeItem(`member-${auth.currentUser.uid}`);
      } catch {
        /* private mode */
      }
    }
    return fbSignOut(auth);
  },

  // Notifications (written by the Cloud Functions in functions/).
  subscribeInbox(name, cb, onError) {
    return onSnapshot(query(inboxCol(name), orderBy('at', 'desc'), limit(40)), (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  markInboxRead(name, ids) {
    const batch = writeBatch(db);
    for (const id of ids) batch.update(doc(inboxCol(name), id), { read: true });
    return batch.commit();
  },
  clearInbox(name, ids) {
    const batch = writeBatch(db);
    for (const id of ids) batch.delete(doc(inboxCol(name), id));
    return batch.commit();
  },

  // Phone notifications on this device: 'on', 'off', 'blocked', 'home-screen'
  // (iPhone/iPad: only works from the Home Screen app), or 'unsupported'.
  pushStatus() {
    if (NEXT) return 'next';
    const support = pushSupport();
    if (support !== 'ok') return support;
    if (Notification.permission === 'denied') return 'blocked';
    return Notification.permission === 'granted' && savedToken() ? 'on' : 'off';
  },
  // Call straight from a tap: Safari only shows the permission prompt then.
  async enablePush(actor) {
    if (NEXT) return 'next';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return this.pushStatus();
    const token = await pushToken();
    const old = savedToken();
    if (old && old !== token) await deleteDoc(doc(pushTokensCol, old)).catch(() => {});
    await setDoc(doc(pushTokensCol, token), { uid: actor.uid, person: actor.name, ua: navigator.userAgent.slice(0, 200), at: Date.now() });
    saveToken(token);
    return 'on';
  },
  async disablePush() {
    const token = savedToken();
    saveToken('');
    if (!token) return 'off';
    await deleteDoc(doc(pushTokensCol, token)).catch(() => {});
    const { getMessaging, deleteToken } = await import('firebase/messaging');
    await deleteToken(getMessaging(app)).catch(() => {});
    return 'off';
  },
  // On each visit: tokens can change, and the device may now be someone else's.
  async refreshPush(actor) {
    if (this.pushStatus() !== 'on') return;
    const token = await pushToken();
    if (token !== savedToken()) await deleteDoc(doc(pushTokensCol, savedToken())).catch(() => {});
    await setDoc(doc(pushTokensCol, token), { uid: actor.uid, person: actor.name, ua: navigator.userAgent.slice(0, 200), at: Date.now() });
    saveToken(token);
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

  // "Deleting" moves a task to Recently deleted; it can be restored for 30 days.
  async trashTask(id, actor, restore = false) {
    const ref = doc(tasksCol, id);
    const batch = writeBatch(db);
    batch.update(ref, { deletedAt: restore ? null : serverTimestamp(), deletedBy: restore ? '' : actor.name });
    batch.set(doc(collection(ref, 'activity')), {
      type: 'change',
      field: 'deleted',
      to: restore ? 'restored' : 'deleted',
      ...actorFields(actor),
      at: serverTimestamp(),
    });
    await batch.commit();
  },

  // Permanent delete (managers only, per the rules), including photo files.
  async deleteTask(id, photos = []) {
    await deleteDoc(doc(tasksCol, id));
    await Promise.all(photos.map(deletePhotoFiles));
  },

  // Photos: a full-size and a thumbnail JPEG in Cloud Storage; the task keeps
  // their URLs in a `photos` array (arrayUnion, so simultaneous uploads don't clash).
  async addTaskPhoto(taskId, { full, thumb, width, height }, actor) {
    const photo = { ...(await uploadPhoto(`tasks/${taskId}`, { full, thumb })), width, height, by: actor.name, at: Date.now() };
    const ref = doc(tasksCol, taskId);
    const batch = writeBatch(db);
    batch.update(ref, { photos: arrayUnion(photo), updatedAt: serverTimestamp(), updatedBy: actor.name });
    batch.set(doc(collection(ref, 'activity')), {
      type: 'change',
      field: 'photos',
      to: 'added',
      ...actorFields(actor),
      at: serverTimestamp(),
    });
    await batch.commit();
  },

  async removeTaskPhoto(taskId, photo, actor) {
    const ref = doc(tasksCol, taskId);
    const batch = writeBatch(db);
    batch.update(ref, { photos: arrayRemove(photo), updatedAt: serverTimestamp(), updatedBy: actor.name });
    batch.set(doc(collection(ref, 'activity')), {
      type: 'change',
      field: 'photos',
      to: 'removed',
      ...actorFields(actor),
      at: serverTimestamp(),
    });
    await batch.commit();
    await deletePhotoFiles(photo);
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

  mergeRenames(map) {
    return setDoc(namesDoc, { renames: map }, { merge: true });
  },

  subscribeNames(cb, onError) {
    return onSnapshot(namesDoc, (snap) => cb((snap.exists() && snap.data().renames) || {}), onError);
  },

  // One batch: record the rename, fix assignees and milestone owners, and move
  // the person's org-chart entry to the new name.
  async renamePerson(oldName, newName, { renames, tasks, milestones, role, dms = [] }, actor) {
    const swap = (list) => list.map((n) => (n === oldName ? newName : n));
    const batch = writeBatch(db);
    for (const d of dms) batch.update(doc(dmsCol, d.id), { people: swap(d.people) });
    batch.set(namesDoc, { renames, updatedAt: serverTimestamp(), updatedBy: actor.name }, { merge: true });
    for (const t of tasks) batch.update(doc(tasksCol, t.id), { assignees: swap(t.assignees) });
    for (const m of milestones) batch.update(doc(milestonesCol, m.id), { owners: swap(m.owners) });
    batch.delete(doc(rolesCol, personId(oldName)));
    batch.set(doc(rolesCol, personId(newName)), {
      ...role,
      name: newName,
      removed: false,
      updatedAt: serverTimestamp(),
      updatedBy: actor.name,
    });
    await batch.commit();
  },

  subscribeSettings(cb, onError) {
    return onSnapshot(settingsDoc, (snap) => cb(snap.exists() ? snap.data() : {}), onError);
  },

  saveSettings(patch, actor) {
    return setDoc(settingsDoc, { ...patch, updatedAt: serverTimestamp(), updatedBy: actor.name }, { merge: true });
  },
  // The whole ads setup at once (mergeFields, so turned-off overrides go away).
  saveAdSettings(ads, actor) {
    return setDoc(
      settingsDoc,
      { ads, updatedAt: serverTimestamp(), updatedBy: actor.name },
      { mergeFields: ['ads', 'updatedAt', 'updatedBy'] },
    );
  },
  // Pretend-ad views and taps, one doc per ad, added up from every device.
  subscribeAdStats(cb) {
    return onSnapshot(
      collection(db, 'adStats'),
      (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
      () => {},
    );
  },
  bumpAdStats(counts, name) {
    const batch = writeBatch(db);
    if (name) {
      const views = Object.values(counts).reduce((t, c) => t + (c.views || 0), 0);
      const taps = Object.values(counts).reduce((t, c) => t + (c.taps || 0), 0);
      batch.set(
        doc(db, 'adPeople', personId(name)),
        { name, views: increment(Math.min(views, 2000)), taps: increment(Math.min(taps, 100)) },
        { merge: true },
      );
    }
    for (const [id, c] of Object.entries(counts)) {
      batch.set(
        doc(db, 'adStats', id),
        { views: increment(Math.min(c.views || 0, 500)), taps: increment(Math.min(c.taps || 0, 50)) },
        { merge: true },
      );
    }
    return batch.commit();
  },
  // Jackson coins ledger: spending, gifts, and Asher's bonuses.
  // On an error, keep what was there (an empty ledger would hand back every
  // coin spent and every prize claimed today).
  subscribeCoins(cb) {
    return onSnapshot(
      collection(db, 'coins'),
      (snap) => cb(snap.docs.map(readDoc)),
      (e) => console.warn('coins', e),
    );
  },
  addCoinTx(tx) {
    return setDoc(doc(collection(db, 'coins')), { ...tx, at: Date.now() });
  },
  deleteCoinTx(id) {
    return deleteDoc(doc(db, 'coins', id));
  },
  // The market and pets (functions/market.js). Perks are team management's to
  // add and change; buying, tournaments and pets go through the server:
  // market('buy' | 'joinTournament' | 'marketManage' | 'pet', data) → { ok } or { note }.
  subscribePerks(cb) {
    return onSnapshot(
      collection(db, 'perks'),
      (snap) => cb(snap.docs.map(readDoc)),
      (e) => console.warn('perks', e),
    );
  },
  savePerk(id, data, actor) {
    const ref = id ? doc(db, 'perks', id) : doc(collection(db, 'perks'));
    return setDoc(ref, { ...data, by: actor.name, ...(id ? { updatedAt: Date.now() } : { at: Date.now() }) }, { merge: true });
  },
  deletePerk(id) {
    return deleteDoc(doc(db, 'perks', id));
  },
  subscribePurchases(cb) {
    return onSnapshot(
      collection(db, 'purchases'),
      (snap) => cb(snap.docs.map(readDoc)),
      (e) => console.warn('purchases', e),
    );
  },
  subscribePets(cb) {
    return onSnapshot(
      collection(db, 'pets'),
      (snap) => cb(snap.docs.map(readDoc)),
      (e) => console.warn('pets', e),
    );
  },
  subscribeTournaments(cb) {
    return onSnapshot(
      collection(db, 'tournaments'),
      (snap) => cb(snap.docs.map(readDoc)),
      (e) => console.warn('tournaments', e),
    );
  },
  async market(fn, data) {
    const call = httpsCallable(getFunctions(app, FUNCTIONS_REGION), fn);
    return (await call(data)).data;
  },
  // What happens after an ad's booking / order (see adOrders.js); only yours.
  subscribeAdOrders(name, cb) {
    return onSnapshot(
      query(collection(db, 'adOrders'), where('by', '==', name)),
      (snap) => cb(snap.docs.map(readDoc)),
      () => cb([]),
    );
  },
  async addAdOrder(order, actor) {
    const ref = doc(collection(db, 'adOrders'));
    await setDoc(ref, { ...order, by: actor.name });
    return ref.id;
  },
  deleteAdOrder(id) {
    return deleteDoc(doc(db, 'adOrders', id));
  },
  // Ads teammates submit and book for certain dates (Asher approves them).
  subscribeAdSubmissions(cb) {
    return onSnapshot(
      collection(db, 'adSubmissions'),
      (snap) => cb(snap.docs.map(readDoc)),
      () => cb([]),
    );
  },
  submitAd(data, actor) {
    return setDoc(doc(collection(db, 'adSubmissions')), { ...data, by: actor.name, status: 'pending', note: '', at: Date.now() });
  },
  updateAdSubmission(id, patch) {
    return updateDoc(doc(db, 'adSubmissions', id), patch);
  },
  deleteAdSubmission(id) {
    return deleteDoc(doc(db, 'adSubmissions', id));
  },
  subscribeAdPeople(cb) {
    return onSnapshot(
      collection(db, 'adPeople'),
      (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.data().name, d.data()]))),
      () => cb({}),
    );
  },
  async resetAdStats() {
    const [snap, people] = await Promise.all([getDocs(collection(db, 'adStats')), getDocs(collection(db, 'adPeople'))]);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    people.docs.forEach((d) => batch.delete(d.ref));
    return batch.commit();
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
  // Resources tab: the team's links, and diagrams (diagrams/electrical).
  subscribeResources(cb, onError) {
    return onSnapshot(resourcesCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  addResource(data, actor) {
    return setDoc(doc(resourcesCol), { ...data, ...actorFields(actor), at: Date.now() });
  },
  updateResource(id, patch, actor) {
    return updateDoc(doc(resourcesCol, id), { ...patch, updatedBy: actor.name, updatedAt: Date.now() });
  },
  deleteResource(id) {
    return deleteDoc(doc(resourcesCol, id));
  },
  // Private notes you keep about teammates: notes/{your id} = { owner, notes: { [name]: text } }.
  // How far each person has read each conversation ({ [conv key]: ms }), so
  // reading on the iPad marks it read on the phone too. Only yours.
  subscribeChatReads(owner, cb, onError) {
    return onSnapshot(doc(db, 'chatReads', personId(owner)), (snap) => cb(snap.exists() ? snap.data().reads || {} : {}), onError);
  },
  saveChatReads(owner, reads) {
    return setDoc(doc(db, 'chatReads', personId(owner)), { owner, reads }, { merge: true });
  },
  subscribeNotes(owner, cb, onError) {
    return onSnapshot(doc(notesCol, personId(owner)), (snap) => cb(snap.exists() ? snap.data().notes || {} : {}), onError);
  },
  saveNote(owner, about, text) {
    return setDoc(
      doc(notesCol, personId(owner)),
      { owner, notes: { [about]: text ? text.slice(0, 500) : deleteField() } },
      { merge: true },
    );
  },
  subscribeDiagram(id, cb, onError) {
    return onSnapshot(doc(diagramsCol, id), (snap) => cb(snap.exists() ? { id, ...snap.data() } : null), onError);
  },
  saveDiagram(id, data, actor) {
    return setDoc(doc(diagramsCol, id), { ...data, updatedBy: actor.name, updatedAt: Date.now() });
  },

  subscribeChecklists(cb, onError) {
    return onSnapshot(checklistsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  // Returns the new checklist's id.
  async createChecklist(data, actor) {
    const ref = doc(checklistsCol);
    await setDoc(ref, { title: '', items: {}, ...data, createdAt: serverTimestamp(), createdBy: actor.name });
    return ref.id;
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

  subscribeRuns(cb, onError) {
    return onSnapshot(runsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  createRun(data, actor) {
    return setDoc(doc(runsCol), { ...newRunDefaults(data), createdAt: serverTimestamp(), createdBy: actor.name });
  },

  updateRun(id, patch, actor) {
    return updateDoc(doc(runsCol, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: actor.name });
  },

  deleteRun(id) {
    return deleteDoc(doc(runsCol, id));
  },

  // Competition matches (Today's pit screen). Team management keeps the
  // schedule; anyone logs our score, which is also saved as a run in the
  // match log. Writes land in the offline cache first, so this works in the pits.
  subscribeMatches(cb, onError) {
    return onSnapshot(matchesCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  // A changed label is a new id, so the old doc goes in the same write.
  saveMatch({ id, ...data }, actor, oldId = null) {
    const batch = writeBatch(db);
    if (oldId && oldId !== id) batch.delete(doc(matchesCol, oldId));
    batch.set(doc(matchesCol, id), { ...data, updatedAt: serverTimestamp(), updatedBy: actor.name }, { merge: true });
    return batch.commit();
  },
  deleteMatch(id) {
    return deleteDoc(doc(matchesCol, id));
  },
  logMatchScore(matchId, run, ours, result, actor) {
    const batch = writeBatch(db);
    const runRef = ours.runId ? doc(runsCol, ours.runId) : doc(runsCol);
    batch.set(
      runRef,
      ours.runId
        ? { ...run, updatedAt: serverTimestamp(), updatedBy: actor.name }
        : { ...newRunDefaults(run), createdAt: serverTimestamp(), createdBy: actor.name },
      { merge: true },
    );
    batch.update(doc(matchesCol, matchId), {
      ours: { ...ours, runId: runRef.id },
      result,
      updatedAt: serverTimestamp(),
      updatedBy: actor.name,
    });
    return batch.commit();
  },
  // The pit's queue countdown started by hand ({ round, at, by }), kept on
  // the "before queueing" checklist so anyone on the team can set it.
  setChecklistQueue(id, queue) {
    return updateDoc(doc(checklistsCol, id), { queue });
  },
  // Team life (functions/life.js): lab bingo ({} → your card, paying any
  // finished lines), score predictions ({ action: 'open' | 'guess' | 'lock' |
  // 'cancel', … }) and the weekly recap (team management: { action:
  // 'preview' | 'post' | 'skip' | 'unskip' }).
  async claimBingo(req) {
    return (await httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'claimBingo')(req || {})).data;
  },
  async predict(req) {
    return (await httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'predict')(req)).data;
  },
  async recap(req) {
    return (await httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'recap')(req)).data;
  },
  // Prediction rounds from the last two weeks (only the server writes them).
  subscribePredictions(cb, onError) {
    const since = Date.now() - 14 * 86400000;
    return onSnapshot(query(collection(db, 'predictions'), where('openedAt', '>=', since)), (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  // FTC Events API (functions/index.js ftcEvents): { action: 'events' } or
  // { action: 'sync', event }. Team management only.
  async ftcEvents(req) {
    const call = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'ftcEvents');
    return (await call(req)).data;
  },

  // Chat. A conversation (conv) is a channel id, or 'dm:<id>' for a direct
  // message. Messages are ordered by the sender's clock (`at`, ms) so a message
  // shows in place immediately, before the server confirms it.
  subscribeChannel(conv, count, cb, onError) {
    const q = query(convCol(conv), orderBy('at', 'desc'), limit(count));
    return onSnapshot(q, (snap) => cb(snap.docs.map(readDoc).reverse()), onError);
  },

  async loadOlderMessages(conv, beforeAt, count) {
    const snap = await getDocs(query(convCol(conv), orderBy('at', 'desc'), startAfter(beforeAt), limit(count)));
    return snap.docs.map(readDoc).reverse();
  },

  // Everything from `at` on, live: older pages on screen keep up with pins,
  // reactions, votes and edits like the newest messages do.
  subscribeSince(conv, at, cb, onError) {
    return onSnapshot(query(convCol(conv), where('at', '>=', at), orderBy('at')), (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  // The newest `count` messages, for search.
  async recentMessages(conv, count) {
    const snap = await getDocs(query(convCol(conv), orderBy('at', 'desc'), limit(count)));
    return snap.docs.map(readDoc);
  },

  async sendMessage(conv, data, actor, photoFiles) {
    const msg = { text: '', mentions: [], taskIds: [], replyTo: null, photo: null, reactions: {}, ...data };
    if (photoFiles)
      msg.photo = { ...(await uploadPhoto(convFolder(conv), photoFiles)), width: photoFiles.width, height: photoFiles.height };
    const at = Date.now();
    const batch = writeBatch(db);
    batch.set(doc(convCol(conv)), { ...msg, by: actor.name, byUid: actor.uid, at });
    // DMs keep their latest message on the DM itself, for the list.
    if (isDm(conv)) {
      const lastText =
        msg.text ||
        (msg.poll
          ? `📊 ${msg.poll.question}`
          : msg.sticker
            ? 'Sticker'
            : msg.files?.length
              ? `📎 ${msg.files[0].name}`
              : msg.gif
                ? 'GIF'
                : msg.photo
                  ? 'Photo'
                  : '');
      batch.update(doc(dmsCol, conv.slice(3)), { lastAt: at, lastBy: actor.name, lastText: lastText.slice(0, 120) });
    }
    return batch.commit();
  },

  // Animated GIFs are uploaded as-is (not shrunk to JPEG, which would freeze them).
  async uploadChatGif(conv, file) {
    const path = `${convFolder(conv)}/${itemId()}.gif`;
    const r = fileRef(storage, path);
    await uploadBytes(r, file, { contentType: 'image/gif' });
    return { path, url: await getDownloadURL(r) };
  },

  editMessage(conv, id, patch) {
    return updateDoc(doc(convCol(conv), id), { ...patch, editedAt: Date.now() });
  },

  // Leaves a "Message deleted" placeholder so replies still make sense.
  async deleteMessage(conv, msg) {
    await updateDoc(doc(convCol(conv), msg.id), {
      deleted: true,
      text: '',
      photo: null,
      gif: null,
      poll: null,
      preview: null,
      taskIds: [],
      mentions: [],
      reactions: {},
      votes: {},
      supers: {},
      sticker: null,
      files: [],
      pinned: false,
    });
    await deleteMessageFiles(msg);
  },
  // Several at once (selected in chat). hard: gone for good, with no "Message
  // deleted" note (team management only; the rules allow deleting for them).
  async deleteMessages(conv, msgs, hard) {
    if (!hard) {
      for (const m of msgs) if (!m.deleted) await this.deleteMessage(conv, m);
      return;
    }
    for (let i = 0; i < msgs.length; i += 400) {
      const batch = writeBatch(db);
      for (const m of msgs.slice(i, i + 400)) batch.delete(doc(convCol(conv), m.id));
      await batch.commit();
    }
    for (const m of msgs) await deleteMessageFiles(m);
  },

  // reactions: { [emoji]: { [uid]: name } }, updated per person so taps don't collide.
  react(conv, id, emoji, actor, on) {
    return updateDoc(doc(convCol(conv), id), new FieldPath('reactions', emoji, actor.uid), on ? actor.name : deleteField());
  },

  // Super reactions (animated): supers: { [emoji]: { [uid]: name } }.
  superReact(conv, id, emoji, actor, on) {
    return updateDoc(doc(convCol(conv), id), new FieldPath('supers', emoji, actor.uid), on ? actor.name : deleteField());
  },

  // Any file (up to 25 MB): videos, PDFs, CAD files… Returns what the message keeps.
  async uploadChatFile(conv, file, onProgress) {
    const safe = file.name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';
    const path = `files/${conv.replace(':', '-')}/${itemId()}-${safe}`;
    const r = fileRef(storage, path);
    const task = uploadBytesResumable(r, file, { contentType: file.type || 'application/octet-stream' });
    await new Promise((resolve, reject) =>
      task.on('state_changed', (s) => onProgress?.(s.bytesTransferred / s.totalBytes), reject, resolve),
    );
    return { name: file.name.slice(0, 120), size: file.size, type: file.type || '', url: await getDownloadURL(r), path };
  },

  removeReaction(conv, id, emoji) {
    return updateDoc(doc(convCol(conv), id), new FieldPath('reactions', emoji), deleteField());
  },
  removeSuperReaction(conv, id, emoji) {
    return updateDoc(doc(convCol(conv), id), new FieldPath('supers', emoji), deleteField());
  },

  // Polls: votes: { [optionId]: { [personKey]: name } }. One vote per person
  // (not per device); single-choice polls clear the person's other votes.
  vote(conv, msg, optionId, actor, on) {
    const me = personId(actor.name);
    const args = [new FieldPath('votes', optionId, me), on ? actor.name : deleteField()];
    if (on && !msg.poll.multi)
      for (const o of msg.poll.options)
        if (o.id !== optionId && msg.votes?.[o.id]?.[me]) args.push(new FieldPath('votes', o.id, me), deleteField());
    return updateDoc(doc(convCol(conv), msg.id), ...args);
  },

  // A written-answer poll: votes.text[person] = { name, text, at } (empty text removes it).
  answerPoll(conv, msg, text, actor) {
    const me = personId(actor.name);
    return updateDoc(
      doc(convCol(conv), msg.id),
      new FieldPath('votes', 'text', me),
      text ? { name: actor.name, text, at: Date.now() } : deleteField(),
    );
  },

  pin(conv, id, on, actor) {
    return updateDoc(doc(convCol(conv), id), { pinned: on, pinnedBy: on ? actor.name : '', pinnedAt: on ? Date.now() : 0 });
  },

  subscribePins(conv, cb, onError) {
    return onSnapshot(query(convCol(conv), where('pinned', '==', true)), (snap) => cb(snap.docs.map(readDoc)), onError);
  },

  // The author can hide a link preview.
  hidePreview(conv, id) {
    return updateDoc(doc(convCol(conv), id), { preview: false });
  },

  // Channels team management added, renamed, or removed (defaults are in config.js).
  subscribeChannels(cb, onError) {
    return onSnapshot(channelsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  saveChannel(id, data, actor) {
    return setDoc(doc(channelsCol, id), { ...data, updatedAt: Date.now(), updatedBy: actor.name }, { merge: true });
  },

  // Direct messages. 1-on-1 DMs have a fixed id so there's only ever one per pair.
  subscribeDms(actor, all, cb, onError) {
    const q = all ? dmsCol : query(dmsCol, where('people', 'array-contains', actor.name));
    return onSnapshot(q, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  async openDm(people, actor, name = '') {
    const sorted = [...new Set(people)].sort();
    const id = sorted.length === 2 ? sorted.map(personId).join('--') : itemId();
    const ref = doc(dmsCol, id);
    const existing = await getDoc(ref).catch(() => null);
    if (!existing?.exists())
      await setDoc(ref, {
        people: sorted,
        name,
        createdBy: actor.name,
        createdAt: Date.now(),
        lastAt: Date.now(),
        lastBy: '',
        lastText: '',
      });
    return `dm:${id}`;
  },
  renameDm(id, name) {
    return updateDoc(doc(dmsCol, id), { name });
  },

  // Profiles: picture, status, and notification settings, one doc per person.
  subscribeProfiles(cb, onError) {
    return onSnapshot(profilesCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  // /ping: one round trip to the server.
  async ping() {
    const t = performance.now();
    await getDocFromServer(doc(db, 'settings', 'team')).catch(() => {});
    return Math.round(performance.now() - t);
  },
  // The casino and economy (slash commands): the play function rolls,
  // checks balances, and posts the result. Returns { ok } or { note }.
  async play(req) {
    const call = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'play');
    return (await call(req)).data;
  },
  subscribeBank(cb) {
    return onSnapshot(
      collection(db, 'bank'),
      (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.data().name, d.data()]))),
      (e) => console.warn('bank', e),
    );
  },
  subscribeLottery(cb) {
    return onSnapshot(
      doc(db, 'lottery', 'current'),
      (snap) => cb(snap.data() || null),
      () => cb(null),
    );
  },
  // Asher's switches (settings/controls, controls.js): tabs, channels, and
  // features that are off for everyone but him.
  subscribeControls(cb) {
    return onSnapshot(
      doc(db, 'settings', 'controls'),
      (snap) => cb(snap.data() || {}),
      () => {},
    );
  },
  saveControls(patch, actor) {
    return setDoc(doc(db, 'settings', 'controls'), { ...patch, by: actor.name, updatedAt: Date.now() }, { merge: true });
  },
  // Asher's switch that shuts the app down for everyone else (settings/shutdown),
  // and what people write back from the shutdown screen (shutdownReplies).
  subscribeShutdown(cb) {
    return onSnapshot(
      doc(db, 'settings', 'shutdown'),
      (snap) => cb(snap.data() || null),
      () => {},
    );
  },
  setShutdown(data, actor) {
    return setDoc(doc(db, 'settings', 'shutdown'), { ...data, by: actor.name, updatedAt: Date.now() });
  },
  // A message in someone's shutdown chat with Asher: person is whose chat it
  // is (the teammate), name is who wrote it.
  sendShutdownReply(text, round, actor, person = actor.name) {
    return setDoc(doc(collection(db, 'shutdownReplies')), { text, round, person, name: actor.name, byUid: actor.uid, at: Date.now() });
  },
  subscribeShutdownThread(person, cb) {
    return onSnapshot(
      query(collection(db, 'shutdownReplies'), where('person', '==', person)),
      (snap) => cb(snap.docs.map(readDoc).sort((a, b) => a.at - b.at)),
      () => cb([]),
    );
  },
  subscribeShutdownReplies(cb) {
    return onSnapshot(
      query(collection(db, 'shutdownReplies'), orderBy('at', 'desc'), limit(300)),
      (snap) => cb(snap.docs.map(readDoc)),
      () => cb([]),
    );
  },
  deleteShutdownReply(id) {
    return deleteDoc(doc(db, 'shutdownReplies', id));
  },
  // /remind: the reminders function sends it to your 🔔 (and phone) when it's time.
  addReminder({ at, text, conv }, actor) {
    return setDoc(doc(collection(db, 'reminders')), { by: actor.name, at, text, conv: conv || '', created: Date.now() });
  },
  saveProfile(name, patch) {
    return setDoc(doc(profilesCol, personId(name)), { ...patch, name, updatedAt: Date.now() }, { merge: true });
  },
  // Pictures are cropped JPEGs, or GIFs kept as they are (animated).
  async uploadAvatar(name, blob, oldPath) {
    const gif = blob.type === 'image/gif';
    const path = `avatars/${personId(name)}-${itemId()}.${gif ? 'gif' : 'jpg'}`;
    const r = fileRef(storage, path);
    await uploadBytes(r, blob, { contentType: gif ? 'image/gif' : 'image/jpeg' });
    const photo = { url: await getDownloadURL(r), path };
    await this.saveProfile(name, { photo });
    if (oldPath) await deleteObject(fileRef(storage, oldPath)).catch(() => {});
    return photo;
  },
  async uploadBanner(name, blob, oldPath) {
    const gif = blob.type === 'image/gif';
    const path = `banners/${personId(name)}-${itemId()}.${gif ? 'gif' : 'jpg'}`;
    const r = fileRef(storage, path);
    await uploadBytes(r, blob, { contentType: gif ? 'image/gif' : 'image/jpeg' });
    const banner = { url: await getDownloadURL(r), path };
    await this.saveProfile(name, { banner });
    if (oldPath) await deleteObject(fileRef(storage, oldPath)).catch(() => {});
  },
  // A custom profile effect's picture (PNG/GIF/WebP/JPEG, shrunk first).
  async uploadEffectImage(name, file, oldPath) {
    const ext = { 'image/gif': 'gif', 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg';
    const path = `effects/${personId(name)}-${itemId()}.${ext}`;
    const r = fileRef(storage, path);
    await uploadBytes(r, file, { contentType: file.type || 'image/png' });
    if (oldPath) await deleteObject(fileRef(storage, oldPath)).catch(() => {});
    return { url: await getDownloadURL(r), path };
  },
  // A picture or GIF for an ad (Asher's own or a teammate's booked spot).
  async uploadAdImage(name, blob) {
    const gif = blob.type === 'image/gif';
    const r = fileRef(storage, `adpics/${personId(name)}-${itemId()}.${gif ? 'gif' : 'jpg'}`);
    await uploadBytes(r, blob, { contentType: gif ? 'image/gif' : 'image/jpeg' });
    return getDownloadURL(r);
  },
  async removeBanner(name, oldPath) {
    await this.saveProfile(name, { banner: null });
    if (oldPath) await deleteObject(fileRef(storage, oldPath)).catch(() => {});
  },
  async removeAvatar(name, oldPath) {
    await this.saveProfile(name, { photo: null });
    if (oldPath) await deleteObject(fileRef(storage, oldPath)).catch(() => {});
  },

  // Who's online: each device writes a heartbeat (and what it's typing in).
  subscribePresence(cb, onError) {
    return onSnapshot(presenceCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  setPresence(actor, patch) {
    return setDoc(doc(presenceCol, actor.uid), { name: actor.name, ...patch }, { merge: true });
  },

  // Team stickers, sent as their own message.
  subscribeStickers(cb, onError) {
    return onSnapshot(stickersCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  async addSticker(name, file, actor) {
    const ext = { 'image/gif': 'gif', 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg';
    const ref = doc(stickersCol);
    const path = `stickers/${ref.id}.${ext}`;
    const r = fileRef(storage, path);
    await uploadBytes(r, file, { contentType: file.type || 'image/png' });
    await setDoc(ref, { name, url: await getDownloadURL(r), path, by: actor.name, at: Date.now() });
  },
  async deleteSticker(s) {
    await deleteDoc(doc(stickersCol, s.id));
    await deleteObject(fileRef(storage, s.path)).catch(() => {});
  },

  // Feature requests: anyone sends one and adds 👍; team management sets the
  // status and replies.
  subscribeRequests(cb, onError) {
    return onSnapshot(requestsCol, (snap) => cb(snap.docs.map(readDoc).sort((a, b) => b.at - a.at)), onError);
  },
  addRequest(text, actor, kind = '') {
    return setDoc(doc(requestsCol), { text, ...actorFields(actor), at: Date.now(), status: 'new', votes: {}, ...(kind ? { kind } : {}) });
  },
  updateRequest(id, patch, actor) {
    return updateDoc(doc(requestsCol, id), { ...patch, updatedBy: actor.name, updatedAt: Date.now() });
  },
  // vote: 'up' (👍), 'down' (👎), or null (neither). One at a time.
  voteRequest(id, name, vote) {
    return updateDoc(
      doc(requestsCol, id),
      new FieldPath('votes', name),
      vote === 'up' ? true : deleteField(),
      new FieldPath('downvotes', name),
      vote === 'down' ? true : deleteField(),
    );
  },
  deleteRequest(id) {
    return deleteDoc(doc(requestsCol, id));
  },

  // Shifts: clock in/out (start and end in ms; end is null while running).
  // The lab log (labLog.js): logs from sinceDay on.
  subscribeLabLogs(sinceDay, cb, onError) {
    return onSnapshot(query(labLogsCol, where('day', '>=', sinceDay)), (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  // One log per person per day; the onLabLog function keeps #lab-log's post up to date.
  saveLabLog(id, log, actor) {
    return setDoc(doc(labLogsCol, id), { ...log, updatedAt: Date.now(), updatedBy: actor.name }, { merge: true });
  },
  // A photo for a lab log (already shrunk by preparePhoto), kept with #lab-log's photos.
  async uploadLabPhoto(prepared) {
    const up = await uploadPhoto(convFolder('lab-log'), prepared);
    return { url: up.url, thumbUrl: up.thumbUrl, path: up.path || '', width: prepared.width, height: prepared.height };
  },
  // A voice note (up to 30 s), named after the person so only they or team
  // management can remove it (storage.rules).
  async uploadLabVoice(blob, ms, actor) {
    const type = (blob.type || 'audio/mp4').split(';')[0];
    const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac' }[type] || 'm4a';
    const path = `voice/${personId(actor.name)}-${itemId()}.${ext}`;
    const r = fileRef(storage, path);
    await uploadBytes(r, blob, { contentType: type });
    return { url: await getDownloadURL(r), path, type, ms: Math.round(ms) };
  },
  deleteLabVoice(voice) {
    return voice?.path ? deleteObject(fileRef(storage, voice.path)).catch(() => {}) : Promise.resolve();
  },
  // How often the team uses each suggestion chip (ids from labLog.js CHIPS),
  // so the common ones come first.
  subscribeLabChips(cb) {
    return onSnapshot(
      doc(db, 'labChips', 'counts'),
      (snap) => cb(snap.data()?.counts || {}),
      () => cb({}),
    );
  },
  bumpLabChips(ids) {
    if (!ids.length) return Promise.resolve();
    return setDoc(
      doc(db, 'labChips', 'counts'),
      { counts: Object.fromEntries(ids.map((id) => [id, increment(1)])), updatedAt: Date.now() },
      { merge: true },
    ).catch(() => {});
  },
  // Tasks you opened, moved or commented on today (labLog.js): picked for you
  // in today's log, on any of your devices.
  async getLabTouches(day, name) {
    try {
      const snap = await getDoc(doc(db, 'labTouches', `${day}_${personId(name)}`));
      return snap.data()?.taskIds || [];
    } catch {
      return [];
    }
  },
  addLabTouch(day, name, taskId) {
    return setDoc(
      doc(db, 'labTouches', `${day}_${personId(name)}`),
      { day, person: name, taskIds: arrayUnion(taskId), at: Date.now() },
      { merge: true },
    ).catch(() => {});
  },

  subscribeShifts(cb, onError) {
    return onSnapshot(shiftsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  startShifts(people, start, extra, actor) {
    const batch = writeBatch(db);
    for (const person of people)
      batch.set(doc(shiftsCol), {
        person,
        start,
        end: null,
        note: '',
        subteam: '',
        taskIds: [],
        ...extra,
        ...actorFields(actor),
        at: Date.now(),
      });
    return batch.commit();
  },
  updateShift(id, patch, actor) {
    return updateDoc(doc(shiftsCol, id), { ...patch, updatedBy: actor.name });
  },
  deleteShift(id) {
    return deleteDoc(doc(shiftsCol, id));
  },
  // Changes to finished shifts, each written down in shiftEdits (who, when,
  // the times before and after) in the same batch. `shift` is the shift as
  // saved (its person under the name it was saved with). A teammate's own
  // records have ids the rules check: <shift>_<editCount> and <shift>_del.
  subscribeShiftEdits(cb, onError) {
    return onSnapshot(query(shiftEditsCol, orderBy('at', 'desc'), limit(200)), (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  // Shorter (teammates) or anything (team management): patch has start/end and any details.
  editShift(shift, patch, kind, actor, requestId) {
    const n = (shift.editCount || 0) + 1;
    const at = Date.now();
    const batch = writeBatch(db);
    batch.update(doc(shiftsCol, shift.id), { ...patch, editCount: n, editedAt: at, editedBy: actor.name, updatedBy: actor.name });
    const edit = editRecord(shift, kind, { start: patch.start ?? shift.start, end: patch.end ?? shift.end }, actor, at, requestId);
    batch.set(kind === 'shorten' ? doc(shiftEditsCol, `${shift.id}_${n}`) : doc(shiftEditsCol), edit);
    return batch.commit();
  },
  removeShift(shift, actor) {
    const batch = writeBatch(db);
    batch.delete(doc(shiftsCol, shift.id));
    batch.set(doc(shiftEditsCol, `${shift.id}_del`), editRecord(shift, 'delete', null, actor, Date.now()));
    return batch.commit();
  },
  // Team management adding a missed shift for someone.
  addShift(data, actor) {
    const ref = doc(shiftsCol);
    const at = Date.now();
    const batch = writeBatch(db);
    batch.set(ref, { note: '', subteam: '', taskIds: [], ...data, ...actorFields(actor), at });
    batch.set(doc(shiftEditsCol), editRecord({ id: ref.id, person: data.person }, 'add', { start: data.start, end: data.end }, actor, at));
    return batch.commit();
  },
  // Asking for a missed shift or a longer one; team management decides.
  subscribeShiftRequests(cb, onError) {
    return onSnapshot(shiftRequestsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  requestShift(req, actor) {
    return setDoc(doc(shiftRequestsCol), { ...req, status: 'pending', ...actorFields(actor), at: Date.now() });
  },
  cancelShiftRequest(id) {
    return deleteDoc(doc(shiftRequestsCol, id));
  },
  // Approving adds the shift (or makes it longer) and writes it down, in one batch.
  // shift: the shift a longer-shift request is for, as saved now (null if it's gone).
  async decideShiftRequest(req, approve, shift, actor) {
    const at = Date.now();
    const batch = writeBatch(db);
    batch.update(doc(shiftRequestsCol, req.id), { status: approve ? 'approved' : 'declined', decidedBy: actor.name, decidedAt: at });
    if (approve) {
      const span = { start: req.start, end: req.end };
      if (req.kind === 'extend' && shift) {
        batch.update(doc(shiftsCol, shift.id), { ...span, editCount: (shift.editCount || 0) + 1, editedAt: at, editedBy: actor.name, updatedBy: actor.name });
        batch.set(doc(shiftEditsCol), editRecord(shift, 'approve', span, actor, at, req.id));
      } else {
        const ref = doc(shiftsCol);
        const details = { note: req.note || '', subteam: req.subteam || '', taskIds: req.taskIds || [] };
        batch.set(ref, { person: req.person, ...span, ...details, ...actorFields(actor), at });
        batch.set(doc(shiftEditsCol), editRecord({ id: ref.id, person: req.person }, 'approve', span, actor, at, req.id));
      }
    }
    return batch.commit();
  },
  // Lab check-ins: team management asks who's coming (lunch / after school);
  // everyone answers for themselves.
  subscribeCheckins(cb, onError) {
    return onSnapshot(checkinsCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  addCheckin(data, actor) {
    return setDoc(doc(checkinsCol), { ...data, answers: {}, ...actorFields(actor), at: Date.now() });
  },
  answerCheckin(id, name, answer) {
    return updateDoc(doc(checkinsCol, id), new FieldPath('answers', name), { ...answer, at: Date.now() });
  },
  deleteCheckin(id) {
    return deleteDoc(doc(checkinsCol, id));
  },
  // Undo for "Not today": the check-in put back as it was.
  restoreCheckin(c) {
    const { id, ...data } = c;
    return setDoc(doc(checkinsCol, id), data);
  },
  // The schedule: planned shifts people can sign up for.
  subscribeShiftPlans(cb, onError) {
    return onSnapshot(shiftPlansCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  addShiftPlans(plans, actor) {
    const batch = writeBatch(db);
    for (const p of plans) batch.set(doc(shiftPlansCol), { ...p, people: {}, createdBy: actor.name, at: Date.now() });
    return batch.commit();
  },
  updateShiftPlan(id, patch, actor) {
    return updateDoc(doc(shiftPlansCol, id), { ...patch, updatedBy: actor.name });
  },
  // oldKeys: answers saved under this person's old names, replaced by this one.
  // The rules only let people touch their first and current names, so if
  // clearing an older one is refused, just save the answer.
  async rsvpShiftPlan(id, name, answer, oldKeys = []) {
    const ref = doc(shiftPlansCol, id);
    const value = answer || deleteField();
    if (oldKeys.length) {
      try {
        return await updateDoc(ref, new FieldPath('people', name), value, ...oldKeys.flatMap((k) => [new FieldPath('people', k), deleteField()]));
      } catch (e) {
        if (e?.code !== 'permission-denied') throw e;
      }
    }
    return updateDoc(ref, new FieldPath('people', name), value);
  },
  deleteShiftPlans(ids) {
    const batch = writeBatch(db);
    for (const id of ids) batch.delete(doc(shiftPlansCol, id));
    return batch.commit();
  },

  // Team emoji, used as :name: in messages and reactions.
  subscribeEmoji(cb, onError) {
    return onSnapshot(emojiCol, (snap) => cb(snap.docs.map(readDoc)), onError);
  },
  async addEmoji(name, file, actor) {
    const ext = { 'image/gif': 'gif', 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg';
    const path = `emoji/${name}-${itemId()}.${ext}`;
    const r = fileRef(storage, path);
    await uploadBytes(r, file, { contentType: file.type || 'image/png' });
    await setDoc(doc(emojiCol, name), { name, url: await getDownloadURL(r), path, by: actor.name, at: Date.now() });
  },
  async deleteEmoji(e) {
    await deleteDoc(doc(emojiCol, e.id));
    await deleteObject(fileRef(storage, e.path)).catch(() => {});
  },

  // Robot tab: 3D model versions (files in Storage), pins, and sandbox layouts.
  subscribeRobot(cb, onError) {
    const state = { versions: [], pins: [], layouts: [] };
    const sub = (col, field) =>
      onSnapshot(
        col,
        (snap) => {
          state[field] = snap.docs.map(readDoc);
          cb({ ...state });
        },
        onError,
      );
    const stops = [sub(robotVersionsCol, 'versions'), sub(robotPinsCol, 'pins'), sub(robotLayoutsCol, 'layouts')];
    return () => stops.forEach((s) => s());
  },

  async uploadRobotVersion(file, meta, actor, onProgress) {
    const ref = doc(robotVersionsCol);
    const ext = /\.gltf$/i.test(file.name) ? 'gltf' : 'glb';
    const path = `robot/${ref.id}.${ext}`;
    const r = fileRef(storage, path);
    const task = uploadBytesResumable(r, file, { contentType: ext === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary' });
    await new Promise((resolve, reject) =>
      task.on('state_changed', (s) => onProgress?.(s.bytesTransferred / s.totalBytes), reject, resolve),
    );
    const url = await getDownloadURL(r);
    await setDoc(ref, { ...meta, path, url, size: file.size, by: actor.name, byUid: actor.uid, at: Date.now() });
  },

  async deleteRobotVersion(version, pins, layouts) {
    const batch = writeBatch(db);
    batch.delete(doc(robotVersionsCol, version.id));
    for (const p of pins) batch.delete(doc(robotPinsCol, p.id));
    for (const l of layouts) batch.delete(doc(robotLayoutsCol, l.id));
    await batch.commit();
    if (version.path) await deleteObject(fileRef(storage, version.path)).catch(() => {});
  },

  createRobotPin(data, actor) {
    return setDoc(doc(robotPinsCol), {
      resolved: false,
      taskId: '',
      partId: '',
      ...data,
      by: actor.name,
      byUid: actor.uid,
      at: Date.now(),
    });
  },
  updateRobotPin(id, patch) {
    return updateDoc(doc(robotPinsCol, id), patch);
  },
  deleteRobotPin(id) {
    return deleteDoc(doc(robotPinsCol, id));
  },

  saveRobotLayout(data, actor) {
    return setDoc(doc(robotLayoutsCol), { ...data, by: actor.name, byUid: actor.uid, at: Date.now() });
  },
  deleteRobotLayout(id) {
    return deleteDoc(doc(robotLayoutsCol, id));
  },
};
