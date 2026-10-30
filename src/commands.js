// Slash commands for chat (type / in the message box). Each one either posts
// a message everyone sees (a Trotbot card, rendered by chat/Commands.jsx), or
// answers just you (a note under the chat that only you see).
//
// The randomness happens here, once, when you send it: the result is saved
// on the message, so everyone sees the same roll. Commands with coins on the
// line (casino, economy, arcade games) roll on the server instead.

import { overdueTasks, parseMatch, parseTask, seasonRecord, todayISO } from './teamCommands.js';
import { blocked, isOff } from '../functions/shared/commandRules.js';

export const GROUPS = [
  ['basics', 'Basics'],
  ['text', 'Text fun'],
  ['random', 'Random'],
  ['actions', 'Actions'],
  ['economy', 'Jackson coins'],
  ['casino', 'Casino (in #arcade)'],
  ['arcade', 'Games (in #arcade)'],
  ['team', 'Team'],
];

// name, group, args (shown as a hint), what it does
export const COMMANDS = [
  { name: 'help', group: 'basics', args: '', desc: 'Every command, and what it does' },
  { name: 'ping', group: 'basics', args: '', desc: 'Is Trotbot awake? (and how fast)' },
  { name: 'whois', group: 'basics', args: '@person', desc: 'Someone’s hours, tasks, coins, and status' },
  { name: 'avatar', group: 'basics', args: '@person', desc: 'Their profile picture, big' },
  { name: 'countdown', group: 'basics', args: '', desc: 'Days until competition' },
  { name: 'afk', group: 'basics', args: 'reason', desc: 'Away: Trotbot tells people who @ you' },
  { name: 'remind', group: 'basics', args: 'when what', desc: 'A reminder later (10m, 2h, tomorrow 7am, at 5pm…)' },
  { name: 'poll', group: 'basics', args: 'question', desc: 'Start a poll' },

  { name: 'me', group: 'text', args: 'action', desc: '*Asher does something*' },
  { name: 'shrug', group: 'text', args: 'message', desc: 'Adds ¯\\_(ツ)_/¯' },
  { name: 'tableflip', group: 'text', args: 'message', desc: 'Adds (╯°□°)╯︵ ┻━┻' },
  { name: 'unflip', group: 'text', args: 'message', desc: 'Adds ┬─┬ ノ( ゜-゜ノ)' },
  { name: 'spoiler', group: 'text', args: 'message', desc: 'Hidden until someone taps it' },
  { name: 'mock', group: 'text', args: 'message', desc: 'sAyS iT lIkE tHiS' },
  { name: 'clap', group: 'text', args: 'message', desc: 'Says 👏 it 👏 like 👏 this' },

  { name: '8ball', group: 'random', args: 'question', desc: 'Ask the Magic 8-Ball' },
  { name: 'flip', group: 'random', args: '', desc: 'Flip a coin' },
  { name: 'roll', group: 'random', args: '2d6', desc: 'Roll dice (d20, 3d6+2, 100…)' },
  { name: 'choose', group: 'random', args: 'a | b | c', desc: 'Trotbot picks one' },
  { name: 'rate', group: 'random', args: 'thing', desc: 'Trotbot rates it out of 10' },
  { name: 'ship', group: 'random', args: '@person @person', desc: 'How compatible are they?' },
  { name: 'wyr', group: 'random', args: '', desc: 'Would you rather… (everyone votes)' },
  { name: 'fortune', group: 'random', args: '', desc: 'Open a fortune cookie' },

  { name: 'pet', group: 'actions', args: '@person', desc: 'Pat pat pat' },
  { name: 'hug', group: 'actions', args: '@person', desc: 'A big hug' },
  { name: 'highfive', group: 'actions', args: '@person', desc: 'Up top!' },
  { name: 'bonk', group: 'actions', args: '@person', desc: 'Cartoon bonk 🔨' },
  { name: 'wave', group: 'actions', args: '@person', desc: 'Say hi' },

  { name: 'balance', group: 'economy', args: '@person', desc: 'How many Jackson coins (yours or theirs)' },
  { name: 'daily', group: 'economy', args: '', desc: 'Free coins once a day (streaks pay more)', server: true },
  { name: 'work', group: 'economy', args: '', desc: 'Coins for your work, while you’re clocked in (once an hour)', server: true },
  { name: 'beg', group: 'economy', args: '', desc: 'Ask around for coins. No promises.', server: true },
  { name: 'give', group: 'economy', args: '@person amount', desc: 'Send someone coins' },
  { name: 'rob', group: 'economy', args: '@person', desc: '35% chance to steal some. Or pay a fine.', server: true },
  { name: 'leaderboard', group: 'economy', args: '', desc: 'Who has the most coins' },

  { name: 'slots', group: 'casino', args: 'bet', desc: 'Spin: three of a kind pays up to 500×', server: true },
  { name: 'dice', group: 'casino', args: 'bet', desc: 'Your 2 dice vs the house’s', server: true },
  { name: 'coinflip', group: 'casino', args: 'bet heads|tails', desc: 'Double or nothing', server: true },
  { name: 'roulette', group: 'casino', args: 'bet red|black|even|odd|low|high|0–36', desc: 'Spin the wheel', server: true },
  { name: 'blackjack', group: 'casino', args: 'bet', desc: 'Beat the dealer to 21', server: true },
  { name: 'crash', group: 'casino', args: 'bet', desc: 'Cash out before the rocket crashes', server: true },
  { name: 'mines', group: 'casino', args: 'bet bombs', desc: 'Open tiles, dodge the bombs, cash out', server: true },
  { name: 'highlow', group: 'casino', args: 'bet', desc: 'Higher or lower? Keep the streak going', server: true },
  { name: 'lottery', group: 'casino', args: 'tickets', desc: `Tickets are 5 coins; Friday's draw takes the pot`, server: true },

  { name: 'rps', group: 'arcade', args: '@person bet', desc: 'Rock paper scissors (anyone, or @Trotbot)', server: true },
  { name: 'tictactoe', group: 'arcade', args: '@person bet', desc: 'Tic-tac-toe (anyone, or @Trotbot)', server: true },
  { name: 'connect4', group: 'arcade', args: '@person bet', desc: 'Connect four (anyone, or @Trotbot)', server: true },
  { name: 'duel', group: 'arcade', args: '@person bet', desc: 'Quick draw: first to tap after DRAW! wins', server: true },
  { name: 'trivia', group: 'arcade', args: '', desc: 'FTC trivia: first right answer wins 8 coins', server: true },
  { name: 'hangman', group: 'arcade', args: '', desc: 'Guess the robotics word together', server: true },
  { name: 'typerace', group: 'arcade', args: '', desc: 'Race to type a sentence (no pasting)', server: true },
  { name: 'heist', group: 'arcade', args: 'bet', desc: 'Plan a heist: more crew, better odds', server: true },

  { name: 'task', group: 'team', args: 'title @person friday !high', desc: 'Make a task' },
  { name: 'mytasks', group: 'team', args: '', desc: 'Your open tasks (check them off right here)' },
  { name: 'overdue', group: 'team', args: '', desc: 'Every task that’s late' },
  { name: 'shift', group: 'team', args: 'who', desc: 'Clock in or out (/shift who: who’s at the lab)' },
  { name: 'match', group: 'team', args: 'auto teleop endgame win #7', desc: 'Log a match to the Match Log (or see the record)' },
  { name: 'standup', group: 'team', args: '', desc: 'Yesterday / today / blockers' },
];
export const commandByName = Object.fromEntries(COMMANDS.map((c) => [c.name, c]));

