// Pet battles (3.3) in demo mode: what the server's play function finds out
// for a battle (functions/index.js battleContext, battleReads and
// writeBattleRecords), on the demo's own pets, and a demo teammate who
// answers on their own: they accept after a moment and pick a move each
// round (at random, from the moves their pet can use), with or without a bet.
// The battle itself runs the same shared code as the server
// (functions/shared/battles.js, through arcade.js in demoStore's play).
import { personId } from './diff.js';
import * as battles from '../../functions/shared/battles.js';
import { levelOf, petXp, petsIn } from '../../functions/shared/pets.js';

const DAY = 86400000;

export function demoBattles({ get, commit, play }) {
  const S = () => get();
  const docOf = (name) => (S().pets || []).find((p) => p.person === name) || null;
  const withLevels = (name, now) =>
    petsIn(docOf(name)).map((pet) => ({ pet, level: levelOf(petXp(name, S().shifts || [], Number(pet.adoptedAt) || 0, now)).level }));

  // The server's battleContext: the person asked (on the team, coins, pets),
  // my pets, and whether a battle of mine is already waiting.
  function context({ me, words, roster, balanceOf, bank, now }) {
    const { them, known } = battles.parseWords(words, roster);
    const peer = known && them !== me && them !== 'Trotbot' ? { name: them, active: roster.includes(them), balance: balanceOf(them), pets: withLevels(them, now) } : null;
    const open = bank.btOpen ? ((S().chat || {})[bank.btOpen.conv] || []).find((x) => x.id === bank.btOpen.id)?.cmd : null;
    const hasOpen = open?.name === 'battle' && open.status === 'open' && open.game.expiresAt > now;
    return { peer, myPets: withLevels(me, now), hasOpen };
  }

  // Both pets still with their owners (one that died or was given away is gone).
  const alive = (g) => {
    const has = (owner, side) => petsIn(docOf(owner)).some((p) => Number(p.adoptedAt) === Number(side?.born));
    return { a: has(g.a, g.pa), b: has(g.b, g.pb) };
  };

  // Each pet's win, loss or draw, once, when a battle really ends.
  function record(pub, now = Date.now()) {
    const rec = battles.recordOf(pub);
    if (!rec) return;
    const s = S();
    const list = [...(s.petBattles || [])];
    [
      [pub.a, pub.pa, rec.a],
      [pub.b, pub.pb, rec.b],
    ].forEach(([person, side, result]) => {
      const id = personId(person);
      const i = list.findIndex((d) => d.id === id);
      const doc = battles.recordAfter(i >= 0 ? list[i] : null, { person, side, result, now });
      if (i >= 0) list[i] = { id, ...doc };
      else list.push({ id, ...doc });
    });
    s.petBattles = list;
  }

  // The demo teammate on the other side: accepts after a moment, then picks
  // a move each round a second or three in, until the battle is over. They
  // answer only battles sent to them by the person using the demo.
  const driving = new Set();
  function drive({ conv, msgId, opp, ctx }) {
    if (driving.has(msgId)) return;
    driving.add(msgId);
    const actor = { name: opp, uid: `demo-${personId(opp)}` };
    const card = () => ((S().chat || {})[conv] || []).find((x) => x.id === msgId)?.cmd || null;
    const step = async () => {
      const c = card();
      if (!c || c.status === 'done') return driving.delete(msgId);
      const g = c.game;
      if (c.status === 'open') await play({ action: 'move', conv, msgId, move: 'accept' }, actor, ctx);
      else if (!(g.picked || []).includes(opp)) {
        const side = g.b === opp ? g.pb : g.pa;
        const i = battles.autoPick(side, g.round, Math.random);
        if (i >= 0) await play({ action: 'move', conv, msgId, move: `m${i}` }, actor, ctx);
      } else if (Date.now() > g.roundEnds + battles.GRACE_MS) await play({ action: 'move', conv, msgId, move: 'peek' }, actor, ctx);
      setTimeout(step, 1000 + Math.random() * 2000);
    };
    setTimeout(step, 1500 + Math.random() * 1500);
  }

  // A few records so the Battles board has something on it.
  function seed() {
    const s = S();
    if (s.battlesSeeded) return;
    const hoot = docOf('Jackson Lucks');
    const waffles = docOf('Cooper Mlezcko');
    const now = Date.now();
    s.petBattles = [
      ...(hoot ? [{ id: 'jackson-lucks', person: 'Jackson Lucks', pets: { [hoot.adoptedAt]: { name: hoot.name, species: hoot.species, w: 3, l: 1, d: 0 } }, updatedAt: now - DAY }] : []),
      ...(waffles ? [{ id: 'cooper-mlezcko', person: 'Cooper Mlezcko', pets: { [waffles.adoptedAt]: { name: waffles.name, species: waffles.species, w: 1, l: 2, d: 1 } }, updatedAt: now - 2 * DAY }] : []),
    ];
    s.battlesSeeded = 1;
    commit();
  }

  const subscribe = (listen, cb) => listen(() => cb((S().petBattles || []).map((d) => ({ ...d }))));

  return { context, alive, record, drive, seed, subscribe };
}
