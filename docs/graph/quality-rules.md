# Graph Quality Rules

## Overview

The Waymark graph must be more trustworthy than a chat log or a ticket system. It is the shared record of what agents encountered, what humans decided, and what was left behind. A graph with phantom relationships or vague nodes creates wrong assumptions about what has been decided and what remains open.

Quality rules define what a valid, useful Waymark graph looks like.

---

## Quality Dimensions

| Dimension | Description |
|---|---|
| **Correctness** | Nodes and relationships reflect reality — no resolved question still marked open, no Decision pointing to the wrong OpenQuestion |
| **Completeness** | All significant uncertainty is captured — agents don't silently skip past blockers or guesses |
| **Freshness** | Statuses are updated when reality changes — no `proposed` alternatives left behind after a question resolves |
| **Consistency** | The same concept is named and typed the same way — no duplicate domains, no `decision` nodes filed as `open-question` |

---

## Node Quality Rules

### OpenQuestion

- `title` must be a specific question, not a vague label ("Should we use X or Y?" not "Database question")
- `description` must explain the context: what the agent was doing, why it got stuck, what information would unblock it
- `urgency` should be set — default to `medium` if genuinely uncertain; `high` only if the agent cannot proceed at all (consider using `Blocker` instead)
- An OpenQuestion with `status = 'resolved'` must have at least one `Decision -[:RESOLVES]-> OpenQuestion` edge

### Blocker

- `description` must clearly state what is blocked and why it cannot proceed without resolution
- A Blocker should have a `CAUSED_BY` edge to an OpenQuestion if the block stems from an unanswered question — this links the urgency to the root cause
- A Blocker with `status = 'unblocked'` should have a corresponding Decision or a manual note in description explaining how it was unblocked

### Gap

- `description` must be specific about what is missing — "Missing rate-limit spec for the /auth endpoint" not "Incomplete spec"
- A Gap should have either `featureId` set or an `ADDRESSES` edge to a Feature — a floating Gap with no scope is hard to act on
- A Gap with `status = 'closed'` should have `updatedAt` reflecting when it was closed

### Decision

- `title` must state the decision, not describe the question ("Use JWT for stateless auth" not "Auth decision")
- `rationale` is required when `status = 'accepted'` — an accepted decision with no rationale cannot be challenged or revisited meaningfully
- A Decision must either `RESOLVES` an OpenQuestion or have `domainId` / `featureId` set — a free-floating Decision with no context is noise
- A Decision with `status = 'deprecated'` should have a note in `description` or `rationale` explaining why it was deprecated

### Alternative

- `pros` and `cons` together must give enough information to compare this option against others — at least one of the two must be non-empty
- Every Alternative must have a `SUGGESTS` edge to exactly one OpenQuestion
- An Alternative with `status = 'proposed'` and its parent OpenQuestion `status = 'resolved'` is stale (see [outdating-rules.md](outdating-rules.md))

### Task

- `recurrence` must be explicitly set — `one-time` or `recurring`; never left unset
- `description` must be actionable — what should the agent do when it picks up this task?
- A Task with `status = 'in-progress'` that has not been updated in over 24 hours is suspect — either the agent abandoned it or the status was set incorrectly

### Domain

- `title` should reflect a DDD bounded context name, not a technology ("Payments" not "Stripe")
- A Domain with no `HAS_FEATURE` edges is acceptable for new domains but should be reviewed if older than 7 days

### Feature

- Every Feature must have a `HAS_FEATURE` edge from a Domain — free-floating Features have no context
- `title` should name the capability ("User authentication", "Rate limiting"), not the implementation ("JWT tokens")

---

## Relationship Quality Rules

### RESOLVES must link correctly

```cypher
// RESOLVES edges where the source is not a Decision
MATCH (a)-[:RESOLVES]->(b)
WHERE a.type <> 'decision'
RETURN a.id, a.type, b.id, b.type
```

### SUGGESTS must link correctly

```cypher
// SUGGESTS edges where the source is not an Alternative
MATCH (a)-[:SUGGESTS]->(b)
WHERE a.type <> 'alternative' OR b.type <> 'open-question'
RETURN a.id, a.type, b.id, b.type
```

