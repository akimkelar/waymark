import { describe, it, expect } from "vitest";
import { getInitialStatus, isValidTransition, getAllowedTransitions } from "../lifecycle.js";

describe("getInitialStatus", () => {
  it("open-question starts as open", () => {
    expect(getInitialStatus("open-question")).toBe("open");
  });
  it("blocker starts as open", () => {
    expect(getInitialStatus("blocker")).toBe("open");
  });
  it("gap starts as open", () => {
    expect(getInitialStatus("gap")).toBe("open");
  });
  it("decision starts as draft", () => {
    expect(getInitialStatus("decision")).toBe("draft");
  });
  it("alternative starts as proposed", () => {
    expect(getInitialStatus("alternative")).toBe("proposed");
  });
  it("task starts as open", () => {
    expect(getInitialStatus("task")).toBe("open");
  });
});

describe("isValidTransition", () => {
  it("open-question: open → resolved is valid", () => {
    expect(isValidTransition("open-question", "open", "resolved")).toBe(true);
  });
  it("open-question: resolved → open is invalid", () => {
    expect(isValidTransition("open-question", "resolved", "open")).toBe(false);
  });
  it("blocker: open → unblocked is valid", () => {
    expect(isValidTransition("blocker", "open", "unblocked")).toBe(true);
  });
  it("decision: draft → accepted is valid", () => {
    expect(isValidTransition("decision", "draft", "accepted")).toBe(true);
  });
  it("decision: accepted → deprecated is valid", () => {
    expect(isValidTransition("decision", "accepted", "deprecated")).toBe(true);
  });
  it("decision: deprecated → accepted is invalid", () => {
    expect(isValidTransition("decision", "deprecated", "accepted")).toBe(false);
  });
  it("task: open → in-progress is valid", () => {
    expect(isValidTransition("task", "open", "in-progress")).toBe(true);
  });
  it("task: done → open is invalid", () => {
    expect(isValidTransition("task", "done", "open")).toBe(false);
  });
  it("alternative: proposed → selected is valid", () => {
    expect(isValidTransition("alternative", "proposed", "selected")).toBe(true);
  });
  it("alternative: proposed → rejected is valid", () => {
    expect(isValidTransition("alternative", "proposed", "rejected")).toBe(true);
  });
});

describe("getAllowedTransitions", () => {
  it("open-question in open state allows resolved", () => {
    expect(getAllowedTransitions("open-question", "open")).toContain("resolved");
  });
  it("task in in-progress allows done and cancelled", () => {
    const allowed = getAllowedTransitions("task", "in-progress");
    expect(allowed).toContain("done");
    expect(allowed).toContain("cancelled");
  });
  it("terminal statuses have no further transitions", () => {
    expect(getAllowedTransitions("open-question", "resolved")).toHaveLength(0);
    expect(getAllowedTransitions("blocker", "unblocked")).toHaveLength(0);
    expect(getAllowedTransitions("gap", "closed")).toHaveLength(0);
  });
});
