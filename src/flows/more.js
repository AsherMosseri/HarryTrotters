// Flows for MORE_ADS 1–15 in src/adPacks.js (see src/adFlows.js for the format).
export default {
  'bolt-bae': {
    title: 'Create your Bolt Bae profile',
    item: 'thread match',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'Describe your ideal thread',
        placeholder: 'Tall, fine pitch, likes long walks in the pit',
        required: true,
        max: 120,
      },
      {
        key: 'size',
        type: 'choice',
        label: 'You are a…',
        options: [
          { label: 'M3 × 0.5', note: 'Small but mighty. Gets lost a lot.' },
          { label: 'M4 × 0.7', note: 'The reliable one. Everyone’s ex.' },
          { label: '#10-32', note: 'Imperial. Your parents don’t approve.' },
          { label: 'Stripped', note: 'It’s okay. We’ve all been there.' },
        ],
      },
      {
        key: 'looking',
        type: 'multi',
        label: 'Looking for',
        max: 2,
        options: ['A nylock nut', 'Something casual', 'Lock washer energy', 'Just friends (washers)'],
      },
      { key: 'torque', type: 'slider', label: 'How tight you like it', min: 0, max: 10, marks: { 0: 'Finger tight', 10: 'Stripped' } },
    ],
    cta: 'Start swiping',
    confirm: 'Profile live: {size}, looking for {looking}. Somewhere out there, a nut is reading your bio.',
    track: {
      review: [
        'Bolt Bae is reading your profile. Out loud. To a bin of nuts.',
        'Your profile is being shown to 4,000 nuts. 3 are interested.',
      ],
      replies: [
        'It’s a match! M3 × 0.5, 4 miles away. Says they “really get your thread.”',
        'You have a match. It’s a wood screw. We’re so sorry.',
        'Three matches. Two are cross-threaded. One is a washer who “just wants to talk.”',
      ],
    },
    chat: [
      {
        say: 'Your match would like to know: are you looking for something serious?',
        options: [
          { label: 'Loctite serious', reply: 'They’re blushing. Nuts can’t blush. This one is.' },
          { label: 'Just a quick fit', reply: 'They said “that’s what the last bolt said.”' },
          { label: 'I’m a robot part', reply: 'So are they. That’s kind of the whole app.' },
        ],
      },
      {
        say: 'They asked if you want to meet up in the parts bin Saturday.',
        options: [
          { label: 'Yes!', reply: 'Date booked. Please don’t cross-thread on the first date.' },
          { label: 'Too fast', reply: 'They understand. They’ll be in drawer 3 if you change your mind.' },
        ],
      },
    ],
  },

  'clamp-gym': {
    title: 'Book a workout at Clamp Gym',
    item: 'grip workout',
    fields: [
      { key: 'when', type: 'when', label: 'Workout' },
      {
        key: 'clamp',
        type: 'choice',
        label: 'Your clamp',
        options: [
          { label: 'C-clamp', note: 'Classic. It will never let go. Neither will you.' },
          { label: 'Bar clamp', note: 'For people who hold long things.' },
          { label: 'Vise grip', note: 'Locks on. Comes with a mild threat.' },
          { label: 'Binder clip', note: 'Beginner tier. No shame. Some shame.' },
        ],
      },
      { key: 'part', type: 'text', label: 'What part will you hold', placeholder: 'The drivetrain, during wiring', max: 50 },
      {
        key: 'minutes',
        type: 'slider',
        label: 'How long you can hold it',
        min: 1,
        max: 120,
        unit: 'min',
        marks: { 1: 'Spaghetti arms', 120: 'Statue' },
      },
    ],
    cta: 'Get a grip',
    confirm: 'Workout locked in for {when}. Bring {part}. Your {clamp} is already warming up.',
    track: {
      confirmed: ['Your {clamp} has been assigned. It looked at you. It’s ready.'],
      remind: ['Workout in 1 hour. Stretch your fingers. All ten.', 'One hour. Do not open any pickle jars before then.'],
      late: [
        { icon: '🗜️', title: 'running late', body: 'The trainer clamped himself to the squat rack. Again.' },
        { icon: '🧤', title: 'a little behind', body: 'Someone is still holding the 9 AM class’s part. Since 9 AM.' },
      ],
    },
    scene: {
      type: 'hold',
      prompt: 'Hold {part} for the inspector photo. Do NOT let go.',
      emoji: '🗜️',
      button: 'Hold it',
      ms: 4000,
      stages: ['Easy.', 'Fingers tingling.', 'Your forearm is writing a will.', 'You have become the clamp.'],
      early: 'You let go. The part fell. The inspector saw. Again.',
      win: 'Held {part} like a {clamp}. Coach says your {minutes} goal was “ambitious.” Same time tomorrow.',
    },
  },

  cadillac: {
    title: 'Configure your CADillac',
    item: 'CADillac (render only)',
    fields: [
      {
        key: 'trim',
        type: 'choice',
        label: 'Trim level',
        options: [
          { label: 'Sketch', note: 'Two lines and a dream.' },
          { label: 'Fully Constrained', note: 'Every dimension locked. You will never edit it again.' },
          { label: 'Under-defined Sport', note: 'Moves when you look at it.' },
          { label: 'Rendered Luxury', note: 'Took 9 hours to render. Looks like a jelly bean.' },
        ],
      },
      {
        key: 'color',
        type: 'choice',
        label: 'Paint',
        options: ['Default Gray', 'Slightly Different Gray', 'Appearance: Chrome', 'Transparent (oops)'],
      },
      { key: 'wheels', type: 'slider', label: 'Wheels', min: 0, max: 8, marks: { 0: 'Sold separately', 8: 'Mecanum everything' } },
      { key: 'build', type: 'toggle', label: 'Actually build it', on: 'Yes (we’ll see)', off: 'No (be honest)' },
    ],
    cta: 'Render my ride',
    confirm: 'Your {color} {trim} with {wheels} wheels is rendering. Build it: {build}.',
    track: {
      packed: ['Exported as .STEP. Then .STL. Then .STEP again, just in case.', 'Zipped. It’s still 2 GB.'],
      shipped: ['Uploading at 12 KB/s. It’s on the lab Wi-Fi.', 'Sent by email. Bounced. Sent by flash drive.'],
      twists: [
        { icon: '💥', title: 'Your CADillac failed to rebuild', body: 'A sketch lost a reference. All 4,000 features are red.' },
        { icon: '🧲', title: 'Mate error detected', body: 'The wheels are now mated to the moon.' },
      ],
      places: ['Left in your Downloads folder. Next to 40 other CADillacs.', 'Pinned to the team Onshape doc. Do not touch it.'],
    },
    scene: {
      type: 'unbox',
      prompt: 'Tap to unzip the 2 GB file.',
      taps: 4,
      inside: [
        'It’s beautiful. It’s {color}. It will never exist.',
        'Your {trim} rendered perfectly. The wheels are inside the body. Close enough.',
        'It opened in 47 minutes and crashed the lab computer. Worth it.',
      ],
    },
  },

  'loctite-lite': {
    title: 'Order Loctite Lite',
    item: 'bottle of Loctite Lite',
    fields: [
      { key: 'qty', type: 'qty', label: 'Bottles', max: 12, unit: 'bottles' },
      {
        key: 'strength',
        type: 'choice',
        label: 'Strength',
        options: [
          { label: 'Purple (barely)', note: 'Holds until someone looks at it.' },
          { label: 'Blue (one match)', note: 'Our bestseller. Lets go in the finals.' },
          { label: 'Red (one and a half)', note: 'Lasts until semifinals. Every time.' },
        ],
      },
      {
        key: 'match',
        type: 'slider',
        label: 'Which match it should fail in',
        min: 1,
        max: 12,
        marks: { 1: 'Practice', 12: 'Finals (classic)' },
      },
    ],
    cta: 'Lock it in (mostly)',
    confirm: '{qty} of {strength}. Scheduled to let go in match {match}. As promised.',
    track: {
      packed: ['The cap was tightened with Loctite Lite. It’s already loose.', 'Packed carefully. The label is peeling off on schedule.'],
      twists: [
        { icon: '🔩', title: 'Your package came apart in transit', body: 'We used our own product on the box. Lesson learned.' },
        { icon: '🧪', title: 'Quality control check', body: 'The bottle held. That’s a defect. We’re looking into it.' },
      ],
      places: ['Left on the pit table. It is slowly rolling off.', 'Delivered. The box screws already backed out.'],
    },
    scene: {
      type: 'tap',
      prompt: 'Tighten the screw before the match. Tap to turn.',
      emoji: '🔩',
      button: 'Quarter turn',
      goal: 14,
      stages: ['Snug.', 'Snugger.', 'It’s holding! For now.', 'Perfect. Do not breathe near it.'],
      win: 'Screw locked with {strength}. It will hold until match {match}. Not one match more.',
    },
  },

  'battery-spa': {
    title: 'Book a spa day for your batteries',
    item: 'battery spa day',
    fields: [
      { key: 'when', type: 'when', label: 'Spa day' },
      { key: 'count', type: 'slider', label: 'Batteries coming', min: 1, max: 12, marks: { 12: 'The whole drawer' } },
      {
        key: 'package',
        type: 'choice',
        label: 'Package',
        options: [
          { label: 'Trickle & Chill', note: 'Slow charge, soft music, no robots.' },
          { label: 'Terminal Massage', note: 'Our therapists use tiny warm hands.' },
          { label: 'Cucumber Cell Facial', note: 'Do not put cucumbers on a battery. We do. Professionally.' },
          { label: 'Full Discharge Detox', note: 'They come out at 0%. Spiritually full.' },
        ],
      },
      { key: 'robot', type: 'toggle', label: 'Tell the robot where they went', on: 'Yes (honesty)', off: 'No (it’ll get jealous)' },
    ],
    cta: 'Treat your cells',
    confirm: '{count} batteries booked for the {package}, {when}. Please arrive fully discharged.',
    track: {
      confirmed: ['A robe in each battery’s size has been set out.', 'The spa lit a candle that smells like 12.8 V.'],
      remind: ['Spa day in 1 hour. Unplug them gently. They’ve been through a lot.'],
      late: [
        { icon: '🔋', title: 'running late', body: 'The 2 PM battery won’t get out of the hot tub.' },
        { icon: '🧖', title: 'behind schedule', body: 'A Matrix battery is crying in the steam room. It’s fine.' },
      ],
    },
    scene: {
      type: 'dial',
      prompt: 'Set the hot tub to the perfect charging temperature.',
      emoji: '🛁',
      left: 'Frozen',
      right: 'Spicy',
      hints: ['Your batteries are shivering.', 'Getting cozy…', 'Almost spa-perfect…'],
      win: 'Your {count} batteries came out of the {package} glowing. One asked to stay forever.',
    },
  },

  'pit-crew-temps': {
    title: 'Hire a pit crew',
    item: 'pit crew',
    fields: [
      { key: 'when', type: 'when', label: 'Shift' },
      { key: 'interns', type: 'qty', label: 'Interns', max: 20, unit: 'interns' },
      {
        key: 'job',
        type: 'multi',
        label: 'They will',
        max: 3,
        options: ['Hold the robot', 'Carry batteries', 'Look busy', 'Cheer loudly', 'Stand near judges', 'Not touch the robot'],
      },
      {
        key: 'vibe',
        type: 'choice',
        label: 'Crew vibe',
        options: [
          { label: 'Professional', note: 'Matching shirts. Nobody knows your team number.' },
          { label: 'Hype', note: 'They will chant. You cannot stop them.' },
          { label: 'Mysterious', note: 'Sunglasses indoors. Very cool. Bumps into things.' },
        ],
      },
    ],
    cta: 'Hire the crew',
    confirm: '{interns} {vibe} interns for {when}. Duties: {job}. Two will get lost.',
    track: {
      confirmed: ['Your interns have been briefed. They stopped listening halfway.'],
      remind: ['Crew arrives in 1 hour. Hide the robot. Just in case.'],
      late: [
        { icon: '🗺️', title: 'running late', body: 'Two interns went to the wrong school. One is at a basketball game.' },
        { icon: '🍕', title: 'stuck at lunch', body: 'The interns found the free pizza. Give them a minute.' },
      ],
    },
    scene: {
      type: 'catch',
      prompt: 'Round up your interns. Do NOT grab the robot.',
      emoji: '👷',
      goal: 7,
      decoys: ['🤖', '🔋'],
      speed: 'fast',
      win: 'Crew assembled! They did: {job}. One touched the robot anyway. There’s always one.',
    },
  },

  'inspector-detector': {
    title: 'Order an Inspector Detector',
    item: 'Inspector Detector',
    fields: [
      { key: 'qty', type: 'qty', label: 'Detectors', max: 6, unit: 'detectors' },
      {
        key: 'alert',
        type: 'choice',
        label: 'Alert sound',
        options: [
          { label: 'Polite beep', note: 'The inspector will also hear it. And smile.' },
          { label: 'Air horn', note: 'Subtle.' },
          { label: 'Whispered “act natural”', note: 'Our most popular. Very unsettling.' },
          { label: 'Silent vibrate', note: 'You will think it’s your phone. Every time.' },
        ],
      },
      { key: 'range', type: 'slider', label: 'Detection range', min: 1, max: 100, unit: 'ft', marks: { 1: 'Too late', 100: 'Paranoid' } },
      {
        key: 'hide',
        type: 'multi',
        label: 'Things to hide fast',
        max: 3,
        options: ['Zip ties', 'Extra motor', 'Hot glue', 'Duct tape', 'Sizing cube results'],
      },
    ],
    cta: 'Act natural',
    confirm: '{qty} detectors at {range}, set to {alert}. Ready to hide: {hide}.',
    track: {
      packed: ['Packed quietly. Very quietly. Someone might be watching.'],
      twists: [
        { icon: '🚨', title: 'Your detector is beeping in the warehouse', body: 'An inspector works here part-time. We had no idea.' },
        { icon: '🕵️', title: 'Package inspected', body: 'By an inspector. It passed. Barely. He asked about the zip ties.' },
      ],
      places: ['Left behind the pit banner. Act natural.', 'Handed to you by an inspector. He said “nice detector.”'],
    },
    scene: {
      type: 'catch',
      prompt: 'Inspection is coming. Spot the inspectors — leave your teammates alone.',
      emoji: '🕵️',
      goal: 6,
      decoys: ['🧑‍🔧', '🧑‍💻'],
      speed: 'fast',
      win: 'All inspectors detected with {alert}. You hid {hide} just in time. You passed. Nobody knows how.',
    },
  },

  'snack-lock': {
    title: 'Order a Snack Drawer Lock',
    item: 'Snack Drawer Lock',
    fields: [
      {
        key: 'lock',
        type: 'choice',
        label: 'Lock type',
        options: [
          { label: 'Combination', note: 'Combination: ask a mentor. Oh no.' },
          { label: 'Fingerprint', note: 'Works great until someone has Cheeto fingers.' },
          { label: 'Riddle lock', note: 'The riddle is “what’s 2 + 2?” Mentors will still fail.' },
          { label: 'Padlock and prayer', note: 'Mentors have bolt cutters.' },
        ],
      },
      {
        key: 'snacks',
        type: 'multi',
        label: 'Protect',
        max: 3,
        options: ['Goldfish', 'Fruit snacks', 'Pretzels', 'The good chips', 'Emergency candy'],
      },
      { key: 'alarm', type: 'toggle', label: 'Mentor alarm', on: 'Sirens when a mentor approaches', off: 'Trust the mentors (why)' },
    ],
    cta: 'Lock the snacks',
    confirm: 'Your {lock} is guarding {snacks}. Mentor alarm: {alarm}. A mentor is already watching.',
    track: {
      packed: ['Packed in a locked box. We forgot the combination. Shipping anyway.'],
      twists: [
        { icon: '🍪', title: 'Package opened en route', body: 'Kevin thought it was snacks. It was a lock. He is disappointed.' },
        { icon: '🧔', title: 'A mentor intercepted your package', body: 'He returned it. With crumbs.' },
      ],
      places: ['Installed on the snack drawer. The drawer looks relieved.', 'Left on top of the snack drawer. Mentors noticed.'],
    },
    scene: {
      type: 'dial',
      prompt: 'Set the combination. Turn slowly. A mentor is listening.',
      emoji: '🔒',
      left: '0',
      right: '100',
      hints: ['Nope. A mentor heard that.', 'Click… closer…', 'So close the drawer is sweating…'],
      win: 'Locked! Snacks secured: {snacks}. For about 9 minutes. Mentors have bolt cutters.',
    },
  },

  'gp-mints': {
    title: 'Order Gracious Professionalism™ Mints',
    item: 'tin of mints',
    fields: [
      { key: 'qty', type: 'qty', label: 'Tins', max: 30, unit: 'tins' },
      {
        key: 'flavor',
        type: 'choice',
        label: 'Flavor',
        big: true,
        options: [
          { label: '🌿 Peppermint Respect', note: 'Fresh breath, firm handshake.' },
          { label: '🍓 Strawberry Sportsmanship', note: 'Sweet. Slightly forced.' },
          { label: '🧊 Cool Under Pressure', note: 'For when the other alliance had a better auto.' },
          { label: '🌶️ Spicy Rematch', note: 'Not technically gracious. Very professional.' },
        ],
      },
      { key: 'rival', type: 'text', label: 'Who you have to congratulate', placeholder: 'The team that beat us 98–97', max: 50 },
      { key: 'smile', type: 'slider', label: 'Smile sincerity', min: 0, max: 100, unit: '%', marks: { 0: 'Teeth only', 100: 'Saint' } },
    ],
    cta: 'Be gracious',
    confirm: '{qty} of {flavor} on the way. You will congratulate {rival} at {smile} sincerity.',
    track: {
      packed: ['Each mint was individually wrapped and complimented.'],
      twists: [
        {
          icon: '🤝',
          title: 'Your driver stopped to congratulate someone',
          body: 'He congratulated the whole warehouse. It took a while.',
        },
        { icon: '🍬', title: 'Another team’s package got mixed up with yours', body: 'Kevin graciously swapped it back. Professionally.' },
      ],
      places: ['Handed to you with a high five.', 'Left at your pit with a thank-you card from the box.'],
    },
    scene: {
      type: 'cards',
      prompt: 'Pick a mint. Each one comes with something to say to {rival}.',
      emoji: '🍬',
      results: [
        '“Great match! Your intake is better than ours. For now.”',
        '“Congrats! We were going easy on you.” (Spit that one out.)',
        '“Amazing auto. Can we see your code? Kidding. Unless?”',
        '“Good game!” with a firm handshake. Classic.',
        '“You deserved it.” You said it. You almost meant it.',
      ],
      win: 'Delivered to {rival} at {smile} sincerity. Very gracious. Very professional.',
    },
  },

  'band-insurance': {
    title: 'Get Surgical Tubing Insurance',
    item: 'tubing insurance plan',
    fields: [
      {
        key: 'plan',
        type: 'choice',
        label: 'Plan',
        options: [
          { label: 'Bronze (no coverage)', note: 'Covers nothing. Very affordable.' },
          { label: 'Silver (less coverage)', note: 'Covers less than nothing. Somehow.' },
          { label: 'Gold (we’ll think about it)', note: 'A claims agent will think about it. Briefly.' },
          { label: 'Platinum (thoughts & prayers)', note: 'Our most comprehensive denial.' },
        ],
      },
      { key: 'snaps', type: 'slider', label: 'Snaps per competition', min: 0, max: 20, marks: { 0: 'Lie', 20: 'Honest' } },
      {
        key: 'covered',
        type: 'multi',
        label: 'Cover',
        max: 3,
        options: ['Surgical tubing', 'Rubber bands', 'Your feelings', 'The intake', 'Your eye (please)'],
      },
    ],
    cta: 'Get not covered',
    confirm: 'You’re on {plan}. Covering {covered}. Your first claim has already been denied.',
    track: {
      packed: ['Your policy is 400 pages. Page 3 says “no.”'],
      twists: [
        { icon: '🩹', title: 'Your policy snapped in transit', body: 'Claim filed. Claim denied. Policy still active.' },
        { icon: '📄', title: 'Fine print update', body: 'Coverage now excludes tubing. And bands. And Tuesdays.' },
      ],
      places: ['Left in your mailbox. It snapped the mailbox flag.', 'Left on the intake. The intake asked for a copy.'],
    },
    scene: {
      type: 'scratch',
      prompt: 'Scratch to see if your claim was approved.',
      prizes: [
        'DENIED. Reason: you used it.',
        'DENIED. Reason: tubing is “a lifestyle choice.”',
        'APPROVED! For $0.03. Check arrives in 3–5 business decades.',
        'DENIED. Reason: you snapped it {snaps} times. That’s a pattern.',
      ],
      win: 'Thank you for choosing {plan}.',
    },
  },

  geargpt: {
    title: 'Ask GearGPT anything',
    item: 'GearGPT answer',
    fields: [
      { key: 'text', type: 'text', label: 'Your question', placeholder: 'Why does our arm sag?', required: true, max: 120 },
      {
        key: 'mode',
        type: 'choice',
        label: 'Answer mode',
        options: [
          { label: 'Concise', note: 'Answer: different gear ratio.' },
          { label: 'Detailed', note: 'Answer: a different gear ratio, but longer.' },
          { label: 'Creative', note: 'Answer: a different gear ratio, but as a poem.' },
        ],
      },
      { key: 'motors', type: 'toggle', label: 'Allow “add more motors”', on: 'Yes (it’s usually right)', off: 'No (be brave)' },
    ],
    cta: 'Generate answer',
    confirm: 'GearGPT is thinking in {mode} mode. It already knows the answer. It’s a gear ratio.',
    track: {
      review: ['GearGPT is thinking… thinking… calculating a gear ratio.', 'Tokens used: 4. All of them say “gear.”'],
      replies: [
        'Have you tried a different gear ratio?',
        'Great question! Have you tried a different gear ratio?',
        'Based on 1.2 trillion parameters: a different gear ratio. Also add more motors.',
      ],
    },
    chat: [
      {
        say: 'Was this answer helpful?',
        options: [
          { label: '👍', reply: 'Thank you! Have you tried a different gear ratio?' },
          { label: '👎', reply: 'Sorry about that. Regenerating… have you tried a different gear ratio?' },
          { label: 'It was a coding question', reply: 'Have you tried a different gear ratio in your code?' },
        ],
      },
      {
        say: 'Anything else I can help with?',
        options: [
          { label: 'Add more motors?', reply: 'Yes. Always. That one’s usually right.' },
          { label: 'No thanks', reply: 'Okay! Remember: gear ratio. 🤖' },
        ],
      },
    ],
  },

  'robot-drivers-ed': {
    title: 'Book a driving lesson for your robot',
    item: 'driving lesson',
    fields: [
      { key: 'when', type: 'when', label: 'Lesson' },
      { key: 'robot', type: 'text', label: 'Your robot’s name', placeholder: 'Sir Drives-a-Lot', max: 30 },
      {
        key: 'skill',
        type: 'choice',
        label: 'Driving skill',
        options: [
          { label: 'Stays in a lane', note: 'Any lane. We’re not picky.' },
          { label: 'Knows where the wall is', note: 'By hitting it. Repeatedly.' },
          { label: 'Spins in place', note: 'Field-centric, or just dizzy.' },
          { label: 'Drives itself (bad)', note: 'That’s autonomous. Ours is a different class.' },
        ],
      },
      { key: 'walls', type: 'slider', label: 'Walls hit per match', min: 0, max: 30, marks: { 0: 'Never', 30: 'Bumper car' } },
    ],
    cta: 'Book the lesson',
    confirm: '{robot} has a lesson {when}. Goal: stop hitting {walls} walls a match.',
    track: {
      confirmed: ['The instructor has been told about {robot}. He sighed.'],
      remind: ['Lesson in 1 hour. Charge {robot}. Tell it to be calm.'],
      late: [
        { icon: '🚧', title: 'running late', body: 'The last student drove into the field wall. And then the real wall.' },
        {
          icon: '🚦',
          title: 'stuck at a light',
          body: 'The instructor is waiting for the light to turn green. It’s a robot. It doesn’t have lights.',
        },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: 'Okay, {robot}. Let’s start. Pull forward slowly.',
          options: [
            { label: 'Full throttle', reply: 'That was the wall. That was the wall again.' },
            { label: 'Slowly', reply: 'Good! Very good! Now stop. STOP. Okay, we’re in the hallway.' },
          ],
        },
        {
          say: 'Now a three-point turn.',
          options: [
            { label: 'Strafe instead', reply: 'Mecanum wheels. Show-off. Points awarded.' },
            { label: 'Spin 900°', reply: 'I’m going to be sick. That’s a fail. That’s also impressive.' },
          ],
        },
        {
          say: 'Last one: parallel park between two game pieces.',
          options: [
            { label: 'Nailed it', reply: 'You knocked over one. That’s a team record.' },
            { label: 'Push them away', reply: 'Technically there’s room now. I’ll allow it.' },
          ],
        },
      ],
      win: '{robot} passed with a learner’s permit. Must be supervised by a human with a controller.',
    },
  },

  'field-reset-fitness': {
    title: 'Join Field Reset Fitness',
    item: 'Field Reset Fitness plan',
    fields: [
      {
        key: 'program',
        type: 'choice',
        label: 'Program',
        options: [
          { label: 'Couch to Reset', note: '400 resets by week 9. You’ll cry by week 2.' },
          { label: 'Reset & Squat', note: 'Bend at the knees. Every. Single. Piece.' },
          { label: 'Volunteer Shred', note: 'Like the volunteers. They are so strong. So tired.' },
        ],
      },
      { key: 'resets', type: 'slider', label: 'Resets a day', min: 10, max: 400, step: 10, marks: { 10: 'Warm-up', 400: 'Volunteer' } },
      {
        key: 'music',
        type: 'choice',
        label: 'Workout music',
        options: ['Match start buzzer', 'Kickoff hype video', 'Silence and regret', 'The field fan noise'],
      },
    ],
    cta: 'Start resetting',
    confirm: 'Welcome to {program}. Day 1: {resets} resets. Soundtrack: {music}.',
    track: {
      packed: ['Your starter kit: one game piece. You’ll be putting it back a lot.'],
      twists: [
        { icon: '🏃', title: 'Your trainer reset the package', body: 'He put it back where it started. Out of habit. It’s coming again.' },
        { icon: '💪', title: 'Your box did a workout', body: 'It’s stronger now. It has abs. Weird.' },
      ],
      places: ['Left in the field. Exactly where it belongs.', 'Placed on the starting line. Please reset it after opening.'],
    },
    scene: {
      type: 'catch',
      prompt: 'Day 1. Pick up the game pieces. Not the robot. Not the referee.',
      emoji: '🟡',
      goal: 10,
      decoys: ['🤖', '🧑‍⚖️'],
      speed: 'fast',
      win: 'Field reset! Only {resets} to go today. Your legs have filed a complaint.',
    },
  },

  'extension-cord-store': {
    title: 'Order an extension cord',
    item: 'extension cord',
    fields: [
      { key: 'length', type: 'slider', label: 'Length', min: 3, max: 300, unit: 'ft', marks: { 3: 'Too short', 300: 'Also too short' } },
      { key: 'qty', type: 'qty', label: 'Cords', max: 10, unit: 'cords' },
      {
        key: 'color',
        type: 'choice',
        label: 'Color',
        options: [
          { label: 'Orange', note: 'You’ll trip on it. Visibly.' },
          { label: 'Black', note: 'You’ll trip on it. Invisibly.' },
          { label: 'Already tangled', note: 'Saves you the trouble.' },
        ],
      },
      { key: 'outlets', type: 'toggle', label: 'Extra outlets on the end', on: '6 outlets (fire marshal sad)', off: 'Just the one' },
    ],
    cta: 'Plug it in',
    confirm: '{qty} of {color}, {length} long. It will be 2 feet short. It’s always 2 feet short.',
    track: {
      packed: ['Coiled neatly. It will never be coiled neatly again.'],
      twists: [
        { icon: '🔌', title: 'Your cord got stuck at the warehouse door', body: 'It reached the truck. Minus 2 feet. We’re pulling.' },
        { icon: '🧶', title: 'Your cord tangled itself', body: 'In the box. While sealed. We don’t know how either.' },
      ],
      places: ['Left by the outlet. Two feet from the outlet.', 'Delivered. Plugged in. Can’t reach your desk.'],
    },
    scene: {
      type: 'hold',
      prompt: 'Stretch the cord to the field. Pull and don’t let go.',
      emoji: '🔌',
      button: 'Pull',
      ms: 3500,
      stages: ['It’s reaching…', 'Almost to the table…', 'So close…', 'Two feet short. Pull harder.'],
      early: 'It snapped back to the outlet. Like it always does.',
      win: 'It reached! You had to move the field 2 feet closer. Your {color} cord thanks you.',
    },
  },

  'kickoff-decoder': {
    title: 'Decode the game reveal',
    item: 'reveal decoding',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'What did you hear in the reveal?',
        placeholder: 'I think the narrator said “intake”',
        required: true,
        max: 120,
      },
      { key: 'rewatched', type: 'slider', label: 'Times you rewatched it', min: 1, max: 900, marks: { 1: 'Casual', 900: 'Expert' } },
      {
        key: 'theory',
        type: 'choice',
        label: 'Your theory',
        options: [
          { label: 'New intake', note: 'Correct. It’s always a new intake.' },
          { label: 'Hidden game piece', note: 'Frame 2,341. Zoom in. ZOOM IN.' },
          { label: 'Secret endgame', note: 'Hanging. It’s always hanging.' },
          { label: 'I just liked the music', note: 'Valid. Also: new intake.' },
        ],
      },
    ],
    cta: 'Decode it',
    confirm: 'Our experts are on rewatch #{rewatched}. Your theory ({theory}) is being taken very seriously.',
    track: {
      review: ['Our experts paused on frame 2,341. They’re zooming in.', 'Rewatching at 0.25× speed. The narrator blinked. Interesting.'],
      replies: [
        'Decoded. It means you need a new intake.',
        'We slowed it down 900 times. The answer is: new intake.',
        'Big news: the reveal hides a secret. The secret is a new intake.',
      ],
    },
    chat: [
      {
        say: 'Follow-up: did you notice the robot at 0:42 had a tiny intake?',
        options: [
          { label: 'Yes!!', reply: 'Then you know. New intake. Big one.' },
          { label: 'No…', reply: 'Rewatch it. 900 more times. We’ll wait.' },
          { label: 'What about drivetrain?', reply: 'Drivetrain is fine. Intake. Please.' },
        ],
      },
      {
        say: 'Want our premium decoding for next season?',
        options: [
          { label: 'Sign me up', reply: 'Prediction pre-loaded: you’ll need a new intake.' },
          { label: 'I get it', reply: 'Great. Go build an intake.' },
        ],
      },
    ],
  },
};
