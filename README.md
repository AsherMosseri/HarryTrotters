# FTC 32313 Task Board

A live, shared task board for the team — replaces the old Google Sheet task log.

- **Board** view: drag cards between Backlog → To Do → In Progress → Blocked / Waiting on Parts → Testing / Review → Done (on iPad, press and hold a card to drag).
- **Table** view: spreadsheet-style list with sorting, inline editing, and quick add.
- **Milestones** tab: timeline to the Nov 14 competition. Tasks link to a milestone, and its bar fills in as those tasks are done; status shows Not started / On track / At risk / Late / Done.
- **Parts** tab: parts and orders (Needed → Ordered → Arrived) with vendor, quantity, cost, link, and a running total spent; a part can be linked to the task waiting on it.
- **Checklists** tab: shared competition checklists (robot inspection, pit packing, competition day) that anyone can tick off. Tasks also have their own step checklists.
- **Match Log** tab: practice runs and competition matches with Auto / TeleOp / Endgame points, a points-per-run chart, and problems (optionally turned into a fix task).
- **Recently deleted**: deleting a task moves it here (with Undo) for 30 days; managers can delete for good, and a manager's device purges entries older than 30 days.
- **Chat** tab (Discord-style): 📣 #announcements (only team management posts; the newest shows as a banner on the board), #general, a channel per subteam, and channels team management adds/renames/reorders. Text formatting (bold, italic, underline, strike, headings, subtext, quotes, lists, code, spoilers) with a formatting bar; @people, @Subteam, and @everyone (team management) mentions; :emoji: shortcodes, a full emoji picker, and team custom emoji; photos, GIFs (GIPHY search when `GIPHY_API_KEY` is set, plus uploads), polls, link previews (made by a Cloud Function) and inline YouTube; reactions, replies, pins, search, editing, and turning a message into a task. Direct messages and group DMs (team management can read them). Profile pictures, statuses, profile cards, who's online, and typing indicators. Per-channel notification settings (All / @mentions / Nothing).
- **Nitro-style extras**: animated GIF profile pictures, banners, pronouns, about me, display-name fonts and gradient colors, avatar decorations, profile effects (including custom ones made from any emoji, GIPHY GIF, or picture), profile theme colors, super reactions, team stickers, any file up to 25 MB in chat (videos and audio play inline), and per-device app color themes. Options live in `src/nitro.js`.
- **Notifications**: the 🔔 lists announcements, @mentions, tasks someone gave you, and a 7:30 AM (New York time) due-tomorrow reminder. Each device can turn on phone notifications (on iPhone/iPad, from the Home Screen app only). Sent by the Cloud Functions in `functions/`.
- **Shifts** tab: ⏱ in the top bar starts a shift in one tap and shows a running timer (tap it to add notes/subteam/tasks, move the start earlier, or end it). The tab shows who's at the lab, the planned schedule (team management plans shifts, once or weekly; people answer I'm in / Can't), season and weekly hours with a goal (`settings/team.shiftGoal`), the log, and CSV export. The `shiftChecks` Cloud Function runs every 15 minutes: a 4-hour "Still at the lab?" reminder, a reminder an hour before planned shifts, and ending shifts left running past midnight (New York time) at the person's last activity.
- **Lab check-in** (Shifts tab): team management asks who's going to the lab (lunch and/or after school) for a day. Everyone is notified (`onCheckin` Cloud Function), and on that day the app shows the question when it opens until it's answered. Lunch answers are split into middle school and high school lunch by grade (`grade` on the Team tab; defaults in `GRADE_DEFAULTS` in `src/config.js`).
- **Parts chat**: the Parts tab shows the #parts channel beside the list.
- **Custom themes** (per device): the theme menu's 🎨 Custom… opens a studio (`src/components/ThemeStudio.jsx`) for any accent and background colors, moving colors, a picture/GIF/emoji-pattern background, and floating effects; 🪞 My profile builds the same from the profile's colors, banner, and effect. Stored in localStorage `custom-theme`; pictures go to Storage under `effects/`.
- **Phone layout** (≤ 760px wide): a slim top bar, a bottom tab bar (`src/components/PhoneChrome.jsx`) with More and Me sheets, a one-status-at-a-time board, a Filters sheet, and a floating ＋.
- **Feature requests**: 💡 at the top (and the idea box on the “What’s new” card after each update) sends an idea to `REQUESTS_TO` in `src/config.js` (Asher) as a notification. Everyone can see ideas and 👍 them; only Asher (`REQUESTS_TO`; enforced in firestore.rules) sets the status (New, Planned, In progress, Added, Not now), replies, or turns one into a task, and the person who asked is notified.
- **Robot** tab: 3D viewer for Onshape GLTF exports (three.js, loaded only on this tab) with a parts tree, hide/show/isolate, exploded view, pinned notes linked to tasks and parts, a sandbox to move/rotate parts and save layouts, and side-by-side version compare (added/removed/moved). Model files need CORS enabled on the Storage bucket to download (see the in-app message).
- **Team** tab: organization chart by subteam plus each person's role and responsibilities (editable on the site; starting values in `ORG_DEFAULTS` in `src/config.js`).
- **Task details**: multiple assignees, subteam, priority, due date, blocker notes, links, comments, and an automatic history of every change.
- Join by picking your name and entering the team code (once per device). The code is checked by the Firestore security rules, so a wrong code can't read or change anything.

