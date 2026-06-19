# Waymark — Agent Guide

## Project overview

Waymark is a Neo4j-backed communication layer for autonomous AI agents. Agents write structured nodes into a graph so humans can review what happened, what was blocked, and what choices were made — without reading logs.

## Node schema

| Label | Purpose | Tier |
|---|---|---|
| `OpenQuestion` | Unresolved question needing human input | Ephemeral |
| `Blocker` | Hard stop — cannot proceed without resolution; highest dashboard priority | Ephemeral |
| `Gap` | One-time missing context; closed after resolution | Ephemeral |
| `Decision` | Resolution artifact — lasting record of what was chosen and why | Permanent |
| `Alternative` | A path not taken; agent-proposed options for a question | Ephemeral |
| `Task` | Recurring or one-time work item identified but not executed | Permanent |

## Rules for agents

- Write to the graph — do not silently discard uncertainty.
- Attach up to 3 `Alternative` nodes to any `OpenQuestion` or `Blocker`.
- After `resolve_question` runs, linked Alternatives are automatically archived — do not manually reject them.
- `Gap` nodes are one-time; close them after resolution.
- `Task` nodes represent recurring work — do not auto-execute them.
- Decision is the lasting artifact — put full context (what was uncertain, why this was chosen) in title, description, and rationale.

## Repository

- `docs/` is excluded from git and contains scratch examples — do not read or reference files inside it unless explicitly instructed.
- No build system exists yet; schema definition is in progress.
