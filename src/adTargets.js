// "Targeted" ads that know a little too much: each one uses the viewer's own
// numbers (hours this week, overdue tasks, coins…) and only shows when its
// condition is true for them. Ids start with t- so their views count too.

const T = (id, when, make) => ({ id: `t-${id}`, when, make });

export const TARGETS = [
  T(
    'sleep',
    (v) => v.hoursWeek >= 8,
    (v) => ({
      brand: 'Sleep™',
      emoji: '😴',
      colors: ['#2d3436', '#6c5ce7'],
      anim: 'float',
      sticker: 'FOR YOU',
      headline: `${v.first}, ${v.hoursWeek} hours at the lab this week`,
      body: 'Sleep™ misses you. Sleep™ has been texting you. Please text back.',
      cta: 'Claim 8 hours',
      action: { kind: 'book', item: '8 hours of sleep', done: 'Booked. Please actually go.' },
    }),
  ),
  T(
    'lab-gps',
    (v) => v.daysSinceLab >= 5 && v.daysSinceLab < 400,
    (v) => ({
      brand: 'Lab GPS',
      emoji: '🧭',
      colors: ['#0984e3', '#00cec9'],
      anim: 'spin',
      sticker: 'LOST?',
      headline: `${v.first}, it’s been ${v.daysSinceLab} days`,
      body: 'The lab is still there. The robot asked about you. We said you were busy.',
      cta: 'Get directions',
      action: { kind: 'book', item: 'trip to the lab', done: 'Turn left at the snack drawer.' },
    }),
  ),
  T(
    'ctrl-z-overdue',
    (v) => v.overdue >= 1,
    (v) => ({
      brand: 'Ctrl+Z for Real Life',
      emoji: '↩️',
      colors: ['#6c5ce7', '#00cec9'],
      anim: 'spin',
      sticker: 'URGENT',
      headline: `${v.first}, ${v.overdue} overdue task${v.overdue === 1 ? '' : 's'}?`,
      body: 'We can’t undo deadlines. But we can make you feel like we tried.',
      cta: 'Undo the deadline',
      action: { kind: 'submit', ask: 'Which deadline do you want undone?', done: 'Deadline undone. (It was not undone.)' },
    }),
  ),
  T(
    'pit-bar-overachiever',
    (v) => v.doneWeek >= 3,
    (v) => ({
      brand: 'Pit Bar',
      emoji: '🍫',
      colors: ['#6d4c41', '#ffb74d'],
      anim: 'zoom',
      sticker: 'MVP',
      headline: `${v.doneWeek} tasks done this week, ${v.first}?`,
      body: 'Fuel for overachievers. 3,000 calories. You’ve earned at least one.',
      cta: 'Treat yourself',
      action: { kind: 'order', item: 'Pit Bar', done: 'Eat one. Only one. You know the rules.' },
    }),
  ),
  T(
    'rich',
    (v) => v.balance >= 100,
    (v) => ({
      brand: 'Zip Ties Monthly',
      emoji: '💰',
      colors: ['#00b894', '#0984e3'],
      anim: 'bounce',
      sticker: 'VIP',
      headline: `${v.first}, ${v.balance} Jackson coins is a lot of coins`,
      body: 'They’re burning a hole in your pocket. We accept coins. We accept all coins.',
      cta: 'Spend it all',
      action: { kind: 'subscribe', done: 'Thanks for your loyalty. Your first box ships forever.' },
    }),
  ),
  T(
    'broke',
    (v) => v.balance < 10,
    (v) => ({
      brand: 'Lucky Socks Rental',
      emoji: '🧦',
      colors: ['#00b894', '#fdcb6e'],
      anim: 'swing',
      sticker: 'PAY LATER',
      headline: `Only ${v.balance} Jackson coin${v.balance === 1 ? '' : 's'}, ${v.first}?`,
      body: 'Same. Rent the socks now, pay never. Luck not included.',
      cta: 'Rent on credit',
      action: { kind: 'book', item: 'sock pickup', done: 'Bring tongs. No credit check.' },
    }),
  ),
  T(
    'late-night',
    (v) => v.lastEndHour >= 21,
    (v) => ({
      brand: 'Mom Rideshare',
      emoji: '🚗',
      colors: ['#0984e3', '#55efc4'],
      anim: 'drive',
      sticker: 'SURGE',
      headline: `Left the lab at ${v.lastEndText} last time, ${v.first}?`,
      body: 'Your driver is already outside. She has been outside for 40 minutes.',
      cta: 'Request a ride',
      action: { kind: 'book', item: 'pickup', done: 'She’s here. She’s been here.' },
    }),
  ),
  T(
    'on-shift',
    (v) => v.onShift,
    (v) => ({
      brand: 'Torque Juice',
      emoji: '👀',
      colors: ['#ff3d71', '#ffb800'],
      anim: 'pulse',
      sticker: 'WE SEE YOU',
      headline: `We see you’re at the lab right now, ${v.first}`,
      body: 'Torque Juice delivers straight to the pit. We know where the pit is.',
      cta: 'Deliver to me',
      action: { kind: 'order', item: 'Torque Juice to the lab', done: 'Look behind you. (Don’t.)' },
    }),
  ),
  T(
    'competition',
    (v) => v.daysToComp >= 0 && v.daysToComp <= 30,
    (v) => ({
      brand: 'Auto Path Psychic',
      emoji: '🔮',
      colors: ['#8e44ad', '#ff79c6'],
      anim: 'float',
      sticker: 'FORESEEN',
      headline: `${v.daysToComp} days until competition, ${v.first}`,
      body: 'We’ve seen your autonomous in the crystal ball. We’re not going to say anything.',
      cta: 'See the future',
      action: { kind: 'book', item: 'reading', done: 'It drives into the wall at 0:03. Sorry.' },
    }),
  ),
  T(
    'programmer',
    (v) => v.subteams.includes('Programming'),
    (v) => ({
      brand: 'Rubber Duck Debugging Pro',
      emoji: '🦆',
      colors: ['#ffd60a', '#ff9f1c'],
      anim: 'wobble',
      sticker: 'QUACK',
      headline: `${v.first}, the duck noticed your code`,
      body: 'The duck has notes. The duck has a lot of notes.',
      cta: 'Hear the notes',
      action: {
        kind: 'submit',
        ask: 'Paste the line you’re worried about',
        done: 'The duck says: missing semicolon. The duck is always right.',
      },
    }),
  ),
  T(
    'cad',
    (v) => v.subteams.includes('CAD'),
    (v) => ({
      brand: 'PotatoCAD',
      emoji: '🥔',
      colors: ['#b8860b', '#f4d03f'],
      anim: 'spin',
      sticker: 'WE SAW',
      headline: `${v.first}, we saw your CAD`,
      body: 'The potato would like a word. The potato does not speak.',
      cta: 'Talk to the potato',
      action: {
        kind: 'submit',
        ask: 'Explain yourself to the potato',
        done: 'The potato has received your design. The potato is disappointed.',
      },
    }),
  ),
  T(
    'electrical',
    (v) => v.subteams.includes('Electrical'),
    (v) => ({
      brand: 'Wire Spaghetti Begone',
      emoji: '🍝',
      colors: ['#e84393', '#fd79a8'],
      anim: 'wobble',
      sticker: 'WE KNOW',
      headline: `${v.first}, about those wires…`,
      body: 'We’ve seen the inside of the robot. We’re here to help. Please let us help.',
      cta: 'Send help',
      action: { kind: 'order', item: 'emergency spray', done: 'Help is on the way. Help is scared.' },
    }),
  ),
  T(
    'busy',
    (v) => v.open >= 4,
    (v) => ({
      brand: 'Robot Therapy',
      emoji: '🛋️',
      colors: ['#74b9ff', '#a29bfe'],
      anim: 'sway',
      sticker: 'FOR HUMANS',
      headline: `${v.open} open tasks, ${v.first}. How are you feeling?`,
      body: 'We usually do robots, but you look like you need a session.',
      cta: 'Book a session',
      action: { kind: 'book', item: 'session (for you)', done: 'Lie on the couch. Not that couch. That’s the robot’s couch.' },
    }),
  ),
];

// The targeted ads that apply to this viewer right now, ready to show.
export function targetedAds(v) {
  if (!v) return [];
  return TARGETS.filter((t) => {
    try {
      return t.when(v);
    } catch {
      return false;
    }
  }).map((t) => ({ id: t.id, targeted: true, fine: 'This ad was chosen just for you. We know things.', ...t.make(v) }));
}
