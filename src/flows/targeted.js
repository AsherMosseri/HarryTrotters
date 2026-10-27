// Flows for the targeted ads in src/adTargets.js (see src/adFlows.js for the format).
export default {
  't-sleep': {
    title: 'Book 8 hours of sleep (finally)',
    item: '8 hours of sleep',
    fields: [
      { key: 'when', type: 'when', label: 'Bedtime' },
      {
        key: 'excuse',
        type: 'choice',
        label: 'Tonight’s excuse for staying up',
        options: [
          { label: 'Just one more test run', note: 'We’ve heard this one. Nine times this week.' },
          { label: 'The intake is almost done', note: 'The intake has been almost done since September.' },
          { label: 'I’m not even tired', note: 'Your eyes are doing a thing.' },
          { label: 'No excuse, going to bed', note: 'We’ll believe it when the lab lights are off.' },
        ],
      },
      { key: 'blanket', type: 'choice', label: 'Blanket', options: ['Weighted', 'Field mat', 'Bubble wrap', 'Your team hoodie'] },
      { key: 'alarms', type: 'slider', label: 'Alarms you’ll set', min: 1, max: 10, marks: { 1: 'Brave', 10: 'Realistic' } },
    ],
    cta: 'Go to bed (for real)',
    confirm: 'Bedtime is {when}. Excuse on file: “{excuse}.” Sleep™ has seen your hours, {first}. Sleep™ is concerned.',
    track: {
      confirmed: ['Sleep™ cleared its schedule. It’s been waiting for you since August.'],
      remind: ['One hour, {first}. Sleep™ is already warming up the {blanket}.', 'Bedtime in 1 hour. Close the CAD. We can see it’s open.'],
      late: [
        { icon: '🔧', title: 'running late', body: 'You said “just one more test run.” It was not just one.' },
        { icon: '💬', title: 'delayed', body: 'Someone posted in #programming. You had opinions.' },
      ],
    },
    scene: {
      type: 'hold',
      prompt: 'Hold to close your eyes. Don’t let go until you’re asleep.',
      emoji: '😴',
      button: 'Hold eyes shut',
      ms: 4000,
      stages: ['Okay, eyes closed…', 'Don’t think about the robot…', 'Don’t think about the robot…', 'Zzz…'],
      early: 'You opened your eyes to check the group chat. Sleep™ saw that.',
      win: 'Eight whole hours, {first}. Under the {blanket}. You only needed {alarms} alarms. Sleep™ is proud of you.',
    },
  },

  't-lab-gps': {
    title: 'Book a trip back to the lab',
    item: 'trip to the lab',
    fields: [
      { key: 'when', type: 'when', label: 'Arrival' },
      {
        key: 'route',
        type: 'choice',
        label: 'Route',
        options: [
          { label: 'Fastest', note: 'Through the parking lot. Mind the drive team.' },
          { label: 'Scenic', note: 'Past the vending machine. Twice.' },
          { label: 'Avoid the coach', note: 'Recalculating… there is no such route.' },
          { label: 'Avoid responsibilities', note: 'You’ve been taking this route for days.' },
        ],
      },
      { key: 'voice', type: 'choice', label: 'GPS voice', options: ['Calm', 'Disappointed parent', 'Drive coach', 'The robot'] },
      { key: 'snacks', type: 'toggle', label: 'Bring snacks as an apology', on: 'Snacks packed', off: 'Showing up empty-handed' },
    ],
    cta: 'Start navigation',
    confirm: 'Route set: {route}, arriving {when}. Voice: {voice}. {snacks}. The robot has been told you’re coming.',
    track: {
      confirmed: ['The robot perked up when we told it. Its LEDs blinked. Twice.'],
      remind: ['Leave in 1 hour. The lab has not moved. We checked.', 'One hour. The {voice} voice is clearing its throat.'],
      late: [
        { icon: '🗺️', title: 'recalculating', body: 'You took a wrong turn into the snack aisle.' },
        { icon: '🚧', title: 'running late', body: 'Traffic. Also you stopped to “grab one thing.”' },
      ],
    },
    scene: {
      type: 'dial',
      prompt: 'Find the lab. Turn until the signal locks on.',
      emoji: '🧭',
      left: 'Home',
      right: 'Definitely not the lab',
      hints: ['You are at a mall.', 'You can smell WD-40…', 'You can hear the robot!'],
      win: 'You have arrived, {first}. The robot rolled over to say hi. It took the {route} route to meet you.',
    },
  },

  't-ctrl-z-overdue': {
    title: 'Pick a deadline to undo',
    item: 'deadline undo request',
    fields: [
      { key: 'text', type: 'text', label: 'Which deadline?', placeholder: 'The one we both know about', required: true, max: 80 },
      {
        key: 'reason',
        type: 'choice',
        label: 'Reason',
        options: [
          { label: 'Time is fake', note: 'Bold. We like it.' },
          { label: 'The dog ate my code', note: 'The dog has been notified.' },
          { label: 'I was building the robot', note: 'Believable. Suspiciously believable.' },
          { label: 'I forgot', note: 'Honesty is not a supported feature.' },
        ],
      },
      { key: 'back', type: 'slider', label: 'How far back', min: 1, max: 30, unit: 'days', marks: { 30: 'Pre-season' } },
    ],
    cta: 'Press Ctrl+Z',
    confirm: 'Undo requested: “{text},” {back} back. Reason: {reason}. Processing… slowly.',
    track: {
      review: [
        'Our undo team is undoing your undo request to see if it works.',
        'Your request is in the queue behind 4,000 stripped screws.',
      ],
      replies: [
        'We undid the deadline. Then it came back. Deadlines always come back.',
        'Undo complete. Please check your task list. (Please don’t check your task list.)',
        'We moved it {back} back. It moved itself forward again. It’s determined.',
      ],
    },
    chat: [
      {
        say: '{first}, quick question. We see a few overdue tasks. Want us to undo those too?',
        options: [
          { label: 'Yes, all of them', reply: 'Greedy. Respect. That’s a Premium feature.' },
          { label: 'Just the one', reply: 'Noble. The others are watching you.' },
          { label: 'What overdue tasks?', reply: 'Exactly the attitude we were worried about.' },
        ],
      },
      {
        say: 'Would you like Ctrl+Y as well, in case you change your mind?',
        options: [
          { label: 'Sure', reply: 'Ctrl+Y is out of stock. It was always out of stock.' },
          { label: 'Never look back', reply: 'Ctrl+Z approves. Ctrl+Y is crying.' },
        ],
      },
    ],
  },

  't-pit-bar-overachiever': {
    title: 'Treat yourself, overachiever',
    item: 'Pit Bar',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many Pit Bars', max: 12, unit: 'bars' },
      {
        key: 'flavor',
        type: 'choice',
        label: 'Flavor',
        big: true,
        options: [
          { label: '🍫 Triple Chocolate Torque', note: '3,000 calories. You did a lot of tasks.' },
          { label: '🥜 Peanut Butter Pinion', note: 'Contains nuts. And bolts.' },
          { label: '🍓 Strawberry Servo', note: 'Spins your taste buds at 60 RPM.' },
          { label: '🧈 Plain (Grease)', note: 'For when you’ve given up.' },
        ],
      },
      { key: 'share', type: 'toggle', label: 'Share with the team', on: 'Sharing (noble)', off: 'Hiding in the toolbox' },
      {
        key: 'brag',
        type: 'slider',
        label: 'How much you’ll brag about your tasks',
        min: 0,
        max: 10,
        marks: { 0: 'Humble', 10: 'Unbearable' },
      },
    ],
    cta: 'I earned this',
    confirm: '{qty} of {flavor} on the way. {share}. Brag level {brag}. You did finish a lot of tasks this week, {first}. We counted.',
    track: {
      packed: ['Packed with a tiny gold medal. You’ve earned it.', 'Wrapped in your completed task list. It’s long.'],
      twists: [
        { icon: '🏆', title: 'Your package stopped to celebrate', body: 'It heard you finished your tasks. It needed a moment.' },
        { icon: '🫠', title: 'Your Pit Bars got warm', body: 'They’re now Pit Puddles. Still delicious.', lose: 1 },
      ],
      places: ['Left on top of your finished tasks. They held it up.', 'Left on the podium. Seemed right.'],
    },
    scene: {
      type: 'catch',
      prompt: 'Catch your Pit Bars before the team does.',
      emoji: '🍫',
      goal: 7,
      decoys: ['🧦', '🔩'],
      speed: 'fast',
      win: 'You caught {qty} of {flavor}. Teammates saw. Brag level {brag}, confirmed.',
    },
  },

  't-rich': {
    title: 'Subscribe to Zip Ties Monthly, VIP',
    item: 'VIP zip tie box',
    fields: [
      {
        key: 'tier',
        type: 'choice',
        label: 'VIP tier',
        options: [
          { label: 'Gold', note: 'Gold-colored zip ties. Not gold. Colored.' },
          { label: 'Platinum', note: 'The zip ties come with a velvet rope.' },
          { label: 'Diamond', note: 'One (1) zip tie, in a glass case.' },
          { label: 'Whale', note: 'We see your balance. We know.' },
        ],
      },
      { key: 'colors', type: 'multi', label: 'Zip tie colors', options: ['Black', 'White', 'Neon', 'Team colors', 'Invisible'], max: 3 },
      { key: 'size', type: 'slider', label: 'Zip tie length', min: 4, max: 48, unit: 'in', marks: { 48: 'Lasso' } },
      { key: 'butler', type: 'toggle', label: 'Zip tie butler', on: 'Butler included', off: 'Self-zipping like a commoner' },
    ],
    cta: 'Spend like a VIP',
    confirm: 'Welcome to {tier}, {first}. {colors} zip ties, {size} long. {butler}. Your coins have never been happier.',
    track: {
      packed: ['Packed on a silk pillow. The pillow is also zip ties.', 'Hand-zipped by our finest zipper.'],
      twists: [
        { icon: '🛥️', title: 'Your box took the yacht', body: 'VIP shipping is slower. And wetter.' },
        { icon: '💎', title: 'Your box was appraised', body: 'Estimated value: 11 zip ties. Emotional value: priceless.' },
      ],
      places: ['Delivered by limo. The limo is still outside.', 'Left on a velvet cushion at the lab door.'],
    },
    scene: {
      type: 'scratch',
      prompt: 'Scratch your VIP welcome card.',
      prizes: [
        'You won: 1,000 more zip ties. You cannot stop this.',
        'You won: a lifetime membership. Lifetime is a strong word. Accurate though.',
        'You won: a zip tie with your name engraved. It says {first}. Mostly.',
      ],
      win: '{tier} life suits you, {first}.',
    },
  },

  't-broke': {
    title: 'Rent lucky socks (pay never)',
    item: 'sock pickup',
    fields: [
      { key: 'when', type: 'when', label: 'Pickup' },
      {
        key: 'pair',
        type: 'choice',
        label: 'Pair',
        options: [
          { label: 'Mismatched', note: 'Twice the luck. Half the dignity.' },
          { label: 'Worn to every comp since 2019', note: 'They’ve seen things. Good things. Mostly.' },
          { label: 'Freshly washed', note: 'Washing removes the luck. Your call.' },
          { label: 'Just one sock', note: 'Fits the budget.' },
        ],
      },
      {
        key: 'pay',
        type: 'choice',
        label: 'Payment plan',
        options: [
          { label: 'Pay never', note: 'Our most popular plan.' },
          { label: 'Pay in hugs', note: 'Accepted at participating labs.' },
          { label: 'IOU on a napkin', note: 'Legally binding. In our hearts.' },
        ],
      },
      { key: 'tongs', type: 'toggle', label: 'Bring tongs', on: 'Bringing tongs (wise)', off: 'Bare hands (brave)' },
    ],
    cta: 'Rent on credit',
    confirm: 'Pickup {when}. Pair: {pair}. Plan: {pay}. {tongs}. No credit check. We saw your balance. We understand.',
    track: {
      confirmed: ['Your socks have been removed from the freezer. Pickup confirmed.'],
      remind: ['Pickup in 1 hour. The socks are airing out. It won’t help.', 'One hour. Remember: {tongs}.'],
      late: [
        { icon: '🧦', title: 'running late', body: 'One sock escaped. We’re chasing it.' },
        { icon: '🍀', title: 'delayed', body: 'The socks got lucky and won a raffle. They’re celebrating.' },
      ],
    },
    scene: {
      type: 'cards',
      prompt: 'Pick a sock from the bin. Choose wisely.',
      emoji: '🧦',
      results: [
        'Lucky sock! Your next match: zero penalties.',
        'Damp sock. Luck unclear. Smell very clear.',
        'Sock with a hole. Luck leaks out, but slowly.',
        'Golden sock. Nobody knows where it came from. Don’t ask.',
      ],
      win: 'Rented on the “{pay}” plan. Return in 3–5 competitions.',
    },
  },

  't-late-night': {
    title: 'Request a ride from Mom',
    item: 'pickup',
    fields: [
      { key: 'when', type: 'when', label: 'Pickup' },
      {
        key: 'mood',
        type: 'choice',
        label: 'Driver’s mood (estimated)',
        options: [
          { label: 'Fine', note: 'She said “fine.” That’s never fine.' },
          { label: 'Asleep in the car', note: 'She’s been outside a while.' },
          { label: 'On the phone with your aunt', note: 'You’ll hear the whole story. Twice.' },
          { label: 'Proud but tired', note: 'Best case. Rare.' },
        ],
      },
      {
        key: 'minutes',
        type: 'slider',
        label: '“Coming in 5 minutes” really means',
        min: 5,
        max: 90,
        unit: 'min',
        marks: { 90: 'Honest' },
      },
      { key: 'sorry', type: 'text', label: 'Apology to text her', placeholder: 'sorry the intake broke again', max: 60 },
    ],
    cta: 'Request a ride',
    confirm: 'Pickup {when}. Driver mood: {mood}. Texted: “{sorry}.” You’ll be out in {minutes}. She knows.',
    track: {
      confirmed: ['Your driver has accepted. She did not have a choice.'],
      remind: ['Pickup in 1 hour. Start packing up now. You know how you are.', 'One hour. She’s already in the parking lot. Somehow.'],
      late: [
        { icon: '🚗', title: 'is outside', body: 'She’s been outside for 40 minutes. She sent a thumbs up. It’s a scary thumbs up.' },
        { icon: '📞', title: 'is calling', body: 'Do not answer “five more minutes.”' },
      ],
    },
    scene: {
      type: 'chat',
      prompt: 'Get in the car.',
      lines: [
        {
          say: 'Do you know what time it is?',
          options: [
            { label: 'Robot time', reply: 'Robot time is not a time zone.' },
            { label: 'Early?', reply: 'It is {minutes} past when you said.' },
            { label: 'Sorry', reply: 'I got your text. “{sorry}.” Mm-hm.' },
          ],
        },
        {
          say: 'Did you at least eat something?',
          options: [
            { label: 'A Pit Bar', reply: 'That’s not food. That’s a dare.' },
            { label: 'Zip ties', reply: 'I’m not even going to ask.' },
            { label: 'Yes (no)', reply: 'We’re stopping for food.' },
          ],
        },
      ],
      win: 'You made it home. Driver mood: still {mood}. But she bought you fries. Five stars.',
    },
  },

  't-on-shift': {
    title: 'Get Torque Juice delivered to the pit',
    item: 'Torque Juice to the lab',
    fields: [
      { key: 'qty', type: 'qty', label: 'How many cans', max: 24, unit: 'cans' },
      {
        key: 'spot',
        type: 'choice',
        label: 'Deliver to',
        options: [
          { label: 'Your workbench', note: 'The one on the left. We know which one.' },
          { label: 'Behind you', note: 'Don’t turn around.' },
          { label: 'The pit', note: 'We know where the pit is.' },
          { label: 'Directly into your hand', note: 'Hold out your hand. No, the other one.' },
        ],
      },
      { key: 'stealth', type: 'slider', label: 'Delivery stealth', min: 0, max: 10, marks: { 0: 'Marching band', 10: 'Ninja' } },
      { key: 'ice', type: 'toggle', label: 'Ice cold', on: 'Ice cold', off: 'Room temperature (the lab’s room)' },
    ],
    cta: 'Deliver to me',
    confirm: '{qty} incoming to {spot}. Stealth level {stealth}. We see you clocked in, {first}. Stay right there.',
    track: {
      packed: ['Packed. We already know your size. Don’t ask how.', 'Packed in a box shaped like the lab.'],
      twists: [
        { icon: '👀', title: 'The driver is in the building', body: 'He waved. You didn’t see. He waved again.' },
        { icon: '🚪', title: 'The driver is at the wrong door', body: 'He’s at the storage closet. Again. He likes it in there.' },
      ],
      out: ['Your driver is already at the lab. He was always at the lab.'],
      places: ['Placed {spot}. You didn’t hear a thing.', 'Left in the parts bin labeled “misc.” Everything ends up there.'],
    },
    scene: {
      type: 'tap',
      prompt: 'Your delivery is somewhere in the lab. Tap to search.',
      emoji: '🔦',
      button: 'Look around',
      goal: 12,
      stages: ['Under the field mat? No.', 'Inside the robot? …Maybe.', 'Behind you? Don’t turn around.', 'Found it!'],
      win: 'Found {qty}, delivered to {spot}. Stealth level {stealth}. We were never here.',
    },
  },

  't-competition': {
    title: 'Book a reading of your autonomous',
    item: 'reading',
    fields: [
      { key: 'when', type: 'when', label: 'Reading' },
      {
        key: 'ask',
        type: 'choice',
        label: 'Ask the crystal ball about',
        options: [
          { label: 'Our auto', note: 'The crystal ball sighed.' },
          { label: 'Inspection', note: 'Bring your 18-inch cube. And a ruler. And hope.' },
          { label: 'Alliance selection', note: 'The ball sees… a spreadsheet.' },
          { label: 'Whether the intake holds', note: 'The ball is not that powerful.' },
        ],
      },
      { key: 'tea', type: 'toggle', label: 'Read the tea leaves too', on: 'Tea leaves included', off: 'Crystal ball only' },
      { key: 'spoilers', type: 'slider', label: 'How many spoilers you want', min: 0, max: 10, marks: { 0: 'None', 10: 'All of them' } },
    ],
    cta: 'See the future',
    confirm: 'Reading booked for {when}. Topic: {ask}. {tea}. Competition is close, {first}. The ball can feel it.',
    track: {
      confirmed: ['The crystal ball has been polished. It saw you coming.'],
      remind: [
        'Your reading is in 1 hour. The ball already knows what you’ll ask.',
        'One hour. Bring the robot. The ball wants to look at it.',
      ],
      late: [
        { icon: '🔮', title: 'running late', body: 'The crystal ball got distracted watching a match from 2019.' },
        { icon: '🌫️', title: 'is foggy', body: 'Too much fog. Someone used the smoke machine again.' },
      ],
    },
    scene: {
      type: 'cards',
      prompt: 'Draw a card from the robotics tarot.',
      emoji: '🔮',
      results: [
        'The Tower: your robot tips over at 0:03.',
        'The Star: a perfect auto. Once. Never on video.',
        'The Wheel of Fortune: a mecanum wheel falls off. It’s fine.',
        'The Judge: they love your notebook. They want to talk about it. For 40 minutes.',
        'The Fool: you forgot the battery.',
      ],
      win: 'About {ask}: the ball has spoken. Spoiler level {spoilers}.',
    },
  },

  't-programmer': {
    title: 'Show the duck your code',
    item: 'code review',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'Paste the line you’re worried about',
        placeholder: 'if (robot.works) {',
        required: true,
        max: 120,
      },
      {
        key: 'lang',
        type: 'choice',
        label: 'Language',
        options: [
          { label: 'Java', note: 'The duck has seen worse. Not much worse.' },
          { label: 'Kotlin', note: 'The duck is impressed and suspicious.' },
          { label: 'Blocks', note: 'The duck respects blocks.' },
          { label: 'Vibes', note: 'The duck codes in vibes too.' },
        ],
      },
      { key: 'comments', type: 'slider', label: 'Comments in your code', min: 0, max: 100, unit: '%', marks: { 0: 'Lawless' } },
      { key: 'blame', type: 'toggle', label: 'Blame the hardware', on: 'Hardware’s fault', off: 'Taking responsibility (rare)' },
    ],
    cta: 'Quack',
    confirm: 'The duck is reading “{text}.” In {lang}. With {comments} comments. {blame}.',
    track: {
      review: [
        'The duck is staring at your code. The duck has not blinked.',
        'The duck is running it in its head. The duck’s head crashed.',
      ],
      replies: [
        'Missing semicolon. The duck is always right.',
        'The duck says it works on the duck’s machine.',
        'The duck says: it’s an off-by-one error. The duck counted wrong too.',
      ],
    },
    chat: [
      {
        say: '{first}, the duck noticed you pushed at 2 AM. Want to talk about it?',
        options: [
          { label: 'It was urgent', reply: 'The commit message was “asdf.”' },
          { label: 'No', reply: 'The duck will wait. The duck is patient.' },
          { label: 'Quack', reply: 'Finally, someone who speaks the language.' },
        ],
      },
      {
        say: 'Did you try turning the robot off and on again?',
        options: [
          { label: 'Yes', reply: 'Try it once more. With feeling.' },
          { label: 'Not yet', reply: 'The duck will be here when you get back.' },
        ],
      },
    ],
  },

  't-cad': {
    title: 'Explain yourself to the potato',
    item: 'design hearing',
    fields: [
      { key: 'text', type: 'text', label: 'Explain your design', placeholder: 'The holes are for… airflow', required: true, max: 120 },
      {
        key: 'part',
        type: 'choice',
        label: 'The part in question',
        options: [
          { label: 'The intake', note: 'The potato has questions about the intake.' },
          { label: 'The arm', note: 'The potato has questions about the arm too.' },
          { label: 'The 400 fillets', note: 'The potato counted. It was 412.' },
          { label: 'Sketch 47 (unconstrained)', note: 'The potato is shaking.' },
        ],
      },
      { key: 'mates', type: 'slider', label: 'Broken mates', min: 0, max: 50, marks: { 0: 'Liar', 50: 'Honest' } },
    ],
    cta: 'Face the potato',
    confirm: 'The potato is reviewing {part}. You admitted to {mates} broken mates. The potato saw your CAD, {first}.',
    track: {
      review: ['The potato is rotating your model. Slowly. Ominously.', 'The potato zoomed in. The potato zoomed in more.'],
      replies: [
        'The potato has received your design. The potato is disappointed.',
        'The potato fixed one mate. Three others broke. The potato is going to lie down.',
        'The potato says {part} is fine. The potato is being polite.',
      ],
    },
    chat: [
      {
        say: 'The potato would like to see the version history.',
        options: [
          { label: 'Here it is', reply: '“final_v2_REAL_final_3.” The potato understands everything now.' },
          { label: 'There is no history', reply: 'The potato respects a person with no past.' },
          { label: 'It was like that when I got here', reply: 'The potato checked. It was not.' },
        ],
      },
      {
        say: 'Will you fully constrain your sketches from now on?',
        options: [
          { label: 'I promise', reply: 'The potato has heard that before. From you.' },
          { label: 'No', reply: 'The potato admires your honesty. The potato is still sad.' },
        ],
      },
    ],
  },

  't-electrical': {
    title: 'Send help for your wiring',
    item: 'emergency spray',
    fields: [
      { key: 'qty', type: 'qty', label: 'Cans of emergency spray', max: 10, unit: 'cans' },
      {
        key: 'mess',
        type: 'choice',
        label: 'How bad is it?',
        options: [
          { label: 'A little tangled', note: 'We’ve seen the inside of the robot. It’s not a little.' },
          { label: 'Spaghetti', note: 'Classic.' },
          { label: 'Lasagna', note: 'Layers. So many layers.' },
          { label: 'It’s alive', note: 'Do not make eye contact with it.' },
        ],
      },
      { key: 'labels', type: 'toggle', label: 'Add wire labels', on: 'Labels included (finally)', off: 'Vibes-based wiring' },
      { key: 'tape', type: 'slider', label: 'Electrical tape holding it together', min: 0, max: 100, unit: 'ft', marks: { 100: 'Mummy' } },
    ],
    cta: 'Send help',
    confirm: '{qty} of spray. Wiring status: “{mess}.” {labels}. {tape} of tape noted. Help is on the way. Help is scared.',
    track: {
      packed: ['Packed in a static-free bag. We’re not taking chances with you.', 'Packed with a flashlight. You’ll need it in there.'],
      twists: [
        { icon: '⚡', title: 'Your package shocked the driver', body: 'He’s fine. His hair is not.' },
        { icon: '🍝', title: 'Your package got tangled', body: 'In its own label. We don’t know how. We blame you.' },
      ],
      places: ['Left next to the robot. It hissed at us.', 'Left far from the robot. For safety.'],
    },
    scene: {
      type: 'dial',
      prompt: 'Find the loose wire. Turn until the robot stops twitching.',
      emoji: '🔌',
      left: 'Brownout',
      right: 'Magic smoke',
      hints: ['Nothing’s happening.', 'Something flickered…', 'The LEDs are dancing!'],
      win: 'Fixed! “{mess}” is under control. For now. {labels}. Please don’t touch it again.',
    },
  },

  't-busy': {
    title: 'Book a session at Robot Therapy',
    item: 'session (for you)',
    fields: [
      { key: 'when', type: 'when', label: 'Session' },
      {
        key: 'feeling',
        type: 'choice',
        label: 'How are you feeling?',
        options: [
          { label: 'Fine', note: 'You have a lot of open tasks. We’ll see.' },
          { label: 'Overwhelmed', note: 'Valid. Very valid. Look at that task list.' },
          { label: 'Like a stripped screw', note: 'We see this a lot.' },
          { label: 'Like the robot after a match', note: 'Smoking slightly but still going?' },
        ],
      },
      { key: 'topics', type: 'multi', label: 'Talk about', options: ['My tasks', 'My robot', 'My CAD', 'The group chat', 'Sleep'], max: 3 },
      { key: 'couch', type: 'choice', label: 'Couch', options: ['Your couch', 'The robot’s couch', 'The floor'] },
    ],
    cta: 'Book a session',
    confirm: 'Session {when}. Feeling: {feeling}. Topics: {topics}. Lie on {couch}. We usually do robots, but you need this.',
    track: {
      confirmed: ['Your therapist read your task list. Your therapist booked a double session.'],
      remind: ['Your session is in 1 hour. Bring your feelings. And your task list.', 'One hour. Your therapist is fluffing {couch}.'],
      late: [
        { icon: '🤖', title: 'running late', body: 'Their last patient was a robot with abandonment issues.' },
        { icon: '📋', title: 'delayed', body: 'They’re still reading your task list. It’s long.' },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: 'So. How does all of this make you feel?',
          options: [
            { label: 'Busy', reply: 'Mm. And how does “busy” make you feel?' },
            { label: 'Fine', reply: 'You said “{feeling}” on the form.' },
            { label: 'Like a robot', reply: 'That’s my specialty.' },
          ],
        },
        {
          say: 'Let’s try something. Pick one task. Just one. Let go of the rest for today.',
          options: [
            { label: 'Okay', reply: 'Good. Breathe. The rest will still be there. That’s the bad news.' },
            { label: 'I can’t', reply: 'That’s what the robot said too.' },
          ],
        },
        {
          say: 'Same time next week?',
          options: [
            { label: 'Yes', reply: 'Wonderful. I’ll keep {couch} warm.' },
            { label: 'Maybe', reply: 'I’ll pencil you in. In pen.' },
          ],
        },
      ],
      win: 'Session complete. You talked about {topics}. You feel 12% lighter. Your tasks do not.',
    },
  },
};
