# Claude Code Integration

This guide explains how to integrate Waymark into Claude Code. It covers both integration surfaces — the MCP server and the skills — and includes step-by-step verification instructions for both human developers and AI agents.

---

## Two Integration Surfaces

Waymark exposes two ways to interact with the knowledge graph from inside Claude Code:

### MCP Server: `waymark-mcp`

The `waymark-mcp` binary runs as an MCP (Model Context Protocol) server. Claude Code connects to it at session start and exposes its tools to the AI agent. Agents use these tools to write nodes to the graph (decisions, open questions, blockers, context) and to query the graph for relevant context.

The MCP server is the primary write/read interface for automated use — the AI does not invoke skills to update the graph; it calls MCP tools directly.

### Skills: `/waymark`, `/waymark-resolve`, `/waymark-write`

Skills are slash commands that humans invoke in Claude Code's chat interface. They wrap the MCP tools in higher-level, conversational workflows:

- `/waymark` — show the current trail: open questions, blockers, recent decisions
- `/waymark-write` — interactively add a node (decision, question, blocker, context) to the graph
- `/waymark-resolve` — mark an open question or blocker as resolved

Skills are intended for human use. Agents should call the MCP tools directly rather than invoking skills.

---

## MCP Server Setup

### After Running `install.sh`

The installer places the `waymark-mcp` binary at `~/.local/bin/waymark-mcp` and adds it to your `PATH`. Add the following to `~/.claude/settings.json` under the `mcpServers` key:

```json
{
  "mcpServers": {
    "waymark": {
      "command": "waymark-mcp"
    }
  }
}
```

Claude Code will launch `waymark-mcp` at session start and keep it running for the duration of the session.

### Without `install.sh` — Using the Full Path

If you have not run the installer, or you want to point Claude Code at a local development build, use the full path to the compiled binary:

```json
{
  "mcpServers": {
    "waymark": {
      "command": "node",
      "args": ["/absolute/path/to/waymark-plugin/packages/core/dist/bin/waymark-mcp.js"],
      "env": {
        "WAYMARK_PROJECT_ROOT": "/absolute/path/to/your/project"
      }
    }
  }
}
```

Replace both paths with absolute paths — relative paths will not work because Claude Code may start the MCP server from a different working directory.

### The `WAYMARK_PROJECT_ROOT` Environment Variable

The MCP server needs to know which project's credentials to use when connecting to Neo4j. It resolves Neo4j configuration (see [neo4j-setup.md](./neo4j-setup.md)) relative to a project root directory.

- If `WAYMARK_PROJECT_ROOT` is set, the server reads the `.env` file from that directory.
- If `WAYMARK_PROJECT_ROOT` is not set, the server defaults to `process.cwd()` — whatever directory the process was started from.

When Claude Code starts the MCP server, `cwd` may not be your project directory. Setting `WAYMARK_PROJECT_ROOT` explicitly in the MCP server's `env` block ensures the server always finds the right `.env` file regardless of how Claude Code launches it.

---

## Skills Setup

### After Running `install.sh`

The installer creates symlinks in `~/.claude/plugins/skills/`. Verify they exist:

```bash
ls ~/.claude/plugins/skills/waymark/
ls ~/.claude/plugins/skills/waymark-resolve/
ls ~/.claude/plugins/skills/waymark-write/
ls ~/.claude/plugins/skills/neo4j-cli-tools-skill/
```

Each command should list the skill's files. If any directory is missing or empty, re-run `install.sh` or set up the symlinks manually (see below).

### Manual Setup Without `install.sh`

```bash
mkdir -p ~/.claude/plugins/skills

ln -s /path/to/waymark-plugin/skills/waymark ~/.claude/plugins/skills/waymark
ln -s /path/to/waymark-plugin/skills/waymark-resolve ~/.claude/plugins/skills/waymark-resolve
ln -s /path/to/waymark-plugin/skills/waymark-write ~/.claude/plugins/skills/waymark-write
```

Replace `/path/to/waymark-plugin` with the absolute path to the `waymark-plugin` directory in your clone of this repository.

After creating the symlinks, restart Claude Code for the skills to be discovered.

---

## The SessionStart Hook

`waymark-plugin/hooks/hooks.json` defines a `SessionStart` hook. When Claude Code starts a new session, this hook runs automatically and reads `.waymark/config.json` in the current project.

The hook announces:
- Open questions that have not been resolved
- Active blockers
- A brief summary of recent decisions

