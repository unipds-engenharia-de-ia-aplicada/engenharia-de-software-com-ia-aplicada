import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createModel } from "./llm/factory.js";
import { InMemoryStore } from "./store/in-memory-store.js";
import { seedStore } from "./store/seed.js";
import { PlanExecuteStrategy } from "./strategies/plan-execute.js";
import { ReactStrategy } from "./strategies/react.js";
import { withReflection } from "./strategies/reflect.js";
import { createTools } from "./tools/index.js";
import type { ReasoningStrategy, TraceEvent } from "./domain/types.js";

export type StrategyName =
  | "react"
  | "plan-and-execute"
  | "reflect:react"
  | "reflect:plan-and-execute";

export interface ArenaArgs {
  strategies: StrategyName[];
  input: string;
  maxIterations: number;
}

const DEFAULT_INPUT = "Quais serviços têm alertas ativos?";

const VALID_STRATEGY_NAMES: StrategyName[] = [
  "react",
  "plan-and-execute",
  "reflect:react",
  "reflect:plan-and-execute",
];

export function parseArgs(argv: string[]): ArenaArgs {
  const args: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    args[token] = argv[i + 1] ?? "";
    i += 1;
  }

  const rawStrategies = (args["--strategies"] ?? "").trim();
  if (!rawStrategies) {
    throw new Error("Missing required flag: --strategies");
  }

  const strategies = rawStrategies
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is StrategyName =>
      VALID_STRATEGY_NAMES.includes(value as StrategyName),
    );
  if (strategies.length === 0) {
    throw new Error(
      "No valid strategies. Use: react, plan-and-execute, reflect:react, reflect:plan-and-execute",
    );
  }

  const maxIterations = args["--max-iterations"] ? Number(args["--max-iterations"]) : 10;
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error("--max-iterations must be a positive integer");
  }

  return {
    strategies,
    input: (args["--input"] ?? positional.join(" ").trim()) || DEFAULT_INPUT,
    maxIterations,
  };
}

function printHeader(strategyName: string): void {
  console.log("════════════════════════════════════════");
  console.log(`Strategy: ${strategyName}`);
  console.log("════════════════════════════════════════");
  console.log();
}

function formatTraceEvent(event: TraceEvent): string {
  if (event.type === "action") {
    const args = JSON.stringify(event.toolArgs ?? {});
    return `[action]      ${event.tool ?? "unknown"}(${args})`;
  }
  return `[${event.type}]      ${event.content}`;
}

function printResult(name: string, result: Awaited<ReturnType<ReasoningStrategy["run"]>>): void {
  printHeader(name);
  console.log("── Trace ──────────────────────────────");
  for (const event of result.trace) {
    console.log(formatTraceEvent(event));
  }
  console.log();
  console.log("── Metrics ────────────────────────────");
  console.log(`LLM calls:   ${result.metrics.llmCalls}`);
  console.log(`Latency:     ${result.metrics.latencyMs} ms`);
  console.log();
  console.log("── Answer ─────────────────────────────");
  console.log(result.answer);
  console.log();
}

export function createStrategy(name: StrategyName, maxIterations: number): ReasoningStrategy {
  const store = new InMemoryStore();
  seedStore(store);
  const tools = createTools(store);

  if (name === "react") {
    return new ReactStrategy({ modelFactory: createModel, tools, maxIterations });
  }
  if (name === "plan-and-execute") {
    return new PlanExecuteStrategy({ modelFactory: createModel, tools, maxIterations });
  }
  if (name === "reflect:react") {
    const base = new ReactStrategy({ modelFactory: createModel, tools, maxIterations });
    return withReflection(base, { modelFactory: createModel });
  }
  if (name === "reflect:plan-and-execute") {
    const base = new PlanExecuteStrategy({ modelFactory: createModel, tools, maxIterations });
    return withReflection(base, { modelFactory: createModel });
  }

  const _exhaustive: never = name;
  throw new Error(`Unknown strategy: ${_exhaustive}`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required. Use Node --env-file (ex: npm run arena -- --input \"...\" --strategies react).",
    );
  }

  const args = parseArgs(argv);
  let hadErrors = false;

  for (const strategyName of args.strategies) {
    try {
      const strategy = createStrategy(strategyName, args.maxIterations);
      const result = await strategy.run(args.input);
      printResult(strategyName, result);
    } catch (error) {
      hadErrors = true;
      printHeader(strategyName);
      console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
    }
  }

  if (hadErrors) {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(currentFile)) {
  main().catch((error) => {
    console.error(error instanceof Error ? `Error: ${error.message}` : String(error));
    process.exit(1);
  });
}
