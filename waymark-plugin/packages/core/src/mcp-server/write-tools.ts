import { randomUUID } from "node:crypto";
import type { Session } from "neo4j-driver";
import { toNeo4jLabel, toNeo4jRelType } from "../schema.js";
import { getInitialStatus, isValidTransition } from "../lifecycle.js";
import type { WaymarkNodeType, WaymarkEdgeType, WaymarkStatus } from "../types.js";

export async function writeNode(
  session: Session,
  type: WaymarkNodeType,
  props: {
    title: string;
    description: string;
    createdBy?: string;
    urgency?: "low" | "medium" | "high";
    rationale?: string;
    pros?: string[];
    cons?: string[];
    recurrence?: "one-time" | "recurring";
    domainId?: string;
    featureId?: string;
  }
): Promise<{ id: string }> {
  const id = `${type}:${randomUUID()}`;
  const now = new Date().toISOString();
  const label = toNeo4jLabel(type);
  const status = getInitialStatus(type);

  const nodeProps: Record<string, unknown> = {
    id,
    type,
    title: props.title,
    description: props.description,
    createdAt: now,
    updatedAt: now,
    ...(status !== undefined && { status }),
    ...(props.createdBy !== undefined && { createdBy: props.createdBy }),
    ...(props.urgency !== undefined && { urgency: props.urgency }),
    ...(props.rationale !== undefined && { rationale: props.rationale }),
    ...(props.pros !== undefined && { pros: props.pros }),
    ...(props.cons !== undefined && { cons: props.cons }),
    ...(props.recurrence !== undefined && { recurrence: props.recurrence }),
    ...(props.domainId !== undefined && { domainId: props.domainId }),
    ...(props.featureId !== undefined && { featureId: props.featureId }),
  };

  await session.run(
    `MERGE (n:\`${label}\` {id: $id}) SET n += $props RETURN n`,
    { id, props: nodeProps }
  );

  return { id };
}

export async function linkNodes(
  session: Session,
  sourceId: string,
  targetId: string,
  edgeType: WaymarkEdgeType
): Promise<{ success: boolean; error?: string }> {
  const relType = toNeo4jRelType(edgeType);
  const now = new Date().toISOString();

  const result = await session.run(
    `MATCH (a {id: $sourceId}), (b {id: $targetId})
     MERGE (a)-[r:\`${relType}\`]->(b)
     ON CREATE SET r.createdAt = $now
     RETURN r`,
    { sourceId, targetId, now }
  );

  if (result.records.length === 0) {
    return { success: false, error: `One or both nodes not found: ${sourceId}, ${targetId}` };
  }
  return { success: true };
}

export async function updateStatus(
  session: Session,
  nodeId: string,
  newStatus: WaymarkStatus
): Promise<{ success: boolean; error?: string }> {
  const found = await session.run(
    `MATCH (n {id: $nodeId}) RETURN n.type AS type, n.status AS status`,
    { nodeId }
  );

  if (found.records.length === 0) {
    return { success: false, error: `Node not found: ${nodeId}` };
  }

  const record = found.records[0];
  const currentStatus = record.get("status") as WaymarkStatus;
  const nodeType = record.get("type") as WaymarkNodeType;

  if (!isValidTransition(nodeType, currentStatus, newStatus)) {
    return {
      success: false,
      error: `Invalid transition for ${nodeType}: ${currentStatus} → ${newStatus}`,
    };
  }

  await session.run(
    `MATCH (n {id: $nodeId}) SET n.status = $newStatus, n.updatedAt = $now`,
    { nodeId, newStatus, now: new Date().toISOString() }
  );

  return { success: true };
}
