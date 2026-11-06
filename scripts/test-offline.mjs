// Working offline (3.2.8): what can't wait offline (src/data/needsServer.js)
// against the real store, demo mode's pretend offline, the count of changes
// waiting to send, and what the offline strip says (src/connection.js).
// Run: node scripts/test-offline.mjs
import { readFileSync } from 'node:fs';

// connection.js keeps its count in localStorage: a small stand-in.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const { SERVER_CALLS, COIN_WRITES, FILE_CALLS, offlineKind, offlineStore } = await import('../src/data/needsServer.js');
const net = await import('../src/connection.js');

let failures = 0;
let passes = 0;
const eq = (got, want, msg) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++;
  else failures++;
  console.log(ok ? 'PASS' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------- the lists match firebaseStore.js ----------
const src = readFileSync(new URL('../src/data/firebaseStore.js', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export const firebaseStore = {'));
const methods = [...body.matchAll(/^ {2}(?:async )?([a-zA-Z0-9_]+)\(/gm)].map((m, i, all) => ({
  name: m[1],
  code: body.slice(m.index, all[i + 1]?.index ?? body.length),
}));
const names = methods.map((m) => m.name);
const calling = methods.filter((m) => /callable\(|callLearn\(/.test(m.code)).map((m) => m.name);
eq(calling.filter((n) => !SERVER_CALLS.includes(n)), [], 'every server call in firebaseStore is in SERVER_CALLS');
eq(SERVER_CALLS.filter((n) => !calling.includes(n)), [], 'SERVER_CALLS are all server calls in firebaseStore');
const uploading = methods.filter((m) => /uploadBytes|uploadPhoto\(|uploadBytesResumable/.test(m.code)).map((m) => m.name);
eq(FILE_CALLS.filter((n) => !uploading.includes(n)), [], 'FILE_CALLS all upload in firebaseStore');
eq(
  uploading.filter((n) => !FILE_CALLS.includes(n) && n !== 'sendMessage'),
  [],
  'every upload in firebaseStore is in FILE_CALLS (sendMessage only with a photo)',
);
for (const n of COIN_WRITES) eq(/coinWrite\(/.test(methods.find((m) => m.name === n)?.code || ''), true, `${n} is refused offline in firebaseStore`);
// Every write goes through the wrappers that count it (and don't wait offline).
const raw = src.split('\n').filter((l) => /\bfs(SetDoc|UpdateDoc|DeleteDoc)\(/.test(l) && !/^const (setDoc|updateDoc|deleteDoc|quietSetDoc) =/.test(l));
eq(raw, [], 'no raw setDoc/updateDoc/deleteDoc outside the wrappers');
const rawBatch = src.split('\n').filter((l) => /fsWriteBatch\(/.test(l));
eq(rawBatch.length, 2, 'raw batches: only the wrapper and sendMessage');
eq(/const sent = trackWrite\(batch\.commit\(\)\)/.test(src), true, 'sendMessage counts its write');
eq(/settleLeftover\(waitForPendingWrites\(db\)\)/.test(src), true, 'changes from an earlier visit are settled by Firestore');

// ---------- demo mode has the same ones ----------
const demoSrc = ['demoStore', 'demoLearn', 'demoLife', 'demoLoans', 'demoBuddy', 'demoEvents', 'demoPetPhotos']
  .map((f) => readFileSync(new URL(`../src/data/${f}.js`, import.meta.url), 'utf8'))
  .join('\n');
const demoHas = (n) => new RegExp(`^\\s+(?:async )?${n}\\(`, 'm').test(demoSrc) || new RegExp(`^\\s+${n}[,:]`, 'm').test(demoSrc);
const missing = [...SERVER_CALLS, ...COIN_WRITES, ...FILE_CALLS].filter((n) => names.includes(n) && !demoHas(n));
eq(missing, [], 'demo store has every method that needs the server');

// ---------- what each kind does offline ----------
eq(offlineKind('play'), 'refuse', 'casino: refused');
eq(offlineKind('market'), 'refuse', 'buying: refused');
eq(offlineKind('loan'), 'refuse', 'loans: refused');
eq(offlineKind('addCoinTx'), 'refuse', 'a coin spend: refused');
eq(offlineKind('uploadChatFile'), 'refuse', 'a file: refused');
eq(offlineKind('sendMessage', ['general', { text: 'hi' }, {}]), 'count', 'a text message: waits');
eq(offlineKind('sendMessage', ['general', { text: 'hi' }, {}, { full: 1 }]), 'refuse', 'a message with a photo: refused');
for (const n of ['setChecklistItem', 'patchChecklistItems', 'moveChecklistItem', 'saveChecklistRun', 'answerCheckin', 'vote', 'votePicks', 'createRun', 'updateTask', 'logMatchScore', 'saveScoutPicks'])
  eq(offlineKind(n), 'count', `${n}: waits to send`);
for (const n of ['subscribeTasks', 'getMember', 'setPresence', 'saveChatReads', 'markInboxRead', 'newMessageId'])
  eq(offlineKind(n), 'pass', `${n}: not a change that waits`);

// ---------- demo's store while pretending to be offline ----------
let isOn = false;
let release;
const back = new Promise((r) => (release = r));
const calls = [];
const fake = {
  play: async () => (calls.push('play'), { ok: true }),
  answerCheckin: async () => (calls.push('answer'), undefined),
  bad: async () => {
    throw new Error('no');
  },
  subscribeTasks: () => () => {},
  value: 7,
};
const tracked = [];
const store = offlineStore(fake, {
  online: () => isOn,
  refusal: () => Object.assign(new Error('Needs a connection.'), { code: 'offline' }),
  track: (p) => tracked.push(p),
  whenOnline: () => back,
});
eq(store.value, 7, 'non-functions pass through');
eq(store.play === store.play, true, 'the same wrapper each time');
let refused = null;
await store.play({}).catch((e) => (refused = e.code));
eq(refused, 'offline', 'offline: a server call is refused');
eq(calls.includes('play'), false, 'offline: the server call never ran (nothing queued)');
await store.answerCheckin('c1', 'Sam', {});
eq(calls.includes('answer'), true, 'offline: a change shows at once');
eq(tracked.length, 1, 'offline: the change is counted as waiting');
await store.bad().catch(() => {});
store.subscribeTasks();
eq(tracked.length, 2, 'a turned-down change is tracked only until it settles');
let settled = false;
tracked[0].then(() => (settled = true));
await tick();
eq(settled, false, 'it waits until the connection is back');
isOn = true;
release();
await tick();
eq(settled, true, 'and is sent once it is');
await store.play({});
eq(calls.includes('play'), true, 'online: server calls go through');
eq(tracked.length, 2, 'online: nothing is counted by the demo');

// ---------- the count of changes waiting ----------
eq(net.pendingCount(), 0, 'starts at 0');
let ok1;
let no2;
const w1 = net.trackWrite(new Promise((r) => (ok1 = r)));
const w2 = net.trackWrite(new Promise((_, n) => (no2 = n)));
w2.catch(() => {});
eq(net.pendingCount(), 2, 'two writes waiting');
eq(localStorage.getItem('offline-unsent'), '2', 'kept in localStorage (after a reload, still counted)');
ok1();
await w1;
await tick();
eq(net.pendingCount(), 1, 'confirmed: one left');
no2(new Error('denied'));
await tick();
await tick();
eq(net.pendingCount(), 0, 'turned down by the server: not waiting any more');
eq(localStorage.getItem('offline-unsent'), null, 'cleared');

// ---------- what the strip says ----------
eq(net.syncText({ status: 'online', pending: 3, sent: true }), '', 'online: nothing');
eq(net.syncText({ status: 'offline', pending: 0, sent: false }), 'Offline · changes send when you’re back', 'offline, nothing waiting');
eq(net.syncText({ status: 'offline', pending: 1, sent: true }), 'Offline · 1 change waiting to send', 'offline, one');
eq(net.syncText({ status: 'offline', pending: 3, sent: true }), 'Offline · 3 changes waiting to send', 'offline, three');
eq(net.syncText({ status: 'back', pending: 2, sent: true }), 'Back online · sending 2 changes…', 'back, still sending');
eq(net.syncText({ status: 'back', pending: 0, sent: true }), 'Back online · sent', 'back, all sent');
eq(net.syncText({ status: 'back', pending: 0, sent: false }), 'Back online', 'back, nothing was waiting');
eq(net.noteFor(net.needsInternet(), 'x').title, 'Needs a connection', 'server calls offline: "Needs a connection"');

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
