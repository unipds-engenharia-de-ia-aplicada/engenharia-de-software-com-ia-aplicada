import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  createListAlertsTool,
  createOpenIncidentTool,
  createResolveIncidentTool,
} from "../agents/tools.js";
import { seedOpsStore } from "../store/seed.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { createOpsMcpServer, OPSPILOT_MCP_VERSION } from "./create-server.js";

const MCP_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_TOOLS = ["list_alerts", "open_incident", "resolve_incident"] as const;
const FORBIDDEN_TOOLS = ["list_incidents", "consultar_runbook", "check_provider_status"] as const;

function seededStore(): SqliteOpsStore {
  const store = new SqliteOpsStore(":memory:");
  seedOpsStore(store);
  return store;
}

async function connectClient(store = seededStore()) {
  const server = createOpsMcpServer(store);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "opspilot-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server, store };
}

function toolText(result: unknown): string {
  assert.ok(result && typeof result === "object");
  const content = (result as { content?: unknown }).content;
  assert.ok(Array.isArray(content), "expected content array");
  const block = content.find(
    (c): c is { type: string; text: string } =>
      !!c &&
      typeof c === "object" &&
      (c as { type?: string }).type === "text" &&
      typeof (c as { text?: unknown }).text === "string",
  );
  assert.ok(block, "expected text content");
  return block.text;
}

test("listTools returns exactly list_alerts, open_incident, resolve_incident", async () => {
  const { client } = await connectClient();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [...EXPECTED_TOOLS].sort());
  assert.equal(tools.length, 3);
});

test("server identity name is opspilot", async () => {
  const { client } = await connectClient();
  await client.listTools();
  const info = client.getServerVersion();
  assert.ok(info);
  assert.equal(info.name, "opspilot");
  assert.equal(info.version, OPSPILOT_MCP_VERSION);
});

test("MCP list_alerts matches LangChain tool on shared seeded store", async () => {
  const store = seededStore();
  const { client } = await connectClient(store);
  const expected = await createListAlertsTool(store).invoke({});
  const result = await client.callTool({ name: "list_alerts", arguments: {} });
  assert.equal(toolText(result), String(expected));
});

test("MCP open_incident creates incident and returns confirmation", async () => {
  const store = seededStore();
  const { client } = await connectClient(store);
  const args = {
    title: "Checkout timeout spike",
    service: "checkout",
    severity: "high",
  };
  const result = await client.callTool({ name: "open_incident", arguments: args });
  const text = toolText(result);
  assert.match(text, /Incident created successfully/);
  assert.match(text, /checkout/);
  assert.match(text, /high/);
  const open = store.getIncidents("open");
  assert.ok(open.some((i) => i.title === args.title && i.service === args.service));
});

test("MCP resolve_incident resolves known id; unknown returns Error", async () => {
  const store = seededStore();
  const created = await createOpenIncidentTool(store).invoke({
    title: "To resolve via MCP",
    service: "payments",
    severity: "medium",
  });
  const idMatch = String(created).match(/ID:\s*(\S+)/);
  assert.ok(idMatch?.[1]);
  const id = idMatch[1];

  const { client } = await connectClient(store);
  const ok = await client.callTool({ name: "resolve_incident", arguments: { id } });
  assert.match(toolText(ok), /has been resolved/);

  const missing = await client.callTool({
    name: "resolve_incident",
    arguments: { id: "inc-does-not-exist" },
  });
  assert.match(toolText(missing), /^Error:/);

  const viaAgent = await createResolveIncidentTool(store).invoke({ id: "inc-does-not-exist" });
  assert.match(String(viaAgent), /^Error:/);
});

test("production src/mcp sources have no console.log", () => {
  const files = readdirSync(MCP_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(MCP_DIR, name));
  assert.ok(files.length >= 2, "expected create-server.ts and server.ts");
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(
      src,
      /\bconsole\.log\b/,
      `${file} must not use console.log (stdout is MCP protocol)`,
    );
  }
});

test("MCP catalog excludes agent-only tools", async () => {
  const { client } = await connectClient();
  const { tools } = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  for (const forbidden of FORBIDDEN_TOOLS) {
    assert.equal(names.has(forbidden), false, `must not register ${forbidden}`);
  }
});
