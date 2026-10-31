// Multiplayer games in #arcade: challenges (rock paper scissors, tic-tac-toe,
// connect four, duel), and games for whoever's around (trivia, hangman, type
// race, heist). Same shape as casino.js: no Firebase in here, the server's play
// function runs it (and keeps answers, words, and picks where phones can't
// read them); demo mode runs the same code locally.
//
// start(game, ctx) and move(game, ctx) return { error } or
//   { pub, secret, money, mentions }
// pub goes on the chat message (pub.status 'done' ends the game), secret is
// kept hidden, and money is [{ name, delta, entry, extra }]: coins in or out of
// someone's bank (casino.bankAfter). Bets are taken when you join and paid
// out at the end. Trotbot can be challenged too: the house plays (and pays).

import { MINUTE, parseBet } from './casino.js';
import * as bs from './battleship.js';
import { RACE_COUNTDOWN, RACE_PRIZE, rank, raceLimit } from './funGames.js';
import { LEVELS } from './minesweeper.js';

export const MULTI = ['rps', 'tictactoe', 'connect4', 'duel', 'trivia', 'hangman', 'typerace', 'heist', 'battleship', 'tetris', 'minesweep'];
export const CHALLENGES = ['rps', 'tictactoe', 'connect4', 'duel', 'battleship', 'tetris', 'minesweep'];
// Tetris and Minesweeper races: both play the same pieces or board on their
// own screens; the card keeps score (funGame sends in each verified result).
export const RACES = ['tetris', 'minesweep'];
export const BOT = 'Trotbot';
export const ICON = {
  rps: '✊',
  tictactoe: '⭕',
  connect4: '🔴',
  duel: '🤠',
  trivia: '🧠',
  hangman: '🪢',
  typerace: '⌨️',
  heist: '💰',
  battleship: '🚢',
  tetris: '🧱',
  minesweep: '💣',
};
export const LABEL = {
  rps: 'Rock paper scissors',
  tictactoe: 'Tic-tac-toe',
  connect4: 'Connect four',
  duel: 'Duel',
  trivia: 'Trivia',
  hangman: 'Hangman',
  typerace: 'Type race',
  heist: 'Heist',
  battleship: 'Battleship',
  tetris: 'Tetris race',
  minesweep: 'Minesweeper race',
};
// Coins for winning Battleship (the 'game' award, capped per day).
export const BATTLESHIP_PRIZE = { bot: 2, person: 3 };
export const TIMES = {
  challenge: 10 * MINUTE, // to accept
  turn: 3 * MINUTE, // before the other player can claim the win
  trivia: 30000,
  heist: 60000,
  countdown: 5000, // before a type race starts
  race: 90000,
  afterFirst: 15000, // a type race ends this long after someone finishes
  duelIdle: 30000, // nobody shot: bets back
  cooldown: MINUTE, // between starting trivia / hangman / type races
  abandoned: 30 * MINUTE, // a board game nobody touches ends: whoever's turn it was loses
  placing: 5 * MINUTE, // to place your Battleship fleet
};
export const TRIVIA_PRIZE = 8;
// Trivia, hangman, and type races are free to play; what they pay is capped
// per person per day (the team's day), so they can't be farmed.
export const FREE_DAILY = 100;
export function capFree(bank, delta, day) {
  const so = bank.free?.day === day ? bank.free.total || 0 : 0;
  const paid = Math.max(0, Math.min(delta, FREE_DAILY - so));
  return { paid, free: { day, total: so + paid } };
}
// casino.bankAfter's [delta, entry, extra] for one payment in a game's money
// list, with free-game winnings capped (day: the team's day, YYYY-MM-DD).
export function paid(x, bank, day) {
  if (!x.free) return [x.delta, x.entry, x.extra || {}];
  const { paid: n, free } = capFree(bank, x.delta, day);
  const note = n < x.delta ? `+${n}, daily limit reached` : `+${n}`;
  const entry = x.entry && { ...x.entry, label: `${x.entry.label} (${note})`, shown: n };
  return [n, entry, { ...(x.extra || {}), free }];
}

const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pickOf = (rng, list) => list[Math.floor(rng() * list.length)];
const shuffle = (rng, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const isLive = (status) => status && status !== 'done';

// "@Cooper Mlezcko 20", "cooper 20", "trotbot" → { them, betWord }
export function parseChallenge(words, roster) {
  const list = [...words];
  const betWord = list.length && parseBet(list[list.length - 1], 1) != null ? list.pop() : '';
  const text = list.join(' ').replace(/@/g, '').trim().toLowerCase();
  if (!text) return { them: null, betWord };
  if (text === 'trotbot' || text === 'bot') return { them: BOT, betWord };
  const them =
    [...roster].sort((a, b) => b.length - a.length).find((n) => text.includes(n.toLowerCase())) ||
    roster.find((n) => n.toLowerCase().split(' ')[0] === text.split(' ')[0]) ||
    roster.find((n) => n.toLowerCase().startsWith(text)) ||
    null;
  return { them, betWord };
}

// ---------- money ----------

const entry = (game, label, shown) => ({ game, icon: ICON[game], label: `${LABEL[game]}: ${label}`, shown });
const take = (name, amount) => (amount && name !== BOT ? [{ name, delta: -amount, entry: null }] : []);
const refund = (name, amount) => (amount && name !== BOT ? [{ name, delta: amount, entry: null }] : []);

// A challenge's bets: the winner gets both; a tie gives both back.
function settle(game, p, winner) {
  const bet = p.bet || 0;
  if (!bet) return [];
  const other = (n) => (n === p.a ? p.b : p.a);
  if (!winner)
    return [p.a, p.b].filter((n) => n !== BOT).map((n) => ({ name: n, delta: bet, entry: entry(game, `tie with ${other(n)}`, 0) }));
  const loser = other(winner);
  return [
    ...(winner === BOT ? [] : [{ name: winner, delta: 2 * bet, entry: entry(game, `beat ${loser} (won ${bet})`, bet) }]),
    ...(loser === BOT ? [] : [{ name: loser, delta: 0, entry: entry(game, `lost to ${winner} (lost ${bet})`, -bet) }]),
  ];
}

// ---------- the boards ----------

const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
export function tttWinner(board) {
  for (const l of TTT_LINES) if (board[l[0]] !== '.' && l.every((i) => board[i] === board[l[0]])) return { mark: board[l[0]], line: l };
  return null;
}
const put = (board, i, mark) => board.slice(0, i) + mark + board.slice(i + 1);

// Trotbot at tic-tac-toe: wins if it can, blocks if it must, and slips up
// now and then (so it can be beaten).
function tttBot(board, rng) {
  const free = [...board].map((c, i) => (c === '.' ? i : -1)).filter((i) => i >= 0);
  const winsWith = (mark) => free.find((i) => tttWinner(put(board, i, mark)));
  if (rng() < 0.2) return pickOf(rng, free);
  const w = winsWith('O');
  if (w != null) return w;
  const b = winsWith('X');
  if (b != null) return b;
  if (board[4] === '.') return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === '.');
  return corners.length ? pickOf(rng, corners) : pickOf(rng, free);
}

