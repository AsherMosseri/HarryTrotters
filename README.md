# FTC 32313 Task Board

A live, shared task board for the team — replaces the old Google Sheet task log.

- **Board** view: drag cards between Backlog → To Do → In Progress → Blocked / Waiting on Parts → Testing / Review → Done (on iPad, press and hold a card to drag).
- **Table** view: spreadsheet-style list with sorting, inline editing, and quick add.
- **Milestones** tab: timeline to the Nov 14 competition. Tasks link to a milestone, and its bar fills in as those tasks are done; status shows Not started / On track / At risk / Late / Done.
- **Parts** tab: parts and orders (Needed → Ordered → Arrived) with vendor, quantity, cost, link, and a running total spent; a part can be linked to the task waiting on it.
- **Checklists** tab: shared competition checklists (robot inspection, pit packing, competition day) that anyone can tick off. Tasks also have their own step checklists.
- **Match Log** tab: practice runs and competition matches with Auto / TeleOp / Endgame points, a points-per-run chart, and problems (optionally turned into a fix task).
- **Recently deleted**: deleting a task moves it here (with Undo) for 30 days; managers can delete for good, and a manager's device purges entries older than 30 days.
- **Chat** tab: 📣 #announcements (only team management posts; the newest shows as a banner on the board), #general, and a channel per subteam, with photos, GIFs (GIPHY search when `GIPHY_API_KEY` is set, plus uploads), reactions (any emoji), replies, @mentions, # task links, editing, and turning a message into a task. Unread counts per device.
- **Notifications**: the 🔔 lists announcements, @mentions, tasks someone gave you, and a 7:30 AM (New York time) due-tomorrow reminder. Each device can turn on phone notifications (on iPhone/iPad, from the Home Screen app only). Sent by the Cloud Functions in `functions/`.
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

### Rules and notifications deploy

`.github/workflows/firebase.yml` publishes `firestore.rules`, `storage.rules`, and the
notification functions (`functions/`) whenever they change on `main`. It copies the real
team and manager codes from the live rules first, so they never need to be on GitHub.
It needs a one-time setup in Google Cloud Shell (no keys or secrets are created):

```bash
bash <(curl -sL https://raw.githubusercontent.com/AsherMosseri/HarryTrotters/main/scripts/setup-firebase-deploy.sh)
```

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
- `roles/{personId}` — `{ name, title, subteams[], responsibilities[], removed }` — org chart edits and people the manager added or removed.
- `settings/team` — `{ competitionDate }`.
- `parts/{id}` — `{ name, vendor, partNumber, qty, unitCost, url, status, subteam, taskId, notes }`.
- Task photos live in Cloud Storage at `tasks/{taskId}/{photoId}.jpg` (+ `-thumb.jpg`); the task's `photos` array holds their URLs.
- `runs/{id}` — `{ date, type, matchNumber, result, drivers[], auto, teleop, endgame, penalties, issues, notes }`.
- Deleted tasks keep `deletedAt` / `deletedBy` until restored or purged.
- `channels/{channelId}/messages/{id}` — `{ text, by, byUid, at, mentions[], taskIds[], replyTo, photo, reactions: { [emoji]: { [uid]: name } }, editedAt, deleted }`. Chat photos live in Storage under `chat/{channelId}/`.
- `robotVersions/{id}` (file in Storage at `robot/{id}.glb`), `robotPins/{id}` `{ versionId, key, point, text, taskId, partId, resolved }`, `robotLayouts/{id}` `{ versionId, name, transforms, hidden }`.
- `checklists/{id}` — `{ title, items: { [itemId]: { text, done, doneBy, doneAt, order } } }` (a map so simultaneous ticks don't collide).
- Messages can also have `gif: { url, width, height, source: 'giphy' | 'upload', path? }`; uploaded GIFs live under `chat/{channelId}/`.
- `inbox/{personId}/items/{id}` — `{ type: announcement | mention | assigned | due, title, body, open, by, at, read }`, written only by the Cloud Functions; `open` is `task:<id>`, `chat:<channel>`, or `view:<tab>`.
- `pushTokens/{token}` — `{ uid, person, ua, at }`, one per device with phone notifications on; only the functions read them.
- `members/{uid}` — `{ name, code, joinedAt }` — one per device that entered the right code; only readable by that device.
- `people/{uid}` — `{ name, joinedAt }` — names for the assignee picker, readable by the team.
- `tasks/{id}` — `{ title, description, status, assignees[], subteam, priority, dueDate, blockedReason, links[], commentCount, createdAt/By, updatedAt/By, completedAt }`
- `tasks/{id}/activity/{id}` — comments and automatic change history.
