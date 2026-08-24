import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  createListAlertsTool,
  createOpenIncidentTool,
  createResolveIncidentTool,
  listAlertsSchema,
  openIncidentSchema,
  resolveIncidentSchema,
} from "../agents/tools.js";
import type { OpsStore } from "../domain/types.js";

/** Align with package.json version. */
export const OPSPILOT_MCP_VERSION = "0.1.0";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/**
 * Build an OpsPilot MCP server (name: opspilot) with the v1 catalog:
 * list_alerts, open_incident, resolve_incident.
 * Does not connect a transport — caller connects stdio or in-memory.
 */
export function createOpsMcpServer(store: OpsStore): McpServer {
  const server = new McpServer({
    name: "opspilot",
    version: OPSPILOT_MCP_VERSION,
  });

  const listAlerts = createListAlertsTool(store);
  const openIncident = createOpenIncidentTool(store);
  const resolveIncident = createResolveIncidentTool(store);

  server.registerTool(
    "list_alerts",
    {
      description: listAlerts.description,
      inputSchema: listAlertsSchema,
    },
    async (args) => {
      const text = await listAlerts.invoke(args);
      return textResult(String(text));
    },
  );

  server.registerTool(
    "open_incident",
    {
      description: openIncident.description,
      inputSchema: openIncidentSchema,
    },
    async (args) => {
      const text = await openIncident.invoke(args);
      return textResult(String(text));
    },
  );

  server.registerTool(
    "resolve_incident",
    {
      description: resolveIncident.description,
      inputSchema: resolveIncidentSchema,
    },
    async (args) => {
      const text = await resolveIncident.invoke(args);
      return textResult(String(text));
    },
  );

  return server;
}
