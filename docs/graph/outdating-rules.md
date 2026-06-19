# Graph Staleness Rules

## Overview

The Waymark graph is persistent — nodes are never automatically deleted or rebuilt. This means staleness accumulates silently unless actively detected and resolved.

Waymark staleness is **status-drift-based and age-based**, not git-commit-based. A node becomes stale when its status no longer reflects reality — an open Blocker that was resolved informally, an Alternative left `proposed` after its question was answered, a Decision deprecated without a successor. An ephemeral node is stale when its status no longer reflects reality; a Decision is stale when deprecated but still the most visible resolution for a question.

Staleness is always **queryable**. The graph does not degrade invisibly.

---

## Types of Staleness

### 1. Status Drift

A node's status hasn't followed reality.

| Signal | Meaning |
|---|---|
| `Alternative.status = 'proposed'` and parent `OpenQuestion.status = 'resolved'` | Question was resolved but alternatives never marked `selected` or `rejected` |
| `Blocker.status = 'open'` older than 3 days | Persistent blockers need escalation |
| `OpenQuestion.status = 'open'` older than 7 days | Unanswered for too long — needs human attention or urgency increase |
| `Decision.status = 'draft'` older than 7 days | Draft decisions left without acceptance or deprecation |

### 2. Orphaned Nodes

A node exists without the relationships it needs to be meaningful.

| Signal | Meaning |
|---|---|
| `Alternative` with no `SUGGESTS` edge | Alternative was created without linking to a question or blocker — its context is lost |
| `Decision` with no `RESOLVES` edge and no `createdBy` context | Decision floats with no connection to what it decided and no author to ask |

### 3. Deprecated Decisions Still Referenced

A deprecated Decision may still be the most visible resolution for a question.

| Signal | Meaning |
|---|---|
| `Decision.status = 'deprecated'` with `RESOLVES` edges still active | The question is technically resolved, but the resolution is obsolete — the question may need re-resolving |
| `Alternative.status = 'selected'` but its parent Decision is `deprecated` | The chosen path was abandoned |

---

## Provenance Tracking

Every node carries `createdBy` (agent or human identifier), `createdAt`, and `updatedAt`. These three fields together enable **provenance** — the ability to trace any decision or question back to its source and assess whether it has ever been reviewed.

When investigating a stale node, check:

1. **Who created it?** (`createdBy`) — was it an agent that may no longer be running, or a human who may have forgotten?
2. **When was it created?** (`createdAt`) — how long has it been open?
3. **When was it last updated?** (`updatedAt`) — has anyone touched it since creation?

A node where `createdAt == updatedAt` and `status` is still the initial status has **never been touched after creation** — it is a strong candidate for staleness review.

```cypher
// Nodes never updated since creation (untouched since write)
MATCH (n)
WHERE n.id IS NOT NULL
  AND n.createdAt = n.updatedAt
  AND n.status IN ['open', 'proposed', 'draft']
  AND duration.between(datetime(n.createdAt), datetime()).days > 7
RETURN labels(n)[0] AS type, n.id, n.title, n.createdBy, n.createdAt
ORDER BY n.createdAt
```

---

## Detection Queries

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

### Deprecated decisions that still resolve open questions

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

### Blockers with no CAUSED_BY link and open longer than 1 day

```cypher
MATCH (b:Blocker {status: 'open'})
WHERE NOT EXISTS((b)-[:CAUSED_BY]->())
  AND duration.between(datetime(b.createdAt), datetime()).days > 1
RETURN b.id, b.title, b.createdAt, b.createdBy
ORDER BY b.createdAt
```

### Nodes never updated since creation

```cypher
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
| OpenQuestion open longer than 7 days | Escalate to human — increase urgency or write a Blocker if agent is waiting |
| Blocker open longer than 3 days | Escalate immediately — write a higher-urgency OpenQuestion if root cause is unknown |
| Alternative `proposed` after question resolved | Run `update_status(altId, 'rejected')` for unselected alternatives, or link with `SELECTED` if the choice was implicitly made |
| Draft Decision older than 7 days | Human reviews and either accepts or deprecates |
| Deprecated Decision still resolving an open question | Human re-resolves the question with a new Decision, then updates the deprecated one's description to reference the successor |
| Orphaned Alternative (no SUGGESTS) | Either link with `link_nodes(altId, questionId, 'suggests')` or delete if context is unrecoverable |
| Orphaned Decision (no RESOLVES, no createdBy context) | Link to a question with `resolve_question(questionId, decisionId)` or add `createdBy` via `write_node` update |
| Blocker with no CAUSED_BY and open > 1 day | Identify the root question and link with `link_nodes(blockerId, questionId, 'caused-by')` |

---

## Visibility

Staleness is not hidden. Any agent or human can run the detection queries above to assess the current state of the graph before relying on it. The `/waymark` skill surfaces counts of open questions and blockers at session start — but it does not run the full staleness scan. Run the queries directly in cypher-shell for a complete audit.
