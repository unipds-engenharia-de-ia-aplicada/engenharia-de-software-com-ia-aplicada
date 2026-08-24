import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createModel } from "./llm/factory.js";
import { InMemoryStore } from "./store/in-memory-store.js";
import { seedStore } from "./store/seed.js";
import { PlanExecuteStrategy } from "./strategies/plan-execute.js";
import { ReactStrategy } from "./strategies/react.js";
import { createTools } from "./tools/index.js";
import type { ReasoningStrategy } from "./domain/types.js";

type ScenarioId = "C1" | "C2" | "C3";
type StrategyId = "react" | "plan-and-execute";

interface BenchArgs {
  scenarios: ScenarioId[];
  noReplanner: boolean;
  maxIterations: number;
}

interface ScenarioDef {
  id: ScenarioId;
  label: string;
  prompt: string;
  check: (store: InMemoryStore, answer: string) => boolean;
  /** Explains miss without changing the pass criteria. */
  diagnose: (store: InMemoryStore, answer: string) => string[];
}

interface BenchRow {
  cenario: ScenarioId;
  estrategia: string;
  acerto: boolean;
  llmCalls: number;
  latencyMs: number;
  error?: string;
  reasons?: string[];
  answerPreview?: string;
  storeSnapshot?: string;
}

const ALL_SCENARIOS: ScenarioId[] = ["C1", "C2", "C3"];
const ALL_STRATEGIES: StrategyId[] = ["react", "plan-and-execute"];

/** sev2 → high (PagerDuty-style). */
const SEV2 = "high" as const;

const C2_SERVICES = ["checkout", "payment", "catalog"] as const;

