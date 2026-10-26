// The version log, newest first. When you ship something, add a version at
// the top: open pages show its number and highlights in the "Update now"
// prompt, and everyone sees a "What's new" card once after updating.
// Plain JS (no imports) so vite.config.js can publish it in version.json.
export const CHANGELOG = [
  {
    version: '2.43',
    date: '2026-10-26',
    title: 'Smoother diagram zoom',
    items: [
      'Pinching to zoom in the electrical diagram stays on the spot you pinched instead of sliding around. On a trackpad, scroll to move around and pinch to zoom.',
      'Cat ears and bunny ears stay level when they move.',
    ],
  },
  {
    version: '2.42',
    date: '2026-10-26',
    title: 'Full profiles, and lots more style',
    items: [
      'Full profiles: tap “View full profile” on anyone’s card for a big profile with About, Activity (hours, what they’re working on, what they finished), and Team (their subteammates).',
      'Profiles show when someone joined, when they were last on, and if they’re at the lab right now. You can keep a private note on anyone’s profile that only you can see.',
      'Decorations that break out of the circle: Cat ears, Bunny ears, Wizard hat, Horns, Headphones, Antenna, and Wings.',
      '13 new name fonts (Pixel, Arcade, Comic, Marker, Handwritten, Retro script, Sci-fi, Bubbly, Poster, Fancy, Typewriter, Neon sign, Gothic) and 6 new name effects (Fire, Ice, Gold, Toon, Glitter, Pulse).',
      'Calm chat (theme menu, on by default): animated pictures, names, and decorations in chat play when you hover or tap. Turn it off to have them play all the time.',
      'Want a font, effect, or decoration we don’t have? Edit profile → Style → “Want something new?” (or “Want another?” under any section).',
    ],
  },
  {
    version: '2.41',
    date: '2026-10-26',
    title: 'Pop-ups fixed for good on iPhone and iPad',
    items: [
      'Every pop-up (What’s new, Edit profile, Help, ideas, task details, and the rest) now opens over the whole screen instead of inside the scrolling page, so it no longer ends up under the top bar, cut off, or bouncing back when you scroll.',
    ],
  },
  {
    version: '2.40',
    date: '2026-10-26',
    title: 'Profiles, Nitro-style',
    items: [
      'A new profile card: your profile colors fill the whole card, your picture sits in a cutout in the banner with your status in a bubble beside it, and badges show your subteams.',
      'All-new animated profile effects that open with a burst and keep going: Aurora, Fireflies, Warp speed, Sakura, Lightning, Matrix, Synthwave, Circuit, and remade Sparkles, Snow globe, Hearts, Embers, Blueprint, Bubbles, and Confetti cannon. The picker shows each one moving.',
      'Animated avatar decorations: Comets, Flame ring, Electric, Halo, Ripple, Petals, and Circuit.',
      'Name effects: Shimmer, Neon, Outline, 3D pop, Glitch, and Rainbow.',
      'Nameplates: animated art behind your name in the members list and DMs (Aurora, Cyber, Fire, Ocean, Space, Sakura, Gold, or your own colors).',
      'In chat, decorations and name effects play when you hover or tap a message, so busy channels stay calm. Custom themes can float any of the new effects too.',
    ],
  },
  {
    version: '2.39',
    date: '2026-10-26',
    title: 'Real parts in the electrical diagram',
    items: [
      'The Control Hub and Expansion Hub are their real pictures now, and you wire straight to the real connectors (the colored dots): battery, motors and encoders, servos, RS485, I²C, digital, and analog.',
      'Motors, servos, and batteries show the goBILDA parts we use.',
      'Saving the diagram as a PNG includes the pictures.',
    ],
  },
  {
    version: '2.38',
    date: '2026-10-26',
    title: 'Resources and the electrical diagram',
    items: [
      'New Resources tab: the team’s own links (CAD, code, docs; only the team can see them) and good FTC links for BIOBUZZ, programming, electrical, building, and scouting.',
      'Electrical diagram: every motor, servo, and sensor and the hub port it plugs into. Electrical and team management can edit it: add parts, drag them around, rename them, and wire ports by tapping one and then the other. Changes save on their own, with undo and earlier versions.',
      'The diagram’s 🔌 Port list shows what’s plugged in where (handy for the robot configuration), and ⬇ PNG saves a picture.',
      'Feature requests have 👎 too, and show who voted each way.',
      'On iPad, pop-ups like What’s new show above the top bar and scroll inside themselves, so you can always get back to the top.',
    ],
  },
  {
    version: '2.37',
    date: '2026-10-21',
    title: 'Chat pickers on phones',
    items: [
      'On phones, Emoji, Sticker, GIF, and reaction pickers open near the top of the screen, so the keyboard no longer hides them.',
      'On iPads and phones, pickers don’t pop the keyboard up on their own. Tap the search box when you want to type.',
    ],
  },
  {
    version: '2.36',
    date: '2026-10-21',
    title: 'Who reacted, and managers can set status',
    items: [
      'Tap a message to see who reacted with each emoji (it works on iPads and phones, not just with a mouse).',
      'Feature requests show who wants each idea under it.',
      'Team management can change or clear anyone’s custom status: open their profile → Edit profile → Status.',
      'Editing your profile without touching your status keeps its “clear after” time.',
      'On phones, a message’s buttons show just above it (no longer covering it) and wrap onto two rows instead of overlapping.',
    ],
  },
  {
    version: '2.35',
    date: '2026-10-21',
    title: 'Version log fix',
    items: ['On phones, the Version log shows each version again instead of a stack of thin lines.'],
  },
  {
    version: '2.34',
    date: '2026-10-21',
    title: 'More phone polish',
    items: [
      'The chat box stays one line when it’s empty (it was growing to two lines on iPhone), and long channel names in it end with “…”.',
      'The chat ＋ menu closes when you tap anywhere else.',
      'Parts cards show the status and quantity again, and skip empty vendor or task lines.',
      'Long task titles in Table end with “…”; Team and the hours list show full names.',
      'Messages at the bottom no longer cover the chat box or a pop-up’s buttons.',
      'Every pop-up closes with Escape on a keyboard, and Shift schedule rows fit on an iPad held upright.',
    ],
  },
  {
    version: '2.33',
    date: '2026-10-21',
    title: 'Pop-ups fit phones',
    items: [
      'On phones, pop-ups (feature requests, Edit profile, Help, new task, and the rest) fill the screen and scroll inside, so the title and ✕ stay pinned at the top.',
      'Profile cards fit their content in the middle of the screen, with no empty space below.',
    ],
  },
  {
    version: '2.32',
    date: '2026-10-21',
    title: 'Thicker avatar rings',
    items: [
      'Custom avatar rings can be almost twice as thick (Thickness now goes to 40). Past the old max, the ring grows inward over the edge of your picture, so it never crowds names in chat.',
    ],
  },
  {
    version: '2.31',
    date: '2026-10-21',
    title: 'Phone fixes',
    items: [
      'Pop-ups (like Edit profile) now show above the top bar and tab bar instead of underneath them.',
      'The top bar no longer scrolls away after you type; the page snaps back when the keyboard closes.',
      'Messages at the bottom and chat side panels sit above the tab bar, so you can always switch tabs.',
      'Shift schedule rows fit on narrow screens, and Help closes with Escape.',
    ],
  },
  {
    version: '2.30',
    date: '2026-10-21',
    title: 'A real phone layout',
    items: [
      'On phones: a slim top bar (timer, bell, and your picture) and a tab bar at the bottom: Board, Chat, Shifts, Parts, and More for everything else.',
      'Tap your picture for your profile, theme, ideas, help, updates, and Switch user.',
      'Board on phones: pick a status at the top and see its tasks as full-width cards. Tap a task to open it and tap a status to move it. The ＋ button adds a task.',
      'Filters live in a Filters sheet; Parts shows cards instead of a wide table; the What’s new card no longer cuts off.',
      'Only Asher can change a feature request’s status or reply to it.',
    ],
  },
  {
    version: '2.29',
    date: '2026-10-21',
    title: 'Three-color gradients and custom borders',
    items: [
      'Gradients can have an optional third color: your name, your profile colors (add a middle color), your avatar ring, and custom app themes.',
      'Gradients look crisper: each color holds a bit before blending.',
      'Custom borders (Edit profile → Style → Borders): around your profile card and around your chat messages. Solid, gradient (up to 3 colors), rainbow, dashed, dotted, double, or glow, with any thickness and roundness, and spin, shimmer, or pulse.',
      'The Avatar border option jumps to your custom avatar ring.',
    ],
  },
  {
    version: '2.28',
    date: '2026-10-21',
    title: 'Custom avatar decorations',
    items: [
      'Edit profile → Style → Avatar decoration → Custom…: build your own.',
      'Ring: none, solid, gradient, two-tone, rainbow, glow, dashed, or dots, in any colors, any thickness, still or spinning either way at any speed.',
      'Up to 3 stickers: any emoji, a GIF, or your own picture. Tap or drag on the big preview to put one anywhere (on the edge, inside, or outside), then set its size and rotation.',
      'Animate each sticker: orbit around the edge, spin, bob, pulse, wiggle, or float, clockwise or counterclockwise, at any speed. 🎲 Surprise me makes a random one.',
    ],
  },
  {
    version: '2.27',
    date: '2026-10-21',
    title: 'Chat follows along',
    items: [
      'Chat scrolls down when you send a message, even in busy channels and even if you had scrolled up.',
      'It stays at the bottom when photos, GIFs, videos, and link previews finish loading.',
    ],
  },
  {
    version: '2.26',
    date: '2026-10-21',
    title: 'Custom themes',
    items: [
      'Theme menu → 🎨 Custom…: pick any accent color and two background colors (any color), how strong they are, and make them move.',
      'Background: your own picture, a GIF, or a pattern of any emoji, with a slider for how much shows through.',
      'Floating: sparkles, snow, hearts, bubbles, confetti, gears, fire, or anything (any emoji, GIF, or picture) falling, rising, or floating behind the app.',
      '🎲 Surprise me makes a random theme. 🪞 My profile matches the app to your profile’s colors, banner, and effect, and follows when you change them.',
      'The + in Help is no longer faded.',
    ],
  },
  {
    version: '2.25',
    date: '2026-10-21',
    title: 'Lab check-in, grades, and parts chat',
    items: [
      'Lab check-in: team management asks “Who’s going to the lab today?” (lunch and/or after school) from the Shifts tab. Everyone gets a notification, and the app asks you when you open it until you answer.',
      'Results in the Shifts tab: lunch is split into middle school lunch and high school lunch by grade, plus after school, not going, and who hasn’t answered. Change your answer anytime.',
      'Grade level on profiles and the Team tab. Only team management can change it.',
      'Parts tab: a #parts chat right next to the parts list (also in the Chat tab).',
    ],
  },
  {
    version: '2.24',
    date: '2026-10-21',
    title: 'Status bar color',
    items: ['The area behind the iPad status bar matches the header (white, or dark in dark mode) instead of gray.'],
  },
  {
    version: '2.23',
    date: '2026-10-21',
    title: 'Header blur, third try',
    items: ['The header is back to its normal size, with another fix for the blur under the iPad status bar.'],
  },
  {
    version: '2.22',
    date: '2026-10-21',
    title: 'Header blur, another try',
    items: [
      'Another fix for the blurry strip at the top of the iPad app, under the status bar.',
      'Notification icons (💡, ⏰, @) sit in the middle of their circles.',
    ],
  },
  {
    version: '2.21',
    date: '2026-10-21',
    title: 'Shifts',
    items: [
      'New Shifts tab: who’s at the lab now, the shift schedule, everyone’s hours, and a log of every shift.',
      'Tap ⏱ at the top to start a shift in one tap. A timer shows while you’re on shift; tap it to add what you’re working on, your subteam, and tasks, fix your start time, or End shift now.',
      'Schedule: team management plans shifts (once or weekly); tap I’m in or Can’t. During a planned shift, Clock in now is one tap.',
      'Hours: a season and this-week leaderboard, with a season goal set by team management. Export every shift as a spreadsheet (CSV).',
      'Reminders: “Still at the lab?” after 4 hours, and an hour before a shift you said you’re coming to. Shifts left running past midnight end automatically.',
      'Team management can clock in several people at once, end anyone’s shift, and add or fix shifts.',
    ],
  },
  {
    version: '2.20',
    date: '2026-10-21',
    title: 'Online dot fixes',
    items: [
      'The green online dot sits on top of decorated profile pictures (Crown, Neon, …) instead of half behind them.',
      '“Online now” on profile cards has a crisp dot that’s no longer cut off.',
    ],
  },
  {
    version: '2.19',
    date: '2026-10-21',
    title: 'Check for updates',
    items: [
      'Help (?) has a “Check for updates” button right under the version number. If there’s a newer version, the update screen opens; if not, it tells you you’re up to date.',
      'Fixed updates getting stuck: several quick changes in a row could keep the newest version from going live.',
    ],
  },
  {
    version: '2.18',
    date: '2026-10-21',
    title: 'Avatar decorations fixed',
    items: [
      'Initials sit in the middle of decorated avatars again (Neon, Flames, Crown, and the rest) instead of being cut off at the top.',
      'Edit profile fits on the screen, and its title and ✕ stay at the top while you scroll.',
    ],
  },
  {
    version: '2.17',
    date: '2026-10-21',
    title: 'Type an emoji to pick it',
    items: [
      'Emoji pickers: type an emoji (emoji keyboard or Globe + E) in the search box and it’s picked right away, instead of “No emoji found.” Works for reactions, chat, your status, and custom profile effects.',
    ],
  },
  {
    version: '2.16',
    date: '2026-10-21',
    title: 'See which tab you’re on',
    items: [
      'Edit profile: the Profile, Style, and Status tabs now highlight the one you’re on.',
      'Same for the Light/Dark/Auto theme buttons and the Fall/Rise/Float choice for custom profile effects.',
    ],
  },
  {
    version: '2.15',
    date: '2026-10-21',
    title: 'Status buttons in tasks',
    items: [
      'Open a task and tap a Status button (To Do, In Progress, Blocked, …) to move it, just like Priority.',
      'The status pill at the top of a task now shows ▾ so you can tell it’s tappable too.',
    ],
  },
  {
    version: '2.14',
    date: '2026-10-21',
    title: 'Feature requests',
    items: [
      'Tap 💡 at the top to send an idea for the app. It goes straight to Asher’s notifications.',
      'The “What’s new” card after each update has an idea box too.',
      'See everyone’s ideas and tap 👍 on the ones you want.',
      'You get a notification when your idea is planned, added, or gets a reply.',
      'Team management can set each idea’s status, reply, and turn it into a task.',
    ],
  },
  {
    version: '2.13',
    date: '2026-10-21',
    title: 'Custom profile effects',
    items: [
      'Profile effect “Custom…”: make anything rain on your profile card: any emoji, a GIF from GIPHY, or your own picture or GIF.',
      'Pick how it moves: Fall, Rise, or Float.',
    ],
  },
  {
    version: '2.12',
    date: '2026-10-21',
    title: 'Reading clears notifications',
    items: [
      'Opening a channel or DM marks its notifications as read in the 🔔 and removes them from your iPad’s notification list.',
      'Same for tasks: opening a task clears the notifications about it.',
      'Looking at the board clears the “due tomorrow” reminder.',
    ],
  },
  {
    version: '2.11',
    date: '2026-10-21',
    title: 'Chat opens where you left off',
    items: [
      'Opening a channel or DM with unread messages starts at the red “New” line near the top, so you read down from where you left off (like Discord). With nothing new, it opens at the newest message.',
      'Fixed: switching channels used the previous channel’s “last read” time, so the jump and the “New” line landed in the wrong place.',
      'Jumping to a message (replies, pins, search) scrolls only the chat, never the screen around it.',
    ],
  },
  {
    version: '2.10',
    date: '2026-10-21',
    title: 'Header blur fix for iPad',
    items: [
      'Fixed: iPadOS 26 blurs the strip under the status bar in Home Screen apps unless the page gives it a solid color to use. The site now does (with an invisible strip at the top), so the header’s top row stays sharp.',
    ],
  },
  {
    version: '2.9',
    date: '2026-10-21',
    title: 'Typing test removed',
    items: ['The Troubleshooting → Typing test screen in Help is gone now that the Globe + E emoji fix is in (the fix stays).'],
  },
  {
    version: '2.8',
    date: '2026-10-21',
    title: 'Crisp header for good',
    items: [
      'Fixed: the top of the iPad app (logo, title, countdown) still looked blurry. The header is now a plain bar and only the area below it scrolls, so nothing passes under it or the status bar.',
    ],
  },
  {
    version: '2.7',
    date: '2026-10-21',
    title: 'Emoji from Globe + E work the first time',
    items: [
      'Fixed: on the iPad app, the first emoji picked with Globe + E didn’t appear in text boxes (chat, names, task titles, everywhere). The iPad sent it only as a key press; the site now types it in when that happens.',
    ],
  },
  {
    version: '2.6',
    date: '2026-10-21',
    title: 'Typing test',
    items: [
      'Help → Troubleshooting → Typing test: shows exactly what the iPad sends when you type, to track down why the first emoji from Globe + E doesn’t appear.',
    ],
  },
  {
    version: '2.5',
    date: '2026-10-21',
    title: 'One tap is enough on iPad',
    items: [
      'Fixed: switching chat channels on iPad took two taps (the first tap only revealed the ⚙ button).',
      'Same fix for other things that appeared on hover: message tools, the Table’s Open button, checklist ✕ buttons, and link-preview ✕.',
    ],
  },
  {
    version: '2.4',
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
    version: '2.3',
    date: '2026-10-21',
    title: 'Pop-ups stay on screen on iPad',
    items: [
      'Fixed: on the iPad app, dialogs (like Edit on the Team tab) opened off the top of the screen when you were scrolled down.',
      'Fixed: the header now stays pinned at the top while you scroll.',
      'The app scrolls inside itself instead of scrolling the whole page, which Safari handles better.',
    ],
  },
  {
    version: '2.2',
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
    version: '2.1',
    date: '2026-10-20',
    title: 'Sharper header and GIF search',
    items: [
      'Fixed: the header (logo and countdown) looked blurry in the iPad app; it’s now solid.',
      'GIF search is on, with the team’s GIPHY key: trending GIFs and search.',
    ],
  },
  {
    version: '2.0',
    date: '2026-10-20',
    title: 'Discord-style chat',
    items: [
      'Text styles: bold, italic, underline, strikethrough, big/medium/small headings, small gray text, quotes, lists, code, code blocks, and ||spoilers||, with an Aa formatting bar and ⌘B/⌘I/⌘U.',
      'Mentions: @people, @Programming (or any subteam), and @everyone (team management only).',
      ':emoji: shortcodes (type :fire), a searchable picker with every emoji, recent emoji, and team custom emoji (animated GIFs work).',
      'Polls (📊): one or several choices, live results, end a poll.',
      'Pins (📌) per channel and message search (🔍) by words and person.',
      'Link previews made by the server, and YouTube videos that play in the chat.',
      'Direct messages and group DMs.',
      'Profile pictures (upload and crop), statuses like “🔧 At the lab”, and profile cards with role, subteams, responsibilities, and open tasks.',
      'Who’s online (green dots), a members panel, and “… is typing”.',
      'Team management can add, rename, reorder, and delete channels, with topics and subteam colors.',
      'Notification setting per channel: All messages, Only @mentions, or Nothing (muted).',
      '“New” line where you left off, tap a reply to jump to the original, paste pictures.',
      'Names colored by subteam, like Discord role colors.',
    ],
  },
  {
    version: '1.9',
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
