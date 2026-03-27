# Post-Session Skill Design

## Context

Zeb Dash V2 is a team dashboard for viewing and sharing Claude Code conversations across a shared repository with multiple branches. The `/post-session` skill is the first component: a manual "push" that publishes the current session's transcript to the Zeb Dash REST API.

This replaces the existing `/post-session` skill at `~/.claude/commands/post-session.md`. The new version is narrower in scope — it posts only the transcript and metadata (no plan files, no CLAUDE.md, no summary). Those will be handled by separate skills later.

## Architecture

Two files, both installed to the user's `~/.claude/zeb-dash/` directory:

1. **`config.json`** — user configuration (endpoint, identity, repo/branch rules)
2. **`post-session.py`** — standalone Python 3 script that does all the work

Plus a skill file in the monorepo:

3. **`skills/post-session/SKILL.md`** — thin orchestration layer that tells Claude how to locate the transcript and invoke the script

### Data Flow

```
User runs /post-session
  → Claude locates transcript JSONL file
  → Claude invokes post-session.py with the file path
  → Script reads config, validates repo/branch, gathers git metadata
  → Script POSTs JSON payload to the API endpoint
  → Claude reports success or failure to the user
```

## Config File

**Location**: `~/.claude/zeb-dash/config.json`

```json
{
  "endpoint": "https://your-api.example.com/api/sessions",
  "user_name": "Jordan Cooper",
  "whitelisted_repos": [
    "team/repo-one",
    "team/repo-two"
  ],
  "blacklisted_branches": [
    "main",
    "production"
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `endpoint` | Yes | Full URL for the POST request |
| `user_name` | Yes | Display name for the dashboard |
| `whitelisted_repos` | Yes | List of `owner/repo` strings. If the current repo is not listed, the post is **hard blocked**. Repos must be added manually. |
| `blacklisted_branches` | No (defaults to `[]`) | List of branch names. If the current branch matches, the post is **hard blocked**. Exact match only. |

### Whitelist/Blacklist Behavior

- **Repositories (whitelist)**: Opt-in. A repo must be explicitly listed to allow posting. This is a safety boundary — especially important for the future automatic hook, which should never post from an unauthorized repo.
- **Branches (blacklist)**: Opt-out. All branches are allowed by default. Specific branches can be blocked (e.g., `main`, `production`). Must be manually removed from the blacklist to unblock.

## POST Payload

```json
{
  "session_id": "661d9150-6d6d-4d00-a4ef-3f32ee8befc6",
  "user_name": "Jordan Cooper",
  "repo": "team/repo-name",
  "branch": "feature/my-branch",
  "git_commit": "a1b2c3d",
  "git_remote": "git@github.com:team/repo-name.git",
  "claude_model": "claude-opus-4-6",
  "claude_version": "1.0.33",
  "timestamp": "2026-03-27T04:12:00Z",
  "transcript": "...full JSONL content as a string..."
}
```

### Field Details

| Field | Source |
|-------|--------|
| `session_id` | Extracted from the first entry in the JSONL transcript |
| `user_name` | From `config.json` |
| `repo` | Parsed from `git remote get-url origin` → `owner/repo` |
| `branch` | From `git branch --show-current` |
| `git_commit` | From `git rev-parse --short HEAD` |
| `git_remote` | Full output of `git remote get-url origin` (unparsed) |
| `claude_model` | Extracted from JSONL transcript metadata |
| `claude_version` | Extracted from JSONL transcript metadata |
| `timestamp` | ISO 8601 UTC, when the POST is made |
| `transcript` | Raw JSONL file content as a single string |

## Helper Script

**Location**: `~/.claude/zeb-dash/post-session.py`
**Source in monorepo**: `scripts/post-session.py`

**Language**: Python 3 — no pip dependencies. Uses only standard library modules: `json`, `urllib.request`, `subprocess`, `os`, `sys`, `re`, `datetime`.

### Execution Flow

1. **Accept arguments**: One required arg — path to the transcript JSONL file.
2. **Read config**: Load `~/.claude/zeb-dash/config.json`. Validate required fields (`endpoint`, `user_name`, `whitelisted_repos`).
3. **Parse repo identity**: Run `git remote get-url origin`. Parse `owner/repo` from any URL format:
   - HTTPS: `https://github.com/owner/repo.git` → `owner/repo`
   - SSH: `git@github.com:owner/repo.git` → `owner/repo`
   - SSH protocol: `ssh://git@github.com/owner/repo.git` → `owner/repo`
   - Strip `.git` suffix if present.
