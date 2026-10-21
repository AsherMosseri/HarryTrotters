// The version log, newest first. When you ship something, add a version at
// the top: open pages show its number and highlights in the "Update now"
// prompt, and everyone sees a "What's new" card once after updating.
// Plain JS (no imports) so vite.config.js can publish it in version.json.
export const CHANGELOG = [
  {
    version: '2.13',
    date: '2026-10-21',
    title: 'Reading clears notifications',
    items: [
      'Opening a channel or DM marks its notifications as read in the 🔔 and removes them from your iPad’s notification list.',
      'Same for tasks: opening a task clears the notifications about it.',
      'Looking at the board clears the “due tomorrow” reminder.',
    ],
  },
  {
    version: '2.12',
    date: '2026-10-21',
    title: 'Chat opens where you left off',
    items: [
      'Opening a channel or DM with unread messages starts at the red “New” line near the top, so you read down from where you left off (like Discord). With nothing new, it opens at the newest message.',
      'Fixed: switching channels used the previous channel’s “last read” time, so the jump and the “New” line landed in the wrong place.',
      'Jumping to a message (replies, pins, search) scrolls only the chat, never the screen around it.',
    ],
  },
  {
    version: '2.11',
    date: '2026-10-21',
    title: 'Header blur fix for iPad',
    items: [
      'Fixed: iPadOS 26 blurs the strip under the status bar in Home Screen apps unless the page gives it a solid color to use. The site now does (with an invisible strip at the top), so the header’s top row stays sharp.',
    ],
  },
  {
    version: '2.10',
    date: '2026-10-21',
    title: 'Typing test removed',
    items: ['The Troubleshooting → Typing test screen in Help is gone now that the Globe + E emoji fix is in (the fix stays).'],
  },
  {
    version: '2.9',
    date: '2026-10-21',
    title: 'Crisp header for good',
    items: [
      'Fixed: the top of the iPad app (logo, title, countdown) still looked blurry. The header is now a plain bar and only the area below it scrolls, so nothing passes under it or the status bar.',
    ],
  },
  {
    version: '2.8',
    date: '2026-10-21',
    title: 'Emoji from Globe + E work the first time',
    items: [
      'Fixed: on the iPad app, the first emoji picked with Globe + E didn’t appear in text boxes (chat, names, task titles, everywhere). The iPad sent it only as a key press; the site now types it in when that happens.',
    ],
  },
  {
    version: '2.7',
    date: '2026-10-21',
    title: 'Typing test',
    items: [
      'Help → Troubleshooting → Typing test: shows exactly what the iPad sends when you type, to track down why the first emoji from Globe + E doesn’t appear.',
    ],
  },
  {
    version: '2.6',
    date: '2026-10-21',
    title: 'One tap is enough on iPad',
    items: [
      'Fixed: switching chat channels on iPad took two taps (the first tap only revealed the ⚙ button).',
      'Same fix for other things that appeared on hover: message tools, the Table’s Open button, checklist ✕ buttons, and link-preview ✕.',
    ],
  },
  {
    version: '2.5',
    date: '2026-10-21',
    title: 'Version log',
    items: [
      'Every version now has a number, starting from the very first board (1.0).',
      'The “Update now” screen says which version is ready and what’s in it.',
      'After updating, a “What’s new” card lists the changes once.',
      'Full version log: every version and feature, from the Help (?) menu or the update screens.',
    ],
  },
  {
    version: '2.4',
    date: '2026-10-21',
    title: 'Pop-ups stay on screen on iPad',
    items: [
      'Fixed: on the iPad app, dialogs (like Edit on the Team tab) opened off the top of the screen when you were scrolled down.',
      'Fixed: the header now stays pinned at the top while you scroll.',
      'The app scrolls inside itself instead of scrolling the whole page, which Safari handles better.',
    ],
  },
  {
    version: '2.3',
    date: '2026-10-20',
    title: 'Nitro-style profiles and extras',
    items: [
      '***Bold italic*** works (it used to leave a stray asterisk), with a BI button on the Aa bar.',
      'GIF search shows every GIPHY rating (up to R), as team management chose.',
      'Animated profile pictures: GIFs stay animated everywhere (up to 4 MB).',
      'Profile banners: a picture (GIFs too) or a color.',
      'Pronouns and an “About me” on your profile card.',
      'Display-name style: fonts (Rounded, Serif, Mono, Script, Chunky) and a color or two-color gradient, shown in chat, the member list, and your card.',
      'Avatar decorations: Rainbow, Gold, Neon, Flames, Crown, Gear, Robot, Stars, Cat.',
      'Profile effects: Confetti, Sparkles, Snow, Hearts, Fire, Gears, Bubbles.',
      'Profile colors: a two-color gradient behind your profile card.',
      'Edit profile has Profile, Style, and Status tabs with a live preview.',
      'Super reactions (✨ on a message): animated reactions that burst.',
      'Team stickers (🎫): team management adds them; anyone sends them. GIF stickers stay animated.',
      'Files in chat (📎) up to 25 MB: PDFs, CAD files, code. Videos and audio play right in the chat.',
      'App color themes per device: Classic, Midnight, Sunset, Ocean, Forest, Cotton candy, Crimson, Chroma (sun/moon button).',
      'On iPad portrait and phones, the chat extras (photo, GIF, poll, file, sticker, emoji) live under the ＋ button.',
    ],
  },
  {
    version: '2.2',
    date: '2026-10-20',
    title: 'Sharper header and GIF search',
    items: [
      'Fixed: the header (logo and countdown) looked blurry in the iPad app; it’s now solid.',
      'GIF search is on, with the team’s GIPHY key: trending GIFs and search.',
    ],
  },
  {
    version: '2.1',
    date: '2026-10-20',
    title: 'Discord-style chat',
    items: [
      'Text styles: bold, italic, underline, strikethrough, big/medium/small headings, small gray text, quotes, lists, code, code blocks, and ||spoilers||, with an Aa formatting bar and ⌘B/⌘I/⌘U.',
      'Mentions: @people, @Programming (or any subteam), and @everyone (team management only).',
      ':emoji: shortcodes (type :fire), a searchable picker with every emoji, recent emoji, and team custom emoji (animated GIFs work).',
      'Polls (📊): one or several choices, live results, end a poll.',
      'Pins (📌) per channel and message search (🔍) by words and person.',
      'Link previews made by the server, and YouTube videos that play in the chat.',
      'Direct messages and group DMs. Team management can read DMs (the app says so) but can’t post in other people’s.',
      'Profile pictures (upload and crop), statuses like “🔧 At the shop”, and profile cards with role, subteams, responsibilities, and open tasks.',
      'Who’s online (green dots), a members panel, and “… is typing”.',
      'Team management can add, rename, reorder, and delete channels, with topics and subteam colors.',
      'Notification setting per channel: All messages, Only @mentions, or Nothing (muted).',
      '“New” line where you left off, tap a reply to jump to the original, paste pictures.',
      'Names colored by subteam, like Discord role colors.',
    ],
  },
  {
    version: '2.0',
    date: '2026-10-20',
    title: 'Announcements, GIFs, and notifications',
    items: [
      '📣 #announcements: everyone reads, only team management posts; the newest shows as a banner on the board.',
      'GIFs in chat: upload your own (up to 8 MB).',
      'The 🔔 bell: announcements, @mentions, tasks someone gave you, and a 7:30 AM “due tomorrow” reminder. Tap one to jump there.',
      'Phone notifications on iPhone, iPad, Android, and computers, even with the app closed (🔔 → Turn on).',
      'On iPhone and iPad the board runs as a Home Screen app, with step-by-step install instructions in Safari.',
      'The welcome card offers to turn on notifications.',
      'Behind the scenes: database rules and notification servers now publish automatically, without anyone pasting rules into Firebase.',
    ],
  },
  {
    version: '1.8',
    date: '2026-10-20',
    title: '3D Robot tab (preview)',
    items: [
      'Upload robot versions exported from Onshape (GLTF), checked for size first.',
      'Spin, zoom, and pan; preset views; a parts list from the CAD; hide, show, and isolate parts; exploded view.',
      '📍 Pins: notes on parts, linked to tasks and tracked parts, resolved when fixed.',
      '✋ Sandbox: move and rotate parts to try ideas and save layouts (never changes the real CAD).',
      '⇄ Compare two versions side by side: added, removed, and moved parts.',
      'In preview for Asher only for now.',
    ],
  },
  {
    version: '1.7',
    date: '2026-10-20',
    title: 'Team chat',
    items: [
      'Chat tab with #general and a channel for each subteam.',
      'Photos, reactions (any emoji), replies, @mentions, and # task links.',
      'Edit your messages (shows “edited”); delete leaves a placeholder.',
      '＋Task turns a message into a task.',
      'Unread counts per channel and on the Chat tab (red when you’re mentioned).',
      'Team management can delete any message and remove reactions.',
    ],
  },
  {
    version: '1.6',
    date: '2026-10-20',
    title: 'Welcome and Help',
    items: [
      'A one-time welcome card with quick tips and the team’s board rules.',
      'The ? button reopens the tips, with details for every tab and a team-management section.',
      'The demo link is gone from the join screen so nobody confuses it with the real board.',
    ],
  },
  {
    version: '1.5',
    date: '2026-10-20',
    title: 'Recently deleted and Match Log',
    items: [
      'Deleting a task moves it to Recently deleted, with Undo. Restore within 30 days; only team management deletes for good.',
      'Match Log tab: practice runs and matches with Auto, TeleOp, Endgame, penalties, drivers, and notes.',
      'Stats (recent average, best, average auto) and a points-per-run chart.',
      'A problem logged after a run can become a fix task.',
      'The tab row moves under the title on narrower screens.',
    ],
  },
  {
    version: '1.4',
    date: '2026-10-20',
    title: 'Task photos, updates, and renaming',
    items: [
      'Photos on tasks: take or pick photos, with thumbnails, a full-screen viewer, and a cover photo on board cards.',
      '“Update now” prompt when a new version is live, so nobody is stuck on an old one.',
      'Team management can rename people; their tasks, milestones, and org chart entry follow.',
      'Matthew’s last name fixed to Kuehl.',
      'Loading problems now say what failed instead of loading forever.',
      'A warning (with Clear filters) when a new task is hidden by your filters.',
    ],
  },
  {
    version: '1.3',
    date: '2026-10-20',
    title: 'Parts and checklists',
    items: [
      'Parts tab: Needed → Ordered → Arrived with vendor, quantity, cost, link, and the task it’s for; total spent.',
      'Checklists tab: shared lists for robot inspection, pit packing, and competition day.',
      'Checklists inside tasks, with progress on cards.',
      'App icon and Home Screen support.',
    ],
  },
  {
    version: '1.2',
    date: '2026-10-20',
    title: 'Team management accounts',
    items: [
      'Asher and Sebastian sign in with their own manager codes.',
      'Team management edits the org chart, adds and removes people, deletes milestones, and changes the competition date.',
      'Secretary gets its own box in the org chart, under Team Management.',
    ],
  },
  {
    version: '1.1',
    date: '2026-10-20',
    title: 'Milestones, org chart, and countdown',
    items: [
      'Milestones tab: a timeline to the Nov 14 competition with progress from linked tasks (on track, at risk, late, done).',
      'Team tab: org chart by subteam and everyone’s responsibilities and open tasks.',
      'Programming subteam; everyone’s full names on the roster.',
      'Days-to-go countdown in the header.',
      'Tap the title for a dancing cat 🐱.',
    ],
  },
  {
    version: '1.0',
    date: '2026-10-19',
    title: 'The task board',
    items: [
      'Replaces the Google Sheet task log.',
      'Board with drag-and-drop columns: Backlog, To Do, In Progress, Blocked / Waiting on Parts, Testing / Review, Done.',
      'Table view with sorting, inline editing, and quick add.',
      'Task details: assignees, subteam, priority, due date, blocker notes, links, comments, and a history of every change.',
      'Join by picking your name and entering the team code, once per device.',
      'Subteams: Team Management, CAD, Mechanical, Assembly, Electrical.',
      'Dark mode and works offline.',
    ],
  },
];

export const VERSION = CHANGELOG[0].version;

// Versions newer than `since` (all of them if `since` is unknown).
export function versionsSince(since) {
  const i = CHANGELOG.findIndex((v) => v.version === since);
  return i === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, i);
}
