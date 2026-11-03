// Differential test for coin balances: the app and the server must give the
// same balance (and earned total) for the same Firestore documents.
//
// It builds randomized teams (renames, old spellings, bank docs, ledger
// entries of every kind, shifts, tasks), works out the true balance from how
// the data was made, then reads the documents the way the app does
// (Workspace.jsx: subscribeBank, subscribeCoins, tasks, shifts, coinInput)
// and the way the server does (functions/index.js freshCoins: alias queries
// on the ledger, bank/{nameKey} reads, freshWallet). All three must agree.
// It also replays the old code (the shapes before the fix) on the minimized
// failing case, to show what it caught: a rename that only changes
// capitals, spaces or punctuation points the old name at the same bank doc as
// the new one, and the server counted that doc twice.
//
// Run: node scripts/test-coin-agree.mjs [cases]
import {
  COIN_DEFAULTS,
  coinInput,
  coinSettings,
  coinsByName,
  coinTasks,
  earnedItems,
  freshWallet,
  ledgerItems,
  oldBankIds,
  wallet,
} from '../functions/shared/coins.js';
import { bankAfter } from '../functions/shared/casino.js';
import { nameKey } from '../functions/shared/team.js';

const CASES = Number(process.argv[2]) || 400;
let failures = 0;
const fail = (msg) => {
  failures++;
  if (failures <= 12) console.log('FAIL', msg);
};
const ok = (cond, msg) => cond || fail(msg);

// ---------- seeded random ----------
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const MIN = 60000;
const HOUR = 3600000;
const DAY = 86400000;
// A Tuesday afternoon, New York time, in the 3.0 era (after RATES_FROM).
const NOW = Date.UTC(2026, 10, 3, 20, 0, 0);
const START = Date.UTC(2026, 7, 28, 14, 0, 0);

// ---------- the world ----------
const FIRST = ['Cooper', 'Asher', 'Jackson', 'Michael', 'Matthew', 'Sophia', 'Kasha', 'Shrey', 'Ira', 'Sebastian', 'Gabe', 'Nora'];
const LAST = ['Mlezcko', 'Mosseri', 'Lucks', 'Meidan', 'Kuehl', 'Bermudez', 'Jurasic', 'Kumar', 'Tolbert', 'Fox', 'Reed'];

// Old spellings of a name: the kinds of rename the Team tab allows.
function spellings(rand, base) {
  const [f, l] = base.split(' ');
  const pool = [
    base.toLowerCase(), // capitals only
    `${f}  ${l}`, // spaces
    `${f} ${l}.`, // punctuation
    `${f} ${l.slice(0, -1)}`, // a typo
    `${f[0]}. ${l}`,
    `${f}-${l}`,
    `${f} ${l}son`,
  ];
  return pool.sort(() => rand() - 0.5);
}

