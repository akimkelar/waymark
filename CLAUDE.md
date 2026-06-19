# Waymark — Claude Guide

## Project

Waymark is a write-first Neo4j communication layer for AI agents. Agents write structured nodes (OpenQuestion, Blocker, Gap, Decision, Alternative, Task, Domain, Feature) during execution. Humans read the trail, make Decisions, and agents continue.

## Key concepts

- **Node types**: OpenQuestion, Blocker, Gap, Decision, Alternative, Task, Domain, Feature
- **Direction**: Agent writes → Neo4j graph → Human reviews → Decision written → Agent resumes
- **DDD alignment**: nodes link to `Domain` and `Feature` for scoping
- **MCP server**: `waymark-mcp` binary — agents use it to write and read the graph

## Repository layout

```
README.md                                    — user-facing project overview
CLAUDE.md                                    — this file
AGENTS.md                                    — agent-focused guide
install.sh                                   — one-command install for Claude Code / Codex
.claude-plugin/plugin.json                   — Claude Code plugin metadata
waymark-plugin/
  hooks/hooks.json                           — SessionStart hook
  skills/waymark/SKILL.md                    — /waymark skill (read the trail)
  skills/waymark-resolve/SKILL.md            — /waymark-resolve skill (resolve a question)
  skills/waymark-write/SKILL.md              — /waymark-write skill (write any node)
  skills/neo4j-cli-tools-skill/SKILL.md      — Neo4j CLI reference
  packages/core/src/
    types.ts                                 — node/edge types, status unions, interfaces
    schema.ts                                — Neo4j label and relationship converters
    lifecycle.ts                             — status transition rules per node type
    neo4j-config.ts                          — config manager (env chain, .env parsing)
    neo4j-session.ts                         — driver session factory (explicit errors)
    mcp-server/                              — MCP server implementation
    bin/waymark-mcp.ts                       — CLI entry point
docs/
  architecture/
    overview.md                              — why Waymark exists, the write→review→decide cycle
    graph-schema.md                          — Neo4j schema: nodes, edges, Cypher examples
    mcp-server.md                            — MCP tools reference, agent usage patterns
  configuration/
    neo4j-setup.md                           — Neo4j config, credentials, database creation
    plugin-build.md                          — build steps, AI agent checklist, common errors
    claude-code-integration.md               — MCP config, skill setup, verification steps
  examples/                                  — scratch examples, not committed
```

## Documentation (read these first)

| Document | When to read |
|---|---|
| [Architecture overview](docs/architecture/overview.md) | Understanding the system design |
| [Graph schema](docs/architecture/graph-schema.md) | Node/edge types, properties, Cypher queries |
| [MCP server reference](docs/architecture/mcp-server.md) | Tool parameters, agent usage patterns |
| [Neo4j setup](docs/configuration/neo4j-setup.md) | Configuring credentials, creating the database |
| [Plugin build guide](docs/configuration/plugin-build.md) | Building `@waymark/core`, AI agent checklist |
| [Claude Code integration](docs/configuration/claude-code-integration.md) | MCP config, skill install, verification |

## Build

```bash
pnpm install       # install dependencies
pnpm build         # compile TypeScript → dist/
pnpm test          # run tests (38 tests, 3 files)
```

See [plugin-build.md](docs/configuration/plugin-build.md) for the full AI agent checklist and common error fixes.

## Neo4j credentials

Resolution order (highest priority first):
1. Env vars: `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`
2. `.env` at project root (auto-added to `.gitignore`)
3. `~/.waymark/neo4j.env` (global, shared across projects)

Default database: `waymark`. See [neo4j-setup.md](docs/configuration/neo4j-setup.md).

## MCP server config (Claude Code)

Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "waymark": { "command": "waymark-mcp" }
  }
}
```

Or without `install.sh`:
```json
{
  "mcpServers": {
    "waymark": {
      "command": "node",
      "args": ["/path/to/waymark-plugin/packages/core/dist/bin/waymark-mcp.js"],
      "env": { "WAYMARK_PROJECT_ROOT": "/your/project/root" }
    }
  }
}
```

See [claude-code-integration.md](docs/configuration/claude-code-integration.md) for the full setup and verification checklist.

## Guidance for Claude

- **Read the docs** before making changes — `docs/architecture/` explains design decisions; `docs/configuration/` explains the build and integration.
- **`docs/examples/`** is excluded from git and contains scratch examples — do not read or reference files inside it.
- All TypeScript uses ESM with `.js` extensions on imports (even for `.ts` sources).
- All Cypher queries must be parameterized — never interpolate user values into query strings.
- Prefer small, focused changes. No speculative abstractions.
- When adding a new source file, export it from `src/index.ts` if it's part of the public API.
