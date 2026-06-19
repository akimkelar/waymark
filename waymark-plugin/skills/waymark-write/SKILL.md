# /waymark-write — Write a Waymark Node

Lets a human (or agent) manually write any Waymark node into the graph and optionally link it to a Domain or Feature.

## Usage

```
/waymark-write                        # prompts for node type
/waymark-write task                   # create a Task node
/waymark-write gap                    # create a Gap node
/waymark-write open-question          # create an OpenQuestion
/waymark-write domain                 # create a Domain
/waymark-write feature                # create a Feature (asks for parent Domain)
/waymark-write decision               # create a Decision
/waymark-write alternative            # create an Alternative (asks for parent OpenQuestion)
```

## Interaction flow

### Step 1: Ask for node type (if not provided)

> "What kind of node would you like to create?
> open-question / blocker / gap / decision / alternative / task / domain / feature"

### Step 2: Ask for required fields

Always ask:
- **title** — short label (one line, e.g. "Missing rate limit spec")
- **description** — detailed explanation (can be multi-line)

### Step 3: Ask for type-specific optional fields

| Type | Extra prompts |
|---|---|
| open-question | urgency? (low/medium/high) |
| task | recurrence? (one-time/recurring) |
| decision | rationale? |
| alternative | pros? (comma-separated), cons? (comma-separated) |
| feature | parent domain ID? (required — features must belong to a domain) |
| alternative | parent OpenQuestion ID? (to link via SUGGESTS) |

### Step 4: Ask for domain/feature link (for content nodes)

For node types other than `domain` and `feature`:
> "Link to a domain? (enter domainId or press Enter to skip)"
> "Link to a feature? (enter featureId or press Enter to skip)"

### Step 5: Preview and confirm

Show a summary:
```
About to create:
  Type: task
  Title: Weekly dependency audit
  Description: Audit npm dependencies for known CVEs every Monday
  Recurrence: recurring
  Domain: auth-domain

Write this node? (yes/no)
```

### Step 6: Write and link

```
write_node(type, { title, description, ...optionalFields, domainId?, featureId? })
```

Post-write auto-linking:
- If a `feature` was created with a `domainId`: `link_nodes(domainId, featureId, "has-feature")`
- If `domainId` was provided on any node: `link_nodes(nodeId, domainId, "belongs-to")`
- If `featureId` was provided: `link_nodes(nodeId, featureId, "belongs-to")`
- If an `alternative` has a parent OpenQuestion ID: `link_nodes(alternativeId, questionId, "suggests")`

### Step 7: Confirm

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
domainId: api-domain
```

## Error handling

- If `write_node` fails, show the full error — do not silently continue
- If linking fails after node creation, report which link failed and provide the IDs so the human can retry with `link_nodes` manually
