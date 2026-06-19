import type { WaymarkNodeType, WaymarkEdgeType } from "./types.js";

const NODE_LABEL_MAP: Record<WaymarkNodeType, string> = {
  "open-question": "OpenQuestion",
  "blocker": "Blocker",
  "gap": "Gap",
  "decision": "Decision",
  "alternative": "Alternative",
  "task": "Task",
  "domain": "Domain",
  "feature": "Feature",
};

const LABEL_TO_TYPE_MAP: Record<string, WaymarkNodeType> = Object.fromEntries(
  Object.entries(NODE_LABEL_MAP).map(([k, v]) => [v, k as WaymarkNodeType])
);

const EDGE_REL_MAP: Record<WaymarkEdgeType, string> = {
  "resolves": "RESOLVES",
  "suggests": "SUGGESTS",
  "selected": "SELECTED",
  "belongs-to": "BELONGS_TO",
  "has-feature": "HAS_FEATURE",
  "caused-by": "CAUSED_BY",
  "addresses": "ADDRESSES",
};

export function toNeo4jLabel(type: WaymarkNodeType): string {
  return NODE_LABEL_MAP[type];
}

export function toNeo4jRelType(edge: WaymarkEdgeType): string {
  return EDGE_REL_MAP[edge];
}

export function fromNeo4jLabel(label: string): WaymarkNodeType | null {
  return LABEL_TO_TYPE_MAP[label] ?? null;
}
