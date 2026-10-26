import { useEffect, useState } from 'react';
import { REQUESTS_TO, TEAM_NAME } from '../config.js';
import { CHANGELOG, VERSION } from '../changelog.js';
import { CloseIcon, Overlay } from './common.jsx';
import { checkForUpdate } from './UpdateGate.jsx';
import { useEscape } from '../util.js';

const QUICK_TIPS = [
  ['+', 'Add a task', 'Tap + New task, or the + at the top of a column. Give it an owner and a due date.'],
  ['✋', 'Move it as you work', 'Press and hold a card, then drag it to another column. Or tap the card and change its status.'],
  [
    '🗂',
    'Use the tabs',
    'Chat: team and subteam channels. Shifts: clock in and out, the schedule, and hours. Milestones: big steps to the competition. Parts: what to buy. Checklists: competition prep. Match Log: practice scores. Robot: the 3D model. Team: who does what.',
  ],
  [
    '🔔',
    'Turn on notifications',
    'The bell shows announcements, @mentions, tasks given to you, and what’s due tomorrow. Tap 🔔 → Turn on to get them on this device even when the app is closed.',
  ],
  [
    '💡',
    'Have an idea for the app?',
    `Tap your name at the top right (Me on a phone) → Request a feature, type it, and tap Send idea. It goes straight to ${REQUESTS_TO.split(' ')[0]}.`,
  ],
  [
    '📱',
    'On a phone',
    'Use the tabs at the bottom (More has the rest). On the board, pick a status at the top, tap a task to open it, and tap ＋ to add one. Tap your picture for theme, help, and more.',
  ],
  ['🗑', 'Deleted something by mistake?', 'Tap Undo, or find it under Filters → Recently deleted for 30 days.'],
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
      'Add checklist steps, photos (📷 Add photos), links, and comments.',
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
      'Tap ⏱ at the top to start a shift. It shows a timer while you’re on shift; tap it to say what you’re working on, fix your start time (−15 min, −30 min, −1 h, or pick a time), or End shift now.',
      'Tapped it by mistake? Tap Undo, or Cancel shift in the first 15 minutes.',
      'Shifts tab: who’s at the lab now, the schedule (tap I’m in or Can’t), everyone’s hours, and the log of past shifts.',
      'You get a reminder after 4 hours on shift and an hour before a shift you said you’d come to. A shift left running past midnight ends at the last time you used the app (marked auto-ended).',
      'Edit your own past shifts’ notes, subteam, and tasks. Team management fixes times.',
      'Lab check-in: when team management asks who’s going to the lab, the app asks you when you open it. Answer Yes or No for lunch and after school; change it later in the Shifts tab.',
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
      '📣 #announcements is for news from team management; everyone can read it, only they can post. New announcements also show at the top of the board.',
      '#general is for everyone; each subteam has its own channel. A number means unread messages (red means someone @mentioned you, your subteam, or @everyone).',
      'Type @ to mention someone, @Programming (or any subteam) to ping that subteam, # to link a task, and : for emoji (like :fire:).',
      'Tap Aa for text styles: bold, italic, bold italic, underline, strikethrough, big/medium/small headings, small gray text, quotes, lists, code, and ||spoilers|| (hidden until tapped). You can also type them: **bold**, *italic*, ***bold italic***, __underline__, ~~strike~~, # Big, ## Medium, ### Small, -# small text, > quote.',
      'Tap 📷 for a photo, GIF for GIFs, 📊 for a poll, 📎 for any file up to 25 MB (videos play right in the chat), 🎫 for team stickers, and 😊 for every emoji (on a phone or iPad these are under ＋). Pasting a picture or file works too. Links show a preview, and YouTube videos play in the chat.',
      'Tap (or hover over) a message to react (✨ for an animated super reaction), reply, 📌 pin it, edit or delete your own, or turn it into a task with +Task. Tapping a message also shows who reacted with what. 📌 at the top shows the channel’s pinned messages; 🔍 searches messages.',
      'Resources: the team’s links (＋ Add link for CAD, code, and docs) and good FTC links. The ⚡ Electrical diagram shows what plugs in where; Electrical and team management can edit it.',
      '🔔 at the top of a channel: All messages, Only @mentions (the default), or Nothing. Announcements and DMs default to All.',
      'Direct messages: tap ＋ next to Direct messages (or Message on someone’s profile) to message one person or a group.',
      'Tap anyone’s name or picture for their profile. Tap your name (top right, or Me on a phone) → Edit profile for a picture (GIFs stay animated), a banner, pronouns, about me, your name’s font, colors, and effect (shimmer, neon, outline, 3D pop, glitch, rainbow), a nameplate behind your name in the members list and DMs, an avatar decoration (animated ones like comets, a flame ring, or electric; or a custom one: any ring, colors, and spin, plus stickers you place, size, rotate, and animate), a profile effect (aurora, warp speed, lightning, matrix, sakura, and more, or a custom one that rains, rises, or floats any emoji, GIF, or picture you pick), profile colors (2 or 3), borders around your profile card and your messages, and a status like “🔧 At the lab”. Tap View full profile for their activity, subteammates, when they joined, and a private note only you can see. Calm chat (in the theme menu) keeps animations in chat still until you hover or tap. A green dot means they have the app open; you’ll see when someone is typing.',
    ],
  ],
  [
    'Robot (3D)',
    [
      'The CAD team uploads each version from Onshape (Export → GLTF, Coarse or Medium detail).',
      'Spin with one finger, pinch to zoom, two fingers to pan. Tap a part to select it; the eye in the Parts list hides or shows it.',
      '📍 Pins: tap the robot to leave a note on a part, link it to a task or part, and resolve it when fixed.',
      '✋ Sandbox: move or rotate parts to try ideas and save the layout. It never changes the real CAD.',
      '⇄ Compare: two versions side by side. Green = added, red = removed, orange = moved.',
    ],
  ],
  ['Team', ['The org chart and everyone’s responsibilities and open tasks.']],
  [
    'Notifications',
    [
      'The 🔔 at the top lists announcements, @mentions, tasks someone gave you, and a 7:30 AM reminder of what’s due tomorrow. Tap one to go there.',
      'Phone notifications: tap 🔔 → Turn on, and allow them. Turn them on for each device you use.',
      'On iPad and iPhone the board opens only from the Home Screen app, which is what lets notifications work (iOS 16.4 or later). On a computer, it works in the browser.',
      'Turned them off by mistake? On iPad/iPhone: Settings → Notifications → 32313 Tasks.',
      'Switch user (in your menu at the top right) stops sending your notifications to that device.',
    ],
  ],
  [
    'Your account',
    [
      'You only enter the team code once per device.',
      'Switch user (in your menu at the top right) signs this device out so someone else can use it. You’ll need the code again.',
      'Your menu (tap your name at the top right) picks light, dark, or automatic, and a color theme (Sunset, Ocean, Forest…) for this device.',
      '🎨 Custom… in that menu makes your own theme: any colors (even moving), a picture, GIF, or emoji pattern behind the app, and floating emoji or GIFs. 🎲 Surprise me picks for you, and 🪞 My profile matches your profile.',
      '🗂 Edit tabs in that menu puts the tabs in your order. It follows you to every device; on a phone, your first four are the tab bar.',
      'When the site is updated, you’ll be asked to tap Update now.',
    ],
  ],
];

