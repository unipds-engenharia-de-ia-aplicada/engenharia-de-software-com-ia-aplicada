import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";

import { createRegistry, listStrategies, resolveStrategy } from "../agents/index.js";
import type {
  ReasoningStrategy,
  StrategyResult,
  StrategyRunInput,
} from "../domain/types.js";
import type { CritiqueResult } from "../strategies/reflect.js";
import { withReflection } from "../strategies/reflect.js";
import { createFakeConversationSummarizer } from "../chat/history-summarizer.js";
import type { ClassifyRouteFn } from "../graph/router.js";
import { FakeEmbedder } from "../memory/fake-embedder.js";
import { SqliteMemoryStore } from "../memory/memory-store.js";
import { createLogger } from "../obs/logger.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import { SqliteRequestStore } from "../store/sqlite-request-store.js";
import { MemoryApprovalStore } from "../store/memory-approval-store.js";
import { createApp, type ChatAppDeps } from "./server.js";

function fakeStrategy(overrides?: {
  name?: string;
  delayMs?: number;
  run?: (input: StrategyRunInput) => Promise<StrategyResult>;
}): ReasoningStrategy & { calls: number; inputs: StrategyRunInput[] } {
  const strategy: ReasoningStrategy & { calls: number; inputs: StrategyRunInput[] } = {
    name: overrides?.name ?? "fake",
    calls: 0,
    inputs: [],
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      strategy.calls += 1;
      strategy.inputs.push(input);
      if (overrides?.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, overrides.delayMs));
      }
      if (overrides?.run) {
        return overrides.run(input);
      }
      return {
        answer: `echo:${input.message}`,
        trace: [{ type: "answer", content: `echo:${input.message}`, node: overrides?.name ?? "fake" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };
  return strategy;
}

function memoryConversations() {
  return new SqliteConversationStore(":memory:");
}

function memoryStore(embedder = new FakeEmbedder()) {
  return new SqliteMemoryStore(":memory:", embedder);
}

function defaultClassify(route: "react" | "planExecute" | "reflect" = "react"): ClassifyRouteFn {
  return async () => ({ route, reason: `test-default:${route}` });
}

function productionBundle(react: ReasoningStrategy, extras?: {
  planExecute?: ReasoningStrategy;
  reflect?: ReasoningStrategy;
}) {
  return {
    react,
    planExecute: extras?.planExecute ?? fakeStrategy({ name: "planExecute" }),
    reflect: extras?.reflect ?? fakeStrategy({ name: "reflect" }),
  };
}

function testApp(
  overrides: Partial<ChatAppDeps> & {
    react?: ReasoningStrategy & { calls?: number };
    planExecute?: ReasoningStrategy;
    reflect?: ReasoningStrategy;
  } = {},
): ReturnType<typeof createApp> {
  const react = overrides.react ?? overrides.strategies?.react ?? fakeStrategy({ name: "react" });
  const strategies = overrides.strategies ?? productionBundle(react, {
    planExecute: overrides.planExecute,
    reflect: overrides.reflect,
  });
  const {
    react: _r,
    planExecute: _p,
    reflect: _f,
    strategies: _s,
    classifyRoute,
    ...rest
  } = overrides as Partial<ChatAppDeps> & {
    react?: ReasoningStrategy;
    planExecute?: ReasoningStrategy;
    reflect?: ReasoningStrategy;
  };
  return createApp({
    conversations: memoryConversations(),
    memories: memoryStore(),
    strategies,
    classifyRoute: classifyRoute ?? defaultClassify("react"),
    ...rest,
  });
}

async function withServer(
  app: ReturnType<typeof createApp>,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ephemeral port");
    }
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postChat(
  baseUrl: string,
  body: unknown,
): Promise<{
  status: number;
  json: Record<string, unknown>;
  headers: Headers;
}> {
  const payload =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? { userId: "test-user", ...(body as Record<string, unknown>) }
      : body;
  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, json, headers: response.headers };
}

function memoryRequests() {
  return new SqliteRequestStore(":memory:");
}

