# Waymark

A communication layer between autonomous AI agents and humans. Waymark lets agents write what they encounter — OpenQuestions, Blockers, Gaps, Decisions, Alternatives — into a Neo4j graph. Humans read the trail, not the logs. Respects DDD with Domain and Feature labels.

---

## Why

Autonomous AI agents work silently. When they get stuck, make a judgment call, or notice something missing, that context disappears into execution logs nobody reads. Waymark gives agents a place to leave structured, human-readable traces — so teams can see not just what the agent did, but what it couldn't do, what it chose, and what it left behind.

---

## Node Types

| Label | Meaning |
|---|---|
| `OpenQuestion` | Something the agent couldn't resolve and needs human input |
| `Blocker` | Hard stop — agent cannot proceed without resolution |
| `Gap` | One-time missing context, data, or capability — resolved and closed |
| `Decision` | A choice the agent made autonomously, logged for review |
| `Alternative` | A path not taken, preserved for human consideration |
| `Task` | Recurring work item the agent identified but didn't execute |
| `Domain` | DDD domain boundary |
| `Feature` | Feature within a domain |

---

## How It Works

### Agent → Human

```
Agent runs
  → hits uncertainty
    → writes OpenQuestion node to Neo4j
      → attaches up to 3 Alternative nodes (agent-suggested options)
        → optionally links to Domain or Feature
```

### Human → Agent

```
Human reviews the graph
  → invokes the Waymark workflow skill on an OpenQuestion
    → selects or authors a Decision
      → graph is updated: Decision node linked, OpenQuestion resolved
        → AI Agent reads the updated graph and continues
```

### Human-initiated

Humans can also write nodes directly into the graph. `Task` nodes represent recurring work to be picked up by agents. `Gap` nodes are one-time — created to address a specific missing piece, then closed once resolved.

### QA Agents

QA Agents audit completed work and write `Gap` nodes when they detect missing coverage, inconsistencies, or unresolved concerns — keeping the graph alive beyond the initial implementation pass.

---

## Status

Early stage. Core node schema and writer interface are being defined. Contributions and feedback welcome.

---

## License

MIT
