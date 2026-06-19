import type { Session } from "neo4j-driver";
import { toNeo4jLabel } from "../schema.js";
import { TERMINAL_STATUSES } from "../types.js";
import type { WaymarkNode, WaymarkNodeType } from "../types.js";

export async function getTrail(
  session: Session,
  filter?: { type?: WaymarkNodeType; status?: string; includeResolved?: boolean }
): Promise<WaymarkNode[]> {
  let query: string;
  const params: Record<string, unknown> = {};

  if (filter?.type) {
    query = `MATCH (n:\`${toNeo4jLabel(filter.type)}\`) WHERE n.id IS NOT NULL`;
  } else {
    query = `MATCH (n) WHERE n.id IS NOT NULL AND n.type IS NOT NULL`;
  }

  if (filter?.status) {
    query += ` AND n.status = $status`;
    params["status"] = filter.status;
  } else if (!filter?.includeResolved) {
    query += ` AND (n.status IS NULL OR NOT n.status IN $terminalStatuses)`;
    params["terminalStatuses"] = TERMINAL_STATUSES;
  }

  query += ` RETURN n ORDER BY n.createdAt DESC`;

  const result = await session.run(query, params);
  return result.records.map((r) => r.get("n").properties as WaymarkNode);
}

export async function getNode(session: Session, nodeId: string): Promise<WaymarkNode | null> {
  const result = await session.run(
    `MATCH (n {id: $nodeId}) RETURN n`,
    { nodeId }
  );
  if (result.records.length === 0) return null;
  return result.records[0].get("n").properties as WaymarkNode;
}

export async function getOpenQuestions(session: Session): Promise<WaymarkNode[]> {
  return getTrail(session, { type: "open-question", status: "open" });
}

export async function getBlockers(session: Session): Promise<WaymarkNode[]> {
  return getTrail(session, { type: "blocker", status: "open" });
}

export async function resolveQuestion(
  session: Session,
  questionId: string,
  decisionId: string
): Promise<{ success: boolean; error?: string }> {
  const check = await session.run(
    `MATCH (q {id: $questionId}), (d {id: $decisionId})
     RETURN q.type AS qt, d.type AS dt, q.status AS qs`,
    { questionId, decisionId }
  );

  if (check.records.length === 0) {
    return { success: false, error: "Question or decision node not found" };
  }

  const qt = check.records[0].get("qt") as string;
  const dt = check.records[0].get("dt") as string;
  const qs = check.records[0].get("qs") as string;

  if (qt !== "open-question") {
    return { success: false, error: `Node ${questionId} is not an OpenQuestion (got: ${qt})` };
  }
  if (dt !== "decision") {
    return { success: false, error: `Node ${decisionId} is not a Decision (got: ${dt})` };
  }
  if (qs === "resolved") {
    return { success: false, error: `OpenQuestion ${questionId} is already resolved` };
  }

  const now = new Date().toISOString();

  // Link decision, mark question resolved, archive proposed alternatives
  await session.run(
    `MATCH (d {id: $decisionId}), (q {id: $questionId})
     MERGE (d)-[r:RESOLVES]->(q)
     ON CREATE SET r.createdAt = $now
     SET q.status = 'resolved', q.updatedAt = $now
     WITH q
     OPTIONAL MATCH (a:Alternative)-[:SUGGESTS]->(q)
     WHERE a.status = 'proposed'
     SET a.status = 'rejected', a.updatedAt = $now`,
    { questionId, decisionId, now }
  );

  return { success: true };
}
