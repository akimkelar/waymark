# Waymark MCP Server Reference

## Design Principles

### Write-first

`write_node` is the primary tool. Agents use it whenever they encounter uncertainty, a blocker, a gap, or a decision point. The server is designed around writes — reads are secondary, used by agents to check whether humans have resolved their questions.

### Explicit errors

If Neo4j is unreachable, the tool returns an explicit error with `isError: true` and the connection error message. The server never silently returns empty results on a connection failure. This matters for agents: an empty result and a connection error look identical without explicit signaling, and an agent that cannot tell the difference may assume its question was resolved when the graph was simply unreachable.

This is a deliberate contrast with tools that silently swallow connection errors and return `[]` — making it impossible to distinguish "no results" from "could not connect."

### Per-request sessions

Each tool call opens its own Neo4j driver session and closes it when the call completes. The server does not hold a persistent connection pool between calls. This keeps the server simple and avoids stale session issues across long-running agent tasks.

### Stateless

The server holds no in-memory state between calls. All state lives in Neo4j. This means any number of agent instances can share the same MCP server (or connect to the same Neo4j instance directly) without coordination.

---

## MCP Tools

### `write_node`

Creates a new node in the Waymark graph.

**Parameters**:

| Name          | Type       | Required | Description                                                          |
|---------------|------------|----------|----------------------------------------------------------------------|
| `type`        | `string`   | yes      | Node type: `open-question`, `blocker`, `gap`, `decision`, `alternative`, `task`, `domain`, `feature` |
| `title`       | `string`   | yes      | Short human-readable title                                           |
| `description` | `string`   | yes      | Full description of the node's content                               |
| `createdBy`   | `string`   | no       | Identifier for the agent or human creating this node                 |
| `urgency`     | `string`   | no       | `low` / `medium` / `high` — only used for `open-question`           |
| `rationale`   | `string`   | no       | Explanation — only used for `decision`                               |
| `pros`        | `string[]` | no       | List of advantages — only used for `alternative`                     |
| `cons`        | `string[]` | no       | List of disadvantages — only used for `alternative`                  |
| `recurrence`  | `string`   | no       | `one-time` / `recurring` — only used for `task`                     |
| `domainId`    | `string`   | no       | ID of a `Domain` node to scope this node to                          |
| `featureId`   | `string`   | no       | ID of a `Feature` node to scope this node to                         |

**Returns**: `{ id: string }` — the ID of the created node in `<type>:<uuid>` format.

**Example**:

```json
{
  "tool": "write_node",
  "params": {
    "type": "open-question",
    "title": "Should we use PDF or HTML for invoice output?",
    "description": "The invoicing feature needs an output format. PDF is portable but harder to style dynamically. HTML is flexible but requires a PDF renderer for download.",
    "createdBy": "billing-agent",
    "urgency": "medium",
    "domainId": "domain:billing-001"
  }
}
// Returns: { "id": "open-question:abc-123" }
```

---

### `link_nodes`

Creates a directed relationship between two existing nodes.

**Parameters**:

| Name       | Type     | Required | Description                                                                    |
|------------|----------|----------|--------------------------------------------------------------------------------|
| `sourceId` | `string` | yes      | ID of the source node                                                          |
| `targetId` | `string` | yes      | ID of the target node                                                          |
| `edgeType` | `string` | yes      | Semantic edge type: `resolves`, `suggests`, `selected`, `belongs-to`, `has-feature`, `caused-by`, `addresses` |

**Returns**: `{ success: boolean, error?: string }`

**Example**:

```json
{
  "tool": "link_nodes",
  "params": {
    "sourceId": "alternative:pdf-option",
    "targetId": "open-question:abc-123",
    "edgeType": "suggests"
  }
}
// Returns: { "success": true }
```

---

### `update_status`

Updates the status of an existing node. Enforces valid status transitions — attempts to make invalid transitions return an error rather than silently writing an invalid state.

**Parameters**:

| Name     | Type     | Required | Description                           |
|----------|----------|----------|---------------------------------------|
| `nodeId` | `string` | yes      | ID of the node to update              |
| `status` | `string` | yes      | The new status value                  |

**Returns**: `{ success: boolean, error?: string }`

**Example**:

```json
{
  "tool": "update_status",
  "params": {
    "nodeId": "open-question:abc-123",
    "status": "resolved"
  }
}
// Returns: { "success": true }
```

---

### `get_trail`

Returns a list of recent nodes, optionally filtered. Primary tool for humans reviewing what the agent has written. Also used by agents checking the current state of the graph.

**Parameters**:

| Name       | Type     | Required | Description                                                      |
|------------|----------|----------|------------------------------------------------------------------|
| `type`     | `string` | no       | Filter by node type (e.g., `open-question`, `blocker`)           |
| `status`   | `string` | no       | Filter by status (e.g., `open`, `resolved`)                      |
| `domainId` | `string` | no       | Filter to nodes belonging to this Domain                         |

**Returns**: `WaymarkNode[]` — ordered by `createdAt` descending, up to 20 nodes.

**Example**:

```json
{
  "tool": "get_trail",
  "params": {
    "type": "open-question",
    "status": "open"
  }
}
```

---

### `get_node`

Retrieves a single node by ID.

**Parameters**:

| Name     | Type     | Required | Description            |
|----------|----------|----------|------------------------|
| `nodeId` | `string` | yes      | ID of the node to fetch |

