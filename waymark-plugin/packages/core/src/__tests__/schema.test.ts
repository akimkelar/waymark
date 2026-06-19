import { describe, it, expect } from "vitest";
import { toNeo4jLabel, toNeo4jRelType, fromNeo4jLabel } from "../schema.js";

describe("toNeo4jLabel", () => {
  it("converts open-question to OpenQuestion", () => {
    expect(toNeo4jLabel("open-question")).toBe("OpenQuestion");
  });
  it("converts blocker to Blocker", () => {
    expect(toNeo4jLabel("blocker")).toBe("Blocker");
  });
  it("converts gap to Gap", () => {
    expect(toNeo4jLabel("gap")).toBe("Gap");
  });
  it("converts decision to Decision", () => {
    expect(toNeo4jLabel("decision")).toBe("Decision");
  });
  it("converts alternative to Alternative", () => {
    expect(toNeo4jLabel("alternative")).toBe("Alternative");
  });
  it("converts task to Task", () => {
    expect(toNeo4jLabel("task")).toBe("Task");
  });
});

describe("toNeo4jRelType", () => {
  it("converts resolves to RESOLVES", () => {
    expect(toNeo4jRelType("resolves")).toBe("RESOLVES");
  });
  it("converts suggests to SUGGESTS", () => {
    expect(toNeo4jRelType("suggests")).toBe("SUGGESTS");
  });
  it("converts selected to SELECTED", () => {
    expect(toNeo4jRelType("selected")).toBe("SELECTED");
  });
  it("converts caused-by to CAUSED_BY", () => {
    expect(toNeo4jRelType("caused-by")).toBe("CAUSED_BY");
  });
});

describe("fromNeo4jLabel", () => {
  it("converts OpenQuestion back to open-question", () => {
    expect(fromNeo4jLabel("OpenQuestion")).toBe("open-question");
  });
  it("converts Decision back to decision", () => {
    expect(fromNeo4jLabel("Decision")).toBe("decision");
  });
  it("returns null for unknown label", () => {
    expect(fromNeo4jLabel("Unknown")).toBeNull();
  });
  it("returns null for removed Domain label", () => {
    expect(fromNeo4jLabel("Domain")).toBeNull();
  });
  it("returns null for removed Feature label", () => {
    expect(fromNeo4jLabel("Feature")).toBeNull();
  });
});
