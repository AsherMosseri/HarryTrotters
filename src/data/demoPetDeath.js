// Pets can die (3.3) in demo mode: the same rule the server runs
// (functions/petdeath.js, shared/petdeath.js) on the demo's own data. The
// check runs when the demo opens and every minute while the pets are shown
// (the server checks a few times a day). Samples: Sophia's fox on day 6 of
// going without food or fun, Matthew's dog asleep while he's inactive,
// Shrey's hedgehog that died yesterday (its card is in #general), an ask
// from Katarina waiting for Asher and pet death already off for Michael.
// Open the demo as Cooper (?demo=member) to ask, and as Asher (?demo) to answer.
import { personId } from './diff.js';
import { REQUESTS_TO } from '../config.js';
import { docOf, giftOpen, newPet, petsIn } from '../../functions/shared/pets.js';
import { teamActivity, inactiveSet } from '../../functions/shared/activity.js';
import {
  answerCheck,
  answerNote,
  askCheck,
  deathNote,
  funeralPost,
  giftsFor,
  memorialId,
  memorialOf,
  neglectWithOff,
  offNames,
  petFate,
  respectsCheck,
  streakStart,
  warnNote,
} from '../../functions/shared/petdeath.js';

const DAY = 86400000;
const H = 3600000;

export function demoPetDeath({ get, commit, uid }) {
  const S = () => get();
  const note = (title, body = '') => ({ note: { title, body } });
  const first = (n) => (n || 'Someone').split(' ')[0];
  const lists = () => {
    const s = S();
    s.petMemorials ||= [];
    s.petDeathOff ||= [];
    return s;
  };
  const renamer = () => {
    const all = S().renames || {};
    const rename = (name) => {
      let n = name;
      for (let i = 0; i < 10 && all[n] && all[n] !== n; i++) n = all[n];
      return n;
    };
    rename.aliases = (name) => [name, ...Object.keys(all).filter((k) => k !== name && rename(k) === name)];
    return rename;
  };
  const tell = (to, title, body, icon = '🐾') => {
    const s = S();
    s.inbox = [{ id: uid(), type: 'market', icon, title, body, open: 'view:market', at: Date.now(), read: false, to }, ...(s.inbox || [])];
  };
  const post = (msg, id) => {
    const s = S();
    const general = ((s.chat || {}).general || []).filter((m) => m.id !== id);
    s.chat = { ...(s.chat || {}), general: [...general, { id, ...msg }] };
  };

  // Who's inactive right now (shared/activity.js, as the app and server ask).
  function asleepNames(names, rename, now) {
    const s = S();
    return inactiveSet(teamActivity(names, { shifts: s.shifts || [], people: s.people || [], roles: s.roles || [], overrides: s.settings?.inactive || null, rename, now }));
  }

  // The server's petCare, on the demo's pets. Returns whether anything changed.
  function sweep(now = Date.now()) {
    const s = lists();
    const rename = renamer();
    const owners = [...new Set((s.pets || []).map((d) => rename(d.person || '')).filter(Boolean))];
    if (!owners.length) return false;
    const asleep = asleepNames(owners, rename, now);
    // With Jackson coins off nobody can buy pet food, so every pet sleeps (like the server).
    if ((s.controls?.off || []).includes('coins')) owners.forEach((n) => asleep.add(n));
    const off = offNames(s.petDeathOff, rename);
    let changed = false;
    const docs = [];
    for (const doc of s.pets || []) {
      const person = rename(doc.person || '');
      const list = petsIn(doc);
      const fates = list.map((p) => petFate(p, { now, asleep: asleep.has(person), off: off.has(person) }));
      if (!fates.some((f) => f.patch || f.status === 'dies')) {
        docs.push(doc);
        continue;
      }
      changed = true;
      const keep = [];
      list.forEach((p, i) => {
        const f = fates[i];
        if (f.status !== 'dies') {
          keep.push(f.patch ? { ...p, neglect: f.patch } : p);
          if (f.warn) {
            const w = warnNote(p.name || 'Your pet', f.warn);
            tell(person, w.title, w.body);
          }
          return;
        }
        const id = memorialId(doc.id || personId(doc.person), p);
        if (s.petMemorials.some((m) => m.id === id)) return;
        const photo = i === 0 && p.photoAsPet === true ? (s.petPhotos || []).find((x) => rename(x.by || '') === person) || null : null;
        const m = memorialOf(p, { id, person, shifts: s.shifts || [], now, photo });
        s.petMemorials.push(m);
        post(funeralPost(m), m.msgId);
        for (const g of giftsFor(s.petGifts || [], p, (x) => giftOpen(x, now) && rename(x.from) === person)) {
          Object.assign(g, { status: 'cancelled', decidedAt: now, why: 'died' });
          tell(rename(g.to), `${m.name} can’t come to you after all`, `${m.name} crossed the rainbow bridge, so ${first(person)}’s offer was cancelled.`, '🌈');
        }
        const d = deathNote(m);
        tell(person, d.title, d.body, '🌈');
      });
      const next = docOf(doc.person, keep);
      if (next) docs.push({ ...next, id: doc.id || personId(doc.person) });
    }
    if (changed) s.pets = docs;
    return changed;
  }

  // The `pet` callable's death actions (functions/petdeath.js run).
  function run(data, actor) {
    const s = lists();
    const me = actor.name;
    const now = Date.now();
    const rename = renamer();
    if (data.action === 'respects') {
      const m = s.petMemorials.find((x) => x.id === data.id) || null;
      const r = respectsCheck(m, { me, rename, now });
      if (r.note) return r;
      if (r.respects) {
        m.respects = r.respects;
        commit();
      }
      return { ok: true, already: !!r.already };
    }
    if (data.action === 'deathAsk') {
      const id = personId(me);
      const doc = s.petDeathOff.find((x) => x.id === id) || null;
      const r = askCheck(data, { me, doc, owner: REQUESTS_TO, now });
      if (r.note) return r;
      s.petDeathOff = [...s.petDeathOff.filter((x) => x.id !== id), { ...r.doc, id }];
      if (r.doc.status === 'off') markPets(me, true, now);
      else tell(REQUESTS_TO, `${first(me)} asked to turn off pet death`, r.doc.reason ? `“${r.doc.reason}” Answer in Market, Pets.` : 'Answer in Market, Pets.');
      commit();
      return { ok: true, status: r.doc.status };
    }
    if (data.action === 'deathAnswer') {
      if (!actor.admin || me !== REQUESTS_TO) return note('Only Asher can answer these.');
      const doc = s.petDeathOff.find((x) => x.id === data.id) || null;
      const r = answerCheck(data, { doc, me, now });
      if (r.note) return r;
      Object.assign(doc, r.doc);
      const who = rename(doc.by || '');
      if (r.told !== 'declined') markPets(who, r.told === 'off', now);
      const n = answerNote(r.told, r.doc);
      tell(who, n.title, n.body);
      commit();
      return { ok: true, status: r.doc.status };
    }
    return note('Unknown action.');
  }
  function markPets(person, off, now) {
    const s = S();
    const rename = renamer();
    s.pets = (s.pets || []).map((doc) =>
      rename(doc.person || '') === person ? { ...docOf(doc.person, petsIn(doc).map((p) => ({ ...p, neglect: neglectWithOff(p.neglect, off, now) }))), id: doc.id } : doc,
    );
  }

  // The samples, set up once on the demo's own pets (demoEvents.js put them
  // in the park; a missing one is made).
  function seedSamples() {
    const s = lists();
    if (s.petDeathSeeded) return;
    s.petDeathSeeded = 1;
    const now = Date.now();
    const shape = (person, made, fn) => {
      const i = (s.pets || []).findIndex((p) => p.person === person);
      const doc = i >= 0 ? s.pets[i] : { ...made, id: personId(person), person };
      const next = { ...doc, ...fn(doc) };
      s.pets = i >= 0 ? s.pets.map((p, k) => (k === i ? next : p)) : [...(s.pets || []), next];
    };
    // Sophia's fox: nothing to eat or do for 6 days and a few hours (she was
    // told on days 3, 5 and 6). Fed in time, it's fine; if not, it dies a day later.
    shape('Sophia Bermudez', newPet('fox', 'Ember', now - 34 * DAY), (p) => {
      const empty = now - 6 * DAY - 2 * H;
      const pet = { ...p, food: { v: 0, at: empty }, fun: { v: 0, at: empty } };
      return { food: pet.food, fun: pet.fun, neglect: { from: now - 30 * DAY, start: streakStart(pet, now - 30 * DAY, now), stage: 6, asleep: false, off: false } };
    });
    // Matthew's dog: hungry and bored for weeks, but he's inactive, so it sleeps.
    shape('Matthew Kuehl', newPet('dog', 'Pepper', now - 60 * DAY), () => ({
      food: { v: 0, at: now - 25 * DAY },
      fun: { v: 0, at: now - 25 * DAY },
      neglect: { from: now - 30 * DAY, start: 0, stage: 0, asleep: true, off: false },
    }));
    // Michael's frog: pet death is off for him (Asher said yes).
    shape('Michael Meidan', newPet('frog', 'Pogo', now - 15 * DAY), (p) => ({ neglect: { from: p.adoptedAt || now, start: 0, stage: 0, asleep: false, off: true } }));
    s.petDeathOff = [
      ...s.petDeathOff.filter((x) => !['michael-meidan', 'katarina-jurasic'].includes(x.id)),
      { id: 'michael-meidan', by: 'Michael Meidan', status: 'off', reason: 'I’m at robotics camp all of December', at: now - 6 * DAY, note: 'Have fun at camp!', decidedBy: REQUESTS_TO, decidedAt: now - 5 * DAY },
      { id: 'katarina-jurasic', by: 'Katarina Jurasic', status: 'pending', reason: 'Family trip for two weeks, no phone', at: now - 3 * H, note: '', decidedBy: '', decidedAt: 0 },
    ];
    // Shrey's hedgehog (he has his cassowary too): died yesterday. Its
    // memorial and funeral card, made the way the server makes them, with one
    // teammate's respects.
    if (!s.petMemorials.some((m) => m.person === 'Shrey Kumar')) {
      const born = now - 45 * DAY;
      const died = now - 20 * H;
      const pet = { ...newPet('hedgehog', 'Noodle', born), gear: { head: 'cap', face: '', neck: 'bandana', body: '', extra: '', palette: '' } };
      const m = memorialOf(pet, { id: memorialId('shrey-kumar', pet), person: 'Shrey Kumar', shifts: s.shifts || [], now: died });
      m.respects = [{ name: 'Jackson Lucks', at: died + 2 * H }];
      s.petMemorials.push(m);
      post(funeralPost(m), m.msgId);
    }
  }

  return {
    sweep,
    run,
    seedSamples,
    subscribeMemorials(listen, cb) {
      return listen(() => cb(lists().petMemorials.map((m) => ({ ...m }))));
    },
    subscribeAsks(listen, actor, cb) {
      const owner = actor.admin && actor.name === REQUESTS_TO;
      return listen(() => cb(lists().petDeathOff.filter((x) => owner || x.by === actor.name).map((x) => ({ ...x }))));
    },
  };
}
