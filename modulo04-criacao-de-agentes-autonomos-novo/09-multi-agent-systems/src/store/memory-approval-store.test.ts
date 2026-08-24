import assert from "node:assert/strict";
import test from "node:test";

import { MemoryApprovalStore, truncateSummary } from "./memory-approval-store.js";

test("MemoryApprovalStore save/get/take", () => {
  const store = new MemoryApprovalStore();
  const saved = store.save({
    requestId: "11111111-1111-4111-8111-111111111111",
    createdAt: 1,
    summary: "hello",
    conversationId: null,
    chatRequest: {
      message: "hello",
      userId: "war-room",
      reflect: false,
    },
  });

  assert.equal(store.get(saved.approvalId)?.summary, "hello");
  const taken = store.take(saved.approvalId);
  assert.equal(taken?.approvalId, saved.approvalId);
  assert.equal(store.get(saved.approvalId), null);
  assert.equal(store.take(saved.approvalId), null);
});

test("truncateSummary caps length", () => {
  const long = "x".repeat(300);
  assert.equal(truncateSummary(long).length, 240);
  assert.ok(truncateSummary(long).endsWith("…"));
});