// "/8ball will it work" → { cmd, args: 'will it work' }; null if it isn't one.
export function parseCommand(text) {
  const m = /^\/([a-z0-9]+)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  const cmd = m && commandByName[m[1].toLowerCase()];
  return cmd ? { cmd, args: (m[2] || '').trim() } : null;
}

// Commands that start with what you've typed so far ("/r" → remind, roll, rate).
// Ones Asher turned off (cfg.off) aren't offered.
export function matchCommands(typed, cfg) {
  const q = typed.toLowerCase();
  const on = COMMANDS.filter((c) => !isOff(c.name, cfg));
  const starts = on.filter((c) => c.name.startsWith(q));
  const inside = q
    ? on.filter(
        (c) =>
          !c.name.startsWith(q) &&
          (c.name.includes(q) ||
            (q.length >= 2 &&
              c.desc
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .some((w) => w.startsWith(q)))),
      )
    : [];
  return [...starts, ...inside];
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
// The same answer every time for the same thing (so /rate pizza is consistent).
const hash = (s) => [...String(s).toLowerCase()].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);

// Who "@Cooper Mlezcko" / "cooper" / "@coop" means.
export function findPerson(text, roster) {
  const t = text.toLowerCase();
  const full = [...roster].sort((a, b) => b.length - a.length).find((n) => t.includes(`@${n.toLowerCase()}`) || t === n.toLowerCase());
  if (full) return full;
  const word = t.replace(/^@/, '').split(/\s+/)[0];
  if (!word) return null;
  return roster.find((n) => n.toLowerCase().split(' ')[0] === word) || roster.find((n) => n.toLowerCase().startsWith(word)) || null;
}
// Everyone named in the text, in order ("@A and @B", or "A B").
export function findPeople(text, roster) {
  const t = text.toLowerCase();
  const tagged = [...roster]
    .map((n) => ({ n, at: t.indexOf(`@${n.toLowerCase()}`) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.n);
  if (tagged.length >= 2) return tagged;
  const words = t
    .replace(/@/g, '')
    .split(/[\s,&]+|\band\b|\bx\b/)
    .filter(Boolean);
  const out = [...tagged];
  for (const w of words) {
    const n = roster.find((r) => r.toLowerCase().split(' ')[0] === w);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

// ---------- the content ----------

export const EIGHT_BALL = [
  ['yes', 'It is certain.'],
  ['yes', 'Without a doubt. Write it in the notebook.'],
  ['yes', 'Yes. The Control Hub agrees.'],
  ['yes', 'Signs point to yes. And to the pit.'],
  ['yes', 'Most likely. Unless it’s autonomous.'],
  ['yes', 'Yes, but zip-tie it first.'],
  ['yes', 'The judges would say yes.'],
  ['maybe', 'Ask again after the next match.'],
  ['maybe', 'Reply hazy. Battery at 11.8 V.'],
  ['maybe', 'Cannot predict now. The code is still compiling.'],
  ['maybe', 'Better not tell you now. Coach is watching.'],
  ['maybe', 'Concentrate and ask again. Louder. Over the field noise.'],
  ['maybe', 'It works on my machine.'],
  ['no', 'Don’t count on it.'],
  ['no', 'My sources say no. My sources are the inspector.'],
  ['no', 'Outlook not so good. Outlook is a Control Hub that won’t connect.'],
  ['no', 'Very doubtful. Have you tried turning it off and on?'],
  ['no', 'No. And please re-tighten the set screws.'],
  ['no', 'Absolutely not. It doesn’t fit in 18 inches.'],
  ['no', 'The robot says no. The robot is never wrong. (It’s often wrong.)'],
];

export const FORTUNES = [
  'Your next auto will drive straight. Once.',
  'A stripped screw is in your future. You will find the extractor.',
  'Someone on your team will finally label the wires.',
  'You will be asked about your design process. You will say “iterative.”',
  'Good things come to those who charge the batteries.',
  'The hex key you seek is in your pocket.',
  'An unexpected alliance will carry you. Be gracious.',
  'Today is a good day to commit your code.',
  'Your intake will intake. Believe it.',
  'A great match awaits you. Bring snacks to the queue.',
  'The field will be reset by someone else this time.',
  'You will find a zip tie exactly when you need one.',
  'Fortune favors the team that tested on the real field.',
  'Your notebook will impress a judge who didn’t read it.',
  'The robot fits in the sizing box. Barely. Breathe in.',
  'You will measure twice and still cut wrong. It’s fine.',
  'Inspiration will strike at 11:58 PM.',
  'A mentor will say “just try it.” Try it.',
  'Your battery will read 13.4 V and tell the truth.',
  'Help will come from the team in the next pit.',
  'Patience. The CAD is loading.',
  'You will win a match you thought you lost.',
  'Somebody will bring donuts. Be nice to them.',
  'Do not trust the encoder today.',
  'Gracious professionalism will be repaid with spare parts.',
  'Your robot’s name will be a good one.',
  'Something you deleted will be in the trash. Check.',
  'Today’s bug is tomorrow’s funny story.',
  'The answer is a bigger gear. It’s always a bigger gear.',
  'You will drive well under pressure. Mostly.',
];

export const WOULD_YOU_RATHER = [
  ['Have a robot that’s fast but can’t turn', 'One that turns perfectly but goes 2 mph'],
  ['Redo all the wiring tonight', 'Rewrite all the code tonight'],
  ['Win Inspire', 'Win the tournament'],
  ['Only use zip ties forever', 'Only use hot glue forever'],
  ['Drive with a 1-second input delay', 'Drive blindfolded with a coach shouting'],
  ['Lose your hex key every day', 'Lose your phone once a week'],
  ['Have a perfect auto and a bad driver', 'A great driver and no auto'],
  ['Present to the judges in a costume', 'Present in complete silence with slides'],
  ['Work in a lab that’s 50 °F', 'One that’s 95 °F'],
  ['Every screw is metric', 'Every screw is imperial'],
  ['Unlimited budget but 1 week', '$100 and the whole season'],
  ['Know the game reveal a week early', 'Have one extra motor all season'],
  ['Only eat Pit Bars at competition', 'Only drink Torque Juice'],
  ['Your robot talks', 'Your robot can feel pain'],
  ['Be the drive coach', 'Be the human player'],
  ['Fix every bug yourself', 'Explain every bug to the duck'],
  ['Have the loudest robot', 'Have the smallest robot'],
  ['Redo the notebook from scratch', 'Redo the CAD from scratch'],
  ['A robot that’s always 1 inch too wide', 'One that’s always 1 V too low'],
  ['Go to worlds with a robot that barely works', 'Win states with a perfect one'],
  ['Have every match on Field 1', 'Never have to queue'],
  ['Teach a rookie to drive', 'Teach a rookie to CAD'],
  ['Infinite servos', 'Infinite batteries'],
  ['Only use blocks', 'Only use assembly'],
  ['Sleep in the lab before competition', 'Drive 4 hours the morning of'],
  ['Your alliance partner is amazing', 'Your opponents are terrible'],
  ['Hear every robot’s thoughts', 'Hear every judge’s thoughts'],
  ['Name the robot something cool', 'Name the robot something funny'],
  ['Lose a match by 1 point', 'Win a match by penalty'],
  ['Mecanum wheels forever', 'Tank drive forever'],
];

export const PING_STATUS = [
  'Control Hub: vibing',
  'Battery: 12.9 V (lying)',
  'Wi-Fi: connected to someone’s hotspot',
  'Motors: humming the national anthem',
  'Encoders: counting, mostly',
  'Servo 3: still jittering',
  'Robot: asleep in the pit',
  'Field: being reset by a volunteer',
  'Code: compiled on the first try (suspicious)',
  'Zip ties: holding everything together',
  'Hot glue: everywhere',
  'Drive coach: yelling “LEFT”',
];

const RATE_QUIPS = [
  [0, 'Did you mean to type that?'],
  [1, 'The inspector would fail it.'],
  [2, 'It has the energy of a dead battery.'],
  [3, 'Needs more zip ties.'],
  [4, 'Mid. Like a robot that drives straight but can’t turn.'],
  [5, 'Perfectly average. Very 50/50 drivetrain.'],
  [6, 'Solid. Would put in the notebook.'],
  [7, 'Pretty good. The judges nodded.'],
  [8, 'Great. Alliance-selection worthy.'],
  [9, 'Excellent. Inspire Award energy.'],
  [10, 'Perfect. Flawless. Worlds-level.'],
];
const SHIP_QUIPS = [
  [0, 'Cross-threaded. Do not force it.'],
  [20, 'Like metric screws in an imperial hole.'],
  [40, 'Could work with enough zip ties.'],
  [60, 'Good alliance partners. Strong auto together.'],
  [80, 'Gears that mesh perfectly. ⚙️⚙️'],
  [95, 'Soulmates. Same drivetrain, same snack drawer.'],
];

const ACTION = {
  pet: { emoji: '🫳', lines: ['pats {to} on the head', 'gives {to} gentle pats', 'pets {to}. Good teammate.'] },
  hug: { emoji: '🫂', lines: ['gives {to} a big hug', 'hugs {to}. Aww.', 'wraps {to} in a hug like a zip tie'] },
  highfive: {
    emoji: '🙏',
    lines: ['high-fives {to}. Up top!', 'and {to} high-five. Nailed it.', 'goes for the high five with {to}. Connected!'],
  },
  bonk: { emoji: '🔨', lines: ['bonks {to}', 'bonks {to}. Back to work.', 'BONKS {to}. Gently. It’s a foam hammer.'] },
  wave: { emoji: '👋', lines: ['waves at {to}', 'says hi to {to} 👋', 'waves at {to} from across the lab'] },
};
const SELF = {
  pet: 'pats themselves on the head. Self-care.',
  hug: 'hugs themselves. It’s okay. We’re here.',
  highfive: 'high-fives themselves. Respect.',
  bonk: 'bonks themselves. Why?',
  wave: 'waves at the mirror.',
};

const mock = (s) => {
  let i = 0;
  return [...s].map((c) => (/[a-z]/i.test(c) ? (i++ % 2 ? c.toUpperCase() : c.toLowerCase()) : c)).join('');
};
const clap = (s) => `👏 ${s.trim().split(/\s+/).join(' 👏 ')} 👏`;

// "2d6+1", "d20", "100", "" → the dice.
export function parseDice(spec) {
  const s = (spec || '').replace(/\s+/g, '').toLowerCase();
  if (!s) return { n: 1, sides: 6, plus: 0 };
  if (/^\d+$/.test(s)) return { n: 1, sides: Math.min(1000000, Math.max(2, +s)), plus: 0 };
  const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(s);
  if (!m) return null;
  const n = Math.min(20, Math.max(1, +(m[1] || 1)));
  const sides = Math.min(1000, Math.max(2, +m[2]));
  return { n, sides, plus: +(m[3] || 0) };
}

// "/remind 10m stretch", "2h", "tomorrow 7am", "at 5pm", "friday 3:30pm" → { at, what }
const UNIT = {
  s: 1000,
  sec: 1000,
  m: 60000,
  min: 60000,
  mins: 60000,
  minute: 60000,
  minutes: 60000,
  h: 3600000,
  hr: 3600000,
  hrs: 3600000,
  hour: 3600000,
  hours: 3600000,
  d: 86400000,
  day: 86400000,
  days: 86400000,
  w: 604800000,
  week: 604800000,
  weeks: 604800000,
};
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function clockTime(word) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(word);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] || 0);
  if (h > 23 || min > 59 || (!m[3] && !m[2])) return null;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return [h, min];
}
export function parseRemind(text, now = Date.now()) {
  let words = text.trim().split(/\s+/);
  const lower = () => (words[0] || '').toLowerCase();
  if (lower() === 'me') words.shift();
  if (lower() === 'in') words.shift();
  let at = null;
  // 10m, 2h, 1d, 30min, "10 minutes"
  const rel = /^(\d+(?:\.\d+)?)([a-z]+)?$/.exec(lower());
  if (rel && (rel[2] ? UNIT[rel[2]] : UNIT[(words[1] || '').toLowerCase()])) {
    const unit = rel[2] ? UNIT[rel[2]] : UNIT[words[1].toLowerCase()];
    at = now + +rel[1] * unit;
    words = words.slice(rel[2] ? 1 : 2);
  } else {
    const base = new Date(now);
    let day = null;
    if (lower() === 'today') {
      day = 0;
      words.shift();
    } else if (lower() === 'tonight') {
      day = 0;
      words.shift();
      words.unshift('8pm');
    } else if (lower() === 'tomorrow') {
      day = 1;
      words.shift();
    } else if (DAYS.includes(lower())) {
      const want = DAYS.indexOf(lower());
      day = (want - base.getDay() + 7) % 7 || 7;
      words.shift();
    }
    if (lower() === 'at') words.shift();
    // "5pm", "5:30pm", "5:30 pm", "17:00"
    let time = null;
    if (words[1] && /^(am|pm)$/i.test(words[1])) {
      time = clockTime(`${lower()}${words[1].toLowerCase()}`);
      if (time) words.splice(0, 2);
    }
    if (!time) {
      time = clockTime(lower());
      if (time) words.shift();
    }
    if (day == null && !time) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + (day || 0));
    if (time) d.setHours(time[0], time[1], 0, 0);
    else d.setHours(9, 0, 0, 0);
    // "at 5pm" when it's already past 5pm today means tomorrow.
    if (day == null && d.getTime() <= now) d.setDate(d.getDate() + 1);
    at = d.getTime();
  }
  const what = words
    .join(' ')
    .replace(/^(to|about|that)\s+/i, '')
    .trim();
  if (!at || at <= now) return null;
  return { at, what };
}