test("US1: POST /chat happy path with fake react strategy", async () => {
  const react = fakeStrategy({ name: "react" });
  const conversations = memoryConversations();
  const app = testApp({ react, conversations });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "oi" });
    assert.equal(status, 200);
    assert.equal(json.answer, "echo:oi");
    assert.ok(typeof json.conversationId === "string");
    assert.ok(Array.isArray(json.trace));
    assert.ok(json.metrics && typeof json.metrics === "object");
    const metrics = json.metrics as {
      llmCalls: number;
      latencyMs: number;
      historyMessages: number;
      recalledMemories: number;
    };
    assert.equal(metrics.llmCalls, 1);
    assert.equal(typeof metrics.latencyMs, "number");
    assert.equal(metrics.historyMessages, 0);
    assert.equal(metrics.recalledMemories, 0);
    assert.equal(react.calls, 1);
    assert.equal(conversations.lastMessages(String(json.conversationId), 12).length, 2);
    const m = json.metrics as { route?: string; routeReason?: string; modelUsed?: string };
    assert.equal(m.route, "react");
    assert.ok(typeof m.routeReason === "string" && m.routeReason.length > 0);
    assert.ok(typeof m.modelUsed === "string" && m.modelUsed.length > 0);
  });
});

test("model resilience: ModelUnavailableError → 503 model_unavailable", async () => {
  const { ModelUnavailableError } = await import("../domain/errors.js");
  const react = fakeStrategy({
    name: "react",
    run: async () => {
      throw new ModelUnavailableError("primary and backup failed");
    },
  });
  const app = testApp({ react });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "down" });
    assert.equal(status, 503);
    assert.equal(json.error, "model_unavailable");
    assert.match(String(json.message), /failed/i);
  });
});

test("model resilience: fallback event + modelUsed when telemetry marks reserve", async () => {
  const {
    createEmptyTelemetry,
    runWithModelTelemetry,
    recordModelSuccess,
  } = await import("../llm/model-telemetry.js");
  const { runProductionTurn } = await import("../graph/production-graph.js");
  const conversations = memoryConversations();
  const memories = memoryStore();
  const react = fakeStrategy({ name: "react" });
  const strategies = productionBundle(react);

  const tel = createEmptyTelemetry("openai/primary", "openai/reserve");
  const result = await runWithModelTelemetry(tel, async () => {
    recordModelSuccess("openai/reserve");
    return runProductionTurn(
      {
        conversations,
        memories,
        strategies,
        classifyRoute: defaultClassify("react"),
      },
      { message: "oi", userId: "u1" },
    );
  });

  assert.equal(result.metrics.modelUsed, "openai/reserve");
  assert.ok(result.trace.some((e) => e.type === "fallback"));
});

test("US1: explicit strategy override selects planExecute node", async () => {
  const react = fakeStrategy({ name: "react" });
  const planExecute = fakeStrategy({ name: "planExecute" });
  const app = testApp({
    react,
    planExecute,
    classifyRoute: defaultClassify("reflect"),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "ping",
      strategy: "planExecute",
    });
    assert.equal(status, 200);
    assert.equal(json.answer, "echo:ping");
    assert.equal(planExecute.calls, 1);
    assert.equal(react.calls, 0);
    const trace = json.trace as Array<{ type: string; route?: string; override?: boolean }>;
    const routeEvent = trace.find((e) => e.type === "route");
    assert.equal(routeEvent?.route, "planExecute");
    assert.equal(routeEvent?.override, true);
  });
});

test("US1: reflect true with approving critic adds critique overhead", async () => {
  const react = fakeStrategy({ name: "react" });
  const criticCalls: number[] = [];
  const reflect = withReflection(react, {
    critic: async (): Promise<CritiqueResult> => {
      criticCalls.push(1);
      return { approved: true, feedback: "" };
    },
  });
  const app = testApp({
    react,
    reflect,
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "com reflect",
      reflect: true,
    });
    assert.equal(status, 200);
    assert.equal(react.calls, 1);
    assert.equal(criticCalls.length, 1);
    const metrics = json.metrics as { llmCalls: number };
    assert.equal(metrics.llmCalls, 2);
    const trace = json.trace as Array<{ type: string; approved?: boolean; node?: string }>;
    assert.ok(trace.some((event) => event.type === "critique" && event.approved === true));
    assert.ok(trace.every((event) => typeof event.node === "string" && event.node.length > 0));
  });
});

