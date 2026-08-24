/**
 * ContextBuilder — monta o prompt com teto por seção.
 *
 * Env (defaults): CONTEXT_BUDGET_SUMMARY=200, CONTEXT_BUDGET_HISTORY=1200,
 * CONTEXT_BUDGET_MEMORIES=300. CONTEXT_BUDGET_SYSTEM is read but system is
 * never cut (intocável). Mensagem atual também intocável.
 * Alias legado: CONTEXT_BUDGET_WINDOW → history.
 */
import type { ConversationMessage, RecalledMemory } from "../domain/types.js";
import { estimateTokens } from "./tokens.js";

export interface SectionBudgets {
  /** Read from env; cut rule is always "never" (system intocável). */
  system: number;
  summary: number;
  history: number;
  memories: number;
}

/**
 * CONTEXT_BUDGET_SYSTEM / CONTEXT_BUDGET_SUMMARY / CONTEXT_BUDGET_HISTORY /
 * CONTEXT_BUDGET_MEMORIES
 */
export const DEFAULT_SECTION_BUDGETS: SectionBudgets = {
  system: Number.POSITIVE_INFINITY,
  summary: 200,
  history: 1200,
  memories: 300,
};

export type CutRule = "never" | "truncate" | "oldest-first" | "lowest-score-first";

export interface BuildInput {
  system: string;
  summary: string | null;
  history: ConversationMessage[];
  memories: RecalledMemory[];
  message: string;
}

/** Alias matching contracts. */
export type ContextBuildInput = BuildInput;

export interface BuildContext {
  system: string;
  message: string;
  summary: string;
  history: ConversationMessage[];
  memories: RecalledMemory[];
  enrichedMessage: string;
  historyMessages: number;
  recalledMemories: number;
  historyText: string;
  memoriesText: string;
  summaryText: string;
}

/** Alias matching contracts. */
export type ContextBuildResult = BuildContext;

type SectionName = "system" | "summary" | "history" | "memories";

interface SectionSpec<T> {
  name: SectionName;
  value: T;
  budget: number;
  cut: CutRule;
}

interface FittedSection<T> {
  name: SectionName;
  value: T;
  text: string;
}

function parseBudget(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.trunc(n);
}

export function resolveSectionBudgets(
  overrides?: Partial<SectionBudgets>,
  env: NodeJS.ProcessEnv = process.env,
): SectionBudgets {
  // Prefer HISTORY; fall back to legacy WINDOW alias.
  const historyRaw = env.CONTEXT_BUDGET_HISTORY ?? env.CONTEXT_BUDGET_WINDOW;
  const base: SectionBudgets = {
    system: parseBudget(env.CONTEXT_BUDGET_SYSTEM, DEFAULT_SECTION_BUDGETS.system),
    summary: parseBudget(env.CONTEXT_BUDGET_SUMMARY, DEFAULT_SECTION_BUDGETS.summary),
    history: parseBudget(historyRaw, DEFAULT_SECTION_BUDGETS.history),
    memories: parseBudget(env.CONTEXT_BUDGET_MEMORIES, DEFAULT_SECTION_BUDGETS.memories),
  };
  if (overrides?.system !== undefined) {
    base.system = overrides.system;
  }
  if (overrides?.summary !== undefined) {
    base.summary = overrides.summary;
  }
  if (overrides?.history !== undefined) {
    base.history = overrides.history;
  }
  if (overrides?.memories !== undefined) {
    base.memories = overrides.memories;
  }
  return base;
}

export function formatHistoryText(history: ConversationMessage[]): string {
  if (history.length === 0) {
    return "";
  }
  return history.map((m) => `${m.role}: ${m.content}`).join("\n");
}

export function formatMemoriesText(recalled: RecalledMemory[]): string {
  if (recalled.length === 0) {
    return "";
  }
  return recalled.map((m) => `- ${m.fact}`).join("\n");
}

/** Inject recalled facts into the user message envelope. */
export function formatMemoriesForPrompt(
  recalled: RecalledMemory[],
  currentMessage: string,
): string {
  if (recalled.length === 0) {
    return currentMessage;
  }
  const lines = recalled.map((m) => `- ${m.fact}`);
  return `Relevant memories:\n${lines.join("\n")}\n\nCurrent message:\n${currentMessage}`;
}

