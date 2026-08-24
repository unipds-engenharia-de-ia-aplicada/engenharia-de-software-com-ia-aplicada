import test from "node:test";
import assert from "node:assert/strict";

import type {
  ReasoningStrategy,
  StrategyResult,
  StrategyRunInput,
  TraceEvent,
} from "../domain/types.js";
import { PlanExecuteStrategy } from "./plan-execute.js";
import { ReactStrategy } from "./react.js";
import {
  createLLMCritic,
  enrichInputWithFeedback,
  withReflection,
  type CriticFn,
  type CritiqueResult,
} from "./reflect.js";
import { createStrategy, parseArgs } from "../arena.js";

function mockBase(overrides?: {
  name?: string;
  run?: (input: StrategyRunInput) => Promise<StrategyResult>;
}): ReasoningStrategy & { calls: string[] } {
  const calls: string[] = [];
  const strategy: ReasoningStrategy & { calls: string[] } = {
    name: overrides?.name ?? "react",
    calls,
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      calls.push(input.message);
      if (overrides?.run) {
        return overrides.run(input);
      }
      return {
        answer: `answer-for:${input.message}`,
        trace: [
          { type: "observation", content: "obs-1" },
          { type: "answer", content: `answer-for:${input.message}` },
        ],
        metrics: { llmCalls: 1, latencyMs: 10 },
      };
    },
  };
  return strategy;
}

function sequenceCritic(results: CritiqueResult[]): CriticFn & { calls: number } {
  let index = 0;
  const fn: CriticFn & { calls: number } = Object.assign(
    async (): Promise<CritiqueResult> => {
      fn.calls += 1;
      const next = results[Math.min(index, results.length - 1)]!;
      index += 1;
      return next;
    },
    { calls: 0 },
  );
  return fn;
}

function alwaysRejectCritic(): CriticFn & { calls: number } {
  return sequenceCritic([{ approved: false, feedback: "incomplete" }]);
}

function critiquesOf(trace: TraceEvent[]): TraceEvent[] {
  return trace.filter((event) => event.type === "critique");
}

// --- US1 ---

test("US1: immediate approval — base called once, one approved critique event", async () => {
  const base = mockBase();
  const critic = sequenceCritic([{ approved: true, feedback: "ok" }]);
  const strategy = withReflection(base, { critic });

  const result = await strategy.run({ message: "list alerts", history: [] });

  assert.equal(base.calls.length, 1);
  assert.equal(critic.calls, 1);
  const critiques = critiquesOf(result.trace);
  assert.equal(critiques.length, 1);
  assert.equal(critiques[0]?.approved, true);
  assert.equal(critiques[0]?.round, 1);
  assert.equal(critiques[0]?.content, "ok");
});

test("US1: rejection then regeneration — feedback prepended, two critique events", async () => {
  const base = mockBase();
  const critic = sequenceCritic([
    { approved: false, feedback: "Resposta incompleta" },
    { approved: true, feedback: "ok" },
  ]);
  const strategy = withReflection(base, { critic });

  const result = await strategy.run({ message: "pedido original", history: [] });

  assert.equal(base.calls.length, 2);
  assert.equal(base.calls[0], "pedido original");
  assert.match(base.calls[1]!, /\[Critique - Round 1\]/);
  assert.match(base.calls[1]!, /Resposta incompleta/);
  assert.match(base.calls[1]!, /Original request:\npedido original/);
  const critiques = critiquesOf(result.trace);
  assert.equal(critiques.length, 2);
  assert.equal(critiques[0]?.approved, false);
  assert.equal(critiques[1]?.approved, true);
});

test("US1: maxReflections default 2 always-reject — 3 base calls, 2 critique events", async () => {
  const base = mockBase();
  const critic = alwaysRejectCritic();
  const strategy = withReflection(base, { critic });

  const result = await strategy.run({ message: "q", history: [] });

  assert.equal(base.calls.length, 3);
  assert.equal(critic.calls, 2);
  const critiques = critiquesOf(result.trace);
  assert.equal(critiques.length, 2);
  assert.equal(critiques[0]?.round, 1);
  assert.equal(critiques[1]?.round, 2);
});

test("US1: maxReflections 0 — critic never called, no critique events", async () => {
  const base = mockBase();
  const critic = sequenceCritic([{ approved: false, feedback: "x" }]);
  const strategy = withReflection(base, { critic, maxReflections: 0 });

  const result = await strategy.run({ message: "q", history: [] });

  assert.equal(base.calls.length, 1);
  assert.equal(critic.calls, 0);
  assert.equal(critiquesOf(result.trace).length, 0);
});

test("US1: base strategy error propagates unmodified (FR-011)", async () => {
  const error = new Error("base failed");
  const base = mockBase({
    run: async () => {
      throw error;
    },
  });
  const strategy = withReflection(base, {
    critic: async () => ({ approved: true, feedback: "" }),
  });

  await assert.rejects(() => strategy.run({ message: "q", history: [] }), (err: unknown) => err === error);
});

test("US1: empty critic feedback injects (sem feedback adicional) preamble", async () => {
  const base = mockBase();
  const critic = sequenceCritic([
    { approved: false, feedback: "" },
    { approved: true, feedback: "" },
  ]);
  const strategy = withReflection(base, { critic });

  await strategy.run({ message: "pedido", history: [] });

  assert.equal(base.calls.length, 2);
  assert.match(base.calls[1]!, /\(sem feedback adicional\)/);
  assert.equal(
    enrichInputWithFeedback("pedido", 1, ""),
    "[Critique - Round 1]:\n(sem feedback adicional)\n\nOriginal request:\npedido",
  );
});

