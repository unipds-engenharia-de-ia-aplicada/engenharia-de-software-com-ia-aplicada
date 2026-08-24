import assert from "node:assert/strict";
import test from "node:test";

import type { BlackboardEntry, BlackboardKind } from "./blackboard.js";
import type { RoleRunner, RoleRunInput } from "./roles.js";
import type {
  DecideNextFn,
  DecideNextInput,
  SupervisorDecision,
  TeamRole,
} from "./supervisor.js";
import {
  CAP_REACHED_PREFIX,
  INVALID_DECISION_PREFIX,
  MAX_HANDOFFS,
  runTeamGraph,
  type TeamGraphDeps,
} from "./team-graph.js";
import { TeamStrategy } from "./team-strategy.js";

const KIND_BY_ROLE: Record<TeamRole, BlackboardKind> = {
  analista: "facts",
  planejador: "plan",
  executor: "execution",
};

function fakeRunner(
  role: TeamRole,
  options?: {
    content?: string;
    llmCalls?: number;
    fail?: boolean;
    log?: string[];
  },
): RoleRunner & { calls: number; inputs: RoleRunInput[] } {
  const runner: RoleRunner & { calls: number; inputs: RoleRunInput[] } = {
    role,
    tools: [],
    calls: 0,
    inputs: [],
    async run(input) {
      runner.calls += 1;
      runner.inputs.push(input);
      options?.log?.push(role);
      if (options?.fail) {
        throw new Error(`${role} quebrou`);
      }
      const content = options?.content ?? `${role} trabalhou: ${input.brief}`;
      return {
        entry: { role, kind: KIND_BY_ROLE[role], brief: input.brief, content },
        trace: [{ type: "observation", content, node: role }],
        llmCalls: options?.llmCalls ?? 1,
      };
    },
  };
  return runner;
}

function decideSeq(
  decisions: SupervisorDecision[],
  log?: string[],
): DecideNextFn & { inputs: DecideNextInput[] } {
  let index = 0;
  const inputs: DecideNextInput[] = [];
  const fn = (async (input: DecideNextInput) => {
    inputs.push(input);
    log?.push("supervisor");
    const decision = decisions[Math.min(index, decisions.length - 1)];
    index += 1;
    return decision;
  }) as DecideNextFn & { inputs: DecideNextInput[] };
  fn.inputs = inputs;
  return fn;
}

function deps(overrides?: Partial<TeamGraphDeps>): TeamGraphDeps {
  return {
    decideNext: decideSeq([{ next: "done", brief: "nada a fazer" }]),
    roleRunners: {
      analista: fakeRunner("analista"),
      planejador: fakeRunner("planejador"),
      executor: fakeRunner("executor"),
    },
    ...overrides,
  };
}

test("US1: supervisor cycle delegates in order over the blackboard", async () => {
  const log: string[] = [];
  const analista = fakeRunner("analista", { log, llmCalls: 2 });
  const planejador = fakeRunner("planejador", { log });
  const executor = fakeRunner("executor", { log });
  const decideNext = decideSeq(
    [
      { next: "analista", brief: "levante os fatos" },
      { next: "planejador", brief: "monte o plano" },
      { next: "done", brief: "resposta final ao plantonista" },
    ],
    log,
  );

  const result = await runTeamGraph(
    deps({
      decideNext,
      roleRunners: { analista, planejador, executor },
      supervisorLlmCalls: 1,
    }),
    { message: "latência no checkout" },
  );

  // Order: control always returns to the supervisor between roles.
  assert.deepEqual(log, [
    "supervisor",
    "analista",
    "supervisor",
    "planejador",
    "supervisor",
  ]);
  assert.equal(analista.calls, 1);
  assert.equal(planejador.calls, 1);
  assert.equal(executor.calls, 0);
  assert.equal(analista.inputs[0]?.brief, "levante os fatos");

  // Supervisor sees the growing blackboard each round.
  assert.equal(decideNext.inputs[0]?.blackboard.length, 0);
  assert.equal(decideNext.inputs[1]?.blackboard.length, 1);
  assert.equal(decideNext.inputs[1]?.blackboard[0]?.kind, "facts");
  assert.equal(decideNext.inputs[2]?.blackboard.length, 2);
  assert.equal(decideNext.inputs[2]?.blackboard[1]?.kind, "plan");

  // brief carries the final summary on done (user contract).
  assert.equal(result.answer, "resposta final ao plantonista");

  // llmCalls aggregate: 3 supervisor decisions (1 each) + analista 2 + planejador 1.
  assert.equal(result.llmCalls, 6);
});

test("US1: malformed decision degrades to done without throwing", async () => {
  const decideNext = (async () => ({
    next: "gerente",
    brief: "x",
  })) as unknown as DecideNextFn;

  const result = await runTeamGraph(deps({ decideNext }), {
    message: "pedido qualquer",
  });

  assert.ok(result.answer.length > 0);
  assert.match(result.answer, /pedido qualquer/);
});

test("US1: done with empty blackboard still answers from the message", async () => {
  const result = await runTeamGraph(
    deps({ decideNext: decideSeq([{ next: "done", brief: "" }]) }),
    { message: "só passando" },
  );

  assert.ok(result.answer.length > 0);
  assert.match(result.answer, /só passando/);
});

