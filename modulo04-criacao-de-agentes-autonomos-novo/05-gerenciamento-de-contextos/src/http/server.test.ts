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
import { createFakeConversationSummarizer } from "../chat/history-summarizer.js";
import { FakeEmbedder } from "../memory/fake-embedder.js";
import { SqliteMemoryStore } from "../memory/memory-store.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
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
        trace: [{ type: "answer", content: `echo:${input.message}` }],
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

function testApp(
  overrides: Partial<ChatAppDeps> & Pick<ChatAppDeps, "registry">,
): ReturnType<typeof createApp> {
  return createApp({
    conversations: memoryConversations(),
    memories: memoryStore(),
    ...overrides,
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
): Promise<{ status: number; json: Record<string, unknown> }> {
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
  return { status: response.status, json };
}

test("US1: POST /chat happy path with fake react strategy", async () => {
  const react = fakeStrategy({ name: "react" });
  const conversations = memoryConversations();
  const app = testApp({ registry: createRegistry({ react }), conversations });

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
  });
});

test("US1: explicit strategy selects registry entry", async () => {
  const react = fakeStrategy({ name: "react" });
  const other = fakeStrategy({ name: "other" });
  const app = testApp({
    registry: createRegistry({ react, other }),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "ping",
      strategy: "other",
    });
    assert.equal(status, 200);
    assert.equal(json.answer, "echo:ping");
    assert.equal(other.calls, 1);
    assert.equal(react.calls, 0);
  });
});

test("US1: reflect true with approving critic adds critique overhead", async () => {
  const react = fakeStrategy({ name: "react" });
  const criticCalls: number[] = [];
  const app = testApp({
    registry: createRegistry({ react }),
    conversations: memoryConversations(),
    reflectionOpts: {
      critic: async (): Promise<CritiqueResult> => {
        criticCalls.push(1);
        return { approved: true, feedback: "" };
      },
    },
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
    const trace = json.trace as Array<{ type: string; approved?: boolean }>;
    assert.ok(trace.some((event) => event.type === "critique" && event.approved === true));
  });
});

test("US2: invalid body returns 400 with zod issues", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    registry: createRegistry({ react }),
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
    registry: createRegistry({ react }),
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

test("US2: omitted strategy and reflect default to react without reflection", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    registry: createRegistry({ react }),
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, { message: "defaults" });
    assert.equal(status, 200);
    assert.equal(json.answer, "echo:defaults");
    assert.equal(react.calls, 1);
    const metrics = json.metrics as { llmCalls: number };
    assert.equal(metrics.llmCalls, 1);
    const trace = json.trace as Array<{ type: string }>;
    assert.ok(!trace.some((event) => event.type === "critique"));
  });
});

test("US3: slow strategy exceeds injected timeout -> 504", async () => {
  const react = fakeStrategy({ name: "react", delayMs: 80 });
  const app = testApp({
    registry: createRegistry({ react }),
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
    registry: createRegistry({ react }),
    conversations: memoryConversations(),
    timeoutMs: 5_000,
  });

  await withServer(app, async (baseUrl) => {
    const { status } = await postChat(baseUrl, { message: "fast" });
    assert.equal(status, 200);
  });
});

test("US4: custom-named fake-only registry works end-to-end", async () => {
  const custom = fakeStrategy({ name: "custom-ops" });
  const app = testApp({
    registry: createRegistry({ "custom-ops": custom }),
    conversations: memoryConversations(),
  });

  await withServer(app, async (baseUrl) => {
    const { status, json } = await postChat(baseUrl, {
      message: "extensível",
      strategy: "custom-ops",
    });
    assert.equal(status, 200);
    assert.equal(json.answer, "echo:extensível");
    assert.equal(custom.calls, 1);
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

test("POST /chat accepts curl-style body without application/json Content-Type", async () => {
  const react = fakeStrategy({ name: "react" });
  const app = testApp({
    registry: createRegistry({ react }),
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
  const app = testApp({ registry: createRegistry({ react }) });

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
    registry: createRegistry({ react }),
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
  const app = testApp({ registry: createRegistry({ react }) });

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
    registry: createRegistry({ react }),
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
  const app = testApp({ registry: createRegistry({ react }), memories });

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
  const app = testApp({ registry: createRegistry({ react }), conversations });

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
    registry: createRegistry({ react }),
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
    registry: createRegistry({ react }),
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
  const app = testApp({ registry: createRegistry({ react }), conversations });

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
  const app = testApp({ registry: createRegistry({ react }), conversations });

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
      trace: [{ type: "answer", content: "ok" }],
      metrics: { llmCalls: 1, latencyMs: 1, promptTokens: 99 },
    }),
  });
  const appWith = testApp({ registry: createRegistry({ react: withTokens }) });

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
  const appWithout = testApp({ registry: createRegistry({ react: withoutTokens }) });

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
    registry: createRegistry({ react }),
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
