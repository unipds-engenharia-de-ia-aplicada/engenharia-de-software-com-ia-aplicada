import type { OpsChatModel } from "../agents/model.js";
import { z } from "zod";

import { ROUTER_SYSTEM_PROMPT } from "./router-prompt.js";

export const PRODUCTION_ROUTES = ["react", "planExecute", "reflect"] as const;

export type ProductionRoute = (typeof PRODUCTION_ROUTES)[number];

export const routeSchema = z.object({
  route: z.enum(PRODUCTION_ROUTES),
  reason: z.string().describe("uma frase justificando a escolha"),
});

export type RouterDecision = z.infer<typeof routeSchema>;

export type ClassifyRouteFn = (input: {
  message: string;
}) => Promise<RouterDecision>;

const FALLBACK_REASON = "fallback: router failed; using react";

export function createClassifyRoute(modelFactory: () => OpsChatModel): ClassifyRouteFn {
  return async ({ message }) => {
    try {
      const raw = await modelFactory()
        .withStructuredOutput(routeSchema)
        .invoke([
          ["system", ROUTER_SYSTEM_PROMPT],
          ["user", message],
        ]);
      return routeSchema.parse(raw);
    } catch {
      return { route: "react", reason: FALLBACK_REASON };
    }
  };
}

/** Map HTTP `strategy` string to a production route (aliases allowed). */
export function parseOverrideStrategy(strategy: string): ProductionRoute | null {
  if (strategy === "react" || strategy === "planExecute" || strategy === "reflect") {
    return strategy;
  }
  if (strategy === "plan-and-execute") {
    return "planExecute";
  }
  return null;
}

export function isProductionRoute(value: string): value is ProductionRoute {
  return (PRODUCTION_ROUTES as readonly string[]).includes(value);
}
