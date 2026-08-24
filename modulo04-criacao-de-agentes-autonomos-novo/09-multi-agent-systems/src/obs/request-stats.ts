/**
 * Estimate USD cost for prompt tokens.
 * Models with `:free` (OpenRouter free tier) are always 0.
 * Other models use a coarse default rate when no price table exists.
 */
const DEFAULT_USD_PER_1M_PROMPT = 0.15;

export function isFreeModel(model: string | null | undefined): boolean {
  if (!model) {
    return false;
  }
  return model.includes(":free");
}

export function estimatePromptCostUsd(
  model: string | null | undefined,
  promptTokens: number,
): number {
  if (promptTokens <= 0) {
    return 0;
  }
  if (isFreeModel(model)) {
    return 0;
  }
  return (promptTokens / 1_000_000) * DEFAULT_USD_PER_1M_PROMPT;
}

/** Parse `24h`, `7d`, `30m`, `90s` → milliseconds. */
export function parseSinceDuration(raw: string): number | null {
  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(raw.trim());
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  const unit = match[2]!.toLowerCase();
  const mult =
    unit === "ms"
      ? 1
      : unit === "s"
        ? 1_000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 3_600_000
            : 86_400_000;
  return n * mult;
}

/** Nearest-rank percentile on a sorted copy; null if empty. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const idx = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[idx]!;
}
