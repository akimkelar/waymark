import { describe, it, expect } from "vitest";
import { parseEnvContent, DEFAULTS } from "../neo4j-config.js";

describe("DEFAULTS", () => {
  it("uses waymark as the default database", () => {
    expect(DEFAULTS.DATABASE).toBe("waymark");
  });
  it("uses driver as default connection type", () => {
    expect(DEFAULTS.CONNECTION_TYPE).toBe("driver");
  });
});

describe("parseEnvContent", () => {
  it("parses key=value pairs", () => {
    const result = parseEnvContent("NEO4J_URI=neo4j://localhost:7687\nNEO4J_PASSWORD=secret");
    expect(result["NEO4J_URI"]).toBe("neo4j://localhost:7687");
    expect(result["NEO4J_PASSWORD"]).toBe("secret");
  });
  it("strips double quotes", () => {
    const result = parseEnvContent('NEO4J_PASSWORD="my secret"');
    expect(result["NEO4J_PASSWORD"]).toBe("my secret");
  });
  it("strips single quotes", () => {
    const result = parseEnvContent("NEO4J_PASSWORD='my secret'");
    expect(result["NEO4J_PASSWORD"]).toBe("my secret");
  });
  it("ignores comment lines", () => {
    const result = parseEnvContent("# comment\nNEO4J_URI=neo4j://localhost:7687");
    expect(result["# comment"]).toBeUndefined();
    expect(result["NEO4J_URI"]).toBe("neo4j://localhost:7687");
  });
  it("ignores empty lines", () => {
    const result = parseEnvContent("\n\nNEO4J_URI=neo4j://localhost:7687\n\n");
    expect(Object.keys(result)).toHaveLength(1);
  });
});