4. **Check whitelist**: If parsed `owner/repo` is not in `whitelisted_repos`, exit with error.
5. **Get branch**: Run `git branch --show-current`.
6. **Check blacklist**: If branch is in `blacklisted_branches`, exit with error.
7. **Get git commit**: Run `git rev-parse --short HEAD`.
8. **Read transcript**: Read the JSONL file. Parse the first line to extract `session_id`, `claude_model`, and `claude_version` (from the `version` and `model` fields in transcript entries).
9. **Build payload**: Assemble the JSON object per the payload spec above.
10. **POST**: Send via `urllib.request.urlopen` with `Content-Type: application/json`.
11. **Report result**: Print success with HTTP status, or failure with status and response body. Exit 0 on success (2xx), exit 1 on any failure.

### Error Messages

Each failure mode produces a clear, actionable message:

- `"Config not found at ~/.claude/zeb-dash/config.json"`
- `"Missing required config field: <field>"`
- `"Repository '<owner/repo>' is not in whitelisted_repos"`
- `"Branch '<branch>' is in blacklisted_branches"`
- `"Transcript file not found: <path>"`
- `"Not in a git repository"`
- `"POST failed: HTTP <status> — <response body>"`

## Skill File

**Location in monorepo**: `skills/post-session/SKILL.md`

### Frontmatter

```yaml
---
name: post-session
description: Use when the user wants to publish their current Claude Code session transcript to the Zeb Dash API
user_invocable: true
---
```

### Instructions

The skill tells Claude to:

1. **Locate the transcript**: The transcript is at `~/.claude/projects/` in a subdirectory named after the current working directory with `/` replaced by `-` (e.g., `/Users/foo/repos/bar` → `-Users-foo-repos-bar`). The file is `[sessionId].jsonl`.
2. **Verify script exists**: Check that `~/.claude/zeb-dash/post-session.py` is present. If not, tell the user they need to install it.
3. **Verify config exists**: Check that `~/.claude/zeb-dash/config.json` is present. If not, tell the user they need to set up their config.
4. **Run the script**: `python3 ~/.claude/zeb-dash/post-session.py /path/to/transcript.jsonl`
5. **Report the result**: Relay the script's stdout to the user.

**Allowed tools**: `Bash`, `Read`, `Glob`

## Out of Scope

- No `--preview` flag (can add later)
- No summary generation (deferred — may be added to skill or API later)
- No plan file posting (separate skill)
- No CLAUDE.md posting (separate skill)
- No subagent transcript inclusion (main session JSONL only)
- No automatic hook (future skill)
- No install/distribution script (future concern)
- No custom HTTP headers in config (add when the API needs auth)

## Monorepo File Layout

```
zeb-dash-v2/
├── skills/
│   └── post-session/
│       └── SKILL.md
├── scripts/
│   └── post-session.py
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-27-post-session-skill-design.md
```

## Verification

1. **Script unit testing**: Run `post-session.py` with a sample JSONL file against a mock endpoint (e.g., httpbin.org/post or a local server) and verify the payload shape.
2. **Whitelist enforcement**: Run from a repo not in `whitelisted_repos` — should hard block with clear error.
3. **Blacklist enforcement**: Run from a blacklisted branch — should hard block with clear error.
4. **Missing config**: Remove or rename config.json — should fail with clear error.
5. **Skill invocation**: Run `/post-session` in Claude Code from a whitelisted repo — should locate transcript, invoke script, and report result.
6. **Remote URL parsing**: Test with HTTPS, SSH, and ssh:// protocol URLs to confirm `owner/repo` extraction works for all formats.