function makeWorld(seed) {
  const rand = rngOf(seed);
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const chance = (p) => rand() < p;

  const n = int(3, 7);
  const people = [];
  const used = new Set();
  while (people.length < n) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (used.has(nameKey(name))) continue;
    used.add(nameKey(name));
    people.push({ current: name });
  }
  // Each person: the names they've gone by, oldest first, ending in the current one.
  const renames = {};
  for (const p of people) {
    const history = [];
    const old = chance(0.55) ? int(1, 3) : 0;
    // Old spellings are unique to one person (a name belongs to one person), unless they only differ in capitals/spaces from their own.
    const pool = spellings(rand, p.current).filter((s) => nameKey(s) === nameKey(p.current) || !used.has(nameKey(s)));
    for (let i = 0; i < old && pool.length; i++) {
      const s = pool.shift();
      if (history.includes(s) || s === p.current) continue;
      history.push(s);
      used.add(nameKey(s));
    }
    history.push(p.current);
    p.names = history;
    for (let i = 0; i < history.length - 1; i++) renames[history[i]] = history[i + 1];
    // Sometimes an old name maps straight to the current one (a skipped step).
    if (history.length > 2 && chance(0.3)) renames[history[0]] = p.current;
  }
  const rename = (name) => {
    let x = name;
    for (let i = 0; i < 10 && renames[x] && renames[x] !== x; i++) x = renames[x];
    return x;
  };
  const aliasesOf = (name) => [name, ...Object.keys(renames).filter((k) => k !== name && rename(k) === name)];

  const cfg = coinSettings(chance(0.3) ? { perTask: int(5, 20), tasksPerDay: int(2, 6), dayCap: int(6, 12) } : {});
  const t0 = () => START + Math.floor(rand() * (NOW - START - HOUR));
  // The spelling a person went by at a time (history split evenly over the season).
  const nameAt = (p, at) => p.names[Math.min(p.names.length - 1, Math.floor(((at - START) / (NOW - START)) * p.names.length))];

  const shifts = [];
  const tasks = [];
  const ledger = [];
  const truth = Object.fromEntries(
    people.map((p) => [p.current, { shifts: [], tasks: [], ledger: [], bankNet: 0 }]),
  );
  for (const p of people) {
    const t = truth[p.current];
    // Shifts: closed ones over many days (some over the daily cap, some
    // across midnight, some before the 3.0 switch), maybe overlapping.
    const k = int(0, 14);
    for (let i = 0; i < k; i++) {
      const start = chance(0.2) ? Date.UTC(2026, 9 + int(0, 1), int(1, 28), int(0, 23)) : t0();
      const len = chance(0.15) ? int(10, 16) * HOUR : int(5, 300) * MIN;
      const end = Math.min(start + len, NOW - 1);
      if (end <= start) continue;
      shifts.push({ person: nameAt(p, start), start, end, id: `s${shifts.length}` });
      t.shifts.push({ person: p.current, start, end });
    }
    if (chance(0.25)) {
      // A shift running right now.
      const start = NOW - int(5, 400) * MIN;
      shifts.push({ person: nameAt(p, start), start, end: null, id: `s${shifts.length}` });
      t.shifts.push({ person: p.current, start, end: null });
    }
    // Ledger: one of each kind, a few of some.
    const mk = (entry, as) => {
      ledger.push(entry);
      t.ledger.push(as);
    };
    for (let i = int(0, 4); i > 0; i--) {
      const at = t0();
      const amount = int(1, 40);
      const what = pick(['skip', 'market', 'tournament', '', 'market']);
      const until = what === '' && chance(0.5) ? at + 3600000 : undefined;
      mk(
        { type: 'spend', person: nameAt(p, at), amount, what, label: `Market: thing ${i}`, ...(until && { until }), at },
        { type: 'spend', person: p.current, amount, what, label: `Market: thing ${i}`, at },
      );
    }
    if (chance(0.5)) {
      const at = t0();
      const amount = int(1, 30);
      mk({ type: 'refund', person: nameAt(p, at), amount, label: 'Refund: a perk', at }, { type: 'refund', person: p.current, amount, label: 'Refund: a perk', at });
    }
    for (let i = int(0, 3); i > 0; i--) {
      const at = t0();
      const amount = int(1, 20);
      const src = pick(['quiz', 'daily', 'bingo', 'streak']);
      mk({ type: 'award', person: nameAt(p, at), amount, source: src, label: `Award ${src}`, at }, { type: 'award', person: p.current, amount, source: src, label: `Award ${src}`, at });
    }
    if (chance(0.5)) {
      const at = t0();
      const what = pick(['wheel', 'tournament', 'game']);
      const amount = int(0, 25);
      mk({ type: 'prize', person: nameAt(p, at), what, amount, label: `Prize ${what}`, at }, { type: 'prize', person: p.current, what, amount, label: `Prize ${what}`, at });
    }
    if (chance(0.3)) {
      const at = t0();
      const amount = chance(0.5) ? int(1, 50) : -int(1, 30);
      mk({ type: 'grant', to: nameAt(p, at), amount, note: 'Bonus', by: 'Asher Mosseri', at }, { type: 'grant', to: p.current, amount, note: 'Bonus', at });
    }
    // Tasks: other people create them, this person finishes them.
    const others = people.filter((q) => q !== p);
    for (let i = int(0, 8); i > 0; i--) {
      const at = t0();
      const creator = pick(others) || p;
      const status = chance(0.8) ? 'done' : pick(['todo', 'doing']);
      const deleted = chance(0.1);
      const asg = [nameAt(p, at)];
      const extra = chance(0.2) ? pick(others) : null;
      const row = {
        id: `t${tasks.length}`,
        title: `Task ${tasks.length}`,
        status,
        assignees: extra ? [...asg, nameAt(extra, at)] : asg,
        createdBy: nameAt(creator, at),
        createdAt: at - HOUR,
        completedAt: status === 'done' ? at : null,
        ...(deleted && { deletedAt: at + 1 }),
      };
      tasks.push(row);
    }
  }
  // Truth for tasks: the same rows with current names.
  const truthTasks = tasks.map((t) => ({
    ...t,
    assignees: t.assignees.map(rename),
    createdBy: rename(t.createdBy),
  }));

  // Bank docs: each period of a person's life writes to the doc of the
  // name they had then (bank/{nameKey}); a case-only rename shares one doc.
  const bank = new Map();
  for (const p of people) {
    let net = 0;
    p.names.forEach((name, idx) => {
      const id = nameKey(name);
      let b = bank.get(id) || {};
      const m = chance(0.8) ? int(1, 22) : 0;
      let at = START + Math.floor((idx / p.names.length) * (NOW - START)) + int(0, 3) * DAY;
      for (let i = 0; i < m; i++) {
        at += int(1, 3) * HOUR;
        const kind = pick(['win', 'loss', 'escrow', 'escrow-then-end', 'daily', 'noentry']);
        let delta;
        let entry = null;
        if (kind === 'win') (delta = int(1, 80)), (entry = { game: 'slots', icon: '🎰', label: `Slots: won ${delta}` });
        else if (kind === 'loss') (delta = -int(1, 60)), (entry = { game: 'slots', icon: '🎰', label: `Slots: lost ${-delta}` });
        else if (kind === 'escrow') delta = -int(1, 30); // a bet held for a running game
        else if (kind === 'escrow-then-end') {
          const bet = int(1, 30);
          b = bankAfter(b, name, -bet, null, {}, at);
          net -= bet;
          const pay = chance(0.5) ? 0 : int(1, bet * 3);
          delta = pay;
          entry = { game: 'mines', icon: 'Mines', label: 'Mines', shown: pay - bet };
        } else if (kind === 'daily') (delta = int(1, 12)), (entry = { icon: '📅', label: 'Daily' });
        else delta = 0;
        b = bankAfter(b, name, delta, entry, {}, at);
        net += delta;
      }
      // A doc exists if anything was ever written; sometimes just touched.
      if (m || chance(0.2)) bank.set(id, { ...b, name: b.name || name });
    });
    truth[p.current].bankNet = net;
  }
  return { rand, people, renames, rename, aliasesOf, cfg, shifts, tasks, truthTasks, ledger, bank, truth };
}

