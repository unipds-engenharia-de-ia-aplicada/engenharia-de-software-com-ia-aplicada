import { z } from "zod";

import type { OpsChatModel } from "../agents/model.js";
import { renderBlackboard, type BlackboardEntry } from "./blackboard.js";
import { SUPERVISOR_SYSTEM_PROMPT } from "./supervisor-prompt.js";

export const TEAM_ROLES = ["analista", "planejador", "executor"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export const supervisorDecisionSchema = z.object({
  next: z.enum(["analista", "planejador", "executor", "done"]),
  brief: z
    .string()
    .describe(
      "instrução de trabalho para o próximo papel (nó) ou resumo final se done",
    ),
});

export type SupervisorDecision = z.infer<typeof supervisorDecisionSchema>;

export interface DecideNextInput {
  message: string;
  blackboard: BlackboardEntry[];
  handoffCount: number;
}

export type DecideNextFn = (input: DecideNextInput) => Promise<SupervisorDecision>;

export function createDecideNext(modelFactory: () => OpsChatModel): DecideNextFn {
  return async ({ message, blackboard, handoffCount }) => {
    const raw = await modelFactory()
      .withStructuredOutput(supervisorDecisionSchema)
      .invoke([
        ["system", SUPERVISOR_SYSTEM_PROMPT],
        [
          "user",
          [
            `Pedido do plantonista: ${message}`,
            `Delegações já usadas: ${handoffCount}`,
            "",
            "Blackboard:",
            renderBlackboard(blackboard),
          ].join("\n"),
        ],
      ]);
    return supervisorDecisionSchema.parse(raw);
  };
}
