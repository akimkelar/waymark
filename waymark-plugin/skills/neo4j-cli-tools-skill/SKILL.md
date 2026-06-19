# Neo4j CLI Tools Reference

Reference documentation for Neo4j CLI tools used by the Waymark plugin.

## Tools covered

- **cypher-shell** — Execute Cypher queries against Neo4j directly from the CLI
- **neo4j-admin** — Database administration operations
- **aura-cli** — Manage Neo4j Aura cloud instances
- **neo4j-mcp** — Run Neo4j as an MCP server

## References

- [cypher-shell](references/cypher-shell-reference.md)
- [neo4j-admin](references/neo4j-admin-reference.md)
- [aura-cli](references/aura-cli-reference.md)
- [neo4j-mcp](references/neo4j-mcp-reference.md)

## Waymark database

Default database name: `waymark`

Common queries for the Waymark trail:

```cypher
// All open questions
MATCH (q:OpenQuestion {status: 'open'}) RETURN q ORDER BY q.createdAt DESC;

// All open blockers
MATCH (b:Blocker {status: 'open'}) RETURN b ORDER BY b.createdAt DESC;

// Full trail (last 20 items)
MATCH (n) WHERE n.id IS NOT NULL RETURN n ORDER BY n.createdAt DESC LIMIT 20;

// Unresolved items linked to a domain
MATCH (n {domainId: 'YOUR_DOMAIN_ID'}) WHERE n.status IN ['open', 'draft'] RETURN n;

// All items created by a specific agent
MATCH (n {createdBy: 'agent-id'}) RETURN n ORDER BY n.createdAt DESC;

// Decision → OpenQuestion resolution chain
MATCH (d:Decision)-[:RESOLVES]->(q:OpenQuestion) RETURN d, q;

// Alternatives for an open question
MATCH (a:Alternative)-[:SUGGESTS]->(q:OpenQuestion {id: 'YOUR_ID'}) RETURN a;
```