/** Prefix conversation summary when present (same contract as history-summarizer). */
export function formatSummaryForPrompt(
  summary: string | null | undefined,
  body: string,
): string {
  const trimmed = summary?.trim() ?? "";
  if (trimmed.length === 0) {
    return body;
  }
  return `Conversation summary:\n${trimmed}\n\n${body}`;
}
function truncateToBudget(text: string, budget: number): string {
  if (budget <= 0) {
    return "";
  }
  const maxChars = budget * 4;
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function section<T>(
  name: SectionName,
  value: T,
  opts: { budget: number; cut: CutRule },
): SectionSpec<T> {
  return { name, value, budget: opts.budget, cut: opts.cut };
}

function shrinkUntilFits(
  prefixLen: number,
  body: string,
  budget: number,
): string {
  if (budget <= 0) {
    return "";
  }
  const maxTotalChars = budget * 4;
  const maxBody = Math.max(0, maxTotalChars - prefixLen);
  return body.length <= maxBody ? body : body.slice(0, maxBody);
}

function fitHistory(history: ConversationMessage[], budget: number): ConversationMessage[] {
  if (budget <= 0) {
    return [];
  }
  let result = history.map((m) => ({ ...m }));
  while (result.length > 1 && estimateTokens(formatHistoryText(result)) > budget) {
    result = result.slice(1);
  }
  if (result.length === 1 && estimateTokens(formatHistoryText(result)) > budget) {
    const only = result[0]!;
    const prefix = `${only.role}: `;
    result = [
      {
        ...only,
        content: shrinkUntilFits(prefix.length, only.content, budget),
      },
    ];
  }
  return result;
}

function fitMemories(memories: RecalledMemory[], budget: number): RecalledMemory[] {
  if (budget <= 0) {
    return [];
  }
  // Work on a copy with original indices for stable tie-break.
  let indexed = memories.map((m, index) => ({ ...m, index }));
  while (indexed.length > 1 && estimateTokens(formatMemoriesText(indexed)) > budget) {
    // Drop lowest score; on tie drop higher original index.
    let dropAt = 0;
    for (let i = 1; i < indexed.length; i++) {
      const cur = indexed[i]!;
      const best = indexed[dropAt]!;
      if (
        cur.score < best.score ||
        (cur.score === best.score && cur.index > best.index)
      ) {
        dropAt = i;
      }
    }
    indexed = indexed.filter((_, i) => i !== dropAt);
  }
  if (indexed.length === 1 && estimateTokens(formatMemoriesText(indexed)) > budget) {
    const only = indexed[0]!;
    indexed = [
      {
        ...only,
        fact: shrinkUntilFits("- ".length, only.fact, budget),
      },
    ];
  }
  // Restore input order among survivors.
  indexed.sort((a, b) => a.index - b.index);
  return indexed.map(({ id, fact, score }) => ({ id, fact, score }));
}
function fitToBudget<T>(spec: SectionSpec<T>): FittedSection<T> {
  const { name, budget, cut } = spec;

  if (name === "system") {
    const value = spec.value as string;
    return { name, value: value as T, text: value };
  }

  if (name === "summary") {
    const raw = String(spec.value ?? "");
    const trimmed = raw.trim();
    if (cut === "never") {
      return { name, value: trimmed as T, text: trimmed };
    }
    // truncate (default for summary budget)
    const fitted = truncateToBudget(trimmed, budget);
    return { name, value: fitted as T, text: fitted };
  }

  if (name === "history") {
    const history = spec.value as ConversationMessage[];
    const fitted =
      cut === "oldest-first" || cut === "truncate"
        ? fitHistory(history, budget)
        : history.map((m) => ({ ...m }));
    return {
      name,
      value: fitted as T,
      text: formatHistoryText(fitted),
    };
  }

  if (name === "memories") {
    const memories = spec.value as RecalledMemory[];
    const fitted =
      cut === "lowest-score-first" || cut === "truncate"
        ? fitMemories(memories, budget)
        : memories.map((m) => ({ ...m }));
    return {
      name,
      value: fitted as T,
      text: formatMemoriesText(fitted),
    };
  }

  return { name, value: spec.value, text: "" };
}

function assemble(
  fitted: FittedSection<unknown>[],
  message: string,
  system: string,
): BuildContext {
  const byName = Object.fromEntries(fitted.map((f) => [f.name, f])) as Record<
    SectionName,
    FittedSection<unknown>
  >;

  const summary = String(byName.summary?.value ?? "");
  const history = (byName.history?.value as ConversationMessage[]) ?? [];
  const memories = (byName.memories?.value as RecalledMemory[]) ?? [];

  let enrichedMessage = formatMemoriesForPrompt(memories, message);
  enrichedMessage = formatSummaryForPrompt(summary || null, enrichedMessage);

  return {
    system,
    message,
    summary,
    history,
    memories,
    enrichedMessage,
    historyMessages: history.length,
    recalledMemories: memories.length,
    historyText: byName.history?.text ?? "",
    memoriesText: byName.memories?.text ?? "",
    summaryText: summary,
  };
}

/**
 * Monta o contexto com teto por seção.
 * Puro: sem I/O — `runChat` carrega summary/history/memories antes.
 */
export function buildContext(
  input: BuildInput,
  options?: { budgets?: Partial<SectionBudgets>; env?: NodeJS.ProcessEnv },
): BuildContext {
  const B = resolveSectionBudgets(options?.budgets, options?.env ?? process.env);

  const fitted: FittedSection<unknown>[] = [
    fitToBudget(
      section("system", input.system, {
        budget: B.system,
        cut: "never",
      }),
    ),
    // Spec: resumo tem teto (default 200) → truncate.
    fitToBudget(
      section("summary", input.summary ?? "", {
        budget: B.summary,
        cut: "truncate",
      }),
    ),
    fitToBudget(
      section("history", input.history, {
        budget: B.history,
        cut: "oldest-first",
      }),
    ),
    fitToBudget(
      section("memories", input.memories, {
        budget: B.memories,
        cut: "lowest-score-first",
      }),
    ),
  ];
  return assemble(fitted, input.message, input.system);
}
