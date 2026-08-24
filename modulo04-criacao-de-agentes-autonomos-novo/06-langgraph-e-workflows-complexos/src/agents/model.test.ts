import assert from "node:assert/strict";
import test from "node:test";

import { RunnableLambda } from "@langchain/core/runnables";
import type { ChatOpenAI } from "@langchain/openai";

import { ModelUnavailableError } from "../domain/errors.js";
import {
  createEmptyTelemetry,
  getModelTelemetry,
  recordFallbackUsed,
  recordModelSuccess,
  runWithModelTelemetry,
} from "../llm/model-telemetry.js";
import {
  MODEL_RETRY_ATTEMPTS,
  composeResilientRunnable,
  normalizeFallback,
} from "./model.js";

function fakeChatModel(
  fn: () => Promise<string>,
): ChatOpenAI {
  const base = RunnableLambda.from(async () => fn());
  return Object.assign(base, {
    withRetry: ({ stopAfterAttempt }: { stopAfterAttempt: number }) =>
      RunnableLambda.from(async () => fn()).withRetry({ stopAfterAttempt }),
  }) as unknown as ChatOpenAI;
}

test("normalizeFallback trims, drops empty, drops equal-to-primary", () => {
  assert.equal(normalizeFallback(undefined, "a"), undefined);
  assert.equal(normalizeFallback("  ", "a"), undefined);
  assert.equal(normalizeFallback("a", "a"), undefined);
  assert.equal(normalizeFallback("  b  ", "a"), "b");
});

test("MODEL_RETRY_ATTEMPTS matches sketch (2)", () => {
  assert.equal(MODEL_RETRY_ATTEMPTS, 2);
});

test("retry: primary flaky recovers without backup", async () => {
  let primaryCalls = 0;
  const primaryR = RunnableLambda.from(async () => {
    primaryCalls += 1;
    if (primaryCalls < 2) {
      throw new Error("transient");
    }
    return "primary-ok";
  }).withRetry({ stopAfterAttempt: 2 });

  let backupCalls = 0;
  const backupR = RunnableLambda.from(async () => {
    backupCalls += 1;
    return "backup-ok";
  });

  const result = await primaryR.withFallbacks([backupR]).invoke("x");
  assert.equal(result, "primary-ok");
  assert.equal(backupCalls, 0);
  assert.ok(primaryCalls >= 2);
});

test("fallback: primary always fails → backup", async () => {
  let backupCalls = 0;
  const primaryR = RunnableLambda.from(async () => {
    throw new Error("primary down");
  }).withRetry({ stopAfterAttempt: 2 });
  const backupR = RunnableLambda.from(async () => {
    backupCalls += 1;
    return "backup-ok";
  }).withRetry({ stopAfterAttempt: 2 });

  const result = await primaryR.withFallbacks([backupR as never]).invoke("x");
  assert.equal(result, "backup-ok");
  assert.equal(backupCalls, 1);
});

test("composeResilientRunnable all-fail → ModelUnavailableError", async () => {
  const primary = fakeChatModel(async () => {
    throw new Error("primary down");
  });
  const backup = fakeChatModel(async () => {
    throw new Error("backup down");
  });

  await assert.rejects(
    () => composeResilientRunnable(primary, backup).invoke("x"),
    (error: unknown) => error instanceof ModelUnavailableError,
  );
});

test("telemetry ALS records success and fallback", async () => {
  const tel = createEmptyTelemetry("primary-model", "backup-model");
  await runWithModelTelemetry(tel, async () => {
    recordModelSuccess("primary-model");
    assert.equal(getModelTelemetry()?.modelUsed, "primary-model");
    assert.equal(getModelTelemetry()?.fallbackUsed, false);
    recordFallbackUsed();
    assert.equal(getModelTelemetry()?.fallbackUsed, true);
    assert.equal(getModelTelemetry()?.modelUsed, "backup-model");
  });
});
