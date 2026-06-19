# /waymark-resolve — Resolve an Open Question

Guides a human through resolving an OpenQuestion by selecting or authoring a Decision, then updates the Neo4j graph atomically.

## Usage

```
/waymark-resolve <question-id>
/waymark-resolve                  # lists open questions to pick from
```

## What this skill does

1. Fetches the target OpenQuestion (by ID, or lists all open ones to pick from)
2. Shows the question and any existing Alternative nodes (suggestions the agent left)
3. Asks the human to pick an alternative or write a new Decision
4. Creates the Decision node if needed
5. Links `Decision -[:RESOLVES]-> OpenQuestion` and marks question as `resolved`
6. If an Alternative was chosen, links `Decision -[:SELECTED]-> Alternative`
7. Confirms what changed

## Step-by-step flow

### Step 1: Identify the question

If an ID was provided:
```
get_node(questionId)
```
If no ID, list open questions:
```
get_open_questions()
```
Show the list and ask: "Which question would you like to resolve? (enter ID)"

### Step 2: Show the question

Display:
- Title and full description
- Urgency level
- Created by / created at
- Any Alternative nodes (fetch with: `get_trail({ type: "alternative" })` and filter by featureId or domainId, or check nodes with this question's ID in description)

Show alternatives like:
```
Alternatives suggested by the agent:
  A) [alternative:111] Use JWT tokens
     Pros: stateless, scales well
     Cons: token revocation is complex
  B) [alternative:222] Use session cookies
     Pros: simple revocation
     Cons: sticky sessions or Redis needed
```

### Step 3: Elicit the Decision

Ask:
> "How do you want to resolve this? You can:
>   a) Select alternative A or B (enter the letter)
>   b) Describe a different decision"

If the human selects an existing alternative, create a Decision that summarizes it:
- title: same as alternative title
- description: "Selected from agent-proposed alternatives: " + alternative description
- rationale: ask "Any rationale to record? (press Enter to skip)"

If the human writes a new decision, prompt for:
- title (short label)
- description (what was decided)
- rationale (why)

### Step 4: Write and link

```
write_node("decision", { title, description, rationale, createdBy: "human" })
```

If an alternative was selected:
```
link_nodes(decisionId, alternativeId, "selected")
```

Resolve the question (creates RESOLVES link AND marks question resolved):
```
resolve_question(questionId, decisionId)
```

### Step 5: Confirm

Show:
```
✓ Question resolved
  OpenQuestion: <title> → resolved
  Decision: <title> (draft)
  
  To accept this decision: /waymark-write then update status to accepted
  Or run: update_status(<decisionId>, "accepted")
```

## Error handling

- If `resolve_question` returns `{ success: false }`, show the error and do not claim success
- If the question is already resolved, show its linked Decision and stop
- If no alternatives exist, skip Step 2's alternative display
