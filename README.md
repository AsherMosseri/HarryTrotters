# FTC 32313 Task Board

A live, shared task board for the team — replaces the old Google Sheet task log.

- **Board** view: drag cards between Backlog → To Do → In Progress → Blocked / Waiting on Parts → Testing / Review → Done (on iPad, press and hold a card to drag).
- **Table** view: spreadsheet-style list with sorting, inline editing, and quick add.
- **Milestones** tab: timeline to the Nov 14 competition. Tasks link to a milestone, and its bar fills in as those tasks are done; status shows Not started / On track / At risk / Late / Done.
- **Parts** tab: parts and orders (Needed → Ordered → Arrived) with vendor, quantity, cost, link, and a running total spent; a part can be linked to the task waiting on it.
- **Checklists** tab: shared competition checklists (robot inspection, pit packing, competition day) that anyone can tick off. Tasks also have their own step checklists.
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

Add it to an iPad or phone Home Screen (Share → Add to Home Screen) to open it like an app.

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Configuration

- `src/config.js` — Firebase config, roster, statuses, subteams, priorities.
- `firestore.rules` — database security rules, including the team code and the
  manager codes (joining as one of `MANAGER_NAMES` requires that person's code; managers can edit the
  org chart, add/remove people, delete milestones, and change the competition
  date). The file in this repo has `CHANGE-ME` placeholders; the real codes only live in
  Firebase console → Firestore Database → Rules. To change the code, edit it
  there and Publish. Devices that already joined stay signed in.
- Firebase Authentication must have the **Anonymous** provider enabled.
- `storage.rules` — Cloud Storage rules for task photos (paste into Firebase console → Storage → Rules).

## Data model (Firestore)

- `milestones/{id}` — `{ title, subteam, owners[], start, end, notes, done }`; tasks link via `milestoneId`.
- `roles/{personId}` — `{ name, title, subteams[], responsibilities[], removed }` — org chart edits and people the manager added or removed.
- `settings/team` — `{ competitionDate }`.
- `parts/{id}` — `{ name, vendor, partNumber, qty, unitCost, url, status, subteam, taskId, notes }`.
- Task photos live in Cloud Storage at `tasks/{taskId}/{photoId}.jpg` (+ `-thumb.jpg`); the task's `photos` array holds their URLs.
- `checklists/{id}` — `{ title, items: { [itemId]: { text, done, doneBy, doneAt, order } } }` (a map so simultaneous ticks don't collide).
- `members/{uid}` — `{ name, code, joinedAt }` — one per device that entered the right code; only readable by that device.
- `people/{uid}` — `{ name, joinedAt }` — names for the assignee picker, readable by the team.
- `tasks/{id}` — `{ title, description, status, assignees[], subteam, priority, dueDate, blockedReason, links[], commentCount, createdAt/By, updatedAt/By, completedAt }`
- `tasks/{id}/activity/{id}` — comments and automatic change history.
