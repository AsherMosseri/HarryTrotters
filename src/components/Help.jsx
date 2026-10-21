import { useState } from 'react';
import { REQUESTS_TO, TEAM_NAME } from '../config.js';
import { CHANGELOG, VERSION } from '../changelog.js';
import { CloseIcon } from './common.jsx';
import { checkForUpdate } from './UpdateGate.jsx';

const QUICK_TIPS = [
  ['➕', 'Add a task', 'Tap + New task, or the + at the top of a column. Give it an owner and a due date.'],
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
  ['💡', 'Have an idea for the app?', `Tap 💡 at the top, type it, and tap Send idea. It goes straight to ${REQUESTS_TO.split(' ')[0]}.`],
  ['🗑', 'Deleted something by mistake?', 'Tap Undo, or find it under Recently deleted in the filter row for 30 days.'],
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
      'Shifts tab: who’s at the shop now, the schedule (tap I’m in or Can’t), everyone’s hours, and the log of past shifts.',
      'You get a reminder after 4 hours on shift and an hour before a shift you said you’d come to. A shift left running past midnight ends at the last time you used the app (marked auto-ended).',
      'Edit your own past shifts’ notes, subteam, and tasks. Team management fixes times.',
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
      'Tap (or hover over) a message to react (✨ for an animated super reaction), reply, 📌 pin it, edit or delete your own, or turn it into a task with +Task. 📌 at the top shows the channel’s pinned messages; 🔍 searches messages.',
      '🔔 at the top of a channel: All messages, Only @mentions (the default), or Nothing. Announcements and DMs default to All.',
      'Direct messages: tap ＋ next to Direct messages (or Message on someone’s profile) to message one person or a group.',
      'Tap anyone’s name or picture for their profile. Tap your own picture (top right) → Edit profile for a picture (GIFs stay animated), a banner, pronouns, about me, your name’s font and colors, an avatar decoration, a profile effect (or a custom one that rains, rises, or floats any emoji, GIF, or picture you pick), profile colors, and a status like “🔧 At the shop”. A green dot means they have the app open; you’ll see when someone is typing.',
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
      'Switch (top right) stops sending your notifications to that device.',
    ],
  ],
  [
    'Your account',
    [
      'You only enter the team code once per device.',
      'Switch (top right) signs this device out so someone else can use it. You’ll need the code again.',
      'The sun/moon button picks light, dark, or automatic, and a color theme (Sunset, Ocean, Forest…) for this device.',
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
  'Shifts tab: Clock in… several people at once, End anyone’s shift, Plan a shift (once or weekly), set the season hours goal, add a missed shift, fix or delete any shift, and Export CSV.',
  'DMs: you can read every DM (under Team DMs) but can’t post in other people’s. You can change anyone’s profile picture from their profile.',
];

function TipList({ showRobot }) {
  return (
    <ul className="tips">
      {QUICK_TIPS.map(([icon, title, text]) => (
        <li key={title}>
          <span className="tip-icon" aria-hidden="true">
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
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog welcome" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="welcome-title">
        <h2 id="welcome-title">Welcome, {name.split(' ')[0]}! 👋</h2>
        <p className="muted">Here’s how the {TEAM_NAME} task board works.</p>
        <TipList showRobot={showRobot} />
        <Rules />
        <p className="muted small">You can see these tips again anytime with the ? button at the top.</p>
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
  );
}

// Asks the site for the newest version now. A newer one opens the update screen.
function UpdateCheck() {
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
  return (
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
  );
}
