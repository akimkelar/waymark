import neo4j, { type Session } from "neo4j-driver";
import { loadConfig } from "./neo4j-config.js";

export type SessionResult =
  | { success: true; session: Session; close: () => Promise<void> }
  | { success: false; error: string };

export async function createSession(projectRoot: string): Promise<SessionResult> {
  const cfg = loadConfig(projectRoot);
  if (!cfg.success || !cfg.config) {
    return {
      success: false,
      error: cfg.error ?? "No Neo4j configuration found",
    };
  }

  const { uri, username, password, database } = cfg.config;
  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

  try {
    await driver.verifyConnectivity();
  } catch (err) {
    await driver.close();
    return {
      success: false,
      error: `Cannot connect to Neo4j at ${uri}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const session = driver.session({ database });
  return {
    success: true,
    session,
    close: async () => {
      await session.close();
      await driver.close();
    },
  };
}
