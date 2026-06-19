import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createSession } from "../neo4j-session.js";
import { writeNode, linkNodes, updateStatus } from "./write-tools.js";
import { getTrail, getNode, getOpenQuestions, getBlockers, resolveQuestion } from "./read-tools.js";
import type { WaymarkNodeType, WaymarkEdgeType, WaymarkStatus } from "../types.js";

export async function startMCPServer(projectRoot: string): Promise<void> {
  const server = new Server(
    { name: "waymark", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "write_node",
        description: "Write a Waymark node to Neo4j. Types: open-question, blocker, gap, decision, alternative, task.",
        inputSchema: {
          type: "object" as const,
          properties: {
            type: {
              type: "string",
              enum: ["open-question", "blocker", "gap", "decision", "alternative", "task"],
              description: "The node type",
            },
            title: { type: "string", description: "Short label" },
            description: { type: "string", description: "Detailed explanation" },
            createdBy: { type: "string", description: "Agent or human identifier" },
            urgency: { type: "string", enum: ["low", "medium", "high"] },
            rationale: { type: "string" },
            pros: { type: "array", items: { type: "string" } },
            cons: { type: "array", items: { type: "string" } },
            recurrence: { type: "string", enum: ["one-time", "recurring"] },
          },
          required: ["type", "title", "description"],
        },
      },
      {
        name: "link_nodes",
        description: "Create a relationship between two Waymark nodes.",
        inputSchema: {
          type: "object" as const,
          properties: {
            sourceId: { type: "string" },
            targetId: { type: "string" },
            edgeType: {
              type: "string",
              enum: ["resolves", "suggests", "selected", "caused-by"],
            },
          },
          required: ["sourceId", "targetId", "edgeType"],
        },
      },
      {
        name: "update_status",
        description: "Update a node's status following allowed lifecycle transitions.",
        inputSchema: {
          type: "object" as const,
          properties: {
            nodeId: { type: "string" },
            status: { type: "string", description: "Target status" },
          },
          required: ["nodeId", "status"],
        },
      },
      {
        name: "get_trail",
        description: "Read Waymark nodes, optionally filtered by type or status. By default excludes resolved/archived items.",
        inputSchema: {
          type: "object" as const,
          properties: {
            type: { type: "string" },
            status: { type: "string" },
            includeResolved: { type: "boolean", description: "Include resolved/archived items. Default false." },
          },
        },
      },
      {
        name: "get_node",
        description: "Get a single Waymark node by ID.",
        inputSchema: {
          type: "object" as const,
          properties: { nodeId: { type: "string" } },
          required: ["nodeId"],
        },
      },
      {
        name: "get_open_questions",
        description: "Get all unresolved OpenQuestion nodes.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "get_blockers",
        description: "Get all open Blocker nodes.",
        inputSchema: { type: "object" as const, properties: {} },
      },
      {
        name: "resolve_question",
        description: "Atomically link a Decision to an OpenQuestion and mark it resolved.",
        inputSchema: {
          type: "object" as const,
          properties: {
            questionId: { type: "string" },
            decisionId: { type: "string" },
          },
          required: ["questionId", "decisionId"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const sessionResult = await createSession(projectRoot);

    if (!sessionResult.success) {
      return {
        content: [{ type: "text" as const, text: `Neo4j connection failed: ${sessionResult.error}` }],
        isError: true,
      };
    }

    const { session, close } = sessionResult;

    try {
      let result: unknown;

      switch (name) {
        case "write_node":
          result = await writeNode(session, args["type"] as WaymarkNodeType, args as Parameters<typeof writeNode>[2]);
          break;
        case "link_nodes":
          result = await linkNodes(
            session,
            args["sourceId"] as string,
            args["targetId"] as string,
            args["edgeType"] as WaymarkEdgeType
          );
          break;
        case "update_status":
          result = await updateStatus(session, args["nodeId"] as string, args["status"] as WaymarkStatus);
          break;
        case "get_trail":
          result = await getTrail(session, args as Parameters<typeof getTrail>[1]);
          break;
        case "get_node":
          result = await getNode(session, args["nodeId"] as string);
          break;
        case "get_open_questions":
          result = await getOpenQuestions(session);
          break;
        case "get_blockers":
          result = await getBlockers(session);
          break;
        case "resolve_question":
          result = await resolveQuestion(
            session,
            args["questionId"] as string,
            args["decisionId"] as string
          );
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } finally {
      await close();
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
