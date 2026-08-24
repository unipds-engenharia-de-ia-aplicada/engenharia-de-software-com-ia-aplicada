import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryStore, RememberResult } from "../domain/types.js";
import { FakeEmbedder } from "./fake-embedder.js";
import {
  LEARNING_REFLECTOR_PROMPT,
  PLANTAO_ORG_MEMORY_FACT,
  buildMemoryRecallQuery,
  prepareMemoriesForTurn,
  scheduleLearning,
  suggestsPlantaoOrganization,
  type LearningReflectorFn,
} from "./learning-reflector.js";
import { SqliteMemoryStore } from "./memory-store.js";
import { formatMemoriesForPrompt, runChat } from "../chat/run-chat.js";
import type { ReasoningStrategy, StrategyResult, StrategyRunInput } from "../domain/types.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";

function spyMemoryStore(): MemoryStore & { rememberCalls: Array<{ userId: string; fact: string }> } {
  const rememberCalls: Array<{ userId: string; fact: string }> = [];
  return {
    rememberCalls,
    async remember(userId: string, fact: string): Promise<RememberResult> {
      rememberCalls.push({ userId, fact });
      return { id: "spy-id", stored: true };
    },
    async recall() {
      return [];
    },
    async forget() {
      return false;
    },
  };
}

test("scheduleLearning: positive reflector calls remember once with trimmed fact", async () => {
  const memories = spyMemoryStore();
  const reflector: LearningReflectorFn = async () => ({
    hasLearning: true,
    fact: "  always prioritize checkout  ",
  });
  await scheduleLearning({
    reflector,
    memories,
    userId: "u1",
    userMessage: "sempre priorize checkout",
  });
  assert.equal(memories.rememberCalls.length, 1);
  assert.deepEqual(memories.rememberCalls[0], {
    userId: "u1",
    fact: "always prioritize checkout",
  });
});

test("scheduleLearning: hasLearning false or empty fact skips remember", async () => {
  const memories = spyMemoryStore();
  await scheduleLearning({
    reflector: async () => ({ hasLearning: false, fact: "ignored" }),
    memories,
    userId: "u1",
    userMessage: "liste alertas",
  });
  await scheduleLearning({
    reflector: async () => ({ hasLearning: true, fact: "   " }),
    memories,
    userId: "u1",
    userMessage: "x",
  });
  assert.equal(memories.rememberCalls.length, 0);
});

test("scheduleLearning: reflector throw and remember reject are swallowed", async () => {
  const memories = spyMemoryStore();
  await scheduleLearning({
    reflector: async () => {
      throw new Error("llm down");
    },
    memories,
    userId: "u1",
    userMessage: "oi",
  });

  const rejecting: MemoryStore = {
    async remember() {
      throw new Error("db down");
    },
    async recall() {
      return [];
    },
    async forget() {
      return false;
    },
  };
  await scheduleLearning({
    reflector: async () => ({ hasLearning: true, fact: "durable" }),
    memories: rejecting,
    userId: "u1",
    userMessage: "oi",
  });
  assert.equal(memories.rememberCalls.length, 0);
});

