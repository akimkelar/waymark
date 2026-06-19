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
  it("converts domain to Domain", () => {
    expect(toNeo4jLabel("domain")).toBe("Domain");
  });
  it("converts feature to Feature", () => {
    expect(toNeo4jLabel("feature")).toBe("Feature");
  });
});

describe("toNeo4jRelType", () => {
  it("converts resolves to RESOLVES", () => {
    expect(toNeo4jRelType("resolves")).toBe("RESOLVES");
  });
  it("converts suggests to SUGGESTS", () => {
    expect(toNeo4jRelType("suggests")).toBe("SUGGESTS");
  });
  it("converts belongs-to to BELONGS_TO", () => {
    expect(toNeo4jRelType("belongs-to")).toBe("BELONGS_TO");
  });
  it("converts has-feature to HAS_FEATURE", () => {
    expect(toNeo4jRelType("has-feature")).toBe("HAS_FEATURE");
  });
});

describe("fromNeo4jLabel", () => {
  it("converts OpenQuestion back to open-question", () => {
    expect(fromNeo4jLabel("OpenQuestion")).toBe("open-question");
  });
  it("returns null for unknown label", () => {
    expect(fromNeo4jLabel("Unknown")).toBeNull();
  });
});
