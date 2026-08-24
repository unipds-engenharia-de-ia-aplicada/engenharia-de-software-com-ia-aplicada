import type { Severity } from "./types.js";

/** Canonical severities stored in SQLite / OpsStore. */
export const SEVERITIES = ["critical", "high", "medium", "low"] as const;

/**
 * Map pager-style aliases (sev1…sev4) and case variants onto DB values.
 * sev1=critical, sev2=high, sev3=medium, sev4=low.
 */
const SEV_ALIASES: Record<string, Severity> = {
  sev1: "critical",
  sev2: "high",
  sev3: "medium",
  sev4: "low",
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

export function normalizeSeverity(value: unknown): Severity | unknown {
  if (typeof value !== "string") {
    return value;
  }
  const key = value.trim().toLowerCase();
  return SEV_ALIASES[key] ?? value;
}

export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITIES as readonly string[]).includes(value);
}
