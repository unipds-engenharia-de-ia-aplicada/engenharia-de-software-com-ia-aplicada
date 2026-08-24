/**
 * Unique model factory: retry on primary → optional fallback reserve → caller sees failure.
 * Ladder: withRetry → withFallbacks → ModelUnavailableError (HTTP 503).
 */
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { LLMResult } from "@langchain/core/outputs";
import { RunnableLambda, type Runnable } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";

import { ModelUnavailableError } from "../domain/errors.js";
import {
  createEmptyTelemetry,
  recordModelSuccess,
  type ModelTelemetry,
} from "../llm/model-telemetry.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_PRIMARY_MODEL = "openai/gpt-4o-mini";
/** Matches classroom sketch (`stopAfterAttempt: 2`). */
export const MODEL_RETRY_ATTEMPTS = 2;

export type OpsChatModel = OpsResilientChatModel;

export function normalizeFallback(
  raw: string | undefined,
  primaryId: string,
): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed === primaryId) {
    return undefined;
  }
  return trimmed;
}

class ModelTelemetryCallback extends BaseCallbackHandler {
  name = "model_telemetry";

  constructor(private readonly modelId: string) {
    super();
  }

  get lc_namespace(): ["langchain_core", "callbacks", string] {
    return ["langchain_core", "callbacks", "model_telemetry"];
  }

  async handleLLMEnd(_output: LLMResult, _runId: string): Promise<void> {
    recordModelSuccess(this.modelId);
  }
}

export function baseModel(modelId: string): ChatOpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  return new ChatOpenAI({
    apiKey,
    model: modelId,
    temperature: 0,
    maxRetries: 0,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
    callbacks: [new ModelTelemetryCallback(modelId)],
  });
}

function wrapModelUnavailable(runnable: Runnable): Runnable {
  return RunnableLambda.from(async (input, config) => {
    try {
      return await runnable.invoke(input, config);
    } catch (error) {
      if (error instanceof ModelUnavailableError) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "All configured language models failed";
      throw new ModelUnavailableError(message);
    }
  });
}

/**
 * Compose primary.withRetry → withFallbacks([backup.withRetry]) per sketch.
 * Sketch used `withFallback(backup)`; LangChain exposes `withFallbacks([backup])`.
 */
export function composeResilientRunnable(
  primary: ChatOpenAI,
  backup?: ChatOpenAI,
): Runnable {
  const primaryRetry = primary.withRetry({ stopAfterAttempt: MODEL_RETRY_ATTEMPTS });
  if (!backup) {
    return wrapModelUnavailable(primaryRetry);
  }
  const backupRetry = backup.withRetry({ stopAfterAttempt: MODEL_RETRY_ATTEMPTS });
  return wrapModelUnavailable(primaryRetry.withFallbacks([backupRetry]));
}

/**
 * Chat-model façade so createReactAgent / withStructuredOutput keep working
 * while every invoke path uses the resilient composition.
 */
export class OpsResilientChatModel {
  readonly primaryModelId: string;
  readonly fallbackModelId?: string;

  constructor(
    private readonly primary: ChatOpenAI,
    private readonly backup: ChatOpenAI | undefined,
    primaryModelId: string,
    fallbackModelId?: string,
  ) {
    this.primaryModelId = primaryModelId;
    this.fallbackModelId = fallbackModelId;
  }

  createTelemetry(): ModelTelemetry {
    return createEmptyTelemetry(this.primaryModelId, this.fallbackModelId);
  }

  bindTools(...args: Parameters<ChatOpenAI["bindTools"]>): Runnable {
    const primaryRetry = (this.primary.bindTools(...args) as ChatOpenAI).withRetry({
      stopAfterAttempt: MODEL_RETRY_ATTEMPTS,
    });
    if (!this.backup) {
      return wrapModelUnavailable(primaryRetry);
    }
    const backupRetry = (this.backup.bindTools(...args) as ChatOpenAI).withRetry({
      stopAfterAttempt: MODEL_RETRY_ATTEMPTS,
    });
    return wrapModelUnavailable(primaryRetry.withFallbacks([backupRetry]));
  }

  withStructuredOutput(...args: Parameters<ChatOpenAI["withStructuredOutput"]>): Runnable {
    const primaryRetry = this.primary.withStructuredOutput(...args).withRetry({
      stopAfterAttempt: MODEL_RETRY_ATTEMPTS,
    });
    if (!this.backup) {
      return wrapModelUnavailable(primaryRetry);
    }
    const backupRetry = this.backup.withStructuredOutput(...args).withRetry({
      stopAfterAttempt: MODEL_RETRY_ATTEMPTS,
    });
    return wrapModelUnavailable(primaryRetry.withFallbacks([backupRetry]));
  }

  invoke(
    input: Parameters<ChatOpenAI["invoke"]>[0],
    options?: Parameters<ChatOpenAI["invoke"]>[1],
  ): ReturnType<ChatOpenAI["invoke"]> {
    return composeResilientRunnable(this.primary, this.backup).invoke(
      input,
      options,
    ) as ReturnType<ChatOpenAI["invoke"]>;
  }

  getPrimary(): ChatOpenAI {
    return this.primary;
  }

  getBackup(): ChatOpenAI | undefined {
    return this.backup;
  }
}

/**
 * Classroom sketch (optional fallback + defaults):
 *
 * ```ts
 * const primary = baseModel(OPENROUTER_MODEL).withRetry({ stopAfterAttempt: 2 });
 * const backup = baseModel(OPENROUTER_MODEL_FALLBACK).withRetry({ stopAfterAttempt: 2 });
 * return primary.withFallbacks([backup]); // sketch: withFallback(backup)
 * ```
 */
export function createModel(): OpsChatModel {
  const primaryId = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_PRIMARY_MODEL;
  const fallbackId = normalizeFallback(process.env.OPENROUTER_MODEL_FALLBACK, primaryId);

  const primary = baseModel(primaryId);
  const backup = fallbackId ? baseModel(fallbackId) : undefined;
  return new OpsResilientChatModel(primary, backup, primaryId, fallbackId);
}