test("US2: invalid body returns 400 with zod issues", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    react,
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const wrongField = await postChat(baseUrl, { mensagem: "campo errado" });
    assert.equal(wrongField.status, 400);
    assert.equal(wrongField.json.error, "validation_error");
    assert.ok(Array.isArray(wrongField.json.issues));
    assert.equal(react.calls, 0);

    const emptyMessage = await postChat(baseUrl, { message: "" });
    assert.equal(emptyMessage.status, 400);
    assert.equal(emptyMessage.json.error, "validation_error");
    assert.equal(react.calls, 0);
  });
});

test("US2: unknown strategy returns 422", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    react,
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "ok",
      strategy: "nope",
    });
    assert.equal(status, 422);
    assert.equal(json.error, "unknown_strategy");
    assert.equal(json.strategy, "nope");
    assert.equal(react.calls, 0);
  });
});

test("US2: omitted strategy uses router (default fake → react) without reflection", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    react,
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "defaults" });
    assert.equal(status, 200);
    assert.equal(json.answer, "echo:defaults");
    assert.equal(react.calls, 1);
    const metrics = json.metrics as { llmCalls: number };
    assert.equal(metrics.llmCalls, 1);
    const trace = json.trace as Array<{ type: string; override?: boolean; node?: string }>;
    assert.ok(trace.some((event) => event.type === "route" && event.override === false));
    assert.ok(!trace.some((event) => event.type === "critique"));
    assert.ok(trace.every((e) => typeof e.node === "string" && e.node.length > 0));
  });
});

test("US3: slow strategy exceeds injected timeout -> 504", async () => {
  const react = fakeStrategy({ name: "react", delayMs: 80 });
  const app = testApp({
    react,
    conversations: memoryConversations(),
    timeoutMs: 20,
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "slow" });
    assert.equal(status, 504);
    assert.equal(json.error, "timeout");
    assert.match(String(json.message), /timed out/i);
  });
});

test("US3: fast strategy returns 200 under timeout", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    react,
    conversations: memoryConversations(),
    timeoutMs: 5_000,
  });

  await withServer(app, async (baseUrl) => {
    const { status } = await postChat(baseUrl, { message: "fast" });
    assert.equal(status, 200);
  });
});

test("US4: unknown custom strategy returns 422; registry helper still works for Arena", async () => {
  const react = fakeStrategy({ name: "react" });
  const custom = fakeStrategy({ name: "custom-ops" });
  const app = testApp({ react });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "extensível",
      strategy: "custom-ops",
    });
    assert.equal(status, 422);
    assert.equal(json.error, "unknown_strategy");
    assert.equal(custom.calls, 0);
    assert.deepEqual(listStrategies(createRegistry({ "custom-ops": custom })), [
      "custom-ops",
    ]);
  });
});

test("US4: resolveStrategy with reflect returns reflect: name", () => {
  const base = fakeStrategy({ name: "react" });
  const registry = createRegistry({ react: base });
  const resolved = resolveStrategy(registry, "react", true, {
    critic: async () => ({ approved: true, feedback: "" }),
  });
  assert.equal(resolved.name, "reflect:react");
});

test("US4: legacy strategy plan-and-execute aliases to planExecute override", async () => {
  const react = fakeStrategy({ name: "react" });
  const planExecute = fakeStrategy({ name: "planExecute" });
  const app = testApp({ react, planExecute });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "plano",
      strategy: "plan-and-execute",
    });
    assert.equal(status, 200);
    assert.equal(planExecute.calls, 1);
    assert.equal(react.calls, 0);
    const trace = json.trace as Array<{ type: string; route?: string; override?: boolean }>;
    const routeEvent = trace.find((e) => e.type === "route");
    assert.equal(routeEvent?.route, "planExecute");
    assert.equal(routeEvent?.override, true);
  });
});

test("POST /chat accepts curl-style body without application/json Content-Type", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    react,
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: '{"message":"quais incidentes estão abertos?","userId":"test-user"}',
    });
    const json = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(json.answer, "echo:quais incidentes estão abertos?");
  });
});

test("semantic memory: missing userId returns 400", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({ react });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "oi",
      userId: undefined,
    });
    assert.equal(status, 400);
    assert.equal(json.error, "validation_error");
    assert.equal(react.calls, 0);

    const empty = await postChat(baseUrl, { message: "oi", userId: "" });
    assert.equal(empty.status, 400);
    assert.equal(react.calls, 0);
  });
});