export const C4_COLS = 7;
export const C4_ROWS = 6;
// The row a piece dropped in column col lands on (-1 if it's full).
export const c4Drop = (board, col) => {
  for (let r = C4_ROWS - 1; r >= 0; r--) if (board[r * C4_COLS + col] === '.') return r;
  return -1;
};
export function c4Winner(board) {
  const at = (r, c) => (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS ? board[r * C4_COLS + c] : '');
  for (let r = 0; r < C4_ROWS; r++)
    for (let c = 0; c < C4_COLS; c++) {
      const m = at(r, c);
      if (m === '.') continue;
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        const line = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
        if (line.every(([y, x]) => at(y, x) === m)) return { mark: m, line: line.map(([y, x]) => y * C4_COLS + x) };
      }
    }
  return null;
}
const c4Put = (board, col, mark) => {
  const r = c4Drop(board, col);
  return r < 0 ? null : put(board, r * C4_COLS + col, mark);
};
function c4Bot(board, rng) {
  const cols = [...Array(C4_COLS).keys()].filter((c) => c4Drop(board, c) >= 0);
  const winsWith = (b, mark) => cols.find((c) => c4Drop(b, c) >= 0 && c4Winner(c4Put(b, c, mark)));
  if (rng() < 0.15) return pickOf(rng, cols);
  const w = winsWith(board, 'Y');
  if (w != null) return w;
  const b = winsWith(board, 'R');
  if (b != null) return b;
  // Don't set up their win; lean toward the middle.
  const safe = cols.filter((c) => {
    const after = c4Put(board, c, 'Y');
    return !cols.some((d) => c4Drop(after, d) >= 0 && c4Winner(c4Put(after, d, 'R')));
  });
  const from = safe.length ? safe : cols;
  const weight = (c) => 4 - Math.abs(3 - c);
  const total = from.reduce((t, c) => t + weight(c), 0);
  let r = rng() * total;
  return from.find((c) => (r -= weight(c)) < 0) ?? from[0];
}

