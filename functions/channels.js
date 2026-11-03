// Channel requests: anyone on the team can ask for a channel; team management
// approves (maybe with edits) or declines. Everything that writes goes through
// here, so the limits can't be skipped and approving makes the channel, its
// members and its first message in one step. The rules only let people read
// their own requests (and team management read all of them).
//
// Callable channelRequest({ action, … }):
//   request  { name, purpose, kind, invitees }        anyone: ask for a channel
//   cancel   { id }                                   the person who asked
//   approve  { id, name?, kind?, invitees? }          team management (edits are optional)
//   decline  { id, note? }                            team management
// Trigger channelRenames keeps names in requests and private member lists
// current when someone is renamed (settings/names).
//
// Shapes and checks: functions/shared/channels.js.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { ROSTER, memberOk, nameKey, onTeam, sameName } from './shared/team.js';
import { teamDay } from './shared/coins.js';
import {
  checkRequest,
  cleanNote,
  createdText,
  freeId,
  limitError,
  takenNames,
  usedIds,
} from './shared/channels.js';

const OPEN = { maxInstances: 5, invoker: 'public' };
const first = (n) => (n || 'Someone').split(' ')[0];
const clip = (text, n = 140) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

export function channelFunctions({ db, renamer, notify, owner }) {
  // The caller: a password member, under their current name.
  async function caller(req) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const member = await db.doc(`members/${uid}`).get();
    if (!memberOk(member.data())) throw new HttpsError('permission-denied', 'Sign in first.');
    const rename = await renamer();
    const me = rename(member.get('name'));
    // Asher's Controls: switched off means nobody but him uses it.
    if (me !== owner) {
      const controls = (await db.doc('settings/controls').get()).data() || {};
      if ((controls.off || []).includes('channelRequests')) throw new HttpsError('failed-precondition', 'Channel requests are switched off right now.');
    }
    return { uid, me, rename, admin: member.get('admin') === true };
  }
  // Names on the team now (for invitees), under their current spellings.
  async function knownNames(rename) {
    const [roles, people] = await Promise.all([db.collection('roles').get(), db.collection('people').get()]);
    const rs = roles.docs.map((d) => d.data());
    const ps = people.docs.map((d) => d.data());
    const names = new Set(ROSTER.map(rename));
    for (const r of rs) if (r.name && !r.removed) names.add(rename(r.name));
    for (const p of ps) if (p.name) names.add(rename(p.name));
    return [...names].filter((n) => onTeam(n, { rename, roles: rs, people: ps }));
  }
  async function managerNames(rename) {
    const snap = await db.collection('members').where('admin', '==', true).get();
    return [...new Set(snap.docs.filter((d) => memberOk(d.data())).map((d) => rename(d.get('name') || '')).filter(Boolean))];
  }
  const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const bad = (message) => new HttpsError('invalid-argument', message);

  async function ask({ me, uid, rename }, data) {
    const known = await knownNames(rename);
    const aliases = rename.aliases(me).slice(0, 10);
    const now = Date.now();
    const ref = db.collection('channelRequests').doc();
    const value = await db.runTransaction(async (tx) => {
      const [channels, privates, requests, mine] = await Promise.all([
        tx.get(db.collection('channels')),
        tx.get(db.collection('privateChannels')),
        tx.get(db.collection('channelRequests').where('status', '==', 'pending')),
        tx.get(db.collection('channelRequests').where('by', 'in', aliases)),
      ]);
      const limit = limitError(docs(mine), now, teamDay);
      if (limit) throw new HttpsError('resource-exhausted', limit);
      const checked = checkRequest(data, {
        me,
        known,
        taken: takenNames({ channels: docs(channels), privates: docs(privates), requests: docs(requests) }),
      });
      if (checked.error) throw bad(checked.error);
      const v = checked.value;
      tx.set(ref, { ...v, by: me, byUid: uid, at: now, status: 'pending', decidedBy: '', decidedAt: null, note: '', channelId: '' });
      return v;
    });
    // Team management hears about it (the bell, and a push).
    const managers = (await managerNames(rename)).filter((n) => n !== me);
    await notify(
      managers.map((to) => ({
        to,
        type: 'channelRequest',
        title: `${first(me)} asked for #${value.name}`,
        body: clip(value.purpose),
        open: 'channels:requests',
        by: me,
      })),
    );
    return { ok: true, id: ref.id };
  }

  async function cancel({ me, uid, rename }, data) {
    const ref = db.doc(`channelRequests/${String(data.id || '')}`);
    await db.runTransaction(async (tx) => {
      const r = await tx.get(ref);
      if (!r.exists) throw new HttpsError('not-found', 'That request is gone.');
      if (r.get('byUid') !== uid && !sameName(rename(r.get('by') || ''), me)) throw new HttpsError('permission-denied', 'That isn’t your request.');
      if (r.get('status') !== 'pending') throw new HttpsError('failed-precondition', `It was already ${r.get('status')}.`);
      tx.update(ref, { status: 'cancelled', decidedBy: me, decidedAt: Date.now() });
    });
    return { ok: true };
  }

  async function approve({ me, rename, admin }, data) {
    if (!admin) throw new HttpsError('permission-denied', 'Only team management decides.');
    const ref = db.doc(`channelRequests/${String(data.id || '')}`);
    const known = await knownNames(rename);
    const now = Date.now();
    const result = await db.runTransaction(async (tx) => {
      const [r, channels, privates] = await Promise.all([
        tx.get(ref),
        tx.get(db.collection('channels')),
        tx.get(db.collection('privateChannels')),
      ]);
      if (!r.exists) throw new HttpsError('not-found', 'That request is gone.');
      if (r.get('status') !== 'pending') throw new HttpsError('failed-precondition', `It was already ${r.get('status')}.`);
      const requester = rename(r.get('by') || '');
      const edited = {
        name: data.name ?? r.get('name'),
        purpose: r.get('purpose'),
        kind: data.kind ?? r.get('kind'),
        invitees: (data.invitees ?? r.get('invitees') ?? []).map(rename),
      };
      const chans = docs(channels);
      const privs = docs(privates);
      const checked = checkRequest(edited, { me: requester, known, taken: takenNames({ channels: chans, privates: privs }) });
      if (checked.error) throw new HttpsError('already-exists', checked.error);
      const v = checked.value;
      const id = freeId(v.name, usedIds({ channels: chans, privates: privs }));
      // After the defaults and anything team management ordered by hand.
      const order = Math.max(20, ...[...chans, ...privs].map((c) => (typeof c.order === 'number' ? c.order : 0))) + 1;
      const members = [requester, ...v.invitees];
      const channel = {
        name: v.name,
        topic: v.purpose,
        subteam: '',
        order,
        deleted: false,
        createdBy: requester,
        requestId: ref.id,
        updatedAt: now,
        updatedBy: me,
      };
      tx.set(db.doc(`${v.kind === 'private' ? 'privateChannels' : 'channels'}/${id}`), v.kind === 'private' ? { ...channel, members } : channel);
      // The first message, from Trotbot (like the lab log posts).
      tx.set(db.collection(`channels/${id}/messages`).doc(), {
        text: createdText(requester, v.purpose, v.kind, members.length),
        by: 'Trotbot',
        byUid: 'trotbot',
        bot: true,
        at: now,
        mentions: [],
        taskIds: [],
        replyTo: null,
        reactions: {},
        photo: null,
      });
      tx.update(ref, {
        status: 'approved',
        name: v.name,
        kind: v.kind,
        invitees: v.invitees,
        decidedBy: me,
        decidedAt: now,
        note: '',
        channelId: id,
      });
      return { id, requester, v };
    });
    await notify([
      {
        to: result.requester,
        type: 'channelRequest',
        title: `Your channel #${result.v.name} was approved`,
        body: result.v.kind === 'private' ? 'It’s private: only the people you invited can see it.' : 'It’s ready in your channel list.',
        open: `chat:${result.id}`,
        by: me,
      },
    ]);
    return { ok: true, channelId: result.id };
  }

  async function decline({ me, rename, admin }, data) {
    if (!admin) throw new HttpsError('permission-denied', 'Only team management decides.');
    const ref = db.doc(`channelRequests/${String(data.id || '')}`);
    const note = cleanNote(data.note);
    const r = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'That request is gone.');
      if (snap.get('status') !== 'pending') throw new HttpsError('failed-precondition', `It was already ${snap.get('status')}.`);
      tx.update(ref, { status: 'declined', decidedBy: me, decidedAt: Date.now(), note });
      return snap.data();
    });
    await notify([
      {
        to: rename(r.by || ''),
        type: 'channelRequest',
        title: `Your channel request for #${r.name} was declined`,
        body: note ? `${first(me)}: ${note}` : 'Ask team management if you want to know more.',
        open: '',
        by: me,
      },
    ]);
    return { ok: true };
  }

  const channelRequest = onCall(OPEN, async (req) => {
    const who = await caller(req);
    const data = req.data || {};
    switch (data.action) {
      case 'request':
        return ask(who, data);
      case 'cancel':
        return cancel(who, data);
      case 'approve':
        return approve(who, data);
      case 'decline':
        return decline(who, data);
      default:
        throw bad('Unknown action.');
    }
  });

  // A rename (settings/names): requests and private member lists follow it, so
  // the person keeps their channels and sees their requests under the new name.
  const channelRenames = onDocumentWritten('settings/names', async (event) => {
    const before = event.data?.before?.get('renames') || {};
    const after = event.data?.after?.get('renames') || {};
    const moved = Object.entries(after).filter(([from, to]) => to && before[from] !== to && nameKey(from) !== nameKey(to));
    if (!moved.length) return;
    const rename = await renamer();
    for (const [from] of moved) {
      const to = rename(from);
      const [privs, asked, invited] = await Promise.all([
        db.collection('privateChannels').where('members', 'array-contains', from).get(),
        db.collection('channelRequests').where('by', '==', from).get(),
        db.collection('channelRequests').where('invitees', 'array-contains', from).get(),
      ]);
      const batch = db.batch();
      const swap = (list) => [...new Set((list || []).map((n) => (n === from ? to : n)))];
      for (const d of privs.docs) batch.update(d.ref, { members: swap(d.get('members')) });
      for (const d of asked.docs) batch.update(d.ref, { by: to });
      for (const d of invited.docs) batch.update(d.ref, { invitees: swap(d.get('invitees')) });
      await batch.commit();
      logger.info('channel names followed rename', from, '→', to, privs.size + asked.size + invited.size);
    }
  });

  return { channelRequest, channelRenames };
}
