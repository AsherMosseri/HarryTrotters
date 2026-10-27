// Flows for the ads in src/ads.js (see src/adFlows.js for the format).
export default {
  sleep: {
    title: 'Book 8 hours of sleep',
    item: '8 hours of sleep',
    fields: [
      { key: 'when', type: 'when', label: 'Bedtime' },
      {
        key: 'pillow',
        type: 'choice',
        label: 'Pillow',
        options: [
          { label: 'Cloud', note: 'Soft. Suspiciously soft.' },
          { label: 'Brick', note: 'For people who like to feel something.' },
          { label: 'Robot chassis', note: 'You fell asleep on it last week anyway.' },
          { label: 'Your backpack', note: 'Classic.' },
        ],
      },
      { key: 'dream', type: 'text', label: 'What to dream about', placeholder: 'Winning worlds, probably', max: 60 },
      { key: 'snooze', type: 'slider', label: 'Snooze button presses', min: 0, max: 12, marks: { 0: 'Liar', 12: 'Honest' } },
      { key: 'phone', type: 'toggle', label: 'Phone under the pillow', on: 'Yes (the lab group chat)', off: 'No (lie)' },
    ],
    cta: 'Lock in bedtime',
    confirm: 'Bedtime is {when}. The {pillow} is fluffed. Dreams of {dream} are pre-loaded.',
    track: {
      confirmed: ['Your pillow ({pillow}) has been notified. It’s nervous.'],
      remind: ['Bedtime in 1 hour. Put the hex key down.', 'One hour. Please close all 47 CAD tabs.'],
      late: [
        { icon: '📱', title: 'running late', body: 'You opened “one more video.” It was nine videos.' },
        { icon: '🤖', title: 'delayed', body: 'Someone in the group chat said “quick question.”' },
      ],
    },
    scene: {
      type: 'catch',
      prompt: 'Count the sheep. Tap each one before it jumps the fence.',
      emoji: '🐑',
      goal: 8,
      decoys: ['🐺', '⏰', '📱'],
      speed: 'slow',
      win: 'Out like a light. You dreamed about {dream}. You hit snooze {snooze} times. Same time tomorrow?',
    },
  },

  'torque-juice': {
    title: 'Build your Torque Juice 12-pack',
    item: 'Torque Juice 12-pack',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many 12-packs', max: 20, unit: 'packs' },
      {
        key: 'flavor',
        type: 'choice',
        label: 'Flavor',
        big: true,
        options: [
          { label: '⚡ Original Volt', note: 'Tastes like licking a battery. In a good way.' },
          { label: '🍒 Cherry Current', note: 'Contains 0% cherries and 100% current.' },
          { label: '🧊 Arctic Amp', note: 'Served at the temperature of the lab in January.' },
          { label: '🫧 WD-40 Zero', note: 'Do not drink. We mean it this time.' },
        ],
      },
      { key: 'amps', type: 'slider', label: 'Amps', min: 1, max: 400, step: 1, unit: 'A', marks: { 400: 'Legally a weapon' } },
      { key: 'straw', type: 'toggle', label: 'Bendy straw', on: 'Bendy straw included', off: 'Straight from the can like an animal' },
    ],
    cta: 'Chug responsibly',
    confirm: '{qty} of {flavor} at {amps}. {straw}. Arriving before your next all-nighter.',
    track: {
      packed: ['Packed by hand. The hands are shaking. Not from cold.', 'Sealed. Then resealed. It kept buzzing.'],
      twists: [
        { icon: '⚡', title: 'Your package tripped a breaker', body: 'The whole warehouse is dark. Kevin says it’s “fine.”' },
        { icon: '🫨', title: 'The driver tried one', body: 'He’s delivering it twice as fast now. He can see sounds.' },
      ],
      places: ['Left on the charging station. It’s charging the station.', 'Left next to the robot. They’re talking.'],
    },
    scene: {
      type: 'tap',
      prompt: 'Crack them open. Tap fast before the fizz settles.',
      emoji: '🥤',
      button: 'Crack one',
      goal: 18,
      stages: ['Psssht.', 'You can hear colors.', 'Your heart is in 4/4 time.', 'You could build a robot right now. Alone.'],
      win: 'You are now running at {amps}. Please do not touch the field. Or the wall. Or anyone.',
    },
  },

  potatocad: {
    title: 'Describe your robot to the potato',
    item: 'design review',
    fields: [
      { key: 'text', type: 'text', label: 'Describe your robot', placeholder: 'It is a box with holes', required: true, max: 120 },
      { key: 'shape', type: 'choice', label: 'It is mostly…', options: ['A box', 'A box with wheels', 'A box with regrets', 'Not a box'] },
      {
        key: 'confidence',
        type: 'slider',
        label: 'How sure are you it fits in 18"',
        min: 0,
        max: 100,
        unit: '%',
        marks: { 100: 'It doesn’t' },
      },
    ],
    cta: 'Show the potato',
    confirm: 'The potato is looking at your {shape}. The potato is {confidence} sure too.',
    track: {
      review: ['The potato is reading it. The potato has no eyes. It’s taking a while.', 'The potato asked another potato.'],
      replies: [
        'The potato has rendered your design. It is a potato.',
        'The potato says it’s 19 inches. The potato has never been wrong.',
        'The potato loves it. The potato loves everything. That’s the problem.',
      ],
    },
    chat: [
      {
        say: 'The potato would like to know: is the potato in the robot?',
        options: [
          { label: 'Yes', reply: 'The potato is honored. Please use zip ties.' },
          { label: 'No', reply: 'The potato will remember this.' },
          { label: 'It could be', reply: 'The potato has already moved in.' },
        ],
      },
      {
        say: 'Final question. Would you like the potato to CAD it for you?',
        options: [
          { label: 'Please', reply: 'Done. It is a potato. You’re welcome.' },
          { label: 'Absolutely not', reply: 'The potato understands. The potato is sad.' },
        ],
      },
    ],
  },

  'zip-ties-monthly': {
    title: 'Subscribe to Zip Ties Monthly',
    item: 'Zip Ties Monthly box',
    fields: [
      {
        key: 'size',
        type: 'choice',
        label: 'Zip tie size',
        options: [
          { label: '4 inch', note: 'For delicate work. You will use them on everything anyway.' },
          { label: '8 inch', note: 'The classic. Holds a robot together. Barely.' },
          { label: '14 inch', note: 'Holds a robot together. And a small car.' },
          { label: 'Surprise me', note: 'They’re all zip ties. It’s not much of a surprise.' },
        ],
      },
      {
        key: 'colors',
        type: 'multi',
        label: 'Colors',
        max: 3,
        options: ['Black', 'White', 'Team colors', 'Glow in the dark', 'Invisible'],
      },
      { key: 'count', type: 'slider', label: 'Zip ties per month', min: 100, max: 10000, step: 100, marks: { 10000: 'Not enough' } },
      { key: 'snips', type: 'toggle', label: 'Include flush cutters', on: 'Flush cutters included', off: 'You’ll use your teeth' },
    ],
    cta: 'Subscribe (permanently)',
    confirm: '{count} zip ties a month, {size}, in {colors}. {snips}. There is no cancel button. We checked again.',
    track: {
      packed: ['Packed. The box is held shut with zip ties.', 'Packed by a machine that only makes zip ties. It’s proud.'],
      twists: [
        { icon: '🔒', title: 'Your box zip-tied itself to the truck', body: 'We cut it free. It used another zip tie.' },
        { icon: '🧍', title: 'Kevin got zip-tied to the box', body: 'He’s fine. He’s coming with it.' },
      ],
      places: ['Zip-tied to your door handle.', 'Zip-tied to the robot. Which is now heavier.'],
    },
    scene: {
      type: 'unbox',
      prompt: 'Cut the zip ties to open it. All of them.',
      taps: 6,
      inside: [
        'Inside: {count} zip ties in {colors}. And a note: “See you next month.”',
        'Inside: zip ties. Under those: more zip ties. At the bottom: a coupon for zip ties.',
        'It’s zip ties. You knew. We knew. Nobody is surprised.',
      ],
      win: 'Your robot is now 40% zip ties. Next box ships in 30 days. And 30 days after that. And…',
    },
  },

  'hot-glue-pro-max': {
    title: 'Pre-order Hot Glue Pro Max',
    item: 'Hot Glue Pro Max',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many', max: 5, unit: 'guns' },
      {
        key: 'finish',
        type: 'choice',
        label: 'Finish',
        options: [
          { label: 'Titanium Gray', note: 'Same as last year. $200 more.' },
          { label: 'Midnight Melt', note: 'Black, so you can’t see the glue strings. They’re there.' },
          { label: 'Burn Unit Pink', note: 'Matches your fingertips.' },
          { label: 'Pro Max Ultra Gold', note: 'Does nothing extra. Costs everything extra.' },
        ],
      },
      {
        key: 'temp',
        type: 'slider',
        label: 'Max temperature',
        min: 100,
        max: 900,
        step: 50,
        unit: '°F',
        marks: { 900: 'Surface of Venus' },
      },
      { key: 'care', type: 'toggle', label: 'AppleCare for your fingers', on: 'Fingers covered', off: 'Fingers on their own' },
    ],
    cta: 'Pre-order now',
    confirm: '{qty} in {finish}, heats to {temp}. {care}. Estimated delivery: Q3 2031.',
    track: {
      packed: ['Packed in a box that costs more than the glue.', 'Unboxing video already recorded. By us.'],
      twists: [
        { icon: '🔥', title: 'Your glue gun is warming up in the truck', body: 'Nobody turned it on. It just wanted to.' },
        { icon: '🕸️', title: 'Delay: glue strings everywhere', body: 'The whole warehouse looks like a haunted house now.' },
      ],
      places: ['Glued to your doorstep. It isn’t coming off.', 'Left on the workbench. Already stuck to it.'],
    },
    scene: {
      type: 'hold',
      prompt: 'Hold the trigger to heat it up. Let go too early and it’s just a sad plastic stick.',
      emoji: '🔥',
      button: 'Hold to heat up',
      ms: 3500,
      stages: ['Warming up…', 'Smells like a candle factory.', 'Glue is dripping. On your shoe.', 'Pro Max temperature reached.'],
      early: 'Cold glue. It’s just a crayon now. Try again.',
      win: 'Hot glue at {temp}. You glued the part, the table, and two fingers together. {care}.',
    },
  },

  'ctrl-z-real-life': {
    title: 'Undo something in real life',
    item: 'real-life undo',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'What do you want to undo?',
        placeholder: 'I stripped the last M3 screw',
        required: true,
        max: 100,
      },
      {
        key: 'how',
        type: 'choice',
        label: 'How far back',
        options: [
          { label: '5 seconds', note: 'Just before you said it out loud.' },
          { label: 'Last night', note: 'Before the “quick” 2 AM rewire.' },
          { label: 'Kickoff', note: 'Bold. We like it.' },
          { label: 'All of 2026', note: 'Our servers are scared.' },
        ],
      },
      { key: 'redo', type: 'toggle', label: 'Also include Ctrl+Y', on: 'Redo included', off: 'No redo (scary)' },
    ],
    cta: 'Undo it',
    confirm: 'Undo queued: “{text},” going back {how}. {redo}. Undo scheduled for yesterday.',
    track: {
      review: [
        'Our team is trying Ctrl+Z on the universe. It made a beep.',
        'Reviewing your request. And three others just like it from your team.',
      ],
      replies: [
        'Undo complete. Nothing changed, but you feel like it did.',
        'We undid it. Then someone on your team redid it.',
        'Undo failed: this action was saved to the cloud.',
      ],
    },
    chat: [
      {
        say: 'Before we undo “{text},” are you sure you want to lose everything since {how}?',
        options: [
          { label: 'Yes, all of it', reply: 'Bold. Your CAD has been rolled back too. Sorry.' },
          { label: 'Wait, save first', reply: 'We tried. The save button was also undone.' },
          { label: 'What’s Ctrl+S?', reply: 'Oh no. Oh no no no.' },
        ],
      },
      {
        say: 'Rate your undo experience.',
        options: [
          { label: 'Undo the rating', reply: 'Rating undone. We got the hint.' },
          { label: 'Great', reply: 'Thanks! We’ll undo this conversation now.' },
        ],
      },
    ],
  },

  'hex-key-finder': {
    title: 'Find your hex key',
    item: 'search for a hex key',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'Where did you last see it?',
        placeholder: 'In my hand. Two seconds ago.',
        required: true,
        max: 100,
      },
      {
        key: 'size',
        type: 'choice',
        label: 'Which one',
        options: [
          { label: '2.5 mm', note: 'The one everybody needs. The one nobody has.' },
          { label: '3 mm', note: 'It’s with the 2.5. They eloped.' },
          { label: '5/64"', note: 'Wrong system. That’s why you can’t find it.' },
          { label: 'The whole set', note: 'The case is still here. Empty. Mocking you.' },
        ],
      },
      {
        key: 'checked',
        type: 'multi',
        label: 'Places you already checked',
        options: ['The couch', 'Hoodie pocket', 'Under the robot', 'Inside the robot', 'Your other hand'],
      },
    ],
    cta: 'Find it',
    confirm: 'Search team dispatched for the {size}. You checked: {checked}. It’s in the couch.',
    track: {
      review: ['Our search dog is sniffing the couch. Intensely.', 'Search team is lifting the couch. They found three other hex keys.'],
      replies: [
        'Found it. It was in the couch. It’s always in the couch.',
        'Found it. It was in your hand. The whole time.',
        'It’s inside the robot, behind the Control Hub. Good luck.',
      ],
    },
    chat: [
      {
        say: 'We found your {size} hex key. Would you like us to tie it to you?',
        options: [
          { label: 'Yes, with a lanyard', reply: 'Lanyard attached. You will still lose it.' },
          { label: 'Zip-tie it to the robot', reply: 'Done. Now nobody can use it. Problem solved.' },
          { label: 'No, I’ll be careful', reply: 'That’s what you said last time.' },
        ],
      },
      {
        say: 'That’ll be $19.99. Pay now?',
        options: [
          { label: 'Pay with a hex key', reply: 'We accept. Please hand over the one we just found.' },
          { label: 'Put it on my tab', reply: 'Your tab is in the couch.' },
        ],
      },
    ],
  },

  'battery-whisperer': {
    title: 'Book a battery listening session',
    item: 'listening session',
    fields: [
      { key: 'when', type: 'when', label: 'When' },
      {
        key: 'volts',
        type: 'slider',
        label: 'What the battery says it is',
        min: 11,
        max: 14,
        step: 0.5,
        unit: 'V',
        marks: { 14: 'Lying' },
      },
      {
        key: 'mood',
        type: 'choice',
        label: 'How it’s been acting',
        options: [
          { label: 'Fine, it says', note: 'That’s what they all say.' },
          { label: 'Dies in match 3', note: 'Classic abandonment issues.' },
          { label: 'Warm and puffy', note: 'Please put it down and step away.' },
          { label: 'Won’t charge', note: 'It needs to feel heard first.' },
        ],
      },
      { key: 'name', type: 'text', label: 'Battery’s name', placeholder: 'Battery 7 (the bad one)', max: 30 },
      { key: 'tissues', type: 'toggle', label: 'Bring tissues', on: 'Tissues packed', off: 'You think you won’t cry' },
    ],
    cta: 'Start listening',
    confirm: 'Session for {name} on {when}. It claims {volts}. {tissues}.',
    track: {
      confirmed: ['The whisperer has read {name}’s file. It’s a long file.'],
      remind: [
        'One hour. Please do not charge {name} beforehand. It needs to be honest.',
        'Session soon. Bring the battery. Bring the charger. Bring snacks.',
      ],
      late: [
        { title: 'running late', body: 'The last battery would not stop talking about the 2024 season.' },
        { title: 'delayed', body: 'A LiPo got emotional. Everyone had to leave the building.' },
      ],
    },
    scene: {
      type: 'dial',
      prompt: 'Tune in to {name}’s true feelings.',
      emoji: '🔋',
      left: 'Static',
      right: 'Screaming',
      hints: ['Just static.', 'You hear a faint sigh…', 'It’s… it’s saying something!'],
      win: '{name} says it’s actually at 11.4 V and it’s tired of pretending. It asked for one full charge and a little respect.',
    },
  },

  'auto-path-psychic': {
    title: 'Book a reading with the Auto Path Psychic',
    item: 'reading',
    fields: [
      { key: 'when', type: 'when', label: 'When' },
      {
        key: 'auto',
        type: 'choice',
        label: 'Your autonomous',
        options: [
          { label: 'Parks. That’s it.', note: 'The psychic sees… 3 points.' },
          { label: 'Scores 2 samples', note: 'In practice. Only in practice.' },
          { label: 'Full 30-second routine', note: 'The psychic is laughing. Not at you. Mostly.' },
          { label: 'We haven’t started', note: 'The psychic already knew.' },
        ],
      },
      {
        key: 'faith',
        type: 'slider',
        label: 'How much do you believe',
        min: 0,
        max: 100,
        unit: '%',
        marks: { 0: 'Skeptic', 100: 'Already paid' },
      },
      { key: 'crystal', type: 'toggle', label: 'Deluxe crystal ball', on: 'Deluxe (has an encoder)', off: 'Basic (cloudy)' },
    ],
    cta: 'See your future',
    confirm: 'Reading booked for {when}. Your auto: “{auto}.” Belief level: {faith}. We already knew you’d book this.',
    track: {
      confirmed: ['The psychic confirmed. The psychic says you were going to say “cool.”'],
      remind: [
        'Your reading is in 1 hour. The psychic says you’ll be 2 minutes late.',
        'One hour. Please bring your robot. And your encoder values.',
      ],
      late: [
        { title: 'running late', body: 'The psychic did not see the traffic coming. Ironic.' },
        { title: 'delayed', body: 'The crystal ball needed a firmware update.' },
      ],
    },
    scene: {
      type: 'cards',
      prompt: 'Pick a card. It will tell you how your autonomous goes at competition.',
      emoji: '🔮',
      results: [
        'The Wall. Your robot drives into it at 0:03.',
        'The Encoder. It counts perfectly. Backwards.',
        'The Battery. It dies at 0:29. Right before the last sample.',
        'The Judge. They saw everything. They were impressed? Unclear.',
        'The Star. It works! It was the other team’s robot.',
      ],
      win: 'The psychic is never wrong. Your auto is “{auto}.” Good luck.',
    },
  },

  'wire-spaghetti': {
    title: 'Order Wire Spaghetti Begone',
    item: 'Wire Spaghetti Begone spray',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many cans', max: 12, unit: 'cans' },
      {
        key: 'mess',
        type: 'choice',
        label: 'How bad is it',
        options: [
          { label: 'A little messy', note: 'You’re lying. We’ve seen the robot.' },
          { label: 'Spaghetti', note: 'Classic. Al dente.' },
          { label: 'Lasagna', note: 'Layers. Many layers.' },
          { label: 'We can’t find the hub', note: 'Search and rescue has been notified.' },
        ],
      },
      { key: 'scent', type: 'choice', label: 'Scent', options: ['Marinara', 'Burnt servo', 'Fresh solder', 'Unscented (sad)'] },
      { key: 'labels', type: 'toggle', label: 'Add a label maker', on: 'Label maker included', off: 'Labels are for quitters' },
    ],
    cta: 'Untangle me',
    confirm: '{qty} of {scent} spray for a “{mess}” situation. {labels}. Ships tangled. Sorry.',
    track: {
      packed: ['Packed. The cans got tangled in the box somehow.', 'Packed with 3 feet of servo extension for no reason.'],
      twists: [
        { icon: '🍝', title: 'Your package got tangled with another package', body: 'Now they’re one package. We can’t separate them.' },
        { icon: '🔌', title: 'The truck is tangled', body: 'Kevin sprayed it. Nothing happened. As advertised.' },
      ],
      places: ['Left next to the electrical box. It looked away.', 'Tangled into your doorknob.'],
    },
    scene: {
      type: 'tap',
      prompt: 'Spray the knots! Faster, before they re-tangle.',
      emoji: '🍝',
      button: 'Spray',
      goal: 22,
      stages: [
        'The wires are loosening…',
        'Wait, is that the IMU cable?',
        'It’s working! It’s… a different tangle now.',
        'One straight wire! One!',
      ],
      win: 'Wiring status was “{mess}.” Now it’s one straight wire. It isn’t connected to anything. Smells like {scent}.',
    },
  },

  'competition-candle': {
    title: 'Order a Competition Day Candle',
    item: 'Competition Day Candle',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many candles', max: 10, unit: 'candles' },
      {
        key: 'scent',
        type: 'choice',
        label: 'Scent',
        options: [
          { label: 'Foam Tiles', note: 'Smells like your knees after inspection.' },
          { label: 'Inspection Line', note: 'Notes of anxiety and a missing flag.' },
          { label: 'Our Robot Is On Fire', note: 'Smoky. Authentic. Not a drill.' },
          { label: 'Field-Side Pizza', note: 'Cold. Cardboard. Perfect.' },
          { label: 'Alliance Selection', note: 'Hopeful, with a hint of crying.' },
        ],
      },
      { key: 'loud', type: 'slider', label: 'Background noise', min: 0, max: 10, marks: { 0: 'Pit at 6 AM', 10: 'Finals' } },
      { key: 'mc', type: 'toggle', label: 'Add MC voice', on: 'Includes the MC yelling', off: 'Silent (unsettling)' },
    ],
    cta: 'Light it up',
    confirm: '{qty} of “{scent}” at noise level {loud}. {mc}. Smells will arrive 1–2 days before the box.',
    track: {
      packed: ['Packed. The whole warehouse smells like a regional now.', 'Wrapped in foam tiles. Gently. Smelly.'],
      twists: [
        { icon: '👃', title: 'Your neighbors can smell your package', body: 'They’re asking which division you’re in.' },
        { icon: '📣', title: 'The candle started announcing matches', body: 'Kevin pulled over. He’s queuing for Q14.' },
      ],
      places: ['Left in the pit. Someone already lit it.', 'Left on the scoring table. The refs are sniffing it.'],
    },
    scene: {
      type: 'scratch',
      prompt: 'Scratch and sniff the lid.',
      prizes: [
        'Smells like “{scent}.” You can hear the field reset crew.',
        'Smells like a motor at 0:25 of a hard match.',
        'Smells like the snack bar ran out of pretzels.',
        'Smells like winning. Faintly. Mostly foam.',
      ],
      win: 'Light it, close your eyes, and you’re back in the pit. {mc}.',
    },
  },

  'lucky-socks': {
    title: 'Book a lucky sock pickup',
    item: 'sock pickup',
    fields: [
      { key: 'when', type: 'when', label: 'Pickup' },
      {
        key: 'pair',
        type: 'choice',
        label: 'Which pair',
        options: [
          { label: 'The 2019 Originals', note: 'Unwashed. Legendary. Crunchy.' },
          { label: 'Mismatched Pair', note: 'One left, one also left.' },
          { label: 'The Ones With the Hole', note: 'The hole is where the luck gets in.' },
          { label: 'Brand New', note: 'No luck yet. Very sad.' },
        ],
      },
      { key: 'days', type: 'slider', label: 'Days you’ll wear them', min: 1, max: 14, marks: { 1: 'Just quals', 14: 'Seek help' } },
      { key: 'tongs', type: 'toggle', label: 'Rent tongs too', on: 'Tongs included', off: 'Bare hands (brave)' },
    ],
    cta: 'Rent the socks',
    confirm: 'Pickup {when}: the {pair}, for {days} days. {tongs}. Do not ask questions.',
    track: {
      confirmed: ['The socks are being “aired out.” It won’t help.'],
      remind: ['Pickup in 1 hour. Hold your breath starting now.', 'One hour. Bring a sealed bag. Two bags.'],
      late: [
        { title: 'running late', body: 'The socks walked off on their own. We’re catching them.' },
        { title: 'delayed', body: 'The building is being ventilated.' },
      ],
    },
    scene: {
      type: 'hold',
      prompt: 'Hold your nose and put them on. Don’t let go.',
      emoji: '🧦',
      button: 'Hold your nose',
      ms: 4000,
      stages: ['Left sock on…', 'Your eyes are watering.', 'Right sock on…', 'You feel… lucky?'],
      early: 'You breathed in. You saw your whole season flash before your eyes. Try again.',
      win: 'The {pair} are on. You feel lucky for {days} days. Your teammates feel something else.',
    },
  },

  'gear-match': {
    title: 'Find your gear match',
    item: 'gear match',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'Describe your ideal gear ratio',
        placeholder: '20:1, likes long walks on a shaft',
        required: true,
        max: 100,
      },
      {
        key: 'type',
        type: 'choice',
        label: 'You are a…',
        options: [
          { label: 'Spur gear', note: 'Straightforward. A little loud.' },
          { label: 'Bevel gear', note: 'You like to see things from an angle.' },
          { label: 'Worm gear', note: 'Commitment issues. Can’t go backwards.' },
          { label: 'Planetary', note: 'You have a lot going on inside.' },
        ],
      },
      { key: 'teeth', type: 'slider', label: 'Teeth', min: 8, max: 120, marks: { 8: 'Shy', 120: 'Smiley' } },
      { key: 'backlash', type: 'toggle', label: 'OK with a little backlash', on: 'Some backlash is fine', off: 'Zero backlash only' },
    ],
    cta: 'Swipe right',
    confirm: 'Profile posted: {type}, {teeth} teeth, looking for “{text}.” {backlash}.',
    track: {
      review: ['Your profile is being reviewed by a sprocket. It’s jealous.', 'Matching you with gears nearby. Some of them are rusty.'],
      replies: [
        '3 compatible gears found nearby. 1 is a little worn.',
        'You matched with a 72-tooth aluminum gear. It meshes well with others.',
        'It’s a match! But they’re metric.',
      ],
    },
    chat: [
      {
        say: 'Your match says: “hey 😉 what’s your pitch?”',
        options: [
          { label: '32 DP 😏', reply: 'They said “wow, so fine.” It’s going well.' },
          { label: 'Module 1', reply: 'They’re into it. They’re also module 1.' },
          { label: 'I don’t know', reply: 'They unmatched. Know your pitch.' },
        ],
      },
      {
        say: 'They want to meet on a shaft this weekend. Go?',
        options: [
          { label: 'Yes! Bring a set screw', reply: 'Meshing confirmed. No slipping. ❤️' },
          { label: 'Too fast', reply: 'Fair. They’re a high-speed gear.' },
        ],
      },
    ],
  },

  'robot-therapy': {
    title: 'Book a therapy session for your robot',
    item: 'session',
    fields: [
      { key: 'when', type: 'when', label: 'When' },
      { key: 'robot', type: 'text', label: 'Robot’s name', placeholder: 'Robot (we never named it)', max: 30 },
      {
        key: 'issue',
        type: 'choice',
        label: 'What’s going on',
        options: [
          { label: 'Drives in circles', note: 'It’s searching for something. Itself.' },
          { label: 'Won’t connect', note: 'Emotionally and over Wi-Fi.' },
          { label: 'Arm keeps dropping', note: 'It just doesn’t want to hold things anymore.' },
          { label: 'Fears the field wall', note: 'Bad experience at 0:03.' },
        ],
      },
      { key: 'couch', type: 'choice', label: 'Couch', options: ['Classic leather', 'Foam tile pile', 'Upside down on a cart'] },
    ],
    cta: 'Book a session',
    confirm: '{robot} has a session {when} for “{issue}.” Couch: {couch}. Please charge it first.',
    track: {
      confirmed: ['The therapist has read {robot}’s logs. All 4,000 lines.'],
      remind: ['Session in 1 hour. Please charge {robot}. Emotionally too.', 'One hour. Remind {robot} it’s a safe space.'],
      late: [
        { title: 'running late', body: 'The last robot would not stop talking about its alliance partner.' },
        { title: 'running behind', body: 'A drivetrain had a breakthrough. It took a while.' },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: 'Hi {robot}. I hear there’s been some… “{issue}.” How does that make you feel?',
          options: [
            { label: 'Beep', reply: 'I hear you. That’s a very valid beep.' },
            { label: '*drives in a circle*', reply: 'Interesting. Let’s unpack that circle.' },
            { label: 'Low battery warning', reply: 'You’re tired. You’re allowed to be tired.' },
          ],
        },
        {
          say: 'Tell me about your relationship with the drive team.',
          options: [
            { label: 'They yell a lot', reply: 'That sounds hard. Have you tried yelling back? Don’t.' },
            { label: 'They never charge me', reply: 'You deserve to be charged. Every night.' },
            { label: 'They’re fine', reply: 'That’s what the last robot said. It drove off a table.' },
          ],
        },
        {
          say: 'Homework: one full match without hitting the wall. Can you do that?',
          options: [
            { label: 'I’ll try', reply: 'That’s all I ask.' },
            { label: 'No promises', reply: 'Honest. That’s growth.' },
          ],
        },
      ],
      win: '{robot} feels heard. It drove straight for 2 whole feet afterward. Same time next week?',
    },
  },

  'mom-rideshare': {
    title: 'Request a ride home from the lab',
    item: 'pickup',
    fields: [
      { key: 'when', type: 'when', label: 'Pickup' },
      {
        key: 'excuse',
        type: 'choice',
        label: 'Why it’s so late',
        options: [
          { label: 'We were almost done', note: 'You were not almost done.' },
          { label: 'The robot caught fire', note: 'Mom would like more details. Many more.' },
          { label: 'Coach kept us', note: 'She will be calling Coach.' },
          { label: 'I lost track of time', note: 'She has a watch. She will show you the watch.' },
        ],
      },
      {
        key: 'surge',
        type: 'slider',
        label: 'Surge pricing you accept',
        min: 1,
        max: 10,
        step: 0.5,
        unit: '×',
        marks: { 10: 'Dishes for a month' },
      },
      { key: 'snack', type: 'toggle', label: 'Ask for a drive-thru stop', on: 'Asking for food (risky)', off: 'Not pushing your luck' },
    ],
    cta: 'Request a ride',
    confirm: 'Pickup {when}. Excuse: “{excuse}.” Surge: {surge}. {snack}.',
    track: {
      confirmed: ['Mom accepted. She typed “ok.” With a period.'],
      remind: ['Pickup in 1 hour. She’s already in the car.', 'One hour. Start packing up now. Not in 59 minutes. Now.'],
      late: [
        { icon: '🚗', title: 'already outside', body: 'She has been outside for 40 minutes. She would like you to know.' },
        { icon: '📞', title: 'on the phone with another mom', body: 'They’re comparing what time you all said you’d be done.' },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: 'Do you know what time it is?',
          options: [
            { label: 'Robot time', reply: 'That’s not a time.' },
            { label: '9:47?', reply: 'It is 9:47. You said 8.' },
            { label: 'Sorry 😬', reply: 'Mm-hm.' },
          ],
        },
        {
          say: 'So. “{excuse}.” Really.',
          options: [
            { label: 'Yes, really', reply: 'Okay. I’ll ask Coach.' },
            { label: 'Kind of', reply: 'Kind of. Okay.' },
          ],
        },
        {
          say: 'How’s your homework going?',
          options: [
            { label: 'Great!', reply: 'Show me when we get home.' },
            { label: 'What homework', reply: 'That’s the surge pricing. Dishes. All week.' },
          ],
        },
      ],
      win: 'You made it home. Fare: {surge} surge, paid in dishes. She saved you a plate anyway. ❤️',
    },
  },

  'pit-bar': {
    title: 'Order Pit Bars',
    item: 'Pit Bar',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many', max: 24, unit: 'bars' },
      {
        key: 'flavor',
        type: 'choice',
        label: 'Flavor',
        big: true,
        options: [
          { label: '🍫 Triple Chocolate Torque', note: '3,000 calories. 2,800 are chocolate.' },
          { label: '🥜 Peanut Butter Pit Crew', note: 'Sticks to the roof of your mouth for one full match.' },
          { label: '🍓 Strawberry Swerve', note: 'Linked to designing a swerve drive at 2 AM.' },
          { label: '🔩 Original (Aluminum)', note: 'Crunchy.' },
        ],
      },
      { key: 'eat', type: 'slider', label: 'How many you’ll eat at once', min: 1, max: 5, marks: { 1: 'As directed', 5: 'Swerve drive' } },
    ],
    cta: 'Eat one',
    confirm: '{qty} of {flavor}. You plan to eat {eat} at once. Please eat only one.',
    track: {
      packed: ['Packed. The box is very heavy. It’s all calories.', 'Packed by a nutritionist who quit right after.'],
      twists: [
        { icon: '🍫', title: 'The driver ate one', body: 'He’s now redesigning his truck’s drivetrain.' },
        { icon: '⚖️', title: 'Your package was flagged at the weigh station', body: 'It weighs as much as a small robot.' },
      ],
      places: ['Left in the snack drawer. The drawer is groaning.', 'Left on the pit table. Already surrounded.'],
    },
    scene: {
      type: 'unbox',
      prompt: 'Unwrap it. The wrapper is industrial strength.',
      taps: 5,
      inside: [
        'It’s a {flavor} bar. It’s the size of a brick. It is a brick of snack.',
        'One bite in and you can lift the robot by yourself.',
        'You ate {eat}. You are now designing a swerve drive. It’s 2 AM somehow.',
      ],
      win: 'Fuel for 14 hours of build. Please eat only one. (You won’t.)',
    },
  },

  'rubber-duck-pro': {
    title: 'Adopt a debugging duck',
    item: 'duck adoption',
    fields: [
      { key: 'text', type: 'text', label: 'Name your duck', placeholder: 'Sir Quacks-a-lot', required: true, max: 30 },
      {
        key: 'lang',
        type: 'choice',
        label: 'Duck’s language',
        options: [
          { label: 'Java', note: 'Quacks in very long sentences. With semicolons.' },
          { label: 'Kotlin', note: 'Same quacks, fewer words.' },
          { label: 'Blocks', note: 'The duck respects you. Mostly.' },
          { label: 'Python', note: 'Wrong animal, but okay.' },
        ],
      },
      {
        key: 'gear',
        type: 'multi',
        label: 'Accessories',
        max: 3,
        options: ['Tiny headset', 'Lanyard', 'Safety glasses', 'Team shirt', 'Judging face'],
      },
      { key: 'strict', type: 'slider', label: 'How strict', min: 0, max: 10, marks: { 0: 'Supportive', 10: 'Code review' } },
    ],
    cta: 'Adopt a duck',
    confirm: 'Application sent for {text}, a {lang} duck with: {gear}. Strictness {strict}. The duck is reviewing your code.',
    track: {
      review: ['{text} is reading your code. {text} has stopped blinking.', 'The duck is quacking at line 247. Just line 247.'],
      replies: [
        'Approved. {text} found your bug: a missing semicolon. The duck is always right.',
        'Approved. {text} says your loop never ends. Neither will this adoption.',
        'Approved. {text} has no comments on your code. Because you wrote no comments.',
      ],
    },
    chat: [
      {
        say: '{text} would like you to explain your code. Line by line. Out loud.',
        options: [
          { label: 'Okay… so this line…', reply: 'Quack. (You just found the bug yourself. That’s the trick.)' },
          { label: 'It just works', reply: 'The duck does not believe you. Nobody believes you.' },
          { label: 'ChatGPT wrote it', reply: 'The duck is disappointed. The duck has left the room.' },
        ],
      },
      {
        say: 'Will you commit with a real message this time?',
        options: [
          { label: '“fixed stuff”', reply: 'QUACK. (That’s a no.)' },
          { label: 'A real message', reply: 'The duck is proud of you. One single quack.' },
        ],
      },
    ],
  },

  'measure-once': {
    title: 'Order the Measure Once™ tape',
    item: 'Measure Once™ tape',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many tapes', max: 10, unit: 'tapes' },
      {
        key: 'units',
        type: 'choice',
        label: 'Units',
        options: [
          { label: 'Inches', note: 'Like a field.' },
          { label: 'Millimeters', note: 'Like the CAD.' },
          { label: 'Both, randomly', note: 'Like your actual robot.' },
          { label: 'Vibes', note: 'Like your drivetrain.' },
        ],
      },
      { key: 'length', type: 'slider', label: 'Tape length', min: 1, max: 25, unit: 'ft', marks: { 25: 'Still too short' } },
      { key: 'cut', type: 'toggle', label: 'Cut it anyway', on: 'Cutting it anyway', off: 'Having second thoughts' },
    ],
    cta: 'Cut it anyway',
    confirm: '{qty} of the {length} tape in {units}. {cut}. Measured once. Shipped once. No returns.',
    track: {
      packed: ['Measured the box once. It doesn’t quite fit. Shipped anyway.', 'Packed. We cut the tape to length. Wrong length.'],
      twists: [
        { icon: '📏', title: 'Your package is 2 inches too long for the truck', body: 'We measured once. Kevin is cutting the truck.' },
        { icon: '🪚', title: 'Your tape was used once', body: 'By us. On your package. It’s all used up now.' },
      ],
      places: ['Left 3 inches from your door. We measured.', 'Left on the bandsaw. Please measure before you move it.'],
    },
    scene: {
      type: 'dial',
      prompt: 'Measure the aluminum channel. You only get one try. Find the exact length.',
      emoji: '📏',
      left: 'Too short',
      right: 'Too long',
      hints: ['Not even close.', 'Getting there…', 'Almost exactly!'],
      win: 'Measured once. In {units}. You cut it. It’s perfect. Nobody believes you.',
    },
  },

  'judge-coach': {
    title: 'Book judge interview coaching',
    item: 'coaching session',
    fields: [
      { key: 'when', type: 'when', label: 'When' },
      {
        key: 'award',
        type: 'choice',
        label: 'Award you’re going for',
        options: [
          { label: 'Inspire', note: 'Ambitious. Say “iterative” a lot.' },
          { label: 'Think', note: 'Bring the notebook. All six binders.' },
          { label: 'Connect', note: 'Name-drop every company you emailed.' },
          { label: 'Any award, please', note: 'Honest. The judges like honest.' },
        ],
      },
      {
        key: 'words',
        type: 'multi',
        label: 'Buzzwords to practice',
        max: 4,
        options: ['Iterative', 'Gracious professionalism', 'Outreach', 'Data-driven', 'Sustainability', 'Synergy'],
      },
      { key: 'blink', type: 'toggle', label: 'Allowed to blink', on: 'Blinking allowed', off: 'No blinking' },
    ],
    cta: 'Start practicing',
    confirm: 'Coaching {when} for the {award} Award. Practicing: {words}. {blink}.',
    track: {
      confirmed: ['Your coach is warming up by saying “iterative” to a mirror.'],
      remind: [
        'Coaching in 1 hour. Practice your handshake. Firm, not robotic.',
        'One hour. Please memorize your team number. Both directions.',
      ],
      late: [
        { title: 'running late', body: 'Their last student wouldn’t stop talking about outreach.' },
        { title: 'delayed', body: 'They got stuck in a 47-minute elevator pitch. In the elevator.' },
      ],
    },
    scene: {
      type: 'tap',
      prompt: 'Say “iterative design process” as many times as you can. Go!',
      emoji: '🎤',
      button: '“Iterative!”',
      goal: 30,
      stages: ['Good start…', 'You haven’t breathed in a while.', 'The judges are nodding!', 'You said it 30 times. A judge is crying.'],
      win: 'Interview complete. You said {words} without blinking. The judges wrote something down. It might be good.',
    },
  },

  'screw-gremlin': {
    title: 'Order Screw Gremlin Repellent',
    item: 'can of Gremlin Repellent',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many cans', max: 12, unit: 'cans' },
      {
        key: 'screws',
        type: 'multi',
        label: 'Screws to protect',
        options: ['M3 × 8', 'M4 × 12', '#10-32', 'The weird one', 'All of them'],
      },
      { key: 'strength', type: 'slider', label: 'Strength', min: 1, max: 10, marks: { 1: 'Polite', 10: 'Gremlins move out' } },
      { key: 'trap', type: 'toggle', label: 'Add a gremlin trap', on: 'Trap included (baited with a screw)', off: 'No trap' },
    ],
    cta: 'Protect your screws',
    confirm: '{qty} at strength {strength}, protecting {screws}. {trap}. Your order is missing one screw. You know why.',
    track: {
      packed: ['Packed with 100 screws. 99 arrived at the truck.', 'Packed. Something in the box giggled.'],
      twists: [
        {
          icon: '👺',
          title: 'A gremlin was spotted near your package',
          body: 'It took one screw from the truck. The truck has a wobble now.',
        },
        { icon: '🔩', title: 'Your package is one screw lighter', body: 'There were no screws in your package. They found one anyway.' },
      ],
      places: ['Left in the parts bin. Count your screws.', 'Left by the robot. The robot is missing a screw.'],
    },
    scene: {
      type: 'catch',
      prompt: 'Spray the gremlins! Don’t spray the screws.',
      emoji: '👺',
      goal: 8,
      decoys: ['🔩', '⚙️'],
      speed: 'fast',
      win: 'Gremlins repelled at strength {strength}. You counted your {screws}. One is missing. It’s always one.',
    },
  },
};
