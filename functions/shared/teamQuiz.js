// "Who did this?" (G8) and "Robot timeline" (G9): questions made from the
// team's own data (lab logs, finished tasks, robot versions, milestones).
// The server builds them and keeps the answer; demo mode runs the same code
// on its sample data. Nothing here is a secret by itself: it's the team's
// data, which everyone can already see in the app.

const DAY = 86400000;
const first = (name = '') => name.split(' ')[0];

function seeded(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffleBy(list, seed) {
  const out = [...list];
  const r = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const dateText = (ms) =>
  new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
const dayText = (iso) => dateText(Date.parse(`${iso}T12:00:00Z`));

// Text that names the person gives the answer away.
const namesSomeone = (text, person) => {
  const f = first(person).toLowerCase();
  return f.length > 2 && new RegExp(`\\b${f.replace(/[^a-z]/g, '')}\\b`, 'i').test(text);
};

// Everything that could be a "who did this?" question, newest first:
// lab logs with something to read, and tasks finished by one person, from
// the last `days` days. `rename` maps old names to current ones.
export function whoItems({ logs = [], tasks = [], rename = (n) => n, now = Date.now(), days = 120 }) {
  const since = now - days * DAY;
  const out = [];
  for (const l of logs) {
    const person = rename(l.person || '');
    const at = l.at || Date.parse(`${l.day}T20:00:00Z`);
    if (!person || !l.day || at < since) continue;
    const note = String(l.note || '').trim();
    const tasksDone = (l.tasks || []).map((t) => String(t.title || '').trim()).filter(Boolean);
    if (note.length < 12 && !tasksDone.length) continue;
    const text = note || `Worked on: ${tasksDone.slice(0, 3).join('; ')}`;
    if (namesSomeone(`${text} ${tasksDone.join(' ')}`, person)) continue;
    out.push({
      id: `log-${l.id}`,
      kind: 'log',
      person,
      at,
      text: text.slice(0, 400),
      areas: (l.areas || []).slice(0, 4),
      tasks: note ? tasksDone.slice(0, 3) : [],
      when: dayText(l.day),
    });
  }
  for (const t of tasks) {
    const who = [...new Set((t.assignees || []).map(rename))];
    const at = t.completedAt || 0;
    if (t.deletedAt || t.status !== 'done' || who.length !== 1 || !at || at < since) continue;
    const title = String(t.title || '').trim();
    if (title.length < 6 || namesSomeone(title, who[0])) continue;
    out.push({ id: `task-${t.id}`, kind: 'task', person: who[0], at, text: title.slice(0, 200), subteam: t.subteam || '', when: dateText(at) });
  }
  return out.sort((a, b) => b.at - a.at);
}

// The next "who did this?" for `me`: the newest item they haven't seen (not
// their own), with four people to pick from. Returns { question, answer,
// explain, id } or null when there's nothing new.
export function whoQuestion(items, { me, seen = [], roster = [], seed = '' }) {
  const done = new Set(seen);
  const pool = items.filter((i) => i.person !== me && !done.has(i.id));
  if (!pool.length) return null;
  // Mostly recent: pick among the 6 newest so it doesn't feel like a list.
  const pick = shuffleBy(pool.slice(0, 6), `${seed}|${seen.length}`)[0];
  const people = [...new Set([...items.map((i) => i.person), ...roster])].filter((n) => n && n !== pick.person && n !== me);
  const wrong = shuffleBy(people, `${seed}|${pick.id}`).slice(0, 3);
  if (wrong.length < 1) return null;
  const choices = shuffleBy([pick.person, ...wrong], `${pick.id}|c`);
  const verb = pick.kind === 'log' ? 'logged this' : 'finished this task';
  return {
    id: pick.id,
    answer: choices.indexOf(pick.person),
    explain: `${pick.person} ${verb} on ${pick.when}.`,
    question: {
      id: pick.id,
      bank: 'who',
      kind: 'choice',
      difficulty: 1,
      prompt: pick.kind === 'log' ? 'Who wrote this lab log?' : 'Who finished this task?',
      entry: { kind: pick.kind, text: pick.text, areas: pick.areas || [], tasks: pick.tasks || [], subteam: pick.subteam || '', when: pick.when },
      choices,
    },
  };
}

// Robot timeline: robot versions and milestones with a date each.
export function timelineItems({ versions = [], milestones = [] }) {
  const out = [];
  for (const v of versions) {
    if (!v.at || !v.name || v.sample) continue;
    out.push({ id: `v-${v.id}`, kind: 'version', label: String(v.name).slice(0, 80), at: v.at, sub: 'Robot version' });
  }
  for (const m of milestones) {
    const day = m.start || m.end;
    if (!day || !m.title) continue;
    out.push({ id: `m-${m.id}`, kind: 'milestone', label: String(m.title).slice(0, 80), at: Date.parse(`${day}T12:00:00Z`), sub: m.subteam ? `Milestone · ${m.subteam}` : 'Milestone' });
  }
  return out.filter((i) => Number.isFinite(i.at)).sort((a, b) => a.at - b.at);
}

// Four (or three) items at least a day apart, in a set `me` hasn't had.
export function timelineQuestion(items, { seen = [], seed = '' }) {
  if (items.length < 3) return null;
  const done = new Set(seen);
  const size = Math.min(4, items.length);
  for (let tries = 0; tries < 60; tries++) {
    const pick = [];
    for (const it of shuffleBy(items, `${seed}|${seen.length}|${tries}`)) {
      if (pick.every((p) => Math.abs(p.at - it.at) >= DAY)) pick.push(it);
      if (pick.length === size) break;
    }
    if (pick.length < 3) continue;
    const key = pick
      .map((p) => p.id)
      .sort()
      .join('+');
    if (done.has(key)) continue;
    const order = [...pick].sort((a, b) => a.at - b.at);
    const shown = shuffleBy(pick, `${key}|shown`);
    // Never show them already in order.
    if (shown.every((p, i) => p.id === order[i].id)) shown.reverse();
    return {
      id: `t-${key}`,
      key,
      order: order.map((p) => p.id),
      dates: Object.fromEntries(order.map((p) => [p.id, dateText(p.at)])),
      question: {
        id: `t-${key}`,
        bank: 'timeline',
        kind: 'order',
        difficulty: 2,
        prompt: 'Put these in order, oldest first.',
        items: shown.map((p) => ({ id: p.id, kind: p.kind, label: p.label, sub: p.sub })),
      },
    };
  }
  return null;
}
