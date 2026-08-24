import assert from "node:assert/strict";
import test from "node:test";

import { createLogger } from "./logger.js";

test("info emits one JSON line with ts/level/event", () => {
  const lines: string[] = [];
  const logger = createLogger({
    write: (line) => lines.push(line),
    now: () => 12345,
  });
  logger.info("chat_request_end", { requestId: "rid", latencyMs: 9 });
  assert.equal(lines.length, 1);
  assert.ok(lines[0]!.endsWith("\n"));
  const parsed = JSON.parse(lines[0]!.trim()) as Record<string, unknown>;
  assert.equal(parsed.ts, 12345);
  assert.equal(parsed.level, "info");
  assert.equal(parsed.event, "chat_request_end");
  assert.equal(parsed.requestId, "rid");
  assert.equal(parsed.latencyMs, 9);
});

test("strips forbidden meta keys", () => {
  const lines: string[] = [];
  const logger = createLogger({ write: (line) => lines.push(line) });
  logger.info("chat_request_start", {
    requestId: "x",
    message: "secret user text",
    answer: "secret",
    content: "no",
    payload: "no",
    toolArgs: "no",
    body: "no",
    prompt: "no",
    httpStatus: 200,
  } as Parameters<typeof logger.info>[1] & Record<string, unknown>);
  const parsed = JSON.parse(lines[0]!.trim()) as Record<string, unknown>;
  assert.equal(parsed.requestId, "x");
  assert.equal(parsed.httpStatus, 200);
  assert.equal("message" in parsed, false);
  assert.equal("answer" in parsed, false);
  assert.equal("content" in parsed, false);
  assert.equal("payload" in parsed, false);
  assert.equal("toolArgs" in parsed, false);
  assert.equal("body" in parsed, false);
  assert.equal("prompt" in parsed, false);
});

test("two calls produce two lines", () => {
  const lines: string[] = [];
  const logger = createLogger({ write: (line) => lines.push(line) });
  logger.info("a");
  logger.error("b", { requestId: "r" });
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]!.trim()).event, "a");
  assert.equal(JSON.parse(lines[1]!.trim()).event, "b");
});
