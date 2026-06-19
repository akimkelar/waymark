# Graph Quality Rules

## Overview

The Waymark graph must be trustworthy. Decisions are the permanent record of what was chosen and why — an accepted Decision with no rationale, or a resolved OpenQuestion with no linked Decision, corrupts that record. Ephemeral nodes (OpenQuestion, Blocker, Gap, Alternative) must be cleaned up after resolution so the active trail stays readable and accurate.

Quality rules define what a valid, useful Waymark graph looks like.

---

## Quality Dimensions

| Dimension | Description |
|---|---|
| **Correctness** | Nodes and relationships reflect reality — no resolved OpenQuestion without a linked Decision, no Decision pointing to the wrong OpenQuestion |
| **Completeness** | All significant uncertainty is captured — agents don't silently skip past blockers or make undocumented guesses |
| **Freshness** | Statuses are updated when reality changes — no `proposed` Alternatives left behind after a question resolves |
| **Consistency** | The same concept is named and typed the same way — no duplicate Decisions, no `decision` nodes mistyped as `open-question` |

---

## Node Quality Rules

### OpenQuestion

- `title` must be a specific question, not a vague label ("Should we use JWT or session tokens?" not "Auth question")
- `description` must explain the context: what the agent was doing, why it got stuck, and what information would unblock it
- `urgency` should be set — default to `medium` if genuinely uncertain; `high` only if the agent cannot proceed at all (consider using `Blocker` instead)
- An OpenQuestion with `status = 'resolved'` must have at least one `Decision -[:RESOLVES]-> OpenQuestion` edge

### Blocker

- `description` must clearly state what is blocked and why it cannot proceed without resolution
- A Blocker should have a `CAUSED_BY` edge to an OpenQuestion if the block stems from an unanswered question — this links the urgency to the root cause
- A Blocker with `status = 'unblocked'` should have a corresponding Decision or a manual note in `description` explaining how it was unblocked

### Gap

- `description` must be specific about what is missing — "Missing rate-limit spec for the /auth endpoint" not "Incomplete spec"
- A Gap should be scoped via `createdBy` at minimum; vague Gaps with no author context are hard to action
- A Gap with `status = 'closed'` should have `updatedAt` reflecting when it was closed

### Decision

- `title` must state the decision, not describe the question ("Use JWT for stateless auth" not "Auth decision")
- `rationale` is required when `status = 'accepted'` — an accepted Decision with no rationale cannot be challenged or revisited meaningfully
- A Decision must either `RESOLVES` an OpenQuestion or stand alone as a documented standalone commitment — a free-floating Decision with no context and no `createdBy` is noise
- A Decision with `status = 'deprecated'` should have a note in `description` or `rationale` explaining why it was deprecated

### Alternative

- `pros` or `cons` must be non-empty — at least one of the two must give enough information to compare this option against others
- Every Alternative must have a `SUGGESTS` edge to exactly one OpenQuestion or Blocker
- An Alternative with `status = 'proposed'` and its parent OpenQuestion `status = 'resolved'` is stale (see [outdating-rules.md](outdating-rules.md))

### Task

- `recurrence` must be explicitly set — `one-time` or `recurring`; never left unset
- `description` must be actionable — what should the agent do when it picks up this task?
- A Task with `status = 'in-progress'` that has not been updated in over 24 hours is suspect — either the agent abandoned it or the status was set incorrectly

---

## Relationship Quality Rules

### RESOLVES must be from Decision to OpenQuestion only

```cypher
// RESOLVES edges where the source is not a Decision or target is not an OpenQuestion
MATCH (a)-[:RESOLVES]->(b)
WHERE a.type <> 'decision' OR b.type <> 'open-question'
RETURN a.id, a.type, b.id, b.type
```

### SUGGESTS must be from Alternative to OpenQuestion or Blocker only

```cypher
// SUGGESTS edges where the source is not an Alternative, or target is neither OpenQuestion nor Blocker
MATCH (a)-[:SUGGESTS]->(b)
WHERE a.type <> 'alternative' OR b.type NOT IN ['open-question', 'blocker']
RETURN a.id, a.type, b.id, b.type
```

### SELECTED must be from Decision to Alternative only, and that Alternative must SUGGEST the same question the Decision RESOLVES