test("semantic memory: injects Relevant memories into strategy message", async () => {
  const react = fakeStrategy({ name: "react" });
  const embedder = new FakeEmbedder()
    .setAxis("checkout latency high", 0)
    .setAxis("how is payment slow?", 0);
  const memories = memoryStore(embedder);
  await memories.remember("plantonista", "checkout latency high");

  const app = testApp({
    react,
    memories,
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "how is payment slow?",
      userId: "plantonista",
    });
    assert.equal(status, 200);
    const metrics = json.metrics as { recalledMemories: number };
    assert.ok(metrics.recalledMemories >= 1);
    assert.match(react.inputs[0]?.message ?? "", /Relevant memories:/);
    assert.match(react.inputs[0]?.message ?? "", /checkout latency high/);
    assert.match(react.inputs[0]?.message ?? "", /Current message:\nhow is payment slow\?/);
  });
});

test("semantic memory: no qualifying memories leaves message unchanged", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({ react });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "hello alone" });
    assert.equal(status, 200);
    const metrics = json.metrics as { recalledMemories: number };
    assert.equal(metrics.recalledMemories, 0);
    assert.equal(react.inputs[0]?.message, "hello alone");
  });
});

test("learning reflector: async remember after 200 with fake reflector", async () => {
  const react = fakeStrategy({ name: "react" });
  const embedder = new FakeEmbedder()
    .setAxis("User prefers prioritizing checkout", 0)
    .setAxis("what are my priorities?", 0);
  const memories = memoryStore(embedder);
  const app = testApp({
    react,
    memories,
    learningReflector: async () => ({
      hasLearning: true,
      fact: "User prefers prioritizing checkout",
    }),
  });

  await withServer(app, async (baseUrl) => {
    const { status } = await postChat(baseUrl, {
      message: "sempre priorize checkout",
      userId: "learner",
    });
    assert.equal(status, 200);
    // Flush scheduled learning
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const recalled = await memories.recall("learner", "what are my priorities?");
    assert.ok(recalled.some((m) => /checkout/i.test(m.fact)));
  });
});

test("POST /memories stores fact for userId", async () => {
  const react = fakeStrategy({ name: "react" });
  const fact = "prefere os alertas críticos primeiro";
  const embedder = new FakeEmbedder().setAxis(fact, 2);
  const memories = memoryStore(embedder);
  const app = testApp({ react, memories });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "u-42", fact }),
    });
    const json = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 201);
    assert.equal(json.stored, true);
    assert.equal(json.userId, "u-42");
    assert.equal(json.fact, fact);
    assert.ok(typeof json.id === "string");

    const missing = await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "u-42" }),
    });
    assert.equal(missing.status, 400);
  });
});

test("persistent: continue conversation reuses conversationId and injects history", async () => {
  const react = fakeStrategy({ name: "react" });
  const conversations = memoryConversations();
  const app = testApp({ react, conversations });

  await withServer(app, async (baseUrl) => {
    const first = await postChat(baseUrl, { message: "turno1" });
    assert.equal(first.status, 200);
    const cid = String(first.json.conversationId);
    const m1 = first.json.metrics as { historyMessages: number };
    assert.equal(m1.historyMessages, 0);

    const second = await postChat(baseUrl, { message: "turno2", conversationId: cid });
    assert.equal(second.status, 200);
    assert.equal(second.json.conversationId, cid);
    const m2 = second.json.metrics as { historyMessages: number };
    assert.equal(m2.historyMessages, 2);
    assert.equal(react.inputs[1]?.history.length, 2);
    assert.equal(react.inputs[1]?.history[0]?.content, "turno1");
    assert.equal(react.inputs[1]?.history[1]?.content, "echo:turno1");
    assert.equal(conversations.lastMessages(cid, 12).length, 4);
  });
});

test("persistent: unknown conversationId returns 404 without running strategy", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    react,
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const missing = randomUUID();
    const { status, json } = await postChat(baseUrl, {
      message: "oi",
      conversationId: missing,
    });
    assert.equal(status, 404);
    assert.equal(json.error, "conversation_not_found");
    assert.equal(json.conversationId, missing);
    assert.equal(react.calls, 0);
  });
});

test("persistent: invalid conversationId returns 400", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    react,
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "oi",
      conversationId: "nope",
    });
    assert.equal(status, 400);
    assert.equal(json.error, "validation_error");
    assert.equal(react.calls, 0);
  });
});

