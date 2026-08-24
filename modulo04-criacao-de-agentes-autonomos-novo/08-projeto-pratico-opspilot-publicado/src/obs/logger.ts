import type { LogLevel, Logger, LogMeta } from "../domain/types.js";

const FORBIDDEN_META_KEYS = new Set([
  "message",
  "answer",
  "trace",
  "content",
  "payload",
  "toolArgs",
  "body",
  "prompt",
]);

export type { LogLevel, Logger, LogMeta };

export interface CreateLoggerOptions {
  write?: (line: string) => void;
  /** Epoch ms provider (tests). */
  now?: () => number;
}

function sanitizeMeta(meta: LogMeta | undefined): LogMeta {
  if (!meta) {
    return {};
  }
  const out: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEYS.has(key)) {
      continue;
    }
    if (
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
    }
  }
  return out;
}

function defaultWrite(line: string): void {
  process.stdout.write(line);
}

/**
 * Structured logger: one JSON line per event, metadata only.
 * Forbidden payload keys are stripped (message/answer/trace/…).
 */
export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  const write = opts.write ?? defaultWrite;
  const now = opts.now ?? (() => Date.now());

  const emit = (level: LogLevel, event: string, meta?: LogMeta): void => {
    const line = JSON.stringify({
      ts: now(),
      level,
      event,
      ...sanitizeMeta(meta),
    });
    write(`${line}\n`);
  };

  return {
    info: (event, meta) => emit("info", event, meta),
    warn: (event, meta) => emit("warn", event, meta),
    error: (event, meta) => emit("error", event, meta),
  };
}