const MANAGER_TIPS = [
  'Team tab: Edit anyone’s role, subteams, responsibilities, and name. Add or remove people.',
  'Milestones tab: Change the competition date, and delete milestones.',
  'Delete checklists, and permanently delete tasks from Recently deleted.',
  'Chat: post in #announcements (everyone gets a notification), use @everyone, delete any message, and remove reactions (🚫☺ on a message).',
  'Channels: ＋ next to Channels adds one; ⚙ on a channel renames it, sets its topic and subteam color, moves it up or down, or deletes it.',
  'Team emoji: open 😊 and tap ＋ under Team emoji to add your own (:name:), or remove them. Stickers: open 🎫 and tap ＋.',
  'Shifts tab: 🧪 Lab check-in asks everyone who’s going to the lab (lunch / after school). Lunch is split by middle and high school lunch using each person’s grade, which you set on the Team tab (Edit).',
  'Shifts tab: Clock in… several people at once, End anyone’s shift, Plan a shift (once or weekly), set the season hours goal, add a missed shift, fix or delete any shift, and Export CSV.',
  'DMs: you can read every DM (under Team DMs) but can’t post in other people’s. You can change anyone’s profile picture and custom status from their profile (Edit profile → Status).',
];

function TipList({ showRobot }) {
  return (
    <ul className="tips">
      {QUICK_TIPS.map(([icon, title, text]) => (
        <li key={title}>
          <span className={`tip-icon${icon === '+' ? ' tip-plus' : ''}`} aria-hidden="true">
            {icon}
          </span>
          <div>
            <b>{title}</b>
            <p>{showRobot ? text : text.replace(' Robot: the 3D model.', '')}</p>
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
          <h2 id="welcome-title">Welcome, {name.split(' ')[0]}! 👋</h2>
          <p className="muted">Here’s how the {TEAM_NAME} task board works.</p>
          <TipList showRobot={showRobot} />
          <Rules />
          <p className="muted small">You can see these tips again anytime with Help in your menu at the top right.</p>
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
                {busy ? 'Turning on…' : '🔔 Turn on notifications'}
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
        {state === 'checking' ? 'Checking…' : '↻ Check for updates'}
      </button>
      <span className="muted small" role="status">
        {state?.status === 'latest' && `✓ You’re on the newest version (${state.release || VERSION}).`}
        {state?.status === 'new' && `Version ${state.release} is ready.`}
        {state?.status === 'offline' && 'Couldn’t check. Are you online?'}
      </span>
    </div>
  );
}

export function HelpDialog({ isManager, showRobot, onClose, onVersionLog, onRequests }) {
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
          <button className="version-chip idea-chip" onClick={onRequests}>
            <span>
              💡 <b>Request a feature</b> · ideas go straight to {REQUESTS_TO.split(' ')[0]}
            </span>
            <span className="link-btn">Send →</span>
          </button>
          <TipList showRobot={showRobot} />
          <Rules />
          <div className="help-sections">
            {SECTIONS.filter(([title]) => showRobot || title !== 'Robot (3D)').map(([title, items]) => (
              <details key={title}>
                <summary>{title}</summary>
                <ul>
                  {items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            ))}
            {isManager && (
              <details open>
                <summary>Team management only</summary>
                <ul>
                  {MANAGER_TIPS.map((t) => (
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