// ---------- reading the documents ----------
// The app (src/data/firebaseStore.js + Workspace.jsx).
function appView(w, name, { now = NOW } = {}) {
  const bankDocs = Object.fromEntries([...w.bank].map(([id, b]) => [id, { ...b, id }])); // subscribeBank
  const data = coinInput({
    tasks: w.tasks,
    shifts: w.shifts,
    ledger: w.ledger,
    bank: Object.values(bankDocs),
    rename: w.rename,
    cfg: w.cfg,
    names: w.people.map((p) => p.current), // the roster
    now: Math.floor(now / MIN) * MIN,
  });
  return wallet(name, data);
}

// The server: freshCoins in functions/index.js, against an in-memory database.
function serverView(w, name, { cacheAge = 0, now = NOW } = {}) {
  const aliases = w.aliasesOf(name).slice(0, 30);
  const field = (f) => w.ledger.map((x, i) => ({ id: `c${i}`, ...x })).filter((x) => aliases.includes(x[f]));
  const found = new Map();
  for (const f of ['person', 'from', 'to']) for (const x of field(f)) found.set(x.id, { ...x, id: undefined });
  const oldIds = oldBankIds(name, aliases);
  const myBank = w.bank.get(nameKey(name)) || {};
  const old = oldIds.filter((id) => w.bank.has(id)).map((id) => ({ ...w.bank.get(id), id }));
  // coinData: all tasks and shifts, under current names (cached for 20 s).
  const data = {
    rename: w.rename,
    tasks: coinTasks(w.tasks, w.rename),
    shifts: coinsByName({ shifts: w.shifts }, w.rename).shifts,
    cfg: w.cfg,
  };
  const banks = [{ ...myBank, id: nameKey(name), name }, ...old];
  return freshWallet(name, data, { ledger: [...found.values()], banks, now });
}

