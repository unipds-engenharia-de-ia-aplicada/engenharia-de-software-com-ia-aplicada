import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRegistry } from "./agents/index.js";
import { createApp, startServer } from "./http/server.js";
import { createModel } from "./llm/factory.js";
import { createLLMLearningReflector } from "./memory/learning-reflector.js";
import { seedOpsStore } from "./store/seed.js";
import { SqliteConversationStore } from "./store/sqlite-conversation-store.js";
import { SqliteMemoryStore } from "./memory/memory-store.js";
import { SqliteOpsStore } from "./store/sqlite-ops-store.js";
import { PlanExecuteStrategy } from "./strategies/plan-execute.js";
import { ReactStrategy } from "./strategies/react.js";
import { createTools } from "./tools/index.js";

export function bootstrapOpsPilot() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  const dbPath = process.env.OPSPILOT_DB ?? "./data/opspilot.db";
  const store = new SqliteOpsStore(dbPath);
  seedOpsStore(store);
  const conversations = new SqliteConversationStore(dbPath);
  const memories = new SqliteMemoryStore(dbPath);
  const tools = createTools(store, memories);
  const learningReflector = createLLMLearningReflector(createModel);

  return {
    store,
    conversations,
    memories,
    tools,
    learningReflector,
    strategies: {
      react: new ReactStrategy({ modelFactory: createModel, tools, maxIterations: 10 }),
      planAndExecute: new PlanExecuteStrategy({
        modelFactory: createModel,
        tools,
        maxIterations: 10,
      }),
    },
  };
}

export async function main(): Promise<void> {
  const { strategies, conversations, memories, learningReflector } = bootstrapOpsPilot();
  const registry = createRegistry({
    react: strategies.react,
    "plan-and-execute": strategies.planAndExecute,
  });
  const app = createApp({
    registry,
    conversations,
    memories,
    learningReflector,
    reflectionOpts: { modelFactory: createModel },
  });
  const port = Number(process.env.PORT ?? 3000);
  startServer(app, port);
}

export { ReactStrategy } from "./strategies/react.js";
export { PlanExecuteStrategy } from "./strategies/plan-execute.js";
export { createApp, startServer } from "./http/server.js";
export { createRegistry, resolveStrategy, listStrategies } from "./agents/index.js";

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(currentFile)) {
  main().catch((error) => {
    console.error(error instanceof Error ? `Error: ${error.message}` : String(error));
    process.exit(1);
  });
}
