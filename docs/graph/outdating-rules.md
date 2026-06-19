# Graph Staleness Rules

## Overview

The Waymark graph is persistent — nodes are never automatically deleted or rebuilt. This means staleness accumulates silently unless actively detected and resolved.

Waymark staleness is different from code-analysis staleness. There is no git commit to compare against. Instead, a node becomes stale when its **status no longer reflects reality** — an open question was answered informally without being updated, a decision was reversed without being deprecated, or an alternative was left `proposed` after its parent question was resolved.

Staleness is always **queryable**. The graph does not degrade invisibly.

---

## Types of Staleness

### 1. Status Drift

A node's status hasn't followed reality.

| Signal | Meaning |
|---|---|
| `OpenQuestion.status = 'open'` with an accepted `Decision` linked via `RESOLVES` | Question was resolved but status not updated (shouldn't happen if `resolve_question` was used, but possible with manual writes) |
| `Alternative.status = 'proposed'` and parent `OpenQuestion.status = 'resolved'` | Question was resolved but alternatives never marked selected/rejected |
| `Decision.status = 'draft'` that is older than 7 days | Draft decisions left without acceptance or deprecation |
| `Blocker.status = 'open'` that is older than 3 days | Persistent blockers need escalation |
| `Gap.status = 'open'` that is older than 14 days | Gaps that were opened but never addressed |

### 2. Orphaned Nodes

A node exists without the relationships it needs to be meaningful.

| Signal | Meaning |
|---|---|
| `Alternative` with no `SUGGESTS` edge | Alternative was created without linking to a question — its context is lost |
| `Decision` with no `RESOLVES` edge and no `domainId`/`featureId` | Decision floats with no connection to what it decided |
| `Feature` with no `HAS_FEATURE` edge from a `Domain` | Feature exists outside any domain boundary |
| `Gap` with no `ADDRESSES` edge and no `featureId` | Gap has no scope — unclear what area it belongs to |

### 3. Deprecated Decisions Still Referenced

A deprecated decision may still be the most visible resolution for a question.

| Signal | Meaning |
|---|---|
| `Decision.status = 'deprecated'` with `RESOLVES` edges still active | The question is technically resolved, but the resolution is obsolete — the question may need re-resolving |
| `Alternative.status = 'selected'` but its parent Decision is `deprecated` | The chosen path was abandoned |

### 4. Structural Inconsistency

The graph has edges that violate the intended schema.

| Signal | Meaning |
|---|---|
| `RESOLVES` edge from a non-Decision node | Write error — wrong node type on source |
| `SUGGESTS` edge from a non-Alternative node | Write error |
| `HAS_FEATURE` edge between non-Domain→Feature pairs | Scope boundary violated |
| `Alternative` with `status = 'selected'` but no `Decision -[:SELECTED]-> Alternative` link | Status was updated without linking the decision |

---

## Staleness Detection Queries

### Open questions older than N days

```cypher
MATCH (q:OpenQuestion {status: 'open'})
WHERE duration.between(datetime(q.createdAt), datetime()).days > $days
RETURN q.id, q.title, q.urgency, q.createdAt, q.createdBy
ORDER BY q.createdAt
```

### Open blockers older than 3 days

```cypher
MATCH (b:Blocker {status: 'open'})
WHERE duration.between(datetime(b.createdAt), datetime()).days > 3
RETURN b.id, b.title, b.createdAt, b.createdBy
ORDER BY b.createdAt
```

### Alternatives left proposed after their question was resolved

```cypher
MATCH (a:Alternative {status: 'proposed'})-[:SUGGESTS]->(q:OpenQuestion)
WHERE q.status = 'resolved'
RETURN a.id, a.title, q.id AS questionId, q.title AS questionTitle
```

### Draft decisions older than 7 days

```cypher
MATCH (d:Decision {status: 'draft'})
WHERE duration.between(datetime(d.createdAt), datetime()).days > 7
RETURN d.id, d.title, d.createdAt, d.createdBy
ORDER BY d.createdAt
```

### Deprecated decisions that still resolve questions

```cypher
MATCH (d:Decision {status: 'deprecated'})-[:RESOLVES]->(q:OpenQuestion)
RETURN d.id, d.title, q.id AS questionId, q.title AS questionTitle, q.status AS questionStatus
```

### Orphaned alternatives (no SUGGESTS edge)

```cypher
MATCH (a:Alternative)
WHERE NOT EXISTS((a)-[:SUGGESTS]->())
RETURN a.id, a.title, a.createdAt, a.createdBy
```

### Orphaned decisions (no RESOLVES, no domain/feature context)

```cypher
MATCH (d:Decision)
WHERE NOT EXISTS((d)-[:RESOLVES]->())
  AND d.domainId IS NULL
  AND d.featureId IS NULL
RETURN d.id, d.title, d.status, d.createdAt
```

### Features with no parent domain

```cypher
MATCH (f:Feature)
WHERE NOT EXISTS((:Domain)-[:HAS_FEATURE]->(f))
RETURN f.id, f.title, f.createdAt
```

### Gaps open longer than 14 days

```cypher
MATCH (g:Gap {status: 'open'})
WHERE duration.between(datetime(g.createdAt), datetime()).days > 14
RETURN g.id, g.title, g.createdAt, g.createdBy
ORDER BY g.createdAt
```

---

## Provenance Tracking

Every node carries `createdBy` (agent or human identifier) and `createdAt`. These two fields together enable **provenance** — the ability to trace any decision or question back to its source.

When investigating a stale node, check:

1. **Who created it?** (`createdBy`) — was it an agent that may no longer be running, or a human who may have forgotten?
2. **When was it created?** (`createdAt`) — how long has it been open?
3. **When was it last updated?** (`updatedAt`) — has anyone touched it since creation?

A node where `createdAt == updatedAt` and `status` is still the initial status has never been touched after creation — it is a strong candidate for staleness review.

```cypher
// Nodes never updated after creation (untouched since write)
MATCH (n)
WHERE n.id IS NOT NULL
  AND n.createdAt = n.updatedAt
  AND n.status IN ['open', 'proposed', 'draft']
  AND duration.between(datetime(n.createdAt), datetime()).days > 7
RETURN labels(n)[0] AS type, n.id, n.title, n.createdBy, n.createdAt
ORDER BY n.createdAt
```

---

## Resolving Staleness

| Condition | Resolution |
|---|---|
| Open question older than 7 days | Escalate to human — increase urgency or write a Blocker if agent is waiting |
| Open blocker older than 3 days | Escalate immediately — write a higher-urgency OpenQuestion if root cause is unknown |
| Alternative `proposed` after question resolved | Run `update_status(altId, 'rejected')` for unselected alternatives, or link with `SELECTED` if appropriate |
| Draft decision older than 7 days | Human reviews and either accepts or deprecates |
| Deprecated decision still resolving a question | Human re-resolves the question with a new Decision |
| Orphaned Alternative | Either link with `link_nodes(altId, questionId, 'suggests')` or delete if context is lost |
| Orphaned Decision | Link to a question with `resolve_question(questionId, decisionId)` or add `domainId`/`featureId` via `write_node` update |
| Feature with no Domain | Link with `link_nodes(domainId, featureId, 'has-feature')` |

---

## Visibility

Staleness is not hidden. Any agent or human can run the detection queries above to assess the current state of the graph before relying on it. The `/waymark` skill runs `get_open_questions()` and `get_blockers()` at session start and surfaces counts — but it does not run the full staleness scan. Run the queries directly in cypher-shell for a complete audit.
