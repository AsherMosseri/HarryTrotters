import { TEAM_NAME } from '../config.js';
import { CloseIcon } from './common.jsx';

const QUICK_TIPS = [
  ['➕', 'Add a task', 'Tap + New task, or the + at the top of a column. Give it an owner and a due date.'],
  ['✋', 'Move it as you work', 'Press and hold a card, then drag it to another column. Or tap the card and change its status.'],
  [
    '🗂',
    'Use the tabs',
    'Chat: team and subteam channels. Milestones: big steps to the competition. Parts: what to buy. Checklists: competition prep. Match Log: practice scores. Robot: the 3D model. Team: who does what.',
  ],
  [
    '📱',
    'Add it to your Home Screen',
    'In Safari, tap Share → Add to Home Screen. It opens like an app. You’ll enter the team code once more there.',
  ],
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
      '#general is for everyone; each subteam has its own channel. A number on the Chat tab means unread messages (red means someone @mentioned you).',
      'Type @ to mention someone and # to link a task. Tap 📷 to send a photo.',
      'Tap (or hover over) a message to react, reply, edit or delete your own, or turn it into a task with +Task.',
      'There are no phone notifications yet, so check the Chat tab.',
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
    'Your account',
    [
      'You only enter the team code once per device.',
      'Switch (top right) signs this device out so someone else can use it. You’ll need the code again.',
      'The sun/moon button switches between light, dark, and automatic.',
      'When the site is updated, you’ll be asked to tap Update now.',
    ],
  ],
];

const MANAGER_TIPS = [
  'Team tab: Edit anyone’s role, subteams, responsibilities, and name. Add or remove people.',
  'Milestones tab: Change the competition date, and delete milestones.',
  'Delete checklists, and permanently delete tasks from Recently deleted.',
  'Chat: delete any message, and remove reactions (🚫☺ on a message).',
];

function TipList() {
  return (
    <ul className="tips">
      {QUICK_TIPS.map(([icon, title, text]) => (
        <li key={title}>
          <span className="tip-icon" aria-hidden="true">
            {icon}
          </span>
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
export function WelcomeCard({ name, onClose }) {
  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <div className="dialog welcome" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="welcome-title">
        <h2 id="welcome-title">Welcome, {name.split(' ')[0]}! 👋</h2>
        <p className="muted">Here’s how the {TEAM_NAME} task board works.</p>
        <TipList />
        <Rules />
        <p className="muted small">You can see these tips again anytime with the ? button at the top.</p>
        <button className="btn primary big-btn" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}

export function HelpDialog({ isManager, onClose }) {
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
        <TipList />
        <Rules />
        <div className="help-sections">
          {SECTIONS.map(([title, items]) => (
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
