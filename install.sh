#!/usr/bin/env bash
set -euo pipefail

WAYMARK_HOME="$HOME/.waymark"
REPO_DIR="$WAYMARK_HOME/repo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR/waymark-plugin"

echo "[waymark] Starting installation..."

# ── Clone or update repo ──────────────────────────────────────────────────────
if [ -d "$REPO_DIR/.git" ]; then
  echo "[waymark] Updating existing install at $REPO_DIR..."
  git -C "$REPO_DIR" pull --ff-only
  PLUGIN_DIR="$REPO_DIR/waymark-plugin"
else
  echo "[waymark] First-time install — cloning to $REPO_DIR..."
  mkdir -p "$WAYMARK_HOME"
  REMOTE_URL="$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null || echo 'https://github.com/akimkelar/waymark')"
  git clone "$REMOTE_URL" "$REPO_DIR"
  PLUGIN_DIR="$REPO_DIR/waymark-plugin"
fi

# ── Build @waymark/core ───────────────────────────────────────────────────────
echo "[waymark] Building @waymark/core..."
cd "$REPO_DIR"
pnpm install --frozen-lockfile
pnpm build

# ── Claude Code: symlink skills ───────────────────────────────────────────────
CLAUDE_SKILLS_DIR="$HOME/.claude/plugins/skills"
if [ -d "$HOME/.claude" ]; then
  mkdir -p "$CLAUDE_SKILLS_DIR"
  for skill_dir in "$PLUGIN_DIR/skills"/*/; do
    skill_name="$(basename "$skill_dir")"
    target="$CLAUDE_SKILLS_DIR/$skill_name"
    [ -L "$target" ] && rm "$target"
    ln -s "$skill_dir" "$target"
    echo "[waymark] Skill linked: $skill_name"
  done
  echo "[waymark] Claude Code skills installed."
fi

# ── waymark-mcp binary ────────────────────────────────────────────────────────
MCP_BIN="$REPO_DIR/waymark-plugin/packages/core/dist/bin/waymark-mcp.js"
BIN_DIR="$HOME/.local/bin"
MCP_LINK="$BIN_DIR/waymark-mcp"
mkdir -p "$BIN_DIR"
[ -L "$MCP_LINK" ] && rm "$MCP_LINK"
ln -s "$MCP_BIN" "$MCP_LINK"
echo "[waymark] waymark-mcp binary linked: $MCP_LINK"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "[waymark] Installation complete."
echo ""
echo "Next steps:"
echo ""
echo "  1. Configure Neo4j credentials (pick one):"
echo "     a) Create ~/.waymark/neo4j.env:"
echo "        NEO4J_URI=neo4j://127.0.0.1:7687"
echo "        NEO4J_USERNAME=neo4j"
echo "        NEO4J_PASSWORD=yourpassword"
echo "        NEO4J_DATABASE=waymark"
echo ""
echo "     b) Set env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD"
echo ""
echo "     c) Create .env at your project root with the same vars"
echo ""
echo "  2. Add waymark-mcp to Claude Code (~/.claude/settings.json):"
echo '     { "mcpServers": { "waymark": { "command": "waymark-mcp" } } }'
echo ""
echo "  3. In Claude Code, run /waymark to read your trail."
