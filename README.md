# FTC 32313 Task Board

A live, shared task board for the team — replaces the old Google Sheet task log.

- **Board** view: drag cards between Backlog → To Do → In Progress → Blocked / Waiting on Parts → Testing / Review → Done (on iPad, press and hold a card to drag).
- **Table** view: spreadsheet-style list with sorting, inline editing, and quick add.
- **Task details**: multiple assignees, subteam, priority, due date, blocker notes, links, comments, and an automatic history of every change.
- Google sign-in; only people on the Team list can see or edit anything.

Try it without signing in: open the site with `?demo` at the end of the URL.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (add ?demo for sample data)
npm run build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Configuration

- `src/config.js` — Firebase config, admin email, roster, statuses, subteams, priorities.
- `firestore.rules` — database security rules. After changing them, paste into
  Firebase console → Firestore Database → Rules → Publish. Keep the admin email
  here in sync with `ADMIN_EMAILS` in `src/config.js`.

## Data model (Firestore)

- `members/{email}` — `{ email, name, addedAt }` — the access allowlist.
- `tasks/{id}` — `{ title, description, status, assignees[], subteam, priority, dueDate, blockedReason, links[], commentCount, createdAt/By, updatedAt/By, completedAt }`
- `tasks/{id}/activity/{id}` — comments and automatic change history.