```cypher
// Decision that SELECTED an Alternative not linked to the question it RESOLVES
MATCH (d:Decision)-[:SELECTED]->(a:Alternative), (d)-[:RESOLVES]->(q:OpenQuestion)
WHERE NOT EXISTS((a)-[:SUGGESTS]->(q))
RETURN d.id, a.id, q.id
```

### No orphaned Alternatives (no SUGGESTS edge)

```cypher
MATCH (a:Alternative)
WHERE NOT EXISTS((a)-[:SUGGESTS]->())
RETURN a.id, a.title, a.createdAt
```

### No deprecated Decisions whose resolved OpenQuestion is still open

```cypher
MATCH (d:Decision {status: 'deprecated'})-[:RESOLVES]->(q:OpenQuestion {status: 'open'})
RETURN d.id, d.title, q.id, q.title
```

---

## Validation Queries

Run before relying on the graph for planning or decisions:

```cypher
// 1. Orphaned nodes — no relationships at all
MATCH (n)
WHERE n.id IS NOT NULL AND size([(n)--() | 1]) = 0
RETURN labels(n)[0] AS type, n.id, n.title;

// 2. Resolved OpenQuestions without a Decision link
MATCH (q:OpenQuestion {status: 'resolved'})
WHERE NOT EXISTS((:Decision)-[:RESOLVES]->(q))
RETURN q.id, q.title;

// 3. Accepted Decisions without rationale
MATCH (d:Decision {status: 'accepted'})
WHERE d.rationale IS NULL OR d.rationale = ''
RETURN d.id, d.title;

// 4. Alternatives with no SUGGESTS edge
MATCH (a:Alternative)
WHERE NOT EXISTS((a)-[:SUGGESTS]->())
RETURN a.id, a.title;

// 5. Open questions with urgency=high that have no Alternatives
MATCH (q:OpenQuestion {status: 'open', urgency: 'high'})
WHERE NOT EXISTS((:Alternative)-[:SUGGESTS]->(q))
RETURN q.id, q.title, q.createdAt;

// 6. Deprecated Decisions still resolving open questions
MATCH (d:Decision {status: 'deprecated'})-[:RESOLVES]->(q:OpenQuestion {status: 'open'})
RETURN d.id, d.title, q.id, q.title;

// 7. Blockers with no CAUSED_BY link and no description of cause (open > 1 day)
MATCH (b:Blocker {status: 'open'})
WHERE NOT EXISTS((b)-[:CAUSED_BY]->())
  AND duration.between(datetime(b.createdAt), datetime()).days > 1
RETURN b.id, b.title, b.createdAt;

// 8. SUGGESTS edges pointing to wrong target types
MATCH (a)-[:SUGGESTS]->(b)
WHERE b.type NOT IN ['open-question', 'blocker']
RETURN a.id, a.type, b.id, b.type;
```

---

## What Makes a Graph Unsafe

A Waymark graph is **unsafe** when it leads agents or humans to wrong assumptions:

- An **accepted Decision with no rationale** — a future agent cannot understand why this path was taken and may reverse it unknowingly
- An **OpenQuestion marked `resolved` with no Decision linked** — agents believe the question was answered, but there is no record of the answer
- An **orphaned Alternative** (no `SUGGESTS` edge) — context exists in the graph with no link to its purpose; humans reviewing the trail cannot interpret it
- **Stale Blockers open for days** — agents may be silently waiting while the graph shows no escalation
- A **deprecated Decision that still resolves an open OpenQuestion** — the question is technically resolved, but the resolution is obsolete; agents cannot tell whether to reopen it

The graph is safe when every resolution is traceable, every open item is visible, and every piece of context is scoped to where it belongs.

---

## Graph Reviewer Checklist

Before treating the graph as authoritative for planning:

- [ ] No orphaned nodes (zero-relationship nodes)
- [ ] All `resolved` OpenQuestions have at least one `Decision -[:RESOLVES]->` edge
- [ ] All `accepted` Decisions have a non-empty `rationale`
- [ ] All Alternatives have a `SUGGESTS` edge to exactly one OpenQuestion or Blocker
- [ ] No `deprecated` Decisions resolving still-open questions
- [ ] No Blockers open longer than 3 days without escalation
- [ ] No `selected` Alternative whose linked Decision is `deprecated`