test("US1: decorated name is reflect:<base.name> (FR-008)", () => {
  const base = mockBase({ name: "react" });
  const strategy = withReflection(base, {
    critic: async () => ({ approved: true, feedback: "" }),
  });
  assert.equal(strategy.name, "reflect:react");
});

// --- US2 ---

test("US2: immediate approval metrics — llmCalls === base + 1 (SC-003)", async () => {
  const base = mockBase({
    run: async () => ({
      answer: "a",
      trace: [{ type: "answer", content: "a" }],
      metrics: { llmCalls: 2, latencyMs: 5 },
    }),
  });
  const critic = sequenceCritic([{ approved: true, feedback: "ok" }]);
  const strategy = withReflection(base, { critic });

  const result = await strategy.run({ message: "q", history: [] });
  assert.equal(result.metrics.llmCalls, 3);
});

test("US2: one reflection cycle metrics — both base runs + 2 critic calls", async () => {
  const base = mockBase();
  const critic = sequenceCritic([
    { approved: false, feedback: "fix" },
    { approved: true, feedback: "ok" },
  ]);
  const strategy = withReflection(base, { critic });

  const result = await strategy.run({ message: "q", history: [] });
  // 2 base (1 each) + 2 critic = 4
  assert.equal(result.metrics.llmCalls, 4);
});

test("US2: maxReflections 2 always-reject — llmCalls === 5", async () => {
  const base = mockBase();
  const critic = alwaysRejectCritic();
  const strategy = withReflection(base, { critic, maxReflections: 2 });

  const result = await strategy.run({ message: "q", history: [] });
  assert.equal(result.metrics.llmCalls, 5);
});

test("US2: latencyMs is wall-clock of full run()", async () => {
  const base = mockBase({
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        answer: "a",
        trace: [{ type: "answer", content: "a" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  });
  const strategy = withReflection(base, {
    critic: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { approved: true, feedback: "ok" };
    },
  });

  const result = await strategy.run({ message: "q", history: [] });
  assert.ok(result.metrics.latencyMs >= 35);
});

test("US2: withReflection sums promptTokens across base runs; omits when none", async () => {
  const withTokens = mockBase({
    run: async () => ({
      answer: "a",
      trace: [{ type: "answer", content: "a" }],
      metrics: { llmCalls: 1, latencyMs: 1, promptTokens: 10 },
    }),
  });
  const rejectThenApprove = sequenceCritic([
    { approved: false, feedback: "fix" },
    { approved: true, feedback: "ok" },
  ]);
  const summed = await withReflection(withTokens, { critic: rejectThenApprove }).run({
    message: "q",
    history: [],
  });
  assert.equal(summed.metrics.promptTokens, 20);

  const without = mockBase({
    run: async () => ({
      answer: "a",
      trace: [{ type: "answer", content: "a" }],
      metrics: { llmCalls: 1, latencyMs: 1 },
    }),
  });
  const omitted = await withReflection(without, {
    critic: async () => ({ approved: true, feedback: "ok" }),
  }).run({ message: "q", history: [] });
  assert.equal(omitted.metrics.promptTokens, undefined);
});

// --- US3 ---

test("US3: withReflection(ReactStrategy) name is reflect:react", () => {
  const base = new ReactStrategy({
    modelFactory: () => {
      throw new Error("unused");
    },
    tools: [],
    maxIterations: 1,
  });
  const strategy = withReflection(base, { maxReflections: 0 });
  assert.equal(strategy.name, "reflect:react");
});

test("US3: withReflection(PlanExecuteStrategy) name is reflect:plan-and-execute", () => {
  const base = new PlanExecuteStrategy({
    modelFactory: () => {
      throw new Error("unused");
    },
    tools: [],
    maxIterations: 1,
  });
  const strategy = withReflection(base, { maxReflections: 0 });
  assert.equal(strategy.name, "reflect:plan-and-execute");
});

test("US3: Arena createStrategy instantiates reflect:* names", () => {
  const reactReflect = createStrategy("reflect:react", 1);
  const planReflect = createStrategy("reflect:plan-and-execute", 1);
  assert.equal(reactReflect.name, "reflect:react");
  assert.equal(planReflect.name, "reflect:plan-and-execute");
});

test("US3: parseArgs accepts reflect:* and lists all four names on invalid", () => {
  const parsed = parseArgs(["--strategies", "reflect:react,reflect:plan-and-execute"]);
  assert.deepEqual(parsed.strategies, ["reflect:react", "reflect:plan-and-execute"]);

  assert.throws(
    () => parseArgs(["--strategies", "nope"]),
    /react, plan-and-execute, reflect:react, reflect:plan-and-execute/,
  );
});

// --- Polish / FR-012 ---

test("FR-012: createLLMCritic fail-safe returns approved on model error", async () => {
  const critic = createLLMCritic(() => {
    throw new Error("boom");
  });
  const result = await critic("answer", [{ type: "observation", content: "o" }], "pedido");
  assert.deepEqual(result, { approved: true, feedback: "" });
});

test("missing critic and modelFactory with maxReflections > 0 behaves as pass-through", async () => {
  const base = mockBase();
  const strategy = withReflection(base, { maxReflections: 2 });
  const result = await strategy.run({ message: "q", history: [] });
  assert.equal(base.calls.length, 1);
  assert.equal(critiquesOf(result.trace).length, 0);
  assert.equal(result.metrics.llmCalls, 1);
});