test("US1: forced closure with content falls back to blackboard summary", async () => {
  const decideNext = decideSeq([
    { next: "analista", brief: "fatos" },
    { next: "done", brief: "" },
  ]);
  const result = await runTeamGraph(deps({ decideNext }), {
    message: "resumo",
  });

  assert.match(result.answer, /Resumo do blackboard/);
  assert.match(result.answer, /analista trabalhou/);
});

test("US1: role failure appends error entry and returns control to supervisor", async () => {
  const analista = fakeRunner("analista", { fail: true });
  const decideNext = decideSeq([
    { next: "analista", brief: "vai falhar" },
    { next: "done", brief: "encerrando após falha" },
  ]);

  const result = await runTeamGraph(
    deps({ decideNext, roleRunners: { ...deps().roleRunners, analista } }),
    { message: "teste de falha" },
  );

  assert.equal(result.answer, "encerrando após falha");
  assert.equal(decideNext.inputs[1]?.blackboard.length, 1);
  assert.equal(decideNext.inputs[1]?.blackboard[0]?.kind, "error");
  assert.match(decideNext.inputs[1]?.blackboard[0]?.content ?? "", /analista quebrou/);
  assert.ok(
    result.trace.some(
      (event) => event.type === "observation" && event.node === "analista",
    ),
  );
});

test("US3: one handoff event per supervisor decision with destination and brief", async () => {
  const decideNext = decideSeq([
    { next: "analista", brief: "levante os fatos" },
    { next: "executor", brief: "resolva o incidente inc-1" },
    { next: "done", brief: "tudo resolvido" },
  ]);

  const result = await runTeamGraph(deps({ decideNext }), {
    message: "resolver incidente",
  });

  const handoffs = result.trace.filter((event) => event.type === "handoff");
  assert.equal(handoffs.length, 3);
  assert.ok(handoffs.every((event) => event.node === "supervisor"));
  assert.deepEqual(
    handoffs.map((event) => event.to),
    ["analista", "executor", "done"],
  );
  assert.deepEqual(
    handoffs.map((event) => event.content),
    ["levante os fatos", "resolva o incidente inc-1", "tudo resolvido"],
  );
});

test("US3: anomalous decision emits handoff with stable prefix", async () => {
  const decideNext = (async () => {
    throw new Error("saída ilegível");
  }) as DecideNextFn;

  const result = await runTeamGraph(deps({ decideNext }), { message: "x" });

  const handoffs = result.trace.filter((event) => event.type === "handoff");
  assert.equal(handoffs.length, 1);
  assert.equal(handoffs[0]?.to, "done");
  assert.ok(handoffs[0]?.content.startsWith(INVALID_DECISION_PREFIX));
});

test("US5: never-finishing supervisor stops after exactly 8 delegations", async () => {
  const analista = fakeRunner("analista");
  const decideNext = decideSeq([{ next: "analista", brief: "de novo" }]);

  const result = await runTeamGraph(
    deps({ decideNext, roleRunners: { ...deps().roleRunners, analista } }),
    { message: "loop" },
  );

  assert.equal(analista.calls, MAX_HANDOFFS);
  const handoffs = result.trace.filter((event) => event.type === "handoff");
  const delegations = handoffs.filter((event) => event.to !== "done");
  assert.equal(delegations.length, MAX_HANDOFFS);
  const forced = handoffs.at(-1);
  assert.equal(forced?.to, "done");
  assert.ok(forced?.content.startsWith(CAP_REACHED_PREFIX));
  assert.ok(result.answer.length > 0);
  assert.match(result.answer, /Resumo do blackboard/);
});

test("US5: natural finish keeps only real delegation handoffs", async () => {
  const decideNext = decideSeq([
    { next: "analista", brief: "fatos" },
    { next: "planejador", brief: "plano" },
    { next: "done", brief: "fim" },
  ]);

  const result = await runTeamGraph(deps({ decideNext }), { message: "x" });

  const delegations = result.trace.filter(
    (event) => event.type === "handoff" && event.to !== "done",
  );
  assert.equal(delegations.length, 2);
});

test("US1: TeamStrategy adapter returns full StrategyResult with history composed", async () => {
  const decideNext = decideSeq([{ next: "done", brief: "resposta direta" }]);
  const strategy = new TeamStrategy({
    modelFactory: (() => {
      throw new Error("no model in tests");
    }) as never,
    analistaTools: [],
    executorTools: [],
    decideNext,
    roleRunners: {
      analista: fakeRunner("analista"),
      planejador: fakeRunner("planejador"),
      executor: fakeRunner("executor"),
    },
  });

  const result = await strategy.run({
    message: "e agora?",
    history: [
      {
        id: "1",
        conversationId: "c1",
        role: "user",
        content: "antes",
        createdAt: 1,
      },
    ],
  });

  assert.equal(strategy.name, "team");
  assert.equal(result.answer, "resposta direta");
  assert.ok(Array.isArray(result.trace));
  assert.equal(typeof result.metrics.llmCalls, "number");
  assert.equal(typeof result.metrics.latencyMs, "number");
  // History composed into the supervisor's message context.
  assert.match(decideNext.inputs[0]?.message ?? "", /Histórico recente/);
  assert.match(decideNext.inputs[0]?.message ?? "", /user: antes/);
  assert.match(decideNext.inputs[0]?.message ?? "", /e agora\?/);
});