test("runChat does not await deferred remember (SC-003)", async () => {
  let resolveRemember!: () => void;
  const rememberGate = new Promise<void>((resolve) => {
    resolveRemember = resolve;
  });
  let rememberStarted = false;
  let rememberFinished = false;

  const memories: MemoryStore = {
    async remember() {
      rememberStarted = true;
      await rememberGate;
      rememberFinished = true;
      return { id: "late", stored: true };
    },
    async recall() {
      return [];
    },
    async forget() {
      return false;
    },
  };

  const conversations = new SqliteConversationStore(":memory:");
  const strategy: ReasoningStrategy = {
    name: "fake",
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      return {
        answer: `echo:${input.message}`,
        trace: [{ node: "test",  type: "answer", content: input.message }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };

  const resultPromise = runChat(conversations, memories, strategy, {
    message: "sempre priorize checkout",
    userId: "u1",
  }, {
    learningReflector: async () => ({
      hasLearning: true,
      fact: "User prefers prioritizing checkout",
    }),
  });

  const result = await resultPromise;
  assert.equal(result.answer, "echo:sempre priorize checkout");
  assert.equal(rememberFinished, false);
  // Allow the scheduled microtask/promise to start remember
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(rememberStarted, true);
  assert.equal(rememberFinished, false);
  resolveRemember();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(rememberFinished, true);
});

test("US2 fixtures: durable learns; punctual and secret do not", async () => {
  const cases: Array<{
    name: string;
    reflection: { hasLearning: boolean; fact: string };
    expectRemember: boolean;
  }> = [
    {
      name: "durable",
      reflection: { hasLearning: true, fact: "Prefer short incident summaries" },
      expectRemember: true,
    },
    {
      name: "punctual",
      reflection: { hasLearning: false, fact: "" },
      expectRemember: false,
    },
    {
      name: "secret",
      reflection: { hasLearning: false, fact: "" },
      expectRemember: false,
    },
  ];

  for (const c of cases) {
    const memories = spyMemoryStore();
    await scheduleLearning({
      reflector: async () => c.reflection,
      memories,
      userId: "u1",
      userMessage: c.name,
    });
    assert.equal(
      memories.rememberCalls.length,
      c.expectRemember ? 1 : 0,
      c.name,
    );
  }
});

test("LEARNING_REFLECTOR_PROMPT documents durable / anti-pontual / anti-segredo / organizar plantão", () => {
  assert.match(LEARNING_REFLECTOR_PROMPT, /DURÁVEIS|DURÁVEL/i);
  assert.match(LEARNING_REFLECTOR_PROMPT, /PONTUAIS|pontual/i);
  assert.match(LEARNING_REFLECTOR_PROMPT, /SEGREDOS|segredo|API keys|senhas/i);
  assert.match(LEARNING_REFLECTOR_PROMPT, /liste alertas|abra um incidente/i);
  assert.match(LEARNING_REFLECTOR_PROMPT, /ORGANIZAR|organiz/i);
  assert.match(LEARNING_REFLECTOR_PROMPT, /severidade|prioridade/i);
  assert.match(LEARNING_REFLECTOR_PROMPT, /critical/);
});

test("suggestsPlantaoOrganization detects organize + listing", () => {
  assert.equal(
    suggestsPlantaoOrganization("organize meu plantão, mostre os incidentes em aberto"),
    true,
  );
  assert.equal(suggestsPlantaoOrganization("liste alertas firing"), false);
  assert.equal(
    suggestsPlantaoOrganization("liste incidentes por prioridade"),
    true,
  );
});

test("buildMemoryRecallQuery enriches organization asks", () => {
  const q = buildMemoryRecallQuery("organize meu plantão");
  assert.match(q, /organize meu plantão/);
  assert.match(q, /severidade/i);
  assert.equal(buildMemoryRecallQuery("oi"), "oi");
});

test("prepareMemoriesForTurn awaits learn then recalls org preference", async () => {
  const userMessage = "organize meu plantão, mostre os incidentes em aberto";
  const recallQuery = buildMemoryRecallQuery(userMessage);
  const embedder = new FakeEmbedder()
    .setAxis(PLANTAO_ORG_MEMORY_FACT, 0)
    .setAxis(recallQuery, 0);
  const store = new SqliteMemoryStore(":memory:", embedder);
  const reflector: LearningReflectorFn = async () => ({
    hasLearning: true,
    fact: PLANTAO_ORG_MEMORY_FACT,
  });

  const recalled = await prepareMemoriesForTurn({
    reflector,
    memories: store,
    userId: "war-room",
    userMessage,
  });

  assert.ok(recalled.length >= 1);
  assert.ok(
    recalled.some((m) => /severidade|critical/i.test(m.fact)),
    `expected org fact in recall, got ${JSON.stringify(recalled)}`,
  );
});

test("formatMemoriesForPrompt still available (sanity)", () => {
  assert.equal(formatMemoriesForPrompt([], "x"), "x");
});

test("scheduleLearning persists via SqliteMemoryStore + FakeEmbedder", async () => {
  const embedder = new FakeEmbedder().setAxis("User prefers prioritizing checkout", 0);
  const store = new SqliteMemoryStore(":memory:", embedder);
  await scheduleLearning({
    reflector: async () => ({
      hasLearning: true,
      fact: "User prefers prioritizing checkout",
    }),
    memories: store,
    userId: "plantonista",
    userMessage: "sempre priorize checkout",
  });
  embedder.setAxis("priorities?", 0);
  const recalled = await store.recall("plantonista", "priorities?");
  assert.ok(recalled.some((m) => /checkout/i.test(m.fact)));
});
