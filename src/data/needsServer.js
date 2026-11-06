// What can't wait offline, by store method name, and demo mode's pretend
// offline (?demo&offline, or the demo banner's switch) built on it.
//
// In the real app (firebaseStore.js) changes to the team's data wait on the
// device and send later (Firestore's offline copy), but these go to the
// server and only work online, so offline they say "Needs a connection" at
// once:
// - SERVER_CALLS: the server functions (coins, casino, games, buying, gifts,
//   loans, pets, tournaments, refunds, Learn, accounts…). Never queued or
//   replayed: the server decides and pays.
// - COIN_WRITES: the two coin changes the app writes itself (ad-free time
//   and skips, the owner's grants and undo), refused offline for the same reason.
// - FILE_CALLS: pictures and files (Storage can't wait offline).
// scripts/test-offline.mjs checks these lists against firebaseStore.js.
export const SERVER_CALLS = [
  'account',
  'petEvent',
  'market',
  'claimBingo',
  'predict',
  'recap',
  'ftcEvents',
  'quizNext',
  'quizAnswer',
  'quizProgress',
  'quizReport',
  'autoRun',
  'dailyAnswer',
  'requestChannel',
  'cancelChannelRequest',
  'decideChannelRequest',
  'play',
  'dispute',
  'disputeDecide',
  'disputeRefundAll',
  'ownerRefund',
  'hiddenCoin',
  'moveToArcade',
  'coinRequest',
  'loan',
  'buddy',
  'coinCheck',
  'funGame',
  'submitTournamentScore',
];
export const COIN_WRITES = ['addCoinTx', 'deleteCoinTx'];
export const FILE_CALLS = [
  'addTaskPhoto',
  'uploadPetPhoto',
  'uploadChecklistPhoto',
  'uploadChatGif',
  'uploadChatFile',
  'uploadAvatar',
  'uploadBanner',
  'uploadEffectImage',
  'uploadAdImage',
  'addSticker',
  'addEmoji',
  'uploadLabPhoto',
  'uploadLabVoice',
  'uploadRobotVersion',
];
const REFUSED = new Set([...SERVER_CALLS, ...COIN_WRITES, ...FILE_CALLS]);

// Store methods that only read, and background bookkeeping the real app
// doesn't count as a change waiting to send (or that runs by itself).
const READS = /^(subscribe|watch|get|load|recent|search|list|new|on[A-Z]|ping|is|has|can|warm|peek)/;
const QUIET = new Set([
  'setPresence',
  'saveChatReads',
  'markInboxRead',
  'bumpLabChips',
  'addLabTouch',
  'setRaceLive',
  'bumpAdStats',
  'useWallets',
  'scaleTick',
  'loanTick',
  'drawLottery',
  'enablePush',
  'disablePush',
  'refreshPush',
  'forgetDevice',
]);
// What happens to a store method offline: 'refuse', 'count' (a change that
// waits to send) or 'pass'.
export function offlineKind(name, args = []) {
  if (REFUSED.has(name)) return 'refuse';
  // A chat message waits; one with a photo needs the upload (sendMessage's 4th argument).
  if (name === 'sendMessage') return args[3] ? 'refuse' : 'count';
  if (READS.test(name) || QUIET.has(name)) return 'pass';
  return 'count';
}

// Demo mode's store, as the real one behaves offline. While `online()` is
// false: the server's parts are refused with `refusal()`; a change shows at
// once (the demo saves it right away, like Firestore's offline copy) and is
// counted with track(promise) until `whenOnline()` settles.
export function offlineStore(store, { online, refusal, track, whenOnline }) {
  const made = new Map(); // one wrapper per method, so it stays the same function
  return new Proxy(store, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      if (typeof v !== 'function' || typeof key !== 'string') return v;
      if (made.get(key)?.v === v) return made.get(key).fn;
      const fn = function offlineAware(...args) {
        if (online()) return v.apply(target, args);
        const kind = offlineKind(key, args);
        if (kind === 'refuse') return Promise.reject(refusal());
        const out = v.apply(target, args);
        // Turned down (a check on the device): nothing waits.
        if (kind === 'count') track(Promise.resolve(out).then(() => whenOnline(), () => {}));
        return out;
      };
      made.set(key, { v, fn });
      return fn;
    },
  });
}
