// "Export for the notebook" (D6): the lab log turned into plain text for the
// engineering notebook the judges read. Everything comes from data the app
// already has (lab logs, shifts, tasks, milestones); nothing is sent anywhere.
//
// buildNotebook() sorts the logs into weeks and days; notebookMarkdown() and
// notebookCsv() print that. Voice notes and photos are only counted.
import { AREAS, areaById, dayOf, entryAreas, entryTasks, hoursOn, isStructured } from './labLog.js';
import { addDays, mondayOf, parseDay } from './milestones.js';

const first = (name = '') => name.trim().split(/\s+/)[0] || name;
const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const noDot = (s) => oneLine(s).replace(/[.\s]+$/, '');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const LOCALE = 'en-US';
const fmt = (day, opts) => parseDay(day).toLocaleDateString(LOCALE, opts);
export const shortDay = (day) => fmt(day, { month: 'short', day: 'numeric' });
export const longDay = (day) => fmt(day, { weekday: 'long', month: 'short', day: 'numeric' });
const fullDay = (day) => fmt(day, { month: 'short', day: 'numeric', year: 'numeric' });

// "a", "a and b", "a, b and c"
export function joinList(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

// The range choices: the last four weeks, or the season so far (from
// September 1, when the FTC season starts) up to today.
export function presetRange(preset, now = Date.now()) {
  const to = dayOf(now);
  if (preset === 'season') {
    const d = new Date(now);
    const year = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
    return { from: `${year}-09-01`, to };
  }
  return { from: addDays(to, -27), to };
}

// ---------- one person's day, in plain sentences ----------

// "Cooper finished 'Fix the intake' and got stuck on 'Wire the hub' (waiting on a cable)."
export function outcomeSentence(person, tasks) {
  const by = (o) => tasks.filter((t) => (t.outcome || '') === o);
  const title = (t) => `'${oneLine(t.title)}'`;
  const stuck = (t) => `${title(t)}${t.blocker ? ` (${lowerFirst(noDot(t.blocker))})` : ''}`;
  const parts = [
    [by('done'), 'finished', title],
    [by('progress'), 'made progress on', title],
    [by('started'), 'just started', title],
    [by('stuck'), 'got stuck on', stuck],
    [by(''), 'worked on', title],
  ]
    .filter(([list]) => list.length)
    .map(([list, verb, show]) => `${verb} ${joinList(list.map(show))}`);
  return parts.length ? `${first(person)} ${joinList(parts)}.` : '';
}

// ---------- building the notebook ----------

// Everything one log adds to the page. `area` limits the tasks (and the
// areas) to one area; null shows them all.
function entryOf(log, shiftsHours, tasks, area) {
  const items = log ? entryTasks(log, tasks) : [];
  const shown = area ? items.filter((t) => t.area === area) : items;
  const areas = log ? entryAreas(log, tasks) : [];
  const legacy = shown.some((t) => t.blocker) || !log?.blockers ? [] : [noDot(log.blockers)];
  return {
    person: log?.person || '',
    hours: shiftsHours || 0,
    areas: area ? areas.filter((a) => a === area) : areas,
    tasks: shown,
    sentence: log ? outcomeSentence(log.person, shown) : '',
    note: oneLine(log?.note),
    // What is blocking us: older logs kept it as text; newer ones have it on the stuck tasks (and in the sentence).
    legacyBlocking: legacy,
    blocking: legacy.concat(shown.filter((t) => t.outcome === 'stuck' && t.blocker).map((t) => `${oneLine(t.title)}: ${noDot(t.blocker)}`)),
    next: oneLine(log?.next),
    withWho: (log?.workedWith || []).map(first),
    photos: (log?.photos || []).length,
    voice: log?.voice?.url || log?.voice?.path ? 1 : 0,
    chips: log?.chips || [],
    logged: !!log,
  };
}

// logs / shifts under current names. { from, to } are 'YYYY-MM-DD' days on
// this device's clock (the same days the lab log uses).
export function buildNotebook({ logs = [], shifts = [], tasks = [], milestones = [], from, to, area = '', person = '', now = Date.now() }) {
  const inRange = (day) => day >= from && day <= to;
  const mineShifts = shifts.filter((s) => s.person && s.start && (!person || s.person === person));
  const mineLogs = logs.filter((l) => l.day && inRange(l.day) && (!person || l.person === person) && (!area || entryAreas(l, tasks).includes(area)));

  // With an area picked, only people who logged in that area are "in".
  const days = new Set(mineLogs.map((l) => l.day));
  if (!area) for (const s of mineShifts) if (inRange(dayOf(s.start))) days.add(dayOf(s.start));

  const byDay = [...days].sort().map((day) => {
    const hours = hoursOn(day, mineShifts, now);
    const logsToday = mineLogs.filter((l) => l.day === day);
    const names = new Set(logsToday.map((l) => l.person));
    if (!area) for (const n of Object.keys(hours)) names.add(n);
    const entries = [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ ...entryOf(logsToday.find((l) => l.person === n), hours[n], tasks, area), person: n }));
    return {
      day,
      entries,
      hours: Math.round(entries.reduce((t, e) => t + e.hours, 0) * 10) / 10,
      areas: AREAS.map((a) => a.id).filter((a) => entries.some((e) => e.areas.includes(a))),
    };
  });

  const weekMap = new Map();
  for (const d of byDay) {
    const monday = mondayOf(d.day);
    if (!weekMap.has(monday)) weekMap.set(monday, []);
    weekMap.get(monday).push(d);
  }
  const weeks = [...weekMap]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monday, list]) => {
      const sunday = addDays(monday, 6);
      const finished = [];
      for (const d of list) for (const e of d.entries) for (const t of e.tasks) if (t.outcome === 'done') finished.push({ title: oneLine(t.title), person: e.person });
      return {
        monday,
        sunday,
        days: list,
        hours: Math.round(list.reduce((t, d) => t + d.hours, 0) * 10) / 10,
        people: [...new Set(list.flatMap((d) => d.entries.map((e) => e.person)))],
        finished,
        milestones: milestones
          .filter((m) => m.start && m.end && m.start <= sunday && m.end >= monday)
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((m) => ({ title: m.title, start: m.start, end: m.end, done: !!m.done && m.end <= sunday })),
      };
    });

  const all = weeks.flatMap((w) => w.days);
  return {
    from,
    to,
    area,
    person,
    weeks,
    days: all.length,
    hours: Math.round(weeks.reduce((t, w) => t + w.hours, 0) * 10) / 10,
    people: [...new Set(all.flatMap((d) => d.entries.map((e) => e.person)))],
    finished: weeks.reduce((t, w) => t + w.finished.length, 0),
    structured: mineLogs.filter(isStructured).length,
  };
}

