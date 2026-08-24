import { tool, type DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

import { IncidentNotFoundError } from "../domain/errors.js";
import type { IStore } from "../domain/types.js";

const listAlertsSchema = z.object({
  status: z.preprocess((value) => value ?? "firing", z.enum(["firing", "resolved", "all"])),
});

const openIncidentSchema = z.object({
  title: z.string().min(1),
  service: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
});

const resolveIncidentSchema = z.object({
  id: z.string().min(1),
});

export function createListAlertsTool(store: IStore): DynamicStructuredTool<typeof listAlertsSchema> {
  return tool(
    async (input) => {
      const normalized = input.status;
      const alerts = normalized === "all" ? store.getAlerts() : store.getAlerts(normalized);

      if (alerts.length === 0) {
        return normalized === "all"
          ? "No alerts found."
          : `No ${normalized} alerts found.`;
      }

      const scope = normalized === "all" ? "alert(s)" : `${normalized} alert(s)`;
      const header = `Found ${alerts.length} ${scope}:`;
      const lines = alerts.map(
        (alert) => `- [${alert.id}] ${alert.service} | ${alert.severity} | ${alert.description}`,
      );
      return [header, ...lines].join("\n");
    },
    {
      name: "list_alerts",
      description: "List alerts by status.",
      schema: listAlertsSchema,
    },
  );
}

export function createOpenIncidentTool(store: IStore): DynamicStructuredTool<typeof openIncidentSchema> {
  return tool(
    async ({ title, service, severity }) => {
      const incident = store.createIncident({ title, service, severity });
      return [
        `Incident created successfully. ID: ${incident.id}`,
        `Title: ${incident.title}`,
        `Service: ${incident.service}`,
        `Severity: ${incident.severity}`,
        `Status: ${incident.status}`,
      ].join("\n");
    },
    {
      name: "open_incident",
      description:
        "Open a new incident for a service. severity must be critical|high|medium|low (sev1=critical, sev2=high, sev3=medium, sev4=low). Use exact service names from the user request.",
      schema: openIncidentSchema,
    },
  );
}

export function createResolveIncidentTool(
  store: IStore,
): DynamicStructuredTool<typeof resolveIncidentSchema> {
  return tool(
    async ({ id }) => {
      try {
        const incident = store.resolveIncident(id);
        return [
          `Incident ${incident.id} has been resolved.`,
          `Service: ${incident.service}`,
          `Resolved at: ${new Date(incident.resolvedAt ?? Date.now()).toISOString()}`,
        ].join("\n");
      } catch (error) {
        if (error instanceof IncidentNotFoundError) {
          return `Error: ${error.message}`;
        }
        throw error;
      }
    },
    {
      name: "resolve_incident",
      description: "Resolve an existing incident by id.",
      schema: resolveIncidentSchema,
    },
  );
}

export function createTools(store: IStore): DynamicStructuredTool[] {
  return [createListAlertsTool(store), createOpenIncidentTool(store), createResolveIncidentTool(store)];
}