This gives the agent immediate context at the start of every session, without requiring the human to manually invoke `/waymark` first.

The `.waymark/config.json` file is written by the MCP server's write operations. It is a lightweight index used by the hook; the full graph lives in Neo4j.

With the plugin installed via `install.sh`, Claude Code automatically discovers and loads `hooks.json`. If you are setting up manually, ensure the plugin directory is registered with Claude Code so hooks are picked up.

---

## Verifying the Integration

Run through this checklist after completing setup. Both humans and AI agents can use these steps to confirm everything is working end to end.

### Checklist

- [ ] **Verify Neo4j is running**:
  ```bash
  cypher-shell -a $NEO4J_URI -u $NEO4J_USERNAME -p $NEO4J_PASSWORD "RETURN 1"
  ```
  Expect: output `1` with no connection errors. If this fails, fix your Neo4j setup before continuing.

- [ ] **Verify the MCP server binary exists**:
  ```bash
  which waymark-mcp || ls /absolute/path/to/dist/bin/waymark-mcp.js
  ```
  Expect: the path is printed. If missing, run `pnpm build` (see [plugin-build.md](./plugin-build.md)).

- [ ] **Verify the MCP server starts**:
  ```bash
  waymark-mcp
  ```
  The process will hang, waiting for MCP input on stdin. This is correct — press Ctrl+C. If it crashes immediately with a stacktrace, the build is broken or Neo4j credentials are missing.

- [ ] **Verify the MCP server appears in Claude Code**:
  Open Claude Code and look for "waymark" in the MCP tools list (accessible via the tool picker or by asking the agent to list available tools). If it is missing, check `~/.claude/settings.json` for the `mcpServers` entry.

- [ ] **Verify `/waymark` skill works**:
  In Claude Code, run `/waymark`. It should display an empty trail (if the graph is empty) or a list of existing nodes. If the skill is not found, check that the symlink in `~/.claude/plugins/skills/waymark/` exists and Claude Code has been restarted.

- [ ] **Test a write operation**:
  Run `/waymark-write open-question` and follow the prompts to create a test question node in the graph.

- [ ] **Confirm the node is readable**:
  Run `/waymark` again and confirm the test question appears in the output.

- [ ] **Test resolution**:
  Run `/waymark-resolve <id>` with the ID of the test question you just created. Confirm the skill marks it as resolved and it no longer appears as open when you run `/waymark`.

---

## Project-Specific vs Global Credentials

Waymark resolves Neo4j credentials at three levels (see [neo4j-setup.md](./neo4j-setup.md) for full details):

| Source | Scope | Path |
|---|---|---|
| Global config | All projects on the machine | `~/.waymark/neo4j.env` |
| Project `.env` | One project | `<project-root>/.env` |
| MCP server `env` block | One Claude Code MCP entry | `~/.claude/settings.json` |

The recommended approach for most users is to put credentials in `~/.waymark/neo4j.env` and use `WAYMARK_PROJECT_ROOT` in the MCP config to point each project at its own root directory. If a project uses a different Neo4j instance, add a `.env` file to that project's root to override the global credentials for that project.

Example `~/.claude/settings.json` with per-project roots:

```json
{
  "mcpServers": {
    "waymark": {
      "command": "waymark-mcp",
      "env": {
        "WAYMARK_PROJECT_ROOT": "/Users/you/projects/my-project"
      }
    }
  }
}
```

---

## For AI Agents: Using MCP Tools Directly

When Waymark's MCP server is connected, the following tools are available to the agent. Call these tools directly rather than invoking skills — skills are designed for interactive human use.

| Tool | Description |
|---|---|
| `waymark_write_decision` | Record a decision that was made, with rationale and alternatives considered |
| `waymark_write_open_question` | Record an open question that needs an answer before proceeding |
| `waymark_write_blocker` | Record a blocker that is preventing progress |
| `waymark_write_context` | Record background context, constraints, or reference information |
| `waymark_resolve` | Mark an open question or blocker as resolved, with the resolution detail |
| `waymark_search` | Search the graph for nodes relevant to a topic or keyword |
| `waymark_trail` | Retrieve the current trail — recent decisions, open questions, and blockers |
| `waymark_get` | Retrieve a specific node by its ID |

For full parameter schemas and examples for each tool, see `docs/architecture/mcp-server.md`.

Agents should write to the graph proactively during development — recording decisions as they are made, open questions as they arise, and blockers as they are encountered. This keeps the graph accurate and useful for future sessions.
