// Trotbot's levels (3.1.1) in Tetris and Minesweeper:
// - the phone's live Trotbot and the server's replay are the same game, for
//   many seeds at every level and board: the app builds its bot from the
//   start answer and advances it a little at a time (TetrisPlay / MinesPlay),
//   the server replays the stored session in one go (funGames.js botResult);
// - no bot ever touches Math.random or the secure generator (only the seed);
// - the server picks the level from the start request against the allowlist
//   (unknown → Medium), and an older app's speed gets the old bot;
// - what beating each level pays, and games from before 3.1.1 replay and
//   pay exactly as they did (results pinned from the 3.1 code);
// - the levels really are different: slower and sloppier at the bottom.
// Run: node scripts/test-trotbot-levels.mjs [seeds per level, default 40]
import * as fun from '../functions/shared/funGames.js';
import * as T from '../functions/shared/tetris.js';
import * as M from '../functions/shared/minesweeper.js';
import { seeded } from '../functions/shared/rng.js';

const SEEDS = Number(process.argv[2] || 40);
let failures = 0;
let passes = 0;
const ok = (cond, msg) => {
  if (cond) passes++;
  else {
    failures++;
    console.log('FAIL', msg);
  }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Any randomness that isn't the seed fails the test.
const realRandom = Math.random;
const realValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
const noRandom = () => {
  Math.random = () => {
    throw new Error('Math.random used by Trotbot');
  };
  globalThis.crypto.getRandomValues = () => {
    throw new Error('secureRandom used by Trotbot');
  };
};
const restore = () => {
  Math.random = realRandom;
  globalThis.crypto.getRandomValues = realValues;
};

// The session the server stores at start, and what the app gets back.
const serverSession = (game, seed, req) => ({
  person: 'Test',
  game,
  mode: 'bot',
  seed,
  level: game === 'tetris' ? 1 : M.LEVELS[req.level] ? req.level : 'beginner',
  ...fun.botPick(req),
});
const startAnswer = (s) => ({ ok: true, id: 'x', seed: s.seed, server: false, mode: s.mode, level: s.level, speed: s.speed, botLevel: s.botLevel || '' });

// The app's side: FunGame's session ({ ...answer, game, mode }), then the
// bot advanced in uneven steps the way the screen's clock ticks.
function clientGame(game, answer, stepSeed) {
  const session = { ...answer, game, mode: 'bot' };
  const bot = fun.botFor({ ...session, game });
  const steps = seeded(`steps|${stepSeed}`);
  let t = 0;
  const end = game === 'tetris' ? T.MAX_FRAMES : M.MAX_MS;
  const done = () => (game === 'tetris' ? T.isDone(bot.game) : M.isDone(bot.game));
  while (!done() && t < end) {
    t += game === 'tetris' ? 1 + steps.int(steps.int(8) ? 3 : 240) : 16 + steps.int(steps.int(8) ? 120 : 4000);
    bot.advance(t);
  }
  return bot;
}

noRandom();
try {
  // ---------- client and server agree ----------
  const boards = Object.keys(M.LEVELS);
  for (const level of fun.BOT_LEVELS) {
    let agree = 0;
    for (let i = 0; i < SEEDS; i++) {
      const s = serverSession('tetris', `t${i}-${level}`, { botLevel: level, speed: 'medium' });
      const server = fun.botResult(s);
      const client = clientGame('tetris', startAnswer(s), i);
      const direct = T.newBot({ seed: s.seed, level }).advance(T.MAX_FRAMES);
      if (same(T.summary(client.game), server) && same(client.game.board, direct.board)) agree++;
      else console.log('  tetris differs', level, s.seed, server, T.summary(client.game));
    }
    ok(agree === SEEDS, `Tetris ${level}: the app's Trotbot and the server's are the same game (${agree}/${SEEDS} seeds)`);
    for (const board of boards) {
      let agreeM = 0;
      for (let i = 0; i < SEEDS; i++) {
        const s = serverSession('minesweep', `m${i}-${level}`, { botLevel: level, level: board });
        const server = fun.botResult(s);
        const client = clientGame('minesweep', startAnswer(s), i);
        if (same(M.summary(client.game), server) && same(client.game.state, M.newBot({ seed: s.seed, level: board, skill: level }).advance(M.MAX_MS).state))
          agreeM++;
        else console.log('  minesweeper differs', level, board, s.seed, server, M.summary(client.game));
      }
      ok(agreeM === SEEDS, `Minesweeper ${level} on ${board}: the app's Trotbot and the server's are the same game (${agreeM}/${SEEDS} seeds)`);
    }
  }
  // Part way through, a bot that ticked in small steps matches one that jumped there.
  for (const level of fun.BOT_LEVELS) {
    const small = T.newBot({ seed: 'mid', level });
    for (let f = 1; f <= 1800; f++) small.advance(f);
    const jump = T.newBot({ seed: 'mid', level }).advance(1800);
    ok(same(small.game.board, jump.board) && small.game.pieces === jump.pieces, `Tetris ${level}: 30 seconds in, frame by frame = one jump`);
    const ms = M.newBot({ seed: 'mid', level: 'intermediate', skill: level });
    for (let t = 100; t <= 60000; t += 100) ms.advance(t);
    const mj = M.newBot({ seed: 'mid', level: 'intermediate', skill: level }).advance(60000);
    ok(same(ms.game.state, mj.state) && ms.game.ms === mj.ms, `Minesweeper ${level}: a minute in, tick by tick = one jump`);
  }
  // A different level on the same seed is a different game.
  const a = fun.botResult(serverSession('tetris', 'same', { botLevel: 'easy' }));
  const b = fun.botResult(serverSession('tetris', 'same', { botLevel: 'hard' }));
  ok(a.frames !== b.frames, 'Tetris: the same seed at two levels plays differently');
  // Seeds give the same game every time.
  ok(same(fun.botResult(serverSession('minesweep', 'again', { botLevel: 'beginner', level: 'expert' })), fun.botResult(serverSession('minesweep', 'again', { botLevel: 'beginner', level: 'expert' }))), 'the same seed and level is the same game twice');
} catch (e) {
  ok(false, `a bot used randomness that isn't the seed: ${e.message}`);
} finally {
  restore();
}

// ---------- the level comes from the start request, checked ----------
ok(same(fun.botPick({ botLevel: 'insane' }), { speed: 'insane', botLevel: 'insane' }), 'botLevel insane is kept');
for (const level of fun.BOT_LEVELS) ok(fun.botPick({ botLevel: level }).botLevel === level, `botLevel ${level} is allowed`);
for (const bad of ['ludicrous', 'INSANE', '', 5, null, {}, ['hard'], '__proto__', 'constructor', 'toString'])
  ok(bad === null ? fun.botPick({ botLevel: bad }).botLevel === undefined : fun.botPick({ botLevel: bad }).botLevel === 'medium', `botLevel ${JSON.stringify(bad)} → ${bad === null ? 'an old app' : 'Medium'}`);
ok(same(fun.botPick({ speed: 'hard' }), { speed: 'hard' }), 'an older app sending speed hard gets the old Hard bot (no botLevel)');
ok(same(fun.botPick({ speed: 'insane' }), { speed: 'medium' }), 'an older app sending a speed it never had gets the old Medium');
ok(same(fun.botPick({}), { speed: 'medium' }), 'no level at all: the old Medium, as before');
ok(fun.botLevelOf({ botLevel: 'insane' }) === 'insane' && fun.botLevelOf({ botLevel: 'nope' }) === '' && fun.botLevelOf({ speed: 'hard' }) === '', 'botLevelOf reads only an allowed botLevel');
ok(fun.botLabel({ botLevel: 'insane' }) === 'Insane' && fun.botLabel({ speed: 'hard' }) === 'Hard' && fun.botLabel({ speed: 'insane' }) === 'Insane' && fun.botLabel({}) === 'Medium', 'labels for sessions and chat cards');

// ---------- coins ----------
const tWin = { finished: true, frames: 3000, lines: 40 };
const mWin = { won: true, ms: 10000, cells: 71 };
const PAY = { beginner: 1, easy: 1, medium: 2, hard: 4, insane: 6 };
for (const level of fun.BOT_LEVELS) {
  const s = serverSession('tetris', 'c', { botLevel: level });
  ok(fun.coinsFor(s, tWin, true) === PAY[level], `Tetris: beating ${level} pays ${PAY[level]}`);
  ok(fun.coinsFor(s, tWin, false) === 0, `Tetris: losing to ${level} pays 0`);
  for (const [board, extra] of [['beginner', -1], ['intermediate', 2], ['expert', 5]]) {
    const m = serverSession('minesweep', 'c', { botLevel: level, level: board });
    const want = PAY[level] + extra;
    ok(fun.coinsFor(m, mWin, true) === want, `Minesweeper ${board}: beating ${level} pays ${want}`);
    ok(fun.msBotCoins(board, PAY[level]) === want, `the picker shows ${want} for ${level} on ${board}`);
    ok(fun.coinsFor(m, mWin, false) === 0, `Minesweeper ${board}: losing to ${level} pays 0`);
  }
}
// What the app says at finish can't change the level: coinsFor reads only the session.
const insane = serverSession('tetris', 'c', { botLevel: 'easy' });
ok(fun.coinsFor({ ...insane }, tWin, true) === 1, 'a session started at Easy pays Easy');
// Old sessions pay what they did (easy 1, medium 2, hard 4; anything else 2).
for (const [speed, pay] of [['easy', 1], ['medium', 2], ['hard', 4], ['', 2], [undefined, 2]]) {
  ok(fun.coinsFor({ game: 'tetris', mode: 'bot', seed: 'o', level: 1, speed }, tWin, true) === pay, `an old Tetris session at ${speed || 'no speed'} pays ${pay}`);
  ok(fun.coinsFor({ game: 'minesweep', mode: 'bot', seed: 'o', level: 'expert', speed }, mWin, true) === pay + 5, `an old Minesweeper Expert session at ${speed || 'no speed'} pays ${pay + 5}`);
  ok(fun.coinsFor({ game: 'minesweep', mode: 'bot', seed: 'o', level: 'beginner', speed }, mWin, true) === pay - 1, `an old Minesweeper Beginner session at ${speed || 'no speed'} pays ${pay - 1}`);
}

// ---------- old games replay exactly as in 3.1 ----------
const GOLDEN = [
  [{ game: 'tetris', mode: 'bot', seed: 'golden', level: 1, speed: 'medium' }, { score: 4800, lines: 40, level: 1, frames: 4635, pieces: 103, over: false, finished: true, reason: 'done' }],
  [{ game: 'tetris', mode: 'bot', seed: 'golden', level: 1, speed: 'hard' }, { score: 4800, lines: 40, level: 1, frames: 2781, pieces: 103, over: false, finished: true, reason: 'done' }],
  [{ game: 'minesweep', mode: 'bot', seed: 'golden', level: 'intermediate', speed: 'easy' }, { won: false, lost: true, ms: 94500, cells: 215, safe: 216, level: 'intermediate' }],
  [{ game: 'minesweep', mode: 'bot', seed: 'golden2', level: 'expert', speed: 'medium' }, { won: true, lost: false, ms: 180000, cells: 381, safe: 381, level: 'expert' }],
];
for (const [s, want] of GOLDEN) ok(same(fun.botResult(s), want), `an old ${s.game} session (${s.speed}) replays exactly as in 3.1`);

// ---------- the levels are different ----------
const median = (xs) => xs.slice().sort((x, y) => x - y)[xs.length >> 1];
const tTimes = {};
const tPieces = {};
const mTimes = {};
const mWins = {};
for (const level of fun.BOT_LEVELS) {
  const ts = [];
  const ps = [];
  const ms = [];
  let wins = 0;
  for (let i = 0; i < 20; i++) {
    const r = T.newBot({ seed: `order${i}`, level }).result();
    ts.push(r.finished ? r.frames : Infinity);
    ps.push(r.pieces);
    const m = M.newBot({ seed: `order${i}`, level: 'intermediate', skill: level }).result();
    if (m.won) {
      wins++;
      ms.push(m.ms);
    }
  }
  tTimes[level] = median(ts);
  tPieces[level] = median(ps);
  mTimes[level] = median(ms);
  mWins[level] = wins;
}
for (let k = 1; k < fun.BOT_LEVELS.length; k++) {
  const [lo, hi] = [fun.BOT_LEVELS[k - 1], fun.BOT_LEVELS[k]];
  ok(tTimes[hi] < tTimes[lo] * 0.85, `Tetris: ${hi} is clearly faster than ${lo} (${(tTimes[hi] / 60).toFixed(0)} s vs ${(tTimes[lo] / 60).toFixed(0)} s)`);
  ok(mTimes[hi] < mTimes[lo] * 0.8, `Minesweeper: ${hi} clears clearly faster than ${lo} (${Math.round(mTimes[hi] / 1000)} s vs ${Math.round(mTimes[lo] / 1000)} s)`);
}
ok(tPieces.beginner > tPieces.insane + 5, `Tetris: Beginner's holes cost it pieces (${tPieces.beginner} vs ${tPieces.insane})`);
ok(mWins.insane > mWins.beginner, `Minesweeper: Insane clears more boards than Beginner (${mWins.insane} vs ${mWins.beginner} of 20)`);

console.log(failures ? `${failures} FAILED, ${passes} passed` : `ALL OK (${passes} checks, ${SEEDS} seeds per level and board)`);
process.exit(failures ? 1 : 0);
