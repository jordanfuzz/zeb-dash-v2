# API and Database Design

## Context

Zeb Dash V2 needs a REST API and Postgres database to receive, store, and serve Claude Code session data. The API is the central hub: Claude Code skills POST data to it, the dashboard reads from it, and future Claude commands (like `/download-session`) will fetch from it.

This spec covers the API (Node.js/Express), database schema (Postgres), and Docker setup. The frontend is a separate design cycle.

## Architecture Overview

Three Docker services orchestrated by `compose.yml`:

```
┌──────────────────────────────────────────────────┐
│  Docker Compose                                  │
│                                                  │
│  ┌──────────────┐       ┌──────────────────┐     │
│  │   api        │       │   db             │     │
│  │   Express    │──────▶│   Postgres 16    │     │
│  │   :3000      │       │   :5432 (int)    │     │
│  └──────┬───────┘       └──────────────────┘     │
│         │                       │                │
└─────────┼───────────────────────┼────────────────┘
          │                       │
     host:3000               host:5433
          │
    ┌─────┴──────┐
    │ Consumers  │
    │ - Dashboard│
    │ - Skills   │
    │ - Scripts  │
    └────────────┘
```

- **API** is the only service exposed for application use. Built from `./api`.
- **Postgres** data persisted via a named Docker volume. Host port 5433 (5432 is in use).
- **Migrations** run automatically on API startup — `docker compose up` gives you a working environment from scratch.

## Database Schema

All tables use UUID primary keys via Postgres's `gen_random_uuid()`.

### users

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `name` | `TEXT` | `UNIQUE NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

Auto-created on first ingest when a new `user_name` is encountered. No auth.

### repositories

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `owner` | `TEXT` | `NOT NULL` |
| `name` | `TEXT` | `NOT NULL` |
| `remote_url` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| | | `UNIQUE(owner, name)` |

`owner` is the org/user (e.g., `jordanfuzz`), `name` is the repo (e.g., `zeb-dash-v2`). Together they form the `owner/repo` identifier used by the post-session script. `remote_url` stores the full git remote URL, updated to the latest value on each ingest.

### branches

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `repository_id` | `UUID` | `REFERENCES repositories(id) NOT NULL` |
| `name` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |
| | | `UNIQUE(repository_id, name)` |

Auto-created on ingest. Purely organizational — no code is stored.

### conversations

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY` |
| `user_id` | `UUID` | `REFERENCES users(id) NOT NULL` |
| `branch_id` | `UUID` | `REFERENCES branches(id) NOT NULL` |
| `git_commit` | `TEXT` | |
| `claude_model` | `TEXT` | |
| `claude_version` | `TEXT` | |
| `transcript` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

The `id` is the Claude `session_id` — passed directly from the ingest payload, not auto-generated. This makes the conversation's PK match the session UUID that Claude already uses, and naturally prevents duplicates.

`transcript` stores the raw JSONL content as plain text. Postgres `text` has no practical size limit.

### documents

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `document_type` | `TEXT` | `NOT NULL` |
| `title` | `TEXT` | |
| `content` | `TEXT` | `NOT NULL` |
| `user_id` | `UUID` | `REFERENCES users(id) NOT NULL` |
| `branch_id` | `UUID` | `REFERENCES branches(id) NOT NULL` |
| `conversation_id` | `UUID` | `REFERENCES conversations(id)` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

`document_type` distinguishes plans from other markdown files (e.g., `'plan'`, `'markdown'`). `conversation_id` is nullable — plans linked to a session get the FK, standalone uploads don't.

## API Structure

```
api/
├── server.js              -- Express app setup, middleware, listen
├── routes/
│   ├── conversations.js   -- POST + GET endpoints
│   ├── documents.js       -- POST + GET endpoints
│   ├── repositories.js    -- GET endpoints
│   ├── branches.js        -- GET endpoints
│   └── users.js           -- GET endpoints
├── db/
│   ├── pool.js            -- pg Pool singleton
│   └── migrations/        -- numbered SQL migration files
├── middleware/
│   └── errors.js          -- error handling middleware
├── Dockerfile
└── package.json
```

### Dependencies

- `express` — HTTP framework
- `pg` — Postgres client
- `node-pg-migrate` — lightweight SQL migration runner

No other runtime dependencies.

## API Endpoints

### Conversations

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/conversations` | Ingest from /post-session |
| `GET` | `/api/conversations` | List conversations (filterable) |
| `GET` | `/api/conversations/:id` | Get single conversation with transcript |

### Documents

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/documents` | Ingest from future skills |
| `GET` | `/api/documents` | List documents (filterable) |
| `GET` | `/api/documents/:id` | Get single document with content |

### Repositories

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/repositories` | List all repositories |
| `GET` | `/api/repositories/:id` | Get single repository |

### Branches

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/branches` | List branches (filterable by repository_id) |

