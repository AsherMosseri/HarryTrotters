import { useEffect, useState } from 'react';
import { REQUESTS_TO, TEAM_NAME } from '../config.js';
import { useControls } from '../controls.js';
import { CHANGELOG, VERSION } from '../changelog.js';
import { CloseIcon, Overlay } from './common.jsx';
import { checkForUpdate } from './UpdateGate.jsx';
import { useEscape } from '../util.js';

const QUICK_TIPS = [
  ['Start on Today', 'The app opens on Today: your tasks, what’s due this week, who’s at the lab, and unread messages.'],
  ['Add a task', 'Tap New task (on Tasks or Today), or + at the top of a column. Give it an owner and a due date.'],
  ['Move it as you work', 'Press and hold a card, then drag it to another column. Or tap the card and change its status.'],
  [
    'Find your way around',
    'On an iPad or computer, every page is in the sidebar on the left, with the chat channels and your messages under them. On a phone, use the tabs at the bottom (More has the rest).',
  ],
  [
    'Turn on notifications',
    'The bell lists announcements, @mentions, tasks given to you, and what’s due tomorrow. Tap the bell, then Turn on, to get them on this device even when the app is closed.',
  ],
  [
    'Have an idea for the app?',
    `Open your menu (your name at the bottom of the sidebar, or your picture on a phone), then Request a feature. It goes straight to ${REQUESTS_TO.split(' ')[0]}.`,
  ],
  ['Deleted something by mistake?', 'Tap Undo, or find it under Filters → Recently deleted for 30 days.'],
];

const RULES = [
  'Every task has an owner and a due date.',
  'Move your card when its status changes.',
  'Stuck? Set it to Blocked and say why.',
  'Log every practice run in the Match Log.',
];

