// Flows for the seasonal packs in src/adPacks.js (see src/adFlows.js for the format).
export default {
  // ---------- Halloween ----------
  'haunted-hex-keys': {
    title: 'Adopt a cursed hex key',
    item: 'cursed hex key',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many keys', max: 13, unit: 'keys' },
      {
        key: 'size',
        type: 'choice',
        label: 'Size (it will change)',
        options: [
          { label: '3/32"', note: 'It will be 2.5 mm by morning.' },
          { label: '2.5 mm', note: 'Bold choice. It will be 3/32" by morning.' },
          { label: 'Whatever size you need', note: 'Then it will be every size except that one.' },
          { label: 'Surprise me', note: 'It always does.' },
        ],
      },
      {
        key: 'hide',
        type: 'multi',
        label: 'Favorite hiding spots',
        max: 3,
        options: ['Under the robot', 'Inside the robot', 'Your pocket', 'The field perimeter', 'Another team’s pit'],
      },
      { key: 'name', type: 'text', label: 'Name your key', placeholder: 'Sir Allen of Wrench', max: 30 },
    ],
    cta: 'Summon the keys',
    confirm: '{qty} cursed, size {size}. {name} has already escaped to: {hide}.',
    track: {
      packed: ['Packed in a box. The box is now empty. We packed them again.', 'Sealed with garlic. Wait, that’s vampires.'],
      shipped: ['They shipped themselves. We didn’t even print a label.'],
      twists: [
        { icon: '👻', title: 'Your keys escaped the truck', body: 'Kevin found two in the cupholder. One is now a 5/64".' },
        {
          icon: '🕯️',
          title: 'A séance was held in the warehouse',
          body: 'The keys said they want to go to your lab. Specifically under the robot.',
        },
      ],
      places: ['Left under the robot. Obviously.', 'Left in a drawer. The drawer is now locked from the inside.'],
    },
    scene: {
      type: 'catch',
      prompt: 'The keys are floating around the lab. Grab them before they vanish (not the ghosts).',
      emoji: '🗝️',
      goal: 7,
      decoys: ['👻', '🦇', '🕸️'],
      speed: 'fast',
      win: 'Got them all. {name} is now {size}. Check again in five minutes. It won’t be.',
    },
  },

  'pumpkin-torque': {
    title: 'Brew your Pumpkin Spice Torque Juice',
    item: 'Pumpkin Spice Torque Juice',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many cans', max: 24, unit: 'cans' },
      { key: 'spice', type: 'slider', label: 'Spice level', min: 0, max: 10, marks: { 0: 'Just pumpkin', 10: 'A candle store' } },
      {
        key: 'topping',
        type: 'choice',
        label: 'Topping',
        options: [
          { label: 'Whipped cream', note: 'Keep it off the Control Hub.' },
          { label: 'Cinnamon dust', note: 'It gets in the gearbox. It stays in the gearbox.' },
          { label: 'Metal shavings', note: 'Already in there, honestly.' },
          { label: 'A tiny scarf', note: 'For the can. It’s fall.' },
        ],
      },
      { key: 'cozy', type: 'toggle', label: 'Cozy sweater sleeve', on: 'Sleeve on, very cozy', off: 'Naked can, still cozy' },
    ],
    cta: 'Fall into it',
    confirm: '{qty} at spice level {spice}, topped with {topping}. Your robot will smell like a candle.',
    track: {
      packed: ['Packed with a decorative gourd. Nobody knows why.', 'Packed in a hay bale. Shipping it is a problem.'],
      shipped: ['Shipped on a hayride. Slow, but festive.'],
      twists: [
        { icon: '🍂', title: 'Your package is buried in leaves', body: 'Kevin jumped in the pile. Kevin is not coming out.' },
        {
          icon: '🕯️',
          title: 'Your package smells too good',
          body: 'Three people followed the truck. They want to know what candle that is.',
        },
      ],
      places: ['Left on the porch next to a pumpkin. Which one is which?', 'Left at the lab door, glowing slightly.'],
    },
    scene: {
      type: 'dial',
      prompt: 'Find the perfect spice. Turn it until the robot purrs.',
      emoji: '🎃',
      left: 'Plain pumpkin',
      right: 'Cinnamon tornado',
      hints: ['Tastes like a plain pumpkin.', 'Getting cozy…', 'It smells like October in here!'],
      win: 'Perfect. Your robot now smells like {topping} and runs 4% faster out of pure coziness.',
    },
  },

  'ghost-wiring': {
    title: 'Book a haunting for your wiring',
    item: 'haunting',
    fields: [
      { key: 'when', type: 'when', label: 'Haunting time' },
      {
        key: 'ghost',
        type: 'choice',
        label: 'Ghost',
        options: [
          { label: 'Friendly ghost', note: 'Unplugs things to say hi.' },
          { label: 'Inspector ghost', note: 'Only appears when someone checks your wire gauge.' },
          { label: 'Ghost of last season', note: 'Still mad about that one match.' },
          { label: 'Poltergeist', note: 'Throws your zip ties. Very fast. Very far.' },
        ],
      },
      {
        key: 'wires',
        type: 'multi',
        label: 'Wires to haunt',
        options: ['Battery lead', 'Servo cable', 'USB to the Control Hub', 'The mystery wire'],
      },
      { key: 'spooky', type: 'slider', label: 'Spookiness', min: 1, max: 10, marks: { 1: 'Flicker', 10: 'Full brownout' } },
    ],
    cta: 'Invite the ghost',
    confirm: 'A {ghost} will haunt your {wires} {when}. Spookiness: {spooky}. Everything works until an inspector looks.',
    track: {
      confirmed: ['The {ghost} confirmed. It said “boo.” We think that’s yes.'],
      remind: ['Your haunting is in 1 hour. Please leave a wire loose for them.', 'One hour. The ghost is doing vocal warm-ups.'],
      late: [
        { icon: '🕯️', title: 'running late', body: 'The ghost got stuck in a wall. It happens more than you’d think.' },
        { icon: '🔌', title: 'flickering', body: 'The ghost is here. Also not here. It’s complicated.' },
      ],
    },
    scene: {
      type: 'cards',
      prompt: 'Three wires. One is haunted. Pick a wire.',
      emoji: '🕸️',
      results: [
        'Haunted! It works perfectly. That’s the scary part.',
        'Not haunted. It just doesn’t work. That’s normal.',
        'It whispered “check your crimps.” It was right.',
        'This one is haunted by the ghost of a stripped screw.',
      ],
      win: 'Your {ghost} has settled in. Spookiness: {spooky}.',
    },
  },

  'zombie-battery': {
    title: 'Order a Zombie Battery',
    item: 'Zombie Battery',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many batteries', max: 10, unit: 'batteries' },
      {
        key: 'death',
        type: 'choice',
        label: 'When should it die?',
        options: [
          { label: 'Right before a match', note: 'Classic. Timeless.' },
          { label: 'During autonomous', note: 'Ambitious.' },
          { label: 'In the queue line', note: 'So you can panic in public.' },
          { label: 'Never (lie)', note: 'It will die. It always dies.' },
        ],
      },
      {
        key: 'volts',
        type: 'slider',
        label: 'Resting voltage',
        min: 11,
        max: 14,
        step: 0.1,
        unit: 'V',
        marks: { 11: 'Undead', 14: 'Suspicious' },
      },
      { key: 'brains', type: 'toggle', label: 'Feed it brains', on: 'Brains included (foam)', off: 'No brains, just vibes' },
    ],
    cta: 'Bring it to life',
    confirm: '{qty}, resting at {volts}. It will die {death}. {brains}.',
    track: {
      packed: ['Packed in a coffin-shaped box. It kept trying to get out.', 'Packed dead. Arrived alive. Let us explain.'],
      twists: [
        { icon: '🧟', title: 'Your battery rose from the box', body: 'It’s walking the rest of the way. Slowly. Arms out.' },
        { icon: '🪦', title: 'Your battery died in transit', body: 'Don’t worry. It does that. Give it a minute.' },
      ],
      places: ['Left on the charger. It’s pretending to be asleep.', 'Left by the lab door, moaning softly at 11.8 V.'],
    },
    scene: {
      type: 'hold',
      prompt: 'It’s dead again. Hold the button to bring it back to life.',
      emoji: '🧟',
      button: 'Hold to revive',
      ms: 3000,
      stages: ['11.6 V… nothing.', '11.9 V… a twitch.', '12.1 V… IT’S ALIVE!'],
      early: 'You let go. It flatlined. It’s also kind of mad at you now.',
      win: 'It’s alive at {volts}! It will die {death}. You have about 40 seconds.',
    },
  },

  'skeleton-crew': {
    title: 'Book a skeleton crew',
    item: 'skeleton crew',
    fields: [
      { key: 'when', type: 'when', label: 'Shift starts' },
      { key: 'count', type: 'slider', label: 'Skeletons', min: 1, max: 12, marks: { 1: 'Lonely', 12: 'Full lab' } },
      {
        key: 'job',
        type: 'choice',
        label: 'Their job',
        options: [
          { label: 'Look busy', note: 'Their specialty.' },
          { label: 'Hold the robot', note: 'They will drop it. They have no muscles.' },
          { label: 'Be the drive team', note: 'They have a great grip on the controller. Bone grip.' },
          { label: 'Judge interviews', note: 'They will say nothing. Very mysterious.' },
        ],
      },
      { key: 'hats', type: 'toggle', label: 'Matching team shirts', on: 'Team shirts on the skeletons', off: 'Skeletons as-is' },
    ],
    cta: 'Rattle them up',
    confirm: '{count} skeletons will show up {when} to {job}. {hats}. They will just stand there.',
    track: {
      confirmed: ['{count} skeletons confirmed. They nodded. A skull fell off.'],
      remind: [
        'Your skeletons arrive in 1 hour. Please clear a corner for them to stand in.',
        'One hour. The skeletons are ironing their shirts.',
      ],
      late: [
        { icon: '🦴', title: 'running late', body: 'One skeleton lost a leg on the bus. They’re looking for it.' },
        { icon: '💀', title: 'rattling slowly', body: 'They took the stairs. Skeletons are terrible at stairs.' },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: '…',
          options: [
            { label: 'Hi?', reply: '*rattles politely*' },
            { label: 'Can you hold this?', reply: '*drops it immediately*' },
            { label: 'Are you okay?', reply: '*jaw falls off*' },
          ],
        },
        {
          say: '*stares at the robot for a long time*',
          options: [
            { label: 'Any ideas?', reply: '*points at the wiring, then at you, then shrugs*' },
            { label: 'Do you want to drive?', reply: '*grabs the controller. drives directly into the wall*' },
          ],
        },
      ],
      win: '{count} skeletons stood in your lab for three hours. Nothing got done. The lab looked so busy.',
    },
  },

  'trick-or-bolt': {
    title: 'Order a mystery bolt bag',
    item: 'mystery bolt bag',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many bags', max: 20, unit: 'bags' },
      {
        key: 'want',
        type: 'choice',
        label: 'The bolt you actually need',
        options: [
          { label: 'M4 × 8', note: 'You will not get an M4 × 8.' },
          { label: 'M3 × 12', note: 'Noted. Ignored.' },
          { label: '#8-32 × 1/2"', note: 'Wrong system entirely. Bold.' },
          { label: 'Any bolt at all', note: 'Even that is not guaranteed.' },
        ],
      },
      { key: 'candy', type: 'slider', label: 'Candy ratio', min: 0, max: 100, unit: '%', marks: { 0: 'All bolts', 100: 'All candy corn' } },
      { key: 'costume', type: 'text', label: 'Your costume', placeholder: 'A robot (the robot is also a robot)', max: 40 },
    ],
    cta: 'Trick or treat',
    confirm: '{qty} with {candy} candy. You need {want}. You will not get {want}. Nice {costume} costume.',
    track: {
      packed: ['Shaken, not sorted.', 'Packed by someone wearing a mask. We think it’s Kevin.'],
      twists: [
        { icon: '🍬', title: 'Someone ate a bolt', body: 'They thought it was candy. It was a #10 washer. They’re fine. Mostly.' },
        { icon: '🎃', title: 'Your driver stopped to trick-or-treat', body: 'He’s on house 14. He’s doing great.' },
      ],
      places: ['Left on the porch in a plastic pumpkin.', 'Handed to a kid dressed as a Control Hub.'],
    },
    scene: {
      type: 'cards',
      prompt: 'Reach into the bag. Pick one.',
      emoji: '🍬',
      results: [
        'Trick! An M5 × 40. You needed {want}.',
        'Treat! A candy corn. Still not a fastener.',
        'A 7/64" hex key. Haunted, probably.',
        'Exactly {want}! …No, wait. It’s metric. It’s always metric.',
        'A tiny spider. It’s plastic. Probably.',
      ],
      win: 'Happy Halloween, {costume}.',
    },
  },

  'witch-lube': {
    title: 'Brew a cauldron of lubricant',
    item: 'cauldron of lubricant',
    fields: [
      {
        key: 'ingredients',
        type: 'multi',
        label: 'Ingredients',
        max: 3,
        options: ['Eye of newt', 'WD-40', 'Bat wing', 'Grease from the lab door', 'Tears of a programmer'],
      },
      {
        key: 'color',
        type: 'choice',
        label: 'Glow color',
        options: [
          { label: 'Toxic green', note: 'Classic witch.' },
          { label: 'Purple', note: 'Matches the alliance banner.' },
          { label: 'Red and blue', note: 'It glows whichever alliance you’re on.' },
        ],
      },
      { key: 'cackle', type: 'slider', label: 'Gearbox cackle volume', min: 0, max: 10, marks: { 0: 'Giggle', 10: 'Full witch' } },
    ],
    cta: 'Double, double',
    confirm: 'One cauldron of {ingredients}, glowing {color}. Your gears will cackle at volume {cackle}.',
    track: {
      packed: ['Bubbled over twice. We used more cauldrons.', 'Packed on a broom. Shipping on a broom.'],
      shipped: ['Shipped by broom. Weather permitting.'],
      twists: [
        { icon: '🧹', title: 'Your broom took a detour', body: 'It flew over a regional competition. Several teams waved.' },
        { icon: '🐈‍⬛', title: 'A black cat crossed the delivery path', body: 'Kevin turned around. Kevin is superstitious now.' },
      ],
      places: ['Left bubbling on the lab bench.', 'Left by the gearbox. It’s already cackling.'],
    },
    scene: {
      type: 'tap',
      prompt: 'Stir the cauldron. Stir it fast before it sets.',
      emoji: '🧙',
      button: 'Stir',
      goal: 16,
      stages: ['Bubble.', 'Bubble, bubble.', 'It glows {color}.', 'The gearbox is giggling.', 'THE GEARBOX IS CACKLING.'],
      win: 'Done. Your gearbox runs smooth and cackles at volume {cackle}. Do not make eye contact with it.',
    },
  },

  'vampire-charger': {
    title: 'Invite a Vampire Charger in',
    item: 'Vampire Charger',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many chargers', max: 6, unit: 'chargers' },
      {
        key: 'invite',
        type: 'choice',
        label: 'How you invite it in',
        options: [
          { label: '“Please come in”', note: 'Polite. It will drain politely.' },
          { label: '“I guess?”', note: 'It counts. Unfortunately.' },
          { label: 'Leave the lab door open', note: 'That’s an invitation, legally.' },
        ],
      },
      {
        key: 'garlic',
        type: 'toggle',
        label: 'Garlic on the battery',
        on: 'Garlic applied (battery smells weird)',
        off: 'No garlic, good luck',
      },
      { key: 'hours', type: 'slider', label: 'Nights per week it charges', min: 1, max: 7, marks: { 7: 'Every night' } },
    ],
    cta: 'Let it in',
    confirm: '{qty}, invited with {invite}. It charges {hours} nights a week. {garlic}.',
    track: {
      packed: ['Packed in a tiny coffin. Shipped after sunset only.', 'Packed in the dark. It insisted.'],
      shipped: ['Shipped after sundown. It refused to leave earlier.'],
      twists: [
        { icon: '🌅', title: 'Delivery paused for sunrise', body: 'Your charger is hiding in the truck until it gets dark.' },
        { icon: '🦇', title: 'Your charger turned into a bat', body: 'It’s flying the rest of the way. It’s actually faster.' },
      ],
      places: ['Left at the charging station. It waited to be invited in.', 'Left in the darkest corner of the lab.'],
    },
    scene: {
      type: 'unbox',
      taps: 4,
      prompt: 'Open the coffin. Slowly.',
      inside: [
        'It whispers: “I vant to drain your batteries.” Your batteries are now 11.2 V.',
        'It’s already plugged into your best battery. That battery is now 11.4 V.',
        'It came with a cape. The cape is a USB-C cable.',
      ],
    },
  },

  // ---------- Competition ----------
  'zip-tie-express': {
    title: 'Rush zip ties to your pit',
    item: 'emergency zip ties',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many zip ties', max: 99, unit: 'zip ties' },
      {
        key: 'minutes',
        type: 'slider',
        label: 'Minutes until inspection',
        min: 1,
        max: 30,
        unit: 'min',
        marks: { 1: 'PANIC', 30: 'Relaxed (lie)' },
      },
      {
        key: 'color',
        type: 'choice',
        label: 'Color',
        options: [
          { label: 'Black', note: 'Professional. Invisible. Lost forever.' },
          { label: 'Team colors', note: 'Very spirited.' },
          { label: 'Glow in the dark', note: 'For the 11 PM rebuild.' },
          { label: 'Whatever’s on the scooter', note: 'It’s black. It’s always black.' },
        ],
      },
      { key: 'pit', type: 'text', label: 'Pit number', placeholder: 'Pit 12, next to the loud team', max: 40 },
    ],
    cta: 'Send the scooter',
    confirm: '{qty} in {color}, heading to {pit}. Inspection in {minutes}. Do not run in the pits.',
    track: {
      packed: ['Grabbed in one handful. No time to count.', 'Packed into a backpack at full speed.'],
      shipped: ['A teenager on a scooter just left. Very fast. Very unsafe.'],
      twists: [
        {
          icon: '🛵',
          title: 'Your scooter got stopped by a volunteer',
          body: 'No running in the pits. That includes scooters. Especially scooters.',
        },
        { icon: '📢', title: 'Your scooter is lost in the venue', body: 'He’s in the cafeteria. He doesn’t know how he got here.' },
      ],
      out: ['The scooter is 3 pits away. The scooter has been 3 pits away for a while.'],
      places: ['Thrown into {pit} from a moving scooter.', 'Handed to whoever was holding the robot.'],
    },
    scene: {
      type: 'catch',
      prompt: 'He’s throwing them as he drives by! Catch the zip ties.',
      emoji: '🪢',
      goal: 8,
      decoys: ['🍌', '📋', '🔋'],
      speed: 'fast',
      win: 'Caught! {qty} in {color}, and you still have {minutes} until inspection. Go zip something.',
    },
  },

  'inspection-candles': {
    title: 'Light an inspection prayer candle',
    item: 'prayer candle',
    fields: [
      {
        key: 'scent',
        type: 'choice',
        label: 'Scent',
        options: [
          { label: 'Bumper Height', note: 'Smells like a tape measure.' },
          { label: 'Please Don’t Check the Size', note: 'Smells like an 18.1-inch robot.' },
          { label: 'Wire Gauge Lavender', note: 'Calming. Mostly.' },
          { label: 'Fresh Zip Tie', note: 'Smells like plastic and hope.' },
        ],
      },
      { key: 'fears', type: 'multi', label: 'What you’re worried about', options: ['Size', 'Weight', 'Bumpers', 'Wiring', 'Everything'] },
      {
        key: 'faith',
        type: 'slider',
        label: 'How sure you are you’ll pass',
        min: 0,
        max: 100,
        unit: '%',
        marks: { 0: 'Doomed', 100: 'Delusional' },
      },
      { key: 'qty', type: 'qty', label: 'Candles', max: 12, unit: 'candles' },
    ],
    cta: 'Light it',
    confirm: '{qty} of {scent}, lit for: {fears}. You are {faith} sure. The candle is less sure.',
    track: {
      packed: ['Packed next to a tape measure, for luck.', 'Blessed by a former head referee.'],
      twists: [
        {
          icon: '🕯️',
          title: 'Your candle was confiscated',
          body: 'No flames in the pits. We sent a battery-powered one. It flickers nervously.',
        },
        { icon: '📏', title: 'Your candle failed inspection', body: 'It was 18.1 inches tall. We trimmed it.' },
      ],
      places: ['Left at the inspection table. The inspector is looking at it.', 'Left in your pit, glowing hopefully.'],
    },
    scene: {
      type: 'cards',
      prompt: 'Your robot is on the table. Draw your inspector.',
      emoji: '📋',
      results: [
        'The Nice Inspector. Passed in 4 minutes. They complimented your wiring.',
        'The Tape Measure Inspector. They measured three times. You passed by 1 mm.',
        'The Inspector Who Asks Questions. “Why is this wire purple?” You don’t know.',
        'The Sizing Box. It fits! (You held your breath.)',
      ],
      win: 'The {scent} candle did its job. Mostly.',
    },
  },

  'alliance-charm-school': {
    title: 'Book a charm lesson',
    item: 'charm lesson',
    fields: [
      { key: 'when', type: 'when', label: 'Lesson time' },
      {
        key: 'seed',
        type: 'choice',
        label: 'Who you want to impress',
        options: [
          { label: 'The #1 seed', note: 'Aim high.' },
          { label: 'The #2 seed', note: 'Realistic. Respectable.' },
          { label: 'Literally anyone', note: 'Honest. We like that.' },
        ],
      },
      {
        key: 'auto',
        type: 'slider',
        label: 'How well your auto works',
        min: 0,
        max: 100,
        unit: '%',
        marks: { 0: 'It exists', 100: 'Lie' },
      },
      {
        key: 'skill',
        type: 'multi',
        label: 'Skills to practice',
        options: ['Handshake', 'Eye contact', 'Saying “consistent”', 'Hiding the broken arm'],
      },
    ],
    cta: 'Book the lesson',
    confirm: 'Lesson {when}: {skill}. Target: {seed}. Your auto works {auto} of the time (say “consistently”).',
    track: {
      confirmed: ['Your instructor confirmed with a very firm handshake.'],
      remind: ['Lesson in 1 hour. Practice smiling at a mirror. Not like that.', 'One hour. Please prepare a story about your auto.'],
      late: [
        { icon: '🤝', title: 'running late', body: 'Your instructor got picked by another alliance on the way.' },
        { icon: '📊', title: 'running late', body: 'They stopped to read the rankings. They’re worried about you.' },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: 'Hi! I’m the {seed}. Tell me about your robot.',
          options: [
            { label: 'Our auto is very consistent', reply: 'Interesting. How consistent?' },
            { label: 'We have a robot', reply: 'Bold opener. I respect that.' },
            { label: '*maintains eye contact*', reply: '…Okay. That’s a lot of eye contact.' },
          ],
        },
        {
          say: 'What does your auto do?',
          options: [
            { label: 'Scores. Every time.', reply: 'Every time?' },
            { label: 'It moves forward', reply: 'Honest. We’ll take it.' },
            { label: '*firm handshake*', reply: 'That’s… a great handshake. Okay, you’re in.' },
          ],
        },
      ],
      win: 'Charm level: graduated. Remember: your auto works {auto} of the time, and you said “consistent” with a straight face.',
    },
  },

  'queue-snacks': {
    title: 'Pack snacks for the queue',
    item: 'queue snack pack',
    fields: [
      {
        key: 'snacks',
        type: 'multi',
        label: 'Snacks',
        max: 3,
        options: ['Pretzels', 'Gummy bears', 'A whole sandwich', 'Granola bar (crushed)', 'Energy gel (bad idea)'],
      },
      { key: 'queue', type: 'slider', label: 'Expected queue time', min: 2, max: 45, unit: 'min', marks: { 45: 'Field fault' } },
      {
        key: 'crumbs',
        type: 'toggle',
        label: 'Crumb-free guarantee',
        on: 'Crumb-free (impossible)',
        off: 'Crumbs everywhere, like normal',
      },
      { key: 'qty', type: 'qty', label: 'Packs', max: 20, unit: 'packs' },
    ],
    cta: 'Get in line',
    confirm: '{qty} of {snacks}, for a {queue} queue. {crumbs}. You’re up next. Eat fast.',
    track: {
      packed: ['Packed in a bag that crinkles loudly. Perfect for the quiet queue.'],
      twists: [
        { icon: '🥨', title: 'Your snack pack is in the queue too', body: 'It’s behind three robots. It’s been there a while.' },
        { icon: '🚫', title: 'Field reset delay', body: 'Your snacks are waiting for the field to be reset. Again.' },
      ],
      places: ['Handed to you in the queue line. Behind 6 teams.', 'Left on the drive team cart.'],
    },
    scene: {
      type: 'tap',
      prompt: 'You’re up in 30 seconds! Eat fast.',
      emoji: '🥨',
      button: 'Chomp',
      goal: 14,
      stages: ['Chomp.', 'The ref is looking at you.', 'Crumbs on the drive team cart.', 'They’re calling your team number!'],
      win: 'Finished just in time. You walked onto the field with {snacks} breath. The ref noticed the crumbs.',
    },
  },

  'judge-spray': {
    title: 'Get a can of confidence',
    item: 'can of confidence',
    fields: [
      {
        key: 'scent',
        type: 'choice',
        label: 'Scent',
        options: [
          { label: 'Iterative Design', note: 'Smells like a whiteboard.' },
          { label: 'Outreach Fresh', note: 'Smells like a library visit.' },
          { label: 'Gracious Professionalism', note: 'Smells like a firm handshake.' },
          { label: 'Notebook (lightly burnt)', note: 'Don’t mention the notebook.' },
        ],
      },
      { key: 'strength', type: 'slider', label: 'Spray strength', min: 1, max: 10, marks: { 1: 'Shy', 10: 'Invented robots' } },
      {
        key: 'words',
        type: 'multi',
        label: 'Words to say confidently',
        max: 3,
        options: ['Iterate', 'Prototype', 'Stakeholder', 'Data-driven', 'Synergy'],
      },
    ],
    cta: 'Spritz',
    confirm: 'One can of {scent} at strength {strength}. You will say “{words}” with total confidence.',
    track: {
      packed: ['Packed in a blazer pocket.', 'Packed with a laminated list of buzzwords.'],
      twists: [
        { icon: '💨', title: 'Your can went off in the truck', body: 'Kevin just explained iterative design to a toll booth.' },
        { icon: '📓', title: 'Someone asked Kevin about the notebook', body: 'The confidence wore off. He’s regrouping.' },
      ],
      places: ['Left outside the judges’ room door.', 'Handed to your most nervous teammate.'],
    },
    scene: {
      type: 'scratch',
      prompt: 'Scratch to reveal what the judges ask you.',
      prizes: [
        '“Tell us about your design process.” Easy. You say “{words}” four times.',
        '“Can we see your notebook?” The spray wore off.',
        '“What would you do differently?” You say “iterate.” They nod.',
        '“Who built the robot?” Everyone points at a different person.',
      ],
      win: 'Confidence level: {strength}.',
    },
  },

  'scouting-binoculars': {
    title: 'Scout a team with the 3000',
    item: 'scouting report',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'Which team are you scouting?',
        placeholder: 'Team 12345, the one with the big arm',
        required: true,
        max: 80,
      },
      {
        key: 'from',
        type: 'choice',
        label: 'Scouting from',
        options: [
          { label: 'The stands', note: 'Classic.' },
          { label: 'The parking lot', note: 'You can see their trailer.' },
          { label: 'Space', note: 'Low resolution, great view.' },
          { label: 'Their own pit', note: 'Bold. They can see you.' },
        ],
      },
      { key: 'sneaky', type: 'slider', label: 'Sneakiness', min: 0, max: 10, marks: { 0: 'Wearing a team shirt', 10: 'Fake mustache' } },
    ],
    cta: 'Start scouting',
    confirm: 'Scouting {text} from {from}, sneakiness {sneaky}. They are scouting you too.',
    track: {
      review: ['Our analyst is zooming in. Further. Further.', 'The report is being written on a napkin.'],
      replies: [
        'Report: they also have a robot. It has wheels. We’re 80% sure.',
        'Report: they were looking at you through binoculars. Bigger binoculars.',
        'Report: their weakness is the robot. Their strength is also the robot.',
      ],
    },
    chat: [
      {
        say: 'Our analyst would like to know: what did YOU see?',
        options: [
          { label: 'Their arm is huge', reply: 'Noted. We also saw the arm. Everyone saw the arm.' },
          { label: 'They were scouting us', reply: 'Correct. They saw your sneakiness level. It was not high.' },
          { label: 'Nothing, it was blurry', reply: 'You had the lens cap on. Classic.' },
        ],
      },
      {
        say: 'Do you want to pick them for your alliance?',
        options: [
          { label: 'Yes', reply: 'Great. They already declined. They saw you scouting.' },
          { label: 'Absolutely not', reply: 'They picked you. Good luck.' },
        ],
      },
    ],
  },

  // ---------- Winter ----------
  'cocoa-torque': {
    title: 'Mix a Hot Cocoa Torque',
    item: 'Hot Cocoa Torque',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many mugs', max: 24, unit: 'mugs' },
      {
        key: 'temp',
        type: 'slider',
        label: 'Temperature',
        min: 40,
        max: 212,
        unit: '°F',
        marks: { 40: 'Lab heater broke', 212: 'Motor after 3 matches' },
      },
      {
        key: 'mallows',
        type: 'choice',
        label: 'Marshmallows',
        options: [
          { label: 'Foam tile chunks', note: 'Chewy. Very, very chewy.' },
          { label: 'Regular', note: 'Boring, but edible.' },
          { label: 'None', note: 'More room for torque.' },
        ],
      },
      { key: 'lid', type: 'toggle', label: 'Spill-proof lid', on: 'Lid on (you’ll still spill)', off: 'No lid, living dangerously' },
    ],
    cta: 'Warm up',
    confirm: '{qty} at {temp} with {mallows}. {lid}. Please keep it away from the Control Hub.',
    track: {
      packed: ['Packed in a thermos. The thermos is sweating.', 'Packed with a peppermint stick for torque.'],
      twists: [
        { icon: '❄️', title: 'Your cocoa froze in the truck', body: 'It’s now a cocoa popsicle. Still high torque.' },
        { icon: '☕', title: 'Your driver drank one', body: 'He says it’s “really good.” He’s shivering less.' },
      ],
      places: ['Left next to the Control Hub. Please move it.', 'Left on the space heater. It’s fine. It’s warm.'],
    },
    scene: {
      type: 'catch',
      prompt: 'Drop the marshmallows in! Catch them (not the zip ties).',
      emoji: '☁️',
      goal: 6,
      decoys: ['🪢', '🔩', '🧊'],
      speed: 'slow',
      win: 'Perfect mug at {temp}. You spilled a little on the Control Hub. Everyone saw.',
    },
  },

  'servo-thaw': {
    title: 'Book a servo thawing',
    item: 'servo thawing',
    fields: [
      { key: 'when', type: 'when', label: 'Thawing time' },
      { key: 'servos', type: 'qty', label: 'Frozen servos', max: 12, unit: 'servos' },
      {
        key: 'temp',
        type: 'slider',
        label: 'How cold was the car',
        min: -20,
        max: 32,
        unit: '°F',
        marks: { '-20': 'Arctic', 32: 'Just chilly' },
      },
      {
        key: 'words',
        type: 'choice',
        label: 'Kind words to use',
        options: [
          { label: '“You’re doing great”', note: 'Servos respond well to praise.' },
          { label: '“Please move”', note: 'Simple. Direct. Desperate.' },
          { label: '“I’m sorry about the car”', note: 'It needed to hear that.' },
        ],
      },
    ],
    cta: 'Warm them up',
    confirm: '{servos} frozen at {temp}, thawing {when}. We’ll say {words}. They’ll be ready by spring.',
    track: {
      confirmed: ['Hair dryer located. It belongs to someone’s mom. We didn’t ask.'],
      remind: ['Thawing in 1 hour. Please bring the servos inside. Now.', 'One hour. Our hair dryer is warming up.'],
      late: [
        { icon: '💇', title: 'running late', body: 'Someone’s mom wants her hair dryer back.' },
        { icon: '🚗', title: 'stuck in the snow', body: 'Our van also froze. Ironic.' },
      ],
    },
    scene: {
      type: 'hold',
      prompt: 'Point the hair dryer at the servos and hold it there.',
      emoji: '🧊',
      button: 'Hold the hair dryer',
      ms: 3500,
      stages: ['Still frozen.', 'A drip!', 'It twitched!', 'It’s spinning!'],
      early: 'You stopped. It refroze. It’s glaring at you.',
      win: '{servos} thawed! We said {words}. One of them cried a little. Don’t leave them in the car again.',
    },
  },

  'snow-day-lab': {
    title: 'Book a snow day in the lab',
    item: 'snow day lab session',
    fields: [
      { key: 'when', type: 'when', label: 'Snow day' },
      { key: 'layers', type: 'slider', label: 'Layers you’re wearing', min: 1, max: 9, marks: { 1: 'Hoodie', 9: 'Marshmallow' } },
      {
        key: 'plan',
        type: 'choice',
        label: 'The plan',
        options: [
          { label: 'Finish the robot', note: 'Optimistic.' },
          { label: 'Stand near the 3D printer', note: 'It’s the only warm thing.' },
          { label: 'Build a snow robot', note: 'Honestly, it might work better.' },
        ],
      },
      { key: 'key', type: 'toggle', label: 'You have a building key', on: 'You have a key (do you?)', off: 'No key (uh oh)' },
    ],
    cta: 'Brave the snow',
    confirm: 'Snow day {when}. You’re wearing {layers} layers. Plan: {plan}. {key}.',
    track: {
      confirmed: ['Confirmed. The heat is still off. Bring {layers} layers. Maybe more.'],
      remind: ['Snow day lab in 1 hour. Shovel the path first.', 'One hour. The parking lot has not been plowed.'],
      late: [
        { icon: '⛄', title: 'snowed in', body: 'The front door is behind a snowbank. Try the side door. Also locked.' },
        { icon: '🚌', title: 'delayed', body: 'Buses aren’t running. That’s what “snow day” means.' },
      ],
    },
    scene: {
      type: 'dial',
      prompt: 'The building is locked. Crack the combination lock.',
      emoji: '🔒',
      left: '0',
      right: '100',
      hints: ['Click. Nothing.', 'Click… click… closer.', 'It’s almost turning!'],
      win: 'You’re in! It’s 41 degrees inside. Plan: {plan}. You lasted 20 minutes in {layers} layers.',
    },
  },

  'winter-build-camp': {
    title: 'Join Winter Break Build Camp',
    item: 'build camp',
    fields: [
      { key: 'days', type: 'slider', label: 'Days of your break', min: 1, max: 10, unit: 'days', marks: { 10: 'All of them' } },
      {
        key: 'cabin',
        type: 'choice',
        label: 'Your cabin',
        options: [
          { label: 'Mechanical', note: 'Smells like metal shavings.' },
          { label: 'Programming', note: 'Lights out never happens.' },
          { label: 'CAD', note: 'Dark room. Big monitors. Quiet.' },
          { label: 'Outreach', note: 'You’ll be making the camp video.' },
        ],
      },
      { key: 'cocoa', type: 'toggle', label: 'Hot chocolate plan', on: 'Hot chocolate (served cold)', off: 'Just tap water' },
      { key: 'goal', type: 'text', label: 'Camp goal', placeholder: 'A robot that drives straight', max: 50 },
    ],
    cta: 'Sign me up',
    confirm: '{days} at camp in the {cabin} cabin. Goal: {goal}. {cocoa}. See you December 26 at 8 AM.',
    track: {
      packed: ['Packed your camp kit: a sleeping bag and a hex key.', 'Packed a flashlight. The lab lights are on a timer.'],
      twists: [
        { icon: '🏕️', title: 'Camp started without you', body: 'They’re already on day 2. The robot is in 40 pieces.' },
        { icon: '🔥', title: 'Campfire canceled', body: 'Fire marshal says no campfires in the lab. Again.' },
      ],
      places: ['Your camp kit is in the lab. So is everyone, still.', 'Left at your cabin (the CAD corner).'],
    },
    scene: {
      type: 'tap',
      prompt: 'Make it through camp. Tap to survive each day.',
      emoji: '🏕️',
      button: 'Survive the day',
      goal: 10,
      stages: [
        'Day 1: excited.',
        'Day 3: no sleep.',
        'Day 5: the robot moved!',
        'Day 7: the robot stopped.',
        'Day 9: everyone is a zip tie now.',
      ],
      win: 'You survived {days} in the {cabin} cabin. Goal: {goal}. Camp has still never ended.',
    },
  },

  'static-guard': {
    title: 'Order a Static Shock Guard',
    item: 'Static Shock Guard',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many', max: 20, unit: 'guards' },
      {
        key: 'zaps',
        type: 'choice',
        label: 'How many Control Hubs you’ve zapped',
        options: [
          { label: 'None', note: 'Liar.' },
          { label: 'One', note: 'We’re sorry for your loss.' },
          { label: 'Several', note: 'The hubs have a group chat about you.' },
          { label: 'I don’t want to talk about it', note: 'Understandable.' },
        ],
      },
      { key: 'socks', type: 'toggle', label: 'Fuzzy socks on the carpet', on: 'Fuzzy socks (dangerous)', off: 'Shoes (responsible)' },
      { key: 'level', type: 'slider', label: 'Static level', min: 0, max: 10, marks: { 0: 'Humid', 10: 'Hair standing up' } },
    ],
    cta: 'Stop the zap',
    confirm: '{qty}. Static level {level}. {socks}. Or just touch a doorknob. It’s free.',
    track: {
      packed: ['Packed in an anti-static bag. It zapped us anyway.', 'Packed by someone wearing rubber gloves.'],
      twists: [
        { icon: '⚡', title: 'Your package shocked the driver', body: 'Kevin’s hair is standing straight up. He says he’s fine.' },
        { icon: '🧦', title: 'Delivery delayed: carpet', body: 'Kevin walked across a carpet in socks. Everything is static now.' },
      ],
      places: ['Left next to a doorknob. Touch the doorknob.', 'Left away from the Control Hub. Far away.'],
    },
    scene: {
      type: 'hold',
      prompt: 'Touch the doorknob first. Hold it to let the static out.',
      emoji: '⚡',
      button: 'Hold the doorknob',
      ms: 2500,
      stages: ['Zzzt.', 'Your hair is going down.', 'All grounded.'],
      early: 'ZAP. You let go too early. Your hair is up again.',
      win: 'Grounded! The Control Hub is safe. For now. Static level was {level}.',
    },
  },

  'ugly-robot-sweater': {
    title: 'Knit an Ugly Robot Sweater',
    item: 'Ugly Robot Sweater',
    fields: [
      {
        key: 'pattern',
        type: 'choice',
        label: 'Pattern',
        big: true,
        options: [
          { label: '🦌 Reindeer', note: 'The antlers are 3 inches. That’s over 18".' },
          { label: '❄️ Snowflakes', note: 'Each one is a different bolt size.' },
          { label: '🎄 Tree with lights', note: 'The lights are real. They drain the battery.' },
          { label: '🤖 Robot in a robot sweater', note: 'Sweater-ception.' },
        ],
      },
      { key: 'size', type: 'choice', label: 'Robot size', options: ['18" (tight)', '18.5" (illegal)', 'Fits a Control Hub'] },
      { key: 'ugly', type: 'slider', label: 'Ugliness', min: 1, max: 10, marks: { 1: 'Tasteful', 10: 'Award-winning' } },
      { key: 'bells', type: 'toggle', label: 'Jingle bells', on: 'Bells on (it jingles when it moves)', off: 'Silent but festive' },
    ],
    cta: 'Start knitting',
    confirm: 'A {pattern} sweater, size {size}, ugliness {ugly}. {bells}. Not legal for competition. Very festive.',
    track: {
      packed: ['Knitted by a grandma who asked a lot of questions about the robot.', 'Wrapped in wrapping paper. With a bow.'],
      twists: [
        { icon: '🧶', title: 'Your sweater unraveled', body: 'It caught on a bolt. The knitter is starting over. She’s not happy.' },
        { icon: '🎁', title: 'Your sweater was mistaken for a gift', body: 'Someone almost gave it to their uncle. It would have fit.' },
      ],
      places: ['Left under the lab tree (a pile of extrusion).', 'Already on the robot. It put it on itself.'],
    },
    scene: {
      type: 'unbox',
      taps: 3,
      prompt: 'Unwrap it!',
      inside: [
        'It’s a {pattern} sweater at ugliness {ugly}. The robot loves it. It refuses to take it off.',
        'It’s perfect. It doesn’t fit. The robot wears it like a cape now.',
        'It’s even uglier than you ordered. That’s a bonus.',
      ],
    },
  },
};
