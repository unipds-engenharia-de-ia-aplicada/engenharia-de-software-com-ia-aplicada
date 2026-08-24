import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/conversa-longa.sh",
);

test("conversa-longa.sh prints promptTokens with n/a fallback", () => {
  const source = readFileSync(scriptPath, "utf8");
  assert.match(source, /\.metrics\.promptTokens\s*\/\/\s*"n\/a"/);
  assert.match(source, /promptTokens=%s/);
});

test("conversa-longa.sh prints conversationId on every turn", () => {
  const source = readFileSync(scriptPath, "utf8");
  assert.match(source, /conversationId=%s/);
  assert.match(
    source,
    /printf 'turno %02d \| conversationId=%s/,
  );
});
