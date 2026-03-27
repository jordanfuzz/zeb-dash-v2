---
name: post-session
description: Use when the user wants to publish their current Claude Code session transcript to the Zeb Dash API
user_invocable: true
---

# Post Session

Publish the current session's transcript to the Zeb Dash API.

## Prerequisites

Before running, verify both of these exist:
- `~/.claude/zeb-dash/config.json` — user configuration
- `~/.claude/zeb-dash/post-session.py` — helper script

If either is missing, tell the user they need to install the Zeb Dash tools. Do not proceed.

## Steps

1. **Locate the transcript file.** The transcript is stored at:
   ```
   ~/.claude/projects/[encoded-cwd]/[sessionId].jsonl
   ```
   Where `[encoded-cwd]` is the current working directory with each `/` replaced by `-` (e.g., `/Users/foo/repos/bar` becomes `-Users-foo-repos-bar`), and `[sessionId]` is the current session's UUID.

2. **Verify the transcript file exists.** If it doesn't, tell the user the transcript could not be found and stop.

3. **Run the helper script:**
   ```bash
   python3 ~/.claude/zeb-dash/post-session.py [path-to-transcript.jsonl]
   ```

4. **Report the result.** Relay the script's output to the user — either a success message with the HTTP status, or the specific error explaining what went wrong (missing config, repo not whitelisted, branch blacklisted, etc.).

## Allowed Tools

Bash, Read, Glob
