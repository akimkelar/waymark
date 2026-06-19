#!/usr/bin/env node
import { resolve } from "node:path";
import { startMCPServer } from "../mcp-server/index.js";

const projectRoot = resolve(process.env["WAYMARK_PROJECT_ROOT"] ?? process.cwd());

startMCPServer(projectRoot).catch((err) => {
  process.stderr.write(
    `waymark-mcp fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
