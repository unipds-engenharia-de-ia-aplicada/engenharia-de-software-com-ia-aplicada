import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyTelemetry,
  getModelTelemetry,
  recordFallbackUsed,
  recordModelSuccess,
  runWithModelTelemetry,
} from "./model-telemetry.js";

test("runWithModelTelemetry isolates store per async context", async () => {
  const a = createEmptyTelemetry("p-a", "f-a");
  const b = createEmptyTelemetry("p-b");

  await Promise.all([
    runWithModelTelemetry(a, async () => {
      recordModelSuccess("p-a");
      assert.equal(getModelTelemetry()?.primaryModel, "p-a");
      assert.equal(getModelTelemetry()?.modelUsed, "p-a");
    }),
    runWithModelTelemetry(b, async () => {
      recordModelSuccess("p-b");
      assert.equal(getModelTelemetry()?.fallbackModel, undefined);
      assert.equal(getModelTelemetry()?.modelUsed, "p-b");
    }),
  ]);
});

test("recordFallbackUsed sets modelUsed to fallback id", async () => {
  const tel = createEmptyTelemetry("primary", "reserve");
  await runWithModelTelemetry(tel, async () => {
    recordFallbackUsed();
    assert.equal(getModelTelemetry()?.fallbackUsed, true);
    assert.equal(getModelTelemetry()?.modelUsed, "reserve");
  });
});
