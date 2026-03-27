#!/usr/bin/env python3
"""Post a Claude Code session transcript to the Zeb Dash API."""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

CONFIG_PATH = os.path.expanduser("~/.claude/zeb-dash/config.json")
REQUIRED_CONFIG_FIELDS = ["endpoint", "user_name", "whitelisted_repos"]


def fatal(msg):
    print(f"Error: {msg}", file=sys.stderr)
    sys.exit(1)


def load_config():
    if not os.path.isfile(CONFIG_PATH):
        fatal(f"Config not found at {CONFIG_PATH}")
    with open(CONFIG_PATH) as f:
        try:
            config = json.load(f)
        except json.JSONDecodeError as e:
            fatal(f"Invalid JSON in config: {e}")
    for field in REQUIRED_CONFIG_FIELDS:
        if not config.get(field):
            fatal(f"Missing required config field: {field}")
    config.setdefault("blacklisted_branches", [])
    return config


def git(args):
    result = subprocess.run(
        ["git"] + args,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def parse_repo_from_remote(remote_url):
    """Extract owner/repo from any git remote URL format.

    Handles:
      https://github.com/owner/repo.git
      git@github.com:owner/repo.git
      ssh://git@github.com/owner/repo.git
    """
    # Strip .git suffix
    url = remote_url.rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    # SSH shorthand: git@host:owner/repo
    match = re.match(r"^[\w.-]+@[\w.-]+:(.+)$", url)
    if match:
        return match.group(1)

    # HTTPS or ssh:// protocol: extract last two path segments
    match = re.match(r"^(?:https?|ssh)://[^/]+/(.+)$", url)
    if match:
        return match.group(1)

    return None


def parse_transcript(filepath):
    """Read transcript JSONL and extract session_id, claude_model, claude_version."""
    session_id = None
    claude_model = None
    claude_version = None

    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            if session_id is None and "sessionId" in entry:
                session_id = entry["sessionId"]
            if claude_version is None and "version" in entry:
                claude_version = entry["version"]
            if claude_model is None and entry.get("type") == "assistant":
                msg = entry.get("message", {})
                if "model" in msg:
                    claude_model = msg["model"]

            if session_id and claude_version and claude_model:
                break

    return session_id, claude_model, claude_version


def main():
    if len(sys.argv) != 2:
        print("Usage: post-session.py <path-to-transcript.jsonl>", file=sys.stderr)
        sys.exit(1)

    transcript_path = sys.argv[1]
    if not os.path.isfile(transcript_path):
        fatal(f"Transcript file not found: {transcript_path}")

    config = load_config()

    # Git metadata
    remote_url = git(["remote", "get-url", "origin"])
    if remote_url is None:
        fatal("Not in a git repository or no 'origin' remote configured")

    repo = parse_repo_from_remote(remote_url)
    if repo is None:
        fatal(f"Could not parse owner/repo from remote URL: {remote_url}")

    # Whitelist check
    if repo not in config["whitelisted_repos"]:
        fatal(f"Repository '{repo}' is not in whitelisted_repos")

    branch = git(["branch", "--show-current"])
    if branch is None or branch == "":
        fatal("Could not determine current branch (detached HEAD?)")

    # Blacklist check
    if branch in config["blacklisted_branches"]:
        fatal(f"Branch '{branch}' is in blacklisted_branches")

    commit = git(["rev-parse", "--short", "HEAD"])
    if commit is None:
        fatal("Could not determine current git commit")

    # Transcript
    session_id, claude_model, claude_version = parse_transcript(transcript_path)
    if session_id is None:
        fatal("Could not extract session_id from transcript")

    with open(transcript_path) as f:
        transcript_content = f.read()

    # Build payload
    payload = {
        "session_id": session_id,
        "user_name": config["user_name"],
        "repo": repo,
        "branch": branch,
        "git_commit": commit,
        "git_remote": remote_url,
        "claude_model": claude_model,
        "claude_version": claude_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "transcript": transcript_content,
    }

    # POST
    endpoint = config["endpoint"]
    data = json.dumps(payload).encode("utf-8")
    req = Request(endpoint, data=data, method="POST")
    req.add_header("Content-Type", "application/json")

    try:
        response = urlopen(req)
        status = response.getcode()
        body = response.read().decode("utf-8", errors="replace")
        print(f"Success: HTTP {status}")
        if body:
            print(body)
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        fatal(f"POST failed: HTTP {e.code} — {body}")
    except URLError as e:
        fatal(f"POST failed: {e.reason}")


if __name__ == "__main__":
    main()