const SECTIONS = [
  [
    'Tasks',
    [
      'Tap a card to open it: change who, priority, subteam, due date, and milestone.',
      'Add checklist steps, photos, links, and comments.',
      'Everything you change is saved right away and shown in the task’s Activity.',
      'Filters (My tasks, person, subteam, priority, Hide done) are remembered on this device. If a task seems missing, tap Clear.',
    ],
  ],
  [
    'Milestones',
    [
      'The big steps to get the robot ready, on a timeline to the competition.',
      'Pick a milestone in a task’s details, and the milestone’s bar fills in as those tasks get done.',
      'Status: Not started, On track, At risk (tasks behind schedule), Late (past its end date), Done.',
    ],
  ],
  [
    'Parts',
    [
      'Track each part as Needed → Ordered → Arrived, with vendor, quantity, and cost.',
      'Link a part to the task waiting on it. The top shows what’s been spent.',
      'The #parts chat sits next to the list, for talking about orders. Open in Chat ↗ has search and pins.',
    ],
  ],
  [
    'Checklists',
    ['Shared lists for inspection, packing the pit, and competition day.', 'Tick items as you go. Everyone sees the same boxes.'],
  ],
  [
    'Shifts',
    [
      'Tap the clock next to the bell to start a shift. It shows a timer while you’re on shift; tap it to say what you’re working on, fix your start time (−15 min, −30 min, −1 h, or pick a time), or End shift now.',
      'Tapped it by mistake? Tap Undo, or Cancel shift in the first 15 minutes.',
      'Shifts tab: who’s at the lab now, the schedule (tap I’m in or Can’t), everyone’s hours, and the log of past shifts.',
      'You get a reminder after 4 hours on shift and an hour before a shift you said you’d come to. A shift left running past midnight ends at the last time you used the app (marked auto-ended).',
      'Edit your own past shifts: delete one, or make it shorter, and it saves right away. Making one longer, or adding a shift you forgot to clock, goes to team management to approve first (it shows “waiting for approval” until then). Every change is written down.',
      'Streaks: school days in a row with a shift (days without school never break it) and weeks in a row. They’re on your profile and the Shifts tab, next to the team’s season numbers.',
      'Lab check-in: when team management asks who’s going to the lab, the app asks you when you open it. Answer Yes or No for lunch and after school; change it later in the Shifts tab.',
      'Required polls work the same way: a poll in #announcements that everyone has to answer pops up until you vote (or write your answer).',
      'Drafts: anything you type and don’t send stays in that channel’s or DM’s box until you come back, and a small pencil next to its name in the channel list shows where one is waiting. Return (Enter) sends; Shift+Return starts a new line.',
    ],
  ],
  [
    'Lab log',
    [
      'Ending a shift asks what you did, mostly with taps: your areas (the only required step), the tasks you worked on and how each went. Finished can move a task to Done, and Stuck can mark it Blocked.',
      'Tasks you touched today are already picked. Add a short line (the chips suggest what the team writes most), a photo, a voice note (hold to talk) and who you worked with. Same as last time fills in your last log.',
      'Under 15 minutes at the lab? Tap Quick visit, nothing to log. Each lab day gets one card in #lab-log with everyone’s logs.',
    ],
  ],
  [
    'Competition',
    [
      'On competition day Today becomes the pit screen: our next match, alliance color, partners and a countdown.',
      'Before queueing: a checklist with a big countdown for the drive team. It starts from the match time (or by hand) and resets every match.',
      'After a match, tap in our score on the number pad; it goes straight into the Match Log.',
      'Guess the score: before a practice run or match, guess our total (in the Match Log or on the pit screen). The closest guess wins coins. Whoever logs the run can’t win it.',
    ],
  ],
  [
    'Scout',
    [
      'Scout has every team at the event. Team management pulls the teams and rankings from FTC Events (Pull teams and rankings, then Refresh rankings between matches); anyone can add a team by hand.',
      'Scout a match: pick the match and the team, tap 1 to 5 for Auto, TeleOp, Endgame, Reliability and Drive / defense, tap any tags that fit and add one line. Save and next clears the form and keeps the match. It saves even with bad Wi-Fi and reaches the server when you’re back online. You can fix or delete your own notes in a team’s page.',
      'A team’s page shows our averages, the tags that come up most, every note with who wrote it, and a team notes box for everyone.',
      'Pick list: team management drags teams into order (or uses the arrows), marks Don’t pick and Picked by others, and Suggest order sorts by our scores. At the table is the list in big type for alliance selection. Scouting pays no coins.',
    ],
  ],
  [
    'Learn',
    [
      'Ten games to learn the robot and the game: Name that part, Rules check, Strategy, Wiring puzzle, Spot the problem, Fix the bug, Gear ratios, the Auto path planner, and quizzes from the team’s own work.',
      'Every answer comes with an explanation (and the rule and page). Something wrong with a question? Tap Report a problem.',
      'The daily question is posted in #general at 7 AM on school days. Answer on the card; the first right answers get the most coins.',
      'Trotbot has five levels in Tetris and Minesweeper, from Beginner (slow and makes lots of mistakes) to Insane (near perfect and very fast). Pick one under Race Trotbot, or type /tetris bot insane or /minesweep bot beginner. Beating it pays 1, 1, 2, 4 or 6 coins by level (Minesweeper adds the board’s win coins), within the daily game limit.',
      'Just for fun: Tetris and Minesweeper, alone, against Trotbot, or racing a teammate. Battleship is in #arcade: /battleship @name, Classic rules (turn by turn) or add hitagain (a hit gets another turn). Tap Play on the card to play it big; anyone can Watch.',
    ],
  ],
  [
    'Market',
    [
      'Your coin balance is the gold pill at the top right of every screen. Tap it for your coins: history, sending, and the leaderboard.',
      'Spend Jackson coins on pet care, real perks, chat extras for a day, and tournament entries. Perks wait for team management to approve them; a decline gives your coins back.',
      'Pets: adopt one if you want. It grows with your lab time (never with coins), needs food and fun, and shows on your profile and next to your name. Don’t see the animal you want? Tap Request a pet under the adopt screen; it goes in the feature requests so others can 👍 it.',
      'Levels unlock things just for show: a title (Rookie up to Hall of Famer), gear to dress your pet in (tap Style), fur tints, and a bronze, silver or gold ring around its badge in chat. Level path in the Pets shelf lists them all.',
      'At level 10 a pet can have one baby (Meet the baby): a new pet that grows from your lab time since it was born. You can hold two pets. To give one to a teammate, tap Give to a teammate; they can accept or say no thanks within a week, and a pet that moves starts over at level 1 with its new owner.',
      'Pet park (top of the Pets shelf, and a card on Today): everyone’s pets in one scene. Tap one to see its owner, level, title and what it wears.',
      'Team events: for a few days the whole team’s lab time fills a meter, with tiers along the bar. Hours come from real shifts only (each day counts up to 10 hours, like coins). When a tier is reached, everyone with at least 1 hour of their own lab time in those days gets the reward: limited pet gear (like the Pit crew cap or the Nov 14 medal) that any pet can wear at any level, and a notification. Dress up in it from Style. Team management makes, edits and ends events at the bottom of the Pets shelf. Nothing here costs or pays coins.',
      'Photo of your real pet: in Market, Pets, tap Add a photo of your real pet (under your pet, or under Your real pet if you don’t have one in the app). Pick a photo and the app cuts your pet out of the background on your own device (the first time it gets a cut-out tool, about 47 MB, and keeps it; Wi-Fi is best). Erase or paint back anything it got wrong, see how it looks, and send it. The original photo never leaves your device. Team management approves it first (you see Waiting for team management, or why it was declined), then it shows as a little sticker beside your pet on your pet card, your profile and in the pet park (tap your pet there to see its name). No pet in the app? It shows on your profile. It never replaces the drawn pet. If the cut-out tool can’t run (offline, or an old device), you can crop the picture yourself instead. Up to 3 photos a day; Change photo and Remove photo are under your pet.',
      'Tournaments: pay the entry and play in the app; the best Tetris or Minesweeper score wins the pot. Every score is checked by the server, and runs that look too fast wait for team management.',
    ],
  ],
  [
    'Loans',
    [
      `Loans: borrow Jackson coins from the bank or from a teammate. Open your coins (the gold pill at the top right), then Loans, and tap Ask the bank or Ask a teammate. Say how many coins, the interest and when you’ll pay it back (1, 2 or 4 weeks). ${REQUESTS_TO.split(' ')[0]} answers for the bank; its coins are made up, not his. A teammate lends their own coins.`,
      'Loans: interest is Standard (the bank’s rate, or 10% once from a teammate), Once (100 at 10% means you pay back 110) or Per week (5% a week for every week started until you pay it back; pay early and you pay less). Up to 50%, rounded up to whole coins.',
      'Loans: whoever you asked can say yes, say no, or counter with a different amount, interest or length. You can take a counter, say no, or counter back. Every step is in the loan’s History. You get a notification for each answer.',
      'Loans: pay back any amount any time with Pay, or Pay all. You get a reminder 2 days before it’s due. On the due date, whatever is left is taken from your coins, even if that puts you below zero.',
      `Loans: below zero after a due date, you’re locked until you’re back to 0: no betting, no Market, no sending coins, no lending and no new loans. Coins you earn still count and get you there. The lender (${REQUESTS_TO.split(' ')[0]} for the bank) can forgive the loan or give more time.`,
      'Loans: by default, one bank loan at a time (any amount) and two from teammates. Nobody lends while paying back a loan of their own, and two people can only have one loan between them at a time.',
      'Loans from chat: /loan opens Loans, /loan bank 100 for parts or /loan @Cooper 50 opens the form with that filled in (add 10%, once or weekly, and 1w, 2w or 4w for the terms), and /loan pay opens My loans. Nothing is sent until you check the form and tap Send request.',
    ],
  ],
  [
    'Match Log',
    [
      'After each practice run or match, log Auto, TeleOp, and Endgame points.',
      'Write what went wrong. It can create a fix task for you.',
      'The chart shows whether scores are going up.',
    ],
  ],
  [
    'Chat',
    [
      '#announcements is for news from team management; everyone can read it, only they can post. New announcements also show at the top of the board.',
      '#general is for everyone; each subteam has its own channel. A number means unread messages (red means someone @mentioned you, your subteam, or @everyone).',
      'Want your own channel? Tap ＋ next to Channels (on a phone, Channel at the top of Chat), pick a name, say what it’s for, and choose Everyone or Private (only the people you invite). Team management reviews every request and you get a notification when it’s approved or not. You can have 3 waiting at once and send 5 a day. A private channel shows with a lock, and only its people (and team management) can read it.',
      'Type @ to mention someone, @Programming (or any subteam) to ping that subteam, # to link a task, and : for emoji (like :fire:).',
      'Polls: pick Choices (your own options), People (everyone, a subteam, or people you choose, like “Who should drive?”), or a written answer. Under “How many can people pick?” choose Just one, or Several: Up to a number, Exactly a number (a vote only counts once someone picks that many), or any number. With several, tap your picks, then press Vote; Change vote lets you redo it until the poll ends. You can turn off “People can vote for themselves”. The top choice (or top few, for “pick 3”) is highlighted, with ties shown as ties.',
      'Tap Aa for text styles: bold, italic, bold italic, underline, strikethrough, big/medium/small headings, small gray text, quotes, lists, code, and ||spoilers|| (hidden until tapped). You can also type them: **bold**, *italic*, ***bold italic***, __underline__, ~~strike~~, # Big, ## Medium, ### Small, -# small text, > quote.',
      'Casino and coins: in #arcade, bet Jackson coins on /slots, /blackjack, /crash, /mines, /highlow, /roulette, /dice, /coinflip, or the Friday /lottery (one lottery card is open at a time; more tickets go on it). Anywhere: /daily (5 coins, plus 1 for each day in a row, up to 15), /work (only while you’re clocked in), /beg, /rob, /give, /balance, /leaderboard. The server rolls everything.',
      'Amounts can be written 2k, 1.5m or 200,000, in bets, /give, /request and /loan: /slots 1.5k is a 1500 bet. They have to come out to whole coins, and the usual limits still apply.',
      'Challenge a teammate to the same coin flip or dice roll: tap Challenge someone on your /coinflip or /dice result (or type /challenge @name coinflip 20, or dice). Your bet is held right away; they have 10 minutes to Accept or Decline, and you can Cancel. When they accept, the server rolls both and the winner takes both bets (a tie gives them back). Up to 500 coins, one challenge waiting at a time, 10 a day.',
      'Ask for something with /request. /request dark mode for the robot tab sends a feature request (with a card in chat everyone can 👍). /request channel build-log, /request pet axolotl and /request style lightning name effect open those request forms with it filled in, and /request on its own opens a picker. /request @Cooper 25 for pizza asks a teammate for Jackson coins: only they see Pay and Decline, and you can Cancel. Paying moves the coins like /give (the same limits, and it shows in both coin histories with the reason). A request closes after 24 hours; you can have 3 waiting at once (one per person) and make 20 a day. /request @Programming 5 for pizza (or @everyone) asks each person in the group for 5: one card shows who paid, each person pays or declines their own, and Cancel closes the rest. A group counts as one of your 3 and one of your 20, and anyone already waiting on one from you is skipped. Only team management’s @everyone buzzes phones; anyone else’s lands quietly in each inbox.',
      `Something look wrong on a casino result? Tap the flag (Report) on it, say what looks wrong, and only ${REQUESTS_TO.split(' ')[0]} sees it. ${REQUESTS_TO.split(' ')[0]} can refund your bet or keep the result, and you get a notification. Your reports and what happened to them are under Jackson coins, Reports. One report per result; nothing is refunded automatically.`,
      'Games in #arcade: challenge anyone (or @Trotbot) to /rps, /tictactoe, /connect4, or /duel, with an optional bet. Everyone can jump into /trivia, /hangman, /typerace, and /heist. Game prizes and /daily share one limit: 20 coins a day.',
      'Team commands, anywhere: /task Fix the intake @Cooper friday, /mytasks (check them off right in chat), /overdue, /shift (clock in or out; /shift who), /match 20 45 15 win #7 (saves to the Match Log), /standup.',
      'Type / for commands (Trotbot answers): /help lists them all. Try /8ball, /roll 2d6, /remind 2h charge batteries, /pet @someone, /whois @someone, or /afk lunch.',
      'Some commands take a group instead of one person: /give @Programming 10 gives 10 to each person in Programming (you need enough for all of them), /highfive @CAD, /hype @everyone, and /hours, /tasks, /streak or /whois @Mechanical for a row per person. Anyone can use a subteam or @everyone in these. Games, bets and /rob are one person at a time.',
      'The buttons by the message box add a photo, a GIF, a poll (choices, people, or a written answer everyone types; whoever made it, or team management, can end it and reopen it later), any file up to 25 MB (videos play right in the chat), team stickers, and emoji (on a phone these are under ＋). Pasting a picture or file works too. Links show a preview, and YouTube videos play in the chat.',
      'Tap (or hover over) a message to react (the burst button gives an animated super reaction), reply, pin it, edit or delete your own, or turn it into a task with +Task. Tapping a message also shows who reacted with what. The pin and search buttons at the top of a channel show its pinned messages and search it.',
      'Pins: tap a message, then Pin, to keep it at the top of the channel. Pinned messages show in a bar under the channel name: tap it to jump to the message (tap again for the next one), or See all. Anyone who can post in the channel can pin and unpin.',
      'Resources: the team’s links (＋ Add link for CAD, code, and docs) and good FTC links. The Electrical diagram shows what plugs in where; Electrical and team management can edit it.',
      'The bell at the top of a channel: All messages, Only @mentions (the default), or Nothing. Announcements and DMs default to All.',
      'Direct messages: tap ＋ next to Messages in the sidebar (Direct messages in Chat on a phone), or Message on someone’s profile, to message one person or a group.',
      'Tap anyone’s name or picture for their profile. Open your menu → Edit profile for a picture (GIFs stay animated), a banner, pronouns, about me, your name’s font, colors, and effect (shimmer, neon, outline, 3D pop, glitch, rainbow), a nameplate behind your name in the members list and DMs, an avatar decoration (animated ones like comets, a flame ring, or electric; or a custom one: any ring, colors, and spin, plus stickers you place, size, rotate, and animate), a profile effect (aurora, warp speed, lightning, matrix, sakura, and more, or a custom one that rains, rises, or floats any emoji, GIF, or picture you pick), profile colors (2 or 3), borders around your profile card and your messages, and a status like “🔧 At the lab”. Tap View full profile for their activity, subteammates, when they joined, and a private note only you can see. Calm chat (in the theme menu) keeps animations in chat still until you hover or tap. A green dot means they have the app open; you’ll see when someone is typing.',
    ],
  ],
  [
    'Robot (3D)',
    [
      'The CAD team uploads each version from Onshape (Export → GLTF, Coarse or Medium detail).',
      'Spin with one finger, pinch to zoom, two fingers to pan. Tap a part to select it; the eye in the Parts list hides or shows it.',
      'Pins: tap the robot to leave a note on a part, link it to a task or part, and resolve it when fixed.',
      'Sandbox: move or rotate parts to try ideas and save the layout. It never changes the real CAD.',
      'Compare: two versions side by side. Green = added, red = removed, orange = moved.',
    ],
  ],
  ['Team', ['The org chart and everyone’s responsibilities and open tasks.']],
  [
    'Notifications',
    [
      'The bell lists announcements, @mentions, tasks someone gave you, and a 7:30 AM reminder of what’s due tomorrow. Tap one to go there.',
      'Phone notifications: tap the bell, then Turn on, and allow them. Turn them on for each device you use.',
      'On iPad and iPhone the board opens only from the Home Screen app, which is what lets notifications work (iOS 16.4 or later). On a computer, it works in the browser.',
      'Turned them off by mistake? On iPad/iPhone: Settings → Notifications → 32313 Tasks.',
      'Switch user (in your menu) stops sending your notifications to that device.',
    ],
  ],
  [
    'Your account',
    [
      'Sign in with your name and your own password; each device stays signed in. Change it from your menu → Change password. Forgot it? Ask Asher to reset it.',
      'Switch user (in your menu) signs this device out so someone else can use it. Signing back in needs your password.',
      'New to the team? After you set up your name, team management lets you in; the app opens by itself as soon as they do.',
      'Appearance (in your menu: your name at the bottom of the sidebar, or your picture on a phone) picks light, dark, or automatic, a color theme, Calm chat, Animations, and Coin numbers (1,234, 1234, or 1.2k) for this device.',
      'Custom… in Appearance makes your own theme: any colors (even moving), a picture, GIF, or emoji pattern behind the app, and floating emoji or GIFs. Surprise me picks for you, and My profile matches your profile.',
      'Edit tabs (in your menu on a phone): drag the tabs into your order. It follows you to every device; on a phone, your first four are the tab bar.',
      'Jackson coins: 15 for each task you were given that gets done (when someone else made it; up to 5 tasks a day) and 4 an hour at the lab (1 for every full 15 minutes, added up per day; time before 3.0 earned 5 an hour), up to 10 hours a day. Games, trivia, and /daily pay up to 20 a day together, plus lab bingo, streak milestones, and the daily question. Your balance, history, Send, and the leaderboard are in your menu; spend them in the Market. If a number ever looks wrong, open Compare with the server at the bottom of History: it shows what the server counts next to what this app shows, and says where they differ.',
      'New friends showing up around the app? Their buttons take bookings, orders, and submissions. Want a spot of your own? Tap “Get your spot here” on one of them. Need a break? Look for the button that clears them away for a while.',
      'Orders & bookings (in your menu): what you ordered or booked from them, with tracking. Each one asks its own questions, and when it’s delivered or it’s time, you get a notification (quietly at night) and something to do: open it, play it, or answer back.',
      'When the site is updated, you’ll be asked to tap Update now.',
    ],
  ],
];

