// The callables the app sends through the one always-warm `api` function
// (functions/api.js). Each one stays deployed under its own name too (older
// versions of the app still call those directly), but only `api` is kept
// awake, so a tap here never waits for a server to start up.
//
// Only these names can be reached through `api`. Left out on purpose:
// ftcEvents (needs the FTC API secrets and calls an outside server) and recap
// (team management's heavy weekly read). Both are rare and stay separate.
//
// The app (src/data/firebaseStore.js) reads this same list.
export const API_FNS = [
  // Sign-in and accounts
  'account',
  // Casino, games, arcade tournaments
  'play',
  'funGame',
  'submitTournamentScore',
  // Learn: quizzes, the auto planner, the daily question
  'quizNext',
  'quizAnswer',
  'quizProgress',
  'quizReport',
  'autoRun',
  'dailyAnswer',
  // Coins: loans, requests, reports, the balance check
  'loanRequest',
  'loanRespond',
  'loanRepay',
  'loanManage',
  'coinRequest',
  'dispute',
  'disputeDecide',
  'disputeRefundAll',
  'ownerRefund',
  'coinCheck',
  // The market and pets
  'buy',
  'joinTournament',
  'marketManage',
  'pet',
  'petEvent',
  // Team life and channels
  'claimBingo',
  'predict',
  'channelRequest',
];
