// Team events in demo mode: the same rules the server runs
// (functions/petevents.js, with the math in functions/shared/events.js), on the
// demo's own data. A sample event is already running with some progress, and a
// handful of teammates have pets, so the pet park has something to show.
import { COIN_DEFAULTS, nextMidnight, teamDay, teamMidnight } from '../../functions/shared/coins.js';
import { dayOf, logId } from '../labLog.js';
import { eventGearItem } from '../../functions/shared/pets.js';
import { MAX_OPEN_EVENTS, advance, cleanEvent, stale, statusOf, unlockAfter } from '../../functions/shared/events.js';

export function demoEvents({ get, commit, uid }) {
  const S = () => get();
  const note = (title, body = '') => ({ note: { title, body } });

  // Does the sums for one event; gives out what its new tiers give.
  function settle(ev, force = false) {
    const s = S();
    const now = Date.now();
    if (!stale(ev, now, force)) return;
    const r = advance(ev, s.shifts || [], { now, dayCapHours: COIN_DEFAULTS.dayCap });
    Object.assign(ev, r.patch);
    const give = [];
    for (const n of r.newly) {
      const gear = n.gear ? eventGearItem(n.gear) : null;
      for (const p of n.people) {
        if (gear) give.push({ p, g: { id: gear.id, event: ev.id, title: ev.title, tier: n.tier, at: now } });
        s.inbox = [
          {
            id: uid(),
            type: 'market',
            icon: '🎉',
            title: `${ev.title}: ${n.label} reached`,
            body: gear ? `The team hit ${n.hours} hours. You earned the ${gear.name}. Open Market, Pets, Style to put it on.` : `The team hit ${n.hours} hours. Thanks for putting in your time.`,
            open: gear ? 'view:market' : 'view:today',
            at: now,
            read: false,
            to: p,
          },
          ...(s.inbox || []),
        ];
      }
    }
    s.petUnlocks = s.petUnlocks || [];
    for (const { p, g } of give) {
      const at = s.petUnlocks.findIndex((u) => u.person === p);
      const doc = unlockAfter(at < 0 ? null : s.petUnlocks[at], p, [g]);
      if (at < 0) s.petUnlocks.push({ id: p, ...doc });
      else s.petUnlocks[at] = { ...s.petUnlocks[at], ...doc };
    }
  }
  const settleAll = (force = false) => {
    for (const ev of S().petEvents || []) settle(ev, force);
  };

  // Called once at start-up: a running event with progress, pets for the park.
  function seedSamples() {
    const s = S();
    if (s.petEventsSeeded) return;
    const now = Date.now();
    const day = 86400000;
    const hour = 3600000;
    const at = (back, h) => teamMidnight(teamDay(now - back * day)) + h * hour;
    // Lab time inside the event's days (two days back until yesterday).
    const lab = [
      ['Asher Mosseri', 1, 15, 3],
      ['Jackson Lucks', 2, 14, 4],
      ['Jackson Lucks', 1, 15, 3],
      ['Sophia Bermudez', 1, 16, 2.5],
      ['Cooper Mlezcko', 2, 15, 2],
      ['Sebastian Tolbert', 1, 13, 3],
      ['Michael Meidan', 2, 16, 1.5],
      ['Katarina Jurasic', 1, 17, 1],
      ['Katarina Jurasic', 2, 17, 1],
    ];
    const added = lab.map(([person, back, h, len]) => ({ id: uid(), person, start: at(back, h), end: at(back, h) + len * hour, note: '', subteam: '', taskIds: [], createdBy: person, at: at(back, h) }));
    s.shifts = [...(s.shifts || []), ...added];
    // A lab log for each of those days, so nobody is asked to log them.
    s.labLogs = s.labLogs || [];
    for (const sh of added) {
      const id = logId(dayOf(sh.start), sh.person);
      if (s.labLogs.some((l) => l.id === id)) continue;
      s.labLogs.push({ id, day: dayOf(sh.start), person: sh.person, uid: 'demo', note: 'Helped out around the lab.', taskIds: [], doneTaskIds: [], photos: [], blockers: '', next: '', at: sh.end });
    }
    s.petEvents = [
      {
        id: 'competition-week-demo',
        title: 'Competition week',
        startsAt: teamMidnight(teamDay(now - 2 * day)),
        endsAt: nextMidnight(teamDay(now + 3 * day)),
        goalHours: 60,
        tiers: [
          { hours: 20, label: 'Warm-up' },
          { hours: 40, label: 'Halfway', gear: 'pitcrew-cap' },
          { hours: 60, label: 'Goal', gear: 'medal-nov14' },
        ],
        reward: { gear: ['pitcrew-cap', 'medal-nov14'] },
        createdBy: 'Asher Mosseri',
        createdAt: now - 3 * day,
        status: 'active',
      },
    ];
    s.petUnlocks = s.petUnlocks || [];

    // More pets so the park isn't empty (Asher's Bolt and Jackson's Hoot are
    // already there; Bolt's baby is born here).
    const need = (food, fun) => ({ food: { v: food, at: now - 2 * hour }, fun: { v: fun, at: now - 2 * hour } });
    const pet = (person, species, name, ago, food, fun, gear = {}) => ({
      id: person.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      person,
      species,
      name,
      adoptedAt: now - ago * day,
      ...need(food, fun),
      inChat: true,
      cared: 2,
      gear: { head: '', face: '', neck: '', extra: '', palette: '', ...gear },
      babyBorn: false,
    });
    const have = new Set((s.pets || []).map((p) => p.person));
    const more = [
      pet('Cooper Mlezcko', 'bunny', 'Clover', 9, 85, 70),
      pet('Sophia Bermudez', 'fox', 'Ember', 14, 75, 90, { neck: 'bandana' }),
      pet('Sebastian Tolbert', 'panda', 'Bao', 16, 90, 80),
      pet('Michael Meidan', 'frog', 'Pogo', 6, 40, 55),
      pet('Katarina Jurasic', 'cat', 'Mochi', 11, 20, 30),
      pet('Shrey Kumar', 'cassowary', 'Casey', 5, 80, 85),
      pet('Ira Kumar', 'monkey', 'Gus', 8, 65, 60),
      pet('Matthew Kuehl', 'dog', 'Pepper', 4, 15, 10),
    ].filter((p) => !have.has(p.person));
    s.pets = [...(s.pets || []), ...more];
    const bolt = (s.pets || []).find((p) => p.person === 'Asher Mosseri');
    if (bolt && !bolt.extra) {
      bolt.babyBorn = true;
      bolt.extra = {
        species: bolt.species,
        name: 'Sparky',
        adoptedAt: now - 3 * day,
        ...need(85, 85),
        inChat: true,
        cared: 0,
        gear: { head: '', face: '', neck: '', extra: '', palette: '' },
        babyBorn: false,
      };
    }
    s.petEventsSeeded = 1;
    settleAll(true);
    // The sample progress shouldn't leave the bell ringing for it.
    s.inbox = (s.inbox || []).map((n) => (n.title?.startsWith('Competition week:') ? { ...n, read: true } : n));
  }

  // The same moves as the petEvent callable.
  function petEvent(req = {}, actor) {
    const s = S();
    const me = actor.name;
    const now = Date.now();
    const done = (r) => {
      commit();
      return r;
    };
    const action = req.action;
    if (action === 'refresh') {
      settleAll(true);
      return done({ ok: true });
    }
    if (action === 'seen') {
      const g = String(req.gear || '');
      if (!eventGearItem(g)) return note('Which reward?');
      const u = (s.petUnlocks || []).find((x) => x.person === me);
      if (!u?.gear?.[g]) return note('That isn’t yours.');
      if (!u.seen?.[g]) u.seen = { ...(u.seen || {}), [g]: now };
      return done({ ok: true });
    }
    if (!['create', 'edit', 'end'].includes(action)) return note('Unknown action.');
    if (!actor.admin) return note('Team management only.');
    s.petEvents = s.petEvents || [];
    if (action === 'create') {
      const r = cleanEvent(req, { me, now });
      if (r.error) return note(r.error);
      if (s.petEvents.filter((e) => ['upcoming', 'live'].includes(statusOf(e, now))).length >= MAX_OPEN_EVENTS)
        return note('That’s a lot of events.', `End one before starting another (${MAX_OPEN_EVENTS} at a time).`);
      const ev = { id: `ev${uid()}`, ...r.event };
      s.petEvents.push(ev);
      settle(ev, true);
      return done({ ok: true, id: ev.id });
    }
    const ev = s.petEvents.find((e) => e.id === req.id);
    if (!ev) return note('That event is gone.');
    if (action === 'end') {
      if (statusOf(ev, now) === 'ended') return note('Already ended.');
      Object.assign(ev, { status: 'ended', endedAt: now, endedBy: me });
      settle(ev, true);
      return done({ ok: true });
    }
    const c = cleanEvent(req, { me, now, existing: ev });
    if (c.error) return note(c.error);
    Object.assign(ev, c.event);
    settle(ev, true);
    return done({ ok: true, id: ev.id });
  }

  return { seedSamples, petEvent };
}
