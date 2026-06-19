# /waymark — Read the Trail

Reads the Waymark trail from Neo4j and presents a human-readable summary of open items needing attention.

## What this skill does

1. Connects to Neo4j via the waymark-mcp MCP server (or cypher-shell fallback)
2. Fetches all open items: OpenQuestion, Blocker, Gap, Task nodes
3. Groups by priority: Blockers → OpenQuestions (by urgency) → Gaps → Tasks
4. Shows each item's title, description, urgency, and who created it
5. Suggests which items need immediate attention

## Usage

```
/waymark
/waymark --type open-question
/waymark --type blocker
/waymark --domain <domainId>
/waymark --status open
```

## Output format

Present results as:

```
## Waymark Trail

### 🔴 Blockers (agent cannot proceed)
- [open-question:abc] Authentication strategy undefined
  "Agent cannot choose between JWT and session cookies without knowing the deployment target."
  Created by: agent-auth-setup

### 🟡 Open Questions (agent needs human input)
- [open-question:xyz] Database sharding approach (urgency: high)
  "Should we shard by tenant or by geography?"
  Alternatives: By tenant (pros: simpler queries), By geography (pros: latency)
  Created by: agent-db-setup

### 🟠 Gaps (missing context, agent identified)
- [gap:def] Missing rate limit spec
  "No rate limit requirements found in the spec."
  Created by: agent-api-setup

### 📋 Open Tasks
- [task:ghi] Weekly dependency audit (recurring)
  Created by: agent-sec-review

---
Total: 1 blocker, 1 open question, 1 gap, 1 task
Run /waymark-resolve <id> to resolve an open question.
```

## Implementation

Use MCP tools:
- `get_blockers()` — fetch open blockers
- `get_open_questions(domainId?)` — fetch open questions, sorted by urgency
- `get_trail({ type: "gap", status: "open" })` — fetch gaps
- `get_trail({ type: "task", status: "open" })` — fetch open tasks

If MCP is unavailable, fall back to cypher-shell:
```bash
cypher-shell -a $NEO4J_URI -u $NEO4J_USERNAME -p $NEO4J_PASSWORD -d waymark \
  "MATCH (n) WHERE n.status IN ['open', 'draft'] RETURN n ORDER BY n.createdAt DESC LIMIT 50"
```

## Neo4j credentials

Config is resolved in this order (highest priority first):
1. Env vars: `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`
2. `.env` at project root
3. `~/.waymark/neo4j.env`

If no credentials are found, show setup instructions.
