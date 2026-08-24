import assert from "node:assert/strict";
import test from "node:test";

import { AIMessage } from "@langchain/core/messages";
import { RunnableLambda } from "@langchain/core/runnables";

import type { OpsChatModel } from "../agents/model.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import {
  createCheckProviderStatusTool,
  createConsultarRunbookTool,
  createListAlertsTool,
  createListIncidentsTool,
  createOpenIncidentTool,
  createResolveIncidentTool,
} from "../tools/index.js";
import {
  createAnalistaRunner,
  createExecutorRunner,
  createPlanejadorRunner,
} from "./roles.js";

function opsStore(): SqliteOpsStore {
  return new SqliteOpsStore(":memory:");
}

function analistaTools(store: SqliteOpsStore) {
  return [
    createListAlertsTool(store),
    createListIncidentsTool(store),
    createConsultarRunbookTool(store),
    createCheckProviderStatusTool(),
  ];
}

function executorTools(store: SqliteOpsStore) {
  return [
    createOpenIncidentTool(store),
    createResolveIncidentTool(store),
    createListIncidentsTool(store),
  ];
}

/** Duck-typed chat model for createReactAgent: bindTools → scripted AIMessages. */
function fakeToolCallingModel(responses: AIMessage[]): () => OpsChatModel {
  let index = 0;
  const model = {
    bindTools: () =>
      RunnableLambda.from(async () => {
        const response = responses[Math.min(index, responses.length - 1)];
        index += 1;
        return response;
      }),
  };
  return () => model as unknown as OpsChatModel;
}

function fakePlainModel(content: string): () => OpsChatModel {
  const model = {
    invoke: async () => ({ content }),
  };
  return () => model as unknown as OpsChatModel;
}

const throwingFactory = () => {
  throw new Error("model should not be constructed in this test");
};

test("US2: structural tool partition per role", () => {
  const store = opsStore();
  const analista = createAnalistaRunner({
    modelFactory: throwingFactory as unknown as () => OpsChatModel,
    tools: analistaTools(store),
  });
  const planejador = createPlanejadorRunner({
    modelFactory: throwingFactory as unknown as () => OpsChatModel,
  });
  const executor = createExecutorRunner({
    modelFactory: throwingFactory as unknown as () => OpsChatModel,
    tools: executorTools(store),
  });

  assert.deepEqual(
    analista.tools.map((tool) => tool.name).sort(),
    ["check_provider_status", "consultar_runbook", "list_alerts", "list_incidents"],
  );
  assert.deepEqual(planejador.tools, []);
  assert.deepEqual(
    executor.tools.map((tool) => tool.name).sort(),
    ["list_incidents", "open_incident", "resolve_incident"],
  );

  // Read-only contract: analista never receives incident mutation tools.
  const mutating = new Set(["open_incident", "resolve_incident"]);
  assert.ok(analista.tools.every((tool) => !mutating.has(tool.name)));
});

test("US2: planejador runs without tools and contributes a plan", async () => {
  const planejador = createPlanejadorRunner({
    modelFactory: fakePlainModel("1. conferir alertas\n2. abrir incidente"),
  });

  const result = await planejador.run({
    message: "latência no checkout",
    brief: "monte o plano",
    blackboard: [
      { role: "analista", kind: "facts", brief: "levante fatos", content: "alerta critical" },
    ],
  });

  assert.equal(result.entry.role, "planejador");
  assert.equal(result.entry.kind, "plan");
  assert.equal(result.entry.brief, "monte o plano");
  assert.match(result.entry.content, /1\. conferir alertas/);
  assert.equal(result.llmCalls, 1);
  assert.equal(result.trace.length, 1);
  assert.equal(result.trace[0]?.type, "plan");
  assert.equal(result.trace[0]?.node, "planejador");
});

test("US2: analista produces facts entry with trace signed analista", async () => {
  const store = opsStore();
  const analista = createAnalistaRunner({
    modelFactory: fakeToolCallingModel([
      new AIMessage("- nenhum alerta disparando\n- nenhum incidente aberto"),
    ]),
    tools: analistaTools(store),
  });

  const result = await analista.run({
    message: "como está o plantão?",
    brief: "diagnóstico geral",
    blackboard: [],
  });

  assert.equal(result.entry.role, "analista");
  assert.equal(result.entry.kind, "facts");
  assert.match(result.entry.content, /nenhum alerta/);
  assert.ok(result.llmCalls >= 1);
  assert.ok(result.trace.length >= 1);
  assert.ok(result.trace.every((event) => event.node === "analista"));
});

test("US2: executor calls incident tool and signs trace as executor", async () => {
  const store = opsStore();
  const executor = createExecutorRunner({
    modelFactory: fakeToolCallingModel([
      new AIMessage({
        content: "",
        tool_calls: [
          { name: "list_incidents", args: { status: "open" }, id: "call-1" },
        ],
      }),
      new AIMessage("nenhum incidente aberto; nada a executar"),
    ]),
    tools: executorTools(store),
  });

  const result = await executor.run({
    message: "feche o que estiver mitigado",
    brief: "liste antes de agir",
    blackboard: [],
  });

  assert.equal(result.entry.role, "executor");
  assert.equal(result.entry.kind, "execution");
  assert.match(result.entry.content, /nada a executar/);
  const types = result.trace.map((event) => event.type);
  assert.ok(types.includes("action"));
  assert.ok(types.includes("observation"));
  assert.ok(result.trace.every((event) => event.node === "executor"));
  const action = result.trace.find((event) => event.type === "action");
  assert.equal(action?.tool, "list_incidents");
});
