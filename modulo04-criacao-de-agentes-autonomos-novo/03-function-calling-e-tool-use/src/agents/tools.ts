import { tool, type DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

import { IncidentNotFoundError, RunbookNotFoundError } from "../domain/errors.js";
import { normalizeSeverity, SEVERITIES } from "../domain/severity.js";
import type { OpsStore } from "../domain/types.js";
import {
  fetchProviderStatus,
  type FetchLike,
  type FetchProviderStatusOptions,
  type ProviderId,
} from "../tools/check-provider-status.js";

/** Shared with MCP server — single source of truth for list_alerts input. */
export const listAlertsSchema = z.object({
  status: z.preprocess(
    (value) => value ?? "firing",
    z
      .enum(["firing", "resolved", "all"])
      .describe(
        'Filtro: "firing" (ativos), "resolved" (encerrados), "all" (todos). Default firing.',
      ),
  ),
});

/** Shared with MCP server — single source of truth for open_incident input. */
export const openIncidentSchema = z.object({
  title: z.string().min(1).describe("Título curto do incidente"),
  service: z
    .string()
    .min(1)
    .describe("Nome exato do serviço afetado (ex.: payments, checkout, auth)"),
  severity: z.preprocess(
    normalizeSeverity,
    z
      .enum(SEVERITIES)
      .describe(
        "Severidade canônica do banco: critical | high | medium | low. Aliases aceitos: sev1→critical, sev2→high, sev3→medium, sev4→low.",
      ),
  ),
});

/** Shared with MCP server — single source of truth for resolve_incident input. */
export const resolveIncidentSchema = z.object({
  id: z.string().min(1).describe("ID do incidente local a resolver (ex.: inc-1722103456789-a3f2)"),
});

const listIncidentsSchema = z.object({
  status: z.preprocess(
    (value) => value ?? "open",
    z
      .enum(["open", "resolved", "all"])
      .describe('Filtro: "open" (default), "resolved", ou "all".'),
  ),
});

const consultarRunbookSchema = z.object({
  service: z.string().min(1).describe("Nome do serviço cujo runbook será consultado"),
});

const checkProviderStatusSchema = z.object({
  provider: z.preprocess(
    (value) => value ?? "github",
    z
      .enum(["github", "cloudflare"])
      .describe(
        'Provedor externo cuja statuspage pública será consultada: "github" (default) ou "cloudflare".',
      ),
  ),
});

export function createListAlertsTool(store: OpsStore): DynamicStructuredTool<typeof listAlertsSchema> {
  return tool(
    async (input) => {
      const normalized = input.status;
      const alerts = normalized === "all" ? store.getAlerts() : store.getAlerts(normalized);

      if (alerts.length === 0) {
        return normalized === "all" ? "No alerts found." : `No ${normalized} alerts found.`;
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
      description:
        "Lista alertas por status. Quando usar: inventário de alertas operacionais. Quando não usar: para incidentes formais (use list_incidents) ou procedimentos (use consultar_runbook).",
      schema: listAlertsSchema,
    },
  );
}

export function createOpenIncidentTool(
  store: OpsStore,
): DynamicStructuredTool<typeof openIncidentSchema> {
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
        "Abre um incidente formal para um serviço. Quando usar: após identificar problema que exige registro (ex. alerta crítico em investigação). Quando não usar: só para consultar alertas; não use se o incidente já existe (aí list_incidents / resolve_incident). severity MUST ser o valor do banco: critical | high | medium | low (aliases sev1→critical, sev2→high, sev3→medium, sev4→low). Use nomes de serviço exatos do pedido.",
      schema: openIncidentSchema,
    },
  );
}

export function createResolveIncidentTool(
  store: OpsStore,
): DynamicStructuredTool<typeof resolveIncidentSchema> {
  return tool(
    async ({ id }) => {
      try {
        // Local OpsStore mutation — not an external LLM/API call.
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
      description:
        "Marca como resolvido um incidente já aberto no store local do OpsPilot (SQLite/in-memory). Quando usar: mitigação concluída e o incidente local deve fechar. Quando não usar: para criar incidente novo, listar estado, ou qualquer ação fora do store local — não é API externa.",
      schema: resolveIncidentSchema,
    },
  );
}

export function createListIncidentsTool(
  store: OpsStore,
): DynamicStructuredTool<typeof listIncidentsSchema> {
  return tool(
    async (input) => {
      const normalized = input.status;
      const incidents =
        normalized === "all" ? store.getIncidents() : store.getIncidents(normalized);

      if (incidents.length === 0) {
        return normalized === "all"
          ? "No incidents found."
          : `No ${normalized} incidents found.`;
      }

      const scope = normalized === "all" ? "incident(s)" : `${normalized} incident(s)`;
      const header = `Found ${incidents.length} ${scope}:`;
      const lines = incidents.map((incident) => {
        const summaryPart = incident.summary ? ` | summary: ${incident.summary}` : "";
        return `- [${incident.id}] ${incident.title} | ${incident.service} | ${incident.severity} | ${incident.status}${summaryPart}`;
      });
      return [header, ...lines].join("\n");
    },
    {
      name: "list_incidents",
      description:
        "Lista incidentes por status. Quando usar: ver incidentes abertos/resolvidos/todos no plantão. Quando não usar: para alertas crus (list_alerts) ou texto de runbook (consultar_runbook).",
      schema: listIncidentsSchema,
    },
  );
}

export function createConsultarRunbookTool(
  store: OpsStore,
): DynamicStructuredTool<typeof consultarRunbookSchema> {
  return tool(
    async ({ service }) => {
      try {
        const runbook = store.getRunbook(service);
        return `Runbook for ${runbook.service}:\n${runbook.content}`;
      } catch (error) {
        if (error instanceof RunbookNotFoundError) {
          return `Error: ${error.message}`;
        }
        throw error;
      }
    },
    {
      name: "consultar_runbook",
      description:
        "Consulta o runbook operacional de um serviço. Quando usar: precisa dos passos de checkout, payments ou auth. Quando não usar: para inventar procedimento sem runbook; não substitui abrir/resolver incidente.",
      schema: consultarRunbookSchema,
    },
  );
}

export function createCheckProviderStatusTool(
  options?: FetchProviderStatusOptions,
): DynamicStructuredTool<typeof checkProviderStatusSchema> {
  const fetchFn: FetchLike | undefined = options?.fetch;
  return tool(
    async (input) => {
      const provider = input.provider as ProviderId;
      return fetchProviderStatus(provider, fetchFn ? { fetch: fetchFn } : undefined);
    },
    {
      name: "check_provider_status",
      description:
        "Consulta o status público de um provedor externo (GitHub ou Cloudflare) via statuspage. Quando usar: suspeita de problema externo; dúvida \"é o nosso ou do provedor?\"; dependência aparentemente fora do ar. Quando não usar: inventário local de alertas/incidentes/runbooks (use list_alerts, list_incidents ou consultar_runbook).",
      schema: checkProviderStatusSchema,
    },
  );
}

export function createTools(store: OpsStore): DynamicStructuredTool[] {
  return [
    createListAlertsTool(store),
    createOpenIncidentTool(store),
    createResolveIncidentTool(store),
    createListIncidentsTool(store),
    createConsultarRunbookTool(store),
    createCheckProviderStatusTool(),
  ];
}