test("persistent: historyMessages capped at 8", async () => {
  const react = fakeStrategy({ name: "react" });
  const conversations = memoryConversations();
  const cid = conversations.create();
  for (let i = 0; i < 15; i += 1) {
    conversations.append(cid, i % 2 === 0 ? "user" : "assistant", `m${i}`);
  }
  const app = testApp({ react, conversations });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "novo",
      conversationId: cid,
    });
    assert.equal(status, 200);
    const metrics = json.metrics as { historyMessages: number };
    assert.equal(metrics.historyMessages, 8);
    assert.equal(react.inputs[0]?.history.length, 8);
  });
});

test("persistent: throwing strategy does not append assistant", async () => {
  const conversations = memoryConversations();
  const react = fakeStrategy({
    name: "react",
    run: async () => {
      throw new Error("boom");
    },
  });
  const app = testApp({ react, conversations });

  await withServer(app, async (baseUrl) => {
    const before = conversations.create();
    // Use known id so we can inspect store after failure
    const { status } = await postChat(baseUrl, {
      message: "fail",
      conversationId: before,
    });
    assert.equal(status, 500);
    const msgs = conversations.lastMessages(before, 12);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.role, "user");
    assert.equal(msgs[0]?.content, "fail");
  });
});

test("context metrics: contextBreakdown always present; promptTokens optional", async () => {
  const withTokens = fakeStrategy({
    name: "react",
    run: async () => ({
      answer: "ok",
      trace: [{ node: "test",  type: "answer", content: "ok" }],
      metrics: { llmCalls: 1, latencyMs: 1, promptTokens: 99 },
    }),
  });
  const appWith = testApp({ react: withTokens });

  await withServer(appWith, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "oi" });
    assert.equal(status, 200);
    const metrics = json.metrics as {
      promptTokens?: number;
      contextBreakdown: {
        system: number;
        history: number;
        memories: number;
        message: number;
        summary: number;
      };
      llmCalls: number;
      historyMessages: number;
      recalledMemories: number;
    };
    assert.equal(metrics.promptTokens, 99);
    assert.equal(metrics.llmCalls, 1);
    assert.equal(metrics.historyMessages, 0);
    assert.equal(metrics.recalledMemories, 0);
    assert.deepEqual(Object.keys(metrics.contextBreakdown).sort(), [
      "history",
      "memories",
      "message",
      "summary",
      "system",
    ]);
    assert.equal(metrics.contextBreakdown.history, 0);
    assert.equal(metrics.contextBreakdown.memories, 0);
    assert.equal(metrics.contextBreakdown.summary, 0);
    assert.ok(metrics.contextBreakdown.system > 0);
    assert.ok(metrics.contextBreakdown.message >= 0);
    // Defaults CONTEXT_BUDGET_*: optional sections never exceed ceilings
    assert.ok(metrics.contextBreakdown.summary <= 200);
    assert.ok(metrics.contextBreakdown.history <= 1200);
    assert.ok(metrics.contextBreakdown.memories <= 300);
  });

  const withoutTokens = fakeStrategy({ name: "react" });
  const appWithout = testApp({ react: withoutTokens });

  await withServer(appWithout, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "oi" });
    assert.equal(status, 200);
    const metrics = json.metrics as Record<string, unknown>;
    assert.equal("promptTokens" in metrics, false);
    assert.ok(metrics.contextBreakdown && typeof metrics.contextBreakdown === "object");
  });
});

test("history summarization: summarize event after 16 seeded messages", async () => {
  const react = fakeStrategy({ name: "react" });
  const conversations = memoryConversations();
  const cid = conversations.create();
  for (let i = 0; i < 16; i += 1) {
    conversations.append(cid, i % 2 === 0 ? "user" : "assistant", `m${i}`);
  }
  let calls = 0;
  const summarizer = createFakeConversationSummarizer(() => {
    calls += 1;
  });
  const app = testApp({
    react,
    conversations,
    summarizer,
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "continue",
      conversationId: cid,
    });
    assert.equal(status, 200);
    assert.equal(calls, 1);
    const trace = json.trace as Array<{ type: string }>;
    assert.equal(trace[0]?.type, "summarize");
    const metrics = json.metrics as {
      historyMessages: number;
      contextBreakdown: { summary: number };
    };
    assert.equal(metrics.historyMessages, 8);
    assert.ok(metrics.contextBreakdown.summary > 0);
    assert.match(react.inputs[0]?.message ?? "", /Conversation summary:/);
  });
});

