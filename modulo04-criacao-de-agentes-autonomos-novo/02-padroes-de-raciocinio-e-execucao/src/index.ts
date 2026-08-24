import { createModel } from "./llm/factory.js";
import { InMemoryStore } from "./store/in-memory-store.js";
import { seedStore } from "./store/seed.js";
import { PlanExecuteStrategy } from "./strategies/plan-execute.js";
import { ReactStrategy } from "./strategies/react.js";
import { createTools } from "./tools/index.js";

export function bootstrapOpsPilot() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  const store = new InMemoryStore();
  seedStore(store);
  const tools = createTools(store);

  return {
    store,
    tools,
    strategies: {
      react: new ReactStrategy({ modelFactory: createModel, tools, maxIterations: 10 }),
      planAndExecute: new PlanExecuteStrategy({ modelFactory: createModel, tools, maxIterations: 10 }),
    },
  };
}

export { ReactStrategy } from "./strategies/react.js";
export { PlanExecuteStrategy } from "./strategies/plan-execute.js";