// ---------- Markdown ----------

const attached = (e) => {
  const bits = [];
  if (e.photos) bits.push(plural(e.photos, 'photo'));
  if (e.voice) bits.push(plural(e.voice, 'voice note'));
  return bits.join(', ');
};
const areaNames = (ids) => ids.map((a) => areaById[a]?.label || a).join(', ');

export function notebookMarkdown(nb, { team = 'Harry Trotters (FTC 32313)' } = {}) {
  const out = [];
  out.push('# Engineering notebook: lab log', '');
  const scope = [nb.area ? `Area: ${areaById[nb.area]?.label || nb.area}` : 'All areas', nb.person ? `Just ${nb.person}` : 'Everyone'];
  out.push(`${team} · ${fullDay(nb.from)} to ${fullDay(nb.to)} · ${scope.join(' · ')}`, '');
  if (!nb.days) {
    out.push('Nothing was logged in this range.', '');
    return out.join('\n');
  }
  out.push(
    `${plural(nb.days, 'lab day')}, ${plural(nb.people.length, 'person', 'people')}, ${nb.hours.toFixed(1)} h at the lab, ${plural(nb.finished, 'task')} finished.`,
    '',
  );
  for (const w of nb.weeks) {
    out.push(`## Week of ${shortDay(w.monday)} to ${shortDay(w.sunday)}`, '');
    out.push(`${w.hours.toFixed(1)} h at the lab, ${plural(w.people.length, 'person', 'people')}.`, '');
    if (w.milestones.length)
      out.push(`Milestones this week: ${w.milestones.map((m) => `${m.title} (${shortDay(m.start)} to ${shortDay(m.end)}${m.done ? ', done' : ''})`).join('; ')}.`, '');
    if (w.finished.length) out.push(`Finished this week: ${w.finished.map((f) => `'${f.title}' (${first(f.person)})`).join(', ')}.`, '');
    for (const d of w.days) {
      out.push(`### ${longDay(d.day)}`, '');
      out.push(
        `At the lab: ${d.entries.map((e) => `${e.person}${e.hours ? ` (${e.hours.toFixed(1)} h)` : ''}`).join(', ')}. ${d.hours.toFixed(1)} h in all.${d.areas.length ? ` Areas: ${areaNames(d.areas)}.` : ''}`,
        '',
      );
      for (const e of d.entries) {
        const head = `- **${e.person}**${e.hours ? `, ${e.hours.toFixed(1)} h` : ''}${e.areas.length ? ` · ${areaNames(e.areas)}` : ''}`;
        out.push(head);
        if (!e.logged) out.push('  - No lab log for this day.');
        if (e.sentence) out.push(`  - ${e.sentence}`);
        if (e.note) out.push(`  - Note: ${e.note}`);
        if (e.legacyBlocking.length) out.push(`  - What is blocking us: ${e.legacyBlocking.join('; ')}.`);
        if (e.next) out.push(`  - Next time: ${noDot(e.next)}.`);
        if (e.withWho.length) out.push(`  - Worked with ${joinList(e.withWho)}.`);
        if (attached(e)) out.push(`  - Attached in the app: ${attached(e)}.`);
      }
      out.push('');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// ---------- CSV ----------

const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function notebookCsv(nb) {
  const head = ['Date', 'Week of', 'Person', 'Hours', 'Areas', 'Finished', 'Made progress', 'Just started', 'Stuck', 'What is blocking', 'Note', 'Next time', 'Worked with', 'Photos', 'Voice notes', 'Milestones'];
  const rows = [head];
  for (const w of nb.weeks)
    for (const d of w.days)
      for (const e of d.entries) {
        const t = (o) => e.tasks.filter((x) => (x.outcome || '') === o).map((x) => oneLine(x.title)).join('; ');
        rows.push([
          d.day,
          w.monday,
          e.person,
          e.hours ? e.hours.toFixed(1) : '',
          areaNames(e.areas),
          t('done'),
          t('progress'),
          t('started'),
          t('stuck'),
          e.blocking.join('; '),
          e.note,
          e.next,
          e.withWho.join(', '),
          e.photos,
          e.voice,
          w.milestones.map((m) => m.title).join('; '),
        ]);
      }
  return `${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

export const fileStem = (nb) => `lab-log-${nb.from}-to-${nb.to}${nb.area ? `-${nb.area}` : ''}`;