// The old code, as it was before the fix, for the failing case.
function oldAppBalance(w, name) {
  const bank = Object.fromEntries([...w.bank.values()].map((b) => [b.name, b]));
  const data = {
    tasks: coinTasks(w.tasks, w.rename),
    ...coinsByName({ shifts: w.shifts, ledger: w.ledger, bank: Object.values(bank) }, w.rename),
    cfg: w.cfg,
    now: Math.floor(NOW / MIN) * MIN,
  };
  return wallet(name, data).balance;
}
function oldServerBalance(w, name) {
  const aliases = w.aliasesOf(name).slice(0, 30);
  const found = new Map();
  for (const f of ['person', 'from', 'to']) w.ledger.forEach((x, i) => aliases.includes(x[f]) && found.set(`c${i}`, x));
  const myBank = w.bank.get(nameKey(name)) || {};
  const old = aliases.slice(1).map((a) => w.bank.get(nameKey(a))); // db.getAll(...aliases.slice(1).map(bankRef))
  const banks = [{ ...myBank, name }, ...old.filter(Boolean)];
  const mine = coinsByName({ ledger: [...found.values()], bank: banks }, w.rename);
  const data = { tasks: coinTasks(w.tasks, w.rename), shifts: coinsByName({ shifts: w.shifts }, w.rename).shifts, cfg: w.cfg };
  return wallet(name, { ...data, ledger: mine.ledger, bank: mine.bank, now: Math.floor(NOW / MIN) * MIN }).balance;
}

// What the person really has, from how the data was made (no renames).
function truthBalance(w, name) {
  const t = w.truth[name];
  const earned = earnedItems(name, { tasks: w.truthTasks, shifts: t.shifts, cfg: w.cfg, now: Math.floor(NOW / MIN) * MIN }).reduce((s, x) => s + x.amount, 0);
  const led = ledgerItems(name, t.ledger).reduce((s, x) => s + x.amount, 0);
  return { earned, balance: earned + led + t.bankNet };
}

// ---------- run ----------
let bankSharedCases = 0;
let gapCases = 0;
for (let seed = 1; seed <= CASES; seed++) {
  const w = makeWorld(seed * 7919);
  for (const p of w.people) {
    const name = p.current;
    const truth = truthBalance(w, name);
    const app = appView(w, name);
    const srv = serverView(w, name);
    const tag = `seed ${seed * 7919} ${name} [${p.names.join(' > ')}]`;
    ok(app.balance === srv.balance, `${tag}: app ${app.balance} vs server ${srv.balance}`);
    ok(app.earned === srv.earned, `${tag}: earned app ${app.earned} vs server ${srv.earned}`);
    ok(app.balance === truth.balance, `${tag}: app ${app.balance} vs truth ${truth.balance}`);
    ok(srv.balance === truth.balance, `${tag}: server ${srv.balance} vs truth ${truth.balance}`);
    ok(app.earned === truth.earned, `${tag}: earned ${app.earned} vs truth ${truth.earned}`);
    // The history adds up to the balance (what the Coins screen lists).
    ok(app.history.reduce((s, x) => s + x.amount, 0) === app.balance, `${tag}: history does not add up`);
    if (p.names.some((s) => s !== name && nameKey(s) === nameKey(name))) {
      bankSharedCases++;
      const oldSrv = oldServerBalance(w, name);
      if (oldSrv !== truth.balance) gapCases++;
    }
  }
}
console.log(`${CASES} random teams checked; ${bankSharedCases} people had a capitals-only rename (same bank doc), the old server code was off for ${gapCases} of them`);