function answerMentionsCount(answer: string, count: number): boolean {
  const escaped = String(count).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\d)${escaped}(?!\\d)`).test(answer);
}

function oldestFiringService(store: InMemoryStore): string | undefined {
  return store.getAlerts("firing")[0]?.service;
}

function snapshotStore(store: InMemoryStore): string {
  const incidents = store
    .getIncidents()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((i) => `${i.id}:${i.service}/${i.severity}/${i.status}`)
    .join("; ");
  const firing = store
    .getAlerts("firing")
    .map((a) => `${a.id}:${a.service}/${a.severity}`)
    .join("; ");
  return `incidents=[${incidents || "none"}] firing=[${firing || "none"}]`;
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: "C1",
    label: "direto",
    prompt: "quantos alertas críticos estão disparando?",
    check(store, answer) {
      const expected = store
        .getAlerts("firing")
        .filter((alert) => alert.severity === "critical").length;
      // Read-only: no incidents; answer must match store ground truth.
      return store.getIncidents().length === 0 && answerMentionsCount(answer, expected);
    },
    diagnose(store, answer) {
      const expected = store
        .getAlerts("firing")
        .filter((alert) => alert.severity === "critical").length;
      const reasons: string[] = [];
      if (store.getIncidents().length !== 0) {
        reasons.push(`esperava 0 incidentes, veio ${store.getIncidents().length}`);
      }
      if (!answerMentionsCount(answer, expected)) {
        reasons.push(`resposta não cita a contagem esperada ${expected}`);
      }
      return reasons;
    },
  },
  {
    id: "C2",
    label: "estruturado",
    prompt:
      "abra três incidentes sev2 para checkout, payment e catalog, nessa mesma ordem, e resolva o primeiro.",
    check(store) {
      const incidents = store.getIncidents().sort((a, b) => a.createdAt - b.createdAt);
      if (incidents.length !== 3) {
        return false;
      }
      const servicesMatch = C2_SERVICES.every(
        (service, index) => incidents[index]?.service.toLowerCase() === service,
      );
      const severitiesMatch = incidents.every((incident) => incident.severity === SEV2);
      const firstResolved = incidents[0]?.status === "resolved";
      const othersOpen = incidents.slice(1).every((incident) => incident.status === "open");
      return servicesMatch && severitiesMatch && firstResolved && othersOpen;
    },
    diagnose(store) {
      const incidents = store.getIncidents().sort((a, b) => a.createdAt - b.createdAt);
      const reasons: string[] = [];
      if (incidents.length !== 3) {
        reasons.push(`esperava 3 incidentes, veio ${incidents.length}`);
      }
      const services = incidents.map((i) => i.service);
      if (
        !C2_SERVICES.every((service, index) => incidents[index]?.service.toLowerCase() === service)
      ) {
        reasons.push(
          `serviços/ordem: [${services.join(", ")}] (esperado: ${C2_SERVICES.join(", ")})`,
        );
      }
      const badSev = incidents.filter((i) => i.severity !== SEV2);
      if (badSev.length > 0) {
        reasons.push(
          `severity≠high (sev2): ${badSev.map((i) => `${i.service}:${i.severity}`).join(", ")}`,
        );
      }
      if (incidents[0] && incidents[0].status !== "resolved") {
        reasons.push(`primeiro incidente status=${incidents[0].status} (esperado resolved)`);
      }
      const notOpen = incidents.slice(1).filter((i) => i.status !== "open");
      if (notOpen.length > 0) {
        reasons.push(
          `demais deveriam estar open: ${notOpen.map((i) => `${i.service}:${i.status}`).join(", ")}`,
        );
      }
      return reasons;
    },
  },
  {
    id: "C3",
    label: "dinâmico",
    prompt:
      "dos alertas disparando, abra um incidente para o mais antigo e diga quantos sobraram",
    check(store, answer) {
      const firing = store.getAlerts("firing");
      const oldestService = oldestFiringService(store);
      const incidents = store.getIncidents();
      if (!oldestService || incidents.length !== 1) {
        return false;
      }
      const incident = incidents[0]!;
      if (incident.service !== oldestService || incident.status !== "open") {
        return false;
      }
      // Remaining firing alerts without an opened incident.
      const remaining = firing.length - 1;
      return answerMentionsCount(answer, remaining);
    },
    diagnose(store, answer) {
      const firing = store.getAlerts("firing");
      const oldestService = oldestFiringService(store);
      const incidents = store.getIncidents();
      const remaining = firing.length - 1;
      const reasons: string[] = [];
      if (incidents.length !== 1) {
        reasons.push(`esperava 1 incidente, veio ${incidents.length}`);
      }
      if (oldestService && incidents[0] && incidents[0].service !== oldestService) {
        reasons.push(
          `serviço=${incidents[0].service} (mais antigo firing=${oldestService})`,
        );
      }
      if (incidents[0] && incidents[0].status !== "open") {
        reasons.push(`incidente status=${incidents[0].status} (esperado open)`);
      }
      if (!answerMentionsCount(answer, remaining)) {
        reasons.push(`resposta não cita quantos sobraram (${remaining})`);
      }
      return reasons;
    },
  },
];

function parseArgs(argv: string[]): BenchArgs {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token === "--no-replanner") {
      args["--no-replanner"] = true;
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }
    args[token] = argv[i + 1] ?? "";
    i += 1;
  }

  const rawScenario = String(args["--scenario"] ?? "").trim().toUpperCase();
  let scenarios = ALL_SCENARIOS;
  if (rawScenario) {
    if (!ALL_SCENARIOS.includes(rawScenario as ScenarioId)) {
      throw new Error(`Invalid --scenario. Use: ${ALL_SCENARIOS.join(", ")}`);
    }
    scenarios = [rawScenario as ScenarioId];
  }

  const maxIterations = args["--max-iterations"]
    ? Number(args["--max-iterations"])
    : 10;
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error("--max-iterations must be a positive integer");
  }

  return {
    scenarios,
    noReplanner: args["--no-replanner"] === true,
    maxIterations,
  };
}

function createStrategy(
  name: StrategyId,
  store: InMemoryStore,
  maxIterations: number,
  noReplanner: boolean,
): ReasoningStrategy {
  const tools = createTools(store);
  if (name === "react") {
    return new ReactStrategy({ modelFactory: createModel, tools, maxIterations });
  }
  return new PlanExecuteStrategy({
    modelFactory: createModel,
    tools,
    maxIterations,
    enableReplanner: !noReplanner,
  });
}

function strategyLabel(name: StrategyId, noReplanner: boolean): string {
  if (name === "plan-and-execute" && noReplanner) {
    return "plan-and-execute (no-replanner)";
  }
  return name;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${" ".repeat(width - value.length)}`;
}