// ---------- running one ----------

// What happens when you send "/name args". ctx: { actor, roster, competitionDate,
// countdown(), whois(name), ping(), setAfk(reason), addReminder(at, text) }.
// Returns one of:
//   { post: { text, cmd?, poll?, votes?, mentions? } }   a message everyone sees
//   { note: { title, body?, lines? } }                  only you see it
//   { poll: 'question' }                                 opens the poll maker
//   { standup: true }                                    opens the standup form
export async function runCommand({ cmd, args }, ctx) {
  const me = ctx.actor.name;
  const first = (n) => n.split(' ')[0];
  const card = (result, extra = {}) => ({
    post: { text: `/${cmd.name}${args ? ` ${args}` : ''}`, cmd: { ...result, name: cmd.name }, ...extra },
  });
  const need = (what) => ({ note: { title: `/${cmd.name} needs ${what}`, body: `Try: /${cmd.name} ${cmd.args}` } });
  // Turned off, or not in this channel (Asher's Commands page).
  const stop = blocked(cmd.name, cmd.group, ctx.conv, ctx.commandCfg);
  if (stop) return { note: stop };
  // Casino and economy: the server rolls and posts the card (functions/index.js play).
  if (cmd.server) {
    const r = await ctx.play(cmd.name, args ? args.split(/\s+/) : []);
    return r?.note ? { note: r.note } : { done: true };
  }
  switch (cmd.name) {
    case 'balance': {
      const who = args ? findPerson(args, ctx.roster) : me;
      if (!who) return { note: { title: `Who’s “${args}”?`, body: 'Try: /balance @name' } };
      const w = ctx.wallet(who);
      return card(
        { to: who, balance: w.balance, earned: w.earned, casino: w.casino, played: w.stats.played || 0, best: w.stats.best || 0 },
        { mentions: [] },
      );
    }
    case 'leaderboard':
      return card({ top: ctx.richest() });
    case 'give': {
      // The amount is the last word, a whole number ("/give @Cooper 20").
      const last = args.trim().split(/\s+/).pop() || '';
      const amount = /^\d+$/.test(last) ? +last : 0;
      const who = args.trim().slice(0, -last.length).trim();
      const to = who && findPerson(who, ctx.roster);
      if (!to || !amount) return { note: { title: 'Give who how much?', body: 'Try: /give @Cooper 20' } };
      // A first name or start of a name that fits more than one person: ask.
      const word = who.toLowerCase().replace(/^@/, '');
      const fits = ctx.roster.filter((n) => n.toLowerCase() === word || n.toLowerCase().startsWith(word));
      if (!who.toLowerCase().includes(`@${to.toLowerCase()}`) && to.toLowerCase() !== word && fits.length > 1)
        return { note: { title: `Which one?`, body: `${fits.join(', ')}. Use their full name, like /give @${fits[0]} ${amount}` } };
      if (to === me) return { note: { title: 'That’s you.', body: 'Your coins are already yours.' } };
      const have = ctx.wallet(me).balance;
      if (amount > have) return { note: { title: `You only have ${have} coins.` } };
      if (amount > 5000) return { note: { title: 'That’s a lot.', body: 'Up to 5000 at a time.' } };
      const r = await ctx.gift(to, amount);
      if (!r?.ok) return { note: r?.note || { title: 'That didn’t go through.' } };
      return card({ to, amount, line: `sent you ${amount} Jackson coins` }, { mentions: [to] });
    }
    case 'help':
      return { note: { title: 'Commands', help: true, off: ctx.commandCfg?.off || [] } };

    case 'task': {
      const t = parseTask(args, ctx.roster, me);
      if (!t.title) return { note: { title: 'What’s the task?', body: 'Try: /task Fix the intake @Cooper friday !high' } };
      const subteam = ctx.subteam || '';
      const id = await ctx.createTask({ ...t, subteam });
      if (!id) return { done: true };
      return card(
        { title: t.title, assignees: t.assignees, dueDate: t.dueDate, priority: t.priority, subteam },
        { taskIds: [id], mentions: t.assignees.filter((n) => n !== me) },
      );
    }
    case 'mytasks': {
      const today = todayISO();
      const mine = (ctx.tasks || [])
        .filter((t) => t.status !== 'done' && (t.assignees || []).includes(me))
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
      if (!mine.length) return { note: { title: 'No open tasks', body: 'Nothing assigned to you right now. Try /task to make one.' } };
      const late = mine.filter((t) => t.dueDate && t.dueDate < today).length;
      return {
        note: {
          title: `Your ${mine.length} open task${mine.length > 1 ? 's' : ''}${late ? ` (${late} late)` : ''}`,
          taskIds: mine.slice(0, 15).map((t) => t.id),
          body: mine.length > 15 ? `Showing 15 of ${mine.length}. The rest are on the Board.` : '',
        },
      };
    }
    case 'overdue': {
      const list = overdueTasks(ctx.tasks);
      return card({ total: list.length, list: list.slice(0, 10) });
    }
    case 'shift': {
      if (/^who\b/i.test(args)) return card({ who: true, people: ctx.onShift() });
      const mine = ctx.myShift();
      if (mine) {
        ctx.endShift();
        return { note: { title: 'Wrapping up your shift', body: 'Fill in what you worked on and tap End shift.' } };
      }
      await ctx.startShift();
      return card({ in: true, at: Date.now(), others: ctx.onShift().filter((p) => p.name !== me) });
    }
    case 'match': {
      if (!args) return card({ record: seasonRecord(ctx.runs()) });
      const r = parseMatch(args);
      if (!r)
        return {
          note: {
            title: 'Log a match: auto, teleop, and endgame points',
            body: 'Try: /match 20 45 15 win #7 · /match auto 12 teleop 40 endgame 10 loss · /match (the season record)',
          },
        };
      const before = ctx.runs();
      await ctx.createRun({ ...r, type: 'match', date: todayISO(), drivers: [] });
      return card({ ...r, total: r.auto + r.teleop + r.endgame, record: seasonRecord([...before, { ...r, type: 'match' }]) });
    }
    case 'standup':
      return { standup: true };
    case 'ping': {
      const ms = await ctx.ping();
      return card({ ms, status: pick(PING_STATUS) });
    }
    case 'whois':
    case 'avatar': {
      const who = args ? findPerson(args, ctx.roster) : me;
      if (!who) return { note: { title: `Who’s “${args}”?`, body: 'Pick someone with @' } };
      return card({ to: who, ...(cmd.name === 'whois' ? ctx.whois(who) : {}) }, { mentions: [] });
    }
    case 'countdown': {
      const c = ctx.countdown();
      if (!c) return { note: { title: 'No competition date yet', body: 'Team management can set it on the Team tab.' } };
      return card(c);
    }
    case 'afk': {
      const reason = args.slice(0, 80);
      await ctx.setAfk(reason || 'AFK');
      return card({ reason: reason || 'AFK' });
    }
    case 'remind': {
      const r = args && parseRemind(args);
      if (!r)
        return {
          note: {
            title: 'When?',
            body: 'Try: /remind 10m stretch · /remind 2h charge batteries · /remind tomorrow 7am safety glasses · /remind friday 3pm notebook',
          },
        };
      if (!r.what) return { note: { title: 'Remind you about what?', body: `Try: /remind ${args} charge the batteries` } };
      await ctx.addReminder(r.at, r.what.slice(0, 200));
      return { note: { title: `Got it. I’ll remind you ${whenText(r.at)}`, body: r.what } };
    }
    case 'poll':
      return { poll: args };

    case 'me':
      if (!args) return need('an action');
      return { post: { text: args, cmd: { name: 'me' } } };
    case 'shrug':
      return { post: { text: `${args ? `${args} ` : ''}¯\\\\\\_(ツ)_/¯` } };
    case 'tableflip':
      return { post: { text: `${args ? `${args} ` : ''}(╯°□°)╯︵ ┻━┻` } };
    case 'unflip':
      return { post: { text: `${args ? `${args} ` : ''}┬─┬ ノ( ゜-゜ノ)` } };
    case 'spoiler':
      if (!args) return need('a message to hide');
      return { post: { text: `||${args.replace(/\|\|/g, '')}||` } };
    case 'mock':
      if (!args) return need('something to mock');
      return { post: { text: mock(args) } };
    case 'clap':
      if (!args) return need('a message');
      return { post: { text: clap(args) } };

    case '8ball': {
      if (!args) return need('a question');
      const [mood, answer] = pick(EIGHT_BALL);
      return card({ q: args.slice(0, 200), answer, mood });
    }
    case 'flip': {
      const r = Math.random();
      return card({ side: r < 0.001 ? 'edge' : r < 0.5005 ? 'heads' : 'tails' });
    }
    case 'roll': {
      const d = parseDice(args);
      if (!d) return { note: { title: `Can’t roll “${args}”`, body: 'Try: /roll · /roll d20 · /roll 2d6 · /roll 3d6+2 · /roll 100' } };
      const rolls = Array.from({ length: d.n }, () => between(1, d.sides));
      return card({
        sides: d.sides,
        spec: `${d.n > 1 ? d.n : ''}d${d.sides}${d.plus ? (d.plus > 0 ? `+${d.plus}` : d.plus) : ''}`,
        rolls,
        plus: d.plus,
        total: rolls.reduce((a, b) => a + b, 0) + d.plus,
      });
    }
    case 'choose': {
      const options = args
        .split(/\s*\|\s*|\s*,\s*|\s+or\s+/i)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12);
      if (options.length < 2) return { note: { title: 'Give me at least two', body: 'Try: /choose pizza | tacos | sushi' } };
      return card({ options, pick: pick(options) });
    }
    case 'rate': {
      if (!args) return need('something to rate');
      const thing = args.slice(0, 100);
      const score = hash(thing.replace(/[^\w ]/g, '')) % 11;
      return card({ thing, score, quip: RATE_QUIPS.find(([s]) => s === score)[1] });
    }
    case 'ship': {
      const pair = findPeople(args, ctx.roster);
      const a = pair[0] && pair[1] ? pair[0] : me;
      const b = pair[0] && pair[1] ? pair[1] : pair[0];
      if (!b) return { note: { title: 'Ship who?', body: 'Try: /ship @Cooper @Sophia (or just one person to ship them with you)' } };
      const pct = a === b ? 100 : hash([a, b].sort().join('+')) % 101;
      const quip = a === b ? 'Self-love. Valid.' : [...SHIP_QUIPS].reverse().find(([min]) => pct >= min)[1];
      const fa = first(a);
      const fb = first(b);
      const couple = fa.slice(0, Math.ceil(fa.length / 2)) + fb.slice(Math.floor(fb.length / 2));
      return card({ a, b, pct, quip, couple }, { mentions: [a, b].filter((n) => n !== me) });
    }
    case 'wyr': {
      const [x, y] = pick(WOULD_YOU_RATHER);
      return {
        post: {
          text: '',
          cmd: { name: 'wyr' },
          poll: {
            question: 'Would you rather…',
            options: [
              { id: 'a', text: x },
              { id: 'b', text: y },
            ],
            multi: false,
          },
          votes: {},
        },
      };
    }
    case 'fortune': {
      const lucky = Array.from({ length: 3 }, () => between(1, 99));
      return card({ text: pick(FORTUNES), lucky, ratio: `${between(1, 9)}:${between(1, 9)}` });
    }

    case 'pet':
    case 'hug':
    case 'highfive':
    case 'bonk':
    case 'wave': {
      const to = args ? findPerson(args, ctx.roster) : null;
      if (args && !to) return { note: { title: `Who’s “${args}”?`, body: `Try: /${cmd.name} @name` } };
      if (!to && cmd.name !== 'wave') return need('someone (@name)');
      const self = to === me;
      const line = !to ? 'waves at everyone 👋' : self ? SELF[cmd.name] : pick(ACTION[cmd.name].lines).replace('{to}', to);
      return card({ to: to || '', line }, { mentions: to && !self ? [to] : [] });
    }
    default:
      return { note: { title: `/${cmd.name} isn’t ready yet` } };
  }
}

export function whenText(at, now = Date.now()) {
  const d = new Date(at);
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (at - now < 3600000) return `in ${Math.max(1, Math.round((at - now) / 60000))} min (${time})`;
  if (d.toDateString() === today.toDateString()) return `today at ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} at ${time}`;
}