// ---------- the minimized failing case ----------
// Cooper's team: renamed "cooper mlezcko" to "Cooper Mlezcko" (capitals only),
// then lost 69 coins at the casino. One bank doc (bank/cooper-mlezcko).
{
  const rename = (n) => (n === 'cooper mlezcko' ? 'Cooper Mlezcko' : n);
  const w = {
    rename,
    aliasesOf: (n) => (n === 'Cooper Mlezcko' ? ['Cooper Mlezcko', 'cooper mlezcko'] : [n]),
    people: [{ current: 'Cooper Mlezcko' }],
    cfg: coinSettings({}),
    shifts: [{ person: 'Cooper Mlezcko', start: NOW - 20 * DAY, end: NOW - 20 * DAY + 10 * HOUR }],
    tasks: [],
    ledger: [{ type: 'grant', to: 'Cooper Mlezcko', amount: 100, note: 'Bonus', at: NOW - 15 * DAY }],
    bank: new Map([['cooper-mlezcko', { name: 'Cooper Mlezcko', net: -69, recent: [{ at: NOW - DAY, amount: -69, icon: '🎰', label: 'Slots: lost 69' }], since: NOW - 10 * DAY, stats: {} }]]),
  };
  const was = { app: oldAppBalance(w, 'Cooper Mlezcko'), server: oldServerBalance(w, 'Cooper Mlezcko') };
  const now = { app: appView(w, 'Cooper Mlezcko').balance, server: serverView(w, 'Cooper Mlezcko').balance };
  console.log(`minimized case (100 granted + 50 for the shift - 69 lost = 81): old app ${was.app}, old server ${was.server}; now app ${now.app}, server ${now.server}`);
  ok(was.app - was.server === 69, 'the old code should show the 69-coin gap');
  ok(now.app === 81 && now.server === 81, 'now both say 81');
}

// ---------- other shapes that used to disagree ----------
{
  // A bank doc whose saved name is spelled differently from the roster (no rename entry):
  // the server reads bank/{nameKey} as theirs; the app now does too.
  const w = makeWorld(42);
  const p = w.people[0];
  const id = nameKey(p.current);
  w.bank.set(id, { ...(w.bank.get(id) || {}), name: `${p.current.toUpperCase()}`, net: 11, recent: [{ at: NOW - HOUR, amount: 11, icon: '📅', label: 'Daily' }], since: NOW - DAY });
  w.truth[p.current].bankNet = 11;
  // The rest of the dataset for this person is shaped by makeWorld, so just compare the two views.
  const a = appView(w, p.current).balance;
  const s = serverView(w, p.current).balance;
  ok(a === s, `stale name in bank doc: app ${a} vs server ${s}`);
}
{
  // Net 0 with entries that don't cancel (a bet held for a running game after a win):
  // the balance is the net, and the history says so.
  const b = { name: 'A B', net: 0, recent: [{ at: NOW - HOUR, amount: 20, icon: '🎰', label: 'Mines: won 20' }], since: NOW - DAY };
  const w = wallet('A B', { tasks: [], shifts: [], ledger: [], bank: { 'A B': b }, cfg: coinSettings({}), now: NOW });
  ok(w.balance === 0, `net 0 must count as 0, not ${w.balance}`);
}
{
  // The same doc listed twice counts once; two docs with one name both count.
  const one = { id: 'x', name: 'A B', net: -10, recent: [], since: 1 };
  const two = { id: 'y', name: 'A B', net: 5, recent: [], since: 1 };
  ok(coinsByName({ bank: [one, one] }).bank['A B'].net === -10, 'a doc listed twice counts once');
  ok(coinsByName({ bank: [one, two] }).bank['A B'].net === -5, 'two docs under one name add up');
}
{
  // Alias ids: same nameKey, current doc skipped, each old doc once.
  const ids = oldBankIds('Cooper Mlezcko', ['Cooper Mlezcko', 'cooper mlezcko', 'Cooper  Mlezcko', 'Cooper Mlezko', 'cooper mlezko']);
  ok(JSON.stringify(ids) === JSON.stringify(['cooper-mlezko']), `old ids: ${ids}`);
}
{
  // Running shift: the app counts up to its minute; the server's number may
  // be at most a minute behind, never more than one coin apart.
  const w = makeWorld(5);
  const p = w.people[0];
  w.shifts.push({ person: p.current, start: NOW - 3 * HOUR - 50 * MIN, end: null, id: 'run' });
  const a = appView(w, p.current, { now: NOW });
  const s = serverView(w, p.current, { now: NOW + 59000 });
  ok(Math.abs(a.balance - s.balance) <= 1, `running shift: ${a.balance} vs ${s.balance}`);
}

console.log(failures ? `${failures} FAILURES` : 'ALL OK');
process.exit(failures ? 1 : 0);
