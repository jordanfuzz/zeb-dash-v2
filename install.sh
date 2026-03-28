#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
ZEB_DIR="$CLAUDE_DIR/zeb-dash"
SKILLS_DIR="$CLAUDE_DIR/skills"

echo "Installing Zeb Dash tools..."

# Create directories
mkdir -p "$ZEB_DIR"
mkdir -p "$SKILLS_DIR/post-session"

# Copy helper script
cp "$SCRIPT_DIR/scripts/post-session.py" "$ZEB_DIR/post-session.py"
chmod +x "$ZEB_DIR/post-session.py"
echo "  Installed post-session.py → $ZEB_DIR/post-session.py"

# Copy skill
cp "$SCRIPT_DIR/skills/post-session/SKILL.md" "$SKILLS_DIR/post-session/SKILL.md"
echo "  Installed post-session skill → $SKILLS_DIR/post-session/SKILL.md"

# Create config (only if it doesn't exist)
if [ ! -f "$ZEB_DIR/config.json" ]; then
  cat > "$ZEB_DIR/config.json" << 'EOF'
{
  "endpoint": "",
  "user_name": "",
  "whitelisted_repos": [],
  "blacklisted_branches": []
}
EOF
  echo "  Created config template → $ZEB_DIR/config.json"
  echo ""
  echo "Edit $ZEB_DIR/config.json to configure your setup:"
  echo "  endpoint           — API URL (e.g. http://localhost:3000/api/conversations)"
  echo "  user_name          — your display name"
  echo "  whitelisted_repos  — repos to allow posting from (e.g. [\"owner/repo\"])"
  echo "  blacklisted_branches — branches to block (e.g. [\"main\", \"production\"])"
else
  echo "  Config already exists at $ZEB_DIR/config.json (not overwritten)"
fi

echo ""
echo "Done! Run /post-session in Claude Code to publish a session."
