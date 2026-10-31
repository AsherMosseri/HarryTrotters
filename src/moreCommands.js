// The 3.0 slash commands: fun, text, robotics help (rules from the manual,
// calculators, code, tips) and team lookups. commands.js lists them with the
// rest and runs them through runMore(); chat/Commands.jsx draws their cards
// (most use the shared "info" card: a title, rows, lines, code and a citation).

import { CHEERS, COMPLIMENTS, FACTS, HOT_TAKES, HYPE, JOKES, RIDDLES } from './funContent.js';
import { EXPLAIN, EXPLAIN_ALIASES, JAVA, JAVA_ALIASES, TIPS, TIP_AREAS } from './learnContent.js';
import * as R from './robotics.js';
import { SUBTEAMS } from './config.js';
import { daysBetween, todayISO } from './teamCommands.js';
import { mergedMs, hoursOf } from '../functions/shared/hours.js';
import { streaksOf, weekStart, addDay } from '../functions/shared/streaks.js';
import { seasonStats, versusLastWeek } from '../functions/shared/stats.js';
import { teamDay, teamMidnight } from '../functions/shared/coins.js';
import { nextMatch } from '../functions/shared/matches.js';

export const MORE_GROUPS = [['learn', 'Robotics help']];

export const MORE_COMMANDS = [
  // Fun
  { name: 'joke', group: 'random', args: '', desc: 'A robotics joke (tap for the punchline)' },
  { name: 'riddle', group: 'random', args: '', desc: 'A riddle; the answer is hidden until tapped' },
  { name: 'fact', group: 'random', args: '', desc: 'A true STEM or FIRST fact' },
  { name: 'compliment', group: 'random', args: '@person', desc: 'Say something nice about someone' },
  { name: 'hype', group: 'random', args: '@person', desc: 'Hype someone up before a match' },
  { name: 'cheer', group: 'random', args: '', desc: 'A Harry Trotters team cheer' },
  { name: 'hottake', group: 'random', args: '', desc: 'An FTC hot take: everyone votes agree or disagree' },
  { name: 'vs', group: 'random', args: 'this | that', desc: 'A quick two-way vote' },
  { name: 'bestof', group: 'random', args: '3', desc: 'Flip a coin best of 3 (or 5, 7…)' },
  { name: 'pick', group: 'random', args: 'subteam', desc: 'Pick a random teammate (at the lab, or from a subteam)' },
  { name: 'teams', group: 'random', args: '2 @a @b @c…', desc: 'Split people into teams (at the lab if nobody’s named)' },
  { name: 'order', group: 'random', args: '@a @b @c…', desc: 'A random order (who drives first?)' },
  { name: 'timer', group: 'random', args: '2m30s label', desc: 'A countdown everyone can see (drive practice, breaks)' },
  // Text
  { name: 'reverse', group: 'text', args: 'message', desc: 'egassem ruoy sesreveR' },
  { name: 'upside', group: 'text', args: 'message', desc: 'Turns your message upside down' },
  { name: 'morse', group: 'text', args: 'message', desc: 'Text to Morse code (or Morse back to text)' },
  { name: 'binary', group: 'text', args: 'message', desc: 'Text to binary (or binary back to text)' },
  // Robotics help
  { name: 'rule', group: 'learn', args: 'G407 | word', desc: 'Look up a game manual rule by number, or search them' },
  { name: 'define', group: 'learn', args: 'term', desc: 'A term from the game manual’s glossary' },
  { name: 'scoring', group: 'learn', args: '', desc: 'This season’s point values and ranking points' },
  { name: 'matchtime', group: 'learn', args: '', desc: 'How long AUTO, the transition and TELEOP are' },
  { name: 'penalty', group: 'learn', args: '', desc: 'Fouls and cards: what each one costs' },
  { name: 'size', group: 'learn', args: '', desc: 'Robot size limits (start and expanded)' },
  { name: 'motors', group: 'learn', args: '', desc: 'Which motors and servos are legal, and how many' },
  { name: 'battery', group: 'learn', args: '', desc: 'Battery rules and what the voltage means' },
  { name: 'wire', group: 'learn', args: '18', desc: 'Wire sizes the rules require, and AWG facts' },
  { name: 'awards', group: 'learn', args: '', desc: 'The judged awards and what each is for' },
  { name: 'ticks', group: 'learn', args: '312 96mm', desc: 'Encoder ticks per turn (and per inch) for a motor' },
  { name: 'gear', group: 'learn', args: '312 2:1 96mm', desc: 'Gear ratio math: speed, torque, wheel speed' },
  { name: 'speed', group: 'learn', args: '312 96mm', desc: 'How fast a wheel at that RPM drives' },
  { name: 'convert', group: 'learn', args: '10 in to mm', desc: 'Units: length, mass, torque, speed, angle, temp' },
  { name: 'ohm', group: 'learn', args: '12V 2A', desc: 'Ohm’s law: give two of volts, amps, ohms, watts' },
  { name: 'calc', group: 'learn', args: '2*pi*48', desc: 'A calculator (sqrt, sin, cos in degrees, pi)' },
  { name: 'java', group: 'learn', args: 'topic', desc: 'FTC Java snippets (motor, imu, mecanum, servo…)' },
  { name: 'explain', group: 'learn', args: 'RUN_TO_POSITION', desc: 'What an FTC term means (PID, odometry, BRAKE…)' },
  { name: 'tip', group: 'learn', args: 'wiring | code | build…', desc: 'A practical FTC tip' },
  // Team
  { name: 'lab', group: 'team', args: '', desc: 'Who’s at the lab right now, and for how long' },
  { name: 'hours', group: 'team', args: '@person', desc: 'Hours today, this week and this season' },
  { name: 'top', group: 'team', args: '', desc: 'Most lab hours this week' },
  { name: 'streak', group: 'team', args: '@person', desc: 'School-day and weekly lab streaks' },
  { name: 'stats', group: 'team', args: '', desc: 'Team hours, tasks and practice runs, this week vs last' },
  { name: 'nextmatch', group: 'team', args: '', desc: 'Our next match at the competition' },
  { name: 'milestone', group: 'team', args: '', desc: 'The next milestones coming up' },
  { name: 'due', group: 'team', args: 'me', desc: 'Tasks due in the next 7 days (yours with “me”)' },
  { name: 'tasks', group: 'team', args: '@person', desc: 'Someone’s open tasks' },
  { name: 'unassigned', group: 'team', args: '', desc: 'Open tasks nobody has taken' },
  { name: 'blocked', group: 'team', args: '', desc: 'Tasks that are stuck, and why' },
  { name: 'roster', group: 'team', args: 'subteam', desc: 'Who’s on a subteam (or all subteams)' },
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const first = (n) => n.split(' ')[0];
const fmt = (n, p = 1) => R.round(n, p).toLocaleString('en-US');

// Everyone named in the text: "@Full Name", or first names.
function namesIn(text, roster) {
  const t = ` ${text.toLowerCase()} `;
  const out = [];
  for (const n of [...roster].sort((a, b) => b.length - a.length))
    if (t.includes(`@${n.toLowerCase()}`) && !out.includes(n)) out.push(n);
  for (const w of t.replace(/@\S+(\s\S+)?/g, ' ').split(/[\s,]+/)) {
    const n = w && roster.find((r) => r.toLowerCase().split(' ')[0] === w);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
const subteamIn = (text) => SUBTEAMS.find((s) => s.toLowerCase().startsWith(text.trim().toLowerCase()) && text.trim().length >= 2) || null;

// "2m30s", "90s", "5m", "1:30", "10" (minutes) → ms.
export function parseDuration(text) {
  const t = String(text || '').trim().toLowerCase();
  const clock = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (clock) return (+clock[1] * 60 + +clock[2]) * 1000;
  if (/^\d+$/.test(t)) return +t * 60000;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)/g;
  let ms = 0;
  let any = false;
  for (const m of t.matchAll(re)) {
    any = true;
    const u = m[2][0];
    ms += +m[1] * (u === 'h' ? 3600000 : u === 'm' ? 60000 : 1000);
  }
  return any ? ms : null;
}

// Rule numbers like "G407", "g 407", "r-102".
const RULE_ID = /^([gretiacl])\s*-?\s*(\d{3})$/i;

// ctx: what commands.js passes (actor, roster, tasks, shifts, milestones,
// matches, subteamsOf, onShift, runs). card(result, extra) posts a card;
// note(...) answers only you.
export async function runMore({ cmd, args }, ctx, { card: post, need }) {
  // Firestore can't store a list inside a list: rows and groups go in as
  // { c: [...] } and { names: [...] } (MoreCards.jsx reads both shapes).
  const card = (result, extra) =>
    post(
      {
        ...result,
        ...(result.rows && { rows: result.rows.map((c) => ({ c })) }),
        ...(result.rows2 && { rows2: result.rows2.map((c) => ({ c })) }),
        ...(result.groups && { groups: result.groups.map((names) => ({ names })) }),
      },
      extra,
    );
  const me = ctx.actor.name;
  const roster = ctx.roster || [];
  const info = (title, more = {}, extra) => card({ view: 'info', title, ...more }, extra);
  const note = (title, body = '') => ({ note: { title, body } });
  const now = Date.now();
  const shifts = ctx.shifts || [];
  const tasks = (ctx.tasks || []).filter((t) => !t.deletedAt);
  const open = tasks.filter((t) => t.status !== 'done');
  const taskRow = (t) => ({ id: t.id, title: t.title || 'Untitled', due: t.dueDate || '', who: t.assignees || [], status: t.status, reason: t.blockedReason || '' });

  switch (cmd.name) {
    // ---------- fun ----------
    case 'joke': {
      const [setup, punch] = pick(JOKES);
      return card({ view: 'reveal', top: setup, hidden: punch, hint: 'Tap for the punchline' });
    }
    case 'riddle': {
      const [q, a] = pick(RIDDLES);
      return card({ view: 'reveal', top: q, hidden: a, hint: 'Tap for the answer' });
    }
    case 'fact':
      return info('Fact', { lines: [pick(FACTS)] });
    case 'compliment':
    case 'hype': {
      const to = args ? namesIn(args, roster)[0] : null;
      if (!to) return need('someone (@name)');
      const line = cmd.name === 'hype' ? pick(HYPE) : pick(COMPLIMENTS);
      return card({ view: 'shout', to, line, name: cmd.name }, { mentions: to !== me ? [to] : [] });
    }
    case 'cheer':
      return card({ view: 'cheer', line: pick(CHEERS) });
    case 'hottake':
    case 'vs': {
      let options;
      let question;
      if (cmd.name === 'hottake') {
        question = `Hot take: ${pick(HOT_TAKES)}`;
        options = ['Agree', 'Disagree'];
      } else {
        options = args
          .split(/\s*\|\s*|\s+vs\.?\s+|\s+or\s+/i)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 2);
        if (options.length < 2) return note('Two things to vote on', 'Try: /vs pizza | tacos');
        question = `${options[0]} or ${options[1]}?`;
      }
      return {
        post: {
          text: '',
          cmd: { name: cmd.name },
          poll: { question, options: options.map((text, i) => ({ id: 'ab'[i], text: text.slice(0, 80) })), multi: false },
          votes: {},
        },
      };
    }
    case 'bestof': {
      const n = Math.max(1, Math.min(15, +(args.match(/\d+/)?.[0] || 3) | 1));
      const flips = [];
      let h = 0;
      let t = 0;
      const need2 = Math.ceil(n / 2);
      while (h < need2 && t < need2) {
        const side = Math.random() < 0.5 ? 'H' : 'T';
        flips.push(side);
        if (side === 'H') h++;
        else t++;
      }
      return info(`Best of ${n}: ${h > t ? 'Heads' : 'Tails'} wins`, { flips, rows: [['Heads', String(h)], ['Tails', String(t)]] });
    }
    case 'pick':
    case 'teams':
    case 'order': {
      const sub = cmd.name === 'pick' && args ? subteamIn(args) : null;
      const named = namesIn(args, roster);
      const here = (ctx.onShift?.() || []).map((p) => p.name);
      let pool = named.length >= 2 ? named : sub ? roster.filter((n) => (ctx.subteamsOf?.(n) || []).includes(sub)) : here;
      if (cmd.name !== 'pick' && named.length < 2 && !here.length)
        return note('Who?', `Name at least two people (/${cmd.name} @Cooper @Sophia…), or use it when people are at the lab.`);
      if (!pool.length) pool = roster.filter((n) => n !== me);
      const from = sub ? `from ${sub}` : named.length >= 2 ? 'from the people named' : here.length ? 'from who’s at the lab' : 'from the team';
      if (cmd.name === 'pick') {
        const who = pick(pool);
        return card({ view: 'people', title: `I pick ${first(who)}`, groups: [[who]], sub: from }, { mentions: who !== me ? [who] : [] });
      }
      if (cmd.name === 'order') return card({ view: 'people', title: 'The order', numbered: true, groups: [shuffle(pool)], sub: from });
      const k = Math.max(2, Math.min(pool.length, +(args.match(/(^|\s)(\d+)(\s|$)/)?.[2] || 2)));
      const groups = Array.from({ length: k }, () => []);
      shuffle(pool).forEach((n, i) => groups[i % k].push(n));
      return card({ view: 'people', title: `${k} teams`, groups, sub: from });
    }
    case 'timer': {
      const m = /^(\S+)\s*(.*)$/.exec(args.trim());
      const ms = m && parseDuration(m[1]);
      if (!ms || ms < 5000 || ms > 4 * 3600000) return note('How long?', 'Try: /timer 2m30s drive practice · /timer 90s · /timer 10 (minutes). Up to 4 hours.');
      return card({ view: 'timer', endsAt: now + ms, ms, label: (m[2] || '').slice(0, 60) });
    }

    // ---------- text ----------
    case 'reverse':
      if (!args) return need('a message');
      return { post: { text: R.reverse(args).slice(0, 2000) } };
    case 'upside':
      if (!args) return need('a message');
      return { post: { text: R.upsideDown(args).slice(0, 2000) } };
    case 'morse':
    case 'binary': {
      if (!args) return need('a message');
      const out = cmd.name === 'morse' ? R.morse(args) : R.binary(args);
      return info(cmd.name === 'morse' ? 'Morse code' : 'Binary', { from: args.slice(0, 200), code: out.slice(0, 1500) });
    }

    // ---------- robotics help ----------
    case 'rule': {
      if (!args) return need('a rule number or a word');
      const { RULES, MANUAL } = await import('./rulebook.js');
      const m = RULE_ID.exec(args.trim());
      if (m) {
        const id = `${m[1].toUpperCase()}${m[2]}`;
        const r = RULES.find((x) => x.id === id);
        if (!r) return note(`There’s no ${id} in the ${MANUAL.name}`, 'Rule numbers look like G407, R102 or E101. Try /rule pin to search.');
        return card({ view: 'rule', id: r.id, title: r.title, text: r.text, page: r.page, section: r.section });
      }
      // Search titles first, then the text.
      const q = args.trim().toLowerCase();
      const hits = [
        ...RULES.filter((r) => r.title.toLowerCase().includes(q)),
        ...RULES.filter((r) => !r.title.toLowerCase().includes(q) && r.text.join(' ').toLowerCase().includes(q)),
      ].slice(0, 8);
      if (!hits.length) return note(`No rule mentions “${args}”`, 'Try another word, or a number like /rule G407.');
      if (hits.length === 1) return card({ view: 'rule', ...hits[0], id: hits[0].id });
      return info(`Rules about “${args.slice(0, 40)}”`, {
        rows: hits.map((r) => [r.id, r.title]),
        cite: `${MANUAL.name}. Look one up: /rule ${hits[0].id}`,
      });
    }
    case 'define': {
      if (!args) return need('a term');
      const { GLOSSARY, MANUAL } = await import('./rulebook.js');
      const q = args.trim().toUpperCase();
      const g =
        GLOSSARY.find((x) => x.term === q || x.term.split('/').includes(q)) ||
        GLOSSARY.find((x) => x.term.startsWith(q)) ||
        GLOSSARY.find((x) => x.term.includes(q));
      if (!g) return note(`“${args}” isn’t in the glossary`, `Defined terms are in capitals in the manual (ALLIANCE, PIN, CONTROL…). Try /rule ${args} to search the rules.`);
      return info(g.term, { lines: [g.def[0].toUpperCase() + g.def.slice(1)], cite: `${MANUAL.name}, Glossary, p. ${g.page}` });
    }
    case 'scoring':
      return info('BIOBUZZ points', {
        rows: R.SCORING.rows,
        label2: 'Ranking points',
        rows2: R.SCORING.rp,
        lines: [R.SCORING.note],
        cite: `${R.MANUAL_NAME}, ${R.SCORING.cite}`,
      });
    case 'matchtime':
      return info('A match', { rows: R.MATCH_TIMES.rows, cite: `${R.MANUAL_NAME}, ${R.MATCH_TIMES.cite}` });
    case 'penalty':
      return info('Fouls and cards', { rows: R.PENALTIES.rows, cite: `${R.MANUAL_NAME}, ${R.PENALTIES.cite}` });
    case 'size':
      return info('Robot size', { rows: R.SIZE.rows, cite: R.MANUAL_NAME });
    case 'motors':
      return info('Motors and servos', { rows: R.MOTOR_RULES.rows, cite: R.MANUAL_NAME, lines: ['Ticks and speeds for a motor: /ticks 312'] });
    case 'battery':
      return info('The robot battery', {
        rows: R.BATTERY.rows,
        label2: 'Voltage guide (rules of thumb, at rest)',
        rows2: R.BATTERY.levels,
        lines: [R.BATTERY.tip],
        cite: R.MANUAL_NAME,
      });
    case 'wire': {
      const g = +(args.match(/\d+/)?.[0] || 0);
      const awg = R.AWG[g];
      const rows = R.WIRE_RULES.map(([use, min]) => [use, `${min} AWG or bigger`]);
      if (args && !awg) return note(`I have AWG 12 to 28 (even numbers)`, 'Try: /wire 18');
      return info(awg ? `${g} AWG wire` : 'Wire sizes', {
        ...(awg && {
          lines: [
            `${awg.mm} mm across, ${fmt(awg.ohm, 3)} Ω per 1000 ft (${fmt(awg.ohm * 3.2808, 2)} Ω per km) of copper.`,
            `A 1 ft run at 10 A loses about ${fmt(((awg.ohm / 1000) * 2 * 10), 3)} V (out and back).`,
            g <= 18 ? 'Big enough for main power and motors.' : g <= 22 ? 'OK for servos, LEDs and circuits on a 10A fuse or less; too small for motor power.' : 'Signal wiring only.',
          ],
        }),
        rows,
        lines2: ['Smaller AWG numbers are thicker wire. Wires that came attached to a legal part are fine as they are.'],
        cite: `${R.MANUAL_NAME}, R609, Table 12-8, pp. 134-135`,
      });
    }
    case 'awards':
      return info('Awards', { rows: R.AWARDS.map(([a, b, c]) => [a, `${b} (${c})`]), cite: R.MANUAL_NAME });
    case 'ticks': {
      const motor = R.findMotor(args);
      const wheel = R.parseLength(args);
      if (!motor)
        return info('Encoder ticks per output turn', {
          rows: [...R.YELLOW_JACKET.map((m) => [`goBILDA ${m.rpm} RPM (${m.ratio})`, String(m.ticks)]), ...R.REV.map((m) => [m.name, String(m.ticks)])],
          lines: ['Add a wheel for ticks per inch: /ticks 312 96mm'],
        });
      const rows = [
        ['Ticks per output turn', fmt(motor.ticks, 1)],
        ['Free speed', `${fmt(motor.rpm, 0)} RPM`],
      ];
      if (wheel) {
        const circ = (Math.PI * wheel) / 25.4;
        rows.push(['Wheel', `${fmt(wheel, 1)} mm (${fmt(wheel / 25.4, 2)} in), ${fmt(circ, 2)} in around`]);
        rows.push(['Ticks per inch', fmt(motor.ticks / circ, 2)]);
        rows.push(['Ticks per tile (24 in.)', fmt((motor.ticks / circ) * 24, 0)]);
      }
      return info(motor.name, { rows });
    }
    case 'gear': {
      const motor = R.findMotor(args.replace(/\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?/, ''));
      const ratio = R.parseRatio(args);
      const wheel = R.parseLength(args);
      if (!ratio) return note('What ratio?', 'Try: /gear 312 2:1 · /gear 20t 60t · /gear 435 1:1.5 96mm (2:1 means the output turns half as fast)');
      const rows = [
        ['Ratio', `${ratio.text} = ${fmt(ratio.ratio, 3)}:1 ${ratio.ratio > 1 ? '(a reduction: slower, stronger)' : ratio.ratio < 1 ? '(an overdrive: faster, weaker)' : '(same speed)'}`],
        ['Torque', `× ${fmt(ratio.ratio, 3)} (before friction)`],
        ['Speed', `÷ ${fmt(ratio.ratio, 3)}`],
      ];
      if (motor) {
        const out = motor.rpm / ratio.ratio;
        rows.push(['Output', `${fmt(out, 1)} RPM from a ${fmt(motor.rpm, 0)} RPM motor`]);
        rows.push(['Ticks per output turn', fmt(motor.ticks * ratio.ratio, 1)]);
        if (wheel) {
          const s = R.wheelSpeed(out, wheel);
          rows.push(['Wheel speed', `${fmt(s.inPerS, 1)} in/s (${fmt(s.ftPerS, 2)} ft/s, ${fmt(s.mPerS, 2)} m/s)`]);
        }
      }
      return info('Gear ratio', { rows, lines: motor ? [] : ['Add a motor for speeds: /gear 312 2:1 96mm'] });
    }
    case 'speed': {
      const motor = R.findMotor(args);
      const wheel = R.parseLength(args);
      const rpm = motor?.rpm || +(args.match(/(\d+(?:\.\d+)?)\s*rpm/i)?.[1] || 0);
      if (!rpm || !wheel) return note('Speed of what?', 'Try: /speed 312 96mm · /speed 435 104mm · /speed 250rpm 4in');
      const s = R.wheelSpeed(rpm, wheel);
      return info(`${fmt(rpm, 0)} RPM on a ${fmt(wheel, 0)} mm wheel`, {
        rows: [
          ['Top speed', `${fmt(s.inPerS, 1)} in/s`],
          ['', `${fmt(s.ftPerS, 2)} ft/s · ${fmt(s.mPerS, 2)} m/s`],
          ['Across the 12 ft field', `${fmt(s.fieldS, 2)} s`],
        ],
        lines: ['Free speed, no load: real robots are about 70–80% of this.'],
      });
    }
    case 'convert': {
      const r = R.convert(args);
      if (r.error) return note('Convert what?', r.error);
      return info('Convert', { big: `${fmt(r.value, 4)} ${r.from} = ${R.nice(r.result)} ${r.to}` });
    }
    case 'ohm': {
      const val = (u) => {
        const m = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(m?)${u}(?![a-z])`, 'i').exec(args);
        return m ? +m[1] / (m[2] ? 1000 : 1) : null;
      };
      let V = val('v');
      let I = val('a');
      let Rr = val('(?:ohms?|Ω|r)');
      let P = val('w');
      const known = [V, I, Rr, P].filter((x) => x != null).length;
      if (known < 2) return note('Give me two of them', 'Try: /ohm 12V 2A · /ohm 12V 6ohm · /ohm 5V 250mA · /ohm 20A 12V');
      for (let k = 0; k < 3; k++) {
        if (V == null && I != null && Rr != null) V = I * Rr;
        if (V == null && P != null && I) V = P / I;
        if (V == null && P != null && Rr != null) V = Math.sqrt(P * Rr);
        if (I == null && V != null && Rr) I = V / Rr;
        if (I == null && P != null && V) I = P / V;
        if (Rr == null && V != null && I) Rr = V / I;
        if (P == null && V != null && I != null) P = V * I;
      }
      return info('Ohm’s law', {
        rows: [
          ['Voltage', `${R.nice(V)} V`],
          ['Current', `${R.nice(I)} A`],
          ['Resistance', `${R.nice(Rr)} Ω`],
          ['Power', `${R.nice(P)} W`],
        ],
        lines: ['V = I × R, and P = V × I'],
      });
    }
    case 'calc': {
      if (!args) return need('a calculation');
      const r = R.calc(args);
      if (r.error) return note('Can’t calculate that', r.error);
      return info('Calculator', { big: `${args.slice(0, 80)} = ${R.nice(r.value)}`, lines: /sin|cos|tan/.test(args) ? ['Angles are in degrees.'] : [] });
    }
    case 'java': {
      const k = args.trim().toLowerCase().replace(/\s+/g, '');
      const key = JAVA[k] ? k : JAVA_ALIASES[k];
      if (!key) return note('Which one?', `Topics: ${Object.keys(JAVA).join(', ')}`);
      const [title, code, line] = JAVA[key];
      return info(title, { code, lang: 'java', lines: [line] });
    }
    case 'explain': {
      const k = args.trim().toLowerCase().replace(/^dcmotor\.(runmode\.)?|^zeropowerbehavior\./, '');
      const key = EXPLAIN[k.replace(/\s+/g, '_')] ? k.replace(/\s+/g, '_') : EXPLAIN[k] ? k : EXPLAIN_ALIASES[k] || EXPLAIN_ALIASES[k.replace(/_/g, ' ')];
      if (!key) return note('Explain what?', `I can explain: ${Object.values(EXPLAIN).map(([t]) => t).join(', ')}`);
      const [title, text] = EXPLAIN[key];
      return info(title, { lines: [text] });
    }
    case 'tip': {
      const area = TIP_AREAS.find((a) => args && a.startsWith(args.trim().toLowerCase()));
      if (args && !area) return note('Tips about what?', `Areas: ${TIP_AREAS.join(', ')}`);
      const [a, tip] = pick(area ? TIPS.filter(([x]) => x === area) : TIPS);
      return info(`Tip: ${a}`, { lines: [tip] });
    }

    // ---------- team ----------
    case 'lab': {
      const here = ctx.onShift?.() || [];
      return card({
        view: 'people',
        title: here.length ? `${here.length} at the lab` : 'Nobody’s at the lab right now',
        groups: here.length ? [here.map((p) => p.name)] : [],
        since: Object.fromEntries(here.map((p) => [p.name, p.since])),
      });
    }
    case 'hours':
    case 'streak': {
      const who = args ? namesIn(args, roster)[0] : me;
      if (!who) return note(`Who’s “${args}”?`, `Try: /${cmd.name} @name`);
      const mine = shifts.filter((s) => s.person === who);
      if (cmd.name === 'streak') {
        const st = streaksOf(who, mine, now);
        return info(`${first(who)}’s streaks`, {
          person: who,
          rows: [
            ['School days in a row', `${st.daily}${st.today ? '' : ' (today not yet)'}`],
            ['Weeks in a row', `${st.weekly}${st.thisWeek ? '' : ' (this week not yet)'}`],
          ],
          lines: ['A school day counts with any shift that day; a week with any shift that week.'],
        });
      }
      const today = teamMidnight(teamDay(now));
      const week = teamMidnight(weekStart(teamDay(now)));
      const h = (from) => hoursOf(mergedMs(mine.filter((s) => s.start >= from), now));
      const ranks = roster
        .map((n) => ({ n, ms: mergedMs(shifts.filter((s) => s.person === n && s.start >= week), now) }))
        .sort((a, b) => b.ms - a.ms);
      const rank = ranks.findIndex((x) => x.n === who) + 1;
      return info(`${first(who)}’s hours`, {
        person: who,
        rows: [
          ['Today', `${h(today)} h`],
          ['This week', `${h(week)} h${ranks[rank - 1]?.ms ? ` (#${rank} on the team)` : ''}`],
          ['This season', `${h(0)} h`],
        ],
      });
    }
    case 'top': {
      const week = teamMidnight(weekStart(teamDay(now)));
      const list = roster
        .map((n) => ({ n, ms: mergedMs(shifts.filter((s) => s.person === n && s.start >= week), now) }))
        .filter((x) => x.ms > 0)
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 10);
      if (!list.length) return info('Lab hours this week', { lines: ['Nobody’s logged time this week yet. Be the first: /shift'] });
      return card({ view: 'people', title: 'Most lab hours this week', numbered: true, groups: [list.map((x) => x.n)], side: Object.fromEntries(list.map((x) => [x.n, `${hoursOf(x.ms)} h`])) });
    }
    case 'stats': {
      const s = seasonStats({ shifts, tasks, runs: ctx.runs?.() || [], now });
      const hr = (ms) => hoursOf(ms);
      return info('Season so far', {
        rows: [
          ['Team hours', `${hr(s.hours.week)} this week · ${versusLastWeek(R.round(hr(s.hours.week) - hr(s.hours.last), 1))} · ${hr(s.hours.season)} this season`],
          ['Tasks finished', `${s.tasks.week} this week · ${versusLastWeek(s.tasks.week - s.tasks.last)} · ${s.tasks.season} this season`],
          ['Practice runs', `${s.runs.week} this week · ${versusLastWeek(s.runs.week - s.runs.last)} · ${s.runs.season} this season`],
        ],
      });
    }
    case 'nextmatch': {
      const m = nextMatch(ctx.matches || [], now);
      if (!m) return info('Next match', { lines: ['No match schedule yet. It comes from FTC Events, or team management types it in at the event.'] });
      const mins = Math.round((m.time - now) / 60000);
      return info(`Next match: ${m.label || ''}`, {
        rows: [
          ['When', `${new Date(m.time).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${mins > 0 ? ` (in ${mins >= 120 ? `${Math.round(mins / 60)} h` : `${mins} min`})` : ' (now)'}`],
          ...(m.alliance ? [['Alliance', m.alliance === 'red' ? 'Red' : m.alliance === 'blue' ? 'Blue' : m.alliance]] : []),
          ...(m.partners?.length ? [['With', m.partners.join(', ')]] : []),
          ...(m.opponents?.length ? [['Against', m.opponents.join(', ')]] : []),
          ...(m.field ? [['Field', m.field]] : []),
        ],
      });
    }
    case 'milestone': {
      const today = todayISO();
      const list = (ctx.milestones || [])
        .filter((m) => !m.done && (m.end || m.start))
        .sort((a, b) => (a.end || a.start).localeCompare(b.end || b.start))
        .filter((m) => (m.end || m.start) >= today)
        .slice(0, 5);
      if (!list.length) return info('Milestones', { lines: ['No open milestones coming up. Add them on the Milestones page.'] });
      return info('Coming up', {
        rows: list.map((m) => {
          const d = daysBetween(today, m.end || m.start);
          return [m.title || 'Untitled', `${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}${m.subteam ? ` · ${m.subteam}` : ''}`];
        }),
      });
    }
    case 'due': {
      const today = todayISO();
      const until = addDay(today, 7);
      const mineOnly = /\bme\b/i.test(args);
      const list = open
        .filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= until && (!mineOnly || (t.assignees || []).includes(me)))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return card({ view: 'tasks', title: list.length ? `${list.length} due in the next 7 days${mineOnly ? ' (yours)' : ''}` : 'Nothing due in the next 7 days', list: list.slice(0, 12).map(taskRow), more: Math.max(0, list.length - 12) });
    }
    case 'tasks': {
      const who = args ? namesIn(args, roster)[0] : me;
      if (!who) return note(`Who’s “${args}”?`, 'Try: /tasks @name');
      const list = open.filter((t) => (t.assignees || []).includes(who)).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
      return card({ view: 'tasks', title: list.length ? `${first(who)} has ${list.length} open task${list.length > 1 ? 's' : ''}` : `${first(who)} has no open tasks`, list: list.slice(0, 12).map(taskRow), more: Math.max(0, list.length - 12) });
    }
    case 'unassigned': {
      const list = open.filter((t) => !(t.assignees || []).length);
      return card({ view: 'tasks', title: list.length ? `${list.length} open task${list.length > 1 ? 's' : ''} with nobody on it` : 'Every open task has someone on it', list: list.slice(0, 12).map(taskRow), more: Math.max(0, list.length - 12) });
    }
    case 'blocked': {
      const list = open.filter((t) => t.status === 'blocked');
      return card({ view: 'tasks', title: list.length ? `${list.length} stuck task${list.length > 1 ? 's' : ''}` : 'Nothing is stuck', list: list.slice(0, 12).map(taskRow), more: Math.max(0, list.length - 12), reasons: true });
    }
    case 'roster': {
      const sub = args ? subteamIn(args) : null;
      if (args && !sub) return note(`Which subteam?`, SUBTEAMS.join(', '));
      const subs = sub ? [sub] : SUBTEAMS;
      const groups = subs.map((s) => roster.filter((n) => (ctx.subteamsOf?.(n) || []).includes(s)));
      return card({ view: 'people', title: sub ? `${sub}: ${groups[0].length}` : 'Subteams', groups, labels: subs });
    }
    default:
      return null;
  }
}