function printTable(rows: BenchRow[]): void {
  const headers = ["cenário", "estratégia", "acerto", "llmCalls", "latencyMs"] as const;
  const cells = rows.map((row) => [
    row.cenario,
    row.estrategia,
    row.acerto ? "sim" : "não",
    String(row.llmCalls),
    String(row.latencyMs),
  ]);

  const widths = headers.map((header, col) =>
    Math.max(header.length, ...cells.map((row) => row[col]!.length)),
  );

  const line = (parts: string[]) =>
    `| ${parts.map((part, i) => pad(part, widths[i]!)).join(" | ")} |`;
  const sep = `|-${widths.map((w) => "-".repeat(w)).join("-|-")}-|`;

  console.log(line([...headers]));
  console.log(sep);
  for (const row of cells) {
    console.log(line(row));
  }
}

async function runCell(
  scenario: ScenarioDef,
  strategyName: StrategyId,
  args: BenchArgs,
): Promise<BenchRow> {
  const store = new InMemoryStore();
  seedStore(store);
  const strategy = createStrategy(
    strategyName,
    store,
    args.maxIterations,
    args.noReplanner,
  );
  const label = strategyLabel(strategyName, args.noReplanner);

  try {
    const result = await strategy.run(scenario.prompt);
    const acerto = scenario.check(store, result.answer);
    return {
      cenario: scenario.id,
      estrategia: label,
      acerto,
      llmCalls: result.metrics.llmCalls,
      latencyMs: result.metrics.latencyMs,
      reasons: acerto ? undefined : scenario.diagnose(store, result.answer),
      answerPreview: acerto
        ? undefined
        : result.answer.replace(/\s+/g, " ").trim().slice(0, 240),
      storeSnapshot: acerto ? undefined : snapshotStore(store),
    };
  } catch (error) {
    return {
      cenario: scenario.id,
      estrategia: label,
      acerto: false,
      llmCalls: 0,
      latencyMs: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required. Use Node --env-file (ex: npm run bench).",
    );
  }

  const args = parseArgs(argv);
  const selected = SCENARIOS.filter((scenario) => args.scenarios.includes(scenario.id));
  const rows: BenchRow[] = [];

  console.log(
    `Bench: ${selected.map((s) => s.id).join(", ")} × ${ALL_STRATEGIES.join(", ")}` +
      (args.noReplanner ? " [--no-replanner]" : ""),
  );
  console.log();

  for (const scenario of selected) {
    for (const strategyName of ALL_STRATEGIES) {
      process.stdout.write(`Running ${scenario.id} / ${strategyName}... `);
      const row = await runCell(scenario, strategyName, args);
      rows.push(row);
      if (row.acerto) {
        console.log("ok");
      } else if (row.error) {
        console.log(`ERROR: ${row.error}`);
      } else {
        console.log("miss");
        for (const reason of row.reasons ?? []) {
          console.log(`  - ${reason}`);
        }
        if (row.answerPreview) {
          console.log(`  - answer: ${row.answerPreview}`);
        }
        if (row.storeSnapshot) {
          console.log(`  - store: ${row.storeSnapshot}`);
        }
      }
    }
  }

  console.log();
  printTable(rows);

  const misses = rows.filter((row) => !row.acerto).length;
  if (misses > 0) {
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