const MANAGER_TIPS = [
  `Bank loans: only ${REQUESTS_TO.split(' ')[0]} answers bank loan requests (Today and his menu show what’s waiting; Approve, Counter or Say no), and can forgive or extend any bank loan. Controls, Loans sets the bank: on or off, the most in one loan, loans at a time, its standard rate and the lengths it allows.`,
  `Refund or take back a game (${REQUESTS_TO.split(' ')[0]} only): every finished casino or arcade card with coins on it has Refund (a loss) and Take back (a win) for each player. It moves exactly what the card shows, once, even if they also reported it, and the card then says “Refunded by ${REQUESTS_TO.split(' ')[0]}” for everyone. Reversing a game’s line in someone’s coin history does the same.`,
  `Refund all casino reports (${REQUESTS_TO.split(' ')[0]} only): in Casino reports, Waiting, pick Everyone or one person and tap Refund all. Each report is checked like its own Refund button; any that can’t be refunded stay waiting and are listed.`,
  'Everyone’s coins: in the Coins screen, the Everyone tab lists each person’s balance, earned coins and casino net (search by name). Tap someone for their whole history with the balance after each entry, filters (Earned, Spent, Casino, Gifts, Prizes, Market), a total, and Compare with the server for that person.',
  'Roster: Edit anyone’s role, subteams, responsibilities, and name. Add or remove people. Removing someone signs them out everywhere and deletes their password; their messages, tasks, shifts and coins stay. Someone new (or removed) who signs in waits at the top under Waiting to join until you tap Approve (or Turn away).',
  'Market: add perks (or pick from the ideas), approve or decline purchases, and start tournaments. In a tournament’s results you can void anyone’s result, and Clear or Void runs that need a check.',
  'Competition mode (on Today): turn it on for an event or scrimmage, pick the event and drive team, and type in the match schedule or pull it from FTC Events.',
  'Weekly recap: Trotbot posts it in #general on Sundays at 6 PM. Preview it on Today, post it early, or skip a week. Questions people report are listed on Learn for you to check.',
  'Milestones: Change the competition date, and delete milestones.',
  'Delete checklists, and permanently delete tasks from Recently deleted.',
  'Chat: post in #announcements (everyone gets a notification), use @everyone, delete any message, and remove reactions (the crossed-out face on a message).',
  'Channels: ＋ next to Channels adds one; ⋯ on a channel in the sidebar (⚙ in Chat on a phone) renames it, sets its topic and subteam color, moves it up or down, or deletes it.',
  'Channel requests: when a teammate asks for a channel, a line shows on Today and a number shows on the ＋ next to Channels. Open it to Approve with one tap, Edit (rename it or change who’s invited) then approve, or Decline with a short note. Approving makes the channel, adds the invited people to a private one, posts the first message, and tells the person. Private channels you aren’t in are under Team messages (you can read them, not post). Asher can switch this off in Controls.',
  'Team emoji: open the emoji picker and tap ＋ under Team emoji to add your own (:name:), or remove them. Stickers: open stickers and tap ＋.',
  'Lab log: ending your shift asks what you did, mostly with taps: the areas you worked in (required), which tasks, how each went (Finished can move it to Done, Stuck can mark it Blocked), then an optional line with suggestion chips, a photo, a voice note (hold to talk, up to 30 seconds) and who you worked with. Done is always at the bottom, and Same as last time fills in your previous log. A visit under 15 minutes just ends with “Quick visit, nothing to log”. It’s required, and #lab-log has one Trotbot card per lab day that fills in as people log. Edit yours from that card. If a shift ends without a log (you forgot to clock out), the app asks the next time you open it.',
  'Shifts: Lab check-in asks everyone who’s going to the lab (lunch / after school). Lunch is split by middle and high school lunch using each person’s grade, which you set on the Roster (Edit). Repeat makes it ask by itself every school day (at 12:00 AM unless you change it), every weekday, or on the days you pick. Tap upcoming days to skip them, or use Not today / Not tomorrow on the Shifts tab (each with Undo). In #announcements, polls can be set so everyone has to answer.',
  'Shifts: Clock in… several people at once, End anyone’s shift, Plan a shift (once or weekly), set the season hours goal, add a missed shift, fix or delete any shift, approve or decline people’s requests for longer or missed shifts, see every shift change, and Export CSV.',
  'DMs: you can read every DM (under Team messages in the sidebar, or Team DMs on a phone) but can’t post in other people’s. You can change anyone’s profile picture and custom status from their profile (Edit profile → Status).',
];

