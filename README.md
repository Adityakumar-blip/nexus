# Nexus

A simple, genuinely useful workspace to drive a product **end to end** — from
roadmap to release — keeping your **projects, releases, tasks, and knowledge** in one place.

- **Projects** — group work into projects, each with its own Kanban board (To Do / In Progress / Done), drag-and-drop, task types (Feature / Improvement / Bug / Chore), priorities, and due dates.
- **Milestones & Roadmap** — group tasks into versioned releases with a goal and target date, track live progress, and see every release across all products on one roadmap (Active / Planned / Shipped).
- **Knowledge base** — markdown notes with live preview, tags, pinning, full-text search, and optional links to projects.
- **Dashboard** — at-a-glance stats, recent projects, active releases with progress, upcoming/overdue tasks, and recent notes.
- **Auth** — email/password sign-in, every user sees only their own data.
- Light/dark mode, realtime sync, toast notifications.

### The end-to-end flow

> **Plan** a release on the Roadmap → **break it into tasks** on the project board → **build** by dragging tasks across the Kanban → **document** decisions in the Knowledge base → **ship** by marking the milestone *Shipped*.

Built with **Next.js (App Router) + TypeScript**, **shadcn/ui** (Radix + Tailwind v4), and **Firebase** (Auth + Firestore).

---

## 1. Install

```bash
npm install
```

## 2. Connect Firebase

The app runs without credentials — it just shows a "Connect Firebase" screen until you add them.

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Get started → enable **Email/Password**.
3. **Firestore Database** → Create database (Production mode is fine).
4. **Firestore → Rules** → paste the contents of [`firestore.rules`](./firestore.rules) and **Publish**.
5. **Project settings → General → Your apps** → add a **Web app**, then copy the config values.
6. Copy `.env.local.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.local.example .env.local
   ```

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

> These `NEXT_PUBLIC_*` keys are meant to be public — Firebase web apps secure data with **Security Rules + Auth**, not by hiding the config. The rules in `firestore.rules` ensure each user can only access documents they own.

## 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start adding projects and notes.

---

## Control Nexus from Claude & other agents (MCP)

Nexus ships a built-in **remote MCP server** at `/api/mcp`, so Claude Code, Cursor,
Claude Desktop, or any MCP-capable agent can read and write your projects,
milestones, tasks, and knowledge — authenticated by a revocable **Personal
Access Token**. The token *is* the identity: it acts as the user who generated it.

### One-time server setup

The MCP endpoint uses the Firebase **Admin SDK**, which needs a service-account
credential (this stays server-side and is never given to agents):

1. Firebase Console → **Project Settings → Service Accounts** → **Generate new private key** (downloads a JSON file).
2. Add it to `.env.local` — paste the whole JSON on one line:

   ```env
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"…", …}
   ```

   (or leave it blank and set `GOOGLE_APPLICATION_CREDENTIALS` to the file path.)
3. Restart `npm run dev`.

### Generate a key & connect

1. In the app, go to **Settings → MCP Access Keys → Generate key**.
2. Copy the key (shown once) and the ready-made command, e.g.:

   ```bash
   claude mcp add --transport http nexus http://localhost:3000/api/mcp \
     --header "Authorization: Bearer nx_live_…"
   ```

   Any other agent: point it at `http://localhost:3000/api/mcp` with the key as a
   Bearer token. The Nexus dev server must be running for the agent to reach it.
3. Revoke a key anytime from the same screen — it stops working instantly.

### Available tools

`list/create/update/delete_project`, `list/create/update/delete_milestone`,
`list/create/update/delete_task`, and `search_notes` + `get/create/update/delete_note`.
All operations are scoped to the key owner's data.

> **Security:** the service-account JSON has full project access — never commit it
> (it's gitignored). Each PAT grants full CRUD over *your* Nexus data; treat it
> like a password. Token hashes (not the tokens) are stored in an `apiKeys`
> collection that clients can't read — only the server (Admin SDK) touches it.

---

## Data model (Firestore)

All collections are top-level and scoped by `ownerId`:

| Collection | Fields |
|-----------|--------|
| `projects`   | `name`, `description`, `color`, `status`, `ownerId`, `createdAt`, `updatedAt` |
| `milestones` | `projectId`, `name`, `description`, `status` (`planned`/`active`/`shipped`), `targetDate` (nullable), `ownerId`, timestamps |
| `tasks`      | `projectId`, `milestoneId` (nullable), `title`, `description`, `status` (`todo`/`in_progress`/`done`), `type` (`feature`/`improvement`/`bug`/`chore`), `priority`, `order`, `dueDate`, `ownerId`, timestamps |
| `notes`      | `title`, `content` (markdown), `tags[]`, `projectId` (nullable), `pinned`, `ownerId`, timestamps |

Queries use only equality filters (`ownerId ==`, optionally `projectId ==`) and sort client-side, so **no composite indexes are required**.

## Project structure

```
src/
  app/
    (app)/                 # authenticated area (sidebar shell)
      dashboard/           # overview + stats + active releases
      projects/            # project list
      projects/[id]/       # Kanban board + release/milestone bar
      roadmap/             # all releases across products (Active/Planned/Shipped)
      knowledge/           # notes (master/detail markdown editor)
    login/                 # sign in / sign up
    page.tsx               # routes to dashboard or login
  components/              # UI + feature components (shadcn in components/ui)
  lib/
    firebase.ts            # client init (+ isFirebaseConfigured guard)
    auth-context.tsx       # auth provider
    store.ts               # Firestore data access (realtime listeners + CRUD)
    types.ts               # domain model
    format.ts              # presentation helpers
firestore.rules            # security rules to paste into Firebase
```

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```
