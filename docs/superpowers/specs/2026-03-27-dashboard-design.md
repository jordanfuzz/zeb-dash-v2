# Dashboard Design

## Context

Zeb Dash V2 needs a read-only web dashboard for viewing Claude Code conversations, plans, and notes across repositories and branches. This is the third component of the system — the API and database already exist and serve the data. The dashboard is a React SPA that fetches from the API and presents a drill-down navigation: Repositories → Repository → Branch.

## Tech Stack

- **Vite** — build tool and dev server
- **React** — UI framework
- **React Router** — client-side routing
- **Tailwind CSS** — utility-first styling
- **No other runtime dependencies** — plain `fetch` + `useState`/`useEffect` for data

## Docker Setup

New `web` service added to `compose.yml`:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `web` | Built from `./web` | `5173:5173` | Vite dev server |

- Vite runs with `--host 0.0.0.0` so it's accessible from the Docker host
- API calls proxied through Vite's dev server config (`/api` → `http://api:3000`) to avoid CORS
- `web` depends on `api`

## Pages & Routes

| Route | Page | Data Source |
|-------|------|-------------|
| `/` | Repositories | `GET /api/repositories` |
| `/repos/:id` | Repository | `GET /api/repositories/:id` + `GET /api/branches?repository_id=:id` |
| `/repos/:id/branches/:branchId` | Branch | `GET /api/conversations?branch_id=:id` + `GET /api/documents?branch_id=:id` |

## Navigation

Breadcrumbs only — no top nav bar or sidebar. A clickable trail appears at the top of every page:

- **Repositories page**: `Repositories` (current, not clickable)
- **Repository page**: `Repositories` > `zeb-dash-v2`
- **Branch page**: `Repositories` > `zeb-dash-v2` > `feature/api`

Repository names display **without the owner prefix** — show `zeb-dash-v2` not `jordanfuzz/zeb-dash-v2`. The owner is kept in the data layer but not rendered.

## Visual Style: Light & Candy

- **Background**: light gray (`#f9fafb`)
- **Cards/containers**: white with soft gray borders (`#e5e7eb`), generous border-radius (10-12px)
- **Text**: dark gray for primary (`#1f2937`), medium gray for secondary (`#6b7280`, `#9ca3af`)
- **Accent colors** cycle through elements: pink (`#f472b6`), blue (`#2563eb`), green (`#059669`), purple (`#6d28d9`), teal (`#0891b2`), amber (`#f59e0b`)
- **Colored dots** next to repository and branch names (color assigned per-item from the accent palette)
- **Tags/badges**: soft colored backgrounds with matching text (e.g., blue bg + blue text for model badges)
- **Spacing**: generous padding and gaps — the design should feel airy and uncluttered
- **Section headers**: small uppercase labels in gray (`BRANCHES`, `CONVERSATIONS`, `PLANS`, `NOTES`)

## Page Designs

### Repositories Page (`/`)

A vertical list of repository cards, or an empty state message if no repositories exist.

Each repository card shows:
- Colored dot + repository name (without owner)
- Branch count, conversation count
- Last active time (relative)

Cards are clickable — navigate to the repository page.

### Repository Page (`/repos/:id`)

A header card with repository details, followed by a branch table.

**Header card:**
- Colored dot + repository name
- Remote URL in small gray text

**Branch table** (inside a white rounded container):
- Column headers: Branch, Last Active
- Each row is clickable — navigates to the branch page
- Branch names are colored (cycling through accent palette)
- Last Active column right-aligned, relative time
- Sorted by newest first (most recently active branches at top)
- Note: Conversation/document count columns are deferred until the API supports aggregate counts per branch. The table starts with just Branch and Last Active.

### Branch Page (`/repos/:id/branches/:branchId`)

A header card with branch details, followed by a two-column layout.

**Header card:**
- Colored dot + branch name
- Summary counts (e.g., "5 conversations · 2 plans · 1 note")

**Two-column layout** (2/3 left, 1/3 right):

**Left — Conversations:**
- Section header: `CONVERSATIONS`
- Vertical list of conversation items
- Each item shows: date, model badge (colored pill), git commit hash (colored, serves as the visual identifier), user name
- Items are not clickable in v1

**Right — Documents sidebar:**
- Two sections stacked: `PLANS` then `NOTES`
- Each document item shows: title (colored — green for plans, amber for notes), date and user
- Items are not clickable in v1
- Documents are separated by `document_type`: `plan` goes under Plans, everything else goes under Notes

### Empty States

Each page has an empty state when there's no data:
- Repositories: "No repositories yet. Push a session with /post-session to get started."
- Repository (no branches): "No branches yet."
- Branch (no conversations): "No conversations yet."
- Sidebar (no plans/notes): Section simply doesn't render

## Component Structure

```
web/src/
├── main.jsx                  -- ReactDOM.createRoot, BrowserRouter
├── App.jsx                   -- Route definitions
├── index.css                 -- Tailwind @import directives
├── components/
│   ├── Breadcrumbs.jsx       -- Clickable breadcrumb trail
│   ├── RepoCard.jsx          -- Single repo in the list
│   ├── BranchTable.jsx       -- Table of branches with column headers
│   ├── ConversationItem.jsx  -- Single conversation in the list
│   ├── DocumentItem.jsx      -- Single plan or note in the sidebar
│   └── EmptyState.jsx        -- Generic empty state message
├── pages/
│   ├── RepositoriesPage.jsx  -- Fetches repos, renders list or empty state
│   ├── RepositoryPage.jsx    -- Fetches repo + branches, renders table
│   └── BranchPage.jsx        -- Fetches conversations + documents, renders two-column layout
└── lib/
    └── api.js                -- Centralized fetch wrapper for /api/* calls
```

### lib/api.js

Thin wrapper around `fetch`. Each function calls an API endpoint and returns the parsed JSON response. Functions:

- `getRepositories()`
- `getRepository(id)`
- `getBranches(repositoryId)`
- `getConversations(branchId)`
- `getDocuments(branchId)`

Base URL is `/api` (proxied by Vite to the API container).

### Color Assignment

Accent colors are assigned deterministically by index — the first repo gets pink, second gets blue, third gets green, etc., cycling through the palette. Same approach for branch names. This keeps colors stable across page loads without needing to store color assignments.

## Monorepo File Layout (after this work)

```
zeb-dash-v2/
├── compose.yml               -- updated with web service
├── web/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       │   ├── Breadcrumbs.jsx
│       │   ├── RepoCard.jsx
│       │   ├── BranchTable.jsx
│       │   ├── ConversationItem.jsx
│       │   ├── DocumentItem.jsx
│       │   └── EmptyState.jsx
│       ├── pages/
│       │   ├── RepositoriesPage.jsx
│       │   ├── RepositoryPage.jsx
│       │   └── BranchPage.jsx
│       └── lib/
│           └── api.js
├── api/
├── scripts/
├── skills/
└── docs/
```

## Out of Scope

- Conversation detail page (next design cycle)
- Document detail/viewer page
- Click handlers on conversation or document items
- Authentication
- Search or filtering in the UI
- Pagination
- Responsive/mobile layout
- Loading skeletons or transitions
- Production build/deployment config

## Verification

1. `docker compose up` — all three services start (db, api, web)
2. Open `http://localhost:5173` — Vite dev server loads the React app
3. Repositories page shows repos from the API (or empty state if none)
4. Click a repository → navigates to repository page, shows branch table
5. Click a branch → navigates to branch page, shows conversations and documents
6. Breadcrumbs navigate correctly at every level
7. API proxy works — no CORS errors in the browser console
8. Seed some test data via the API, verify all pages render correctly with data