Try it without signing in: open the site with `?demo` at the end of the URL (`?demo=member` to preview a regular teammate's view).

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (add ?demo for sample data)
npm run build
```

On iPhone and iPad the board only runs from the Home Screen (Share → Add to Home Screen); Safari shows install steps instead, since that's the only way notifications work there. Computers and Android use it in the browser.

Each build publishes `version.json`; open pages check it every minute and block with an "Update now" prompt when a newer version is live.

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

**Version log:** every user-visible change gets an entry at the top of `src/changelog.js` (version number, date, title, and a line per feature or fix). The build publishes it in `version.json`, so open pages show "Version X is ready" with its highlights, devices see a "What's new" card once after updating, and the full log is in Help (?).

### Rules and notifications deploy

`.github/workflows/firebase.yml` publishes `firestore.rules`, `storage.rules`, and the
notification functions (`functions/`) whenever they change on `main`. It copies the real
team and manager codes from the live rules first, so they never need to be on GitHub.
It needs a one-time setup in Google Cloud Shell (no keys or secrets are created):

```bash
bash <(curl -sL https://raw.githubusercontent.com/AsherMosseri/HarryTrotters/main/scripts/setup-firebase-deploy.sh)
```

The script also sets CORS on the Storage bucket so the Robot tab can download model files.

Test locally with the emulators: `npx firebase-tools emulators:start --only firestore,auth,functions`.

## Configuration

- `src/config.js` — Firebase config, roster, statuses, subteams, priorities.
- `firestore.rules` — database security rules, including the team code and the
  manager codes (joining as one of `MANAGER_NAMES` requires that person's code; managers can edit the
  org chart, add/remove people, delete milestones, and change the competition
  date). The file in this repo has `CHANGE-ME` placeholders; the real codes only live in
  Firebase console → Firestore Database → Rules. To change the code, edit it
  there and Publish. Devices that already joined stay signed in.
- Firebase Authentication must have the **Anonymous** provider enabled.
- `storage.rules` — Cloud Storage rules for photos, GIFs, and robot files.
- `GIPHY_API_KEY` in `src/config.js` — free key from developers.giphy.com for GIF search (public, like the Firebase config). Empty means GIF uploads only.
- `VAPID_KEY` in `src/config.js` — optional Web Push key; empty uses Firebase's default.

## Data model (Firestore)

- `milestones/{id}` — `{ title, subteam, owners[], start, end, notes, done }`; tasks link via `milestoneId`.
- `roles/{personId}` — `{ name, title, grade, subteams[], responsibilities[], removed }` — org chart edits and people the manager added or removed.
- `settings/team` — `{ competitionDate }`.
- `parts/{id}` — `{ name, vendor, partNumber, qty, unitCost, url, status, subteam, taskId, notes }`.
- Task photos live in Cloud Storage at `tasks/{taskId}/{photoId}.jpg` (+ `-thumb.jpg`); the task's `photos` array holds their URLs.
- `runs/{id}` — `{ date, type, matchNumber, result, drivers[], auto, teleop, endgame, penalties, issues, notes }`.
- Deleted tasks keep `deletedAt` / `deletedBy` until restored or purged.
- `channels/{channelId}/messages/{id}` — `{ text, by, byUid, at, mentions[], taskIds[], replyTo, photo, reactions: { [emoji]: { [uid]: name } }, editedAt, deleted }`. Chat photos live in Storage under `chat/{channelId}/`.
- `robotVersions/{id}` (file in Storage at `robot/{id}.glb`), `robotPins/{id}` `{ versionId, key, point, text, taskId, partId, resolved }`, `robotLayouts/{id}` `{ versionId, name, transforms, hidden }`.
- `checklists/{id}` — `{ title, items: { [itemId]: { text, done, doneBy, doneAt, order } } }` (a map so simultaneous ticks don't collide).
- Messages can also have `gif: { url, width, height, source: 'giphy' | 'upload', path? }`; uploaded GIFs live under `chat/{channelId}/`.
- `channels/{id}` — `{ name, topic, subteam, order, deleted }` — channel changes by team management (defaults are `CHANNELS` in config.js).
- `dms/{id}` — `{ people[], name, lastAt, lastBy, lastText }`, messages in `dms/{id}/messages` (same shape as channel messages). 1-on-1 ids are the two person ids joined by `--`.
- Messages can also have `poll: { question, options[{id,text}], multi, closed }` with `votes: { [optionId]: { [personId]: name } }`, `pinned/pinnedBy/pinnedAt`, `everyone`, `roles[]` (subteam mentions; `mentions` holds everyone they ping), and `preview: { url, site, title, description, image }` (set by a Cloud Function; `false` if the author hid it).
- `profiles/{personId}` — `{ name, photo: { url, path }, status: { emoji, text, until }, notify: { [conv]: 'all' | 'mentions' | 'none' } }`; pictures in Storage under `avatars/`.
- `presence/{uid}` — `{ name, at, typing, typingAt }`, one per device (heartbeat every minute).
- Profiles can also have `banner`, `bannerColor`, `about`, `pronouns`, `decoration` (with `decorationCustom: { ring: { style, colors[], width, spin, speed }, badges: [{ kind, value, path?, angle, dist, size, rotate, anim, dir, speed }] }` for 'custom', drawn by `src/components/decoRender.jsx`), `effect`, `effectCustom: { kind: 'emoji'|'image', value, path, motion: 'fall'|'rise'|'twinkle' }` (pictures in Storage under `effects/`), `nameStyle: { font, colors[] (2–3 for a gradient) }`, `theme: { a, b, m? }` (m = optional middle color), and `cardBorder` / `msgBorder` (`{ style, colors[], width, radius, anim }`, see `src/borders.js`). Messages can have `supers` (super reactions, same shape as `reactions`), `sticker: { id, name, url }`, and `files: [{ name, size, type, url, path }]` (Storage under `files/`).
- `stickers/{id}` — `{ name, url, path }`, team stickers; files in Storage under `stickers/`.
- `emoji/{name}` — `{ name, url, path }`, team emoji; files in Storage under `emoji/`.
- `shifts/{id}` — `{ person, start, end (null while running), note, subteam, taskIds[], by, byUid, autoEnded?, reminded?, planId? }` (ms times). You create your own (start up to 12 h back) and end it; managers change anything.
- `checkins/{id}` — `{ date, question, slots: ['lunch' | 'after'], answers: { [name]: { lunch?, after?, at } }, by, byUid, at }`. Managers create/delete; people answer only for themselves.
- `shiftPlans/{id}` — `{ date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM', title, subteam, people: { [name]: 'in' | 'out' }, repeatId?, reminded? }`. Managers create/delete; people answer only for themselves.
- `requests/{id}` — `{ text, by, byUid, at, status: new | planned | working | done | declined, votes: { [name]: true }, reply?, updatedBy?, updatedAt? }`. Anyone creates (as themselves, status new) and 👍s; managers change the rest.
- `inbox/{personId}/items/{id}` — `{ type: announcement | mention | assigned | due | request | shift | checkin, title, body, open, by, at, read }`, written only by the Cloud Functions; `open` is `task:<id>`, `chat:<channel>`, `view:<tab>`, `requests:<id>`, or `shift:end`.
- `pushTokens/{token}` — `{ uid, person, ua, at }`, one per device with phone notifications on; only the functions read them.
- `members/{uid}` — `{ name, code, joinedAt }` — one per device that entered the right code; only readable by that device.
- `people/{uid}` — `{ name, joinedAt }` — names for the assignee picker, readable by the team.
- `tasks/{id}` — `{ title, description, status, assignees[], subteam, priority, dueDate, blockedReason, links[], commentCount, createdAt/By, updatedAt/By, completedAt }`
- `tasks/{id}/activity/{id}` — comments and automatic change history.
