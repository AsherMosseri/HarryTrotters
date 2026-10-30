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
      'Edit your own past shifts’ notes, subteam, and tasks. Team management fixes times.',
      'Lab check-in: when team management asks who’s going to the lab, the app asks you when you open it. Answer Yes or No for lunch and after school; change it later in the Shifts tab.',
      'Required polls work the same way: a poll in #announcements that everyone has to answer pops up until you vote (or write your answer).',
      'Drafts: anything you type and don’t send stays in that channel’s box until you come back. Return (Enter) sends; Shift+Return starts a new line.',
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
      'Type @ to mention someone, @Programming (or any subteam) to ping that subteam, # to link a task, and : for emoji (like :fire:).',
      'Tap Aa for text styles: bold, italic, bold italic, underline, strikethrough, big/medium/small headings, small gray text, quotes, lists, code, and ||spoilers|| (hidden until tapped). You can also type them: **bold**, *italic*, ***bold italic***, __underline__, ~~strike~~, # Big, ## Medium, ### Small, -# small text, > quote.',
      'Casino and coins: in #arcade, bet Jackson coins on /slots, /blackjack, /crash, /mines, /highlow, /roulette, /dice, /coinflip, or the Friday /lottery (one lottery card is open at a time; more tickets go on it). Anywhere: /daily, /work (only while you’re clocked in), /beg, /rob, /give, /balance, /leaderboard. The server rolls everything.',
      'Games in #arcade: challenge anyone (or @Trotbot) to /rps, /tictactoe, /connect4, or /duel, with an optional bet. Everyone can jump into /trivia, /hangman, /typerace, and /heist.',
      'Team commands, anywhere: /task Fix the intake @Cooper friday, /mytasks (check them off right in chat), /overdue, /shift (clock in or out; /shift who), /match 20 45 15 win #7 (saves to the Match Log), /standup.',
      'Type / for commands (Trotbot answers): /help lists them all. Try /8ball, /roll 2d6, /remind 2h charge batteries, /pet @someone, /whois @someone, or /afk lunch.',
      'The buttons by the message box add a photo, a GIF, a poll (choices, or a written answer everyone types; whoever made it, or team management, can end it and reopen it later), any file up to 25 MB (videos play right in the chat), team stickers, and emoji (on a phone these are under ＋). Pasting a picture or file works too. Links show a preview, and YouTube videos play in the chat.',
      'Tap (or hover over) a message to react (the burst button gives an animated super reaction), reply, pin it, edit or delete your own, or turn it into a task with +Task. Tapping a message also shows who reacted with what. The pin and search buttons at the top of a channel show its pinned messages and search it.',
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
      'Switch user (in your menu) signs this device out so someone else can use it. You’ll need the code again.',
      'Your menu (your name at the bottom of the sidebar, or your picture on a phone) picks light, dark, or automatic, and a color theme (Sunset, Ocean, Forest…) for this device.',
      'Custom… in that menu makes your own theme: any colors (even moving), a picture, GIF, or emoji pattern behind the app, and floating emoji or GIFs. Surprise me picks for you, and My profile matches your profile.',
      'Edit tabs in that menu: drag the tabs into your order. It follows you to every device; on a phone, your first four are the tab bar.',
      'Jackson coins: 15 for each task you were given that gets done (when someone else made it) and 5 an hour at the lab, up to 10 hours a day. Your balance, history, Send, and the leaderboard are in your menu.',
      'New friends showing up around the app? Their buttons take bookings, orders, and submissions. Want a spot of your own? Tap “Get your spot here” on one of them. Need a break? Look for the button that clears them away for a while.',
      'Orders & bookings (in your menu): what you ordered or booked from them, with tracking. Each one asks its own questions, and when it’s delivered or it’s time, you get a notification (quietly at night) and something to do: open it, play it, or answer back.',
      'When the site is updated, you’ll be asked to tap Update now.',
    ],
  ],
];

const MANAGER_TIPS = [
  'Roster: Edit anyone’s role, subteams, responsibilities, and name. Add or remove people.',
  'Milestones: Change the competition date, and delete milestones.',
  'Delete checklists, and permanently delete tasks from Recently deleted.',
  'Chat: post in #announcements (everyone gets a notification), use @everyone, delete any message, and remove reactions (the crossed-out face on a message).',
  'Channels: ＋ next to Channels adds one; ⋯ on a channel in the sidebar (⚙ in Chat on a phone) renames it, sets its topic and subteam color, moves it up or down, or deletes it.',
  'Team emoji: open the emoji picker and tap ＋ under Team emoji to add your own (:name:), or remove them. Stickers: open stickers and tap ＋.',
  'Lab log: ending your shift asks what you did (a note, the tasks you worked on, photos, blockers, and next time). It’s required, and it shows up in #lab-log, where Trotbot keeps one post per lab day with everyone’s logs and hours. Edit yours from that post. If a shift ends without a log (you forgot to clock out), the app asks the next time you open it.',
  'Shifts: Lab check-in asks everyone who’s going to the lab (lunch / after school). Lunch is split by middle and high school lunch using each person’s grade, which you set on the Roster (Edit). Repeat makes it ask by itself every weekday, or on the days you pick, at a set time. In #announcements, polls can be set so everyone has to answer.',
  'Shifts: Clock in… several people at once, End anyone’s shift, Plan a shift (once or weekly), set the season hours goal, add a missed shift, fix or delete any shift, and Export CSV.',
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
  Chat: 'chat',
  'Robot (3D)': 'robot',
};
const LINE_FEATURES = [
  [/^Casino and coins|^Games in #arcade|^Jackson coins/, 'coins'],
  [/^Lab check-in|Lab check-in asks/, 'checkins'],
  [/^Required polls/, 'requiredPolls'],
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
            {SECTIONS.filter(([title]) => (showRobot || title !== 'Robot (3D)') && controls.tabOn(SECTION_TABS[title])).map(
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