export const RPS = { rock: '🪨', paper: '📄', scissors: '✂️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

// ---------- content ----------

// [question, right answer, wrong, wrong, wrong]
export const TRIVIA = [
  ['What does FTC stand for?', 'FIRST Tech Challenge', 'FIRST Team Competition', 'Future Technology Challenge', 'FIRST Tournament Circuit'],
  [
    'What does FIRST stand for?',
    'For Inspiration and Recognition of Science and Technology',
    'Future Innovators in Robotics, Science, and Technology',
    'Foundation for Inventors, Robots, Science, and Tools',
    'For Industry, Research, Science, and Technology',
  ],
  ['Who founded FIRST?', 'Dean Kamen', 'Woodie Flowers', 'Steve Wozniak', 'Elon Musk'],
  ['Who coined the phrase “Gracious Professionalism”?', 'Woodie Flowers', 'Dean Kamen', 'Bill Nye', 'Grace Hopper'],
  [
    'How big can an FTC robot be at the start of a match?',
    '18 × 18 × 18 inches',
    '12 × 12 × 12 inches',
    '24 × 24 × 24 inches',
    '18 × 18 × 24 inches',
  ],
  ['How long is the autonomous period in an FTC match?', '30 seconds', '15 seconds', '45 seconds', '1 minute'],
  ['How long is the driver-controlled period in an FTC match?', '2 minutes', '1 minute', '2 minutes 30 seconds', '3 minutes'],
  ['How many robots are on the field in an FTC match?', '4', '2', '6', '3'],
  ['How many teams are on an alliance in a qualification match?', '2', '3', '1', '4'],
  ['What colors are the two FTC alliances?', 'Red and blue', 'Red and green', 'Blue and yellow', 'Black and white'],
  ['Which comes first in an FTC match?', 'Autonomous', 'TeleOp', 'Endgame', 'The coin toss'],
  ['What is the top award in FTC?', 'Inspire Award', 'Think Award', 'Winning Alliance', 'Control Award'],
  [
    'What do judges read to learn about your design process?',
    'The engineering portfolio',
    'The pit map',
    'The scouting sheet',
    'The robot’s code comments',
  ],
  ['What does “TeleOp” stand for?', 'Teleoperated', 'Telephone operator', 'Television operation', 'Telemetry operation'],
  ['What is the robot’s main computer in FTC?', 'REV Control Hub', 'Raspberry Pi', 'Arduino Uno', 'LEGO Spike Hub'],
  ['Which company makes the Control Hub and Expansion Hub?', 'REV Robotics', 'goBILDA', 'VEX Robotics', 'AndyMark'],
  ['What voltage is an FTC robot battery?', '12 volts', '9 volts', '24 volts', '5 volts'],
  ['What can a driver use as the Driver Station?', 'An Android phone or REV Driver Hub', 'An iPad', 'A laptop', 'A game console'],
  ['What is an “OpMode” in FTC code?', 'A program the robot can run', 'A type of motor', 'A field element', 'A penalty'],
  ['A LinearOpMode runs its code…', 'Top to bottom, in order', 'In a loop 50 times a second', 'Backwards', 'Only in TeleOp'],
  ['Most FTC teams using Android Studio write code in…', 'Java', 'Python', 'C++', 'Swift'],
  ['What FIRST program uses the biggest robots?', 'FIRST Robotics Competition (FRC)', 'FTC', 'FIRST LEGO League', 'VEX IQ'],
  ['Which FIRST program uses LEGO robots?', 'FIRST LEGO League', 'FTC', 'FRC', 'LEGO Masters'],
  [
    'What does “Coopertition” mean?',
    'Competing hard while still helping others',
    'Cooperating to fix the field',
    'A tie match',
    'Two teams sharing a robot',
  ],
  ['When is the new FTC game revealed?', 'At Kickoff, in September', 'In January', 'At the World Championship', 'At the first qualifier'],
  ['What do mecanum wheels let a robot do?', 'Drive sideways (strafe)', 'Climb stairs', 'Spin faster', 'Drive underwater'],
  ['What is “strafing”?', 'Moving sideways without turning', 'Spinning in place', 'Driving backwards', 'Lifting the robot'],
  [
    'What do “dead wheels” do?',
    'Unpowered wheels that track position',
    'Wheels with no tread left',
    'Spare wheels in the pit',
    'Wheels that brake',
  ],
  [
    'What does “odometry” do?',
    'Tracks where the robot is on the field',
    'Measures the battery',
    'Counts penalties',
    'Smooths the joystick',
  ],
  ['What are AprilTags used for?', 'Camera markers that help find position', 'Team name tags', 'Wire labels', 'Inspection stickers'],
  ['What sensor measures how far a motor has turned?', 'An encoder', 'A limit switch', 'A color sensor', 'A potentiometer on the battery'],
  ['What does IMU stand for?', 'Inertial Measurement Unit', 'Internal Motor Unit', 'Integrated Motion Updater', 'Input Monitoring Utility'],
  [
    'What does PID stand for?',
    'Proportional, Integral, Derivative',
    'Power, Input, Direction',
    'Position, Inertia, Distance',
    'Pulse, Idle, Drive',
  ],
  ['What does PWM stand for?', 'Pulse Width Modulation', 'Power With Motors', 'Positive Wire Mode', 'Programmed Wheel Movement'],
  ['What does a servo do that a regular motor doesn’t?', 'Moves to a set position', 'Spins faster', 'Uses no power', 'Runs backwards'],
  [
    'A 20-tooth gear drives a 60-tooth gear. The output turns…',
    '3× slower with 3× the torque',
    '3× faster with 3× the torque',
    '3× faster with less torque',
    'The same speed',
  ],
  ['A 6000 RPM motor through a 20:1 gearbox spins at about…', '300 RPM', '120,000 RPM', '3000 RPM', '60 RPM'],
  [
    'Bigger drive wheels (same motor) make a robot…',
    'Faster, but with less pushing force',
    'Slower and stronger',
    'Turn better',
    'Lighter',
  ],
  ['What is torque?', 'Twisting force', 'Top speed', 'Battery charge', 'Weight'],
  ['Ohm’s law says…', 'V = I × R', 'V = I + R', 'P = I ÷ R', 'R = V × I'],
  ['What do you use to measure voltage?', 'A multimeter', 'A caliper', 'A protractor', 'A torque wrench'],
  ['What color wire usually means negative / ground?', 'Black', 'Red', 'Yellow', 'Green'],
  ['How many sides does a hex shaft have?', '6', '4', '5', '8'],
  ['What screw size does goBILDA use?', 'M4', 'M3', '#10-32', '1/4-20'],
  ['What is blue threadlocker for?', 'Keeping screws from vibrating loose', 'Gluing plastic', 'Insulating wires', 'Greasing gears'],
  ['How many millimeters are in an inch?', '25.4', '10', '2.54', '30'],
  ['What does CAD stand for?', 'Computer-Aided Design', 'Code And Debug', 'Center Axis Drive', 'Computer Assembly Diagram'],
  ['What’s a bill of materials?', 'A list of every part you need', 'The team’s budget', 'The robot’s weight', 'A shipping receipt'],
  ['What does LED stand for?', 'Light-emitting diode', 'Low-energy display', 'Lit electric device', 'Light energy driver'],
  ['How many bits are in a byte?', '8', '4', '16', '10'],
  ['What is 5 in binary?', '101', '110', '111', '100'],
  ['In Java, which keyword means a variable can’t change?', 'final', 'static', 'const', 'fixed'],
  ['Which of Newton’s laws is “every action has an equal and opposite reaction”?', 'The third', 'The first', 'The second', 'The fourth'],
  ['What is a pull request?', 'Asking to merge your code changes', 'A rope for the robot', 'A request for parts', 'A penalty call'],
  ['What unit is torque measured in (metric)?', 'Newton-meters', 'Watts', 'Volts', 'Newtons per second'],
];

// [word or phrase, hint]
export const WORDS = [
  ['MECANUM', 'Drivetrain'],
  ['ODOMETRY', 'Programming'],
  ['ENCODER', 'Sensor'],
  ['SERVO', 'Part'],
  ['GEARBOX', 'Part'],
  ['DRIVETRAIN', 'Robot'],
  ['INTAKE', 'Robot'],
  ['AUTONOMOUS', 'Match'],
  ['ALLIANCE', 'Match'],
  ['INSPECTION', 'Competition'],
  ['PORTFOLIO', 'Judging'],
  ['KICKOFF', 'Season'],
  ['TORQUE', 'Physics'],
  ['VOLTAGE', 'Electrical'],
  ['MULTIMETER', 'Tool'],
  ['SOLDERING', 'Electrical'],
  ['CHAMFER', 'CAD'],
  ['EXTRUSION', 'Build'],
  ['BEARING', 'Part'],
  ['SPROCKET', 'Part'],
  ['PULLEY', 'Part'],
  ['CHASSIS', 'Robot'],
  ['GYROSCOPE', 'Sensor'],
  ['TELEMETRY', 'Programming'],
  ['ITERATION', 'Design'],
  ['PROTOTYPE', 'Design'],
  ['SCOUTING', 'Competition'],
  ['QUALIFIER', 'Competition'],
  ['SPONSOR', 'Outreach'],
  ['OUTREACH', 'Team'],
  ['ZIP TIE', 'The answer to everything'],
  ['HEX KEY', 'Tool'],
  ['HOT GLUE', 'Last resort'],
  ['CONTROL HUB', 'Electrical'],
  ['DRIVER STATION', 'Match'],
  ['GRACIOUS PROFESSIONALISM', 'FIRST'],
  ['INSPIRE AWARD', 'Judging'],
  ['LINEAR SLIDE', 'Mechanism'],
  ['FOUR BAR', 'Mechanism'],
  ['GEAR RATIO', 'Physics'],
  ['PID LOOP', 'Programming'],
  ['ANDROID STUDIO', 'Programming'],
  ['FIELD RESET', 'Competition'],
  ['PIT MAP', 'Competition'],
  ['ENGINEERING NOTEBOOK', 'Judging'],
  ['THREADLOCKER', 'Build'],
  ['CALIPERS', 'Tool'],
  ['ALUMINUM', 'Material'],
  ['POLYCARBONATE', 'Material'],
  ['BATTERY', 'Electrical'],
];

export const SENTENCES = [
  'The robot fits in the sizing box if everyone breathes in at the same time.',
  'Charge the batteries before the match, not during the match.',
  'Measure twice, cut once, and then measure again because someone moved the ruler.',
  'Our autonomous worked perfectly every time until the judges were watching.',
  'Zip ties are temporary until the end of the season, which makes them permanent.',
  'Gracious professionalism means helping the team that just beat you fix their arm.',
  'The intake picked up three game pieces and one very confused volunteer.',
  'Somebody please label the wires before we forget which motor is which.',
  'If the code compiles on the first try, something is definitely wrong.',
  'We had a great match until the battery fell out in the last ten seconds.',
  'Strafing sideways looks cool, but driving straight is also an option.',
  'The drive coach yelled left so the driver turned right with full confidence.',
  'Every screw on this robot is either too long, too short, or missing.',
  'The engineering portfolio is due tomorrow and we have one page and a cover.',
  'Never trust an encoder that has not been reset since last Tuesday.',
  'Hot glue is not a structural material, no matter what the freshman says.',
  'Our robot has seven motors, four servos, and one very tired Control Hub.',
  'The field reset crew deserves a medal and possibly a nap.',
  'Please stop calling the linear slide the robot noodle during inspection.',
  'The best way to fix a bug is to explain it to a rubber duck out loud.',
  'We are not lost, we are taking a scenic route through the pit.',
  'Robot inspection passed on the first try and nobody knows how.',
  'The gear ratio is wrong, but at least it is consistently wrong.',
  'Bring snacks to the queue because the queue is longer than the match.',
  'The robot is ready, the code is ready, and the driver is in the bathroom.',
  'Tighten the set screws now so you do not have to tighten them in the pit.',
  'A good alliance partner shares batteries, snacks, and moral support.',
  'Our mascot is a horse wearing safety glasses, and we are proud of it.',
  'The Harry Trotters do not walk to the field, they trot with purpose.',
  'Practice driving every day so the match feels like just another practice.',
];

const HEIST_WIN = [
  'The crew slipped into the parts room, grabbed the good motors, and walked out whistling.',
  'Someone distracted the mentor with a question about gear ratios. It worked.',
  'They cracked the snack cabinet in under a minute. Legendary.',
  'The vault was just a toolbox. They took the whole thing.',
  'Nobody noticed. Nobody ever checks the bottom drawer.',
];
const HEIST_LOSE = [
  'The alarm went off. It was the robot. It always beeps at the worst time.',
  'Someone tripped over the extension cord. Everyone heard it.',
  'The mentor was waiting inside the parts room. With a clipboard.',
  'The getaway robot drove straight into the wall. Auto was not tuned.',
  'They took a selfie during the heist. The flash gave them away.',
];

const normalize = (s) =>
  String(s || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const maskOf = (word, guessed) => [...word].map((ch) => (ch === ' ' || guessed.includes(ch) ? ch : '')).join('|');
const cooldownLeft = (bank, game, now) => Math.max(0, (bank.cooldowns?.[game] || 0) + TIMES.cooldown - now);

// ---------- starting ----------

// ctx: { me, words, roster, balance, bank, now, rng }
export function start(game, { me, words = [], roster = [], balance = 0, bank = {}, now = Date.now(), rng = Math.random }) {
  if (CHALLENGES.includes(game)) {
    // A Minesweeper race's board size: "/minesweep @Cooper expert 10".
    const level = game === 'minesweep' ? words.map((w) => w.toLowerCase()).find((w) => LEVELS[w]) || 'beginner' : '';
    const rest = level ? words.filter((w) => w.toLowerCase() !== level) : words;
    const { them, betWord } = parseChallenge(rest, roster);
    if (!them) return { error: `Challenge who? Try: /${game} @name 20${RACES.includes(game) ? '' : ' (or @Trotbot)'}` };
    if (them === me) return { error: 'You can’t challenge yourself.' };
    if (them === BOT && RACES.includes(game)) return { error: `Race Trotbot from the game screen: type /${game} and pick Trotbot.` };
    const bet = betWord ? parseBet(betWord, balance) : 0;
    if (bet == null || bet < 0) return { error: 'That’s not a bet.' };
    if (bet > balance) return { error: `You only have ${balance} coins.` };
    const bot = them === BOT;
    const p = { a: me, b: them, bet, at: now, expiresAt: now + TIMES.challenge, status: bot ? 'playing' : 'open', lastAt: now };
    const secret = {};
    if (game === 'rps') {
      p.picked = bot ? [BOT] : [];
      secret.picks = bot ? { [BOT]: pickOf(rng, Object.keys(RPS)) } : {};
    }
    if (game === 'tictactoe') Object.assign(p, { board: '.........', turn: me });
    if (game === 'connect4') Object.assign(p, { board: '.'.repeat(C4_COLS * C4_ROWS), turn: me });
    if (game === 'duel' && bot) startDuel(p, secret, now, rng);
    if (game === 'battleship') {
      p.placed = [];
      if (bot) startPlacing(p, secret, now, rng);
    }
    if (RACES.includes(game)) Object.assign(p, { results: {}, ...(level && { level }) });
    return { pub: p, secret, money: take(me, bet), mentions: bot ? [] : [them] };
  }

  if (game === 'heist') {
    const bet = parseBet(words[0], balance);
    if (!bet || bet < 1) return { error: `/heist needs a bet. Try: /heist 20. You have ${balance} coins.` };
    if (bet > balance) return { error: `You only have ${balance} coins.` };
    return { pub: { status: 'open', bet, crew: [me], endsAt: now + TIMES.heist }, secret: {}, money: take(me, bet), mentions: [] };
  }

  // Trivia, hangman, type race: free to play, small prizes. A minute between starts.
  const left = cooldownLeft(bank, game, now);
  if (left) return { error: `Give it a minute: you can start another in ${Math.ceil(left / 1000)} seconds.` };
  const cool = [{ name: me, delta: 0, entry: null, extra: { cooldowns: { ...bank.cooldowns, [game]: now } } }];
  if (game === 'trivia') {
    const [q, right, ...wrong] = pickOf(rng, TRIVIA);
    const choices = shuffle(rng, [right, ...wrong]);
    return {
      pub: { status: 'playing', q, choices, tried: {}, endsAt: now + TIMES.trivia, prize: TRIVIA_PRIZE },
      secret: { answer: choices.indexOf(right) },
      money: cool,
      mentions: [],
    };
  }
  if (game === 'hangman') {
    const [word, hint] = pickOf(rng, WORDS);
    return {
      pub: { status: 'playing', hint, mask: maskOf(word, []), guessed: [], misses: 0, found: {}, length: word.replace(/ /g, '').length },
      secret: { word },
      money: cool,
      mentions: [],
    };
  }
  if (game === 'typerace') {
    return {
      pub: { status: 'open', startAt: now + TIMES.countdown, results: [] },
      secret: { text: pickOf(rng, SENTENCES) },
      money: cool,
      mentions: [],
    };
  }
  return { error: 'Unknown game.' };
}

// Battleship: both place their fleets (Trotbot's goes straight in).
function startPlacing(p, secret, now, rng) {
  Object.assign(p, { status: 'placing', placeBy: now + TIMES.placing, lastAt: now });
  secret.ships = { ...(secret.ships || {}) };
  if (p.b === BOT) {
    secret.ships[BOT] = bs.randomFleet(rng);
    p.placed = [BOT];
  }
}
// A race: the seed goes on the card, and it starts a few seconds later for both.
function startRace(game, p, now, rng) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const seed = Array.from({ length: 12 }, () => abc[Math.floor(rng() * abc.length)]).join('');
  const startAt = now + RACE_COUNTDOWN;
  Object.assign(p, { seed, startAt, endsAt: startAt + raceLimit(game, p.level), results: {} });
}

function startDuel(p, secret, now, rng) {
  p.status = 'playing';
  p.drawAt = now + rint(rng, 2500, 6000);
  // Trotbot's reflexes: it shoots this long after DRAW (unless you're faster).
  if (p.b === BOT) secret.botAt = p.drawAt + rint(rng, 350, 750);
}

// ---------- moves ----------

// ctx: { pub, secret, me, move, balance, now, rng, verified }. Returns { error }, or
// { pub, secret, money, awards } (write: false when nothing changed, like an
// early peek). awards: coins the server pays through awardCoins ('game').
// verified: a race result the server replayed (funGame); never from the app.
export function move(game, { pub, secret = {}, me, move: mv, balance = 0, now = Date.now(), rng = Math.random, verified = null }) {
  const p = { ...pub };
  const s = { ...secret };
  const m = String(mv || '').slice(0, 400);
  const nothing = { write: false, pub, secret, money: [] };
  const out = (money = [], awards = []) => ({ write: true, pub: p, secret: s, money, awards });
  if (!isLive(p.status)) return nothing;

  if (CHALLENGES.includes(game)) {
    const player = me === p.a || me === p.b;
    const end = (winner, how, money) => {
      Object.assign(p, { status: 'done', winner: winner || '', how });
      return out(money ?? settle(game, p, winner));
    };
    // Waiting for them to accept.
    if (p.status === 'open') {
      if (m === 'peek') return now >= p.expiresAt ? end('', 'expired', refund(p.a, p.bet)) : nothing;
      if (m === 'cancel')
        return me === p.a ? end('', 'cancelled', refund(p.a, p.bet)) : { error: 'Only the person who challenged can cancel.' };
      // The challenger can pick their rock/paper/scissors while they wait.
      if (game === 'rps' && me === p.a && RPS[m]) return rpsPick(p, s, me, m, now);
      if (me !== p.b) return { error: me === p.a ? `Waiting for ${p.b} to accept.` : `This challenge is for ${p.b}.` };
      if (m === 'decline') return end('', 'declined', refund(p.a, p.bet));
      const accepting = m === 'accept' || (game === 'rps' && RPS[m]);
      if (!accepting) return { error: 'Accept the challenge first.' };
      if (p.bet > balance) return { error: `It’s a ${p.bet} coin bet. You have ${balance}.` };
      Object.assign(p, { status: 'playing', lastAt: now });
      if (game === 'duel') startDuel(p, s, now, rng);
      if (game === 'battleship') startPlacing(p, s, now, rng);
      if (RACES.includes(game)) startRace(game, p, now, rng);
      if (m === 'accept') return out(take(me, p.bet));
      // RPS: picking accepts.
      const r = rpsPick(p, s, me, m, now);
      return { ...r, money: [...take(me, p.bet), ...r.money] };
    }
    if (game === 'rps') {
      // Nobody picks for a while: whoever picked wins; if nobody did, bets back.
      if (m === 'peek') {
        if (now - p.lastAt < TIMES.turn) return nothing;
        const picked = (p.picked || []).filter((n) => n === p.a || n === p.b);
        return end(picked.length === 1 ? picked[0] : '', picked.length === 1 ? 'timeout' : 'nopick');
      }
      if (!player) return { error: 'You’re not in this one.' };
      if (!RPS[m]) return { error: 'Rock, paper, or scissors?' };
      return rpsPick(p, s, me, m, now);
    }
    if (game === 'duel') {
      const other = me === p.a ? p.b : p.a;
      if (p.b === BOT && now >= s.botAt && (m === 'peek' || m === 'shoot')) {
        // Trotbot already shot.
        p.ms = s.botAt - p.drawAt;
        return end(BOT, 'shot');
      }
      if (m === 'peek') return p.b !== BOT && now >= p.drawAt + TIMES.duelIdle ? end('', 'nobody') : nothing;
      if (!player || m !== 'shoot') return { error: 'Only the two of them can shoot.' };
      if (now < p.drawAt) return end(other, 'early');
      p.ms = now - p.drawAt;
      return end(me, 'shot');
    }
    if (game === 'battleship') return battleshipMove(p, s, { me, m, now, rng, end, out, player, nothing });
    if (RACES.includes(game)) {
      const other = me === p.a ? p.b : p.a;
      // Ranked by the games' own clocks; whoever didn't send a result lost.
      const settleRace = () => {
        const r = rank(game, p.results[p.a], p.results[p.b]);
        const winner = r > 0 ? p.a : r < 0 ? p.b : '';
        const loser = winner === p.a ? p.b : p.a;
        const res = end(winner, winner && !p.results[loser] ? 'dnf' : 'race');
        res.awards = winner ? [{ person: winner, amount: RACE_PRIZE, label: `${LABEL[game]}: beat ${loser}` }] : [];
        return res;
      };
      if (m === 'peek') return now >= p.endsAt ? settleRace() : nothing;
      if (!player) return { error: 'You’re not in this race.' };
      if (p.results[me]) return { error: 'You already finished.' };
      if (m === 'resign') {
        p.results = { ...p.results, [me]: { gaveUp: true, finished: false, won: false, lines: 0, cells: 0 } };
        return p.results[other] ? settleRace() : out();
      }
      if (m !== 'finish' || !verified) return { error: 'Play it from the game screen.' };
      if (now > p.endsAt + 30000) return settleRace();
      p.results = { ...p.results, [me]: verified };
      return p.results[other] ? settleRace() : out();
    }
    // Tic-tac-toe and connect four.
    const ttt = game === 'tictactoe';
    const markOf = (n) => (ttt ? (n === p.a ? 'X' : 'O') : n === p.a ? 'R' : 'Y');
    const other = me === p.a ? p.b : p.a;
    // Left for good: whoever's turn it was loses (the other player could have claimed it).
    if (m === 'peek') return now - p.lastAt >= TIMES.abandoned ? end(p.turn === p.a ? p.b : p.a, 'timeout') : nothing;
    if (!player) return { error: 'You’re not playing this one.' };
    if (m === 'resign') return end(other, 'resigned');
    if (m === 'claim') {
      if (p.turn === me) return { error: 'It’s your turn.' };
      if (now - p.lastAt < TIMES.turn) return { error: `${p.turn} has ${Math.ceil((p.lastAt + TIMES.turn - now) / 1000)} more seconds.` };
      return end(me, 'timeout');
    }
    if (p.turn !== me) return { error: `It’s ${p.turn}’s turn.` };
    const place = (who, i) => {
      if (ttt) {
        if (!(i >= 0 && i < 9) || p.board[i] !== '.') return false;
        p.board = put(p.board, i, markOf(who));
      } else {
        if (!(i >= 0 && i < C4_COLS)) return false;
        const b = c4Put(p.board, i, markOf(who));
        if (!b) return false;
        p.board = b;
      }
      p.last = ttt ? i : (c4Drop(p.board, i) + 1) * C4_COLS + i;
      return true;
    };
    const finished = () => {
      const w = ttt ? tttWinner(p.board) : c4Winner(p.board);
      if (w) {
        p.line = w.line;
        return end(w.mark === markOf(p.a) ? p.a : p.b, 'line');
      }
      if (!p.board.includes('.')) return end('', 'full');
      return null;
    };
    const i = +m;
    if (!/^\d+$/.test(m) || !place(me, i)) return { error: ttt ? 'Pick an empty square.' : 'That column is full.' };
    p.turn = other;
    p.lastAt = now;
    const done = finished();
    if (done) return done;
    if (other === BOT) {
      place(BOT, ttt ? tttBot(p.board, rng) : c4Bot(p.board, rng));
      p.turn = me;
      return finished() || out();
    }
    return out();
  }

  if (game === 'heist') {
    const resolve = () => {
      const n = p.crew.length;
      const odds = Math.min(0.85, 0.35 + 0.1 * (n - 1));
      const each = Math.floor((p.bet * 0.95) / odds);
      const ok = rng() < odds;
      Object.assign(p, {
        status: 'done',
        ok,
        odds: Math.round(odds * 100),
        each,
        vault: each * n,
        story: pickOf(rng, ok ? HEIST_WIN : HEIST_LOSE),
      });
      return out(
        p.crew.map((name) =>
          ok
            ? { name, delta: each, entry: { game, icon: ICON.heist, label: `Heist: got away with ${each}`, shown: each - p.bet } }
            : { name, delta: 0, entry: { game, icon: '🚓', label: `Heist: caught (lost ${p.bet})`, shown: -p.bet } },
        ),
      );
    };
    if (m === 'peek') return now >= p.endsAt ? resolve() : nothing;
    if (m === 'go') {
      if (me !== p.crew[0]) return { error: 'Only the person who planned it can start early.' };
      if (p.crew.length < 2) return { error: 'You need a crew. Wait for someone to join.' };
      return resolve();
    }
    if (m !== 'join') return { error: 'Join the crew?' };
    if (now >= p.endsAt) return resolve();
    if (p.crew.includes(me)) return { error: 'You’re already in.' };
    if (p.bet > balance) return { error: `It costs ${p.bet} coins to join. You have ${balance}.` };
    p.crew = [...p.crew, me];
    return out(take(me, p.bet));
  }

  if (game === 'trivia') {
    const reveal = (winner) => {
      Object.assign(p, { status: 'done', answer: s.answer, winner: winner || '' });
      return out(
        winner ? [{ name: winner, delta: p.prize, free: true, entry: { icon: ICON.trivia, label: 'Trivia: right answer' } }] : [],
      );
    };
    if (m === 'peek') return now >= p.endsAt ? reveal('') : nothing;
    if (now >= p.endsAt) return reveal('');
    if (me in p.tried) return { error: 'One guess each.' };
    const pick = +m;
    if (!/^[0-3]$/.test(m)) return { error: 'Pick an answer.' };
    p.tried = { ...p.tried, [me]: pick };
    return pick === s.answer ? reveal(me) : out();
  }

  if (game === 'hangman') {
    if (m === 'peek') return nothing;
    const word = s.word;
    const finish = (won, solver) => {
      const found = p.found;
      const money = [];
      if (won) {
        for (const [name, n] of Object.entries(found)) {
          const amount = 2 * n + (name === solver ? 5 : 0);
          money.push({ name, delta: amount, free: true, entry: { icon: ICON.hangman, label: `Hangman: ${word}` } });
        }
        if (solver && !found[solver])
          money.push({ name: solver, delta: 5, free: true, entry: { icon: ICON.hangman, label: `Hangman: solved ${word}` } });
      }
      Object.assign(p, { status: 'done', won, word, solver: solver || '' });
      return out(money);
    };
    if (m.startsWith('solve:')) {
      const guess = normalize(m.slice(6)).toUpperCase();
      if (!guess) return { error: 'Type the whole word.' };
      if (guess === word) {
        p.guessed = [...new Set([...p.guessed, ...word.replace(/ /g, '')])];
        p.mask = maskOf(word, p.guessed);
        return finish(true, me);
      }
      p.misses += 1;
      p.wrongSolves = [...(p.wrongSolves || []), { name: me, guess: guess.slice(0, 30) }];
      return p.misses >= 6 ? finish(false) : out();
    }
    const letter = m.toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return { error: 'Pick a letter.' };
    if (p.guessed.includes(letter)) return { error: `${letter} was already guessed.` };
    p.guessed = [...p.guessed, letter];
    const hits = [...word].filter((ch) => ch === letter).length;
    if (hits) {
      p.found = { ...p.found, [me]: (p.found[me] || 0) + 1 };
      p.mask = maskOf(word, p.guessed);
      if (!p.mask.split('|').includes('')) return finish(true, me);
    } else {
      p.misses += 1;
      if (p.misses >= 6) return finish(false);
    }
    p.lastGuess = { name: me, letter, hit: hits > 0 };
    return out();
  }

  if (game === 'typerace') {
    const end = () => {
      const results = [...p.results].sort((a, b) => a.ms - b.ms);
      const paid = results.length >= 2;
      const prize = 10 + 2 * (results.length - 1);
      Object.assign(p, { status: 'done', results, winner: results[0]?.name || '', prize: paid ? prize : 0 });
      return out(
        paid
          ? [
              {
                name: results[0].name,
                delta: prize,
                free: true,
                entry: { icon: ICON.typerace, label: `Type race: 1st of ${results.length}` },
              },
            ]
          : [],
      );
    };
    if (p.status === 'open') {
      if (now < p.startAt) return m === 'peek' ? nothing : { error: 'Wait for GO.' };
      Object.assign(p, { status: 'playing', text: s.text, endsAt: p.startAt + TIMES.race });
      if (m === 'peek') return out();
    }
    if (now >= p.endsAt) return end();
    if (m === 'peek') return nothing;
    if (!m.startsWith('type:')) return { error: 'Type the sentence.' };
    if (p.results.some((r) => r.name === me)) return { error: 'You already finished.' };
    const typed = normalize(m.slice(5));
    const want = normalize(s.text);
    if (typed !== want) {
      const a = typed.split(' ');
      const b = want.split(' ');
      const at = b.findIndex((w, i) => a[i] !== w);
      return { error: `Not quite. Check “${b[Math.max(0, at)]}” (word ${Math.max(0, at) + 1}).` };
    }
    const ms = now - p.startAt;
    const wpm = Math.round(want.length / 5 / (ms / 60000));
    p.results = [...p.results, { name: me, ms, wpm }];
    if (p.results.length === 1) p.endsAt = Math.min(p.endsAt, now + TIMES.afterFirst);
    return out();
  }
  return { error: 'Unknown game.' };
}

// ---------- Battleship ----------

// pub: placed [names], turn, shots { name: what's been fired at name's board },
// sunk { name: [{ k, cells }] }, last { by, i, hit, sunk }. The fleets stay
// in the secret until the game ends (then they're shown).
const sunkCells = (p, name) => (p.sunk?.[name] || []).flatMap((x) => x.cells);
const afloat = (p, name) => {
  const gone = new Set((p.sunk?.[name] || []).map((x) => x.k));
  return bs.FLEET.map(([, len], k) => (gone.has(k) ? 0 : len)).filter(Boolean);
};
function battleshipMove(p, s, { me, m, now, rng, end, player, nothing }) {
  const other = me === p.a ? p.b : p.a;
  const finish = (winner, how) => {
    if (s.ships) p.fleets = s.ships;
    const res = end(winner, how);
    const loser = winner === p.a ? p.b : p.a;
    res.awards =
      winner && winner !== BOT && how === 'sunk'
        ? [{ person: winner, amount: loser === BOT ? BATTLESHIP_PRIZE.bot : BATTLESHIP_PRIZE.person, label: `Battleship: beat ${loser}` }]
        : [];
    return res;
  };
  const out = () => ({ write: true, pub: p, secret: s, money: [], awards: [] });
  if (p.status === 'placing') {
    if (m === 'peek') {
      if (now < p.placeBy) return nothing;
      const placed = (p.placed || []).filter((n) => n === p.a || n === p.b);
      return placed.length === 1 ? finish(placed[0], 'timeout') : end('', 'noplace');
    }
    if (!player) return { error: 'You’re not playing this one.' };
    if (m === 'resign') return finish(other, 'resigned');
    if (!m.startsWith('place:')) return { error: 'Place your ships first.' };
    if ((p.placed || []).includes(me)) return { error: 'Your ships are already placed.' };
    const ships = bs.parseFleet(m.slice(6));
    if (!ships) return { error: 'Those ships don’t fit there.' };
    s.ships = { ...(s.ships || {}), [me]: ships };
    p.placed = [...(p.placed || []), me];
    p.lastAt = now;
    if (s.ships[p.a] && s.ships[p.b])
      Object.assign(p, {
        status: 'playing',
        turn: p.a,
        shots: { [p.a]: bs.emptyShots(), [p.b]: bs.emptyShots() },
        sunk: { [p.a]: [], [p.b]: [] },
      });
    return out();
  }
  // Left for good: whoever's turn it was loses.
  if (m === 'peek') return now - p.lastAt >= TIMES.abandoned ? finish(p.turn === p.a ? p.b : p.a, 'timeout') : nothing;
  if (!player) return { error: 'You’re not playing this one.' };
  if (m === 'resign') return finish(other, 'resigned');
  if (m === 'claim') {
    if (p.turn === me) return { error: 'It’s your turn.' };
    if (now - p.lastAt < TIMES.turn) return { error: `${p.turn} has ${Math.ceil((p.lastAt + TIMES.turn - now) / 1000)} more seconds.` };
    return finish(me, 'timeout');
  }
  if (p.turn !== me) return { error: `It’s ${p.turn}’s turn.` };
  const shoot = (by, at, i) => {
    const r = bs.fire(p.shots[at], s.ships[at], i);
    p.shots = { ...p.shots, [at]: r.shots };
    if (r.sunk >= 0) p.sunk = { ...p.sunk, [at]: [...(p.sunk[at] || []), { k: r.sunk, cells: s.ships[at][r.sunk] }] };
    p.last = { by, i, hit: r.hit, sunk: r.sunk >= 0 ? bs.FLEET[r.sunk][0] : '' };
    return r.all;
  };
  if (!/^(fire:)?\d+$/.test(m)) return { error: 'Pick a square to fire at.' };
  const i = +m.replace(/^fire:/, '');
  if (!(i >= 0 && i < bs.N * bs.N)) return { error: 'Pick a square to fire at.' };
  if (p.shots[other][i] !== '.') return { error: 'You already fired there.' };
  p.lastAt = now;
  p.mine = null;
  if (shoot(me, other, i)) return finish(me, 'sunk');
  p.turn = other;
  if (other === BOT) {
    // Trotbot answers right away; the card shows both shots.
    p.mine = p.last;
    const at = bs.botAim(p.shots[me], sunkCells(p, me), afloat(p, me), rng);
    if (shoot(BOT, me, at)) return finish(BOT, 'sunk');
    p.turn = me;
  }
  return out();
}

// Your own fleet, for your screen only (the play function's 'mine' move).
export const myFleet = (game, secret, me) => (game === 'battleship' ? secret?.ships?.[me] || null : null);

function rpsPick(p, s, me, pick, now) {
  if (s.picks?.[me]) return { error: 'You already picked.' };
  s.picks = { ...(s.picks || {}), [me]: pick };
  p.picked = [...(p.picked || []), me];
  p.lastAt = now;
  if (!s.picks[p.a] || !s.picks[p.b]) return { write: true, pub: p, secret: s, money: [] };
  const a = s.picks[p.a];
  const b = s.picks[p.b];
  const winner = a === b ? '' : BEATS[a] === b ? p.a : p.b;
  Object.assign(p, { status: 'done', picks: s.picks, winner, how: winner ? 'beat' : 'tie' });
  return { write: true, pub: p, secret: s, money: settle('rps', p, winner) };
}
