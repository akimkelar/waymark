export type WaymarkNodeType =
  | "open-question"
  | "blocker"
  | "gap"
  | "decision"
  | "alternative"
  | "task";

export type WaymarkEdgeType =
  | "resolves"
  | "suggests"
  | "selected"
  | "caused-by";

export type OpenQuestionStatus = "open" | "resolved";
export type BlockerStatus = "open" | "unblocked";
export type GapStatus = "open" | "closed";
export type DecisionStatus = "draft" | "accepted" | "deprecated";
export type AlternativeStatus = "proposed" | "selected" | "rejected";
export type TaskStatus = "open" | "in-progress" | "done" | "cancelled";

export type WaymarkStatus =
  | OpenQuestionStatus
  | BlockerStatus
  | GapStatus
  | DecisionStatus
  | AlternativeStatus
  | TaskStatus;

export const TERMINAL_STATUSES: WaymarkStatus[] = [
  "resolved",
  "unblocked",
  "closed",
  "deprecated",
  "done",
  "cancelled",
  "selected",
  "rejected",
];

export interface WaymarkNode {
  id: string;
  type: WaymarkNodeType;
  title: string;
  description: string;
  status?: WaymarkStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  urgency?: "low" | "medium" | "high";
  rationale?: string;
  pros?: string[];
  cons?: string[];
  recurrence?: "one-time" | "recurring";
}

export interface WaymarkEdge {
  sourceId: string;
  targetId: string;
  type: WaymarkEdgeType;
  createdAt: string;
}

export interface WaymarkGraph {
  nodes: WaymarkNode[];
  edges: WaymarkEdge[];
}
