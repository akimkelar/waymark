# /waymark-write — Write a Waymark Node

Lets a human (or agent) manually write any Waymark node into the graph.

## Usage

```
/waymark-write                        # prompts for node type
/waymark-write task                   # create a Task node
/waymark-write gap                    # create a Gap node
/waymark-write open-question          # create an OpenQuestion
/waymark-write decision               # create a Decision
/waymark-write alternative            # create an Alternative (asks for parent OpenQuestion)
/waymark-write blocker                # create a Blocker
```

## Interaction flow

### Step 1: Ask for node type (if not provided)

> "What kind of node would you like to create?
> open-question / blocker / gap / decision / alternative / task"

### Step 2: Ask for required fields

Always ask:
- **title** — short label (one line, e.g. "Missing rate limit spec")
- **description** — detailed explanation (can be multi-line)

### Step 3: Ask for type-specific optional fields

| Type | Extra prompts |
|---|---|
| open-question | urgency? (low/medium/high) |
| blocker | urgency? (low/medium/high) |
| task | recurrence? (one-time/recurring) |
| decision | rationale? |
| alternative | pros? (comma-separated), cons? (comma-separated), parent OpenQuestion ID? (to link via SUGGESTS) |

### Step 4: Preview and confirm

Show a summary:
```
About to create:
  Type: task
  Title: Weekly dependency audit
  Description: Audit npm dependencies for known CVEs every Monday
  Recurrence: recurring

Write this node? (yes/no)
```

### Step 5: Write and link

```
write_node(type, { title, description, ...optionalFields })
```

Post-write auto-linking:
- If an `alternative` has a parent OpenQuestion ID: `link_nodes(alternativeId, questionId, "suggests")`

### Step 6: Confirm

```
✓ Node created
  ID: task:abc-123-def
  Title: Weekly dependency audit
  Status: open
  
Run /waymark to see the full trail.
```

## Agent usage (no prompts)

Agents calling this skill should provide all fields upfront to avoid interactive prompts:

```
/waymark-write open-question
title: "Should we use GraphQL or REST for the public API?"
description: "The spec mentions both. GraphQL would enable flexible queries but adds tooling complexity."
urgency: high
createdBy: agent-api-design
```

## Error handling

- If `write_node` fails, show the full error — do not silently continue
- If linking fails after node creation, report which link failed and provide the IDs so the human can retry with `link_nodes` manually
