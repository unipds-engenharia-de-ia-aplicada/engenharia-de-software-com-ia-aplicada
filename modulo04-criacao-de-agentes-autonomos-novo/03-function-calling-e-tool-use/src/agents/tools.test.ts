import test from "node:test";
import assert from "node:assert/strict";

import {
  createCheckProviderStatusTool,
  createConsultarRunbookTool,
  createListAlertsTool,
  createListIncidentsTool,
  createOpenIncidentTool,
  createResolveIncidentTool,
  createTools,
} from "./tools.js";
import { formatProviderStatus, type FetchLike } from "../tools/check-provider-status.js";
import { seedOpsStore } from "../store/seed.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";

function seededStore(): SqliteOpsStore {
  const store = new SqliteOpsStore(":memory:");
  seedOpsStore(store);
  return store;
}

test("list_incidents defaults to open and respects filters", async () => {
  const store = seededStore();
  const open = store.createIncident({
    title: "Open one",
    service: "checkout",
    severity: "high",
  });
  store.resolveIncident(
    store.createIncident({ title: "Done", service: "auth", severity: "low" }).id,
    "fixed",
  );

  const tool = createListIncidentsTool(store);
  const defaultResult = String(await tool.invoke({}));
  assert.match(defaultResult, /open incident/);
  assert.match(defaultResult, new RegExp(open.id));
  assert.doesNotMatch(defaultResult, /Done/);

  const resolvedResult = String(await tool.invoke({ status: "resolved" }));
  assert.match(resolvedResult, /resolved incident/);
  assert.match(resolvedResult, /Done/);

  const allResult = String(await tool.invoke({ status: "all" }));
  assert.match(allResult, /2 incident/);
});

test("consultar_runbook hit payments and miss inventory", async () => {
  const store = seededStore();
  const tool = createConsultarRunbookTool(store);

  const hit = String(await tool.invoke({ service: "payments" }));
  assert.match(hit, /Runbook for payments/);
  assert.match(hit, /PSP|circuit breaker|payments/i);

  const miss = String(await tool.invoke({ service: "inventory" }));
  assert.equal(miss, "Error: Runbook not found: inventory");
});

test("existing tools work on :memory: SQLite", async () => {
  const store = seededStore();
  const listAlerts = createListAlertsTool(store);
  const openIncident = createOpenIncidentTool(store);
  const resolveIncident = createResolveIncidentTool(store);

  const alerts = String(await listAlerts.invoke({ status: "firing" }));
  assert.match(alerts, /3 firing alert/);

  const opened = String(
    await openIncident.invoke({
      title: "Tool regression",
      service: "payments",
      severity: "critical",
    }),
  );
  assert.match(opened, /Incident created successfully/);
  const idMatch = opened.match(/ID: (inc-\S+)/);
  assert.ok(idMatch);

  const resolved = String(await resolveIncident.invoke({ id: idMatch[1] }));
  assert.match(resolved, /has been resolved/);
});

test("open_incident normalizes sev2 alias to high (DB canonical)", async () => {
  const store = seededStore();
  const openIncident = createOpenIncidentTool(store);
  const opened = String(
    await openIncident.invoke({
      title: "Sev alias",
      service: "catalog",
      severity: "sev2",
    }),
  );
  assert.match(opened, /Severity: high/);
  assert.equal(store.getIncidents("open")[0]?.severity, "high");
});

test("createTools registers six tools including check_provider_status", () => {
  const store = seededStore();
  const tools = createTools(store);
  assert.equal(tools.length, 6);
  assert.deepEqual(
    tools.map((t) => t.name),
    [
      "list_alerts",
      "open_incident",
      "resolve_incident",
      "list_incidents",
      "consultar_runbook",
      "check_provider_status",
    ],
  );
});

test("check_provider_status tool invoke with fake fetch (no network)", async () => {
  const fake: FetchLike = async () =>
    new Response(
      JSON.stringify({
        status: { indicator: "none", description: "All Systems Operational" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const tool = createCheckProviderStatusTool({ fetch: fake });
  const result = String(await tool.invoke({}));
  assert.equal(result, formatProviderStatus("github", "none", "All Systems Operational"));

  const cf = String(await tool.invoke({ provider: "cloudflare" }));
  assert.equal(cf, formatProviderStatus("cloudflare", "none", "All Systems Operational"));
});
