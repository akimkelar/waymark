# Neo4j Setup and Configuration

This guide walks through setting up Neo4j for use with Waymark, configuring credentials, and verifying connectivity. Waymark stores its knowledge graph in a dedicated Neo4j database named `waymark`.

---

## Prerequisites

Waymark works with any of the following Neo4j deployment options:

- **Neo4j 5.x Community Edition** — free, self-hosted, single-database server
- **Neo4j 5.x Enterprise Edition** — self-hosted with multi-database support and additional features
- **Neo4j Aura** — fully managed cloud service (free and paid tiers available)

Neo4j 4.x is not supported. Use Neo4j 5.x or later.

---

## Creating the Waymark Database

Waymark expects a database named `waymark`. On self-hosted Neo4j 5.x (Community or Enterprise), create it before first use.

Connect to your Neo4j instance and run:

```cypher
CREATE DATABASE waymark IF NOT EXISTS;
```

Using `cypher-shell` from the command line:

```bash
cypher-shell -a neo4j://localhost:7687 -u neo4j -p yourpassword \
  "CREATE DATABASE waymark IF NOT EXISTS"
```

On Community Edition, only one user database is supported alongside the default `neo4j` database. If you are already using the `neo4j` database for something else, consider Enterprise Edition or Aura.

On **Neo4j Aura**, you cannot create additional databases — Aura provides exactly one database per instance. Set `NEO4J_DATABASE` to the name Aura assigned your instance (usually `neo4j`) rather than `waymark`.

---

## Configuration Resolution Order

Waymark resolves Neo4j connection settings in the following order, from highest to lowest priority:

1. **Environment variables** — variables set in the shell or in the MCP server's `env` block in `~/.claude/settings.json`
2. **Project `.env` file** — a `.env` file at the root of your project (the directory where Claude Code is running, or the path set in `WAYMARK_PROJECT_ROOT`)
3. **Global config file** — `~/.waymark/neo4j.env` — shared across all projects on the machine

If a variable is found at a higher-priority source, lower-priority sources are ignored for that variable.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEO4J_URI` | `neo4j://127.0.0.1:7687` | Bolt connection URI for the Neo4j instance |
| `NEO4J_DATABASE` | `waymark` | Database name to connect to |
| `NEO4J_USERNAME` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | _(none, required)_ | Neo4j password — must be set |
| `NEO4J_CONNECTION_TYPE` | `driver` | Connection method: `driver` or `cypher-shell` |

`NEO4J_PASSWORD` has no default and must be provided via one of the configuration sources. Waymark will fail to connect if it is missing.

---

## Global Config File: `~/.waymark/neo4j.env`

The global config file is useful when you want one Neo4j instance shared across multiple projects without repeating credentials in each project's `.env`.

Create the directory and file:

```bash
mkdir -p ~/.waymark
```

Then write `~/.waymark/neo4j.env`:

```ini
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_DATABASE=waymark
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=yourpassword
NEO4J_CONNECTION_TYPE=driver
```

Replace `yourpassword` with the password you set when creating your Neo4j instance.

---

## Project-Level `.env` File

For project-specific overrides — for example, if a project uses a different Neo4j instance or database — create a `.env` file at the project root using the same format:

```ini
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_DATABASE=waymark
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=yourpassword
NEO4J_CONNECTION_TYPE=driver
```

Waymark automatically adds `.env` to `.gitignore` during installation to prevent credentials from being committed to version control. If you manage `.gitignore` manually, add `.env` yourself.

---

## Neo4j Desktop Setup

Neo4j Desktop is the easiest way to run Neo4j locally during development.

1. Download and install Neo4j Desktop from [neo4j.com/download](https://neo4j.com/download/).
2. Open Neo4j Desktop and click **New Project**.
3. Inside the project, click **Add** > **Local DBMS**.
4. Set the DBMS name and choose a password. Neo4j 5.x will be selected by default.
5. Click **Create**, then **Start** to start the DBMS.
6. Open a terminal or use the built-in Neo4j Browser to create the `waymark` database (see [Creating the Waymark Database](#creating-the-waymark-database) above).

The default connection URI for Neo4j Desktop is `neo4j://127.0.0.1:7687`.

---

## Neo4j Aura Setup

Neo4j Aura is a hosted cloud service. The free tier is sufficient for most Waymark use cases.

1. Sign up at [neo4j.com/cloud/aura](https://neo4j.com/cloud/aura/).
2. Click **Create a free instance**. Choose a name and region.
3. After the instance is created, note the **Connection URI** — it will look like `neo4j+s://xxxx.databases.neo4j.io`.
4. Download the credentials file when prompted (you cannot retrieve the generated password later).
5. Set `NEO4J_URI` to the `neo4j+s://` URI and `NEO4J_DATABASE` to `neo4j` (Aura only supports one database per instance — the `CREATE DATABASE` command is not available).

Use `neo4j+s://` (encrypted) for Aura connections. The plain `neo4j://` scheme will not work with Aura.

---

## Verifying the Connection

After configuring credentials, confirm Waymark can reach Neo4j:

```bash
cypher-shell -a $NEO4J_URI -u $NEO4J_USERNAME -p $NEO4J_PASSWORD -d waymark \
  "RETURN 'connected' AS status"
```

Expected output:

```
status
"connected"
```

If the command fails, check that:
- Neo4j is running and the Bolt port (default 7687) is reachable
- The URI scheme matches your setup (`neo4j://` for local, `neo4j+s://` for Aura)
- The username and password are correct
- The database `waymark` exists (or your `NEO4J_DATABASE` value matches the actual database name)

---

## Connection Type: `driver` vs `cypher-shell`

Waymark supports two connection methods, controlled by `NEO4J_CONNECTION_TYPE`.

### `driver` (default)

Uses the official Neo4j JavaScript driver to connect directly over the Bolt protocol. This is the recommended mode:

- Fastest option — no subprocess overhead
- Best for programmatic use and high query throughput
- Supports streaming, transactions, and connection pooling
- Works with both local and cloud (Aura) Neo4j instances

Use `driver` unless you have a specific reason not to.

### `cypher-shell`

Spawns `cypher-shell` as a subprocess for each query. This mode is useful in specific situations:

- The JavaScript driver fails due to DNS resolution issues (common in some corporate networks or VPNs)
- You want to debug queries interactively and see raw `cypher-shell` output
- The driver's version of the Bolt protocol is incompatible with an older Neo4j instance

To use `cypher-shell` mode, `cypher-shell` must be installed and available in `PATH`. It ships with Neo4j Desktop and can be installed separately from [neo4j.com/deployment-center](https://neo4j.com/deployment-center/).

Set the connection type in your config:

```ini
NEO4J_CONNECTION_TYPE=cypher-shell
```
