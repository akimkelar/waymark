# Waymark — Agent Guide

## Project overview

Waymark is a Neo4j-backed communication layer for autonomous AI agents. Agents write structured nodes into a graph so humans can review what happened, what was blocked, and what choices were made — without reading logs.

## Node schema

| Label | Purpose |
|---|---|
| `OpenQuestion` | Unresolved question needing human input |
| `Blocker` | Hard stop — cannot proceed without resolution |
| `Gap` | One-time missing context; closed after resolution |
| `Decision` | Autonomous choice made by the agent, logged for review |
| `Alternative` | A path not taken, preserved for human consideration |
| `Task` | Recurring work item identified but not executed |
| `Domain` | DDD domain boundary |
| `Feature` | Feature within a domain |

## Rules for agents

- Write to the graph — do not silently discard uncertainty.
- Attach up to 3 `Alternative` nodes to any `OpenQuestion`.
- Link nodes to `Domain` or `Feature` when scope is known.
- `Gap` nodes are one-time; close them after resolution.
- `Task` nodes represent recurring work — do not auto-execute them.

## Repository

- `docs/` is excluded from git and contains scratch examples — do not read or reference files inside it unless explicitly instructed.
- No build system exists yet; schema definition is in progress.