test("015: POST /chat 200 requestId equals X-Request-Id", async () => {
  const app = testApp({ requests: memoryRequests() });
  await withServer(app, async (baseUrl) => {
    const { status, json, headers } = await postChat(baseUrl, { message: "oi" });
    assert.equal(status, 200);
    assert.ok(typeof json.requestId === "string" && (json.requestId as string).length > 0);
    assert.equal(json.requestId, headers.get("x-request-id"));
  });
});

test("015: successive chats get distinct requestIds", async () => {
  const app = testApp({ requests: memoryRequests() });
  await withServer(app, async (baseUrl) => {
    const a = await postChat(baseUrl, { message: "a" });
    const b = await postChat(baseUrl, { message: "b" });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.notEqual(a.json.requestId, b.json.requestId);
  });
});

test("015: invalid body 400 still sets X-Request-Id", async () => {
  const app = testApp({ requests: memoryRequests() });
  await withServer(app, async (baseUrl) => {
    const { status, json, headers } = await postChat(baseUrl, {});
    assert.equal(status, 400);
    assert.equal(json.error, "validation_error");
    const rid = headers.get("x-request-id");
    assert.ok(rid && rid.length > 0);
  });
});

test("015: GET /requests/:id returns ordered trace after chat", async () => {
  const react = fakeStrategy({
    name: "react",
    run: async (input) => ({
      answer: `echo:${input.message}`,
      trace: [
        { type: "thought", content: "t1", node: "react" },
        { type: "answer", content: `echo:${input.message}`, node: "react" },
      ],
      metrics: { llmCalls: 1, latencyMs: 1 },
    }),
  });
  const requests = memoryRequests();
  const app = testApp({ react, requests });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "audit" });
    assert.equal(status, 200);
    const requestId = String(json.requestId);
    const response = await fetch(`${baseUrl}/requests/${requestId}`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      request: { id: string; status: string };
      trace: Array<{ type: string; node: string }>;
    };
    assert.equal(body.request.id, requestId);
    assert.equal(body.request.status, "success");
    // route event from router + 2 strategy events
    assert.ok(body.trace.length >= 3);
    assert.equal(body.trace[0]?.type, "route");
    const types = body.trace.map((e) => e.type);
    assert.ok(types.includes("thought"));
    assert.ok(types.includes("answer"));
    assert.deepEqual(
      body.trace.map((e) => e.type),
      (json.trace as Array<{ type: string }>).map((e) => e.type),
    );
  });
});

test("015: GET /requests/:id 404 unknown and 400 non-uuid", async () => {
  const app = testApp({ requests: memoryRequests() });
  await withServer(app, async (baseUrl) => {
    const missing = await fetch(
      `${baseUrl}/requests/66666666-6666-4666-8666-666666666666`,
    );
    assert.equal(missing.status, 404);
    const missingJson = (await missing.json()) as { error: string };
    assert.equal(missingJson.error, "request_not_found");

    const bad = await fetch(`${baseUrl}/requests/not-a-uuid`);
    assert.equal(bad.status, 400);
    const badJson = (await bad.json()) as { error: string };
    assert.equal(badJson.error, "validation_error");
  });
});

test("015: persist failure still returns 200 and logs request_persist_failed", async () => {
  const lines: string[] = [];
  const logger = createLogger({ write: (line) => lines.push(line) });
  const requests = {
    save() {
      throw new Error("disk full");
    },
    getById() {
      return null;
    },
    stats() {
      return {
        total: 0,
        errors: 0,
        tokens: 0,
        costUsd: 0,
        latency: { p50: null, p95: null },
        byRoute: {},
        byModel: {},
      };
    },
  };
  const app = testApp({ requests, logger });

  await withServer(app, async (baseUrl) => {
    const { status, json, headers } = await postChat(baseUrl, { message: "ok" });
    assert.equal(status, 200);
    assert.equal(json.requestId, headers.get("x-request-id"));
    const persistFailed = lines
      .map((line) => JSON.parse(line.trim()) as { event: string; requestId?: string })
      .find((row) => row.event === "request_persist_failed");
    assert.ok(persistFailed);
    assert.equal(persistFailed.requestId, json.requestId);
  });
});