function TipList() {
  return (
    <ul className="tips">
      {QUICK_TIPS.map(([title, text]) => (
        <li key={title}>
          <div>
            <b>{title}</b>
            <p>{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Rules() {
  return (
    <div className="rules">
      <h3>How we use the board</h3>
      <ol>
        {RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </div>
  );
}

// Shown once per device after joining.
export function WelcomeCard({ name, showRobot, pushStatus, onEnablePush, onClose }) {
  useEscape(onClose);
  const [busy, setBusy] = useState(false);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog welcome" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="welcome-title">
          <h2 id="welcome-title">Welcome, {name.split(' ')[0]}</h2>
          <p className="muted">Here’s how the {TEAM_NAME} task board works.</p>
          <TipList />
          <Rules />
          <p className="muted small">You can see these tips again anytime with Help in your menu.</p>
          {pushStatus === 'off' ? (
            <>
              <button
                className="btn primary big-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onEnablePush();
                  onClose();
                }}
              >
                {busy ? 'Turning on…' : 'Turn on notifications'}
              </button>
              <button className="link-btn" onClick={onClose}>
                Not now
              </button>
            </>
          ) : (
            <button className="btn primary big-btn" onClick={onClose} autoFocus>
              Got it
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// Asks the site for the newest version now. A newer one opens the update screen.
export function UpdateCheck() {
  const [state, setState] = useState(null); // null | 'checking' | result
  const run = async () => {
    setState('checking');
    setState(await checkForUpdate());
  };
  return (
    <div className="update-check">
      <button className="btn" onClick={run} disabled={state === 'checking'}>
        {state === 'checking' ? 'Checking…' : 'Check for updates'}
      </button>
      <span className="muted small" role="status">
        {state?.status === 'latest' && `You’re on the newest version (${state.release || VERSION}).`}
        {state?.status === 'new' && `Version ${state.release} is ready.`}
        {state?.status === 'offline' && 'Couldn’t check. Are you online?'}
      </span>
    </div>
  );
}

// Help about something switched off (Controls) is hidden with it: whole
// sections for tabs, single lines for features.
const SECTION_TABS = {
  Parts: 'parts',
  Checklists: 'checklists',
  Shifts: 'shifts',
  'Match Log': 'runs',
  Scout: 'scout',
  Chat: 'chat',
  'Robot (3D)': 'robot',
};
const LINE_FEATURES = [
  [/^Casino and coins|^Games in #arcade|^Jackson coins|^Spend Jackson coins|^Pets:|^Tournaments:|^Guess the score|^Market:|^Loans:|^Bank loans:/, 'coins'],
  [/^Lab check-in|Lab check-in asks/, 'checkins'],
  [/^Required polls/, 'requiredPolls'],
  [/^Polls:/, 'polls'],
  [/^Tap Aa/, 'formatting'],
  [/^Direct messages|^DMs:/, 'dms'],
  [/^New friends showing up|^Orders & bookings/, 'ads'],
  [/^Custom… in that menu/, 'themes'],
  [/^Team emoji:/, 'teamEmoji'],
];
const helpShows = (line, controls) => LINE_FEATURES.every(([re, id]) => !re.test(line) || controls.isOn(id));

export function HelpDialog({ isManager, showRobot, onClose, onVersionLog, onRequests }) {
  const controls = useControls();
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog help" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="help-title">
          <div className="panel-head">
            <h2 id="help-title">Help</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <button className="version-chip" onClick={onVersionLog}>
            <span>
              Version <b>{VERSION}</b> · {CHANGELOG[0].title}
            </span>
            <span className="link-btn">Version log →</span>
          </button>
          <UpdateCheck />
          {controls.isOn('requests') && (
            <button className="version-chip idea-chip" onClick={onRequests}>
              <span>
                <b>Request a feature</b> · ideas go straight to {REQUESTS_TO.split(' ')[0]}
              </span>
              <span className="link-btn">Send →</span>
            </button>
          )}
          <TipList />
          <Rules />
          <div className="help-sections">
            {SECTIONS.filter(
              ([title, items]) =>
                (showRobot || title !== 'Robot (3D)') && controls.tabOn(SECTION_TABS[title]) && items.some((t) => helpShows(t, controls)),
            ).map(
              ([title, items]) => (
                <details key={title}>
                  <summary>{title}</summary>
                  <ul>
                    {items
                      .filter((t) => helpShows(t, controls))
                      .map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                  </ul>
                </details>
              ),
            )}
            {isManager && (
              <details open>
                <summary>Team management only</summary>
                <ul>
                  {MANAGER_TIPS.filter((t) => helpShows(t, controls)).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
