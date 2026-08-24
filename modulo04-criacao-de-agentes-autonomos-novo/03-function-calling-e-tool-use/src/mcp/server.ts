import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { seedOpsStore } from "../store/seed.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { createOpsMcpServer } from "./create-server.js";

/**
 * MCP stdio entrypoint. stdout is reserved for the protocol —
 * use console.error / stderr for diagnostics only.
 */
export async function main(): Promise<void> {
  const store = new SqliteOpsStore(process.env.OPSPILOT_DB ?? "./data/opspilot.db");
  seedOpsStore(store);

  const server = createOpsMcpServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("opspilot MCP server: pronto (stdio)");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(currentFile)) {
  main().catch((error) => {
    console.error(error instanceof Error ? `Error: ${error.message}` : String(error));
    process.exit(1);
  });
}
