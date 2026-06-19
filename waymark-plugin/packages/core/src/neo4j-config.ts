import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const GLOBAL_CONFIG_DIR = ".waymark";
export const GLOBAL_CONFIG_FILE = "neo4j.env";

export const ENV_VARS = {
  URI: "NEO4J_URI",
  DATABASE: "NEO4J_DATABASE",
  USERNAME: "NEO4J_USERNAME",
  PASSWORD: "NEO4J_PASSWORD",
  CONNECTION_TYPE: "NEO4J_CONNECTION_TYPE",
} as const;

export type ConnectionType = "driver" | "cypher-shell";

export const DEFAULTS = {
  DATABASE: "waymark",
  CONNECTION_TYPE: "driver" as ConnectionType,
  URI: "neo4j://127.0.0.1:7687",
  USERNAME: "neo4j",
};

export interface Neo4jConfig {
  uri: string;
  database: string;
  username: string;
  password: string;
  connectionType: ConnectionType;
}

export interface ConfigLoadResult {
  success: boolean;
  config?: Neo4jConfig;
  error?: string;
  source?: "project" | "global" | "environment" | "none";
}

export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

function serializeConfig(config: Neo4jConfig): string {
  return [
    `# Waymark Neo4j configuration`,
    `# Do not commit this file`,
    ``,
    `${ENV_VARS.URI}=${config.uri}`,
    `${ENV_VARS.DATABASE}=${config.database}`,
    `${ENV_VARS.USERNAME}=${config.username}`,
    `${ENV_VARS.PASSWORD}=${config.password}`,
    `${ENV_VARS.CONNECTION_TYPE}=${config.connectionType}`,
    ``,
  ].join("\n");
}

function configFromVars(vars: Record<string, string>): Neo4jConfig | null {
  if (!vars[ENV_VARS.URI] && !process.env[ENV_VARS.URI]) return null;
  return {
    uri: vars[ENV_VARS.URI] ?? DEFAULTS.URI,
    database: vars[ENV_VARS.DATABASE] ?? DEFAULTS.DATABASE,
    username: vars[ENV_VARS.USERNAME] ?? DEFAULTS.USERNAME,
    password: vars[ENV_VARS.PASSWORD] ?? "",
    connectionType: (vars[ENV_VARS.CONNECTION_TYPE] as ConnectionType) ?? DEFAULTS.CONNECTION_TYPE,
  };
}

function loadFromEnvFile(filePath: string): Neo4jConfig | null {
  if (!existsSync(filePath)) return null;
  try {
    const vars = parseEnvContent(readFileSync(filePath, "utf-8"));
    return configFromVars(vars);
  } catch {
    return null;
  }
}

function loadFromEnvironment(): Neo4jConfig | null {
  if (!process.env[ENV_VARS.URI] || !process.env[ENV_VARS.USERNAME]) return null;
  return {
    uri: process.env[ENV_VARS.URI] ?? DEFAULTS.URI,
    database: process.env[ENV_VARS.DATABASE] ?? DEFAULTS.DATABASE,
    username: process.env[ENV_VARS.USERNAME] ?? DEFAULTS.USERNAME,
    password: process.env[ENV_VARS.PASSWORD] ?? "",
    connectionType: (process.env[ENV_VARS.CONNECTION_TYPE] as ConnectionType) ?? DEFAULTS.CONNECTION_TYPE,
  };
}

export function loadConfig(projectRoot: string): ConfigLoadResult {
  const fromEnv = loadFromEnvironment();
  if (fromEnv) return { success: true, config: fromEnv, source: "environment" };

  const fromProject = loadFromEnvFile(join(projectRoot, ".env"));
  if (fromProject) return { success: true, config: fromProject, source: "project" };

  const fromGlobal = loadFromEnvFile(join(homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE));
  if (fromGlobal) return { success: true, config: fromGlobal, source: "global" };

  return {
    success: false,
    error: "No Neo4j configuration found. Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD env vars, or create .env at project root, or create ~/.waymark/neo4j.env.",
    source: "none",
  };
}

export function saveConfig(projectRoot: string, config: Neo4jConfig): void {
  writeFileSync(join(projectRoot, ".env"), serializeConfig(config), "utf-8");
  ensureEnvInGitignore(projectRoot);
}

export function saveGlobalConfig(config: Neo4jConfig): void {
  const dir = join(homedir(), GLOBAL_CONFIG_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, GLOBAL_CONFIG_FILE), serializeConfig(config), "utf-8");
}

export function ensureEnvInGitignore(projectRoot: string): void {
  const gitignorePath = join(projectRoot, ".gitignore");
  const entry = ".env";
  if (existsSync(gitignorePath)) {
    const lines = readFileSync(gitignorePath, "utf-8").split("\n").map((l) => l.trim());
    if (lines.includes(entry)) return;
    appendFileSync(gitignorePath, `\n# Waymark — Neo4j credentials\n${entry}\n`, "utf-8");
  } else {
    writeFileSync(gitignorePath, `# Waymark — Neo4j credentials\n${entry}\n`, "utf-8");
  }
}

export function buildCypherShellCommand(
  config: Neo4jConfig,
  query: string
): { command: string; args: string[] } {
  return {
    command: "cypher-shell",
    args: [
      "-a", config.uri,
      "-u", config.username,
      "-p", config.password,
      "-d", config.database,
      "--format", "plain",
      query,
    ],
  };
}

export function hasConfig(projectRoot: string): boolean {
  return loadConfig(projectRoot).success;
}
