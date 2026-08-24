import assert from "node:assert/strict";
import test from "node:test";

import type {
  ReasoningStrategy,
  StrategyResult,
  StrategyRunInput,
} from "../domain/types.js";
import { FakeEmbedder } from "../memory/fake-embedder.js";
import { SqliteMemoryStore } from "../memory/memory-store.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import { ROUTER_SYSTEM_PROMPT } from "./router-prompt.js";
import type { ClassifyRouteFn, ProductionRoute } from "./router.js";
import { runProductionTurn, type ProductionStrategies } from "./production-graph.js";

function fakeStrategy(
  name: string,
  overrides?: {
    run?: (input: StrategyRunInput) => Promise<StrategyResult>;
  },
): ReasoningStrategy & { calls: number } {
  const strategy: ReasoningStrategy & { calls: number } = {
    name,
    calls: 0,
    async run(input) {
      strategy.calls += 1;
      if (overrides?.run) {
        return overrides.run(input);
      }
      return {
        answer: `${name}:${input.message}`,
        trace: [{ type: "answer", content: `${name}:${input.message}`, node: name }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };
  return strategy;
}

function bundle(extras?: Partial<ProductionStrategies>): {
  strategies: ProductionStrategies;
  react: ReasoningStrategy & { calls: number };
  planExecute: ReasoningStrategy & { calls: number };
  reflect: ReasoningStrategy & { calls: number };
  team: ReasoningStrategy & { calls: number };
} {
  const react = (extras?.react as ReasoningStrategy & { calls: number }) ?? fakeStrategy("react");
  const planExecute =
    (extras?.planExecute as ReasoningStrategy & { calls: number }) ?? fakeStrategy("planExecute");
  const reflect =
    (extras?.reflect as ReasoningStrategy & { calls: number }) ?? fakeStrategy("reflect");
  const team =
    (extras?.team as ReasoningStrategy & { calls: number }) ?? fakeStrategy("team");
  return {
    strategies: { react, planExecute, reflect, team },
    react,
    planExecute,
    reflect,
    team,
  };
}

function classify(route: ProductionRoute): ClassifyRouteFn {
  return async () => ({ route, reason: `choose ${route}` });
}

test("router prompt table lists all four routes", () => {
  assert.match(ROUTER_SYSTEM_PROMPT, /react/);
  assert.match(ROUTER_SYSTEM_PROMPT, /planExecute/);
  assert.match(ROUTER_SYSTEM_PROMPT, /reflect/);
  assert.match(ROUTER_SYSTEM_PROMPT, /team/);
  assert.match(ROUTER_SYSTEM_PROMPT, /Tabela de decisão/);
});

test("US1: context → router → react → resposta appends conversation", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const { strategies, react, planExecute, reflect } = bundle();

  const result = await runProductionTurn(
    {
      conversations,
      memories,
      strategies,
      classifyRoute: classify("react"),
    },
    { message: "oi", userId: "u1" },
  );

  assert.equal(result.answer, "react:oi");
  assert.equal(react.calls, 1);
  assert.equal(planExecute.calls, 0);
  assert.equal(reflect.calls, 0);
  assert.equal(conversations.lastMessages(result.conversationId, 10).length, 2);
  assert.ok(result.trace.some((e) => e.type === "route" && e.node === "roteador"));
  assert.equal(result.metrics.route, "react");
  assert.ok(typeof result.metrics.routeReason === "string");
  assert.ok(typeof result.metrics.modelUsed === "string");
});

test("US1: conditional edge runs only selected strategy", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const { strategies, react, planExecute, reflect } = bundle();

  await runProductionTurn(
    {
      conversations,
      memories,
      strategies,
      classifyRoute: classify("planExecute"),
    },
    { message: "multi", userId: "u1" },
  );

  assert.equal(planExecute.calls, 1);
  assert.equal(react.calls, 0);
  assert.equal(reflect.calls, 0);
});

test("US2: fake classifier emits route event without override", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const { strategies } = bundle();

  const result = await runProductionTurn(
    {
      conversations,
      memories,
      strategies,
      classifyRoute: classify("planExecute"),
    },
    { message: "x", userId: "u1" },
  );

  const routeEvent = result.trace.find((e) => e.type === "route");
  assert.equal(routeEvent?.node, "roteador");
  assert.equal(routeEvent?.route, "planExecute");
  assert.equal(routeEvent?.override, false);
  assert.match(routeEvent?.reason ?? "", /planExecute/);
  assert.equal(result.metrics.route, "planExecute");
  assert.equal(result.metrics.routeReason, routeEvent?.reason);
});

