// Flows for MORE_ADS 16–30 in src/adPacks.js (see src/adFlows.js for the format).
export default {
  'parts-witness-protection': {
    title: 'Report a part to Witness Protection',
    item: 'witness protection case',
    fields: [
      { key: 'part', type: 'text', label: 'Which part is missing?', placeholder: '2.5 mm hex key (again)', required: true, max: 60 },
      {
        key: 'lastSeen',
        type: 'choice',
        label: 'Last seen',
        options: [
          { label: 'In my hand', note: 'Two seconds ago. Classic.' },
          { label: 'In the robot', note: 'It does not want to be found.' },
          { label: 'Near Kevin', note: 'Interesting. Very interesting.' },
          { label: 'Never', note: 'Did it ever really exist?' },
        ],
      },
      { key: 'miss', type: 'slider', label: 'How much you miss it', min: 0, max: 10, marks: { 0: 'Good riddance', 10: 'Holding a vigil' } },
      { key: 'reward', type: 'toggle', label: 'Offer a reward', on: 'Reward: one Pit Bar', off: 'No reward (it knows)' },
    ],
    cta: 'File the report',
    confirm: 'Case opened for your {part}. Last seen: {lastSeen}. {reward}. We cannot confirm or deny anything.',
    track: {
      review: [
        'Agent Torx is looking into it. Agent Torx is also a hex key.',
        'Your {part} has been moved to a safe house. The safe house is a different toolbox.',
      ],
      replies: [
        'Your {part} is safe. It goes by “Gerald” now. Please don’t contact it.',
        'Your {part} has started a new life in someone else’s toolbox. It seems happy.',
        'We found it. It asked us not to tell you where.',
      ],
    },
    chat: [
      {
        say: 'We need to verify your identity. What size hex key did you lose most recently?',
        options: [
          { label: '2.5 mm', reply: 'Correct. Everyone loses the 2.5 mm.' },
          { label: 'All of them', reply: 'Honest. We respect that.' },
          { label: 'Hex key?', reply: 'This is why they leave.' },
        ],
      },
      {
        say: 'Would you like to send your {part} a message? We’ll pass it along anonymously.',
        options: [
          { label: 'Come home', reply: 'It read it. It’s not coming home.' },
          { label: 'I’m sorry', reply: 'It forgives you. It’s still not coming back.' },
          { label: 'Traitor', reply: 'Noted. Its new identity has been upgraded.' },
        ],
      },
    ],
  },

  'superglue-remover': {
    title: 'Order Superglue Remover',
    item: 'bottle of Superglue Remover',
    fields: [
      { key: 'qty', type: 'qty', label: 'Bottles', max: 12, unit: 'bottles' },
      {
        key: 'stuck',
        type: 'choice',
        label: 'What’s stuck',
        options: [
          { label: 'Fingers to fingers', note: 'You’re waving with one big hand now.' },
          { label: 'Hand to robot', note: 'You are part of the robot now. Congrats.' },
          { label: 'Phone to table', note: 'At least it’s charging. Probably.' },
          { label: 'Lid to bottle', note: 'The remover bottle. Yes. We know.' },
        ],
      },
      { key: 'urgency', type: 'slider', label: 'Urgency', min: 1, max: 10, marks: { 1: 'Eh', 10: 'Glued to the field' } },
      { key: 'spare', type: 'toggle', label: 'Spare bottle cap', on: 'Spare cap included (also glued)', off: 'No spare cap' },
    ],
    cta: 'Unstick me',
    confirm: '{qty} of remover for: {stuck}. Urgency {urgency}. {spare}. The bottle is glued shut. Sorry.',
    track: {
      packed: ['Packed. The packing tape is also glued shut.', 'Packed with care and one glued glove.'],
      twists: [
        { icon: '🧴', title: 'The box is glued to the truck', body: 'Kevin is using the remover. He can’t open it.' },
        { icon: '🤝', title: 'Your driver shook hands with a customer', body: 'They’re still shaking hands. Please be patient.' },
      ],
      places: ['Glued to the lab door. Permanently.', 'Left on the bench. Do not lean on it.'],
    },
    scene: {
      type: 'hold',
      prompt: 'The cap is glued shut. Hold to twist it open.',
      emoji: '🧴',
      button: 'Hold and twist',
      ms: 3500,
      stages: ['It’s budging…', 'It’s budging the other way…', 'Your hand is now glued to the cap.', 'POP!'],
      early: 'You let go. It re-glued itself. Of course it did.',
      win: 'It’s open! Your {stuck} problem is solved. The cap is now glued to your thumb.',
    },
  },

  'pit-earmuffs': {
    title: 'Order Pit Earmuffs Pro',
    item: 'Pit Earmuffs Pro',
    fields: [
      {
        key: 'block',
        type: 'multi',
        label: 'Block out',
        max: 4,
        options: ['The announcer', 'The music', 'Your coach', 'The other team’s chant', 'The air horn', 'Your own thoughts'],
      },
      {
        key: 'level',
        type: 'slider',
        label: 'Noise canceling',
        min: 0,
        max: 100,
        unit: '%',
        marks: { 0: 'Hear everything', 100: 'Hear colors' },
      },
      {
        key: 'color',
        type: 'choice',
        label: 'Color',
        options: [
          { label: 'Pit Black', note: 'Matches the pit floor. And your mood.' },
          { label: 'Safety Orange', note: 'Your coach will find you instantly.' },
          { label: 'Team Colors', note: 'Spirit points!' },
        ],
      },
      { key: 'mic', type: 'toggle', label: 'Built-in mic', on: 'Mic on (the drive team can reach you)', off: 'Mic off (peace)' },
    ],
    cta: 'Get quiet',
    confirm: 'Blocking: {block}. Noise canceling at {level}, in {color}. Your coach can still see you.',
    track: {
      shipped: ['Shipped in total silence. The driver didn’t hear the address.'],
      twists: [
        { icon: '📢', title: 'Your driver can’t hear the GPS', body: 'He tried the earmuffs on. He’s driving by feel now.' },
        { icon: '🔇', title: 'Delivery attempted', body: 'We knocked. You were wearing them. Of course you didn’t hear.' },
      ],
      out: ['Arriving soon. Shhh.'],
      places: ['Left in the pit. You didn’t hear it arrive.', 'Handed to your coach. Your coach can still see you.'],
    },
    scene: {
      type: 'dial',
      prompt: 'Tune out the pit. Find the spot where it all goes quiet.',
      emoji: '🎧',
      left: 'MATCH 47 IS STARTING',
      right: 'Whale sounds',
      hints: ['Still hearing the announcer.', 'The music is fading…', 'Almost silent. Just your coach’s face.'],
      win: 'Total silence. {block}: gone. Your coach is waving. You can’t hear it. Bliss.',
    },
  },

  'rookie-insurance': {
    title: 'Get Rookie Mistake Insurance',
    item: 'Rookie Mistake Insurance',
    fields: [
      {
        key: 'cover',
        type: 'multi',
        label: 'Cover me for',
        max: 3,
        options: [
          'Reversed polarity',
          'Forgot the battery',
          'Wrong alliance color',
          'Driving off in auto',
          'Unplugged the hub',
          'Forgot to save the code',
        ],
      },
      {
        key: 'plan',
        type: 'choice',
        label: 'Plan',
        options: [
          { label: 'Bronze', note: 'Covers one mistake. You’ll need more.' },
          { label: 'Silver', note: 'Covers three mistakes and one excuse.' },
          { label: 'Rookie Forever', note: 'For veterans who still do this.' },
        ],
      },
      {
        key: 'odds',
        type: 'slider',
        label: 'Chance you’ll need it',
        min: 0,
        max: 100,
        unit: '%',
        marks: { 0: 'Delusional', 100: 'Realistic' },
      },
    ],
    cta: 'Get covered',
    confirm: 'You’re covered for: {cover}. Plan: {plan}. Please check your battery is plugged in.',
    track: {
      packed: ['Your policy was printed. Upside down. That’s covered.'],
      twists: [
        { icon: '🧯', title: 'Your policy was inspected', body: 'The adjuster plugged it in backwards. Claim filed automatically.' },
        { icon: '🔋', title: 'Delivery delayed', body: 'The truck forgot its battery. It’s covered, at least.' },
      ],
      places: ['Left inside the robot, next to the battery you forgot.'],
    },
    scene: {
      type: 'cards',
      prompt: 'File your first claim. Pick a card.',
      emoji: '🧯',
      results: [
        'Claim approved! We plugged your battery in. That’s all it was.',
        'Claim denied. That mistake was made by a veteran.',
        'Claim approved! Your motor now spins the right way. The other one doesn’t.',
        'Claim pending. Our adjuster also forgot the battery.',
      ],
      win: 'Coverage: {cover}.',
    },
  },

  'overtime-pizza': {
    title: 'Order pizza to the lab',
    item: 'pizza',
    fields: [
      { key: 'qty', type: 'qty', label: 'Pizzas', max: 20, unit: 'pizzas' },
      {
        key: 'topping',
        type: 'choice',
        label: 'Topping',
        big: true,
        options: [
          { label: '🧀 Cheese', note: 'Safe. Boring. Gone in 40 seconds.' },
          { label: '🍍 Pineapple', note: 'This will start a fight in the lab.' },
          { label: '🔩 Extra bolts', note: 'Crunchy. Not food. Delicious.' },
          { label: '🍄 Whatever’s left', note: 'It’s always mushrooms.' },
        ],
      },
      {
        key: 'temp',
        type: 'slider',
        label: 'Temperature on arrival',
        min: 32,
        max: 90,
        unit: '°F',
        marks: { 32: 'Tradition', 90: 'A lie' },
      },
      { key: 'lid', type: 'toggle', label: 'Eat off a toolbox lid', on: 'Toolbox lid included', off: 'Plates (nobody will use them)' },
    ],
    cta: 'Order the pizza',
    confirm: '{qty} of {topping}, arriving at {temp}. {lid}. Arriving cold, as tradition demands.',
    track: {
      packed: ['Boxed. The cheese is already getting cold. Right on schedule.'],
      twists: [
        { icon: '🍕', title: 'Your driver ate a slice', body: 'Just one. Okay, two. It was cold anyway.' },
        { icon: '🌙', title: 'Your pizza is waiting for 9 PM', body: 'House rules. It can’t arrive before overtime starts.' },
      ],
      out: ['Heading to the lab. Cooling one degree per minute, as promised.'],
      places: ['Left on the toolbox lid. As tradition demands.', 'Left on the field. Please do not score it.'],
    },
    scene: {
      type: 'unbox',
      prompt: 'Open the pizza box before someone else does.',
      taps: 2,
      inside: [
        'It’s cold. Perfect.',
        'Someone already took a slice. It was you, from the future.',
        'There’s a hex key baked in. Good luck.',
        'It’s {topping}. Everyone wanted something else.',
      ],
    },
  },

  'chain-support-group': {
    title: 'Join a Broken Chain meeting',
    item: 'support group meeting',
    fields: [
      { key: 'when', type: 'when', label: 'Meeting' },
      {
        key: 'chain',
        type: 'choice',
        label: 'Your chain',
        options: [
          { label: '#25', note: 'The classic. We’ve all been there.' },
          { label: '#35', note: 'Brave. Still broke, though.' },
          { label: 'Belt, actually', note: 'You’re welcome here too. Mostly.' },
        ],
      },
      { key: 'snaps', type: 'slider', label: 'Chains broken this season', min: 0, max: 20, marks: { 0: 'In denial', 20: 'Group leader' } },
      {
        key: 'share',
        type: 'toggle',
        label: 'Share your story',
        on: 'You’ll share your story',
        off: 'Just listening (we’ll call on you anyway)',
      },
    ],
    cta: 'Save me a seat',
    confirm: 'See you {when}. {snaps} broken {chain} chains. Bring a master link. Everyone brings a master link.',
    track: {
      confirmed: ['A chair has been saved for you. It has a master link on it.'],
      remind: ['Meeting in 1 hour. Practice saying “master link” three times.', 'One hour. Check your chain tension on the way.'],
      late: [
        { icon: '⛓️', title: 'running late', body: 'The group leader’s chain broke on the way here.' },
        {
          icon: '🔧',
          title: 'running a little late',
          body: 'Someone forgot the master links. Everyone brought one. Nobody can find them.',
        },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: 'Welcome. Let’s all say it together: master link, master link, master link. Want to introduce yourself?',
          options: [
            { label: 'Hi, I broke a chain', reply: 'Hi! 👋 (everyone, at once)' },
            { label: 'I’m just here for snacks', reply: 'The snacks are master links. Sorry.' },
            { label: 'My chain is fine', reply: 'Denial is the first stage. We’ll wait.' },
          ],
        },
        {
          say: 'Tell us about the moment it snapped.',
          options: [
            { label: 'Elimination match', reply: 'The group gasps. Someone starts crying.' },
            { label: 'During inspection', reply: 'In front of the inspector? Oh no. Oh no no no.' },
            { label: 'Still in the box', reply: 'Before it even touched the robot. Legendary.' },
          ],
        },
        {
          say: 'Before we go: what will you do differently?',
          options: [
            { label: 'Tension it', reply: 'Growth. Beautiful growth.' },
            { label: 'Switch to belts', reply: 'The room goes quiet. Someone hisses.' },
            { label: 'Nothing', reply: 'See you next week, then.' },
          ],
        },
      ],
      win: 'You did it. {snaps} chains, zero judgment. You got a sobriety chip. It’s a master link.',
    },
  },

  'gear-horoscope': {
    title: 'Get your gear ratio horoscope',
    item: 'horoscope reading',
    fields: [
      { key: 'text', type: 'text', label: 'What’s your sign?', placeholder: 'Libra, 3:1', required: true, max: 40 },
      {
        key: 'element',
        type: 'choice',
        label: 'Your element',
        options: [
          { label: 'Aluminum', note: 'Light. Flexible. Bends under pressure.' },
          { label: 'Steel', note: 'Strong. Heavy. Overkill.' },
          { label: 'Polycarbonate', note: 'Shatterproof. Emotionally too.' },
          { label: 'Zip ties', note: 'Holds everything together. Barely.' },
        ],
      },
      {
        key: 'backlash',
        type: 'slider',
        label: 'Backlash in your gearbox',
        min: 0,
        max: 10,
        unit: '°',
        marks: { 0: 'Suspicious', 10: 'Spiritual' },
      },
    ],
    cta: 'Read my stars',
    confirm: 'The stars are aligning for {text}. Element: {element}. Backlash: {backlash}. Mercury is checking.',
    track: {
      review: [
        'Our astrologer is consulting the stars. And a gear chart.',
        'Mercury is in retrograde. So is the reading. It’s backing up.',
      ],
      replies: [
        'Your lucky ratio today is 7:3. Avoid spur gears after noon.',
        'The stars say 3:1. The gearbox says no.',
        'Big things ahead for {element} signs. Mostly stripped teeth.',
      ],
    },
    chat: [
      {
        say: 'The stars have a question. When did you last grease your gears?',
        options: [
          { label: 'Today', reply: 'The stars are impressed. The stars think you’re lying.' },
          { label: 'Never', reply: 'The stars could tell. The stars could hear it.' },
          { label: 'Grease?', reply: 'Mercury has entered retrograde out of spite.' },
        ],
      },
      {
        say: 'Would you like tomorrow’s reading too?',
        options: [
          { label: 'Yes', reply: 'Tomorrow: 5:1. Someone will borrow your hex key.' },
          { label: 'No', reply: 'The stars respect your boundaries. They’ll text anyway.' },
        ],
      },
    ],
  },

  'volunteer-hours': {
    title: 'Generate volunteer hours',
    item: 'hours of volunteering',
    fields: [
      {
        key: 'minutes',
        type: 'slider',
        label: 'Minutes you actually volunteered',
        min: 0,
        max: 60,
        unit: 'min',
        marks: { 0: 'Bold', 60: 'Overachiever' },
      },
      {
        key: 'where',
        type: 'choice',
        label: 'Where',
        options: [
          { label: 'The food bank', note: 'Wholesome. Real, hopefully.' },
          { label: 'The library', note: 'You shelved one book. Upside down.' },
          { label: 'Our own lab', note: 'Cleaning up your own mess counts? Bold.' },
          { label: 'Hard to say', note: 'We’ll fill in the details. We won’t.' },
        ],
      },
      { key: 'qty', type: 'qty', label: 'Hours to generate', max: 40, unit: 'hours' },
      {
        key: 'signature',
        type: 'toggle',
        label: 'Include a signature',
        on: 'Signed by “A. Supervisor”',
        off: 'Unsigned (honest, at least)',
      },
    ],
    cta: 'Generate hours',
    confirm: '{minutes} at {where}, turned into {qty}. {signature}. *It does not.',
    track: {
      packed: ['Your hours were counted. Then recounted. They went down.'],
      twists: [
        { icon: '🕵️', title: 'Your hours were audited', body: 'An auditor checked. Your 15 minutes are now 12 minutes.' },
        { icon: '⏳', title: 'Your hours are stuck in traffic', body: 'Hours take a while to arrive. That’s how hours work.' },
      ],
      places: ['Left in your inbox. It says “*It does not.”'],
    },
    scene: {
      type: 'scratch',
      prompt: 'Scratch off your certificate to see your official hours.',
      prizes: [
        'Official total: 15 minutes. Just like you said.',
        'Official total: 4 hours! (*It does not.)',
        'Official total: −3 hours. You owe the food bank.',
        'Official total: “Nice try.”',
      ],
      win: 'Volunteering at {where} is great, though. Try it for real. It’s fun.',
    },
  },

  'telemetry-diary': {
    title: 'Subscribe to the Telemetry Diary',
    item: 'Telemetry Diary',
    fields: [
      {
        key: 'robot',
        type: 'choice',
        label: 'Whose diary',
        options: [
          { label: 'Our robot', note: 'It has a lot to say. Mostly errors.' },
          { label: 'Last year’s robot', note: 'It’s been in a box. It’s bitter.' },
          { label: 'The practice bot', note: 'Short entries. Low self-esteem.' },
        ],
      },
      { key: 'verbosity', type: 'slider', label: 'Log level', min: 1, max: 5, marks: { 1: 'Errors only', 5: 'Every thought it has' } },
      { key: 'feelings', type: 'toggle', label: 'Feelings mode', on: 'with feelings', off: 'just the stack traces' },
    ],
    cta: 'Start reading',
    confirm: 'Subscribed to {robot}’s diary at log level {verbosity}, {feelings}. Today’s entry: NullPointerException.',
    track: {
      packed: ['Your first entry was printed. It’s 8,000 pages.'],
      twists: [
        { icon: '💥', title: 'Your diary crashed', body: 'NullPointerException. It’s writing about it now.' },
        { icon: '🔁', title: 'Your diary is stuck in a loop', body: 'Entry 8,001: same. Entry 8,002: same.' },
      ],
      places: ['Left by the driver station. It’s still logging.'],
    },
    scene: {
      type: 'catch',
      prompt: 'Catch the real diary entries. Skip the errors.',
      emoji: '📝',
      goal: 6,
      decoys: ['💥', '🐛', '🔴'],
      speed: 'fast',
      win: '{robot} wrote: “Dear diary, today I moved forward. Then a NullPointerException. Then nothing.” Moving.',
    },
  },

  'field-in-a-box': {
    title: 'Order a Practice Field in a Box',
    item: 'Practice Field in a Box',
    fields: [
      { key: 'qty', type: 'qty', label: 'Fields', max: 5, unit: 'fields' },
      {
        key: 'scale',
        type: 'choice',
        label: 'Scale',
        options: [
          { label: '1:48', note: 'Fits in your locker. Your robot doesn’t.' },
          { label: '1:1', note: 'Ships in a box the size of a gym. Sorry.' },
          { label: '1:1000', note: 'Bring a magnifying glass. And tweezers.' },
        ],
      },
      { key: 'pieces', type: 'toggle', label: 'Game pieces', on: 'with game pieces (tiny)', off: 'no game pieces (use crumbs)' },
      { key: 'note', type: 'text', label: 'Note for the field', placeholder: 'Please be bigger', max: 60 },
    ],
    cta: 'Order a field',
    confirm: '{qty} at {scale}, {pieces}. Your field fits in your locker. Your robot does not.',
    track: {
      packed: ['Folded 47 times to fit in the box.'],
      twists: [
        { icon: '🔍', title: 'Your field was lost in the truck', body: 'It’s 1:48 scale. It’s in there somewhere.' },
        { icon: '🐜', title: 'Ants are using your field', body: 'They scored 120 points. They’re very good.' },
      ],
      places: ['Left in your locker. It fits!', 'Left on the real field. Very confusing for everyone.'],
    },
    scene: {
      type: 'tap',
      prompt: 'Unfold your field. It keeps folding back up.',
      emoji: '📦',
      button: 'Unfold',
      goal: 14,
      stages: [
        'It’s the size of a sandwich.',
        'It’s the size of a pizza box.',
        'It’s the size of a table.',
        'It’s… still smaller than your robot.',
      ],
      win: 'Done! A {scale} field, ready to play. Your robot drove onto it and covered the whole thing.',
    },
  },

  'cable-monk': {
    title: 'Book a visit from the cable monk',
    item: 'monk visit',
    fields: [
      { key: 'when', type: 'when', label: 'Visit' },
      {
        key: 'mess',
        type: 'choice',
        label: 'How bad is it',
        options: [
          { label: 'A little messy', note: 'The monk smiles. You both know that’s a lie.' },
          { label: 'Spaghetti', note: 'The monk sighs. Silently.' },
          { label: 'Spaghetti and meatballs', note: 'There’s a battery in there somewhere.' },
          { label: 'We don’t open that side', note: 'The monk will need extra time. 8 years.' },
        ],
      },
      {
        key: 'ties',
        type: 'slider',
        label: 'Zip ties to provide',
        min: 0,
        max: 500,
        step: 10,
        marks: { 0: 'He brings his own', 500: 'A start' },
      },
      { key: 'quiet', type: 'toggle', label: 'Stay quiet during the visit', on: 'You’ll stay silent', off: 'You’ll talk (he won’t)' },
    ],
    cta: 'Request the monk',
    confirm: 'The monk arrives {when} for your wiring (status: “{mess}”), with {ties} zip ties. {quiet}. (Takes 6 to 8 years.)',
    track: {
      confirmed: ['The monk accepted. He sent a single zip tie as confirmation.'],
      remind: ['The monk is in 1 hour. Please begin being quiet.', 'One hour. The monk has started walking. He walks very slowly.'],
      late: [
        { icon: '🧘', title: 'running late', body: 'The monk stopped to tidy a stranger’s phone charger. It took a while.' },
        { icon: '🐌', title: 'running 6 to 8 years late', body: 'As promised.' },
      ],
    },
    scene: {
      type: 'chat',
      lines: [
        {
          say: '🧘 …',
          options: [
            { label: 'Hello?', reply: '🧘 … (he bows)' },
            { label: 'The wires are over here', reply: '🧘 … (he already knows)' },
            { label: '*bow back*', reply: '🧘 … (he approves)' },
          ],
        },
        {
          say: '🧘 … (he points at a wire, then at you)',
          options: [
            { label: 'That one’s fine', reply: '🧘 … (he zip ties it anyway)' },
            { label: 'I don’t know where it goes', reply: '🧘 … (he does. He won’t say.)' },
            { label: 'I’m sorry', reply: '🧘 … (he forgives you)' },
          ],
        },
        {
          say: '🧘 … (he holds up the last zip tie)',
          options: [
            { label: 'Cut it short', reply: '🧘 ✂️ … (perfect)' },
            { label: 'Leave the tail', reply: '🧘 … (he cuts it anyway)' },
          ],
        },
      ],
      win: 'Perfect harmony. “{mess}” is no more. The monk left without a word. He used {ties} zip ties. He also took a hex key.',
    },
  },

  'robot-name-generator': {
    title: 'Get a name for your robot',
    item: 'robot name',
    fields: [
      { key: 'text', type: 'text', label: 'Describe your robot', placeholder: 'It has wheels and an attitude', required: true, max: 100 },
      { key: 'vibe', type: 'multi', label: 'Vibe', max: 2, options: ['Fast', 'Scary', 'Cute', 'Mostly working', 'Held together by hope'] },
      {
        key: 'style',
        type: 'choice',
        label: 'Name style',
        options: [
          { label: 'Cool', note: 'Like “Thunderbolt.” You will get “Robot.”' },
          { label: 'Pun', note: 'We love a pun. Our algorithm loves “Robot.”' },
          { label: 'Classic', note: 'Robot. It’s Robot.' },
        ],
      },
    ],
    cta: 'Name my robot',
    confirm: 'Our algorithm is thinking about your {style}, {vibe} robot. It’s leaning toward “Robot.”',
    track: {
      review: [
        'Our algorithm is thinking. It has narrowed it down to one name.',
        'The algorithm asked for a second opinion. The second opinion said “Robot.”',
      ],
      replies: ['We suggest: Robot.', 'We suggest: Robot 2. (Robot was taken.)', 'We suggest: Sir Robot. Very {style}.'],
    },
    chat: [
      {
        say: 'Don’t love it? We can try again. What should it sound like?',
        options: [
          { label: 'Cooler', reply: 'Okay: “ROBOT.” In caps. Much cooler.' },
          { label: 'Funnier', reply: 'Okay: “Robert.” You’re welcome.' },
          { label: 'Scarier', reply: 'Okay: “Robot (Angry).”' },
        ],
      },
      {
        say: 'Final answer. Do you accept the name?',
        options: [
          { label: 'Yes', reply: 'Congratulations on Robot. Great name. The only name.' },
          { label: 'No', reply: 'We’ll name your next one. It will also be Robot.' },
        ],
      },
    ],
  },

  'notebook-ghostwriter': {
    title: 'Hire a notebook ghostwriter',
    item: 'notebook page',
    fields: [
      {
        key: 'text',
        type: 'text',
        label: 'What did you build this week?',
        placeholder: 'We moved a motor 2 inches',
        required: true,
        max: 120,
      },
      {
        key: 'tone',
        type: 'choice',
        label: 'Tone',
        options: [
          { label: 'Professional', note: 'The word “iteration” will appear 12 times.' },
          { label: 'Dramatic', note: '“And then… the motor moved.”' },
          { label: 'Spooky', note: 'It is a ghost, after all.' },
        ],
      },
      { key: 'pages', type: 'slider', label: 'Pages', min: 1, max: 40, marks: { 1: 'Honest', 40: 'Judges will notice' } },
      {
        key: 'diagrams',
        type: 'toggle',
        label: 'Hand-drawn diagrams',
        on: 'with diagrams (drawn by a ghost)',
        off: 'no diagrams (just vibes)',
      },
    ],
    cta: 'Write my notebook',
    confirm: '{pages} pages about “{text}”, {tone} tone, {diagrams}. In your handwriting. Somehow.',
    track: {
      review: ['The ghost is writing. You might feel a chill.', 'The ghost is practicing your handwriting. It’s getting creepy-good.'],
      replies: [
        'Page 47 is ready. It says “iteration” 12 times.',
        'Done. The ghost added a page about a design you never had. It’s good, though.',
        'Your notebook is ready. The judges will love it. One judge saw a ghost.',
      ],
    },
    chat: [
      {
        say: 'The ghost has a question. Did you actually do any testing?',
        options: [
          { label: 'Yes', reply: 'The ghost added a graph. The graph goes up.' },
          { label: 'Kind of', reply: 'The ghost made it sound like yes.' },
          { label: 'No', reply: 'The ghost will need more pages.' },
        ],
      },
      {
        say: 'Should the ghost sign it?',
        options: [
          { label: 'Sign my name', reply: 'Done. It looks better than your real signature.' },
          { label: 'Sign “The Ghost”', reply: 'The judges are going to have questions.' },
        ],
      },
    ],
  },

  'servo-whisperer': {
    title: 'Translate your servo',
    item: 'servo translation',
    fields: [
      { key: 'text', type: 'text', label: 'What is your servo doing?', placeholder: 'Jittering. Constantly.', required: true, max: 100 },
      {
        key: 'sound',
        type: 'choice',
        label: 'What it sounds like',
        options: [
          { label: 'Bzzzzz', note: 'It’s upset.' },
          { label: 'Click click click', note: 'It’s trying Morse code.' },
          { label: 'Nothing', note: 'The silent treatment. Very upset.' },
          { label: 'A tiny scream', note: 'That’s not good.' },
        ],
      },
      {
        key: 'position',
        type: 'choice',
        label: 'Position you set it to',
        options: [
          { label: '0.0', note: 'Reasonable.' },
          { label: '0.5', note: 'The servo is fine with this.' },
          { label: '1.0', note: 'The servo is nervous.' },
          { label: '1.2', note: 'The servo is screaming. That’s the sound.' },
        ],
      },
    ],
    cta: 'Translate it',
    confirm: 'Listening to your servo go “{sound}” at position {position}. The whisperer is concerned.',
    track: {
      review: ['The whisperer put an ear to it. It bit him.', 'The whisperer is listening very carefully. It’s mostly static.'],
      replies: [
        'Translation: “Please stop setting me to 1.2.”',
        'Translation: “I’m not jittering. I’m dancing.”',
        'Translation: “{sound}” means “I want a new home.”',
      ],
    },
    chat: [
      {
        say: 'Your servo would like to speak to you directly. Are you ready?',
        options: [
          { label: 'Yes', reply: 'It says: “Range is 0 to 1. Learn it.”' },
          { label: 'I’m scared', reply: 'It says: “You should be.”' },
        ],
      },
      {
        say: 'Anything to say back to it?',
        options: [
          { label: 'Sorry', reply: 'It’s jittering less. That’s a hug.' },
          { label: 'Work harder', reply: 'It stopped moving entirely. Bold choice.' },
          { label: 'I’ll set you to 1.2', reply: 'It made the tiny scream again.' },
        ],
      },
    ],
  },

  'lab-lost-found': {
    title: 'Bid at the Lab Lost & Found Auction',
    item: 'mystery hoodie',
    fields: [
      {
        key: 'lot',
        type: 'choice',
        label: 'Lot',
        options: [
          { label: 'Mystery hoodie', note: 'One of 14. All gray. All WD-40.' },
          { label: 'The shoe', note: 'Here since 2019. Nobody knows whose.' },
          { label: 'Single glove', note: 'The other one is in the robot.' },
          { label: 'Box of “miscellaneous”', note: 'It’s cables. It’s always cables.' },
        ],
      },
      { key: 'bid', type: 'slider', label: 'Your bid', min: 0, max: 100, unit: '¢', marks: { 0: 'Lowball', 100: 'Way too much' } },
      { key: 'wash', type: 'toggle', label: 'Wash it first', on: 'Washed (still smells like WD-40)', off: 'As is (strong choice)' },
    ],
    cta: 'Place a bid',
    confirm: 'You bid {bid} on the {lot}. {wash}. Going once…',
    track: {
      packed: ['Bagged. Then double-bagged. For everyone’s safety.'],
      twists: [
        { icon: '🔨', title: 'You were outbid', body: 'By the shoe’s original owner. Then they left. You win by default.' },
        { icon: '👃', title: 'Your package was flagged', body: 'The truck smells like WD-40 now. Kevin is fine with it.' },
      ],
      places: ['Left on the lab couch, right where it was found.', 'Returned to the lost and found. Someone bid on it again.'],
    },
    scene: {
      type: 'unbox',
      prompt: 'Open your winnings. Carefully.',
      taps: 4,
      inside: [
        'It’s a hoodie. It is not yours. It smells like WD-40.',
        'It’s the shoe. The shoe chose you.',
        'There’s a hex key in the pocket. Finally.',
        'It’s a team shirt from 2017. Size: XXXXL.',
      ],
    },
  },
};