test("015: GET /stats?since=24h aggregates requests", async () => {
  const requests = memoryRequests();
  const now = Date.now();
  requests.save({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    createdAt: now - 1000,
    finishedAt: now,
    status: "success",
    httpStatus: 200,
    metrics: {
      llmCalls: 1,
      latencyMs: 12,
      promptTokens: 100,
      route: "react",
      modelUsed: "openai/gpt-4o-mini:free",
    },
    trace: [],
  });
  const app = testApp({ requests });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/stats?since=24h`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      since: string;
      total: number;
      errors: number;
      tokens: number;
      costUsd: number;
      byRoute: Record<string, { total: number }>;
      byModel: Record<string, { costUsd: number }>;
    };
    assert.equal(body.since, "24h");
    assert.equal(body.total, 1);
    assert.equal(body.errors, 0);
    assert.equal(body.tokens, 100);
    assert.equal(body.costUsd, 0);
    assert.equal(body.byRoute.react?.total, 1);
    assert.equal(body.byModel["openai/gpt-4o-mini:free"]?.costUsd, 0);

    const bad = await fetch(`${baseUrl}/stats?since=yesterday`);
    assert.equal(bad.status, 400);
  });
});

test("016: awaitHumanApproval true returns 202 pending", async () => {
  const react = fakeStrategy({ name: "react" });
  const approvals = new MemoryApprovalStore();
  const app = testApp({
    react,
    approvals,
    corsOrigins: ["http://localhost:5173"],
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "abrir incidente",
      awaitHumanApproval: true,
    });
    assert.equal(status, 202);
    assert.equal(react.calls, 0);
    const pending = json.pending as {
      approvalId: string;
      summary: string;
      createdAt: number;
    };
    assert.ok(pending.approvalId);
    assert.equal(pending.summary, "abrir incidente");
    assert.equal(typeof pending.createdAt, "number");
    assert.equal(json.answer, undefined);
  });
});

test("016: approve runs deferred turn; deny cancels; second approve 404", async () => {
  const react = fakeStrategy({ name: "react" });
  const approvals = new MemoryApprovalStore();
  const app = testApp({ react, approvals });

  await withServer(app, async (baseUrl) => {
    const pendingRes = await postChat(baseUrl, {
      message: "fazer algo",
      awaitHumanApproval: true,
    });
    assert.equal(pendingRes.status, 202);
    const approvalId = (
      pendingRes.json.pending as { approvalId: string }
    ).approvalId;

    const approve = await fetch(`${baseUrl}/approvals/${approvalId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve", userId: "test-user" }),
    });
    assert.equal(approve.status, 200);
    const approveJson = (await approve.json()) as {
      answer: string;
      requestId: string;
    };
    assert.equal(approveJson.answer, "echo:fazer algo");
    assert.equal(react.calls, 1);
    assert.ok(approve.headers.get("x-request-id"));

    const again = await fetch(`${baseUrl}/approvals/${approvalId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve", userId: "test-user" }),
    });
    assert.equal(again.status, 404);

    const pending2 = await postChat(baseUrl, {
      message: "cancelar",
      awaitHumanApproval: true,
    });
    const approvalId2 = (
      pending2.json.pending as { approvalId: string }
    ).approvalId;
    const deny = await fetch(`${baseUrl}/approvals/${approvalId2}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "deny", userId: "test-user" }),
    });
    assert.equal(deny.status, 200);
    const denyJson = (await deny.json()) as { answer: string; trace: unknown[] };
    assert.match(denyJson.answer, /cancelada/i);
    assert.equal(react.calls, 1);
  });
});

test("016: CORS OPTIONS /approvals allowlisted includes POST", async () => {
  const app = testApp({
    approvals: new MemoryApprovalStore(),
    corsOrigins: ["http://localhost:5173"],
  });

  await withServer(app, async (baseUrl) => {
    const id = "22222222-2222-4222-8222-222222222222";
    const options = await fetch(`${baseUrl}/approvals/${id}`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(options.status, 204);
    assert.equal(
      options.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
    assert.match(
      options.headers.get("access-control-allow-methods") ?? "",
      /POST/,
    );
  });
});

test("016: awaitHumanApproval false still 200", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({ react, approvals: new MemoryApprovalStore() });
  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "oi",
      awaitHumanApproval: false,
    });
    assert.equal(status, 200);
    assert.equal(json.answer, "echo:oi");
    assert.equal(react.calls, 1);
  });
});