test("US2: throwing classifier falls back to react", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const { strategies, react } = bundle();

  const result = await runProductionTurn(
    {
      conversations,
      memories,
      strategies,
      classifyRoute: async () => {
        throw new Error("boom");
      },
    },
    { message: "x", userId: "u1" },
  );

  assert.equal(react.calls, 1);
  const routeEvent = result.trace.find((e) => e.type === "route");
  assert.equal(routeEvent?.route, "react");
  assert.match(routeEvent?.content ?? "", /fallback/i);
});

test("US3: overrideRoute beats classifier", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const { strategies, react, reflect } = bundle();

  const result = await runProductionTurn(
    {
      conversations,
      memories,
      strategies,
      classifyRoute: classify("reflect"),
    },
    { message: "x", userId: "u1", overrideRoute: "react" },
  );

  assert.equal(react.calls, 1);
  assert.equal(reflect.calls, 0);
  const routeEvent = result.trace.find((e) => e.type === "route");
  assert.equal(routeEvent?.override, true);
  assert.equal(routeEvent?.route, "react");
});

test("018/US4: classified team route runs team strategy preserving role nodes", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const team = fakeStrategy("team", {
    run: async () => ({
      answer: "equipe resolveu",
      trace: [
        { type: "handoff", content: "levante fatos", node: "supervisor", to: "analista" },
        { type: "observation", content: "fatos", node: "analista" },
        { type: "handoff", content: "resumo final", node: "supervisor", to: "done" },
        { type: "answer", content: "equipe resolveu", node: "supervisor" },
      ],
      metrics: { llmCalls: 4, latencyMs: 1 },
    }),
  });
  const { strategies, react } = bundle({ team });

  const result = await runProductionTurn(
    {
      conversations,
      memories,
      strategies,
      classifyRoute: classify("team"),
    },
    { message: "investigue e resolva", userId: "u1" },
  );

  assert.equal(team.calls, 1);
  assert.equal(react.calls, 0);
  assert.equal(result.answer, "equipe resolveu");
  assert.equal(result.metrics.route, "team");

  // Team branch must NOT re-stamp node: role signatures preserved.
  const handoffs = result.trace.filter((e) => e.type === "handoff");
  assert.equal(handoffs.length, 2);
  assert.ok(handoffs.every((e) => e.node === "supervisor"));
  assert.equal(handoffs[0]?.to, "analista");
  const observation = result.trace.find((e) => e.type === "observation");
  assert.equal(observation?.node, "analista");
});

test("018: react/planExecute/reflect turns contain zero handoff events", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());

  for (const route of ["react", "planExecute", "reflect"] as const) {
    const { strategies } = bundle();
    const result = await runProductionTurn(
      {
        conversations,
        memories,
        strategies,
        classifyRoute: classify(route),
      },
      { message: "simples", userId: "u1" },
    );
    assert.equal(
      result.trace.filter((e) => e.type === "handoff").length,
      0,
      `route ${route} must not emit handoff`,
    );
  }
});

test("US4: every trace event has node; strategy events use strategy id", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const { strategies } = bundle();

  const result = await runProductionTurn(
    {
      conversations,
      memories,
      strategies,
      classifyRoute: classify("react"),
    },
    { message: "x", userId: "u1" },
  );

  assert.ok(result.trace.length >= 2);
  for (const event of result.trace) {
    assert.ok(typeof event.node === "string" && event.node.length > 0, JSON.stringify(event));
  }
  const answer = result.trace.find((e) => e.type === "answer");
  assert.equal(answer?.node, "react");
});
