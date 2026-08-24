import type { TeamRole } from "./supervisor.js";

export type BlackboardKind = "facts" | "plan" | "execution" | "error";

/** Contribution appended by a role to the shared per-turn blackboard. */
export interface BlackboardEntry {
  role: TeamRole;
  /** analista→facts, planejador→plan, executor→execution; error on role failure. */
  kind: BlackboardKind;
  /** Supervisor brief that originated this contribution. */
  brief: string;
  content: string;
}

/** Serialize the blackboard for supervisor/role prompts. */
export function renderBlackboard(entries: BlackboardEntry[]): string {
  if (entries.length === 0) {
    return "(blackboard vazio — nenhuma contribuição ainda)";
  }
  return entries
    .map((entry, index) =>
      [
        `[${index + 1}] ${entry.role} (${entry.kind}) — brief: ${entry.brief}`,
        entry.content,
      ].join("\n"),
    )
    .join("\n\n");
}