**Returns**: `WaymarkNode | null` — the node if found, `null` if no node with that ID exists.

**Example**:

```json
{
  "tool": "get_node",
  "params": {
    "nodeId": "decision:def-456"
  }
}
```

---

### `get_open_questions`

Returns all `OpenQuestion` nodes with status `open`. Optionally scoped to a domain.

**Parameters**:

| Name       | Type     | Required | Description                                   |
|------------|----------|----------|-----------------------------------------------|
| `domainId` | `string` | no       | Filter to questions in a specific Domain      |

**Returns**: `WaymarkNode[]` — all open questions, ordered by `createdAt` descending.

**Example**:

```json
{
  "tool": "get_open_questions",
  "params": {}
}
```

---

### `get_blockers`

Returns all `Blocker` nodes with status `open`.

**Parameters**: none

**Returns**: `WaymarkNode[]` — all open blockers, ordered by `createdAt` descending.

**Example**:

```json
{
  "tool": "get_blockers",
  "params": {}
}
```

---

### `resolve_question`

Links a `Decision` to an `OpenQuestion` via a `RESOLVES` edge and updates the question's status to `resolved`. This is the completion step after a human writes a decision — it ties the two nodes together and closes the question.

**Parameters**:

| Name         | Type     | Required | Description                              |
|--------------|----------|----------|------------------------------------------|
| `questionId` | `string` | yes      | ID of the `OpenQuestion` to resolve      |
| `decisionId` | `string` | yes      | ID of the `Decision` that resolves it    |

**Returns**: `{ success: boolean, error?: string }`

**Example**:

```json
{
  "tool": "resolve_question",
  "params": {
    "questionId": "open-question:abc-123",
    "decisionId": "decision:def-456"
  }
}
// Returns: { "success": true }
```

---

## How Agents Should Use the MCP Tools

The recommended agent pattern:

```
1. When hitting uncertainty:
   → write_node("open-question", title, description, urgency)
   → record the returned ID

2. If multiple paths exist:
   → write_node("alternative", ...) for each option (up to 3)
   → link_nodes(altId, questionId, "suggests") for each
   → write pros/cons in each Alternative's description or properties

3. If hard blocked:
   → write_node("blocker", ...)
   → if the blocker stems from an open question:
       link_nodes(blockerId, questionId, "caused-by")

4. If work is needed to address a gap:
   → write_node("task", ...)
   → link_nodes(taskId, gapId, "addresses")

5. After writing, continue other work where possible.
   Do not wait synchronously for human resolution.

6. On the next cycle, or when reaching a decision point:
   → get_open_questions() to check if your question was resolved
   → if the question is no longer open, get_node(questionId) to read the Decision
   → read the Decision's rationale and continue with the chosen path
```

**Scoping to a Domain or Feature**: If the project uses Domain and Feature nodes, pass `domainId` or `featureId` when writing nodes. This lets humans filter the trail by bounded context and keeps unrelated questions from appearing in the same view.

**Handling write failures**: If `write_node` returns an error (Neo4j unreachable, invalid parameters), do not assume the write succeeded. Log the error and, if the write was critical, surface it as part of your task output rather than continuing silently.

---

## Claude Code MCP Configuration

### Manual installation (pointing at a built package)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "waymark": {
      "command": "node",
      "args": ["/path/to/waymark-plugin/packages/core/dist/bin/waymark-mcp.js"],
      "env": {
        "WAYMARK_PROJECT_ROOT": "/your/project/root"
      }
    }
  }
}
```

Replace `/path/to/waymark-plugin` with the absolute path to the Waymark package and `/your/project/root` with the root of the project whose `.waymark/` credentials file the server should read.

### After running `install.sh`

Once `install.sh` has installed the `waymark-mcp` binary to your PATH:

```json
{
  "mcpServers": {
    "waymark": {
      "command": "waymark-mcp"
    }
  }
}
```

The `WAYMARK_PROJECT_ROOT` env var is not required when invoking from within a project directory — the server falls back to `cwd()` if the env var is not set.

---

## Entry Point

**File**: `src/bin/waymark-mcp.ts`

At startup, the server reads the `WAYMARK_PROJECT_ROOT` environment variable. If set, it uses that path as the project root. If not set, it falls back to `process.cwd()`.

The project root is where the server looks for the `.waymark/` directory containing the Neo4j connection credentials (URI, username, password). This allows the same compiled server binary (`dist/bin/waymark-mcp.js` or the installed `waymark-mcp` executable) to work across multiple projects: each project has its own `.waymark/` config, and the server finds the right one based on `WAYMARK_PROJECT_ROOT`.

This means you can:
- Run one global `waymark-mcp` binary
- Point it at different projects via the env var
- Each project connects to its own Neo4j instance (local, Aura, or otherwise)

---

## Error Propagation

Waymark explicitly propagates connection errors rather than swallowing them.

When Neo4j is unreachable, the server returns:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Failed to connect to Neo4j: ServiceUnavailable: Connection was refused..."
    }
  ]
}
```

This is intentional. A tool that silently returns `[]` on connection failure makes it impossible for the calling agent to distinguish between:
- "There are no open questions" (the graph is healthy, nothing was written)
- "The graph is unreachable" (the result is meaningless)

By returning `isError: true` with the connection error message, agents can detect the failure, stop treating the empty result as meaningful, and surface the problem rather than making decisions based on a broken read.