### HAS_FEATURE must connect Domain to Feature only

```cypher
// HAS_FEATURE edges between wrong node types
MATCH (a)-[:HAS_FEATURE]->(b)
WHERE a.type <> 'domain' OR b.type <> 'feature'
RETURN a.id, a.type, b.id, b.type
```

### SELECTED must reference the Alternative suggested to the same question

```cypher
// Decision that SELECTED an Alternative not linked to the question it RESOLVES
MATCH (d:Decision)-[:SELECTED]->(a:Alternative), (d)-[:RESOLVES]->(q:OpenQuestion)
WHERE NOT EXISTS((a)-[:SUGGESTS]->(q))
RETURN d.id, a.id, q.id
```

### No orphaned Alternatives

```cypher
MATCH (a:Alternative)
WHERE NOT EXISTS((a)-[:SUGGESTS]->())
RETURN a.id, a.title, a.createdAt
```

---

## Validation Queries

Run before relying on the graph for planning or decisions:

```cypher
// 1. Orphaned nodes — no relationships at all
MATCH (n)
WHERE n.id IS NOT NULL AND size([(n)--() | 1]) = 0
RETURN labels(n)[0] AS type, n.id, n.title;

// 2. Resolved questions without a Decision link
MATCH (q:OpenQuestion {status: 'resolved'})
WHERE NOT EXISTS((:Decision)-[:RESOLVES]->(q))
RETURN q.id, q.title;

// 3. Accepted decisions without rationale
MATCH (d:Decision {status: 'accepted'})
WHERE d.rationale IS NULL OR d.rationale = ''
RETURN d.id, d.title;

// 4. Alternatives with no SUGGESTS edge
MATCH (a:Alternative)
WHERE NOT EXISTS((a)-[:SUGGESTS]->())
RETURN a.id, a.title;

// 5. Features with no parent Domain
MATCH (f:Feature)
WHERE NOT EXISTS((:Domain)-[:HAS_FEATURE]->(f))
RETURN f.id, f.title;

// 6. Open questions with urgency=high that have no Alternatives
MATCH (q:OpenQuestion {status: 'open', urgency: 'high'})
WHERE NOT EXISTS((:Alternative)-[:SUGGESTS]->(q))
RETURN q.id, q.title, q.createdAt;

// 7. Decisions with deprecated status still resolving open questions
MATCH (d:Decision {status: 'deprecated'})-[:RESOLVES]->(q:OpenQuestion {status: 'open'})
RETURN d.id, d.title, q.id, q.title;

// 8. Blockers with no causal link (no CAUSED_BY, no description of cause)
MATCH (b:Blocker {status: 'open'})
WHERE NOT EXISTS((b)-[:CAUSED_BY]->())
RETURN b.id, b.title, b.createdAt;
```

---

## What Makes a Graph Unsafe

A Waymark graph is **unsafe** when it leads agents or humans to wrong assumptions:

- An `OpenQuestion` marked `resolved` with no Decision linked — agents believe the question was answered, but there is no record of the answer
- A `Decision` accepted with no `rationale` — a future agent cannot understand why this path was taken and may reverse it unknowingly
- A `Blocker` that has been open for days but never escalated — agents may be silently waiting
- `Alternative` nodes left `proposed` after the question resolved — humans reviewing the trail see unresolved options that were already decided
- A `Feature` with no parent `Domain` — scoped questions and decisions attached to it have lost their bounded context

The graph is safe when every resolution is traceable, every open item is visible, and every piece of context is scoped to where it belongs.

---

## Graph Reviewer Checklist

Before treating the graph as authoritative for planning:

- [ ] No orphaned nodes (zero-relationship nodes)
- [ ] All `resolved` OpenQuestions have at least one `Decision -[:RESOLVES]->` edge
- [ ] All `accepted` Decisions have a non-empty `rationale`
- [ ] All Alternatives have a `SUGGESTS` edge
- [ ] All Features have a `HAS_FEATURE` edge from a Domain
- [ ] No `deprecated` Decisions resolving still-open questions
- [ ] No Blockers open longer than 3 days without escalation
- [ ] No `selected` Alternative whose Decision is `deprecated`
