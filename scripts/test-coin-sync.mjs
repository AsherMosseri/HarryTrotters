// Unit test for src/coinSync.js (the app checking its balance against the
// server's), with a tiny stand-in for React's hooks and fake timers.
// Run: node scripts/test-coin-sync.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'coinsync-'));
// The hooks: refs and state kept in one place, timers on a manual clock.
writeFileSync(
  join(dir, 'react.mjs'),
  `const store = globalThis.__hooks;
export const useRef = (v) => { const k = store.next(); if (!(k in store.refs)) store.refs[k] = { current: v }; return store.refs[k]; };
export const useState = (v) => { const k = store.next(); if (!(k in store.state)) store.state[k] = v; return [store.state[k], (x) => { store.state[k] = x; }]; };
export const useCallback = (f) => { const k = store.next(); if (!(k in store.cb)) store.cb[k] = f; return store.cb[k]; };
export const useEffect = () => {};
`,
);
const src = readFileSync(resolve(here, '../src/coinSync.js'), 'utf8')
  .replace("from 'react'", "from './react.mjs'")
  .replace("from './coins.js'", `from '${resolve(here, '../functions/shared/coins.js')}'`);
writeFileSync(join(dir, 'coinSync.mjs'), src);

let clock = 0;
let queue = [];
globalThis.setTimeout = (f, ms) => (queue.push({ at: clock + ms, f }), queue.length);
globalThis.clearTimeout = (id) => { if (queue[id - 1]) queue[id - 1] = null; };
const tick = (ms) => {
  clock += ms;
  for (const t of [...queue]) if (t && t.at <= clock) { queue[queue.indexOf(t)] = null; t.f(); }
};
let calls = 0;
globalThis.__hooks = { refs: {}, state: {}, cb: {}, i: 0, next() { return this.i++; } };
const render = (wallet) => { globalThis.__hooks.i = 0; return mod.useCoinSync(wallet); };
const warns = [];
console.warn = (...a) => warns.push(a);
const mod = await import(join(dir, 'coinSync.mjs'));

let fails = 0;
const check = (ok, label) => { console.log(ok ? 'PASS' : 'FAIL', label); if (!ok) fails++; };

const w = (balance) => ({ balance, history: [{ kind: 'task', amount: balance }] });
let s = render(w(50));
// The server says 50 and the app says 50: nothing.
s.noteServer(50); tick(4000); tick(6000);
s = render(w(50));
check(s.stale === null && !warns.length, 'matching numbers: no flag, no log');
// Within a coin: fine.
s.noteServer(51); tick(10000); s = render(w(50));
check(s.stale === null, 'a coin apart (a running shift): fine');
// The app catches up in time: fine.
s.noteServer(60); tick(2000); s = render(w(60)); tick(2000); tick(6000); s = render(w(60));
check(s.stale === null && !warns.length, 'the app catches up within seconds: no flag');
// Still different after 10 seconds: flagged, logged once with the breakdown.
s = render(w(74));
s.noteServer(5); tick(4000); s = render(w(74));
check(s.stale === null, 'first look at 4 s says nothing yet'); tick(6000);
s = render(w(74));
check(s.stale && s.stale.server === 5 && s.stale.app === 74, 'flagged with both numbers after 10 s');
check(warns.length === 1 && warns[0][1].breakdown.task.coins === 74, 'logged once with the breakdown');
s.noteServer(5); tick(10000); render(w(74));
check(warns.length === 1, 'the same disagreement isn’t logged again');
// A newer answer replaces an older check.
s.noteServer(1); s.noteServer(74); tick(10000); s = render(w(74));
check(s.stale === null, 'a newer answer wins and clears it');
// Not a number (demo mode, an error): ignored.
s.noteServer(undefined); s.noteServer(null); s.noteServer('5'); tick(20000); s = render(w(74));
check(s.stale === null, 'answers without a balance are ignored');
console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
