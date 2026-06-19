import type { WaymarkNodeType, WaymarkStatus } from "./types.js";

type TransitionMap = Partial<Record<WaymarkStatus, WaymarkStatus[]>>;
type LifecycleMap = Partial<Record<WaymarkNodeType, { initial: WaymarkStatus; transitions: TransitionMap }>>;

const LIFECYCLE: LifecycleMap = {
  "open-question": {
    initial: "open",
    transitions: { open: ["resolved"] },
  },
  "blocker": {
    initial: "open",
    transitions: { open: ["unblocked"] },
  },
  "gap": {
    initial: "open",
    transitions: { open: ["closed"] },
  },
  "decision": {
    initial: "draft",
    transitions: {
      draft: ["accepted", "deprecated"],
      accepted: ["deprecated"],
    },
  },
  "alternative": {
    initial: "proposed",
    transitions: {
      proposed: ["selected", "rejected"],
    },
  },
  "task": {
    initial: "open",
    transitions: {
      open: ["in-progress", "cancelled"],
      "in-progress": ["done", "cancelled"],
    },
  },
};

export function getInitialStatus(type: WaymarkNodeType): WaymarkStatus | undefined {
  return LIFECYCLE[type]?.initial;
}

export function getAllowedTransitions(type: WaymarkNodeType, current: WaymarkStatus): WaymarkStatus[] {
  return LIFECYCLE[type]?.transitions[current] ?? [];
}

export function isValidTransition(type: WaymarkNodeType, from: WaymarkStatus, to: WaymarkStatus): boolean {
  return getAllowedTransitions(type, from).includes(to);
}
