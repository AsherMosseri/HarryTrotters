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
import { firebaseConfig, VAPID_KEY } from '../config.js';
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
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
// Name changes made by managers; readable before joining so the join screen is current.
const namesDoc = doc(db, 'settings', 'names');
const partsCol = collection(db, 'parts');
const checklistsCol = collection(db, 'checklists');
const runsCol = collection(db, 'runs');
const channelsCol = collection(db, 'channels');
const dmsCol = collection(db, 'dms');
const profilesCol = collection(db, 'profiles');
const presenceCol = collection(db, 'presence');
const emojiCol = collection(db, 'emoji');
const stickersCol = collection(db, 'stickers');
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
  async leave() {
    // Stop sending this person's notifications to a device they've left.
    const token = savedToken();
    if (token) await deleteDoc(doc(pushTokensCol, token)).catch(() => {});
    saveToken('');
    if (auth.currentUser) await deleteDoc(doc(presenceCol, auth.currentUser.uid)).catch(() => {});
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
    const support = pushSupport();
    if (support !== 'ok') return support;
    if (Notification.permission === 'denied') return 'blocked';
    return Notification.permission === 'granted' && savedToken() ? 'on' : 'off';
  },
  // Call straight from a tap: Safari only shows the permission prompt then.
  async enablePush(actor) {
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
    if (msg.photo) await deletePhotoFiles(msg.photo);
    for (const f of msg.files || []) await deleteObject(fileRef(storage, f.path)).catch(() => {});
    if (msg.gif?.path) await deleteObject(fileRef(storage, msg.gif.path)).catch(() => {});
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