### Users

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/users` | List all users |

### List Behavior

All list endpoints (`GET` collections) return rows **without** large text fields (`transcript`, `content`). Those are only included on single-resource GETs. This keeps list responses lightweight.

### Query Parameters

List endpoints support basic filtering:

- `/api/conversations?repo_id=...&branch_id=...&user_id=...`
- `/api/documents?repo_id=...&branch_id=...&user_id=...&document_type=...`
- `/api/branches?repository_id=...`

No pagination in v1.

## Ingest Contract: POST /api/conversations

### Request Body

Matches the post-session script payload exactly:

```json
{
  "session_id": "661d9150-6d6d-4d00-a4ef-3f32ee8befc6",
  "user_name": "Jordan Cooper",
  "repo": "jordanfuzz/zeb-dash-v2",
  "branch": "feature/my-branch",
  "git_commit": "a1b2c3d",
  "git_remote": "git@github.com:jordanfuzz/zeb-dash-v2.git",
  "claude_model": "claude-opus-4-6",
  "claude_version": "1.0.33",
  "timestamp": "2026-03-27T04:12:00Z",
  "transcript": "...full JSONL content as a string..."
}
```

### Ingest Flow

1. Validate required fields: `session_id`, `user_name`, `repo`, `branch`, `transcript`
2. Parse `repo` ("owner/repo") into `owner` and `name`
3. Upsert user by `user_name` → get `user_id`
4. Upsert repository by `owner` + `name` → get `repository_id`
5. Update `remote_url` on the repository if provided
6. Upsert branch by `name` + `repository_id` → get `branch_id`
7. Insert conversation row using `session_id` as the PK
8. Return 201

### Responses

| Status | Meaning |
|--------|---------|
| `201` | `{ "id": "661d9150-...", "message": "Conversation ingested successfully" }` |
| `400` | Missing required fields — response body names the missing field(s) |
| `409` | Duplicate `session_id` — conversation already exists |
| `413` | Payload too large (exceeds body limit) |
| `500` | Internal server error |

## Ingest Contract: POST /api/documents

### Request Body

```json
{
  "document_type": "plan",
  "title": "Implementation Plan: Feature X",
  "content": "...raw markdown...",
  "user_name": "Jordan Cooper",
  "repo": "jordanfuzz/zeb-dash-v2",
  "branch": "feature/my-branch",
  "conversation_id": "661d9150-..."
}
```

`conversation_id` is optional. `title` is optional.

### Ingest Flow

Same upsert pattern as conversations: resolve user, repo, branch, then insert the document.

### Responses

| Status | Meaning |
|--------|---------|
| `201` | `{ "id": "...", "message": "Document ingested successfully" }` |
| `400` | Missing required fields |
| `404` | `conversation_id` provided but not found |
| `500` | Internal server error |

## Docker Setup

### compose.yml Services

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| `api` | Built from `./api` | `3000:3000` | Express API server |
| `db` | `postgres:16` | `5433:5432` | Postgres database |

### Configuration

Environment variables set in `compose.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://zeb:zeb@db:5432/zebdash` | Postgres connection string |
| `PORT` | `3000` | API listen port |
| `BODY_LIMIT` | `10mb` | Max request body size |

### Startup

- `db` service includes a healthcheck. `api` uses `depends_on` with `condition: service_healthy`.
- On startup, the API runs pending migrations via `node-pg-migrate`, then starts listening.
- `docker compose up` from a clean state gives you a fully working environment.

### Persistence

Postgres data stored in a named volume (`zeb-db-data`). Survives container restarts and rebuilds.

## Monorepo File Layout (after this work)

```
zeb-dash-v2/
├── compose.yml
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── routes/
│   │   ├── conversations.js
│   │   ├── documents.js
│   │   ├── repositories.js
│   │   ├── branches.js
│   │   └── users.js
│   ├── db/
│   │   ├── pool.js
│   │   └── migrations/
│   │       └── 001_initial-schema.sql
│   └── middleware/
│       └── errors.js
├── scripts/
│   └── post-session.py
├── skills/
│   └── post-session/
│       └── SKILL.md
└── docs/
    └── superpowers/
        └── specs/
```

## Out of Scope

- Authentication/authorization
- PUT/PATCH endpoints (updates to existing records)
- Frontend service in Docker
- Document ingest skill (endpoint exists but no Claude skill to call it yet)
- Full-text search or advanced querying
- Pagination on list endpoints
- Rate limiting
- Production deployment (Docker Compose is the local dev target for now)

## Verification

1. `docker compose up` starts both services, migrations run, API is healthy
2. `POST /api/conversations` with the post-session payload → 201, data visible in Postgres
3. `POST /api/conversations` with same `session_id` → 409
4. `POST /api/conversations` with missing fields → 400 with specific error
5. `GET /api/conversations` → list without transcript bodies
6. `GET /api/conversations/:id` → full record with transcript
7. `GET /api/repositories` → shows auto-created repo
8. `GET /api/branches?repository_id=...` → shows auto-created branch
9. `POST /api/documents` with and without `conversation_id` → both work
10. Large transcript (several MB) ingests successfully
11. Run the actual `post-session.py` script against the local API → end-to-end success
